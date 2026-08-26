'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Download, Plus, Receipt } from 'lucide-react'
import { useSales } from '@/lib/queries/sales'
import { useCustomers } from '@/lib/queries/parties'
import { addDays, formatDate, num, toDateInput } from '@/lib/format'
import { downloadCsv } from '@/lib/csv'
import type { SaleWithCustomer } from '@/types/database'
import { PageHeader } from '@/components/shared/page-header'
import { DataTable, type Column } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/empty-state'
import { Money, Percent } from '@/components/shared/money'
import { PaymentBadge, StatusBadge } from '@/components/shared/badges'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Combobox } from '@/components/ui/combobox'

export default function SalesPage() {
  const router = useRouter()
  const { data: customers } = useCustomers()

  const [customerId, setCustomerId] = React.useState<string | null>(null)
  const [from, setFrom] = React.useState(toDateInput(addDays(new Date(), -90)))
  const [to, setTo] = React.useState(toDateInput(new Date()))
  const [unpaidOnly, setUnpaidOnly] = React.useState(false)

  const { data: sales, isLoading } = useSales({
    customerId: customerId ?? undefined,
    from,
    to,
    unpaidOnly,
  })

  const rows = sales ?? []
  const confirmed = rows.filter((r) => r.status === 'confirmed')
  const revenue = confirmed.reduce((s, r) => s + num(r.total), 0)
  const profit = confirmed.reduce((s, r) => s + num(r.profit_total), 0)
  const receivable = confirmed.reduce((s, r) => s + num(r.total) - num(r.paid_amount), 0)

  const columns: Column<SaleWithCustomer>[] = [
    {
      key: 'sale_date',
      header: 'Date',
      sortValue: (r) => r.sale_date,
      cell: (r) => <span className="whitespace-nowrap">{formatDate(r.sale_date)}</span>,
    },
    {
      key: 'invoice_no',
      header: 'Invoice',
      hideBelow: 'sm',
      sortValue: (r) => r.invoice_no ?? '',
      cell: (r) => <span className="num text-xs">{r.invoice_no ?? '—'}</span>,
    },
    {
      key: 'customer',
      header: 'Customer',
      sortValue: (r) => r.customer?.name ?? '',
      cell: (r) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{r.customer?.name ?? 'Unknown'}</div>
          {r.customer?.company && (
            <div className="truncate text-xs text-[var(--muted-foreground)]">
              {r.customer.company}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      numeric: true,
      sortValue: (r) => num(r.total),
      cell: (r) => <Money value={r.total} />,
    },
    {
      key: 'profit_total',
      header: 'Profit',
      numeric: true,
      sortValue: (r) => num(r.profit_total),
      cell: (r) => (
        <div>
          <Money value={r.profit_total} signed />
          {num(r.total) > 0 && (
            <div className="text-xs text-[var(--muted-foreground)]">
              <Percent value={(num(r.profit_total) / num(r.total)) * 100} />
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'balance',
      header: 'Balance',
      numeric: true,
      hideBelow: 'md',
      sortValue: (r) => num(r.total) - num(r.paid_amount),
      cell: (r) => {
        const balance = num(r.total) - num(r.paid_amount)
        return (
          <Money value={balance} className={balance > 0.005 ? 'text-[var(--warn)]' : undefined} />
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      align: 'right',
      cell: (r) => (
        <div className="flex justify-end gap-1.5">
          {r.status === 'confirmed' && <PaymentBadge total={r.total} paid={r.paid_amount} />}
          <StatusBadge status={r.status} />
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Sales"
        description={
          <>
            {rows.length} in range · revenue{' '}
            <Money value={revenue} dp={0} className="font-medium text-[var(--foreground)]" /> ·
            profit <Money value={profit} dp={0} signed className="font-medium" />
            {receivable > 0.005 && (
              <>
                {' '}
                · receivable{' '}
                <Money value={receivable} dp={0} className="font-medium text-[var(--warn)]" />
              </>
            )}
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              onClick={() =>
                downloadCsv(`sales-${from}-to-${to}`, rows, [
                  { header: 'Date', value: (r) => r.sale_date },
                  { header: 'Invoice', value: (r) => r.invoice_no },
                  { header: 'Customer', value: (r) => r.customer?.name },
                  { header: 'Subtotal', value: (r) => num(r.subtotal) },
                  { header: 'Discount', value: (r) => num(r.discount) },
                  { header: 'Total', value: (r) => num(r.total) },
                  { header: 'COGS', value: (r) => num(r.cogs_total) },
                  { header: 'Profit', value: (r) => num(r.profit_total) },
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
              <Link href="/sales/new">
                <Plus className="h-4 w-4" />
                New sale
              </Link>
            </Button>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="w-56 space-y-1.5">
          <Label>Customer</Label>
          <Combobox
            options={[
              { value: '', label: 'All customers' },
              ...(customers ?? []).map((c) => ({ value: c.id, label: c.name })),
            ]}
            value={customerId ?? ''}
            onChange={(v) => setCustomerId(v || null)}
            placeholder="All customers"
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
        onRowClick={(r) => router.push(`/sales/${r.id}`)}
        defaultSort={{ key: 'sale_date', dir: 'desc' }}
        rowClassName={(r) => (r.status === 'cancelled' ? 'opacity-60' : undefined)}
        empty={
          <EmptyState
            icon={<Receipt />}
            title="No sales in this range"
            description="Widen the date range, or record the sale that took ink out the door."
            action={
              <Button asChild>
                <Link href="/sales/new">
                  <Plus className="h-4 w-4" />
                  New sale
                </Link>
              </Button>
            }
          />
        }
      />
    </>
  )
}
