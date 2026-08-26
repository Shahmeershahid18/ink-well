'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Factory, Pencil, Scale } from 'lucide-react'
import { useInk, useInkFormula, useInkProfitability } from '@/lib/queries/inks'
import { useBatches } from '@/lib/queries/production'
import { useInkSales } from '@/lib/queries/sales'
import { useItemMovements } from '@/lib/queries/materials'
import { computeInkCost, type FormulaLine } from '@/lib/calc/formula'
import { formatDate, formatKg, num } from '@/lib/format'
import type { BatchWithInk } from '@/types/database'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { DataTable, type Column } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/empty-state'
import { Money, Percent, Rate, Weight } from '@/components/shared/money'
import { InkSwatch, StatusBadge, StockBadge } from '@/components/shared/badges'
import { MovementLedger } from '@/components/materials/movement-ledger'
import { AdjustStockDialog } from '@/components/materials/adjust-stock-dialog'
import { FormulaBuilder } from '@/components/inks/formula-builder'
import { InkForm } from '@/components/inks/ink-form'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default function InkDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params.id

  const { data: ink, isLoading } = useInk(id)
  const { data: formula } = useInkFormula(id)
  const { data: batches, isLoading: batchesLoading } = useBatches({ inkId: id })
  const { data: saleLines } = useInkSales(id)
  const { data: movements, isLoading: movementsLoading } = useItemMovements('ink', id)
  const { data: profitability } = useInkProfitability()

  const [editOpen, setEditOpen] = React.useState(false)
  const [adjustOpen, setAdjustOpen] = React.useState(false)

  const perf = profitability?.find((p) => p.id === id)

  const theoretical = React.useMemo(() => {
    if (!ink) return null
    const lines: FormulaLine[] = (formula ?? []).map((f) => ({
      raw_material_id: f.raw_material_id,
      quantity_kg: num(f.quantity_kg),
      avg_cost_per_kg: num(f.raw_material?.avg_cost_per_kg),
      current_stock_kg: num(f.raw_material?.current_stock_kg),
    }))
    return computeInkCost(lines, ink)
  }, [ink, formula])

  const batchColumns: Column<BatchWithInk>[] = [
    {
      key: 'production_date',
      header: 'Date',
      sortValue: (r) => r.production_date,
      cell: (r) => formatDate(r.production_date),
    },
    {
      key: 'batch_no',
      header: 'Batch',
      sortValue: (r) => r.batch_no ?? '',
      cell: (r) => <span className="num text-xs">{r.batch_no ?? '—'}</span>,
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
      hideBelow: 'sm',
      sortValue: (r) =>
        r.produced_qty_kg == null
          ? -1
          : ((num(r.planned_qty_kg) - num(r.produced_qty_kg)) / num(r.planned_qty_kg)) * 100,
      cell: (r) => {
        if (r.produced_qty_kg == null) return <span className="text-[var(--muted-foreground)]">—</span>
        const lost = num(r.planned_qty_kg) - num(r.produced_qty_kg)
        const pct = num(r.planned_qty_kg) > 0 ? (lost / num(r.planned_qty_kg)) * 100 : 0
        return (
          <span className={pct > num(ink?.expected_wastage_pct) ? 'text-[var(--warn)]' : undefined}>
            {formatKg(lost)} kg · {pct.toFixed(1)}%
          </span>
        )
      },
    },
    {
      key: 'cost_per_kg',
      header: 'Actual cost/kg',
      numeric: true,
      sortValue: (r) => num(r.cost_per_kg),
      cell: (r) => (r.cost_per_kg == null ? '—' : <Rate value={r.cost_per_kg} />),
    },
    {
      key: 'variance',
      header: 'vs theoretical',
      numeric: true,
      hideBelow: 'md',
      sortValue: (r) =>
        theoretical && r.cost_per_kg != null
          ? num(r.cost_per_kg) - theoretical.baseCostPerKg
          : 0,
      cell: (r) => {
        if (!theoretical || r.cost_per_kg == null || theoretical.baseCostPerKg <= 0) {
          return <span className="text-[var(--muted-foreground)]">—</span>
        }
        const diff = num(r.cost_per_kg) - theoretical.baseCostPerKg
        const pct = (diff / theoretical.baseCostPerKg) * 100
        return (
          <span className={diff > 0 ? 'text-[var(--danger)]' : 'text-[var(--ok)]'}>
            {diff > 0 ? '+' : ''}
            {pct.toFixed(1)}%
          </span>
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      align: 'right',
      cell: (r) => <StatusBadge status={r.status} />,
    },
  ]

  if (isLoading) return <Skeleton className="h-64 w-full" />
  if (!ink) {
    return (
      <EmptyState
        title="Ink not found"
        description="It may have been removed."
        action={
          <Button variant="outline" onClick={() => router.push('/inks')}>
            Back to inks
          </Button>
        }
      />
    )
  }

  const topCustomers = Object.values(
    (saleLines ?? [])
      .filter((l) => l.sale?.status === 'confirmed')
      .reduce<Record<string, { name: string; kg: number; revenue: number; profit: number }>>(
        (acc, line) => {
          const key = line.sale?.customer?.id ?? 'unknown'
          const entry = acc[key] ?? {
            name: line.sale?.customer?.name ?? 'Unknown',
            kg: 0,
            revenue: 0,
            profit: 0,
          }
          entry.kg += num(line.quantity_kg)
          entry.revenue += num(line.line_total)
          entry.profit += num(line.line_profit)
          acc[key] = entry
          return acc
        },
        {},
      ),
  ).sort((a, b) => b.revenue - a.revenue)

  return (
    <>
      <PageHeader
        back={
          <Link
            href="/inks"
            className="mb-1 inline-flex items-center gap-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            <ArrowLeft className="h-3 w-3" />
            Inks
          </Link>
        }
        title={ink.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <InkSwatch color={ink.color_hex} />
            {[ink.code, ink.ink_type, `batch ${formatKg(ink.batch_size_kg)} kg`]
              .filter(Boolean)
              .join(' · ')}
            <StockBadge stockKg={ink.current_stock_kg} reorderKg={ink.reorder_level_kg} />
          </span>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
            <Button variant="outline" onClick={() => setAdjustOpen(true)}>
              <Scale className="h-4 w-4" />
              Adjust stock
            </Button>
            <Button asChild>
              <Link href={`/production/new?ink=${ink.id}`}>
                <Factory className="h-4 w-4" />
                Produce
              </Link>
            </Button>
          </>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="In stock"
          value={<Weight value={ink.current_stock_kg} />}
          sub={<Money value={num(ink.current_stock_kg) * num(ink.avg_cost_per_kg)} dp={0} prefix="worth " />}
        />
        <StatCard
          label="Stock cost/kg"
          value={<Rate value={ink.avg_cost_per_kg} />}
          sub="Weighted average of batches on hand"
        />
        <StatCard
          label="Theoretical cost/kg"
          value={<Rate value={theoretical?.baseCostPerKg ?? 0} />}
          sub="At today's material prices"
        />
        <StatCard
          label="Sold"
          value={<Weight value={perf?.sold_kg ?? 0} />}
          sub={<Money value={perf?.revenue ?? 0} dp={0} prefix="revenue " />}
        />
        <StatCard
          label="Profit"
          value={<Money value={perf?.profit ?? 0} dp={0} signed />}
          sub={perf ? <Percent value={perf.margin_pct} /> : 'No sales yet'}
        />
      </div>

      <Tabs defaultValue="formula">
        <TabsList>
          <TabsTrigger value="formula">Formula</TabsTrigger>
          <TabsTrigger value="batches">Batches</TabsTrigger>
          <TabsTrigger value="stock">Stock &amp; sales</TabsTrigger>
        </TabsList>

        <TabsContent value="formula">
          {formula ? (
            <FormulaBuilder key={ink.id} ink={ink} formula={formula} />
          ) : (
            <Skeleton className="h-64 w-full" />
          )}
        </TabsContent>

        <TabsContent value="batches">
          <DataTable
            columns={batchColumns}
            rows={batches}
            loading={batchesLoading}
            rowKey={(r) => r.id}
            onRowClick={(r) => router.push(`/production/${r.id}`)}
            defaultSort={{ key: 'production_date', dir: 'desc' }}
            empty={
              <EmptyState
                title="This ink has never been produced"
                description="Run a batch and the actual cost per kg will appear here, next to the theoretical cost — that gap is where formula drift shows up."
                action={
                  <Button asChild>
                    <Link href={`/production/new?ink=${ink.id}`}>Start a batch</Link>
                  </Button>
                }
              />
            }
          />
        </TabsContent>

        <TabsContent value="stock">
          <div className="space-y-5">
            {topCustomers.length > 0 && (
              <Card className="overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle>Who buys this ink</CardTitle>
                </CardHeader>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">Volume</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                      <TableHead className="text-right">Avg price/kg</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topCustomers.slice(0, 8).map((c) => (
                      <TableRow key={c.name}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="num text-right">
                          <Weight value={c.kg} />
                        </TableCell>
                        <TableCell className="num text-right">
                          <Money value={c.revenue} dp={0} />
                        </TableCell>
                        <TableCell className="num text-right">
                          <Money value={c.profit} dp={0} signed />
                        </TableCell>
                        <TableCell className="num text-right">
                          <Rate value={c.kg > 0 ? c.revenue / c.kg : 0} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}

            <div>
              <h2 className="mb-2 text-sm font-semibold">Movement ledger</h2>
              <MovementLedger movements={movements} loading={movementsLoading} />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <InkForm open={editOpen} onOpenChange={setEditOpen} ink={ink} />
      <AdjustStockDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        itemType="ink"
        itemId={ink.id}
        itemName={ink.name}
        currentStockKg={num(ink.current_stock_kg)}
      />
    </>
  )
}
