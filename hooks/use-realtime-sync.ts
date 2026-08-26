'use client'

import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { StockAlert } from '@/types/database'

const TABLES = [
  'raw_materials',
  'inks',
  'purchases',
  'sales',
  'production_batches',
  'stock_alerts',
  'inventory_movements',
] as const

/**
 * Realtime is the confirmation, not the mechanism: forms already update optimistically
 * and invalidate on success. This keeps a second tab — or a second device — honest.
 */
export function useRealtimeSync() {
  const queryClient = useQueryClient()

  React.useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel('erp-sync')

    TABLES.forEach((table) => {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload: { eventType: string; new: Record<string, unknown> }) => {
          queryClient.invalidateQueries({ queryKey: [table] })
          queryClient.invalidateQueries({ queryKey: ['dashboard'] })

          if (table === 'stock_alerts' && payload.eventType === 'INSERT') {
            const alert = payload.new as unknown as StockAlert
            if (alert?.message) {
              if (alert.level === 'critical') toast.error(alert.message)
              else toast.warning(alert.message)
            }
          }
        },
      )
    })

    channel.subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])
}

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  useRealtimeSync()
  return children as React.ReactElement
}
