// Coupling 1: Surgical Expansion x Nurse Ratio
// Tests that surgical expansion combined with understaffing creates
// OR cancellations and bed pressure amplification.

import { describe, it, expect } from 'vitest'
import { initializeGame, simulateYear, computeCouplingSignals, recalcBedPressure } from '../orchestrator'
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

describe('Coupling 1: Surgical Expansion x Nurse Ratio', () => {
  describe('computeCouplingSignals', () => {
    it('nurseRatioStress = 0 when no expansion', () => {
      const signals = computeCouplingSignals(programsWith({ nurseRatio: 8 }))
      expect(signals.nurseRatioStress).toBe(0)
    })

    it('nurseRatioStress = 0 at ratio 4-5 even with expansion', () => {
      const signals4 = computeCouplingSignals(programsWith({
        nurseRatio: 4,
        surgicalExpansion: { active: true, investmentLevel: 'major' },
      }))
      expect(signals4.nurseRatioStress).toBe(0)

      const signals5 = computeCouplingSignals(programsWith({
        nurseRatio: 5,
        surgicalExpansion: { active: true, investmentLevel: 'major' },
      }))
      expect(signals5.nurseRatioStress).toBe(0)
    })

    it('nurseRatioStress ramps from 0 at ratio 5 to 1.0 at ratio 8', () => {
      const signals6 = computeCouplingSignals(programsWith({
        nurseRatio: 6,
        surgicalExpansion: { active: true, investmentLevel: 'major' },
      }))
      expect(signals6.nurseRatioStress).toBeCloseTo(1 / 3, 2)

      const signals7 = computeCouplingSignals(programsWith({
        nurseRatio: 7,
        surgicalExpansion: { active: true, investmentLevel: 'major' },
      }))
      expect(signals7.nurseRatioStress).toBeCloseTo(2 / 3, 2)

      const signals8 = computeCouplingSignals(programsWith({
        nurseRatio: 8,
        surgicalExpansion: { active: true, investmentLevel: 'major' },
      }))
      expect(signals8.nurseRatioStress).toBeCloseTo(1.0, 2)
    })
  })

  describe('OR cancellations from coupling', () => {
    it('major expansion + 4:1 ratio = no additional cancellations', () => {
      const state = initializeGame(noEventDeck())
      const goodStaff = programsWith({
        nurseRatio: 4,
        compensationChange: 5,
        surgicalExpansion: { active: true, investmentLevel: 'major' },
      })
      const noExpansion = programsWith({
        nurseRatio: 4,
        compensationChange: 5,
      })

      const rExpand = simulateYear(state, goodStaff, NO_EVENT)
      const rNoExpand = simulateYear(state, noExpansion, NO_EVENT)

      // With good staffing, expansion should complete MORE cases, not fewer
      expect(rExpand.moduleOutputs.or.patients.count)
        .toBeGreaterThanOrEqual(rNoExpand.moduleOutputs.or.patients.count)
    })

    it('major expansion + 7:1 ratio = severe cancellations', () => {
      const state = initializeGame(noEventDeck())
      const badStaff = programsWith({
        nurseRatio: 7,
        surgicalExpansion: { active: true, investmentLevel: 'major' },
      })
      const goodStaff = programsWith({
        nurseRatio: 4,
        compensationChange: 5,
        surgicalExpansion: { active: true, investmentLevel: 'major' },
      })

      const rBad = simulateYear(state, badStaff, NO_EVENT)
      const rGood = simulateYear(state, goodStaff, NO_EVENT)

      // Bad staffing should result in significantly fewer completed cases
      const cancellationDelta = rGood.moduleOutputs.or.patients.count - rBad.moduleOutputs.or.patients.count
      expect(cancellationDelta).toBeGreaterThan(0)
      // At least 10% fewer completed cases
      const cancellationPct = cancellationDelta / rGood.moduleOutputs.or.patients.count
      expect(cancellationPct).toBeGreaterThanOrEqual(0.10)
    })

    it('no expansion = no coupling effect regardless of nurse ratio', () => {
      const ratio4 = programsWith({ nurseRatio: 4, compensationChange: 5 })
      const ratio8 = programsWith({ nurseRatio: 8 })

      // Without expansion, nurseRatioStress should be 0 regardless of ratio
      const signals4 = computeCouplingSignals(ratio4)
      const signals8 = computeCouplingSignals(ratio8)
      expect(signals4.nurseRatioStress).toBe(0)
      expect(signals8.nurseRatioStress).toBe(0)
    })

    it('minor expansion + 6:1 = same stress signal as major (expansion multiplier applied in OR)', () => {
      const minor = programsWith({
        nurseRatio: 6,
        surgicalExpansion: { active: true, investmentLevel: 'minor' },
      })
      const major = programsWith({
        nurseRatio: 6,
        surgicalExpansion: { active: true, investmentLevel: 'major' },
      })

      // Both have same nurseRatioStress (ratio-based), expansion multiplier applied in OR module
      const signalsMinor = computeCouplingSignals(minor)
      const signalsMajor = computeCouplingSignals(major)
      expect(signalsMinor.nurseRatioStress).toBe(signalsMajor.nurseRatioStress)
    })
  })

  describe('bed pressure amplification', () => {
    it('nurseRatioStress amplifies recovery patient impact on bed pressure', () => {
      // Use recalcBedPressure directly to test the amplification
      const mockMedsurgOutput = {
        patients: { count: 9000, avgAcuity: 1.5, surgicalFraction: 0.15, avgLOS: 5.0 },
        financials: { revenue: 0, expenses: { labor: 0, supplies: 0, overhead: 0, capital: 0, programs: 0 } },
        signals: { bedPressure: 0, qualityScore: 56, readmissionRate: 0.166 },
      }
      const mockMedsurgState: MedSurgState = {
        beds: 200,
        occupancyRate: 0.7,
        lengthOfStay: 5.0,
        qualityScore: 56,
        drgAccuracy: 1.0,
        readmissionRate: 0.166,
        headcount: 1100,
        avgCompPerYear: 76000,
        prevHospitalistEffectiveness: null,
      }

      const orRecovery = 500
      const pressureNoStress = recalcBedPressure(mockMedsurgOutput, orRecovery, mockMedsurgState, 0)
      const pressureWithStress = recalcBedPressure(mockMedsurgOutput, orRecovery, mockMedsurgState, 0.67)

      // Stress should amplify bed pressure
      expect(pressureWithStress).toBeGreaterThanOrEqual(pressureNoStress)
    })
  })
})
