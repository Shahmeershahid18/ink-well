'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Download, Plus, ShoppingCart } from 'lucide-react'
import { usePurchases } from '@/lib/queries/purchases'
import { useSuppliers } from '@/lib/queries/parties'
import { formatDate, num, toDateInput, addDays } from '@/lib/format'
import { downloadCsv } from '@/lib/csv'
import type { PurchaseWithSupplier } from '@/types/database'
import { PageHeader } from '@/components/shared/page-header'
import { DataTable, type Column } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/empty-state'
import { Money } from '@/components/shared/money'
import { PaymentBadge, StatusBadge } from '@/components/shared/badges'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Combobox } from '@/components/ui/combobox'

export default function PurchasesPage() {
  const router = useRouter()
  const { data: suppliers } = useSuppliers()

  const [supplierId, setSupplierId] = React.useState<string | null>(null)
  const [from, setFrom] = React.useState(toDateInput(addDays(new Date(), -90)))
  const [to, setTo] = React.useState(toDateInput(new Date()))
  const [unpaidOnly, setUnpaidOnly] = React.useState(false)

  const { data: purchases, isLoading } = usePurchases({
    supplierId: supplierId ?? undefined,
    from,
    to,
    unpaidOnly,
  })

  const rows = purchases ?? []
  const totalSpend = rows
    .filter((r) => r.status === 'received')
    .reduce((s, r) => s + num(r.total), 0)
  const totalOwing = rows
    .filter((r) => r.status === 'received')
    .reduce((s, r) => s + num(r.total) - num(r.paid_amount), 0)

  const columns: Column<PurchaseWithSupplier>[] = [
    {
      key: 'purchase_date',
      header: 'Date',
      sortValue: (r) => r.purchase_date,
      cell: (r) => <span className="whitespace-nowrap">{formatDate(r.purchase_date)}</span>,
    },
    {
      key: 'invoice_no',
      header: 'Invoice',
      hideBelow: 'sm',
      sortValue: (r) => r.invoice_no ?? '',
      cell: (r) => <span className="num text-xs">{r.invoice_no ?? '—'}</span>,
    },
    {
      key: 'supplier',
      header: 'Supplier',
      sortValue: (r) => r.supplier?.name ?? '',
      cell: (r) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{r.supplier?.name ?? 'Unknown'}</div>
          {r.supplier?.company && (
            <div className="truncate text-xs text-[var(--muted-foreground)]">
              {r.supplier.company}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'items',
      header: 'Lines',
      numeric: true,
      hideBelow: 'lg',
      sortValue: (r) => r.purchase_items?.[0]?.count ?? 0,
      cell: (r) => r.purchase_items?.[0]?.count ?? 0,
    },
    {
      key: 'total',
      header: 'Total',
      numeric: true,
      sortValue: (r) => num(r.total),
      cell: (r) => <Money value={r.total} />,
    },
    {
      key: 'paid_amount',
      header: 'Paid',
      numeric: true,
      hideBelow: 'md',
      sortValue: (r) => num(r.paid_amount),
      cell: (r) => <Money value={r.paid_amount} />,
    },
    {
      key: 'balance',
      header: 'Balance',
      numeric: true,
      sortValue: (r) => num(r.total) - num(r.paid_amount),
      cell: (r) => {
        const balance = num(r.total) - num(r.paid_amount)
        return (
          <Money
            value={balance}
            className={balance > 0.005 ? 'text-[var(--warn)]' : undefined}
          />
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      align: 'right',
      cell: (r) => (
        <div className="flex justify-end gap-1.5">
          {r.status === 'received' && <PaymentBadge total={r.total} paid={r.paid_amount} />}
          <StatusBadge status={r.status} />
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Purchases"
        description={
          <>
            {rows.length} in range · spend <Money value={totalSpend} dp={0} className="font-medium text-[var(--foreground)]" />
            {totalOwing > 0.005 && (
              <>
                {' '}
                · owing{' '}
                <Money value={totalOwing} dp={0} className="font-medium text-[var(--warn)]" />
              </>
            )}
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              onClick={() =>
                downloadCsv(`purchases-${from}-to-${to}`, rows, [
                  { header: 'Date', value: (r) => r.purchase_date },
                  { header: 'Invoice', value: (r) => r.invoice_no },
                  { header: 'Supplier', value: (r) => r.supplier?.name },
                  { header: 'Subtotal', value: (r) => num(r.subtotal) },
                  { header: 'Freight', value: (r) => num(r.freight_cost) },
                  { header: 'Other', value: (r) => num(r.other_cost) },
                  { header: 'Discount', value: (r) => num(r.discount) },
                  { header: 'Total', value: (r) => num(r.total) },
                  { header: 'Paid', value: (r) => num(r.paid_amount) },
                  { header: 'Balance', value: (r) => num(r.total) - num(r.paid_amount) },
                  { header: 'Status', value: (r) => r.status },
                ])
              }
            >
              <Download className="h-4 w-4" />
              CSV
            </Button>
            <Button asChild>
              <Link href="/purchases/new">
                <Plus className="h-4 w-4" />
                New purchase
              </Link>
            </Button>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="w-56 space-y-1.5">
          <Label>Supplier</Label>
          <Combobox
            options={[
              { value: '', label: 'All suppliers' },
              ...(suppliers ?? []).map((s) => ({ value: s.id, label: s.name })),
            ]}
            value={supplierId ?? ''}
            onChange={(v) => setSupplierId(v || null)}
            placeholder="All suppliers"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="from">From</Label>
          <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="to">To</Label>
          <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="flex h-9 items-center gap-2">
          <Checkbox
            id="unpaid"
            checked={unpaidOnly}
            onCheckedChange={(v) => setUnpaidOnly(v === true)}
          />
          <Label htmlFor="unpaid" className="cursor-pointer">
            Unpaid only
          </Label>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={isLoading}
        rowKey={(r) => r.id}
        onRowClick={(r) => router.push(`/purchases/${r.id}`)}
        defaultSort={{ key: 'purchase_date', dir: 'desc' }}
        rowClassName={(r) => (r.status === 'cancelled' ? 'opacity-60' : undefined)}
        empty={
          <EmptyState
            icon={<ShoppingCart />}
            title="No purchases in this range"
            description="Widen the date range, or record the purchase that brought material in."
            action={
              <Button asChild>
                <Link href="/purchases/new">
                  <Plus className="h-4 w-4" />
                  New purchase
                </Link>
              </Button>
            }
          />
        }
      />
    </>
  )
}
