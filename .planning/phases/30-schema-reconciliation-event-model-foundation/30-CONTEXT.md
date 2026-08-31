# Phase 30: Schema Reconciliation + Event Model Foundation - Context

**Gathered:** 2026-08-31
**Status:** Ready for planning
**Mode:** Infrastructure phase — smart discuss skipped (goal keyword "migration"/"reconciliation", all-technical success criteria, zero user-facing behavior described)

<domain>
## Phase Boundary

The event layer exists in the schema — truthfully — and changes no current behavior. This is the load-bearing foundation for the entire v2.2 milestone; F16/F17 (schema truth gaps between `supabase/migrations/` and the live database) mean the schema must be made truthful before a single new migration is authored.

In scope: regenerating `src/types/supabase.ts` from the live database and reconciling it against `supabase/migrations/`; creating the `events` table (UUID-keyed, canonical start/end/resolution-confidence, no content columns); adding nullable `recordings.event_id`; extending `call_participants` with `event_id`, a role value, and `has_confirmed_speech`; registering `events` and extended `call_participants` in the `CROSS_ORG_TABLES` CI gate; writing `events` RLS so visibility is granted through participation or an owned capture, never `organization_id`.

Out of scope for this phase: any matching/resolution logic (Phase 31+), any UI, any behavior change while `event_id` is NULL — EVT-03 requires `get_workspace_recordings`, `global_search`, chat, and MCP to return byte-identical results in the NULL case, proven by test.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — this is a pure infrastructure phase (schema truthfulness + additive schema foundation), no user-facing behavior to decide on. Governing constraints, already locked in the spec and requirements docs (not open questions):
- Forward-only, additive only: `IF NOT EXISTS` everywhere, every new column nullable, every existing RPC signature preserved (per REQUIREMENTS.md Constraints, spec Decisions Made #3).
- `events` lives in the same Supabase Postgres database as `recordings` — no physical separation. It is simply the first non-org-scoped table; RLS grants via participation/ownership, never `organization_id` (EVT-04; resolved Open Question 1, spec Decisions Resolved).
- SAFE-07 must run first and resolve F16 (migration folder ≠ schema truth: `recordings`/`organizations`/`workspaces` not created by any committed migration; `20260228000001` references nonexistent `public.vaults`) and F17 (`supabase.ts` missing `ai_generated_title`/`ai_title_generated_at`) before any new migration is authored.
- Follow the `COALESCE`-then-fallback reader pattern from `20260618160000_recordings_canonical_ai_title.sql` as the model for EVT-03's byte-identical-when-NULL guarantee.
- Event reads join through `workspace_entries` (EVT-07) — `recordings` has no `workspace_id` column and none should be assumed or added.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `call_participants` table already exists with `recording_id`, `organization_id`, `email`, `name`, `participant_type`, `sources: string[]` — extend it, do not create a parallel table (F7).
- `split_recording_atomic` — precedent for atomic multi-table transactional migrations/operations, reusable pattern for later phases but relevant now as the style precedent.
- `20260730160000_fix_cross_org_copy_dedup.sql` — most recent migration touching `recordings` dedup; read for current dedup-constraint shape (`recordings_source_dedup (organization_id, source_app, source_call_id)`).
- Existing `CROSS_ORG_TABLES` CI gate array — extend with `events` and `call_participants`, don't duplicate the mechanism.

### Established Patterns
- Migration file structure per `supabase/CLAUDE.md`: `YYYYMMDDHHMMSS_descriptive_name.sql`, header comment block (Migration/Purpose/Author/Date), `TABLE`/`INDEXES`/`ROW LEVEL SECURITY`/`RLS POLICIES`/`COMMENTS` sectioned with `====` banners.
- snake_case for all DB fields.
- Migrations affecting production read `DATABASE_URL` from `.env` and must verify the prod ref (`vltmrnjsubfzrgrtdqey`) before connecting — established repo-wide convention, independent of git branch.

### Integration Points
- `_shared/canonical-recording.ts` is the ingest seam — resolution will hook here in Phase 31+, not this phase, but Phase 30's `event_id` column is what that future hook will populate.
- `dedup-fingerprint.ts` — Zoom-only, user-scoped today (F4); not touched in Phase 30, but its future provider-agnostic replacement (Phase 32) depends on the `events`/`call_participants` schema landing correctly here.

</code_context>

<specifics>
## Specific Ideas

No specific UI or behavior requirements — infrastructure phase. The one hard constraint carried from the branch-discipline decision (PROJECT.md Key Decision, 2026-08-31): this phase executes on the `v2.2-event-resolution` branch, not `main`, and the branch is already cut.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope (skipped; infrastructure-only).

</deferred>
