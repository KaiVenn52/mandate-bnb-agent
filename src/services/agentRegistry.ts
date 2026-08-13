export type RegistrySnapshot = {
  total: number
  latestAgent: string | null
  chainId: number | null
  capturedAt: string
}

type RegistryResponse = {
  success: boolean
  data: Array<{ name?: string; chain_id?: number }>
  meta?: {
    timestamp?: string
    pagination?: { total?: number }
  }
}

const API_BASE = import.meta.env.VITE_8004SCAN_API_BASE ?? 'https://8004scan.io/api/v1/public'

export async function fetchRegistrySnapshot(signal?: AbortSignal): Promise<RegistrySnapshot> {
  const response = await fetch(`${API_BASE}/agents?page=1&limit=1&chainId=56`, { signal })
  if (!response.ok) throw new Error(`ERC-8004 registry returned ${response.status}`)

  const payload = (await response.json()) as RegistryResponse
  if (!payload.success) throw new Error('ERC-8004 registry did not return a successful response')

  return {
    total: payload.meta?.pagination?.total ?? payload.data.length,
    latestAgent: payload.data[0]?.name ?? null,
    chainId: payload.data[0]?.chain_id ?? null,
    capturedAt: payload.meta?.timestamp ?? new Date().toISOString(),
  }
}
