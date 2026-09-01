import { isAddress } from 'viem'
import type { AgentTrackRecord, CategoryId } from '../catalog'
import { isPublicHttpsEndpoint } from './agentRegistry'

/**
 * Small provider-owned capability document used by the onboarding flow.
 *
 * ERC-8004 metadata tells us where an agent says it lives; it does not prove
 * that the endpoint belongs to the wallet or that it can execute a bounded
 * testnet action. This document is intentionally stricter than a health check
 * and is fetched directly from the provider with browser CORS enabled.
 */
export type ProviderServiceDocument = {
  schema: 'mandate.provider-service.v1'
  version: 1
  chain_id: 97
  provider_address: string
  service_protocol: 'A2A' | 'MCP'
  categories: CategoryId[]
  acceptance_endpoint: string
  execution_endpoint: string
  capabilities: {
    bounded_service_escrow: boolean
    bounded_testnet_execution: boolean
    asset_transactions: boolean
  }
  /** Explicit action/contract ceiling for the provider-owned testnet path. */
  execution_scope: {
    category: CategoryId
    chain_id: 97
    allowed_actions: string[]
    contract_allowlist: string[]
    max_value_wei: string
  }
  execution_receipts?: string[]
  /** Required for the grid category; optional for non-trading services. */
  track_record?: AgentTrackRecord
}

export type ProviderCapabilityResult = {
  document: ProviderServiceDocument
  endpoint: string
  executionScope: ProviderServiceDocument['execution_scope']
  executionReceipts: string[]
  trackRecord?: AgentTrackRecord
}

const API_ROOT = `${(import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '')}`

