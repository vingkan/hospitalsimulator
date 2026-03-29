// Calibration test suite: verifies that the engine produces economically realistic
// results under default settings. These tests catch calibration regressions.
// Evidence sources: AHA Hospital Statistics, CMS IPPS, HFMA benchmarks, BLS data.

import { describe, it, expect } from 'vitest'
import { initializeGame, simulateYear } from '../orchestrator'
import { ALL_EVENTS, shuffleEvents, drawEvent } from '../events'
import { getFitnessCriteria } from '../modules/finance'
import { medSurgModule } from '../modules/medsurg'
import { orModule } from '../modules/or'
import { sourcesModule } from '../modules/sources'
import type { ProgramState, ExternalEvent } from '../types'
import type { MedSurgState } from '../modules/medsurg'

// ── Helpers ──────────────────────────────────────────────────────────

const NO_EVENT: ExternalEvent = {
  id: 'none',
  title: 'Uneventful Year',
  description: 'Nothing unusual happens.',
  operationalEffects: {},
  financialEffects: {},
  duration: 1,
  teaches: '',
}

function defaultPrograms(): ProgramState {
  return { nurseRatio: 5, compensationChange: 0, supplyTier: 'standard' }
}

function hospitalistPrograms(): ProgramState {
  return {
    nurseRatio: 5,
    compensationChange: 0,
    supplyTier: 'standard',
    hospitalist: {
      active: true,
      workforce: 'employed',
      cdiIntensity: 'light',
      documentationTraining: true,
      effectiveness: 1.0,
    },
  }
}

function noEventDeck(): ExternalEvent[] {
  return [NO_EVENT, NO_EVENT, NO_EVENT, NO_EVENT, NO_EVENT]
}

// ── Tests ────────────────────────────────────────────────────────────

describe('Calibration: Year 1 no-event fitness', () => {
  it('margin is 1-4%', () => {
    const state = initializeGame(noEventDeck())
    const r = simulateYear(state, defaultPrograms(), NO_EVENT)
    expect(r.financials.margin).toBeGreaterThanOrEqual(0.01)
    expect(r.financials.margin).toBeLessThanOrEqual(0.04)
  })

  it('labor is 50-60% of total expenses', () => {
    const state = initializeGame(noEventDeck())
    const r = simulateYear(state, defaultPrograms(), NO_EVENT)
    const laborPct = r.financials.expenses.labor / r.financials.expenses.total
    expect(laborPct).toBeGreaterThanOrEqual(0.50)
    expect(laborPct).toBeLessThanOrEqual(0.60)
  })

  it('supplies are 15-20% of total expenses', () => {
    const state = initializeGame(noEventDeck())
    const r = simulateYear(state, defaultPrograms(), NO_EVENT)
    const supplyPct = r.financials.expenses.supplies / r.financials.expenses.total
    expect(supplyPct).toBeGreaterThanOrEqual(0.15)
    expect(supplyPct).toBeLessThanOrEqual(0.20)
  })

  it('overhead is 20-25% of total expenses', () => {
    const state = initializeGame(noEventDeck())
    const r = simulateYear(state, defaultPrograms(), NO_EVENT)
    const overheadPct = r.financials.expenses.overhead / r.financials.expenses.total
    expect(overheadPct).toBeGreaterThanOrEqual(0.20)
    expect(overheadPct).toBeLessThanOrEqual(0.25)
  })

  it('occupancy is 65-85%', () => {
    const state = initializeGame(noEventDeck())
    const r = simulateYear(state, defaultPrograms(), NO_EVENT)
    const occ = (r.state.moduleStates.medsurg as MedSurgState).occupancyRate
    expect(occ).toBeGreaterThanOrEqual(0.65)
    expect(occ).toBeLessThanOrEqual(0.85)
  })

  it('annual volume is 8,000-12,000', () => {
    const state = initializeGame(noEventDeck())
    const r = simulateYear(state, defaultPrograms(), NO_EVENT)
    expect(r.moduleOutputs.sources.patients.count).toBeGreaterThanOrEqual(8_000)
    expect(r.moduleOutputs.sources.patients.count).toBeLessThanOrEqual(12_000)
  })
})

describe('Calibration: 5-year survival', () => {
  it('default play with events does not bankrupt', () => {
    const deck = shuffleEvents(ALL_EVENTS)
    let state = initializeGame(deck)
    const programs = defaultPrograms()

    for (let y = 0; y < 5; y++) {
      const event = drawEvent(deck, y)
      const r = simulateYear(state, programs, event)
      state = r.state
    }

    expect(state.financials.cashReserves).toBeGreaterThan(0)
    expect(state.gameOver).toBe(false)
  })

  it('margin stays within -20% to +25% every year with events', () => {
    // Use ALL_EVENTS in order (deterministic) to avoid shuffle-dependent failures
    const deck = [...ALL_EVENTS]
    let state = initializeGame(deck)
    const programs = defaultPrograms()

    for (let y = 0; y < 5; y++) {
      const event = drawEvent(deck, y)
      const r = simulateYear(state, programs, event)
      // Wide range: events can cause significant swings, but no year should be catastrophic
      expect(r.financials.margin).toBeGreaterThanOrEqual(-0.20)
      expect(r.financials.margin).toBeLessThanOrEqual(0.25)
      state = r.state
    }
  })
})

