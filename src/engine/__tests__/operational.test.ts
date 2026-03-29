import { describe, it, expect } from 'vitest'
import { composeEffects, getOvertimeMultiplier } from '../operational'
import { DOMAIN_BOUNDS } from '../constants'

describe('composeEffects', () => {
  it('returns base value when no modifiers', () => {
    const result = composeEffects(5.2, [], DOMAIN_BOUNDS.lengthOfStay)
    expect(result).toBe(5.2)
  })

  it('applies single modifier at 100%', () => {
    const result = composeEffects(5.2, [-0.8], DOMAIN_BOUNDS.lengthOfStay)
    expect(result).toBeCloseTo(4.4, 1)
  })

  it('applies diminishing returns for stacked modifiers', () => {
    // First at 100%, second at 70%
    const result = composeEffects(5.2, [-0.8, -0.6], DOMAIN_BOUNDS.lengthOfStay)
    // -0.8 * 1.0 + -0.6 * 0.7 = -0.8 + -0.42 = -1.22
    expect(result).toBeCloseTo(5.2 - 1.22, 1)
  })

  it('sorts by magnitude: largest effect gets full weight regardless of order', () => {
    const result1 = composeEffects(5.2, [-0.8, -0.6], DOMAIN_BOUNDS.lengthOfStay)
    const result2 = composeEffects(5.2, [-0.6, -0.8], DOMAIN_BOUNDS.lengthOfStay)
    expect(result1).toBeCloseTo(result2, 5)
  })

  it('clamps to minimum bound', () => {
    const result = composeEffects(3.0, [-2.0], DOMAIN_BOUNDS.lengthOfStay)
    expect(result).toBe(3.5) // min is 3.5
  })

  it('clamps to maximum bound', () => {
    const result = composeEffects(7.5, [1.5], DOMAIN_BOUNDS.lengthOfStay)
    expect(result).toBe(8.0) // max is 8.0
  })

  it('opposing effects cancel naturally', () => {
    const result = composeEffects(65, [10, -5], DOMAIN_BOUNDS.qualityScore)
    // 10 * 1.0 + -5 * 0.7 = 10 - 3.5 = 6.5
    expect(result).toBeCloseTo(71.5, 1)
  })

  it('applies no diminishing returns when config says so', () => {
    const noDiminishing = { min: 0, max: 1, diminishing: false }
    const result = composeEffects(0.5, [0.1, 0.1], noDiminishing)
    expect(result).toBeCloseTo(0.7, 5) // straight sum
  })
})

describe('getOvertimeMultiplier', () => {
  it('returns 1.0 for ratio 4 (best staffing)', () => {
    expect(getOvertimeMultiplier(4)).toBe(1.0)
  })

  it('returns 1.05 for ratio 5', () => {
    expect(getOvertimeMultiplier(5)).toBe(1.05)
  })

  it('returns 1.60 for ratio 8 (worst staffing)', () => {
    expect(getOvertimeMultiplier(8)).toBe(1.60)
  })

  it('interpolates for non-integer ratios', () => {
    const result = getOvertimeMultiplier(5.5)
    // Between 1.05 (ratio 5) and 1.15 (ratio 6) = 1.10
    expect(result).toBeCloseTo(1.10, 2)
  })

  it('clamps below 4', () => {
    expect(getOvertimeMultiplier(3)).toBe(1.0)
  })

  it('clamps above 8', () => {
    expect(getOvertimeMultiplier(9)).toBe(1.60)
  })
})
