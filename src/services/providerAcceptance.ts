import { isAddress, keccak256, stringToHex, verifyMessage, type Hex } from 'viem'
import type { CategoryId } from '../catalog'
import type { MandateDraft } from './mandateDraft'
import { isPublicHttpsEndpoint, type RegistryAgentDiscovery } from './agentRegistry'
import { ERC8183_BUDGET, ERC8183_COMMERCE_ADDRESS } from './erc8183'
import { U_TOKEN_ADDRESS } from './uFaucet'

/**
 * Portable buyer request used by providers that implement MANDATE's small
 * acceptance adapter. The provider must sign the exact digest before the
 * client can assign it in ERC-8183.
 */
export type ProviderAcceptanceRequest = {
  schema: 'mandate.provider-acceptance-request.v1'
  chain_id: 97
  candidate: {
    token_id: string
    agent_id: string
    provider_wallet: string
  }
  category: CategoryId
  mandate: string
  mandate_digest: Hex
  requested_at_utc: string
  evidence_requirements: string[]
  service_budget: { amount: string; token: string }
}

export type ProviderAcceptanceReceipt = {
  schema: 'mandate.provider-acceptance.v1'
  accepted: true
  chain_id: 97
  token_id: string
  provider_address: `0x${string}`
  /** MANDATE digest for the exact buyer mandate. */
  mandate_digest: Hex
  /** MANDATE signature, or the official SDK provider_sig for an A2A quote. */
  signature: Hex
  accepted_at_utc: string
  /** Compact-provider receipts are replayable only until this explicit expiry. */
  expires_at_utc: string
  deliverable_url?: string
  execution_endpoint?: string
  /** `mandate` is the small adapter; `a2a` is the BNBAgent SDK path. */
  protocol?: 'mandate' | 'a2a'
  service_endpoint?: string
  /** Raw provider-signed BNBAgent negotiation envelope for on-chain anchoring. */
  negotiation?: Record<string, unknown>
}

const ACCEPTANCE_STORAGE_PREFIX = 'mandate:provider-acceptance:v1:'
const API_ROOT = `${(import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '')}`
const MAX_ACCEPTANCE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const ACCEPTANCE_CLOCK_SKEW_MS = 5 * 60 * 1000

function canonicalMandatePayload(input: {
  categoryId: CategoryId
  mandate: string
  tokenId: string
  providerAddress: string
}) {
  return JSON.stringify({
    chain_id: 97,
    category: input.categoryId,
    mandate: input.mandate,
    provider_address: input.providerAddress.toLowerCase(),
    token_id: input.tokenId,
    version: 1,
  })
}

export function mandateDigest(input: {
  categoryId: CategoryId
  mandate: string
  tokenId: string
  providerAddress: string
}): Hex {
  return keccak256(stringToHex(canonicalMandatePayload(input)))
}

export function buildProviderAcceptanceRequest(input: {
  categoryId: CategoryId
  mandate: MandateDraft | null
  categoryPrompt: string
  agent: RegistryAgentDiscovery
  serviceBudgetToken: string
}) {
  const provider = input.agent.agentWallet ?? input.agent.ownerAddress
  if (!provider || !isAddress(provider)) throw new Error('This registry identity has no valid provider wallet.')
  const mandateText = input.mandate?.prompt ?? input.categoryPrompt
  const digest = mandateDigest({
    categoryId: input.categoryId,
    mandate: mandateText,
    tokenId: input.agent.tokenId,
    providerAddress: provider,
  })
  const request: ProviderAcceptanceRequest = {
    schema: 'mandate.provider-acceptance-request.v1',
    chain_id: 97,
    candidate: {
      token_id: input.agent.tokenId,
      agent_id: input.agent.agentId,
      provider_wallet: provider,
    },
    category: input.categoryId,
    mandate: mandateText,
    mandate_digest: digest,
    requested_at_utc: new Date().toISOString(),
    evidence_requirements: ['provider wallet signature', 'public deliverable URL', 'bytes32 deliverable hash', 'bounded execution receipts when applicable'],
    service_budget: { amount: '0.1', token: input.serviceBudgetToken },
  }
  return { request, digest, providerAddress: provider as `0x${string}` }
}

