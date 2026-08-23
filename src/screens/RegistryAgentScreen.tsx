import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, ExternalLink, Radio, Search, ShieldAlert, ShieldCheck, WalletCards } from 'lucide-react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getCategory } from '../catalog'
import { fetchRegistryAgent } from '../services/agentRegistry'
import { loadMandateDraft } from '../services/mandateDraft'

export function RegistryAgentScreen() {
  const navigate = useNavigate()
  const { tokenId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const category = getCategory(searchParams.get('category'))
  const draft = loadMandateDraft()
  const mandate = draft?.categoryId === category.id ? draft : null
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
  const hasCallableService = Boolean(agent.mcpEndpoint || agent.a2aEndpoint)
  const canQualify = agent.isActive && agent.endpointVerified && hasCallableService
  const candidateParams = new URLSearchParams({ category: category.id, candidate: agent.tokenId })

  return (
    <section className="registry-agent-screen page-gutter">
      <button className="text-button back-button" type="button" onClick={() => navigate(`/results?category=${category.id}`)}><ArrowLeft size={16} /> Back to marketplace</button>

      <header className="registry-profile-header">
        <div>
          <span className="section-kicker">EXTERNAL ERC-8004 AGENT · BNB CHAIN MAINNET</span>
          <h1>{agent.name}</h1>
          <p>{agent.description}</p>
        </div>
        <div className={`registry-profile-state ${canQualify ? 'is-positive' : ''}`}>
          {canQualify ? <CheckCircle2 size={20} /> : <ShieldAlert size={20} />}
          <span><strong>{canQualify ? 'Ready for qualification' : 'Discovery only'}</strong><small>{canQualify ? 'Callable endpoint and domain verified' : 'Do not fund from registry metadata alone'}</small></span>
        </div>
      </header>

      <div className="registry-profile-layout">
        <main>
          <section className="qualification-panel">
            <div className="section-heading"><div><h2>Mandate qualification</h2><p>Identity discovery is automatic. Financial permissions require stronger evidence.</p></div></div>
            <div className="qualification-list">
              <div className="is-pass"><CheckCircle2 size={17} /><span><strong>Onchain identity</strong><p>Agent #{agent.tokenId} is indexed on BNB Chain mainnet.</p></span><b>PASS</b></div>
              <div className={agent.isActive ? 'is-pass' : 'is-blocked'}>{agent.isActive ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}<span><strong>Active registration</strong><p>The registry marks this identity as {agent.isActive ? 'active' : 'inactive'}.</p></span><b>{agent.isActive ? 'PASS' : 'BLOCKED'}</b></div>
              <div className={hasCallableService ? 'is-review' : 'is-blocked'}>{hasCallableService ? <Radio size={17} /> : <AlertTriangle size={17} />}<span><strong>Callable service</strong><p>{agent.mcpEndpoint ? 'MCP endpoint declared.' : agent.a2aEndpoint ? 'A2A endpoint declared.' : 'No MCP or A2A endpoint declared.'}</p></span><b>{hasCallableService ? 'REVIEW' : 'BLOCKED'}</b></div>
              <div className={agent.endpointVerified ? 'is-pass' : 'is-review'}>{agent.endpointVerified ? <CheckCircle2 size={17} /> : <ShieldAlert size={17} />}<span><strong>Endpoint ownership</strong><p>{agent.endpointVerified ? 'Endpoint domain ownership is verified.' : 'The advertised endpoint is not domain-verified.'}</p></span><b>{agent.endpointVerified ? 'PASS' : 'UNVERIFIED'}</b></div>
              <div className="is-review"><Search size={17} /><span><strong>Mandate compatibility</strong><p>{mandate ? `${category.label}: ${mandate.prompt}` : 'Create a mandate to evaluate financial constraints.'}</p></span><b>PROPOSAL NEEDED</b></div>
              <div className="is-blocked"><ShieldCheck size={17} /><span><strong>Capital, leverage, risk and price</strong><p>The registry does not provide enforceable values for these limits. Assignment and funding stay blocked until the provider accepts the exact brief.</p></span><b>NOT PROVEN</b></div>
            </div>
          </section>

          <section className="external-invite-panel">
            <div><h2>Invite this agent without pretending it already qualifies.</h2><p>Create an unfunded ERC-8183 Open Mandate that references this identity. The provider must accept the exact limits before you assign it or fund escrow.</p></div>
            <button className="button button-primary" type="button" disabled={!mandate || !agent.isActive} onClick={() => navigate(`/open-mandate?${candidateParams}`)}>Invite with Open Mandate <ArrowRight size={16} /></button>
          </section>
        </main>

        <aside className="registry-profile-evidence">
          <h2>Registry evidence</h2>
          <dl>
            <div><dt>Global identity</dt><dd className="mono">{agent.agentId}</dd></div>
            <div><dt>Owner</dt><dd className="mono">{agent.ownerAddress ?? 'Not disclosed'}</dd></div>
            <div><dt>Agent wallet</dt><dd className="mono">{agent.agentWallet ?? 'Not verified'}</dd></div>
            <div><dt>Protocols</dt><dd>{agent.supportedProtocols.join(' · ') || 'None declared'}</dd></div>
            <div><dt>Registry score</dt><dd>{agent.totalScore.toFixed(2)}</dd></div>
            <div><dt>Feedback</dt><dd>{agent.totalFeedbacks}</dd></div>
            <div><dt>Health score</dt><dd>{agent.healthScore ?? 'Not available'}</dd></div>
          </dl>
          <div className="registry-service-proof"><WalletCards size={17} /><div><strong>Declared service</strong><p className="mono">{agent.mcpEndpoint ?? agent.a2aEndpoint ?? 'No callable endpoint'}</p></div></div>
          <a href={`https://8004scan.io/agents/56/${agent.tokenId}`} target="_blank" rel="noreferrer">Open 8004scan record <ExternalLink size={14} /></a>
          {agent.createdTxHash ? <a href={`https://bscscan.com/tx/${agent.createdTxHash}`} target="_blank" rel="noreferrer">Open registration transaction <ExternalLink size={14} /></a> : null}
        </aside>
      </div>
    </section>
  )
}
