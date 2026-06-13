---
phase: 17-activation-per-run-observability-go-live-hardening
plan: 03
subsystem: testing
tags: [autopilot, push-gate, test-integrity, runner-runs, evidence]

requires:
  - phase: 17-activation-per-run-observability-go-live-hardening
    provides: "Plan 17-01 runner_runs ledger and evidence fields"
provides:
  - "Deterministic test-integrity push-gate stage for ACT-05"
  - "Fixture coverage for test deletion, count reduction, disabled tests, and assertion weakening"
  - "Runner evidence parsing for gate_stage='test_integrity'"
affects: [autopilot, AdminTab, runner_runs, ACT-04, ACT-05]

tech-stack:
  added: []
  patterns: ["Shell-only push-gate helper invoked after commit-advance", "Gate output parsed into run-ledger fields"]

key-files:
  created:
    - "~/dev/autopilot/gate/test-integrity-gate.sh"
  modified:
    - "~/dev/autopilot/gate/push-gate.sh"
    - "~/dev/autopilot/gate/push-gate-test.sh"
    - "~/dev/autopilot/src/runner.ts"
    - "~/dev/autopilot/src/lib/evidence.ts"
    - "~/dev/autopilot/src/lib/evidence.test.ts"

key-decisions:
  - "Implemented test integrity as a deterministic shell helper inside the push-gate boundary."
  - "Runner stops before branch push and awaiting_approval when the push-gate blocks."

patterns-established:
  - "Gate stage names are parsed mechanically from push-gate output and written to runner_runs/detail."
  - "ACT-05 fixture harness keeps offline DB skip confined to tests."

requirements-completed: [ACT-05]

duration: 35min
completed: 2026-06-13
---

# Phase 17 Plan 03 Summary

**Deterministic test-integrity push-gate blocks test weakening and records `test_integrity` in runner evidence**

## Performance

- **Duration:** 35 min
- **Started:** 2026-06-13T15:50:00Z
- **Completed:** 2026-06-13T16:25:41Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Added red-first fixtures proving the gate blocks test file deletion, test-case count decrease, `.skip` / `.only`, `xit` / `xdescribe`, and assertion-count decrease.
- Added `gate/test-integrity-gate.sh` and wired it into `push-gate.sh` after commit-advance and before denylist evaluation.
- Added gate-output parsing so runner evidence records `gate_verdict='fail'` and `gate_stage='test_integrity'` when this stage blocks.

## Task Commits

1. **Task 1: Add fixture tests for every weakening behavior** - `9ed0181` (`test`)
2. **Task 2: Implement the deterministic test-integrity stage** - `2bae262` (`feat`)
3. **Task 3: Prove blocked gate status reaches run evidence** - `e2a97ba` (`feat`)

## Files Created/Modified

- `~/dev/autopilot/gate/test-integrity-gate.sh` - Deterministic helper comparing base/head tests, cases, assertions, and disabled markers.
- `~/dev/autopilot/gate/push-gate.sh` - Invokes `test_integrity` after commit-advance before denylist.
- `~/dev/autopilot/gate/push-gate-test.sh` - Offline fixtures for all ACT-05 weakening cases.
- `~/dev/autopilot/src/lib/evidence.ts` - Parses push-gate output into run-ledger gate fields.
- `~/dev/autopilot/src/lib/evidence.test.ts` - Covers `test_integrity` parsing.
- `~/dev/autopilot/src/runner.ts` - Runs the push-gate before branch push and records blocked gate details.

## Decisions Made

- Used a separate shell helper rather than expanding `push-gate.sh` inline, keeping the authority boundary small and fixtureable.
- Treated runner push-gate failure as `gate_failed` and returned before branch push / `awaiting_approval`, preserving the hard gate.

## Deviations from Plan

None - plan executed as written.

## Issues Encountered

- The first implementation of the shell counters treated `$` inside a Perl character class as interpolation. Fixed the regex to use `\x24`; fixture suite then passed.

## Verification

- `cd ~/dev/autopilot && bash gate/push-gate-test.sh` - passed, `ALL 12 FIXTURES PASS`.
- `cd ~/dev/autopilot && bun test src/lib/evidence.test.ts` - passed, `12 pass`, `0 fail`.
- `cd ~/dev/autopilot && bun run typecheck` - passed.
- `cd ~/dev/autopilot && rg -n "LLM|claude|codex|allow|bypass" gate/push-gate.sh gate/test-integrity-gate.sh || true` - no matches.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

ACT-05 is enforced inside the deterministic push-gate. ACT-04 UI can display `runner_runs.gate_stage` values including `test_integrity` from this plan's runner evidence.

---
*Phase: 17-activation-per-run-observability-go-live-hardening*
*Completed: 2026-06-13*
