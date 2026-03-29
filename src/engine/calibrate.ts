/**
 * Headless calibration runner for hospital simulator.
 * Run: npx tsx src/engine/calibrate.ts
 * Verifies 6 deterministic scenarios produce realistic outcomes.
 */
import { createInitialState } from './constants'
import { simulateQuarter, defaultConsoleState } from './simulate'
import { ALL_EVENTS } from './events'
import type { HospitalState, OperationsConsoleState } from './types'

interface ScenarioResult {
  name: string
  finalMargin: number
  finalCash: number
  losRange: [number, number]
  pass: boolean
  reason: string
}

function runScenario(
  name: string,
  consoleOverrides: Array<Partial<OperationsConsoleState>>,
  events: typeof ALL_EVENTS,
  check: (states: HospitalState[]) => { pass: boolean; reason: string }
): ScenarioResult {
  const initialState = createInitialState(events)
  const states: HospitalState[] = [initialState]
  let state = initialState

  const quarters = consoleOverrides.length || 4
  for (let q = 0; q < quarters; q++) {
    const event = events[q % events.length]
    const base = defaultConsoleState(state)
    const consoleState: OperationsConsoleState = { ...base, ...consoleOverrides[q] }
    const result = simulateQuarter(state, consoleState, event)
    state = result.state
    states.push(state)
  }

  const finalState = states[states.length - 1]
  const losValues = states.slice(1).map(s => s.operational.lengthOfStay)
  const { pass, reason } = check(states)

  return {
    name,
    finalMargin: finalState.financial.margin,
    finalCash: finalState.financial.cashReserves,
    losRange: [Math.min(...losValues), Math.max(...losValues)],
    pass,
    reason,
  }
}

export function runCalibration(): ScenarioResult[] {
  const events = ALL_EVENTS

  // Scenario 1: Baseline
  const baseline = runScenario(
    'Baseline',
    [{}, {}, {}, {}],
    [events[7], events[7], events[7], events[7]],
    (states) => {
      const margin = states[1].financial.margin
      const pass = margin > 0.02 && margin < 0.06
      return { pass, reason: pass ? 'OK' : `Margin ${(margin*100).toFixed(1)}% not in 2-6%` }
    }
  )

  // Scenario 2: Do nothing, 4 quarters with varied events
  const doNothing = runScenario(
    'Do nothing (4Q)',
    [{}, {}, {}, {}],
    events.slice(0, 4),
    (states) => {
      const finalMargin = states[4].financial.margin
      const pass = finalMargin > -0.10 && finalMargin < 0.08
      return { pass, reason: pass ? 'OK' : `Margin ${(finalMargin*100).toFixed(1)}% not in -10% to 8%` }
    }
  )

  // Scenario 3: Good decisions
  const goodDecisions = runScenario(
    'Good decisions',
    [
      {
        hospitalist: { active: true, workforce: 'employed', cdiIntensity: 'light', documentationTraining: true },
        dischargeCoordination: { active: true, model: 'dedicated_planners', postAcutePartnerships: true },
      },
      {}, {}, {},
    ],
    [events[7], events[7], events[7], events[7]],
    (states) => {
      const finalMargin = states[4].financial.margin
      const pass = finalMargin > 0.02 && finalMargin < 0.12
      return { pass, reason: pass ? 'OK' : `Margin ${(finalMargin*100).toFixed(1)}% not in 2-12%` }
    }
  )

  // Scenario 4: Bad decisions
  const badDecisions = runScenario(
    'Bad decisions',
    [{ nurseRatio: 8, compensationChange: 0 }, {}, {}, {}],
    [events[0], events[2], events[4], events[5]],
    (states) => {
      const anyBankrupt = states.some(s => s.financial.cashReserves <= 0 || s.gameOver)
      const finalMargin = states[4].financial.margin
      const pass = anyBankrupt || finalMargin < -0.05
      return { pass, reason: pass ? 'OK' : `Hospital survived with margin ${(finalMargin*100).toFixed(1)}%` }
    }
  )

  // Scenario 5: Max programs
  const maxPrograms = runScenario(
    'Max programs',
    [
      {
        hospitalist: { active: true, workforce: 'employed', cdiIntensity: 'light', documentationTraining: true },
        dischargeCoordination: { active: true, model: 'dedicated_planners', postAcutePartnerships: true },
        nurseRatio: 4,
        compensationChange: 5,
      },
      { surgicalExpansion: 'major' },
      {}, {},
    ],
    [events[7], events[7], events[7], events[7]],
    (states) => {
      const losValues = states.slice(1).map(s => s.operational.lengthOfStay)
      const minLOS = Math.min(...losValues)
      const finalMargin = states[4].financial.margin
      const pass = minLOS >= 3.5 && finalMargin > 0.01
      return {
        pass,
        reason: pass ? 'OK' : `LOS min=${minLOS.toFixed(1)} (need >=3.5), margin=${(finalMargin*100).toFixed(1)}%`,
      }
    }
  )

  // Scenario 6: Stress test
  const stressTest = runScenario(
    'Stress test',
    [{}, {}, {}, {}],
    [events[0], events[2], events[4], events[3]],
    (states) => {
      const q1Cash = states[1].financial.cashReserves
      const pass = q1Cash > 0
      return { pass, reason: pass ? 'OK' : `Cash $${(q1Cash/1e6).toFixed(1)}M after Q1 (need >0)` }
    }
  )

  return [baseline, doNothing, goodDecisions, badDecisions, maxPrograms, stressTest]
}

// CLI entry point (run via: npx tsx src/engine/calibrate.ts)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _process = typeof globalThis !== 'undefined' ? (globalThis as any).process : undefined
if (_process?.argv?.[1]?.includes('calibrate')) {
  const results = runCalibration()
  console.log('\n=== CALIBRATION RESULTS ===\n')
  console.log(
    'Scenario'.padEnd(20),
    'Margin'.padEnd(10),
    'Cash'.padEnd(12),
    'LOS Range'.padEnd(14),
    'Result'
  )
  console.log('-'.repeat(70))

  let allPass = true
  for (const r of results) {
    if (!r.pass) allPass = false
    console.log(
      r.name.padEnd(20),
      `${(r.finalMargin * 100).toFixed(1)}%`.padEnd(10),
      `$${(r.finalCash / 1e6).toFixed(1)}M`.padEnd(12),
      `${r.losRange[0].toFixed(1)}-${r.losRange[1].toFixed(1)}d`.padEnd(14),
      r.pass ? 'PASS' : `FAIL: ${r.reason}`
    )
  }

  console.log('\n' + (allPass ? 'ALL SCENARIOS PASSED' : 'SOME SCENARIOS FAILED'))
  _process.exit(allPass ? 0 : 1)
}
