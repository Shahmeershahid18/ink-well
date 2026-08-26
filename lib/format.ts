import { LOCALE } from './constants'

/** Postgres numerics arrive as strings often enough to be worth one guard everywhere. */
export function num(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === '') return fallback
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}

const moneyFmt = (dp: number) =>
  new Intl.NumberFormat(LOCALE, { minimumFractionDigits: dp, maximumFractionDigits: dp })

/** Money for tables (2 dp) and cards (0 dp). Rounding happens here and nowhere else. */
export function formatMoney(value: unknown, dp: 0 | 2 | 4 = 2): string {
  return moneyFmt(dp).format(num(value))
}

/** Compact money for KPI cards and chart axes: 1.2M, 340K, 60K. */
export function formatMoneyCompact(value: unknown): string {
  const n = num(value)
  const abs = Math.abs(n)
  // A trailing ".0" makes an axis read as 60.0K beside 240K — drop it.
  const trim = (s: string) => (s.endsWith('.0') ? s.slice(0, -2) : s)
  if (abs >= 1_000_000) return `${trim((n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1))}M`
  if (abs >= 10_000) return `${trim((n / 1_000).toFixed(abs >= 100_000 ? 0 : 1))}K`
  return formatMoney(n, 0)
}

/** Weight in kg, 3 dp with trailing zeros trimmed: 12.5 not 12.500 */
export function formatKg(value: unknown, dp = 3): string {
  const n = num(value)
  const s = new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: dp,
  }).format(n)
  return s
}

export function formatPct(value: unknown, dp = 1): string {
  return `${num(value).toFixed(dp)}%`
}

/** Cost per kg keeps 4 dp internally; show 2 unless asked. */
export function formatRate(value: unknown, dp = 2): string {
  return moneyFmt(dp).format(num(value))
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function toDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  const s = String(value)
  // date-only strings must not be shifted by the browser timezone
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

/** dd MMM yyyy — the plan's house format. */
export function formatDate(value: unknown): string {
  const d = toDate(value)
  if (!d) return '—'
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function formatDateTime(value: unknown): string {
  const d = toDate(value)
  if (!d) return '—'
  const h = d.getHours()
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${formatDate(d)}, ${h12}:${String(d.getMinutes()).padStart(2, '0')}${ampm}`
}

export function formatMonth(value: unknown): string {
  const d = toDate(value)
  if (!d) return '—'
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/** yyyy-MM-dd in local time — what the API and <input type="date"> both want. */
export function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function today(): string {
  return toDateInput(new Date())
}

export function addDays(d: Date, days: number): Date {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + days)
  return copy
}

/** "3 days ago" for activity feeds. */
export function relativeDate(value: unknown): string {
  const d = toDate(value)
  if (!d) return '—'
  const days = Math.round((Date.now() - d.getTime()) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days} days ago`
  if (days < 365) return `${Math.round(days / 30)} months ago`
  return `${Math.round(days / 365)} years ago`
}

/** Percent change vs a previous period, guarding the divide-by-zero case. */
export function pctChange(current: number, previous: number): number | null {
  if (!previous) return current ? null : 0
  return ((current - previous) / Math.abs(previous)) * 100
}
