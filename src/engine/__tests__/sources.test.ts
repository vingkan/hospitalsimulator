import { describe, it, expect } from 'vitest'
import { sourcesModule } from '../modules/sources'
import type { SourcesState } from '../modules/sources'
import type { ModuleInputs, ModuleControls } from '../modules/types'

// ── Helpers ──────────────────────────────────────────────────────────

function defaultConfig() {
  return {
    id: 'sources',
    calibrationConstants: {},
  }
}

function defaultState(): SourcesState {
  return sourcesModule.init(defaultConfig()) as SourcesState
}

function defaultInputs(): ModuleInputs {
  return {
    patients: {
      count: 0, // Sources generates its own volume
      avgAcuity: 0,
      surgicalFraction: 0,
      avgLOS: 0,
    },
    signals: {
      bedPressure: 0,
      qualityScore: 56,
      readmissionRate: 0.166,
    },
    events: [],
    readmissions: 0,
  }
}

function defaultControls(): ModuleControls {
  return {}
}

// ── Tests ────────────────────────────────────────────────────────────

describe('Sources module', () => {
  // 1. init produces valid state with default volume
  it('init produces valid state with default volume', () => {
    const state = defaultState()
    expect(state.baseAnnualVolume).toBe(8_340)
    expect(state.edAdmissionRate).toBe(0.30)
    expect(state.yearIndex).toBe(0)
  })

  // 2. Base volume computation within expected range
  it('base volume computation within expected range', () => {
    const state = defaultState()
    const inputs = defaultInputs()
    const controls = defaultControls()

    const { outputs } = sourcesModule.tick(state, inputs, controls)

    // Base 8340 (readmissions add ~1660 to reach ~10000 total)
    // Without readmissions in this unit test, volume ≈ 8340
    expect(outputs.patients.count).toBeGreaterThanOrEqual(7_000)
    expect(outputs.patients.count).toBeLessThanOrEqual(9_500)
    expect(outputs.patients.avgAcuity).toBe(1.5)
    expect(outputs.patients.surgicalFraction).toBe(0.15)
    expect(outputs.patients.avgLOS).toBe(5.2)
  })

  // 3. Bed pressure reduces admissions (30% at full pressure)
  it('bed pressure reduces admissions', () => {
    const state = defaultState()
    const inputsNoPressure = defaultInputs()
    const inputsFullPressure: ModuleInputs = {
      ...defaultInputs(),
      signals: { bedPressure: 1.0, qualityScore: 56, readmissionRate: 0.166 },
    }
    const controls = defaultControls()

    const { outputs: outNone } = sourcesModule.tick(state, inputsNoPressure, controls)
    const { outputs: outFull } = sourcesModule.tick(state, inputsFullPressure, controls)

    // Full bed pressure: volume × (1 - 1.0 × 0.15) = volume × 0.85
    // So full pressure output should be ~85% of no-pressure output
    const ratio = outFull.patients.count / outNone.patients.count
    expect(ratio).toBeGreaterThanOrEqual(0.80)
    expect(ratio).toBeLessThanOrEqual(0.90)
  })

  // 4. Readmission feedback adds to volume
  it('readmission feedback adds to volume', () => {
    const state = defaultState()
    const inputsNoReadmit = defaultInputs()
    const inputsWithReadmit: ModuleInputs = {
      ...defaultInputs(),
      readmissions: 500,
    }
    const controls = defaultControls()

    const { outputs: outNone } = sourcesModule.tick(state, inputsNoReadmit, controls)
    const { outputs: outReadmit } = sourcesModule.tick(state, inputsWithReadmit, controls)

    // Readmissions add ~500 to volume
    const diff = outReadmit.patients.count - outNone.patients.count
    expect(diff).toBeGreaterThanOrEqual(450)
    expect(diff).toBeLessThanOrEqual(550)
  })

  // 5. Event volume modifiers applied correctly
  it('event volume modifiers applied correctly', () => {
    const state = defaultState()
    const inputsNoEvent = defaultInputs()
    const inputsWithEvent: ModuleInputs = {
      ...defaultInputs(),
      events: [{ moduleId: 'sources', volumeModifier: 0.20 }],
    }
    const controls = defaultControls()

    const { outputs: outNone } = sourcesModule.tick(state, inputsNoEvent, controls)
    const { outputs: outEvent } = sourcesModule.tick(state, inputsWithEvent, controls)

    // +20% volume modifier
    const ratio = outEvent.patients.count / outNone.patients.count
    expect(ratio).toBeGreaterThanOrEqual(1.15)
    expect(ratio).toBeLessThanOrEqual(1.25)
  })

  // 6. getFitnessCriteria returns volume/ED rate ranges
  it('getFitnessCriteria returns volume and ED rate ranges', () => {
    const criteria = sourcesModule.getFitnessCriteria()
    expect(criteria.length).toBeGreaterThanOrEqual(2)

    const volume = criteria.find(c => c.metric === 'annualVolume')
    expect(volume).toBeDefined()
    expect(volume!.min).toBeGreaterThanOrEqual(6_000)
    expect(volume!.max).toBeLessThanOrEqual(15_000)

    const edRate = criteria.find(c => c.metric === 'edAdmissionRate')
    expect(edRate).toBeDefined()
    expect(edRate!.min).toBeGreaterThanOrEqual(0.20)
    expect(edRate!.max).toBeLessThanOrEqual(0.40)
  })
})
