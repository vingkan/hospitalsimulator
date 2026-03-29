// useProjection: speculative projection engine.
// Runs simulateYear twice (baseline + projected) and returns structured diffs.
// Debounced via useEffect + setTimeout (100ms). No new dependencies.

import { useState, useEffect } from 'react'
import type { OperationsConsoleState, ProgramState } from '../engine/types'
import { simulateYear, type GameState, type YearResult } from '../engine/orchestrator'
import { NO_EVENT } from '../engine/events'
import type { MedSurgState } from '../engine/modules/medsurg'

// ── Types ────────────────────────────────────────────────────────────

export interface Delta {
  before: number
  after: number
  delta: number
}

export interface CausalStep {
  id: string
  label: string
  before: number
  after: number
  delta: number
  unit: string       // "days", "%", "$M", "pp", "patients"
  direction: 'positive' | 'negative' | 'neutral'
}

export interface DepartmentMargin {
  revenue: number
  expenses: number
  margin: number
}

export interface FeedbackLoop {
  id: string
  label: string
  current: number
  projected: number
  volumeImpact: number
  description: string
}

export interface ProjectionFog {
  level: 0 | 1 | 2  // 0=clear (Y1), 1=bands (Y2-3), 2=greyed (Y4-5)
  conflictSeverity: number  // 0 (no conflict) to ~1.6 (max conflict)
}

export interface ProjectionDiff {
  volume: Delta
  signals: {
    bedPressure: Delta
    qualityScore: Delta
    readmissionRate: Delta
    occupancy: Delta
    lengthOfStay: Delta
  }
  financials: {
    revenue: Delta
    labor: Delta
    supplies: Delta
    overhead: Delta
    programs: Delta
    expensesTotal: Delta
    margin: Delta
  }
  departments: {
    medsurg: DepartmentMargin
    or: DepartmentMargin
    overhead: number
  }
  feedbackLoops: FeedbackLoop[]
  causalChain: CausalStep[]
  fog: ProjectionFog
}

// ── Fog helpers ─────────────────────────────────────────────────────

function computeFogLevel(year: number): 0 | 1 | 2 {
  if (year <= 1) return 0
  if (year <= 3) return 1
  return 2
}

function computeConflictSeverity(consoleState: OperationsConsoleState): number {
  let severity = 0
  // C1: surgical expansion + high nurse ratio
  if (consoleState.surgicalExpansion !== 'none' && consoleState.nurseRatio > 5) {
    severity += Math.min(1.0, (consoleState.nurseRatio - 5) / 3)
  }
  // C2: hospitalist active + low compensation
  if (consoleState.hospitalist.active && consoleState.compensationChange < 5) {
    const compModifier = consoleState.compensationChange >= 0
      ? 0.7 + (consoleState.compensationChange / 5) * 0.3
      : consoleState.compensationChange >= -3
        ? 0.4 + ((consoleState.compensationChange + 3) / 3) * 0.3
        : 0.4
    severity += Math.abs(1.0 - compModifier)
  }
  return severity
}

// ── Console → ProgramState mapping ───────────────────────────────────
// Duplicated from GameContext to avoid circular dependency.

