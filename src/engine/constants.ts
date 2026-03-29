import type { DomainConfig, HospitalState, ProgramState } from './types'

// Domain bounds for effect composition
export const DOMAIN_BOUNDS: Record<string, DomainConfig> = {
  lengthOfStay:    { min: 2.0, max: 8.0, diminishing: true },
  qualityScore:    { min: 20,  max: 100, diminishing: true },
  drgAccuracy:     { min: 0.85, max: 1.15, diminishing: true },
  readmissionRate: { min: 0.05, max: 0.30, diminishing: true },
  occupancyRate:   { min: 0,   max: 1.0, diminishing: false },
  nurseRatio:      { min: 4,   max: 8,   diminishing: false },
}

// Diminishing returns decay: modifier[i] applied at DECAY[i] rate
// First effect at 100%, second at 70%, third at 50%, fourth+ at 40%
export const DIMINISHING_DECAY = [1.0, 0.7, 0.5, 0.4]

// Days in a quarter (approximate)
export const DAYS_IN_QUARTER = 91

// Starting conditions: 200-bed community hospital
export const STARTING_BEDS = 200
export const STARTING_CASH = 10_000_000
export const STARTING_PATIENT_VOLUME = 2500 // cases per quarter
export const STARTING_LOS = 5.2 // days
export const STARTING_QUALITY = 65
export const STARTING_NURSE_RATIO = 5 // 1:5
export const STARTING_HEADCOUNT = 800
export const STARTING_AVG_COMP_PER_QUARTER = 18_750 // $75K/year
export const STARTING_OR_CAPACITY = 200 // max surgical cases per quarter
export const STARTING_DRG_ACCURACY = 1.0

// Payer rates per case
export const MEDICARE_RATE = 12_000
export const COMMERCIAL_RATE = 18_000
export const MEDICAID_RATE = 8_000
export const SELF_PAY_RATE = 3_000
export const SURGICAL_RATE = 22_000

// Payer mix (fractions)
export const PAYER_MIX = {
  medicare: 0.45,
  commercial: 0.35,
  medicaid: 0.15,
  selfPay: 0.05,
}

// Supply costs per case by tier
export const SUPPLY_COST = {
  budget: 1_800,
  standard: 2_400,
  premium: 3_200,
}

// Overhead per quarter (relatively fixed)
export const OVERHEAD_PER_QUARTER = 6_000_000
export const CAPITAL_DEPRECIATION_PER_QUARTER = 1_500_000

// Overtime multiplier based on nurse-to-patient ratio
// More patients per nurse = more overtime = exponential cost
export const OVERTIME_MULTIPLIER: Record<number, number> = {
  4: 1.00,
  5: 1.05,
  6: 1.15,
  7: 1.35,
  8: 1.60,
}

// Quality score weights
export const QUALITY_WEIGHTS = {
  nurseRatio: 0.4,
  programs: 0.3,
  supplyTier: 0.3,
}

// Quality component scores by nurse ratio
export const NURSE_RATIO_QUALITY: Record<number, number> = {
  4: 100,
  5: 80,
  6: 60,
  7: 40,
  8: 20,
}

// Quality component scores by supply tier
export const SUPPLY_TIER_QUALITY: Record<string, number> = {
  premium: 100,
  standard: 60,
  budget: 20,
}

// Malpractice cost: base * (100 - quality) / 50, per quarter
export const MALPRACTICE_BASE = 125_000

// Readmission formula: base - (quality * sensitivity)
export const READMISSION_BASE = 0.25
export const READMISSION_SENSITIVITY = 0.0015 // per quality point

// Medicare readmission penalty threshold and rate
export const READMISSION_PENALTY_THRESHOLD = 0.15
export const READMISSION_PENALTY_RATE = 0.02 // 2% reduction in medicare rate

// Occupancy thresholds
export const SURGICAL_CANCEL_THRESHOLD = 0.90 // cancel elective surgeries above this
export const ED_BOARDING_THRESHOLD = 0.95

// Surgical revenue: fraction of total volume that's surgical (starting)
export const SURGICAL_FRACTION = 0.15 // 15% of cases are surgical

// Hospitalist program effects
export const HOSPITALIST_SUBSIDY_PER_QUARTER = 500_000

// Program quality scores (for quality model)
export function programQualityScore(programs: ProgramState): number {
  if (programs.hospitalist?.active && programs.hospitalist.documentationTraining) return 100
  if (programs.hospitalist?.active || programs.dischargeCoordination?.active) return 60
  return 20
}

