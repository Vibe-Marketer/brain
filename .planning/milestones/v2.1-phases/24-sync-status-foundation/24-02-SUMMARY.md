---
phase: 24-sync-status-foundation
plan: 02
subsystem: database
tags: [postgres, supabase, rls, migration, sync_jobs, realtime, cross-org-isolation]

# Dependency graph
requires:
  - phase: 24-sync-status-foundation (Plan 01)
    provides: canonical synced-signal reader (getSyncStatusForExternalIds) — establishes the recordings-as-truth foundation this plan's sync_jobs ledger complements
provides:
  - additive sync_jobs migration adding 9 nullable/defaulted columns (source_app, organization_id, workspace_id, source_id, mode, date_start, date_end, provider_cursor, last_heartbeat_at)
  - org-scoped RLS policy (sync_jobs_org_isolation) ADDED ALONGSIDE the retained user_id policy — OR-combined so legacy NULL-org rows stay visible
  - idx_sync_jobs_organization_status index for org-scoped polling in later phases
  - sync_jobs registered in CROSS_ORG_TABLES so the RLS regression CI gate fails loud on any cross-org leak
  - verified (not re-added) supabase_realtime membership via a pg_publication_tables guard
affects: [27-observable-jobs, 28-server-side-sync-all, 29-partial-success-retry]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive-only schema evolution: ADD COLUMN IF NOT EXISTS, nullable/defaulted, no DROP/ALTER COLUMN/RENAME"
    - "OR-combined permissive RLS: add an org policy ALONGSIDE (never replacing) the user policy so legacy NULL-org rows stay visible to their owner while new org rows are tenant-isolated"
    - "Realtime membership verification via pg_publication_tables DO-block guard (verify, never blindly ADD TABLE)"

key-files:
  created:
    - supabase/migrations/20260620120000_sync_jobs_durable_resource.sql
  modified:
    - src/test/rls-regression.test.ts

key-decisions:
  - "Org policy is FOR SELECT using is_organization_member(organization_id, auth.uid()) — the canonical project predicate (mirrors recordings/workspaces), added alongside the retained user_id policy"
  - "organization_id is NOT backfilled — left NULL for legacy/in-flight rows so they remain readable via the OR-combined user_id policy; only source_app=fathom and mode=selected are backfilled (every prior job was a Fathom selected-import)"
  - "Realtime membership verified, not re-added — sync_jobs is already in supabase_realtime with all columns (prattrs IS NULL); new columns auto-replicate"

patterns-established:
  - "Permissive-policy OR semantics for legacy-row visibility during org migrations"
  - "DO-block IF NOT EXISTS guards around idempotent DDL (policy creation + publication membership)"

requirements-completed: [IMP-03]

# Metrics
duration: ~12min
completed: 2026-06-20
---

# Phase 24 Plan 02: sync_jobs Durable Resource Summary

**Additive sync_jobs migration adding 9 org/provider/cursor columns plus an org-scoped RLS policy added alongside the retained user policy, with sync_jobs registered in the CROSS_ORG_TABLES CI gate.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-20
- **Completed:** 2026-06-20
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- Wrote the strictly-additive `sync_jobs` migration: 9 `ADD COLUMN IF NOT EXISTS` columns, all nullable/defaulted so in-flight jobs stay readable across the brain + autopilot two-repo contract.
- Added `sync_jobs_org_isolation` (FOR SELECT, `is_organization_member`) ALONGSIDE the retained `"Users can read own sync jobs"` user policy — both permissive, OR-combined, so legacy `organization_id = NULL` rows stay visible to their owner while another org's rows are invisible to a tenant JWT.
- Backfilled `source_app='fathom'`, `mode='selected'` on existing rows (non-destructive); left `organization_id` NULL.
- Added `idx_sync_jobs_organization_status` for org-scoped polling in Phases 27/28.
- Verified (not re-added) `supabase_realtime` membership via a `pg_publication_tables` DO-block guard.
- Registered `{ table: "sync_jobs", filterColumn: "organization_id" }` in `CROSS_ORG_TABLES` so the RLS regression CI gate fails loud on any future cross-org leak.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write additive sync_jobs migration with org-scoped RLS + Realtime verification** - `1e94696` (feat)
2. **Task 2: Register sync_jobs in CROSS_ORG_TABLES** - `90baf41` (test)

