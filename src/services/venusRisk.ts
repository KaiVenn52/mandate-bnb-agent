export type VenusRiskEvidence = {
  schema: string
  agent: { erc8004_id: number; name: string }
  mandate: {
    account: string
    minimum_liquidation_buffer_usd: number
    allowed_actions: string[]
    broadcast_allowed: boolean
  }
  source: {
    chain: string
    chain_id: number
    protocol: string
    comptroller: string
    block_number: number
    block_hash: string
    block_timestamp: number
    read_method: string
  }
  observation: {
    protocol_error_code: number
    entered_market_count: number
    entered_markets: string[]
    liquidity_buffer_wei: string
    liquidity_buffer_usd: string
    shortfall_wei: string
    shortfall_usd: string
  }
  decision: {
    status: 'NO_POSITION' | 'LIQUIDATABLE' | 'BUFFER_BELOW_MANDATE' | 'WITHIN_MANDATE' | 'DATA_ERROR'
    severity: 'none' | 'low' | 'warning' | 'critical'
    recommendation: string
    transaction_attempted: false
  }
  generated_at_utc: string
  evidence_sha256: string
}

const apiBase = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '')

export async function runVenusRiskAgent(
  account: string,
  minimumBufferUsd: number,
): Promise<VenusRiskEvidence> {
  const response = await fetch(`${apiBase}/agents/venus-risk/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account, minimum_buffer_usd: minimumBufferUsd }),
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(body || `Live agent failed (${response.status})`)
  }
  return response.json() as Promise<VenusRiskEvidence>
}
