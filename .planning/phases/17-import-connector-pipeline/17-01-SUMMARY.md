---
phase: 17-import-connector-pipeline
plan: 01
subsystem: database
tags: [supabase, edge-functions, deno, postgresql, rls, connector-pipeline, import, deduplication]

# Dependency graph
requires:
  - phase: 15-data-migration
    provides: "recordings + vault_entries tables with source_metadata containing external_id for all 1,554 migrated records"
  - phase: 15-data-migration
    provides: "bank_memberships + banks + vaults schema for personal bank/vault resolution"
provides:
  - "supabase/functions/_shared/connector-pipeline.ts — shared 5-stage pipeline with checkDuplicate() and insertRecording()"
  - "import_sources table with RLS — per-user, per-source connection state for Import Hub UI"
  - "sync_jobs.skipped_count column — dedup summary reporting in sync completion toasts"
  - "get_import_counts() RPC — single-query call counts per source_app per user"
affects:
  - 17-import-connector-pipeline (plans 02+: all connectors rewired to use pipeline)
  - future phases referencing import_sources for routing rules (Phase 18)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Flat exported async functions in _shared — no class hierarchy"
    - "Dedup by owner_user_id + source_app + source_metadata->>'external_id' (prevents cross-source ID collisions)"
    - "Fail-open dedup: query error returns isDuplicate=false, never blocks import"
    - "external_id as first key in source_metadata for consistent JSON structure"
    - "Vault entry creation non-blocking (try/catch, logs only) — recording already committed"
    - "personal bank auto-resolution via bank_memberships JOIN banks WHERE type='personal'"

key-files:
  created:
    - "supabase/functions/_shared/connector-pipeline.ts"
    - "supabase/migrations/20260228000002_create_import_sources.sql"
  modified: []

key-decisions:
  - "Migration file named 000002 because 000001 was already taken by Phase 16 workspace_redesign_schema.sql — auto-fixed as Rule 3 (blocking issue)"
  - "Vault entry insert wrapped in non-blocking try/catch per Phase 10 pattern: recording commit must succeed even if vault lookup fails"
  - "Fail-open on dedup query error: a broken dedup check should never silently drop an import"
  - "get_import_counts() uses SECURITY DEFINER for consistent access pattern; call counts are decorative and can tolerate 5-min stale time in React Query"

patterns-established:
  - "ConnectorRecord interface: external_id + source_app + title + full_transcript + recording_start_time + optional duration/bank_id/vault_id/source_metadata"
  - "runPipeline() returns { success, recordingId } | { success:false, skipped:true } | { success:false, error }"
  - "All new connectors import from '../_shared/connector-pipeline.ts' instead of writing their own DB logic"

# Metrics
duration: 2min
completed: 2026-02-28
---

# Phase 17 Plan 01: Connector Pipeline Foundation Summary

**Shared 5-stage connector pipeline utility and import_sources database table deployed — all future connectors write recordings via checkDuplicate() + insertRecording() with fail-open dedup and non-blocking vault entry creation.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-28T04:39:53Z
- **Completed:** 2026-02-28T04:42:02Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created `_shared/connector-pipeline.ts` with flat exported functions: `ConnectorRecord`, `PipelineResult`, `checkDuplicate`, `insertRecording`, `runPipeline`
- Deployed `import_sources` table to production with UNIQUE(user_id, source_app), 4 RLS policies, and supporting `get_import_counts()` RPC
- Added `sync_jobs.skipped_count` for dedup summary reporting in completion toasts

## Task Commits

Each task was committed atomically:

1. **Task 1: Create shared connector pipeline utility** - `62c1ef8` (feat)
2. **Task 2: Create import_sources table migration** - `87aaddf` (feat)

**Plan metadata:** (docs commit follows this SUMMARY)

## Files Created/Modified

- `supabase/functions/_shared/connector-pipeline.ts` — Shared pipeline with dedup check (Stage 3) and recording insert with vault entry (Stage 5), plus runPipeline() convenience wrapper
- `supabase/migrations/20260228000002_create_import_sources.sql` — import_sources table, RLS, sync_jobs.skipped_count column, get_import_counts() RPC; deployed to production

## Decisions Made

- **Migration filename 000002**: `20260228000001` was already used by Phase 16's `workspace_redesign_schema.sql`. Used `000002` instead (auto-fixed as Rule 3 blocking issue).
- **Fail-open dedup**: If the dedup query errors, the pipeline returns `isDuplicate: false` and allows the import to proceed. Silently dropping an import is worse than a rare false negative.
- **Non-blocking vault entry**: Vault entry creation is wrapped in try/catch. If the vault lookup fails, the recording is already committed and the error is logged only. This matches Phase 10's established pattern.
- **SECURITY DEFINER for get_import_counts()**: Consistent with existing aggregate RPC functions. React Query stale time can be generous (5 min) since call counts are decorative.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Migration filename conflict**
- **Found during:** Task 2 (Create import_sources table migration)
- **Issue:** Plan specified filename `20260228000001_create_import_sources.sql` but `20260228000001_workspace_redesign_schema.sql` already existed from Phase 16
- **Fix:** Used `20260228000002_create_import_sources.sql` — same content, incremented sequence number
- **Files modified:** `supabase/migrations/20260228000002_create_import_sources.sql`
- **Verification:** Migration deployed successfully to production; confirmed via psql query
- **Committed in:** `87aaddf` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 3 blocking)
**Impact on plan:** Filename rename only — no schema or functionality changes. All must_haves met.

## Issues Encountered

None beyond the migration filename auto-fix above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02 (rewire YouTube connector) can now `import { runPipeline } from '../_shared/connector-pipeline.ts'`
- Plans 03-04 (Zoom + Fathom rewires) follow the same import pattern
- Plan 05 (file-upload connector) validated against the ≤230 line budget — pipeline provides all DB logic
- `import_sources` table is ready for Plan 06+ (Import Hub UI) to read/write source status

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `supabase/functions/_shared/connector-pipeline.ts` exists | FOUND |
| `supabase/migrations/20260228000002_create_import_sources.sql` exists | FOUND |
| `.planning/phases/17-import-connector-pipeline/17-01-SUMMARY.md` exists | FOUND |
| Task 1 commit `62c1ef8` exists | FOUND |
| Task 2 commit `87aaddf` exists | FOUND |
| `import_sources` table in production with RLS enabled | CONFIRMED (psql) |
| 4 RLS policies on `import_sources` | CONFIRMED (psql) |
| `get_import_counts()` function exists | CONFIRMED (psql) |
| `sync_jobs.skipped_count` column exists | CONFIRMED (psql) |
| UNIQUE(user_id, source_app) constraint | CONFIRMED (psql) |

---
*Phase: 17-import-connector-pipeline*
*Completed: 2026-02-28*
