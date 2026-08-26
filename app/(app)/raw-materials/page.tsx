'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Download, Package, Plus } from 'lucide-react'
import { useMaterialUsage, useRawMaterials } from '@/lib/queries/materials'
import { num } from '@/lib/format'
import { downloadCsv } from '@/lib/csv'
import { MATERIAL_CATEGORIES } from '@/lib/constants'
import type { VMaterialUsage } from '@/types/database'
import { PageHeader } from '@/components/shared/page-header'
import { DataTable, type Column } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/empty-state'
import { Money, Rate, Weight } from '@/components/shared/money'
import { StockBadge, stockRank } from '@/components/shared/badges'
import { MaterialForm } from '@/components/materials/material-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function RawMaterialsPage() {
  const router = useRouter()
  const [search, setSearch] = React.useState('')
  const [category, setCategory] = React.useState('all')
  const [lowOnly, setLowOnly] = React.useState(false)
  const [formOpen, setFormOpen] = React.useState(false)

  const { data: usage, isLoading } = useMaterialUsage()
  const { data: materials } = useRawMaterials()

  const rows = React.useMemo(() => {
    let list = (usage ?? []).filter((m) => m.is_active)
    if (category !== 'all') list = list.filter((m) => m.category === category)
    if (lowOnly)
      list = list.filter(
        (m) => num(m.current_stock_kg) <= 0 || (num(m.reorder_level_kg) > 0 && num(m.current_stock_kg) <= num(m.reorder_level_kg)),
      )
    const q = search.trim().toLowerCase()
    if (q) list = list.filter((m) => [m.name, m.code].some((v) => v?.toLowerCase().includes(q)))
    return list
  }, [usage, search, category, lowOnly])

  const totalValue = rows.reduce((s, m) => s + num(m.stock_value), 0)

  const columns: Column<VMaterialUsage>[] = [
    {
      key: 'name',
      header: 'Material',
      sortValue: (r) => r.name,
      cell: (r) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{r.name}</div>
          <div className="truncate text-xs text-[var(--muted-foreground)]">
            {[r.code, r.category].filter(Boolean).join(' · ') || '—'}
          </div>
        </div>
      ),
    },
    {
      key: 'current_stock_kg',
      header: 'Stock',
      numeric: true,
      sortValue: (r) => num(r.current_stock_kg),
      cell: (r) => <Weight value={r.current_stock_kg} unit={r.unit} />,
    },
    {
      key: 'avg_cost_per_kg',
      header: 'Avg cost/kg',
      numeric: true,
      hideBelow: 'sm',
      sortValue: (r) => num(r.avg_cost_per_kg),
      cell: (r) => <Rate value={r.avg_cost_per_kg} />,
    },
    {
      key: 'stock_value',
      header: 'Stock value',
      numeric: true,
      sortValue: (r) => num(r.stock_value),
      cell: (r) => <Money value={r.stock_value} dp={0} />,
    },
    {
      key: 'reorder_level_kg',
      header: 'Reorder at',
      numeric: true,
      hideBelow: 'lg',
      sortValue: (r) => num(r.reorder_level_kg),
      cell: (r) =>
        num(r.reorder_level_kg) > 0 ? (
          <Weight value={r.reorder_level_kg} showUnit={false} />
        ) : (
          <span className="text-[var(--muted-foreground)]">—</span>
        ),
    },
    {
      key: 'days_of_cover',
      header: 'Days cover',
      numeric: true,
      hideBelow: 'lg',
      sortValue: (r) => (r.days_of_cover == null ? Number.MAX_SAFE_INTEGER : num(r.days_of_cover)),
      cell: (r) =>
        r.days_of_cover == null ? (
          <span className="text-[var(--muted-foreground)]">—</span>
        ) : (
          <span className={num(r.days_of_cover) < 14 ? 'text-[var(--warn)]' : undefined}>
            {num(r.days_of_cover).toFixed(0)}
          </span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'right',
      sortValue: (r) => stockRank(r.current_stock_kg, r.reorder_level_kg),
      cell: (r) => <StockBadge stockKg={r.current_stock_kg} reorderKg={r.reorder_level_kg} />,
    },
  ]

  return (
    <>
      <PageHeader
        title="Raw materials"
        description={
          <>
            {rows.length} of {materials?.length ?? 0} · stock value{' '}
            <Money value={totalValue} dp={0} className="font-medium text-[var(--foreground)]" />
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              onClick={() =>
                downloadCsv('raw-materials', rows, [
                  { header: 'Name', value: (r) => r.name },
                  { header: 'Code', value: (r) => r.code },
                  { header: 'Category', value: (r) => r.category },
                  { header: 'Stock kg', value: (r) => num(r.current_stock_kg) },
                  { header: 'Avg cost/kg', value: (r) => num(r.avg_cost_per_kg) },
                  { header: 'Stock value', value: (r) => num(r.stock_value) },
                  { header: 'Reorder level kg', value: (r) => num(r.reorder_level_kg) },
                  { header: 'Purchased kg', value: (r) => num(r.purchased_kg) },
                  { header: 'Consumed kg', value: (r) => num(r.consumed_kg) },
                  { header: 'Days of cover', value: (r) => r.days_of_cover },
                ])
              }
            >
              <Download className="h-4 w-4" />
              CSV
            </Button>
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" />
              New material
            </Button>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search name or code…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {MATERIAL_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Checkbox id="low-only" checked={lowOnly} onCheckedChange={(v) => setLowOnly(v === true)} />
          <Label htmlFor="low-only" className="cursor-pointer">
            Low stock only
          </Label>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={isLoading}
        rowKey={(r) => r.id}
        onRowClick={(r) => router.push(`/raw-materials/${r.id}`)}
        defaultSort={{ key: 'status', dir: 'asc' }}
        rowClassName={(r) => (num(r.current_stock_kg) <= 0 ? 'bg-[var(--danger-soft)]/30' : undefined)}
        empty={
          <EmptyState
            icon={<Package />}
            title={search || lowOnly ? 'Nothing matches those filters' : 'No raw materials yet'}
            description={
              search || lowOnly
                ? 'Clear the filters to see everything.'
                : 'Add the pigments, resins and solvents you buy. Purchases will keep their stock and average cost up to date.'
            }
            action={
              !search && (
                <Button onClick={() => setFormOpen(true)}>
                  <Plus className="h-4 w-4" />
                  New material
                </Button>
              )
            }
          />
        }
      />

      <MaterialForm open={formOpen} onOpenChange={setFormOpen} />
    </>
  )
}
