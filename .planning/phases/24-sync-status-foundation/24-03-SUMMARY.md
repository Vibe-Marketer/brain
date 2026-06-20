---
phase: 24-sync-status-foundation
plan: 03
subsystem: database
tags: [postgres, migrations, supabase, reconciliation, idempotency, recordings, fathom_calls]

# Dependency graph
requires:
  - phase: 24-sync-status-foundation (Plan 02)
    provides: additive sync_jobs migration + org RLS (write-only, push gated in 24-04)
provides:
  - "Idempotent backfill of NULL recordings.source_call_id from fathom_provider_id::text (IMP-02 gap closure)"
  - "Idempotent orphan-report migration for truly-orphan fathom_calls with a PK-arbitrated ON CONFLICT (IMP-04, report-only)"
  - "fathom_calls_orphan_report table (fathom_call_id BIGINT PRIMARY KEY) for manual operator review"
affects: [Phase 24 Plan 04 (real-DB test + supabase db push), Phase 26 canonical reader consumption]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Report-only reconciliation: persist orphans for manual review, never fabricate canonical rows"
    - "PK-arbitrated ON CONFLICT (col) DO NOTHING for re-runnable data migrations"

key-files:
  created:
    - supabase/migrations/20260620120500_backfill_null_source_call_id.sql
    - supabase/migrations/20260620121000_reconcile_orphan_fathom_calls.sql
  modified:
    - .planning/STATE.md
    - .planning/ROADMAP.md

key-decisions:
  - "Backfill source_call_id = fathom_provider_id::text only where fathom_provider_id IS NOT NULL; both-NULL rows are a documented bounded gap (no provider id to re-fetch, cannot be double-imported)"
  - "Orphans are EXCLUDED + reported (operator-locked), never fabricated into recordings"
  - "fathom_call_id BIGINT PRIMARY KEY (matches fathom_calls.recording_id BIGINT PK) is the ON CONFLICT arbiter"
  - "UNIQUE NULLS NOT DISTINCT upgrade deferred as destructive/out-of-scope for additive-only migration"

patterns-established:
  - "Report-only reconciliation: identify-and-surface for human review instead of auto-resurrecting data"
  - "Type-safe dual-bridge orphan detection (BIGINT<->BIGINT, UUID<->UUID), never cast BIGINT to UUID"

requirements-completed: [IMP-02, IMP-04]

# Metrics
duration: 11min
completed: 2026-06-20
---

# Phase 24 Plan 03: Sync-Status Foundation Data Migrations Summary

**Two additive, idempotent data migrations: backfill of NULL `recordings.source_call_id` from `fathom_provider_id::text` (IMP-02 gap), and a PK-arbitrated orphan-report for truly-orphan `fathom_calls` that never fabricates rows (IMP-04).**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-06-20
- **Completed:** 2026-06-20
- **Tasks:** 2
- **Files modified:** 2 created (migrations) + STATE.md/ROADMAP.md

## Accomplishments
- Closed the NULL-`source_call_id` constraint-escape gap: idempotent UPDATE backfilling from `fathom_provider_id::text` for fathom/fathom-paste rows where derivable, with a `RAISE NOTICE` residual report and a documented bounded both-NULL gap.
- Built an idempotent IMP-04 orphan-report migration: `fathom_calls_orphan_report` table with `fathom_call_id BIGINT PRIMARY KEY`, populated via a dual-bridge-path `NOT EXISTS` query, persisted with an explicit `ON CONFLICT (fathom_call_id) DO NOTHING`, never inserting into `recordings`.
- Both migrations are write-only this plan (push gated in 24-04); no constraint recreation, no ID coercion, no DB push.

## Task Commits

Each task was committed atomically:

1. **Task 1: NULL source_call_id backfill migration (IMP-02 gap)** - `8262b25` (feat)
2. **Task 2: Orphan-report reconciliation migration (IMP-04)** - `f3db9ae` (feat)

## Files Created/Modified
- `supabase/migrations/20260620120500_backfill_null_source_call_id.sql` - Idempotent UPDATE setting `source_call_id = fathom_provider_id::text` for NULL fathom/fathom-paste rows; `RAISE NOTICE` residual-gap report; documents the both-NULL bounded gap and the deferred destructive `NULLS NOT DISTINCT` upgrade. No constraint touched.
- `supabase/migrations/20260620121000_reconcile_orphan_fathom_calls.sql` - Creates `fathom_calls_orphan_report (fathom_call_id BIGINT PRIMARY KEY, ...)`; populates it with `fathom_calls` rows that miss BOTH bridge paths (BIGINT `recording_id`->`recordings.fathom_provider_id` AND UUID `canonical_recording_id`->`recordings.id`), type-safe, via `ON CONFLICT (fathom_call_id) DO NOTHING`; `RAISE NOTICE` orphan count. Never inserts into `recordings`.

## Decisions Made
- **Backfill key:** `fathom_provider_id::text` with an explicit cast (never implicit BIGINT/TEXT coercion, never `parseInt`/`Number`). `source_call_id` stays TEXT end-to-end.
- **Both-NULL rows:** documented as a known bounded gap rather than silently left — they have no provider id, so they cannot be double-imported via the connector path.
- **Orphan handling:** operator-locked EXCLUDE-and-report — `fathom_calls_orphan_report` surfaces them for manual review; no `recordings` rows are fabricated (avoids resurrecting deliberately-deleted calls).
- **Idempotency arbiter:** `fathom_call_id` declared `BIGINT PRIMARY KEY` (matching `fathom_calls.recording_id` BIGINT PK) so the explicit named `ON CONFLICT (fathom_call_id)` has a real arbiter; a bare `ON CONFLICT DO NOTHING` would have errored.
- **Report table column type:** `fathom_call_id BIGINT` chosen to match `fathom_calls.recording_id BIGINT PRIMARY KEY` (confirmed in `00000000000000_consolidated_schema.sql:88`). RESEARCH.md introspected the live `fathom_calls` table directly (2,094 rows, 60 truly-orphan) — followed those verified live facts.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. Both migrations passed all acceptance grep gates on the first write. Verified DO/$$ block balance and absence of any BIGINT→UUID cast as additional safety checks. Migrations were NOT pushed (push is gated in Plan 04 per the plan's explicit scope).

## User Setup Required
None - no external service configuration required. (The migrations are applied + proven against the real TEST DB in Plan 04.)

## Next Phase Readiness
- Both data migrations are written and committed; Plan 04 applies them via `supabase db push` and proves them with the mandatory real-DB reconciliation test (NULL set shrinks correctly; orphan count matches the live 60).
- No constraint was recreated; no DB was mutated this plan. The grep gates (constraint-ops = 0, INSERT INTO recordings = 0, PK arbiter present, named `ON CONFLICT` arbiter present) all pass.

## Self-Check: PASSED

- FOUND: supabase/migrations/20260620120500_backfill_null_source_call_id.sql
- FOUND: supabase/migrations/20260620121000_reconcile_orphan_fathom_calls.sql
- FOUND: .planning/phases/24-sync-status-foundation/24-03-SUMMARY.md
- FOUND commit: 8262b25 (Task 1)
- FOUND commit: f3db9ae (Task 2)

---
*Phase: 24-sync-status-foundation*
*Completed: 2026-06-20*
