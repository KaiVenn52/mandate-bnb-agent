export type RegistrySnapshot = {
  total: number
  latestAgent: string | null
  chainId: number | null
  capturedAt: string
}

export type RegistryAgentDiscovery = {
  tokenId: string
  name: string
  description: string
  supportedProtocols: string[]
  totalScore: number
  similarityScore: number | null
  isVerified: boolean
  endpointVerified: boolean
  totalFeedbacks: number
}

type RegistryResponse = {
  success: boolean
  data: Array<{ name?: string; chain_id?: number }>
  meta?: {
    timestamp?: string
    pagination?: { total?: number }
  }
}

type RegistrySearchResponse = {
  success: boolean
  data: Array<{
    token_id?: string | number
    name?: string
    description?: string
    supported_protocols?: string[]
    total_score?: number
    similarity_score?: number
    is_verified?: boolean
    is_endpoint_verified?: boolean
    total_feedbacks?: number
  }>
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

export async function searchRegistryAgents(query: string, signal?: AbortSignal): Promise<RegistryAgentDiscovery[]> {
  const params = new URLSearchParams({ q: query, chainId: '56', limit: '10', semanticWeight: '0.65' })
  const response = await fetch(`${API_BASE}/agents/search?${params}`, { signal })
  if (!response.ok) throw new Error(`ERC-8004 semantic search returned ${response.status}`)

  const payload = (await response.json()) as RegistrySearchResponse
  if (!payload.success) throw new Error('ERC-8004 semantic search did not return a successful response')

  return payload.data
    .filter((agent) => agent.token_id !== undefined && agent.name)
    .map((agent) => ({
      tokenId: String(agent.token_id),
      name: agent.name ?? `Agent #${agent.token_id}`,
      description: agent.description?.trim() || 'No capability description supplied.',
      supportedProtocols: agent.supported_protocols ?? [],
      totalScore: agent.total_score ?? 0,
      similarityScore: agent.similarity_score ?? null,
      isVerified: Boolean(agent.is_verified),
      endpointVerified: Boolean(agent.is_endpoint_verified),
      totalFeedbacks: agent.total_feedbacks ?? 0,
    }))
}
