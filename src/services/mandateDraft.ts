import { categories, type CategoryId } from '../catalog'

export const MANDATE_DRAFT_KEY = 'mandate:active-draft:v1'

export type ParsedField = { label: string; value: string; support?: string }

export type MandateDraft = {
  prompt: string
  categoryId: CategoryId
  fields: ParsedField[]
  summary: string[]
  constraints: {
    capitalAmount: number | null
    asset: string
    riskMax: 'low' | 'medium' | 'high'
    riskSpecified: boolean
    leverageMax: number
    leverageSpecified: boolean
    actionCap: number
    actionPeriod: 'day' | 'week' | 'month'
    actionCapSpecified: boolean
    protocols: string[]
  }
  updatedAt: string
}

export type EditableMandateField = 'Goal' | 'Capital' | 'Risk' | 'Leverage' | 'Max actions' | 'Allowed protocols'

const supportedProtocols = ['PancakeSwap', 'Venus', 'Lista', 'Aster'] as const

const numberWords: Record<string, number> = {
  one: 1, once: 1, two: 2, twice: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12,
}

function count(value: string | undefined): number | undefined {
  if (!value) return undefined
  return /^\d+$/.test(value) ? Number(value) : numberWords[value.toLowerCase()]
}

function inferCategory(prompt: string, fallback: CategoryId): CategoryId {
  const text = prompt.toLowerCase()
  const scores: Record<CategoryId, number> = {
    rebalancing: ['liquidity', ' lp ', 'position in range', 'rebalance', 'impermanent'].filter((term) => text.includes(term)).length,
    grid: ['grid', 'orders per', 'drawdown', 'ranging market', 'trading'].filter((term) => text.includes(term)).length,
    yield: ['yield', 'earn on', 'apy', 'supply', 'deposit'].filter((term) => text.includes(term)).length,
    health: ['health factor', 'liquidation', 'repay', 'collateral', 'borrow'].filter((term) => text.includes(term)).length,
  }
  const best = (Object.entries(scores) as Array<[CategoryId, number]>).sort((left, right) => right[1] - left[1])[0]
  return best[1] > 0 ? best[0] : fallback
}

function extractCapital(prompt: string): { amount: string; numericAmount: number | null; asset: string } {
  const assetAmount = prompt.match(/(?:[$€£]\s*)?([\d,.]+)\s*(USDT|USDC|BNB|USD|ETH|BTCB|BTC)\b/i)
  const currencyAmount = prompt.match(/([$€£])\s*([\d,.]+)/)
  const amount = (assetAmount?.[1] ?? currencyAmount?.[2])?.replace(/,$/, '') ?? 'Not specified'
  const currencyAsset = currencyAmount?.[1] === '€' ? 'EUR' : currencyAmount?.[1] === '£' ? 'GBP' : 'USD'
  const asset = assetAmount?.[2]?.toUpperCase() ?? (currencyAmount ? currencyAsset : (prompt.match(/\b(USDT|USDC|BNB|ETH|BTCB|BTC)\b/i)?.[1]?.toUpperCase() ?? 'Any asset'))
  const numericAmount = amount === 'Not specified' ? null : Number(amount.replace(/,/g, ''))
  return { amount, numericAmount: Number.isFinite(numericAmount) ? numericAmount : null, asset }
}

function extractRisk(prompt: string): { label: string; level: 'low' | 'medium' | 'high'; specified: boolean } {
  const text = prompt.toLowerCase()
  const healthFactor = prompt.match(/health factor\D{0,18}(\d+(?:\.\d+)?)/i)
  if (healthFactor) return { label: `Health factor ≥ ${healthFactor[1]}`, level: 'low', specified: true }
  if (/low risk|conservative/.test(text)) return { label: 'Low / conservative', level: 'low', specified: true }
  if (/medium risk|moderate risk/.test(text)) return { label: 'Medium or lower', level: 'medium', specified: true }
  if (/high risk|aggressive/.test(text)) return { label: 'High', level: 'high', specified: true }
  const drawdown = prompt.match(/drawdown\D{0,18}(\d+(?:\.\d+)?)\s*%/i)
  return drawdown
    ? { label: `Drawdown ≤ ${drawdown[1]}%`, level: Number(drawdown[1]) <= 5 ? 'medium' : 'high', specified: true }
    : { label: 'Medium (safety default)', level: 'medium', specified: false }
}

