// Hospital profile definitions.
// Each profile sets the starting conditions for a game session.
// The engine runs identically across profiles — only constants differ.

import type { HospitalProfile } from './types'

export const SUBURBAN_COMMUNITY: HospitalProfile = {
  id: 'suburban',
  name: 'Riverside General',
  description: '200-bed suburban community hospital. 35% commercial payer mix. The default.',
  beds: 200,
  payerMix: { medicare: 0.45, commercial: 0.35, medicaid: 0.15, selfPay: 0.05 },
  baseAnnualVolume: 8_340,
  startingCash: 72_000_000,
  baseOverhead: 32_000_000,
  headcount: 1_100,
  avgCompPerYear: 76_000,
  dshPayment: 0,
  costBasedMedicare: false,
}

export const URBAN_SAFETY_NET: HospitalProfile = {
  id: 'safety_net',
  name: 'Metro General',
  description: '350-bed urban safety net. 40% Medicaid, surviving on DSH payments.',
  beds: 350,
  payerMix: { medicare: 0.30, commercial: 0.15, medicaid: 0.40, selfPay: 0.15 },
  baseAnnualVolume: 14_000,
  startingCash: 45_000_000,
  baseOverhead: 48_000_000,
  headcount: 1_800,
  avgCompPerYear: 78_000,
  dshPayment: 52_000_000,    // DSH + state supplemental payments — lifeline for safety nets
  costBasedMedicare: false,
}

export const RURAL_CRITICAL_ACCESS: HospitalProfile = {
  id: 'rural',
  name: 'Valley Community',
  description: '50-bed rural critical access. 55% Medicare, cost-based reimbursement.',
  beds: 50,
  payerMix: { medicare: 0.55, commercial: 0.20, medicaid: 0.20, selfPay: 0.05 },
  baseAnnualVolume: 2_100,
  startingCash: 18_000_000,
  baseOverhead: 7_500_000,
  headcount: 175,
  avgCompPerYear: 65_000,
  dshPayment: 0,
  costBasedMedicare: true,
}

export const ALL_PROFILES: HospitalProfile[] = [
  SUBURBAN_COMMUNITY,
  URBAN_SAFETY_NET,
  RURAL_CRITICAL_ACCESS,
]

export const DEFAULT_PROFILE = SUBURBAN_COMMUNITY
