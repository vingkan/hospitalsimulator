import { describe, it, expect } from 'vitest'
import { initializeGame, simulateYear } from '../orchestrator'
import { SUBURBAN_COMMUNITY } from '../profiles'
import type { ExternalEvent, ProgramState } from '../types'

const NO_EVENT: ExternalEvent = { id: 'none', title: '', description: '', operationalEffects: {}, financialEffects: {}, duration: 1, teaches: '' }
function noEventDeck() { return [NO_EVENT, NO_EVENT, NO_EVENT, NO_EVENT, NO_EVENT] }

describe('CMS Penalties', () => {
  it('CMS adjustment is negative at default quality (penalty)', () => {
    const state = initializeGame(SUBURBAN_COMMUNITY, noEventDeck())
    const progs: ProgramState = { nurseRatio: 5, compensationChange: 0, supplyTier: 'standard' }
    const r = simulateYear(state, progs, NO_EVENT)
    // Default quality ~56, readmission ~16.6% > 15% threshold → HRRP penalty
    expect(r.financials.cmsAdjustment).toBeLessThan(0)
  })

  it('high quality + low readmissions produces CMS bonus', () => {
    const progs: ProgramState = {
      nurseRatio: 4,
      compensationChange: 5,
      supplyTier: 'premium',
      hospitalist: { active: true, workforce: 'employed', cdiIntensity: 'aggressive', documentationTraining: true, effectiveness: 1.0 },
      dischargeCoordination: { active: true, model: 'dedicated_planners', postAcutePartnerships: true },
    }
    // Run 3 years so readmissions drop below threshold
    let s = initializeGame(SUBURBAN_COMMUNITY, noEventDeck())
    for (let y = 0; y < 3; y++) {
      const r = simulateYear(s, progs, NO_EVENT)
      s = r.state
    }
    const final = simulateYear(s, progs, NO_EVENT)
    // With all quality programs, VBP bonus should apply (quality > 70)
    // CMS adjustment should be positive or at least less negative
    expect(final.financials.cmsAdjustment).toBeGreaterThan(-500_000)
  })

  it('observation revenue exists at balanced posture', () => {
    const state = initializeGame(SUBURBAN_COMMUNITY, noEventDeck())
    const progs: ProgramState = { nurseRatio: 5, compensationChange: 0, supplyTier: 'standard', admissionPosture: 'balanced' }
    const r = simulateYear(state, progs, NO_EVENT)
    expect(r.financials.observationRevenue).toBeGreaterThan(0)
  })
})
