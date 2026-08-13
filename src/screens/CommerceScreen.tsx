import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ExternalLink, FileCheck2, LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react'
import { formatUnits, keccak256, parseEventLogs, stringToHex, zeroAddress } from 'viem'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { bscTestnet } from 'wagmi/chains'
import { U_TOKEN_ADDRESS } from '../services/uFaucet'
import {
  buildYieldDeliverableManifest,
  commerceAbi,
  type CommerceJob,
  ERC8183_BUDGET,
  ERC8183_COMMERCE_ADDRESS,
  ERC8183_DISPUTE_WINDOW,
  ERC8183_POLICY_ADDRESS,
  ERC8183_ROUTER_ADDRESS,
  exactApprovalAbi,
  jobStatusLabels,
  routerAbi,
  stableStringify,
  YIELD_REFERENCE_PATH,
  YIELD_REFERENCE_SHA256,
} from '../services/erc8183'

const STORAGE_KEY = 'mandate:erc8183-yield-route:v1'
const expectedWallet = (
  import.meta.env.VITE_SUBMISSION_WALLET_ADDRESS ?? '0xD30BbB80c863c9B94622EF92337AaD65148D2EC3'
).toLowerCase()

type ChainState = { job: CommerceJob; policy: `0x${string}`; allowance: bigint; policyAllowed: boolean }
type ActionName = 'create' | 'register' | 'budget' | 'approve' | 'fund' | 'submit' | 'settle'

const loadJobId = () => {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored && /^\d+$/.test(stored) ? BigInt(stored) : undefined
}

const actionCopy: Record<ActionName, { title: string; detail: string }> = {
  create: { title: 'Create YieldRoute proof job', detail: 'Creates an OPEN ERC-8183 job for the public live-data report. No tokens move.' },
  register: { title: 'Bind optimistic policy', detail: 'Registers the official Router policy. No tokens move.' },
  budget: { title: 'Set 0.1 U budget', detail: 'Records the exact mandate ceiling. No tokens move.' },
  approve: { title: 'Approve exactly 0.1 U', detail: 'One exact ERC-20 allowance to AgenticCommerce. Never unlimited.' },
  fund: { title: 'Fund escrow with 0.1 U', detail: 'Moves 0.1 test U into the official ERC-8183 escrow.' },
  submit: { title: 'Submit YieldRoute deliverable', detail: 'Anchors the live report manifest hash and public retrieval URL.' },
  settle: { title: 'Settle after dispute window', detail: 'Permissionless settlement after the current 15-minute optimistic window.' },
}

