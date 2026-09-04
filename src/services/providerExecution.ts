import { isAddress, keccak256, stringToHex, type Hex, type PublicClient } from 'viem'
import type { CategoryId } from '../catalog'
import { isPublicHttpsEndpoint, type RegistryAgentDiscovery } from './agentRegistry'
import { ERC8183_COMMERCE_ADDRESS } from './erc8183'
import { verifyAssignedProviderAcceptance, verifyProviderSignature, type ProviderAcceptanceReceipt } from './providerAcceptance'

/**
 * Provider-owned, bounded execution request.  MANDATE never receives a
 * provider private key: it only asks the provider to execute one named action
 * inside the provider-published scope and return independently checkable
 * receipts.
 */
export type ProviderExecutionRequest = {
  schema: 'mandate.provider-execution-request.v1'
  version: 1
  chain_id: 97
  job_id: string
  category: CategoryId
  mandate: string
  mandate_digest: Hex
  provider_address: string
  action: string
  constraints: Record<string, unknown>
  requested_at_utc: string
  request_nonce: string
  submit_to_erc8183: boolean
  acceptance_receipt: {
    schema: ProviderAcceptanceReceipt['schema']
    mandate_digest: Hex
    provider_address: `0x${string}`
    signature: Hex
    expires_at_utc: string
    protocol?: ProviderAcceptanceReceipt['protocol']
  }
}

export type ProviderExecutionScope = {
  category: CategoryId
  chain_id: 97
  allowed_actions: string[]
  contract_allowlist: string[]
  max_value_wei: string
}

export type ProviderCommerceSubmission = {
  transaction_hash: Hex
  deliverable_hash: Hex
  deliverable_url: string
}

export type ProviderExecutionReceipt = {
  schema: 'mandate.provider-execution-receipt.v1'
  version: 1
  accepted: true
  chain_id: 97
  job_id: string
  category: CategoryId
  action: string
  mandate_digest: Hex
  request_nonce: string
  provider_address: `0x${string}`
  transaction_hash: Hex
  transaction_to: `0x${string}`
  executed_at_utc: string
  execution_scope: ProviderExecutionScope
  receipt_digest?: Hex
  signature: Hex
  deliverable_hash?: Hex
  deliverable_url?: string
  commerce_submission?: ProviderCommerceSubmission
  protocol?: 'mandate' | 'a2a'
  service_endpoint?: string
}

/**
 * Official BNBAgent A2A sellers may use the ERC-8183 `notify_funded` skill
 * instead of MANDATE's optional execution-receipt extension. This notice is
 * only an acknowledgement that the provider started delivery; it is never
 * treated as an execution or performance receipt.
 */
export type ProviderFundingNotification = {
  schema: 'mandate.provider-funded-notification.v1'
  accepted: true
  chain_id: 97
  job_id: string
  provider_address: `0x${string}`
  notified_at_utc: string
  service_endpoint: string
  provider_status: 'accepted'
}

export type ExecutionChainReader = Pick<PublicClient, 'getTransactionReceipt' | 'getTransaction'>

const API_ROOT = `${(import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '')}`
const STORAGE_PREFIX = 'mandate:provider-execution:v1:'

const actionByCategory: Record<CategoryId, string> = {
  rebalancing: 'execute-bounded-lp-rebalance',
  grid: 'execute-bounded-grid-swap',
  yield: 'execute-bounded-yield-route',
  health: 'execute-bounded-health-intervention',
}

export function actionForCategory(category: CategoryId) {
  return actionByCategory[category]
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

function isHash(value: unknown): value is Hex {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value)
}

function isSignature(value: unknown): value is Hex {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{130}$/.test(value)
}

function isHttps(value: unknown): value is string {
  return isPublicHttpsEndpoint(typeof value === 'string' ? value : undefined)
}

function endpointCandidates(agent: RegistryAgentDiscovery, acceptance?: ProviderAcceptanceReceipt) {
  const values = [acceptance?.execution_endpoint, agent.a2aEndpoint, agent.mcpEndpoint]
  const seen = new Set<string>()
  return values.filter((value): value is string => {
    if (!isHttps(value) || seen.has(value)) return false
    seen.add(value)
    return true
  })
}

type HttpResult = { status: number; payload: unknown }

