# Phase 27: Observable Jobs - Context

**Gathered:** 2026-06-23
**Status:** Ready for planning
**Mode:** Decisions grounded in v2.1 research + Phase 24/26 outcomes

<domain>
## Phase Boundary

Import jobs are visible, trustworthy, and never vanish silently — progress survives refresh, failures persist, dead jobs get reaped, and there's a per-provider status indicator. Builds on the Phase 24 `sync_jobs` durable schema (already has `last_heartbeat_at`, scope columns) and plugs into the Phase 26 `<ImportSurface>` seams.

Requirements: JOB-01 (shared `useSyncJobs` poller hook on every import surface), JOB-02 (heartbeat + zombie-job reaper for stuck "processing"), JOB-03 (remove the unconditional 8-second auto-dismiss; failures persist), JOB-04 (Realtime push via `postgres_changes` + polling fallback), JOB-05 (persistent per-provider status indicator "Last synced X · N new · M failed").
</domain>

<decisions>
## Implementation Decisions

### Shared poller (JOB-01)
- One shared `useSyncJobs` hook (reads `sync_jobs`, org/user-scoped) used by the `<ImportSurface>` in BOTH the Import tab and Sync tab — replacing the SyncTab-only poller. Preserve/refactor the existing `useSyncTabState` job-status logic (preserved in Phase 26) into this shared hook; this is where the Phase-26 carry-forward (`useSyncTabState.ts:202` hardcoded `sourceApp: "fathom"`) gets fixed — thread real `source_app` + `organizationId`.

### Heartbeat + reaper (JOB-02)
- Long-running jobs write `last_heartbeat_at` periodically. A `pg_cron` reaper flips jobs whose heartbeat is stale (no update beyond a threshold while status='processing') to `failed`/`stale` so they stop being zombies. Model after the in-repo `embedding_queue` claim-table/stale-lock pattern. Reaper threshold: Claude's discretion grounded in Edge wall-clock (~400s) — e.g. heartbeat every ~30–60s, reap after ~5min of silence. Verify with a real-DB reaper integration test (a job with an old heartbeat gets reaped).

### Kill 8s auto-dismiss (JOB-03)
- Remove the unconditional 8-second `recentlyCompletedJobs` auto-dismiss (`useSyncTabState.ts:176`). Failed / `completed_with_errors` jobs PERSIST until the user dismisses/resolves them; only clean `completed` jobs may auto-fade (or require explicit dismiss — Claude's discretion, but failures must NOT vanish — that was the "no status to tell him what happened" complaint).

### Realtime (JOB-04)
- Supabase Realtime `postgres_changes` subscription on `sync_jobs` (already in the Realtime publication per Phase 24) to push job progress to the UI, with the existing polling as a FALLBACK (not a replacement). Per-user/org filtered. Do NOT use Broadcast (scale-only, out of scope).

### Per-provider status chip (JOB-05)
- A persistent indicator per provider: "Last synced X · N new available · M failed" — rendered in the `<ImportSurface>` (the seam left in Phase 26). Reads from the durable `sync_jobs` + canonical sync-status. Reuse/evolve the PRESERVED `SyncStatusIndicator.tsx` / `ActiveSyncJobsCard.tsx` from Phase 26 rather than rebuilding.

### Claude's Discretion
Exact heartbeat cadence + reap threshold; whether to fully merge SyncStatusIndicator/ActiveSyncJobsCard into the new hook or keep them as presentational; auto-fade behavior for clean-completed jobs.
</decisions>

<code_context>
## Existing Code Insights

### Reusable / preserved (from Phase 26)
- `useSyncTabState.ts` (PRESERVED in Phase 26 for this phase) — contains the existing job poller + the 8s auto-dismiss (line ~176) + the hardcoded `"fathom"` carry-forward (line ~202) to fix here.
- `SyncStatusIndicator.tsx`, `ActiveSyncJobsCard.tsx` (PRESERVED) — the job-status UI to evolve into JOB-05.
- `src/components/import/ImportSurface.tsx` — has Phase 27 seams/mount-points left in.
- Phase 24 `sync_jobs` schema (last_heartbeat_at, source_app, org/workspace, status incl. completed_with_errors/failed) + it's in the Realtime publication.
- `embedding_queue` migration — the in-repo pg_cron + stale-lock reaper reference pattern.

### Established patterns
- Service+Hook separation; TanStack Query for polling; Supabase Realtime postgres_changes already used in the codebase (useSyncTabState).
- Additive migrations only; prod ref vltmrnjsubfzrgrtdqey guard; .env=PROD vs .env.test.

### Integration points
- The reaper is a pg_cron job (DB) + the heartbeat writes come from the sync-meetings / future sync-all job processors.
- The shared hook + status chip render in `<ImportSurface>`.
</code_context>

<specifics>
## Specific Ideas

Andrew's ask: "we need more visibility into the status of the imports… a status indicator… make the customer feel like all their content is being synced without worry." JOB-05's per-provider chip + JOB-01's always-visible progress + JOB-03's persistent failures are the direct answer. The reaper (JOB-02) ensures a job that silently died (the "nothing actually imported" surprise) becomes a VISIBLE failed state, not a zombie.
</specifics>

<deferred>
## Deferred Ideas

- The server-side sync-all job that the reaper/heartbeat protect is Phase 28 (SYNC) — this phase makes jobs observable; Phase 28 creates the big resumable job. Ensure the heartbeat/reaper contract is ready for Phase 28 to write into.
- Partial-success/retry UI is Phase 29 (FAIL) — this phase persists failures visibly; Phase 29 adds the retry-failures action.
- Realtime Broadcast (scale-only) — out of scope.
</deferred>
