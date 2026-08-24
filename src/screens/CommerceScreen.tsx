import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ExternalLink, FileCheck2, LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react'
import { formatUnits, keccak256, parseEventLogs, stringToHex, zeroAddress } from 'viem'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { bscTestnet } from 'wagmi/chains'
import { useSearchParams } from 'react-router-dom'
import { getCategory } from '../catalog'
import { U_TOKEN_ADDRESS } from '../services/uFaucet'
import {
  buildMarketplaceDeliverableManifest,
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
  YIELD_REFERENCE_SHA256,
} from '../services/erc8183'
import { loadMandateDraft } from '../services/mandateDraft'
import { authorizationFromMandate } from '../services/mandateAuthorization'

const STORAGE_KEY = 'mandate:erc8183-marketplace-job:v3'
const TERMIX_TASK_BY_CATEGORY = {
  yield: 'A-01',
  grid: 'A-02',
  health: 'A-03',
} as const
type ChainState = { job: CommerceJob; policy: `0x${string}`; allowance: bigint; policyAllowed: boolean }
type ActionName = 'create' | 'register' | 'budget' | 'approve' | 'fund' | 'submit' | 'settle'

const loadJobId = (key: string) => {
  const stored = localStorage.getItem(key)
  return stored && /^\d+$/.test(stored) ? BigInt(stored) : undefined
}

const actionCopy: Record<ActionName, { title: string; detail: string }> = {
  create: { title: 'Create agent hire job', detail: 'Creates an OPEN ERC-8183 job for the selected provider and this exact mandate. No tokens move.' },
  register: { title: 'Bind optimistic policy', detail: 'Registers the official Router policy. No tokens move.' },
  budget: { title: 'Set 0.1 U budget', detail: 'Records the exact mandate ceiling. No tokens move.' },
  approve: { title: 'Approve exactly 0.1 U', detail: 'One exact ERC-20 allowance to AgenticCommerce. Never unlimited.' },
  fund: { title: 'Fund escrow with 0.1 U', detail: 'Moves 0.1 test U into the official ERC-8183 escrow.' },
  submit: { title: 'Submit agent deliverable', detail: 'Anchors the category result manifest hash and public retrieval URL.' },
  settle: { title: 'Settle after dispute window', detail: 'Permissionless settlement after the current 15-minute optimistic window.' },
}

