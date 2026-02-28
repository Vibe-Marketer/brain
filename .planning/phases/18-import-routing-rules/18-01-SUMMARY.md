---
phase: 18-import-routing-rules
plan: 01
subsystem: database
tags: [supabase, postgres, rls, deno, typescript, routing-engine, connector-pipeline]

# Dependency graph
requires:
  - phase: 17-import-connector-pipeline
    provides: connector-pipeline.ts with runPipeline/insertRecording/checkDuplicate, ConnectorRecord type
  - phase: 16-workspace-redesign
    provides: vaults, folders, banks, bank_memberships tables used as routing targets

provides:
  - import_routing_rules table with priority ordering, JSONB conditions, AND/OR logic, target vault/folder
  - import_routing_defaults table for org-level fallback destination (one row per bank)
  - update_routing_rule_priorities() SECURITY DEFINER RPC for drag-to-reorder priority updates
  - routing-engine.ts with resolveRoutingDestination() — first-match-wins evaluation of 6 condition types
  - connector-pipeline.ts runPipeline() with routing resolution pre-step before insertRecording
  - folder_id field on ConnectorRecord flowing through to vault_entries INSERT

affects:
  - 18-02 (routing rules UI — needs these tables and engine)
  - 18-03 (routing preview — queries import_routing_rules)
  - 18-04 (default destination UI — needs import_routing_defaults)
  - all connectors using runPipeline() get routing automatically

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Routing resolution is a non-blocking pre-step in runPipeline() — failure never blocks import"
    - "First-match-wins evaluation: rules queried ordered by priority ASC, return on first match"
    - "Fail-open pattern extended: routing errors log and continue (same as dedup check)"
    - "RLS via bank_memberships JOIN: org-scoped tables use EXISTS subquery on bank_memberships"
    - "Routing trace in source_metadata: routed_by_rule_id, routed_by_rule_name, routed_at"
    - "SECURITY DEFINER RPC for batch priority update with manual membership check"

key-files:
  created:
    - supabase/migrations/20260228000003_create_import_routing_rules.sql
    - supabase/functions/_shared/routing-engine.ts
  modified:
    - supabase/functions/_shared/connector-pipeline.ts

key-decisions:
  - "Routing resolution as runPipeline() pre-step (not insertRecording() parameter) — preserves insertRecording signature unchanged"
  - "Rules are org-scoped via bank_id (not user_id) — the whole org shares one rule list"
  - "vault_entries INSERT receives folder_id only when routing resolves a folder — not null-inserted"
  - "Priority update via SECURITY DEFINER RPC with manual membership check rather than UPDATE policies"
  - "import_routing_defaults uses bank_id as PRIMARY KEY — one default per org, managed via upsert"

patterns-established:
  - "routing-engine.ts: pure module with no side effects beyond DB reads"
  - "evaluateCondition dispatches on field type to typed sub-evaluators (string, number, date)"
  - "extractParticipants: checks calendar_invitees (object array with email/name) and participants (string array)"

# Metrics
duration: 4min
completed: 2026-02-28
---

# Phase 18 Plan 01: Routing Rules DB Schema and Engine Summary

**Bank-scoped routing rules table with priority+conditions JSONB, org default destination table, and first-match-wins routing engine integrated into connector pipeline's runPipeline() as a non-blocking pre-step**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-28T05:10:57Z
- **Completed:** 2026-02-28T05:14:47Z
- **Tasks:** 2
- **Files modified:** 3 (1 created migration, 1 created routing-engine.ts, 1 modified connector-pipeline.ts)

## Accomplishments

- Deployed `import_routing_rules` table to production with bank-scoped RLS (4 policies using bank_memberships JOIN pattern), compound partial index on (bank_id, priority) WHERE enabled=true, and all columns per plan spec (IMP-10 priority column from first migration confirmed)
- Deployed `import_routing_defaults` table to production with 3 RLS policies; bank_id as primary key enforces one-default-per-org via upsert
- Created `update_routing_rule_priorities()` SECURITY DEFINER RPC for atomic batch-priority updates with manual membership authorization check
- Created `routing-engine.ts` as pure TypeScript module with `resolveRoutingDestination()` implementing first-match-wins evaluation across 6 condition types (title, source, duration, participant, tag, date), AND/OR logic per rule, and fail-open error handling
- Modified `runPipeline()` in `connector-pipeline.ts` to resolve routing destination between dedup check and insert — rules first-match, then org default, then personal vault fallback (existing behavior preserved)
- Added `folder_id` to `ConnectorRecord` interface; flows through to `vault_entries` INSERT when routing resolves a folder-level destination
- Routing trace metadata (`routed_by_rule_id`, `routed_by_rule_name`, `routed_at`) merged into `source_metadata` for future UI display ("Routed by: [Rule Name]" badge)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create routing rules database migration** - `4991b5a` (feat)
2. **Task 2: Create routing engine and integrate into connector pipeline** - `efe155b` (feat)

