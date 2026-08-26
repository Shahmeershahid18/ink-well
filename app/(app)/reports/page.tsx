'use client'

import * as React from 'react'
import Link from 'next/link'
import { Download, Printer } from 'lucide-react'
import { usePeriod } from '@/hooks/use-period'
import { useProfitLoss } from '@/lib/queries/dashboard'
import { useDashboardSummary } from '@/lib/queries/dashboard'
import { useInkProfitability } from '@/lib/queries/inks'
import { useMaterialUsage, useRawMaterials } from '@/lib/queries/materials'
import { useInks } from '@/lib/queries/inks'
import { useCustomerSummary, useSupplierSummary } from '@/lib/queries/parties'
import { formatDate, formatMonth, num } from '@/lib/format'
import { downloadCsv } from '@/lib/csv'
import type {
  ProfitLossRow,
  VCustomerSummary,
  VInkProfitability,
  VMaterialUsage,
  VSupplierSummary,
} from '@/types/database'
import { PageHeader } from '@/components/shared/page-header'
import { PeriodSelector } from '@/components/dashboard/period-selector'
import { DataTable, type Column } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/empty-state'
import { Money, Percent, Rate, Weight } from '@/components/shared/money'
import { InkName } from '@/components/shared/badges'
import { StatCard } from '@/components/shared/stat-card'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function ReportsPage() {
  const { period, preset, setPreset, customFrom, customTo, setCustomFrom, setCustomTo } =
    usePeriod('year')

  return (
    <>
      <PageHeader
        title="Reports"
        description={`${period.label} · ${period.from} to ${period.to}`}
        actions={
          <>
            <PeriodSelector
              preset={preset}
              onPresetChange={setPreset}
              customFrom={customFrom}
              customTo={customTo}
              onCustomFromChange={setCustomFrom}
              onCustomToChange={setCustomTo}
            />
            <Button variant="outline" onClick={() => window.print()} className="no-print">
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </>
        }
      />

      <Tabs defaultValue="pl">
        <TabsList className="no-print flex-wrap">
          <TabsTrigger value="pl">Profit &amp; loss</TabsTrigger>
          <TabsTrigger value="inks">Ink profitability</TabsTrigger>
          <TabsTrigger value="materials">Material usage</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          <TabsTrigger value="valuation">Stock valuation</TabsTrigger>
        </TabsList>

        <TabsContent value="pl">
          <ProfitLossReport from={period.from} to={period.to} />
        </TabsContent>
        <TabsContent value="inks">
          <InkProfitabilityReport />
        </TabsContent>
        <TabsContent value="materials">
          <MaterialUsageReport />
        </TabsContent>
        <TabsContent value="customers">
          <CustomerStatementReport />
        </TabsContent>
        <TabsContent value="suppliers">
          <SupplierStatementReport />
        </TabsContent>
        <TabsContent value="valuation">
          <StockValuationReport />
        </TabsContent>
      </Tabs>
    </>
  )
}

/* ─────────────── PROFIT & LOSS ─────────────── */

