import type { HospitalFinancials } from './modules/finance'
import type { ModuleOutputs } from './modules/types'

export interface NarrativeResult {
  narrative: string[]
  operationalHighlights: string[]
  financialHighlights: string[]
}

interface NarrativeSnapshot {
  financials: HospitalFinancials
  medsurg: ModuleOutputs
  or: ModuleOutputs
}

/** Format a dollar amount for display */
function formatMoney(amount: number): string {
  const abs = Math.abs(amount)
  if (abs >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`
  return `$${amount.toFixed(0)}`
}

/** Format a percentage for display */
function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

/**
 * Build narrative highlights by comparing previous and current year outputs.
 * Returns operational highlights, financial highlights, and a flowing narrative.
 */
export function buildNarrative(
  prev: NarrativeSnapshot | null,
  current: NarrativeSnapshot,
  eventTitle: string,
): NarrativeResult {
  const opHighlights: string[] = []
  const finHighlights: string[] = []
  const narrative: string[] = []

  if (prev) {
    // LOS change
    const losDelta = current.medsurg.patients.avgLOS - prev.medsurg.patients.avgLOS
    if (Math.abs(losDelta) > 0.1) {
      const direction = losDelta < 0 ? 'decreased' : 'increased'
      opHighlights.push(
        `Average length of stay ${direction} from ${prev.medsurg.patients.avgLOS.toFixed(1)} to ${current.medsurg.patients.avgLOS.toFixed(1)} days`
      )
    }

    // Surgical cases
    const surgDelta = current.or.patients.count - prev.or.patients.count
    if (Math.abs(surgDelta) > 5) {
      const direction = surgDelta > 0 ? 'increased' : 'decreased'
      opHighlights.push(
        `Surgical cases ${direction} from ${prev.or.patients.count} to ${current.or.patients.count}`
      )
    }

    // Quality
    const qualityDelta = current.medsurg.signals.qualityScore - prev.medsurg.signals.qualityScore
    if (Math.abs(qualityDelta) > 2) {
      const direction = qualityDelta > 0 ? 'improved' : 'declined'
      opHighlights.push(
        `Quality score ${direction} from ${prev.medsurg.signals.qualityScore.toFixed(0)} to ${current.medsurg.signals.qualityScore.toFixed(0)}`
      )
    }

    // Readmission rate
    const readmitDelta = current.medsurg.signals.readmissionRate - prev.medsurg.signals.readmissionRate
    if (Math.abs(readmitDelta) > 0.005) {
      const direction = readmitDelta > 0 ? 'rose' : 'fell'
      opHighlights.push(
        `Readmission rate ${direction} from ${formatPercent(prev.medsurg.signals.readmissionRate)} to ${formatPercent(current.medsurg.signals.readmissionRate)}`
      )
    }

    // Bed pressure
    const pressureDelta = current.medsurg.signals.bedPressure - prev.medsurg.signals.bedPressure
    if (Math.abs(pressureDelta) > 0.05) {
      const direction = pressureDelta > 0 ? 'increased' : 'eased'
      opHighlights.push(
        `Bed pressure ${direction} to ${formatPercent(current.medsurg.signals.bedPressure)}`
      )
    }

    // Revenue change
    const revDelta = current.financials.revenue.total - prev.financials.revenue.total
    if (Math.abs(revDelta) > 500_000) {
      const direction = revDelta > 0 ? 'increased' : 'decreased'
      finHighlights.push(`Total revenue ${direction} by ${formatMoney(Math.abs(revDelta))} to ${formatMoney(current.financials.revenue.total)}`)
    }

    // Expense change
    const expDelta = current.financials.expenses.total - prev.financials.expenses.total
    if (Math.abs(expDelta) > 500_000) {
      const direction = expDelta > 0 ? 'increased' : 'decreased'
      finHighlights.push(`Total expenses ${direction} by ${formatMoney(Math.abs(expDelta))} to ${formatMoney(current.financials.expenses.total)}`)
    }

    // Flowing narrative connections
    if (losDelta < -0.2 && surgDelta > 0) {
      narrative.push(
        `Reduced length of stay freed beds, allowing ${Math.abs(surgDelta)} more surgical cases at ${formatMoney(22_000)} average revenue each, adding ${formatMoney(Math.abs(surgDelta) * 22_000)} in high-margin surgical revenue.`
      )
    }

    if (losDelta < -0.2 && surgDelta <= 0) {
      narrative.push(
        `Length of stay decreased by ${Math.abs(losDelta).toFixed(1)} days, but the freed capacity hasn't yet translated to additional surgical cases.`
      )
    }

    const programsDelta = current.financials.expenses.programs - prev.financials.expenses.programs
    if (programsDelta > 100_000) {
      narrative.push(
        `New program investments cost ${formatMoney(programsDelta)}/year in direct subsidies.`
      )
    }
  }

  // Margin
  finHighlights.push(`Operating margin: ${formatPercent(current.financials.margin)}${prev ? ` (${current.financials.margin - prev.financials.margin >= 0 ? '+' : ''}${formatPercent(current.financials.margin - prev.financials.margin)})` : ''}`)

  // Cash
  finHighlights.push(`Cash reserves: ${formatMoney(current.financials.cashReserves)}`)

  // Programs
  if (current.financials.expenses.programs > 0) {
    finHighlights.push(`Program costs: ${formatMoney(current.financials.expenses.programs)}/year`)
  }

  // Event narrative
  if (eventTitle) {
    narrative.push(`External event this year: ${eventTitle}.`)
  }

  // Cash warning
  if (current.financials.cashReserves < 10_000_000) {
    narrative.push(`Warning: Cash reserves are critically low at ${formatMoney(current.financials.cashReserves)}.`)
  }

  return { narrative, operationalHighlights: opHighlights, financialHighlights: finHighlights }
}
