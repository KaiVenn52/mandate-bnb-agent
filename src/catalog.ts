export type CategoryId = 'rebalancing' | 'grid' | 'yield' | 'health'

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
    prompt: 'Keep my BNB/USDT PancakeSwap position in range. Rebalance no more than twice a day and keep gas drag below 20% of fees.',
    summary: ['BNB/USDT LP', '≤2 rebalances/day', 'Gas drag ≤20%', 'PancakeSwap only'],
    description: 'Keeps concentrated liquidity productive without letting transaction costs erase the fees earned.',
    primaryMetricLabel: 'Projected net fees',
    primaryMetricSupport: 'After gas and estimated IL',
    activityLabel: 'Rebalances',
    activitySupport: 'Per day',
    tableColumns: [
      { key: 'netFees', label: 'Net fees / 30d' },
      { key: 'rangeUptime', label: 'Range uptime' },
      { key: 'gasDrag', label: 'Gas drag' },
      { key: 'rebalances', label: 'Rebalances' },
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
      { id: 'rg-1042', name: 'RangeGuard', recommendation: 'Best fit', fit: 91, status: 'satisfies', metrics: { netFees: '+$184.20', rangeUptime: '96.8%', gasDrag: '14.2%', rebalances: '1.3/day' }, completedMandates: 19, disputed: 0, capitalObserved: 48_300, medianExecutionSeconds: 38, lastActive: '4m ago', shadow: { primary: '+$184.20', baseline: '+$119.70', advantage: '+$64.50', cost: '$2.84', baselineCost: '$0.00', activity: '1.3/day', baselineActivity: '0', risk: 'Medium', baselineRisk: 'High', annualised: '+$774 / $10k / year' } },
      { id: 'rb-2271', name: 'BandSteady', recommendation: 'Safer', fit: 86, status: 'satisfies', metrics: { netFees: '+$161.80', rangeUptime: '94.1%', gasDrag: '10.8%', rebalances: '0.8/day' }, completedMandates: 12, disputed: 0, capitalObserved: 26_900, medianExecutionSeconds: 46, lastActive: '9m ago', shadow: { primary: '+$161.80', baseline: '+$119.70', advantage: '+$42.10', cost: '$1.96', baselineCost: '$0.00', activity: '0.8/day', baselineActivity: '0', risk: 'Low', baselineRisk: 'High', annualised: '+$505 / $10k / year' } },
      { id: 'rh-9904', name: 'RangeHyper', recommendation: 'Cheaper', fit: 74, status: 'violates', violation: 'Rebalances 4.8 times per day, above your limit of 2.', metrics: { netFees: '+$211.30', rangeUptime: '98.2%', gasDrag: '27.4%', rebalances: '4.8/day' }, completedMandates: 31, disputed: 3, capitalObserved: 96_200, medianExecutionSeconds: 27, lastActive: '1m ago', shadow: { primary: '+$211.30', baseline: '+$119.70', advantage: '+$91.60', cost: '$8.20', baselineCost: '$0.00', activity: '4.8/day', baselineActivity: '0', risk: 'High', baselineRisk: 'High' } },
    ],
  },
  grid: {
    id: 'grid',
    label: 'Grid Trading',
    shortLabel: 'Run a grid',
    prompt: 'Run a conservative BNB/USDT grid. Keep max drawdown below 5%, place no more than 12 orders per day, and stop outside a ranging market.',
    summary: ['BNB/USDT grid', 'Max drawdown 5%', '≤12 orders/day', 'Ranging regime only'],
    description: 'Runs bounded automated grid orders while treating drawdown and market regime as hard risk gates.',
    primaryMetricLabel: 'Net PnL',
    primaryMetricSupport: '30-day replay after fees',
    activityLabel: 'Filled orders',
    activitySupport: 'Per day',
    tableColumns: [
      { key: 'netPnl', label: 'Net PnL / 30d' },
      { key: 'drawdown', label: 'Max drawdown' },
      { key: 'profitFactor', label: 'Profit factor' },
      { key: 'winRate', label: 'Win rate' },
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
      { id: 'gp-3814', name: 'GridPilot', recommendation: 'Best fit', fit: 88, status: 'satisfies', metrics: { netPnl: '+4.26%', drawdown: '3.18%', profitFactor: '1.71', winRate: '64.8%' }, completedMandates: 22, disputed: 1, capitalObserved: 61_750, medianExecutionSeconds: 51, lastActive: '2m ago', shadow: { primary: '+4.26%', baseline: '+1.08%', advantage: '+3.18%', cost: '$4.12', baselineCost: '$0.00', activity: '8.4/day', baselineActivity: '0', risk: '3.18% DD', baselineRisk: '6.42% DD', annualised: '+$159 / $5k / 30d' } },
      { id: 'gc-2140', name: 'GridCalm', recommendation: 'Safer', fit: 84, status: 'satisfies', metrics: { netPnl: '+3.44%', drawdown: '2.11%', profitFactor: '1.58', winRate: '62.1%' }, completedMandates: 15, disputed: 0, capitalObserved: 35_400, medianExecutionSeconds: 64, lastActive: '7m ago', shadow: { primary: '+3.44%', baseline: '+1.08%', advantage: '+2.36%', cost: '$3.26', baselineCost: '$0.00', activity: '6.1/day', baselineActivity: '0', risk: '2.11% DD', baselineRisk: '6.42% DD', annualised: '+$118 / $5k / 30d' } },
      { id: 'gt-8102', name: 'GridTurbo', recommendation: 'Cheaper', fit: 77, status: 'violates', violation: '30-day replay reaches 8.7% max drawdown, above your 5% hard stop.', metrics: { netPnl: '+7.82%', drawdown: '8.70%', profitFactor: '1.39', winRate: '58.4%' }, completedMandates: 44, disputed: 4, capitalObserved: 132_900, medianExecutionSeconds: 29, lastActive: '1m ago', shadow: { primary: '+7.82%', baseline: '+1.08%', advantage: '+6.74%', cost: '$9.38', baselineCost: '$0.00', activity: '18.6/day', baselineActivity: '0', risk: '8.70% DD', baselineRisk: '6.42% DD' } },
    ],
  },
  yield: {
    id: 'yield',
    label: 'Yield Optimisation',
    shortLabel: 'Earn yield',
    prompt: 'Earn on 10,000 USDT. No leverage. Medium risk or lower. Move funds no more than twice a week.',
    summary: ['Earn on 10,000 USDT', 'No leverage', 'Medium risk or lower', '≤2 actions/week'],
    description: 'Routes stablecoins to the best net yield after fees without violating protocol, leverage, or activity limits.',
    primaryMetricLabel: 'Projected net APY',
    primaryMetricSupport: 'After fees',
    activityLabel: 'Protocol switches',
    activitySupport: 'Per mandate',
    tableColumns: [
      { key: 'netApy', label: 'Projected net APY' },
      { key: 'leverage', label: 'Leverage' },
      { key: 'protocols', label: 'Protocols' },
      { key: 'mandates', label: 'Mandates' },
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
      { id: '8217', name: 'YieldRoute', recommendation: 'Best fit', fit: 87, status: 'satisfies', metrics: { netApy: '7.42%', leverage: '0 leverage', protocols: '3', mandates: '14' }, completedMandates: 14, disputed: 0, capitalObserved: 21_420, medianExecutionSeconds: 42, lastActive: '3m ago', shadow: { primary: '7.42%', baseline: '5.69%', advantage: '+1.73%', cost: '$0.27', baselineCost: '$0.00', activity: '1', baselineActivity: '0', risk: 'Medium', baselineRisk: 'Low', annualised: '+$173 / $10k / year' } },
      { id: '6042', name: 'SteadyPath', recommendation: 'Safer', fit: 82, status: 'satisfies', metrics: { netApy: '6.18%', leverage: '0 leverage', protocols: '2', mandates: '8' }, completedMandates: 8, disputed: 0, capitalObserved: 12_610, medianExecutionSeconds: 55, lastActive: '11m ago', shadow: { primary: '6.18%', baseline: '5.69%', advantage: '+0.49%', cost: '$0.19', baselineCost: '$0.00', activity: '1', baselineActivity: '0', risk: 'Low', baselineRisk: 'Low', annualised: '+$49 / $10k / year' } },
      { id: '1938', name: 'AggroMax', recommendation: 'Cheaper', fit: 79, status: 'violates', violation: 'Uses 2× leverage, which your mandate forbids.', metrics: { netApy: '8.91%', leverage: '2× leverage', protocols: '4', mandates: '27' }, completedMandates: 27, disputed: 2, capitalObserved: 88_930, medianExecutionSeconds: 31, lastActive: '1m ago', shadow: { primary: '8.91%', baseline: '5.69%', advantage: '+3.22%', cost: '$0.31', baselineCost: '$0.00', activity: '3', baselineActivity: '0', risk: 'High', baselineRisk: 'Low' } },
    ],
  },
  health: {
    id: 'health',
    label: 'Health Factor Monitoring',
    shortLabel: 'Protect position',
    prompt: 'Keep my Venus health factor above 1.8 for 7 days. Spend no more than $50. Repay or add collateral only. Never borrow more.',
    summary: ['Venus HF ≥1.8', '7-day watch', 'Spend ≤$50', 'No new borrowing'],
    description: 'Watches lending positions continuously and intervenes before liquidation without increasing debt.',
    primaryMetricLabel: 'Minimum health factor',
    primaryMetricSupport: '30-day replay',
    activityLabel: 'Response latency',
    activitySupport: 'After threshold breach',
    tableColumns: [
      { key: 'minimumHf', label: 'Minimum HF' },
      { key: 'leadTime', label: 'Warning lead' },
      { key: 'latency', label: 'Response latency' },
      { key: 'falseAlerts', label: 'False alerts' },
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
      { id: 'ls-5520', name: 'LiqShield', recommendation: 'Best fit', fit: 94, status: 'satisfies', metrics: { minimumHf: '1.92', leadTime: '4m 18s', latency: '6.2s', falseAlerts: '0' }, completedMandates: 17, disputed: 0, capitalObserved: 42_800, medianExecutionSeconds: 6, lastActive: '20s ago', shadow: { primary: '1.92 HF', baseline: '1.61 HF', advantage: '+0.31 HF', cost: '$0.09', baselineCost: '$0.00', activity: '6.2s', baselineActivity: 'Manual', risk: 'Protected', baselineRisk: 'Liquidation zone', annualised: '4m 18s earlier warning' } },
      { id: 'hs-1188', name: 'HealthSentinel', recommendation: 'Safer', fit: 89, status: 'satisfies', metrics: { minimumHf: '2.04', leadTime: '5m 02s', latency: '9.8s', falseAlerts: '1' }, completedMandates: 11, disputed: 0, capitalObserved: 31_600, medianExecutionSeconds: 10, lastActive: '2m ago', shadow: { primary: '2.04 HF', baseline: '1.61 HF', advantage: '+0.43 HF', cost: '$0.12', baselineCost: '$0.00', activity: '9.8s', baselineActivity: 'Manual', risk: 'Protected', baselineRisk: 'Liquidation zone', annualised: '5m 02s earlier warning' } },
      { id: 'ha-7011', name: 'HealthAmp', recommendation: 'Cheaper', fit: 76, status: 'violates', violation: 'May open a new borrow position during intervention, which your mandate forbids.', metrics: { minimumHf: '2.21', leadTime: '3m 41s', latency: '4.1s', falseAlerts: '3' }, completedMandates: 29, disputed: 2, capitalObserved: 83_500, medianExecutionSeconds: 4, lastActive: '35s ago', shadow: { primary: '2.21 HF', baseline: '1.61 HF', advantage: '+0.60 HF', cost: '$0.18', baselineCost: '$0.00', activity: '4.1s', baselineActivity: 'Manual', risk: 'Adds debt', baselineRisk: 'Liquidation zone' } },
    ],
  },
}

