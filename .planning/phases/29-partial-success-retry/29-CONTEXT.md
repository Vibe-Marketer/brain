# Phase 29: Partial-Success & Retry - Context

**Gathered:** 2026-06-30
**Status:** Ready for planning
**Mode:** Decisions grounded in v2.1 research + Phase 27/28 outcomes (final phase)

<domain>
## Phase Boundary

After an import, the user sees exactly what happened and can retry ONLY the failures — never a vanishing toast, never a full-batch replay. Builds on Phase 27 (persistent failures in SyncJobBanner — no 8s dismiss) + Phase 28 (sync-all records failed_ids/skipped_count) + Phase 24 idempotency (retry can't duplicate) + the existing single-call retry path.

Requirements: FAIL-01 (partial-success surfaced where the import was triggered — "18 of 30 imported, 12 failed" — reading completed_with_errors/failed_ids, not a vanishing success toast), FAIL-02 (retry only the failures: retry set = requested − synced, wired to the existing single-call retry path).
</domain>

<decisions>
## Implementation Decisions

### Partial-success display (FAIL-01)
- The SyncJobBanner (Phase 27) already persists failed / completed_with_errors jobs. This phase makes that banner render the precise breakdown: "{synced} of {requested} imported, {failed} failed" from the job's counts (synced_count / requested / failed_ids.length / skipped_count). It must appear WHERE the import was triggered (the ImportSurface banner seam), and persist (no timer — Phase 27 already removed the 8s dismiss).
- Distinguish failed (genuine errors, retryable) from skipped (already-synced duplicates, NOT failures — Phase 28's 23505→skipped). Skipped is informational, not an error to retry.

### Retry-failures-only (FAIL-02)
- A "Retry failed" action on the banner that re-attempts ONLY the failure set (retry set = requested − synced, i.e. the failed_ids — NOT the already-synced or skipped). Wire to the EXISTING single-call retry path (sync-meetings accepts a singleCallId / the existing per-call import) — do NOT build a new import path. For a sync-all job's failures, retry the failed_ids set.
- Idempotent by construction (Phase 24 unique constraint) — retrying a call that actually did import is a no-op/skip, never a duplicate.
- After retry, the banner/counts update via the Phase 27 observable-jobs hook (Realtime/poll) — successful retries drop out of the failed set.

### Claude's Discretion
Exact retry affordance (per-job "Retry failed (N)" button vs per-row retry); whether retry creates a new small sync_jobs row or reuses the existing per-call path directly; copy wording. All grounded in the existing retry path + Phase 27 banner.
</decisions>

<code_context>
## Existing Code Insights

### Reusable
- Phase 27 `SyncJobBanner.tsx` + `useSyncJobs` hook (persistent failures; activeJobs/terminalJobs) — extend the banner with the breakdown + retry action.
- Phase 28 sync-all job records failed_ids + skipped_count on sync_jobs.
- `sync_jobs` schema: status (completed_with_errors/failed), failed_ids, skipped_count, requested/synced counts (verify exact column names in the schema).
- The EXISTING single-call retry path: `sync-meetings` accepts a singleCallId (per the v2.1 SystemsThinking analysis — "sync-meetings already accepts singleCallId") and there's a `FailedImportsSection` / `useFailedImports` hook that already exists but wasn't wired to the happy path. Reuse/wire these.
- Phase 24 idempotency unique constraint (no dup on retry).

### Constraints
- Frontend changes batched to milestone-end push (build green, not pushed). Any backend retry-RPC change (if needed) deploys per-phase with checkpoint. Remix Icons only; never coerce IDs (failed_ids are TEXT source_call_ids).
</code_context>

<specifics>
## Specific Ideas

This directly closes John's exact complaint: he imported, "only some actually did," and there was no status. Phase 27 made failures visible + persistent; Phase 29 tells him precisely "18 of 30 imported, 12 failed" and lets him retry just the 12 with one click — idempotent, no dupes, no full replay. This is the last piece of the "seamless, trustworthy import" goal.
</specifics>

<deferred>
## Deferred Ideas

- Auto-retry / backoff on transient failures — out of scope (manual retry only for v2.1).
- The frontend push to prod is batched to milestone-end (operator review) per the v2.1 deploy decision.
</deferred>
