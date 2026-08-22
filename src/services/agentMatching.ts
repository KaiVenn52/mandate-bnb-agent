import type { CatalogAgent, CategoryConfig } from '../catalog'
import type { MandateDraft } from './mandateDraft'

export type MatchedAgent = CatalogAgent & { matchReason: string; estimatedOutcome?: string }

type Period = 'day' | 'week' | 'month'
type CapabilityProfile = {
  assets: string[]
  protocols: string[]
  maxCapitalUsd: number
  maxLeverage: number
  risk: 'low' | 'medium' | 'high'
  actionRate: { count: number; period: Period }
  estimatedCostUsd: number
}

const riskRank = { low: 0, medium: 1, high: 2 }

const profiles: Record<string, CapabilityProfile> = {
  RangeGuard: { assets: ['BNB', 'USDT'], protocols: ['PancakeSwap'], maxCapitalUsd: 250_000, maxLeverage: 0, risk: 'medium', actionRate: { count: 1.3, period: 'day' }, estimatedCostUsd: 2.84 },
  BandSteady: { assets: ['BNB', 'USDT'], protocols: ['PancakeSwap'], maxCapitalUsd: 250_000, maxLeverage: 0, risk: 'low', actionRate: { count: 0.8, period: 'day' }, estimatedCostUsd: 1.96 },
  RangeHyper: { assets: ['BNB', 'USDT'], protocols: ['PancakeSwap'], maxCapitalUsd: 500_000, maxLeverage: 0, risk: 'high', actionRate: { count: 4.8, period: 'day' }, estimatedCostUsd: 8.2 },
  GridPilot: { assets: ['BNB', 'USDT'], protocols: ['PancakeSwap'], maxCapitalUsd: 100_000, maxLeverage: 0, risk: 'medium', actionRate: { count: 8.4, period: 'day' }, estimatedCostUsd: 4.12 },
  GridCalm: { assets: ['BNB', 'USDT'], protocols: ['PancakeSwap'], maxCapitalUsd: 100_000, maxLeverage: 0, risk: 'low', actionRate: { count: 6.1, period: 'day' }, estimatedCostUsd: 3.26 },
  GridTurbo: { assets: ['BNB', 'USDT'], protocols: ['PancakeSwap'], maxCapitalUsd: 150_000, maxLeverage: 0, risk: 'high', actionRate: { count: 18.6, period: 'day' }, estimatedCostUsd: 9.38 },
  YieldRoute: { assets: ['USDT', 'USDC'], protocols: ['PancakeSwap', 'Venus', 'Lista'], maxCapitalUsd: 1_000_000, maxLeverage: 0, risk: 'medium', actionRate: { count: 1, period: 'week' }, estimatedCostUsd: 0.27 },
  SteadyPath: { assets: ['USDT', 'USDC'], protocols: ['Venus', 'Lista'], maxCapitalUsd: 500_000, maxLeverage: 0, risk: 'low', actionRate: { count: 1, period: 'week' }, estimatedCostUsd: 0.19 },
  AggroMax: { assets: ['USDT', 'USDC'], protocols: ['PancakeSwap', 'Venus', 'Lista', 'Aster'], maxCapitalUsd: 1_000_000, maxLeverage: 2, risk: 'high', actionRate: { count: 3, period: 'week' }, estimatedCostUsd: 0.31 },
  LiqShield: { assets: ['USDT', 'USDC', 'BNB', 'BTCB', 'ETH'], protocols: ['Venus'], maxCapitalUsd: 1_000_000, maxLeverage: 0, risk: 'low', actionRate: { count: 1, period: 'week' }, estimatedCostUsd: 0.09 },
  HealthSentinel: { assets: ['USDT', 'USDC', 'BNB', 'BTCB', 'ETH'], protocols: ['Venus'], maxCapitalUsd: 1_000_000, maxLeverage: 0, risk: 'low', actionRate: { count: 1, period: 'week' }, estimatedCostUsd: 0.12 },
  HealthAmp: { assets: ['USDT', 'USDC', 'BNB', 'BTCB', 'ETH'], protocols: ['Venus'], maxCapitalUsd: 1_000_000, maxLeverage: 2, risk: 'high', actionRate: { count: 2, period: 'week' }, estimatedCostUsd: 0.18 },
}