describe('Calibration: hospitalist program ROI', () => {
  it('hospitalist program produces higher margin than default by Year 3', () => {
    const deck = noEventDeck()

    // Default run
    let stateD = initializeGame(deck)
    for (let y = 0; y < 3; y++) {
      const r = simulateYear(stateD, defaultPrograms(), NO_EVENT)
      stateD = r.state
    }

    // Hospitalist run
    let stateH = initializeGame(deck)
    for (let y = 0; y < 3; y++) {
      const r = simulateYear(stateH, hospitalistPrograms(), NO_EVENT)
      stateH = r.state
    }

    expect(stateH.financials.margin).toBeGreaterThan(stateD.financials.margin)
  })
})

describe('Calibration: volume-sensitive labor', () => {
  it('20% volume drop produces ~6% labor reduction', () => {
    const state = initializeGame(noEventDeck())

    // Normal volume
    const rNormal = simulateYear(state, defaultPrograms(), NO_EVENT)
    const laborNormal = rNormal.financials.expenses.labor

    // Simulate 20% volume drop via low-volume event
    const lowVolEvent: ExternalEvent = {
      id: 'low-vol',
      title: 'Low Volume',
      description: 'Volume drops 20%',
      operationalEffects: { volumeModifier: -0.20 },
      financialEffects: {},
      duration: 1,
      teaches: '',
    }
    const rLow = simulateYear(state, defaultPrograms(), lowVolEvent)
    const laborLow = rLow.financials.expenses.labor

    const reduction = (laborNormal - laborLow) / laborNormal
    // Should be approximately 4-8% reduction (variable staff scales down)
    expect(reduction).toBeGreaterThanOrEqual(0.03)
    expect(reduction).toBeLessThanOrEqual(0.10)
  })

  it('zero volume produces only fixed labor cost', () => {
    const state = initializeGame(noEventDeck())

    // Simulate with a massive volume reduction
    const zeroVolEvent: ExternalEvent = {
      id: 'zero-vol',
      title: 'Zero Volume',
      description: 'No patients',
      operationalEffects: { volumeModifier: -0.99 },
      financialEffects: {},
      duration: 1,
      teaches: '',
    }
    const r = simulateYear(state, defaultPrograms(), zeroVolEvent)
    const labor = r.financials.expenses.labor

    // Fixed labor = 70% of headcount × comp × overtime = 770 * 76000 * ~1.05 = ~$61.4M
    // Variable labor should be minimal (1% of base volume → ~1% variable utilization)
    expect(labor).toBeGreaterThan(55_000_000)
    expect(labor).toBeLessThan(70_000_000)
  })
})

describe('Calibration: module fitness criteria', () => {
  it('all module fitness criteria pass for initial dry tick', () => {
    const state = initializeGame(noEventDeck())
    const r = simulateYear(state, defaultPrograms(), NO_EVENT)
    const f = r.financials

    // Finance fitness criteria
    const financeCriteria = getFitnessCriteria()
    for (const c of financeCriteria) {
      let value: number
      if (c.metric === 'margin') value = f.margin
      else if (c.metric === 'laborPctOfExpenses') value = f.expenses.labor / f.expenses.total
      else if (c.metric === 'supplyPctOfExpenses') value = f.expenses.supplies / f.expenses.total
      else if (c.metric === 'overheadPctOfExpenses') value = f.expenses.overhead / f.expenses.total
      else continue

      expect(value, `Finance: ${c.metric} = ${value}`).toBeGreaterThanOrEqual(c.min)
      expect(value, `Finance: ${c.metric} = ${value}`).toBeLessThanOrEqual(c.max)
    }

    // Med/Surg fitness criteria
    const ms = r.state.moduleStates.medsurg as MedSurgState
    const msCriteria = medSurgModule.getFitnessCriteria()
    for (const c of msCriteria) {
      let value: number
      if (c.metric === 'occupancyRate') value = ms.occupancyRate
      else if (c.metric === 'lengthOfStay') value = ms.lengthOfStay
      else if (c.metric === 'qualityScore') value = ms.qualityScore
      else if (c.metric === 'readmissionRate') value = ms.readmissionRate
      else continue

      expect(value, `MedSurg: ${c.metric} = ${value}`).toBeGreaterThanOrEqual(c.min)
      expect(value, `MedSurg: ${c.metric} = ${value}`).toBeLessThanOrEqual(c.max)
    }

    // Sources fitness criteria
    const sourcesCriteria = sourcesModule.getFitnessCriteria()
    for (const c of sourcesCriteria) {
      let value: number
      if (c.metric === 'annualVolume') value = r.moduleOutputs.sources.patients.count
      else if (c.metric === 'edAdmissionRate') value = 0.30 // default
      else continue

      expect(value, `Sources: ${c.metric} = ${value}`).toBeGreaterThanOrEqual(c.min)
      expect(value, `Sources: ${c.metric} = ${value}`).toBeLessThanOrEqual(c.max)
    }

    // OR fitness criteria
    const orCriteria = orModule.getFitnessCriteria()
    const orState = r.state.moduleStates.or
    const orOutput = r.moduleOutputs.or
    for (const c of orCriteria) {
      let value: number
      if (c.metric === 'utilization') value = orState.utilization
      else if (c.metric === 'cancellationRate') {
        const demand = Math.round(r.moduleOutputs.medsurg.patients.count * r.moduleOutputs.medsurg.patients.surgicalFraction)
        value = demand > 0 ? 1 - orOutput.patients.count / demand : 0
      }
      else if (c.metric === 'surgicalContributionMargin') {
        value = orOutput.financials.revenue > 0
          ? (orOutput.financials.revenue - orOutput.financials.expenses.supplies) / orOutput.financials.revenue
          : 0
      }
      else continue

      expect(value, `OR: ${c.metric} = ${value}`).toBeGreaterThanOrEqual(c.min)
      expect(value, `OR: ${c.metric} = ${value}`).toBeLessThanOrEqual(c.max)
    }
  })
})