export function CommerceScreen() {
  const { address, chainId, isConnected } = useAccount()
  const walletClient = useWalletClient()
  const publicClient = usePublicClient({ chainId: bscTestnet.id })
  const [jobId, setJobId] = useState<bigint | undefined>(loadJobId)
  const [chainState, setChainState] = useState<ChainState>()
  const [activeAction, setActiveAction] = useState<ActionName>()
  const [latestHash, setLatestHash] = useState<`0x${string}`>()
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => BigInt(Math.floor(Date.now() / 1000)))

  const validWallet = Boolean(isConnected && address?.toLowerCase() === expectedWallet && chainId === bscTestnet.id)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(BigInt(Math.floor(Date.now() / 1000))), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const refresh = useCallback(async () => {
    if (!publicClient || !address || jobId === undefined) return
    try {
      const [job, policy, allowance, policyAllowed] = await Promise.all([
        publicClient.readContract({ address: ERC8183_COMMERCE_ADDRESS, abi: commerceAbi, functionName: 'getJob', args: [jobId] }),
        publicClient.readContract({ address: ERC8183_ROUTER_ADDRESS, abi: routerAbi, functionName: 'jobPolicy', args: [jobId] }),
        publicClient.readContract({ address: U_TOKEN_ADDRESS, abi: exactApprovalAbi, functionName: 'allowance', args: [address, ERC8183_COMMERCE_ADDRESS] }),
        publicClient.readContract({ address: ERC8183_ROUTER_ADDRESS, abi: routerAbi, functionName: 'policyWhitelist', args: [ERC8183_POLICY_ADDRESS] }),
      ])
      setChainState({ job: job as CommerceJob, policy, allowance, policyAllowed })
      setError('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to read ERC-8183 state.')
    }
  }, [address, jobId, publicClient])

  useEffect(() => { void refresh() }, [refresh])

  const nextAction = useMemo<ActionName | 'waiting' | 'complete'>(() => {
    if (jobId === undefined || !chainState) return jobId === undefined ? 'create' : 'waiting'
    // Terminal kernel state is authoritative. Router deliberately clears the
    // per-job policy mapping after finalisation, so policy must not be checked
    // before COMPLETED or the UI would incorrectly offer registration again.
    if (chainState.job.status === 3) return 'complete'
    if (chainState.policy.toLowerCase() === zeroAddress) return chainState.policyAllowed ? 'register' : 'waiting'
    if (chainState.job.budget !== ERC8183_BUDGET) return 'budget'
    if (chainState.job.status === 0 && chainState.allowance < ERC8183_BUDGET) return 'approve'
    if (chainState.job.status === 0) return 'fund'
    if (chainState.job.status === 1) return 'submit'
    if (chainState.job.status === 2) {
      return now >= chainState.job.submittedAt + ERC8183_DISPUTE_WINDOW ? 'settle' : 'waiting'
    }
    return 'waiting'
  }, [chainState, jobId, now])

  const settlementAt = chainState?.job.submittedAt
    ? chainState.job.submittedAt + ERC8183_DISPUTE_WINDOW
    : undefined
  const remainingSeconds = settlementAt && settlementAt > now ? Number(settlementAt - now) : 0

  const broadcast = async (action: ActionName) => {
    if (!walletClient.data || !publicClient || !address || !validWallet) return
    setActiveAction(action)
    setError('')
    try {
      let hash: `0x${string}`
      if (action === 'create') {
        const negotiatedAt = Math.floor(Date.now() / 1000)
        const description = JSON.stringify({
          version: 1,
          negotiated_at: negotiatedAt,
          task: 'Run YieldRoute against a live public BSC stablecoin yield snapshot, apply the 5,000 USDT high-risk no-leverage mandate, and return a hash-verifiable read-only recommendation.',
          terms: {
            deliverables: ['YieldRoute JSON evidence', 'SDK-compatible manifest', 'on-chain deliverable hash', 'public retrieval URL'],
            quality_standards: ['live public data snapshot', 'no live asset execution', 'bounded 0.1 U test budget', 'truthful limitations'],
            success_criteria: ['job funded', 'deliverable submitted', 'optimistic policy settles'],
          },
          price: ERC8183_BUDGET.toString(),
          currency: U_TOKEN_ADDRESS,
        })
        const request = await publicClient.simulateContract({
          account: address,
          address: ERC8183_COMMERCE_ADDRESS,
          abi: commerceAbi,
          functionName: 'createJob',
          args: [address, ERC8183_ROUTER_ADDRESS, BigInt(negotiatedAt + 259_200), description, ERC8183_ROUTER_ADDRESS],
        })
        hash = await walletClient.data.writeContract({ ...request.request, chain: bscTestnet })
        const receipt = await publicClient.waitForTransactionReceipt({ hash })
        const [created] = parseEventLogs({ abi: commerceAbi, eventName: 'JobCreated', logs: receipt.logs, strict: false })
        const createdId = created?.args.jobId
        if (createdId === undefined) throw new Error('JobCreated event was not found in the confirmed receipt.')
        localStorage.setItem(STORAGE_KEY, createdId.toString())
        setJobId(createdId)
      } else {
        if (jobId === undefined) throw new Error('No job ID is available.')
        if (action === 'register') {
          const request = await publicClient.simulateContract({ account: address, address: ERC8183_ROUTER_ADDRESS, abi: routerAbi, functionName: 'registerJob', args: [jobId, ERC8183_POLICY_ADDRESS] })
          hash = await walletClient.data.writeContract({ ...request.request, chain: bscTestnet })
        } else if (action === 'budget') {
          const request = await publicClient.simulateContract({ account: address, address: ERC8183_COMMERCE_ADDRESS, abi: commerceAbi, functionName: 'setBudget', args: [jobId, ERC8183_BUDGET, '0x'] })
          hash = await walletClient.data.writeContract({ ...request.request, chain: bscTestnet })
        } else if (action === 'approve') {
          const request = await publicClient.simulateContract({ account: address, address: U_TOKEN_ADDRESS, abi: exactApprovalAbi, functionName: 'approve', args: [ERC8183_COMMERCE_ADDRESS, ERC8183_BUDGET] })
          hash = await walletClient.data.writeContract({ ...request.request, chain: bscTestnet })
        } else if (action === 'fund') {
          const request = await publicClient.simulateContract({ account: address, address: ERC8183_COMMERCE_ADDRESS, abi: commerceAbi, functionName: 'fund', args: [jobId, ERC8183_BUDGET, '0x'] })
          hash = await walletClient.data.writeContract({ ...request.request, chain: bscTestnet })
        } else if (action === 'submit') {
          const manifest = buildYieldDeliverableManifest(jobId)
          const deliverableHash = keccak256(stringToHex(stableStringify(manifest)))
          const deliverableUrl = `${window.location.origin}/api/erc8183/yield-deliverable/${jobId}`
          const optParams = stringToHex(JSON.stringify({ deliverable_url: deliverableUrl, evidence_sha256: YIELD_REFERENCE_SHA256 }))
          const request = await publicClient.simulateContract({ account: address, address: ERC8183_COMMERCE_ADDRESS, abi: commerceAbi, functionName: 'submit', args: [jobId, deliverableHash, optParams] })
          hash = await walletClient.data.writeContract({ ...request.request, chain: bscTestnet })
        } else {
          const request = await publicClient.simulateContract({ account: address, address: ERC8183_ROUTER_ADDRESS, abi: routerAbi, functionName: 'settle', args: [jobId, '0x'] })
          hash = await walletClient.data.writeContract({ ...request.request, chain: bscTestnet })
        }
        await publicClient.waitForTransactionReceipt({ hash })
        await refresh()
      }
      setLatestHash(hash)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Transaction failed or was rejected.')
    } finally {
      setActiveAction(undefined)
    }
  }

  const steps: ActionName[] = ['create', 'register', 'budget', 'approve', 'fund', 'submit', 'settle']
  const activeIndex = nextAction === 'complete'
    ? steps.length
    : nextAction === 'waiting'
      ? chainState?.job.status === 2
        ? 6
        : jobId === undefined
          ? 0
          : 1
      : steps.indexOf(nextAction)

  return (
    <section className="commerce-screen page-gutter">
      <div className="commerce-heading">
        <span className="section-kicker">YIELDROUTE PROOF JOB · BSC TESTNET</span>
        <h1>Anchor a real agent result</h1>
        <p>One real YieldRoute report, one public evidence file and seven explicit ERC-8183 steps. Every write is simulated before Bitget receives a signing request.</p>
      </div>

      <div className="yield-proof-source">
        <FileCheck2 size={19} />
        <div><strong>Evidence is fixed before the job is created</strong><p>Lista Lending USDT · 5.01909% observed APY · 5,000 USDT mandate · analysis only</p></div>
        <a href={YIELD_REFERENCE_PATH} target="_blank" rel="noreferrer">Open public JSON <ExternalLink size={13} /></a>
        <code>{YIELD_REFERENCE_SHA256}</code>
      </div>

      <div className="registration-guard" role="status">
        <ShieldCheck size={18} />
        <div><strong>Hard transaction boundaries</strong><p>Wallet 0xD30B…2EC3 · Chain 97 · Budget 0.1 test U · Exact approval only · Current policy whitelist verified</p></div>
        <span className={validWallet ? 'guard-ready' : 'guard-blocked'}>{validWallet ? 'WALLET VERIFIED' : 'CONNECT VERIFIED WALLET'}</span>
      </div>

      <div className="commerce-summary">
        <div><small>Job</small><strong>{jobId === undefined ? 'Not created' : `#${jobId}`}</strong></div>
        <div><small>Status</small><strong>{chainState ? jobStatusLabels[chainState.job.status] ?? `STATE ${chainState.job.status}` : 'READY'}</strong></div>
        <div><small>Escrow budget</small><strong>0.1 U</strong></div>
        <div><small>Current allowance</small><strong>{chainState ? `${formatUnits(chainState.allowance, 18)} U` : '0 U'}</strong></div>
      </div>

      <div className="commerce-steps">
        {steps.map((step, index) => {
          const complete = index < activeIndex
          const current = nextAction === step
          return (
            <article className={complete ? 'is-complete' : current ? 'is-current' : ''} key={step}>
              <span className="commerce-step-index">{complete ? <CheckCircle2 size={18} /> : `0${index + 1}`}</span>
              <div><strong>{actionCopy[step].title}</strong><p>{actionCopy[step].detail}</p></div>
              {current ? (
                <button className="button button-primary" type="button" disabled={!validWallet || Boolean(activeAction)} onClick={() => broadcast(step)}>
                  {activeAction === step ? <><LoaderCircle className="spin" size={16} /> Confirming…</> : `Sign step ${index + 1}`}
                </button>
              ) : <span className="commerce-step-state">{complete ? 'CONFIRMED' : 'LOCKED'}</span>}
            </article>
          )
        })}
      </div>

      {nextAction === 'waiting' && chainState?.job.status === 2 ? (
        <div className="commerce-wait"><LockKeyhole size={18} /><div><strong>Deliverable submitted — optimistic window active</strong><p>Settlement unlocks in approximately {Math.ceil(remainingSeconds / 3600)} hours. No signature is needed while waiting.</p></div></div>
      ) : null}
      {nextAction === 'complete' ? <div className="commerce-complete"><CheckCircle2 size={19} /> ERC-8183 pilot fully settled on-chain.</div> : null}
      {error ? <div className="inline-error" role="alert"><div><strong>Nothing was broadcast beyond the confirmed step</strong><p>{error}</p></div></div> : null}
      {latestHash ? <a className="faucet-proof" href={`https://testnet.bscscan.com/tx/${latestHash}`} target="_blank" rel="noreferrer">Latest transaction proof <ExternalLink size={14} /></a> : null}
    </section>
  )
}
