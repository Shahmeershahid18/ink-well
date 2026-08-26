/**
 * Hand-written to match supabase/migrations. Regenerate once the project is linked:
 *   npx supabase gen types typescript --linked > types/database.ts
 * The shape follows the generator's output, so replacing this file is a drop-in swap.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type ItemType = 'raw' | 'ink'
export type MovementType =
  | 'purchase' | 'production_in' | 'production_out' | 'sale' | 'adjustment' | 'return'
export type DocStatusPurchase = 'draft' | 'received' | 'cancelled'
export type DocStatusSale = 'draft' | 'confirmed' | 'cancelled'
export type DocStatusBatch = 'draft' | 'completed' | 'cancelled'
export type AlertLevel = 'warning' | 'critical'
export type PartyType = 'supplier' | 'customer'

type Timestamps = { created_at: string }

export interface Party {
  id: string
  owner_id: string | null
  name: string
  company: string | null
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  notes: string | null
  opening_balance: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface RawMaterial {
  id: string
  owner_id: string | null
  name: string
  code: string | null
  category: string | null
  unit: string
  current_stock_kg: number
  avg_cost_per_kg: number
  last_price_per_kg: number | null
  reorder_level_kg: number
  default_supplier_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Ink {
  id: string
  owner_id: string | null
  name: string
  code: string | null
  color_hex: string | null
  ink_type: string | null
  batch_size_kg: number
  labor_cost_per_batch: number
  overhead_cost_per_batch: number
  packaging_cost_per_kg: number
  expected_wastage_pct: number
  default_price_per_kg: number | null
  current_stock_kg: number
  avg_cost_per_kg: number
  reorder_level_kg: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface InkFormulaItem {
  id: string
  ink_id: string
  raw_material_id: string
  quantity_kg: number
  note: string | null
  sort_order: number
}

export interface Purchase extends Timestamps {
  id: string
  owner_id: string | null
  supplier_id: string
  invoice_no: string | null
  purchase_date: string
  subtotal: number
  freight_cost: number
  other_cost: number
  discount: number
  total: number
  paid_amount: number
  status: DocStatusPurchase
  notes: string | null
  idempotency_key: string | null
  cancelled_at: string | null
}

export interface PurchaseItem {
  id: string
  purchase_id: string
  raw_material_id: string
  quantity_kg: number
  price_per_kg: number
  landed_cost_per_kg: number
  line_total: number
}

export interface ProductionBatch extends Timestamps {
  id: string
  owner_id: string | null
  ink_id: string
  batch_no: string | null
  production_date: string
  planned_qty_kg: number
  produced_qty_kg: number | null
  material_cost: number
  labor_cost: number
  overhead_cost: number
  packaging_cost: number
  total_cost: number
  cost_per_kg: number | null
  status: DocStatusBatch
  notes: string | null
  completed_at: string | null
}

export interface ProductionConsumption {
  id: string
  batch_id: string
  raw_material_id: string
  quantity_kg: number
  cost_per_kg: number
  line_cost: number
}

export interface Sale extends Timestamps {
  id: string
  owner_id: string | null
  customer_id: string
  invoice_no: string | null
  sale_date: string
  subtotal: number
  discount: number
  total: number
  cogs_total: number
  profit_total: number
  paid_amount: number
  status: DocStatusSale
  notes: string | null
  idempotency_key: string | null
  cancelled_at: string | null
}

export interface SaleItem {
  id: string
  sale_id: string
  ink_id: string
  quantity_kg: number
  price_per_kg: number
  cost_per_kg_snapshot: number
  line_total: number
  line_cost: number
  line_profit: number
}

export interface CustomerInkPrice {
  id: string
  customer_id: string
  ink_id: string
  price_per_kg: number
}

export interface InventoryMovement extends Timestamps {
  id: string
  owner_id: string | null
  item_type: ItemType
  item_id: string
  movement_type: MovementType
  quantity_kg: number
  cost_per_kg: number | null
  balance_after: number
  ref_table: string | null
  ref_id: string | null
  notes: string | null
}

export interface StockAlert extends Timestamps {
  id: string
  owner_id: string | null
  item_type: ItemType
  item_id: string
  item_name: string
  level: AlertLevel
  message: string
  is_read: boolean
  is_resolved: boolean
  resolved_at: string | null
}

export interface Payment extends Timestamps {
  id: string
  owner_id: string | null
  party_type: PartyType
  party_id: string
  direction: 'in' | 'out'
  amount: number
  method: string | null
  reference: string | null
  paid_on: string
  ref_table: string | null
  ref_id: string | null
  notes: string | null
}

export interface AppSettings {
  id: number
  company_name: string | null
  company_address: string | null
  company_phone: string | null
  currency: string
  low_stock_email: string | null
  default_labor_rate: number | null
  invoice_prefix: string | null
  batch_prefix: string | null
  purchase_prefix: string | null
  updated_at: string
}

/* ─────────────── VIEWS ─────────────── */

