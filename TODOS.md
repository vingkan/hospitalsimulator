# TODOs

## Auto-Calibration Harness
**What:** Build `src/engine/autocalibrate.ts` with random search over module calibration constants, evidence-grounded fitness functions (using each module's `getFitnessCriteria()`), 200 iterations or 30 min, TSV logging.
**Why:** Hand-tuning module constants doesn't scale. Auto-calibration systematically finds realistic parameter values.
**Depends on:** v3 module architecture being stable.
**Added:** 2026-03-29, deferred from v3 scope during eng review.

## Population / Insurance Mix Module
**What:** Layer 1 module that enriches PatientCohort with insurance mix (Medicare/Commercial/Medicaid/Self-pay shares), affecting downstream revenue calculations in Finance aggregator.
**Why:** Currently payer mix is a static constant in Finance. Real hospitals see payer mix shift based on market dynamics, Medicaid expansion, aging demographics. One control (e.g. "accept more Medicaid") could affect multiple downstream modules.
**Depends on:** v3 module architecture.
**Added:** 2026-03-29, identified during eng review event discussion.
