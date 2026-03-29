import type { DecisionPackage } from '../engine/types'

export const hospitalistPackage: DecisionPackage = {
  id: 'hospitalist',
  name: 'Hospitalist Program',
  description: 'Establish a team of hospital-based physicians who manage inpatient care. Hospitalists coordinate care, improve documentation, and discharge patients faster, but their direct revenue rarely covers their salary.',
  available: (state) => state.quarter <= 2 && !state.programs.hospitalist?.active,
  strategicChoice: {
    question: 'Should we establish a hospitalist program?',
    options: [
      {
        id: 'establish',
        label: 'Yes, establish the program',
        description: 'Cost: ~$500K/quarter subsidy. Hospitalists rarely pay for themselves through direct revenue. The value is indirect: shorter stays, better documentation, freed beds for surgical cases.',
      },
      {
        id: 'skip',
        label: 'No, not this quarter',
        description: 'Save the $500K/quarter. Continue with the current attending physician model.',
      },
    ],
  },
  implementationChoices: [
    {
      id: 'workforce',
      question: 'Workforce model: employed or contracted?',
      dependsOnStrategic: 'establish',
      options: [
        {
          id: 'employed',
          label: 'Employed hospitalists',
          description: 'Higher cost, but you control quality, culture, and documentation practices. Hospitalists feel like part of your team.',
        },
        {
          id: 'contracted',
          label: 'Contracted workforce',
          description: 'Cheaper, but managed by an external company. Less control over documentation quality and engagement. They may not invest in your hospital\'s goals.',
        },
      ],
    },
    {
      id: 'cdi',
      question: 'CDI integration intensity?',
      dependsOnStrategic: 'establish',
      options: [
        {
          id: 'light-cdi',
          label: 'Light touch (2-3 queries/week)',
          description: 'CDI team sends a few targeted queries. Hospitalists stay focused on patient care. Moderate DRG improvement.',
        },
        {
          id: 'aggressive-cdi',
          label: 'Aggressive (8+ queries/week)',
          description: 'CDI floods hospitalists with queries for maximum DRG capture. Better revenue per case, but hospitalists complain of distraction from clinical work.',
        },
      ],
    },
    {
      id: 'training',
      question: 'Invest in documentation training?',
      dependsOnStrategic: 'establish',
      options: [
        {
          id: 'invest-training',
          label: 'Yes, invest $200K in training',
          description: 'Upfront investment teaches hospitalists to document accurately from the start. Better DRG capture without relying solely on CDI queries.',
        },
        {
          id: 'skip-training',
          label: 'No, rely on CDI team',
          description: 'Save the $200K. The CDI team will catch documentation gaps after the fact. Slower improvement, but cheaper.',
        },
      ],
    },
  ],
  facilitatorNote: 'Key discussion: The hospitalist program "loses money" on paper. But does the indirect revenue from freed beds and better DRG capture outweigh the subsidy? Watch the P&L next quarter to find out. Also ask: what happens when you combine contracted workforce with aggressive CDI?',
}
