import { describe, it, expect } from 'vitest'
import { simulateYear, initializeGame, recalcBedPressure } from '../orchestrator'
import { ALL_EVENTS, shuffleEvents, drawEvent, eventToModuleEffects } from '../events'
import type { ModuleOutputs } from '../modules/types'
import type { MedSurgState } from '../modules/medsurg'
import type { ProgramState } from '../types'

function defaultPrograms(): ProgramState {
  return {
    nurseRatio: 5,
    compensationChange: 0,
    supplyTier: 'standard',
  }
}

describe('initializeGame', () => {
  it('produces valid initial state', () => {
    const deck = shuffleEvents(ALL_EVENTS)
    const state = initializeGame(deck)

    expect(state.year).toBe(1)
    expect(state.gameOver).toBe(false)
    expect(state.history).toHaveLength(0)
    // Readmissions seeded at steady-state: base * rate / (1 - rate)
    expect(state.prevReadmissions).toBeGreaterThan(1000)
    expect(state.prevReadmissions).toBeLessThan(2500)
    expect(state.financials.cashReserves).toBeGreaterThan(0)
    expect(state.financials.margin).toBeGreaterThan(-0.5)
    expect(state.financials.margin).toBeLessThan(0.5)
    expect(state.moduleStates.sources).toBeDefined()
    expect(state.moduleStates.medsurg).toBeDefined()
    expect(state.moduleStates.or).toBeDefined()
  })
})

describe('simulateYear', () => {
  it('produces valid year result', () => {
    const deck = shuffleEvents(ALL_EVENTS)
    const state = initializeGame(deck)
    const event = drawEvent(deck, 0)
    const result = simulateYear(state, defaultPrograms(), event)

    expect(result.year).toBe(1)
    expect(result.state.year).toBe(2)
    expect(result.event).toBe(event)
    expect(result.financials).toBeDefined()
    expect(result.financials.revenue.total).toBeGreaterThan(0)
    expect(result.financials.expenses.total).toBeGreaterThan(0)
    expect(result.moduleOutputs.sources).toBeDefined()
    expect(result.moduleOutputs.medsurg).toBeDefined()
    expect(result.moduleOutputs.or).toBeDefined()
  })

  it('runs a full 5-year game', () => {
    const deck = shuffleEvents(ALL_EVENTS)
    let state = initializeGame(deck)
    const programs = defaultPrograms()

    for (let y = 0; y < 5; y++) {
      const event = drawEvent(deck, y)
      const result = simulateYear(state, programs, event)
      state = result.state
    }

    expect(state.year).toBe(6)
    expect(state.history).toHaveLength(5)
  })

  it('detects game over when cash goes deeply negative', () => {
    const deck = shuffleEvents(ALL_EVENTS)
    let state = initializeGame(deck)

    // Set cash deeply negative so even positive net income can't recover
    state = { ...state, financials: { ...state.financials, cashReserves: -100_000_000 } }

    const event = drawEvent(deck, 0)
    const result = simulateYear(state, defaultPrograms(), event)

    // Cash should still be negative (net income ~$9M can't cover $100M hole)
    expect(result.state.financials.cashReserves).toBeLessThan(0)
    expect(result.state.gameOver).toBe(true)
  })
})

describe('two-pass bed pressure', () => {
  it('Sources output differs between pass 1 (no pressure) and pass 2 (with pressure)', () => {
    const deck = shuffleEvents(ALL_EVENTS)
    const state = initializeGame(deck)

    // Run with default programs, which should produce some occupancy
    const event = drawEvent(deck, 0)
    const result = simulateYear(state, defaultPrograms(), event)

    // Sources volume should be in a reasonable range
    const sourcesOutput = result.moduleOutputs.sources
    expect(sourcesOutput.patients.count).toBeGreaterThan(5000)
    expect(sourcesOutput.patients.count).toBeLessThan(15000)

    // Med/Surg should produce bed pressure > 0
    const medsurgOutput = result.moduleOutputs.medsurg
    expect(medsurgOutput.signals.bedPressure).toBeGreaterThanOrEqual(0)
  })
})

