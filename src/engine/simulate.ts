import type {
  HospitalState,
  OperationsConsoleState,
  ExternalEvent,
  QuarterResult,
  OperationalEffects,
  FinancialEffects,
  PendingEffect,
} from './types'
import { computeOperational } from './operational'
import { computeFinancial } from './financial'
import { buildNarrative } from './narrative'

/**
 * Simulate one quarter. Pure function: takes current state + console state + event,
 * returns the new state wrapped in a QuarterResult.
 */
export function simulateQuarter(
  state: HospitalState,
  consoleState: OperationsConsoleState,
  event: ExternalEvent
): QuarterResult {
  // Step 1: Apply pending effects from previous quarters
  let currentState = applyPendingEffects(state)

  // Step 2: Apply console state (update programs and headcount)
  const { updatedState, additionalEffects: consoleEffects } = applyConsoleState(currentState, consoleState)

  currentState = updatedState

  // Step 3: Collect all operational and financial effects
  const { opEffects, finEffects, newPending } = collectEffects(currentState, event)

  // Merge console-produced effects with event/pending effects
  for (const fx of consoleEffects.op) opEffects.push(fx)
  for (const fx of consoleEffects.fin) finEffects.push(fx)

  // Step 4: Recompute operational metrics
  const newOperational = computeOperational(currentState, opEffects)

  // Step 5: Build intermediate state for financial computation
  const intermediateState: HospitalState = {
    ...currentState,
    operational: newOperational,
  }

  // Step 6: Recompute financial metrics
  const newFinancial = computeFinancial(intermediateState, finEffects)

  // Step 7: Check game over
  const gameOver = newFinancial.cashReserves <= 0

  // Step 8: Build new state
  const newState: HospitalState = {
    ...currentState,
    quarter: currentState.quarter + 1,
    operational: newOperational,
    financial: newFinancial,
    pendingEffects: [
      ...currentState.pendingEffects.filter(pe => pe.applyInQuarter > currentState.quarter),
      ...newPending,
    ],
    activeEvents: [
      ...currentState.activeEvents
        .map(ae => ({ ...ae, remainingQuarters: ae.remainingQuarters - 1 }))
        .filter(ae => ae.remainingQuarters > 0),
      ...(event.duration > 1 ? [{ event, remainingQuarters: event.duration - 1 }] : []),
    ],
    gameOver,
  }

  // Step 9: Build narrative by comparing previous and new state
  const narrativeResult = buildNarrative(currentState, newState, event.title)

  const result: QuarterResult = {
    quarter: currentState.quarter,
    state: newState,
    programs: { ...currentState.programs },
    event,
    ...narrativeResult,
  }

  // Append to history
  newState.history = [...currentState.history, result]

  return result
}

/** Build a default console state from the current programs (no changes from last quarter) */
export function defaultConsoleState(state: HospitalState): OperationsConsoleState {
  const p = state.programs
  return {
    nurseRatio: p.nurseRatio,
    compensationChange: p.compensationChange,
    headcountDelta: 0,
    hospitalist: p.hospitalist?.active
      ? { active: true, workforce: p.hospitalist.workforce, cdiIntensity: p.hospitalist.cdiIntensity, documentationTraining: p.hospitalist.documentationTraining }
      : { active: false },
    dischargeCoordination: p.dischargeCoordination?.active
      ? { active: true, model: p.dischargeCoordination.model, postAcutePartnerships: p.dischargeCoordination.postAcutePartnerships }
      : { active: false },
    supplyTier: p.supplyTier,
    surgicalExpansion: p.surgicalExpansion?.active ? p.surgicalExpansion.investmentLevel : 'none',
    bedChange: 'none',
  }
}

/** Apply any pending effects that are due this quarter */
function applyPendingEffects(state: HospitalState): HospitalState {
  const due = state.pendingEffects.filter(pe => pe.applyInQuarter === state.quarter)
  if (due.length === 0) return state

  // Pending effects are collected in collectEffects and applied during recomputation
  return state
}

