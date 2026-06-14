---
phase: 22-recurrence-structural-fix
plan: 04
subsystem: autopilot
tags: [tier2, structural-fix, approval, recurrence, trust-ladder]

requires:
  - phase: 22-01
    provides: ticket_classes structural task context and recurrence class fields
provides:
  - Structural-fix tier-2 digest builder
  - Structural-fix route override to digest/manual only
  - Approval guard blocking structural tasks from trust-ladder auto approvals
affects: [22-05, tier2-cadence, approval-ladder, recurrence-structural-fix]

tech-stack:
  added: []
  patterns:
    - Untrusted structural-fix context normalization before operator-facing digest text
    - Structural-fix manual/admin override before auto trust routing

key-files:
  created: []
  modified:
    - /Users/admin/dev/autopilot/src/lib/tier2.ts
    - /Users/admin/dev/autopilot/src/lib/approval.ts
    - /Users/admin/dev/autopilot/src/lib/tier2.test.ts
    - /Users/admin/dev/autopilot/src/lib/approval.test.ts

key-decisions:
  - "Structural-fix context is normalized from either context.structural_fix or the existing top-level ticket_class_key/class_root shape so Plan 04 works with the current Plan 01 migration output."
  - "Structural fixes force tier2_digest_queued/manual routing before category trust can select auto_fix or autopilot_auto approval."

patterns-established:
  - "Structural-fix tickets are identified by structural context, not by source/category trust alone."
  - "Structural operator digests remain one-sentence, solution-shaped, and carry exactly one recommended option."

requirements-completed: [REC-02]

duration: 3min
completed: 2026-06-14
---

# Phase 22 Plan 04: Structural Tier-2 Routing Summary

**Recurring-class structural fixes now render class-root tier-2 digests and are blocked from autonomous auto-push even when category trust is auto.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-06-14T03:10:14Z
- **Completed:** 2026-06-14T03:13:01Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added RED coverage for structural digest shape, manual tier-2 routing, and trust-ladder auto-approval refusal.
- Added `buildStructuralFixDigest()` plus structural context normalization with safe fallbacks for malformed DB context.
- Forced structural escalation routing to `{ action: "digest", requiresPushGate: false, reason: "structural_fix_requires_admin_approval" }`.
- Added an approval guard so tickets carrying structural-fix context cannot become `autopilot_auto` merge candidates.

## Task Commits

Each task was committed atomically in `/Users/admin/dev/autopilot`:

1. **Task 1: Add structural digest tests and manual-route assertions** - `616ae24` (test)
2. **Task 2: Implement structural-fix tier-2 digest and auto-approval override** - `6594a22` (feat)

## Files Created/Modified

- `/Users/admin/dev/autopilot/src/lib/tier2.ts` - Structural context parser, digest builder, route override, and structural digest enqueue path.
- `/Users/admin/dev/autopilot/src/lib/approval.ts` - Structural task guard before trust-ladder auto approval.
- `/Users/admin/dev/autopilot/src/lib/tier2.test.ts` - Structural digest validation and manual route assertions.
- `/Users/admin/dev/autopilot/src/lib/approval.test.ts` - Regression coverage proving structural tasks do not become auto approval candidates.

## Verification

- `cd /Users/admin/dev/autopilot && npm test -- src/lib/tier2.test.ts src/lib/approval.test.ts` during RED: failed for the intended missing helper and missing approval guard.
- `cd /Users/admin/dev/autopilot && npm test -- src/lib/tier2.test.ts src/lib/approval.test.ts && npm run typecheck`: passed after implementation.
- Final rerun: `33 pass, 0 fail, 115 expect() calls`; `tsc --noEmit` passed.
- `git diff -- package.json package-lock.json`: clean, no package changes.
- Post-commit deletion check across the two Autopilot commits: no deleted tracked files.

## Decisions Made

- Supported both nested `context.structural_fix` and the current top-level `ticket_class_key`/`class_root` structural task context from Plan 01. This keeps the Autopilot consumer compatible with the live migration contract while honoring the locked structural-fix invariant.
- Kept the route override in `tier2.ts` and reused the same structural discriminator in `approval.ts`, so digest routing and approval routing fail closed on the same signal.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The RED test showed the intended failures: missing `buildStructuralFixDigest()` export and structural tasks still receiving an `autopilot_auto` approval candidate.
- Existing unrelated Autopilot dirty files remained unstaged: `qa/known-fingerprints.json` and `qa/runs.log`.
- Existing unrelated Brain untracked files remained unstaged, including `.mcp.json` and prior planning/debug artifacts.

## Known Stubs

None.

## Threat Flags

None beyond the plan threat model. No new network endpoints, schema, file access, package dependencies, or queue surfaces were introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 05 can wire the tier-2 cadence/claim filtering to pass structural context into this digest route. The core Plan 04 invariant is in place: structural fixes cannot emit `tier2_auto_fix_queued` through `routeTier2Escalation()` when structural context is present, and they cannot enter the approval ladder as `autopilot_auto`.

## Self-Check: PASSED

- Summary file exists at `.planning/phases/22-recurrence-structural-fix/22-04-SUMMARY.md`.
- Autopilot commits found: `616ae24`, `6594a22`.
- Focused tests and typecheck passed after the final commit.

---
*Phase: 22-recurrence-structural-fix*
*Completed: 2026-06-14*
