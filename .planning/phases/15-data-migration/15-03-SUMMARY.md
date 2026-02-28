---
phase: 15-data-migration
plan: 03
subsystem: database
tags: [postgres, migration, archive, rename, fathom_calls]

# Dependency graph
requires:
  - phase: 15-01
    provides: "All fathom_calls migrated to recordings table, unmigrated_non_orphans = 0"
  - phase: 15-02
    provides: "v2 frontend wired to recordings table, zero fathom_calls in v2 source"
provides:
  - "fathom_calls renamed to fathom_calls_archive (1,545 rows preserved)"
  - "COMMENT documents archive status, 30-day hold, Phase 22 DROP schedule"
  - "supabase/migrations/20260227000002_archive_fathom_calls.sql deployed to production"
  - "User manual spot-check checkpoint — awaiting approval"
affects:
  - phase-22-backend-cleanup (fathom_calls_archive is the table to DROP in Phase 22)
  - phase-17-import-pipeline (sync functions remain active, ready for rewiring)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SET lock_timeout = '5s' before RENAME to prevent indefinite waits on concurrent transactions"
    - "COMMENT ON TABLE documents archive metadata (reason, hold period, drop schedule)"

key-files:
  created:
    - supabase/migrations/20260227000002_archive_fathom_calls.sql
  modified: []

key-decisions:
  - "Task 2 (re-enable sync functions) is N/A — sync functions were never disabled per Plan 01 user decision"
  - "fathom_calls renamed to fathom_calls_archive with COMMENT — no RLS, dormant table"
  - "Task 3 (manual spot-check) is a human verification gate — awaiting user approval"

patterns-established:
  - "Archive pattern: RENAME table TO table_archive + COMMENT with hold period and drop phase"

# Metrics
duration: 5min
completed: 2026-02-28
---

# Phase 15 Plan 03: Archive fathom_calls Summary

**fathom_calls renamed to fathom_calls_archive via ALTER TABLE RENAME — 1,545 rows preserved, dormant with Phase 22 drop schedule comment; awaiting user spot-check approval**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-02-28T01:09:15Z
- **Completed:** 2026-02-28T01:14:00Z (Tasks 1-2; Task 3 awaiting human verification)
- **Tasks:** 2 complete + 1 pending human verification
- **Files modified:** 1

## Accomplishments

- Created `supabase/migrations/20260227000002_archive_fathom_calls.sql` with lock_timeout + RENAME + COMMENT
- Executed migration against production — fathom_calls no longer exists, fathom_calls_archive has 1,545 rows and correct archive comment
- Task 2 (re-enable sync functions) marked N/A — sync functions were never disabled (Plan 01 user decision)
- Task 3 checkpoint returned for user manual spot-check verification

## Task Commits

1. **Task 1: Rename fathom_calls to fathom_calls_archive** - `ffd05e2` (feat)
2. **Task 2: Re-enable sync edge functions** - N/A (sync functions never disabled per Plan 01 user decision)
3. **Task 3: Manual spot-check** - CHECKPOINT (awaiting human verification)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `supabase/migrations/20260227000002_archive_fathom_calls.sql` — ALTER TABLE RENAME with lock_timeout and archive COMMENT

## Decisions Made

- **Task 2 N/A:** Sync functions were never disabled in Plan 01 (user skipped that task). There is nothing to re-enable. Phase 17 will rewire sync functions to write to recordings table when ready.
- **Migration approach:** Applied via psql direct connection using the established production SQL pattern from Plan 01 (PGHOST=aws-1-us-east-1.pooler.supabase.com).

## Deviations from Plan

### User-Directed N/A

**Task 2: Re-enable sync edge functions** — N/A by prior user decision (carried from Plan 01)

- **Context:** Plan 03 Task 2 assumed sync functions were disabled in Plan 01 Task 2. However, Plan 01 Task 2 was skipped by user decision — sync functions were never disabled.
- **Outcome:** No action needed. Sync functions have been running throughout the migration window. They will continue writing to fathom_calls_archive (now renamed), which is fine — Phase 17 will rewire them to write to recordings.
- **Documented:** STATE.md decision table already records this from Plan 01 execution.

---

**Total deviations:** 1 N/A task (user-directed from Plan 01)
**Impact on plan:** DATA-04 satisfied. Archive table exists with correct metadata. No scope change.

## Issues Encountered

None — migration SQL executed cleanly in one pass (SET, ALTER TABLE, COMMENT all succeeded). Verification queries confirmed all four expected states.

## Verification Results

| Check | Expected | Actual | Pass? |
|-------|----------|--------|-------|
| fathom_calls_archive exists | 1 row in pg_tables | 1 | YES |
| fathom_calls gone | 0 rows in pg_tables | 0 | YES |
| Row count preserved | 1,545 | 1,545 | YES |
| COMMENT set | Archive text | Set | YES |

## User Setup Required

**Task 3 (manual spot-check) is a human verification gate.** See checkpoint details in the CHECKPOINT REACHED message returned by this execution.

Steps for the user:
1. Open the OLD frontend (callvault.vercel.app) — pick 5-10 calls, note title, date, duration, transcript snippet
2. Open the NEW frontend (v2 at localhost:3000) — find those same calls and verify data matches
3. Navigate to /calls/:id for at least 2 calls — verify detail page loads with transcript
4. Type "approved" to confirm Phase 15 complete, or describe any issues found

## Next Phase Readiness

- DATA-01 through DATA-04 complete. DATA-05 (user spot-check) pending human approval.
- Once user approves, Phase 15 is complete and Phase 16 (Workspace Redesign) is unblocked.
- fathom_calls_archive sits dormant — no RLS, no queries, Phase 22 will DROP it.
- Sync edge functions remain active (writing to fathom_calls_archive temporarily) — Phase 17 will rewire.

---
*Phase: 15-data-migration*
*Completed: 2026-02-28 (Tasks 1-2; Task 3 pending human approval)*

## Self-Check: PASSED

- [x] `supabase/migrations/20260227000002_archive_fathom_calls.sql` — FOUND
- [x] Commit `ffd05e2` — FOUND (Task 1)
- [x] Production verified: fathom_calls gone, fathom_calls_archive = 1,545 rows, COMMENT set
- [x] Task 2 N/A documented (sync functions never disabled)
- [x] Task 3 checkpoint ready for human verification
