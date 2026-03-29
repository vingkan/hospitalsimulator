import { describe, it, expect } from 'vitest'
import { aggregateFinance, getFitnessCriteria } from '../modules/finance'
import type { ModuleFinancials, ModuleSignals } from '../modules/types'

// ── Helpers ──────────────────────────────────────────────────────────

function makeModuleFinancials(overrides: Partial<ModuleFinancials> = {}): ModuleFinancials {
  return {
    revenue: overrides.revenue ?? 0,
    expenses: {
      labor: overrides.expenses?.labor ?? 0,
      supplies: overrides.expenses?.supplies ?? 0,
      overhead: overrides.expenses?.overhead ?? 0,
      capital: overrides.expenses?.capital ?? 0,
      programs: overrides.expenses?.programs ?? 0,
    },
  }
}

function defaultSignals(): ModuleSignals {
  return {
    bedPressure: 0,
    qualityScore: 56,
    readmissionRate: 0.12,
  }
}

// ── Tests ────────────────────────────────────────────────────────────

describe('Finance aggregator', () => {
  // 1. Revenue aggregation sums module revenues + medical revenue
  it('revenue aggregation sums module revenues and medical revenue', () => {
    const orFinancials = makeModuleFinancials({ revenue: 22_000_000 }) // ~1000 surgical cases
    const medsurgFinancials = makeModuleFinancials({
      expenses: { labor: 82_500_000, supplies: 24_000_000, overhead: 0, capital: 0, programs: 0 },
    })

    const result = aggregateFinance(
      [medsurgFinancials, orFinancials],
      defaultSignals(),
      [],
      50_000_000, // prevCash
      1.0,        // drgAccuracy
      10_000,     // patientVolume
    )

    // Surgical revenue = 22M (from OR)
    expect(result.revenue.surgical).toBe(22_000_000)
    // Medical revenue: 9000 medical cases with payer mix
    // Medicare: ~4050 × $14,000 = ~56.7M
    // Commercial: ~3150 × $20,000 = ~63M
    // Medicaid: ~1350 × $8,000 = ~10.8M
    // Self-pay: ~450 × $3,000 = ~1.35M
    // Total medical: ~131.85M
    expect(result.revenue.medical).toBeGreaterThan(100_000_000)
    expect(result.revenue.medical).toBeLessThan(160_000_000)
    // Total = medical + surgical
    expect(result.revenue.total).toBe(result.revenue.medical + result.revenue.surgical)
  })

  // 2. Expense aggregation sums module expenses + overhead
  it('expense aggregation sums module expenses and overhead', () => {
    const medsurgFinancials = makeModuleFinancials({
      expenses: { labor: 82_500_000, supplies: 24_000_000, overhead: 0, capital: 0, programs: 2_000_000 },
    })
    const orFinancials = makeModuleFinancials({
      revenue: 22_000_000,
      expenses: { labor: 0, supplies: 5_000_000, overhead: 0, capital: 0, programs: 0 },
    })

    const result = aggregateFinance(
      [medsurgFinancials, orFinancials],
      defaultSignals(),
      [],
      50_000_000,
      1.0,
      10_000,
    )

    expect(result.expenses.labor).toBe(82_500_000)
    expect(result.expenses.supplies).toBe(29_000_000) // 24M + 5M
    expect(result.expenses.programs).toBe(2_000_000)
    // Overhead includes base $32M + malpractice
    expect(result.expenses.overhead).toBeGreaterThan(32_000_000)
    // Capital includes $8M depreciation
    expect(result.expenses.capital).toBeGreaterThanOrEqual(8_000_000)
    // Total = sum of all categories
    expect(result.expenses.total).toBe(
      result.expenses.labor + result.expenses.supplies +
      result.expenses.overhead + result.expenses.capital +
      result.expenses.programs
    )
  })

  // 3. Hospital-wide overhead includes malpractice (inversely related to quality)
  it('malpractice cost inversely related to quality score', () => {
    const financials = [makeModuleFinancials()]

    const lowQuality = aggregateFinance(
      financials,
      { bedPressure: 0, qualityScore: 30, readmissionRate: 0.12 },
      [], 0, 1.0, 1000,
    )
    const highQuality = aggregateFinance(
      financials,
      { bedPressure: 0, qualityScore: 80, readmissionRate: 0.12 },
      [], 0, 1.0, 1000,
    )

    // Lower quality → higher malpractice → higher overhead
    expect(lowQuality.expenses.overhead).toBeGreaterThan(highQuality.expenses.overhead)
    // Malpractice at quality=30: $1M × (100-30)/50 = $1.4M
    // Malpractice at quality=80: $1M × (100-80)/50 = $0.4M
    // Difference should be ~$1M
    const diff = lowQuality.expenses.overhead - highQuality.expenses.overhead
    expect(diff).toBeGreaterThanOrEqual(800_000)
    expect(diff).toBeLessThanOrEqual(1_200_000)
  })

  // 4. Medicare readmission penalty reduces rate when above 15%
  it('Medicare readmission penalty reduces revenue when above 15%', () => {
    const financials = [makeModuleFinancials()]

    const noPenalty = aggregateFinance(
      financials,
      { bedPressure: 0, qualityScore: 56, readmissionRate: 0.12 },
      [], 0, 1.0, 10_000,
    )
    const withPenalty = aggregateFinance(
      financials,
      { bedPressure: 0, qualityScore: 56, readmissionRate: 0.18 },
      [], 0, 1.0, 10_000,
    )

    // Readmission > 0.15 triggers 2% Medicare rate reduction
    // Medical revenue should be lower with penalty
    expect(withPenalty.revenue.medical).toBeLessThan(noPenalty.revenue.medical)
    // Medicare is 45% of medical cases, penalty is 2% on Medicare rate
    // Difference should be noticeable but not huge
    const pctDiff = (noPenalty.revenue.medical - withPenalty.revenue.medical) / noPenalty.revenue.medical
    expect(pctDiff).toBeGreaterThanOrEqual(0.005)
    expect(pctDiff).toBeLessThanOrEqual(0.02)
  })

  // 5. Cash flow: prevCash + (revenue - expenses)
  it('cash reserves equal prevCash plus net income', () => {
    const financials = [makeModuleFinancials({
      expenses: { labor: 80_000_000, supplies: 20_000_000, overhead: 0, capital: 0, programs: 0 },
    })]
    const prevCash = 50_000_000

    const result = aggregateFinance(
      financials,
      defaultSignals(),
      [],
      prevCash,
      1.0,
      10_000,
    )

    const netIncome = result.revenue.total - result.expenses.total
    expect(result.cashReserves).toBeCloseTo(prevCash + netIncome, 0)
  })

  // 6. getFitnessCriteria returns margin/labor%/supply% ranges
  it('getFitnessCriteria returns margin, labor%, and supply% ranges', () => {
    const criteria = getFitnessCriteria()
    expect(criteria.length).toBeGreaterThanOrEqual(3)

    const margin = criteria.find(c => c.metric === 'margin')
    expect(margin).toBeDefined()
    expect(margin!.min).toBeGreaterThanOrEqual(0)
    expect(margin!.max).toBeLessThanOrEqual(0.10)

    const labor = criteria.find(c => c.metric === 'laborPctOfExpenses')
    expect(labor).toBeDefined()
    expect(labor!.min).toBeGreaterThanOrEqual(0.40)
    expect(labor!.max).toBeLessThanOrEqual(0.70)

    const supply = criteria.find(c => c.metric === 'supplyPctOfExpenses')
    expect(supply).toBeDefined()
    expect(supply!.min).toBeGreaterThanOrEqual(0.10)
    expect(supply!.max).toBeLessThanOrEqual(0.25)
  })
})
