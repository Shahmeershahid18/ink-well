/**
 * Pure costing maths. These mirror the SQL in 002_functions.sql exactly — if the two
 * ever disagree, the SQL is the truth and this file is the bug. Unit-tested in
 * costing.test.ts because this is where money errors hide.
 */

/** Postgres `round(numeric, n)` rounds half away from zero; JS does not. Match Postgres. */
export function roundTo(value: number, dp: number): number {
  if (!Number.isFinite(value)) return 0
  const factor = 10 ** dp
  const scaled = value * factor
  // nudge past float representation error (2.675 * 100 === 267.49999999999997)
  const nudged = scaled >= 0 ? scaled + 1e-9 : scaled - 1e-9
  return (nudged >= 0 ? Math.floor(nudged + 0.5) : Math.ceil(nudged - 0.5)) / factor
}

export const round2 = (v: number) => roundTo(v, 2)
export const round4 = (v: number) => roundTo(v, 4)

/** Moving weighted average after a stock-in. */
export function weightedAverage(
  oldQty: number,
  oldAvg: number,
  inQty: number,
  inCostPerKg: number,
): number {
  const newQty = oldQty + inQty
  if (newQty <= 0) return inCostPerKg
  return ((oldQty * oldAvg) + (inQty * inCostPerKg)) / newQty
}

export interface PurchaseLineInput {
  quantity_kg: number
  price_per_kg: number
}

export interface AllocatedLine extends PurchaseLineInput {
  line_total: number
  landed_cost_per_kg: number
}

/**
 * Freight and other costs are allocated by line value, not by weight — a drum of
 * pigment carries more of the freight bill than a drum of solvent because it is
 * worth more, which is what the invoice actually reflects.
 */
export function allocateLandedCost(
  lines: PurchaseLineInput[],
  extraCost: number,
): { lines: AllocatedLine[]; subtotal: number } {
  const withTotals = lines.map((l) => ({
    ...l,
    line_total: round2((l.quantity_kg || 0) * (l.price_per_kg || 0)),
  }))
  const subtotal = round2(withTotals.reduce((s, l) => s + l.line_total, 0))

  return {
    subtotal,
    lines: withTotals.map((l) => ({
      ...l,
      landed_cost_per_kg:
        subtotal > 0 && l.quantity_kg > 0
          ? l.price_per_kg + (extraCost * (l.line_total / subtotal)) / l.quantity_kg
          : l.price_per_kg,
    })),
  }
}

export interface PurchaseTotalsInput {
  lines: PurchaseLineInput[]
  freight_cost?: number
  other_cost?: number
  discount?: number
  paid_amount?: number
}

export function purchaseTotals(input: PurchaseTotalsInput) {
  const freight = input.freight_cost || 0
  const other = input.other_cost || 0
  const discount = input.discount || 0
  const { lines, subtotal } = allocateLandedCost(input.lines, freight + other)
  const total = round2(subtotal + freight + other - discount)
  return {
    lines,
    subtotal,
    extra: round2(freight + other),
    discount,
    total,
    balance: round2(total - (input.paid_amount || 0)),
  }
}

export interface BatchCostInput {
  materialCost: number
  laborCost: number
  overheadCost: number
  packagingCostPerKg: number
  producedKg: number
  plannedKg?: number
}

export interface BatchCostResult {
  materialCost: number
  laborCost: number
  overheadCost: number
  packagingCost: number
  totalCost: number
  costPerKg: number
  wastageKg: number
  wastagePct: number
}

/** What `complete_production_batch` computes, so the dialog can preview it. */
export function batchCost(input: BatchCostInput): BatchCostResult {
  const produced = input.producedKg || 0
  const packaging = round2(produced * (input.packagingCostPerKg || 0))
  const total = round2(
    (input.materialCost || 0) + (input.laborCost || 0) + (input.overheadCost || 0) + packaging,
  )
  const planned = input.plannedKg ?? produced
  const wastageKg = round2(Math.max(planned - produced, 0))
  return {
    materialCost: round2(input.materialCost || 0),
    laborCost: round2(input.laborCost || 0),
    overheadCost: round2(input.overheadCost || 0),
    packagingCost: packaging,
    totalCost: total,
    costPerKg: produced > 0 ? round4(total / produced) : 0,
    wastageKg,
    wastagePct: planned > 0 ? round2((wastageKg / planned) * 100) : 0,
  }
}

