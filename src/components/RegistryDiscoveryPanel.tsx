import { AlertTriangle, ArrowRight, CheckCircle2, ExternalLink, RefreshCw, ShieldAlert } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { CategoryId } from '../catalog'
import type { RegistryAgentDiscovery } from '../services/agentRegistry'

type Props = {
  categoryId: CategoryId
  registryTotal?: number
  agents?: RegistryAgentDiscovery[]
  isPending: boolean
  error: unknown
}

function readiness(agent: RegistryAgentDiscovery) {
  const callable = Boolean(agent.mcpEndpoint || agent.a2aEndpoint)
  if (agent.isActive && agent.endpointVerified && callable) {
    return { label: 'Ready for qualification', className: 'is-positive', icon: CheckCircle2 }
  }
  return { label: 'Metadata only', className: '', icon: ShieldAlert }
}

export function RegistryDiscoveryPanel({ categoryId, registryTotal, agents = [], isPending, error }: Props) {
  const navigate = useNavigate()

  return (
    <section className="registry-discovery is-primary" aria-labelledby="registry-discovery-title">
      <div className="registry-discovery-heading">
        <div>
          <span className="section-kicker">LIVE ERC-8004 MARKETPLACE · BNB CHAIN</span>
          <h2 id="registry-discovery-title">Agents found across the open registry</h2>
          <p>
            Semantic discovery searches {registryTotal ? registryTotal.toLocaleString() : 'the live BNB Chain registry'} identities by the mandate you created. Results are external records, not MANDATE-owned samples.
          </p>
        </div>
        <span className="discovery-count">{isPending ? 'SEARCHING' : error ? 'UNAVAILABLE' : `${agents.length} FOUND`}</span>
      </div>

      {error ? (
        <div className="inline-error"><AlertTriangle size={18} /><div><strong>Live marketplace search unavailable</strong><p>{error instanceof Error ? error.message : 'Try the search again later.'}</p></div></div>
      ) : isPending ? (
        <div className="discovery-loading"><RefreshCw className="spin" size={17} /> Searching names, descriptions, capabilities and declared services…</div>
      ) : agents.length ? (
        <div className="registry-agent-list">
          <div className="registry-agent-head" aria-hidden="true"><span>External agent</span><span>Service</span><span>Trust signals</span><span>Qualification</span><span /></div>
          {agents.map((agent) => {
            const state = readiness(agent)
            const ReadinessIcon = state.icon
            return (
              <article className="registry-agent-row" key={agent.tokenId}>
                <div className="registry-agent-identity">
                  <small className="mono">ERC-8004 #{agent.tokenId} · {Math.round((agent.similarityScore ?? 0) * 100)}% relevance</small>
                  <strong>{agent.name}</strong>
                  <p>{agent.description}</p>
                </div>
                <div data-label="Service">
                  <strong>{agent.mcpEndpoint ? 'MCP' : agent.a2aEndpoint ? 'A2A' : agent.supportedProtocols.join(' · ') || 'No callable service'}</strong>
                  <small>{agent.endpointVerified ? 'Endpoint verified' : 'Endpoint not verified'}</small>
                </div>
                <div data-label="Trust signals">
                  <strong>{agent.totalScore.toFixed(1)} registry score</strong>
                  <small>{agent.totalFeedbacks} feedback · health {agent.healthScore ?? '—'}</small>
                </div>
                <div className={`registry-readiness ${state.className}`} data-label="Qualification">
                  <ReadinessIcon size={15} /><span><strong>{state.label}</strong><small>Hard limits checked on detail</small></span>
                </div>
                <button className="button button-secondary compact-button" type="button" onClick={() => navigate(`/registry-agent/${agent.tokenId}?category=${categoryId}`)}>
                  Review <ArrowRight size={14} />
                </button>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="empty-state">No relevant external identity was returned. Publish the unchanged requirement as an Open Mandate instead of accepting a false match.</div>
      )}

      <a className="registry-source-link" href="https://8004scan.io/agents?network=bsc" target="_blank" rel="noreferrer">Inspect the source registry <ExternalLink size={14} /></a>
    </section>
  )
}
