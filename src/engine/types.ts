// Shared types for the hospital simulator engine and UI.

// ── Program types (used by orchestrator + UI) ──────────────────────

export interface ProgramState {
  hospitalist?: HospitalistProgram
  dischargeCoordination?: DischargeProgram
  surgicalExpansion?: SurgicalExpansionProgram
  nurseRatio: number             // patients per nurse (4-8), always exists
  compensationChange: number     // percentage change this year
  supplyTier: 'budget' | 'standard' | 'premium'
}

export interface HospitalistProgram {
  active: boolean
  workforce: 'employed' | 'contracted'
  cdiIntensity: 'light' | 'aggressive'
  documentationTraining: boolean
  effectiveness: number          // 0-1, can degrade over time
}

export interface DischargeProgram {
  active: boolean
  model: 'dedicated_planners' | 'nurse_led'
  postAcutePartnerships: boolean
}

export interface SurgicalExpansionProgram {
  active: boolean
  investmentLevel: 'minor' | 'major'
}

// ── Event types ────────────────────────────────────────────────────

export interface OperationalEffects {
  losModifier?: number
  qualityModifier?: number
  drgAccuracyModifier?: number
  readmissionModifier?: number
  volumeModifier?: number
  surgicalCapacityModifier?: number
  bedModifier?: number
}

export interface FinancialEffects {
  laborCostModifier?: number
  supplyCostModifier?: number
  overheadModifier?: number
  capitalExpenditure?: number
  depreciationModifier?: number
  programSubsidy?: number
  medicareRateModifier?: number
  commercialRateModifier?: number
  commercialVolumeModifier?: number
}

export interface ExternalEvent {
  id: string
  title: string
  description: string
  operationalEffects: OperationalEffects
  financialEffects: FinancialEffects
  duration: number               // years this event persists
  teaches: string                // one-line lesson for facilitator
}

// ── UI types ───────────────────────────────────────────────────────

// Operations console state: what the facilitator sets each year via direct levers.
// This type lives in React (not in engine state). On submit, it maps to ProgramState.
export type HospitalistConsoleState =
  | { active: false }
  | { active: true; workforce: 'employed' | 'contracted'; cdiIntensity: 'light' | 'aggressive'; documentationTraining: boolean }

export type DischargeConsoleState =
  | { active: false }
  | { active: true; model: 'dedicated_planners' | 'nurse_led'; postAcutePartnerships: boolean }

export interface OperationsConsoleState {
  nurseRatio: number
  compensationChange: number
  hospitalist: HospitalistConsoleState
  dischargeCoordination: DischargeConsoleState
  supplyTier: 'budget' | 'standard' | 'premium'
  surgicalExpansion: 'none' | 'minor' | 'major'
}

// Game phase for the UI state machine
export type GamePhase =
  | 'setup'
  | 'decision'
  | 'computing'
  | 'results'
  | 'endgame'
  | 'gameover'
