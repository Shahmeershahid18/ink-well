'use client'

import * as React from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { cn } from '@/lib/utils'
import { formatDate, formatMoney, formatMoneyCompact, formatMonth, num } from '@/lib/format'
import type { TrendPoint } from '@/types/database'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type MetricKey = 'revenue' | 'purchases' | 'profit'

const METRICS: { key: MetricKey; label: string; color: string; hint: string }[] = [
  { key: 'revenue', label: 'Revenue', color: 'var(--chart-revenue)', hint: 'Ink sold, before cost' },
  {
    key: 'purchases',
    label: 'Purchases',
    color: 'var(--chart-purchases)',
    hint: 'Material bought, landed',
  },
  { key: 'profit', label: 'Gross profit', color: 'var(--chart-profit)', hint: 'Revenue less COGS' },
]

/**
 * One measure at a time. Three money series stacked on one axis was noise — the
 * switcher keeps every total visible while the plot stays a single readable shape,
 * which also means no legend is needed: the active tile names the line.
 */
export function TrendChart({
  data,
  grain,
  loading,
}: {
  data: TrendPoint[] | undefined
  grain: 'day' | 'month'
  loading?: boolean
}) {
  const [metric, setMetric] = React.useState<MetricKey>('revenue')
  const [view, setView] = React.useState<'chart' | 'table'>('chart')

  const points = React.useMemo(
    () =>
      (data ?? []).map((d) => ({
        bucket: d.bucket,
        revenue: num(d.revenue),
        purchases: num(d.purchases),
        profit: num(d.profit),
        cogs: num(d.cogs),
      })),
    [data],
  )

  const totals = React.useMemo(
    () => ({
      revenue: points.reduce((s, p) => s + p.revenue, 0),
      purchases: points.reduce((s, p) => s + p.purchases, 0),
      profit: points.reduce((s, p) => s + p.profit, 0),
    }),
    [points],
  )

  const active = METRICS.find((m) => m.key === metric)!
  const hasData = points.some((p) => p.revenue || p.purchases || p.profit)
  const label = (value: unknown) => (grain === 'month' ? formatMonth(value) : formatDate(value))

  return (
    <Card className="overflow-hidden">
      {/* metric tiles double as the switcher */}
      {/* Three across even on a phone — stacked, they pushed the plot off screen. */}
      <div className="grid grid-cols-3 divide-x divide-[var(--border)] border-b border-[var(--border)]">
        {METRICS.map((m) => {
          const isActive = m.key === metric
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetric(m.key)}
              aria-pressed={isActive}
              className={cn(
                'relative px-2.5 py-2.5 text-left transition-colors sm:px-4 sm:py-3',
                isActive ? 'bg-[var(--muted)]/50' : 'hover:bg-[var(--muted)]/30',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'absolute inset-x-0 top-0 h-0.5 transition-opacity',
                  isActive ? 'opacity-100' : 'opacity-0',
                )}
                style={{ background: m.color }}
              />
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: m.color, opacity: isActive ? 1 : 0.4 }}
                  aria-hidden
                />
                <span
                  className={cn(
                    'truncate text-[11px] font-medium sm:text-xs',
                    isActive ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]',
                  )}
                >
                  {m.label}
                </span>
              </span>
              <span className="num mt-1 block text-base font-semibold tracking-tight sm:text-xl">
                {formatMoneyCompact(totals[m.key])}
              </span>
              <span className="mt-0.5 hidden truncate text-[11px] text-[var(--muted-foreground)] sm:block">
                {m.hint}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between px-4 pb-1 pt-3">
        <p className="text-xs text-[var(--muted-foreground)]">
          {active.label} by {grain === 'month' ? 'month' : 'day'}
        </p>
        <div className="inline-flex rounded-md border border-[var(--border)] p-0.5">
          {(['chart', 'table'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={cn(
                'rounded px-2 py-0.5 text-[11px] font-medium capitalize transition-colors',
                view === v
                  ? 'bg-[var(--secondary)] text-[var(--foreground)]'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="px-1 pb-3">
        {loading ? (
          <Skeleton className="mx-3 h-64" />
        ) : !hasData ? (
          <EmptyState
            title="Nothing recorded in this period"
            description="Record a purchase or a sale and the trend will start filling in."
          />
        ) : view === 'table' ? (
          <div className="max-h-64 overflow-auto px-3">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{grain === 'month' ? 'Month' : 'Day'}</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Purchases</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {points.map((p) => (
                  <TableRow key={p.bucket}>
                    <TableCell className="whitespace-nowrap">{label(p.bucket)}</TableCell>
                    <TableCell className="num text-right">{formatMoney(p.revenue, 0)}</TableCell>
                    <TableCell className="num text-right">{formatMoney(p.purchases, 0)}</TableCell>
                    <TableCell className="num text-right">{formatMoney(p.profit, 0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={points} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={active.color} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={active.color} stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey="bucket"
                tickFormatter={(v) =>
                  grain === 'month' ? formatMonth(v).slice(0, 3) : formatDate(v).slice(0, 6)
                }
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                tickLine={false}
                axisLine={false}
                width={52}
                tickFormatter={(v) => formatMoneyCompact(v)}
              />
              <Tooltip
                cursor={{ stroke: 'var(--muted-foreground)', strokeWidth: 1, strokeDasharray: '3 3' }}
                content={({ active: isActive, payload, label: l }) => {
                  if (!isActive || !payload?.length) return null
                  const row = payload[0].payload as (typeof points)[number]
                  return (
                    <div className="rounded-md border border-[var(--border)] bg-[var(--popover)] px-2.5 py-2 text-xs shadow-md">
                      <div className="mb-1.5 font-medium">{label(l)}</div>
                      {METRICS.map((m) => (
                        <div key={m.key} className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ background: m.color, opacity: m.key === metric ? 1 : 0.4 }}
                            aria-hidden
                          />
                          <span className="text-[var(--muted-foreground)]">{m.label}</span>
                          <span
                            className={cn(
                              'num ml-auto pl-4',
                              m.key === metric && 'font-semibold',
                            )}
                          >
                            {formatMoney(row[m.key], 0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                }}
              />
              <Area
                type="monotone"
                dataKey={metric}
                name={active.label}
                stroke={active.color}
                strokeWidth={2}
                fill="url(#trend-fill)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--card)' }}
                isAnimationActive
                animationDuration={450}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  )
}
