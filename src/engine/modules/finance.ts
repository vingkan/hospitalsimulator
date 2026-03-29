// Finance aggregator: combines module financials into hospital-wide P&L.
// NOT a HospitalModule - plain function for the orchestrator to call after all module ticks.
// All computations are ANNUAL (game tick = 1 year).

import type { ModuleFinancials, ModuleSignals, EventEffect, FitnessCriterion } from './types'
import type { AdmissionPosture, CommercialNegotiation } from '../types'

// ── Types ────────────────────────────────────────────────────────────

export interface HospitalFinancials {
  revenue: { medical: number; surgical: number; total: number }
  expenses: { labor: number; supplies: number; overhead: number; capital: number; programs: number; total: number }
  margin: number
  cashReserves: number
  cmsAdjustment: number          // negative = penalty, positive = bonus
  observationRevenue: number
}

// ── Constants ────────────────────────────────────────────────────────

const MEDICARE_BASE_RATE = 15_000
const COMMERCIAL_BASE_RATE = 22_000
const MEDICAID_RATE = 8_000
const SELF_PAY_RATE = 3_000

const BASE_OVERHEAD_PER_YEAR = 32_000_000         // Suburban default (calibrated with balanced obs status)
const BASE_MALPRACTICE_PER_YEAR = 1_000_000       // scales with quality
const CAPITAL_DEPRECIATION_PER_YEAR = 8_000_000    // ~5% of expenses

// ── Helpers ──────────────────────────────────────────────────────────

function relevantEvents(events: EventEffect[]): EventEffect[] {
  return events.filter(e => e.moduleId === 'finance' || e.moduleId === '*')
}

// ── Main function ────────────────────────────────────────────────────