async function jsonBody(response: Response): Promise<unknown> {
  try { return await response.json() } catch { return null }
}

function responseDetail(payload: unknown) {
  if (!payload || typeof payload !== 'object') return ''
  const root = payload as Record<string, unknown>
  const nested = root.error && typeof root.error === 'object' ? root.error as Record<string, unknown> : null
  const detail = [root.detail, root.message, nested?.message, typeof root.error === 'string' ? root.error : null]
    .find((item): item is string => typeof item === 'string' && item.trim().length > 0)
  return detail ? detail.replace(/[\r\n]+/g, ' ').trim().slice(0, 240) : ''
}

function httpFailure(label: string, result: HttpResult) {
  const detail = responseDetail(result.payload)
  return new Error(`${label} HTTP ${result.status}${detail ? `: ${detail}` : '.'}`)
}

async function postJson(endpoint: string, payload: unknown, signal?: AbortSignal): Promise<HttpResult> {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    })
    return { status: response.status, payload: await jsonBody(response) }
  } catch (reason) {
    if (!(reason instanceof TypeError)) throw reason
    const proxyResponse = await fetch(`${API_ROOT}/registry/provider-execution`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint, payload }),
      signal,
    })
    return { status: proxyResponse.status, payload: await jsonBody(proxyResponse) }
  }
}

async function getJson(endpoint: string, signal?: AbortSignal): Promise<HttpResult> {
  try {
    const response = await fetch(endpoint, { headers: { Accept: 'application/json' }, cache: 'no-store', signal })
    return { status: response.status, payload: await jsonBody(response) }
  } catch (reason) {
    if (!(reason instanceof TypeError)) throw reason
    const proxyResponse = await fetch(`${API_ROOT}/registry/provider-card`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
      signal,
    })
    return { status: proxyResponse.status, payload: await jsonBody(proxyResponse) }
  }
}

function jsonRpcData(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== 'object') return null
  const root = payload as Record<string, unknown>
  const result = root.result && typeof root.result === 'object' ? root.result as Record<string, unknown> : null
  if (!result) return null
  const candidates: unknown[] = [result, result.message]
  if (Array.isArray(result.artifacts)) candidates.push(...result.artifacts)
  for (const item of candidates) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    if (record.schema === 'mandate.provider-execution-receipt.v1') return record
    const parts = Array.isArray(record.parts) ? record.parts : []
    for (const part of parts) {
      if (!part || typeof part !== 'object') continue
      const partRecord = part as Record<string, unknown>
      if (partRecord.kind !== 'data' && partRecord.type !== 'data') continue
      if (partRecord.data && typeof partRecord.data === 'object') return partRecord.data as Record<string, unknown>
      if (typeof partRecord.data === 'string') {
        try {
          const parsed = JSON.parse(partRecord.data) as unknown
          if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>
        } catch { /* provider returned a non-JSON data part */ }
      }
    }
  }
  return null
}

function resolveA2AUrl(card: Record<string, unknown>, base: string) {
  const candidates: unknown[] = [card.url]
  if (Array.isArray(card.supportedInterfaces)) candidates.push(...card.supportedInterfaces.map((item) => item && typeof item === 'object' ? (item as Record<string, unknown>).url : null))
  if (Array.isArray(card.endpoints)) candidates.push(...card.endpoints.map((item) => item && typeof item === 'object' ? (item as Record<string, unknown>).url : item))
  for (const item of candidates) {
    if (typeof item !== 'string' || !item.trim()) continue
    try {
      const url = new URL(item, base)
      if (isPublicHttpsEndpoint(url.toString())) return url.toString()
    } catch { /* try the next advertised interface */ }
  }
  return null
}

async function a2aEndpoint(agent: RegistryAgentDiscovery, signal?: AbortSignal) {
  const card = await a2aCard(agent, signal)
  return card.endpoint
}

