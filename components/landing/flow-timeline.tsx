'use client'

import { Beaker, Factory, Package, Truck, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useReveal } from '@/hooks/use-reveal'

const STEPS = [
  { icon: Truck, label: 'Supplier', note: 'invoice + freight' },
  { icon: Package, label: 'Raw material', note: 'weighted average cost' },
  { icon: Factory, label: 'Production', note: 'batch, real yield' },
  { icon: Beaker, label: 'Ink', note: 'cost per kg' },
  { icon: Users, label: 'Customer', note: 'profit, locked in' },
] as const

/**
 * The vertical form of the flow, for a tall narrow column. Each row spans the full
 * width — label left, note right — so the block reads as a designed list rather
 * than a short stack marooned in a wide box. One continuous line runs behind the
 * chips instead of separate dashes between them.
 */
export function FlowTimeline({ className }: { className?: string }) {
  const ref = useReveal<HTMLOListElement>()

  return (
    <ol
      ref={ref}
      className={cn('relative flex flex-col', className)}
      aria-label="How material and cost move through the system"
    >
      {/* the thread, from the first chip's centre to the last */}
      <span
        aria-hidden
        className="absolute left-[19px] top-[30px] bottom-[30px] w-px"
        style={{
          background:
            'linear-gradient(to bottom, transparent, var(--brand-to), var(--brand-to), transparent)',
          opacity: 0.45,
        }}
      />

      {STEPS.map((step, i) => {
        const Icon = step.icon
        const isLast = i === STEPS.length - 1
        return (
          <li
            key={step.label}
            className="reveal relative flex items-center gap-3.5 py-2.5"
            style={{ ['--reveal-delay' as string]: `${i * 90}ms` }}
          >
            <span
              className={cn(
                'relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-[var(--card)]',
                isLast ? 'border-[var(--ok)]/40' : 'border-[var(--border)]',
              )}
            >
              <Icon
                className="h-4 w-4"
                style={{ color: isLast ? 'var(--ok)' : 'var(--brand-to)' }}
              />
            </span>

            <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-sm font-medium">{step.label}</span>
              <span className="truncate text-xs text-[var(--muted-foreground)]">{step.note}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}
