---
phase: 28-server-side-sync-all
plan: 04
subsystem: api
tags: [pg-cron, pg-net, resume-heartbeat, per-environment-host, sync-jobs, slice-budget, connector-adapter, syncAll, import-surface, supabase-edge, react]

# Dependency graph
requires:
  - phase: 28-server-side-sync-all (Plan 02)
    provides: connector-sync-all pager (dual-auth USER-START + service-role RESUME branch) + SLICE_ITEM_BUDGET const this plan tuned in place
  - phase: 28-server-side-sync-all (Plan 03)
    provides: 6 populated listPage impls + connector-list-page-registry the pager resolves against
  - phase: 27-observable-jobs
    provides: sync_jobs reaper (5-min fail) + useSyncJobs banner/chip surface the resume-heartbeat sits earlier than and the button reports through
  - phase: 24-sync-status-foundation
    provides: sync_jobs durable columns (provider_cursor, mode, last_heartbeat_at, organization_id)
provides:
  - "Additive per-environment pg_cron 'sync-all-resume-heartbeat' (every minute, 2-min stale): re-kicks stalled processing mode='all' jobs via net.http_post (no Authorization header) BEFORE the 5-min reaper fails them"
  - "Per-environment cron host via current_setting('app.supabase_url', true) — no hardcoded prod ref, so a TEST-applied cron targets TEST and a PROD one targets PROD (T-28-18)"
  - "SLICE_ITEM_BUDGET tuned in place (20 -> 25) from per-item-cost analysis; sub-paging bounds slice latency regardless of provider page size"
  - "syncAll on the 6 list-API adapters (Fathom/Grain/Zoom/Read.ai/Fireflies/Plaud); youtube/file-upload leave it undefined"
  - "ImportSurface 'Sync all from <provider>' button wired to the start path; progress via the Phase-27 banner/chip (no new query)"
