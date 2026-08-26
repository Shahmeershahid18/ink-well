'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  Party,
  Payment,
  VCustomerSummary,
  VSupplierSummary,
  CustomerInkPrice,
} from '@/types/database'
import { db, unwrap } from './helpers'
import { qk } from './keys'

export type PartyKind = 'supplier' | 'customer'
const table = (kind: PartyKind) => (kind === 'supplier' ? 'suppliers' : 'customers')

export interface PartyInput {
  id?: string
  name: string
  company?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  city?: string | null
  notes?: string | null
  opening_balance?: number
  is_active?: boolean
}

/* ─────────────── SUPPLIERS ─────────────── */

export function useSuppliers(activeOnly = false) {
  return useQuery({
    queryKey: [...qk.suppliers, { activeOnly }],
    queryFn: async () => {
      let q = db().from('suppliers').select('*').order('name')
      if (activeOnly) q = q.eq('is_active', true)
      return unwrap<Party[]>(await q)
    },
  })
}

export function useSupplierSummary() {
  return useQuery({
    queryKey: qk.supplierSummary,
    queryFn: async () =>
      unwrap<VSupplierSummary[]>(
        await db().from('v_supplier_summary').select('*').order('total_spend', { ascending: false }),
      ),
  })
}

export function useSupplier(id: string | undefined) {
  return useQuery({
    queryKey: qk.supplier(id ?? ''),
    enabled: !!id,
    queryFn: async () =>
      unwrap<Party>(await db().from('suppliers').select('*').eq('id', id!).single()),
  })
}

/* ─────────────── CUSTOMERS ─────────────── */

export function useCustomers(activeOnly = false) {
  return useQuery({
    queryKey: [...qk.customers, { activeOnly }],
    queryFn: async () => {
      let q = db().from('customers').select('*').order('name')
      if (activeOnly) q = q.eq('is_active', true)
      return unwrap<Party[]>(await q)
    },
  })
}

export function useCustomerSummary() {
  return useQuery({
    queryKey: qk.customerSummary,
    queryFn: async () =>
      unwrap<VCustomerSummary[]>(
        await db().from('v_customer_summary').select('*').order('revenue', { ascending: false }),
      ),
  })
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: qk.customer(id ?? ''),
    enabled: !!id,
    queryFn: async () =>
      unwrap<Party>(await db().from('customers').select('*').eq('id', id!).single()),
  })
}

/* ─────────────── SHARED MUTATIONS ─────────────── */

export function useSaveParty(kind: PartyKind) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: PartyInput) => {
      const { id, ...values } = input
      const payload = {
        ...values,
        company: values.company || null,
        phone: values.phone || null,
        email: values.email || null,
        address: values.address || null,
        city: values.city || null,
        notes: values.notes || null,
        opening_balance: values.opening_balance ?? 0,
      }
      if (id) {
        return unwrap<Party>(
          await db().from(table(kind)).update(payload).eq('id', id).select().single(),
        )
      }
      return unwrap<Party>(await db().from(table(kind)).insert(payload).select().single())
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: kind === 'supplier' ? qk.suppliers : qk.customers })
    },
  })
}

export function useSetPartyActive(kind: PartyKind) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) =>
      unwrap<Party>(
        await db().from(table(kind)).update({ is_active }).eq('id', id).select().single(),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: kind === 'supplier' ? qk.suppliers : qk.customers })
    },
  })
}

/* ─────────────── PAYMENTS ─────────────── */

export function usePartyPayments(kind: PartyKind, partyId: string | undefined) {
  return useQuery({
    queryKey: qk.partyPayments(kind, partyId ?? ''),
    enabled: !!partyId,
    queryFn: async () =>
      unwrap<Payment[]>(
        await db()
          .from('payments')
          .select('*')
          .eq('party_type', kind)
          .eq('party_id', partyId!)
          .order('paid_on', { ascending: false }),
      ),
  })
}

export interface PaymentInput {
  party_type: PartyKind
  party_id: string
  amount: number
  method?: string | null
  reference?: string | null
  paid_on?: string
  ref_table?: 'purchases' | 'sales' | null
  ref_id?: string | null
  notes?: string | null
}

export function useRecordPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: PaymentInput) =>
      unwrap<string>(await db().rpc('record_payment', { payload: input })),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: qk.payments })
      qc.invalidateQueries({ queryKey: vars.party_type === 'supplier' ? qk.suppliers : qk.customers })
      qc.invalidateQueries({ queryKey: vars.ref_table === 'sales' ? qk.sales : qk.purchases })
      qc.invalidateQueries({ queryKey: qk.dashboard })
    },
  })
}

/* ─────────────── AGREED PRICES ─────────────── */

export function useCustomerPrices(customerId: string | undefined) {
  return useQuery({
    queryKey: qk.customerPrices(customerId ?? ''),
    enabled: !!customerId,
    queryFn: async () =>
      unwrap<CustomerInkPrice[]>(
        await db().from('customer_ink_prices').select('*').eq('customer_id', customerId!),
      ),
  })
}

export function useSaveCustomerPrice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { customer_id: string; ink_id: string; price_per_kg: number }) =>
      unwrap<CustomerInkPrice>(
        await db()
          .from('customer_ink_prices')
          .upsert(input, { onConflict: 'customer_id,ink_id' })
          .select()
          .single(),
      ),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.customerPrices(vars.customer_id) })
    },
  })
}

export function useDeleteCustomerPrice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; customer_id: string }) => {
      const { error } = await db().from('customer_ink_prices').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.customerPrices(vars.customer_id) })
    },
  })
}
