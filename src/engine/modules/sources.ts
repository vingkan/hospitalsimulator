// Sources module: patient arrivals, seasonal variation, readmission feedback, reputation.
// Layer 1 (Arrival) - external patient volume entering the hospital.
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

// ── Constants ────────────────────────────────────────────────────────

// Base volume excludes readmissions. With ~16.6% readmission rate,
// base 8,340 + readmissions ≈ 10,000 total (AHA 200-bed community hospital).
const DEFAULT_BASE_ANNUAL_VOLUME = 8_340
const DEFAULT_ED_ADMISSION_RATE = 0.30
const BED_PRESSURE_ADMISSION_COEFFICIENT = 0.15

// ── Internal state shape ─────────────────────────────────────────────

export interface SourcesState extends ModuleState {
  baseAnnualVolume: number
  edAdmissionRate: number
  yearIndex: number
}

// ── Helpers ──────────────────────────────────────────────────────────

function relevantEvents(events: EventEffect[]): EventEffect[] {
  return events.filter(e => e.moduleId === 'sources' || e.moduleId === '*')
}

// ── Module ───────────────────────────────────────────────────────────

export const sourcesModule: HospitalModule = {
  id: 'sources',
  layer: 1,

  init(config: ModuleConfig): SourcesState {
    const c = config.calibrationConstants
    return {
      baseAnnualVolume: (c.baseAnnualVolume as number) ?? DEFAULT_BASE_ANNUAL_VOLUME,
      edAdmissionRate: (c.edAdmissionRate as number) ?? DEFAULT_ED_ADMISSION_RATE,
      yearIndex: 0,
    }
  },

  tick(
    state: ModuleState,
    inputs: ModuleInputs,
    _controls: ModuleControls,
  ): { nextState: ModuleState; outputs: ModuleOutputs } {
    const s = state as SourcesState
    const events = relevantEvents(inputs.events)

    // ── Base volume (events provide year-over-year variation) ───────
    let volume = s.baseAnnualVolume

    // ── Readmission feedback ───────────────────────────────────────
    volume += inputs.readmissions

    // ── Event volume modifiers ─────────────────────────────────────
    for (const ev of events) {
      if (ev.volumeModifier != null) {
        volume *= (1 + ev.volumeModifier)
      }
    }

    // ── Bed pressure reduces admissions ────────────────────────────
    const effectiveAdmissionRate = 1 - inputs.signals.bedPressure * BED_PRESSURE_ADMISSION_COEFFICIENT
    volume = volume * effectiveAdmissionRate

    // ── Quality reputation effect (gradient, not cliff) ─────────────
    // Linear from -5% at quality 20 to +3% at quality 90.
    // At baseline quality 56: +0.6% (near-neutral).
    const qualityMidpoint = 55
    // Asymmetric: low quality penalizes volume harder than high quality rewards it
    // Below midpoint: /300 (strong penalty). Above: /600 (modest reward).
    const qualityDelta = inputs.signals.qualityScore - qualityMidpoint
    const qualityReputationEffect = qualityDelta < 0
      ? qualityDelta / 300
      : qualityDelta / 600
    volume *= (1 + qualityReputationEffect)

    volume = Math.round(volume)

    // ── Build next state ───────────────────────────────────────────
    const nextState: SourcesState = {
      baseAnnualVolume: s.baseAnnualVolume,
      edAdmissionRate: s.edAdmissionRate,
      yearIndex: s.yearIndex + 1,
    }

    const outputs: ModuleOutputs = {
      patients: {
        count: volume,
        avgAcuity: 1.5,
        surgicalFraction: 0.15,
        avgLOS: 5.2,
      },
      financials: {
        revenue: 0,
        expenses: {
          labor: 0,
          supplies: 0,
          overhead: 0,
          capital: 0,
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
    return [] // External arrivals not player-controlled
  },

  getFitnessCriteria(): FitnessCriterion[] {
    return [
      {
        metric: 'annualVolume',
        min: 8_000,
        max: 12_000,
        source: 'AHA 200-bed community hospital annual admissions',
        severity: 'warning',
      },
      {
        metric: 'edAdmissionRate',
        min: 0.25,
        max: 0.35,
        source: 'AHA ED admission rate range for community hospitals',
        severity: 'warning',
      },
    ]
  },
}

export default sourcesModule
