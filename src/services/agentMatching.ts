import type { CatalogAgent, CategoryConfig } from '../catalog'
import type { MandateDraft } from './mandateDraft'

export type MatchedAgent = CatalogAgent & {
  matchReason: string
  estimatedOutcome?: string
}

const riskRank = { low: 0, medium: 1, high: 2 }

function agentRisk(agent: CatalogAgent): 'low' | 'medium' | 'high' {
  const value = agent.shadow.risk.toLowerCase()
  if (/high|adds debt|liquidation|8\.|9\./.test(value)) return 'high'
  if (/medium|3\.|4\.|5\./.test(value)) return 'medium'
  return 'low'
}

function numeric(value: string | undefined): number {
  return Number(value?.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)?.[0] ?? 0)
}

export function matchAgents(category: CategoryConfig, draft: MandateDraft | null): MatchedAgent[] {
  if (!draft || draft.categoryId !== category.id) {
    return category.agents.map((agent) => ({ ...agent, matchReason: 'Using the category template until a mandate is saved.' }))
  }

  const capital = draft.constraints.capitalAmount
  const candidates = category.agents.map((agent) => {
    const violations: string[] = []
    const leverage = numeric(agent.metrics.leverage)
    const risk = agentRisk(agent)
    if (leverage > draft.constraints.leverageMax) {
      violations.push(`${leverage}× leverage exceeds ${draft.constraints.leverageSpecified ? 'your cap' : 'the no-leverage safety default'}`)
    }
    if (riskRank[risk] > riskRank[draft.constraints.riskMax]) {
      violations.push(`${risk} risk exceeds the ${draft.constraints.riskMax} risk cap`)
    }

    const apy = category.id === 'yield' ? numeric(agent.metrics.netApy) : 0
    const estimatedOutcome = capital && apy
      ? `≈ ${(capital * apy / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${draft.constraints.asset}/year at the displayed sample APY`
      : undefined
    const reliability = 1 - agent.disputed / Math.max(1, agent.completedMandates)
    const evidenceCoverage = capital ? Math.min(1, agent.capitalObserved / capital) : 0.5
    const status = violations.length ? 'violates' as const : 'satisfies' as const
    const fit = status === 'satisfies'
      ? Math.min(98, Math.round(68 + Math.min(18, apy * 2) + reliability * 8 + evidenceCoverage * 4))
      : Math.min(74, Math.round(50 + reliability * 8 + evidenceCoverage * 4))
    const defaultNotes = [
      !draft.constraints.leverageSpecified ? 'no-leverage safety default applied' : null,
      !draft.constraints.actionCapSpecified ? `${draft.constraints.actionCap}/${draft.constraints.actionPeriod} action safety default applied` : null,
    ].filter(Boolean)
    return {
      ...agent,
      fit,
      status,
      violation: violations.length ? `${violations.join('; ')}.` : undefined,
      matchReason: violations.length
        ? `Excluded: ${violations.join('; ')}.`
        : `Eligible for ${draft.constraints.riskMax} risk. ${defaultNotes.join('; ') || 'All explicit limits passed'}.`,
      estimatedOutcome,
    }
  })

  return candidates.sort((left, right) => {
    if (left.status !== right.status) return left.status === 'satisfies' ? -1 : 1
    return right.fit - left.fit
  })
}