function consoleToProgramState(cs: OperationsConsoleState): ProgramState {
  return {
    nurseRatio: cs.nurseRatio,
    compensationChange: cs.compensationChange,
    supplyTier: cs.supplyTier,
    hospitalist: cs.hospitalist.active
      ? {
          active: true,
          workforce: cs.hospitalist.workforce,
          cdiIntensity: cs.hospitalist.cdiIntensity,
          documentationTraining: cs.hospitalist.documentationTraining,
          effectiveness: 1.0,
        }
      : undefined,
    dischargeCoordination: cs.dischargeCoordination.active
      ? {
          active: true,
          model: cs.dischargeCoordination.model,
          postAcutePartnerships: cs.dischargeCoordination.postAcutePartnerships,
        }
      : undefined,
    surgicalExpansion: cs.surgicalExpansion !== 'none'
      ? { active: true, investmentLevel: cs.surgicalExpansion }
      : undefined,
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

function makeDelta(before: number, after: number): Delta {
  return { before, after, delta: after - before }
}

function extractMedsurgState(result: YearResult): MedSurgState {
  return result.state.moduleStates.medsurg
}

function buildDepartments(result: YearResult): ProjectionDiff['departments'] {
  const fin = result.financials
  const medsurgExpenses =
    result.moduleOutputs.medsurg.financials.expenses.labor +
    result.moduleOutputs.medsurg.financials.expenses.supplies +
    result.moduleOutputs.medsurg.financials.expenses.programs

  const orExpenses =
    result.moduleOutputs.or.financials.expenses.labor +
    result.moduleOutputs.or.financials.expenses.supplies +
    result.moduleOutputs.or.financials.expenses.capital +
    result.moduleOutputs.or.financials.expenses.programs

  return {
    medsurg: {
      revenue: fin.revenue.medical,
      expenses: medsurgExpenses,
      margin: fin.revenue.medical - medsurgExpenses,
    },
    or: {
      revenue: fin.revenue.surgical,
      expenses: orExpenses,
      margin: fin.revenue.surgical - orExpenses,
    },
    overhead: fin.expenses.overhead + fin.expenses.capital,
  }
}

function deltaDirection(delta: number, higherIsBetter: boolean): 'positive' | 'negative' | 'neutral' {
  if (Math.abs(delta) < 0.001) return 'neutral'
  if (higherIsBetter) return delta > 0 ? 'positive' : 'negative'
  return delta < 0 ? 'positive' : 'negative'
}

function buildProjectionDiff(
  baseline: YearResult,
  projected: YearResult,
  currentReadmissions: number,
  fog: ProjectionFog,
): ProjectionDiff {
  const bFin = baseline.financials
  const pFin = projected.financials
  const bMs = extractMedsurgState(baseline)
  const pMs = extractMedsurgState(projected)

  const volume = makeDelta(
    baseline.moduleOutputs.medsurg.patients.count,
    projected.moduleOutputs.medsurg.patients.count,
  )

  const signals = {
    bedPressure: makeDelta(
      baseline.moduleOutputs.medsurg.signals.bedPressure,
      projected.moduleOutputs.medsurg.signals.bedPressure,
    ),
    qualityScore: makeDelta(bMs.qualityScore, pMs.qualityScore),
    readmissionRate: makeDelta(bMs.readmissionRate, pMs.readmissionRate),
    occupancy: makeDelta(bMs.occupancyRate, pMs.occupancyRate),
    lengthOfStay: makeDelta(bMs.lengthOfStay, pMs.lengthOfStay),
  }

  const financials = {
    revenue: makeDelta(bFin.revenue.total, pFin.revenue.total),
    labor: makeDelta(bFin.expenses.labor, pFin.expenses.labor),
    supplies: makeDelta(bFin.expenses.supplies, pFin.expenses.supplies),
    overhead: makeDelta(bFin.expenses.overhead, pFin.expenses.overhead),
    programs: makeDelta(bFin.expenses.programs, pFin.expenses.programs),
    expensesTotal: makeDelta(bFin.expenses.total, pFin.expenses.total),
    margin: makeDelta(bFin.margin, pFin.margin),
  }

  // Feedback loops
  const projectedReadmissions = Math.round(
    projected.moduleOutputs.medsurg.patients.count * pMs.readmissionRate
  )
  const baselineReadmissions = Math.round(
    baseline.moduleOutputs.medsurg.patients.count * bMs.readmissionRate
  )

  const feedbackLoops: FeedbackLoop[] = [
    {
      id: 'readmissions',
      label: 'Readmissions',
      current: currentReadmissions,
      projected: projectedReadmissions,
      volumeImpact: projectedReadmissions - baselineReadmissions,
      description: projectedReadmissions < baselineReadmissions
        ? `${baselineReadmissions - projectedReadmissions} fewer patients return next year`
        : projectedReadmissions > baselineReadmissions
        ? `${projectedReadmissions - baselineReadmissions} more patients return next year`
        : 'No change in returning patients',
    },
    {
      id: 'bed-pressure',
      label: 'Bed Pressure',
      current: baseline.moduleOutputs.medsurg.signals.bedPressure,
      projected: projected.moduleOutputs.medsurg.signals.bedPressure,
      volumeImpact: volume.delta,
      description: projected.moduleOutputs.medsurg.signals.bedPressure > 0
        ? 'High occupancy is diverting patients away'
        : 'No bed pressure — all patients admitted',
    },
    {
      id: 'quality-reputation',
      label: 'Quality Reputation',
      current: bMs.qualityScore,
      projected: pMs.qualityScore,
      volumeImpact: volume.delta,
      description: pMs.qualityScore > bMs.qualityScore
        ? 'Higher quality attracts more patients'
        : pMs.qualityScore < bMs.qualityScore
        ? 'Lower quality reduces patient volume'
        : 'Quality unchanged',
    },
  ]

  // Causal chain: the primary forward path
  const losD = signals.lengthOfStay
  const occD = signals.occupancy
  const bpD = signals.bedPressure
  const volD = volume
  const revD = financials.revenue
  const expD = financials.expensesTotal
  const mD = financials.margin

  const causalChain: CausalStep[] = [
    {
      id: 'los',
      label: 'Length of Stay',
      ...losD,
      unit: 'days',
      direction: deltaDirection(losD.delta, false), // lower is better
    },
    {
      id: 'occupancy',
      label: 'Occupancy',
      before: occD.before * 100,
      after: occD.after * 100,
      delta: occD.delta * 100,
      unit: '%',
      direction: deltaDirection(occD.delta, false), // lower is generally better (less pressure)
    },
    {
      id: 'bed-pressure',
      label: 'Bed Pressure',
      ...bpD,
      unit: '',
      direction: deltaDirection(bpD.delta, false),
    },
    {
      id: 'volume',
      label: 'Volume',
      ...volD,
      unit: 'patients',
      direction: deltaDirection(volD.delta, true),
    },
    {
      id: 'revenue',
      label: 'Revenue',
      before: revD.before / 1_000_000,
      after: revD.after / 1_000_000,
      delta: revD.delta / 1_000_000,
      unit: '$M',
      direction: deltaDirection(revD.delta, true),
    },
    {
      id: 'expenses',
      label: 'Expenses',
      before: expD.before / 1_000_000,
      after: expD.after / 1_000_000,
      delta: expD.delta / 1_000_000,
      unit: '$M',
      direction: deltaDirection(expD.delta, false),
    },
    {
      id: 'margin',
      label: 'Margin',
      before: mD.before * 100,
      after: mD.after * 100,
      delta: mD.delta * 100,
      unit: 'pp',
      direction: deltaDirection(mD.delta, true),
    },
  ]

  return {
    volume,
    signals,
    financials,
    departments: buildDepartments(projected),
    feedbackLoops,
    causalChain,
    fog,
  }
}

// ── Hook ─────────────────────────────────────────────────────────────

export function useProjection(
  gameState: GameState,
  consoleState: OperationsConsoleState,
): ProjectionDiff | null {
  const [diff, setDiff] = useState<ProjectionDiff | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      // Baseline: run with current programs (what would happen if player changes nothing)
      const baselineResult = simulateYear(gameState, gameState.programs, NO_EVENT)

      // Projected: run with console state (what would happen with player's changes)
      const projectedPrograms = consoleToProgramState(consoleState)
      const projectedResult = simulateYear(gameState, projectedPrograms, NO_EVENT)

      const fog = {
        level: computeFogLevel(gameState.year),
        conflictSeverity: computeConflictSeverity(consoleState),
      }

      const projection = buildProjectionDiff(
        baselineResult,
        projectedResult,
        gameState.prevReadmissions,
        fog,
      )
      setDiff(projection)
    }, 100) // 100ms debounce

    return () => clearTimeout(timer)
  }, [gameState, consoleState])

  return diff
}

