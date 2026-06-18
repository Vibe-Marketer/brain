---
status: resolved
trigger: "the bulk-refresh is still not functioning right.. it's not pulling them all in, probably need some sort of a \"status\" loading/working toast type message or something but it's also just not actually loading it like it should and they're not all updating."
created: "2026-06-02"
updated: "2026-06-02"
---

# Debug Session: bulk-refresh-not-functioning

## Symptoms

- expected_behavior: Bulk Fathom refresh should refresh every selected eligible Fathom call, show clear in-progress status while work is happening, and make updated call data visible after completion.
- actual_behavior: User reports bulk refresh still does not pull all selected calls in; some selected calls do not appear to update, and the current toast/status is not enough to tell whether work is still running or partially failed.
- error_messages: No specific error message reported for the current bulk run.
- timeline: Started after adding/detailing Fathom refresh support on 2026-06-02; single-call refresh now works, but bulk behavior remains unreliable or ambiguous.
- reproduction: Select multiple Fathom calls in the fourth pane bulk actions, run "Refresh from Fathom", observe that only some calls appear updated and status feedback is insufficient.

## Current Focus

- hypothesis: Bulk refresh is a client-side sequential loop over single-call refresh requests, counts some Fathom rows as refreshable even when they are missing required provider IDs, and lacks clear per-call progress/retry handling.
- test: Tighten eligibility, centralize bulk orchestration with pacing/retry-aware progress, and verify the updated frontend/service/edge-function path.
- expecting: Bulk refresh should only count actually refreshable rows, keep visible current/total status, retry rate-limited calls once, and report skips/failures accurately.
- next_action: resolved
- reasoning_checkpoint:
- tdd_checkpoint:

## Evidence

- timestamp: 2026-06-02
  observation: BulkActionToolbarEnhanced runs bulk refresh as a browser-side `for ... of` loop invoking `fathom-refresh` once per selected call. It previously showed only one initial loading toast and a final toast, with no per-call current/total progress.
  source: src/components/transcript-library/BulkActionToolbarEnhanced.tsx
- timestamp: 2026-06-02
  observation: FathomClient.fetchWithRetry retried only HTTP 429 and network errors. Earlier live probes saw Fathom return HTTP 503, which the refresh function could then exhaust into not-found/failed behavior instead of retrying as provider instability.
  source: supabase/functions/_shared/fathom-client.ts
- timestamp: 2026-06-02
  observation: Production rows showed many Daniel calls did receive `synced_at` from `fathom-refresh`, so at least some reported failures were a mix of ambiguous UI/status and visible-title-change mismatch rather than total refresh absence.
  source: production Supabase recordings query
- timestamp: 2026-06-02T20:15:12Z
  observation: The bulk toolbar counted any Fathom row with `canonical_uuid` as refreshable, but the edge function also requires `legacy_recording_id`; production data shows `148` current Fathom recordings with `legacy_recording_id IS NULL`, so the prior bulk UI was overstating what it could actually refresh.
  source: src/components/transcript-library/BulkActionToolbarEnhanced.tsx; supabase/functions/fathom-refresh/index.ts; production Supabase recordings query
- timestamp: 2026-06-02T20:15:12Z
  observation: There was no automated coverage for multi-call refresh orchestration, retry-after handling, or aggregate progress/failure reporting before this fix; only single-call/contract coverage existed.
  source: src/services/__tests__/sync-tab.service.test.ts; supabase/functions/fathom-refresh/__tests__/fathom-refresh.test.ts

## Eliminated

- hypothesis: Bulk refresh is purely unfinished background work after the toast completes.
  reason: The client loop awaits each refresh call and then shows the final toast only after the loop completes.
- hypothesis: Every missed refresh was a cache invalidation bug.
  reason: The bulk path already invalidated list/detail queries after completion; the real gaps were eligibility filtering, retry/backoff, and progress visibility.

## Resolution

- root_cause: Bulk Fathom refresh was not a true bulk operation. It iterated the single-call edge function client-side, counted some non-refreshable Fathom rows as eligible because it ignored missing `legacy_recording_id`, and had weak retry/progress handling, so rate limits or provider instability produced partial updates with poor operator feedback.
- fix: Tightened eligibility to require both `canonical_uuid` and `legacy_recording_id`, moved bulk refresh orchestration into `sync-tab.service.ts` with per-call progress updates, inter-call pacing, and one automatic retry on `FATHOM_RATE_LIMITED`, retried Fathom 502/503/504 transient provider failures in the shared Fathom client, and returned stable human-readable server messages so aggregate success/failure toasts are accurate.
- verification: `npx vitest run src/services/__tests__/sync-tab.service.test.ts`; `npx vitest run supabase/functions/fathom-refresh/__tests__/fathom-refresh.test.ts`; `deno check supabase/functions/fathom-refresh/index.ts`; `npm run type-check`; `npm run build`; `supabase functions deploy fathom-refresh --use-api`; production-data spot check via local env confirmed `148` Fathom rows currently lack `legacy_recording_id`.
- files_changed: `src/components/transcript-library/BulkActionToolbarEnhanced.tsx`, `src/services/sync-tab.service.ts`, `src/hooks/useFathomRefresh.ts`, `src/services/__tests__/sync-tab.service.test.ts`, `supabase/functions/_shared/fathom-client.ts`, `supabase/functions/fathom-refresh/index.ts`