function extractLeverage(prompt: string): { label: string; max: number; specified: boolean } {
  if (/no leverage|without leverage|never leverage/i.test(prompt)) return { label: 'None (1×)', max: 0, specified: true }
  const leverage = prompt.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(?:leverage)?/i)
  return leverage
    ? { label: `Up to ${leverage[1]}×`, max: Number(leverage[1]), specified: true }
    : { label: 'None (safety default)', max: 0, specified: false }
}

function extractFrequency(prompt: string, categoryId: CategoryId): { label: string; cap: number; period: 'day' | 'week' | 'month'; specified: boolean } {
  const match = prompt.match(/(?:no more than|at most|max(?:imum)?(?: of)?)\s*(once|twice|one|two|three|four|five|six|seven|eight|nine|ten|twelve|\d+)\s*(?:times?|actions?|orders?|moves?|rebalances?)?\s*(?:a|per|\/)?\s*(day|week|month)/i)
    ?? prompt.match(/(once|twice|one|two|three|four|five|six|seven|eight|nine|ten|twelve|\d+)\s*(?:actions?|orders?|moves?|rebalances?)\s*(?:a|per|\/)\s*(day|week|month)/i)
  const amount = count(match?.[1])
  if (amount && match) return { label: `${amount} per ${match[2].toLowerCase()}`, cap: amount, period: match[2].toLowerCase() as 'day' | 'week' | 'month', specified: true }
  const defaults: Record<CategoryId, { cap: number; period: 'day' | 'week' }> = {
    rebalancing: { cap: 2, period: 'day' }, grid: { cap: 12, period: 'day' },
    yield: { cap: 2, period: 'week' }, health: { cap: 2, period: 'week' },
  }
  const fallback = defaults[categoryId]
  return { label: `${fallback.cap} per ${fallback.period} (safety default)`, ...fallback, specified: false }
}

function extractProtocols(prompt: string): string {
  const protocols = supportedProtocols.filter((name) => new RegExp(name, 'i').test(prompt))
  return protocols.length ? protocols.join(', ') : 'No protocol specified'
}

function canonicalPrompt(input: {
  goal: string
  capitalAmount: number | null
  asset: string
  risk: 'low' | 'medium' | 'high'
  leverage: number
  actionCap: number
  actionPeriod: 'day' | 'week' | 'month'
  protocols: string[]
}) {
  const capital = input.capitalAmount === null ? 'Capital not specified' : `Capital ${input.capitalAmount} ${input.asset}`
  const risk = `${input.risk[0].toUpperCase()}${input.risk.slice(1)} risk`
  const leverage = input.leverage === 0 ? 'No leverage' : `${input.leverage}x leverage`
  const protocols = input.protocols.length ? `Allowed protocols: ${input.protocols.join(', ')}` : 'No protocol specified'
  return `${input.goal}. ${capital}. ${risk}. ${leverage}. Max ${input.actionCap} actions per ${input.actionPeriod}. ${protocols}.`
}

