import { isHireableCatalogAgent, type AgentTrackRecord, type CategoryId, type CatalogAgent, type CategoryConfig } from '../catalog'

/**
 * Provider registrations created from this browser are only a convenience
 * index. The ERC-8004 transaction is the source of truth; localStorage merely
 * lets the provider see the identity immediately before 8004scan indexes it.
 */
export type ProviderRegistration = {
  categoryId: CategoryId
  agentId: string
  providerAddress: `0x${string}`
  registrationTxHash: `0x${string}`
  name: string
  serviceEndpoint: string
  serviceProtocol?: 'A2A' | 'MCP'
  endpointVerified?: boolean
  assetExecutionVerified?: boolean
  executionReceiptHashes?: string[]
  executionScope?: {
    category: CategoryId
    chain_id: 97
    allowed_actions: string[]
    contract_allowlist: string[]
    max_value_wei: string
  }
  trackRecord?: AgentTrackRecord
  registeredAt: string
}

const STORAGE_KEY = 'mandate:provider-registrations:v1'

export function loadProviderRegistrations(): ProviderRegistration[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown
    if (!Array.isArray(value)) return []
    return value.filter((item): item is ProviderRegistration => {
      if (!item || typeof item !== 'object') return false
      const record = item as Partial<ProviderRegistration>
      return Boolean(
        record.categoryId &&
        record.agentId &&
        record.providerAddress &&
        record.registrationTxHash &&
        record.name,
      )
    })
  } catch {
    return []
  }
}

export function saveProviderRegistration(record: ProviderRegistration) {
  const existing = loadProviderRegistrations().filter((item) => item.registrationTxHash.toLowerCase() !== record.registrationTxHash.toLowerCase())
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, record]))
}

function liveMetrics(category: CategoryId): Record<string, string> {
  if (category === 'rebalancing') return { netFees: 'Live run', rangeUptime: 'Not claimed', gasDrag: 'Calculated live', rebalances: 'Mandate cap' }
  if (category === 'grid') return { netPnl: 'No realized PnL', drawdown: 'Mandate hard stop', profitFactor: 'Not claimed', winRate: 'No onchain record' }
  if (category === 'yield') return { netApy: 'Live quote', leverage: 'Mandate cap', protocols: 'Live sources', mandates: 'No history claimed' }
  return { minimumHf: 'Live wallet read', leadTime: 'Pinned block', latency: 'API measured', falseAlerts: 'No history claimed' }
}

function benchmarkShape(category: CategoryId) {
  return {
    primary: 'Live decision',
    baseline: 'Not compared',
    advantage: 'Not claimed',
    cost: 'Wallet quote',
    baselineCost: 'Not measured',
    activity: 'Mandate cap',
    baselineActivity: 'Not measured',
    risk: 'Mandate bound',
    baselineRisk: 'Not measured',
    annualised: category === 'grid' ? 'No realized return claim' : undefined,
  }
}

export function providerRegistrationAsAgent(record: ProviderRegistration, category: CategoryConfig): CatalogAgent {
  return {
    id: record.agentId,
    name: record.name,
    recommendation: 'Best fit',
    fit: 100,
    status: 'satisfies',
    metrics: liveMetrics(record.categoryId),
    completedMandates: 0,
    disputed: 0,
    capitalObserved: 0,
    medianExecutionSeconds: 0,
    lastActive: 'Just registered',
    providerAddress: record.providerAddress,
    registrationTxHash: record.registrationTxHash,
    evidenceStatus: 'verified-onchain',
    // An identity can be registered before its first asset receipt exists, but
    // it must stay out of the hireable inventory until that receipt is checked.
    executionMode: record.endpointVerified && record.executionScope && record.assetExecutionVerified ? 'testnet-service-escrow' : 'not-hireable',
    serviceEndpoint: record.serviceEndpoint,
    serviceProtocol: record.serviceProtocol,
    assetExecutionVerified: record.assetExecutionVerified === true,
    executionReceiptHashes: record.executionReceiptHashes ?? [],
    executionScope: record.executionScope,
    trackRecord: record.trackRecord,
    providerSource: `Provider wallet ${record.providerAddress.slice(0, 6)}…${record.providerAddress.slice(-4)} · ERC-8004 receipt${record.endpointVerified ? ' · capability verified' : ' · endpoint capability not verified'}${record.assetExecutionVerified ? ' · testnet receipt verified' : ''}`,
    shadow: benchmarkShape(category.id),
  }
}

/** Merge locally indexed provider registrations without ever promoting fixtures. */
export function getMarketplaceCategory(category: CategoryConfig): CategoryConfig {
  const localAgents = loadProviderRegistrations()
    .filter((record) => record.categoryId === category.id)
    .map((record) => providerRegistrationAsAgent(record, category))
  const byIdentity = new Map<string, CatalogAgent>()
  for (const agent of [...category.agents, ...localAgents]) {
    const key = `${agent.id}:${agent.providerAddress?.toLowerCase() ?? 'fixture'}`
    byIdentity.set(key, agent)
  }
  return { ...category, agents: [...byIdentity.values()] }
}

export function categoryProviderSummary(category: CategoryConfig) {
  const hireable = category.agents.filter(isHireableCatalogAgent)
  const providers = new Set(hireable.map((agent) => agent.providerAddress?.toLowerCase()).filter(Boolean))
  const executionVerified = hireable.filter((agent) => agent.assetExecutionVerified === true)
  return {
    hireableAgents: hireable.length,
    uniqueProviders: providers.size,
    executionVerifiedAgents: executionVerified.length,
    executionReceiptCount: executionVerified.reduce((count, agent) => count + (agent.executionReceiptHashes?.length ?? 0), 0),
    needsIndependentProvider: providers.size < 2,
  }
}
