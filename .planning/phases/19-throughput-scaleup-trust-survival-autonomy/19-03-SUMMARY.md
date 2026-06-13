---
phase: 19-throughput-scaleup-trust-survival-autonomy
plan: 03
subsystem: autopilot-throughput
tags: [autopilot, throughput, rate-limit, trust-metrics, bun]

requires:
  - phase: 19
    plan: 01
    provides: trust schema and rate-limit exclusion fields
provides:
  - conservative throughput cap/cadence guardrails
  - quiet-hours and run-cap tests with concurrency locked at 1
  - first-class rate-limit claim defer helper
  - runner branch for transcript-driven rate-limit defers
affects: [autopilot-daemon, claimer, runner, ticket-events, runner-runs]

tech-stack:
  added: []
  patterns:
    - Bun unit tests against mocked Supabase-like DB builders
    - status-guarded claim release
    - runner_runs ledger outcome for retryable defer

key-files:
  created:
    - /Users/admin/dev/autopilot/src/claimer.test.ts
    - /Users/admin/dev/autopilot/src/runner.test.ts
  modified:
    - /Users/admin/dev/autopilot/autopilot.config.ts
    - /Users/admin/dev/autopilot/src/claimer.ts
    - /Users/admin/dev/autopilot/src/lib/claim.ts
    - /Users/admin/dev/autopilot/src/lib/claim.test.ts
    - /Users/admin/dev/autopilot/src/runner.ts

key-decisions:
  - "Phase 19 ships tunable throughput guardrails with conservative defaults; live volume remains unchanged and concurrency remains literal 1."
  - "Rate-limit defers restore the claim-time attempts increment and use distinct rate_limit_defer event accounting instead of failed-fix accounting."
  - "Runner rate-limit transcripts finish as requeued/deferred:rate-limit with skipped rate_limit gate metadata, preserving existing finally cleanup."

requirements-completed: [ACT-02, TRU-01]

duration: 27m
completed: 2026-06-13T21:35:23Z
---

# Phase 19 Plan 03: Throughput Controls + Rate-Limit Defer Summary

**Conservative Autopilot throughput controls and rate-limit defer handling without raising live volume or concurrency.**

## Performance

- **Duration:** 27m
- **Completed:** 2026-06-13T21:35:23Z
- **Tasks:** 3/3
- **Files modified:** 7

## Accomplishments

- Added conservative Phase 19 config comments and tests proving `concurrency` remains `1`, quiet hours suppress new claims, and the rolling run cap suppresses claims.
- Added `evaluateClaimSuppression()` so the claimer budget decision is testable without changing the one-cycle launchd behavior.
- Added `releaseClaimForRateLimit()` with a guarded `status = in_progress` update that restores claim-time `attempts`, applies jittered backoff, and writes a distinct `rate_limit_defer` ticket event.
- Added runner handling for transcript-detected rate limits in both the normal transcript branch and the catch path.
- Added a rate-limit runner ledger helper and tests proving `status = requeued`, `outcome = deferred:rate-limit`, `gate_verdict = skipped`, and `gate_stage = rate_limit`.

## Task Commits

1. **Task 1: Conservative throughput cap/cadence tests** - `b1ad80a` (`test(19): cover conservative throughput suppressors`)
2. **Task 2: Rate-limit defer helper** - `c9b7184` (`feat(19): defer rate-limit claims without failed attempts`)
3. **Task 3: Runner rate-limit route** - `72f7f6c` (`feat(19): route runner rate limits to defer`)
4. **Plan-level auto-fix:** `048879b` (`fix(19): use supported claimer test matcher`)

## Verification

- `cd /Users/admin/dev/autopilot && bun test src/claimer.test.ts` - passed: 4 tests.
- `cd /Users/admin/dev/autopilot && grep -R "concurrency: 1" autopilot.config.ts` - passed.
- `cd /Users/admin/dev/autopilot && test "$(grep -R "concurrency: [2-9]" autopilot.config.ts src | wc -l | tr -d ' ')" = "0"` - passed.
- `cd /Users/admin/dev/autopilot && bun test src/lib/claim.test.ts` - passed: 17 tests.
- `cd /Users/admin/dev/autopilot && grep -R "rate_limit_defer" src/lib/claim.ts src/lib/claim.test.ts` - passed.
- `cd /Users/admin/dev/autopilot && grep -R "rate_limit_defer_count\\|attempts" src/lib/claim.ts src/lib/claim.test.ts` - passed.
- `cd /Users/admin/dev/autopilot && bun test src/runner.test.ts src/lib/claim.test.ts src/lib/evidence.test.ts` - passed: 37 tests.
- `cd /Users/admin/dev/autopilot && grep -R "deferred:rate-limit\\|gate_stage.*rate_limit\\|rate_limit_suspected" src/runner.ts src/runner.test.ts` - passed.
- `cd /Users/admin/dev/autopilot && bun test src/claimer.test.ts src/lib/claim.test.ts src/runner.test.ts src/lib/evidence.test.ts` - passed: 41 tests.
- `cd /Users/admin/dev/autopilot && bun run typecheck` - passed.

## Decisions Made

- Kept `maxRunsPerWindow.maxRuns` at the existing conservative value of `4`; Phase 19 only ships the mechanism.
- Used `ticket_events.event_type = rate_limit_defer` as separate defer accounting rather than adding another tickets column in this autopilot-only plan.
- Catch-path rate-limit handling returns `deferred:rate-limit` after writing a requeued runner ledger row instead of throwing a failed runner result.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Bun matcher type blocked plan-level typecheck**
- **Found during:** Plan-level verification after Task 3.
- **Issue:** `toBeGreaterThanOrEqual` works conceptually but is not present in this repo's Bun matcher typings.
- **Fix:** Replaced it with a boolean assertion in `src/claimer.test.ts`.
- **Files modified:** `/Users/admin/dev/autopilot/src/claimer.test.ts`
- **Verification:** `bun run typecheck` passed.
- **Committed in:** `048879b`

## Issues Encountered

- `src/claimer.test.ts` and `src/runner.test.ts` did not exist before this plan; both were created with focused coverage.
- Existing dirty files were left untouched: `/Users/admin/dev/autopilot/qa/known-fingerprints.json`, `/Users/admin/dev/autopilot/qa/runs.log`, `/Users/admin/dev/brain/.mcp.json`, `/Users/admin/dev/brain/.planning/debug/signup-email-confirmation-setup.md`, and pre-existing untracked planning files.

## Known Stubs

None.

## Threat Flags

None - the changed surfaces are covered by the plan threat model: throughput suppression, rate-limit defer classification, service-role ticket release, and runner ledger accounting.

## User Setup Required

None.

## Next Phase Readiness

Plan 19-04 can rely on `deferred:rate-limit` runner outcomes and `rate_limit_defer` ticket events being distinct from failed fixes and excluded from survival denominators.

## Self-Check: PASSED

- Found `/Users/admin/dev/autopilot/src/claimer.test.ts`.
- Found `/Users/admin/dev/autopilot/src/runner.test.ts`.
- Found task commit `b1ad80a`.
- Found task commit `c9b7184`.
- Found task commit `72f7f6c`.
- Found auto-fix commit `048879b`.

---
*Phase: 19-throughput-scaleup-trust-survival-autonomy*
*Completed: 2026-06-13*