function endpointFor(agent: RegistryAgentDiscovery) {
  const endpoint = [agent.a2aEndpoint, agent.mcpEndpoint].find((candidate) => isPublicHttpsEndpoint(candidate))
  if (!endpoint) throw new Error('The provider did not publish a public HTTPS A2A or MCP endpoint.')
  return endpoint
}

function isHexSignature(value: unknown): value is Hex {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{130}$/.test(value)
}

function isHexHash(value: unknown): value is Hex {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value)
}

/**
 * Recover the signer from a provider receipt.  BNBAgent's EVM wallet signs
 * the digest as EIP-191 text, while a few EVM providers sign the raw 32-byte
 * digest.  Both are safe here because the recovered address is compared with
 * the ERC-8004 wallet before the receipt is accepted.
 */
export async function verifyProviderSignature(address: `0x${string}`, digest: Hex, signature: Hex) {
  // BNBAgent's EVMWalletProvider signs the 66-character digest as an
  // EIP-191 *text* message. Some browser wallets/providers instead sign the
  // 32 raw digest bytes. Accept either representation, but never skip
  // recovery against the registry wallet.
  if (await verifyMessage({ address, message: digest, signature })) return true
  return verifyMessage({ address, message: { raw: digest }, signature })
}

/** Python's SDK uses json.dumps(sort_keys=True, separators=(',', ':')). */
function sdkCanonicalJson(value: unknown): string {
  const compact = stableJson(value)
  // Python json.dumps defaults to ensure_ascii=True. Escaping here keeps the
  // request_hash compatible even when a buyer writes a non-ASCII mandate.
  let escaped = ''
  for (let index = 0; index < compact.length; index += 1) {
    const character = compact[index]
    const code = character.charCodeAt(0)
    escaped += code <= 0x7f ? character : `\\u${code.toString(16).padStart(4, '0')}`
  }
  return escaped
}

/**
 * Re-derive the hash that BNBAgent's NegotiationHandler signs.  A provider
 * signature over an opaque `negotiation_hash` is not enough: without this
 * check a malicious transport could pair a valid signature with different
 * request/response terms.  Keep this mirror next to the SDK canonicalizer so
 * the signed bytes and the bytes we inspect cannot drift apart.
 */
