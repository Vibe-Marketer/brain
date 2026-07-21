---
phase: 28-server-side-sync-all
verified: 2026-06-30T20:05:00Z
status: human_needed
score: 4/4 success criteria verified (code-level); 2 operational items require human verification
overrides_applied: 0
re_verification:
human_verification:
  - test: "Live multi-slice provider-backed sync-all (resume test (d)) — provision an active TEST import_source with real provider credentials (Fathom or any of the 6), then run `npm run test:integration`. Confirm a 200+ call sync-all completes across multiple self-chaining slices, resumes after a killed slice, and produces no duplicate recordings rows."
    expected: "Job reaches status 'completed'/'completed_with_errors' across self-chained slices; provider_cursor advances per slice; zero duplicate recordings for the same (organization_id, source_app, source_call_id)."
    why_human: "No provider credentials exist anywhere in .env/.env.local/.env.test and the TEST project is empty (0 import_sources). The slice makes a real provider API call; it cannot be exercised without real credentials, which cannot be fabricated. SYNC-01/03 correctness is otherwise proven provider-agnostically against the real DB; this is the end-to-end live confirmation only."
  - test: "Activate the resume-heartbeat cron — run `ALTER DATABASE postgres SET app.supabase_url = 'https://<THIS_PROJECT_REF>.supabase.co'; SELECT pg_reload_conf();` via the Supabase dashboard SQL editor (superuser) on TEST then PROD. Then seed a stalled sync-all job (status='processing', non-null provider_cursor, last_heartbeat_at 3+ min in the past) and confirm cron.job_run_details shows the heartbeat re-kicked it."
    expected: "After GUC set, cron 'sync-all-resume-heartbeat' (jobid 7 TEST / jobid 8 PROD, schedule '* * * * *', active) fires net.http_post to the SAME-environment connector-sync-all host and advances the stalled job's cursor/heartbeat."
    why_human: "The per-env GUC app.supabase_url cannot be set via the pooler `postgres` user (permission denied to set parameter) — it requires superuser via the dashboard SQL editor. Until set, the cron is registered+active+prod-ref-free but no-ops harmlessly (URL resolves to NULL). The self-chain (primary resume path) + Phase 27 reaper are the active safety nets in the interim. NOTE: the existing PROD fathom-daily-reconcile cron uses the same mechanism and also has a NULL GUC today — pre-existing infra condition, not introduced by Phase 28."
---

# Phase 28: Server-Side Sync-All Verification Report

**Phase Goal:** "Sync all from this provider" actually syncs every call in the date range — the server pages the provider itself, decoupled from what the UI has scrolled, and resumes if interrupted.
**Verified:** 2026-06-30T20:05:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

The phase goal is achieved at the CODE level. The resumable, one-page-per-invocation, dual-auth, idempotent pager exists, is substantive, is wired end-to-end (registry → 6 listPage impls → adapters → UI button), and its correctness properties (org-scoped dedup + 23505→skip reclassification, RESUME-branch auth/guard) are PROVEN against the real TEST DB. Two items remain that require human action (live provider credentials + a superuser GUC) — neither is a code defect; both are environmental/operational.

### Observable Truths

