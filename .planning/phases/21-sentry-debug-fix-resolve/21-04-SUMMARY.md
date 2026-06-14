---
phase: 21-sentry-debug-fix-resolve
plan: 04
subsystem: daemon
tags: [autopilot, sentry, brief, runner_runs, jsonb-memory, bun]

requires:
  - phase: 21-sentry-debug-fix-resolve
    provides: Sentry ticket ingestion/source rows and existing runner_runs ledger state
provides:
  - Sentry prior-attempt memory adapter over existing runner_runs rows
  - Sentry-only debug discipline and prior-attempt context in fix briefs
  - Runner wiring that fetches prior attempts before Sentry fix attempts
affects: [21-05, 21-06, sentry-resolve, autopilot-runner]

tech-stack:
  added: []
  patterns: [DbLike structural read adapter, pure brief composition, runner brief helper]

key-files:
  created:
    - ~/dev/autopilot/src/lib/sentry-memory.ts
    - ~/dev/autopilot/src/lib/sentry-memory.test.ts
    - ~/dev/autopilot/src/lib/brief.test.ts
  modified:
    - ~/dev/autopilot/src/lib/brief.ts
    - ~/dev/autopilot/src/runner.ts
    - ~/dev/autopilot/src/runner.test.ts

key-decisions:
  - "Memory stays zero-package: prior attempts are read from existing runner_runs rows, not Honcho or a new SDK."
  - "composeBrief remains pure; runner.ts performs DB memory reads and passes pre-rendered text into composeBrief."
  - "Non-Sentry tickets keep the pre-change composeBrief output byte-identical."

patterns-established:
  - "Sentry source-specific fix-loop context is injected before the ticket data fence, after the HARD POLICY block."
  - "Prior-attempt DB failures are logged and treated as empty history so the runner can continue."

requirements-completed: [SEN-03]

duration: 5min
completed: 2026-06-14T01:44:07Z
---

# Phase 21 Plan 04 Summary

**Sentry fix briefs now carry scientific-method discipline plus runner_runs prior-attempt memory before the existing fix subprocess starts.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-06-14T01:39:31Z
- **Completed:** 2026-06-14T01:44:07Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Added `fetchPriorAttempts` + `renderPriorAttempts` in `~/dev/autopilot/src/lib/sentry-memory.ts`, reading only existing `runner_runs` fields and returning `[]` on DB errors after a logged `[autopilot]` error.
- Extended `composeBrief` so `source === "sentry"` briefs include the debug method and rendered prior attempts before `=== BEGIN TICKET DATA ===`; non-Sentry output is byte-pinned unchanged.
- Wired runner brief creation through `buildRunnerBrief(db, ticket, messages)`, so Sentry tickets fetch memory before `runAgent` and non-Sentry tickets do not query memory.

## Task Commits

1. **Task 1: JSONB prior-attempt memory adapter** - `63674f7` (`feat(21)`)
2. **Task 2: Sentry discipline + prior-attempt brief section** - `8026e28` (`feat(21)`)
3. **Task 3: Runner memory wiring before fix attempt** - `44d5350` (`feat(21)`)
4. **Follow-up: test typecheck cleanup** - `b517b23` (`fix(21)`)

## Files Created/Modified

- `~/dev/autopilot/src/lib/sentry-memory.ts` - JSONB/runner_runs prior-attempt adapter and renderer.
- `~/dev/autopilot/src/lib/sentry-memory.test.ts` - Adapter read, render, and log-don't-throw coverage.
- `~/dev/autopilot/src/lib/brief.ts` - Sentry-only discipline/prior-attempt injection; `BriefTicket.source` added.
- `~/dev/autopilot/src/lib/brief.test.ts` - Non-Sentry byte snapshot and Sentry containment tests.
- `~/dev/autopilot/src/runner.ts` - `buildRunnerBrief` helper and pre-`runAgent` memory wiring.
- `~/dev/autopilot/src/runner.test.ts` - Runner brief memory wiring coverage for Sentry vs non-Sentry paths.

## Decisions Made

- Chose the plan-recommended pure composition seam: `brief.ts` has no DB reads, and `runner.ts` owns memory fetching before spawning the fix agent.
- Used `detail.verdict` when present, otherwise `gate_verdict`, because `runner_runs` has no standalone verdict column.
- Kept prior-attempt rendering compact to avoid inflating the headless agent prompt.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Bun test matcher types failed repo typecheck**
- **Found during:** Final verification after Task 3.
- **Issue:** `bun run typecheck` rejected `spyOn`, `toMatchObject`, and `toContainEqual` in the new tests because the local Bun test types expose a smaller matcher surface than runtime supports.
- **Fix:** Rewrote tests to use existing typed matchers and manual `console.error` capture; cast mock query builders through `unknown` to satisfy `DbLike`.
- **Files modified:** `~/dev/autopilot/src/lib/sentry-memory.test.ts`, `~/dev/autopilot/src/runner.test.ts`
- **Verification:** `bun test src/lib/sentry-memory.test.ts src/lib/brief.test.ts src/runner.test.ts` and `bun run typecheck` both pass.
- **Committed in:** `b517b23`

---

**Total deviations:** 1 auto-fixed (Rule 3)
**Impact on plan:** No behavior scope change; it only made the planned tests typecheck-clean.

## Issues Encountered

- CodeGraph was not initialized in `~/dev/autopilot`, so source navigation used direct file reads and exact grep-style checks.
- Pre-existing dirty autopilot files remained unstaged: `qa/known-fingerprints.json`, `qa/runs.log`.

## Verification

- `bun test src/lib/sentry-memory.test.ts` — PASS (4 tests)
- `bun test src/lib/brief.test.ts` — PASS (2 tests)
- `bun test src/runner.test.ts` — PASS (4 tests)
- `bun test src/lib/sentry-memory.test.ts src/lib/brief.test.ts src/runner.test.ts` — PASS (10 tests, 41 expects)
- `bun run typecheck` — PASS
- `git diff -- package.json` — empty; zero new packages.

## User Setup Required

None.

## Next Phase Readiness

Plan 05/06 can rely on Sentry tickets reaching the existing fix loop with prior-attempt context already present in the generated brief. The resolve/cap/freeze work still needs to preserve the same zero-package and per-fingerprint-only invariants.

---
*Phase: 21-sentry-debug-fix-resolve*
*Completed: 2026-06-14T01:44:07Z*