function expectedA2ANegotiationHash(quote: Record<string, unknown>): Hex | null {
  const request = quote.request && typeof quote.request === 'object' ? quote.request as Record<string, unknown> : null
  const response = quote.response && typeof quote.response === 'object' ? quote.response as Record<string, unknown> : null
  const requestTerms = request?.terms && typeof request.terms === 'object' ? request.terms as Record<string, unknown> : null
  const responseTerms = response?.terms && typeof response.terms === 'object' ? response.terms as Record<string, unknown> : null
  if (!request || !response || !requestTerms || !responseTerms || typeof request.task_description !== 'string' || response.accepted !== true) return null
  if (typeof responseTerms.deliverables !== 'string' || typeof responseTerms.quality_standards !== 'string' || typeof responseTerms.price !== 'string' || typeof responseTerms.currency !== 'string') return null
  const negotiatedAt = quote.negotiated_at ?? response.negotiated_at
  const quoteExpiry = quote.quote_expires_at ?? response.quote_expires_at
  if (!Number.isSafeInteger(negotiatedAt) || !Number.isSafeInteger(quoteExpiry)) return null
  const terms: Record<string, unknown> = {
    deliverables: sanitizeClaim(responseTerms.deliverables),
    quality_standards: sanitizeClaim(responseTerms.quality_standards),
  }
  if (Array.isArray(responseTerms.success_criteria) && responseTerms.success_criteria.length > 0) {
    if (!responseTerms.success_criteria.every((item) => typeof item === 'string')) return null
    terms.success_criteria = responseTerms.success_criteria.map((item) => sanitizeClaim(item))
  }
  const chain = quote.chain_id
  const contract = quote.verifying_contract
  if (chain !== 97 || typeof contract !== 'string' || !isAddress(contract)) return null
  // Web3's SDK uses a checksummed contract in the signable content. viem's
  // getAddress is intentionally avoided here because the provider may return
  // a valid all-lowercase address; the canonical contract constant is already
  // checksummed and is the only accepted value for this flow.
  if (contract.toLowerCase() !== ERC8183_COMMERCE_ADDRESS.toLowerCase()) return null
  const content = {
    version: 1,
    negotiated_at: negotiatedAt,
    task: sanitizeClaim(request.task_description),
    terms,
    price: responseTerms.price,
    currency: responseTerms.currency,
    quote_expires_at: quoteExpiry,
    chain_id: chain,
    verifying_contract: ERC8183_COMMERCE_ADDRESS,
  }
  return keccak256(stringToHex(sdkCanonicalJson(content)))
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

type ProviderHttpResult = { status: number; payload: unknown }

async function readJson(response: Response): Promise<unknown> {
  try { return await response.json() } catch { return null }
}

function responseDetail(payload: unknown) {
  if (!payload || typeof payload !== 'object') return ''
  const value = payload as Record<string, unknown>
  const nested = value.error && typeof value.error === 'object' ? value.error as Record<string, unknown> : null
  const detail = [value.detail, value.message, nested?.message, typeof value.error === 'string' ? value.error : null].find((item): item is string => typeof item === 'string' && item.trim().length > 0)
  if (!detail) return ''
  return detail.replace(/[\r\n]+/g, ' ').trim().slice(0, 240)
}

function httpFailure(label: string, result: ProviderHttpResult) {
  const detail = responseDetail(result.payload)
  return new Error(`${label} HTTP ${result.status}${detail ? `: ${detail}` : '.'}`)
}

async function postProviderJson(endpoint: string, payload: unknown, signal?: AbortSignal): Promise<ProviderHttpResult> {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    })
    return { status: response.status, payload: await readJson(response) }
  } catch (reason) {
    // A provider may implement the protocol correctly but omit browser CORS.
    // The same-origin proxy only forwards this buyer-initiated request and
    // never signs, assigns or funds anything.
    if (!(reason instanceof TypeError)) throw reason
    const proxyResponse = await fetch(`${API_ROOT}/registry/provider-acceptance`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint, payload }),
      signal,
    })
    return { status: proxyResponse.status, payload: await readJson(proxyResponse) }
  }
}

async function getProviderJson(endpoint: string, signal?: AbortSignal): Promise<ProviderHttpResult> {
  try {
    const response = await fetch(endpoint, { method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store', signal })
    return { status: response.status, payload: await readJson(response) }
  } catch (reason) {
    if (!(reason instanceof TypeError)) throw reason
    const proxyResponse = await fetch(`${API_ROOT}/registry/provider-card`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
      signal,
    })
    return { status: proxyResponse.status, payload: await readJson(proxyResponse) }
  }
}

async function resolveCompactAcceptanceEndpoint(agent: RegistryAgentDiscovery, signal?: AbortSignal) {
  const declaredEndpoint = endpointFor(agent)
  const capability = await getProviderJson(declaredEndpoint, signal).catch(() => null)
  if (capability?.status !== 200 || !capability.payload || typeof capability.payload !== 'object') return declaredEndpoint
  const document = capability.payload as Record<string, unknown>
  if (document.schema !== 'mandate.provider-service.v1' || typeof document.acceptance_endpoint !== 'string') return declaredEndpoint
  try {
    const advertised = new URL(document.acceptance_endpoint, declaredEndpoint)
    const declared = new URL(declaredEndpoint)
    // The registry owner selected the declared host. Do not allow its document
    // to turn the buyer's signed mandate into a request to an unrelated host.
    if (advertised.hostname !== declared.hostname || !isPublicHttpsEndpoint(advertised.toString())) return declaredEndpoint
    return advertised.toString()
  } catch {
    return declaredEndpoint
  }
}

function isJsonRpcEnvelope(payload: unknown): payload is Record<string, unknown> {
  return Boolean(payload && typeof payload === 'object' && (payload as Record<string, unknown>).jsonrpc === '2.0')
}

function jsonRpcData(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== 'object') return null
  const root = payload as Record<string, unknown>
  const result = root.result && typeof root.result === 'object' ? root.result as Record<string, unknown> : null
  if (!result || result.error) return null
  const messages: unknown[] = [result, result.message]
  if (Array.isArray(result.artifacts)) messages.push(...result.artifacts)
  for (const message of messages) {
    if (!message || typeof message !== 'object') continue
    const parts = Array.isArray((message as Record<string, unknown>).parts) ? (message as Record<string, unknown>).parts as unknown[] : []
    for (const part of parts) {
      if (!part || typeof part !== 'object') continue
      const record = part as Record<string, unknown>
      if (record.kind !== 'data' && record.type !== 'data') continue
      if (record.data && typeof record.data === 'object') return record.data as Record<string, unknown>
      if (typeof record.data === 'string') {
        try {
          const parsed = JSON.parse(record.data) as unknown
          if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>
        } catch { /* provider returned a non-JSON data part */ }
      }
    }
  }
  return null
}

