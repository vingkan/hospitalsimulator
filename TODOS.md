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

## Third Lever Coupling (C3)
**What:** Design a coupling where two individually GOOD choices conflict. The original C3 (discharge coordination x budget supplies) was dropped because budget supplies are already bad — it's not a dilemma where two good choices conflict. Candidates: discharge coordination x nurse ratio (fast discharge pulls nurses from bedside care when understaffed), or a pairing from Phase 2 big bets.
**Why:** Two couplings (C1: surgical expansion x nurse ratio, C2: hospitalist x compensation) shipped first. A strong third coupling adds more room-splitting debates in facilitated sessions.
**Depends on:** Playtesting C1+C2 to confirm coupling model creates genuine disagreements. Design requires /office-hours session.
**Added:** 2026-03-29, dropped from lever coupling plan during eng review (outside voice identified C3 wasn't a real coupling).
