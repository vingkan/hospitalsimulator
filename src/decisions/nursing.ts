import type { DecisionPackage } from '../engine/types'

export const nursingPackage: DecisionPackage = {
  id: 'nursing',
  name: 'Nursing Staffing',
  description: 'Adjust nurse-to-patient ratios and compensation. More nurses means better care and less overtime, but labor is your biggest expense. The relationship between staffing and cost is nonlinear.',
  available: () => true, // Always available: you can always adjust staffing
  strategicChoice: {
    question: 'Adjust nursing staffing levels?',
    options: [
      {
        id: 'adjust',
        label: 'Yes, adjust staffing',
        description: 'Change nurse-to-patient ratio and/or compensation. Labor is ~55% of your costs.',
      },
      {
        id: 'maintain',
        label: 'No changes this quarter',
        description: 'Keep current staffing levels and compensation.',
      },
    ],
  },
  implementationChoices: [
    {
      id: 'ratio',
      question: 'Target nurse-to-patient ratio?',
      dependsOnStrategic: 'adjust',
      options: [
        {
          id: 'ratio-4',
          label: '1:4 (best care)',
          description: 'Excellent care quality, no overtime. But requires the most nurses and highest labor cost.',
        },
        {
          id: 'ratio-5',
          label: '1:5 (standard)',
          description: 'National average. Slight overtime (5% premium). Good balance of quality and cost.',
        },
        {
          id: 'ratio-6',
          label: '1:6 (stretched)',
          description: 'Moderate overtime (15% premium). Quality starts to decline. Nurses feel the strain.',
        },
        {
          id: 'ratio-8',
          label: '1:8 (understaffed)',
          description: 'Major overtime (60% premium). Quality drops sharply. Burnout, turnover risk, patient safety concerns. The cost savings from fewer nurses are eaten by overtime.',
        },
      ],
    },
    {
      id: 'compensation',
      question: 'Adjust compensation?',
      dependsOnStrategic: 'adjust',
      options: [
        {
          id: 'comp-0',
          label: 'No change (0%)',
          description: 'Hold compensation flat. Risk: in a competitive market, nurses may leave for better offers.',
        },
        {
          id: 'comp-3',
          label: 'Modest raise (3%)',
          description: 'Keep pace with inflation. Maintains retention but adds to labor costs.',
        },
        {
          id: 'comp-5',
          label: 'Competitive raise (5%)',
          description: 'Above-market compensation. Better retention and recruitment, but significant cost increase on your largest expense.',
        },
      ],
    },
  ],
  facilitatorNote: 'Key discussion: The overtime curve is nonlinear. Going from 1:6 to 1:8 costs MORE in overtime than going from 1:4 to 1:6. This teaches that cutting nursing staff to save money can backfire: the overtime premium erases the savings while hurting quality. Ask the team: what happens to quality, readmissions, and ultimately revenue when you push nurses too hard?',
}