function ProfitLossReport({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useProfitLoss(from, to)
  const { data: summary } = useDashboardSummary(from, to)

  const rows = data ?? []
  const totals = rows.reduce(
    (acc, r) => ({
      revenue: acc.revenue + num(r.revenue),
      cogs: acc.cogs + num(r.cogs),
      gross: acc.gross + num(r.gross_profit),
      purchases: acc.purchases + num(r.purchases),
      production: acc.production + num(r.production_cost),
      producedKg: acc.producedKg + num(r.produced_kg),
    }),
    { revenue: 0, cogs: 0, gross: 0, purchases: 0, production: 0, producedKg: 0 },
  )
  const marginPct = totals.revenue > 0 ? (totals.gross / totals.revenue) * 100 : 0

  const columns: Column<ProfitLossRow>[] = [
    { key: 'month', header: 'Month', cell: (r) => formatMonth(r.month) },
    {
      key: 'revenue',
      header: 'Revenue',
      numeric: true,
      cell: (r) => <Money value={r.revenue} dp={0} />,
    },
    { key: 'cogs', header: 'COGS', numeric: true, cell: (r) => <Money value={r.cogs} dp={0} /> },
    {
      key: 'gross_profit',
      header: 'Gross profit',
      numeric: true,
      cell: (r) => <Money value={r.gross_profit} dp={0} signed />,
    },
    {
      key: 'margin_pct',
      header: 'Margin',
      numeric: true,
      cell: (r) => <Percent value={r.margin_pct} />,
    },
    {
      key: 'purchases',
      header: 'Purchases',
      numeric: true,
      hideBelow: 'md',
      cell: (r) => <Money value={r.purchases} dp={0} />,
    },
    {
      key: 'production_cost',
      header: 'Production cost',
      numeric: true,
      hideBelow: 'lg',
      cell: (r) => <Money value={r.production_cost} dp={0} />,
    },
    {
      key: 'produced_kg',
      header: 'Produced',
      numeric: true,
      hideBelow: 'lg',
      cell: (r) => <Weight value={r.produced_kg} />,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Revenue" value={<Money value={totals.revenue} compact />} sub="Confirmed sales" />
        <StatCard label="Cost of goods sold" value={<Money value={totals.cogs} compact />} sub="At snapshot cost" />
        <StatCard
          label="Gross profit"
          value={<Money value={totals.gross} compact signed />}
          sub={<Percent value={marginPct} />}
        />
        <StatCard
          label="Closing inventory"
          value={<Money value={summary?.inventory_value} compact />}
          sub="Raw + ink, at weighted average"
        />
      </div>

      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          className="no-print"
          onClick={() =>
            downloadCsv(`profit-and-loss-${from}-to-${to}`, rows, [
              { header: 'Month', value: (r) => r.month },
              { header: 'Revenue', value: (r) => num(r.revenue) },
              { header: 'COGS', value: (r) => num(r.cogs) },
              { header: 'Gross profit', value: (r) => num(r.gross_profit) },
              { header: 'Margin %', value: (r) => num(r.margin_pct) },
              { header: 'Purchases', value: (r) => num(r.purchases) },
              { header: 'Production cost', value: (r) => num(r.production_cost) },
              { header: 'Produced kg', value: (r) => num(r.produced_kg) },
            ])
          }
        >
          <Download className="h-4 w-4" />
          CSV
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={isLoading}
        rowKey={(r) => r.month}
        empty={<EmptyState title="Nothing in this period" description="Widen the date range." />}
        footer={
          <tr>
            <td className="px-3 py-2 font-medium">Total</td>
            <td className="num px-3 py-2 text-right font-medium">
              <Money value={totals.revenue} dp={0} />
            </td>
            <td className="num px-3 py-2 text-right font-medium">
              <Money value={totals.cogs} dp={0} />
            </td>
            <td className="num px-3 py-2 text-right font-medium">
              <Money value={totals.gross} dp={0} signed />
            </td>
            <td className="num px-3 py-2 text-right font-medium">
              <Percent value={marginPct} />
            </td>
            <td className="num hidden px-3 py-2 text-right font-medium md:table-cell">
              <Money value={totals.purchases} dp={0} />
            </td>
            <td className="num hidden px-3 py-2 text-right font-medium lg:table-cell">
              <Money value={totals.production} dp={0} />
            </td>
            <td className="num hidden px-3 py-2 text-right font-medium lg:table-cell">
              <Weight value={totals.producedKg} />
            </td>
          </tr>
        }
      />
    </div>
  )
}

/* ─────────────── INK PROFITABILITY ─────────────── */

function InkProfitabilityReport() {
  const { data, isLoading } = useInkProfitability()
  const rows = data ?? []
  const belowCost = rows.filter((r) => num(r.sold_kg) > 0 && num(r.profit) < 0)

  const columns: Column<VInkProfitability>[] = [
    {
      key: 'name',
      header: 'Ink',
      sortValue: (r) => r.name,
      cell: (r) => (
        <Link href={`/inks/${r.id}`} className="hover:underline">
          <InkName name={r.name} color={r.color_hex} code={r.code} />
        </Link>
      ),
    },
    {
      key: 'produced_kg',
      header: 'Produced',
      numeric: true,
      hideBelow: 'md',
      sortValue: (r) => num(r.produced_kg),
      cell: (r) => <Weight value={r.produced_kg} />,
    },
    {
      key: 'sold_kg',
      header: 'Sold',
      numeric: true,
      sortValue: (r) => num(r.sold_kg),
      cell: (r) => <Weight value={r.sold_kg} />,
    },
    {
      key: 'avg_price_per_kg',
      header: 'Avg price/kg',
      numeric: true,
      hideBelow: 'sm',
      sortValue: (r) => num(r.avg_price_per_kg),
      cell: (r) => <Rate value={r.avg_price_per_kg} />,
    },
    {
      key: 'revenue',
      header: 'Revenue',
      numeric: true,
      sortValue: (r) => num(r.revenue),
      cell: (r) => <Money value={r.revenue} dp={0} />,
    },
    {
      key: 'cost',
      header: 'Cost',
      numeric: true,
      hideBelow: 'lg',
      sortValue: (r) => num(r.cost),
      cell: (r) => <Money value={r.cost} dp={0} />,
    },
    {
      key: 'profit',
      header: 'Profit',
      numeric: true,
      sortValue: (r) => num(r.profit),
      cell: (r) => <Money value={r.profit} dp={0} signed />,
    },
    {
      key: 'margin_pct',
      header: 'Margin',
      numeric: true,
      sortValue: (r) => num(r.margin_pct),
      cell: (r) => <Percent value={r.margin_pct} signed />,
    },
  ]

  return (
    <div className="space-y-3">
      {belowCost.length > 0 && (
        <Card className="border-[var(--danger)] p-3 text-sm">
          <span className="font-medium text-[var(--danger)]">
            {belowCost.length} ink{belowCost.length === 1 ? '' : 's'} sold at a loss:
          </span>{' '}
          {belowCost.map((r) => r.name).join(', ')}
        </Card>
      )}

      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          className="no-print"
          onClick={() =>
            downloadCsv('ink-profitability', rows, [
              { header: 'Ink', value: (r) => r.name },
              { header: 'Code', value: (r) => r.code },
              { header: 'Produced kg', value: (r) => num(r.produced_kg) },
              { header: 'Sold kg', value: (r) => num(r.sold_kg) },
              { header: 'Revenue', value: (r) => num(r.revenue) },
              { header: 'Cost', value: (r) => num(r.cost) },
              { header: 'Profit', value: (r) => num(r.profit) },
              { header: 'Margin %', value: (r) => num(r.margin_pct) },
              { header: 'Stock kg', value: (r) => num(r.current_stock_kg) },
              { header: 'Stock value', value: (r) => num(r.stock_value) },
            ])
          }
        >
          <Download className="h-4 w-4" />
          CSV
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={isLoading}
        rowKey={(r) => r.id}
        defaultSort={{ key: 'profit', dir: 'desc' }}
        rowClassName={(r) =>
          num(r.sold_kg) > 0 && num(r.profit) < 0 ? 'bg-[var(--danger-soft)]/30' : undefined
        }
        empty={<EmptyState title="No inks yet" description="Create an ink to start tracking it." />}
      />
    </div>
  )
}

/* ─────────────── MATERIAL USAGE ─────────────── */

function MaterialUsageReport() {
  const { data, isLoading } = useMaterialUsage()
  const rows = (data ?? []).filter((r) => r.is_active)

  const columns: Column<VMaterialUsage>[] = [
    {
      key: 'name',
      header: 'Material',
      sortValue: (r) => r.name,
      cell: (r) => (
        <Link href={`/raw-materials/${r.id}`} className="font-medium hover:underline">
          {r.name}
        </Link>
      ),
    },
    {
      key: 'purchased_kg',
      header: 'Purchased',
      numeric: true,
      sortValue: (r) => num(r.purchased_kg),
      cell: (r) => <Weight value={r.purchased_kg} />,
    },
    {
      key: 'consumed_kg',
      header: 'Consumed',
      numeric: true,
      sortValue: (r) => num(r.consumed_kg),
      cell: (r) => <Weight value={r.consumed_kg} />,
    },
    {
      key: 'current_stock_kg',
      header: 'Closing',
      numeric: true,
      sortValue: (r) => num(r.current_stock_kg),
      cell: (r) => <Weight value={r.current_stock_kg} />,
    },
    {
      key: 'stock_value',
      header: 'Value',
      numeric: true,
      sortValue: (r) => num(r.stock_value),
      cell: (r) => <Money value={r.stock_value} dp={0} />,
    },
    {
      key: 'consumed_kg_90',
      header: 'Used (90 days)',
      numeric: true,
      hideBelow: 'md',
      sortValue: (r) => num(r.consumed_kg_90),
      cell: (r) => <Weight value={r.consumed_kg_90} />,
    },
    {
      key: 'days_of_cover',
      header: 'Days of cover',
      numeric: true,
      sortValue: (r) => (r.days_of_cover == null ? Number.MAX_SAFE_INTEGER : num(r.days_of_cover)),
      cell: (r) =>
        r.days_of_cover == null ? (
          <span className="text-[var(--muted-foreground)]">—</span>
        ) : (
          <span
            className={
              num(r.days_of_cover) < 14
                ? 'text-[var(--danger)]'
                : num(r.days_of_cover) < 30
                  ? 'text-[var(--warn)]'
                  : undefined
            }
          >
            {num(r.days_of_cover).toFixed(0)}
          </span>
        ),
    },
  ]

  return (
    <div className="space-y-3">
      <Card className="p-3 text-xs text-[var(--muted-foreground)]">
        Days of cover is closing stock divided by average daily consumption over the last 90 days —
        a better reorder signal than a static level, because it moves with how fast you actually use
        the material.
      </Card>

      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          className="no-print"
          onClick={() =>
            downloadCsv('material-usage', rows, [
              { header: 'Material', value: (r) => r.name },
              { header: 'Code', value: (r) => r.code },
              { header: 'Category', value: (r) => r.category },
              { header: 'Purchased kg', value: (r) => num(r.purchased_kg) },
              { header: 'Consumed kg', value: (r) => num(r.consumed_kg) },
              { header: 'Closing kg', value: (r) => num(r.current_stock_kg) },
              { header: 'Avg cost/kg', value: (r) => num(r.avg_cost_per_kg) },
              { header: 'Stock value', value: (r) => num(r.stock_value) },
              { header: 'Used last 90 days kg', value: (r) => num(r.consumed_kg_90) },
              { header: 'Days of cover', value: (r) => r.days_of_cover },
            ])
          }
        >
          <Download className="h-4 w-4" />
          CSV
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={isLoading}
        rowKey={(r) => r.id}
        defaultSort={{ key: 'days_of_cover', dir: 'asc' }}
        empty={<EmptyState title="No materials yet" />}
      />
    </div>
  )
}

/* ─────────────── CUSTOMERS ─────────────── */

function CustomerStatementReport() {
  const { data, isLoading } = useCustomerSummary()
  const rows = data ?? []

  const columns: Column<VCustomerSummary>[] = [
    {
      key: 'name',
      header: 'Customer',
      sortValue: (r) => r.name,
      cell: (r) => (
        <Link href={`/customers/${r.id}`} className="font-medium hover:underline">
          {r.name}
        </Link>
      ),
    },
    {
      key: 'orders',
      header: 'Orders',
      numeric: true,
      sortValue: (r) => num(r.orders),
      cell: (r) => num(r.orders),
    },
    {
      key: 'total_kg',
      header: 'Volume',
      numeric: true,
      sortValue: (r) => num(r.total_kg),
      cell: (r) => <Weight value={r.total_kg} />,
    },
    {
      key: 'revenue',
      header: 'Revenue',
      numeric: true,
      sortValue: (r) => num(r.revenue),
      cell: (r) => <Money value={r.revenue} dp={0} />,
    },
    {
      key: 'profit',
      header: 'Profit',
      numeric: true,
      sortValue: (r) => num(r.profit),
      cell: (r) => <Money value={r.profit} dp={0} signed />,
    },
    {
      key: 'receivable',
      header: 'Receivable',
      numeric: true,
      sortValue: (r) => num(r.receivable),
      cell: (r) => (
        <Money
          value={r.receivable}
          dp={0}
          className={num(r.receivable) > 0.005 ? 'text-[var(--warn)]' : undefined}
        />
      ),
    },
    {
      key: 'last_order_date',
      header: 'Last order',
      align: 'right',
      hideBelow: 'md',
      sortValue: (r) => r.last_order_date ?? '',
      cell: (r) => (r.last_order_date ? formatDate(r.last_order_date) : 'Never'),
    },
  ]

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          className="no-print"
          onClick={() =>
            downloadCsv('customer-statement', rows, [
              { header: 'Customer', value: (r) => r.name },
              { header: 'Company', value: (r) => r.company },
              { header: 'Phone', value: (r) => r.phone },
              { header: 'Orders', value: (r) => num(r.orders) },
              { header: 'Volume kg', value: (r) => num(r.total_kg) },
              { header: 'Revenue', value: (r) => num(r.revenue) },
              { header: 'Profit', value: (r) => num(r.profit) },
              { header: 'Receivable', value: (r) => num(r.receivable) },
              { header: 'Last order', value: (r) => r.last_order_date },
            ])
          }
        >
          <Download className="h-4 w-4" />
          CSV
        </Button>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        loading={isLoading}
        rowKey={(r) => r.id}
        defaultSort={{ key: 'revenue', dir: 'desc' }}
        empty={<EmptyState title="No customers yet" />}
      />
    </div>
  )
}

/* ─────────────── SUPPLIERS ─────────────── */

function SupplierStatementReport() {
  const { data, isLoading } = useSupplierSummary()
  const rows = data ?? []

  const columns: Column<VSupplierSummary>[] = [
    {
      key: 'name',
      header: 'Supplier',
      sortValue: (r) => r.name,
      cell: (r) => (
        <Link href={`/suppliers/${r.id}`} className="font-medium hover:underline">
          {r.name}
        </Link>
      ),
    },
    {
      key: 'purchase_count',
      header: 'Purchases',
      numeric: true,
      sortValue: (r) => num(r.purchase_count),
      cell: (r) => num(r.purchase_count),
    },
    {
      key: 'total_spend',
      header: 'Total spend',
      numeric: true,
      sortValue: (r) => num(r.total_spend),
      cell: (r) => <Money value={r.total_spend} dp={0} />,
    },
    {
      key: 'payable',
      header: 'Payable',
      numeric: true,
      sortValue: (r) => num(r.payable),
      cell: (r) => (
        <Money
          value={r.payable}
          dp={0}
          className={num(r.payable) > 0.005 ? 'text-[var(--warn)]' : undefined}
        />
      ),
    },
    {
      key: 'last_purchase_date',
      header: 'Last purchase',
      align: 'right',
      hideBelow: 'md',
      sortValue: (r) => r.last_purchase_date ?? '',
      cell: (r) => (r.last_purchase_date ? formatDate(r.last_purchase_date) : 'Never'),
    },
  ]

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          className="no-print"
          onClick={() =>
            downloadCsv('supplier-statement', rows, [
              { header: 'Supplier', value: (r) => r.name },
              { header: 'Company', value: (r) => r.company },
              { header: 'Phone', value: (r) => r.phone },
              { header: 'Purchases', value: (r) => num(r.purchase_count) },
              { header: 'Total spend', value: (r) => num(r.total_spend) },
              { header: 'Payable', value: (r) => num(r.payable) },
              { header: 'Last purchase', value: (r) => r.last_purchase_date },
            ])
          }
        >
          <Download className="h-4 w-4" />
          CSV
        </Button>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        loading={isLoading}
        rowKey={(r) => r.id}
        defaultSort={{ key: 'total_spend', dir: 'desc' }}
        empty={<EmptyState title="No suppliers yet" />}
      />
    </div>
  )
}

