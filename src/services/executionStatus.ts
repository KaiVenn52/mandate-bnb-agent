import { apiError } from './apiError'
import type { CategoryId } from '../catalog'

export type ExecutionStatus = {
  schema: string
  chain_id: number
  registry_chain_id?: number
  generated_at_utc: string
  autonomous_execution: false
  service_receipts: { erc8183_jobs: number[]; description: string }
  categories: Record<CategoryId, {
    agent_id: string
    service: string
    mode: string
    service_escrow_enabled: boolean
    asset_transaction_enabled: false
    external_execution_supported?: boolean
    provider_execution_protocol?: string
    required_for_testnet_execution: string[]
  }>
}

const apiBase = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '')

export async function fetchExecutionStatus(signal?: AbortSignal): Promise<ExecutionStatus> {
  const response = await fetch(`${apiBase}/agents/execution-status`, { signal })
  if (!response.ok) throw await apiError(response, 'Execution status failed')
  return response.json() as Promise<ExecutionStatus>
}
