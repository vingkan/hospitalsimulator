// Orchestrator: runs all modules in layer order once per year.
// Two-pass bed pressure: Sources runs without pressure, Med/Surg computes pressure,
// Sources re-runs with pressure, Med/Surg re-runs with adjusted volume.

import type {
  ModuleInputs,
  ModuleOutputs,
  ModuleControls,
  ModuleSignals,
  PatientCohort,
  EventEffect,
} from './modules/types'
import type { MedSurgState } from './modules/medsurg'
import type { ORState } from './modules/or'
import type { SourcesState } from './modules/sources'
import { medSurgModule } from './modules/medsurg'
import { orModule } from './modules/or'
import { sourcesModule } from './modules/sources'
import { aggregateFinance, type HospitalFinancials } from './modules/finance'
import type { ExternalEvent, ProgramState } from './types'
import { eventToModuleEffects } from './events'

// ── Game State ──────────────────────────────────────────────────────

export interface GameState {
  year: number                   // 1-5
  moduleStates: {
    sources: SourcesState
    medsurg: MedSurgState
    or: ORState
  }
  financials: HospitalFinancials
  prevReadmissions: number       // readmissions fed from previous year
  programs: ProgramState         // flat program state at orchestrator level
  eventDeck: ExternalEvent[]
  history: YearResult[]
  gameOver: boolean
}

export interface YearResult {
  year: number
  state: GameState
  programs: ProgramState
  event: ExternalEvent
  moduleOutputs: {
    sources: ModuleOutputs
    medsurg: ModuleOutputs
    or: ModuleOutputs
  }
  financials: HospitalFinancials
}

// ── Empty signals/patients ──────────────────────────────────────────

const EMPTY_SIGNALS: ModuleSignals = { bedPressure: 0, qualityScore: 0, readmissionRate: 0 }
const EMPTY_PATIENTS: PatientCohort = { count: 0, avgAcuity: 0, surgicalFraction: 0, avgLOS: 0 }

// ── ProgramState → ModuleControls mapping ───────────────────────────

export function mapMedSurgControls(programs: ProgramState): ModuleControls {
  return {
    nurseRatio: programs.nurseRatio,
    compensationChange: programs.compensationChange,
    headcountDelta: 0, // delta applied per-year, reset each tick
    supplyTier: programs.supplyTier,
    hospitalistActive: programs.hospitalist?.active ?? false,
    hospitalistWorkforce: programs.hospitalist?.workforce ?? 'employed',
    hospitalistCDI: programs.hospitalist?.cdiIntensity ?? 'light',
    hospitalistDocTraining: programs.hospitalist?.documentationTraining ?? false,
    dischargeActive: programs.dischargeCoordination?.active ?? false,
    dischargeModel: programs.dischargeCoordination?.model ?? 'dedicated_planners',
    dischargePartnerships: programs.dischargeCoordination?.postAcutePartnerships ?? false,
  }
}

export function mapORControls(programs: ProgramState): ModuleControls {
  return {
    surgicalExpansion: programs.surgicalExpansion?.active
      ? programs.surgicalExpansion.investmentLevel
      : 'none',
  }
}

// ── Coupling signals ────────────────────────────────────────────────

export function computeCouplingSignals(programs: ProgramState): { nurseRatioStress: number } {
  const hasExpansion = programs.surgicalExpansion?.active ?? false
  if (!hasExpansion) return { nurseRatioStress: 0 }
  // Ramps from 0 at ratio 5 to 1.0 at ratio 8
  const ratio = programs.nurseRatio
  const stress = ratio <= 5 ? 0 : Math.min(1.0, (ratio - 5) / 3)
  return { nurseRatioStress: stress }
}

// ── Bed pressure recalculation ──────────────────────────────────────

/** Pure function: recalculate bed pressure accounting for OR recovery patients */
export function recalcBedPressure(
  medsurgOutput: ModuleOutputs,
  orRecoveryCount: number,
  medsurgState: MedSurgState,
  nurseRatioStress: number = 0,
): number {
  // OR recovery patients consume Med/Surg beds. Nurse ratio stress increases effective recovery burden.
  const effectiveRecoveryCount = orRecoveryCount * (1 + nurseRatioStress * 0.5)
  const totalPatients = medsurgOutput.patients.count + effectiveRecoveryCount
  const adjustedOccupancy = Math.min(1.0,
    (totalPatients * medsurgOutput.patients.avgLOS) / (medsurgState.beds * 365)
  )
  // Threshold formula: no diversion below 80%, ramps to 1.0 at 95%
  return Math.min(1.0, Math.max(0, (adjustedOccupancy - 0.80) / 0.15))
}

