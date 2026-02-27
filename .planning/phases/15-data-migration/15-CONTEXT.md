# Phase 15: Data Migration - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Run the already-deployed migration infrastructure (recordings table, migrate_fathom_call_to_recording RPC, get_unified_recordings RPC) to completion. All existing fathom_calls data moves to the recordings table. RLS is verified with real JWTs. source_metadata is normalized for deduplication. fathom_calls is archived (renamed, not dropped). The new frontend reads exclusively from recordings after verification passes.

This is NOT new infrastructure — it's running existing v1 migration tooling to completion and verifying the results.

</domain>

<decisions>
## Implementation Decisions

### Migration behavior
- Single batch, offline — run once during a maintenance window, not incrementally
- Pause all imports (Fathom sync, Zoom sync, YouTube) during migration window — disable sync edge functions, re-enable after completion
- No dual-read transition — new frontend reads only from recordings after verification passes (clean cut)

### Edge case handling
- Clean during migration — apply defaults for NULLs: NULL title -> "Untitled Call", NULL duration -> 0, etc.
- Skip and log on row failures — log the failed row ID and error, continue migrating remaining rows, review failures after batch completes
- Do NOT halt the entire batch on a single failure

### Verification & rollback
- Automated verification script first: count comparisons, random row spot-checks, RLS tests with real JWTs
- Manual spot-check second: user personally compares 5-10 calls across old vs new frontend
- Create a second test user account for cross-tenant RLS verification
- Rollback approach: fix and re-run — delete bad rows from recordings, fix migration logic, run again (fathom_calls stays untouched until archive)

### Archive strategy
- Rename fathom_calls to fathom_calls_archive — just a safety net, not queryable
- 30-day clock starts when v2 goes live to real users (not from migration completion)
- Archive table dropped in Phase 22 (Backend Cleanup), NOT in Phase 15
- No RLS policies needed on archive table — it sits dormant

### Claude's Discretion
- Dry-run approach (DATA-05): Claude picks between production copy vs transaction rollback based on Supabase constraints and data volume
- Migration monitoring: Claude picks simplest approach that gives enough visibility (console logs vs migration_log table)
- Orphaned rows (no valid user): Claude picks based on data integrity
- source_metadata normalization depth: Claude picks what gives the best foundation for the connector pipeline (Phase 17)
- Edge functions that read fathom_calls: Claude decides whether to update them in Phase 15 or defer to Phase 17 connector pipeline normalization

</decisions>

<specifics>
## Specific Ideas

- User confirmed this phase is about running EXISTING infrastructure, not creating new tables — the recordings table and migration RPCs were built during v1 Phases 9-10
- Migration infrastructure already deployed: recordings table, migrate_fathom_call_to_recording(), get_unified_recordings RPC
- Google Meet removed entirely — DATA-03 covers only Fathom, Zoom, YouTube
- Same Supabase project: vltmrnjsubfzrgrtdqey.supabase.co

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 15-data-migration*
*Context gathered: 2026-02-27*