## Files Created/Modified
- `supabase/migrations/20260620120000_sync_jobs_durable_resource.sql` - Additive 9-column migration + org RLS (alongside user policy) + Realtime membership verification + source_app/mode backfill + org-scoped polling index.
- `src/test/rls-regression.test.ts` - Appended sync_jobs to CROSS_ORG_TABLES (filterColumn organization_id); no type change needed (union already includes organization_id).

## Decisions Made
- **Org predicate:** Used `is_organization_member(organization_id, auth.uid())` — the canonical project org-membership function used by `recordings`/`workspaces` policies (confirmed in `20260301000002_recreate_rls_policies.sql` and defined in `20260301000001_rename_vaults_to_workspaces.sql`).
- **Existing user policy name confirmed:** `"Users can read own sync jobs"` (consolidated_schema.sql:646). Left intact — the org policy is added, not substituted.
- **No organization_id backfill:** Deliberate. Legacy rows have no assignable org; leaving NULL keeps them readable via the OR-combined user policy (any org-only predicate would hide NULL-org rows).
- **Migration is WRITE-ONLY here.** Not pushed to prod or TEST — that push is gated in Plan 24-04. No `supabase db push` was run.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `npx tsc -p tsconfig.app.json --noEmit` reports errors, but **zero reference the changed file** (`rls-regression.test.ts`). All errors are pre-existing in unrelated files (`src/stores/__tests__/panelStore.test.ts`, `src/stores/preferencesStore.ts`, `src/types/folders.ts`, `src/types/index.ts`) — already documented in this phase's `deferred-items.md` from Plan 01. Out of scope per the executor SCOPE BOUNDARY rule; not fixed. The Task 2 acceptance criterion is satisfied for the changed file's contribution (it introduces no new type errors).

## Verification Results
- `grep -c "ADD COLUMN IF NOT EXISTS"` → **9** (one per new column).
- `grep -vE '^\s*--' ... | grep -c "error_message"` → **0** (never references the nonexistent column).
- `grep -cE "DROP |ALTER COLUMN|RENAME"` → **0** (additive only; existing user policy not dropped).
- `grep -cE "DROP POLICY|CREATE OR REPLACE POLICY"` → **0** (user policy retained; org policy added).
- Migration contains `sync_jobs_org_isolation`, `pg_publication_tables` guard, and the inline OR-combined-permissive/legacy-NULL-org rationale comment.
- `grep -c '{ table: "sync_jobs", filterColumn: "organization_id" }'` → **1**.
- `tsc` errors referencing `rls-regression` → **0**.

(Live RLS isolation + column existence + legacy-row visibility are proven in Plan 04 after `supabase db push` against the TEST DB.)

## User Setup Required
None - no external service configuration required. (Migration push to prod/TEST is gated in Plan 24-04.)

## Next Phase Readiness
- The `sync_jobs` durable-resource schema contract is written and ready for Plan 24-04 to push (prod + TEST) and run the live RLS regression.
- Phases 27 (observable jobs) and 28 (resumable sync-all) can build against the new columns (`provider_cursor`, `last_heartbeat_at`, `mode`, date range, org/workspace scope) once 24-04 applies the migration.

## Self-Check: PASSED

- FOUND: `supabase/migrations/20260620120000_sync_jobs_durable_resource.sql`
- FOUND: `.planning/phases/24-sync-status-foundation/24-02-SUMMARY.md`
- FOUND: commit `1e94696` (Task 1)
- FOUND: commit `90baf41` (Task 2)

---
*Phase: 24-sync-status-foundation*
*Completed: 2026-06-20*
