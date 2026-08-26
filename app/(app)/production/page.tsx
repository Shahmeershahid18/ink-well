'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Download, Factory, Plus } from 'lucide-react'
import { useBatches } from '@/lib/queries/production'
import { useInks } from '@/lib/queries/inks'
import { addDays, formatDate, formatKg, num, toDateInput } from '@/lib/format'
import { downloadCsv } from '@/lib/csv'
import type { BatchWithInk } from '@/types/database'
import { PageHeader } from '@/components/shared/page-header'
import { DataTable, type Column } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/empty-state'
import { Money, Rate, Weight } from '@/components/shared/money'
import { InkName, StatusBadge } from '@/components/shared/badges'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Combobox } from '@/components/ui/combobox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function ProductionPage() {
  const router = useRouter()
  const { data: inks } = useInks()

  const [inkId, setInkId] = React.useState<string | null>(null)
  const [status, setStatus] = React.useState('all')
  const [from, setFrom] = React.useState(toDateInput(addDays(new Date(), -90)))
  const [to, setTo] = React.useState(toDateInput(new Date()))

  const { data: batches, isLoading } = useBatches({
    inkId: inkId ?? undefined,
    status: status === 'all' ? undefined : status,
    from,
    to,
  })

  const rows = batches ?? []
  const completed = rows.filter((b) => b.status === 'completed')
  const producedKg = completed.reduce((s, b) => s + num(b.produced_qty_kg), 0)
  const productionCost = completed.reduce((s, b) => s + num(b.total_cost), 0)

  const columns: Column<BatchWithInk>[] = [
    {
      key: 'production_date',
      header: 'Date',
      sortValue: (r) => r.production_date,
      cell: (r) => <span className="whitespace-nowrap">{formatDate(r.production_date)}</span>,
    },
    {
      key: 'batch_no',
      header: 'Batch',
      hideBelow: 'sm',
      sortValue: (r) => r.batch_no ?? '',
      cell: (r) => <span className="num text-xs">{r.batch_no ?? '—'}</span>,
    },
    {
      key: 'ink',
      header: 'Ink',
      sortValue: (r) => r.ink?.name ?? '',
      cell: (r) => (
        <InkName name={r.ink?.name ?? 'Unknown'} color={r.ink?.color_hex} code={r.ink?.code} />
      ),
    },
    {
      key: 'qty',
      header: 'Planned / produced',
      numeric: true,
      sortValue: (r) => num(r.produced_qty_kg),
      cell: (r) => (
        <span className="num">
          {formatKg(r.planned_qty_kg)}
          <span className="text-[var(--muted-foreground)]"> / </span>
          {r.produced_qty_kg == null ? '—' : formatKg(r.produced_qty_kg)}
        </span>
      ),
    },
    {
      key: 'wastage',
      header: 'Wastage',
      numeric: true,
      hideBelow: 'md',
      sortValue: (r) =>
        r.produced_qty_kg == null
          ? -1
          : ((num(r.planned_qty_kg) - num(r.produced_qty_kg)) / num(r.planned_qty_kg)) * 100,
      cell: (r) => {
        if (r.produced_qty_kg == null) return <span className="text-[var(--muted-foreground)]">—</span>
        const lost = num(r.planned_qty_kg) - num(r.produced_qty_kg)
        const pct = num(r.planned_qty_kg) > 0 ? (lost / num(r.planned_qty_kg)) * 100 : 0
        return <span className={pct > 5 ? 'text-[var(--warn)]' : undefined}>{pct.toFixed(1)}%</span>
      },
    },
    {
      key: 'cost_per_kg',
      header: 'Cost/kg',
      numeric: true,
      sortValue: (r) => num(r.cost_per_kg),
      cell: (r) => (r.cost_per_kg == null ? '—' : <Rate value={r.cost_per_kg} />),
    },
    {
      key: 'total_cost',
      header: 'Total cost',
      numeric: true,
      hideBelow: 'lg',
      sortValue: (r) => num(r.total_cost),
      cell: (r) => (num(r.total_cost) > 0 ? <Money value={r.total_cost} dp={0} /> : '—'),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'right',
      cell: (r) => <StatusBadge status={r.status} />,
    },
  ]

  return (
    <>
      <PageHeader
        title="Production"
        description={
          <>
            {rows.length} batches in range · produced <Weight value={producedKg} /> at a cost of{' '}
            <Money value={productionCost} dp={0} className="font-medium text-[var(--foreground)]" />
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              onClick={() =>
                downloadCsv(`production-${from}-to-${to}`, rows, [
                  { header: 'Date', value: (r) => r.production_date },
                  { header: 'Batch', value: (r) => r.batch_no },
                  { header: 'Ink', value: (r) => r.ink?.name },
                  { header: 'Planned kg', value: (r) => num(r.planned_qty_kg) },
                  { header: 'Produced kg', value: (r) => r.produced_qty_kg },
                  { header: 'Material cost', value: (r) => num(r.material_cost) },
                  { header: 'Labor', value: (r) => num(r.labor_cost) },
                  { header: 'Overhead', value: (r) => num(r.overhead_cost) },
                  { header: 'Packaging', value: (r) => num(r.packaging_cost) },
                  { header: 'Total cost', value: (r) => num(r.total_cost) },
                  { header: 'Cost/kg', value: (r) => r.cost_per_kg },
                  { header: 'Status', value: (r) => r.status },
                ])
              }
            >
              <Download className="h-4 w-4" />
              CSV
            </Button>
            <Button asChild>
              <Link href="/production/new">
                <Plus className="h-4 w-4" />
                New batch
              </Link>
            </Button>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="w-56 space-y-1.5">
          <Label>Ink</Label>
          <Combobox
            options={[
              { value: '', label: 'All inks' },
              ...(inks ?? []).map((i) => ({ value: i.id, label: i.name, color: i.color_hex })),
            ]}
            value={inkId ?? ''}
            onChange={(v) => setInkId(v || null)}
            placeholder="All inks"
          />
        </div>
        <div className="w-36 space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="from">From</Label>
          <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="to">To</Label>
          <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={isLoading}
        rowKey={(r) => r.id}
        onRowClick={(r) => router.push(`/production/${r.id}`)}
        defaultSort={{ key: 'production_date', dir: 'desc' }}
        rowClassName={(r) => (r.status === 'cancelled' ? 'opacity-60' : undefined)}
        empty={
          <EmptyState
            icon={<Factory />}
            title="No batches in this range"
            description="Plan a batch from an ink's formula — it will scale the recipe to whatever quantity you are making."
            action={
              <Button asChild>
                <Link href="/production/new">
                  <Plus className="h-4 w-4" />
                  New batch
                </Link>
              </Button>
            }
          />
        }
      />
    </>
  )
}
