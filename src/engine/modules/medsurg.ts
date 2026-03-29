// Med/Surg module: beds, LOS, quality, DRG accuracy, readmission, labor, supplies, programs.
// Layer 2 (Care) - the core inpatient medicine module.
// All computations are ANNUAL (game tick = 1 year).

import type {
  HospitalModule,
  ModuleConfig,
  ModuleState,
  ModuleInputs,
  ModuleOutputs,
  ModuleControls,
  ControlDefinition,
  FitnessCriterion,
  EventEffect,
} from './types'
import { composeEffects, getOvertimeMultiplier, DOMAIN_BOUNDS } from '../utils'

// ── Constants ────────────────────────────────────────────────────────

const DAYS_IN_YEAR = 365

const BASE_LOS = 5.2 // AHA community hospital average

const NURSE_RATIO_QUALITY: Record<number, number> = {
  4: 100,
  5: 80,
  6: 60,
  7: 40,
  8: 20,
}

const SUPPLY_TIER_QUALITY: Record<string, number> = {
  premium: 100,
  standard: 60,
  budget: 20,
}

const SUPPLY_COST_PER_CASE: Record<string, number> = {
  budget: 2_100,    // narrower gap: $300 savings vs standard, not $600
  standard: 2_400,
  premium: 3_000,   // narrower gap: $600 premium, not $800
}

const QUALITY_WEIGHTS = {
  nurse: 0.4,
  program: 0.3,
  supply: 0.3,
}

const READMISSION_BASE = 0.25
const READMISSION_SENSITIVITY = 0.0015 // per quality point

// Program subsidies (annual)
const HOSPITALIST_SUBSIDY_PER_YEAR = 3_500_000
const DISCHARGE_DEDICATED_SUBSIDY_PER_YEAR = 1_200_000
const DISCHARGE_NURSELED_SUBSIDY_PER_YEAR = 400_000

// ── Defaults ─────────────────────────────────────────────────────────

const DEFAULT_BEDS = 200
const DEFAULT_HEADCOUNT = 1100
const DEFAULT_AVG_COMP_PER_YEAR = 76_000
const DEFAULT_QUALITY = 56
const DEFAULT_LOS = 5.2
const DEFAULT_READMISSION = 0.166

// ── Internal state shape ─────────────────────────────────────────────

