'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import type { PurchaseFull, PurchaseWithSupplier } from '@/types/database'
import { db, unwrap, useInvalidateMoneyEvent } from './helpers'
import { qk } from './keys'

export interface PurchaseFilters {
  supplierId?: string
  from?: string
  to?: string
  unpaidOnly?: boolean
  status?: string
}

export function usePurchases(filters: PurchaseFilters = {}) {
  return useQuery({
    queryKey: [...qk.purchases, filters],
    queryFn: async () => {
      let q = db()
        .from('purchases')
        .select('*, supplier:suppliers(id, name, company), purchase_items(count)')
        .order('purchase_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(500)

      if (filters.supplierId) q = q.eq('supplier_id', filters.supplierId)
      if (filters.status) q = q.eq('status', filters.status)
      if (filters.from) q = q.gte('purchase_date', filters.from)
      if (filters.to) q = q.lte('purchase_date', filters.to)

      const rows = unwrap<PurchaseWithSupplier[]>(await q)
      return filters.unpaidOnly
        ? rows.filter((r) => Number(r.total) - Number(r.paid_amount) > 0.005)
        : rows
    },
  })
}

export function usePurchase(id: string | undefined) {
  return useQuery({
    queryKey: qk.purchase(id ?? ''),
    enabled: !!id,
    queryFn: async () =>
      unwrap<PurchaseFull>(
        await db()
          .from('purchases')
          .select(
            '*, supplier:suppliers(*), purchase_items(*, raw_material:raw_materials(id, name, code, unit))',
          )
          .eq('id', id!)
          .single(),
      ),
  })
}

export interface PurchasePayload {
  supplier_id: string
  invoice_no?: string | null
  purchase_date: string
  freight_cost?: number
  other_cost?: number
  discount?: number
  paid_amount?: number
  payment_method?: string | null
  notes?: string | null
  idempotency_key: string
  items: { raw_material_id: string; quantity_kg: number; price_per_kg: number }[]
}

export function useRecordPurchase() {
  const invalidate = useInvalidateMoneyEvent()
  return useMutation({
    mutationFn: async (payload: PurchasePayload) =>
      unwrap<string>(await db().rpc('record_purchase', { payload })),
    onSuccess: invalidate,
  })
}

export function useCancelPurchase() {
  const invalidate = useInvalidateMoneyEvent()
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) =>
      unwrap<string>(
        await db().rpc('cancel_purchase', { p_purchase_id: id, p_reason: reason ?? null }),
      ),
    onSuccess: invalidate,
  })
}

/** Suggested next document number, so the field is filled but still editable. */
export function useNextDocumentNo(kind: 'purchase' | 'invoice' | 'batch', enabled = true) {
  return useQuery({
    queryKey: ['doc-no', kind],
    enabled,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    queryFn: async () => unwrap<string>(await db().rpc('next_document_no', { p_kind: kind })),
  })
}