/** Apply console state: map lever values to ProgramState and produce additional effects */
function applyConsoleState(
  state: HospitalState,
  console: OperationsConsoleState
): {
  updatedState: HospitalState
  additionalEffects: { op: OperationalEffects[]; fin: FinancialEffects[] }
} {
  const programs = { ...state.programs }
  const opEffects: OperationalEffects[] = []
  const finEffects: FinancialEffects[] = []

  // Staffing: direct assignment
  programs.nurseRatio = console.nurseRatio
  programs.compensationChange = console.compensationChange

  // Supply tier: direct assignment
  programs.supplyTier = console.supplyTier

  // Hospitalist program
  if (console.hospitalist.active) {
    const h = console.hospitalist
    // Derive effectiveness from workforce model
    let effectiveness = h.workforce === 'employed' ? 1.0 : 0.7
    if (h.workforce === 'contracted' && h.cdiIntensity === 'aggressive') {
      effectiveness *= 0.8
    }
    // If previously active, carry forward degraded effectiveness
    if (state.programs.hospitalist?.active && state.programs.hospitalist.effectiveness < effectiveness) {
      effectiveness = state.programs.hospitalist.effectiveness
    }

    programs.hospitalist = {
      active: true,
      workforce: h.workforce,
      cdiIntensity: h.cdiIntensity,
      documentationTraining: h.documentationTraining,
      effectiveness,
    }
  } else {
    programs.hospitalist = undefined
  }

  // Discharge coordination
  if (console.dischargeCoordination.active) {
    const d = console.dischargeCoordination
    programs.dischargeCoordination = {
      active: true,
      model: d.model,
      postAcutePartnerships: d.postAcutePartnerships,
    }
  } else {
    programs.dischargeCoordination = undefined
  }

  // Surgical expansion
  if (console.surgicalExpansion !== 'none') {
    const wasAlreadyActive = state.programs.surgicalExpansion?.active
    programs.surgicalExpansion = {
      active: true,
      investmentLevel: console.surgicalExpansion,
    }
    // Capital cost only in the quarter it's first established
    if (!wasAlreadyActive) {
      finEffects.push({
        capitalExpenditure: console.surgicalExpansion === 'major' ? 4_000_000 : 1_000_000,
        depreciationModifier: console.surgicalExpansion === 'major' ? 400_000 : 100_000,
      })
    }
  } else {
    programs.surgicalExpansion = undefined
  }

  // Headcount delta: apply to financial state
  const prevHeadcount = state.financial.expenses.labor.headcount
  const newHeadcount = Math.max(800, Math.min(2000, prevHeadcount + console.headcountDelta))
  const updatedFinancial = {
    ...state.financial,
    expenses: {
      ...state.financial.expenses,
      labor: {
        ...state.financial.expenses.labor,
        headcount: newHeadcount,
      },
    },
  }

  // Bed change
  if (console.bedChange === 'add') {
    opEffects.push({ bedModifier: 20 })
    finEffects.push({ capitalExpenditure: 500_000 }) // cost of adding beds
  } else if (console.bedChange === 'close') {
    opEffects.push({ bedModifier: -20 })
  }

  return {
    updatedState: { ...state, programs, financial: updatedFinancial },
    additionalEffects: { op: opEffects, fin: finEffects },
  }
}

/** Collect all operational and financial effects from events and active events */
function collectEffects(
  state: HospitalState,
  currentEvent: ExternalEvent
): {
  opEffects: OperationalEffects[]
  finEffects: FinancialEffects[]
  newPending: PendingEffect[]
} {
  const opEffects: OperationalEffects[] = []
  const finEffects: FinancialEffects[] = []
  const newPending: PendingEffect[] = []

  // Current quarter's event
  if (currentEvent.operationalEffects) opEffects.push(currentEvent.operationalEffects)
  if (currentEvent.financialEffects) finEffects.push(currentEvent.financialEffects)

  // Active multi-quarter events from previous quarters
  for (const ae of state.activeEvents) {
    if (ae.event.operationalEffects) opEffects.push(ae.event.operationalEffects)
    if (ae.event.financialEffects) finEffects.push(ae.event.financialEffects)
  }

  // Pending effects due this quarter
  for (const pe of state.pendingEffects.filter(p => p.applyInQuarter === state.quarter)) {
    if (pe.operationalEffects) opEffects.push(pe.operationalEffects)
    if (pe.financialEffects) finEffects.push(pe.financialEffects)
  }

  // Create pending effects for quality/program changes (1-quarter delay)
  // Quality impact of this quarter's decisions will apply next quarter
  if (state.programs.hospitalist?.active) {
    const h = state.programs.hospitalist
    // Contracted + aggressive CDI degrades effectiveness over time
    if (h.workforce === 'contracted' && h.cdiIntensity === 'aggressive' && h.effectiveness > 0.4) {
      newPending.push({
        applyInQuarter: state.quarter + 1,
        operationalEffects: { qualityModifier: -3 },
        source: 'Contracted hospitalists disengaging due to aggressive CDI queries',
      })
    }
  }

  // Note: surgical expansion capital costs are now handled in applyConsoleState

  return { opEffects, finEffects, newPending }
}