export interface MedSurgState extends ModuleState {
  beds: number
  occupancyRate: number
  lengthOfStay: number
  qualityScore: number
  drgAccuracy: number
  readmissionRate: number
  headcount: number
  avgCompPerYear: number
  // Track previous hospitalist effectiveness for carry-forward rule
  prevHospitalistEffectiveness: number | null
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Interpolate nurse quality for non-integer ratios */
function interpolateNurseQuality(ratio: number): number {
  const clamped = Math.max(4, Math.min(8, ratio))
  const lower = Math.floor(clamped)
  const upper = Math.ceil(clamped)
  if (lower === upper) return NURSE_RATIO_QUALITY[lower] ?? 60
  const lowerQ = NURSE_RATIO_QUALITY[lower] ?? 60
  const upperQ = NURSE_RATIO_QUALITY[upper] ?? 60
  const t = clamped - lower
  return lowerQ + (upperQ - lowerQ) * t
}

/** Compute hospitalist effectiveness from controls, respecting carry-forward */
function computeHospitalistEffectiveness(
  workforce: string,
  cdi: string,
  prevEffectiveness: number | null,
): number {
  let eff = workforce === 'employed' ? 1.0 : 0.7
  if (workforce === 'contracted' && cdi === 'aggressive') {
    eff *= 0.8
  }
  // Carry forward the lower value if previously active with lower effectiveness
  if (prevEffectiveness !== null && prevEffectiveness < eff) {
    eff = prevEffectiveness
  }
  return eff
}

/** Compute program quality score */
function programQualityScore(
  hospitalistActive: boolean,
  hospitalistDocTraining: boolean,
  dischargeActive: boolean,
): number {
  if (hospitalistActive && hospitalistDocTraining) return 100
  if (hospitalistActive || dischargeActive) return 60
  return 20
}

/** Collect relevant event effects for this module */
function relevantEvents(events: EventEffect[]): EventEffect[] {
  return events.filter(e => e.moduleId === 'medsurg' || e.moduleId === '*')
}

// ── Module ───────────────────────────────────────────────────────────

export const medSurgModule: HospitalModule = {
  id: 'medsurg',
  layer: 2,

  init(config: ModuleConfig): MedSurgState {
    const c = config.calibrationConstants
    return {
      beds: c.beds ?? DEFAULT_BEDS,
      occupancyRate: 0, // computed on first tick
      lengthOfStay: c.lengthOfStay ?? DEFAULT_LOS,
      qualityScore: c.qualityScore ?? DEFAULT_QUALITY,
      drgAccuracy: c.drgAccuracy ?? 1.0,
      readmissionRate: c.readmissionRate ?? DEFAULT_READMISSION,
      headcount: c.headcount ?? DEFAULT_HEADCOUNT,
      avgCompPerYear: c.avgCompPerYear ?? DEFAULT_AVG_COMP_PER_YEAR,
      prevHospitalistEffectiveness: null,
    }
  },

  tick(
    state: ModuleState,
    inputs: ModuleInputs,
    controls: ModuleControls,
  ): { nextState: ModuleState; outputs: ModuleOutputs } {
    const s = state as MedSurgState
    const events = relevantEvents(inputs.events)

    // ── Read controls ──────────────────────────────────────────────
    const nurseRatio = (controls.nurseRatio as number) ?? 5
    const compensationChange = (controls.compensationChange as number) ?? 0
    const headcountDelta = (controls.headcountDelta as number) ?? 0
    const supplyTier = (controls.supplyTier as string) ?? 'standard'
    const hospitalistActive = (controls.hospitalistActive as boolean) ?? false
    const hospitalistWorkforce = (controls.hospitalistWorkforce as string) ?? 'employed'
    const hospitalistCDI = (controls.hospitalistCDI as string) ?? 'light'
    const hospitalistDocTraining = (controls.hospitalistDocTraining as boolean) ?? false
    const dischargeActive = (controls.dischargeActive as boolean) ?? false
    const dischargeModel = (controls.dischargeModel as string) ?? 'dedicated_planners'
    const dischargePartnerships = (controls.dischargePartnerships as boolean) ?? false

    // ── Headcount ──────────────────────────────────────────────────
    const headcount = Math.max(0, s.headcount + headcountDelta)
    // Apply comp change to BASE rate, not running value (prevents compounding)
    const avgCompPerYear = DEFAULT_AVG_COMP_PER_YEAR * (1 + compensationChange / 100)

    // ── Hospitalist effectiveness ──────────────────────────────────
    let hospitalistEffectiveness = 0
    let nextPrevEffectiveness: number | null = s.prevHospitalistEffectiveness
    if (hospitalistActive) {
      hospitalistEffectiveness = computeHospitalistEffectiveness(
        hospitalistWorkforce,
        hospitalistCDI,
        s.prevHospitalistEffectiveness,
      )
      nextPrevEffectiveness = hospitalistEffectiveness
    } else {
      nextPrevEffectiveness = null
    }

    // ── LOS ────────────────────────────────────────────────────────
    const losModifiers: number[] = []

    if (hospitalistActive) {
      // Real hospitalist programs reduce LOS by 0.3-0.5 days (AHA benchmarks)
      const w = hospitalistWorkforce
      const c = hospitalistCDI
      if (w === 'employed' && c === 'light') {
        losModifiers.push(-0.5 * hospitalistEffectiveness)
      } else if (w === 'employed' && c === 'aggressive') {
        losModifiers.push(-0.3 * hospitalistEffectiveness)
      } else if (w === 'contracted' && c === 'light') {
        losModifiers.push(-0.3 * hospitalistEffectiveness)
      } else if (w === 'contracted' && c === 'aggressive') {
        losModifiers.push(-0.2 * hospitalistEffectiveness)
      }
    }

    if (dischargeActive) {
      if (dischargeModel === 'dedicated_planners') {
        losModifiers.push(-0.6)
        if (dischargePartnerships) losModifiers.push(-0.2)
      } else {
        losModifiers.push(-0.3)
      }
    }

    // Event LOS effects: use volumeModifier as a proxy for LOS shift
    // (EventEffect doesn't have a dedicated LOS field, so we skip event LOS for now;
    // quality/cost modifiers are applied below)

    const lengthOfStay = composeEffects(BASE_LOS, losModifiers, DOMAIN_BOUNDS.lengthOfStay)

    // ── Quality ────────────────────────────────────────────────────
    // Compensation affects nurse morale/retention: -5% comp → -10% nurse quality
    const compQualityFactor = 1 + compensationChange * 0.02
    const nurseQuality = interpolateNurseQuality(nurseRatio) * Math.max(0.5, Math.min(1.2, compQualityFactor))
    const programQuality = programQualityScore(
      hospitalistActive,
      hospitalistDocTraining,
      dischargeActive,
    )
    const supplyQuality = SUPPLY_TIER_QUALITY[supplyTier] ?? 60

    const qualityBase =
      QUALITY_WEIGHTS.nurse * nurseQuality +
      QUALITY_WEIGHTS.program * programQuality +
      QUALITY_WEIGHTS.supply * supplyQuality

    const qualityModifiers: number[] = []
    for (const ev of events) {
      if (ev.qualityModifier != null) qualityModifiers.push(ev.qualityModifier)
    }

    const qualityScore = composeEffects(qualityBase, qualityModifiers, DOMAIN_BOUNDS.qualityScore)

    // ── DRG accuracy ───────────────────────────────────────────────
    let drgBase = 1.0
    if (hospitalistActive) {
      // Doc training: real CDI improves case-mix index by 1-2%
      if (hospitalistDocTraining) {
        drgBase += 0.02 * hospitalistEffectiveness
      }
      if (hospitalistCDI === 'aggressive') {
        drgBase += 0.02 * hospitalistEffectiveness
      } else {
        drgBase += 0.01 * hospitalistEffectiveness
      }
    }

    const drgModifiers: number[] = []
    for (const ev of events) {
      if (ev.rateModifier != null) drgModifiers.push(ev.rateModifier)
    }

    const drgAccuracy = composeEffects(drgBase, drgModifiers, DOMAIN_BOUNDS.drgAccuracy)

    // ── Readmission ────────────────────────────────────────────────
    const readmissionBase = READMISSION_BASE - qualityScore * READMISSION_SENSITIVITY
    const readmissionModifiers: number[] = []
    if (dischargeActive) {
      readmissionModifiers.push(dischargePartnerships ? -0.02 : -0.01)
    }
    // No event readmission field in EventEffect, skip

    const readmissionRate = composeEffects(
      readmissionBase,
      readmissionModifiers,
      DOMAIN_BOUNDS.readmissionRate,
    )

    // ── Volume & occupancy ─────────────────────────────────────────
    const volume = inputs.patients.count
    const beds = s.beds // bed changes handled by orchestrator
    const occupancyRate = Math.min(1.0, (volume * lengthOfStay) / (beds * DAYS_IN_YEAR))

    // ── Bed pressure ───────────────────────────────────────────────
    // Threshold formula: no diversion below 80% occupancy, ramps to 1.0 at 95%
    const bedPressure = Math.min(1.0, Math.max(0, (occupancyRate - 0.80) / 0.15))

    // ── Financials (annual) ────────────────────────────────────────

    // Labor: fixed + variable split (70/30)
    // Fixed staff (management, specialists, admin) always paid.
    // Variable staff (PRN/agency) scales with census utilization.
    // Comp cuts increase turnover → more overtime/agency usage
    // -5% comp adds ~5% overtime premium (turnover backfill)
    const compOvertimePenalty = compensationChange < 0 ? 1 + Math.abs(compensationChange) * 0.01 : 1.0
    const overtimeMultiplier = getOvertimeMultiplier(nurseRatio) * compOvertimePenalty
    const fixedStaff = headcount * 0.70
    const variableStaff = headcount * 0.30
    // Hours needed: nursing hours (24/ratio per patient-day) × 2.4 for all variable roles
    // (techs, aides, dietary, housekeeping scale with census alongside nursing)
    const VARIABLE_STAFF_MULTIPLIER = 2.4
    const productiveHoursNeeded = volume * lengthOfStay * (1 / nurseRatio) * 24 * VARIABLE_STAFF_MULTIPLIER
    const availableVariableHours = variableStaff * 2080 * 0.85 // annual hours × productivity
    const variableUtilization = Math.min(1.0, productiveHoursNeeded / (availableVariableHours || 1))
    const fixedCost = fixedStaff * avgCompPerYear * overtimeMultiplier
    const variableCost = variableStaff * avgCompPerYear * variableUtilization
    let laborCost = fixedCost + variableCost
    // Agency premium when understaffed
    if (productiveHoursNeeded > availableVariableHours) {
      const excessHours = productiveHoursNeeded - availableVariableHours
      const agencyPremium = excessHours * (avgCompPerYear / 2080) * 1.5
      laborCost += agencyPremium
    }
    for (const ev of events) {
      if (ev.laborCostDelta != null) laborCost += ev.laborCostDelta
    }

    // Supplies
    const supplyCostPerCase = SUPPLY_COST_PER_CASE[supplyTier] ?? SUPPLY_COST_PER_CASE.standard
    let supplyCostModifier = 1.0
    for (const ev of events) {
      if (ev.supplyCostModifier != null) supplyCostModifier += ev.supplyCostModifier
    }
    const supplyCost = volume * supplyCostPerCase * supplyCostModifier

    // Programs
    let programCost = 0
    if (hospitalistActive) programCost += HOSPITALIST_SUBSIDY_PER_YEAR
    if (dischargeActive) {
      programCost += dischargeModel === 'dedicated_planners'
        ? DISCHARGE_DEDICATED_SUBSIDY_PER_YEAR
        : DISCHARGE_NURSELED_SUBSIDY_PER_YEAR
    }

    // ── Build next state ───────────────────────────────────────────
    const nextState: MedSurgState = {
      beds,
      occupancyRate,
      lengthOfStay,
      qualityScore,
      drgAccuracy,
      readmissionRate,
      headcount,
      avgCompPerYear,
      prevHospitalistEffectiveness: nextPrevEffectiveness,
    }

    const outputs: ModuleOutputs = {
      patients: {
        count: volume,
        avgAcuity: inputs.patients.avgAcuity,
        surgicalFraction: inputs.patients.surgicalFraction,
        avgLOS: lengthOfStay,
      },
      financials: {
        revenue: 0, // Revenue computed by Finance aggregator
        expenses: {
          labor: laborCost,
          supplies: supplyCost,
          overhead: 0, // Hospital-wide overhead handled by Finance aggregator
          capital: 0,  // Unless bed changes (handled by orchestrator)
          programs: programCost,
        },
      },
      signals: {
        bedPressure,
        qualityScore,
        readmissionRate,
      },
    }

    return { nextState, outputs }
  },

  getControls(): ControlDefinition[] {
    return [
      {
        key: 'nurseRatio',
        label: 'Nurse-to-Patient Ratio',
        type: 'slider',
        min: 4,
        max: 8,
        step: 1,
        default: 5,
      },
      {
        key: 'compensationChange',
        label: 'Compensation Change (%)',
        type: 'slider',
        min: -5,
        max: 10,
        step: 1,
        default: 0,
      },
      {
        key: 'headcountDelta',
        label: 'Headcount Change (FTEs)',
        type: 'slider',
        min: -100,
        max: 100,
        step: 10,
        default: 0,
      },
      {
        key: 'supplyTier',
        label: 'Supply Tier',
        type: 'segment',
        options: [
          { value: 'budget', label: 'Budget' },
          { value: 'standard', label: 'Standard' },
          { value: 'premium', label: 'Premium' },
        ],
        default: 'standard',
      },
      {
        key: 'hospitalistActive',
        label: 'Hospitalist Program',
        type: 'toggle',
        default: false,
      },
      {
        key: 'hospitalistWorkforce',
        label: 'Hospitalist Workforce',
        type: 'segment',
        options: [
          { value: 'employed', label: 'Employed' },
          { value: 'contracted', label: 'Contracted' },
        ],
        default: 'employed',
      },
      {
        key: 'hospitalistCDI',
        label: 'CDI Intensity',
        type: 'segment',
        options: [
          { value: 'light', label: 'Light' },
          { value: 'aggressive', label: 'Aggressive' },
        ],
        default: 'light',
      },
      {
        key: 'hospitalistDocTraining',
        label: 'Documentation Training',
        type: 'toggle',
        default: false,
      },
      {
        key: 'dischargeActive',
        label: 'Discharge Coordination',
        type: 'toggle',
        default: false,
      },
      {
        key: 'dischargeModel',
        label: 'Discharge Model',
        type: 'segment',
        options: [
          { value: 'dedicated_planners', label: 'Dedicated Planners' },
          { value: 'nurse_led', label: 'Nurse-Led' },
        ],
        default: 'dedicated_planners',
      },
      {
        key: 'dischargePartnerships',
        label: 'Post-Acute Partnerships',
        type: 'toggle',
        default: false,
      },
    ]
  },

  getFitnessCriteria(): FitnessCriterion[] {
    return [
      {
        metric: 'occupancyRate',
        min: 0.65,
        max: 0.85,
        source: 'AHA Hospital Statistics: median community hospital occupancy',
        severity: 'warning',
      },
      {
        metric: 'lengthOfStay',
        min: 4.5,
        max: 6.0,
        source: 'AHA Hospital Statistics: average community hospital LOS',
        severity: 'warning',
      },
      {
        metric: 'qualityScore',
        min: 50,
        max: 70,
        source: 'Baseline quality with standard supplies, 1:5 ratio, no programs',
        severity: 'warning',
      },
      {
        metric: 'readmissionRate',
        min: 0.12,
        max: 0.18,
        source: 'CMS national all-cause readmission average ~15.5%',
        severity: 'fail',
      },
    ]
  },
}

export default medSurgModule
