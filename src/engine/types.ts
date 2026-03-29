// Domain bounds and diminishing returns configuration
export interface DomainConfig {
  min: number
  max: number
  diminishing: boolean // whether stacked effects use diminishing returns
}

// Effects that decision packages and events can produce
export interface OperationalEffects {
  losModifier?: number           // days (negative = shorter stay)
  qualityModifier?: number       // points on 20-100 scale
  drgAccuracyModifier?: number   // decimal (e.g., +0.05 = 5% better capture)
  readmissionModifier?: number   // percentage points
  volumeModifier?: number        // fractional (e.g., +0.05 = 5% more patients)
  surgicalCapacityModifier?: number // cases per quarter
  bedModifier?: number           // number of beds added/removed
}

export interface FinancialEffects {
  laborCostModifier?: number     // dollars per quarter
  supplyCostModifier?: number    // fractional change (e.g., +0.30 = 30% more)
  overheadModifier?: number      // dollars per quarter
  capitalExpenditure?: number    // one-time dollars (deducted from cash)
  depreciationModifier?: number  // dollars per quarter added to depreciation
  programSubsidy?: number        // dollars per quarter (ongoing program cost)
  medicareRateModifier?: number  // fractional change to medicare rate
  commercialRateModifier?: number
  commercialVolumeModifier?: number // fractional change to commercial volume
}

export interface HospitalState {
  quarter: number // 1-4

  // Operational layer
  operational: {
    beds: {
      total: number
      occupancyRate: number      // 0-1
      availableBedDays: number
    }
    lengthOfStay: number         // average days per admission
    dischargeRate: number        // discharges per quarter
    bedTurnover: number          // discharges per bed per quarter
    surgical: {
      orCapacity: number         // max surgical cases per quarter
      casesCompleted: number
      casesCancelled: number
    }
    readmissionRate: number      // 0-1 (e.g., 0.15 = 15%)
    drgAccuracy: number          // multiplier 0.85-1.15
    qualityScore: number         // 20-100
  }

  // Financial layer
  financial: {
    cashReserves: number
    revenue: {
      medical: number
      surgical: number
      total: number
    }
    expenses: {
      labor: {
        amount: number
        headcount: number
        avgCompPerQuarter: number
        overtimeCost: number
      }
      supplies: {
        amount: number
        costPerCase: number
      }
      overhead: {
        amount: number
      }
      capital: {
        amount: number
        depreciationBase: number
      }
      programSubsidies: number
      total: number
    }
    margin: number               // (revenue - expenses) / revenue
    payers: {
      medicare: PayerInfo
      commercial: PayerInfo
      medicaid: PayerInfo
      selfPay: PayerInfo
    }
  }

  // Active programs and their implementation state
  programs: ProgramState

  // Engine state
  pendingEffects: PendingEffect[]
  activeEvents: ActiveEvent[]
  eventDeck: ExternalEvent[]     // shuffled at game start, draw 1 per quarter
  history: QuarterResult[]
  gameOver: boolean
}

export interface PayerInfo {
  share: number                  // fraction of total cases (e.g., 0.45)
  baseRate: number               // dollars per case before modifiers
  effectiveRate: number          // after DRG accuracy multiplier etc.
  cases: number                  // cases this quarter
}

export interface ProgramState {
  hospitalist?: HospitalistProgram
  dischargeCoordination?: DischargeProgram
  surgicalExpansion?: SurgicalExpansionProgram
  nurseRatio: number             // patients per nurse (4-8), always exists
  compensationChange: number     // percentage change this quarter
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

export interface PendingEffect {
  applyInQuarter: number
  operationalEffects?: OperationalEffects
  financialEffects?: FinancialEffects
  source: string                 // for narrative: "hospitalist program quality impact"
}

export interface ActiveEvent {
  event: ExternalEvent
  remainingQuarters: number
}

export interface ExternalEvent {
  id: string
  title: string
  description: string
  operationalEffects: OperationalEffects
  financialEffects: FinancialEffects
  duration: number               // quarters this event persists (1 or 2)
  teaches: string                // one-line lesson for facilitator
}

// Decision packages
export interface DecisionPackage {
  id: string
  name: string
  description: string
  available: (state: HospitalState) => boolean
  strategicChoice: {
    question: string
    options: StrategicOption[]
  }
  implementationChoices: ImplementationChoice[]
  facilitatorNote: string
}

export interface StrategicOption {
  id: string
  label: string
  description: string
}

export interface ImplementationChoice {
  id: string
  question: string
  dependsOnStrategic?: string    // only show if this strategic option was chosen
  options: ImplementationOption[]
}

export interface ImplementationOption {
  id: string
  label: string
  description: string            // trade-off explanation
}

// What the player chose for a single package
export interface SelectedDecision {
  packageId: string
  strategicOptionId: string
  implementationOptionIds: string[]
}

// Result of simulating one quarter
export interface QuarterResult {
  quarter: number
  state: HospitalState
  decisions: SelectedDecision[]
  event: ExternalEvent
  narrative: string[]
  operationalHighlights: string[]
  financialHighlights: string[]
}

// Game phase for the UI state machine
export type GamePhase =
  | 'setup'
  | 'decision'
  | 'computing'
  | 'results'
  | 'endgame'
  | 'gameover'
