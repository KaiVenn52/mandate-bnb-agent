export type CategoryId = 'rebalancing' | 'grid' | 'yield' | 'health'

export type AgentEvidenceStatus = 'verified-onchain' | 'unverified-sample'
export type AgentExecutionMode = 'live-read-only' | 'testnet-service-escrow' | 'not-hireable'

export type AgentTrackRecord = {
  schema: 'mandate.agent-track-record.v1'
  mode: 'realized-onchain'
  window: { start_utc: string; end_utc: string }
  summary: {
    executed_trades: number
    winning_trades: number
    losing_trades: number
    win_rate_pct: number
    max_drawdown_pct: number
  }
  risk_exposure: {
    position_side: string
    leverage: number
    max_loss_pct: number
    notes: string
  }
  onchain_evidence: {
    chain_id: 97
    transactions: Array<{ hash: `0x${string}`; executed_at_utc: string }>
    verification_url?: string
  }
}

export type CatalogAgent = {
  id: string
  name: string
  recommendation: 'Best fit' | 'Safer' | 'Cheaper'
  fit: number
  status: 'satisfies' | 'violates'
  violation?: string
  metrics: Record<string, string>
  completedMandates: number
  disputed: number
  capitalObserved: number
  medianExecutionSeconds: number
  lastActive: string
  providerAddress?: `0x${string}`
  registrationTxHash?: `0x${string}`
  /** Provenance is intentionally explicit so ranking never treats fixtures as history. */
  evidenceStatus?: AgentEvidenceStatus
  /** The current built-in service reads data; it does not sign DeFi asset transactions. */
  executionMode?: AgentExecutionMode
  /** Provider-controlled endpoint advertised in ERC-8004 metadata. */
  serviceEndpoint?: string
  serviceProtocol?: 'A2A' | 'MCP'
  /** Set only after a provider-owned testnet transaction is independently checked. */
  assetExecutionVerified?: boolean
  executionReceiptHashes?: string[]
  trackRecord?: AgentTrackRecord
  executionScope?: {
    category: CategoryId
    chain_id: 97
    allowed_actions: string[]
    contract_allowlist: string[]
    max_value_wei: string
  }
  providerSource?: string
  shadow: {
    primary: string
    baseline: string
    advantage: string
    cost: string
    baselineCost: string
    activity: string
    baselineActivity: string
    risk: string
    baselineRisk: string
    annualised?: string
  }
}

export type CategoryConfig = {
  id: CategoryId
  label: string
  shortLabel: string
  prompt: string
  summary: string[]
  description: string
  primaryMetricLabel: string
  primaryMetricSupport: string
  activityLabel: string
  activitySupport: string
  tableColumns: Array<{ key: string; label: string }>
  builderFields: Array<{ label: string; value: string; support?: string }>
  authorization: {
    goal: string
    asset: string
    capital: string
    maxSpend: string
    duration: string
    protocols: string
    actions: string
    expiry: string
    may: string[]
    mayNot: string[]
  }
  agents: CatalogAgent[]
}

export const categoryOrder: CategoryId[] = ['rebalancing', 'grid', 'yield', 'health']

