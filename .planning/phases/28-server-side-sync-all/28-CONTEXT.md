# Phase 28: Server-Side Sync-All - Context

**Gathered:** 2026-06-25
**Status:** Ready for planning
**Mode:** Decisions grounded in v2.1 research; HIGHEST-RISK phase (spike-flagged)

<domain>
## Phase Boundary

"Sync all from this provider" actually syncs every call in the date range — the SERVER pages the provider itself, decoupled from what the UI has scrolled, and resumes if interrupted. This is the load-bearing correctness change that fixes "only some imported, nothing told me." Builds on: Phase 24 `sync_jobs` durable schema (provider_cursor, mode, date_start/end, scope cols), Phase 27 heartbeat+reaper (protect/observe the long job), Phase 25 select-all-matching descriptor (client twin), Phase 26 ImportSurface (sync-all affordance seam).

Requirements: SYNC-01 (resumable checkpoint/resume pager — one provider page per invocation, persist provider_cursor, self-chain + pg_cron heartbeat; NOT one long waitUntil batch loop), SYNC-02 (optional `syncAll` adapter-contract entry — implemented by list-API providers Fathom/Zoom/Fireflies/Grain/Read.ai; undefined for webhook/manual-only PLAUD/YouTube/file-upload), SYNC-03 (idempotent on source_call_id, safe concurrent with selective import — no duplicates).
</domain>

<decisions>
## Implementation Decisions

### The pager (SYNC-01) — checkpoint/resume, NOT one long loop
- A new edge function (e.g. `connector-sync-all`) processes ONE provider page per invocation: fetch a page → upsert new calls via the shared connector-pipeline (dedup on source_call_id) → persist `provider_cursor` + progress to `sync_jobs` → self-chain (re-invoke for the next page) OR let a pg_cron driver pick it up. Must NOT run the whole batch inside one EdgeRuntime.waitUntil (shares the ~400s ceiling and silently dies — the existing sync-meetings anti-pattern). Heartbeat each slice (Phase 27 reaper reaps it if it dies).
- Self-chaining mechanism: Claude's discretion — either the function re-invokes itself (fetch to its own URL) per slice, OR a pg_cron driver advances 'processing' sync-all jobs with a saved cursor. Prefer whichever is simplest + most crash-resilient; the reaper already exists as the safety net.
- Queue substrate: pgmq vs the in-repo embedding_queue claim-table — DECIDE during plan based on the spike. Default to the simplest that works for a single-cursor pager (the claim-table pattern is already in-repo and proven). Do NOT add an external vendor.

### Adapter contract (SYNC-02)
- Add optional `syncAll` to the provider adapter contract (registry/types.ts). Implement for list-API providers: Fathom, Zoom, Fireflies, Grain, Read.ai — ONLY those whose list endpoints expose date-range + cursor paging (CONFIRM each in research/spike). Leave undefined for PLAUD/YouTube/file-upload (webhook/manual-only — surface "imports automatically" instead of a sync-all button).

### Idempotency (SYNC-03)
- The pager upserts through the shared connector-pipeline which dedups on (organization_id, source_app, source_call_id) — the Phase 24 unique constraint guarantees no duplicates even if sync-all runs concurrently with a user's selective import, or a slice retries after a crash. Verify with a real-DB test (concurrent selective import + sync-all → one row per call).

### UI seam (from Phase 26)
- The ImportSurface has a sync-all affordance seam + the Phase 25 select-all-matching descriptor as the client twin. Wire the "Sync all from this provider" button to create a sync-all `sync_jobs` row; progress shows via the Phase 27 observable-jobs banner/chip. (Frontend wiring batched to milestone-end push; backend pager deploys this phase.)

### Claude's Discretion
Self-chain vs cron-driver; pgmq vs claim-table; per-provider chunk/page size (size to stay well under ~400s per slice — spike to measure); exact cursor encoding per provider.
</decisions>

<code_context>
## Existing Code Insights

### Reusable
- Phase 24 `sync_jobs` columns: provider_cursor, mode, date_start, date_end, organization_id, workspace_id, source_app, last_heartbeat_at, status (incl. completed_with_errors/failed).
- `supabase/functions/sync-meetings/index.ts` — the EXISTING per-recording pager (the anti-pattern to NOT copy: maxPages=100 inside one waitUntil). Reuse its provider-fetch + connector-pipeline upsert, invert so the SERVER owns the cursor + checkpoints.
- `supabase/functions/_shared/connector-pipeline.ts` — runPipeline / checkDuplicate (dedups on source_call_id) — reuse verbatim for idempotency.
- `embedding_queue` migration — in-repo claim-table + pg_cron driver precedent.
- Phase 27 reaper (`reap_stale_sync_jobs` + `sync-jobs-reaper` cron) — already protects long 'processing' jobs.
- Provider fetch fns: `fetch-*` / `*-sync-meetings` edge fns per provider — research must confirm which expose date-range + cursor list endpoints.
- registry/types.ts — adapter contract (searchAvailable/importSelected; add syncAll?).

### Constraints
- Additive migrations only; .env=PROD ref vltmrnjsubfzrgrtdqey vs .env.test; edge deploy `--use-api` (Docker-less). Never coerce IDs (source_call_id TEXT). Edge wall-clock ~400s/150s — size slices well under.
</code_context>

<specifics>
## Specific Ideas

This is the direct fix for Andrew's core complaint: "a better way to be able to sync all calls… make the customer feel like all their content is being synced without worry." Server-side sync-all means the customer clicks once and the BACKEND fetches every page, resuming if interrupted, with the Phase 27 status surface showing progress — no "click more 10 at a time," no silent mid-run death.
</specifics>

<deferred>
## Deferred Ideas

- Frontend "Sync all" button wiring lands in code this phase but the FRONTEND push is batched to milestone-end (operator review). The backend pager + adapter + migration deploy this phase.
- Scheduled auto-sync (AUTO-01) — out of scope (Future Requirements).
- Partial-success/retry-failures UI — Phase 29 (FAIL); but the sync-all job must record failed_ids so Phase 29 can surface/retry them.
</deferred>
