import type { HospitalState, QuarterResult } from './types'

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
 * Build narrative highlights by comparing previous and current state.
 * Returns operational highlights, financial highlights, and a flowing narrative.
 */
export function buildNarrative(
  prev: HospitalState,
  current: HospitalState,
  eventTitle: string
): Pick<QuarterResult, 'narrative' | 'operationalHighlights' | 'financialHighlights'> {
  const opHighlights: string[] = []
  const finHighlights: string[] = []
  const narrative: string[] = []

  // LOS change
  const losDelta = current.operational.lengthOfStay - prev.operational.lengthOfStay
  if (Math.abs(losDelta) > 0.1) {
    const direction = losDelta < 0 ? 'decreased' : 'increased'
    opHighlights.push(
      `Average length of stay ${direction} from ${prev.operational.lengthOfStay.toFixed(1)} to ${current.operational.lengthOfStay.toFixed(1)} days`
    )

    if (losDelta < 0) {
      const freedBedDays = Math.round(Math.abs(losDelta) * current.operational.dischargeRate)
      const freedBeds = Math.round(freedBedDays / 91)
      opHighlights.push(`This freed approximately ${freedBeds} beds per quarter`)
    }
  }

  // Surgical cases
  const surgDelta = current.operational.surgical.casesCompleted - prev.operational.surgical.casesCompleted
  if (Math.abs(surgDelta) > 5) {
    const direction = surgDelta > 0 ? 'increased' : 'decreased'
    opHighlights.push(
      `Surgical cases ${direction} from ${prev.operational.surgical.casesCompleted} to ${current.operational.surgical.casesCompleted}`
    )
  }
  if (current.operational.surgical.casesCancelled > 0) {
    opHighlights.push(
      `${current.operational.surgical.casesCancelled} elective surgical cases were cancelled due to bed capacity`
    )
  }

  // Quality
  const qualityDelta = current.operational.qualityScore - prev.operational.qualityScore
  if (Math.abs(qualityDelta) > 2) {
    const direction = qualityDelta > 0 ? 'improved' : 'declined'
    opHighlights.push(
      `Quality score ${direction} from ${prev.operational.qualityScore.toFixed(0)} to ${current.operational.qualityScore.toFixed(0)}`
    )
  }

  // Readmission rate
  const readmitDelta = current.operational.readmissionRate - prev.operational.readmissionRate
  if (Math.abs(readmitDelta) > 0.005) {
    const direction = readmitDelta > 0 ? 'rose' : 'fell'
    opHighlights.push(
      `Readmission rate ${direction} from ${formatPercent(prev.operational.readmissionRate)} to ${formatPercent(current.operational.readmissionRate)}`
    )
  }

  // Occupancy
  const occDelta = current.operational.beds.occupancyRate - prev.operational.beds.occupancyRate
  if (Math.abs(occDelta) > 0.03) {
    opHighlights.push(
      `Bed occupancy moved from ${formatPercent(prev.operational.beds.occupancyRate)} to ${formatPercent(current.operational.beds.occupancyRate)}`
    )
  }

  // Revenue change
  const revDelta = current.financial.revenue.total - prev.financial.revenue.total
  if (Math.abs(revDelta) > 100_000) {
    const direction = revDelta > 0 ? 'increased' : 'decreased'
    finHighlights.push(`Total revenue ${direction} by ${formatMoney(Math.abs(revDelta))} to ${formatMoney(current.financial.revenue.total)}`)
  }

  // Expense change
  const expDelta = current.financial.expenses.total - prev.financial.expenses.total
  if (Math.abs(expDelta) > 100_000) {
    const direction = expDelta > 0 ? 'increased' : 'decreased'
    finHighlights.push(`Total expenses ${direction} by ${formatMoney(Math.abs(expDelta))} to ${formatMoney(current.financial.expenses.total)}`)
  }

  // Margin
  const marginDelta = current.financial.margin - prev.financial.margin
  finHighlights.push(`Operating margin: ${formatPercent(current.financial.margin)} (${marginDelta >= 0 ? '+' : ''}${formatPercent(marginDelta)})`)

  // Cash
  finHighlights.push(`Cash reserves: ${formatMoney(current.financial.cashReserves)}`)

  // Program subsidies
  if (current.financial.expenses.programSubsidies > 0) {
    finHighlights.push(`Program costs: ${formatMoney(current.financial.expenses.programSubsidies)}/quarter`)
  }

  // Build flowing narrative
  if (opHighlights.length > 0 || finHighlights.length > 0) {
    // Connect operational changes to financial outcomes
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

    if (current.financial.expenses.programSubsidies > prev.financial.expenses.programSubsidies) {
      const subsidyIncrease = current.financial.expenses.programSubsidies - prev.financial.expenses.programSubsidies
      narrative.push(
        `New program investments cost ${formatMoney(subsidyIncrease)}/quarter in direct subsidies.`
      )
    }

    if (current.operational.surgical.casesCancelled > 0) {
      const lostRevenue = current.operational.surgical.casesCancelled * 22_000
      narrative.push(
        `Full beds forced ${current.operational.surgical.casesCancelled} surgical cancellations, costing ${formatMoney(lostRevenue)} in lost high-margin revenue.`
      )
    }

    // Event narrative
    if (eventTitle) {
      narrative.push(`External event this quarter: ${eventTitle}.`)
    }

    // Cash warning
    if (current.financial.cashReserves < 3_000_000) {
      narrative.push(`Warning: Cash reserves are critically low at ${formatMoney(current.financial.cashReserves)}.`)
    }
  }

  return { narrative, operationalHighlights: opHighlights, financialHighlights: finHighlights }
}
