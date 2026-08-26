'use client'

import { cn } from '@/lib/utils'
import { PERIOD_PRESETS, type PeriodPreset } from '@/lib/constants'
import { Input } from '@/components/ui/input'

interface PeriodSelectorProps {
  preset: PeriodPreset
  onPresetChange: (preset: PeriodPreset) => void
  customFrom: string
  customTo: string
  onCustomFromChange: (value: string) => void
  onCustomToChange: (value: string) => void
  className?: string
}

/** One row of filters above the charts, as the interaction spec asks for. */
export function PeriodSelector({
  preset,
  onPresetChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
  className,
}: PeriodSelectorProps) {
  return (
    <div className={cn('flex w-full flex-wrap items-center gap-2 sm:w-auto', className)}>
      {/* Scrolls rather than wraps on a phone, so the row stays one line. */}
      <div
        className="-mx-1 flex max-w-full snap-x overflow-x-auto rounded-lg border border-[var(--border)] p-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:overflow-visible"
        role="group"
        aria-label="Reporting period"
      >
        {PERIOD_PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => onPresetChange(p.value)}
            aria-pressed={preset === p.value}
            className={cn(
              'shrink-0 snap-start whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              preset === p.value
                ? 'bg-[var(--secondary)] text-[var(--foreground)]'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {preset === 'custom' && (
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Input
            type="date"
            className="h-8 w-full sm:w-36"
            value={customFrom}
            onChange={(e) => onCustomFromChange(e.target.value)}
            aria-label="From date"
          />
          <span className="text-xs text-[var(--muted-foreground)]">to</span>
          <Input
            type="date"
            className="h-8 w-full sm:w-36"
            value={customTo}
            onChange={(e) => onCustomToChange(e.target.value)}
            aria-label="To date"
          />
        </div>
      )}
    </div>
  )
}
