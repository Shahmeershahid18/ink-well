'use client'

import { formatDate, formatMoney } from '@/lib/format'

export interface TooltipPayloadItem {
  name?: string
  dataKey?: string | number
  value?: number | string
  color?: string
  payload?: Record<string, unknown>
}

interface ChartTooltipProps {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string | number
  /** Formats the header. Defaults to a date. */
  labelFormatter?: (label: unknown) => string
  valueFormatter?: (value: number) => string
  /** Adds a derived row that is not a series, e.g. margin %. */
  extra?: (payload: Record<string, unknown>) => React.ReactNode
}

export function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter = (l) => formatDate(l),
  valueFormatter = (v) => formatMoney(v, 0),
  extra,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--popover)] px-2.5 py-2 text-xs shadow-md">
      <div className="mb-1 font-medium">{labelFormatter(label)}</div>
      <div className="flex flex-col gap-0.5">
        {payload.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: item.color }}
              aria-hidden
            />
            <span className="text-[var(--muted-foreground)]">{item.name}</span>
            <span className="num ml-auto pl-4 font-medium">
              {valueFormatter(Number(item.value ?? 0))}
            </span>
          </div>
        ))}
        {extra && payload[0]?.payload && (
          <div className="mt-1 border-t border-[var(--border)] pt-1">
            {extra(payload[0].payload)}
          </div>
        )}
      </div>
    </div>
  )
}
