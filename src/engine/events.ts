import type { ExternalEvent } from './types'
import type { EventEffect } from './modules/types'

export const ALL_EVENTS: ExternalEvent[] = [
  {
    id: 'medicare-rate-cut',
    title: 'Medicare Rate Cut',
    description: 'CMS announces a 3% reduction in DRG payments effective this quarter.',
    operationalEffects: {},
    financialEffects: { medicareRateModifier: -0.03 },
    duration: 1,
    teaches: "You can't control your biggest payer's rates.",
  },
  {
    id: 'flu-season',
    title: 'Severe Flu Season',
    description: 'Patient volume surges 20% as flu season overwhelms the region.',
    operationalEffects: { volumeModifier: 0.20 },
    financialEffects: { supplyCostModifier: 0.15 },
    duration: 1,
    teaches: "Volume isn't free money. More patients means more costs, more overtime, more strain.",
  },
  {
    id: 'nursing-shortage',
    title: 'Regional Nursing Shortage',
    description: 'A regional shortage forces hospitals to rely on expensive agency nurses.',
    operationalEffects: {},
    financialEffects: { laborCostModifier: 600_000 }, // ~20% premium for agency nurses
    duration: 1,
    teaches: 'Labor market dynamics can spike your biggest cost overnight.',
  },
  {
    id: 'commercial-payer-exit',
    title: 'Commercial Payer Exits Market',
    description: 'Your largest commercial payer merges and drops your hospital from their network.',
    operationalEffects: {},
    financialEffects: { commercialVolumeModifier: -0.25 },
    duration: 2,
    teaches: 'Payer concentration risk: losing one contract can reshape your revenue.',
  },
  {
    id: 'supply-chain-disruption',
    title: 'Supply Chain Disruption',
    description: 'Global supply shortage drives surgical supply costs up 30%.',
    operationalEffects: {},
    financialEffects: { supplyCostModifier: 0.30 },
    duration: 1,
    teaches: 'External cost shocks hit thin margins hard.',
  },
  {
    id: 'competitor-asc',
    title: 'New Competitor Opens',
    description: 'A new outpatient surgery center opens 5 miles away, targeting high-margin elective procedures.',
    operationalEffects: { surgicalCapacityModifier: 0, volumeModifier: -0.10 },
    financialEffects: {},
    duration: 2,
    teaches: 'Competition targets your most profitable cases first.',
  },
  {
    id: 'regulatory-mandate',
    title: 'Nurse Ratio Mandate',
    description: 'New state regulation requires minimum nurse-to-patient ratio of 1:5.',
    operationalEffects: {},
    financialEffects: { laborCostModifier: 400_000 }, // cost of compliance hiring
    duration: 1,
    teaches: 'Regulatory compliance costs are non-negotiable.',
  },
  {
    id: 'value-based-bonus',
    title: 'Value-Based Care Bonus',
    description: 'Medicare announces quality bonus payments for hospitals with readmission rates below 12%.',
    operationalEffects: {},
    financialEffects: { medicareRateModifier: 0.02 },
    duration: 1,
    teaches: 'Quality and revenue are directly linked through value-based programs.',
  },
]

/** Shuffle events using Fisher-Yates. Returns a new array. */
export function shuffleEvents(events: ExternalEvent[] = ALL_EVENTS): ExternalEvent[] {
  const deck = [...events]
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

/** Draw the next event from the deck for the given index (0-indexed). */
export function drawEvent(deck: ExternalEvent[], index: number): ExternalEvent {
  return deck[index % deck.length]
}

/**
 * Adapter: convert an old-format ExternalEvent to module-targeted EventEffect[].
 * Routes effects to appropriate modules based on what they affect.
 * Annual scaling: multiply quarterly dollar amounts by 4.
 */
export function eventToModuleEffects(event: ExternalEvent): EventEffect[] {
  const effects: EventEffect[] = []
  const op = event.operationalEffects || {}
  const fin = event.financialEffects || {}

  // Volume modifiers target Sources
  if (op.volumeModifier != null) {
    effects.push({ moduleId: 'sources', volumeModifier: op.volumeModifier })
  }

  // Quality modifiers target Med/Surg
  if (op.qualityModifier != null) {
    effects.push({ moduleId: 'medsurg', qualityModifier: op.qualityModifier })
  }

  // Labor cost modifiers target Med/Surg (annual = quarterly × 4)
  if (fin.laborCostModifier != null) {
    effects.push({ moduleId: 'medsurg', laborCostDelta: fin.laborCostModifier * 4 })
  }

  // Supply cost modifiers target all modules
  if (fin.supplyCostModifier != null) {
    effects.push({ moduleId: '*', supplyCostModifier: fin.supplyCostModifier })
  }

  // Medicare/commercial rate modifiers target Finance
  if (fin.medicareRateModifier != null) {
    effects.push({ moduleId: 'finance', rateModifier: fin.medicareRateModifier })
  }
  if (fin.commercialRateModifier != null) {
    effects.push({ moduleId: 'finance', rateModifier: fin.commercialRateModifier })
  }

  // Commercial volume modifiers target Sources (proxy: fewer patients overall)
  if (fin.commercialVolumeModifier != null) {
    effects.push({ moduleId: 'sources', volumeModifier: fin.commercialVolumeModifier })
  }

  // Overhead modifiers target Finance
  if (fin.overheadModifier != null) {
    effects.push({ moduleId: 'finance', costModifier: fin.overheadModifier / 32_000_000 })
  }

  // If no effects were generated, return a wildcard no-op so the event is still "present"
  if (effects.length === 0) {
    effects.push({ moduleId: '*' })
  }

  return effects
}
