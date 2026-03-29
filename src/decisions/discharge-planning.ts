import type { DecisionPackage } from '../engine/types'

export const dischargePlanningPackage: DecisionPackage = {
  id: 'discharge-planning',
  name: 'Discharge Planning',
  description: 'Invest in getting patients out of the hospital sooner and safely. Discharge coordination reduces length of stay, frees beds, and lowers readmission rates. But the implementation model matters: dedicated planners vs nurse-led, and whether you partner with post-acute facilities.',
  available: (state) => state.quarter <= 3 && !state.programs.dischargeCoordination?.active,
  strategicChoice: {
    question: 'Should we invest in discharge coordination?',
    options: [
      {
        id: 'invest',
        label: 'Yes, invest in discharge planning',
        description: 'Cost: $100-300K/quarter depending on model. Reduces length of stay and readmissions, freeing beds for higher-revenue cases.',
      },
      {
        id: 'skip',
        label: 'No, not this quarter',
        description: 'Save the investment. Discharges continue at current pace.',
      },
    ],
  },
  implementationChoices: [
    {
      id: 'model',
      question: 'Discharge coordination model?',
      dependsOnStrategic: 'invest',
      options: [
        {
          id: 'dedicated',
          label: 'Dedicated discharge planners',
          description: 'Hire specialized staff ($300K/quarter) whose only job is coordinating discharges. Bigger LOS reduction (-0.6 days), more consistent results.',
        },
        {
          id: 'nurse-led',
          label: 'Nurse-led discharge',
          description: 'Train existing nurses to handle discharge planning ($100K/quarter). Smaller LOS reduction (-0.3 days), but cheaper and builds nursing skills.',
        },
      ],
    },
    {
      id: 'partnerships',
      question: 'Establish post-acute care partnerships?',
      dependsOnStrategic: 'invest',
      options: [
        {
          id: 'partnerships',
          label: 'Yes, partner with SNFs and home health',
          description: 'Negotiate preferred relationships with skilled nursing facilities and home health agencies. Patients transition faster, readmissions drop. Small additional cost.',
        },
        {
          id: 'no-partnerships',
          label: 'No, handle internally',
          description: 'Discharge planning stays within the hospital walls. Slower transitions, but simpler to manage.',
        },
      ],
    },
  ],
  facilitatorNote: 'Key discussion: Length of stay is the master lever. Reducing LOS by even 0.5 days frees dozens of bed-days per quarter. Those freed beds can be filled by high-margin elective surgical cases. The discharge program might cost $300K but enable $500K+ in surgical revenue. Ask: why is this indirect connection so hard to see on a normal P&L?',
}
