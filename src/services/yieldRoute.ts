import { apiError } from './apiError'

export type YieldRoute = {
  pool_id: string
  protocol: string
  project: string
  symbol: string
  pool_meta: string | null
  apy_pct: number
  apy_base_pct: number | null
  apy_reward_pct: number
  estimated_gross_yield_usd_year: number
  pool_tvl_usd: number
  protocol_tvl_usd: number | null
  protocol_tvl_change_7d_pct: number | null
  risk: 'low' | 'medium' | 'high'
  risk_signals: string[]
  eligible: boolean
  violations: string[]
}

export type YieldRouteEvidence = {
  schema: string
  agent: { erc8004_id: number; name: string }
  mandate: {
    asset: string
    capital_usd: number
    max_risk: 'low' | 'medium' | 'high'
    leverage_max: number
    allowed_protocols: string[]
    max_actions_per_week: number
    broadcast_allowed: false
  }
  source: {
    chain: string
    chain_id: number
    provider: string
    yield_url: string
    protocol_url: string
    retrieved_at_utc: string
    method: string
  }
  coverage: {
    supported_protocols: string[]
    matching_pools: number
    eligible_pools: number
    rejected_pools: number
    limitations: string[]
  }
  decision: {
    status: 'ROUTE_FOUND' | 'NO_COMPLIANT_ROUTE'
    selected_pool_id: string | null
    protocol?: string
    project?: string
    symbol?: string
    apy_pct?: number
    estimated_gross_yield_usd_year?: number
    recommendation: string
    transaction_attempted: false
  }
  eligible_routes: YieldRoute[]
  rejected_routes: YieldRoute[]
  generated_at_utc: string
  deliverable_sha256: string
}

const apiBase = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '')

export async function runYieldRouteAgent(input: {
  asset: string
  capitalUsd: number
  maxRisk: 'low' | 'medium' | 'high'
  leverageMax: number
  allowedProtocols: string[]
  maxActionsPerWeek: number
}): Promise<YieldRouteEvidence> {
  const response = await fetch(`${apiBase}/agents/yield-route/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      asset: input.asset,
      capital_usd: input.capitalUsd,
      max_risk: input.maxRisk,
      leverage_max: input.leverageMax,
      allowed_protocols: input.allowedProtocols,
      max_actions_per_week: input.maxActionsPerWeek,
    }),
  })
  if (!response.ok) throw await apiError(response, 'Live YieldRoute failed')
  return response.json() as Promise<YieldRouteEvidence>
}
