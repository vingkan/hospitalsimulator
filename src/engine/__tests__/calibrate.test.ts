import { describe, it, expect } from 'vitest'
import { runCalibration } from '../calibrate'

describe('calibration scenarios', () => {
  const results = runCalibration()

  for (const scenario of results) {
    it(`${scenario.name}: ${scenario.reason}`, () => {
      expect(scenario.pass).toBe(true)
    })
  }
})
