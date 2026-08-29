export type AgentCategory = 'yield' | 'grid' | 'liquidity' | 'health'

export type Agent = {
  id: string
  name: string
  category: AgentCategory
  recommendation: 'Best fit' | 'Safer' | 'Cheaper'
  fit: number
  projectedApy: number | null
  leverage: number
  protocols: string[]
  completedMandates: number | null
  disputed: number | null
  capitalObserved: number | null
  medianExecutionSeconds: number | null
  lastActive: string | null
  dataQuality: 'unverified-sample' | 'verified-onchain' | 'live-read-only'
  status: 'satisfies' | 'violates'
  violation?: string
}

export type Mandate = {
  prompt: string
  goal: string
  asset: string
  capital: number
  risk: 'Low' | 'Medium' | 'High'
  leverage: boolean
  maxActionsPerWeek: number
  allowedProtocols: string[]
}

export type AdvantageTask = {
  id: string
  task: string
  category: string
  agentTime: string
  baselineTime: string
  agentCost: string
  baselineCost: string
  qualityDelta: string
  evidence: string
}

export type CategorySheet = {
  category: AgentCategory
  eyebrow: string
  agent: string
  mandate: string
  fit: number
  evidenceStatus: 'live-read-only' | 'verified-onchain' | 'paper-only'
  metrics: Array<{
    label: string
    value: string
    source: string
  }>
  riskRule: string
}