export function aggregateFinance(
  moduleFinancials: ModuleFinancials[],
  signals: ModuleSignals,
  events: EventEffect[],
  prevCash: number,
  drgAccuracy: number,
  patientVolume: number,
  payerMix: { medicare: number; commercial: number; medicaid: number; selfPay: number } = { medicare: 0.45, commercial: 0.35, medicaid: 0.15, selfPay: 0.05 },
  programs: { maParticipation?: boolean; commercialNegotiation?: CommercialNegotiation; admissionPosture?: AdmissionPosture; hospitalistCDI?: string; hospitalistDocTraining?: boolean } = {},
  profile: { dshPayment: number; costBasedMedicare: boolean; baseOverhead?: number } = { dshPayment: 0, costBasedMedicare: false },
): HospitalFinancials {
  const finEvents = relevantEvents(events)

  // ── Sum module revenues (surgical revenue comes from OR module) ──
  let surgicalRevenue = 0
  for (const mf of moduleFinancials) {
    surgicalRevenue += mf.revenue
  }

  // ── Medical revenue (payer mix on non-surgical patients) ─────────
  const surgicalCases = surgicalRevenue > 0 ? Math.round(surgicalRevenue / 22_000) : 0
  const medicalCases = Math.max(0, patientVolume - surgicalCases)

  // ── Observation status split ────────────────────────────────────
  const posture = programs.admissionPosture ?? 'balanced'
  const observationFractionMap: Record<AdmissionPosture, number> = {
    conservative: 0.20,
    balanced: 0.10,
    aggressive: 0.03,
  }
  const observationFraction = observationFractionMap[posture]
  const observationCases = Math.round(medicalCases * observationFraction)
  const inpatientMedicalCases = medicalCases - observationCases

  // ── Payer mix breakdown on inpatient medical cases ──────────────
  let ffsMedicareShare = payerMix.medicare
  let maCases = 0
  let maRate = MEDICARE_BASE_RATE * 0.88

  if (programs.maParticipation) {
    const maShare = payerMix.medicare * 0.15
    ffsMedicareShare = payerMix.medicare - maShare
    maCases = Math.round(inpatientMedicalCases * maShare)
  }

  const ffsMedicareCases = Math.round(inpatientMedicalCases * ffsMedicareShare)
  const commercialCases = Math.round(inpatientMedicalCases * payerMix.commercial)
  const medicaidCases = Math.round(inpatientMedicalCases * payerMix.medicaid)
  const selfPayCases = Math.max(0, inpatientMedicalCases - ffsMedicareCases - maCases - commercialCases - medicaidCases)

  // Event rate modifiers
  let rateModifier = 0
  for (const ev of finEvents) {
    if (ev.rateModifier != null) rateModifier += ev.rateModifier
  }

  // ── Medicare rate with DRG accuracy ─────────────────────────────
  const medicareRate = MEDICARE_BASE_RATE * drgAccuracy * (1 + rateModifier)

  // ── Commercial negotiation rate ─────────────────────────────────
  const negotiation = programs.commercialNegotiation ?? 'none'
  let commercialRate = COMMERCIAL_BASE_RATE * (1 + rateModifier)
  if (negotiation === 'standard' && signals.qualityScore > 60) {
    commercialRate = COMMERCIAL_BASE_RATE * 1.075 * (1 + rateModifier)
  } else if (negotiation === 'aggressive' && signals.qualityScore > 75) {
    commercialRate = COMMERCIAL_BASE_RATE * 1.20 * (1 + rateModifier)
  }

  // ── Cost-based Medicare override ────────────────────────────────
  // For cost-based reimbursement, we need module labor + supplies to compute cost
  let moduleLaborTotal = 0
  let moduleSupplyTotal = 0
  let moduleCapitalTotal = 0
  let moduleProgramsTotal = 0

  for (const mf of moduleFinancials) {
    moduleLaborTotal += mf.expenses.labor
    moduleSupplyTotal += mf.expenses.supplies
    moduleCapitalTotal += mf.expenses.capital
    moduleProgramsTotal += mf.expenses.programs
  }

  // ── Medicare revenue calculation ────────────────────────────────
  let ffsMedicareRevenue: number
  let maMedicareRevenue: number

  if (profile.costBasedMedicare) {
    // Cost-based: Medicare revenue = Medicare share of (labor + supplies) * 1.01
    const totalCosts = moduleLaborTotal + moduleSupplyTotal
    const totalMedicareShare = ffsMedicareShare + (programs.maParticipation ? payerMix.medicare * 0.15 : 0)
    ffsMedicareRevenue = totalCosts * ffsMedicareShare * 1.01
    maMedicareRevenue = programs.maParticipation ? totalCosts * (payerMix.medicare * 0.15) * 1.01 : 0
    // Ignore DRG accuracy and rate modifiers for cost-based
    // But still use the case counts for CMS penalty calculations below
    void totalMedicareShare // used indirectly
  } else {
    ffsMedicareRevenue = ffsMedicareCases * medicareRate
    maMedicareRevenue = maCases * maRate * drgAccuracy * (1 + rateModifier)
  }

  const totalMedicareRevenue = ffsMedicareRevenue + maMedicareRevenue

  // ── Observation revenue ─────────────────────────────────────────
  // Observation cases generate revenue at 50% of the weighted inpatient rate
  const weightedInpatientRate =
    inpatientMedicalCases > 0
      ? (ffsMedicareCases * medicareRate + maCases * maRate + commercialCases * commercialRate + medicaidCases * MEDICAID_RATE + selfPayCases * SELF_PAY_RATE) / inpatientMedicalCases
      : medicareRate // fallback
  const observationRevenue = observationCases * weightedInpatientRate * 0.65

  // ── Audit clawback ──────────────────────────────────────────────
  // Base audit rate of 5% applies to aggressive posture; scaled down for balanced/conservative
  // (spec: "clawback only matters for aggressive posture, but still compute it")
  const postureAuditScale: Record<AdmissionPosture, number> = {
    conservative: 0.1,  // negligible
    balanced: 0.2,      // negligible
    aggressive: 1.0,    // full audit exposure
  }
  let auditRate = 0.05 * postureAuditScale[posture]
  if (programs.hospitalistCDI === 'aggressive') {
    auditRate *= 0.4
  }
  if (programs.hospitalistDocTraining) {
    auditRate *= 0.7
  }
  const auditClawback = inpatientMedicalCases * auditRate * 8_000

  // ── Base medical revenue (non-Medicare) ─────────────────────────
  const nonMedicareRevenue =
    commercialCases * commercialRate +
    medicaidCases * MEDICAID_RATE +
    selfPayCases * SELF_PAY_RATE

  const baseMedicalRevenue = totalMedicareRevenue + nonMedicareRevenue + observationRevenue - auditClawback

  // ── CMS penalties/bonuses ───────────────────────────────────────
  let cmsAdjustment = 0

  // HRRP: Hospital Readmissions Reduction Program
  if (signals.readmissionRate > 0.15) {
    const hrrpPenaltyRate = Math.min(0.03, (signals.readmissionRate - 0.15) * 0.8)
    cmsAdjustment -= totalMedicareRevenue * hrrpPenaltyRate
  }

  // VBP: Value-Based Purchasing
  if (signals.qualityScore < 50) {
    const vbpPenaltyRate = (50 - signals.qualityScore) / 50 * 0.02
    cmsAdjustment -= totalMedicareRevenue * vbpPenaltyRate
  } else if (signals.qualityScore > 70) {
    const vbpBonusRate = (signals.qualityScore - 70) / 30 * 0.02
    cmsAdjustment += totalMedicareRevenue * vbpBonusRate
  }

  // HAC: Hospital-Acquired Conditions
  if (signals.qualityScore < 40) {
    cmsAdjustment -= ffsMedicareRevenue * 0.01
  }

  // Include CMS adjustment in medical revenue (penalties are Medicare-based)
  const medicalRevenue = baseMedicalRevenue + cmsAdjustment
  const totalRevenue = medicalRevenue + surgicalRevenue + profile.dshPayment

  // ── Hospital-wide overhead ───────────────────────────────────────
  let overhead = profile.baseOverhead ?? BASE_OVERHEAD_PER_YEAR
  const malpractice = BASE_MALPRACTICE_PER_YEAR * (100 - signals.qualityScore) / 50
  overhead += malpractice

  // Apply event overhead/cost modifiers
  for (const ev of finEvents) {
    if (ev.costModifier != null) {
      overhead *= (1 + ev.costModifier)
    }
  }

  // Add commercial negotiation costs to overhead
  if (negotiation === 'standard') {
    overhead += 1_000_000
  } else if (negotiation === 'aggressive') {
    overhead += 2_500_000
  }

  // ── Capital depreciation (scales with hospital size via overhead ratio) ──
  const overheadRatio = (profile.baseOverhead ?? BASE_OVERHEAD_PER_YEAR) / BASE_OVERHEAD_PER_YEAR
  const capitalTotal = Math.round(CAPITAL_DEPRECIATION_PER_YEAR * overheadRatio) + moduleCapitalTotal

  // ── Totals ───────────────────────────────────────────────────────
  const totalExpenses = moduleLaborTotal + moduleSupplyTotal + overhead + capitalTotal + moduleProgramsTotal
  const margin = totalRevenue > 0 ? (totalRevenue - totalExpenses) / totalRevenue : -1
  const cashReserves = prevCash + (totalRevenue - totalExpenses)

  return {
    revenue: {
      medical: medicalRevenue,
      surgical: surgicalRevenue,
      total: totalRevenue,
    },
    expenses: {
      labor: moduleLaborTotal,
      supplies: moduleSupplyTotal,
      overhead,
      capital: capitalTotal,
      programs: moduleProgramsTotal,
      total: totalExpenses,
    },
    margin,
    cashReserves,
    cmsAdjustment,
    observationRevenue,
  }
}

// ── Fitness criteria (standalone) ────────────────────────────────────

export function getFitnessCriteria(): FitnessCriterion[] {
  return [
    {
      metric: 'margin',
      min: 0.01,
      max: 0.04,
      source: 'AHA 2023: median hospital operating margin',
      severity: 'fail',
    },
    {
      metric: 'laborPctOfExpenses',
      min: 0.50,
      max: 0.60,
      source: 'HFMA: labor as percentage of total hospital expenses',
      severity: 'warning',
    },
    {
      metric: 'supplyPctOfExpenses',
      min: 0.15,
      max: 0.20,
      source: 'HFMA: supplies as percentage of total hospital expenses',
      severity: 'warning',
    },
    {
      metric: 'overheadPctOfExpenses',
      min: 0.20,
      max: 0.25,
      source: 'HFMA: overhead as percentage of total hospital expenses',
      severity: 'warning',
    },
  ]
}