**Plan metadata:** _(docs commit hash — created after SUMMARY)_

## Files Created/Modified

- `supabase/migrations/20260228000003_create_import_routing_rules.sql` - Migration: import_routing_rules + import_routing_defaults tables, RLS policies, compound index, update_routing_rule_priorities RPC
- `supabase/functions/_shared/routing-engine.ts` - Pure routing evaluation module: resolveRoutingDestination(), evaluateRule(), 6 condition type evaluators, participant/tag extractors
- `supabase/functions/_shared/connector-pipeline.ts` - Added resolveRoutingDestination import, folder_id on ConnectorRecord, routing pre-step in runPipeline(), folder_id in vault_entries INSERT

## Decisions Made

- Routing logic lives entirely in `runPipeline()`, not in `insertRecording()` — preserves the signature of insertRecording() unchanged, which is the contract all connectors depend on
- Rules table is bank-scoped (org-level) rather than user-scoped — matches the locked decision from CONTEXT.md: "one brain routing calls for the whole org"
- Routing errors are fully non-blocking (try/catch around entire routing block) — a routing failure should never prevent a call from being imported
- Participant extraction checks both `calendar_invitees` (object array with email/name keys) and `participants` (flat string array) for compatibility across connector types
- `import_routing_defaults` uses `bank_id` as primary key (not a separate id column) — semantic guarantee that only one default exists per org, enforced by the schema itself

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Repaired Supabase migration history before push**
- **Found during:** Task 1 (deploying migration)
- **Issue:** `supabase db push --linked` failed because migrations 20260227000002, 20260228000001, 20260228000002 were applied directly to production (manual deploy in Phase 17) but not recorded in the supabase_migrations tracking table
- **Fix:** Ran `supabase migration repair --status applied 20260227000002 20260228000001 20260228000002` to mark them as applied, then re-ran `supabase db push --linked` which then only applied the new 20260228000003 migration successfully
- **Files modified:** None (supabase migration history table in production, no local files)
- **Verification:** `supabase db push --linked` completed with "Finished supabase db push", db dump confirmed both tables and RPC exist in production
- **Committed in:** 4991b5a (part of Task 1 commit — migration file itself)

---

**Total deviations:** 1 auto-fixed (blocking issue)
**Impact on plan:** Entirely a deployment infrastructure issue; no code changes required. The migration content itself was created exactly as planned.

## Issues Encountered

- Supabase migration history was out of sync with production because previous phases deployed migrations manually (outside the CLI workflow). Repaired with `supabase migration repair` which is the standard CLI mechanism for this scenario.

## Self-Check: PASSED

- `/Users/Naegele/dev/brain/supabase/migrations/20260228000003_create_import_routing_rules.sql` — FOUND
- `/Users/Naegele/dev/brain/supabase/functions/_shared/routing-engine.ts` — FOUND
- Commit `4991b5a` (Task 1) — FOUND
- Commit `efe155b` (Task 2) — FOUND

## User Setup Required

None - no external service configuration required. Migration deployed to production automatically via Supabase CLI.

## Next Phase Readiness

- `import_routing_rules` and `import_routing_defaults` tables are live in production with RLS
- `routing-engine.ts` is ready for future plans that need to test or extend condition types
- `runPipeline()` now routes automatically — all connectors using it (fathom, zoom, youtube, file-upload) get routing behavior without any changes to connector code
- Plan 18-02 (Rules UI) can now query `import_routing_rules` for CRUD operations
- Plan 18-04 (Default Destination UI) can now upsert `import_routing_defaults`

---
*Phase: 18-import-routing-rules*
*Completed: 2026-02-28*
