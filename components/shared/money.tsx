import { cn } from '@/lib/utils'
import { formatKg, formatMoney, formatMoneyCompact, formatPct, formatRate, num } from '@/lib/format'

interface MoneyProps {
  value: unknown
  /** 0 dp on cards, 2 dp in tables, 4 dp when a cost/kg needs its full precision. */
  dp?: 0 | 2 | 4
  compact?: boolean
  /** Green when positive, red when negative — for profit columns only. */
  signed?: boolean
  className?: string
  prefix?: string
}

export function Money({ value, dp = 2, compact, signed, className, prefix }: MoneyProps) {
  const n = num(value)
  return (
    <span
      className={cn(
        'num',
        signed && n > 0 && 'text-[var(--ok)]',
        signed && n < 0 && 'text-[var(--danger)]',
        className,
      )}
    >
      {prefix}
      {compact ? formatMoneyCompact(n) : formatMoney(n, dp)}
    </span>
  )
}

export function Rate({ value, dp = 2, className }: { value: unknown; dp?: number; className?: string }) {
  return <span className={cn('num', className)}>{formatRate(value, dp)}</span>
}

export function Weight({
  value,
  unit = 'kg',
  showUnit = true,
  className,
}: {
  value: unknown
  unit?: string
  showUnit?: boolean
  className?: string
}) {
  return (
    <span className={cn('num', className)}>
      {formatKg(value)}
      {showUnit && <span className="ml-0.5 text-[var(--muted-foreground)]">{unit}</span>}
    </span>
  )
}

export function Percent({
  value,
  dp = 1,
  signed,
  className,
}: {
  value: unknown
  dp?: number
  signed?: boolean
  className?: string
}) {
  const n = num(value)
  return (
    <span
      className={cn(
        'num',
        signed && n > 0 && 'text-[var(--ok)]',
        signed && n < 0 && 'text-[var(--danger)]',
        className,
      )}
    >
      {formatPct(n, dp)}
    </span>
  )
}