function resolveA2AMessageUrl(card: Record<string, unknown>, baseEndpoint: string) {
  const candidates: unknown[] = [card.url]
  if (Array.isArray(card.supportedInterfaces)) {
    for (const item of card.supportedInterfaces) {
      if (item && typeof item === 'object') candidates.push((item as Record<string, unknown>).url)
    }
  }
  if (Array.isArray(card.endpoints)) {
    for (const item of card.endpoints) {
      if (item && typeof item === 'object') candidates.push((item as Record<string, unknown>).url)
      else candidates.push(item)
    }
  }
  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || !candidate.trim()) continue
    try {
      const url = new URL(candidate, baseEndpoint)
      if (isPublicHttpsEndpoint(url.toString())) return url.toString()
    } catch { /* ignore malformed advertised interfaces and try the next */ }
  }
  return null
}

async function a2aMessageEndpoint(agent: RegistryAgentDiscovery, signal?: AbortSignal) {
  const endpoint = agent.a2aEndpoint
  if (!endpoint || !isPublicHttpsEndpoint(endpoint)) throw new Error('The provider did not publish a public HTTPS A2A endpoint.')
  // ERC-8004 commonly stores the A2A agent-card URL. Resolve its advertised
  // JSON-RPC message URL before falling back to POSTing to the declared URL.
  // Also honor the skill identifier published by the card: external agents
  // are not required to use MANDATE's example skill name.
  const card = await getProviderJson(endpoint, signal).catch(() => null)
  if (card?.status === 200 && card.payload && typeof card.payload === 'object') {
    const payload = card.payload as Record<string, unknown>
    const advertised = resolveA2AMessageUrl(payload, endpoint)
    const skills = Array.isArray(payload.skills) ? payload.skills : []
    const skillIds = skills
      .map((skill) => skill && typeof skill === 'object' ? (skill as Record<string, unknown>).id : null)
      .filter((skill): skill is string => typeof skill === 'string' && skill.trim().length > 0)
    const negotiationSkill = skillIds.find((skill) => skill === 'negotiate') ?? skillIds.find((skill) => skill === 'negotiate-erc8183-job') ?? 'negotiate-erc8183-job'
    return { endpoint: advertised ?? endpoint, negotiationSkill }
  }
  return { endpoint, negotiationSkill: 'negotiate-erc8183-job' }
}

function a2aNegotiationRequest(request: ProviderAcceptanceRequest) {
  const terms = {
    // Keep these two required SDK terms concise enough for independent A2A
    // implementations with conservative request-size limits. The immutable
    // mandate still carries the full user constraints; the receipt checks
    // that providers echo both strings without weakening them.
    deliverables: 'HTTPS deliverable URL, bytes32 hash, and BSC Testnet execution receipts.',
    quality_standards: `${request.mandate} BSC Testnet only; no unbounded approvals or transfers.`,
    // TermSpecification.to_dict() in the official SDK emits these defaults;
    // including them makes our request_hash byte-for-byte compatible with
    // NegotiationHandler rather than merely similar to it.
    evaluation_required: true,
    evaluator_type: 'uma_oov3',
  }
  const negotiation = { task_description: request.mandate, terms }
  return {
    negotiation,
    request_hash: keccak256(stringToHex(sdkCanonicalJson(negotiation))),
  }
}

