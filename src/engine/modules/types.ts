// Module system types for the hospital simulator engine.
// Each hospital department is a self-contained module with defined I/O contracts.

export interface ModuleState {
  [key: string]: unknown
}

export interface ModuleInputs {
  patients: PatientCohort
  signals: ModuleSignals
  events: EventEffect[]
  readmissions: number
}

export interface ModuleOutputs {
  patients: PatientCohort
  financials: ModuleFinancials
  signals: ModuleSignals
}

export interface PatientCohort {
  count: number
  avgAcuity: number            // 1.0 = routine, 2.0 = complex, 3.0 = critical
  surgicalFraction: number     // fraction needing procedures
  avgLOS: number               // expected length of stay in days
}

export interface ModuleFinancials {
  revenue: number
  expenses: {
    labor: number
    supplies: number
    overhead: number
    capital: number
    programs: number
  }
}

export interface ModuleSignals {
  bedPressure: number          // 0.0 = plenty of room, 1.0 = completely full
  qualityScore: number         // 0-100
  readmissionRate: number      // fraction readmitted
  nurseRatioStress?: number    // 0-1, coupling signal from nurse ratio × surgical expansion
}

export interface EventEffect {
  moduleId: string             // which module this targets ('*' for all)
  volumeModifier?: number      // fractional change to patient volume
  costModifier?: number        // fractional change to expenses
  rateModifier?: number        // fractional change to reimbursement rate
  qualityModifier?: number     // points change to quality score
  laborCostDelta?: number      // dollar amount added to labor costs
  supplyCostModifier?: number  // fractional change to supply costs
}

export interface ModuleConfig {
  id: string
  calibrationConstants: Record<string, number>
  initialState?: Partial<ModuleState>
}

// Player-adjustable settings keyed by ControlDefinition.key
export interface ModuleControls {
  [key: string]: number | boolean | string
}

export interface ControlDefinition {
  key: string
  label: string
  type: 'slider' | 'toggle' | 'segment'
  min?: number
  max?: number
  step?: number
  options?: { value: string; label: string }[]
  default: number | boolean | string
}

export interface FitnessCriterion {
  metric: string
  min: number
  max: number
  source: string               // evidence citation
  severity: 'warning' | 'fail'
}

export interface HospitalModule {
  id: string
  layer: 1 | 2 | 3 | 4 | 5

  init(config: ModuleConfig): ModuleState

  tick(
    state: ModuleState,
    inputs: ModuleInputs,
    controls: ModuleControls,
  ): { nextState: ModuleState; outputs: ModuleOutputs }

  getControls(): ControlDefinition[]

  getFitnessCriteria(): FitnessCriterion[]
}
