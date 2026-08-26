'use client'

import { Beaker, Factory, Package, Truck, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useReveal } from '@/hooks/use-reveal'

const NODES = [
  { icon: Truck, label: 'Supplier', note: 'invoice + freight' },
  { icon: Package, label: 'Raw material', note: 'weighted average cost' },
  { icon: Factory, label: 'Production', note: 'batch, real yield' },
  { icon: Beaker, label: 'Ink', note: 'cost per kg' },
  { icon: Users, label: 'Customer', note: 'profit, locked in' },
] as const

/**
 * The whole system in one line. Built from flex + CSS rather than a fixed-viewBox
 * SVG so it turns into a vertical column on a phone without a second drawing.
 *
 * It owns its own reveal observer, so it is never left invisible when dropped into
 * a page that does not run one.
 */
export function FlowDiagram({
  className,
  /** 'row' goes horizontal from the sm breakpoint; 'column' stays stacked. */
  orientation = 'row',
}: {
  className?: string
  orientation?: 'row' | 'column'
}) {
  const ref = useReveal<HTMLDivElement>()
  const horizontal = orientation === 'row'

  return (
    <div
      ref={ref}
      className={cn(
        'flex flex-col items-stretch gap-0',
        horizontal && 'sm:flex-row sm:items-start',
        className,
      )}
      role="img"
      aria-label="Material flows from supplier to raw material stock, through production into ink stock, and out to the customer. Cost follows it at every step."
    >
      {NODES.map((node, i) => {
        const Icon = node.icon
        return (
          <div
            key={node.label}
            className={cn('flex flex-col', horizontal && 'flex-1 sm:flex-row sm:items-start')}
          >
            {/* node */}
            <div
              className={cn(
                'reveal flex flex-row items-center gap-3',
                horizontal && 'flex-1 sm:flex-col sm:gap-2 sm:text-center',
              )}
              style={{ ['--reveal-delay' as string]: `${i * 110}ms` }}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
                <Icon
                  className="h-5 w-5"
                  style={{ color: i === NODES.length - 1 ? 'var(--ok)' : 'var(--brand-to)' }}
                />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{node.label}</span>
                <span className="block text-xs text-[var(--muted-foreground)]">{node.note}</span>
              </span>
            </div>

            {/* connector */}
            {i < NODES.length - 1 && (
              <div
                className={cn(
                  'reveal ml-[22px] flex h-7 w-px items-center justify-center',
                  horizontal && 'sm:ml-0 sm:mt-[22px] sm:h-px sm:w-full sm:flex-1',
                )}
                style={{ ['--reveal-delay' as string]: `${i * 110 + 60}ms` }}
                aria-hidden="true"
              >
                <svg className="h-full w-full overflow-visible" preserveAspectRatio="none">
                  <line
                    x1="0.5"
                    y1="0"
                    x2="0.5"
                    y2="100%"
                    stroke="var(--brand-to)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    className={cn('animate-flow', horizontal && 'sm:hidden')}
                    opacity="0.55"
                  />
                  {horizontal && (
                    <line
                      x1="0"
                      y1="0.5"
                      x2="100%"
                      y2="0.5"
                      stroke="var(--brand-to)"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      className="hidden animate-flow sm:block"
                      opacity="0.55"
                    />
                  )}
                </svg>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