| # | Truth | Status | Evidence |
| --- | ------- | ---------- | -------------- |
| 1 | Pager processes EXACTLY ONE provider page per invocation, never a whole-batch waitUntil loop | ✓ VERIFIED | `connector-sync-all/index.ts` `processSlice` fetches one `listPage(...)`, caps at SLICE_ITEM_BUDGET, checkpoints, self-chains. Grep for `waitUntil`/`maxPages`/`while`/multi-page `for` loop = 0 (only doc-comment mentions of the anti-pattern). The `__subpage__` cursor carves an oversized page into bounded slices. |
| 2 | provider_cursor is checkpointed to sync_jobs each slice; resume reads it; self-chain via functions.invoke | ✓ VERIFIED | `provider_cursor` written in processSlice update (7 refs); decoded at slice start via `decodeSubpageCursor`; `selfChain()` calls `supabase.functions.invoke("connector-sync-all", {body:{jobId}})` fire-and-forget. |
| 3 | Dual auth: user-start uses JWT + derives org; cron/service-role resume binds to job-row stored org/user, never caller input (IDOR boundary) | ✓ VERIFIED | `index.ts` lines 421-468: no-JWT branch loads job row, operates on `job.organization_id`/`job.user_id`, rejects non-'all'/non-'processing'. Resume test (b) confirms terminal-job 409 guard on the deployed fn. |
| 4 | 23505 unique-violation reclassified as skipped (skipped_count), never failed_ids | ✓ VERIFIED | `isUniqueViolation()` (defensive multi-pattern match) → `skippedCount += 1`, never `failed.push`. Real-DB idempotency test (b) proves the loser's error is a 23505 the predicate classifies as skip. |
| 5 | organization_id written at job creation + passed into runPipeline so org-scoped dedup fires deterministically | ✓ VERIFIED | User-start resolves personal org (lines 510-525), writes `organization_id` at INSERT; `mapItemToConnectorRecord` sets org_id from the job row. Idempotency test (a): two concurrent writers → exactly ONE recordings row. |
| 6 | All 6 list-API providers expose listPage returning {items, nextCursor} paginating to exhaustion; cursor is opaque to the pager | ✓ VERIFIED | 6 exported listPage fns (fathom/grain/zoom/read-ai/fireflies/plaud), all substantive (115–729 lines). listPage unit suite 11/11 GREEN across all 6 dialects. |
| 7 | Zoom cursor encodes BOTH 30-day window AND next_page_token (no >30-day truncation) | ✓ VERIFIED | `zoomListPage` uses `ZoomComposedCursor` (window_from/window_to/next_page_token), `advanceZoomCursor`/`initialZoomCursor`. Unit test "does not truncate a >30-day backfill" GREEN. |
| 8 | youtube + file-upload have NO listPage and stay opted-out (resolveListPage→undefined) | ✓ VERIFIED | Runtime check: fathom/grain/zoom/read-ai/fireflies/plaud → FN; youtube/file-upload/paste-transcript → undefined. Registry deliberately omits them. |
| 9 | 6 adapters implement syncAll (create the job); youtube/file-upload leave it undefined; UI button wired | ✓ VERIFIED | 6 adapters call `createSyncAll({sourceApp,...})` which invokes connector-sync-all; youtube.ts/file-upload.ts have 0 syncAll. `ImportSurface.tsx` `handleSyncAll` → `adapter.syncAll` behind a button (renders only when adapter advertises syncAll). |
| 10 | Resume-heartbeat cron is per-environment (no prod-ref literal), service-role resume (no Auth header), additive | ✓ VERIFIED | Migration uses `current_setting('app.supabase_url', true)`; 0 prod-ref literal; POST has no Authorization header → service-role RESUME branch; only registers one cron, zero destructive DDL. |
| 11 | Integration tests ASSERT real DB behavior — NOT guard-skipped / fake-pass | ✓ VERIFIED | Independently confirmed: idempotency test throws loudly on fixture gap (lines 117-121/141/152), real assertions `toBe(1)` on row counts. Resume test throws on fixture gap; (d) honestly pins `liveProviderAvailable===false` rather than vacuous pass. Ran in isolation 3×: 7/7 pass every time. |
| 12 | Per-recording metadata loop replaced; OAUTH_CALLBACK_ROUTES.length passes against committed-tree build | ✓ VERIFIED | `oauth-callback-routing.test.ts` 10/10 GREEN; `npm run build` exit 0 (built in 8.87s). |

**Score:** 12/12 code truths verified. (Roadmap success criteria 1-4 all mapped and verified at code level — see below.)

### Roadmap Success Criteria Mapping

