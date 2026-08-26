'use client'

import * as React from 'react'
import { Boxes, Receipt, ShoppingCart, TrendingUp } from 'lucide-react'
import { usePeriod } from '@/hooks/use-period'
import { useDashboardSummary, useTrendSeries } from '@/lib/queries/dashboard'
import { formatKg, formatMoneyCompact, num, pctChange } from '@/lib/format'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { Money, Percent } from '@/components/shared/money'
import { PeriodSelector } from '@/components/dashboard/period-selector'
import { TrendChart } from '@/components/dashboard/trend-chart'
import { AlertsPanel } from '@/components/dashboard/alerts-panel'
import { TopInks } from '@/components/dashboard/top-inks'
import { RecentActivity } from '@/components/dashboard/recent-activity'

export default function DashboardPage() {
  const { period, preset, setPreset, customFrom, customTo, setCustomFrom, setCustomTo } =
    usePeriod('30d')

  const { data: summary, isLoading } = useDashboardSummary(period.from, period.to)
  const { data: previous } = useDashboardSummary(period.prevFrom, period.prevTo)
  const { data: trend, isLoading: trendLoading } = useTrendSeries(
    period.from,
    period.to,
    period.grain,
  )

  const purchaseTotal = num(summary?.purchase_total)
  const revenue = num(summary?.revenue)
  const grossProfit = num(summary?.gross_profit)
  const inventoryValue = num(summary?.inventory_value)

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${period.label} · ${period.from} to ${period.to}`}
        actions={
          <PeriodSelector
            preset={preset}
            onPresetChange={setPreset}
            customFrom={customFrom}
            customTo={customTo}
            onCustomFromChange={setCustomFrom}
            onCustomToChange={setCustomTo}
          />
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total investment"
          value={<Money value={purchaseTotal} compact />}
          sub={
            <>
              {num(summary?.purchase_count)} purchases ·{' '}
              <Money value={summary?.payable} compact /> payable
            </>
          }
          change={pctChange(purchaseTotal, num(previous?.purchase_total))}
          invertChange
          icon={<ShoppingCart className="h-4 w-4" />}
          loading={isLoading}
        />

        <StatCard
          label="Inventory value"
          value={<Money value={inventoryValue} compact />}
          sub={`${formatKg(summary?.raw_kg)} kg raw · ${formatKg(summary?.ink_kg)} kg ink`}
          icon={<Boxes className="h-4 w-4" />}
          loading={isLoading}
        />

        <StatCard
          label="Revenue"
          value={<Money value={revenue} compact />}
          sub={
            <>
              {num(summary?.sale_count)} orders ·{' '}
              <Money value={summary?.receivable} compact /> receivable
            </>
          }
          change={pctChange(revenue, num(previous?.revenue))}
          icon={<Receipt className="h-4 w-4" />}
          loading={isLoading}
        />

        <StatCard
          label="Gross profit"
          value={<Money value={grossProfit} compact />}
          sub={
            <>
              <Percent value={summary?.margin_pct} /> margin · COGS{' '}
              {formatMoneyCompact(summary?.cogs)}
            </>
          }
          change={pctChange(grossProfit, num(previous?.gross_profit))}
          icon={<TrendingUp className="h-4 w-4" />}
          loading={isLoading}
        />
      </div>

      <div className="mt-4">
        <TrendChart data={trend} grain={period.grain} loading={trendLoading} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AlertsPanel />
        </div>
        <TopInks />
      </div>

      <div className="mt-4">
        <RecentActivity />
      </div>
    </>
  )
}
