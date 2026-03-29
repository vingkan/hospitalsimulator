// Finance aggregator: combines module financials into hospital-wide P&L.
// NOT a HospitalModule - plain function for the orchestrator to call after all module ticks.
// All computations are ANNUAL (game tick = 1 year).

import type { ModuleFinancials, ModuleSignals, EventEffect, FitnessCriterion } from './types'

// ── Types ────────────────────────────────────────────────────────────

export interface HospitalFinancials {
  revenue: { medical: number; surgical: number; total: number }
  expenses: { labor: number; supplies: number; overhead: number; capital: number; programs: number; total: number }
  margin: number
  cashReserves: number
}

// ── Constants ────────────────────────────────────────────────────────

const PAYER_MIX = {
  medicare: 0.45,
  commercial: 0.35,
  medicaid: 0.15,
  // selfPay = remainder
}

const MEDICARE_BASE_RATE = 15_000
const COMMERCIAL_BASE_RATE = 22_000
const MEDICAID_RATE = 8_000
const SELF_PAY_RATE = 3_000

const READMISSION_PENALTY_THRESHOLD = 0.15
const READMISSION_PENALTY_FACTOR = 0.02

const BASE_OVERHEAD_PER_YEAR = 35_000_000         // IT, admin, compliance, facilities (~21% of expenses)
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
): HospitalFinancials {
  const finEvents = relevantEvents(events)

  // ── Sum module revenues (surgical revenue comes from OR module) ──
  let surgicalRevenue = 0
  for (const mf of moduleFinancials) {
    surgicalRevenue += mf.revenue
  }

  // ── Medical revenue (payer mix on non-surgical patients) ─────────
  // OR module already counted surgical patients in its revenue.
  // Medical cases = total volume minus those that generated surgical revenue.
  // Surgical cases = surgicalRevenue / SURGICAL_RATE (reverse from OR output)
  const surgicalCases = surgicalRevenue > 0 ? Math.round(surgicalRevenue / 22_000) : 0
  const medicalCases = Math.max(0, patientVolume - surgicalCases)

  const medicareCases = Math.round(medicalCases * PAYER_MIX.medicare)
  const commercialCases = Math.round(medicalCases * PAYER_MIX.commercial)
  const medicaidCases = Math.round(medicalCases * PAYER_MIX.medicaid)
  const selfPayCases = Math.max(0, medicalCases - medicareCases - commercialCases - medicaidCases)

  // Event rate modifiers
  let rateModifier = 0
  for (const ev of finEvents) {
    if (ev.rateModifier != null) rateModifier += ev.rateModifier
  }

  // Medicare rate with DRG accuracy and readmission penalty
  let medicareRate = MEDICARE_BASE_RATE * drgAccuracy * (1 + rateModifier)
  if (signals.readmissionRate > READMISSION_PENALTY_THRESHOLD) {
    medicareRate *= (1 - READMISSION_PENALTY_FACTOR)
  }

  const commercialRate = COMMERCIAL_BASE_RATE * (1 + rateModifier)

  const medicalRevenue =
    medicareCases * medicareRate +
    commercialCases * commercialRate +
    medicaidCases * MEDICAID_RATE +
    selfPayCases * SELF_PAY_RATE

  const totalRevenue = medicalRevenue + surgicalRevenue

  // ── Expenses from modules ────────────────────────────────────────
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

  // ── Hospital-wide overhead ───────────────────────────────────────
  let overhead = BASE_OVERHEAD_PER_YEAR
  const malpractice = BASE_MALPRACTICE_PER_YEAR * (100 - signals.qualityScore) / 50
  overhead += malpractice

  // Apply event overhead/cost modifiers
  for (const ev of finEvents) {
    if (ev.costModifier != null) {
      overhead *= (1 + ev.costModifier)
    }
  }

  // ── Capital depreciation ─────────────────────────────────────────
  const capitalTotal = CAPITAL_DEPRECIATION_PER_YEAR + moduleCapitalTotal

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