async function requestA2AQuote(agent: RegistryAgentDiscovery, request: ProviderAcceptanceRequest, signal?: AbortSignal): Promise<ProviderAcceptanceReceipt> {
  const a2a = await a2aMessageEndpoint(agent, signal)
  const endpoint = a2a.endpoint
  const { negotiation, request_hash } = a2aNegotiationRequest(request)
  const rpc = {
    jsonrpc: '2.0',
    id: crypto.randomUUID(),
    method: 'message/send',
    params: {
      message: {
        kind: 'message',
        role: 'user',
        messageId: crypto.randomUUID(),
        parts: [{ kind: 'data', data: { skill: a2a.negotiationSkill, ...negotiation } }],
      },
    },
  }
  const result = await postProviderJson(endpoint, rpc, signal)
  if (result.status < 200 || result.status >= 300) throw httpFailure('Provider A2A negotiation returned', result)
  const quote = jsonRpcData(result.payload)
  if (!quote) {
    const rpcError = isJsonRpcEnvelope(result.payload) && result.payload.error && typeof result.payload.error === 'object'
      ? (result.payload.error as Record<string, unknown>).message
      : null
    throw new Error(typeof rpcError === 'string' ? `Provider A2A rejected the request: ${rpcError}` : 'Provider A2A response did not contain a negotiation data part.')
  }
  const response = quote.response && typeof quote.response === 'object' ? quote.response as Record<string, unknown> : null
  const responseTerms = response?.terms && typeof response.terms === 'object' ? response.terms as Record<string, unknown> : null
  const expectedProvider = request.candidate.provider_wallet.toLowerCase()
  // Some A2A sellers omit provider_address even though their Agent Card and
  // signed quote identify the wallet indirectly. Bind that quote to the
  // ERC-8004 wallet supplied by the buyer, then recover the signer against it.
  const provider = quote.provider_address ?? expectedProvider
  const quoteRequest = quote.request && typeof quote.request === 'object' ? quote.request as Record<string, unknown> : null
  const quoteTask = quoteRequest?.task_description
  const quoteRequestHash = quote.request_hash
  const negotiationHash = quote.negotiation_hash
  const providerSig = quote.provider_sig
  const quoteChain = quote.chain_id
  const quoteContract = quote.verifying_contract
  const quoteExpiry = quote.quote_expires_at ?? response?.quote_expires_at
  const price = responseTerms?.price
  const currency = responseTerms?.currency
  const expectedTerms = negotiation.terms as Record<string, unknown>
  const quotedRequestTerms = quoteRequest?.terms && typeof quoteRequest.terms === 'object' ? quoteRequest.terms as Record<string, unknown> : null
  const quotedResponseTerms = responseTerms
  if (response?.accepted !== true) throw new Error('Provider A2A negotiation rejected this mandate.')
  if (typeof provider !== 'string' || !isAddress(provider) || provider.toLowerCase() !== expectedProvider) throw new Error('Provider A2A quote wallet does not match the ERC-8004 provider wallet.')
  if (!isHexHash(negotiationHash) || !isHexSignature(providerSig)) throw new Error('Provider A2A quote is missing a verifiable negotiation hash or signature.')
  if (quoteChain !== 97 || typeof quoteContract !== 'string' || quoteContract.toLowerCase() !== ERC8183_COMMERCE_ADDRESS.toLowerCase()) throw new Error('Provider A2A quote is not bound to BSC Testnet AgenticCommerce.')
  if (quoteTask !== request.mandate || !isHexHash(quoteRequestHash) || quoteRequestHash.toLowerCase() !== request_hash.toLowerCase()) throw new Error('Provider A2A quote is not bound to the exact mandate text.')
  if (!quotedRequestTerms || quotedRequestTerms.deliverables !== expectedTerms.deliverables || quotedRequestTerms.quality_standards !== expectedTerms.quality_standards || stableJson(quotedRequestTerms.success_criteria) !== stableJson(expectedTerms.success_criteria)) throw new Error('Provider A2A quote changed the requested deliverables or quality limits.')
  if (!quotedResponseTerms || quotedResponseTerms.deliverables !== expectedTerms.deliverables || quotedResponseTerms.quality_standards !== expectedTerms.quality_standards || stableJson(quotedResponseTerms.success_criteria) !== stableJson(expectedTerms.success_criteria)) throw new Error('Provider A2A quote response weakened the requested deliverables or quality limits.')
  const normalizedExpiry = typeof quoteExpiry === 'number' ? quoteExpiry : typeof quoteExpiry === 'string' && /^\d+$/.test(quoteExpiry) ? Number(quoteExpiry) : NaN
  if (!Number.isSafeInteger(normalizedExpiry) || normalizedExpiry <= Math.floor(Date.now() / 1000)) throw new Error('Provider A2A quote has expired or omitted its expiry.')
  if (typeof price !== 'string' || !/^\d+$/.test(price) || BigInt(price) > ERC8183_BUDGET) throw new Error('Provider A2A quote exceeds the fixed 0.1 U testnet service budget.')
  if (typeof currency !== 'string' || currency.toLowerCase() !== U_TOKEN_ADDRESS.toLowerCase()) throw new Error('Provider A2A quote uses a different payment token than BSC Testnet U.')
  const derivedNegotiationHash = expectedA2ANegotiationHash(quote)
  if (!derivedNegotiationHash || derivedNegotiationHash.toLowerCase() !== negotiationHash.toLowerCase()) throw new Error('Provider A2A negotiation hash does not match the quoted request and response terms.')
  const verified = await verifyProviderSignature(provider as `0x${string}`, negotiationHash, providerSig)
  if (!verified) throw new Error('Provider A2A quote signature could not be verified against the published wallet.')
  const normalizedQuote = { ...quote, provider_address: provider }
  return {
    schema: 'mandate.provider-acceptance.v1',
    accepted: true,
    chain_id: 97,
    token_id: request.candidate.token_id,
    provider_address: provider as `0x${string}`,
    mandate_digest: request.mandate_digest,
    signature: providerSig,
    accepted_at_utc: new Date().toISOString(),
    expires_at_utc: new Date(normalizedExpiry * 1000).toISOString(),
    protocol: 'a2a',
    service_endpoint: endpoint,
    negotiation: normalizedQuote,
  }
}

