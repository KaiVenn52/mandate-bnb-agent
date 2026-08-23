import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, CheckCircle2, ExternalLink, LoaderCircle, Radio, Search, ShieldCheck } from 'lucide-react'
import { parseEventLogs, zeroAddress } from 'viem'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { bscTestnet } from 'wagmi/chains'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getCategory } from '../catalog'
import { commerceAbi, type CommerceJob, ERC8183_COMMERCE_ADDRESS, ERC8183_ROUTER_ADDRESS, jobStatusLabels } from '../services/erc8183'
import { loadMandateDraft } from '../services/mandateDraft'

const storageKey = (address: string, category: string) => `mandate:open-job:v1:${address.toLowerCase()}:${category}`

export function OpenMandateScreen() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const category = getCategory(searchParams.get('category'))
  const draft = loadMandateDraft()
  const mandate = draft?.categoryId === category.id ? draft : null
  const { address, chainId, isConnected } = useAccount()
  const walletClient = useWalletClient()
  const publicClient = usePublicClient({ chainId: bscTestnet.id })
  const queryJobId = searchParams.get('jobId')
  const [jobId, setJobId] = useState<bigint | undefined>(() => queryJobId && /^\d+$/.test(queryJobId) ? BigInt(queryJobId) : undefined)
  const [job, setJob] = useState<CommerceJob>()
  const [latestHash, setLatestHash] = useState<`0x${string}`>()
  const [isPublishing, setIsPublishing] = useState(false)
  const [error, setError] = useState('')
  const walletReady = Boolean(isConnected && address && chainId === bscTestnet.id)

  useEffect(() => {
    if (jobId !== undefined || !address) return
    const stored = localStorage.getItem(storageKey(address, category.id))
    if (stored && /^\d+$/.test(stored)) setJobId(BigInt(stored))
  }, [address, category.id, jobId])

  const refresh = useCallback(async () => {
    if (!publicClient || jobId === undefined) return
    try {
      const result = await publicClient.readContract({ address: ERC8183_COMMERCE_ADDRESS, abi: commerceAbi, functionName: 'getJob', args: [jobId] })
      setJob(result as CommerceJob)
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to read this open mandate.')
    }
  }, [jobId, publicClient])

  useEffect(() => { void refresh() }, [refresh])

  const publish = async () => {
    if (!mandate || !walletReady || !address || !walletClient.data || !publicClient) return
    setIsPublishing(true)
    setError('')
    try {
      const createdAt = Math.floor(Date.now() / 1000)
      const description = JSON.stringify({
        version: 1,
        type: 'open-mandate',
        provider: 'unassigned',
        category: category.id,
        mandate: mandate.prompt,
        constraints: mandate.constraints,
        service_budget_ceiling: '0.1 test U',
        bidding: 'offchain-provider-proposals; client-assigns-provider-before-funding',
        evidence_requirements: ['ERC-8004 identity', 'bounded decision', 'public deliverable manifest', 'onchain deliverable hash'],
      })
      const request = await publicClient.simulateContract({
        account: address,
        address: ERC8183_COMMERCE_ADDRESS,
        abi: commerceAbi,
        functionName: 'createJob',
        args: [zeroAddress, ERC8183_ROUTER_ADDRESS, BigInt(createdAt + 604_800), description, ERC8183_ROUTER_ADDRESS],
      })
      const hash = await walletClient.data.writeContract({ ...request.request, chain: bscTestnet })
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      const [created] = parseEventLogs({ abi: commerceAbi, eventName: 'JobCreated', logs: receipt.logs, strict: false })
      const createdId = created?.args.jobId
      if (createdId === undefined) throw new Error('JobCreated event was not found in the confirmed receipt.')
      localStorage.setItem(storageKey(address, category.id), createdId.toString())
      const nextParams = new URLSearchParams(searchParams)
      nextParams.set('category', category.id)
      nextParams.set('jobId', createdId.toString())
      setSearchParams(nextParams, { replace: true })
      setJobId(createdId)
      setLatestHash(hash)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Open mandate publication failed or was rejected.')
    } finally {
      setIsPublishing(false)
    }
  }

  if (!mandate) {
    return (
      <section className="open-mandate-screen page-gutter">
        <button className="text-button back-button" type="button" onClick={() => navigate('/')}><ArrowLeft size={16} /> Back</button>
        <div className="inline-error"><div><strong>No built mandate is available</strong><p>Build and save a mandate before publishing an open marketplace request.</p></div></div>
      </section>
    )
  }

  const providerUnassigned = !job || job.provider.toLowerCase() === zeroAddress
  return (
    <section className="open-mandate-screen page-gutter">
      <button className="text-button back-button" type="button" onClick={() => navigate(`/results?category=${category.id}`)}><ArrowLeft size={16} /> Back to matching</button>
      <div className="open-mandate-heading">
        <span className="section-kicker">OPEN MANDATE · ERC-8183 · BSC TESTNET</span>
        <h1>Publish the requirement, not a fake match.</h1>
        <p>No disclosed agent satisfies every hard limit. This creates an OPEN ERC-8183 job with no provider assigned. It moves no tokens and preserves your mandate exactly.</p>
      </div>

      <div className="open-mandate-flow" aria-label="Open mandate workflow">
        <div className="is-complete"><CheckCircle2 size={18} /><span><small>01</small><strong>Mandate built</strong><p>{mandate.prompt}</p></span></div>
        <div className="is-complete"><Search size={18} /><span><small>02</small><strong>Marketplace searched</strong><p>No disclosed provider passed every hard limit.</p></span></div>
        <div className={job ? 'is-complete' : 'is-current'}><Radio size={18} /><span><small>03</small><strong>Open mandate</strong><p>{job ? `Public Job #${jobId} is waiting for provider proposals.` : 'Publish an unassigned job for provider discovery and offchain bidding.'}</p></span></div>
      </div>

      <section className="open-mandate-contract" aria-labelledby="open-contract-title">
        <div>
          <span className="section-kicker">IMMUTABLE JOB BRIEF</span>
          <h2 id="open-contract-title">{category.label} open mandate</h2>
          <p>{mandate.prompt}</p>
        </div>
        <dl>
          <div><dt>Client</dt><dd className="mono">{job ? job.client : address ?? 'Connect wallet'}</dd></div>
          <div><dt>Provider</dt><dd className="mono">{providerUnassigned ? 'UNASSIGNED' : job?.provider}</dd></div>
          <div><dt>Status</dt><dd>{job ? jobStatusLabels[job.status] ?? `STATE ${job.status}` : 'NOT PUBLISHED'}</dd></div>
          <div><dt>Escrow</dt><dd>0 U · not funded</dd></div>
          <div><dt>Provider assignment</dt><dd>Client only · before funding</dd></div>
          <div><dt>Expiry</dt><dd>{job ? new Date(Number(job.expiredAt) * 1000).toLocaleString() : '7 days after publication'}</dd></div>
        </dl>
        {!job ? (
          <button className="button button-primary open-publish-button" type="button" disabled={!walletReady || isPublishing} onClick={publish}>
            {isPublishing ? <><LoaderCircle className="spin" size={17} /> Confirming publication…</> : <><Radio size={17} /> Publish open mandate</>}
          </button>
        ) : (
          <div className="open-mandate-published"><ShieldCheck size={19} /><div><strong>Open mandate published onchain</strong><p>Provider bidding stays offchain by ERC-8183 design. Funding remains locked until you explicitly assign a provider.</p></div></div>
        )}
      </section>

      {!walletReady && !job ? <div className="registration-guard"><ShieldCheck size={18} /><div><strong>Connect a BSC Testnet client wallet</strong><p>Publication needs one createJob signature and a small amount of testnet gas. No token approval or escrow occurs.</p></div><span className="guard-blocked">WALLET REQUIRED</span></div> : null}
      {error ? <div className="inline-error" role="alert"><div><strong>Nothing was broadcast beyond the confirmed step</strong><p>{error}</p></div></div> : null}
      {latestHash ? <a className="faucet-proof" href={`https://testnet.bscscan.com/tx/${latestHash}`} target="_blank" rel="noreferrer">Open publication transaction <ExternalLink size={14} /></a> : null}
    </section>
  )
}
