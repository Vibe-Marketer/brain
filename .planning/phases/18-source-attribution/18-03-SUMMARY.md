---
phase: 18-source-attribution
plan: 03
subsystem: autopilot
tags: [autopilot, watchdog, qa, ticket_source]

requires:
  - phase: 18-source-attribution
    plan: 01
    provides: ticket_source enum values internal and nightly_qa
provides:
  - watchdog tools-health tickets stamp internal
  - QA triage tickets stamp nightly_qa through service-role owned inserts
  - regression coverage for both operational source paths

key-files:
  modified:
    - /Users/admin/dev/autopilot/src/watchdog.ts
    - /Users/admin/dev/autopilot/src/watchdog.test.ts
    - /Users/admin/dev/autopilot/qa/triage.ts
  created:
    - /Users/admin/dev/autopilot/qa/triage.test.ts

requirements-completed: [SRC-01]
completed: 2026-06-13
---

# Phase 18 Plan 03: Autopilot Source Attribution Summary

Autopilot operational ticket creation now stamps true server-owned origins: watchdog tools-health tickets use `internal`, and nightly QA triage tickets use `nightly_qa`.

## Task Results

1. **Task 1: Stamp watchdog tickets as internal** - complete
   - Commit: `/Users/admin/dev/autopilot` `f27a688` (`fix(18): stamp watchdog tickets as internal`)
   - Added `buildToolsHealthTicketInsert()` so the ticket row shape is testable.
   - Changed the tools-health ticket insert source from `manual` to `internal`.
   - Preserved reporter, severity, status, dedupe query, and `context.origin = "autopilot-watchdog"`.

2. **Task 2: Stop QA triage from filing manual tickets** - complete
   - Commit: `/Users/admin/dev/autopilot` `3d83016` (`fix(18): stamp QA triage tickets as nightly QA`)
   - Replaced the browser/person ticket filing path with service-role REST inserts.
   - QA now writes ticket rows with `source: "nightly_qa"` and `context.origin = "qa-nightly-crawler"`.
   - Added agent-authored ticket message and created event writes so operational tickets keep a usable ticket thread.
   - Preserved known-fingerprint persistence after successful filing only.

## Verification

- `cd /Users/admin/dev/autopilot && bun test src/watchdog.test.ts` passed: 13 tests, 49 expects.
- `cd /Users/admin/dev/autopilot && bun test qa/triage.test.ts` passed: 4 tests, 17 expects.
- `cd /Users/admin/dev/autopilot && bun test src/watchdog.test.ts qa/triage.test.ts` passed: 17 tests, 66 expects.
- `cd /Users/admin/dev/autopilot && bun run typecheck` passed.
- `grep -n 'source: "internal"' /Users/admin/dev/autopilot/src/watchdog.ts` found the watchdog insert type and value.
- `test "$(grep -R "send-support-ticket" /Users/admin/dev/autopilot/qa/triage.ts | wc -l | tr -d ' ')" = "0"` passed.
- `grep -R 'source: "manual"' /Users/admin/dev/autopilot/src/watchdog.ts /Users/admin/dev/autopilot/qa/triage.ts` returned no matches.

## Deviations

- Added pure ticket-row builders to make source attribution directly testable without live DB writes.
- Added service-role writes for QA ticket messages and created events to preserve the useful shape of tickets previously created by the person-report path.
- CodeGraph was not initialized in `/Users/admin/dev/autopilot`; implementation used targeted file reads instead.

## Notes

- Existing dirty autopilot runtime files were intentionally left unstaged: `qa/known-fingerprints.json` and `qa/runs.log`.
- Autopilot has no git remote configured, so the two autopilot commits are local-only.
