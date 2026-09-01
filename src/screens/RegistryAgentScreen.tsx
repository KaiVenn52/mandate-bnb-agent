import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, Copy, ExternalLink, LoaderCircle, Radio, Search, ShieldAlert, ShieldCheck, WalletCards } from 'lucide-react'
import { isAddress } from 'viem'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getCategory } from '../catalog'
import { fetchRegistryAgent, isPublicHttpsEndpoint } from '../services/agentRegistry'
import { loadMandateDraft, parseMandate, saveMandateDraft } from '../services/mandateDraft'
import { buildProviderAcceptanceRequest, mandateDigest, requestProviderAcceptance, type ProviderAcceptanceReceipt } from '../services/providerAcceptance'

export function RegistryAgentScreen() {
  const navigate = useNavigate()
  const { tokenId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const category = getCategory(searchParams.get('category'))
  const savedDraft = loadMandateDraft()
  // A registry profile is reachable by a direct URL. Never bind a mandate
  // from another category to this candidate's acceptance digest.
  const mandate = savedDraft?.categoryId === category.id ? savedDraft : null
  const [copied, setCopied] = useState(false)
  const [acceptance, setAcceptance] = useState<ProviderAcceptanceReceipt | null>(null)
  const [acceptanceError, setAcceptanceError] = useState('')
  const [requestingAcceptance, setRequestingAcceptance] = useState(false)
  const query = useQuery({
    queryKey: ['erc-8004-agent', tokenId],
    queryFn: ({ signal }) => fetchRegistryAgent(tokenId, signal),
    staleTime: 5 * 60_000,
    retry: 1,
  })

  if (query.isPending) return <div className="route-loading">Reading ERC-8004 Agent #{tokenId}…</div>
  if (query.isError) {
    return <section className="registry-agent-screen page-gutter"><button className="text-button back-button" type="button" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Back</button><div className="inline-error"><AlertTriangle size={20} /><div><strong>Agent record unavailable</strong><p>{query.error instanceof Error ? query.error.message : 'The registry record could not be loaded.'}</p></div></div></section>
  }

  const agent = query.data
  const declaredService = [agent.mcpEndpoint, agent.a2aEndpoint].find((endpoint) => isPublicHttpsEndpoint(endpoint)) ?? agent.mcpEndpoint ?? agent.a2aEndpoint
  const hasCallableService = isPublicHttpsEndpoint(declaredService)
  const providerWallet = agent.agentWallet ?? agent.ownerAddress
  const hasProviderWallet = Boolean(providerWallet && isAddress(providerWallet))
  const sameNetwork = agent.chainId === 97
  // Domain verification is a trust signal, not a hard prerequisite for the
  // cryptographic handoff. The provider still has to sign the exact mandate
  // digest; assignment and funding remain impossible without that receipt.
  const canQualify = sameNetwork && agent.isActive && hasCallableService && hasProviderWallet
  const candidateMandateDigest = hasProviderWallet
    ? mandateDigest({ categoryId: category.id, mandate: mandate?.prompt ?? category.prompt, tokenId: agent.tokenId, providerAddress: providerWallet as string })
    : null
  const mandateBrief = JSON.stringify({
    version: 1,
    type: 'mandate-provider-request',
    candidate: { token_id: agent.tokenId, agent_id: agent.agentId, name: agent.name, provider_wallet: providerWallet },
    category: category.id,
    mandate: mandate?.prompt ?? category.prompt,
    mandate_digest: candidateMandateDigest,
    acceptance_endpoint: declaredService,
    acceptance: 'Provider must accept this exact brief before assignment or funding.',
    evidence: ['callable endpoint', 'provider wallet signature', 'public deliverable URL', 'bytes32 deliverable hash'],
  }, null, 2)

  const copyBrief = async () => {
    await navigator.clipboard?.writeText(mandateBrief)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }
  const candidateParams = new URLSearchParams({ category: category.id, candidate: agent.tokenId })

  const continueWithAcceptance = () => {
    // Direct ERC-8004 profile links are a supported marketplace entry point.
    // If this browser has no draft yet, persist the exact category mandate
    // that the provider just signed so OpenMandateScreen can reproduce the
    // same digest and constraints instead of presenting a disabled dead end.
    if (!mandate) saveMandateDraft(parseMandate(category.prompt, category.id))
    navigate(`/open-mandate?${candidateParams}${acceptance ? `&acceptance=${encodeURIComponent(acceptance.mandate_digest)}` : ''}`)
  }

  const requestAcceptance = async () => {
    setAcceptanceError('')
    setAcceptance(null)
    setRequestingAcceptance(true)
    try {
      const { request } = buildProviderAcceptanceRequest({
        categoryId: category.id,
        mandate,
        categoryPrompt: category.prompt,
        agent,
        serviceBudgetToken: 'U on BSC Testnet',
      })
      const receipt = await requestProviderAcceptance(agent, request)
      setAcceptance(receipt)
    } catch (reason) {
      setAcceptanceError(reason instanceof Error ? reason.message : 'The provider did not return a verifiable acceptance receipt.')
    } finally {
      setRequestingAcceptance(false)
    }
  }

  return (
    <section className="registry-agent-screen page-gutter">
      <button className="text-button back-button" type="button" onClick={() => navigate(`/results?category=${category.id}`)}><ArrowLeft size={16} /> Back to marketplace</button>

      <header className="registry-profile-header">
        <div>
          <span className="section-kicker">EXTERNAL ERC-8004 AGENT · BNB CHAIN {agent.chainId === 97 ? 'TESTNET' : agent.chainId ? 'MAINNET' : 'NETWORK UNKNOWN'}</span>
          <h1>{agent.name}</h1>
          <p>{agent.description}</p>
        </div>
        <div className={`registry-profile-state ${canQualify ? 'is-positive' : ''}`}>
          {canQualify ? <CheckCircle2 size={20} /> : <ShieldAlert size={20} />}
          <span><strong>{canQualify ? (agent.endpointVerified ? 'Callable · acceptance required' : 'Callable · provider signature required') : 'Discovery only'}</strong><small>{canQualify ? 'The endpoint can be contacted; the provider must sign the exact brief before assignment.' : 'Do not fund from registry metadata alone'}</small></span>
        </div>
      </header>

      <div className="registry-profile-layout">
        <main>
          <section className="qualification-panel">
            <div className="section-heading"><div><h2>Mandate qualification</h2><p>Identity discovery is automatic. Financial permissions require stronger evidence.</p></div></div>
            <div className="qualification-list">
              <div className={sameNetwork ? 'is-pass' : 'is-blocked'}>{sameNetwork ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}<span><strong>Onchain identity</strong><p>Agent #{agent.tokenId} is indexed on BNB Chain {agent.chainId === 97 ? 'Testnet' : agent.chainId ? 'mainnet' : 'an unknown network'}.</p></span><b>{sameNetwork ? 'PASS' : 'WRONG NETWORK'}</b></div>
              <div className={agent.isActive ? 'is-pass' : 'is-blocked'}>{agent.isActive ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}<span><strong>Active registration</strong><p>The registry marks this identity as {agent.isActive ? 'active' : 'inactive'}.</p></span><b>{agent.isActive ? 'PASS' : 'BLOCKED'}</b></div>
              <div className={hasCallableService ? 'is-review' : 'is-blocked'}>{hasCallableService ? <Radio size={17} /> : <AlertTriangle size={17} />}<span><strong>Callable service</strong><p>{declaredService ? (hasCallableService ? `${agent.mcpEndpoint === declaredService ? 'MCP' : 'A2A'} public HTTPS endpoint declared.` : 'The declared service is not a public HTTPS endpoint.') : 'No MCP or A2A endpoint declared.'}</p></span><b>{hasCallableService ? 'REVIEW' : 'BLOCKED'}</b></div>
              <div className={agent.endpointVerified ? 'is-pass' : 'is-review'}>{agent.endpointVerified ? <CheckCircle2 size={17} /> : <ShieldAlert size={17} />}<span><strong>Endpoint ownership</strong><p>{agent.endpointVerified ? 'Endpoint domain ownership is verified.' : 'Registry domain verification is absent; the provider signature will be checked against its published wallet.'}</p></span><b>{agent.endpointVerified ? 'PASS' : 'UNVERIFIED'}</b></div>
              <div className={hasProviderWallet ? 'is-pass' : 'is-blocked'}>{hasProviderWallet ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}<span><strong>Provider wallet</strong><p>{hasProviderWallet ? `${providerWallet} is a valid EVM address.` : 'No valid provider wallet is published for assignment.'}</p></span><b>{hasProviderWallet ? 'VISIBLE' : 'BLOCKED'}</b></div>
              <div className="is-review"><Search size={17} /><span><strong>Mandate compatibility</strong><p>{mandate ? `${category.label}: ${mandate.prompt}` : 'Create a mandate to evaluate financial constraints.'}</p></span><b>PROPOSAL NEEDED</b></div>
              <div className="is-blocked"><ShieldCheck size={17} /><span><strong>Capital, leverage, risk and price</strong><p>The registry does not provide enforceable values for these limits. Assignment and funding stay blocked until the provider accepts the exact brief.</p></span><b>NOT PROVEN</b></div>
            </div>
          </section>

          <section className="external-invite-panel">
            <div><h2>Turn discovery into a direct, verifiable hire.</h2><p>Request a signed response now. MANDATE first tries its compact acceptance schema, then the official BNBAgent A2A <span className="mono">message/send</span> negotiation flow when an agent card advertises it. A verified response binds this exact mandate, provider wallet and 0.1 U ceiling before assignment. If the endpoint is offline or fails either schema, create an unfunded Open Mandate and invite the provider.</p></div>
            <div className="external-acceptance-actions">
              <button className="button button-secondary" type="button" disabled={!canQualify || requestingAcceptance} onClick={requestAcceptance}>
                {requestingAcceptance ? <><LoaderCircle className="spin" size={16} /> Requesting signed acceptance…</> : <><WalletCards size={16} /> Request signed acceptance</>}
              </button>
              <small>{canQualify ? 'Calls the provider endpoint; no wallet transaction is broadcast.' : 'Requires an active BSC Testnet identity, HTTPS endpoint and provider wallet.'}</small>
            </div>
            {acceptance ? <div className="external-acceptance-success" role="status"><CheckCircle2 size={17} /><div><strong>Acceptance verified</strong><p className="mono">Digest {acceptance.mandate_digest.slice(0, 12)}…{acceptance.mandate_digest.slice(-8)} · signed by {acceptance.provider_address.slice(0, 6)}…{acceptance.provider_address.slice(-4)}</p></div></div> : null}
            {acceptanceError ? <div className="external-acceptance-error" role="alert"><ShieldAlert size={16} /><span>{acceptanceError}</span></div> : null}
            <div className="external-invite-actions">
              <button className="button button-secondary" type="button" onClick={copyBrief}>{copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Brief copied' : 'Copy provider brief'}</button>
              <button className="button button-primary" type="button" disabled={!agent.isActive} onClick={continueWithAcceptance}>{acceptance ? 'Use verified acceptance' : 'Create Open Mandate'} <ArrowRight size={16} /></button>
            </div>
          </section>
        </main>

        <aside className="registry-profile-evidence">
          <h2>Registry evidence</h2>
          <dl>
            <div><dt>Global identity</dt><dd className="mono">{agent.agentId}</dd></div>
            <div><dt>Owner</dt><dd className="mono">{agent.ownerAddress ?? 'Not disclosed'}</dd></div>
            <div><dt>Agent wallet</dt><dd className="mono">{agent.agentWallet ?? 'Not verified'}</dd></div>
            <div><dt>x402</dt><dd>{agent.x402Supported ? 'Advertised by registry' : 'Not advertised'}</dd></div>
            <div><dt>Protocols</dt><dd>{agent.supportedProtocols.join(' · ') || 'None declared'}</dd></div>
            <div><dt>Registry score</dt><dd>{agent.totalScore.toFixed(2)}</dd></div>
            <div><dt>Feedback</dt><dd>{agent.totalFeedbacks}</dd></div>
            <div><dt>Health score</dt><dd>{agent.healthScore ?? 'Not available'}</dd></div>
          </dl>
          <div className="registry-service-proof"><WalletCards size={17} /><div><strong>Declared service</strong><p className="mono">{agent.mcpEndpoint ?? agent.a2aEndpoint ?? 'No callable endpoint'}</p></div></div>
          {agent.parseWarnings.length ? <div className="registry-service-proof"><ShieldAlert size={17} /><div><strong>Registry parser warnings</strong><p>{agent.parseWarnings.slice(0, 2).join(' · ')}</p></div></div> : null}
          <a href={`https://8004scan.io/agents/${agent.chainId}/${agent.tokenId}`} target="_blank" rel="noreferrer">Open 8004scan record <ExternalLink size={14} /></a>
          {agent.createdTxHash ? <a href={`https://bscscan.com/tx/${agent.createdTxHash}`} target="_blank" rel="noreferrer">Open registration transaction <ExternalLink size={14} /></a> : null}
        </aside>
      </div>
    </section>
  )
}
