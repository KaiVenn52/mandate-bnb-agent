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

const apiBase = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '')

async function post(path: string, body: object): Promise<MarketAgentEvidence> {
  const response = await fetch(`${apiBase}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error((await response.text()) || `Live agent failed (${response.status})`)
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
