'use client'

import Link from 'next/link'
import { useInkProfitability } from '@/lib/queries/inks'
import { num } from '@/lib/format'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { InkSwatch } from '@/components/shared/badges'
import { Money, Percent, Weight } from '@/components/shared/money'

export function TopInks() {
  const { data, isLoading } = useInkProfitability()

  const rows = (data ?? []).filter((i) => num(i.sold_kg) > 0).slice(0, 6)
  const best = rows[0] ? Math.abs(num(rows[0].profit)) : 0

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle>Top inks by profit</CardTitle>
        <p className="text-xs text-[var(--muted-foreground)]">All time, confirmed sales only.</p>
      </CardHeader>

      <div className="flex-1">
        {isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No ink has sold yet"
            description="Once you record a sale, the inks that actually make you money show up here."
          />
        ) : (
          <div className="space-y-2.5 px-4 pb-4">
            {rows.map((ink) => {
              const profit = num(ink.profit)
              const width = best > 0 ? (Math.abs(profit) / best) * 100 : 0
              return (
                <Link
                  key={ink.id}
                  href={`/inks/${ink.id}`}
                  className="block rounded-md p-1.5 transition-colors hover:bg-[var(--accent)]"
                >
                  <div className="flex items-center gap-2">
                    <InkSwatch color={ink.color_hex} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{ink.name}</span>
                    <Money value={profit} dp={0} signed className="text-sm font-medium" />
                  </div>
                  <div className="mt-1 flex items-center gap-2 pl-5">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--muted)]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${width}%`,
                          background:
                            profit < 0 ? 'var(--danger)' : 'var(--chart-profit)',
                        }}
                      />
                    </div>
                    <span className="num shrink-0 text-xs text-[var(--muted-foreground)]">
                      <Weight value={ink.sold_kg} /> · <Percent value={ink.margin_pct} />
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </Card>
  )
}
