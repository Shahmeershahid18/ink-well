import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { DEFAULT_INK_COLOR } from '@/lib/constants'
import { num } from '@/lib/format'

/** Red out of stock · amber below reorder · zinc healthy. */
export function StockBadge({
  stockKg,
  reorderKg,
  className,
}: {
  stockKg: unknown
  reorderKg: unknown
  className?: string
}) {
  const stock = num(stockKg)
  const reorder = num(reorderKg)
  if (stock <= 0) return <Badge variant="danger" className={className}>Out of stock</Badge>
  if (reorder > 0 && stock <= reorder)
    return <Badge variant="warn" className={className}>Low</Badge>
  return <Badge variant="outline" className={className}>OK</Badge>
}

/** Ranks rows so low stock can be sorted to the top. */
export function stockRank(stockKg: unknown, reorderKg: unknown): number {
  const stock = num(stockKg)
  const reorder = num(reorderKg)
  if (stock <= 0) return 0
  if (reorder > 0 && stock <= reorder) return 1
  return 2
}

const STATUS_VARIANT: Record<string, 'ok' | 'warn' | 'danger' | 'outline' | 'default'> = {
  received: 'ok',
  confirmed: 'ok',
  completed: 'ok',
  draft: 'warn',
  cancelled: 'danger',
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant={STATUS_VARIANT[status] ?? 'outline'} className={cn('capitalize', className)}>
      {status}
    </Badge>
  )
}

export function PaymentBadge({
  total,
  paid,
  className,
}: {
  total: unknown
  paid: unknown
  className?: string
}) {
  const t = num(total)
  const p = num(paid)
  if (p <= 0 && t > 0) return <Badge variant="danger" className={className}>Unpaid</Badge>
  if (p + 0.005 < t) return <Badge variant="warn" className={className}>Part paid</Badge>
  return <Badge variant="ok" className={className}>Paid</Badge>
}

export function InkSwatch({
  color,
  size = 12,
  className,
}: {
  color?: string | null
  size?: number
  className?: string
}) {
  return (
    <span
      className={cn('inline-block shrink-0 rounded-full border border-[var(--border)]', className)}
      style={{ width: size, height: size, background: color || DEFAULT_INK_COLOR }}
    />
  )
}

export function InkName({
  name,
  color,
  code,
}: {
  name: string
  color?: string | null
  code?: string | null
}) {
  return (
    <span className="flex items-center gap-2">
      <InkSwatch color={color} />
      <span className="truncate font-medium">{name}</span>
      {code && <span className="text-xs text-[var(--muted-foreground)]">{code}</span>}
    </span>
  )
}
