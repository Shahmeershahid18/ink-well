'use client'

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatDate, formatMoney, num } from '@/lib/format'
import { ChartTooltip } from '@/components/charts/chart-tooltip'

/**
 * One series, so no legend: the card title says what the line is. The last point
 * is labelled directly — that is the number you actually came to read.
 */
export function PriceHistoryChart({
  data,
}: {
  data: { created_at: string; cost_per_kg: number }[]
}) {
  const points = data.map((d) => ({
    date: d.created_at,
    price: num(d.cost_per_kg),
  }))
  const last = points[points.length - 1]
  const first = points[0]
  const change = first && last && first.price ? ((last.price - first.price) / first.price) * 100 : 0

  return (
    <div>
      <div className="mb-2 flex items-baseline gap-2">
        <span className="num text-xl font-semibold">{formatMoney(last?.price, 2)}</span>
        <span className="text-xs text-[var(--muted-foreground)]">per kg landed, latest</span>
        {points.length > 1 && (
          <span
            className={`num ml-auto text-xs ${
              change > 0 ? 'text-[var(--danger)]' : change < 0 ? 'text-[var(--ok)]' : ''
            }`}
          >
            {change > 0 ? '+' : ''}
            {change.toFixed(1)}% since {formatDate(first.date)}
          </span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(v) => formatDate(v).slice(0, 6)}
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(v) => formatMoney(v, 0)}
          />
          <Tooltip
            content={<ChartTooltip valueFormatter={(v) => `${formatMoney(v, 2)} / kg`} />}
            cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
          />
          <Line
            type="monotone"
            dataKey="price"
            name="Landed cost"
            stroke="var(--chart-purchases)"
            strokeWidth={2}
            dot={{ r: 4, strokeWidth: 0, fill: 'var(--chart-purchases)' }}
            activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--card)' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
