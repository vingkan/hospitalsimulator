// Inpatient OR module: surgical capacity, utilization, cancellations, expansion.
// Layer 3 (Procedural) - the operating room service line.
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
} from './types'

// ── Constants ────────────────────────────────────────────────────────

const SURGICAL_RATE = 22_000         // revenue per surgical case
const SURGICAL_SUPPLY_COST = 5_000   // supply cost per surgical case
const MINOR_EXPANSION_CAPACITY = 80  // additional cases/year
const MAJOR_EXPANSION_CAPACITY = 200
const MINOR_EXPANSION_CAPITAL = 1_000_000
const MAJOR_EXPANSION_CAPITAL = 4_000_000

const DEFAULT_OR_CAPACITY = 1600     // 400/quarter × 4

// ── Internal state shape ─────────────────────────────────────────────

export interface ORState extends ModuleState {
  orCapacity: number
  utilization: number
  expansionCapitalSpent: boolean  // tracks whether first-year capital was already charged
}

// ── Module ───────────────────────────────────────────────────────────

export const orModule: HospitalModule = {
  id: 'or',
  layer: 3,

  init(config: ModuleConfig): ORState {
    const c = config.calibrationConstants
    return {
      orCapacity: (c.orCapacity as number) ?? DEFAULT_OR_CAPACITY,
      utilization: 0,
      expansionCapitalSpent: false,
    }
  },

  tick(
    state: ModuleState,
    inputs: ModuleInputs,
    controls: ModuleControls,
  ): { nextState: ModuleState; outputs: ModuleOutputs } {
    const s = state as ORState

    // ── Read controls ──────────────────────────────────────────────
    const surgicalExpansion = (controls.surgicalExpansion as string) ?? 'none'

    // ── Capacity with expansion ────────────────────────────────────
    let capacity = s.orCapacity
    let capitalCost = 0
    let expansionCapitalSpent = s.expansionCapitalSpent

    if (surgicalExpansion === 'minor') {
      capacity += MINOR_EXPANSION_CAPACITY
      if (!s.expansionCapitalSpent) {
        capitalCost = MINOR_EXPANSION_CAPITAL
        expansionCapitalSpent = true
      }
    } else if (surgicalExpansion === 'major') {
      capacity += MAJOR_EXPANSION_CAPACITY
      if (!s.expansionCapitalSpent) {
        capitalCost = MAJOR_EXPANSION_CAPITAL
        expansionCapitalSpent = true
      }
    } else {
      // Reset capital tracking when expansion is turned off
      expansionCapitalSpent = false
    }

    // ── Surgical demand and completion ─────────────────────────────
    const demand = inputs.patients.count
    let completed = Math.min(demand, capacity)

    // Bed pressure cancellations
    if (inputs.signals.bedPressure > 0) {
      const cancellationRate = Math.min(0.5, inputs.signals.bedPressure * 0.4)
      completed -= Math.round(completed * cancellationRate)
    }

    // Nurse ratio stress cancellations (coupling: surgical expansion × nurse ratio)
    const nurseRatioStress = inputs.signals.nurseRatioStress ?? 0
    if (nurseRatioStress > 0 && surgicalExpansion !== 'none') {
      const expansionMultiplier = surgicalExpansion === 'major' ? 1.0 : 0.5
      const stressCancellationRate = nurseRatioStress * 0.3 * expansionMultiplier
      completed -= Math.round(completed * Math.min(0.3, stressCancellationRate))
    }

    const utilization = capacity > 0 ? completed / capacity : 0

    // ── Financials ─────────────────────────────────────────────────
    const revenue = completed * SURGICAL_RATE
    const supplyCost = completed * SURGICAL_SUPPLY_COST

    // ── Build next state ───────────────────────────────────────────
    const nextState: ORState = {
      orCapacity: capacity,
      utilization,
      expansionCapitalSpent,
    }

    const outputs: ModuleOutputs = {
      patients: {
        count: completed,
        avgAcuity: 2.0,
        surgicalFraction: 0,
        avgLOS: 3.0,
      },
      financials: {
        revenue,
        expenses: {
          labor: 0,
          supplies: supplyCost,
          overhead: 0,
          capital: capitalCost,
          programs: 0,
        },
      },
      signals: {
        bedPressure: 0,
        qualityScore: 0,
        readmissionRate: 0,
      },
    }

    return { nextState, outputs }
  },

  getControls(): ControlDefinition[] {
    return [
      {
        key: 'surgicalExpansion',
        label: 'Surgical Expansion',
        type: 'segment',
        options: [
          { value: 'none', label: 'None' },
          { value: 'minor', label: 'Minor' },
          { value: 'major', label: 'Major' },
        ],
        default: 'none',
      },
    ]
  },

  getFitnessCriteria(): FitnessCriterion[] {
    return [
      {
        metric: 'utilization',
        min: 0.70,
        max: 0.95,
        source: 'OR management literature: community hospital utilization range',
        severity: 'warning',
      },
      {
        metric: 'cancellationRate',
        min: 0.0,
        max: 0.15,
        source: 'OR management literature: cancellation rate range (0 at low bed pressure)',
        severity: 'warning',
      },
      {
        metric: 'surgicalContributionMargin',
        min: 0.70,
        max: 0.85,
        source: 'OR contribution margin (revenue - supplies) / revenue, no allocated labor',
        severity: 'fail',
      },
    ]
  },
}

export default orModule
