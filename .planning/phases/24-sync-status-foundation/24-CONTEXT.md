# Phase 24: Sync-Status Foundation - Context

**Gathered:** 2026-06-18
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

One durable, provider-agnostic answer to "is this call synced?", plus the schema and idempotency constraints every later v2.1 phase reads and writes against. Delivers: (1) a canonical sync-status reader on `recordings.(source_app, source_call_id)` TEXT, no numeric coercion; (2) an org-scoped unique constraint `(organization_id, source_app, source_call_id)`; (3) an additive `sync_jobs` migration adding `source_app`, org/workspace scope, `mode`, date range, `provider_cursor`, `last_heartbeat_at`, with org-scoped RLS, `CROSS_ORG_TABLES` registration, and Realtime publication whitelist; (4) reconciliation of legacy `fathom_calls` into `recordings` truth, verified by a real-DB test. No user-facing UI in this phase.

Requirements: IMP-01, IMP-02, IMP-03, IMP-04.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — this is a pure data-model/infrastructure phase. Use the converged research (`.planning/research/ARCHITECTURE.md`, `PITFALLS.md`, `STACK.md`), the ROADMAP success criteria, and codebase conventions to guide decisions.

### Non-negotiable constraints (from PROJECT.md + research)
- **Additive migrations only** against prod (ref `vltmrnjsubfzrgrtdqey`): `ADD COLUMN IF NOT EXISTS`, never mutate/retype columns in-flight jobs depend on. Run old + new consumers in parallel during cutover.
- **Dual recording-ID system:** `source_call_id` is TEXT — never `parseInt`/`Number()`/coerce. Route cross-ID work through `toRecordingUuid`/`toRecordingUuidBatch` (`src/lib/recording-ids.ts`).
- **Real-DB reconciliation test mandatory** (IMP-04) — mocked tests passed for this exact bug class in the prior Phase 30/BUG-01 incident, so the test must hit a real DB.
- Org-scoped RLS on `sync_jobs`; register in `CROSS_ORG_TABLES`; add new columns to the Realtime publication whitelist.
- `.env` (PROD) vs `.env.local`/`.env.test` (TEST) — any migration/DDL reads `.env` and must verify the prod ref before connecting.

</code_context>

<code_context>
## Existing Code Insights

### Reusable Assets
- `fetchSyncedCalls` already reads `recordings.source_call_id` correctly (the canonical pattern to generalize).
- `connector-pipeline.checkDuplicate` already dedups on `source_call_id` — mirror its truth.
- `embedding_queue` migration is the in-repo claim-table reference pattern (for later SYNC phase, not this one).

### Established Patterns
- Service+Hook separation (src/services pure fns, src/hooks TanStack Query wrappers).
- Migrations in `supabase/migrations/`; prod ref-guarded runner at `~/dev/autopilot/src/gsd-runner.ts`.

### Integration Points
- `checkSyncedRecordingIds` (sync-tab.service.ts) is the broken Fathom-only/`parseInt` reader to replace with the canonical provider-agnostic one.
- `CROSS_ORG_TABLES` array (RLS regression suite) must gain `sync_jobs`.

</code_context>

<specifics>
## Specific Ideas

Proposed canonical reader name from research: `getSyncStatusForExternalIds` on `recordings.(source_app, source_call_id)`. Demote legacy `fathom_calls` to write-only source-detail. Confirm the `fathom_calls → recordings` backfill path (`canonical_recording_id` bridge) and orphan reconciliation during plan-phase research before flipping the read.

</specifics>

<deferred>
## Deferred Ideas

None — phase scope is the data-model foundation only. UI consumption of the canonical reader lands in Phases 26–27.

</deferred>