function storageKey(tokenId: string, digest: Hex) {
  return `${ACCEPTANCE_STORAGE_PREFIX}${tokenId}:${digest.toLowerCase()}`
}

export function saveProviderAcceptance(receipt: ProviderAcceptanceReceipt) {
  localStorage.setItem(storageKey(receipt.token_id, receipt.mandate_digest), JSON.stringify(receipt))
}

export function loadProviderAcceptance(tokenId: string, digest: Hex): ProviderAcceptanceReceipt | null {
  try {
    const raw = localStorage.getItem(storageKey(tokenId, digest))
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<ProviderAcceptanceReceipt>
    if (
      value.schema !== 'mandate.provider-acceptance.v1' ||
      value.accepted !== true ||
      value.chain_id !== 97 ||
      value.token_id !== tokenId ||
      value.mandate_digest?.toLowerCase() !== digest.toLowerCase() ||
      !value.provider_address ||
      !isAddress(value.provider_address) ||
      !isHexSignature(value.signature) ||
      !value.accepted_at_utc ||
      !value.expires_at_utc ||
      (value.protocol !== undefined && value.protocol !== 'mandate' && value.protocol !== 'a2a')
    ) return null
    return value as ProviderAcceptanceReceipt
  } catch {
    return null
  }
}

export async function verifyProviderAcceptance(receipt: ProviderAcceptanceReceipt, expectedProvider?: string, expectedMandateDigest?: Hex) {
  if (expectedProvider && receipt.provider_address.toLowerCase() !== expectedProvider.toLowerCase()) return false
  if (expectedMandateDigest && receipt.mandate_digest.toLowerCase() !== expectedMandateDigest.toLowerCase()) return false
  const acceptedAt = Date.parse(receipt.accepted_at_utc)
  const expiresAt = Date.parse(receipt.expires_at_utc)
  if (!Number.isFinite(acceptedAt) || !Number.isFinite(expiresAt) || acceptedAt > Date.now() + ACCEPTANCE_CLOCK_SKEW_MS || expiresAt <= Date.now() || expiresAt <= acceptedAt || expiresAt - acceptedAt > MAX_ACCEPTANCE_TTL_MS) return false
  if (receipt.protocol === 'a2a') {
    const negotiation = receipt.negotiation
    if (!negotiation) return false
    const negotiationHash = negotiation?.negotiation_hash
    const quoteProvider = negotiation?.provider_address
    const chain = negotiation?.chain_id
    const contract = negotiation?.verifying_contract
    const expiryValue = negotiation?.quote_expires_at ?? (negotiation?.response && typeof negotiation.response === 'object' ? (negotiation.response as Record<string, unknown>).quote_expires_at : undefined)
    const expiry = typeof expiryValue === 'number' ? expiryValue : typeof expiryValue === 'string' && /^\d+$/.test(expiryValue) ? Number(expiryValue) : NaN
    if (!isHexHash(negotiationHash) || !isHexSignature(receipt.signature) || typeof quoteProvider !== 'string' || quoteProvider.toLowerCase() !== receipt.provider_address.toLowerCase() || chain !== 97 || typeof contract !== 'string' || contract.toLowerCase() !== ERC8183_COMMERCE_ADDRESS.toLowerCase() || !Number.isSafeInteger(expiry) || expiry <= Math.floor(Date.now() / 1000) || Math.floor(expiresAt / 1000) !== expiry) return false
    const derivedNegotiationHash = expectedA2ANegotiationHash(negotiation)
    if (!derivedNegotiationHash || derivedNegotiationHash.toLowerCase() !== negotiationHash.toLowerCase()) return false
    return verifyProviderSignature(receipt.provider_address, negotiationHash, receipt.signature)
  }
  return verifyProviderSignature(receipt.provider_address, receipt.mandate_digest, receipt.signature)
}

