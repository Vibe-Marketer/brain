---
phase: 29-partial-success-retry
plan: 01
subsystem: ui
tags: [react, import, sync, banner, vitest, tdd, remix-icons]

# Dependency graph
requires:
  - phase: 27-sync-status-banner (JOB-03)
    provides: SyncJobBanner — durable, sticky, no-timer job-status banner reading sync_jobs rows
  - phase: 28-skip-already-synced
    provides: sync_jobs.skipped_count — 23505 dupes recorded as skipped (informational), not failed
provides:
  - completed_with_errors banner renders the precise FAIL-01 breakdown "{synced} of {requested} imported, {failed} failed"
  - skipped-vs-failed distinction in the UI — skipped surfaced as muted informational, never counted as failure
  - RED-first breakdown tests locking the copy, the distinction, and the zero-setTimeout persistence invariant
affects: [29-02-retry-action, import-surface, sync-status]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Truthful denominator: requested = job.progress_total, falling back to synced+failed+skipped for legacy rows that never set progress_total"
    - "Skipped rendered as a conditional muted clause distinct from failed — never folded into the failed count"

key-files:
  created:
    - src/components/import/__tests__/SyncJobBanner.breakdown.test.tsx
  modified:
    - src/components/import/SyncJobBanner.tsx
    - src/components/import/__tests__/SyncJobBanner.test.tsx

key-decisions:
  - "requested denominator falls back to synced+failed+skipped when progress_total is 0/null so the 'of N' is always truthful for legacy rows"
  - "skipped clause is muted (text-muted-foreground/70) and separated by a middot to read as informational, not an error"
  - "Updated the stale Phase-27 completed_with_errors test to assert the FAIL-01 copy — the old '{synced} synced, {failed} failed' assertion was superseded by this plan"

patterns-established:
  - "Counts derive from .length on TEXT[] arrays + numeric progress_total/skipped_count only — no parseInt/Number (dual-ID rule)"
  - "Terminal banners remain sticky: zero setTimeout, asserted directly against the component source"

requirements-completed: [FAIL-01]

# Metrics
duration: 12min
completed: 2026-07-01
---

# Phase 29 Plan 01: Partial-Success Breakdown Summary

**SyncJobBanner now renders the precise FAIL-01 breakdown "{synced} of {requested} imported, {failed} failed" from the job's own counts, with already-synced duplicates surfaced as a muted informational "skipped" clause distinct from genuine failures — no timer, sticky until dismissed.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-01T00:02Z
- **Completed:** 2026-07-01T00:14Z
- **Tasks:** 2 (TDD: RED then GREEN)
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- completed_with_errors banner replaced vague "{synced} synced, {failed} failed" with the precise "{synced} of {requested} imported, {failed} failed" breakdown John asked for.
- Skipped (already-synced dupes, Phase 28) shown as informational "N already synced (skipped)", muted, never folded into the failed count; omitted entirely at 0/null.
- Truthful denominator: uses job.progress_total, falling back to synced+failed+skipped for legacy rows.
- RED-first tests lock the copy, the skipped-vs-failed distinction (incl. omitted at 0 and null), and the zero-setTimeout persistence invariant.

## Task Commits

Each task committed atomically (TDD):

1. **Task 1: RED — breakdown + skipped-distinction tests** - `2e43ce3` (test)
2. **Task 2: GREEN — render the precise breakdown + skipped distinction** - `6d43eb5` (feat)

## Files Created/Modified
- `src/components/import/__tests__/SyncJobBanner.breakdown.test.tsx` - RED-first FAIL-01 tests: breakdown copy, skipped-vs-failed distinction (omitted at 0/null), zero-setTimeout source assertion.
- `src/components/import/SyncJobBanner.tsx` - completed_with_errors branch renders the precise breakdown + conditional muted skipped clause; derives requested/skipped counts without coercion; doc-comment updated.
- `src/components/import/__tests__/SyncJobBanner.test.tsx` - Phase-27 completed_with_errors test updated to assert the FAIL-01 copy (breakdown + sticky), replacing the superseded "X synced, Y failed" assertion.

## Decisions Made
- **requested fallback:** when progress_total is 0/null (legacy rows), the "of N" denominator falls back to synced+failed+skipped so it never lies.
- **skipped styling:** rendered as a muted, middot-separated clause to read informational, not as an error segment.
- **stale-test update:** the Phase-27 test encoded the exact old copy string; FAIL-01 explicitly replaces that copy, so the assertion was updated to the new required copy while preserving the same load-bearing invariants (counts present + sticky after 9000ms).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated superseded Phase-27 banner test assertion**
- **Found during:** Task 2 (GREEN)
- **Issue:** The existing `SyncJobBanner.test.tsx` completed_with_errors test asserted `getByText(/synced/i)` against the OLD copy. FAIL-01 replaces that copy with "{synced} of {requested} imported, {failed} failed", so the word "synced" no longer stands alone in that branch and the query threw. The plan itself specifies this copy replaces the old line.
- **Fix:** Updated the test to assert the new FAIL-01 copy via tolerant container.textContent regexes ("3 of 5 imported", "2 failed"), preserving the same sticky-after-9000ms invariant and set progress_total on the fixture.
- **Files modified:** src/components/import/__tests__/SyncJobBanner.test.tsx
- **Verification:** Both banner test files green (10/10).
- **Committed in:** `6d43eb5` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — stale test superseded by planned copy change)
**Impact on plan:** Necessary to keep the existing suite green under the plan-mandated copy change. No scope creep — display-only, retry action deferred to Plan 02 as planned.

## Issues Encountered
- Repo-wide `tsc -p tsconfig.app.json` reports 308 pre-existing errors in unrelated files (known-hollow root typecheck condition). Zero errors in the touched files (SyncJobBanner.tsx, both test files) — verified by filtering the tsc output. Out of scope; not fixed.

## User Setup Required
None - frontend display-only change, no external service configuration, no new package.

## Next Phase Readiness
- Display half of the partial-success loop is done. Plan 02 (FAIL-02) wires the "Retry failed (N)" action onto this same banner (failed_ids only, idempotent, org-scoped, existing singleCallId path).
- No blockers.

## Self-Check: PASSED

- FOUND: src/components/import/SyncJobBanner.tsx
- FOUND: src/components/import/__tests__/SyncJobBanner.breakdown.test.tsx
- FOUND: .planning/phases/29-partial-success-retry/29-01-SUMMARY.md
- FOUND commit: 2e43ce3 (test — RED)
- FOUND commit: 6d43eb5 (feat — GREEN)

---
*Phase: 29-partial-success-retry*
*Completed: 2026-07-01*
