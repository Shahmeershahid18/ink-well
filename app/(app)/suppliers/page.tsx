'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Truck } from 'lucide-react'
import { useSupplierSummary, useSuppliers } from '@/lib/queries/parties'
import { formatDate } from '@/lib/format'
import type { VSupplierSummary } from '@/types/database'
import { PageHeader } from '@/components/shared/page-header'
import { DataTable, type Column } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/empty-state'
import { Money } from '@/components/shared/money'
import { PartyForm } from '@/components/parties/party-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

export default function SuppliersPage() {
  const router = useRouter()
  const [search, setSearch] = React.useState('')
  const [activeOnly, setActiveOnly] = React.useState(true)
  const [formOpen, setFormOpen] = React.useState(false)

  const { data: summary, isLoading } = useSupplierSummary()
  const { data: suppliers } = useSuppliers()

  const rows = React.useMemo(() => {
    let list = summary ?? []
    if (activeOnly) list = list.filter((s) => s.is_active)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter((s) =>
        [s.name, s.company, s.phone, s.city].some((v) => v?.toLowerCase().includes(q)),
      )
    }
    return list
  }, [summary, search, activeOnly])

  const columns: Column<VSupplierSummary>[] = [
    {
      key: 'name',
      header: 'Supplier',
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
      key: 'phone',
      header: 'Phone',
      hideBelow: 'md',
      sortValue: (r) => r.phone ?? '',
      cell: (r) => <span className="num text-xs">{r.phone ?? '—'}</span>,
    },
    {
      key: 'purchase_count',
      header: 'Purchases',
      numeric: true,
      hideBelow: 'sm',
      sortValue: (r) => Number(r.purchase_count),
      cell: (r) => Number(r.purchase_count),
    },
    {
      key: 'total_spend',
      header: 'Total spend',
      numeric: true,
      sortValue: (r) => Number(r.total_spend),
      cell: (r) => <Money value={r.total_spend} dp={0} />,
    },
    {
      key: 'payable',
      header: 'Payable',
      numeric: true,
      sortValue: (r) => Number(r.payable),
      cell: (r) => (
        <Money
          value={r.payable}
          dp={0}
          className={Number(r.payable) > 0.005 ? 'text-[var(--warn)]' : undefined}
        />
      ),
    },
    {
      key: 'last_purchase_date',
      header: 'Last purchase',
      align: 'right',
      hideBelow: 'lg',
      sortValue: (r) => r.last_purchase_date ?? '',
      cell: (r) => (
        <span className="text-xs text-[var(--muted-foreground)]">
          {r.last_purchase_date ? formatDate(r.last_purchase_date) : 'Never'}
        </span>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Suppliers"
        description={`${rows.length} of ${suppliers?.length ?? 0} · who you buy raw material from`}
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            New supplier
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
        onRowClick={(r) => router.push(`/suppliers/${r.id}`)}
        defaultSort={{ key: 'total_spend', dir: 'desc' }}
        empty={
          <EmptyState
            icon={<Truck />}
            title={search ? 'No supplier matches that search' : 'No suppliers yet'}
            description={
              search
                ? 'Try a shorter search, or clear the active-only filter.'
                : 'Add the supplier you buy pigment and resin from — you will need one before recording a purchase.'
            }
            action={
              !search && (
                <Button onClick={() => setFormOpen(true)}>
                  <Plus className="h-4 w-4" />
                  New supplier
                </Button>
              )
            }
          />
        }
      />

      <PartyForm kind="supplier" open={formOpen} onOpenChange={setFormOpen} />
    </>
  )
}
