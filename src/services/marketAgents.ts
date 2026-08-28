import { apiError } from './apiError'

export type LiveMarket = {
  pair_address: string
  price_usd: number
  change_h1_pct: number
  change_h24_pct: number
  liquidity_usd: number
  volume_h24_usd: number
  url: string
}

export type MarketAgentEvidence = {
  schema: string
  agent: { erc8004_id: number; name: string }
  source: { chain: string; chain_id: number; provider: string; url: string }
  market: LiveMarket
  decision: {
    status: string
    recommendation: string
    transaction_attempted: false
    range_lower_usd?: number
    range_upper_usd?: number
    estimated_gas_drag_pct?: number
    market_regime?: string
    grid_lower_usd?: number
    grid_upper_usd?: number
    grid_levels?: number
    order_notional_usd?: number
    hard_stop_usd?: number
  }
  limitations: string[]
  generated_at_utc: string
  deliverable_sha256: string
}

export type GridTrackRecord = {
  schema: string
  label: string
  source: { provider: string; symbol: string; interval: string; url: string; closed_candles: number }
  window: { start_utc: string; end_utc: string; sessions: number; session_hours: number }
  policy: { capital_usd: number; grid_levels: number; adaptive_half_width_pct: { formula: string; observed_min: number; observed_max: number }; hard_stop_pct: number; fee_pct_per_leg: number; execution: string }
  record: {
    traded_sessions: number
    winning_sessions: number
    losing_sessions: number
    session_win_rate_pct: number | null
    net_pnl_usd: number
    net_return_pct: number
    max_session_drawdown_pct: number
    hard_stop_sessions: number
    closed_grid_cycles: number
    fees_usd: number
  }
  limitations: string[]
  generated_at_utc: string
  evidence_sha256: string
}

const apiBase = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '')

async function post(path: string, body: object): Promise<MarketAgentEvidence> {
  const response = await fetch(`${apiBase}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw await apiError(response, 'Live agent failed')
  return response.json() as Promise<MarketAgentEvidence>
}

export const runRebalancingAgent = (capitalUsd: number) => post('/agents/rebalancing/run', {
  capital_usd: capitalUsd,
  max_rebalances_per_day: 2,
  max_gas_drag_pct: 20,
  target_width_pct: 15,
})

export const runGridAgent = (capitalUsd: number) => post('/agents/grid/run', {
  capital_usd: capitalUsd,
  max_drawdown_pct: 5,
  max_orders_per_day: 12,
  grid_levels: 7,
})

export async function fetchGridTrackRecord(): Promise<GridTrackRecord> {
  const response = await fetch(`${apiBase}/agents/grid/track-record?days=30`)
  if (!response.ok) throw await apiError(response, 'Grid paper record failed')
  return response.json() as Promise<GridTrackRecord>
}
