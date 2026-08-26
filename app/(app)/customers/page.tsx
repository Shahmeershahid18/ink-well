'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Users } from 'lucide-react'
import { useCustomerSummary, useCustomers } from '@/lib/queries/parties'
import { formatDate } from '@/lib/format'
import type { VCustomerSummary } from '@/types/database'
import { PageHeader } from '@/components/shared/page-header'
import { DataTable, type Column } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/empty-state'
import { Money, Percent, Weight } from '@/components/shared/money'
import { PartyForm } from '@/components/parties/party-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

export default function CustomersPage() {
  const router = useRouter()
  const [search, setSearch] = React.useState('')
  const [activeOnly, setActiveOnly] = React.useState(true)
  const [formOpen, setFormOpen] = React.useState(false)

  const { data: summary, isLoading } = useCustomerSummary()
  const { data: customers } = useCustomers()

  const rows = React.useMemo(() => {
    let list = summary ?? []
    if (activeOnly) list = list.filter((c) => c.is_active)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter((c) =>
        [c.name, c.company, c.phone, c.city].some((v) => v?.toLowerCase().includes(q)),
      )
    }
    return list
  }, [summary, search, activeOnly])

  const columns: Column<VCustomerSummary>[] = [
    {
      key: 'name',
      header: 'Customer',
      sortValue: (r) => r.name,
      cell: (r) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-medium">
            <span className="truncate">{r.name}</span>
            {!r.is_active && <Badge variant="outline">Inactive</Badge>}
          </div>
          {r.company && (
            <div className="truncate text-xs text-[var(--muted-foreground)]">{r.company}</div>
          )}
        </div>
      ),
    },
    {
      key: 'orders',
      header: 'Orders',
      numeric: true,
      hideBelow: 'sm',
      sortValue: (r) => Number(r.orders),
      cell: (r) => Number(r.orders),
    },
    {
      key: 'total_kg',
      header: 'Volume',
      numeric: true,
      hideBelow: 'md',
      sortValue: (r) => Number(r.total_kg),
      cell: (r) => <Weight value={r.total_kg} />,
    },
    {
      key: 'revenue',
      header: 'Revenue',
      numeric: true,
      sortValue: (r) => Number(r.revenue),
      cell: (r) => <Money value={r.revenue} dp={0} />,
    },
    {
      key: 'profit',
      header: 'Profit',
      numeric: true,
      sortValue: (r) => Number(r.profit),
      cell: (r) => (
        <div>
          <Money value={r.profit} dp={0} signed />
          {Number(r.revenue) > 0 && (
            <div className="text-xs text-[var(--muted-foreground)]">
              <Percent value={(Number(r.profit) / Number(r.revenue)) * 100} />
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'receivable',
      header: 'Receivable',
      numeric: true,
      sortValue: (r) => Number(r.receivable),
      cell: (r) => (
        <Money
          value={r.receivable}
          dp={0}
          className={Number(r.receivable) > 0.005 ? 'text-[var(--warn)]' : undefined}
        />
      ),
    },
    {
      key: 'last_order_date',
      header: 'Last order',
      align: 'right',
      hideBelow: 'lg',
      sortValue: (r) => r.last_order_date ?? '',
      cell: (r) => (
        <span className="text-xs text-[var(--muted-foreground)]">
          {r.last_order_date ? formatDate(r.last_order_date) : 'Never'}
        </span>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Customers"
        description={`${rows.length} of ${customers?.length ?? 0} · who you sell ink to`}
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            New customer
          </Button>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search name, company, city…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex items-center gap-2">
          <Checkbox
            id="active-only"
            checked={activeOnly}
            onCheckedChange={(v) => setActiveOnly(v === true)}
          />
          <Label htmlFor="active-only" className="cursor-pointer">
            Active only
          </Label>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={isLoading}
        rowKey={(r) => r.id}
        onRowClick={(r) => router.push(`/customers/${r.id}`)}
        defaultSort={{ key: 'revenue', dir: 'desc' }}
        empty={
          <EmptyState
            icon={<Users />}
            title={search ? 'No customer matches that search' : 'No customers yet'}
            description={
              search
                ? 'Try a shorter search, or clear the active-only filter.'
                : 'Add a customer before recording your first sale — profit is tracked per customer.'
            }
            action={
              !search && (
                <Button onClick={() => setFormOpen(true)}>
                  <Plus className="h-4 w-4" />
                  New customer
                </Button>
              )
            }
          />
        }
      />

      <PartyForm kind="customer" open={formOpen} onOpenChange={setFormOpen} />
    </>
  )
}
