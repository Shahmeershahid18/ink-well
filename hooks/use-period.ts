'use client'

import * as React from 'react'
import { addDays, toDateInput } from '@/lib/format'
import type { PeriodPreset } from '@/lib/constants'

export interface Period {
  preset: PeriodPreset
  from: string
  to: string
  /** The equal-length window immediately before, for the % change pills. */
  prevFrom: string
  prevTo: string
  grain: 'day' | 'month'
  label: string
}

function rangeFor(preset: PeriodPreset, customFrom: string, customTo: string) {
  const now = new Date()
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  switch (preset) {
    case 'today':
      return { from: toDateInput(t), to: toDateInput(t), label: 'Today' }
    case '7d':
      return { from: toDateInput(addDays(t, -6)), to: toDateInput(t), label: 'Last 7 days' }
    case '30d':
      return { from: toDateInput(addDays(t, -29)), to: toDateInput(t), label: 'Last 30 days' }
    case 'month':
      return {
        from: toDateInput(new Date(t.getFullYear(), t.getMonth(), 1)),
        to: toDateInput(t),
        label: 'This month',
      }
    case 'year':
      return {
        from: toDateInput(new Date(t.getFullYear(), 0, 1)),
        to: toDateInput(t),
        label: 'This year',
      }
    default:
      return { from: customFrom, to: customTo, label: 'Custom range' }
  }
}

export function usePeriod(initial: PeriodPreset = '30d') {
  const [preset, setPreset] = React.useState<PeriodPreset>(initial)
  const today = toDateInput(new Date())
  const [customFrom, setCustomFrom] = React.useState(toDateInput(addDays(new Date(), -29)))
  const [customTo, setCustomTo] = React.useState(today)

  const period: Period = React.useMemo(() => {
    const { from, to, label } = rangeFor(preset, customFrom, customTo)
    const fromD = new Date(`${from}T00:00:00`)
    const toD = new Date(`${to}T00:00:00`)
    const days = Math.max(Math.round((toD.getTime() - fromD.getTime()) / 86_400_000) + 1, 1)

    return {
      preset,
      from,
      to,
      prevFrom: toDateInput(addDays(fromD, -days)),
      prevTo: toDateInput(addDays(fromD, -1)),
      grain: days > 92 ? 'month' : 'day',
      label,
    }
  }, [preset, customFrom, customTo])

  return {
    period,
    preset,
    setPreset,
    customFrom,
    customTo,
    setCustomFrom,
    setCustomTo,
  }
}
