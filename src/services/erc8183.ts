import type { CategoryId } from '../catalog'

export const ERC8183_COMMERCE_ADDRESS = '0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE' as const
export const ERC8183_ROUTER_ADDRESS = '0xD7d36D66d2F1B608A0F943f722D27e3744f66F25' as const
// Canonical current testnet policy from apex-contracts/scripts/addresses.ts.
// bnbagent 0.4.2 still carries the retired 0x4F46… address, so MANDATE
// explicitly pins the upstream deployment registry until the SDK catches up.
export const ERC8183_POLICY_ADDRESS = '0xd6a4217588f6b1f5657a92a3e94e6422ad771cea' as const
export const ERC8183_BUDGET = 100_000_000_000_000_000n
export const ERC8183_DISPUTE_WINDOW = 900n

export const commerceAbi = [
  {
    type: 'function', name: 'createJob', stateMutability: 'nonpayable',
    inputs: [
      { name: 'provider', type: 'address' }, { name: 'evaluator', type: 'address' },
      { name: 'expiredAt', type: 'uint256' }, { name: 'description', type: 'string' },
      { name: 'hook', type: 'address' },
    ], outputs: [{ name: 'jobId', type: 'uint256' }],
  },
  {
    type: 'function', name: 'setBudget', stateMutability: 'nonpayable',
    inputs: [{ name: 'jobId', type: 'uint256' }, { name: 'amount', type: 'uint256' }, { name: 'optParams', type: 'bytes' }], outputs: [],
  },
  {
    type: 'function', name: 'setProvider', stateMutability: 'nonpayable',
    inputs: [{ name: 'jobId', type: 'uint256' }, { name: 'provider', type: 'address' }, { name: 'optParams', type: 'bytes' }], outputs: [],
  },
  {
    type: 'function', name: 'fund', stateMutability: 'nonpayable',
    inputs: [{ name: 'jobId', type: 'uint256' }, { name: 'expectedBudget', type: 'uint256' }, { name: 'optParams', type: 'bytes' }], outputs: [],
  },
  {
    type: 'function', name: 'submit', stateMutability: 'nonpayable',
    inputs: [{ name: 'jobId', type: 'uint256' }, { name: 'deliverable', type: 'bytes32' }, { name: 'optParams', type: 'bytes' }], outputs: [],
  },
  {
    type: 'function', name: 'getJob', stateMutability: 'view', inputs: [{ name: 'jobId', type: 'uint256' }],
    outputs: [{ name: '', type: 'tuple', components: [
      { name: 'id', type: 'uint256' }, { name: 'client', type: 'address' }, { name: 'provider', type: 'address' },
      { name: 'evaluator', type: 'address' }, { name: 'description', type: 'string' }, { name: 'budget', type: 'uint256' },
      { name: 'expiredAt', type: 'uint256' }, { name: 'status', type: 'uint8' }, { name: 'hook', type: 'address' },
      { name: 'submittedAt', type: 'uint256' }, { name: 'deliverable', type: 'bytes32' },
    ] }],
  },
  {
    type: 'event', name: 'JobCreated', anonymous: false,
    inputs: [
      { indexed: true, name: 'jobId', type: 'uint256' }, { indexed: true, name: 'client', type: 'address' },
      { indexed: true, name: 'provider', type: 'address' }, { indexed: false, name: 'evaluator', type: 'address' },
      { indexed: false, name: 'expiredAt', type: 'uint256' }, { indexed: false, name: 'hook', type: 'address' },
    ],
  },
] as const

export const routerAbi = [
  {
    type: 'function', name: 'registerJob', stateMutability: 'nonpayable',
    inputs: [{ name: 'jobId', type: 'uint256' }, { name: 'policy', type: 'address' }], outputs: [],
  },
  {
    type: 'function', name: 'jobPolicy', stateMutability: 'view',
    inputs: [{ name: 'jobId', type: 'uint256' }], outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function', name: 'policyWhitelist', stateMutability: 'view',
    inputs: [{ name: 'policy', type: 'address' }], outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function', name: 'settle', stateMutability: 'nonpayable',
    inputs: [{ name: 'jobId', type: 'uint256' }, { name: 'evidence', type: 'bytes' }], outputs: [],
  },
] as const

export const exactApprovalAbi = [
  {
    type: 'function', name: 'approve', stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function', name: 'allowance', stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }],
  },
] as const