affects: [28-05 (real-DB resume + idempotency proofs; pushes the migration prod-ref-guarded + deploys the edge fn + frontend)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-environment cron host: current_setting('app.supabase_url', true) (the fathom-reconcile precedent), NEVER the google-poll-cron prod-ref fallback — keeps a TEST cron from driving PROD"
    - "Resume-heartbeat fires EARLIER (2min) than the reaper (5min) so a dropped self-chain link is re-advanced, not failed"
    - "createSyncAll factory mirrors createSelectedImporter but passes NO enumerated ids — the SERVER enumerates every page; client only names source + date window"
    - "canSyncAll capability flag gates the button uniformly across all 7 providers (youtube/file-upload fall through to 'imports automatically')"

key-files:
  created:
    - supabase/migrations/20260625120000_sync_all_resume_heartbeat.sql
  modified:
    - supabase/functions/connector-sync-all/index.ts
    - src/components/connectors/registry/adapters/adapter-helpers.ts
    - src/components/connectors/registry/adapters/fathom.ts
    - src/components/connectors/registry/adapters/grain.ts
    - src/components/connectors/registry/adapters/zoom.ts
    - src/components/connectors/registry/adapters/read-ai.ts
    - src/components/connectors/registry/adapters/fireflies.ts
    - src/components/connectors/registry/adapters/plaud.ts
    - src/lib/connector-capabilities.ts
    - src/components/import/ImportSurface.tsx

key-decisions:
  - "Host derivation copies the fathom-daily-reconcile cron (current_setting('app.supabase_url', true)), the codebase's prod-ref-FREE per-environment mechanism — deliberately NOT the google-poll-cron pattern that hardcodes the prod ref as a fallback (that would let a TEST cron POST to PROD, T-28-18)"
  - "Cron predicate adds AND current_setting('app.supabase_url', true) IS NOT NULL/'' so an unconfigured environment no-ops harmlessly instead of POSTing to a NULL/garbage URL — the Phase 27 reaper remains the net there"
  - "SLICE_ITEM_BUDGET set to 25 from per-item-cost analysis (no live TEST credentials in this env to wall-clock); sub-paging makes the value robust to page-size outliers (Zoom 300/page -> 12 slices of 25; Read.ai 10/page never sub-pages). Plan 05 can confirm/raise from cron.job_run_details."
  - "createSyncAll is one shared factory; source_app is the only per-provider difference, so all 6 adapters use a single line"
  - "Button placed at the existing Phase-28 seam inside the canImportSelected block (all 6 list-API providers have both importSelected AND syncAll); gated on canSyncAll so it never renders for youtube/file-upload"

patterns-established:
  - "Resume-heartbeat-before-reaper: a self-chain safety net that RE-ADVANCES (not fails) a stalled job, sitting between the self-chain (fast) and the reaper (give-up)"
  - "Server-enumerates sync-all: the client sync-all path passes source + window only, never enumerated ids — distinct from importSelected"

requirements-completed: [SYNC-01, SYNC-02]

# Metrics
duration: ~6min
completed: 2026-06-25
---

# Phase 28 Plan 04: Resume-Heartbeat Cron + Adapter syncAll + Sync-All Button Summary

**An additive, per-environment pg_cron resume-heartbeat that re-kicks stalled `processing` sync-all jobs two minutes before the Phase-27 reaper would fail them — its target host derived from `current_setting('app.supabase_url', true)` so a TEST-applied cron can never drive PROD — plus the SLICE_ITEM_BUDGET tuned in place, `syncAll` on all six list-API adapters, and the "Sync all from this provider" button wired into the existing ImportSurface seam (build-green, not pushed).**

## Performance
- **Duration:** ~6 min
- **Started:** 2026-06-25T20:18:59Z
- **Completed:** 2026-06-25T20:25:03Z
- **Tasks:** 2
- **Files modified:** 10 (1 created, 9 modified)

## Accomplishments
- **Resume-heartbeat cron (the safety net):** `supabase/migrations/20260625120000_sync_all_resume_heartbeat.sql` registers one additive pg_cron job (`sync-all-resume-heartbeat`, `* * * * *`) that `net.http_post`s `{ jobId }` (NO Authorization header → the service-role RESUME branch) to `connector-sync-all` for every sync-all job that is `status='processing' AND mode='all' AND provider_cursor IS NOT NULL AND last_heartbeat_at < NOW() - INTERVAL '2 minutes'`. It fires earlier than the 5-min reaper, so a job whose self-chain link dropped is RE-ADVANCED rather than failed.
- **Per-environment host (the W4 / T-28-18 fix):** the cron URL is `current_setting('app.supabase_url', true) || '/functions/v1/connector-sync-all'` — the prod-ref-free mechanism the fathom-daily-reconcile cron already uses. Grep for the prod ref literal `vltmrnjsubfzrgrtdqey` in the migration = **0**. A TEST-applied cron resolves to the TEST host, a PROD-applied one to PROD. An unconfigured env no-ops (predicate excludes NULL/empty host) — never a prod fallback.
- **Slice budget tuned in place:** `SLICE_ITEM_BUDGET` 20 → 25 in `connector-sync-all/index.ts` (the const Plan 02 owns), with the per-provider latency reasoning recorded in the const doc-comment. Because an oversized page is carved into sub-page slices, per-slice wall-clock is bounded by `budget × per-item runPipeline cost` (~1.3–3.8s at 25) regardless of provider page size — Read.ai (10/page, never sub-pages) and Zoom (300/page → 12 slices of 25) both stay well under 150s.
- **6 adapter syncAll impls:** new `createSyncAll` factory + one line each on fathom/grain/zoom/read-ai/fireflies/plaud. youtube/file-upload leave `syncAll` undefined (verified absent).
- **Sync-all button:** `canSyncAll` added to capabilities; ImportSurface renders a hollow "Sync all from <provider>" button (Remix `RiRefreshLine`) at the existing Phase-28 seam, passing only the current date window. Progress shows through the already-mounted Phase-27 `SyncJobBanner` / `PerProviderSyncChip` — no new query.

## Task Commits
1. **Task 1: per-env resume-heartbeat cron + SLICE_ITEM_BUDGET tune** — `3a1db18` (feat)
2. **Task 2: 6 adapter syncAll + Sync-all button** — `73ecbd9` (feat)

## Slice-Latency Measurement (RESEARCH A1)
No live TEST provider credentials were available in this execution environment (no deploy / no DB push — gated to 28-05), so the budget was set from per-item-cost analysis rather than a measured wall-clock run, and recorded as such:

| Provider | Page size | Sub-pages per page @25 | Est. slice wall-clock | Headroom vs 150s |
|----------|-----------|------------------------|------------------------|------------------|
| Read.ai  | ~10/page  | 0 (page ≤ budget)      | ~0.5–1.5s              | huge |
| Fathom   | ~50/page  | 2 slices of 25         | ~1.3–3.8s/slice        | huge |
| Grain    | ~10–50    | 0–1                    | ~0.5–3.8s              | huge |
| Fireflies| ~50/page  | 2 slices of 25         | ~1.3–3.8s/slice        | huge |
| Plaud    | offset    | per offset window      | ~1.3–3.8s/slice        | huge |
| Zoom     | 300/page  | 12 slices of 25        | ~1.3–3.8s/slice        | huge |

Per-item cost basis: runPipeline = 1 owner-scoped dedup read + 1 upsert (~50–150ms observed; transcript-heavy at the top of the band). Plan 05 can confirm/raise the budget from real `cron.job_run_details` after deploy.

## Decisions Made
- **fathom-reconcile host pattern, not google-poll.** The codebase has two cron-host patterns: fathom-reconcile (`current_setting`, prod-ref-free) and google-poll (`current_setting` WITH a hardcoded prod-ref fallback). Chose the former so the prod-ref literal is provably absent and a TEST cron physically cannot reach PROD.
- **No-op when host unset.** Added `current_setting(...) IS NOT NULL/''` to the cron predicate so an environment that never set the GUC silently does nothing (the reaper covers it) instead of POSTing to a NULL URL.
- **SLICE_ITEM_BUDGET = 25.** Modest bump from 20 for throughput; sub-paging insulates it from page-size outliers. Set from analysis (no live creds), intentionally conservative.
- **Button at the existing seam, gated on canSyncAll.** All 6 list-API providers have both `importSelected` and `syncAll`, so the existing `canImportSelected` seam is the right slot; the `canSyncAll` gate keeps youtube/file-upload on "imports automatically".

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ImportSurface path mismatch in plan frontmatter**
- **Found during:** Task 2
- **Issue:** The plan's `files_modified` lists `src/components/connectors/import/ImportSurface.tsx`, but the file actually lives at `src/components/import/ImportSurface.tsx` (the path the plan's own `<read_first>` uses). The `connectors/import/` directory has no ImportSurface.
- **Fix:** Edited the real file at `src/components/import/ImportSurface.tsx`. No new file created at the wrong path.
- **Files modified:** src/components/import/ImportSurface.tsx
- **Commit:** 73ecbd9