function httpsUrl(value: string, label: string): URL {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${label} must be a valid HTTPS URL.`)
  }
  if (!isPublicHttpsEndpoint(value)) throw new Error(`${label} must use public HTTPS without private or loopback hosts.`)
  return url
}

function isHexTxHash(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value)
}

function isCategory(value: unknown): value is CategoryId {
  return value === 'rebalancing' || value === 'grid' || value === 'yield' || value === 'health'
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 120
}

function assertDocument(value: unknown, categoryId: CategoryId, expectedProvider: string, endpoint: URL, requireExecutionReceipt: boolean): ProviderServiceDocument {
  if (!value || typeof value !== 'object') throw new Error('Provider endpoint did not return a JSON capability document.')
  const candidate = value as Partial<ProviderServiceDocument>
  if (candidate.schema !== 'mandate.provider-service.v1' || candidate.version !== 1 || candidate.chain_id !== 97) {
    throw new Error('Provider endpoint must return mandate.provider-service.v1 for BSC Testnet (chain 97).')
  }
  if (!candidate.provider_address || !isAddress(candidate.provider_address) || candidate.provider_address.toLowerCase() !== expectedProvider.toLowerCase()) {
    throw new Error('Provider capability wallet does not match the connected registration wallet.')
  }
  if (candidate.service_protocol !== 'A2A' && candidate.service_protocol !== 'MCP') {
    throw new Error('Provider capability document must declare A2A or MCP.')
  }
  if (!Array.isArray(candidate.categories) || !candidate.categories.every(isCategory) || !candidate.categories.includes(categoryId)) {
    throw new Error(`Provider capability document does not advertise the ${categoryId} category.`)
  }
  const acceptance = typeof candidate.acceptance_endpoint === 'string' ? httpsUrl(candidate.acceptance_endpoint, 'Acceptance endpoint') : null
  const execution = typeof candidate.execution_endpoint === 'string' ? httpsUrl(candidate.execution_endpoint, 'Execution endpoint') : null
  if (!acceptance || !execution) throw new Error('Provider must publish both HTTPS acceptance and bounded execution endpoints.')
  if (candidate.capabilities?.bounded_service_escrow !== true || (requireExecutionReceipt && (candidate.capabilities?.bounded_testnet_execution !== true || candidate.capabilities?.asset_transactions !== true))) {
    throw new Error('Provider has not declared bounded testnet asset execution and service escrow.')
  }
  const scope = candidate.execution_scope
  if (!scope || typeof scope !== 'object' || scope.category !== categoryId || scope.chain_id !== 97 || !Array.isArray(scope.allowed_actions) || !scope.allowed_actions.length || !scope.allowed_actions.every(isNonEmptyString) || !Array.isArray(scope.contract_allowlist) || !scope.contract_allowlist.length || !scope.contract_allowlist.every((value) => typeof value === 'string' && isAddress(value)) || typeof scope.max_value_wei !== 'string' || !/^\d+$/.test(scope.max_value_wei)) {
    throw new Error('Provider capability must declare a category-matched BSC Testnet execution scope, contract allowlist and max_value_wei.')
  }
  try {
    if (BigInt(scope.max_value_wei) <= 0n) throw new Error('zero ceiling')
  } catch {
    throw new Error('Provider execution scope max_value_wei must be a positive integer.')
  }
  const receipts = Array.isArray(candidate.execution_receipts) ? candidate.execution_receipts.filter(isHexTxHash) : []
  if (new Set(receipts.map((receipt) => receipt.toLowerCase())).size !== receipts.length) {
    throw new Error('Provider capability document contains duplicate execution receipts.')
  }
  if (requireExecutionReceipt && receipts.length === 0) throw new Error('Provider capability document has no testnet transaction receipt yet.')
  if (categoryId === 'grid' && (requireExecutionReceipt || receipts.length > 0)) {
    const record = candidate.track_record
    const start = record?.window?.start_utc
    const end = record?.window?.end_utc
    const transactions = record?.onchain_evidence?.transactions
    if (!record || record.schema !== 'mandate.agent-track-record.v1' || record.mode !== 'realized-onchain' || typeof start !== 'string' || typeof end !== 'string' || !Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end)) || Date.parse(end) <= Date.parse(start) || record.onchain_evidence?.chain_id !== 97 || !record.summary || !Number.isInteger(record.summary.executed_trades) || record.summary.executed_trades <= 0 || !Number.isInteger(record.summary.winning_trades) || record.summary.winning_trades < 0 || !Number.isInteger(record.summary.losing_trades) || record.summary.losing_trades < 0 || record.summary.winning_trades + record.summary.losing_trades !== record.summary.executed_trades || typeof record.summary.win_rate_pct !== 'number' || !Number.isFinite(record.summary.win_rate_pct) || record.summary.win_rate_pct < 0 || record.summary.win_rate_pct > 100 || Math.abs(record.summary.win_rate_pct - (record.summary.winning_trades / record.summary.executed_trades) * 100) > 0.01 || typeof record.summary.max_drawdown_pct !== 'number' || !Number.isFinite(record.summary.max_drawdown_pct) || record.summary.max_drawdown_pct < 0 || record.summary.max_drawdown_pct > 100 || !record.risk_exposure || typeof record.risk_exposure.position_side !== 'string' || !record.risk_exposure.position_side.trim() || typeof record.risk_exposure.leverage !== 'number' || !Number.isFinite(record.risk_exposure.leverage) || record.risk_exposure.leverage < 0 || typeof record.risk_exposure.max_loss_pct !== 'number' || !Number.isFinite(record.risk_exposure.max_loss_pct) || record.risk_exposure.max_loss_pct < 0 || record.risk_exposure.max_loss_pct > 100 || typeof record.risk_exposure.notes !== 'string' || !record.risk_exposure.notes.trim() || !Array.isArray(transactions) || transactions.length < record.summary.executed_trades || new Set(transactions.map((item) => item?.hash?.toLowerCase())).size !== transactions.length || !transactions.every((item) => item && isHexTxHash(item.hash) && typeof item.executed_at_utc === 'string' && Number.isFinite(Date.parse(item.executed_at_utc)) && Date.parse(item.executed_at_utc) >= Date.parse(start) && Date.parse(item.executed_at_utc) <= Date.parse(end) && Date.parse(item.executed_at_utc) <= Date.now() && receipts.some((receipt) => receipt.toLowerCase() === item.hash.toLowerCase()))) {
      throw new Error('Grid providers must publish a realized-onchain track record with a time window, win/loss counts, max drawdown, risk exposure and receipt-linked trades.')
    }
  }
  // The endpoint itself must be the advertised acceptance or execution host;
  // this prevents a provider from registering a convenient third-party URL.
  const hostMatches = [acceptance, execution].every((url) => url.hostname === endpoint.hostname)
  if (!hostMatches) throw new Error('Acceptance and execution endpoints must share the registered provider host.')
  return candidate as ProviderServiceDocument
}

export async function probeProviderCapability(
  endpoint: string,
  categoryId: CategoryId,
  expectedProvider: string,
  options: { requireExecutionReceipt?: boolean } = {},
  signal?: AbortSignal,
): Promise<ProviderCapabilityResult> {
  const endpointUrl = httpsUrl(endpoint, 'Provider service endpoint')
  if (!isAddress(expectedProvider)) throw new Error('Connected provider wallet is not a valid EVM address.')
  const controller = new AbortController()
  // Free provider hosts can cold-start for close to a minute. Registration is
  // intentionally gated on this probe, so a short timeout prevents the wallet
  // request from ever opening even when the provider is healthy.
  const capabilityTimeoutMs = 65_000
  const timeout = window.setTimeout(() => controller.abort(), capabilityTimeoutMs)
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  try {
    let response: Response
    try {
      response = await fetch(endpointUrl.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: controller.signal,
      })
    } catch (reason) {
      // Capability documents are often served by an agent that has not opted
      // into browser CORS. Retry through MANDATE's SSRF-guarded, GET-only
      // proxy; the document and receipts still face the exact same checks.
      if (!(reason instanceof TypeError)) throw reason
      const proxyResponse = await fetch(`${API_ROOT}/registry/provider-capability`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: endpointUrl.toString() }),
        signal: controller.signal,
      })
      if (!proxyResponse.ok) {
        let detail = ''
        try {
          const body = await proxyResponse.json() as { detail?: string }
          detail = body.detail ? `: ${body.detail}` : ''
        } catch { /* preserve the status when the proxy returned non-JSON */ }
        throw new Error(`Provider capability endpoint could not be reached from the browser or proxy (${proxyResponse.status})${detail}`)
      }
      response = proxyResponse
    }
    if (!response.ok) throw new Error(`Provider capability endpoint returned HTTP ${response.status}.`)
    const document = assertDocument(await response.json(), categoryId, expectedProvider, endpointUrl, options.requireExecutionReceipt === true)
    return {
      document,
      endpoint: endpointUrl.toString(),
      executionScope: document.execution_scope,
      executionReceipts: (document.execution_receipts ?? []).filter(isHexTxHash),
      trackRecord: document.track_record,
    }
  } catch (reason) {
    if (reason instanceof DOMException && reason.name === 'AbortError') throw new Error('Provider capability endpoint timed out after 65 seconds.')
    throw reason instanceof Error ? reason : new Error('Provider capability probe failed.')
  } finally {
    window.clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
  }
}
