import { useState } from 'react'
import { Activity, CheckCircle2, Download, ExternalLink, Radar, ShieldAlert } from 'lucide-react'
import type { CategoryId } from '../catalog'
import type { MandateDraft } from '../services/mandateDraft'
import { runGridAgent, runRebalancingAgent, type MarketAgentEvidence } from '../services/marketAgents'

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
  const [error, setError] = useState('')
  const [running, setRunning] = useState(false)
  const capital = draft.constraints.capitalAmount
  const isGrid = categoryId === 'grid'

  async function run() {
    if (!capital) return setError('Add a capital amount before running the agent.')
    setError('')
    setRunning(true)
    try {
      setEvidence(await (isGrid ? runGridAgent(capital) : runRebalancingAgent(capital)))
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
          <div className="yield-evidence-actions"><button className="button button-outline compact-button" type="button" onClick={() => downloadEvidence(evidence)}><Download size={15} /> Download evidence</button><small>Point-in-time analysis. No transaction attempted.</small></div>
        </>}
      </div>
    </section>
  )
}
