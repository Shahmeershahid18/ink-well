import { round2, roundTo, theoreticalInkCost, type CostBreakdown } from './costing'

export interface FormulaLine {
  raw_material_id: string
  quantity_kg: number
  name?: string
  avg_cost_per_kg?: number
  current_stock_kg?: number
}

export interface FormulaLineComputed extends FormulaLine {
  pctOfBatch: number
  lineCost: number
}

export interface FormulaSummary {
  lines: FormulaLineComputed[]
  totalWeightKg: number
  materialCostPerBatch: number
  weightMatchesBatch: boolean
  weightDifferenceKg: number
}

/**
 * A formula is allowed not to sum to the batch size — solvent flashes off, and some
 * recipes are written to a base weight. We warn, we never block.
 */
export function summariseFormula(lines: FormulaLine[], batchSizeKg: number): FormulaSummary {
  const totalWeight = lines.reduce((s, l) => s + (l.quantity_kg || 0), 0)
  const computed: FormulaLineComputed[] = lines.map((l) => ({
    ...l,
    pctOfBatch: totalWeight > 0 ? ((l.quantity_kg || 0) / totalWeight) * 100 : 0,
    lineCost: round2((l.quantity_kg || 0) * (l.avg_cost_per_kg || 0)),
  }))
  const materialCost = round2(computed.reduce((s, l) => s + l.lineCost, 0))
  const diff = roundTo(totalWeight - (batchSizeKg || 0), 3)

  return {
    lines: computed,
    totalWeightKg: roundTo(totalWeight, 3),
    materialCostPerBatch: materialCost,
    weightMatchesBatch: Math.abs(diff) < 0.001,
    weightDifferenceKg: diff,
  }
}

export interface InkCostInput {
  batch_size_kg: number
  labor_cost_per_batch: number
  overhead_cost_per_batch: number
  packaging_cost_per_kg: number
  expected_wastage_pct: number
  default_price_per_kg?: number | null
}

export interface InkCostResult extends CostBreakdown {
  materialCostPerBatch: number
  totalWeightKg: number
  weightMatchesBatch: boolean
  weightDifferenceKg: number
  pricePerKg: number
  marginPerKg: number
  marginPct: number
  belowCost: boolean
}

/** Everything the cost-breakdown bar needs, from the formula rows and the ink header. */
export function computeInkCost(lines: FormulaLine[], ink: InkCostInput): InkCostResult {
  const formula = summariseFormula(lines, ink.batch_size_kg)
  const breakdown = theoreticalInkCost({
    materialCostPerBatch: formula.materialCostPerBatch,
    laborCostPerBatch: ink.labor_cost_per_batch || 0,
    overheadCostPerBatch: ink.overhead_cost_per_batch || 0,
    packagingCostPerKg: ink.packaging_cost_per_kg || 0,
    batchSizeKg: ink.batch_size_kg || 0,
    expectedWastagePct: ink.expected_wastage_pct || 0,
  })

  const price = ink.default_price_per_kg || 0
  const marginPerKg = price - breakdown.baseCostPerKg

  return {
    ...breakdown,
    materialCostPerBatch: formula.materialCostPerBatch,
    totalWeightKg: formula.totalWeightKg,
    weightMatchesBatch: formula.weightMatchesBatch,
    weightDifferenceKg: formula.weightDifferenceKg,
    pricePerKg: price,
    marginPerKg,
    marginPct: price > 0 ? (marginPerKg / price) * 100 : 0,
    belowCost: price > 0 && marginPerKg < 0,
  }
}

/** Segments for the stacked cost bar, in the order they should be drawn. */
export function costBarSegments(cost: InkCostResult) {
  const segments = [
    { key: 'material', label: 'Material', value: cost.materialPerKg, color: 'var(--seg-material)' },
    { key: 'labor', label: 'Labor', value: cost.laborPerKg, color: 'var(--seg-labor)' },
    { key: 'overhead', label: 'Overhead', value: cost.overheadPerKg, color: 'var(--seg-overhead)' },
    { key: 'packaging', label: 'Packaging', value: cost.packagingPerKg, color: 'var(--seg-packaging)' },
  ]
  if (cost.pricePerKg > 0) {
    segments.push({
      key: 'margin',
      label: cost.marginPerKg < 0 ? 'Loss' : 'Margin',
      value: Math.abs(cost.marginPerKg),
      color: cost.marginPerKg < 0 ? 'var(--danger)' : 'var(--seg-margin)',
    })
  }
  const total = segments.reduce((s, x) => s + Math.max(x.value, 0), 0)
  return segments.map((s) => ({
    ...s,
    pct: total > 0 ? (Math.max(s.value, 0) / total) * 100 : 0,
  }))
}

export interface ScaledLine extends FormulaLine {
  shortfallKg: number
  hasShortfall: boolean
}

/**
 * Scale a formula to a planned batch quantity. Real production deviates, so the
 * result is only a starting point — every line stays editable.
 */
export function scaleFormula(
  lines: FormulaLine[],
  plannedKg: number,
  batchSizeKg: number,
): ScaledLine[] {
  const factor = batchSizeKg > 0 ? plannedKg / batchSizeKg : 1
  return lines.map((l) => {
    const qty = roundTo((l.quantity_kg || 0) * factor, 3)
    const available = l.current_stock_kg ?? 0
    return {
      ...l,
      quantity_kg: qty,
      shortfallKg: qty > available ? roundTo(qty - available, 3) : 0,
      hasShortfall: qty > available,
    }
  })
}

/** Cost of a set of consumption lines at the materials' current average cost. */
export function consumptionCost(lines: FormulaLine[]): number {
  return round2(lines.reduce((s, l) => s + (l.quantity_kg || 0) * (l.avg_cost_per_kg || 0), 0))
}