async function a2aCard(agent: RegistryAgentDiscovery, signal?: AbortSignal) {
  const endpoint = agent.a2aEndpoint
  if (!endpoint || !isHttps(endpoint)) throw new Error('The provider did not publish a public HTTPS A2A endpoint.')
  const card = await getJson(endpoint, signal).catch(() => null)
  if (card?.status === 200 && card.payload && typeof card.payload === 'object') {
    const payload = card.payload as Record<string, unknown>
    const skills = Array.isArray(payload.skills)
      ? payload.skills
        .map((skill) => skill && typeof skill === 'object' ? (skill as Record<string, unknown>).id : null)
        .filter((skill): skill is string => typeof skill === 'string' && skill.trim().length > 0)
      : []
    return { endpoint: resolveA2AUrl(payload, endpoint) ?? endpoint, skills }
  }
  return { endpoint, skills: [] }
}

function buildA2AFundedEnvelope(jobId: string) {
  return {
    jsonrpc: '2.0',
    id: crypto.randomUUID(),
    method: 'message/send',
    params: {
      message: {
        kind: 'message',
        role: 'user',
        messageId: crypto.randomUUID(),
        parts: [{ kind: 'data', data: { skill: 'notify_funded', job_id: Number(jobId) } }],
      },
    },
  }
}

/**
 * Notify an official BNBAgent ERC-8183 seller after the client funds a job.
 * The seller may then submit its own deliverable asynchronously. Returning
 * `null` means the card does not advertise this official skill, so callers can
 * try MANDATE's stronger bounded-execution receipt extension instead.
 */
export async function notifyProviderFunded(
  agent: RegistryAgentDiscovery,
  jobId: bigint | string,
  providerAddress: string,
  signal?: AbortSignal,
): Promise<ProviderFundingNotification | null> {
  const declaredProvider = agent.agentWallet ?? agent.ownerAddress
  if (!agent.a2aEndpoint || !isAddress(providerAddress) || !declaredProvider || !isAddress(declaredProvider) || declaredProvider.toLowerCase() !== providerAddress.toLowerCase()) {
    return null
  }
  const card = await a2aCard(agent, signal)
  if (!card.skills.includes('notify_funded')) return null
  const normalizedJobId = String(jobId)
  if (!/^\d+$/.test(normalizedJobId) || Number(normalizedJobId) > Number.MAX_SAFE_INTEGER) throw new Error('The funded job ID is not safe to send over A2A.')
  const result = await postJson(card.endpoint, buildA2AFundedEnvelope(normalizedJobId), signal)
  if (result.status < 200 || result.status >= 300) throw httpFailure('Provider A2A funded notification returned', result)
  const data = jsonRpcData(result.payload)
  if (!data || data.status !== 'accepted' || String(data.job_id) !== normalizedJobId) throw new Error('Provider A2A did not acknowledge this funded job.')
  return {
    schema: 'mandate.provider-funded-notification.v1',
    accepted: true,
    chain_id: 97,
    job_id: normalizedJobId,
    provider_address: providerAddress as `0x${string}`,
    notified_at_utc: new Date().toISOString(),
    service_endpoint: card.endpoint,
    provider_status: 'accepted',
  }
}

function buildA2AEnvelope(request: ProviderExecutionRequest) {
  return {
    jsonrpc: '2.0',
    id: crypto.randomUUID(),
    method: 'message/send',
    params: {
      message: {
        kind: 'message',
        role: 'user',
        messageId: crypto.randomUUID(),
        parts: [{ kind: 'data', data: { skill: 'execute-bounded-testnet-action', ...request } }],
      },
    },
  }
}

function rawReceipt(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== 'object') return null
  const root = payload as Record<string, unknown>
  if (root.schema === 'mandate.provider-execution-receipt.v1') return root
  if (root.receipt && typeof root.receipt === 'object') return root.receipt as Record<string, unknown>
  return jsonRpcData(payload)
}

function scopeFrom(value: unknown): ProviderExecutionScope | null {
  if (!value || typeof value !== 'object') return null
  const scope = value as Record<string, unknown>
  if (
    scope.category !== 'rebalancing' && scope.category !== 'grid' && scope.category !== 'yield' && scope.category !== 'health'
  ) return null
  if (scope.chain_id !== 97 || !Array.isArray(scope.allowed_actions) || !scope.allowed_actions.every((item) => typeof item === 'string' && item.length > 0) || !Array.isArray(scope.contract_allowlist) || !scope.contract_allowlist.every((item) => typeof item === 'string' && isAddress(item)) || typeof scope.max_value_wei !== 'string' || !/^\d+$/.test(scope.max_value_wei) || BigInt(scope.max_value_wei) < 0n) return null
  return {
    category: scope.category,
    chain_id: 97,
    allowed_actions: scope.allowed_actions,
    contract_allowlist: scope.contract_allowlist,
    max_value_wei: scope.max_value_wei,
  }
}