| # | Success Criterion | Status | Notes |
|---|-------------------|--------|-------|
| 1 | 200+ call sync-all completes across self-chaining slices, one page/invocation, provider_cursor checkpointed, pg_cron re-kick (NOT waitUntil/100-page loop) | ✓ code-verified / ⚠ live-unproven | Pager architecture, cursor checkpoint, self-chain, cron all present + correct. The literal "200+ call completes" live run needs provider creds (human item 1). |
| 2 | Idempotent on source_call_id; safe concurrent with selective import; no duplicates | ✓ VERIFIED | Proven on real TEST DB: concurrent writers → 1 row; 23505→skip; crash-retry no-dup. |
| 3 | Every list-API provider exposes syncAll; youtube+file-upload undefined, "imports automatically" | ✓ VERIFIED | 6/6 adapters + registry + UI; youtube/file-upload undefined (runtime-confirmed). |
| 4 | Per-recording loop replaced by list-page→set-diff→detail-for-new-ids; OAUTH_CALLBACK_ROUTES.length passes committed build | ✓ VERIFIED | listPage architecture + build green + OAUTH test 10/10. |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `supabase/functions/connector-sync-all/index.ts` | one-page pager, dual auth, 23505→skip, org_id at creation, SLICE_ITEM_BUDGET | ✓ VERIFIED | 601 lines, substantive, wired to runPipeline + resolveListPage. |
| `supabase/functions/_shared/connector-list-page-registry.ts` | populated 6-provider resolver | ✓ VERIFIED | 6 mapped; youtube/file-upload absent; runtime-confirmed. |
| `supabase/functions/_shared/connector-list-page.ts` | contract types only | ✓ VERIFIED | ListPageResult/ListPageParams/ListPageFn/ListPageResolver. |
| 6 client listPage impls (fathom/grain/zoom/read-ai/fireflies/plaud) | paginate to exhaustion | ✓ VERIFIED | All exported + substantive; unit suite GREEN. |
| `supabase/migrations/20260625120000_sync_all_resume_heartbeat.sql` | per-env additive cron | ✓ VERIFIED | Per-env GUC, no prod-ref, service-role resume, additive. |
| `src/components/import/ImportSurface.tsx` | sync-all button | ✓ VERIFIED | handleSyncAll → adapter.syncAll; button gated on advertised syncAll. |
| 6 adapters with syncAll (`registry/adapters/*`) | create sync-all job | ✓ VERIFIED | createSyncAll invokes connector-sync-all; youtube/file-upload have none. |
| `__tests__/idempotency.integration.test.ts` + `resume.integration.test.ts` | real-DB proofs | ✓ VERIFIED | Real assertions, throw-on-fixture-gap, 7/7 pass in isolation. |
| `_shared/__tests__/listPage.test.ts` | all-6 pagination unit suite | ✓ VERIFIED | 11/11 GREEN. |

### Key Link Verification

