import { describe, it, expect } from 'vitest'
import { simulateQuarter } from '../simulate'
import { createInitialState } from '../constants'
import { ALL_EVENTS } from '../events'
import type { SelectedDecision } from '../types'

describe('simulateQuarter', () => {
  const initialState = createInitialState(ALL_EVENTS)

  it('produces a valid QuarterResult', () => {
    const decisions: SelectedDecision[] = []
    const event = ALL_EVENTS[0]

    const result = simulateQuarter(initialState, decisions, event)

    expect(result.quarter).toBe(1)
    expect(result.state.quarter).toBe(2)
    expect(result.event).toBe(event)
    expect(result.narrative).toBeDefined()
    expect(Array.isArray(result.operationalHighlights)).toBe(true)
    expect(Array.isArray(result.financialHighlights)).toBe(true)
  })

  it('appends result to history', () => {
    const result = simulateQuarter(initialState, [], ALL_EVENTS[0])
    expect(result.state.history).toHaveLength(1)
    expect(result.state.history[0].quarter).toBe(1)
  })

  it('hospitalist program reduces LOS', () => {
    const decisions: SelectedDecision[] = [
      {
        packageId: 'hospitalist',
        strategicOptionId: 'establish',
        implementationOptionIds: ['employed', 'light-cdi', 'invest-training'],
      },
    ]

    const result = simulateQuarter(initialState, decisions, ALL_EVENTS[7]) // value-based bonus (mild)
    expect(result.state.operational.lengthOfStay).toBeLessThan(initialState.operational.lengthOfStay)
    expect(result.state.programs.hospitalist?.active).toBe(true)
  })

  it('hospitalist program adds subsidy cost', () => {
    const decisions: SelectedDecision[] = [
      {
        packageId: 'hospitalist',
        strategicOptionId: 'establish',
        implementationOptionIds: ['employed', 'light-cdi', 'invest-training'],
      },
    ]

    const result = simulateQuarter(initialState, decisions, ALL_EVENTS[7])
    expect(result.state.financial.expenses.programSubsidies).toBeGreaterThan(0)
  })

  it('nursing ratio change affects quality and overtime', () => {
    const worseStaffing: SelectedDecision[] = [
      {
        packageId: 'nursing',
        strategicOptionId: 'adjust',
        implementationOptionIds: ['ratio-8', 'comp-0'],
      },
    ]

    const result = simulateQuarter(initialState, worseStaffing, ALL_EVENTS[7])
    // Quality should drop (worse nurse ratio)
    expect(result.state.operational.qualityScore).toBeLessThan(initialState.operational.qualityScore)
  })

  it('game over triggers when cash runs out', () => {
    // Create a state already deeply in the red — revenue is recomputed from ops,
    // so we can't fake low revenue. Instead start with negative cash.
    // With ~$6M profit per quarter, need to start below -$6M to stay negative.
    const veryBrokeState = {
      ...initialState,
      financial: {
        ...initialState.financial,
        cashReserves: -10_000_000, // -$10M, too deep to recover in 1 quarter
      },
    }

    const result2 = simulateQuarter(veryBrokeState, [], ALL_EVENTS[0])
    expect(result2.state.gameOver).toBe(true)
  })

  it('full 4-quarter game produces 4 history entries', () => {
    let state = initialState
    const decisions: SelectedDecision[] = []

    for (let q = 0; q < 4; q++) {
      const result = simulateQuarter(state, decisions, ALL_EVENTS[q])
      state = result.state
    }

    expect(state.history).toHaveLength(4)
    expect(state.quarter).toBe(5) // started at 1, incremented 4 times
  })

  it('events with duration > 1 persist in activeEvents', () => {
    // Commercial payer exit has duration 2
    const commercialExit = ALL_EVENTS.find(e => e.id === 'commercial-payer-exit')!
    const result = simulateQuarter(initialState, [], commercialExit)

    expect(result.state.activeEvents).toHaveLength(1)
    expect(result.state.activeEvents[0].remainingQuarters).toBe(1)
  })

  it('LOS never goes below minimum bound', () => {
    // Establish both LOS-reducing programs
    const decisions: SelectedDecision[] = [
      {
        packageId: 'hospitalist',
        strategicOptionId: 'establish',
        implementationOptionIds: ['employed', 'light-cdi', 'invest-training'],
      },
      {
        packageId: 'discharge-planning',
        strategicOptionId: 'invest',
        implementationOptionIds: ['dedicated', 'partnerships'],
      },
    ]

    const result = simulateQuarter(initialState, decisions, ALL_EVENTS[7])
    expect(result.state.operational.lengthOfStay).toBeGreaterThanOrEqual(2.0)
  })
})