/* ─────────────── STOCK VALUATION ─────────────── */

interface ValuationRow {
  id: string
  kind: 'Raw material' | 'Ink'
  name: string
  code: string | null
  stockKg: number
  costPerKg: number
  value: number
  color?: string | null
}

function StockValuationReport() {
  const { data: materials, isLoading: materialsLoading } = useRawMaterials()
  const { data: inks, isLoading: inksLoading } = useInks()

  const rows: ValuationRow[] = React.useMemo(
    () => [
      ...(materials ?? []).map((m) => ({
        id: m.id,
        kind: 'Raw material' as const,
        name: m.name,
        code: m.code,
        stockKg: num(m.current_stock_kg),
        costPerKg: num(m.avg_cost_per_kg),
        value: num(m.current_stock_kg) * num(m.avg_cost_per_kg),
      })),
      ...(inks ?? []).map((i) => ({
        id: i.id,
        kind: 'Ink' as const,
        name: i.name,
        code: i.code,
        stockKg: num(i.current_stock_kg),
        costPerKg: num(i.avg_cost_per_kg),
        value: num(i.current_stock_kg) * num(i.avg_cost_per_kg),
        color: i.color_hex,
      })),
    ],
    [materials, inks],
  )

  const rawValue = rows.filter((r) => r.kind === 'Raw material').reduce((s, r) => s + r.value, 0)
  const inkValue = rows.filter((r) => r.kind === 'Ink').reduce((s, r) => s + r.value, 0)

  const columns: Column<ValuationRow>[] = [
    {
      key: 'name',
      header: 'Item',
      sortValue: (r) => r.name,
      cell: (r) =>
        r.kind === 'Ink' ? (
          <Link href={`/inks/${r.id}`} className="hover:underline">
            <InkName name={r.name} color={r.color} code={r.code} />
          </Link>
        ) : (
          <Link href={`/raw-materials/${r.id}`} className="font-medium hover:underline">
            {r.name}
            {r.code && (
              <span className="ml-2 text-xs text-[var(--muted-foreground)]">{r.code}</span>
            )}
          </Link>
        ),
    },
    { key: 'kind', header: 'Type', sortValue: (r) => r.kind, cell: (r) => r.kind },
    {
      key: 'stockKg',
      header: 'Quantity',
      numeric: true,
      sortValue: (r) => r.stockKg,
      cell: (r) => <Weight value={r.stockKg} />,
    },
    {
      key: 'costPerKg',
      header: 'Weighted avg cost/kg',
      numeric: true,
      sortValue: (r) => r.costPerKg,
      cell: (r) => <Rate value={r.costPerKg} dp={4} />,
    },
    {
      key: 'value',
      header: 'Value',
      numeric: true,
      sortValue: (r) => r.value,
      cell: (r) => <Money value={r.value} />,
    },
  ]

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Raw material value" value={<Money value={rawValue} compact />} sub={`${rows.filter((r) => r.kind === 'Raw material').length} items`} />
        <StatCard label="Finished ink value" value={<Money value={inkValue} compact />} sub={`${rows.filter((r) => r.kind === 'Ink').length} inks`} />
        <StatCard
          label="Total closing stock"
          value={<Money value={rawValue + inkValue} compact />}
          sub="Your closing-stock figure for accounting"
        />
      </div>

      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          className="no-print"
          onClick={() =>
            downloadCsv('stock-valuation', rows, [
              { header: 'Item', value: (r) => r.name },
              { header: 'Code', value: (r) => r.code },
              { header: 'Type', value: (r) => r.kind },
              { header: 'Quantity kg', value: (r) => r.stockKg },
              { header: 'Weighted avg cost/kg', value: (r) => r.costPerKg },
              { header: 'Value', value: (r) => r.value },
            ])
          }
        >
          <Download className="h-4 w-4" />
          CSV
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={materialsLoading || inksLoading}
        rowKey={(r) => `${r.kind}-${r.id}`}
        defaultSort={{ key: 'value', dir: 'desc' }}
        empty={<EmptyState title="Nothing in stock" />}
        footer={
          <tr>
            <td colSpan={4} className="px-3 py-2 text-right font-medium">
              Total closing stock value
            </td>
            <td className="num px-3 py-2 text-right font-semibold">
              <Money value={rawValue + inkValue} />
            </td>
          </tr>
        }
      />
    </div>
  )
}