// ── Core simulation ─────────────────────────────────────────────────

export function simulateYear(
  state: GameState,
  programs: ProgramState,
  event: ExternalEvent,
): YearResult {
  const events = eventToModuleEffects(event)

  const medsurgControls = mapMedSurgControls(programs)
  const orControls = mapORControls(programs)
  const sourcesControls: ModuleControls = {} // no player controls
  const couplingSignals = computeCouplingSignals(programs)

  // ── Pass 1: Sources without bed pressure ────────────────────────
  const sourcesInput1: ModuleInputs = {
    patients: EMPTY_PATIENTS,
    signals: EMPTY_SIGNALS,
    events,
    readmissions: state.prevReadmissions,
  }
  const sourcesResult1 = sourcesModule.tick(state.moduleStates.sources, sourcesInput1, sourcesControls)

  // ── Pass 1: Med/Surg with Sources output ────────────────────────
  const medsurgInput1: ModuleInputs = {
    patients: sourcesResult1.outputs.patients,
    signals: EMPTY_SIGNALS,
    events,
    readmissions: 0,
  }
  const medsurgResult1 = medSurgModule.tick(state.moduleStates.medsurg, medsurgInput1, medsurgControls)

  // ── Pass 2: Sources with bed pressure from Med/Surg ─────────────
  const sourcesInput2: ModuleInputs = {
    patients: EMPTY_PATIENTS,
    signals: {
      bedPressure: medsurgResult1.outputs.signals.bedPressure,
      qualityScore: medsurgResult1.outputs.signals.qualityScore,
      readmissionRate: 0,
    },
    events,
    readmissions: state.prevReadmissions,
  }
  const sourcesResult2 = sourcesModule.tick(state.moduleStates.sources, sourcesInput2, sourcesControls)

  // ── Pass 2: Med/Surg with adjusted Sources output ───────────────
  const medsurgInput2: ModuleInputs = {
    patients: sourcesResult2.outputs.patients,
    signals: {
      bedPressure: medsurgResult1.outputs.signals.bedPressure,
      qualityScore: 0,
      readmissionRate: 0,
    },
    events,
    readmissions: 0,
  }
  const medsurgResult2 = medSurgModule.tick(state.moduleStates.medsurg, medsurgInput2, medsurgControls)

  // ── Procedures: OR with surgical patients ───────────────────────
  const surgicalPatientCount = Math.round(
    medsurgResult2.outputs.patients.count * medsurgResult2.outputs.patients.surgicalFraction
  )
  const orInput: ModuleInputs = {
    patients: {
      count: surgicalPatientCount,
      avgAcuity: 2.0,
      surgicalFraction: 1.0,
      avgLOS: 3.0,
    },
    signals: {
      ...medsurgResult2.outputs.signals,
      nurseRatioStress: couplingSignals.nurseRatioStress,
    },
    events,
    readmissions: 0,
  }
  const orResult = orModule.tick(state.moduleStates.or, orInput, orControls)

  // ── Post-hoc bed pressure with OR recovery ──────────────────────
  const finalBedPressure = recalcBedPressure(
    medsurgResult2.outputs,
    orResult.outputs.patients.count,
    medsurgResult2.nextState as MedSurgState,
    couplingSignals.nurseRatioStress,
  )

  // Update Med/Surg signals with final bed pressure
  const finalMedsurgOutputs: ModuleOutputs = {
    ...medsurgResult2.outputs,
    signals: {
      ...medsurgResult2.outputs.signals,
      bedPressure: finalBedPressure,
    },
  }

  // ── Finance aggregation ─────────────────────────────────────────
  const financials = aggregateFinance(
    [finalMedsurgOutputs.financials, orResult.outputs.financials],
    finalMedsurgOutputs.signals,
    events,
    state.financials.cashReserves,
    (medsurgResult2.nextState as MedSurgState).drgAccuracy,
    medsurgResult2.outputs.patients.count,
  )

  // ── Readmissions for next year ──────────────────────────────────
  const readmissions = Math.round(
    medsurgResult2.outputs.patients.count * finalMedsurgOutputs.signals.readmissionRate
  )

  // ── Game over check ─────────────────────────────────────────────
  const gameOver = financials.cashReserves <= 0

  // ── Build new game state ────────────────────────────────────────
  const newState: GameState = {
    year: state.year + 1,
    moduleStates: {
      sources: sourcesResult2.nextState as SourcesState,
      medsurg: medsurgResult2.nextState as MedSurgState,
      or: orResult.nextState as ORState,
    },
    financials,
    prevReadmissions: readmissions,
    programs,
    eventDeck: state.eventDeck,
    history: state.history, // updated below
    gameOver,
  }

  const result: YearResult = {
    year: state.year,
    state: newState,
    programs: { ...programs },
    event,
    moduleOutputs: {
      sources: sourcesResult2.outputs,
      medsurg: finalMedsurgOutputs,
      or: orResult.outputs,
    },
    financials,
  }

  newState.history = [...state.history, result]

  return result
}

