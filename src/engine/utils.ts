// Shared utilities for the hospital simulator engine.
// Extracted from operational.ts for use by individual modules.

export interface DomainConfig {
  min: number
  max: number
  diminishing: boolean
}

// Domain bounds for effect composition
export const DOMAIN_BOUNDS: Record<string, DomainConfig> = {
  lengthOfStay:    { min: 3.5, max: 8.0, diminishing: true },
  qualityScore:    { min: 20,  max: 100, diminishing: true },
  drgAccuracy:     { min: 0.85, max: 1.15, diminishing: true },
  readmissionRate: { min: 0.08, max: 0.30, diminishing: true },
  occupancyRate:   { min: 0,   max: 1.0, diminishing: false },
  nurseRatio:      { min: 4,   max: 8,   diminishing: false },
}

// Diminishing returns decay: modifier[i] applied at DECAY[i] rate
export const DIMINISHING_DECAY = [1.0, 0.7, 0.5, 0.4]

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

// Overtime multiplier based on nurse-to-patient ratio
export const OVERTIME_MULTIPLIER: Record<number, number> = {
  4: 1.00,
  5: 1.05,
  6: 1.15,
  7: 1.35,
  8: 1.60,
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
