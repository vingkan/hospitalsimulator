import type {
  HospitalState,
  SelectedDecision,
  ExternalEvent,
  QuarterResult,
  OperationalEffects,
  FinancialEffects,
  PendingEffect,
} from './types'
import { computeOperational } from './operational'
import { computeFinancial } from './financial'
import { buildNarrative } from './narrative'
import { allPackages } from '../decisions'

/**
 * Simulate one quarter. Pure function: takes current state + decisions + event,
 * returns the new state wrapped in a QuarterResult.
 */
export function simulateQuarter(
  state: HospitalState,
  decisions: SelectedDecision[],
  event: ExternalEvent
): QuarterResult {
  // Step 1: Apply pending effects from previous quarters
  let currentState = applyPendingEffects(state)

  // Step 2: Apply decision effects (update programs state)
  currentState = applyDecisions(currentState, decisions)

  // Step 3: Collect all operational and financial effects
  const { opEffects, finEffects, newPending } = collectEffects(currentState, event)

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
    decisions,
    event,
    ...narrativeResult,
  }

  // Append to history
  newState.history = [...currentState.history, result]

  return result
}

/** Apply any pending effects that are due this quarter */
function applyPendingEffects(state: HospitalState): HospitalState {
  const due = state.pendingEffects.filter(pe => pe.applyInQuarter === state.quarter)
  if (due.length === 0) return state

  // Pending effects are collected in collectEffects and applied during recomputation
  return state
}

/** Apply player decisions: update programs state based on selected options */
function applyDecisions(state: HospitalState, decisions: SelectedDecision[]): HospitalState {
  let programs = { ...state.programs }

  for (const decision of decisions) {
    const pkg = allPackages.find(p => p.id === decision.packageId)
    if (!pkg) continue

    switch (pkg.id) {
      case 'hospitalist': {
        if (decision.strategicOptionId === 'establish') {
          const workforce = decision.implementationOptionIds.includes('employed')
            ? 'employed' as const : 'contracted' as const
          const cdi = decision.implementationOptionIds.includes('aggressive-cdi')
            ? 'aggressive' as const : 'light' as const
          const training = decision.implementationOptionIds.includes('invest-training')

          // Effectiveness starts at 1.0 for employed, 0.7 for contracted
          let effectiveness = workforce === 'employed' ? 1.0 : 0.7
          // Aggressive CDI with contracted workforce degrades effectiveness
          if (workforce === 'contracted' && cdi === 'aggressive') {
            effectiveness *= 0.8
          }

          programs.hospitalist = {
            active: true,
            workforce,
            cdiIntensity: cdi,
            documentationTraining: training,
            effectiveness,
          }
        }
        break
      }

      case 'nursing': {
        if (decision.strategicOptionId === 'adjust') {
          const ratioOption = decision.implementationOptionIds.find(id => id.startsWith('ratio-'))
          if (ratioOption) {
            programs.nurseRatio = parseInt(ratioOption.replace('ratio-', ''), 10)
          }
          const compOption = decision.implementationOptionIds.find(id => id.startsWith('comp-'))
          if (compOption) {
            programs.compensationChange = parseInt(compOption.replace('comp-', ''), 10)
          }
        }
        break
      }

      case 'discharge-planning': {
        if (decision.strategicOptionId === 'invest') {
          const model = decision.implementationOptionIds.includes('dedicated')
            ? 'dedicated_planners' as const : 'nurse_led' as const
          const partnerships = decision.implementationOptionIds.includes('partnerships')

          programs.dischargeCoordination = {
            active: true,
            model,
            postAcutePartnerships: partnerships,
          }
        }
        break
      }

      case 'surgical-expansion': {
        if (decision.strategicOptionId === 'expand') {
          const level = decision.implementationOptionIds.includes('major')
            ? 'major' as const : 'minor' as const

          programs.surgicalExpansion = {
            active: true,
            investmentLevel: level,
          }
        }
        break
      }
    }
  }

  return { ...state, programs }
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

  // Capital expenditure for surgical expansion
  if (state.programs.surgicalExpansion?.active) {
    const level = state.programs.surgicalExpansion.investmentLevel
    // Only apply capital cost in the quarter it was established
    const wasJustEstablished = !state.history.some(
      h => h.state.programs.surgicalExpansion?.active
    )
    if (wasJustEstablished) {
      finEffects.push({
        capitalExpenditure: level === 'major' ? 4_000_000 : 1_000_000,
        depreciationModifier: level === 'major' ? 400_000 : 100_000,
      })
    }
  }

  return { opEffects, finEffects, newPending }
}