export type CommerceJob = {
  id: bigint
  client: `0x${string}`
  provider: `0x${string}`
  evaluator: `0x${string}`
  description: string
  budget: bigint
  expiredAt: bigint
  status: number
  hook: `0x${string}`
  submittedAt: bigint
  deliverable: `0x${string}`
}

export const jobStatusLabels = ['OPEN', 'FUNDED', 'SUBMITTED', 'COMPLETED', 'REJECTED', 'EXPIRED'] as const

export const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

export const buildDeliverableManifest = (jobId: bigint) => ({
  version: 1,
  job_id: Number(jobId),
  chain_id: 97,
  contracts: {
    commerce: ERC8183_COMMERCE_ADDRESS,
    router: ERC8183_ROUTER_ADDRESS,
    policy: ERC8183_POLICY_ADDRESS,
  },
  response: {
    content: 'MANDATE Health Factor pilot completed against a controlled test fixture. Decision: NO_ACTION. The bounded policy correctly refused execution because no live lending position was delegated.',
    content_type: 'text/plain',
  },
  metadata: {
    agent_id: '1807',
    category: 'health-factor-monitoring',
    evidence_mode: 'controlled-test-fixture',
    sdk: 'bnbagent-0.4.2',
  },
})

export const YIELD_REFERENCE_PATH = 'https://mandate-bnb-agent.vercel.app/evidence/yield-route-reference.json'
export const YIELD_REFERENCE_SHA256 = 'be4e4264f3b5d106ec9f8517c4ddf9292b8b107b92e871243d8702c9302d6d3c'

export const buildYieldDeliverableManifest = (jobId: bigint) => ({
  version: 1,
  job_id: Number(jobId),
  chain_id: 97,
  contracts: {
    commerce: ERC8183_COMMERCE_ADDRESS,
    router: ERC8183_ROUTER_ADDRESS,
    policy: ERC8183_POLICY_ADDRESS,
  },
  response: {
    content: 'YieldRoute completed a live read-only BSC stablecoin analysis. The selected reference route was Lista Lending USDT at 5.01909% observed APY for a 5,000 USDT high-risk mandate. No transaction was attempted.',
    content_type: 'application/json',
  },
  evidence: {
    uri: YIELD_REFERENCE_PATH,
    sha256: YIELD_REFERENCE_SHA256,
  },
  metadata: {
    agent_id: '1806',
    category: 'yield-optimisation',
    evidence_mode: 'live-read-only-reference-snapshot',
    data_provider: 'DefiLlama',
    sdk: 'bnbagent-0.4.2',
  },
})

const marketplaceDeliverables: Record<Exclude<CategoryId, 'yield'>, { agentId: string; content: string; evidenceMode: string }> = {
  rebalancing: {
    agentId: '1804',
    content: 'RangeGuard completed a bounded LP rebalancing plan against the disclosed marketplace category fixture. Decision: NO_ACTION. No LP position was delegated and no asset transaction was attempted.',
    evidenceMode: 'controlled-category-proof',
  },
  grid: {
    agentId: '1805',
    content: 'GridPilot completed the frozen BNB/USDT grid safety review. Decision: balanced-26. The higher-return turbo plan was rejected for exceeding drawdown and activity caps. No asset transaction was attempted.',
    evidenceMode: 'verified-termix-fixture',
  },
  health: {
    agentId: '1807',
    content: 'LiqShield completed the frozen Venus health-factor intervention. Decision: repay-1600. Borrowing and no-action were rejected by the bounded policy. No asset transaction was attempted.',
    evidenceMode: 'verified-termix-fixture',
  },
}

export const buildMarketplaceDeliverableManifest = (jobId: bigint, category: CategoryId) => {
  if (category === 'yield') return buildYieldDeliverableManifest(jobId)
  const deliverable = marketplaceDeliverables[category]
  return {
    version: 1,
    job_id: Number(jobId),
    chain_id: 97,
    contracts: { commerce: ERC8183_COMMERCE_ADDRESS, router: ERC8183_ROUTER_ADDRESS, policy: ERC8183_POLICY_ADDRESS },
    response: { content: deliverable.content, content_type: 'application/json' },
    metadata: { agent_id: deliverable.agentId, category, evidence_mode: deliverable.evidenceMode, sdk: 'bnbagent-0.4.2' },
  }
}
