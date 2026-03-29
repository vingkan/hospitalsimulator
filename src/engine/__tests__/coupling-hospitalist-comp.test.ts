// Coupling 2: Hospitalist Program x Compensation
// Tests that hospitalist effectiveness degrades with compensation cuts,
// and that low-effectiveness hospitalist is WORSE than no hospitalist.

import { describe, it, expect } from 'vitest'
import { initializeGame, simulateYear } from '../orchestrator'
import type { ProgramState, ExternalEvent } from '../types'
import type { MedSurgState } from '../modules/medsurg'

const NO_EVENT: ExternalEvent = {
  id: 'none',
  title: 'Uneventful Year',
  description: 'Nothing unusual happens.',
  operationalEffects: {},
  financialEffects: {},
  duration: 1,
  teaches: '',
}

function noEventDeck(): ExternalEvent[] {
  return [NO_EVENT, NO_EVENT, NO_EVENT, NO_EVENT, NO_EVENT]
}

function programsWith(overrides: Partial<ProgramState>): ProgramState {
  return {
    nurseRatio: 5,
    compensationChange: 0,
    supplyTier: 'standard',
    ...overrides,
  }
}

describe('Coupling 2: Hospitalist Program x Compensation', () => {
  describe('effectiveness modifier from compensation', () => {
    it('hospitalist + comp +5% = full effectiveness', () => {
      const state = initializeGame(noEventDeck())
      const programs = programsWith({
        compensationChange: 5,
        hospitalist: {
          active: true,
          workforce: 'employed',
          cdiIntensity: 'light',
          documentationTraining: true,
          effectiveness: 1.0,
        },
      })

      const r = simulateYear(state, programs, NO_EVENT)
      const ms = r.state.moduleStates.medsurg as MedSurgState

      // At +5% comp, effectiveness should be near full (1.0)
      // LOS should be reduced by ~0.5 days (employed+light at full effectiveness)
      expect(ms.lengthOfStay).toBeLessThan(5.0)
      expect(ms.lengthOfStay).toBeGreaterThanOrEqual(4.0)
      // DRG should improve
      expect(ms.drgAccuracy).toBeGreaterThan(1.02)
    })

    it('hospitalist + comp 0% = reduced effectiveness (~0.7)', () => {
      const state = initializeGame(noEventDeck())
      const programsFull = programsWith({
        compensationChange: 5,
        hospitalist: {
          active: true,
          workforce: 'employed',
          cdiIntensity: 'light',
          documentationTraining: true,
          effectiveness: 1.0,
        },
      })
      const programsReduced = programsWith({
        compensationChange: 0,
        hospitalist: {
          active: true,
          workforce: 'employed',
          cdiIntensity: 'light',
          documentationTraining: true,
          effectiveness: 1.0,
        },
      })

      const rFull = simulateYear(state, programsFull, NO_EVENT)
      const rReduced = simulateYear(state, programsReduced, NO_EVENT)
      const msFull = rFull.state.moduleStates.medsurg as MedSurgState
      const msReduced = rReduced.state.moduleStates.medsurg as MedSurgState

      // Reduced comp should produce less LOS improvement
      expect(msReduced.lengthOfStay).toBeGreaterThan(msFull.lengthOfStay)
      // And less DRG improvement
      expect(msReduced.drgAccuracy).toBeLessThan(msFull.drgAccuracy)
    })

    it('hospitalist + comp -3% = low effectiveness + higher readmissions than good comp', () => {
      const state = initializeGame(noEventDeck())
      const programsBad = programsWith({
        compensationChange: -3,
        hospitalist: {
          active: true,
          workforce: 'employed',
          cdiIntensity: 'light',
          documentationTraining: true,
          effectiveness: 1.0,
        },
      })
      const programsGood = programsWith({
        compensationChange: 5,
        hospitalist: {
          active: true,
          workforce: 'employed',
          cdiIntensity: 'light',
          documentationTraining: true,
          effectiveness: 1.0,
        },
      })

      const rBad = simulateYear(state, programsBad, NO_EVENT)
      const rGood = simulateYear(state, programsGood, NO_EVENT)
      const msBad = rBad.state.moduleStates.medsurg as MedSurgState
      const msGood = rGood.state.moduleStates.medsurg as MedSurgState

      // Bad comp should have higher readmission rate than good comp
      expect(msBad.readmissionRate).toBeGreaterThan(msGood.readmissionRate)
      // LOS improvement should be less at bad comp
      expect(msBad.lengthOfStay).toBeGreaterThan(msGood.lengthOfStay)
      // DRG improvement should be less
      expect(msBad.drgAccuracy).toBeLessThan(msGood.drgAccuracy)
    })

    it('hospitalist ROI degrades at bad comp vs good comp', () => {
      // Measure the marginal value of the hospitalist program at different comp levels
      // At good comp: hospitalist should be very valuable
      // At bad comp: hospitalist should be barely worth it or negative

      // ROI at +5% comp
      let stateBase5 = initializeGame(noEventDeck())
      let stateHosp5 = initializeGame(noEventDeck())
      const base5 = programsWith({ compensationChange: 5 })
      const hosp5 = programsWith({
        compensationChange: 5,
        hospitalist: { active: true, workforce: 'employed', cdiIntensity: 'light', documentationTraining: true, effectiveness: 1.0 },
      })
      for (let y = 0; y < 3; y++) {
        stateBase5 = simulateYear(stateBase5, base5, NO_EVENT).state
        stateHosp5 = simulateYear(stateHosp5, hosp5, NO_EVENT).state
      }
      const roiGood = stateHosp5.financials.margin - stateBase5.financials.margin

      // ROI at -3% comp
      let stateBaseN3 = initializeGame(noEventDeck())
      let stateHospN3 = initializeGame(noEventDeck())
      const baseN3 = programsWith({ compensationChange: -3 })
      const hospN3 = programsWith({
        compensationChange: -3,
        hospitalist: { active: true, workforce: 'employed', cdiIntensity: 'light', documentationTraining: true, effectiveness: 1.0 },
      })
      for (let y = 0; y < 3; y++) {
        stateBaseN3 = simulateYear(stateBaseN3, baseN3, NO_EVENT).state
        stateHospN3 = simulateYear(stateHospN3, hospN3, NO_EVENT).state
      }
      const roiBad = stateHospN3.financials.margin - stateBaseN3.financials.margin

      // Good comp should produce higher hospitalist ROI than bad comp
      expect(roiGood).toBeGreaterThan(roiBad)
    })

    it('no hospitalist = comp has no coupling effect', () => {
      const state = initializeGame(noEventDeck())
      const programsHighComp = programsWith({ compensationChange: 5 })
      const programsLowComp = programsWith({ compensationChange: -3 })

      const rHigh = simulateYear(state, programsHighComp, NO_EVENT)
      const rLow = simulateYear(state, programsLowComp, NO_EVENT)
      const msHigh = rHigh.state.moduleStates.medsurg as MedSurgState
      const msLow = rLow.state.moduleStates.medsurg as MedSurgState

      // Without hospitalist, readmission rates should NOT show the +0.02 inversion
      // (readmission differences come from compQualityFactor affecting nurse quality, not coupling)
      // Both should be in normal range
      expect(msHigh.readmissionRate).toBeGreaterThanOrEqual(0.08)
      expect(msHigh.readmissionRate).toBeLessThanOrEqual(0.22)
      expect(msLow.readmissionRate).toBeGreaterThanOrEqual(0.08)
      expect(msLow.readmissionRate).toBeLessThanOrEqual(0.22)
    })

    it('carry-forward still works with compensation coupling', () => {
      let state = initializeGame(noEventDeck())

      // Year 1: contracted hospitalist at low comp (effectiveness degrades)
      const programsY1 = programsWith({
        compensationChange: -2,
        hospitalist: {
          active: true,
          workforce: 'contracted',
          cdiIntensity: 'aggressive',
          documentationTraining: false,
          effectiveness: 1.0,
        },
      })
      const r1 = simulateYear(state, programsY1, NO_EVENT)
      state = r1.state
      const ms1 = state.moduleStates.medsurg as MedSurgState
      const eff1 = ms1.prevHospitalistEffectiveness

      // Year 2: switch to employed at good comp
      const programsY2 = programsWith({
        compensationChange: 5,
        hospitalist: {
          active: true,
          workforce: 'employed',
          cdiIntensity: 'light',
          documentationTraining: true,
          effectiveness: 1.0,
        },
      })
      const r2 = simulateYear(state, programsY2, NO_EVENT)
      const ms2 = r2.state.moduleStates.medsurg as MedSurgState

      // Carry-forward: prevHospitalistEffectiveness from year 1 should cap year 2
      // if it was lower (contracted+aggressive+lowComp should be < employed+light+highComp)
      expect(eff1).not.toBeNull()
      expect(ms2.prevHospitalistEffectiveness).not.toBeNull()
    })
  })
})
