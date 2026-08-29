export type RegistrySnapshot = {
  total: number
  latestAgent: string | null
  chainId: number | null
  capturedAt: string
  stale?: boolean
}

export type RegistryAgentDiscovery = {
  chainId: number
  tokenId: string
  agentId: string
  name: string
  description: string
  ownerAddress: string | null
  agentWallet: string | null
  supportedProtocols: string[]
  mcpEndpoint: string | null
  a2aEndpoint: string | null
  agentUrl: string | null
  x402Supported: boolean
  totalScore: number
  similarityScore: number | null
  isVerified: boolean
  endpointVerified: boolean
  isActive: boolean
  healthScore: number | null
  totalFeedbacks: number
  createdTxHash: string | null
  parseWarnings: string[]
  registryStale?: boolean
}

/**
 * A registry URL is only a declaration.  Treat loopback/private hostnames as
 * non-callable in the browser too; otherwise a deployed marketplace could
 * accidentally label a provider's local development server as hireable.
 * Public DNS ownership is still proven by the provider signature, not by this
 * syntactic check.
 */
export function isPublicHttpsEndpoint(value: string | null | undefined): value is string {
  if (typeof value !== 'string' || !/^https:\/\//i.test(value)) return false
  let url: URL
  try { url = new URL(value) } catch { return false }
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname) return false
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host === 'localhost.localdomain' || host.endsWith('.localhost') || host.endsWith('.local')) return false
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4) {
    const octets = ipv4.slice(1).map(Number)
    if (octets.some((octet) => octet > 255)) return false
    const [first, second] = octets
    if (first === 0 || first === 10 || first === 127 || first >= 224 || (first === 169 && second === 254) || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168)) return false
  }
  // Do not make an IPv6 literal look public without a DNS ownership check.
  if (host.includes(':')) return false
  return true
}

type RegistryResponse = {
  success: boolean
  data: Array<{ name?: string; chain_id?: number }>
  meta?: {
    timestamp?: string
    pagination?: { total?: number }
    mandate_cache_stale?: boolean
  }
}

type RegistryAgentPayload = {
  chain_id?: number
  token_id?: string | number
  agent_id?: string
  name?: string
  description?: string
  owner_address?: string
  agent_wallet?: string
  supported_protocols?: string[]
  mcp_server?: string
  a2a_endpoint?: string
  agent_url?: string
  x402_supported?: boolean
  total_score?: number
  similarity_score?: number
  is_verified?: boolean
  is_endpoint_verified?: boolean
  is_active?: boolean
  health_score?: number
  total_feedbacks?: number
  created_tx_hash?: string
  parse_status?: { info?: Array<{ message?: string }> | string | null; warnings?: string[] | string | null }
}

type RegistrySearchResponse = {
  success: boolean
  data: RegistryAgentPayload[]
  meta?: { mandate_cache_stale?: boolean }
}

type RegistryAgentResponse = {
  success: boolean
  data: RegistryAgentPayload
}

// Browser traffic goes through the same-origin allowlisted cache so one judge
// session cannot exhaust 8004scan's anonymous global quota.
const API_BASE = `${(import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '')}/registry`

export async function fetchRegistrySnapshot(signal?: AbortSignal): Promise<RegistrySnapshot> {
  const response = await fetch(`${API_BASE}/agents?page=1&limit=1&chainId=97`, { signal })
  if (!response.ok) throw new Error(`ERC-8004 registry returned ${response.status}`)

  const payload = (await response.json()) as RegistryResponse
  if (!payload.success) throw new Error('ERC-8004 registry did not return a successful response')

  return {
    total: payload.meta?.pagination?.total ?? payload.data.length,
    latestAgent: payload.data[0]?.name ?? null,
    chainId: payload.data[0]?.chain_id ?? null,
    capturedAt: payload.meta?.timestamp ?? new Date().toISOString(),
    stale: payload.meta?.mandate_cache_stale === true,
  }
}

