'use client'

import Link from 'next/link'
import { Receipt, ShoppingCart } from 'lucide-react'
import { useRecentActivity } from '@/lib/queries/dashboard'
import { relativeDate } from '@/lib/format'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { Money } from '@/components/shared/money'
import { StatusBadge } from '@/components/shared/badges'

export function RecentActivity() {
  const { data, isLoading } = useRecentActivity()

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-[var(--muted-foreground)]" />
            Latest purchases
          </CardTitle>
        </CardHeader>
        {isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : !data?.purchases.length ? (
          <EmptyState title="No purchases yet" description="Your first purchase will show here." />
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {data.purchases.map((p) => (
              <Link
                key={p.id}
                href={`/purchases/${p.id}`}
                className="flex items-center gap-3 px-4 py-2 hover:bg-[var(--accent)]"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{p.supplier?.name ?? 'Unknown supplier'}</div>
                  <div className="num text-xs text-[var(--muted-foreground)]">
                    {p.invoice_no ?? '—'} · {relativeDate(p.purchase_date)}
                  </div>
                </div>
                {p.status !== 'received' && <StatusBadge status={p.status} />}
                <Money value={p.total} dp={0} className="text-sm font-medium" />
              </Link>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-[var(--muted-foreground)]" />
            Latest sales
          </CardTitle>
        </CardHeader>
        {isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : !data?.sales.length ? (
          <EmptyState title="No sales yet" description="Your first sale will show here." />
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {data.sales.map((s) => (
              <Link
                key={s.id}
                href={`/sales/${s.id}`}
                className="flex items-center gap-3 px-4 py-2 hover:bg-[var(--accent)]"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{s.customer?.name ?? 'Unknown customer'}</div>
                  <div className="num text-xs text-[var(--muted-foreground)]">
                    {s.invoice_no ?? '—'} · {relativeDate(s.sale_date)}
                  </div>
                </div>
                {s.status !== 'confirmed' && <StatusBadge status={s.status} />}
                <div className="text-right">
                  <Money value={s.total} dp={0} className="block text-sm font-medium" />
                  <span className="block text-xs text-[var(--muted-foreground)]">
                    profit <Money value={s.profit_total} dp={0} signed /></span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
