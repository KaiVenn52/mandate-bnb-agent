import type { CatalogAgent, CategoryConfig } from '../catalog'
import type { MandateDraft } from './mandateDraft'

export type MatchedAgent = CatalogAgent & { matchReason: string; estimatedOutcome?: string }

type Period = 'day' | 'week' | 'month'
type CapabilityProfile = {
  assets: string[]
  protocols: string[]
  /** Null means the provider has not published a verifiable ceiling. */
  maxCapitalUsd: number | null
  maxLeverage: number | null
  risk: 'low' | 'medium' | 'high' | null
  actionRate: { count: number; period: Period } | null
  estimatedCostUsd: number | null
}

const riskRank = { low: 0, medium: 1, high: 2 }

// These are only declared operating surfaces, never historical performance,
// capacity, cost or activity measurements.  Unknown numeric/risk fields stay
// null so a matcher cannot silently turn an old benchmark fixture into a
// provider claim.
const profiles: Record<string, CapabilityProfile> = {
  RangeGuard: { assets: ['BNB', 'USDT'], protocols: ['PancakeSwap'], maxCapitalUsd: null, maxLeverage: 0, risk: null, actionRate: null, estimatedCostUsd: null },
  BandSteady: { assets: ['BNB', 'USDT'], protocols: ['PancakeSwap'], maxCapitalUsd: null, maxLeverage: 0, risk: null, actionRate: null, estimatedCostUsd: null },
  RangeHyper: { assets: ['BNB', 'USDT'], protocols: ['PancakeSwap'], maxCapitalUsd: null, maxLeverage: 0, risk: null, actionRate: null, estimatedCostUsd: null },
  GridPilot: { assets: ['BNB', 'USDT'], protocols: ['PancakeSwap'], maxCapitalUsd: null, maxLeverage: 0, risk: null, actionRate: null, estimatedCostUsd: null },
  GridCalm: { assets: ['BNB', 'USDT'], protocols: ['PancakeSwap'], maxCapitalUsd: null, maxLeverage: 0, risk: null, actionRate: null, estimatedCostUsd: null },
  GridTurbo: { assets: ['BNB', 'USDT'], protocols: ['PancakeSwap'], maxCapitalUsd: null, maxLeverage: 0, risk: null, actionRate: null, estimatedCostUsd: null },
  YieldRoute: { assets: ['USDT', 'USDC'], protocols: ['PancakeSwap', 'Venus', 'Lista'], maxCapitalUsd: null, maxLeverage: 0, risk: null, actionRate: null, estimatedCostUsd: null },
  SteadyPath: { assets: ['USDT', 'USDC'], protocols: ['Venus', 'Lista'], maxCapitalUsd: null, maxLeverage: 0, risk: null, actionRate: null, estimatedCostUsd: null },
  AggroMax: { assets: ['USDT', 'USDC'], protocols: ['PancakeSwap', 'Venus', 'Lista', 'Aster'], maxCapitalUsd: null, maxLeverage: null, risk: null, actionRate: null, estimatedCostUsd: null },
  LiqShield: { assets: ['USDT', 'USDC', 'BNB', 'BTCB', 'ETH'], protocols: ['Venus'], maxCapitalUsd: null, maxLeverage: 0, risk: null, actionRate: null, estimatedCostUsd: null },
  HealthSentinel: { assets: ['USDT', 'USDC', 'BNB', 'BTCB', 'ETH'], protocols: ['Venus'], maxCapitalUsd: null, maxLeverage: 0, risk: null, actionRate: null, estimatedCostUsd: null },
  HealthAmp: { assets: ['USDT', 'USDC', 'BNB', 'BTCB', 'ETH'], protocols: ['Venus'], maxCapitalUsd: null, maxLeverage: null, risk: null, actionRate: null, estimatedCostUsd: null },
}

const weeklyRate = (count: number, period: Period) => period === 'day' ? count * 7 : period === 'month' ? count / 4.345 : count