export const categories: Record<CategoryId, CategoryConfig> = {
  rebalancing: {
    id: 'rebalancing',
    label: 'LP Rebalancing',
    shortLabel: 'Rebalance LP',
    prompt: 'Keep my BNB/USDT PancakeSwap position in range. Capital: 10,000 USDT. Medium risk or lower. Rebalance no more than twice a day and keep gas drag below 20% of fees.',
    summary: ['10,000 USDT-equivalent LP', 'Medium risk or lower', '≤2 rebalances/day', 'PancakeSwap only'],
    description: 'Keeps concentrated liquidity productive without letting transaction costs erase the fees earned.',
    primaryMetricLabel: 'Live range decision',
    primaryMetricSupport: 'Point-in-time market read',
    activityLabel: 'Rebalances',
    activitySupport: 'Per day',
    tableColumns: [
      { key: 'netFees', label: 'Capability' },
      { key: 'rangeUptime', label: 'Performance claim' },
      { key: 'gasDrag', label: 'Cost gate' },
      { key: 'rebalances', label: 'Action limit' },
    ],
    builderFields: [
      { label: 'Goal', value: 'Keep LP in range' },
      { label: 'Position', value: 'BNB/USDT V3' },
      { label: 'Risk', value: 'Gas drag ≤20%', support: 'Hard limit' },
      { label: 'Max actions', value: '2 per day' },
      { label: 'Price band', value: '±7.5%' },
      { label: 'Allowed protocol', value: 'PancakeSwap V3 only' },
    ],
    authorization: {
      goal: 'Keep concentrated liquidity in range',
      asset: 'BNB/USDT LP position',
      capital: '$10,000 equivalent',
      maxSpend: '$4/day gas',
      duration: '7 days',
      protocols: 'PancakeSwap V3',
      actions: 'Collect · Decrease · Swap · Increase',
      expiry: '7 days after activation',
      may: ['Manage the selected LP position', 'Collect fees and rebalance inside the target band', 'Swap only the position assets', 'Spend up to $4 per day on execution'],
      mayNot: ['Transfer the LP NFT to another wallet', 'Use any pool outside BNB/USDT', 'Borrow assets or add leverage', 'Rebalance more than twice in 24 hours'],
    },
    agents: [
      { id: 'rg-1042', name: 'RangeGuard', recommendation: 'Best fit', fit: 91, status: 'satisfies', metrics: { netFees: 'Live run', rangeUptime: 'Not claimed', gasDrag: 'Calculated live', rebalances: 'Mandate cap' }, completedMandates: 0, disputed: 0, capitalObserved: 0, medianExecutionSeconds: 0, lastActive: 'Live on request', shadow: { primary: 'Live decision', baseline: 'Not compared', advantage: 'Not claimed', cost: 'Wallet quote', baselineCost: 'Not measured', activity: 'Mandate cap', baselineActivity: 'Not measured', risk: 'Mandate bound', baselineRisk: 'Not measured' } },
      { id: 'rb-2271', name: 'BandSteady', recommendation: 'Safer', fit: 0, status: 'satisfies', metrics: { netFees: 'Not verified', rangeUptime: 'Not verified', gasDrag: 'Not verified', rebalances: 'Not verified' }, completedMandates: 0, disputed: 0, capitalObserved: 0, medianExecutionSeconds: 0, lastActive: 'Not verified', shadow: { primary: 'Not verified', baseline: 'Not verified', advantage: 'Not claimed', cost: 'Not verified', baselineCost: 'Not verified', activity: 'Not verified', baselineActivity: 'Not verified', risk: 'Not verified', baselineRisk: 'Not verified' } },
      { id: 'rh-9904', name: 'RangeHyper', recommendation: 'Cheaper', fit: 0, status: 'violates', violation: 'No verified provider receipt; cannot be assessed for your mandate.', metrics: { netFees: 'Not verified', rangeUptime: 'Not verified', gasDrag: 'Not verified', rebalances: 'Not verified' }, completedMandates: 0, disputed: 0, capitalObserved: 0, medianExecutionSeconds: 0, lastActive: 'Not verified', shadow: { primary: 'Not verified', baseline: 'Not verified', advantage: 'Not claimed', cost: 'Not verified', baselineCost: 'Not verified', activity: 'Not verified', baselineActivity: 'Not verified', risk: 'Not verified', baselineRisk: 'Not verified' } },
    ],
  },
  grid: {
    id: 'grid',
    label: 'Grid Trading',
    shortLabel: 'Run a grid',
    prompt: 'Run a 5,000 USDT BNB/USDT grid. Medium risk or lower. Keep max drawdown below 5%, place no more than 12 orders per day, and stop outside a ranging market.',
    summary: ['5,000 USDT grid', 'Medium risk or lower', 'Max drawdown 5%', '≤12 orders/day'],
    description: 'Runs bounded automated grid orders while treating drawdown and market regime as hard risk gates.',
    primaryMetricLabel: 'Live grid decision',
    primaryMetricSupport: 'Point-in-time market read',
    activityLabel: 'Filled orders',
    activitySupport: 'Per day',
    tableColumns: [
      { key: 'netPnl', label: 'Track record' },
      { key: 'drawdown', label: 'Risk gate' },
      { key: 'profitFactor', label: 'Fee model' },
      { key: 'winRate', label: 'Hire evidence' },
    ],
    builderFields: [
      { label: 'Goal', value: 'Run bounded grid' },
      { label: 'Market', value: 'BNB/USDT' },
      { label: 'Risk', value: 'Max drawdown 5%', support: 'Hard stop' },
      { label: 'Max orders', value: '12 per day' },
      { label: 'Regime', value: 'Ranging only' },
      { label: 'Allowed protocol', value: 'PancakeSwap only' },
    ],
    authorization: {
      goal: 'Capture range-bound BNB/USDT volatility',
      asset: '5,000 USDT',
      capital: '$5,000',
      maxSpend: '$35/day turnover',
      duration: '72 hours',
      protocols: 'PancakeSwap',
      actions: 'Quote · Swap · Cancel · Pause',
      expiry: '72 hours after activation',
      may: ['Place bounded BNB/USDT grid swaps', 'Cancel unfilled grid instructions', 'Pause when the regime changes', 'Use no more than 12 orders per day'],
      mayNot: ['Trade any other pair', 'Use leverage or borrowed capital', 'Continue after 5% drawdown', 'Transfer assets outside the execution contract'],
    },
    agents: [
      { id: 'gp-3814', name: 'GridPilot', recommendation: 'Best fit', fit: 88, status: 'satisfies', metrics: { netPnl: '30d paper test', drawdown: 'Mandate hard stop', profitFactor: 'Pool fee modeled', winRate: 'No onchain record' }, completedMandates: 0, disputed: 0, capitalObserved: 0, medianExecutionSeconds: 0, lastActive: 'Live on request', shadow: { primary: 'Paper record', baseline: 'Not compared', advantage: 'Not claimed', cost: 'Modeled', baselineCost: 'Not measured', activity: 'Mandate cap', baselineActivity: 'Not measured', risk: 'Paper hard stop', baselineRisk: 'Not measured' } },
      { id: 'gc-2140', name: 'GridCalm', recommendation: 'Safer', fit: 0, status: 'satisfies', metrics: { netPnl: 'Not verified', drawdown: 'Not verified', profitFactor: 'Not verified', winRate: 'Not verified' }, completedMandates: 0, disputed: 0, capitalObserved: 0, medianExecutionSeconds: 0, lastActive: 'Not verified', shadow: { primary: 'Not verified', baseline: 'Not verified', advantage: 'Not claimed', cost: 'Not verified', baselineCost: 'Not verified', activity: 'Not verified', baselineActivity: 'Not verified', risk: 'Not verified', baselineRisk: 'Not verified' } },
      { id: 'gt-8102', name: 'GridTurbo', recommendation: 'Cheaper', fit: 0, status: 'violates', violation: 'No verified provider receipt; cannot be assessed for your mandate.', metrics: { netPnl: 'Not verified', drawdown: 'Not verified', profitFactor: 'Not verified', winRate: 'Not verified' }, completedMandates: 0, disputed: 0, capitalObserved: 0, medianExecutionSeconds: 0, lastActive: 'Not verified', shadow: { primary: 'Not verified', baseline: 'Not verified', advantage: 'Not claimed', cost: 'Not verified', baselineCost: 'Not verified', activity: 'Not verified', baselineActivity: 'Not verified', risk: 'Not verified', baselineRisk: 'Not verified' } },
    ],
  },
  yield: {
    id: 'yield',
    label: 'Yield Optimisation',
    shortLabel: 'Earn yield',
    prompt: 'Earn on 10,000 USDT. No leverage. Medium risk or lower. Move funds no more than twice a week.',
    summary: ['Earn on 10,000 USDT', 'No leverage', 'Medium risk or lower', '≤2 actions/week'],
    description: 'Routes stablecoins to the best net yield after fees without violating protocol, leverage, or activity limits.',
    primaryMetricLabel: 'Observed APY',
    primaryMetricSupport: 'Point-in-time third-party data',
    activityLabel: 'Protocol switches',
    activitySupport: 'Per mandate',
    tableColumns: [
      { key: 'netApy', label: 'Capability' },
      { key: 'leverage', label: 'Leverage limit' },
      { key: 'protocols', label: 'Live sources' },
      { key: 'mandates', label: 'Hire evidence' },
    ],
    builderFields: [
      { label: 'Goal', value: 'Earn yield' },
      { label: 'Capital', value: '10,000 USDT' },
      { label: 'Risk', value: 'Medium or lower', support: 'Within limits' },
      { label: 'Leverage', value: 'None (1×)' },
      { label: 'Max actions', value: '2 per week' },
      { label: 'Allowed protocols', value: 'PancakeSwap, Venus, Lista' },
    ],
    authorization: {
      goal: 'Maximise stablecoin yield',
      asset: 'USDT only',
      capital: '$10,000',
      maxSpend: '$50/day',
      duration: '7 days',
      protocols: 'PancakeSwap · Venus · Lista',
      actions: 'Supply · Withdraw · Swap',
      expiry: '7 days after activation',
      may: ['Use up to 10,000 USDT of your capital', 'Supply to and withdraw from allowed protocols', 'Swap on allowed protocols to optimise yield', 'Spend up to $50 per day in total'],
      mayNot: ['Borrow any assets or use leverage', 'Transfer funds to wallets outside the allowlist', 'Use any protocol outside the allowed list', 'Exceed $50 of spend in a 24h period'],
    },
    agents: [
      { id: '8217', name: 'YieldRoute', recommendation: 'Best fit', fit: 87, status: 'satisfies', metrics: { netApy: 'Live quote', leverage: 'Mandate cap', protocols: 'Live sources', mandates: '1 verified hire' }, completedMandates: 1, disputed: 0, capitalObserved: 0, medianExecutionSeconds: 0, lastActive: 'Live on request', shadow: { primary: 'Live quote', baseline: 'Not compared', advantage: 'Not claimed', cost: 'Wallet quote', baselineCost: 'Not measured', activity: 'Mandate cap', baselineActivity: 'Not measured', risk: 'Mandate bound', baselineRisk: 'Not measured' } },
      { id: '6042', name: 'SteadyPath', recommendation: 'Safer', fit: 0, status: 'satisfies', metrics: { netApy: 'Not verified', leverage: 'Not verified', protocols: 'Not verified', mandates: 'Not verified' }, completedMandates: 0, disputed: 0, capitalObserved: 0, medianExecutionSeconds: 0, lastActive: 'Not verified', shadow: { primary: 'Not verified', baseline: 'Not verified', advantage: 'Not claimed', cost: 'Not verified', baselineCost: 'Not verified', activity: 'Not verified', baselineActivity: 'Not verified', risk: 'Not verified', baselineRisk: 'Not verified' } },
      { id: '1938', name: 'AggroMax', recommendation: 'Cheaper', fit: 0, status: 'violates', violation: 'No verified provider receipt; cannot be assessed for your mandate.', metrics: { netApy: 'Not verified', leverage: 'Not verified', protocols: 'Not verified', mandates: 'Not verified' }, completedMandates: 0, disputed: 0, capitalObserved: 0, medianExecutionSeconds: 0, lastActive: 'Not verified', shadow: { primary: 'Not verified', baseline: 'Not verified', advantage: 'Not claimed', cost: 'Not verified', baselineCost: 'Not verified', activity: 'Not verified', baselineActivity: 'Not verified', risk: 'Not verified', baselineRisk: 'Not verified' } },
    ],
  },
  health: {
    id: 'health',
    label: 'Health Factor Monitoring',
    shortLabel: 'Protect position',
    prompt: 'Keep my Venus health factor above 1.8 for 7 days. Spend no more than $50. Repay or add collateral only. Never borrow more.',
    summary: ['Venus HF ≥1.8', '7-day watch', 'Spend ≤$50', 'No new borrowing'],
    description: 'Watches lending positions continuously and intervenes before liquidation without increasing debt.',
    primaryMetricLabel: 'Live health factor',
    primaryMetricSupport: 'Pinned BSC block',
    activityLabel: 'Response latency',
    activitySupport: 'After threshold breach',
    tableColumns: [
      { key: 'minimumHf', label: 'Capability' },
      { key: 'leadTime', label: 'Snapshot' },
      { key: 'latency', label: 'API evidence' },
      { key: 'falseAlerts', label: 'Performance claim' },
    ],
    builderFields: [
      { label: 'Goal', value: 'Health factor ≥1.8' },
      { label: 'Position', value: 'Venus lending' },
      { label: 'Risk', value: 'Liquidation protection', support: 'Hard floor' },
      { label: 'Max spend', value: '$50 total' },
      { label: 'Allowed actions', value: 'Repay, add collateral' },
      { label: 'Forbidden', value: 'New borrowing' },
    ],
    authorization: {
      goal: 'Keep Venus health factor above 1.8',
      asset: 'Selected Venus position',
      capital: 'Up to $2,500 collateral',
      maxSpend: '$50 total',
      duration: '7 days',
      protocols: 'Venus only',
      actions: 'Monitor · Repay · Add collateral',
      expiry: '7 days after activation',
      may: ['Read the selected Venus position', 'Repay debt when HF approaches 1.8', 'Add allowlisted collateral', 'Spend no more than $50 in total'],
      mayNot: ['Open a new borrow position', 'Withdraw collateral', 'Use any protocol outside Venus', 'Transfer funds outside the allowlist'],
    },
    agents: [
      { id: 'ls-5520', name: 'LiqShield', recommendation: 'Best fit', fit: 94, status: 'satisfies', metrics: { minimumHf: 'Live wallet read', leadTime: 'Pinned block', latency: 'API measured', falseAlerts: 'Not claimed' }, completedMandates: 0, disputed: 0, capitalObserved: 0, medianExecutionSeconds: 0, lastActive: 'Live on request', shadow: { primary: 'Live decision', baseline: 'Not compared', advantage: 'Not claimed', cost: 'Wallet quote', baselineCost: 'Not measured', activity: 'Mandate cap', baselineActivity: 'Not measured', risk: 'Mandate bound', baselineRisk: 'Not measured' } },
      { id: 'hs-1188', name: 'HealthSentinel', recommendation: 'Safer', fit: 0, status: 'satisfies', metrics: { minimumHf: 'Not verified', leadTime: 'Not verified', latency: 'Not verified', falseAlerts: 'Not verified' }, completedMandates: 0, disputed: 0, capitalObserved: 0, medianExecutionSeconds: 0, lastActive: 'Not verified', shadow: { primary: 'Not verified', baseline: 'Not verified', advantage: 'Not claimed', cost: 'Not verified', baselineCost: 'Not verified', activity: 'Not verified', baselineActivity: 'Not verified', risk: 'Not verified', baselineRisk: 'Not verified' } },
      { id: 'ha-7011', name: 'HealthAmp', recommendation: 'Cheaper', fit: 0, status: 'violates', violation: 'No verified provider receipt; cannot be assessed for your mandate.', metrics: { minimumHf: 'Not verified', leadTime: 'Not verified', latency: 'Not verified', falseAlerts: 'Not verified' }, completedMandates: 0, disputed: 0, capitalObserved: 0, medianExecutionSeconds: 0, lastActive: 'Not verified', shadow: { primary: 'Not verified', baseline: 'Not verified', advantage: 'Not claimed', cost: 'Not verified', baselineCost: 'Not verified', activity: 'Not verified', baselineActivity: 'Not verified', risk: 'Not verified', baselineRisk: 'Not verified' } },
    ],
  },
}

