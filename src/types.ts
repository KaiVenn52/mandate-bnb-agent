export type AgentCategory = 'yield' | 'grid' | 'liquidity' | 'health'

export type Agent = {
  id: string
  name: string
  category: AgentCategory
  recommendation: 'Best fit' | 'Safer' | 'Cheaper'
  fit: number
  projectedApy: number
  leverage: number
  protocols: string[]
  completedMandates: number
  disputed: number
  capitalObserved: number
  medianExecutionSeconds: number
  lastActive: string
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
  metrics: Array<{
    label: string
    value: string
    source: 'HISTORICAL SAMPLE' | 'DERIVED SAMPLE'
  }>
  riskRule: string
}