async function verifyChainCall(reader: ExecutionChainReader, hash: Hex, provider: string, expectedTo: string, scope: ProviderExecutionScope) {
  const receipt = await reader.getTransactionReceipt({ hash })
  const transaction = await reader.getTransaction({ hash })
  if (receipt.status !== 'success') throw new Error('Provider execution transaction did not succeed on BSC Testnet.')
  if (!receipt.from || receipt.from.toLowerCase() !== provider.toLowerCase()) throw new Error('Provider execution receipt sender does not match the ERC-8004 wallet.')
  if (!receipt.to || !transaction.to || receipt.to.toLowerCase() !== transaction.to.toLowerCase() || transaction.to.toLowerCase() !== expectedTo.toLowerCase()) throw new Error('Provider execution target does not match the signed receipt.')
  if (!scope.contract_allowlist.some((item) => item.toLowerCase() === transaction.to?.toLowerCase())) throw new Error('Provider execution target is outside the published contract allowlist.')
  if (transaction.input === '0x') throw new Error('Provider execution transaction has no calldata.')
  if (transaction.value > BigInt(scope.max_value_wei)) throw new Error('Provider execution value exceeds the provider-published ceiling.')
}

async function validateReceipt(value: Record<string, unknown>, request: ProviderExecutionRequest, reader: ExecutionChainReader, endpoint: string): Promise<ProviderExecutionReceipt> {
  const provider = value.provider_address
  const txHash = value.transaction_hash
  const txTo = value.transaction_to
  const scope = scopeFrom(value.execution_scope ?? value.scope)
  const signature = value.signature
  const action = value.action
  if (value.schema !== 'mandate.provider-execution-receipt.v1' || value.version !== 1 || value.accepted !== true || value.chain_id !== 97 || String(value.job_id) !== request.job_id || value.category !== request.category || typeof value.mandate_digest !== 'string' || value.mandate_digest.toLowerCase() !== request.mandate_digest.toLowerCase() || value.request_nonce !== request.request_nonce || typeof action !== 'string' || !scope || scope.category !== request.category || !scope.allowed_actions.includes(action) || action !== request.action || typeof provider !== 'string' || !isAddress(provider) || provider.toLowerCase() !== request.provider_address.toLowerCase() || !isHash(txHash) || typeof txTo !== 'string' || !isAddress(txTo) || !isSignature(signature) || typeof value.executed_at_utc !== 'string' || !Number.isFinite(Date.parse(value.executed_at_utc))) {
    throw new Error('Provider execution response is missing an exact mandate, action, scope or signed receipt.')
  }
  const executedAt = Date.parse(value.executed_at_utc as string)
  const requestedAt = Date.parse(request.requested_at_utc)
  if (!Number.isFinite(requestedAt) || executedAt < requestedAt - 5 * 60_000 || executedAt > Date.now() + 5 * 60_000) {
    throw new Error('Provider execution receipt timestamp is outside this request window.')
  }
  const unsigned = { ...value }
  delete unsigned.signature
  // `receipt_digest` is the detached digest itself, so it must not be part
  // of the payload that is hashed. Otherwise providers would have to sign a
  // circular value and every otherwise-valid receipt would fail verification.
  delete unsigned.receipt_digest
  const digest = keccak256(stringToHex(stableJson(unsigned)))
  if (value.receipt_digest && (!isHash(value.receipt_digest) || value.receipt_digest.toLowerCase() !== digest.toLowerCase())) throw new Error('Provider execution receipt digest does not match its canonical payload.')
  if (!(await verifyProviderSignature(provider as `0x${string}`, digest, signature))) throw new Error('Provider execution signature could not be verified against the ERC-8004 wallet.')
  await verifyChainCall(reader, txHash, provider, txTo, scope)

  let commerceSubmission: ProviderCommerceSubmission | undefined
  const submission = value.commerce_submission
  if (submission && typeof submission === 'object') {
    const item = submission as Record<string, unknown>
    if (!isHash(item.transaction_hash) || !isHash(item.deliverable_hash) || !isHttps(item.deliverable_url)) throw new Error('Provider commerce submission has an invalid transaction, hash or HTTPS URL.')
    const submissionReceipt = await reader.getTransactionReceipt({ hash: item.transaction_hash })
    const submissionTx = await reader.getTransaction({ hash: item.transaction_hash })
    if (submissionReceipt.status !== 'success' || !submissionReceipt.from || submissionReceipt.from.toLowerCase() !== provider.toLowerCase() || !submissionReceipt.to || !submissionTx.to || submissionReceipt.to.toLowerCase() !== submissionTx.to.toLowerCase() || submissionTx.to.toLowerCase() !== ERC8183_COMMERCE_ADDRESS.toLowerCase() || submissionTx.input === '0x') throw new Error('Provider ERC-8183 submission receipt is not a successful provider-signed AgenticCommerce call.')
    commerceSubmission = { transaction_hash: item.transaction_hash, deliverable_hash: item.deliverable_hash, deliverable_url: item.deliverable_url }
  }

  return {
    schema: 'mandate.provider-execution-receipt.v1',
    version: 1,
    accepted: true,
    chain_id: 97,
    job_id: request.job_id,
    category: request.category,
    action,
    mandate_digest: request.mandate_digest,
    request_nonce: request.request_nonce,
    provider_address: provider as `0x${string}`,
    transaction_hash: txHash,
    transaction_to: txTo as `0x${string}`,
    executed_at_utc: value.executed_at_utc,
    execution_scope: scope,
    receipt_digest: isHash(value.receipt_digest) ? value.receipt_digest : digest,
    signature,
    deliverable_hash: isHash(value.deliverable_hash) ? value.deliverable_hash : undefined,
    deliverable_url: isHttps(value.deliverable_url) ? value.deliverable_url : undefined,
    commerce_submission: commerceSubmission,
    protocol: value.protocol === 'a2a' ? 'a2a' : 'mandate',
    service_endpoint: endpoint,
  }
}