export function getAgentCapabilityProfile(agent: CatalogAgent): CapabilityProfile {
  // A provider can be registered from the onboarding flow before its
  // implementation-specific profile is indexed. Treat that state as
  // capability-unverified rather than crashing the matcher or inventing a
  // performance profile. The live endpoint still has to be run before hire.
  return profiles[agent.name] ?? {
    assets: ['BNB', 'USDT', 'USDC', 'BTCB', 'ETH'],
    protocols: ['PancakeSwap', 'Venus', 'Lista'],
    maxCapitalUsd: null,
    maxLeverage: null,
    risk: null,
    actionRate: null,
    estimatedCostUsd: null,
  }
}

export function matchAgents(category: CategoryConfig, draft: MandateDraft | null): MatchedAgent[] {
  if (!draft || draft.categoryId !== category.id) {
    return category.agents.map((agent) => ({ ...agent, matchReason: 'Using the category template until a mandate is saved.' }))
  }

  const capital = draft.constraints.capitalAmount
  const candidates = category.agents.map((agent) => {
    const profile = getAgentCapabilityProfile(agent)
    const violations: string[] = []
    if (profile.maxLeverage !== null && profile.maxLeverage > draft.constraints.leverageMax) violations.push(`${profile.maxLeverage}× leverage exceeds ${draft.constraints.leverageSpecified ? 'your cap' : 'the no-leverage safety default'}`)
    if (profile.risk !== null && riskRank[profile.risk] > riskRank[draft.constraints.riskMax]) violations.push(`${profile.risk} risk exceeds the ${draft.constraints.riskMax} risk cap`)
    if (capital !== null && profile.maxCapitalUsd !== null && capital > profile.maxCapitalUsd) violations.push(`${capital.toLocaleString()} ${draft.constraints.asset} exceeds the provider's ${profile.maxCapitalUsd.toLocaleString()} USD capacity`)
    if (draft.constraints.asset !== 'Any asset' && !profile.assets.includes(draft.constraints.asset)) violations.push(`${draft.constraints.asset} is outside the provider's supported assets`)
    if (draft.constraints.protocols.length && !draft.constraints.protocols.some((protocol) => profile.protocols.includes(protocol))) violations.push('none of the allowed protocols are supported by this provider')
    if (profile.actionRate && weeklyRate(profile.actionRate.count, profile.actionRate.period) > weeklyRate(draft.constraints.actionCap, draft.constraints.actionPeriod) + 0.0001) violations.push(`${profile.actionRate.count}/${profile.actionRate.period} declared activity exceeds the ${draft.constraints.actionCap}/${draft.constraints.actionPeriod} cap`)
    if (draft.constraints.spendCapUsd !== null && profile.estimatedCostUsd !== null && profile.estimatedCostUsd > draft.constraints.spendCapUsd) violations.push(`declared $${profile.estimatedCostUsd} execution cost exceeds the $${draft.constraints.spendCapUsd} spend cap`)
    const status = violations.length ? 'violates' as const : 'satisfies' as const
    // Fit is constraint compliance only. Performance, reliability and capital
    // history are not scored until a reviewer runs the live endpoint or opens
    // a wallet-funded receipt.
    const fit = Math.max(0, Math.round(((7 - Math.min(7, violations.length)) / 7) * 100))
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
      matchReason: violations.length ? `Excluded: ${violations.join('; ')}.` : `7/7 encoded constraint checks passed${appliedDefaults.length ? ` (${appliedDefaults.join('; ')})` : ''}. Performance is not inferred.`,
    }
  })

  return candidates.toSorted((left, right) => {
    if (left.status !== right.status) return left.status === 'satisfies' ? -1 : 1
    if (Boolean(left.providerAddress) !== Boolean(right.providerAddress)) return left.providerAddress ? -1 : 1
    return right.fit - left.fit
  })
}
