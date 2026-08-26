'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import type { SaleFull, SaleWithCustomer } from '@/types/database'
import { db, unwrap, useInvalidateMoneyEvent } from './helpers'
import { qk } from './keys'

export interface SaleFilters {
  customerId?: string
  from?: string
  to?: string
  unpaidOnly?: boolean
  status?: string
  inkId?: string
}

export function useSales(filters: SaleFilters = {}) {
  return useQuery({
    queryKey: [...qk.sales, filters],
    queryFn: async () => {
      let q = db()
        .from('sales')
        .select('*, customer:customers(id, name, company), sale_items(count)')
        .order('sale_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(500)

      if (filters.customerId) q = q.eq('customer_id', filters.customerId)
      if (filters.status) q = q.eq('status', filters.status)
      if (filters.from) q = q.gte('sale_date', filters.from)
      if (filters.to) q = q.lte('sale_date', filters.to)

      const rows = unwrap<SaleWithCustomer[]>(await q)
      return filters.unpaidOnly
        ? rows.filter((r) => Number(r.total) - Number(r.paid_amount) > 0.005)
        : rows
    },
  })
}

export function useSale(id: string | undefined) {
  return useQuery({
    queryKey: qk.sale(id ?? ''),
    enabled: !!id,
    queryFn: async () =>
      unwrap<SaleFull>(
        await db()
          .from('sales')
          .select('*, customer:customers(*), sale_items(*, ink:inks(id, name, code, color_hex))')
          .eq('id', id!)
          .single(),
      ),
  })
}

/** Sales of one ink, for the ink detail page. */
export function useInkSales(inkId: string | undefined) {
  return useQuery({
    queryKey: [...qk.sales, 'by-ink', inkId],
    enabled: !!inkId,
    queryFn: async () =>
      unwrap<
        {
          id: string
          quantity_kg: number
          price_per_kg: number
          line_total: number
          line_profit: number
          sale: { id: string; sale_date: string; invoice_no: string | null; status: string; customer: { id: string; name: string } | null } | null
        }[]
      >(
        await db()
          .from('sale_items')
          .select(
            'id, quantity_kg, price_per_kg, line_total, line_profit, sale:sales(id, sale_date, invoice_no, status, customer:customers(id, name))',
          )
          .eq('ink_id', inkId!)
          .limit(200),
      ),
  })
}

export interface SalePayload {
  customer_id: string
  invoice_no?: string | null
  sale_date: string
  discount?: number
  paid_amount?: number
  payment_method?: string | null
  notes?: string | null
  idempotency_key: string
  items: { ink_id: string; quantity_kg: number; price_per_kg: number }[]
}

export function useRecordSale() {
  const invalidate = useInvalidateMoneyEvent()
  return useMutation({
    mutationFn: async (payload: SalePayload) =>
      unwrap<string>(await db().rpc('record_sale', { payload })),
    onSuccess: invalidate,
  })
}

export function useCancelSale() {
  const invalidate = useInvalidateMoneyEvent()
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) =>
      unwrap<string>(await db().rpc('cancel_sale', { p_sale_id: id, p_reason: reason ?? null })),
    onSuccess: invalidate,
  })
}