export interface VLowStock {
  item_type: ItemType
  id: string
  name: string
  code: string | null
  current_stock_kg: number
  reorder_level_kg: number
  avg_cost_per_kg: number
  stock_value: number
  default_supplier_id: string | null
  level: AlertLevel
}

export interface VInventoryValue {
  raw_value: number
  ink_value: number
  raw_kg: number
  ink_kg: number
}

export interface VInkProfitability {
  id: string
  name: string
  code: string | null
  color_hex: string | null
  ink_type: string | null
  current_stock_kg: number
  avg_cost_per_kg: number
  default_price_per_kg: number | null
  stock_value: number
  produced_kg: number
  sold_kg: number
  revenue: number
  cost: number
  profit: number
  margin_pct: number
  avg_price_per_kg: number | null
}

export interface VCustomerSummary {
  id: string
  name: string
  company: string | null
  phone: string | null
  city: string | null
  is_active: boolean
  orders: number
  total_kg: number
  revenue: number
  profit: number
  receivable: number
  last_order_date: string | null
}

export interface VSupplierSummary {
  id: string
  name: string
  company: string | null
  phone: string | null
  city: string | null
  is_active: boolean
  purchase_count: number
  total_spend: number
  payable: number
  last_purchase_date: string | null
}

export interface VMaterialUsage {
  id: string
  name: string
  code: string | null
  category: string | null
  unit: string
  is_active: boolean
  current_stock_kg: number
  avg_cost_per_kg: number
  reorder_level_kg: number
  default_supplier_id: string | null
  stock_value: number
  purchased_kg: number
  purchase_value: number
  consumed_kg: number
  consumed_kg_90: number
  days_of_cover: number | null
}

export interface VMonthlyTrend {
  month: string
  purchases: number
  revenue: number
  cogs: number
  profit: number
}

export interface VStockReconciliation {
  item_type: ItemType
  id: string
  name: string
  current_stock_kg: number
  ledger_kg: number
  difference_kg: number
}

/* ─────────────── RPC RETURNS ─────────────── */

export interface DashboardSummary {
  purchase_total: number
  purchase_count: number
  revenue: number
  cogs: number
  gross_profit: number
  margin_pct: number
  sale_count: number
  produced_kg: number
  production_cost: number
  raw_stock_value: number
  ink_stock_value: number
  inventory_value: number
  raw_kg: number
  ink_kg: number
  low_stock_count: number
  payable: number
  receivable: number
}

export interface TrendPoint {
  bucket: string
  purchases: number
  revenue: number
  cogs: number
  profit: number
}

export interface ProfitLossRow {
  month: string
  revenue: number
  cogs: number
  gross_profit: number
  margin_pct: number
  purchases: number
  production_cost: number
  produced_kg: number
}

/* ─────────────── JOINED SHAPES USED BY THE UI ─────────────── */

export type Supplier = Party
export type Customer = Party

export type PurchaseWithSupplier = Purchase & {
  supplier: Pick<Party, 'id' | 'name' | 'company'> | null
  purchase_items?: { count: number }[]
}

export type PurchaseFull = Purchase & {
  supplier: Party | null
  purchase_items: (PurchaseItem & { raw_material: Pick<RawMaterial, 'id' | 'name' | 'code' | 'unit'> | null })[]
}

export type SaleWithCustomer = Sale & {
  customer: Pick<Party, 'id' | 'name' | 'company'> | null
  sale_items?: { count: number }[]
}

export type SaleFull = Sale & {
  customer: Party | null
  sale_items: (SaleItem & { ink: Pick<Ink, 'id' | 'name' | 'code' | 'color_hex'> | null })[]
}

export type BatchInk = Pick<
  Ink,
  | 'id'
  | 'name'
  | 'code'
  | 'color_hex'
  | 'batch_size_kg'
  | 'packaging_cost_per_kg'
  | 'expected_wastage_pct'
>

export type BatchWithInk = ProductionBatch & {
  ink: BatchInk | null
}

export type BatchFull = BatchWithInk & {
  production_consumption: (ProductionConsumption & {
    raw_material: Pick<RawMaterial, 'id' | 'name' | 'code' | 'current_stock_kg' | 'avg_cost_per_kg'> | null
  })[]
}

export type FormulaItemWithMaterial = InkFormulaItem & {
  raw_material: Pick<RawMaterial, 'id' | 'name' | 'code' | 'avg_cost_per_kg' | 'current_stock_kg' | 'unit'> | null
}