export function buildProviderExecutionRequest(input: {
  categoryId: CategoryId
  jobId: bigint | string
  mandate: string
  constraints: Record<string, unknown>
  agent: RegistryAgentDiscovery
  acceptance: ProviderAcceptanceReceipt
  action?: string
}) {
  const provider = input.agent.agentWallet ?? input.agent.ownerAddress
  if (!provider || !isAddress(provider)) throw new Error('The selected registry agent has no valid provider wallet.')
  if (provider.toLowerCase() !== input.acceptance.provider_address.toLowerCase()) throw new Error('The provider acceptance wallet does not match the registry wallet.')
  const action = input.action ?? actionForCategory(input.categoryId)
  const request: ProviderExecutionRequest = {
    schema: 'mandate.provider-execution-request.v1',
    version: 1,
    chain_id: 97,
    job_id: String(input.jobId),
    category: input.categoryId,
    mandate: input.mandate,
    mandate_digest: input.acceptance.mandate_digest,
    provider_address: provider,
    action,
    constraints: input.constraints,
    requested_at_utc: new Date().toISOString(),
    request_nonce: crypto.randomUUID(),
    submit_to_erc8183: true,
    acceptance_receipt: {
      schema: input.acceptance.schema,
      mandate_digest: input.acceptance.mandate_digest,
      provider_address: input.acceptance.provider_address,
      signature: input.acceptance.signature,
      expires_at_utc: input.acceptance.expires_at_utc,
      ...(input.acceptance.protocol ? { protocol: input.acceptance.protocol } : {}),
    },
  }
  return { request, providerAddress: provider as `0x${string}` }
}