export async function searchRegistryAgents(query: string, signal?: AbortSignal): Promise<RegistryAgentDiscovery[]> {
  const params = new URLSearchParams({ q: query, chainId: '97', limit: '10', semanticWeight: '0.65' })
  const response = await fetch(`${API_BASE}/agents/search?${params}`, { signal })
  if (!response.ok) throw new Error(`ERC-8004 semantic search returned ${response.status}`)

  const payload = (await response.json()) as RegistrySearchResponse
  if (!payload.success) throw new Error('ERC-8004 semantic search did not return a successful response')

  const normalized = payload.data
    .filter((agent) => agent.token_id !== undefined && agent.name)
    .map((agent) => normalizeRegistryAgent(agent, payload.meta?.mandate_cache_stale === true))

  // 8004scan can return many tokenized copies of the same service. Keep the
  // marketplace useful by collapsing exact provider/name duplicates while
  // retaining distinct wallets and identities for comparison.
  const seen = new Set<string>()
  return normalized
    .toSorted((left, right) => {
      const readiness = (agent: RegistryAgentDiscovery) => agent.isActive && agent.endpointVerified && [agent.mcpEndpoint, agent.a2aEndpoint].some((endpoint) => isPublicHttpsEndpoint(endpoint)) ? 2 : agent.isActive && Boolean(agent.agentWallet || agent.ownerAddress) ? 1 : 0
      return readiness(right) - readiness(left) || (right.similarityScore ?? 0) - (left.similarityScore ?? 0) || right.totalScore - left.totalScore
    })
    .filter((agent) => {
      const identity = `${agent.name.toLowerCase()}|${(agent.agentWallet ?? agent.ownerAddress ?? agent.agentId).toLowerCase()}`
      if (seen.has(identity)) return false
      seen.add(identity)
      return true
    })
}

function normalizeRegistryAgent(agent: RegistryAgentPayload, registryStale = false): RegistryAgentDiscovery {
  const parseMessages = (value: unknown) => {
    if (Array.isArray(value)) {
      return value
        .map((item) => typeof item === 'string' ? item : item && typeof item === 'object' && 'message' in item ? (item as { message?: unknown }).message : null)
        .filter((message): message is string => typeof message === 'string' && message.trim().length > 0)
    }
    return typeof value === 'string' && value.trim().length > 0 ? [value] : []
  }
  return {
    // Fail closed when a registry record omits chain_id. Treating an
    // unscoped identity as BSC Testnet would make a mainnet/unknown provider
    // look eligible for a testnet job.
    chainId: agent.chain_id ?? 0,
    tokenId: String(agent.token_id),
    agentId: agent.agent_id ?? `97:unknown:${agent.token_id}`,
    name: agent.name ?? `Agent #${agent.token_id}`,
    description: agent.description?.trim() || 'No capability description supplied.',
    ownerAddress: agent.owner_address ?? null,
    agentWallet: agent.agent_wallet ?? null,
    supportedProtocols: agent.supported_protocols ?? [],
    mcpEndpoint: agent.mcp_server ?? null,
    a2aEndpoint: agent.a2a_endpoint ?? null,
    agentUrl: agent.agent_url ?? null,
    x402Supported: Boolean(agent.x402_supported),
    totalScore: agent.total_score ?? 0,
    similarityScore: agent.similarity_score ?? null,
    isVerified: Boolean(agent.is_verified),
    endpointVerified: Boolean(agent.is_endpoint_verified),
    isActive: agent.is_active !== false,
    healthScore: agent.health_score ?? null,
    totalFeedbacks: agent.total_feedbacks ?? 0,
    createdTxHash: agent.created_tx_hash ?? null,
    parseWarnings: [
      ...parseMessages(agent.parse_status?.info),
      ...parseMessages(agent.parse_status?.warnings),
    ],
    registryStale,
  }
}

export async function fetchRegistryAgent(tokenId: string, signal?: AbortSignal): Promise<RegistryAgentDiscovery> {
  if (!/^\d+$/.test(tokenId)) throw new Error('Invalid ERC-8004 token ID.')
  const response = await fetch(`${API_BASE}/agents/97/${tokenId}`, { signal })
  if (!response.ok) throw new Error(`ERC-8004 agent lookup returned ${response.status}`)
  const payload = (await response.json()) as RegistryAgentResponse
  if (!payload.success) throw new Error('ERC-8004 agent lookup did not return a successful response')
  return normalizeRegistryAgent(payload.data)
}
