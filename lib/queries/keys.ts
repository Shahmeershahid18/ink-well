/**
 * Query keys are also realtime channel keys: the first element matches the table
 * name so `use-realtime-sync` can invalidate a whole table with one call.
 */
export const qk = {
  suppliers: ['suppliers'] as const,
  supplier: (id: string) => ['suppliers', id] as const,
  supplierSummary: ['suppliers', 'summary'] as const,

  customers: ['customers'] as const,
  customer: (id: string) => ['customers', id] as const,
  customerSummary: ['customers', 'summary'] as const,
  customerPrices: (id: string) => ['customers', id, 'prices'] as const,

  rawMaterials: ['raw_materials'] as const,
  rawMaterial: (id: string) => ['raw_materials', id] as const,
  materialUsage: ['raw_materials', 'usage'] as const,

  inks: ['inks'] as const,
  ink: (id: string) => ['inks', id] as const,
  inkFormula: (id: string) => ['inks', id, 'formula'] as const,
  inkProfitability: ['inks', 'profitability'] as const,

  purchases: ['purchases'] as const,
  purchase: (id: string) => ['purchases', id] as const,

  batches: ['production_batches'] as const,
  batch: (id: string) => ['production_batches', id] as const,

  sales: ['sales'] as const,
  sale: (id: string) => ['sales', id] as const,

  movements: ['inventory_movements'] as const,
  itemMovements: (type: string, id: string) => ['inventory_movements', type, id] as const,

  alerts: ['stock_alerts'] as const,
  lowStock: ['stock_alerts', 'low_stock'] as const,

  payments: ['payments'] as const,
  partyPayments: (type: string, id: string) => ['payments', type, id] as const,

  dashboard: ['dashboard'] as const,
  settings: ['app_settings'] as const,
  reconciliation: ['reconciliation'] as const,
}

/** Everything the dashboard reads, invalidated together after any money event. */
export const MONEY_EVENT_KEYS = [
  ['dashboard'],
  ['raw_materials'],
  ['inks'],
  ['purchases'],
  ['sales'],
  ['production_batches'],
  ['inventory_movements'],
  ['stock_alerts'],
  ['suppliers'],
  ['customers'],
] as const
