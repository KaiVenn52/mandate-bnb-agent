import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calculator,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ExternalLink,
  FileCheck2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { categorySheets } from '../data'
import { categories, categoryOrder, getCategory } from '../catalog'
import { fetchRegistrySnapshot } from '../services/agentRegistry'
import { loadMandateDraft } from '../services/mandateDraft'
import { matchAgents } from '../services/agentMatching'
import { LiveYieldRoute } from '../components/LiveYieldRoute'

type ShadowStatus = 'idle' | 'running' | 'complete'

const shadowSteps = ['Simulating', 'Tracking', 'Analysing', 'Results ready']

function capitalisedAdvantage(categoryId: string, advantage: string, capitalAmount?: number | null) {
  if (categoryId !== 'yield' || !capitalAmount) return null
  const percentage = Number.parseFloat(advantage.replace(/[^0-9.-]/g, ''))
  if (!Number.isFinite(percentage)) return null
  const annualValue = capitalAmount * percentage / 100
  return `+${annualValue.toLocaleString('en-US', { maximumFractionDigits: 2 })} USDT / year on this mandate`
}

export function ResultsScreen() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const category = getCategory(searchParams.get('category'))
  const draft = loadMandateDraft()
  const mandateSummary = draft?.categoryId === category.id ? draft.summary : category.summary
  const agents = matchAgents(category, draft)
  const eligibleCount = agents.filter((agent) => agent.status === 'satisfies').length
  const noEligibleAgents = eligibleCount === 0
  const [selectedId, setSelectedId] = useState(agents[0].id)
  const [shadowStatus, setShadowStatus] = useState<ShadowStatus>('idle')
  const [progress, setProgress] = useState(0)
  const effectiveSelectedId = agents.some((agent) => agent.id === selectedId) ? selectedId : agents[0].id
  const selected = agents.find((agent) => agent.id === effectiveSelectedId) ?? agents[0]
  const personalisedAnnualised = capitalisedAdvantage(category.id, selected.shadow.advantage, draft?.constraints.capitalAmount)
  const linkedActivity = selected.registrationTxHash
    ? [{ hash: selected.registrationTxHash, label: `ERC-8004 Agent #${selected.id} registration` }]
    : []
  const registry = useQuery({
    queryKey: ['erc-8004-registry-snapshot'],
    queryFn: ({ signal }) => fetchRegistrySnapshot(signal),
    staleTime: 60_000,
    retry: 1,
  })

  useEffect(() => {
    if (shadowStatus !== 'running') return
    const timers = [1, 2, 3, 4].map((step) =>
      window.setTimeout(() => {
        setProgress(step)
        if (step === 4) setShadowStatus('complete')
      }, step * 520),
    )
    return () => timers.forEach(window.clearTimeout)
  }, [shadowStatus])

  const runShadow = () => {
    setProgress(0)
    setShadowStatus('running')
  }

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
              setShadowStatus('idle')
              setProgress(0)
              setSearchParams({ category: id })
            }}
          >
            <small>0{categoryOrder.indexOf(id) + 1}</small>
            <span>{categories[id].label}</span>
          </button>
        ))}
      </nav>

      {draft?.categoryId === category.id ? (
        <section className="personalized-match" aria-label="Active matching constraints">
          <div><small>Matching this mandate</small><strong>{draft.fields[1].value}</strong></div>
          <div><small>Risk ceiling</small><strong>{draft.constraints.riskMax}</strong></div>
          <div><small>Leverage ceiling</small><strong>{draft.constraints.leverageMax === 0 ? 'None' : `${draft.constraints.leverageMax}×`}{!draft.constraints.leverageSpecified ? ' · safety default' : ''}</strong></div>
          <div><small>Action ceiling</small><strong>{draft.constraints.actionCap}/{draft.constraints.actionPeriod}{!draft.constraints.actionCapSpecified ? ' · safety default' : ''}</strong></div>
        </section>
      ) : null}

      <div className="results-layout">
        <div className="results-main">
          <div className="list-header">
            <div>
              <h2>{noEligibleAgents ? 'No eligible agent found' : 'Top recommendations'}</h2>
              <p>
                {noEligibleAgents
                  ? `All ${agents.length} disclosed candidates violate at least one hard limit. Your mandate has not been weakened.`
                  : `${eligibleCount} of ${agents.length} disclosed candidates satisfy every parsed hard limit.`}{' '}
                The live ERC-8004 registry total{' '}
                ({registry.data ? registry.data.total.toLocaleString() : 'syncing'}) is ecosystem context.
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
                    setShadowStatus('idle')
                    setProgress(0)
                  }}
                >
                  <span className="agent-identity">
                    <span className="radio-mark" aria-hidden="true" />
                    <span>
                      <small>{agent.status === 'violates' ? 'Excluded' : agent.recommendation} · {agent.fit}% personalised fit</small>
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

          {!noEligibleAgents ? <section className="shadow-panel" aria-labelledby="shadow-title">
            <div className="shadow-heading">
              <div>
                <h2 id="shadow-title">Shadow Mode comparison</h2>
                <p>Read-only simulation. No funds move.</p>
              </div>
              <button className="text-button muted" type="button">Why am I seeing this?</button>
            </div>

            {selected.status === 'violates' ? (
              <div className="inline-error">
                <AlertTriangle size={20} aria-hidden="true" />
                <div><strong>Shadow run blocked</strong><p>{selected.violation} Select an eligible agent to continue.</p></div>
              </div>
            ) : (
              <>
                <div className="comparison-grid">
                  <div className="comparison-label" />
                  <div className="comparison-head"><small>Selected agent</small><strong>{selected.name}</strong></div>
                  <div className="comparison-head"><small>Baseline</small><strong>Do nothing</strong></div>
                  <div className="comparison-advantage" />

                  <span className="comparison-label">{category.primaryMetricLabel}<small>{category.primaryMetricSupport}</small></span>
                  <strong className="mono comparison-number">{selected.shadow.primary}</strong>
                  <strong className="mono comparison-number">{selected.shadow.baseline}</strong>
                  <div className="advantage-cell"><small>Agent advantage</small><strong className="mono positive">{selected.shadow.advantage}</strong></div>

                  <span className="comparison-label">Execution cost<small>Estimated</small></span>
                  <span className="mono">{selected.shadow.cost}</span><span className="mono">{selected.shadow.baselineCost}</span>
                  <span className="mono muted">{personalisedAnnualised ?? selected.shadow.annualised ?? 'Within configured budget'}</span>

                  <span className="comparison-label">{category.activityLabel}<small>{category.activitySupport}</small></span>
                  <span className="mono">{selected.shadow.activity}</span><span className="mono">{selected.shadow.baselineActivity}</span><span />

                  <span className="comparison-label">Risk exposure<small>Worst-case simulation</small></span>
                  <span className="mono">{selected.shadow.risk}</span><span className="mono">{selected.shadow.baselineRisk}</span>
                  <span className="within-limit"><CheckCircle2 size={16} /> Within your mandate</span>
                </div>

                <div className="shadow-actionbar">
                  <div className={`shadow-progress ${shadowStatus}`} aria-live="polite">
                    {shadowSteps.map((step, index) => (
                      <div className={progress > index ? 'done' : progress === index && shadowStatus === 'running' ? 'active' : ''} key={step}>
                        <span>{progress > index ? <Check size={14} /> : index + 1}</span>
                        <small>{step}</small>
                      </div>
                    ))}
                  </div>
                  {shadowStatus === 'complete' ? (
                    <div className="shadow-actions">
                      <button className="button button-secondary compact-button" type="button" onClick={runShadow}><RefreshCw size={16} /> Run again</button>
                      <button className="button button-primary compact-button" type="button" onClick={() => navigate(`/activate?category=${category.id}&agent=${selected.id}`)}>
                        {selected.providerAddress ? 'Review permissions' : 'Preview sample permissions'} <ArrowRight size={16} />
                      </button>
                    </div>
                  ) : (
                    <button className="button button-primary shadow-run-button" type="button" onClick={runShadow} disabled={shadowStatus === 'running'} aria-busy={shadowStatus === 'running'}>
                      <Sparkles size={17} aria-hidden="true" />
                      {shadowStatus === 'running' ? 'Running shadow…' : 'Run in Shadow Mode'}
                    </button>
                  )}
                </div>
              </>
            )}
          </section> : null}
          {category.id === 'yield' && draft?.categoryId === 'yield' ? <LiveYieldRoute draft={draft} /> : null}
        </div>

        <aside className="evidence-sidebar" aria-label="Evidence for selected agent">
          <div className="sidebar-heading"><h2>Evidence</h2><span className="verified-label">Mixed sources</span></div>
          <div className="provenance-note">
            <strong>Evidence provenance</strong>
            <p>Registry totals are live ERC-8004 data. Candidate performance is a labelled demo dataset until a wallet-funded mandate produces receipts.</p>
          </div>
          <section className="evidence-section">
            <h3>Evidence Passport</h3>
            {[
              [`Identity verified · Agent #${selected.id}`, selected.providerAddress ? 'ONCHAIN VERIFIED' : 'DEMO SAMPLE', ShieldCheck],
              [`${selected.completedMandates} completed mandates`, 'DEMO SAMPLE', FileCheck2],
              [`${selected.disputed} disputed`, 'DEMO SAMPLE', CheckCircle2],
              [`$${selected.capitalObserved.toLocaleString()} capital observed`, 'DEMO SAMPLE', Calculator],
              [`Last active ${selected.lastActive}`, 'DEMO SAMPLE', Clock3],
              [`Median execution ${selected.medianExecutionSeconds} sec`, 'DEMO SAMPLE', Clock3],
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
            <h3>Calculation breakdown</h3>
            <div><Calculator size={16} /><span>{category.primaryMetricLabel}</span><strong className="mono">{selected.shadow.primary}</strong></div>
            <div><RefreshCw size={16} /><span>Execution cost</span><strong className="mono">{selected.shadow.cost}</strong></div>
            <div><ShieldCheck size={16} /><span>Risk exposure</span><strong>{selected.shadow.risk}</strong></div>
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
          <span className="mono muted">SAMPLE DATA SHAPE</span>
        </div>
        <div className="category-sheet-grid">
          {categorySheets.map((sheet) => {
            const flowCategory = sheet.category === 'liquidity' ? 'rebalancing' : sheet.category
            return (
            <article className={`category-sheet ${category.id === flowCategory ? 'is-active' : ''}`} key={sheet.category}>
              <div className="category-sheet-title">
                <div><small>{sheet.eyebrow}</small><h3>{sheet.agent}</h3></div>
                <strong className="mono">{sheet.fit}% <span>FIT</span></strong>
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
                setShadowStatus('idle')
                setProgress(0)
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
