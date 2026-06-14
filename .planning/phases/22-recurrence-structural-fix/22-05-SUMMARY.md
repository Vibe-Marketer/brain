---
phase: 22-recurrence-structural-fix
plan: 05
subsystem: autopilot
tags: [tier2, recurrence, structural-fix, claim-guard, supabase-rpc]

requires:
  - phase: 22-01
    provides: ticket_classes structural task context and rollup RPC
  - phase: 22-04
    provides: structural-fix tier-2 digest builder and manual/admin routing
provides:
  - Tier-2 cadence invokes Brain's rollup_ticket_classes RPC
  - Tier-1 claim selection excludes structural-fix task tickets
  - Structural task collection queues tier2_digest_queued only
affects: [tier2-cadence, recurrence-rollup, claim-selection, structural-fix-digest]

tech-stack:
  added: []
  patterns:
    - Service-role RPC wrapper for Brain-owned recurrence rollups
    - Client-side structural task guard before autonomous tier-1 claim ordering
    - Idempotent tier-2 digest collection for structural task tickets

key-files:
  created:
    - /Users/admin/dev/autopilot/src/tier2.test.ts
  modified:
    - /Users/admin/dev/autopilot/src/tier2.ts
    - /Users/admin/dev/autopilot/src/claimer.test.ts
    - /Users/admin/dev/autopilot/src/lib/claim.ts
    - /Users/admin/dev/autopilot/src/lib/db.ts
    - /Users/admin/dev/autopilot/src/lib/tier2.ts
    - /Users/admin/dev/autopilot/src/lib/tier2.test.ts

key-decisions:
  - "Autopilot calls rollup_ticket_classes from the existing tier-2 cycle and fails soft if the RPC is unavailable."
  - "Structural-fix task tickets are filtered out of tier-1 claim candidates before ordering, preserving normal bug-ticket eligibility."
  - "Structural task collection is idempotent: an existing tier2_digest_queued event prevents duplicate event/message creation."

patterns-established:
  - "Recurrence refresh belongs to the tier-2 cadence, not a new scheduler or tier-1 bug path."
  - "Structural fixes use tier2_digest_queued/admin digest only; tier2_auto_fix_queued is reserved for non-structural tier-2 auto-fix routes."

requirements-completed: [REC-01, REC-02]

duration: 4min
completed: 2026-06-14
---

# Phase 22 Plan 05: Recurrence Cadence Wiring Summary

**Autopilot now refreshes recurring ticket classes during the existing tier-2 cycle and keeps structural fixes out of the autonomous tier-1 bug lane.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-06-14T03:15:47Z
- **Completed:** 2026-06-14T03:19:36Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Added cadence tests proving `rollup_ticket_classes` is invoked once before tier-2 digest collection and fails soft on RPC errors.
- Added a `rollupTicketClasses()` DB wrapper and called it from `runTier2Cycle()` before structural digest collection.
- Filtered `type='task'` tickets carrying structural-fix context out of tier-1 claim selection while preserving ordinary bug claims.
- Added idempotent structural task collection that writes `tier2_digest_queued` and a solution-shaped digest message only when one does not already exist.

## Task Commits

Each task was committed atomically in `/Users/admin/dev/autopilot`:

1. **Task 1: Add Autopilot cadence and claim-exclusion tests** - `53d74b8` (test)
2. **Task 2: Invoke rollup from tier-2 and exclude structural tasks from tier-1 claims** - `38f8bb5` (feat)
3. **Task 3: Queue structural tasks into the tier-2 digest lane only** - `825e114` (test/refinement)

## Files Created/Modified

- `/Users/admin/dev/autopilot/src/tier2.test.ts` - New tier-2 cadence, rollup failure, structural digest collection, and idempotency coverage.
- `/Users/admin/dev/autopilot/src/tier2.ts` - Exported injectable `runTier2Cycle()`, invoked recurrence rollup, and collected structural digest tasks before queue scan.
- `/Users/admin/dev/autopilot/src/lib/db.ts` - Added service-role `rollup_ticket_classes` RPC wrapper with soft-fail logging.
- `/Users/admin/dev/autopilot/src/lib/claim.ts` - Selected ticket `type` and `context`, then excluded structural-fix tasks before tier-1 ordering.
- `/Users/admin/dev/autopilot/src/lib/tier2.ts` - Added idempotent `queueStructuralFixDigests()` collection using the existing structural digest enqueue path.
- `/Users/admin/dev/autopilot/src/claimer.test.ts` - Added regression coverage proving a structural task cannot outrank and claim before an ordinary bug.
- `/Users/admin/dev/autopilot/src/lib/tier2.test.ts` - Added digest enqueue assertions for `tier2_digest_queued` only.

## Verification

- RED gate: `cd /Users/admin/dev/autopilot && npm test -- src/tier2.test.ts src/claimer.test.ts` failed as expected before implementation: `runTier2Cycle` was not exported and structural tasks were still claimable.
- Task 2 gate: `cd /Users/admin/dev/autopilot && npm test -- src/tier2.test.ts src/claimer.test.ts && npm run typecheck` passed after implementation.
- Task 3 / overall gate: `cd /Users/admin/dev/autopilot && npm test -- src/lib/tier2.test.ts src/tier2.test.ts src/claimer.test.ts && npm run typecheck` passed with `32 pass, 0 fail, 97 expect() calls`; `tsc --noEmit` passed.
- `git diff -- package.json package-lock.json`: clean, no package changes.

## Decisions Made

- Kept recurrence refresh on the existing tier-2 executable instead of adding a scheduler, queue, volume knob, or concurrency change.
- Treated rollup failure as deferred/logged: tier-2 continues scanning queued digest work rather than crashing unrelated processing.
- Used the existing structural context parser as the single discriminator for both claim exclusion and digest collection.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- CodeGraph was not initialized in `/Users/admin/dev/autopilot`, so implementation discovery fell back to direct source reads after `codegraph status` reported "Not initialized."
- Existing unrelated Autopilot dirty files remained unstaged: `qa/known-fingerprints.json` and `qa/runs.log`.
- Existing unrelated Brain untracked files remained unstaged, including `.mcp.json`, `.planning/debug/signup-email-confirmation-setup.md`, and prior phase pattern/UI-spec artifacts.

## Known Stubs

None.

## Threat Flags

None beyond the plan threat model. No new endpoints, package dependencies, schema changes, file access paths, queues, launchd jobs, run-cap changes, or concurrency changes were introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 22 has the cross-repo recurrence path wired through the locked ownership boundary: Brain owns the `rollup_ticket_classes` RPC and Autopilot now consumes it from tier-2 cadence. Structural fixes stay visible to tier-2/admin approval and are blocked from tier-1 autonomous claiming.

## Self-Check: PASSED

- Summary file exists at `.planning/phases/22-recurrence-structural-fix/22-05-SUMMARY.md`.
- Autopilot commits found: `53d74b8`, `38f8bb5`, `825e114`.
- Focused tests and typecheck passed after the final commit.
- Package diff check remained clean for `package.json` and `package-lock.json`.

---
*Phase: 22-recurrence-structural-fix*
*Completed: 2026-06-14*
