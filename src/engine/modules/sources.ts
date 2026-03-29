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

const DEFAULT_BASE_ANNUAL_VOLUME = 10_000  // 2500/quarter × 4
const DEFAULT_ED_ADMISSION_RATE = 0.30
const DEFAULT_SEASONAL_VARIANCE = 0.10

// ── Internal state shape ─────────────────────────────────────────────

export interface SourcesState extends ModuleState {
  baseAnnualVolume: number
  edAdmissionRate: number
  seasonalVariance: number
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
      seasonalVariance: (c.seasonalVariance as number) ?? DEFAULT_SEASONAL_VARIANCE,
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

    // ── Base volume with seasonal variation ─────────────────────────
    const seasonalMod = s.seasonalVariance * Math.sin(s.yearIndex * 1.2)
    let volume = s.baseAnnualVolume * (1 + seasonalMod)

    // ── Readmission feedback ───────────────────────────────────────
    volume += inputs.readmissions

    // ── Event volume modifiers ─────────────────────────────────────
    for (const ev of events) {
      if (ev.volumeModifier != null) {
        volume *= (1 + ev.volumeModifier)
      }
    }

    // ── Bed pressure reduces admissions ────────────────────────────
    const effectiveAdmissionRate = 1 - inputs.signals.bedPressure * 0.3
    volume = volume * effectiveAdmissionRate

    // ── Quality reputation effect ──────────────────────────────────
    if (inputs.signals.qualityScore > 70) {
      volume *= 1.05
    } else if (inputs.signals.qualityScore < 40) {
      volume *= 0.90
    }

    volume = Math.round(volume)

    // ── Build next state ───────────────────────────────────────────
    const nextState: SourcesState = {
      baseAnnualVolume: s.baseAnnualVolume,
      edAdmissionRate: s.edAdmissionRate,
      seasonalVariance: s.seasonalVariance,
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
