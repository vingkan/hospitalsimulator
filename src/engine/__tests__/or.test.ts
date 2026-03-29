import { describe, it, expect } from 'vitest'
import { orModule } from '../modules/or'
import type { ORState } from '../modules/or'
import type { ModuleInputs, ModuleControls } from '../modules/types'

// ── Helpers ──────────────────────────────────────────────────────────

function defaultConfig() {
  return {
    id: 'or',
    calibrationConstants: {},
  }
}

function defaultState(): ORState {
  return orModule.init(defaultConfig()) as ORState
}

function defaultInputs(count = 1200): ModuleInputs {
  return {
    patients: {
      count,
      avgAcuity: 2.0,
      surgicalFraction: 1.0, // OR receives only surgical patients
      avgLOS: 3.0,
    },
    signals: {
      bedPressure: 0,
      qualityScore: 56,
      readmissionRate: 0.166,
    },
    events: [],
    readmissions: 0,
  }
}

function defaultControls(): ModuleControls {
  return {
    surgicalExpansion: 'none',
  }
}

// ── Tests ────────────────────────────────────────────────────────────

describe('OR module', () => {
  // 1. init produces valid state with default OR capacity
  it('init produces valid state with default OR capacity', () => {
    const state = defaultState()
    expect(state.orCapacity).toBe(1600)
    expect(state.utilization).toBe(0)
    expect(state.expansionCapitalSpent).toBe(false)
  })

  // 2. Surgical demand from input patients is computed correctly
  it('surgical demand from input patients is computed correctly', () => {
    const state = defaultState()
    const inputs = defaultInputs(1000)
    const controls = defaultControls()

    const { outputs } = orModule.tick(state, inputs, controls)

    // Demand 1000, capacity 1600 → all 1000 completed (no bed pressure)
    expect(outputs.patients.count).toBe(1000)
  })

  // 3. Capacity limits completion (demand > capacity → capped)
  it('capacity limits completion when demand exceeds capacity', () => {
    const state = defaultState()
    const inputs = defaultInputs(2000) // demand > 1600 capacity
    const controls = defaultControls()

    const { outputs } = orModule.tick(state, inputs, controls)

    // Completed should be capped at capacity (1600)
    expect(outputs.patients.count).toBeLessThanOrEqual(1600)
    expect(outputs.patients.count).toBeGreaterThan(0)
  })

  // 4. Bed pressure increases cancellation rate
  it('bed pressure increases cancellation rate', () => {
    const state = defaultState()
    const inputsNoPressure = defaultInputs(1200)
    const inputsHighPressure: ModuleInputs = {
      ...defaultInputs(1200),
      signals: { bedPressure: 0.8, qualityScore: 56, readmissionRate: 0.166 },
    }
    const controls = defaultControls()

    const { outputs: outNone } = orModule.tick(state, inputsNoPressure, controls)
    const { outputs: outHigh } = orModule.tick(state, inputsHighPressure, controls)

    // With bed pressure 0.8: cancellationRate = min(0.5, 0.8*0.4) = 0.32
    // Completed should be ~32% fewer
    expect(outHigh.patients.count).toBeLessThan(outNone.patients.count)
    // At 0.8 pressure: 1200 * (1 - 0.32) = 816
    expect(outHigh.patients.count).toBeGreaterThanOrEqual(750)
    expect(outHigh.patients.count).toBeLessThanOrEqual(900)
  })

  // 5. Surgical revenue computed correctly (completed × $22K)
  it('surgical revenue computed correctly', () => {
    const state = defaultState()
    const inputs = defaultInputs(1000)
    const controls = defaultControls()

    const { outputs } = orModule.tick(state, inputs, controls)

    // 1000 completed × $22,000
    expect(outputs.financials.revenue).toBe(1000 * 22_000)
    expect(outputs.financials.expenses.supplies).toBe(1000 * 5_000)
  })

  // 6. Recovery patient output has correct count
  it('recovery patient output has correct cohort properties', () => {
    const state = defaultState()
    const inputs = defaultInputs(800)
    const controls = defaultControls()

    const { outputs } = orModule.tick(state, inputs, controls)

    expect(outputs.patients.count).toBe(800)
    expect(outputs.patients.avgAcuity).toBe(2.0)
    expect(outputs.patients.surgicalFraction).toBe(0)
    expect(outputs.patients.avgLOS).toBe(3.0)
  })

  // 7. getControls returns surgical expansion options
  it('getControls returns surgical expansion segment', () => {
    const controls = orModule.getControls()
    expect(controls).toHaveLength(1)
    expect(controls[0].key).toBe('surgicalExpansion')
    expect(controls[0].type).toBe('segment')
    expect(controls[0].options).toHaveLength(3)
    expect(controls[0].default).toBe('none')
  })

  // 8. getFitnessCriteria returns utilization/cancellation/margin ranges
  it('getFitnessCriteria returns utilization, cancellation, and margin ranges', () => {
    const criteria = orModule.getFitnessCriteria()
    expect(criteria.length).toBeGreaterThanOrEqual(3)

    const utilization = criteria.find(c => c.metric === 'utilization')
    expect(utilization).toBeDefined()
    expect(utilization!.min).toBeGreaterThanOrEqual(0.60)
    expect(utilization!.max).toBeLessThanOrEqual(0.95)

    const cancellation = criteria.find(c => c.metric === 'cancellationRate')
    expect(cancellation).toBeDefined()
    expect(cancellation!.min).toBeGreaterThanOrEqual(0)
    expect(cancellation!.max).toBeLessThanOrEqual(0.20)

    const margin = criteria.find(c => c.metric === 'surgicalContributionMargin')
    expect(margin).toBeDefined()
    expect(margin!.min).toBeGreaterThanOrEqual(0.60)
    expect(margin!.max).toBeLessThanOrEqual(0.90)
  })
})