// ERC-8004 identities were registered by the project owner, while ERC-8183
// work is fulfilled by a separate provider wallet. Keeping those roles
// separate makes every TermiX hire independently verifiable onchain.
const verifiedServiceProvider = '0x34ABe1790E6d67E25c7616799C2C6B7336932c7e' as const
Object.assign(categories.rebalancing.agents[0], {
  id: '1804',
  providerAddress: verifiedServiceProvider,
  registrationTxHash: '0x6347892a3647919efde0b145698771678b42b24c8d717df7f2b8588919f96d60',
})
Object.assign(categories.grid.agents[0], {
  id: '1805',
  providerAddress: verifiedServiceProvider,
  registrationTxHash: '0x9aff5b7f4ef4ad2236d4c1b3821f4cd63882de540c476a7ffe13c33e1d8d4542',
})
Object.assign(categories.yield.agents[0], {
  id: '1806',
  providerAddress: verifiedServiceProvider,
  registrationTxHash: '0xe00a95305b3b28637d6de96b31b6cf0e87d84acac49a31d7b4a1f2add44a8198',
})
Object.assign(categories.health.agents[0], {
  id: '1807',
  providerAddress: verifiedServiceProvider,
  registrationTxHash: '0x27237dab5509726b660be6e2d13d13296cc34a2c33312b01f1f8cd1f69261100',
})

export function getCategory(value: string | null): CategoryConfig {
  return value && value in categories ? categories[value as CategoryId] : categories.yield
}