// ── Results-phase diff builder (no hook, just data) ──────────────────

export function buildResultsDiff(
  currentResult: YearResult,
  previousResult: YearResult | null,
): ProjectionDiff | null {
  if (!previousResult) return null

  const prevMs = previousResult.state.moduleStates.medsurg
  const currMs = extractMedsurgState(currentResult)

  const prevVolume = previousResult.moduleOutputs.medsurg.patients.count
  const currVolume = currentResult.moduleOutputs.medsurg.patients.count

  const volume = makeDelta(prevVolume, currVolume)

  const signals = {
    bedPressure: makeDelta(
      previousResult.moduleOutputs.medsurg.signals.bedPressure,
      currentResult.moduleOutputs.medsurg.signals.bedPressure,
    ),
    qualityScore: makeDelta(prevMs.qualityScore, currMs.qualityScore),
    readmissionRate: makeDelta(prevMs.readmissionRate, currMs.readmissionRate),
    occupancy: makeDelta(prevMs.occupancyRate, currMs.occupancyRate),
    lengthOfStay: makeDelta(prevMs.lengthOfStay, currMs.lengthOfStay),
  }

  const pFin = previousResult.financials
  const cFin = currentResult.financials

  const financials = {
    revenue: makeDelta(pFin.revenue.total, cFin.revenue.total),
    labor: makeDelta(pFin.expenses.labor, cFin.expenses.labor),
    supplies: makeDelta(pFin.expenses.supplies, cFin.expenses.supplies),
    overhead: makeDelta(pFin.expenses.overhead, cFin.expenses.overhead),
    programs: makeDelta(pFin.expenses.programs, cFin.expenses.programs),
    expensesTotal: makeDelta(pFin.expenses.total, cFin.expenses.total),
    margin: makeDelta(pFin.margin, cFin.margin),
  }

  // Feedback loops (actual, not projected)
  const prevReadmissions = Math.round(prevVolume * prevMs.readmissionRate)
  const currReadmissions = Math.round(currVolume * currMs.readmissionRate)

  const feedbackLoops: FeedbackLoop[] = [
    {
      id: 'readmissions',
      label: 'Readmissions',
      current: prevReadmissions,
      projected: currReadmissions,
      volumeImpact: currReadmissions - prevReadmissions,
      description: currReadmissions < prevReadmissions
        ? `${prevReadmissions - currReadmissions} fewer patients will return next year`
        : currReadmissions > prevReadmissions
        ? `${currReadmissions - prevReadmissions} more patients will return next year`
        : 'No change in returning patients',
    },
    {
      id: 'bed-pressure',
      label: 'Bed Pressure',
      current: previousResult.moduleOutputs.medsurg.signals.bedPressure,
      projected: currentResult.moduleOutputs.medsurg.signals.bedPressure,
      volumeImpact: volume.delta,
      description: currentResult.moduleOutputs.medsurg.signals.bedPressure > 0
        ? 'High occupancy diverted patients away'
        : 'No bed pressure — all patients admitted',
    },
    {
      id: 'quality-reputation',
      label: 'Quality Reputation',
      current: prevMs.qualityScore,
      projected: currMs.qualityScore,
      volumeImpact: volume.delta,
      description: currMs.qualityScore > prevMs.qualityScore
        ? 'Higher quality attracted more patients'
        : currMs.qualityScore < prevMs.qualityScore
        ? 'Lower quality reduced patient volume'
        : 'Quality unchanged',
    },
  ]

  // Build causal chain with same structure
  const losD = signals.lengthOfStay
  const occD = signals.occupancy
  const bpD = signals.bedPressure
  const revD = financials.revenue
  const expD = financials.expensesTotal
  const mD = financials.margin

  const causalChain: CausalStep[] = [
    { id: 'los', label: 'Length of Stay', ...losD, unit: 'days', direction: deltaDirection(losD.delta, false) },
    { id: 'occupancy', label: 'Occupancy', before: occD.before * 100, after: occD.after * 100, delta: occD.delta * 100, unit: '%', direction: deltaDirection(occD.delta, false) },
    { id: 'bed-pressure', label: 'Bed Pressure', before: bpD.before, after: bpD.after, delta: bpD.delta, unit: '', direction: deltaDirection(bpD.delta, false) },
    { id: 'volume', label: 'Volume', ...volume, unit: 'patients', direction: deltaDirection(volume.delta, true) },
    { id: 'revenue', label: 'Revenue', before: revD.before / 1e6, after: revD.after / 1e6, delta: revD.delta / 1e6, unit: '$M', direction: deltaDirection(revD.delta, true) },
    { id: 'expenses', label: 'Expenses', before: expD.before / 1e6, after: expD.after / 1e6, delta: expD.delta / 1e6, unit: '$M', direction: deltaDirection(expD.delta, false) },
    { id: 'margin', label: 'Margin', before: mD.before * 100, after: mD.after * 100, delta: mD.delta * 100, unit: 'pp', direction: deltaDirection(mD.delta, true) },
  ]

  return {
    volume,
    signals,
    financials,
    departments: buildDepartments(currentResult),
    feedbackLoops,
    causalChain,
    fog: { level: 0 as const, conflictSeverity: 0 },
  }
}