export async function requestProviderExecution(
  agent: RegistryAgentDiscovery,
  request: ProviderExecutionRequest,
  reader: ExecutionChainReader,
  acceptance?: ProviderAcceptanceReceipt,
  signal?: AbortSignal,
) {
  if (acceptance && !(await verifyAssignedProviderAcceptance(acceptance, request.provider_address, request.mandate_digest))) {
    throw new Error('The assigned provider acceptance does not verify for this execution request.')
  }
  const endpoints = endpointCandidates(agent, acceptance)
  if (!endpoints.length) throw new Error('The provider did not publish a public HTTPS execution endpoint.')
  let lastError: unknown
  for (const endpoint of endpoints) {
    try {
      const directPayload = agent.a2aEndpoint === endpoint
        ? buildA2AEnvelope(request)
        : request
      const result = await postJson(endpoint, directPayload, signal)
      let payload = result.payload
      if (result.status >= 200 && result.status < 300) {
        const receipt = rawReceipt(payload)
        if (receipt) return await validateReceipt(receipt, request, reader, endpoint)
      }
      // A2A cards commonly reject a raw POST to the card URL. Retry the
      // canonical JSON-RPC message/send interface once, then move to the next
      // declared endpoint. This keeps an offline provider actionable without
      // weakening the assignment gate.
      if (agent.a2aEndpoint === endpoint && (result.status === 404 || result.status === 405 || result.status === 415 || !rawReceipt(payload))) {
        const rpcEndpoint = await a2aEndpoint(agent, signal)
        const rpcResult = await postJson(rpcEndpoint, buildA2AEnvelope(request), signal)
        payload = rpcResult.payload
        if (rpcResult.status >= 200 && rpcResult.status < 300) {
          const receipt = rawReceipt(payload)
          if (receipt) return await validateReceipt(receipt, request, reader, rpcEndpoint)
        }
        throw httpFailure('Provider A2A execution returned', rpcResult)
      }
      throw httpFailure('Provider execution endpoint returned', result)
    } catch (reason) {
      lastError = reason
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Provider execution request failed.')
}

/** Re-check a cached receipt before displaying it as verified evidence. */
export async function verifyProviderExecutionReceipt(
  receipt: ProviderExecutionReceipt,
  expected: { jobId: bigint | string; category: CategoryId; providerAddress: string; mandateDigest?: Hex },
  reader: ExecutionChainReader,
) {
  if (String(receipt.job_id) !== String(expected.jobId) || receipt.category !== expected.category || receipt.provider_address.toLowerCase() !== expected.providerAddress.toLowerCase() || (expected.mandateDigest && receipt.mandate_digest.toLowerCase() !== expected.mandateDigest.toLowerCase())) return null
  const request = {
    schema: 'mandate.provider-execution-request.v1' as const,
    version: 1 as const,
    chain_id: 97 as const,
    job_id: String(expected.jobId),
    category: expected.category,
    mandate: '',
    mandate_digest: receipt.mandate_digest,
    provider_address: expected.providerAddress,
    action: receipt.action,
    constraints: {},
    requested_at_utc: receipt.executed_at_utc,
    request_nonce: receipt.request_nonce,
    submit_to_erc8183: true,
    acceptance_receipt: {
      schema: 'mandate.provider-acceptance.v1' as const,
      mandate_digest: receipt.mandate_digest,
      provider_address: receipt.provider_address,
      signature: receipt.signature,
      expires_at_utc: receipt.executed_at_utc,
    },
  } satisfies ProviderExecutionRequest
  try {
    return await validateReceipt(receipt as unknown as Record<string, unknown>, request, reader, receipt.service_endpoint ?? '')
  } catch {
    return null
  }
}

function executionStorageKey(jobId: bigint | string, provider: string) {
  return `${STORAGE_PREFIX}${String(jobId)}:${provider.toLowerCase()}`
}

export function saveProviderExecution(receipt: ProviderExecutionReceipt) {
  localStorage.setItem(executionStorageKey(receipt.job_id, receipt.provider_address), JSON.stringify(receipt))
}

export function loadProviderExecution(jobId: bigint | string, provider: string): ProviderExecutionReceipt | null {
  try {
    const value = JSON.parse(localStorage.getItem(executionStorageKey(jobId, provider)) ?? 'null') as Partial<ProviderExecutionReceipt> | null
    if (!value || value.schema !== 'mandate.provider-execution-receipt.v1' || value.version !== 1 || value.accepted !== true || value.chain_id !== 97 || String(value.job_id) !== String(jobId) || !value.provider_address || !isAddress(value.provider_address) || !isHash(value.transaction_hash) || !isSignature(value.signature) || !isHash(value.mandate_digest) || typeof value.request_nonce !== 'string' || !value.request_nonce) return null
    return value as ProviderExecutionReceipt
  } catch {
    return null
  }
}