export function editMandateField(draft: MandateDraft, label: EditableMandateField, rawValue: string): string {
  const value = rawValue.trim()
  if (!value) throw new Error(`${label} cannot be empty.`)
  const next = {
    goal: draft.fields[0].value,
    capitalAmount: draft.constraints.capitalAmount,
    asset: draft.constraints.asset,
    risk: draft.constraints.riskMax,
    leverage: draft.constraints.leverageMax,
    actionCap: draft.constraints.actionCap,
    actionPeriod: draft.constraints.actionPeriod,
    protocols: [...draft.constraints.protocols],
  }

  if (label === 'Goal') {
    next.goal = value.replace(/[.!?]+$/, '')
  } else if (label === 'Capital') {
    const match = value.match(/^([\d,.]+)\s*(USDT|USDC|BNB|USD|ETH|BTCB|BTC)$/i)
    if (!match) throw new Error('Use a value such as 5000 USDT.')
    const amount = Number(match[1].replace(/,/g, ''))
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Capital must be greater than zero.')
    if (next.capitalAmount !== null) {
      const previousCapital = new RegExp(`${String(next.capitalAmount).replace('.', '\\.')}\\s*${next.asset}`, 'i')
      next.goal = next.goal.replace(previousCapital, `${amount} ${match[2].toUpperCase()}`)
    }
    next.capitalAmount = amount
    next.asset = match[2].toUpperCase()
  } else if (label === 'Risk') {
    const normalized = value.toLowerCase()
    if (!['low', 'medium', 'high'].includes(normalized)) throw new Error('Choose low, medium, or high.')
    next.risk = normalized as 'low' | 'medium' | 'high'
  } else if (label === 'Leverage') {
    if (/^(none|no|0|1x)$/i.test(value)) next.leverage = 0
    else {
      const amount = Number(value.replace(/x|×|leverage/gi, '').trim())
      if (!Number.isFinite(amount) || amount <= 1 || amount > 20) throw new Error('Use none or a leverage value from 2x to 20x.')
      next.leverage = amount
    }
  } else if (label === 'Max actions') {
    const match = value.match(/^(\d+)\s*(?:actions?\s*)?(?:per|\/|a)\s*(day|week|month)$/i)
    if (!match) throw new Error('Use a value such as 2 per week.')
    const amount = Number(match[1])
    if (amount < 1 || amount > 100) throw new Error('Action limit must be between 1 and 100.')
    next.actionCap = amount
    next.actionPeriod = match[2].toLowerCase() as 'day' | 'week' | 'month'
  } else {
    if (/^(none|any|no protocol specified)$/i.test(value)) next.protocols = []
    else {
      const requested = value.split(',').map((item) => item.trim()).filter(Boolean)
      const matched = supportedProtocols.filter((protocol) => requested.some((item) => item.toLowerCase() === protocol.toLowerCase()))
      if (matched.length !== requested.length) throw new Error(`Supported: ${supportedProtocols.join(', ')}.`)
      next.protocols = matched
    }
  }

  return canonicalPrompt(next)
}

function outcome(prompt: string, categoryId: CategoryId): string {
  const firstSentence = prompt.trim().split(/[!?\n]|\.(?:\s+|$)/)[0]?.trim()
  return firstSentence && firstSentence.length <= 72 ? firstSentence : categories[categoryId].label
}

export function parseMandate(prompt: string, fallback: CategoryId): MandateDraft {
  const categoryId = inferCategory(` ${prompt} `, fallback)
  const capital = extractCapital(prompt)
  const risk = extractRisk(prompt)
  const leverage = extractLeverage(prompt)
  const frequency = extractFrequency(prompt, categoryId)
  const protocols = extractProtocols(prompt)
  const fields: ParsedField[] = [
    { label: 'Goal', value: outcome(prompt, categoryId) },
    { label: 'Capital', value: capital.amount === 'Not specified' ? capital.amount : `${capital.amount} ${capital.asset}` },
    { label: 'Risk', value: risk.label, support: risk.specified ? 'Parsed limit' : 'Safety default' },
    { label: 'Leverage', value: leverage.label },
    { label: 'Max actions', value: frequency.label },
    { label: 'Allowed protocols', value: protocols },
  ]
  return {
    prompt: prompt.trim(),
    categoryId,
    fields,
    summary: [
      outcome(prompt, categoryId),
      capital.amount === 'Not specified' ? capital.asset : `${capital.amount} ${capital.asset}`,
      risk.label,
      frequency.label,
    ],
    constraints: {
      capitalAmount: capital.numericAmount,
      asset: capital.asset,
      riskMax: risk.level,
      riskSpecified: risk.specified,
      leverageMax: leverage.max,
      leverageSpecified: leverage.specified,
      actionCap: frequency.cap,
      actionPeriod: frequency.period,
      actionCapSpecified: frequency.specified,
      protocols: protocols === 'No protocol specified' ? [] : protocols.split(', '),
    },
    updatedAt: new Date().toISOString(),
  }
}

export function saveMandateDraft(draft: MandateDraft) {
  window.localStorage.setItem(MANDATE_DRAFT_KEY, JSON.stringify(draft))
}

export function loadMandateDraft(): MandateDraft | null {
  try {
    const raw = window.localStorage.getItem(MANDATE_DRAFT_KEY)
    if (!raw) return null
    const saved = JSON.parse(raw) as MandateDraft
    return parseMandate(saved.prompt, saved.categoryId)
  } catch {
    return null
  }
}
