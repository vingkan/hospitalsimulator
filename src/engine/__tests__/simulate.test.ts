import { describe, it, expect } from 'vitest'
import { simulateQuarter, defaultConsoleState } from '../simulate'
import { createInitialState } from '../constants'
import { ALL_EVENTS } from '../events'
import type { OperationsConsoleState } from '../types'

describe('simulateQuarter', () => {
  const initialState = createInitialState(ALL_EVENTS)
  const noChanges = defaultConsoleState(initialState)

  it('produces a valid QuarterResult', () => {
    const event = ALL_EVENTS[0]
    const result = simulateQuarter(initialState, noChanges, event)

    expect(result.quarter).toBe(1)
    expect(result.state.quarter).toBe(2)
    expect(result.event).toBe(event)
    expect(result.narrative).toBeDefined()
    expect(Array.isArray(result.operationalHighlights)).toBe(true)
    expect(Array.isArray(result.financialHighlights)).toBe(true)
  })

  it('appends result to history', () => {
    const result = simulateQuarter(initialState, noChanges, ALL_EVENTS[0])
    expect(result.state.history).toHaveLength(1)
    expect(result.state.history[0].quarter).toBe(1)
  })

  it('stores programs snapshot in QuarterResult', () => {
    const result = simulateQuarter(initialState, noChanges, ALL_EVENTS[0])
    expect(result.programs).toBeDefined()
    expect(result.programs.nurseRatio).toBe(5)
  })

  it('hospitalist program reduces LOS', () => {
    const withHospitalist: OperationsConsoleState = {
      ...noChanges,
      hospitalist: { active: true, workforce: 'employed', cdiIntensity: 'light', documentationTraining: true },
    }

    const result = simulateQuarter(initialState, withHospitalist, ALL_EVENTS[7])
    expect(result.state.operational.lengthOfStay).toBeLessThan(initialState.operational.lengthOfStay)
    expect(result.state.programs.hospitalist?.active).toBe(true)
  })

  it('hospitalist program adds subsidy cost', () => {
    const withHospitalist: OperationsConsoleState = {
      ...noChanges,
      hospitalist: { active: true, workforce: 'employed', cdiIntensity: 'light', documentationTraining: true },
    }

    const result = simulateQuarter(initialState, withHospitalist, ALL_EVENTS[7])
    expect(result.state.financial.expenses.programSubsidies).toBeGreaterThan(0)
  })

  it('nursing ratio change affects quality and overtime', () => {
    const worseStaffing: OperationsConsoleState = {
      ...noChanges,
      nurseRatio: 8,
      compensationChange: 0,
    }

    const result = simulateQuarter(initialState, worseStaffing, ALL_EVENTS[7])
    expect(result.state.operational.qualityScore).toBeLessThan(initialState.operational.qualityScore)
  })

  it('game over triggers when cash runs out', () => {
    const veryBrokeState = {
      ...initialState,
      financial: {
        ...initialState.financial,
        cashReserves: -5_000_000,
      },
    }

    const result = simulateQuarter(veryBrokeState, noChanges, ALL_EVENTS[0])
    expect(result.state.gameOver).toBe(true)
  })

  it('full 4-quarter game produces 4 history entries', () => {
    let state = initialState

    for (let q = 0; q < 4; q++) {
      const console = defaultConsoleState(state)
      const result = simulateQuarter(state, console, ALL_EVENTS[q])
      state = result.state
    }

    expect(state.history).toHaveLength(4)
    expect(state.quarter).toBe(5)
  })

  it('events with duration > 1 persist in activeEvents', () => {
    const commercialExit = ALL_EVENTS.find(e => e.id === 'commercial-payer-exit')!
    const result = simulateQuarter(initialState, noChanges, commercialExit)

    expect(result.state.activeEvents).toHaveLength(1)
    expect(result.state.activeEvents[0].remainingQuarters).toBe(1)
  })

  it('LOS never goes below minimum bound', () => {
    const maxPrograms: OperationsConsoleState = {
      ...noChanges,
      hospitalist: { active: true, workforce: 'employed', cdiIntensity: 'light', documentationTraining: true },
      dischargeCoordination: { active: true, model: 'dedicated_planners', postAcutePartnerships: true },
    }

    const result = simulateQuarter(initialState, maxPrograms, ALL_EVENTS[7])
    expect(result.state.operational.lengthOfStay).toBeGreaterThanOrEqual(3.5)
  })

  // --- New v2 tests ---

  it('headcount delta increases headcount within bounds', () => {
    const hireMore: OperationsConsoleState = {
      ...noChanges,
      headcountDelta: 50,
    }
    const result = simulateQuarter(initialState, hireMore, ALL_EVENTS[7])
    expect(result.state.financial.expenses.labor.headcount).toBe(1150) // 1100 + 50
  })

  it('headcount delta clamps to minimum 800', () => {
    const fireMany: OperationsConsoleState = {
      ...noChanges,
      headcountDelta: -500,
    }
    const result = simulateQuarter(initialState, fireMany, ALL_EVENTS[7])
    expect(result.state.financial.expenses.labor.headcount).toBe(800)
  })

  it('bed add increases total beds', () => {
    const addBeds: OperationsConsoleState = {
      ...noChanges,
      bedChange: 'add',
    }
    const result = simulateQuarter(initialState, addBeds, ALL_EVENTS[7])
    expect(result.state.operational.beds.total).toBe(220) // 200 + 20
  })

  it('bed close decreases total beds', () => {
    const closeBeds: OperationsConsoleState = {
      ...noChanges,
      bedChange: 'close',
    }
    const result = simulateQuarter(initialState, closeBeds, ALL_EVENTS[7])
    expect(result.state.operational.beds.total).toBe(180) // 200 - 20
  })

  it('effectiveness derived from workforce model', () => {
    const employed: OperationsConsoleState = {
      ...noChanges,
      hospitalist: { active: true, workforce: 'employed', cdiIntensity: 'light', documentationTraining: false },
    }
    const contracted: OperationsConsoleState = {
      ...noChanges,
      hospitalist: { active: true, workforce: 'contracted', cdiIntensity: 'light', documentationTraining: false },
    }

    const employedResult = simulateQuarter(initialState, employed, ALL_EVENTS[7])
    const contractedResult = simulateQuarter(initialState, contracted, ALL_EVENTS[7])

    expect(employedResult.state.programs.hospitalist?.effectiveness).toBe(1.0)
    expect(contractedResult.state.programs.hospitalist?.effectiveness).toBe(0.7)
  })

  it('default console state produces stable simulation', () => {
    const result = simulateQuarter(initialState, noChanges, ALL_EVENTS[7])
    // With no changes and a mild event, margin should stay roughly similar
    expect(result.state.financial.margin).toBeGreaterThan(-0.05)
    expect(result.state.financial.margin).toBeLessThan(0.10)
  })
})
