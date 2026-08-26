export const CURRENCY = 'PKR'
export const LOCALE = 'en-PK'
export const TIMEZONE = 'Asia/Karachi'

export const MATERIAL_CATEGORIES = [
  { value: 'pigment', label: 'Pigment' },
  { value: 'resin', label: 'Resin' },
  { value: 'solvent', label: 'Solvent' },
  { value: 'additive', label: 'Additive' },
  { value: 'other', label: 'Other' },
] as const

export const INK_TYPES = [
  { value: 'offset', label: 'Offset' },
  { value: 'flexo', label: 'Flexo' },
  { value: 'gravure', label: 'Gravure' },
  { value: 'screen', label: 'Screen' },
  { value: 'other', label: 'Other' },
] as const

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank transfer' },
  { value: 'cheque', label: 'Cheque' },
] as const

export const MOVEMENT_LABELS: Record<string, string> = {
  purchase: 'Purchase',
  production_in: 'Produced',
  production_out: 'Consumed',
  sale: 'Sale',
  adjustment: 'Adjustment',
  return: 'Reversal',
}

/** Swatch fallbacks when an ink has no colour set. */
export const DEFAULT_INK_COLOR = '#71717a'

export const PERIOD_PRESETS = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'month', label: 'This month' },
  { value: 'year', label: 'This year' },
  { value: 'custom', label: 'Custom' },
] as const

export type PeriodPreset = (typeof PERIOD_PRESETS)[number]['value']
