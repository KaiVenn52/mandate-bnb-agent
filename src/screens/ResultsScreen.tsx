import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calculator,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileCheck2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { categorySheets } from '../data'
import { categories, categoryOrder, getCategory } from '../catalog'
import { fetchRegistrySnapshot, searchRegistryAgents } from '../services/agentRegistry'
import { loadMandateDraft, parseMandate } from '../services/mandateDraft'
import { matchAgents } from '../services/agentMatching'
import { LiveYieldRoute } from '../components/LiveYieldRoute'
import { LiveMarketAgent } from '../components/LiveMarketAgent'
import { LiveVenusAgent } from '../components/LiveVenusAgent'
import { RegistryDiscoveryPanel } from '../components/RegistryDiscoveryPanel'

const hireActivity = {
  grid: { hash: '0x110a45c0e374ab9297143a0dd428850141e29732bca5c7f678dbe0af9d88f1a9', label: 'Completed ERC-8183 Job #644' },
  yield: { hash: '0x65075a013ca176bf1e4c6abedd4de61bf94140ad227ca9cd100c298aa98b19df', label: 'Completed ERC-8183 Job #642' },
  health: { hash: '0xc939266cea840943359333fe83d99db50c91799bc9c64e2acbef297a083a13d1', label: 'Completed ERC-8183 Job #666' },
} as const

