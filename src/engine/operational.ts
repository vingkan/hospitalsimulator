import type { HospitalState, OperationalEffects, DomainConfig } from './types'
import {
  DOMAIN_BOUNDS,
  DIMINISHING_DECAY,
  DAYS_IN_QUARTER,
  OVERTIME_MULTIPLIER,
  QUALITY_WEIGHTS,
  NURSE_RATIO_QUALITY,
  SUPPLY_TIER_QUALITY,
  READMISSION_BASE,
  READMISSION_SENSITIVITY,
  SURGICAL_CANCEL_THRESHOLD,
  SURGICAL_FRACTION,
  STARTING_LOS,
  programQualityScore,
} from './constants'

/**
 * Apply diminishing returns to a list of modifiers, then clamp to bounds.
 * Modifiers are sorted by absolute magnitude (largest first gets full weight).
 */
export function composeEffects(
  baseValue: number,
  modifiers: number[],
  config: DomainConfig
): number {
  if (modifiers.length === 0) return Math.max(config.min, Math.min(config.max, baseValue))

  let total = baseValue

  if (config.diminishing) {
    // Sort by absolute magnitude descending: largest effect gets full weight
    const sorted = [...modifiers].sort((a, b) => Math.abs(b) - Math.abs(a))
    for (let i = 0; i < sorted.length; i++) {
      const decay = DIMINISHING_DECAY[Math.min(i, DIMINISHING_DECAY.length - 1)]
      total += sorted[i] * decay
    }
  } else {
    total += modifiers.reduce((sum, m) => sum + m, 0)
  }

  return Math.max(config.min, Math.min(config.max, total))
}

/**
 * Collect all operational effects from active events and pending effects,
 * then recompute all operational metrics.
 */
