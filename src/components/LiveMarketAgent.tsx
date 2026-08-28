import { useState } from 'react'
import { Activity, CheckCircle2, Download, ExternalLink, Radar, ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { CategoryId } from '../catalog'
import type { MandateDraft } from '../services/mandateDraft'
import { fetchGridTrackRecord, runGridAgent, runRebalancingAgent, type GridTrackRecord, type MarketAgentEvidence } from '../services/marketAgents'

type SupportedCategory = Extract<CategoryId, 'rebalancing' | 'grid'>

function downloadEvidence(evidence: MarketAgentEvidence) {
  const blob = new Blob([JSON.stringify(evidence, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `mandate-${evidence.agent.name.toLowerCase()}-${evidence.generated_at_utc.slice(0, 19).replaceAll(':', '-')}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

const usd = (value?: number) => value == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value)

export function LiveMarketAgent({ categoryId, draft }: { categoryId: SupportedCategory; draft: MandateDraft }) {
  const [evidence, setEvidence] = useState<MarketAgentEvidence | null>(null)
  const [trackRecord, setTrackRecord] = useState<GridTrackRecord | null>(null)
  const [error, setError] = useState('')
  const [running, setRunning] = useState(false)
  const capital = draft.constraints.capitalAmount
  const isGrid = categoryId === 'grid'

  async function run() {
    if (!capital) return setError('Add a capital amount before running the agent.')
    setError('')
    setRunning(true)
    try {
      if (isGrid) {
        const [live, historical] = await Promise.all([
          runGridAgent(capital),
          fetchGridTrackRecord().catch(() => null),
        ])
        setEvidence(live)
        setTrackRecord(historical)
      } else {
        setEvidence(await runRebalancingAgent(capital))
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The live market read failed.')
    } finally {
      setRunning(false)
    }
  }

  return (
    <section className="live-agent" aria-labelledby={`live-${categoryId}-title`}>
      <header className="live-agent-heading">
        <div>
          <span className="section-kicker">LIVE CAPABILITY · PANCAKESWAP BSC · READ ONLY</span>
          <h2 id={`live-${categoryId}-title`}>Run {isGrid ? 'GridPilot' : 'RangeGuard'} on the current BNB/USDT market</h2>
          <p>Reads the deepest PancakeSwap V3 BNB/USDT pool, enforces bounded risk rules, and returns downloadable hash-verifiable evidence. It never signs or broadcasts a trade.</p>
        </div>
        <span className="live-agent-badge"><Radar size={15} /> AGENT #{isGrid ? '1805' : '1804'}</span>
      </header>
      <div className="yield-run-summary">
        <div><small>Capital</small><strong>{capital ? usd(capital) : 'Missing'}</strong></div>
        <div><small>Hard gate</small><strong>{isGrid ? '5% drawdown · ranging only' : '20% gas drag · 2/day'}</strong></div>
        <div><small>Execution</small><strong>Analysis only</strong></div>
        <button className="button button-primary" type="button" disabled={running || !capital} onClick={run}><Activity size={16} /> {running ? 'Reading live pool…' : `Run live ${isGrid ? 'grid' : 'LP'} agent`}</button>
      </div>
      <div className="yield-live-output" aria-live="polite">
        {!evidence && !error && <p className="yield-live-idle">No signature · no approval · no transaction. This produces a real point-in-time decision, not a simulated receipt.</p>}
        {error && <div className="live-agent-error"><ShieldAlert size={20} /><span><strong>Agent could not complete the live read</strong>{error}</span></div>}
        {evidence && <>
          <div className="yield-decision found">
            <CheckCircle2 size={20} />
            <div><small>Decision</small><strong>{evidence.decision.status.replaceAll('_', ' ')}</strong></div>
            <div><small>Live BNB price</small><strong className="mono">{usd(evidence.market.price_usd)}</strong></div>
            <div><small>24h move</small><strong className="mono">{evidence.market.change_h24_pct.toFixed(2)}%</strong></div>
            <div><small>{isGrid ? 'Grid / hard stop' : 'Bounded range'}</small><strong className="mono">{isGrid ? `${usd(evidence.decision.grid_lower_usd)}–${usd(evidence.decision.grid_upper_usd)} / ${usd(evidence.decision.hard_stop_usd)}` : `${usd(evidence.decision.range_lower_usd)}–${usd(evidence.decision.range_upper_usd)}`}</strong></div>
          </div>
          <p className="live-agent-recommendation">{evidence.decision.recommendation}</p>
          <dl className="live-agent-proof">
            <div><dt>Retrieved</dt><dd className="mono">{new Date(evidence.generated_at_utc).toLocaleString()}</dd></div>
            <div><dt>Liquidity</dt><dd className="mono">{usd(evidence.market.liquidity_usd)}</dd></div>
            <div><dt>Source pool</dt><dd><a href={evidence.market.url} target="_blank" rel="noreferrer">DexScreener / PancakeSwap <ExternalLink size={12} /></a></dd></div>
            <div><dt>Deliverable SHA-256</dt><dd className="mono">{evidence.deliverable_sha256}</dd></div>
          </dl>
          {isGrid && trackRecord ? <section className="track-record" aria-label="GridPilot historical paper record">
            <div className="track-record-heading"><div><small>TRANSPARENT TRACK RECORD</small><strong>{trackRecord.label}</strong></div><a href={trackRecord.source.url} target="_blank" rel="noreferrer">Source candles <ExternalLink size={12} /></a></div>
            <div className="track-record-metrics">
              <div><small>Window</small><strong>{trackRecord.window.sessions} × 24h</strong><span>{new Date(trackRecord.window.start_utc).toLocaleDateString()}–{new Date(trackRecord.window.end_utc).toLocaleDateString()}</span></div>
              <div><small>Session win rate</small><strong>{trackRecord.record.session_win_rate_pct == null ? '—' : `${trackRecord.record.session_win_rate_pct}%`}</strong><span>{trackRecord.record.winning_sessions} win · {trackRecord.record.losing_sessions} loss</span></div>
              <div><small>Max session drawdown</small><strong>{trackRecord.record.max_session_drawdown_pct}%</strong><span>{trackRecord.record.hard_stop_sessions} hard-stop sessions</span></div>
              <div><small>Paper net return</small><strong>{trackRecord.record.net_return_pct}%</strong><span>Fees included · gas/slippage excluded</span></div>
            </div>
            <p>Historical paper test, not realized PnL. BNBUSDT reference candles; no PancakeSwap orders were executed. Hash: <span className="mono">{trackRecord.evidence_sha256}</span></p>
          </section> : null}
          <div className="yield-evidence-actions"><div><button className="button button-outline compact-button" type="button" onClick={() => downloadEvidence(evidence)}><Download size={15} /> Download evidence</button><Link className="button button-primary compact-button" to={`/activate?category=${categoryId}&agent=${isGrid ? '1805' : '1804'}`}>Review permissions</Link></div><small>Point-in-time analysis. No transaction attempted.</small></div>
        </>}
      </div>
    </section>
  )
}