const weeklyRate = (count: number, period: Period) => period === 'day' ? count * 7 : period === 'month' ? count / 4.345 : count

export function getAgentCapabilityProfile(agent: CatalogAgent): CapabilityProfile {
  return profiles[agent.name]
}

export function matchAgents(category: CategoryConfig, draft: MandateDraft | null): MatchedAgent[] {
  if (!draft || draft.categoryId !== category.id) {
    return category.agents.map((agent) => ({ ...agent, matchReason: 'Using the category template until a mandate is saved.' }))
  }

  const capital = draft.constraints.capitalAmount
  const candidates = category.agents.map((agent) => {
    const profile = getAgentCapabilityProfile(agent)
    const violations: string[] = []
    if (profile.maxLeverage > draft.constraints.leverageMax) violations.push(`${profile.maxLeverage}× leverage exceeds ${draft.constraints.leverageSpecified ? 'your cap' : 'the no-leverage safety default'}`)
    if (riskRank[profile.risk] > riskRank[draft.constraints.riskMax]) violations.push(`${profile.risk} risk exceeds the ${draft.constraints.riskMax} risk cap`)
    if (capital !== null && capital > profile.maxCapitalUsd) violations.push(`${capital.toLocaleString()} ${draft.constraints.asset} exceeds the provider's ${profile.maxCapitalUsd.toLocaleString()} USD capacity`)
    if (draft.constraints.asset !== 'Any asset' && !profile.assets.includes(draft.constraints.asset)) violations.push(`${draft.constraints.asset} is outside the provider's supported assets`)
    if (draft.constraints.protocols.length && !draft.constraints.protocols.some((protocol) => profile.protocols.includes(protocol))) violations.push('none of the allowed protocols are supported by this provider')
    if (weeklyRate(profile.actionRate.count, profile.actionRate.period) > weeklyRate(draft.constraints.actionCap, draft.constraints.actionPeriod) + 0.0001) violations.push(`${profile.actionRate.count}/${profile.actionRate.period} activity exceeds the ${draft.constraints.actionCap}/${draft.constraints.actionPeriod} cap`)
    if (draft.constraints.spendCapUsd !== null && profile.estimatedCostUsd > draft.constraints.spendCapUsd) violations.push(`estimated $${profile.estimatedCostUsd} cost exceeds the $${draft.constraints.spendCapUsd} spend cap`)
    const apy = category.id === 'yield' ? Number(agent.metrics.netApy?.replace(/[^0-9.-]/g, '') ?? 0) : 0
    const estimatedOutcome = capital && apy ? `≈ ${(capital * apy / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${draft.constraints.asset}/year at the displayed sample APY` : undefined
    const reliability = 1 - agent.disputed / Math.max(1, agent.completedMandates)
    const evidenceCoverage = capital ? Math.min(1, agent.capitalObserved / capital) : 0.5
    const status = violations.length ? 'violates' as const : 'satisfies' as const
    const fit = status === 'satisfies' ? Math.min(98, Math.round(68 + Math.min(18, apy * 2) + reliability * 8 + evidenceCoverage * 4)) : Math.min(74, Math.round(50 + reliability * 8 + evidenceCoverage * 4))
    const appliedDefaults = [
      !draft.constraints.leverageSpecified ? 'no-leverage default' : null,
      !draft.constraints.actionCapSpecified ? `${draft.constraints.actionCap}/${draft.constraints.actionPeriod} action default` : null,
      !draft.constraints.protocols.length ? `${profile.protocols.join(', ')} provider universe` : null,
    ].filter(Boolean)

    return {
      ...agent,
      fit,
      status,
      violation: violations.length ? `${violations.join('; ')}.` : undefined,
      matchReason: violations.length ? `Excluded: ${violations.join('; ')}.` : `Eligible: asset, capital, risk, leverage, protocol, activity and spend checks passed${appliedDefaults.length ? ` (${appliedDefaults.join('; ')})` : ''}.`,
      estimatedOutcome,
    }
  })

  return candidates.toSorted((left, right) => {
    if (left.status !== right.status) return left.status === 'satisfies' ? -1 : 1
    if (Boolean(left.providerAddress) !== Boolean(right.providerAddress)) return left.providerAddress ? -1 : 1
    return right.fit - left.fit
  })
}
