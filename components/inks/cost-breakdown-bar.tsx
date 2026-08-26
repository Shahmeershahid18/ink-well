'use client'

import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/format'
import { costBarSegments, type InkCostResult } from '@/lib/calc/formula'
import { Money, Percent, Rate } from '@/components/shared/money'

/**
 * The screen you stare at when pricing. Every segment carries a written label and
 * a number — the colour is identity, never the only cue.
 */
export function CostBreakdownBar({
  cost,
  className,
}: {
  cost: InkCostResult
  className?: string
}) {
  const segments = costBarSegments(cost)
  const perKgTotal = cost.pricePerKg > 0 ? cost.pricePerKg : cost.baseCostPerKg

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <div>
          <div className="text-xs text-[var(--muted-foreground)]">Base cost / kg</div>
          <div className="num text-xl font-semibold">
            <Rate value={cost.baseCostPerKg} />
          </div>
        </div>
        {cost.pricePerKg > 0 && (
          <>
            <div>
              <div className="text-xs text-[var(--muted-foreground)]">Selling price / kg</div>
              <div className="num text-xl font-semibold">
                <Rate value={cost.pricePerKg} />
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--muted-foreground)]">
                {cost.belowCost ? 'Loss' : 'Margin'}
              </div>
              <div className="text-xl font-semibold">
                <Percent value={cost.marginPct} signed />
                <span className="ml-1.5 text-xs font-normal text-[var(--muted-foreground)]">
                  <Money value={cost.marginPerKg} dp={0} signed />/kg
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 2px surface gaps between segments keep adjacent fills from bleeding together */}
      <div
        className="flex h-7 w-full overflow-hidden rounded-md"
        role="img"
        aria-label={`Cost breakdown per kg: ${segments
          .map((s) => `${s.label} ${formatMoney(s.value, 0)}`)
          .join(', ')}`}
      >
        {segments.map((seg, i) =>
          seg.pct <= 0 ? null : (
            <div
              key={seg.key}
              className="flex items-center justify-center overflow-hidden"
              style={{
                width: `${seg.pct}%`,
                background: seg.color,
                marginLeft: i === 0 ? 0 : 2,
              }}
              title={`${seg.label}: ${formatMoney(seg.value, 2)} / kg`}
            >
              {seg.pct > 12 && (
                <span className="num truncate px-1 text-[10px] font-medium text-white">
                  {formatMoney(seg.value, 0)}
                </span>
              )}
            </div>
          ),
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-5">
        {segments.map((seg) => (
          <div key={seg.key} className="flex items-baseline gap-1.5">
            <span
              className="h-2.5 w-2.5 shrink-0 translate-y-px rounded-sm"
              style={{ background: seg.color }}
              aria-hidden
            />
            <span className="min-w-0">
              <span className="block truncate text-xs text-[var(--muted-foreground)]">
                {seg.label}
              </span>
              <span className="num block text-sm font-medium">
                {formatMoney(seg.value, 2)}
                <span className="ml-1 text-[10px] font-normal text-[var(--muted-foreground)]">
                  {perKgTotal > 0 ? `${seg.pct.toFixed(0)}%` : ''}
                </span>
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