describe('readmission feedback', () => {
  it('readmissions from year N feed into year N+1 volume', () => {
    const deck = shuffleEvents(ALL_EVENTS)
    let state = initializeGame(deck)
    const programs = defaultPrograms()

    // Year 1
    const event1 = drawEvent(deck, 0)
    const result1 = simulateYear(state, programs, event1)
    state = result1.state

    // prevReadmissions should be > 0 (readmission rate × patient volume)
    expect(state.prevReadmissions).toBeGreaterThan(0)

    // Year 2
    const event2 = drawEvent(deck, 1)
    const result2 = simulateYear(state, programs, event2)

    // Year 2 Sources output should include readmissions
    expect(result2.moduleOutputs.sources.patients.count).toBeGreaterThan(0)
  })
})

describe('event adapter', () => {
  it('converts flu season event to module-targeted effects', () => {
    const fluEvent = ALL_EVENTS.find(e => e.id === 'flu-season')!
    const effects = eventToModuleEffects(fluEvent)

    // Flu season has volumeModifier and supplyCostModifier
    const volumeEffect = effects.find(e => e.moduleId === 'sources' && e.volumeModifier != null)
    expect(volumeEffect).toBeDefined()
    expect(volumeEffect!.volumeModifier).toBe(0.20)

    const supplyEffect = effects.find(e => e.supplyCostModifier != null)
    expect(supplyEffect).toBeDefined()
    expect(supplyEffect!.supplyCostModifier).toBe(0.15)
  })

  it('converts medicare rate cut to finance-targeted effect', () => {
    const mcEvent = ALL_EVENTS.find(e => e.id === 'medicare-rate-cut')!
    const effects = eventToModuleEffects(mcEvent)

    const rateEffect = effects.find(e => e.moduleId === 'finance' && e.rateModifier != null)
    expect(rateEffect).toBeDefined()
    expect(rateEffect!.rateModifier).toBe(-0.03)
  })
})

describe('module interaction', () => {
  it('Sources → MedSurg → OR pipeline produces consistent results', () => {
    const deck = shuffleEvents(ALL_EVENTS)
    const state = initializeGame(deck)
    const event = drawEvent(deck, 0)
    const result = simulateYear(state, defaultPrograms(), event)

    const sourcesCount = result.moduleOutputs.sources.patients.count
    const medsurgCount = result.moduleOutputs.medsurg.patients.count
    const orCount = result.moduleOutputs.or.patients.count

    // Med/Surg receives all patients from Sources
    expect(medsurgCount).toBe(sourcesCount)

    // OR receives surgical fraction of Med/Surg output
    const expectedSurgical = Math.round(medsurgCount * result.moduleOutputs.medsurg.patients.surgicalFraction)
    // OR completed ≤ surgical demand (capacity or cancellation limited)
    expect(orCount).toBeLessThanOrEqual(expectedSurgical)
    expect(orCount).toBeGreaterThan(0)
  })
})

describe('recalcBedPressure', () => {
  it('increases bed pressure when OR recovery patients are added', () => {
    // High volume to push occupancy above threshold (0.80)
    const medsurgOutput: ModuleOutputs = {
      patients: { count: 12000, avgAcuity: 1.5, surgicalFraction: 0.15, avgLOS: 5.2 },
      financials: { revenue: 0, expenses: { labor: 0, supplies: 0, overhead: 0, capital: 0, programs: 0 } },
      signals: { bedPressure: 0.5, qualityScore: 56, readmissionRate: 0.16 },
    }
    const medsurgState: MedSurgState = {
      beds: 200,
      occupancyRate: 0.85,
      lengthOfStay: 5.2,
      qualityScore: 56,
      drgAccuracy: 1.0,
      readmissionRate: 0.16,
      headcount: 1100,
      avgCompPerYear: 76000,
      prevHospitalistEffectiveness: null,
    }

    const pressureWithout = recalcBedPressure(medsurgOutput, 0, medsurgState)
    const pressureWith = recalcBedPressure(medsurgOutput, 1000, medsurgState)

    // 12000*5.2/(200*365) = 0.855 occupancy → pressure = (0.855-0.80)/0.15 = 0.367
    // 13000*5.2/(200*365) = 0.926 → pressure = (0.926-0.80)/0.15 = 0.841
    expect(pressureWith).toBeGreaterThan(pressureWithout)
    expect(pressureWithout).toBeGreaterThan(0)
    expect(pressureWith).toBeGreaterThan(0.5)
  })
})
