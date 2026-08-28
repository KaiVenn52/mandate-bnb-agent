import { apiError } from './apiError'

const API_BASE = import.meta.env.VITE_MANDATE_API_BASE ?? (import.meta.env.PROD ? '/api' : 'http://127.0.0.1:8003')

export type GatewayHealth = {
  ok: boolean
  network: string
  live: boolean
  liveData?: boolean
  autonomousExecution?: boolean
  executionMode?: string
  sdk: string
  standards: string[]
  operatorAddress?: string | null
}

export type JobPreview = {
  mode: 'preview' | 'live-ready'
  network: string
  provider: string
  description: string
  budget_wei: number
  expired_at: number
  lifecycle: string[]
  broadcast: false
}

export async function fetchGatewayHealth(signal?: AbortSignal): Promise<GatewayHealth> {
  const response = await fetch(`${API_BASE}/health`, { signal })
  if (!response.ok) throw new Error(`Gateway health returned ${response.status}`)
  return response.json() as Promise<GatewayHealth>
}

export async function previewJob(input: {
  provider: `0x${string}`
  description: string
  budgetWei: number
  durationSeconds: number
}): Promise<JobPreview> {
  const response = await fetch(`${API_BASE}/jobs/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: input.provider,
      description: input.description,
      budget_wei: input.budgetWei,
      duration_seconds: input.durationSeconds,
    }),
  })

  if (!response.ok) throw await apiError(response, 'Gateway preview failed')
  return response.json() as Promise<JobPreview>
}