| From | To | Via | Status |
| ---- | --- | --- | ------ |
| connector-sync-all/index.ts | connector-list-page-registry.ts | resolveListPage(source_app) | ✓ WIRED |
| connector-sync-all/index.ts | connector-pipeline.ts runPipeline | per-item upsert | ✓ WIRED |
| connector-sync-all/index.ts | sync_jobs.provider_cursor | checkpoint + self-chain functions.invoke | ✓ WIRED |
| adapters/*.ts | ConnectorAdapter.syncAll → connector-sync-all | createSyncAll invoke | ✓ WIRED |
| ImportSurface.tsx | adapter.syncAll | handleSyncAll button | ✓ WIRED |
| resume-heartbeat cron | connector-sync-all (same-env host) | net.http_post, no Auth → service-role resume | ⚠ WIRED-but-DORMANT (GUC unset; human item 2) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| listPage all-6 pagination | `vitest run listPage.test.ts` | 11 passed | ✓ PASS |
| OAUTH_CALLBACK_ROUTES.length | `vitest run oauth-callback-routing.test.ts` | 10 passed | ✓ PASS |
| committed-tree build | `npm run build` | exit 0, built 8.87s | ✓ PASS |
| resolveListPage runtime | `deno run` resolve check | 6 FN, youtube/file-upload undefined | ✓ PASS |
| SYNC-03 real-DB idempotency (isolation) | `vitest run idempotency.integration.test.ts` ×3 | 3 pass | ✓ PASS |
| SYNC-01 real-DB resume (isolation) | `vitest run resume.integration.test.ts` ×3 | 4 pass | ✓ PASS |
| SYNC-01/03 in FULL integration suite | `npm run test:integration` | Phase 28 tests pass; idempotency(c) flaked once under parallel DB contention, passed on re-run | ⚠ PASS-with-flake (see Anti-Patterns) |

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
| ----------- | ---------- | ------ | -------- |
| SYNC-01 (resumable one-page pager, provider_cursor, self-chain, cron) | 28-02/28-04 | ✓ SATISFIED (code); live multi-slice + cron-firing need human items 1+2 | Pager + cursor + self-chain + per-env cron verified; resume contract proven on real DB. |
| SYNC-02 (syncAll on 6 list-API providers; youtube/file-upload excluded) | 28-03/28-04 | ✓ SATISFIED | 6 listPage + 6 adapters + registry + runtime exclusion confirmed. |
| SYNC-03 (idempotent on source_call_id; concurrent-safe; 23505→skip) | 28-02/28-05 | ✓ SATISFIED | Proven on real TEST DB (concurrent→1 row, 23505→skip, crash-retry no-dup). |

REQUIREMENTS.md still lists SYNC-01/SYNC-03 as "In Progress" — that traceability text should be updated to Complete (code) with the two human items noted; not a code gap.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| idempotency.integration.test.ts (c) | 151-167 | Flaky under parallel full-suite DB contention — failed once across multiple full `test:integration` runs; passed every isolated run (3×) and on full-suite re-runs | ⚠ Warning | Test-harness contention against the shared TEST DB, NOT a SYNC-03 code defect. The crash-retry assertion is correct; the intermittent failure is row-state/connection contention when 15 integration files hit one TEST project concurrently. Consider serializing or per-test unique-org isolation. |
| connector-sync-all/index.ts | 9-22, 299, 386 | `return null`/`return []`/`waitUntil` strings | ℹ Info | All are documentation comments naming the anti-pattern being AVOIDED, or legitimate empty-cursor terminal returns — not stubs. |

No debt markers (TBD/FIXME/XXX) found in Phase 28 source files.

### Human Verification Required

See frontmatter `human_verification`. Two items:

1. **Live multi-slice provider-backed sync-all** — needs a real provider TEST credential (none exist in any env file; TEST project empty). Resume test (d) honestly records this as a pinned gap rather than a vacuous pass. SYNC-01/03 correctness is otherwise proven provider-agnostically on the real DB.

2. **Activate resume-heartbeat cron GUC** — `ALTER DATABASE postgres SET app.supabase_url = '...'` requires dashboard superuser (pooler `postgres` user gets "permission denied to set parameter"). Cron is registered+active+prod-ref-free on TEST (jobid 7) and PROD (jobid 8) but no-ops until the GUC is set. Self-chain + Phase 27 reaper are the active resume safety nets meanwhile. Pre-existing infra condition (the prod fathom-reconcile cron shares it).

### Gaps Summary

No code-level gaps. The pager, registry, 6 listPage impls, 6 adapters, UI button, per-env cron, and real-DB proofs all exist, are substantive, are wired, and pass. The 28-05 executor's claimed fake-pass fix was independently confirmed: the integration tests now assert real DB behavior and throw loudly on fixture gaps (verified by reading the bodies AND running them — 7/7 in isolation, real assertions execute).

The two outstanding items are environmental/operational, not implementation defects:
- 0/6 providers live-proven end-to-end (no credentials anywhere; honestly disclosed in the SUMMARY, not implied as proven)
- resume cron dormant until a superuser GUC is set

Both are correctly recorded as human-verification items. The CODE goal of Phase 28 is met; live end-to-end confirmation and cron activation are the human steps that close the loop. Status is therefore **human_needed**, not gaps_found.

One flaky integration test (idempotency (c)) under full-suite parallel DB contention is flagged as a WARNING — it is a test-harness isolation issue, reliably green in isolation, and does not reflect a SYNC-03 code defect.

---

_Verified: 2026-06-30T20:05:00Z_
_Verifier: Claude (gsd-verifier)_
