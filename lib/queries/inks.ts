'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { FormulaItemWithMaterial, Ink, VInkProfitability } from '@/types/database'
import { db, unwrap } from './helpers'
import { qk } from './keys'

export interface InkInput {
  id?: string
  name: string
  code?: string | null
  color_hex?: string | null
  ink_type?: string | null
  batch_size_kg: number
  labor_cost_per_batch?: number
  overhead_cost_per_batch?: number
  packaging_cost_per_kg?: number
  expected_wastage_pct?: number
  default_price_per_kg?: number | null
  reorder_level_kg?: number
  is_active?: boolean
}

export function useInks(activeOnly = false) {
  return useQuery({
    queryKey: [...qk.inks, { activeOnly }],
    queryFn: async () => {
      let q = db().from('inks').select('*').order('name')
      if (activeOnly) q = q.eq('is_active', true)
      return unwrap<Ink[]>(await q)
    },
  })
}

export function useInk(id: string | undefined) {
  return useQuery({
    queryKey: qk.ink(id ?? ''),
    enabled: !!id,
    queryFn: async () => unwrap<Ink>(await db().from('inks').select('*').eq('id', id!).single()),
  })
}

export function useInkProfitability() {
  return useQuery({
    queryKey: qk.inkProfitability,
    queryFn: async () =>
      unwrap<VInkProfitability[]>(
        await db().from('v_ink_profitability').select('*').order('profit', { ascending: false }),
      ),
  })
}

export function useInkFormula(inkId: string | undefined) {
  return useQuery({
    queryKey: qk.inkFormula(inkId ?? ''),
    enabled: !!inkId,
    queryFn: async () =>
      unwrap<FormulaItemWithMaterial[]>(
        await db()
          .from('ink_formula_items')
          .select(
            '*, raw_material:raw_materials(id, name, code, avg_cost_per_kg, current_stock_kg, unit)',
          )
          .eq('ink_id', inkId!)
          .order('sort_order'),
      ),
  })
}

/**
 * Every formula line in one request, so the ink list can show a live theoretical
 * cost per ink without N round trips.
 */
export function useAllFormulas() {
  return useQuery({
    queryKey: [...qk.inks, 'formulas'],
    queryFn: async () => {
      const rows = unwrap<FormulaItemWithMaterial[]>(
        await db()
          .from('ink_formula_items')
          .select('*, raw_material:raw_materials(id, name, code, avg_cost_per_kg, current_stock_kg, unit)')
          .order('sort_order'),
      )
      const byInk = new Map<string, FormulaItemWithMaterial[]>()
      rows.forEach((row) => {
        const list = byInk.get(row.ink_id) ?? []
        list.push(row)
        byInk.set(row.ink_id, list)
      })
      return byInk
    },
  })
}

export function useSaveInk() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: InkInput) => {
      const { id, ...values } = input
      const payload = {
        ...values,
        code: values.code || null,
        color_hex: values.color_hex || null,
        ink_type: values.ink_type || null,
        labor_cost_per_batch: values.labor_cost_per_batch ?? 0,
        overhead_cost_per_batch: values.overhead_cost_per_batch ?? 0,
        packaging_cost_per_kg: values.packaging_cost_per_kg ?? 0,
        expected_wastage_pct: values.expected_wastage_pct ?? 0,
        default_price_per_kg: values.default_price_per_kg ?? null,
        reorder_level_kg: values.reorder_level_kg ?? 0,
      }
      if (id) {
        return unwrap<Ink>(await db().from('inks').update(payload).eq('id', id).select().single())
      }
      return unwrap<Ink>(await db().from('inks').insert(payload).select().single())
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.inks })
      qc.invalidateQueries({ queryKey: qk.dashboard })
    },
  })
}

export function useSaveFormula() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      ink_id: string
      items: { raw_material_id: string; quantity_kg: number; note?: string | null }[]
    }) => {
      const { error } = await db().rpc('save_ink_formula', {
        p_ink_id: input.ink_id,
        p_items: input.items,
      })
      if (error) throw error
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.inkFormula(vars.ink_id) })
      qc.invalidateQueries({ queryKey: qk.inks })
    },
  })
}
