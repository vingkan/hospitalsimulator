import type { DecisionPackage } from '../engine/types'

export const surgicalExpansionPackage: DecisionPackage = {
  id: 'surgical-expansion',
  name: 'Surgical Expansion',
  description: 'Add operating room capacity to handle more high-margin surgical cases. Surgical cases average $22K revenue each, making them the most profitable category. But expansion requires capital investment that creates long-term depreciation costs.',
  available: (state) => state.quarter >= 2 && !state.programs.surgicalExpansion?.active,
  strategicChoice: {
    question: 'Should we expand surgical capacity?',
    options: [
      {
        id: 'expand',
        label: 'Yes, expand OR capacity',
        description: 'Capital investment to add ORs and equipment. Enables more high-margin surgical cases, but only if you have beds for post-op recovery.',
      },
      {
        id: 'skip',
        label: 'No, not this quarter',
        description: 'Save the capital. Current OR capacity stays the same.',
      },
    ],
  },
  implementationChoices: [
    {
      id: 'investment-level',
      question: 'Investment level?',
      dependsOnStrategic: 'expand',
      options: [
        {
          id: 'minor',
          label: 'Minor expansion ($1M)',
          description: 'Add 1 OR suite. +20 surgical cases/quarter capacity. $100K/quarter ongoing depreciation. Lower risk.',
        },
        {
          id: 'major',
          label: 'Major expansion ($4M)',
          description: 'Add 3 OR suites. +50 surgical cases/quarter capacity. $400K/quarter ongoing depreciation. High capital risk but biggest revenue potential.',
        },
      ],
    },
  ],
  facilitatorNote: 'Key discussion: Surgical expansion only pays off if you have beds available for post-op patients. If your hospital is at 90%+ occupancy, new ORs sit idle because there are no beds for surgical patients to recover in. This is why LOS reduction (hospitalist program, discharge planning) often needs to come BEFORE surgical expansion. Ask: did you sequence your investments in the right order?',
}
