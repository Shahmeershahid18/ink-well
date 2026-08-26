import { describe, expect, it } from 'vitest'
import {
  allocateLandedCost,
  batchCost,
  daysOfCover,
  marginPct,
  markupPct,
  purchaseTotals,
  round2,
  round4,
  roundTo,
  saleLineTotals,
  saleTotals,
  theoreticalInkCost,
  weightedAverage,
} from './costing'

/**
 * The worked example from the plan (Part C1). If these numbers ever change, either
 * the maths broke or the plan did — do not "fix" the test to match the code.
 */
describe('rounding', () => {
  it('rounds half away from zero, like Postgres numeric', () => {
    expect(roundTo(2.675, 2)).toBe(2.68)
    expect(roundTo(0.5, 0)).toBe(1)
    expect(roundTo(-0.5, 0)).toBe(-1)
    expect(roundTo(-2.675, 2)).toBe(-2.68)
    expect(round2(1.005)).toBe(1.01)
    expect(round4(714.57731)).toBe(714.5773)
  })

  it('survives float representation error', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3)
    expect(round2(1.0049999999)).toBe(1)
  })
})

describe('weighted average cost', () => {
  it('reaches 1,270 on the worked example', () => {
    // 100 kg landed at 1,230 then 50 kg at 1,350
    expect(weightedAverage(100, 1230, 50, 1350)).toBe(1270)
  })

  it('takes the incoming cost when there was no stock', () => {
    expect(weightedAverage(0, 0, 40, 812.5)).toBe(812.5)
  })

  it('is not the last price', () => {
    const avg = weightedAverage(900, 100, 100, 200)
    expect(avg).toBe(110)
    expect(avg).not.toBe(200)
  })

  it('falls back to the incoming cost if the new balance is zero', () => {
    expect(weightedAverage(10, 500, -10, 640)).toBe(640)
  })
})

describe('landed cost allocation', () => {
  it('turns 100 kg @ 1,200 with 3,000 freight into 1,230/kg', () => {
    const { lines, subtotal } = allocateLandedCost(
      [{ quantity_kg: 100, price_per_kg: 1200 }],
      3000,
    )
    expect(subtotal).toBe(120000)
    expect(lines[0].landed_cost_per_kg).toBe(1230)
  })

  it('splits freight by line value, not by quantity', () => {
    // 5,000 freight over a 90,000 line and a 10,000 line → 4,500 / 500
    const { lines } = allocateLandedCost(
      [
        { quantity_kg: 100, price_per_kg: 900 },
        { quantity_kg: 100, price_per_kg: 100 },
      ],
      5000,
    )
    expect(round2(lines[0].landed_cost_per_kg)).toBe(945) // 900 + 4500/100
    expect(round2(lines[1].landed_cost_per_kg)).toBe(105) // 100 + 500/100

    const allocated =
      (lines[0].landed_cost_per_kg - 900) * 100 + (lines[1].landed_cost_per_kg - 100) * 100
    expect(round2(allocated)).toBe(5000)
  })

  it('leaves price alone when there is no extra cost', () => {
    const { lines } = allocateLandedCost([{ quantity_kg: 50, price_per_kg: 1350 }], 0)
    expect(lines[0].landed_cost_per_kg).toBe(1350)
  })

  it('does not divide by zero on an empty purchase', () => {
    const { lines, subtotal } = allocateLandedCost([], 5000)
    expect(subtotal).toBe(0)
    expect(lines).toHaveLength(0)
  })
})

describe('purchase totals', () => {
  it('adds extras and subtracts discount', () => {
    const totals = purchaseTotals({
      lines: [{ quantity_kg: 100, price_per_kg: 1200 }],
      freight_cost: 3000,
      other_cost: 500,
      discount: 1000,
      paid_amount: 100000,
    })
    expect(totals.subtotal).toBe(120000)
    expect(totals.extra).toBe(3500)
    expect(totals.total).toBe(122500)
    expect(totals.balance).toBe(22500)
  })
})

