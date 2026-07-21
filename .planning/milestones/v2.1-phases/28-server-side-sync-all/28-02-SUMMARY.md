---
phase: 28-server-side-sync-all
plan: 02
subsystem: api
tags: [supabase-edge, pager, checkpoint-resume, sync-jobs, provider-cursor, dual-auth, idempotency, 23505, idor, typescript]

# Dependency graph
requires:
  - phase: 28-server-side-sync-all (Plan 01)
    provides: types-only ListPageResult/ListPageParams/ListPageFn contract + RED resume/idempotency integration scaffolds
  - phase: 28-server-side-sync-all (Plan 03)
    provides: POPULATED connector-list-page-registry.ts (resolveListPage) the pager resolves against
  - phase: 24-sync-status-foundation
    provides: recordings_source_dedup org-scoped unique constraint + sync_jobs durable columns (provider_cursor, mode, organization_id, last_heartbeat_at)
  - phase: 27-observable-jobs
    provides: reaper + heartbeat net the per-slice heartbeat relies on
provides:
  - "connector-sync-all edge function: provider-agnostic one-page-per-invocation checkpoint/resume pager (SYNC-01)"
  - "Dual auth: JWT USER-START path + service-role CRON/RESUME path bound to the job row's stored org/user (IDOR boundary)"
  - "23505 unique-violation reclassified as skipped (SYNC-03); failed_ids holds only genuine errors"
  - "SLICE_ITEM_BUDGET const (conservative 20) owned here; Plan 04 tunes in place"
