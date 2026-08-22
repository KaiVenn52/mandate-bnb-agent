import type { CatalogAgent, CategoryConfig } from '../catalog'
import type { MandateDraft } from './mandateDraft'
import { getAgentCapabilityProfile } from './agentMatching'

export type MandateAuthorization = CategoryConfig['authorization'] & {
  source: 'parsed-mandate' | 'category-template'
}

const title = (value: string) => `${value[0].toUpperCase()}${value.slice(1)}`

export function authorizationFromMandate(
  category: CategoryConfig,
  agent: CatalogAgent,
  draft: MandateDraft | null,
): MandateAuthorization {
  if (!draft || draft.categoryId !== category.id) return { ...category.authorization, source: 'category-template' }

  const constraints = draft.constraints
  const profile = getAgentCapabilityProfile(agent)
  const protocols = constraints.protocols.length ? constraints.protocols : profile.protocols
  const capital = constraints.capitalAmount === null
    ? 'Not specified · analysis only'
    : `${constraints.capitalAmount.toLocaleString()} ${constraints.asset}`
  const leverage = constraints.leverageMax === 0 ? 'No leverage' : `Up to ${constraints.leverageMax}× leverage`
  const spend = constraints.spendCapUsd === null
    ? `${category.authorization.maxSpend} · safety default`
    : `$${constraints.spendCapUsd.toLocaleString()}${constraints.spendCapPeriod === 'total' ? ' total' : `/${constraints.spendCapPeriod}`}`
  const protocolLabel = `${protocols.join(' · ')}${constraints.protocols.length ? '' : ' · safety default'}`
  const capitalPermission = constraints.capitalAmount === null
    ? 'Produce analysis only until a capital ceiling is specified'
    : `Use no more than ${capital}`
  const spendPermission = constraints.spendCapUsd === null
    ? `Stay within the ${category.authorization.maxSpend} category safety default`
    : `Spend no more than ${spend}`

  return {
    source: 'parsed-mandate',
    goal: draft.fields[0].value,
    asset: constraints.asset === 'Any asset' ? category.authorization.asset : `${constraints.asset} only`,
    capital,
    maxSpend: spend,
    duration: category.authorization.duration,
    protocols: protocolLabel,
    actions: category.authorization.actions,
    expiry: category.authorization.expiry,
    may: [
      capitalPermission,
      `${category.authorization.actions} only on ${protocols.join(', ')}`,
      leverage,
      `Perform at most ${constraints.actionCap} actions per ${constraints.actionPeriod}`,
      spendPermission,
    ],
    mayNot: [
      constraints.capitalAmount === null ? 'Move capital without an explicit capital ceiling' : `Exceed the ${capital} capital ceiling`,
      constraints.leverageMax === 0 ? 'Borrow assets or add leverage' : `Exceed ${constraints.leverageMax}× leverage`,
      `Use any protocol outside ${protocols.join(', ')}`,
      `Exceed ${constraints.actionCap} actions per ${constraints.actionPeriod}`,
      constraints.spendCapUsd === null ? `Exceed the ${category.authorization.maxSpend} safety default` : `Exceed ${spend}`,
      `Operate above the ${title(constraints.riskMax)} risk ceiling`,
    ],
  }
}
