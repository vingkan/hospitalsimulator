import { describe, it, expect } from 'vitest'
import { initializeGame, simulateYear } from '../orchestrator'
import { SUBURBAN_COMMUNITY } from '../profiles'
import type { ExternalEvent, ProgramState } from '../types'

const NO_EVENT: ExternalEvent = { id: 'none', title: '', description: '', operationalEffects: {}, financialEffects: {}, duration: 1, teaches: '' }
function noEventDeck() { return [NO_EVENT, NO_EVENT, NO_EVENT, NO_EVENT, NO_EVENT] }

describe('Payer Strategy', () => {
  it('MA participation increases volume', () => {
    const state = initializeGame(SUBURBAN_COMMUNITY, noEventDeck())
    const noMA: ProgramState = { nurseRatio: 5, compensationChange: 0, supplyTier: 'standard', maParticipation: false }
    const withMA: ProgramState = { ...noMA, maParticipation: true }
    const rNo = simulateYear(state, noMA, NO_EVENT)
    const rYes = simulateYear(state, withMA, NO_EVENT)
    expect(rYes.moduleOutputs.medsurg.patients.count).toBeGreaterThan(rNo.moduleOutputs.medsurg.patients.count)
  })

  it('aggressive negotiation without quality threshold wastes money', () => {
    const state = initializeGame(SUBURBAN_COMMUNITY, noEventDeck())
    const noNeg: ProgramState = { nurseRatio: 5, compensationChange: 0, supplyTier: 'standard', commercialNegotiation: 'none' }
    const aggNeg: ProgramState = { ...noNeg, commercialNegotiation: 'aggressive' }
    const rNo = simulateYear(state, noNeg, NO_EVENT)
    const rAgg = simulateYear(state, aggNeg, NO_EVENT)
    // Default quality ~56, below 75 threshold → aggressive negotiation fails
    // Revenue should be similar but expenses higher ($2.5M wasted)
    expect(rAgg.financials.expenses.overhead).toBeGreaterThan(rNo.financials.expenses.overhead)
    expect(rAgg.financials.margin).toBeLessThan(rNo.financials.margin)
  })

  it('conservative admission posture produces higher observation revenue', () => {
    const state = initializeGame(SUBURBAN_COMMUNITY, noEventDeck())
    const balanced: ProgramState = { nurseRatio: 5, compensationChange: 0, supplyTier: 'standard', admissionPosture: 'balanced' }
    const conservative: ProgramState = { ...balanced, admissionPosture: 'conservative' }
    const rBal = simulateYear(state, balanced, NO_EVENT)
    const rCon = simulateYear(state, conservative, NO_EVENT)
    // Conservative has more obs patients → higher observation revenue
    expect(rCon.financials.observationRevenue).toBeGreaterThan(rBal.financials.observationRevenue)
    // But lower total revenue (obs pays less than IP)
    expect(rCon.financials.revenue.total).toBeLessThan(rBal.financials.revenue.total)
  })
})