// ── Game initialization ─────────────────────────────────────────────

const STARTING_CASH = 72_000_000 // $18M/quarter × 4

export function initializeGame(eventDeck: ExternalEvent[]): GameState {
  const sourcesState = sourcesModule.init({
    id: 'sources',
    calibrationConstants: {},
  }) as SourcesState

  const medsurgState = medSurgModule.init({
    id: 'medsurg',
    calibrationConstants: {},
  }) as MedSurgState

  const orState = orModule.init({
    id: 'or',
    calibrationConstants: {},
  }) as ORState

  const defaultPrograms: ProgramState = {
    nurseRatio: 5,
    compensationChange: 0,
    supplyTier: 'standard',
  }

  // Compute initial financials by running a dry tick
  const dryEvents: EventEffect[] = []
  const drySourcesInput: ModuleInputs = {
    patients: EMPTY_PATIENTS,
    signals: EMPTY_SIGNALS,
    events: dryEvents,
    readmissions: 0,
  }
  const drySourcesResult = sourcesModule.tick(sourcesState, drySourcesInput, {})

  const dryMedsurgInput: ModuleInputs = {
    patients: drySourcesResult.outputs.patients,
    signals: EMPTY_SIGNALS,
    events: dryEvents,
    readmissions: 0,
  }
  const dryMedsurgResult = medSurgModule.tick(medsurgState, dryMedsurgInput, mapMedSurgControls(defaultPrograms))

  const surgicalCount = Math.round(
    dryMedsurgResult.outputs.patients.count * dryMedsurgResult.outputs.patients.surgicalFraction
  )
  const dryOrInput: ModuleInputs = {
    patients: { count: surgicalCount, avgAcuity: 2.0, surgicalFraction: 1.0, avgLOS: 3.0 },
    signals: dryMedsurgResult.outputs.signals,
    events: dryEvents,
    readmissions: 0,
  }
  const dryOrResult = orModule.tick(orState, dryOrInput, mapORControls(defaultPrograms))

  const initialFinancials = aggregateFinance(
    [dryMedsurgResult.outputs.financials, dryOrResult.outputs.financials],
    dryMedsurgResult.outputs.signals,
    dryEvents,
    STARTING_CASH,
    (dryMedsurgResult.nextState as MedSurgState).drgAccuracy,
    dryMedsurgResult.outputs.patients.count,
  )

  // Seed readmissions at steady-state via full simulation iteration.
  // Run simulateYear in a loop until readmissions stabilize, so Year 1 starts
  // at true equilibrium (no artificial volume ramp).
  let seedState: GameState = {
    year: 1,
    moduleStates: { sources: sourcesState, medsurg: medsurgState, or: orState },
    financials: initialFinancials,
    prevReadmissions: 0,
    programs: defaultPrograms,
    eventDeck,
    history: [],
    gameOver: false,
  }
  const seedEvent: ExternalEvent = { id: 'none', title: '', description: '', operationalEffects: {}, financialEffects: {}, duration: 1, teaches: '' }
  for (let i = 0; i < 10; i++) {
    const r = simulateYear(seedState, defaultPrograms, seedEvent)
    const nextReadmissions = Math.round(
      r.moduleOutputs.medsurg.patients.count *
      (r.state.moduleStates.medsurg as MedSurgState).readmissionRate
    )
    if (Math.abs(nextReadmissions - seedState.prevReadmissions) < 2) break
    // Reset state but carry forward readmissions
    seedState = { ...seedState, prevReadmissions: nextReadmissions }
  }
  const steadyStateReadmissions = seedState.prevReadmissions

  return {
    year: 1,
    moduleStates: {
      sources: sourcesState,
      medsurg: medsurgState,
      or: orState,
    },
    financials: initialFinancials,
    prevReadmissions: steadyStateReadmissions,
    programs: defaultPrograms,
    eventDeck,
    history: [],
    gameOver: false,
  }
}