export function CommerceScreen() {
  const { address, chainId, isConnected } = useAccount()
  const [searchParams, setSearchParams] = useSearchParams()
  const category = getCategory(searchParams.get('category'))
  const agent = category.agents.find((item) => item.id === searchParams.get('agent')) ?? category.agents[0]
  const draft = loadMandateDraft()
  const authorization = authorizationFromMandate(category, agent, draft)
  const mandatePrompt = draft?.categoryId === category.id ? draft.prompt : category.prompt
  const walletClient = useWalletClient()
  const publicClient = usePublicClient({ chainId: bscTestnet.id })
  const [jobId, setJobId] = useState<bigint | undefined>()
  const [chainState, setChainState] = useState<ChainState>()
  const [activeAction, setActiveAction] = useState<ActionName>()
  const [latestHash, setLatestHash] = useState<`0x${string}`>()
  const [error, setError] = useState('')
  const [externalDeliverableHash, setExternalDeliverableHash] = useState('')
  const [externalDeliverableUrl, setExternalDeliverableUrl] = useState('')
  const [now, setNow] = useState(() => BigInt(Math.floor(Date.now() / 1000)))

  const storageKey = `${STORAGE_KEY}:${category.id}:${agent.id}`
  const queryJobId = searchParams.get('jobId')
  const validQueryJobId = queryJobId && /^\d+$/.test(queryJobId) ? BigInt(queryJobId) : undefined
  const isTestnetWallet = Boolean(isConnected && address && chainId === bscTestnet.id)

  useEffect(() => {
    setJobId(validQueryJobId ?? loadJobId(storageKey))
    setChainState(undefined)
    setLatestHash(undefined)
    setError('')
  }, [storageKey, validQueryJobId])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(BigInt(Math.floor(Date.now() / 1000))), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const refresh = useCallback(async () => {
    if (!publicClient || jobId === undefined) return
    try {
      const [jobResult, policy, policyAllowed] = await Promise.all([
        publicClient.readContract({ address: ERC8183_COMMERCE_ADDRESS, abi: commerceAbi, functionName: 'getJob', args: [jobId] }),
        publicClient.readContract({ address: ERC8183_ROUTER_ADDRESS, abi: routerAbi, functionName: 'jobPolicy', args: [jobId] }),
        publicClient.readContract({ address: ERC8183_ROUTER_ADDRESS, abi: routerAbi, functionName: 'policyWhitelist', args: [ERC8183_POLICY_ADDRESS] }),
      ])
      const job = jobResult as CommerceJob
      const allowance = await publicClient.readContract({ address: U_TOKEN_ADDRESS, abi: exactApprovalAbi, functionName: 'allowance', args: [job.client, ERC8183_COMMERCE_ADDRESS] })
      setChainState({ job, policy, allowance, policyAllowed })
      setError('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to read ERC-8183 state.')
    }
  }, [jobId, publicClient])

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

  const walletRole = !address || !chainState
    ? undefined
    : address.toLowerCase() === chainState.job.client.toLowerCase()
      ? 'client'
      : address.toLowerCase() === chainState.job.provider.toLowerCase()
        ? 'provider'
        : 'observer'
  const isExternalProvider = Boolean(chainState && agent.providerAddress && chainState.job.provider.toLowerCase() !== agent.providerAddress.toLowerCase())
  const externalDeliverableReady = /^0x[0-9a-fA-F]{64}$/.test(externalDeliverableHash) && /^https:\/\//i.test(externalDeliverableUrl)
  const termixTaskId = category.id in TERMIX_TASK_BY_CATEGORY
    ? TERMIX_TASK_BY_CATEGORY[category.id as keyof typeof TERMIX_TASK_BY_CATEGORY]
    : undefined
  const publicDeliverableUrl = jobId === undefined
    ? undefined
    : termixTaskId
      ? `/api/benchmarks/${termixTaskId}/hire-deliverable/${jobId}`
      : `/api/erc8183/marketplace-deliverable/${category.id}/${jobId}`

  const canSignAction = (action: ActionName) => {
    if (!isTestnetWallet || !address || !agent.providerAddress) return false
    if (action === 'create') return address.toLowerCase() !== agent.providerAddress.toLowerCase()
    if (action === 'submit') return walletRole === 'provider' && (!isExternalProvider || externalDeliverableReady)
    if (action === 'settle') return true
    return walletRole === 'client'
  }

  const broadcast = async (action: ActionName) => {
    if (!walletClient.data || !publicClient || !address || !canSignAction(action)) return
    setActiveAction(action)
    setError('')
    try {
      let hash: `0x${string}`
      if (action === 'create') {
        const negotiatedAt = Math.floor(Date.now() / 1000)
        if (!agent.providerAddress) throw new Error('The selected provider does not have a verified BSC identity.')
        const description = JSON.stringify({
          version: 1,
          negotiated_at: negotiatedAt,
          task: mandatePrompt,
          category: category.id,
          agent: { id: agent.id, name: agent.name, provider: agent.providerAddress },
          terms: {
            capital_ceiling: authorization.capital,
            risk_ceiling: draft?.constraints.riskMax ?? 'category default',
            leverage_ceiling: draft?.constraints.leverageMax ?? 0,
            protocols: authorization.protocols,
            activity_ceiling: draft ? `${draft.constraints.actionCap}/${draft.constraints.actionPeriod}` : 'category default',
            deliverables: ['category decision evidence', 'SDK-compatible manifest', 'on-chain deliverable hash', 'public retrieval URL'],
            quality_standards: ['bounded decision', 'no live asset execution', 'exact 0.1 U test service budget', 'truthful evidence mode'],
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
          args: [agent.providerAddress, ERC8183_ROUTER_ADDRESS, BigInt(negotiatedAt + 259_200), description, ERC8183_ROUTER_ADDRESS],
        })
        hash = await walletClient.data.writeContract({ ...request.request, chain: bscTestnet })
        const receipt = await publicClient.waitForTransactionReceipt({ hash })
        const [created] = parseEventLogs({ abi: commerceAbi, eventName: 'JobCreated', logs: receipt.logs, strict: false })
        const createdId = created?.args.jobId
        if (createdId === undefined) throw new Error('JobCreated event was not found in the confirmed receipt.')
        localStorage.setItem(storageKey, createdId.toString())
        setJobId(createdId)
        const nextParams = new URLSearchParams(searchParams)
        nextParams.set('category', category.id)
        nextParams.set('agent', agent.id)
        nextParams.set('jobId', createdId.toString())
        setSearchParams(nextParams, { replace: true })
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
          if (isExternalProvider && !externalDeliverableReady) throw new Error('External provider must supply its own bytes32 deliverable hash and public HTTPS retrieval URL.')
          let deliverableHash: `0x${string}`
          let deliverableUrl: string
          if (isExternalProvider) {
            deliverableHash = externalDeliverableHash as `0x${string}`
            deliverableUrl = externalDeliverableUrl
          } else if (termixTaskId) {
            deliverableUrl = `${window.location.origin}/api/benchmarks/${termixTaskId}/hire-deliverable/${jobId}`
            const response = await fetch(deliverableUrl, { headers: { Accept: 'application/json' } })
            if (!response.ok) {
              const detail = await response.text()
              throw new Error(`The independent hire is not eligible for a TermiX deliverable yet (${response.status}): ${detail}`)
            }
            const deliverable = await response.json() as unknown
            deliverableHash = keccak256(stringToHex(stableStringify(deliverable)))
          } else {
            const manifest = buildMarketplaceDeliverableManifest(jobId, category.id)
            deliverableHash = keccak256(stringToHex(stableStringify(manifest)))
            deliverableUrl = `${window.location.origin}/api/erc8183/marketplace-deliverable/${category.id}/${jobId}`
          }
          const optParams = stringToHex(JSON.stringify({
            deliverable_url: deliverableUrl,
            ...(termixTaskId ? { termix_task_id: termixTaskId, hash_canonicalization: 'recursive-key-sorted compact JSON, then keccak256(UTF-8)' } : {}),
            ...(category.id === 'yield' && !termixTaskId ? { evidence_sha256: YIELD_REFERENCE_SHA256 } : {}),
          }))
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
        <span className="section-kicker">{category.label.toUpperCase()} HIRE · BSC TESTNET</span>
        <h1>{isExternalProvider ? 'Complete the Open Mandate hire' : `Hire ${agent.name} onchain`}</h1>
        <p>Your connected wallet becomes the client, the assigned address is the separate provider, and explicit ERC-8183 steps create a public service receipt. Client and provider sign only their own protocol actions; every write is simulated first.</p>
      </div>

      <div className="yield-proof-source">
        <FileCheck2 size={19} />
        <div><strong>Service terms are fixed before the job is created</strong><p>{mandatePrompt} · analysis/decision service only</p></div>
        {publicDeliverableUrl ? <a href={publicDeliverableUrl} target="_blank" rel="noreferrer">Open hire-backed deliverable <ExternalLink size={13} /></a> : <span>Created after funding</span>}
        <code>{termixTaskId ? `${termixTaskId} · independent hire required` : category.id === 'yield' ? YIELD_REFERENCE_SHA256 : `${category.id} · deterministic category deliverable`}</code>
      </div>

      <div className="registration-guard" role="status">
        <ShieldCheck size={18} />
        <div><strong>Hard transaction boundaries</strong><p>Client {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : 'your wallet'} · Provider {chainState ? `${chainState.job.provider.slice(0, 6)}…${chainState.job.provider.slice(-4)}` : `Agent #${agent.id}`} · Chain 97 · Budget 0.1 test U · Exact approval only</p></div>
        <span className={isTestnetWallet ? 'guard-ready' : 'guard-blocked'}>{isTestnetWallet ? `${walletRole?.toUpperCase() ?? 'CLIENT'} WALLET READY` : 'CONNECT BSC TESTNET WALLET'}</span>
      </div>

      <div className="commerce-summary">
        <div><small>Job</small><strong>{jobId === undefined ? 'Not created' : `#${jobId}`}</strong></div>
        <div><small>Status</small><strong>{chainState ? jobStatusLabels[chainState.job.status] ?? `STATE ${chainState.job.status}` : 'READY'}</strong></div>
        <div><small>Escrow budget</small><strong>0.1 U</strong></div>
        <div><small>Current allowance</small><strong>{chainState ? `${formatUnits(chainState.allowance, 18)} U` : '0 U'}</strong></div>
      </div>

      {isExternalProvider && chainState?.job.status === 1 ? (
        <section className="open-mandate-contract" aria-labelledby="external-deliverable-title">
          <div><span className="section-kicker">PROVIDER-OWNED DELIVERABLE</span><h2 id="external-deliverable-title">Submit the accepted provider's real output</h2><p>MANDATE will not fabricate evidence for an external agent. The assigned provider must connect its wallet and supply a public HTTPS result plus the exact bytes32 hash it produced.</p></div>
          <label>Public deliverable URL<input type="url" placeholder="https://provider.example/result/506.json" value={externalDeliverableUrl} onChange={(event) => setExternalDeliverableUrl(event.target.value)} /></label>
          <label>Deliverable hash (bytes32)<input className="mono" placeholder="0x + 64 hexadecimal characters" value={externalDeliverableHash} onChange={(event) => setExternalDeliverableHash(event.target.value.trim())} spellCheck={false} /></label>
          <div className={`registration-guard ${externalDeliverableReady ? '' : 'is-blocked'}`}><ShieldCheck size={18} /><div><strong>{externalDeliverableReady ? 'External evidence is structurally ready' : 'Waiting for valid provider evidence'}</strong><p>The provider transaction will still be simulated before the wallet can broadcast it.</p></div></div>
        </section>
      ) : null}

      <div className="commerce-steps">
        {steps.map((step, index) => {
          const complete = index < activeIndex
          const current = nextAction === step
          return (
            <article className={complete ? 'is-complete' : current ? 'is-current' : ''} key={step}>
              <span className="commerce-step-index">{complete ? <CheckCircle2 size={18} /> : `0${index + 1}`}</span>
              <div><strong>{actionCopy[step].title}</strong><p>{actionCopy[step].detail}</p></div>
              {current ? (
                canSignAction(step) ? (
                  <button className="button button-primary" type="button" disabled={Boolean(activeAction)} onClick={() => broadcast(step)}>
                    {activeAction === step ? <><LoaderCircle className="spin" size={16} /> Confirming…</> : `Sign step ${index + 1}`}
                  </button>
                ) : (
                  <span className="commerce-step-state">
                    {step === 'submit' ? 'WAITING FOR PROVIDER' : step === 'create' && isTestnetWallet ? 'USE A SEPARATE CLIENT WALLET' : 'CLIENT WALLET REQUIRED'}
                  </span>
                )
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
