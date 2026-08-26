import { describe, expect, it } from 'vitest'
import { round4 } from './costing'
import {
  computeInkCost,
  consumptionCost,
  costBarSegments,
  scaleFormula,
  summariseFormula,
  type FormulaLine,
} from './formula'

/** Process Blue from the plan's worked example. */
const FORMULA: FormulaLine[] = [
  { raw_material_id: 'pig', quantity_kg: 30, avg_cost_per_kg: 1270, current_stock_kg: 150 },
  { raw_material_id: 'res', quantity_kg: 55, avg_cost_per_kg: 400, current_stock_kg: 200 },
  { raw_material_id: 'sol', quantity_kg: 15, avg_cost_per_kg: 250, current_stock_kg: 100 },
]

const INK = {
  batch_size_kg: 100,
  labor_cost_per_batch: 2500,
  overhead_cost_per_batch: 1800,
  packaging_cost_per_kg: 12,
  expected_wastage_pct: 3,
  default_price_per_kg: 950,
}

describe('formula summary', () => {
  it('costs the batch at 63,850', () => {
    const summary = summariseFormula(FORMULA, 100)
    expect(summary.materialCostPerBatch).toBe(63850)
    expect(summary.totalWeightKg).toBe(100)
    expect(summary.weightMatchesBatch).toBe(true)
  })

  it('reports the percentage of the mix per line', () => {
    const summary = summariseFormula(FORMULA, 100)
    expect(summary.lines.map((l) => Math.round(l.pctOfBatch))).toEqual([30, 55, 15])
  })

  it('warns without blocking when the weight does not match the batch size', () => {
    const summary = summariseFormula(FORMULA, 102)
    expect(summary.weightMatchesBatch).toBe(false)
    expect(summary.weightDifferenceKg).toBe(-2)
  })

  it('handles an empty formula', () => {
    const summary = summariseFormula([], 100)
    expect(summary.materialCostPerBatch).toBe(0)
    expect(summary.lines).toHaveLength(0)
  })
})

describe('ink cost', () => {
  it('matches the worked example end to end', () => {
    const cost = computeInkCost(FORMULA, INK)
    expect(cost.effectiveYieldKg).toBe(97)
    expect(round4(cost.baseCostPerKg)).toBe(714.5773)
    expect(cost.pricePerKg).toBe(950)
    expect(round4(cost.marginPerKg)).toBe(235.4227)
    expect(Number(cost.marginPct.toFixed(2))).toBe(24.78)
    expect(cost.belowCost).toBe(false)
  })

  it('flags an ink priced below its cost', () => {
    const cost = computeInkCost(FORMULA, { ...INK, default_price_per_kg: 600 })
    expect(cost.belowCost).toBe(true)
    expect(cost.marginPct).toBeLessThan(0)
  })

  it('reacts to a material price rise', () => {
    const before = computeInkCost(FORMULA, INK)
    const after = computeInkCost(
      FORMULA.map((l) =>
        l.raw_material_id === 'pig' ? { ...l, avg_cost_per_kg: 1500 } : l,
      ),
      INK,
    )
    expect(after.baseCostPerKg).toBeGreaterThan(before.baseCostPerKg)
    // 30 kg × 230 more, spread over 97 kg of yield
    expect(round4(after.baseCostPerKg - before.baseCostPerKg)).toBe(round4((30 * 230) / 97))
  })
})

describe('cost bar segments', () => {
  it('adds a margin segment only when a price is set', () => {
    const withPrice = costBarSegments(computeInkCost(FORMULA, INK))
    expect(withPrice.map((s) => s.key)).toContain('margin')

    const noPrice = costBarSegments(
      computeInkCost(FORMULA, { ...INK, default_price_per_kg: null }),
    )
    expect(noPrice.map((s) => s.key)).not.toContain('margin')
  })

  it('labels a negative margin as a loss and keeps the bar positive', () => {
    const segments = costBarSegments(computeInkCost(FORMULA, { ...INK, default_price_per_kg: 600 }))
    const margin = segments.find((s) => s.key === 'margin')!
    expect(margin.label).toBe('Loss')
    expect(margin.value).toBeGreaterThan(0)
  })

  it('sums to 100% across the segments', () => {
    const segments = costBarSegments(computeInkCost(FORMULA, INK))
    const total = segments.reduce((s, x) => s + x.pct, 0)
    expect(Math.round(total)).toBe(100)
  })
})

describe('scaling a formula to a planned quantity', () => {
  it('scales every line proportionally', () => {
    const scaled = scaleFormula(FORMULA, 250, 100)
    expect(scaled.map((l) => l.quantity_kg)).toEqual([75, 137.5, 37.5])
  })

  it('flags only the lines that would run out of stock', () => {
    // ×5: pigment needs exactly its 150 kg, resin needs 275 of 200, solvent 75 of 100
    const scaled = scaleFormula(FORMULA, 500, 100)
    const short = scaled.filter((l) => l.hasShortfall)
    expect(short.map((l) => l.raw_material_id)).toEqual(['res'])
    expect(short[0].shortfallKg).toBe(75)
    expect(scaled.find((l) => l.raw_material_id === 'pig')!.hasShortfall).toBe(false)
  })

  it('does not scale when the batch size is unknown', () => {
    const scaled = scaleFormula(FORMULA, 250, 0)
    expect(scaled[0].quantity_kg).toBe(30)
  })
})

describe('consumption cost', () => {
  it('prices lines at the material average', () => {
    expect(consumptionCost(FORMULA)).toBe(63850)
  })
})