export function ResultsScreen() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const category = getCategory(searchParams.get('category'))
  const savedDraft = loadMandateDraft()
  const isSavedMandate = savedDraft?.categoryId === category.id
  const draft = isSavedMandate ? savedDraft : parseMandate(category.prompt, category.id)
  const mandateSummary = draft.summary
  // Only identities backed by an onchain registration and a callable MANDATE
  // service are inventory. The remaining catalog rows are benchmark fixtures,
  // never marketplace recommendations.
  const inventoryCategory = { ...category, agents: category.agents.filter((agent) => agent.providerAddress && agent.registrationTxHash) }
  const agents = matchAgents(inventoryCategory, draft)
  const eligibleCount = agents.filter((agent) => agent.status === 'satisfies').length
  const noEligibleAgents = eligibleCount === 0
  const [selectedId, setSelectedId] = useState(agents[0].id)
  const effectiveSelectedId = agents.some((agent) => agent.id === selectedId) ? selectedId : agents[0].id
  const selected = agents.find((agent) => agent.id === effectiveSelectedId) ?? agents[0]
  const linkedActivity = selected.registrationTxHash
    ? [{ hash: selected.registrationTxHash, label: `ERC-8004 Agent #${selected.id} registration` }]
    : []
  const completedHire = category.id in hireActivity ? hireActivity[category.id as keyof typeof hireActivity] : null
  if (completedHire) linkedActivity.push(completedHire)
  const registry = useQuery({
    queryKey: ['erc-8004-registry-snapshot'],
    queryFn: ({ signal }) => fetchRegistrySnapshot(signal),
    staleTime: 60_000,
    retry: 1,
  })
  const discoveryQuery = `${category.label}. ${draft.prompt}`
  const discoveries = useQuery({
    queryKey: ['erc-8004-semantic-search', category.id, discoveryQuery],
    queryFn: ({ signal }) => searchRegistryAgents(discoveryQuery, signal),
    staleTime: 5 * 60_000,
    retry: 1,
  })

  return (
    <section className="results-screen page-gutter">
      <button className="text-button back-button" type="button" onClick={() => navigate('/')}>
        <ArrowLeft size={16} aria-hidden="true" /> Back to mandate
      </button>

      <div className="mandate-summary">
        <FileCheck2 size={20} aria-hidden="true" />
        {mandateSummary.map((item, index) => (
          <span className="mandate-summary-item" key={`${item}-${index}`}>{item}{index < mandateSummary.length - 1 ? <i /> : null}</span>
        ))}
        <button className="button button-secondary compact-button" type="button" onClick={() => navigate('/')}>
          Edit mandate
        </button>
      </div>

      <nav className="category-flow-tabs" aria-label="Agent categories">
        {categoryOrder.map((id) => (
          <button
            className={category.id === id ? 'is-active' : ''}
            key={id}
            type="button"
            onClick={() => {
              setSelectedId(categories[id].agents[0].id)
              setSearchParams({ category: id })
            }}
          >
            <small>0{categoryOrder.indexOf(id) + 1}</small>
            <span>{categories[id].label}</span>
          </button>
        ))}
      </nav>

        <section className="personalized-match" aria-label="Active matching constraints">
          <div><small>{isSavedMandate ? 'Matching your saved mandate' : 'Official category template'}</small><strong>{draft.fields[1].value}</strong></div>
          <div><small>Risk ceiling</small><strong>{draft.constraints.riskMax}</strong></div>
          <div><small>Leverage ceiling</small><strong>{draft.constraints.leverageMax === 0 ? 'None' : `${draft.constraints.leverageMax}×`}{!draft.constraints.leverageSpecified ? ' · safety default' : ''}</strong></div>
          <div><small>Action ceiling</small><strong>{draft.constraints.actionCap}/{draft.constraints.actionPeriod}{!draft.constraints.actionCapSpecified ? ' · safety default' : ''}</strong></div>
        </section>

      <div className="results-layout">
        <div className="results-main">
          <RegistryDiscoveryPanel
            categoryId={category.id}
            registryTotal={registry.data?.total}
            agents={discoveries.data}
            isPending={discoveries.isPending}
            error={discoveries.error}
          />

          <div className="list-header">
            <div>
              <h2>{noEligibleAgents ? 'No callable provider passes every limit' : 'Callable onchain provider'}</h2>
              <p>
                {noEligibleAgents
                  ? `The registered callable provider violates at least one hard limit. Your mandate has not been weakened.`
                  : `The registered callable provider satisfies every parsed hard limit. Run its live capability below before hiring it.`}{' '}
                A separate semantic search runs across the live ERC-8004 index below.
              </p>
            </div>
            <div className="registry-state" title={registry.error instanceof Error ? registry.error.message : undefined}>
              <span className={`network-dot ${registry.isError ? 'is-error' : ''}`} />
              <span className="mono">
                {registry.isPending ? 'SYNCING ERC-8004' : registry.isError ? 'REGISTRY FALLBACK' : `LIVE REGISTRY · CHAIN ${registry.data.chainId}`}
              </span>
            </div>
          </div>

          {noEligibleAgents ? (
            <section className="no-match-panel" role="status" aria-labelledby="no-match-title">
              <AlertTriangle size={22} aria-hidden="true" />
              <div>
                <span className="section-kicker">HARD LIMITS PRESERVED</span>
                <h2 id="no-match-title">We will not recommend a non-compliant agent.</h2>
                <p>Review the rejection reasons below. Keep the requirement intact and publish it as an open mandate, or edit only a constraint you genuinely want to change before searching again.</p>
              </div>
              <div className="no-match-actions">
                <button className="button button-secondary" type="button" onClick={() => navigate('/')}>Edit mandate</button>
                <button className="button button-primary" type="button" onClick={() => navigate(`/open-mandate?category=${category.id}`)}>Publish open mandate <ArrowRight size={16} /></button>
              </div>
            </section>
          ) : null}

          <div className="agent-table" role="radiogroup" aria-label={noEligibleAgents ? 'Excluded agents' : 'Recommended agents'}>
            <div className="agent-table-head" aria-hidden="true">
              <span>{noEligibleAgents ? 'Excluded candidate' : 'Recommendation'}</span>
              {category.tableColumns.map((column) => <span key={column.key}>{column.label}</span>)}
              <span>Status</span>
            </div>
            {agents.map((agent) => {
              const isSelected = effectiveSelectedId === agent.id
              return (
                <button
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className={`agent-row ${isSelected ? 'is-selected' : ''}`}
                  key={agent.id}
                  onClick={() => {
                    setSelectedId(agent.id)
                  }}
                >
                  <span className="agent-identity">
                    <span className="radio-mark" aria-hidden="true" />
                    <span>
                      <small>{agent.status === 'violates' ? 'Excluded' : agent.recommendation} · {agent.fit}% constraint match</small>
                      <strong>{agent.name}</strong>
                      <em>{agent.matchReason}</em>
                      {agent.estimatedOutcome ? <em className="agent-outcome">{agent.estimatedOutcome}</em> : null}
                    </span>
                  </span>
                  {category.tableColumns.map((column, index) => (
                    <span
                      className={`mono ${index === 0 ? 'metric' : ''}`}
                      data-label={column.label}
                      key={column.key}
                    >
                      {agent.metrics[column.key]}
                    </span>
                  ))}
                  <span className={`agent-status ${agent.status}`}>
                    {agent.status === 'satisfies' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                    {agent.status === 'satisfies' ? 'Satisfies mandate' : 'Does not satisfy'}
                    <ChevronRight size={15} aria-hidden="true" />
                  </span>
                </button>
              )
            })}
          </div>

          {!noEligibleAgents ? <section className="shadow-panel verification-panel" aria-labelledby="verification-title">
            <div className="shadow-heading">
              <div>
                <h2 id="verification-title">Verify before you hire</h2>
                <p>MANDATE does not invent performance. Run the live capability, inspect its source and hash, then review permissions.</p>
              </div>
              <span className="verified-label">NO PROFIT CLAIM</span>
            </div>
            <div className="verification-gates">
              <div><CheckCircle2 size={17} /><span><small>01 · Identity</small><strong>ERC-8004 Agent #{selected.id}</strong></span></div>
              <div><CheckCircle2 size={17} /><span><small>02 · Limits</small><strong>{selected.fit}% constraint match</strong></span></div>
              <div><RefreshCw size={17} /><span><small>03 · Capability</small><strong>Run live below</strong></span></div>
              <div><ShieldCheck size={17} /><span><small>04 · Commerce</small><strong>0.1 test U escrow</strong></span></div>
            </div>
            <div className="shadow-actionbar">
              <button className="button button-secondary compact-button" type="button" onClick={() => document.getElementById('live-capability')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><RefreshCw size={16} /> Run live capability</button>
              <button className="button button-primary compact-button" type="button" onClick={() => navigate(`/activate?category=${category.id}&agent=${selected.id}`)}>Review permissions <ArrowRight size={16} /></button>
            </div>
          </section> : null}
          <div id="live-capability">
            {category.id === 'yield' ? <LiveYieldRoute draft={draft} /> : null}
            {category.id === 'rebalancing' ? <LiveMarketAgent categoryId="rebalancing" draft={draft} /> : null}
            {category.id === 'grid' ? <LiveMarketAgent categoryId="grid" draft={draft} /> : null}
            {category.id === 'health' ? <LiveVenusAgent /> : null}
          </div>
        </div>

        <aside className="evidence-sidebar" aria-label="Evidence for selected agent">
          <div className="sidebar-heading"><h2>Evidence</h2><span className="verified-label">VERIFIABLE SOURCES</span></div>
          <div className="provenance-note">
            <strong>Evidence provenance</strong>
            <p>Identity, market reads and completed hires link to public sources. No sample APY, PnL, win rate or capital history is used to rank this provider.</p>
          </div>
          <section className="evidence-section">
            <h3>Evidence Passport</h3>
            {[
              [`Identity verified · Agent #${selected.id}`, 'ONCHAIN VERIFIED', ShieldCheck],
              ['Public production endpoint', 'CALLABLE', CheckCircle2],
              ['Live BSC or market data', 'SOURCE LINKED', FileCheck2],
              ['No autonomous signing key', 'READ ONLY', ShieldCheck],
              [completedHire ? completedHire.label : 'No completed hire claimed', completedHire ? 'ONCHAIN VERIFIED' : 'NOT CLAIMED', FileCheck2],
            ].map(([label, source, Icon]) => {
              const EvidenceIcon = Icon as typeof ShieldCheck
              return (
                <div className="evidence-row" key={label as string}>
                  <EvidenceIcon size={16} aria-hidden="true" />
                  <span>{label as string}</span>
                  <small>{source as string}</small>
                </div>
              )
            })}
          </section>
          <section className="evidence-section calculation-rail">
            <h3>Pre-hire truth checks</h3>
            <div><Calculator size={16} /><span>Performance</span><strong className="mono">LIVE RUN REQUIRED</strong></div>
            <div><RefreshCw size={16} /><span>Network fee</span><strong className="mono">WALLET QUOTE</strong></div>
            <div><ShieldCheck size={16} /><span>Authority</span><strong>READ ONLY</strong></div>
          </section>
          <section className="evidence-section">
            <h3>Linked activity</h3>
            {linkedActivity.length === 0 ? <div className="provenance-note"><p>No onchain activity is claimed for this sample provider.</p></div> : null}
            {linkedActivity.map(({ hash, label }) => (
              <a className="transaction-row" href={`https://testnet.bscscan.com/tx/${hash}`} target="_blank" rel="noreferrer" key={hash}>
                <span className="mono">{`${hash.slice(0, 8)}…${hash.slice(-6)}`}</span><small>{label}</small><ExternalLink size={13} />
              </a>
            ))}
          </section>
        </aside>
      </div>

      <section className="category-benchmarks" aria-labelledby="category-benchmarks-title">
        <div className="category-benchmarks-heading">
          <div>
            <span className="section-kicker">FOUR CATEGORIES · FOUR DECISION MODELS</span>
            <h2 id="category-benchmarks-title">Category-specific evidence sheets</h2>
            <p>Each agent is judged on the outcomes and failure modes that matter for its work—not a generic star rating.</p>
          </div>
          <span className="mono muted">LIVE SOURCES · NO PROFIT CLAIMS</span>
        </div>
        <div className="category-sheet-grid">
          {categorySheets.map((sheet) => {
            const flowCategory = sheet.category === 'liquidity' ? 'rebalancing' : sheet.category
            return (
            <article className={`category-sheet ${category.id === flowCategory ? 'is-active' : ''}`} key={sheet.category}>
              <div className="category-sheet-title">
                <div><small>{sheet.eyebrow}</small><h3>{sheet.agent}</h3></div>
                <strong className="mono">{sheet.fit}% <span>CONSTRAINTS</span></strong>
              </div>
              <p className="category-mandate">{sheet.mandate}</p>
              <dl>
                {sheet.metrics.map((metric) => (
                  <div key={metric.label}>
                    <dt>{metric.label}<small>{metric.source}</small></dt>
                    <dd className="mono">{metric.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="category-risk"><ShieldCheck size={15} /><p><strong>Risk gate</strong>{sheet.riskRule}</p></div>
              <button className="text-button category-sheet-link" type="button" onClick={() => {
                setSelectedId(categories[flowCategory].agents[0].id)
                setSearchParams({ category: flowCategory })
              }}>Open full {sheet.eyebrow.toLowerCase()} flow <ArrowRight size={14} /></button>
            </article>
            )
          })}
        </div>
      </section>
    </section>
  )
}
