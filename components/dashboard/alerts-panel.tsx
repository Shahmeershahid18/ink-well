'use client'

import Link from 'next/link'
import { CircleCheck, PackageX, ShoppingCart, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatKg, num } from '@/lib/format'
import { useLowStock } from '@/lib/queries/dashboard'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { Money } from '@/components/shared/money'

export function AlertsPanel() {
  const { data: lowStock, isLoading } = useLowStock()

  const rows = [...(lowStock ?? [])].sort((a, b) => {
    if (a.level !== b.level) return a.level === 'critical' ? -1 : 1
    return num(a.current_stock_kg) - num(b.current_stock_kg)
  })

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          Stock alerts
          {rows.length > 0 && (
            <span className="num rounded-full bg-[var(--danger-soft)] px-1.5 text-xs text-[var(--danger)]">
              {rows.length}
            </span>
          )}
        </CardTitle>
        <p className="text-xs text-[var(--muted-foreground)]">
          Anything at or below its reorder level, worst first.
        </p>
      </CardHeader>

      <div className="flex-1">
        {isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<CircleCheck className="text-[var(--ok)]" />}
            title="All stock levels are healthy."
            description="Nothing is at or below its reorder level right now."
          />
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {rows.map((row) => (
              <div key={`${row.item_type}-${row.id}`} className="flex items-center gap-3 px-4 py-2.5">
                <span
                  className={cn(
                    'shrink-0',
                    row.level === 'critical' ? 'text-[var(--danger)]' : 'text-[var(--warn)]',
                  )}
                >
                  {row.level === 'critical' ? (
                    <PackageX className="h-4 w-4" />
                  ) : (
                    <TriangleAlert className="h-4 w-4" />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <Link
                    href={row.item_type === 'raw' ? `/raw-materials/${row.id}` : `/inks/${row.id}`}
                    className="block truncate text-sm font-medium hover:underline"
                  >
                    {row.name}
                  </Link>
                  <div className="num text-xs text-[var(--muted-foreground)]">
                    {formatKg(row.current_stock_kg)} kg left · reorder at{' '}
                    {formatKg(row.reorder_level_kg)} kg ·{' '}
                    <Money value={row.stock_value} dp={0} /> in stock
                  </div>
                </div>

                {row.item_type === 'raw' ? (
                  <Button size="sm" variant="outline" asChild className="shrink-0">
                    <Link
                      href={`/purchases/new?material=${row.id}${
                        row.default_supplier_id ? `&supplier=${row.default_supplier_id}` : ''
                      }`}
                    >
                      <ShoppingCart className="h-3.5 w-3.5" />
                      Order
                    </Link>
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" asChild className="shrink-0">
                    <Link href={`/production/new?ink=${row.id}`}>Produce</Link>
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}
