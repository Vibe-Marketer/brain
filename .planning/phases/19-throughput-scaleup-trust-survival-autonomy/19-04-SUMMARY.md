---
phase: 19-throughput-scaleup-trust-survival-autonomy
plan: 04
subsystem: daemon
tags: [autopilot, trust-ladder, approvals, survival, canary, bun]

requires:
  - phase: 19-01
    provides: runner_runs survival/canary schema and trust tables
  - phase: 19-03
    provides: conservative throughput and rate-limit defer behavior
provides:
  - Autopilot trust ladder helper with fail-closed decisions
  - Trust-gated approval candidates for admin and ladder auto approvals
  - Successful-merge survival/canary runner_runs writer
  - Claimer approval pass using trust-aware candidates before new claims
affects: [phase-19, autopilot, approval-merge, runner-runs, trust-rollups]

tech-stack:
  added: []
  patterns: [DbLike structural mocks, injected claimer approval pass, persisted trust state gate]

key-files:
  created:
    - /Users/admin/dev/autopilot/src/lib/trust.ts
    - /Users/admin/dev/autopilot/src/lib/trust.test.ts
  modified:
    - /Users/admin/dev/autopilot/src/lib/approval.ts
    - /Users/admin/dev/autopilot/src/lib/approval.test.ts
    - /Users/admin/dev/autopilot/src/claimer.ts
    - /Users/admin/dev/autopilot/src/claimer.test.ts
    - src/types/supabase.ts

key-decisions:
  - "Auto approval requires stored rung=auto plus persisted survival gate; manual and eligible never auto-approve."
  - "Auto approval writes autopilot_trust_events.auto_approval_used and never forges ticket_events approval rows."
  - "Post-merge survival/canary scheduling runs only after merge/push succeeds."
  - "Claimer approval processing remains before budget/quiet-hour suppression; suppression still controls only new claims."

patterns-established:
  - "Trust decisions refresh the persisted rollup first, then read autopilot_category_trust as source of truth."
  - "Successful merges stamp runner_runs.fix_category, merged_at, survival_due_at, survival_status, canary_status, and canary_next_run_at."
  - "processApprovalPass is injectable for tests while production defaults use findApprovals/executeApproval."

requirements-completed: [TRU-01, TRU-02, TRU-03, ACT-02]

duration: 10min
completed: 2026-06-13
---

# Phase 19 Plan 04 Summary

**Autopilot approval merges are now gated by durable category trust state and feed survival/canary scheduling after successful merges.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-06-13T21:37:54Z
- **Completed:** 2026-06-13T21:47:46Z
- **Tasks:** 3 completed
- **Files modified:** 7

## Accomplishments

- Added `src/lib/trust.ts` with fail-closed trust decisions, rollup refresh, persisted trust reads, and durable auto-demotion/audit writes.
- Extended approval discovery to include trust-approved `autopilot_auto` candidates while preserving admin approval/rejection behavior.
- Added post-merge runner ledger writes for survival and canary due scheduling.
- Wired the claimer to process trust-aware approvals before budget/quiet-hour new-claim suppression.

## Task Commits

1. **Task 1: Add trust ladder helper and fail-closed tests** - `9e99430` (`feat(19)`)
2. **Task 2: Gate approval candidates through trust ladder** - `9988fef` (`feat(19)`)
3. **Task 3: Wire trust-aware approvals into the one-cycle claimer** - `a3a170d` (`feat(19)`)

## Files Created/Modified

- `/Users/admin/dev/autopilot/src/lib/trust.ts` - Trust ladder decisions, rollup refresh, durable demotion.
- `/Users/admin/dev/autopilot/src/lib/trust.test.ts` - Manual/eligible/auto, DB failure, stale rollup, demotion, and rate-limit-defer tests.
- `/Users/admin/dev/autopilot/src/lib/approval.ts` - Trust candidates, auto approval audit event, successful merge survival/canary writer.
- `/Users/admin/dev/autopilot/src/lib/approval.test.ts` - Admin/manual/eligible/auto approval and survival/canary writer coverage.
- `/Users/admin/dev/autopilot/src/claimer.ts` - Injectable trust-aware approval pass before new claims.
- `/Users/admin/dev/autopilot/src/claimer.test.ts` - Approval pass, dry-run, and approval-before-budget tests.
- `src/types/supabase.ts` - Regenerated from linked Supabase project; live trust types were already present, generation added `graphql_public`.

## Verification

- `cd /Users/admin/dev/autopilot && bun test src/lib/trust.test.ts` - PASS, 9 tests.
- `cd /Users/admin/dev/autopilot && bun test src/lib/approval.test.ts src/lib/trust.test.ts` - PASS, 31 tests.
- `cd /Users/admin/dev/autopilot && bun test src/claimer.test.ts src/lib/approval.test.ts src/lib/trust.test.ts` - PASS, 39 tests.
- `cd /Users/admin/dev/autopilot && bun run typecheck` - PASS, `tsc --noEmit`.
- `cd /Users/admin/dev/brain && supabase db push` - PASS, remote database up to date.
- `supabase gen types typescript --linked > src/types/supabase.ts` - PASS.
- `rg` in generated types confirmed `autopilot_category_trust`, `autopilot_trust_events`, `fix_category`, `survival_due_at`, `canary_next_run_at`, and `rollup_autopilot_category_trust`.

## Deviations from Plan

None - plan executed within the requested scope. One verification fallback was used: `supabase db dump --linked --schema public` could not run because Docker is not running, so live schema confirmation used linked type generation plus generated type inspection.

## Issues Encountered

- Bun runtime tests passed with `resolves`/`toMatchObject`, but the local Bun expect type definitions do not expose those matchers. Tests were converted to explicit awaited assertions so `bun run typecheck` passes.
- Existing dirty files were left untouched: `/Users/admin/dev/autopilot/qa/known-fingerprints.json`, `/Users/admin/dev/autopilot/qa/runs.log`, `.mcp.json`, and `.planning/debug/*`.

## User Setup Required

None.

## Next Phase Readiness

Plan 05 can build on trust-aware approval merges. The live volume cap was not raised, concurrency remains 1, and auto approval still goes through the same deterministic merge/push path.

---
*Phase: 19-throughput-scaleup-trust-survival-autonomy*
*Completed: 2026-06-13*
