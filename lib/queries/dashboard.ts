'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  AppSettings,
  DashboardSummary,
  InventoryMovement,
  ProfitLossRow,
  StockAlert,
  TrendPoint,
  VLowStock,
  VStockReconciliation,
} from '@/types/database'
import { db, unwrap } from './helpers'
import { qk } from './keys'

export function useDashboardSummary(from: string, to: string) {
  return useQuery({
    queryKey: [...qk.dashboard, 'summary', from, to],
    queryFn: async () => {
      const rows = unwrap<DashboardSummary[]>(
        await db().rpc('get_dashboard_summary', { p_from: from, p_to: to }),
      )
      return rows?.[0] ?? null
    },
  })
}

export function useTrendSeries(from: string, to: string, grain: 'day' | 'month') {
  return useQuery({
    queryKey: [...qk.dashboard, 'trend', from, to, grain],
    queryFn: async () =>
      unwrap<TrendPoint[]>(
        await db().rpc('get_trend_series', { p_from: from, p_to: to, p_grain: grain }),
      ),
  })
}

export function useProfitLoss(from: string, to: string) {
  return useQuery({
    queryKey: [...qk.dashboard, 'pl', from, to],
    queryFn: async () =>
      unwrap<ProfitLossRow[]>(await db().rpc('get_profit_loss', { p_from: from, p_to: to })),
  })
}

export function useLowStock() {
  return useQuery({
    queryKey: qk.lowStock,
    queryFn: async () =>
      unwrap<VLowStock[]>(
        await db().from('v_low_stock').select('*').order('current_stock_kg', { ascending: true }),
      ),
  })
}

export function useAlerts(unresolvedOnly = true) {
  return useQuery({
    queryKey: [...qk.alerts, { unresolvedOnly }],
    queryFn: async () => {
      let q = db()
        .from('stock_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      if (unresolvedOnly) q = q.eq('is_resolved', false)
      return unwrap<StockAlert[]>(await q)
    },
  })
}

export function useMarkAlertsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids.length) return
      const { error } = await db().from('stock_alerts').update({ is_read: true }).in('id', ids)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.alerts }),
  })
}

export interface MovementFilters {
  itemType?: 'raw' | 'ink'
  itemId?: string
  movementType?: string
  from?: string
  to?: string
  limit?: number
}

export function useMovements(filters: MovementFilters = {}) {
  return useQuery({
    queryKey: [...qk.movements, filters],
    queryFn: async () => {
      let q = db()
        .from('inventory_movements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(filters.limit ?? 300)

      if (filters.itemType) q = q.eq('item_type', filters.itemType)
      if (filters.itemId) q = q.eq('item_id', filters.itemId)
      if (filters.movementType) q = q.eq('movement_type', filters.movementType)
      if (filters.from) q = q.gte('created_at', `${filters.from}T00:00:00`)
      if (filters.to) q = q.lte('created_at', `${filters.to}T23:59:59`)

      return unwrap<InventoryMovement[]>(await q)
    },
  })
}

export function useReconciliation() {
  return useQuery({
    queryKey: qk.reconciliation,
    queryFn: async () =>
      unwrap<VStockReconciliation[]>(await db().from('v_stock_reconciliation').select('*')),
  })
}

export function useSettings() {
  return useQuery({
    queryKey: qk.settings,
    staleTime: 5 * 60_000,
    queryFn: async () =>
      unwrap<AppSettings>(await db().from('app_settings').select('*').eq('id', 1).single()),
  })
}

export function useSaveSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: Partial<AppSettings>) =>
      unwrap<AppSettings>(
        await db()
          .from('app_settings')
          .update({ ...values, updated_at: new Date().toISOString() })
          .eq('id', 1)
          .select()
          .single(),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.settings }),
  })
}

/** Last five purchases and last five sales for the dashboard activity row. */
export function useRecentActivity() {
  return useQuery({
    queryKey: [...qk.dashboard, 'recent'],
    queryFn: async () => {
      const [purchases, sales] = await Promise.all([
        db()
          .from('purchases')
          .select('id, invoice_no, purchase_date, total, status, supplier:suppliers(name)')
          .order('created_at', { ascending: false })
          .limit(5),
        db()
          .from('sales')
          .select('id, invoice_no, sale_date, total, profit_total, status, customer:customers(name)')
          .order('created_at', { ascending: false })
          .limit(5),
      ])
      if (purchases.error) throw purchases.error
      if (sales.error) throw sales.error
      return {
        purchases: (purchases.data ?? []) as unknown as {
          id: string
          invoice_no: string | null
          purchase_date: string
          total: number
          status: string
          supplier: { name: string } | null
        }[],
        sales: (sales.data ?? []) as unknown as {
          id: string
          invoice_no: string | null
          sale_date: string
          total: number
          profit_total: number
          status: string
          customer: { name: string } | null
        }[],
      }
    },
  })
}
