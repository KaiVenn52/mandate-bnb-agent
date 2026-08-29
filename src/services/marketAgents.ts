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
  mandate?: {
    capital_usd: number
    max_rebalances_per_day?: number
    max_gas_drag_pct?: number
    target_width_pct?: number
    max_drawdown_pct?: number
    max_orders_per_day?: number
    requested_grid_levels?: number
    action_cap?: number
    action_period?: ActionPeriod
    effective_daily_cap?: number
    broadcast_allowed: false
  }
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
  risk_exposure: {
    position_side: string
    leverage: number
    capital_base_usd: number
    hard_stop_pct: number
    max_loss_if_hard_stop_usd: number
    exposure_model: string
  }
  onchain_evidence: {
    status: 'none' | 'partial' | 'verified'
    chain_id: number
    transaction_count: number
    transactions: Array<{ hash: string; url?: string; executed_at_utc?: string }>
    verification_url: string | null
    note: string
  }
  limitations: string[]
  generated_at_utc: string
  evidence_sha256: string
}

const apiBase = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '')

type ActionPeriod = 'day' | 'week' | 'month'

export const dailyActionCap = (count: number, period: ActionPeriod) => {
  const days = period === 'day' ? 1 : period === 'week' ? 7 : 30
  return Math.max(1, Math.ceil(count / days))
}

async function post(path: string, body: object): Promise<MarketAgentEvidence> {
  const response = await fetch(`${apiBase}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw await apiError(response, 'Live agent failed')
  return response.json() as Promise<MarketAgentEvidence>
}

export const runRebalancingAgent = (input: {
  capitalUsd: number
  actionCap: number
  actionPeriod: ActionPeriod
  maxGasDragPct: number
  targetWidthPct?: number
}) => post('/agents/rebalancing/run', {
  capital_usd: input.capitalUsd,
  max_rebalances_per_day: dailyActionCap(input.actionCap, input.actionPeriod),
  max_gas_drag_pct: input.maxGasDragPct,
  target_width_pct: input.targetWidthPct ?? 15,
  action_cap: input.actionCap,
  action_period: input.actionPeriod,
})

export const runGridAgent = (input: {
  capitalUsd: number
  actionCap: number
  actionPeriod: ActionPeriod
  maxDrawdownPct: number
  gridLevels?: number
}) => post('/agents/grid/run', {
  capital_usd: input.capitalUsd,
  max_drawdown_pct: input.maxDrawdownPct,
  max_orders_per_day: dailyActionCap(input.actionCap, input.actionPeriod),
  grid_levels: input.gridLevels ?? 7,
  action_cap: input.actionCap,
  action_period: input.actionPeriod,
})

export async function fetchGridTrackRecord(): Promise<GridTrackRecord> {
  const response = await fetch(`${apiBase}/agents/grid/track-record?days=30`)
  if (!response.ok) throw await apiError(response, 'Grid paper record failed')
  return response.json() as Promise<GridTrackRecord>
}