export async function requestProviderAcceptance(
  agent: RegistryAgentDiscovery,
  request: ProviderAcceptanceRequest,
  signal?: AbortSignal,
): Promise<ProviderAcceptanceReceipt> {
  // A MANDATE provider registers its public capability document in ERC-8004;
  // the document, in turn, advertises the POST-only acceptance endpoint. Do
  // not POST the mandate to the GET-only capability URL.
  const endpoint = await resolveCompactAcceptanceEndpoint(agent, signal)
  const result = await postProviderJson(endpoint, request, signal)
  const payload = result.payload as Partial<ProviderAcceptanceReceipt> | null
  const expectedProvider = request.candidate.provider_wallet.toLowerCase()
  if (
    result.status >= 200 && result.status < 300 && payload &&
    payload.schema === 'mandate.provider-acceptance.v1' &&
    payload.accepted === true &&
    payload.chain_id === 97 &&
    String(payload.token_id) === request.candidate.token_id &&
    payload.mandate_digest?.toLowerCase() === request.mandate_digest.toLowerCase() &&
    payload.provider_address &&
    isAddress(payload.provider_address) &&
    payload.provider_address.toLowerCase() === expectedProvider &&
    isHexSignature(payload.signature) &&
    payload.accepted_at_utc &&
    typeof payload.expires_at_utc === 'string'
  ) {
    const verified = await verifyProviderAcceptance(payload as ProviderAcceptanceReceipt, expectedProvider)
    if (!verified) throw new Error('Provider acceptance signature could not be verified against the published wallet.')
    const receipt = payload as ProviderAcceptanceReceipt
    saveProviderAcceptance(receipt)
    return receipt
  }

  // The official BNBAgent SDK recommends A2A JSON-RPC `message/send`; its
  // standard result is a signed negotiation quote rather than MANDATE's small
  // acceptance document. Adapt that envelope so a real external provider can
  // continue into the same ERC-8183 flow. Only fall back for an unimplemented
  // custom endpoint or a JSON-RPC response; malformed 2xx responses fail shut.
  // The same-origin proxy maps a provider's card-level 404/405/415 to 502 so
  // it can keep the browser response uniform. Inspect that bounded detail as
  // well; otherwise a perfectly valid A2A card URL would never reach the
  // JSON-RPC fallback when the provider omits CORS.
  const proxyShowsA2AUnsupported = result.status === 502 && /HTTP Error (404|405|415)|returned (404|405|415)/i.test(responseDetail(result.payload))
  if (agent.a2aEndpoint && (result.status === 404 || result.status === 405 || result.status === 415 || proxyShowsA2AUnsupported || isJsonRpcEnvelope(result.payload))) {
    const receipt = await requestA2AQuote(agent, request, signal)
    saveProviderAcceptance(receipt)
    return receipt
  }

  if (result.status < 200 || result.status >= 300) throw httpFailure('Provider acceptance endpoint returned', result)
  throw new Error('Provider response did not include a valid acceptance receipt for this exact mandate.')
}

