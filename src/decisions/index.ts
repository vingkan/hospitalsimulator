import type { DecisionPackage, HospitalState } from '../engine/types'
import { hospitalistPackage } from './hospitalist'
import { nursingPackage } from './nursing'
import { dischargePlanningPackage } from './discharge-planning'
import { surgicalExpansionPackage } from './surgical-expansion'

export const allPackages: DecisionPackage[] = [
  hospitalistPackage,
  nursingPackage,
  dischargePlanningPackage,
  surgicalExpansionPackage,
]

/** Get decision packages available for the current state */
export function getAvailablePackages(state: HospitalState): DecisionPackage[] {
  return allPackages.filter(pkg => pkg.available(state))
}
