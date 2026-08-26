'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InventoryMovement, RawMaterial, VMaterialUsage } from '@/types/database'
import { db, unwrap, useInvalidateMoneyEvent } from './helpers'
import { qk } from './keys'

export interface MaterialInput {
  id?: string
  name: string
  code?: string | null
  category?: string | null
  unit?: string
  reorder_level_kg?: number
  default_supplier_id?: string | null
  is_active?: boolean
  /** Only on create: writes an adjustment movement rather than a direct stock write. */
  opening_stock_kg?: number
  opening_cost_per_kg?: number
}

export function useRawMaterials(activeOnly = false) {
  return useQuery({
    queryKey: [...qk.rawMaterials, { activeOnly }],
    queryFn: async () => {
      let q = db().from('raw_materials').select('*').order('name')
      if (activeOnly) q = q.eq('is_active', true)
      return unwrap<RawMaterial[]>(await q)
    },
  })
}

export function useRawMaterial(id: string | undefined) {
  return useQuery({
    queryKey: qk.rawMaterial(id ?? ''),
    enabled: !!id,
    queryFn: async () =>
      unwrap<RawMaterial>(await db().from('raw_materials').select('*').eq('id', id!).single()),
  })
}

export function useMaterialUsage() {
  return useQuery({
    queryKey: qk.materialUsage,
    queryFn: async () =>
      unwrap<VMaterialUsage[]>(await db().from('v_material_usage').select('*').order('name')),
  })
}

export function useSaveMaterial() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: MaterialInput) => {
      const { id, opening_stock_kg, opening_cost_per_kg, ...values } = input
      const payload = {
        ...values,
        code: values.code || null,
        category: values.category || null,
        unit: values.unit || 'kg',
        reorder_level_kg: values.reorder_level_kg ?? 0,
        default_supplier_id: values.default_supplier_id || null,
      }

      if (id) {
        return unwrap<RawMaterial>(
          await db().from('raw_materials').update(payload).eq('id', id).select().single(),
        )
      }

      const created = unwrap<RawMaterial>(
        await db().from('raw_materials').insert(payload).select().single(),
      )

      // Opening stock goes through the ledger like every other movement.
      if (opening_stock_kg && opening_stock_kg > 0) {
        const { error } = await db().rpc('adjust_stock', {
          p_item_type: 'raw',
          p_item_id: created.id,
          p_new_qty: opening_stock_kg,
          p_reason: 'Opening stock',
          p_cost_per_kg: opening_cost_per_kg ?? 0,
        })
        if (error) throw error
      }
      return created
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.rawMaterials })
      qc.invalidateQueries({ queryKey: qk.movements })
      qc.invalidateQueries({ queryKey: qk.dashboard })
    },
  })
}

export function useAdjustStock() {
  const invalidate = useInvalidateMoneyEvent()
  return useMutation({
    mutationFn: async (input: {
      item_type: 'raw' | 'ink'
      item_id: string
      new_qty: number
      reason: string
      cost_per_kg?: number | null
    }) => {
      const { error } = await db().rpc('adjust_stock', {
        p_item_type: input.item_type,
        p_item_id: input.item_id,
        p_new_qty: input.new_qty,
        p_reason: input.reason,
        p_cost_per_kg: input.cost_per_kg ?? null,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useItemMovements(
  itemType: 'raw' | 'ink' | undefined,
  itemId: string | undefined,
  limit = 200,
) {
  return useQuery({
    queryKey: qk.itemMovements(itemType ?? '', itemId ?? ''),
    enabled: !!itemId && !!itemType,
    queryFn: async () =>
      unwrap<InventoryMovement[]>(
        await db()
          .from('inventory_movements')
          .select('*')
          .eq('item_type', itemType!)
          .eq('item_id', itemId!)
          .order('created_at', { ascending: false })
          .limit(limit),
      ),
  })
}

/** Landed price history for a material, oldest first — feeds the price mini-chart. */
export function useMaterialPriceHistory(materialId: string | undefined) {
  return useQuery({
    queryKey: [...qk.rawMaterial(materialId ?? ''), 'price-history'],
    enabled: !!materialId,
    queryFn: async () =>
      unwrap<{ created_at: string; cost_per_kg: number }[]>(
        await db()
          .from('inventory_movements')
          .select('created_at, cost_per_kg')
          .eq('item_type', 'raw')
          .eq('item_id', materialId!)
          .eq('movement_type', 'purchase')
          .order('created_at', { ascending: true })
          .limit(60),
      ),
  })
}
