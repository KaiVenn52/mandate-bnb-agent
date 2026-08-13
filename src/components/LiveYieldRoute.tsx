import { useState } from 'react'
import { Activity, CheckCircle2, Download, ExternalLink, Radar, ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { MandateDraft } from '../services/mandateDraft'
import { runYieldRouteAgent, type YieldRouteEvidence } from '../services/yieldRoute'

function downloadEvidence(evidence: YieldRouteEvidence) {
  const blob = new Blob([JSON.stringify(evidence, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `mandate-yield-route-${evidence.generated_at_utc.slice(0, 19).replaceAll(':', '-')}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

function formatUsd(value: number | null | undefined) {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value)
}

export function LiveYieldRoute({ draft }: { draft: MandateDraft }) {
  const [evidence, setEvidence] = useState<YieldRouteEvidence | null>(null)
  const [error, setError] = useState('')
  const [running, setRunning] = useState(false)
  const capital = draft.constraints.capitalAmount

  async function run() {
    if (!capital) {
      setError('Add a capital amount to the mandate before running live analysis.')
      return
    }
    setError('')
    setEvidence(null)
    setRunning(true)
    try {
      setEvidence(await runYieldRouteAgent({
        asset: draft.constraints.asset,
        capitalUsd: capital,
        maxRisk: draft.constraints.riskMax,
        leverageMax: draft.constraints.leverageMax,
        allowedProtocols: draft.constraints.protocols,
        maxActionsPerWeek: draft.constraints.actionPeriod === 'week'
          ? draft.constraints.actionCap
          : draft.constraints.actionPeriod === 'day'
            ? draft.constraints.actionCap * 7
            : Math.max(1, Math.floor(draft.constraints.actionCap / 4)),
      }))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Live YieldRoute failed.')
    } finally {
      setRunning(false)
    }
  }

  const selected = evidence?.eligible_routes.find((route) => route.pool_id === evidence.decision.selected_pool_id)

  return (
    <section className="live-agent live-yield-route" aria-labelledby="live-yield-title">
      <header className="live-agent-heading">
        <div>
          <span className="section-kicker">LIVE CAPABILITY · BNB CHAIN · READ ONLY</span>
          <h2 id="live-yield-title">Run YieldRoute on current market data</h2>
          <p>Fetches live BSC pool APY, liquidity and protocol TVL trends, applies this mandate's hard limits, and produces a SHA-256-verifiable deliverable. It cannot move funds.</p>
        </div>
        <span className="live-agent-badge"><Radar size={15} /> AGENT #1806</span>
      </header>

      <div className="yield-run-summary">
        <div><small>Capital</small><strong>{capital ? `${capital.toLocaleString()} ${draft.constraints.asset}` : 'Missing'}</strong></div>
        <div><small>Risk ceiling</small><strong>{draft.constraints.riskMax}</strong></div>
        <div><small>Protocol universe</small><strong>{draft.constraints.protocols.length ? draft.constraints.protocols.join(', ') : 'PancakeSwap, Venus, Lista'}</strong></div>
        <button className="button button-primary" type="button" disabled={running || !capital} onClick={run}>
          <Activity size={16} /> {running ? 'Reading live markets…' : 'Run live YieldRoute'}
        </button>
      </div>

      <div className="yield-live-output" aria-live="polite">
        {!evidence && !error && <p className="yield-live-idle">No signature · no approval · no transaction. The result is a real analysis deliverable, not a simulated trade.</p>}
        {error && <div className="live-agent-error"><ShieldAlert size={20} /><span><strong>Agent could not complete the live read</strong>{error}</span></div>}
        {evidence && (
          <>
            <div className={`yield-decision ${selected ? 'found' : 'none'}`}>
              <CheckCircle2 size={20} />
              <div><small>Decision</small><strong>{evidence.decision.status.replaceAll('_', ' ')}</strong></div>
              <div><small>Selected route</small><strong>{selected ? `${selected.protocol} · ${selected.symbol}` : 'Keep funds unchanged'}</strong></div>
              <div><small>Observed APY</small><strong className="mono">{selected ? `${selected.apy_pct}%` : '—'}</strong></div>
              <div><small>Gross estimate</small><strong className="mono">{formatUsd(evidence.decision.estimated_gross_yield_usd_year)} / year</strong></div>
            </div>
            <p className="live-agent-recommendation">{evidence.decision.recommendation}</p>
            <div className="yield-route-list">
              {evidence.eligible_routes.slice(0, 3).map((route, index) => (
                <article key={route.pool_id} className={route.pool_id === evidence.decision.selected_pool_id ? 'is-selected' : ''}>
                  <small>0{index + 1} · {route.risk} risk</small>
                  <strong>{route.protocol} <span>{route.symbol}</span></strong>
                  <div><span>{route.apy_pct}% APY</span><span>{formatUsd(route.pool_tvl_usd)} pool TVL</span><span>{formatUsd(route.estimated_gross_yield_usd_year)} / year</span></div>
                </article>
              ))}
            </div>
            <dl className="live-agent-proof">
              <div><dt>Retrieved</dt><dd className="mono">{new Date(evidence.source.retrieved_at_utc).toLocaleString()}</dd></div>
              <div><dt>Coverage</dt><dd>{evidence.coverage.matching_pools} matching · {evidence.coverage.eligible_pools} eligible · {evidence.coverage.rejected_pools} rejected</dd></div>
              <div><dt>Data source</dt><dd><a href={evidence.source.yield_url} target="_blank" rel="noreferrer">DefiLlama live pools <ExternalLink size={12} /></a></dd></div>
              <div><dt>Deliverable SHA-256</dt><dd className="mono">{evidence.deliverable_sha256}</dd></div>
            </dl>
            <div className="yield-evidence-actions">
              <div>
                <button className="button button-outline compact-button" type="button" onClick={() => downloadEvidence(evidence)}><Download size={15} /> Download deliverable</button>
                <Link className="button button-primary compact-button" to="/commerce"><CheckCircle2 size={15} /> Prepare onchain proof</Link>
              </div>
              <small>Point-in-time APY, not guaranteed. No transaction was attempted.</small>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