affects: [28-04 (cron resume-heartbeat + syncAll adapters; edits SLICE_ITEM_BUDGET in place), 28-05 (real-DB resume + idempotency proofs go GREEN after deploy)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One provider page per invocation; the sync_jobs row IS the resume point — never a whole-batch waitUntil loop (inverts the sync-meetings anti-pattern)"
    - "Opaque provider cursor round-tripped verbatim through sync_jobs.provider_cursor; pager never parses provider dialect"
    - "Within-page sub-batching: when a page exceeds SLICE_ITEM_BUDGET, encode a namespaced sub-page cursor ({c: providerCursor, o: offset}) so the next slice resumes mid-page"
    - "Self-chain via fire-and-forget functions.invoke (no JWT forwarded → next slice runs the service-role RESUME branch); pg_cron resume-heartbeat (Plan 04) re-kicks a dropped link"
    - "Dual auth by JWT presence: Authorization header → USER-START (authenticateRequest); absent → CRON/RESUME (load job row, bind to stored org/user)"
    - "Provider-agnostic item mapping: best-effort field extraction (id/title/start/transcript) across well-known keys into ConnectorRecord with org_id from the job row"

key-files:
  created:
    - supabase/functions/connector-sync-all/index.ts
  modified: []

key-decisions:
  - "org_id is written onto the sync_jobs row AT CREATION (USER-START path) and copied into every ConnectorRecord, so the org-scoped recordings_source_dedup constraint fires deterministically"
  - "Auth path is chosen by JWT presence: an Authorization header means USER-START; its absence (pg_net from cron) means the service-role RESUME branch, which loads the job row and authorizes off its stored organization_id/user_id — never a caller-supplied org (T-28-03/T-28-04 IDOR boundary)"
  - "RESUME rejects any job whose mode != 'all' or status != 'processing' (409) so a caller cannot advance another mode/terminal job"
  - "23505 detection is defensive (code, message substring, OR constraint name) because the Supabase thrown-insert error shape varies; the concurrent-slice loser is reclassified skipped, never failed"
  - "SLICE_ITEM_BUDGET is a single const (20) owned by this file; the slice loop is the sole reference; Plan 04 edits the value in place"
  - "Supabase client typed as `any` (matching _shared/connector-function-utils.ts convention) — strict generics otherwise infer .update() payloads as `never` and reject the live createClient() return shape"

patterns-established:
  - "Sub-page cursor: __subpage__:{json} namespace lets a slice resume inside a single oversized provider page without the provider ever seeing the wrapper"
  - "Job row is the single source of truth for cursor + synced_ids/failed_ids/skipped_count; every slice writes them before self-chaining so resume is exact and Phase 29 reads partial-success truth"

requirements-completed: [SYNC-01, SYNC-03]

# Metrics
duration: ~9min
completed: 2026-06-25
---

# Phase 28 Plan 02: connector-sync-all Checkpoint/Resume Pager Summary

**Provider-agnostic, resumable `connector-sync-all` edge function that processes exactly ONE provider page per invocation — resolving listPage from the populated registry, reusing runPipeline for idempotency, checkpointing `provider_cursor` + heartbeat each slice, self-chaining the next slice, reclassifying 23505 unique-violations as skipped, and authorizing both a JWT user-start and a service-role cron resume bound to the job row's stored org/user.**

## Performance

- **Duration:** ~9 min
- **Completed:** 2026-06-25
- **Tasks:** 2
- **Files modified:** 1 (1 created)

## Accomplishments
- Created `supabase/functions/connector-sync-all/index.ts` (574 lines) — the load-bearing correctness change for the milestone: "sync all" now actually syncs all, decoupled from UI scroll, resumable after a kill, with no duplicates under concurrency.
- **One page per invocation, never a batch loop.** Each invocation loads the job row, fetches exactly one page, upserts (capped at `SLICE_ITEM_BUDGET`), checkpoints `provider_cursor` + `last_heartbeat_at`, then self-chains or terminates. The `sync-meetings` whole-batch `EdgeRuntime.waitUntil` anti-pattern is provably absent (grep gate 0/0 for `maxPages` / page-loop).
- **Dual auth.** USER-START authenticates via `authenticateRequest`, Zod-validates the payload, runs `validateRequestedWorkspaceId` (IDOR gate reused from sync-meetings), resolves the user's personal org, and writes `organization_id` onto the job at creation. CRON/SERVICE-ROLE RESUME detects the absent JWT, loads the job row, and operates ONLY on its stored `organization_id`/`user_id` — rejecting non-`all`/non-`processing` jobs with a 409.
- **Idempotency (SYNC-03).** `runPipeline` `skipped` (duplicate) is success-equivalent; a 23505/unique-violation error is reclassified as `skipped` (the concurrent-slice loser path) via a defensive `isUniqueViolation` matcher — never pushed to `failed_ids`. `failed_ids` holds only genuine errors with uncoerced TEXT ids for Phase 29.
- **Sub-page resume.** When a single provider page exceeds the slice budget, a namespaced sub-page cursor (`__subpage__:{c,o}`) carries the provider cursor + within-page offset so the next slice continues mid-page (RESEARCH Finding 3).

## Task Commits

1. **Task 1: Dual-auth entry + one-page slice loop + cursor checkpoint** — `0484b06` (feat)
2. **Task 2: 23505 reclassification + skipped-not-failed + failure recording** — `2a9e24a` (feat)

## Files Created/Modified
- `supabase/functions/connector-sync-all/index.ts` (NEW) — the pager. Imports `resolveListPage` from the POPULATED `connector-list-page-registry.ts` (Plan 03), `runPipeline`/`ConnectorRecord` from `connector-pipeline.ts`, `authenticateRequest`, `validateRequestedWorkspaceId`/`getConnectorDateWindow`, `getDecryptedOAuthTokens`. Owns `SLICE_ITEM_BUDGET = 20`.

## Decisions Made
- **org_id at creation.** Written onto the job row in the USER-START path and copied into every `ConnectorRecord`, so the org-scoped `recordings_source_dedup` constraint is the deterministic dedup arbiter (not just the owner-scoped fast check).
- **Auth path by JWT presence.** `net.http_post` from cron carries no user JWT (RESEARCH Open Question 2 / locked cron-auth decision), so the absence of an `Authorization` header selects the service-role RESUME branch. This keeps the IDOR boundary explicit: the resume path never trusts caller-supplied org/user.
- **Defensive 23505 detection.** The Supabase thrown-insert error may surface the code on `error.code`, embed `duplicate key`/`unique constraint` in the message, or name `recordings_source_dedup` — `isUniqueViolation` matches all, not one exact substring (RESEARCH Pitfall 1).
- **`SupabaseClient = any`.** Matches the existing `_shared/connector-function-utils.ts` convention; the strict generics otherwise infer `.update()` payloads as `never`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Supabase client generic mismatch**
- **Found during:** Task 1 (deno check)
- **Issue:** Annotating helpers with the imported `SupabaseClient` type produced `Type '"public"' is not assignable to type 'never'` against the live `createClient()` return, and `.update()` payloads inferred as `never`.
- **Fix:** Replaced with `type SupabaseClient = any` (the documented connector-edge convention in `_shared/connector-function-utils.ts`) and removed the unused `import type { SupabaseClient }`.
- **Files modified:** supabase/functions/connector-sync-all/index.ts
- **Commit:** 0484b06

**2. [Rule 3 - Blocking] Implicit-any callback param + unused import**
- **Found during:** Task 1 (deno check)
- **Issue:** `.catch((err) => ...)` flagged `TS7006 implicitly any`; `resolveOAuthAccessToken` imported but unused (the generic decrypted-token read is used instead, since it has no per-provider refresh signature here); `validateRequestedWorkspaceId` imported twice.
- **Fix:** Typed `err: unknown`; consolidated the connector-function-utils import; dropped the unused `resolveOAuthAccessToken`.
- **Files modified:** supabase/functions/connector-sync-all/index.ts
- **Commit:** 0484b06

## Deferred Issues (out of scope)
- Two pre-existing `src/` type errors surface under `deno check` (`types.ts:42` readonly modifier; `source-registry.ts:262` `uiVisible`). Both are byte-identical on committed HEAD (also noted in 28-01) and are NOT introduced by this plan — the `connector-sync-all/index.ts` file itself type-checks clean. Logged to `deferred-items.md`.

## Verification
- One page per invocation; no `maxPages`/whole-batch loop — grep gate 0/0.
- Imports populated registry: `connector-list-page-registry` = 1; contract-only `connector-list-page.ts` NOT used for resolution.
- Positive greps: `authenticateRequest`=3, `provider_cursor`=7, `functions.invoke`=1, `runPipeline`=4, `SLICE_ITEM_BUDGET`=6.
- Task 2 greps: `23505`=3, `skipped_count`=7, `failed_ids`=7.
- No token/header logging (grep clean).
- `deno check` on the file: 0 errors in `connector-sync-all/index.ts` (2 pre-existing `src/` errors out of scope).
- **No DB push, no edge deploy, no origin push** (gated to 28-05).

## Known Stubs
None. The pager is fully wired (resolves real providers, decrypts the job owner's token, upserts via runPipeline). The real-DB resume + idempotency integration tests (28-01 scaffolds) remain RED/guard-skipped until 28-05 deploys and seeds TEST — by design, not faked.

## Next Phase Readiness
- **Plan 28-04 (cron resume-heartbeat + syncAll adapters)** can register the pg_cron job that POSTs `{ jobId }` (no JWT) to drive the RESUME path, and edit `SLICE_ITEM_BUDGET` in place from measured TEST latency. `connector-sync-all/index.ts` is already in 28-04's files_modified for that cross-plan touch.
- **Plan 28-05** runs the resume + idempotency proofs against the real TEST DB after deploy; the pager persists `provider_cursor`/`synced_ids`/`failed_ids`/`skipped_count` every slice exactly as those tests assert.

## Self-Check: PASSED

---
*Phase: 28-server-side-sync-all*
*Completed: 2026-06-25*