describe('batch cost', () => {
  it('produces 714.5773/kg on the worked example', () => {
    const result = batchCost({
      materialCost: 63850, // 30×1270 + 55×400 + 15×250
      laborCost: 2500,
      overheadCost: 1800,
      packagingCostPerKg: 12,
      producedKg: 97,
      plannedKg: 100,
    })
    expect(result.packagingCost).toBe(1164)
    expect(result.totalCost).toBe(69314)
    expect(result.costPerKg).toBe(714.5773)
    expect(result.wastageKg).toBe(3)
    expect(result.wastagePct).toBe(3)
  })

  it('raises cost per kg by about 4% when yield drops from 100 to 96', () => {
    const base = { materialCost: 60000, laborCost: 2000, overheadCost: 1000, packagingCostPerKg: 0 }
    const full = batchCost({ ...base, producedKg: 100, plannedKg: 100 })
    const short = batchCost({ ...base, producedKg: 96, plannedKg: 100 })
    const increase = (short.costPerKg - full.costPerKg) / full.costPerKg
    expect(increase).toBeGreaterThan(0.04)
    expect(increase).toBeLessThan(0.0417)
    expect(short.wastagePct).toBe(4)
  })

  it('returns zero cost per kg rather than Infinity on a zero yield', () => {
    const result = batchCost({
      materialCost: 1000,
      laborCost: 0,
      overheadCost: 0,
      packagingCostPerKg: 0,
      producedKg: 0,
    })
    expect(result.costPerKg).toBe(0)
  })
})

describe('theoretical ink cost', () => {
  it('spreads batch costs over the effective yield', () => {
    const cost = theoreticalInkCost({
      materialCostPerBatch: 63850,
      laborCostPerBatch: 2500,
      overheadCostPerBatch: 1800,
      packagingCostPerKg: 12,
      batchSizeKg: 100,
      expectedWastagePct: 3,
    })
    expect(cost.effectiveYieldKg).toBe(97)
    // (63850 + 2500 + 1800) / 97 + 12
    expect(round4(cost.baseCostPerKg)).toBe(714.5773)
    expect(round4(cost.materialPerKg)).toBe(658.2474)
  })

  it('does not divide by zero when wastage is 100% of a zero batch', () => {
    const cost = theoreticalInkCost({
      materialCostPerBatch: 1000,
      laborCostPerBatch: 0,
      overheadCostPerBatch: 0,
      packagingCostPerKg: 5,
      batchSizeKg: 0,
      expectedWastagePct: 0,
    })
    expect(cost.baseCostPerKg).toBe(5)
  })
})

describe('margin', () => {
  it('is measured on the selling price', () => {
    expect(round2(marginPct(950, 714.5773))).toBe(24.78)
    expect(round2(markupPct(950, 714.5773))).toBe(32.95)
  })

  it('is zero rather than Infinity when the price is zero', () => {
    expect(marginPct(0, 500)).toBe(0)
    expect(markupPct(500, 0)).toBe(0)
  })

  it('goes negative below cost', () => {
    expect(marginPct(600, 700)).toBeLessThan(0)
  })
})

describe('sale profit', () => {
  it('locks 9,416.91 on the worked example', () => {
    const line = saleLineTotals({ quantity_kg: 40, price_per_kg: 950, cost_per_kg: 714.5773 })
    expect(line.lineTotal).toBe(38000)
    expect(line.lineCost).toBe(28583.09)
    expect(line.lineProfit).toBe(9416.91)
    expect(line.belowCost).toBe(false)
  })

  it('flags a line sold below cost', () => {
    const line = saleLineTotals({ quantity_kg: 10, price_per_kg: 600, cost_per_kg: 700 })
    expect(line.belowCost).toBe(true)
    expect(line.lineProfit).toBe(-1000)
  })

  it('takes the discount off the total before profit', () => {
    const totals = saleTotals(
      [{ quantity_kg: 40, price_per_kg: 950, cost_per_kg: 714.5773 }],
      2000,
      10000,
    )
    expect(totals.subtotal).toBe(38000)
    expect(totals.total).toBe(36000)
    expect(totals.cogs).toBe(28583.09)
    expect(totals.profit).toBe(7416.91)
    expect(round2(totals.marginPct)).toBe(20.6)
    expect(totals.balance).toBe(26000)
  })

  it('reports no margin on an empty sale instead of NaN', () => {
    const totals = saleTotals([], 0, 0)
    expect(totals.total).toBe(0)
    expect(totals.marginPct).toBe(0)
  })
})

describe('days of cover', () => {
  it('divides stock by average daily consumption', () => {
    expect(daysOfCover(90, 90)).toBe(90) // 1 kg/day
    expect(daysOfCover(45, 180)).toBe(22.5)
  })

  it('is unknown when nothing has been consumed', () => {
    expect(daysOfCover(100, 0)).toBeNull()
  })
})