export function acceptanceEndpoint(agent: RegistryAgentDiscovery) {
  return endpointFor(agent)
}

export function acceptanceNegotiation(receipt: ProviderAcceptanceReceipt) {
  return receipt.protocol === 'a2a' && receipt.negotiation ? receipt.negotiation : null
}

function sanitizeClaim(value: unknown) {
  if (typeof value !== 'string') return String(value ?? '')
  return value
    .replaceAll('[', '(')
    .replaceAll(']', ')')
    .split('')
    .filter((character) => character.charCodeAt(0) >= 0x20 || character === '\t' || character === '\n')
    .join('')
}

/**
 * Rebuild the exact top-level description shape expected by BNBAgent's
 * `verify_job` from a signed A2A negotiation envelope. Context fields are
 * intentionally extra metadata; the SDK hash covers only the canonical quote
 * fields and therefore remains verifiable after `setProvider`.
 */
export function buildProviderJobDescription(
  receipt: ProviderAcceptanceReceipt,
  context: { category: CategoryId; mandate: string; constraints: unknown },
) {
  const quote = acceptanceNegotiation(receipt)
  if (!quote) return null
  const request = quote.request && typeof quote.request === 'object' ? quote.request as Record<string, unknown> : null
  const response = quote.response && typeof quote.response === 'object' ? quote.response as Record<string, unknown> : null
  const terms = response?.terms && typeof response.terms === 'object' ? response.terms as Record<string, unknown> : null
  if (!request || !response || !terms || typeof terms.price !== 'string' || typeof terms.currency !== 'string') return null
  const success = Array.isArray(terms.success_criteria) ? terms.success_criteria.filter((item): item is string => typeof item === 'string').map(sanitizeClaim) : undefined
  const canonical: Record<string, unknown> = {
    version: 1,
    negotiated_at: typeof response.negotiated_at === 'number' ? response.negotiated_at : Math.floor(Date.now() / 1000),
    task: sanitizeClaim(request.task_description),
    terms: {
      deliverables: sanitizeClaim(terms.deliverables),
      quality_standards: sanitizeClaim(terms.quality_standards),
      ...(success?.length ? { success_criteria: success } : {}),
    },
    price: terms.price,
    currency: terms.currency,
    ...(typeof quote.quote_expires_at === 'number' ? { quote_expires_at: quote.quote_expires_at } : typeof response.quote_expires_at === 'number' ? { quote_expires_at: response.quote_expires_at } : {}),
    chain_id: quote.chain_id,
    verifying_contract: quote.verifying_contract,
    negotiation_hash: quote.negotiation_hash,
    provider_sig: quote.provider_sig,
  }
  return {
    ...canonical,
    type: 'open-mandate-with-provider-quote',
    provider: 'unassigned-until-client-assignment',
    category: context.category,
    mandate: context.mandate,
    constraints: context.constraints,
    provider_negotiation: {
      protocol: 'A2A',
      token_id: receipt.token_id,
      provider_address: receipt.provider_address,
      service_endpoint: receipt.service_endpoint,
    },
  }
}
