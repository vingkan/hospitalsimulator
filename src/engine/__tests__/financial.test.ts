import { describe, it, expect } from 'vitest'
import { computeFinancial } from '../financial'
import { createInitialState } from '../constants'

describe('computeFinancial', () => {
  const initialState = createInitialState([])

  it('starting state revenue is approximately $39-40M', () => {
    const financial = computeFinancial(initialState)
    // Revenue includes medical (~$31M) + surgical (~$8M)
    expect(financial.revenue.total).toBeGreaterThan(38_000_000)
    expect(financial.revenue.total).toBeLessThan(41_000_000)
  })

  it('starting state expenses are approximately $37-39M', () => {
    const financial = computeFinancial(initialState)
    expect(financial.expenses.total).toBeGreaterThan(37_000_000)
    expect(financial.expenses.total).toBeLessThan(40_000_000)
  })

  it('starting margin is positive (hospital starts healthy)', () => {
    const financial = computeFinancial(initialState)
    expect(financial.margin).toBeGreaterThan(0)
  })

  it('starting margin is realistic at 2-4%', () => {
    const financial = computeFinancial(initialState)
    // Starting margin calibrated to realistic community hospital (~2.7%)
    expect(financial.margin).toBeGreaterThan(0.01)
    expect(financial.margin).toBeLessThan(0.05)
  })

  it('surgical revenue is tracked separately', () => {
    const financial = computeFinancial(initialState)
    expect(financial.revenue.surgical).toBeGreaterThan(0)
    expect(financial.revenue.medical).toBeGreaterThan(0)
    expect(financial.revenue.total).toBeCloseTo(
      financial.revenue.medical + financial.revenue.surgical,
      0
    )
  })

  it('expenses sum correctly', () => {
    const financial = computeFinancial(initialState)
    const sum =
      financial.expenses.labor.amount +
      financial.expenses.supplies.amount +
      financial.expenses.overhead.amount +
      financial.expenses.capital.amount +
      financial.expenses.programSubsidies
    expect(financial.expenses.total).toBeCloseTo(sum, 0)
  })

  it('medicare rate is penalized when readmission rate is high', () => {
    // Create states with clearly different readmission rates
    const lowReadmissionState = {
      ...initialState,
      operational: {
        ...initialState.operational,
        readmissionRate: 0.10, // below 0.15 threshold
      },
    }
    const highReadmissionState = {
      ...initialState,
      operational: {
        ...initialState.operational,
        readmissionRate: 0.20, // above 0.15 threshold
      },
    }
    const normalFinancial = computeFinancial(lowReadmissionState)
    const penalizedFinancial = computeFinancial(highReadmissionState)

    expect(penalizedFinancial.payers.medicare.effectiveRate)
      .toBeLessThan(normalFinancial.payers.medicare.effectiveRate)
  })

  it('program subsidies increase when hospitalist program is active', () => {
    const withHospitalist = {
      ...initialState,
      programs: {
        ...initialState.programs,
        hospitalist: {
          active: true,
          workforce: 'employed' as const,
          cdiIntensity: 'light' as const,
          documentationTraining: true,
          effectiveness: 1.0,
        },
      },
    }
    const baseFinancial = computeFinancial(initialState)
    const hospFinancial = computeFinancial(withHospitalist)

    expect(hospFinancial.expenses.programSubsidies)
      .toBeGreaterThan(baseFinancial.expenses.programSubsidies)
  })

  it('cash reserves update based on revenue minus expenses', () => {
    const financial = computeFinancial(initialState)
    const expectedCash = initialState.financial.cashReserves +
      (financial.revenue.total - financial.expenses.total)
    expect(financial.cashReserves).toBeCloseTo(expectedCash, 0)
  })
})