// ERC-8004 identities were registered by the project owner, while ERC-8183
// work is fulfilled by a separate provider wallet. Keeping those roles
// separate makes every TermiX hire independently verifiable onchain.
export const verifiedServiceProvider = '0x34ABe1790E6d67E25c7616799C2C6B7336932c7e' as const
Object.assign(categories.rebalancing.agents[0], {
  id: '1804',
  providerAddress: verifiedServiceProvider,
  registrationTxHash: '0x6347892a3647919efde0b145698771678b42b24c8d717df7f2b8588919f96d60',
  metrics: { netFees: 'Live run', rangeUptime: 'Not claimed', gasDrag: 'Calculated live', rebalances: '≤2/day cap' },
})
Object.assign(categories.grid.agents[0], {
  id: '1805',
  providerAddress: verifiedServiceProvider,
  registrationTxHash: '0x9aff5b7f4ef4ad2236d4c1b3821f4cd63882de540c476a7ffe13c33e1d8d4542',
  metrics: { netPnl: '30d paper test', drawdown: '5% hard stop', profitFactor: 'Pool fee modeled', winRate: '1 verified hire' },
})
Object.assign(categories.yield.agents[0], {
  id: '1806',
  providerAddress: verifiedServiceProvider,
  registrationTxHash: '0xe00a95305b3b28637d6de96b31b6cf0e87d84acac49a31d7b4a1f2add44a8198',
  metrics: { netApy: 'Live quote', leverage: '0 leverage', protocols: '3 live sources', mandates: '1 verified hire' },
})
Object.assign(categories.health.agents[0], {
  id: '1807',
  providerAddress: verifiedServiceProvider,
  registrationTxHash: '0x27237dab5509726b660be6e2d13d13296cc34a2c33312b01f1f8cd1f69261100',
  metrics: { minimumHf: 'Live wallet read', leadTime: 'Pinned block', latency: 'API measured', falseAlerts: 'Not claimed' },
})

