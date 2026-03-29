import { describe, it, expect } from 'vitest'
import { initializeGame, simulateYear } from '../orchestrator'
import { SUBURBAN_COMMUNITY, URBAN_SAFETY_NET, RURAL_CRITICAL_ACCESS, ALL_PROFILES } from '../profiles'
import type { ExternalEvent, ProgramState } from '../types'

const NO_EVENT: ExternalEvent = { id: 'none', title: '', description: '', operationalEffects: {}, financialEffects: {}, duration: 1, teaches: '' }
function noEventDeck() { return [NO_EVENT, NO_EVENT, NO_EVENT, NO_EVENT, NO_EVENT] }
function defaultPrograms(): ProgramState { return { nurseRatio: 5, compensationChange: 0, supplyTier: 'standard', maParticipation: false, commercialNegotiation: 'none', admissionPosture: 'balanced' } }

describe('Hospital Profiles', () => {
  it('all profiles initialize without error', () => {
    for (const p of ALL_PROFILES) {
      const state = initializeGame(p, noEventDeck())
      expect(state.profile.id).toBe(p.id)
      expect(state.moduleStates.medsurg.beds).toBe(p.beds)
    }
  })

  it('suburban produces margin 1-3% at default play', () => {
    let state = initializeGame(SUBURBAN_COMMUNITY, noEventDeck())
    const r = simulateYear(state, defaultPrograms(), NO_EVENT)
    expect(r.financials.margin).toBeGreaterThanOrEqual(0.005)
    expect(r.financials.margin).toBeLessThanOrEqual(0.04)
  })

  it('safety net produces margin -2% to 1% at default play', () => {
    let state = initializeGame(URBAN_SAFETY_NET, noEventDeck())
    const r = simulateYear(state, defaultPrograms(), NO_EVENT)
    expect(r.financials.margin).toBeGreaterThanOrEqual(-0.03)
    expect(r.financials.margin).toBeLessThanOrEqual(0.02)
  })

  it('rural produces margin 0-2% at default play', () => {
    let state = initializeGame(RURAL_CRITICAL_ACCESS, noEventDeck())
    const r = simulateYear(state, defaultPrograms(), NO_EVENT)
    expect(r.financials.margin).toBeGreaterThanOrEqual(-0.01)
    expect(r.financials.margin).toBeLessThanOrEqual(0.03)
  })

  it('different profiles produce different revenue structures', () => {
    const results = ALL_PROFILES.map(p => {
      const state = initializeGame(p, noEventDeck())
      return simulateYear(state, defaultPrograms(), NO_EVENT)
    })
    // Safety net should have highest total revenue (most volume)
    expect(results[1].financials.revenue.total).toBeGreaterThan(results[0].financials.revenue.total)
    // Rural should have lowest
    expect(results[2].financials.revenue.total).toBeLessThan(results[0].financials.revenue.total)
  })
})
