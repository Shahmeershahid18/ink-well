import * as React from 'react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface StatCardProps {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  /** Percent change vs the previous equal-length period. null hides the pill. */
  change?: number | null
  /** For costs, a rise is not good news. */
  invertChange?: boolean
  icon?: React.ReactNode
  loading?: boolean
  className?: string
}

export function StatCard({
  label,
  value,
  sub,
  change,
  invertChange,
  icon,
  loading,
  className,
}: StatCardProps) {
  const good = change == null ? null : invertChange ? change < 0 : change > 0

  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-[var(--muted-foreground)]">{label}</span>
        {icon && <span className="text-[var(--muted-foreground)]">{icon}</span>}
      </div>

      {loading ? (
        <Skeleton className="mt-2 h-7 w-28" />
      ) : (
        <div className="num mt-1.5 text-2xl font-semibold tracking-tight">{value}</div>
      )}

      <div className="mt-1.5 flex items-center gap-2 text-xs">
        {change != null && Number.isFinite(change) && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium',
              good ? 'bg-[var(--ok-soft)] text-[var(--ok)]' : 'bg-[var(--danger-soft)] text-[var(--danger)]',
            )}
          >
            {change > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(change).toFixed(0)}%
          </span>
        )}
        {loading ? (
          <Skeleton className="h-3 w-32" />
        ) : (
          sub && <span className="truncate text-[var(--muted-foreground)]">{sub}</span>
        )}
      </div>
    </Card>
  )
}
