'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import type { BatchFull, BatchWithInk } from '@/types/database'
import { db, unwrap, useInvalidateMoneyEvent } from './helpers'
import { qk } from './keys'

export interface BatchFilters {
  inkId?: string
  status?: string
  from?: string
  to?: string
}

export function useBatches(filters: BatchFilters = {}) {
  return useQuery({
    queryKey: [...qk.batches, filters],
    queryFn: async () => {
      let q = db()
        .from('production_batches')
        .select(
          '*, ink:inks(id, name, code, color_hex, batch_size_kg, packaging_cost_per_kg, expected_wastage_pct)',
        )
        .order('production_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(500)

      if (filters.inkId) q = q.eq('ink_id', filters.inkId)
      if (filters.status) q = q.eq('status', filters.status)
      if (filters.from) q = q.gte('production_date', filters.from)
      if (filters.to) q = q.lte('production_date', filters.to)

      return unwrap<BatchWithInk[]>(await q)
    },
  })
}

export function useBatch(id: string | undefined) {
  return useQuery({
    queryKey: qk.batch(id ?? ''),
    enabled: !!id,
    queryFn: async () =>
      unwrap<BatchFull>(
        await db()
          .from('production_batches')
          .select(
            '*, ink:inks(id, name, code, color_hex, batch_size_kg, packaging_cost_per_kg, expected_wastage_pct), production_consumption(*, raw_material:raw_materials(id, name, code, current_stock_kg, avg_cost_per_kg))',
          )
          .eq('id', id!)
          .single(),
      ),
  })
}

export interface BatchPayload {
  id?: string
  ink_id: string
  batch_no?: string | null
  production_date: string
  planned_qty_kg: number
  labor_cost?: number
  overhead_cost?: number
  notes?: string | null
  items: { raw_material_id: string; quantity_kg: number }[]
}

export function useSaveBatch() {
  const invalidate = useInvalidateMoneyEvent()
  return useMutation({
    mutationFn: async (payload: BatchPayload) =>
      unwrap<string>(await db().rpc('save_production_batch', { payload })),
    onSuccess: invalidate,
  })
}

export function useCompleteBatch() {
  const invalidate = useInvalidateMoneyEvent()
  return useMutation({
    mutationFn: async ({ id, producedQty }: { id: string; producedQty: number }) =>
      unwrap<string>(
        await db().rpc('complete_production_batch', {
          p_batch_id: id,
          p_produced_qty: producedQty,
        }),
      ),
    onSuccess: invalidate,
  })
}

export function useCancelBatch() {
  const invalidate = useInvalidateMoneyEvent()
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) =>
      unwrap<string>(
        await db().rpc('cancel_production_batch', { p_batch_id: id, p_reason: reason ?? null }),
      ),
    onSuccess: invalidate,
  })
}
