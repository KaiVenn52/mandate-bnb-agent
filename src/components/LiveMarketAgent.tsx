import { useState } from 'react'
import { Activity, CheckCircle2, Download, ExternalLink, Radar, ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { AgentTrackRecord, CategoryId } from '../catalog'
import type { MandateDraft } from '../services/mandateDraft'
import { dailyActionCap, fetchGridTrackRecord, runGridAgent, runRebalancingAgent, type GridTrackRecord, type MarketAgentEvidence } from '../services/marketAgents'

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

export function LiveMarketAgent({ categoryId, draft, onVerified, displayAgentId, displayAgentName, displayTrackRecord }: { categoryId: SupportedCategory; draft: MandateDraft; onVerified?: (verified: boolean) => void; displayAgentId?: string; displayAgentName?: string; displayTrackRecord?: AgentTrackRecord }) {
  const [evidence, setEvidence] = useState<MarketAgentEvidence | null>(null)
  const [trackRecord, setTrackRecord] = useState<GridTrackRecord | null>(null)
  const [error, setError] = useState('')
  const [running, setRunning] = useState(false)
  const capital = draft.constraints.capitalAmount
  const isGrid = categoryId === 'grid'
  const actionCap = draft.constraints.actionCap
  const actionPeriod = draft.constraints.actionPeriod
  const dailyCap = dailyActionCap(actionCap, actionPeriod)
  const maxGasDragPct = draft.constraints.gasDragMaxPct ?? 20
  const maxDrawdownPct = draft.constraints.drawdownMaxPct ?? 5
  const hardGate = isGrid
    ? `Drawdown ≤${maxDrawdownPct}%${draft.constraints.drawdownMaxPct == null ? ' safety default' : ''} · ${actionCap}/${actionPeriod}`
    : `Gas drag ≤${maxGasDragPct}%${draft.constraints.gasDragMaxPct == null ? ' safety default' : ''} · ${actionCap}/${actionPeriod}`
  const agentIdLabel = displayAgentId ?? (isGrid ? '1805' : '1804')
  const agentNameLabel = displayAgentName ?? (isGrid ? 'GridPilot' : 'RangeGuard')

  async function run() {
    onVerified?.(false)
    setError('')
    setEvidence(null)
    setTrackRecord(null)
    if (!capital) return setError('Add a capital amount before running the agent.')
    setRunning(true)
    try {
      if (isGrid) {
        const [live, historical] = await Promise.all([
          runGridAgent({ capitalUsd: capital, actionCap, actionPeriod, maxDrawdownPct }),
          displayTrackRecord ? Promise.resolve(null) : fetchGridTrackRecord().catch(() => null),
        ])
        setEvidence(live)
        setTrackRecord(historical)
        onVerified?.(true)
      } else {
        setEvidence(await runRebalancingAgent({ capitalUsd: capital, actionCap, actionPeriod, maxGasDragPct }))
        onVerified?.(true)
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
          <span className="section-kicker">LIVE CAPABILITY · BNB CHAIN MAINNET DATA · READ ONLY</span>
          <h2 id={`live-${categoryId}-title`}>Run {agentNameLabel} on the current BNB/USDT market</h2>
          <p>Reads the deepest PancakeSwap V3 BNB/USDT pool, enforces bounded risk rules, and returns downloadable hash-verifiable evidence. It never signs or broadcasts a trade.</p>
        </div>
        <span className="live-agent-badge"><Radar size={15} /> AGENT #{agentIdLabel}</span>
      </header>
      <div className="yield-run-summary">
        <div><small>Capital</small><strong>{capital ? usd(capital) : 'Missing'}</strong></div>
        <div><small>Mandate gate</small><strong>{hardGate}</strong></div>
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
            <div><dt>Applied activity</dt><dd className="mono">{evidence.mandate?.action_cap ?? actionCap}/{evidence.mandate?.action_period ?? actionPeriod} ({evidence.mandate?.effective_daily_cap ?? dailyCap}/day normalised)</dd></div>
            <div><dt>Applied risk</dt><dd className="mono">{isGrid ? `Drawdown ≤${evidence.mandate?.max_drawdown_pct ?? maxDrawdownPct}%` : `Gas drag ≤${evidence.mandate?.max_gas_drag_pct ?? maxGasDragPct}%`}</dd></div>
            <div><dt>Liquidity</dt><dd className="mono">{usd(evidence.market.liquidity_usd)}</dd></div>
            <div><dt>Source pool</dt><dd><a href={evidence.market.url} target="_blank" rel="noreferrer">DexScreener / PancakeSwap <ExternalLink size={12} /></a></dd></div>
            <div><dt>Deliverable SHA-256</dt><dd className="mono">{evidence.deliverable_sha256}</dd></div>
          </dl>
          {isGrid && displayTrackRecord ? <section className="track-record" aria-label={`${agentNameLabel} realized onchain track record`}>
            <div className="track-record-heading"><div><small>PROVIDER-PUBLISHED REALIZED RECORD</small><strong>{agentNameLabel} · onchain track record</strong></div><a href={displayTrackRecord.onchain_evidence.verification_url ?? `https://testnet.bscscan.com/address/${displayTrackRecord.onchain_evidence.transactions[0]?.hash ?? ''}`} target="_blank" rel="noreferrer">Verify receipts <ExternalLink size={12} /></a></div>
            <div className="track-record-metrics">
              <div><small>Window</small><strong>{new Date(displayTrackRecord.window.start_utc).toLocaleDateString()}–{new Date(displayTrackRecord.window.end_utc).toLocaleDateString()}</strong><span>{displayTrackRecord.summary.executed_trades} executed trades</span></div>
              <div><small>Win rate</small><strong>{displayTrackRecord.summary.win_rate_pct}%</strong><span>{displayTrackRecord.summary.winning_trades} win · {displayTrackRecord.summary.losing_trades} loss</span></div>
              <div><small>Max drawdown</small><strong>{displayTrackRecord.summary.max_drawdown_pct}%</strong><span>Realized record</span></div>
              <div><small>Risk exposure</small><strong>{displayTrackRecord.risk_exposure.leverage}× · {displayTrackRecord.risk_exposure.max_loss_pct}% max loss</strong><span>{displayTrackRecord.risk_exposure.position_side}</span></div>
            </div>
            <div className="track-record-onchain is-verified">
              <div><small>Onchain evidence</small><strong>{displayTrackRecord.onchain_evidence.transactions.length} verified transactions</strong></div>
              <div><small>Chain</small><strong>BSC Testnet · 97</strong></div>
              <p>{displayTrackRecord.risk_exposure.notes}</p>
            </div>
            <div className="track-record-transactions">{displayTrackRecord.onchain_evidence.transactions.map((transaction) => <a key={transaction.hash} href={`https://testnet.bscscan.com/tx/${transaction.hash}`} target="_blank" rel="noreferrer"><span className="mono">{transaction.hash.slice(0, 12)}…{transaction.hash.slice(-8)}</span><small>{new Date(transaction.executed_at_utc).toLocaleString()} <ExternalLink size={11} /></small></a>)}</div>
            <p>Realized onchain figures are provider-supplied and receipt-linked. MANDATE accepts this record only after every hash is a successful provider-signed BSC Testnet contract call inside the declared scope.</p>
          </section> : null}
          {isGrid && !displayTrackRecord && trackRecord ? <section className="track-record" aria-label={`${agentNameLabel} historical paper record`}>
            <div className="track-record-heading"><div><small>TRANSPARENT TRACK RECORD</small><strong>{trackRecord.label}</strong></div><a href={trackRecord.source.url} target="_blank" rel="noreferrer">Source candles <ExternalLink size={12} /></a></div>
            <div className="track-record-metrics">
              <div><small>Window</small><strong>{trackRecord.window.sessions} × 24h</strong><span>{new Date(trackRecord.window.start_utc).toLocaleDateString()}–{new Date(trackRecord.window.end_utc).toLocaleDateString()}</span></div>
              <div><small>Session win rate</small><strong>{trackRecord.record.session_win_rate_pct == null ? '—' : `${trackRecord.record.session_win_rate_pct}%`}</strong><span>{trackRecord.record.winning_sessions} win · {trackRecord.record.losing_sessions} loss</span></div>
              <div><small>Max session drawdown</small><strong>{trackRecord.record.max_session_drawdown_pct}%</strong><span>{trackRecord.record.hard_stop_sessions} hard-stop sessions</span></div>
              <div><small>Paper net return</small><strong>{trackRecord.record.net_return_pct}%</strong><span>Fees included · gas/slippage excluded</span></div>
            </div>
            <div className={`track-record-onchain ${trackRecord.onchain_evidence.status === 'verified' ? 'is-verified' : ''}`}>
              <div><small>Onchain trading evidence</small><strong>{trackRecord.onchain_evidence.status === 'verified' ? `${trackRecord.onchain_evidence.transaction_count} verified transactions` : 'None recorded'}</strong></div>
              <div><small>Risk exposure</small><strong>{trackRecord.risk_exposure.position_side} · {trackRecord.risk_exposure.leverage}× leverage · ≤{trackRecord.risk_exposure.hard_stop_pct}% stop</strong></div>
              <p>{trackRecord.onchain_evidence.note}</p>
            </div>
            <p>Historical paper test, not realized PnL. BNBUSDT reference candles; no PancakeSwap orders were executed. Hash: <span className="mono">{trackRecord.evidence_sha256}</span></p>
          </section> : null}
          <div className="yield-evidence-actions"><div><button className="button button-outline compact-button" type="button" onClick={() => downloadEvidence(evidence)}><Download size={15} /> Download evidence</button><Link className="button button-primary compact-button" to={`/activate?category=${categoryId}&agent=${agentIdLabel}`}>Start bounded testnet hire</Link></div><small>Analysis is read-only; ERC-8183 service escrow requires explicit wallet signatures.</small></div>
        </>}
      </div>
    </section>
  )
}
