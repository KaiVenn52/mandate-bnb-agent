export type RegistrySnapshot = {
  total: number
  latestAgent: string | null
  chainId: number | null
  capturedAt: string
}

export type RegistryAgentDiscovery = {
  tokenId: string
  agentId: string
  name: string
  description: string
  ownerAddress: string | null
  agentWallet: string | null
  supportedProtocols: string[]
  mcpEndpoint: string | null
  a2aEndpoint: string | null
  totalScore: number
  similarityScore: number | null
  isVerified: boolean
  endpointVerified: boolean
  isActive: boolean
  healthScore: number | null
  totalFeedbacks: number
  createdTxHash: string | null
}

type RegistryResponse = {
  success: boolean
  data: Array<{ name?: string; chain_id?: number }>
  meta?: {
    timestamp?: string
    pagination?: { total?: number }
  }
}

type RegistryAgentPayload = {
  token_id?: string | number
  agent_id?: string
  name?: string
  description?: string
  owner_address?: string
  agent_wallet?: string
  supported_protocols?: string[]
  mcp_server?: string
  a2a_endpoint?: string
  total_score?: number
  similarity_score?: number
  is_verified?: boolean
  is_endpoint_verified?: boolean
  is_active?: boolean
  health_score?: number
  total_feedbacks?: number
  created_tx_hash?: string
}

type RegistrySearchResponse = {
  success: boolean
  data: RegistryAgentPayload[]
}

type RegistryAgentResponse = {
  success: boolean
  data: RegistryAgentPayload
}

// Browser traffic goes through the same-origin allowlisted cache so one judge
// session cannot exhaust 8004scan's anonymous global quota.
const API_BASE = `${(import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '')}/registry`

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
    .map(normalizeRegistryAgent)
}

function normalizeRegistryAgent(agent: RegistryAgentPayload): RegistryAgentDiscovery {
  return {
    tokenId: String(agent.token_id),
    agentId: agent.agent_id ?? `56:unknown:${agent.token_id}`,
    name: agent.name ?? `Agent #${agent.token_id}`,
    description: agent.description?.trim() || 'No capability description supplied.',
    ownerAddress: agent.owner_address ?? null,
    agentWallet: agent.agent_wallet ?? null,
    supportedProtocols: agent.supported_protocols ?? [],
    mcpEndpoint: agent.mcp_server ?? null,
    a2aEndpoint: agent.a2a_endpoint ?? null,
    totalScore: agent.total_score ?? 0,
    similarityScore: agent.similarity_score ?? null,
    isVerified: Boolean(agent.is_verified),
    endpointVerified: Boolean(agent.is_endpoint_verified),
    isActive: agent.is_active !== false,
    healthScore: agent.health_score ?? null,
    totalFeedbacks: agent.total_feedbacks ?? 0,
    createdTxHash: agent.created_tx_hash ?? null,
  }
}

export async function fetchRegistryAgent(tokenId: string, signal?: AbortSignal): Promise<RegistryAgentDiscovery> {
  if (!/^\d+$/.test(tokenId)) throw new Error('Invalid ERC-8004 token ID.')
  const response = await fetch(`${API_BASE}/agents/56/${tokenId}`, { signal })
  if (!response.ok) throw new Error(`ERC-8004 agent lookup returned ${response.status}`)
  const payload = (await response.json()) as RegistryAgentResponse
  if (!payload.success) throw new Error('ERC-8004 agent lookup did not return a successful response')
  return normalizeRegistryAgent(payload.data)
}
