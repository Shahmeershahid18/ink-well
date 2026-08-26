'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Beaker, Download, Plus } from 'lucide-react'
import { useAllFormulas, useInks } from '@/lib/queries/inks'
import { computeInkCost, type FormulaLine } from '@/lib/calc/formula'
import { num } from '@/lib/format'
import { downloadCsv } from '@/lib/csv'
import type { Ink } from '@/types/database'
import { PageHeader } from '@/components/shared/page-header'
import { DataTable, type Column } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/empty-state'
import { Money, Percent, Rate, Weight } from '@/components/shared/money'
import { InkName, StockBadge, stockRank } from '@/components/shared/badges'
import { InkForm } from '@/components/inks/ink-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

interface InkRow extends Ink {
  baseCostPerKg: number
  marginPct: number
  hasFormula: boolean
}

export default function InksPage() {
  const router = useRouter()
  const [search, setSearch] = React.useState('')
  const [activeOnly, setActiveOnly] = React.useState(true)
  const [formOpen, setFormOpen] = React.useState(false)

  const { data: inks, isLoading } = useInks()
  const { data: formulas } = useAllFormulas()

  const rows: InkRow[] = React.useMemo(() => {
    let list = inks ?? []
    if (activeOnly) list = list.filter((i) => i.is_active)
    const q = search.trim().toLowerCase()
    if (q) list = list.filter((i) => [i.name, i.code].some((v) => v?.toLowerCase().includes(q)))

    return list.map((ink) => {
      const items = formulas?.get(ink.id) ?? []
      const lines: FormulaLine[] = items.map((f) => ({
        raw_material_id: f.raw_material_id,
        quantity_kg: num(f.quantity_kg),
        avg_cost_per_kg: num(f.raw_material?.avg_cost_per_kg),
        current_stock_kg: num(f.raw_material?.current_stock_kg),
      }))
      const cost = computeInkCost(lines, ink)
      return {
        ...ink,
        baseCostPerKg: cost.baseCostPerKg,
        marginPct: cost.marginPct,
        hasFormula: items.length > 0,
      }
    })
  }, [inks, formulas, search, activeOnly])

  const columns: Column<InkRow>[] = [
    {
      key: 'name',
      header: 'Ink',
      sortValue: (r) => r.name,
      cell: (r) => (
        <div className="min-w-0">
          <InkName name={r.name} color={r.color_hex} code={r.code} />
          <div className="pl-5 text-xs text-[var(--muted-foreground)]">
            {r.ink_type ?? 'Unspecified'} · batch {num(r.batch_size_kg)} kg
          </div>
        </div>
      ),
    },
    {
      key: 'baseCostPerKg',
      header: 'Base cost/kg',
      numeric: true,
      sortValue: (r) => r.baseCostPerKg,
      cell: (r) =>
        r.hasFormula ? (
          <Rate value={r.baseCostPerKg} />
        ) : (
          <span className="text-xs text-[var(--muted-foreground)]">No formula</span>
        ),
    },
    {
      key: 'default_price_per_kg',
      header: 'List price/kg',
      numeric: true,
      hideBelow: 'sm',
      sortValue: (r) => num(r.default_price_per_kg),
      cell: (r) =>
        r.default_price_per_kg ? (
          <Rate value={r.default_price_per_kg} />
        ) : (
          <span className="text-[var(--muted-foreground)]">—</span>
        ),
    },
    {
      key: 'marginPct',
      header: 'Margin',
      numeric: true,
      sortValue: (r) => r.marginPct,
      cell: (r) =>
        r.hasFormula && r.default_price_per_kg ? (
          <Percent value={r.marginPct} signed />
        ) : (
          <span className="text-[var(--muted-foreground)]">—</span>
        ),
    },
    {
      key: 'current_stock_kg',
      header: 'Stock',
      numeric: true,
      sortValue: (r) => num(r.current_stock_kg),
      cell: (r) => <Weight value={r.current_stock_kg} />,
    },
    {
      key: 'stock_value',
      header: 'Stock value',
      numeric: true,
      hideBelow: 'lg',
      sortValue: (r) => num(r.current_stock_kg) * num(r.avg_cost_per_kg),
      cell: (r) => <Money value={num(r.current_stock_kg) * num(r.avg_cost_per_kg)} dp={0} />,
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
        title="Inks"
        description={`${rows.length} of ${inks?.length ?? 0} · base cost is recalculated from today's material prices`}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() =>
                downloadCsv('inks', rows, [
                  { header: 'Name', value: (r) => r.name },
                  { header: 'Code', value: (r) => r.code },
                  { header: 'Type', value: (r) => r.ink_type },
                  { header: 'Batch size kg', value: (r) => num(r.batch_size_kg) },
                  { header: 'Base cost/kg', value: (r) => r.baseCostPerKg.toFixed(4) },
                  { header: 'List price/kg', value: (r) => num(r.default_price_per_kg) },
                  { header: 'Margin %', value: (r) => r.marginPct.toFixed(2) },
                  { header: 'Stock kg', value: (r) => num(r.current_stock_kg) },
                  { header: 'Avg cost/kg', value: (r) => num(r.avg_cost_per_kg) },
                ])
              }
            >
              <Download className="h-4 w-4" />
              CSV
            </Button>
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" />
              New ink
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
        onRowClick={(r) => router.push(`/inks/${r.id}`)}
        defaultSort={{ key: 'name', dir: 'asc' }}
        empty={
          <EmptyState
            icon={<Beaker />}
            title={search ? 'No ink matches that search' : 'No inks yet'}
            description={
              search
                ? 'Try a shorter search.'
                : 'Create an ink, give it a formula, and the system will cost every batch you make from it.'
            }
            action={
              !search && (
                <Button onClick={() => setFormOpen(true)}>
                  <Plus className="h-4 w-4" />
                  New ink
                </Button>
              )
            }
          />
        }
      />

      <InkForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSaved={(ink) => router.push(`/inks/${ink.id}`)}
      />
    </>
  )
}
