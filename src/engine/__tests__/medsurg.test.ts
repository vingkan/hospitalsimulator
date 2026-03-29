import { describe, it, expect } from 'vitest'
import { medSurgModule } from '../modules/medsurg'
import type { MedSurgState } from '../modules/medsurg'
import type { ModuleInputs, ModuleControls } from '../modules/types'

// ── Helpers ──────────────────────────────────────────────────────────

function defaultConfig() {
  return {
    id: 'medsurg',
    calibrationConstants: {},
  }
}

function defaultState(): MedSurgState {
  return medSurgModule.init(defaultConfig()) as MedSurgState
}

function defaultInputs(volume = 10000): ModuleInputs {
  return {
    patients: {
      count: volume,
      avgAcuity: 1.2,
      surgicalFraction: 0.15,
      avgLOS: 5.2,
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
    nurseRatio: 5,
    compensationChange: 0,
    headcountDelta: 0,
    supplyTier: 'standard',
    hospitalistActive: false,
    hospitalistWorkforce: 'employed',
    hospitalistCDI: 'light',
    hospitalistDocTraining: false,
    dischargeActive: false,
    dischargeModel: 'dedicated_planners',
    dischargePartnerships: false,
  }
}

// ── Tests ────────────────────────────────────────────────────────────

describe('Med/Surg module', () => {
  // 1. init produces valid state with correct defaults
  it('init produces valid state with correct defaults', () => {
    const state = defaultState()
    expect(state.beds).toBe(200)
    expect(state.headcount).toBe(1100)
    expect(state.avgCompPerYear).toBe(76_000)
    expect(state.qualityScore).toBeCloseTo(56, 0)
    expect(state.lengthOfStay).toBeCloseTo(5.2, 1)
    expect(state.readmissionRate).toBeCloseTo(0.166, 2)
    expect(state.drgAccuracy).toBe(1.0)
    expect(state.prevHospitalistEffectiveness).toBeNull()
  })

  // 2. LOS modifiers: hospitalist employed+light reduces LOS
  it('hospitalist employed+light CDI reduces LOS', () => {
    const state = defaultState()
    const inputs = defaultInputs()
    const controls = {
      ...defaultControls(),
      hospitalistActive: true,
      hospitalistWorkforce: 'employed',
      hospitalistCDI: 'light',
    }

    const { nextState } = medSurgModule.tick(state, inputs, controls)
    const ns = nextState as MedSurgState
    // Employed+light should reduce LOS by up to 0.8 days from baseline 5.2
    expect(ns.lengthOfStay).toBeGreaterThanOrEqual(3.5)
    expect(ns.lengthOfStay).toBeLessThan(5.2)
    // Should be around 4.4 (5.2 - 0.8)
    expect(ns.lengthOfStay).toBeGreaterThanOrEqual(4.0)
    expect(ns.lengthOfStay).toBeLessThanOrEqual(4.8)
  })

  // 3. LOS modifiers: discharge dedicated_planners reduces LOS
  it('discharge dedicated_planners reduces LOS', () => {
    const state = defaultState()
    const inputs = defaultInputs()
    const controls = {
      ...defaultControls(),
      dischargeActive: true,
      dischargeModel: 'dedicated_planners',
      dischargePartnerships: true,
    }

    const { nextState } = medSurgModule.tick(state, inputs, controls)
    const ns = nextState as MedSurgState
    // dedicated_planners: -0.6, partnerships: -0.2 (with diminishing returns)
    expect(ns.lengthOfStay).toBeLessThan(5.2)
    expect(ns.lengthOfStay).toBeGreaterThanOrEqual(3.5)
    // Should be around 4.4-4.6 after diminishing returns
    expect(ns.lengthOfStay).toBeGreaterThanOrEqual(4.0)
    expect(ns.lengthOfStay).toBeLessThanOrEqual(4.8)
  })

  // 4. Quality score weighted average (no programs = ~56)
  it('quality score is ~56 at baseline (no programs)', () => {
    const state = defaultState()
    const inputs = defaultInputs()
    const controls = defaultControls() // nurseRatio=5, standard supplies, no programs

    const { nextState } = medSurgModule.tick(state, inputs, controls)
    const ns = nextState as MedSurgState
    // 0.4*80 + 0.3*20 + 0.3*60 = 32 + 6 + 18 = 56
    expect(ns.qualityScore).toBeGreaterThanOrEqual(50)
    expect(ns.qualityScore).toBeLessThanOrEqual(62)
  })

  // 5. Quality score with programs active (higher)
  it('quality score increases with hospitalist + doc training', () => {
    const state = defaultState()
    const inputs = defaultInputs()
    const controlsBase = defaultControls()
    const controlsProgram = {
      ...defaultControls(),
      hospitalistActive: true,
      hospitalistDocTraining: true,
    }

    const { nextState: nsBase } = medSurgModule.tick(state, inputs, controlsBase)
    const { nextState: nsProgram } = medSurgModule.tick(state, inputs, controlsProgram)
    const qBase = (nsBase as MedSurgState).qualityScore
    const qProgram = (nsProgram as MedSurgState).qualityScore

    expect(qProgram).toBeGreaterThan(qBase)
    // hospitalist+docTraining gives program quality 100 instead of 20
    // difference = 0.3 * (100 - 20) = 24
    expect(qProgram).toBeGreaterThanOrEqual(70)
    expect(qProgram).toBeLessThanOrEqual(86)
  })

  // 6. DRG accuracy with CDI and doc training
  it('DRG accuracy improves with hospitalist CDI and doc training', () => {
    const state = defaultState()
    const inputs = defaultInputs()
    const controls = {
      ...defaultControls(),
      hospitalistActive: true,
      hospitalistWorkforce: 'employed',
      hospitalistCDI: 'aggressive',
      hospitalistDocTraining: true,
    }

    const { nextState } = medSurgModule.tick(state, inputs, controls)
    const ns = nextState as MedSurgState
    // Base 1.0 + 0.02 (doc training) + 0.02 (aggressive CDI) = 1.04
    expect(ns.drgAccuracy).toBeGreaterThan(1.0)
    expect(ns.drgAccuracy).toBeGreaterThanOrEqual(1.03)
    expect(ns.drgAccuracy).toBeLessThanOrEqual(1.06)
  })

  // 7. Readmission rate from quality (inverse relationship)
  it('readmission rate decreases with higher quality', () => {
    const state = defaultState()
    const inputs = defaultInputs()

    // Low quality: budget supplies, ratio 8, no programs
    const controlsLow = {
      ...defaultControls(),
      nurseRatio: 8,
      supplyTier: 'budget',
    }
    // High quality: premium supplies, ratio 4, hospitalist+docTraining
    const controlsHigh = {
      ...defaultControls(),
      nurseRatio: 4,
      supplyTier: 'premium',
      hospitalistActive: true,
      hospitalistDocTraining: true,
    }

    const { nextState: nsLow } = medSurgModule.tick(state, inputs, controlsLow)
    const { nextState: nsHigh } = medSurgModule.tick(state, inputs, controlsHigh)

    const readmitLow = (nsLow as MedSurgState).readmissionRate
    const readmitHigh = (nsHigh as MedSurgState).readmissionRate

    expect(readmitLow).toBeGreaterThan(readmitHigh)
    expect(readmitLow).toBeGreaterThanOrEqual(0.08)
    expect(readmitLow).toBeLessThanOrEqual(0.30)
    expect(readmitHigh).toBeGreaterThanOrEqual(0.08)
    expect(readmitHigh).toBeLessThanOrEqual(0.30)
  })

  // 8. Bed pressure signal at high occupancy
  it('bed pressure approaches 1.0 at high occupancy', () => {
    const state = defaultState()
    // High volume to push occupancy up
    // beds=200, LOS=5.2 → need volume such that volume*5.2/(200*365) >= 0.95
    // volume >= 0.95 * 200 * 365 / 5.2 ≈ 13327
    const inputs = defaultInputs(14000)
    const controls = defaultControls()

    const { outputs } = medSurgModule.tick(state, inputs, controls)

    expect(outputs.signals.bedPressure).toBeGreaterThanOrEqual(0.9)
    expect(outputs.signals.bedPressure).toBeLessThanOrEqual(1.0)
  })

  // 9. Occupancy calculation (annual)
  it('occupancy computed correctly using annual bed-days', () => {
    const state = defaultState()
    const volume = 10000
    const inputs = defaultInputs(volume)
    const controls = defaultControls()

    const { nextState } = medSurgModule.tick(state, inputs, controls)
    const ns = nextState as MedSurgState

    // Expected: (10000 * LOS) / (200 * 365)
    // LOS at baseline ≈ 5.2, so occ ≈ 52000 / 73000 ≈ 0.712
    expect(ns.occupancyRate).toBeGreaterThanOrEqual(0.60)
    expect(ns.occupancyRate).toBeLessThanOrEqual(0.80)
  })

  // 10. Labor expense with fixed+variable split and overtime
  it('labor expense scales with headcount, comp, and overtime', () => {
    const state = defaultState()
    const inputs = defaultInputs()
    const controls = {
      ...defaultControls(),
      nurseRatio: 7, // higher ratio → higher overtime multiplier (~1.35)
      compensationChange: 5, // +5% comp
    }

    const { outputs } = medSurgModule.tick(state, inputs, controls)

    // Fixed+variable labor with 70/30 split
    // fixedStaff=770, variableStaff=330, comp=76000*1.05=79800, overtime~1.35
    // fixedCost = 770 * 79800 * 1.35 ≈ 82.9M
    // variableUtilization ≈ 0.31 (volume=10000 at nurseRatio=7)
    // variableCost = 330 * 79800 * 0.31 ≈ 8.2M
    // total ≈ 91M
    // With VARIABLE_STAFF_MULTIPLIER=2.4, high nurse ratio produces agency premium
    const labor = outputs.financials.expenses.labor
    expect(labor).toBeGreaterThan(90_000_000)
    expect(labor).toBeLessThan(120_000_000)
  })

  // 11. Supply expense by tier
  it('supply expense varies by tier', () => {
    const state = defaultState()
    const volume = 10000
    const inputs = defaultInputs(volume)

    const controlsBudget = { ...defaultControls(), supplyTier: 'budget' }
    const controlsPremium = { ...defaultControls(), supplyTier: 'premium' }

    const { outputs: outB } = medSurgModule.tick(state, inputs, controlsBudget)
    const { outputs: outP } = medSurgModule.tick(state, inputs, controlsPremium)

    // budget: 10000 * 2100 = 21M, premium: 10000 * 3000 = 30M
    expect(outB.financials.expenses.supplies).toBeCloseTo(21_000_000, -5)
    expect(outP.financials.expenses.supplies).toBeCloseTo(30_000_000, -5)
    expect(outP.financials.expenses.supplies).toBeGreaterThan(outB.financials.expenses.supplies)
  })

  // 12. Labor formula: overstaffed branch (variable scales down with census)
  it('labor cost decreases when volume drops (variable scales down)', () => {
    const state = defaultState()
    const controlsDefault = defaultControls()

    const inputsNormal = defaultInputs(10000)
    const inputsLow = defaultInputs(6000)

    const { outputs: outNormal } = medSurgModule.tick(state, inputsNormal, controlsDefault)
    const { outputs: outLow } = medSurgModule.tick(state, inputsLow, controlsDefault)

    // Lower volume → lower variable labor cost
    expect(outLow.financials.expenses.labor).toBeLessThan(outNormal.financials.expenses.labor)
    // Fixed component (~70%) stays the same, only variable flexes
    const reduction = 1 - outLow.financials.expenses.labor / outNormal.financials.expenses.labor
    expect(reduction).toBeGreaterThan(0.02)
    expect(reduction).toBeLessThan(0.15)
  })

  // 13. Labor formula: understaffed branch (agency premium)
  it('labor cost includes agency premium when understaffed', () => {
    const state = defaultState()
    const controls = defaultControls()

    // Very high volume to exceed variable staff capacity
    const inputsHigh = defaultInputs(16000)
    const { outputs: outHigh } = medSurgModule.tick(state, inputsHigh, controls)

    // Normal volume
    const inputsNormal = defaultInputs(10000)
    const { outputs: outNormal } = medSurgModule.tick(state, inputsNormal, controls)

    // Agency premium should make high-volume labor more expensive
    const laborRatio = outHigh.financials.expenses.labor / outNormal.financials.expenses.labor
    // Labor should increase more than proportionally due to agency premium (1.5x rate)
    expect(laborRatio).toBeGreaterThan(1.0)
  })

  // 14. Labor formula: zero volume produces only fixed cost
  it('zero volume produces only fixed labor cost', () => {
    const state = defaultState()
    const controls = defaultControls()
    const inputsZero = defaultInputs(0)

    const { outputs } = medSurgModule.tick(state, inputsZero, controls)
    const labor = outputs.financials.expenses.labor

    // Fixed cost = 70% × 1100 × 76000 × overtimeMultiplier(1.05) ≈ $61.4M
    // Variable utilization = 0 (zero volume → zero hours needed), so variableCost ≈ 0
    const expectedFixed = 1100 * 0.70 * 76000 * 1.05 // overtime at nurseRatio=5
    expect(labor).toBeCloseTo(expectedFixed, -5)
  })

  // 15. Program subsidies (hospitalist + discharge)
  it('program subsidies reflect active programs', () => {
    const state = defaultState()
    const inputs = defaultInputs()

    // No programs
    const controlsNone = defaultControls()
    const { outputs: outNone } = medSurgModule.tick(state, inputs, controlsNone)
    expect(outNone.financials.expenses.programs).toBe(0)

    // Hospitalist only
    const controlsH = { ...defaultControls(), hospitalistActive: true }
    const { outputs: outH } = medSurgModule.tick(state, inputs, controlsH)
    expect(outH.financials.expenses.programs).toBeCloseTo(3_500_000, -4)

    // Both programs: hospitalist + discharge dedicated
    const controlsBoth = {
      ...defaultControls(),
      hospitalistActive: true,
      dischargeActive: true,
      dischargeModel: 'dedicated_planners',
    }
    const { outputs: outBoth } = medSurgModule.tick(state, inputs, controlsBoth)
    // 3.5M + 1.2M = 4.7M
    expect(outBoth.financials.expenses.programs).toBeCloseTo(4_700_000, -4)

    // Discharge nurse-led only
    const controlsNL = {
      ...defaultControls(),
      dischargeActive: true,
      dischargeModel: 'nurse_led',
    }
    const { outputs: outNL } = medSurgModule.tick(state, inputs, controlsNL)
    expect(outNL.financials.expenses.programs).toBeCloseTo(400_000, -4)
  })
})