// Build the initial hospital state
export function createInitialState(eventDeck: import('./types').ExternalEvent[]): HospitalState {
  const medicalCases = Math.round(STARTING_PATIENT_VOLUME * (1 - SURGICAL_FRACTION))
  const surgicalCases = Math.round(STARTING_PATIENT_VOLUME * SURGICAL_FRACTION)

  const programs: ProgramState = {
    nurseRatio: STARTING_NURSE_RATIO,
    compensationChange: 0,
    supplyTier: 'standard',
  }

  const overtimeMultiplier = OVERTIME_MULTIPLIER[STARTING_NURSE_RATIO] ?? 1.05
  const laborCost = STARTING_HEADCOUNT * STARTING_AVG_COMP_PER_QUARTER * overtimeMultiplier
  const supplyCost = STARTING_PATIENT_VOLUME * SUPPLY_COST.standard
  const malpracticeCost = MALPRACTICE_BASE * (100 - STARTING_QUALITY) / 50
  const overheadCost = OVERHEAD_PER_QUARTER + malpracticeCost
  const totalExpenses = laborCost + supplyCost + overheadCost + CAPITAL_DEPRECIATION_PER_QUARTER

  const medicareCases = Math.round(medicalCases * PAYER_MIX.medicare / (1 - SURGICAL_FRACTION))
  const commercialCases = Math.round(medicalCases * PAYER_MIX.commercial / (1 - SURGICAL_FRACTION))
  const medicaidCases = Math.round(medicalCases * PAYER_MIX.medicaid / (1 - SURGICAL_FRACTION))
  const selfPayCases = medicalCases - medicareCases - commercialCases - medicaidCases

  const medicalRevenue =
    medicareCases * MEDICARE_RATE * STARTING_DRG_ACCURACY +
    commercialCases * COMMERCIAL_RATE +
    medicaidCases * MEDICAID_RATE +
    selfPayCases * SELF_PAY_RATE

  const surgicalRevenue = surgicalCases * SURGICAL_RATE
  const totalRevenue = medicalRevenue + surgicalRevenue
  const margin = (totalRevenue - totalExpenses) / totalRevenue

  const occupancyRate = (STARTING_PATIENT_VOLUME * STARTING_LOS) / (STARTING_BEDS * DAYS_IN_QUARTER)

  return {
    quarter: 1,
    operational: {
      beds: {
        total: STARTING_BEDS,
        occupancyRate,
        availableBedDays: STARTING_BEDS * DAYS_IN_QUARTER * (1 - occupancyRate),
      },
      lengthOfStay: STARTING_LOS,
      dischargeRate: STARTING_PATIENT_VOLUME,
      bedTurnover: STARTING_PATIENT_VOLUME / STARTING_BEDS,
      surgical: {
        orCapacity: STARTING_OR_CAPACITY,
        casesCompleted: surgicalCases,
        casesCancelled: 0,
      },
      readmissionRate: READMISSION_BASE - STARTING_QUALITY * READMISSION_SENSITIVITY,
      drgAccuracy: STARTING_DRG_ACCURACY,
      qualityScore: STARTING_QUALITY,
    },
    financial: {
      cashReserves: STARTING_CASH,
      revenue: {
        medical: medicalRevenue,
        surgical: surgicalRevenue,
        total: totalRevenue,
      },
      expenses: {
        labor: {
          amount: laborCost,
          headcount: STARTING_HEADCOUNT,
          avgCompPerQuarter: STARTING_AVG_COMP_PER_QUARTER,
          overtimeCost: laborCost - STARTING_HEADCOUNT * STARTING_AVG_COMP_PER_QUARTER,
        },
        supplies: {
          amount: supplyCost,
          costPerCase: SUPPLY_COST.standard,
        },
        overhead: {
          amount: overheadCost,
        },
        capital: {
          amount: CAPITAL_DEPRECIATION_PER_QUARTER,
          depreciationBase: CAPITAL_DEPRECIATION_PER_QUARTER,
        },
        programSubsidies: 0,
        total: totalExpenses,
      },
      margin,
      payers: {
        medicare: {
          share: PAYER_MIX.medicare,
          baseRate: MEDICARE_RATE,
          effectiveRate: MEDICARE_RATE * STARTING_DRG_ACCURACY,
          cases: medicareCases,
        },
        commercial: {
          share: PAYER_MIX.commercial,
          baseRate: COMMERCIAL_RATE,
          effectiveRate: COMMERCIAL_RATE,
          cases: commercialCases,
        },
        medicaid: {
          share: PAYER_MIX.medicaid,
          baseRate: MEDICAID_RATE,
          effectiveRate: MEDICAID_RATE,
          cases: medicaidCases,
        },
        selfPay: {
          share: PAYER_MIX.selfPay,
          baseRate: SELF_PAY_RATE,
          effectiveRate: SELF_PAY_RATE,
          cases: selfPayCases,
        },
      },
    },
    programs,
    pendingEffects: [],
    activeEvents: [],
    eventDeck,
    history: [],
    gameOver: false,
  }
}
