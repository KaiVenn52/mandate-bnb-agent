import { AlertTriangle, ArrowRight, CheckCircle2, ExternalLink, RefreshCw, ShieldAlert } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { CategoryId } from '../catalog'
import { isPublicHttpsEndpoint, type RegistryAgentDiscovery } from '../services/agentRegistry'

type Props = {
  categoryId: CategoryId
  registryTotal?: number
  registryStale?: boolean
  agents?: RegistryAgentDiscovery[]
  isPending: boolean
  error: unknown
  onRetry?: () => void
}

function readiness(agent: RegistryAgentDiscovery) {
  const callable = [agent.mcpEndpoint, agent.a2aEndpoint].some((endpoint) => isPublicHttpsEndpoint(endpoint))
  const hasProviderWallet = Boolean(agent.agentWallet || agent.ownerAddress)
  const sameNetwork = agent.chainId === 97
  if (sameNetwork && agent.isActive && callable && hasProviderWallet) {
    if (agent.endpointVerified) {
      return { label: 'Callable · acceptance required', className: 'is-positive', icon: CheckCircle2, detail: 'Endpoint + provider wallet found; provider must accept the immutable brief.' }
    }
    // Registry domain verification is helpful, but the decisive control is a
    // provider EIP-191 signature over this exact mandate. Let a real endpoint
    // be contacted instead of forcing every self-attested provider into Invite.
    return { label: 'Callable · provider signature required', className: 'is-review', icon: ShieldAlert, detail: 'Endpoint is self-attested; request a provider signature before assignment.' }
  }
  if (agent.isActive && hasProviderWallet) {
    return { label: sameNetwork ? 'Inviteable · endpoint unverified' : 'Inviteable · wrong network', className: 'is-neutral', icon: ShieldAlert, detail: sameNetwork ? 'Open Mandate can be prepared, but assignment stays blocked until the service is verified.' : 'This identity is on BNB Chain mainnet; the BSC Testnet job cannot assign it.' }
  }
  return { label: 'Discovery only', className: '', icon: ShieldAlert, detail: 'No verified provider wallet and callable service are both available.' }
}

export function RegistryDiscoveryPanel({ categoryId, registryTotal, registryStale = false, agents = [], isPending, error, onRetry }: Props) {
  const navigate = useNavigate()

  return (
    <section className="registry-discovery is-primary" aria-labelledby="registry-discovery-title">
      <div className="registry-discovery-heading">
        <div>
          <span className="section-kicker">LIVE ERC-8004 MARKETPLACE · BSC TESTNET</span>
          <h2 id="registry-discovery-title">Agents found across the open registry</h2>
          <p>
            Semantic discovery searches {registryTotal ? registryTotal.toLocaleString() : 'the live BNB Chain registry'} identities by the mandate you created. Results are external records, not MANDATE-owned samples.
          </p>
          {registryStale ? <small className="registry-cache-warning">Registry cache is temporarily stale; verify the provider record and receipt before acting.</small> : null}
        </div>
        <span className="discovery-count">{isPending ? 'SEARCHING' : error ? 'UNAVAILABLE' : `${agents.length} FOUND`}</span>
      </div>

      {error ? (
        <div className="inline-error"><AlertTriangle size={18} /><div><strong>Live marketplace search unavailable</strong><p>{error instanceof Error ? error.message : 'Try the search again later.'}</p>{onRetry ? <button className="button button-secondary compact-button" type="button" onClick={onRetry}><RefreshCw size={14} /> Retry search</button> : null}</div></div>
      ) : isPending ? (
        <div className="discovery-loading"><RefreshCw className="spin" size={17} /> Searching names, descriptions, capabilities and declared services…</div>
      ) : agents.length ? (
        <div className="registry-agent-list">
          <div className="registry-agent-head" aria-hidden="true"><span>External agent</span><span>Service</span><span>Trust signals</span><span>Qualification</span><span /></div>
          {agents.map((agent) => {
            const state = readiness(agent)
            const ReadinessIcon = state.icon
            const directRequestReady = state.label.startsWith('Callable')
            return (
              <article className="registry-agent-row" key={agent.tokenId}>
                <div className="registry-agent-identity">
                  <small className="mono">ERC-8004 #{agent.tokenId} · {Math.round((agent.similarityScore ?? 0) * 100)}% relevance{agent.registryStale ? ' · cached' : ''}</small>
                  <strong>{agent.name}</strong>
                  <p>{agent.description}</p>
                </div>
                <div data-label="Service">
                  <strong>{isPublicHttpsEndpoint(agent.mcpEndpoint) ? 'MCP' : isPublicHttpsEndpoint(agent.a2aEndpoint) ? 'A2A' : agent.supportedProtocols.join(' · ') || 'No callable service'}</strong>
                  <small>{agent.endpointVerified ? 'Endpoint verified' : 'Endpoint not verified'} · BNB Chain {agent.chainId === 97 ? 'Testnet' : agent.chainId ? 'mainnet' : 'network unknown'}{agent.x402Supported ? ' · x402 advertised' : ''}</small>
                </div>
                <div data-label="Trust signals">
                  <strong>{agent.totalScore.toFixed(1)} registry score</strong>
                  <small>{agent.totalFeedbacks} feedback · health {agent.healthScore ?? '—'}</small>
                </div>
                <div className={`registry-readiness ${state.className}`} data-label="Qualification">
                  <ReadinessIcon size={15} /><span><strong>{state.label}</strong><small>{state.detail}</small></span>
                </div>
                <div className="registry-agent-actions">
                  <button className="button button-secondary compact-button" type="button" onClick={() => navigate(`/registry-agent/${agent.tokenId}?category=${categoryId}`)}>
                    Review <ArrowRight size={14} />
                  </button>
                  <button className="button button-primary compact-button" type="button" disabled={!agent.isActive} onClick={() => navigate(directRequestReady ? `/registry-agent/${agent.tokenId}?category=${categoryId}` : `/open-mandate?category=${categoryId}&candidate=${agent.tokenId}`)}>
                    {directRequestReady ? 'Request hire' : 'Invite'} <ArrowRight size={14} />
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="empty-state">No relevant external identity was returned. Publish the unchanged requirement as an Open Mandate instead of accepting a false match.</div>
      )}

      <a className="registry-source-link" href="https://8004scan.io/agents?network=bsc-testnet" target="_blank" rel="noreferrer">Inspect the source registry <ExternalLink size={14} /></a>
    </section>
  )
}