**2. [Rule 2 - Missing critical functionality] canSyncAll capability flag**
- **Found during:** Task 2
- **Issue:** `getConnectorCapabilities` exposed canSearchAvailable/canImportSelected but no canSyncAll, so the button had no clean uniform gate (would have required ad-hoc `Boolean(adapter.syncAll)` inline).
- **Fix:** Added `canSyncAll` to `ConnectorCapabilities` + `getConnectorCapabilities`, mirroring the existing flags. The button gates on it.
- **Files modified:** src/lib/connector-capabilities.ts
- **Commit:** 73ecbd9

## Deferred Issues (out of scope)
- Two pre-existing `src/` type errors surface under `deno check` of the edge function (`types.ts:42` readonly modifier; `source-registry.ts:262` `uiVisible`). Both are byte-identical on committed HEAD and documented in the 28-02 SUMMARY's Deferred Issues — NOT introduced by this plan. `connector-sync-all/index.ts` itself type-checks clean (the change was a `20`→`25` literal swap). Out of scope.

## Verification
- Migration: `sync-all-resume-heartbeat` present (8); destructive DDL (ALTER/DROP) on non-comment lines = **0**; prod-ref literal `vltmrnjsubfzrgrtdqey` = **0**; `net.http_post` present (3); `current_setting('app.supabase_url')` host derivation present (4); the two "Authorization" matches are both comments stating NO Authorization header is sent.
- `SLICE_ITEM_BUDGET` refs = 8; value line = `const SLICE_ITEM_BUDGET = 25;`.
- 6 adapters `syncAll` = 1 each; youtube/file-upload `syncAll` = 0 (files exist, intentionally absent); ImportSurface `syncAll` = 3 (capability + handler + button).
- `npm run build` exit **0** on the committed tree; only the pre-existing chunk-size warning. OAUTH_CALLBACK_ROUTES (derived from SOURCE_REGISTRY, untouched) non-empty — boot-crash guard holds.
- **No DB push, no edge deploy, no origin push** (gated to 28-05).

## Known Stubs
None. The migration, the budget tune, the 6 adapters, and the button are fully wired. The cron is authored but un-applied by design (Plan 05 pushes it prod-ref-guarded and verifies the TEST cron targets TEST).

## Threat Flags
None — no new network endpoint, auth path, or trust-boundary surface beyond what the plan's `<threat_model>` already covers (T-28-11/12/13/14/18).

## Self-Check: PASSED
- All 6 created/modified key files verified present on disk.
- Both task commits (3a1db18, 73ecbd9) verified in git log.

---
*Phase: 28-server-side-sync-all*
*Completed: 2026-06-25*