// Keep the provenance on every card, including the benchmark fixtures that are
// intentionally excluded from the hireable inventory. This makes it impossible
// for a new surface to accidentally present the old demo APY/PnL/counts as facts.
for (const category of Object.values(categories)) {
  for (const agent of category.agents) {
    if (agent.providerAddress && agent.registrationTxHash) {
      agent.evidenceStatus = 'verified-onchain'
      agent.executionMode = 'live-read-only'
      agent.providerSource = 'MANDATE live gateway + public BSC receipt'
    } else {
      agent.evidenceStatus = 'unverified-sample'
      agent.executionMode = 'not-hireable'
      agent.providerSource = 'Benchmark fixture — no provider wallet or receipt'
    }
  }
}

export function isHireableCatalogAgent(agent: CatalogAgent) {
  return Boolean(
    agent.evidenceStatus === 'verified-onchain' &&
    (agent.executionMode === 'live-read-only' || agent.executionMode === 'testnet-service-escrow') &&
    agent.providerAddress &&
    agent.registrationTxHash,
  ) && (agent.executionMode !== 'testnet-service-escrow' || (Boolean(agent.executionScope) && agent.assetExecutionVerified === true))
    && (agent.executionScope?.category !== 'grid' || Boolean(agent.trackRecord?.mode === 'realized-onchain'))
}

export function countUniqueProviders(category: CategoryConfig) {
  return new Set(
    category.agents
      .filter(isHireableCatalogAgent)
      .map((agent) => agent.providerAddress?.toLowerCase())
      .filter(Boolean),
  ).size
}

export function getCategory(value: string | null): CategoryConfig {
  return value && value in categories ? categories[value as CategoryId] : categories.yield
}
