import type { HospitalState, FinancialEffects } from './types'
import {
  MEDICARE_RATE,
  COMMERCIAL_RATE,
  MEDICAID_RATE,
  SELF_PAY_RATE,
  SURGICAL_RATE,
  PAYER_MIX,
  SUPPLY_COST,
  OVERHEAD_PER_QUARTER,
  MALPRACTICE_BASE,
  READMISSION_PENALTY_THRESHOLD,
  READMISSION_PENALTY_RATE,
  HOSPITALIST_SUBSIDY_PER_QUARTER,
} from './constants'
import { getOvertimeMultiplier } from './operational'

/**
 * Recompute all financial metrics from the current operational state and programs.
 */
export function computeFinancial(
  state: HospitalState,
  additionalEffects: FinancialEffects[] = []
): HospitalState['financial'] {
  const ops = state.operational
  const programs = state.programs
  const prevFinancial = state.financial

  // Collect additional effects
  let medicareRateMod = 0
  let commercialRateMod = 0
  let commercialVolumeMod = 0
  let laborCostMod = 0
  let supplyCostMod = 0
  let overheadMod = 0
  let capitalExpenditure = 0
  let depreciationMod = 0
  let programSubsidyMod = 0

  for (const fx of additionalEffects) {
    if (fx.medicareRateModifier) medicareRateMod += fx.medicareRateModifier
    if (fx.commercialRateModifier) commercialRateMod += fx.commercialRateModifier
    if (fx.commercialVolumeModifier) commercialVolumeMod += fx.commercialVolumeModifier
    if (fx.laborCostModifier) laborCostMod += fx.laborCostModifier
    if (fx.supplyCostModifier) supplyCostMod += fx.supplyCostModifier
    if (fx.overheadModifier) overheadMod += fx.overheadModifier
    if (fx.capitalExpenditure) capitalExpenditure += fx.capitalExpenditure
    if (fx.depreciationModifier) depreciationMod += fx.depreciationModifier
    if (fx.programSubsidy) programSubsidyMod += fx.programSubsidy
  }

  // Revenue: medical cases by payer
  const totalMedicalCases = ops.dischargeRate - ops.surgical.casesCompleted
  const medicareCases = Math.round(totalMedicalCases * PAYER_MIX.medicare)
  const commercialShare = PAYER_MIX.commercial * (1 + commercialVolumeMod)
  const commercialCases = Math.round(totalMedicalCases * commercialShare)
  const medicaidCases = Math.round(totalMedicalCases * PAYER_MIX.medicaid)
  const selfPayCases = Math.max(0, totalMedicalCases - medicareCases - commercialCases - medicaidCases)

  // Medicare rate: base * DRG accuracy * rate modifier, minus readmission penalty
  let medicareEffectiveRate = MEDICARE_RATE * ops.drgAccuracy * (1 + medicareRateMod)
  if (ops.readmissionRate > READMISSION_PENALTY_THRESHOLD) {
    medicareEffectiveRate *= (1 - READMISSION_PENALTY_RATE)
  }

  const commercialEffectiveRate = COMMERCIAL_RATE * (1 + commercialRateMod)

  const medicalRevenue =
    medicareCases * medicareEffectiveRate +
    commercialCases * commercialEffectiveRate +
    medicaidCases * MEDICAID_RATE +
    selfPayCases * SELF_PAY_RATE

  const surgicalRevenue = ops.surgical.casesCompleted * SURGICAL_RATE
  const totalRevenue = medicalRevenue + surgicalRevenue

  // Expenses: labor
  const overtimeMultiplier = getOvertimeMultiplier(programs.nurseRatio)
  const compMultiplier = 1 + programs.compensationChange / 100
  const baseLaborCost = prevFinancial.expenses.labor.headcount *
    prevFinancial.expenses.labor.avgCompPerQuarter * compMultiplier
  const laborCost = baseLaborCost * overtimeMultiplier + laborCostMod
  const overtimeCost = laborCost - baseLaborCost

  // Expenses: supplies
  const supplyCostPerCase = SUPPLY_COST[programs.supplyTier] ?? SUPPLY_COST.standard
  const supplyCost = ops.dischargeRate * supplyCostPerCase * (1 + supplyCostMod)

  // Expenses: overhead (includes malpractice)
  const malpracticeCost = MALPRACTICE_BASE * (100 - ops.qualityScore) / 50
  const overheadCost = OVERHEAD_PER_QUARTER + malpracticeCost + overheadMod

  // Expenses: capital
  const depreciationBase = prevFinancial.expenses.capital.depreciationBase + depreciationMod
  const capitalCost = depreciationBase

  // Expenses: program subsidies
  let programSubsidies = programSubsidyMod
  if (programs.hospitalist?.active) {
    programSubsidies += HOSPITALIST_SUBSIDY_PER_QUARTER
  }
  if (programs.dischargeCoordination?.active) {
    const dischargeCost = programs.dischargeCoordination.model === 'dedicated_planners'
      ? 300_000 : 100_000
    programSubsidies += dischargeCost
  }

  const totalExpenses = laborCost + supplyCost + overheadCost + capitalCost + programSubsidies

  // Margin and cash
  const margin = totalRevenue > 0 ? (totalRevenue - totalExpenses) / totalRevenue : -1
  const cashReserves = prevFinancial.cashReserves + (totalRevenue - totalExpenses) - capitalExpenditure

  return {
    cashReserves,
    revenue: {
      medical: medicalRevenue,
      surgical: surgicalRevenue,
      total: totalRevenue,
    },
    expenses: {
      labor: {
        amount: laborCost,
        headcount: prevFinancial.expenses.labor.headcount,
        avgCompPerQuarter: prevFinancial.expenses.labor.avgCompPerQuarter * compMultiplier,
        overtimeCost,
      },
      supplies: {
        amount: supplyCost,
        costPerCase: supplyCostPerCase,
      },
      overhead: {
        amount: overheadCost,
      },
      capital: {
        amount: capitalCost,
        depreciationBase,
      },
      programSubsidies,
      total: totalExpenses,
    },
    margin,
    payers: {
      medicare: {
        share: PAYER_MIX.medicare,
        baseRate: MEDICARE_RATE,
        effectiveRate: medicareEffectiveRate,
        cases: medicareCases,
      },
      commercial: {
        share: PAYER_MIX.commercial,
        baseRate: COMMERCIAL_RATE,
        effectiveRate: commercialEffectiveRate,
        cases: commercialCases,
      },
      medicaid: {
        share: PAYER_MIX.medicaid,
        baseRate: MEDICAID_RATE,
        effectiveRate: MEDICAID_RATE,
        cases: medicaidCases,
      },
      selfPay: {
        share: PAYER_MIX.selfPay,
        baseRate: SELF_PAY_RATE,
        effectiveRate: SELF_PAY_RATE,
        cases: selfPayCases,
      },
    },
  }
}