export function computeOperational(
  state: HospitalState,
  additionalEffects: OperationalEffects[] = []
): HospitalState['operational'] {
  const prev = state.operational
  const programs = state.programs

  // Collect LOS modifiers from programs
  const losModifiers: number[] = []

  if (programs.hospitalist?.active) {
    const h = programs.hospitalist
    if (h.workforce === 'employed' && h.cdiIntensity === 'light') {
      losModifiers.push(-0.8 * h.effectiveness)
    } else if (h.workforce === 'employed' && h.cdiIntensity === 'aggressive') {
      losModifiers.push(-0.6 * h.effectiveness) // aggressive CDI distracts
    } else if (h.workforce === 'contracted' && h.cdiIntensity === 'light') {
      losModifiers.push(-0.5 * h.effectiveness)
    } else if (h.workforce === 'contracted' && h.cdiIntensity === 'aggressive') {
      losModifiers.push(-0.3 * h.effectiveness) // worst combo
    }
  }

  if (programs.dischargeCoordination?.active) {
    const d = programs.dischargeCoordination
    if (d.model === 'dedicated_planners') {
      losModifiers.push(-0.6)
      if (d.postAcutePartnerships) losModifiers.push(-0.2)
    } else {
      losModifiers.push(-0.3)
    }
  }

  // Add any additional LOS effects (from events, pending)
  for (const fx of additionalEffects) {
    if (fx.losModifier != null) losModifiers.push(fx.losModifier)
  }

  // Use STARTING LOS as the base, not previous quarter's LOS.
  // Program modifiers are absolute reductions from baseline, not compounding deltas.
  const lengthOfStay = composeEffects(
    STARTING_LOS,
    losModifiers,
    DOMAIN_BOUNDS.lengthOfStay
  )

  // Quality score
  const nurseQuality = interpolateNurseQuality(programs.nurseRatio)
  const programQuality = programQualityScore(programs)
  const supplyQuality = SUPPLY_TIER_QUALITY[programs.supplyTier] ?? 60

  let qualityBase =
    QUALITY_WEIGHTS.nurseRatio * nurseQuality +
    QUALITY_WEIGHTS.programs * programQuality +
    QUALITY_WEIGHTS.supplyTier * supplyQuality

  const qualityModifiers: number[] = []
  for (const fx of additionalEffects) {
    if (fx.qualityModifier != null) qualityModifiers.push(fx.qualityModifier)
  }

  const qualityScore = composeEffects(qualityBase, qualityModifiers, DOMAIN_BOUNDS.qualityScore)

  // DRG accuracy
  let drgBase = 1.0
  if (programs.hospitalist?.active) {
    const h = programs.hospitalist
    if (h.documentationTraining) {
      drgBase += 0.08 * h.effectiveness
    }
    if (h.cdiIntensity === 'aggressive') {
      drgBase += 0.05 * h.effectiveness
    } else {
      drgBase += 0.02 * h.effectiveness
    }
  }

  const drgModifiers: number[] = []
  for (const fx of additionalEffects) {
    if (fx.drgAccuracyModifier != null) drgModifiers.push(fx.drgAccuracyModifier)
  }

  const drgAccuracy = composeEffects(drgBase, drgModifiers, DOMAIN_BOUNDS.drgAccuracy)

  // Readmission rate (influenced by quality with delay, but we apply current quality for now)
  const readmissionBase = READMISSION_BASE - qualityScore * READMISSION_SENSITIVITY
  const readmissionModifiers: number[] = []
  for (const fx of additionalEffects) {
    if (fx.readmissionModifier != null) readmissionModifiers.push(fx.readmissionModifier)
  }
  if (programs.dischargeCoordination?.active) {
    readmissionModifiers.push(programs.dischargeCoordination.postAcutePartnerships ? -0.02 : -0.01)
  }
  const readmissionRate = composeEffects(
    readmissionBase,
    readmissionModifiers,
    DOMAIN_BOUNDS.readmissionRate
  )

  // Volume and surgical calculations
  let totalVolume = prev.dischargeRate
  let volumeModifier = 1.0
  for (const fx of additionalEffects) {
    if (fx.volumeModifier != null) volumeModifier += fx.volumeModifier
  }
  // Quality reputation effect
  if (qualityScore > 70) volumeModifier += 0.05
  else if (qualityScore < 40) volumeModifier -= 0.10

  totalVolume = Math.round(totalVolume * volumeModifier)

  // Bed occupancy
  const beds = prev.beds.total + additionalEffects.reduce((sum, fx) => sum + (fx.bedModifier ?? 0), 0)
  const occupancyRate = Math.min(1.0, (totalVolume * lengthOfStay) / (beds * DAYS_IN_QUARTER))

  // Surgical cases: limited by OR capacity and bed availability
  let orCapacity = prev.surgical.orCapacity
  for (const fx of additionalEffects) {
    if (fx.surgicalCapacityModifier) orCapacity += fx.surgicalCapacityModifier
  }
  if (programs.surgicalExpansion?.active) {
    orCapacity += programs.surgicalExpansion.investmentLevel === 'major' ? 50 : 20
  }

  const surgicalDemand = Math.round(totalVolume * SURGICAL_FRACTION)
  let surgicalCompleted = Math.min(surgicalDemand, orCapacity)

  // If beds are too full, cancel elective surgeries
  if (occupancyRate > SURGICAL_CANCEL_THRESHOLD) {
    const cancelRate = (occupancyRate - SURGICAL_CANCEL_THRESHOLD) / (1 - SURGICAL_CANCEL_THRESHOLD)
    const cancelled = Math.round(surgicalCompleted * cancelRate * 0.5) // cancel up to 50% of surgical
    surgicalCompleted -= cancelled
  }

  const surgicalCancelled = surgicalDemand - surgicalCompleted

  return {
    beds: {
      total: beds,
      occupancyRate,
      availableBedDays: beds * DAYS_IN_QUARTER * (1 - occupancyRate),
    },
    lengthOfStay,
    dischargeRate: totalVolume,
    bedTurnover: totalVolume / beds,
    surgical: {
      orCapacity,
      casesCompleted: surgicalCompleted,
      casesCancelled: surgicalCancelled,
    },
    readmissionRate,
    drgAccuracy,
    qualityScore,
  }
}

/** Interpolate nurse quality for non-integer ratios (e.g., 5.5) */
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

/** Get overtime multiplier, interpolating for non-integer ratios */
export function getOvertimeMultiplier(ratio: number): number {
  const clamped = Math.max(4, Math.min(8, ratio))
  const lower = Math.floor(clamped)
  const upper = Math.ceil(clamped)
  if (lower === upper) return OVERTIME_MULTIPLIER[lower] ?? 1.05
  const lowerM = OVERTIME_MULTIPLIER[lower] ?? 1.05
  const upperM = OVERTIME_MULTIPLIER[upper] ?? 1.05
  const t = clamped - lower
  return lowerM + (upperM - lowerM) * t
}