export interface TheoreticalCostInput {
  materialCostPerBatch: number
  laborCostPerBatch: number
  overheadCostPerBatch: number
  packagingCostPerKg: number
  batchSizeKg: number
  expectedWastagePct: number
}

export interface CostBreakdown {
  materialPerKg: number
  laborPerKg: number
  overheadPerKg: number
  packagingPerKg: number
  baseCostPerKg: number
  effectiveYieldKg: number
}

/**
 * The ink's theoretical cost at today's material prices:
 *   effective_yield  = batch_size × (1 − expected_wastage%)
 *   base_cost_per_kg = (material + labor + overhead) / effective_yield + packaging/kg
 */
export function theoreticalInkCost(input: TheoreticalCostInput): CostBreakdown {
  const yieldKg = Math.max(
    (input.batchSizeKg || 0) * (1 - (input.expectedWastagePct || 0) / 100),
    0,
  )
  const perKg = (amount: number) => (yieldKg > 0 ? amount / yieldKg : 0)

  const materialPerKg = perKg(input.materialCostPerBatch || 0)
  const laborPerKg = perKg(input.laborCostPerBatch || 0)
  const overheadPerKg = perKg(input.overheadCostPerBatch || 0)
  const packagingPerKg = input.packagingCostPerKg || 0

  return {
    materialPerKg,
    laborPerKg,
    overheadPerKg,
    packagingPerKg,
    baseCostPerKg: materialPerKg + laborPerKg + overheadPerKg + packagingPerKg,
    effectiveYieldKg: yieldKg,
  }
}

/** Margin on selling price, the way a printer quotes it. */
export function marginPct(pricePerKg: number, costPerKg: number): number {
  if (!pricePerKg) return 0
  return ((pricePerKg - costPerKg) / pricePerKg) * 100
}

/** Markup on cost, for when you price up from cost instead. */
export function markupPct(pricePerKg: number, costPerKg: number): number {
  if (!costPerKg) return 0
  return ((pricePerKg - costPerKg) / costPerKg) * 100
}

export interface SaleLineInput {
  quantity_kg: number
  price_per_kg: number
  cost_per_kg: number
}

export function saleLineTotals(line: SaleLineInput) {
  const total = round2((line.quantity_kg || 0) * (line.price_per_kg || 0))
  const cost = round2((line.quantity_kg || 0) * (line.cost_per_kg || 0))
  return {
    lineTotal: total,
    lineCost: cost,
    lineProfit: round2((line.quantity_kg || 0) * ((line.price_per_kg || 0) - (line.cost_per_kg || 0))),
    marginPct: marginPct(line.price_per_kg || 0, line.cost_per_kg || 0),
    belowCost: (line.price_per_kg || 0) < (line.cost_per_kg || 0),
  }
}

export function saleTotals(lines: SaleLineInput[], discount = 0, paid = 0) {
  const subtotal = round2(lines.reduce((s, l) => s + saleLineTotals(l).lineTotal, 0))
  const cogs = round2(lines.reduce((s, l) => s + saleLineTotals(l).lineCost, 0))
  const total = round2(subtotal - discount)
  const profit = round2(total - cogs)
  return {
    subtotal,
    discount,
    total,
    cogs,
    profit,
    marginPct: total > 0 ? (profit / total) * 100 : 0,
    balance: round2(total - paid),
    belowCost: lines.some((l) => saleLineTotals(l).belowCost),
  }
}

/** Days of cover — the real reorder signal, better than a static level. */
export function daysOfCover(currentStockKg: number, consumedKgLast90: number): number | null {
  if (!consumedKgLast90) return null
  return roundTo(currentStockKg / (consumedKgLast90 / 90), 1)
}
