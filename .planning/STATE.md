---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: Import/Sync Rebuild
status: verifying
last_updated: "2026-06-25T18:54:59.301Z"
last_activity: 2026-06-25
progress:
  total_phases: 6
  completed_phases: 4
  total_plans: 14
  completed_plans: 14
  percent: 67
---

# STATE — CallVault v2.1 Import/Sync Rebuild

**Last updated:** 2026-06-18

---

## Project Reference

**Project:** CallVault — v2.1 Import/Sync Rebuild (Durable, Observable Import)
**Repo:** `/Users/admin/dev/brain` (single source; `callvault/` is abandoned).
**Production:** https://app.callvaultai.com (Vercel, auto-deploys from `main`)
**MCP endpoint:** https://mcp.callvaultai.com (Cloudflare Worker → Supabase Edge Function)
**Prod Supabase ref:** `vltmrnjsubfzrgrtdqey` (migrations read `.env`, prod-ref guarded)

**Core value:** Importing calls from any provider is a durable, observable, trustworthy resource — selection, progress, and partial-failure survive navigation, and "sync all" actually syncs all.

**Current focus:** Phase 27 — Observable Jobs

---

## Current Position

Phase: 27 (Observable Jobs) — COMPLETE (4/4)
Plan: 4 of 4 (27-01, 27-02, 27-03, 27-04 complete)
Status: Phase complete — ready for verification. Backend LIVE in prod (reaper cron + heartbeat deploy). Frontend NOT pushed to origin (batched to milestone end).
Last activity: 2026-06-25

## Performance Metrics

(Will populate as phases run.)

- Cycle time per plan: —
- Plans completed per phase: —
- Verification-pass rate: —

---

## Accumulated Context

### Roadmap Evolution

- **v1.0 Self-Serve Public Launch shipped 2026-06-12** — 24 phases, 113 plans. Full record in MILESTONES.md.
- **v2.0 Autonomous Operations shipped 2026-06-15** — Phases 17–23 (35 plans; 34 shipped, 17-05 held/deferred). Live on real production traffic.
- **v2.1 roadmap created 2026-06-18** — 6 phases (24–29) derived from the converged research build order (IMP → SEL → TBL+BROWSE → JOB → SYNC → FAIL). 19 requirements across IMP/SEL/TBL/BROWSE/JOB/FAIL/SYNC mapped to exactly one phase each. Phase numbering continues from v2.0 (does NOT reset to 1).
  - Phase 24: Sync-Status Foundation (IMP-01..04)
  - Phase 25: Durable Selection (SEL-01,02)
  - Phase 26: Unified Import Surface incl. browse/find split (TBL-01..04, BROWSE-01)
  - Phase 27: Observable Jobs (JOB-01..05)
  - Phase 28: Server-Side Sync-All (SYNC-01..03)
  - Phase 29: Partial-Success & Retry (FAIL-01,02)

### Key Decisions

- **Import is a durable, observable resource, not a transient action.** Every John-from-Clickable complaint (vanishing selections, "only some imported", no status, slow paging) traces to one fault: import state lived in volatile React `useState` across two forked codepaths (`ConnectorImportWizard` + `SyncTab`), with the synced-signal split across two tables read two ways. Modeling import as a DB-backed job + persistent client store makes the failures impossible by construction.
- **Supabase-native, zero new vendors.** `sync_jobs` ledger (extend additively) + in-repo claim-table pattern (`embedding_queue`) + pg_cron/pg_net + Realtime `postgres_changes` + Zustand `persist` + TanStack Query. External queues (Inngest/Trigger.dev/QStash/BullMQ) are a hard no — they break customer-owned infra. pgmq is an optional upgrade decided at the SYNC phase.
- **IMP (24) must be first.** The canonical sync-status reader, the org-scoped idempotency unique index `(organization_id, source_app, source_call_id)`, and the additive `sync_jobs` migration are the foundation every other phase reads/writes against.
- **The dominant risk is silent mid-run death (Pitfall 3).** Current `sync-meetings` runs its whole batch in one `EdgeRuntime.waitUntil`, which shares the 400s/150s Edge wall-clock ceiling and pages Fathom up to 100 pages per recording. SYNC (28) must be checkpoint/resume from the start — do NOT port the existing batch loop.
- **BROWSE folds into TBL (26).** Browse-vs-find is two stacked sections (cheap DB read above expensive provider call) in one `<ImportSurface>`, not a standalone phase and not two separate apps (the named anti-feature).
- **SEL-02 (select-all-matching) and SYNC are two ends of one capability** — client-side twin (25) and server-side pager (28). Sequenced sensibly, not budgeted twice.

### Decisions Needed

Per-phase research flags (resolve at phase planning, not roadmap creation):

- **Phase 24 (IMP):** Confirm the `fathom_calls → recordings` backfill path (`canonical_recording_id` bridge) and orphan reconciliation before flipping the synced-signal read. Real-DB reconciliation test mandatory (mocked passed for this exact bug class in Phase 30/BUG-01). Confirm exact Realtime payload column whitelist includes the new `sync_jobs` columns.
- **Phase 28 (SYNC):** Per-provider server-side list+cursor+date-range endpoint shapes for Zoom/Fireflies/Grain/Read.ai/PLAUD are NOT individually verified — confirm each before wiring `connector-sync-all` (Fathom confirmed). Decide whether PLAUD/YouTube/file-upload advertise `syncAll` at all (webhook-only → leave undefined). Decide pgmq vs. claim-table for the pager. Size the per-provider chunk budget (~300s margin).

### Todos

- Plan Phase 24 (`$gsd-plan-phase 24`) — flag `--research-phase` (IMP backfill/reconciliation).
- Phase 28 (SYNC) — flag `--research-phase` (per-provider list endpoints + chunk budget + pgmq decision).

## Phase-Spanning Knowledge

Binding fragile surfaces (must respect in every phase):

- **Dual recording-ID system.** UUID `recordings.id` vs legacy BIGINT `recordings.legacy_recording_id`/`fathom_provider_id` vs TEXT `source_call_id`. Never `parseInt()`/`Number()`/string coercion on any recording or call id — this is the exact `parseInt(externalId)` bug in `checkSyncedRecordingIds` that drops UUID-id providers. Route cross-ID work through `toRecordingUuid()`/`toRecordingUuidBatch()` (`src/lib/recording-ids.ts`). The idempotency natural key is TEXT `source_call_id`.
- **`source-registry.ts` `oauthCallbackFunctionName`** entries are load-bearing boot artifacts — empty `OAUTH_CALLBACK_ROUTES` crashes React mount (prod white screen, happened in commit `9b6e3338`). Build against the COMMITTED tree (`git stash -u && npm run build`) before every push during connector churn; add a CI assertion on `OAUTH_CALLBACK_ROUTES.length`. Watch the uncommitted-files-as-real-code pattern.
- **`recordings.share_url` is not a top-level column** — use `resolveShareUrl()` from `src/lib/recording-source-url.ts`.
- **Additive migrations only** against prod (ref `vltmrnjsubfzrgrtdqey`, read from `.env`). Expand status enums (treat unknown as non-terminal); never rename/retype `sync_jobs` columns in-flight jobs depend on (`recording_ids` is `number[]` client-side today). Run old + new consumers in parallel during cutover; drain before any destructive change.
- **New job/import tables need org-scoped RLS** and registration in `CROSS_ORG_TABLES` (`src/test/rls-regression.test.ts`, CI gate). Natural-key index org-scoped, never user-scoped.
- **Realtime gotchas:** DELETE events can't be filtered and bypass RLS — use INSERT/UPDATE only for the synced-signal. Batch progress writes (every N items / M seconds), not per-item, to avoid single-threaded change-processing storms.
- **`runPipeline`/`checkDuplicate`** in `_shared/connector-pipeline.ts` is the canonical idempotent write path — reuse verbatim for sync-all. `validateRequestedWorkspaceId` (sync-meetings:543) gates IDOR — reuse on every new write path.
- **All AI/LLM in Edge Functions** (constraint AI-02). Frontend AI usage banned.
- **Direct-main workflow.** No feature branches/PRs unless Andrew explicitly asks. npm only.

---

## Session Continuity

### Last session

- **Date:** 2026-06-25
- **Activity:** Executed Phase 27 Plan 04 ([BLOCKING] backend prod push, JOB-02). Operator pre-approved the prod write + edge deploy. Verified the reaper migration strictly additive (0 destructive DDL; the lone grep hit was a comment). TEST-first: linked TEST (`swjzxiddcrtaqixsfaac`, TEST DB password from `.env.local`), `supabase db push --linked` → `Scheduled sync-jobs-reaper cron`. Ran the reaper proof LIVE — the integration test's donor-guard would have skipped (TEST had zero sync_jobs/fathom_raw_calls rows), so seeded sync_jobs rows under a real `auth.users` id, ran `reap_stale_sync_jobs()` live, asserted all 5 cases (stale→failed, fresh spared, NULL-old reaped, NULL-young spared, idempotent), reaper returned 3 reaped, cleaned up all seeded rows. Then prod-ref guard (asserted DATABASE_URL contains `vltmrnjsubfzrgrtdqey`, booleans only) → linked PROD → `supabase db push` → `Scheduled sync-jobs-reaper cron`. Deployed `sync-meetings --use-api` (Docker-less) to PROD. Phase gate: `npm run build` exit 0; full unit suite 6 files/20 tests failed = ZERO new failures vs the 26-04 baseline (7/21), all 6 pre-existing MCP/edge-fn/rpc-smoke areas.
- **Outcome:** Backend live in prod. Cron `sync-jobs-reaper` verified active (schedule `* * * * *`, active=true) on PROD + TEST via direct pg query; `reap_stale_sync_jobs` fn present on both. 1 metadata commit (no source files changed this plan — migration/edge authored in 27-02 `6a53b139`/`60329fc1`). 27-04-SUMMARY.md written; self-check PASSED. NO origin push (frontend batched to milestone end).
- **(prior) 27-03 Activity:** Executed Phase 27 Plan 03 (JOB-03/JOB-05). Built two presentational components driven entirely by the shared `useSyncJobs` hook and mounted them at the clean Phase-26 seams in `<ImportSurface>`: `SyncJobBanner` (status-switch off the `sync_jobs` row — progress / clean-completed / `completed_with_errors` "{synced} synced, {failed} failed" / `failed` with `job.error`; failures + partial-success are STICKY with NO `setTimeout` anywhere — they leave the DOM only via the user's dismiss control calling `onDismiss(job.id)`), and `PerProviderSyncChip` (persistent "Last synced X · N new · M failed" pill; provider label from `getConnectorAdapter(sourceApp).metadata.label`, never hardcoded; "N new" = `results.length − importedIds.size`, no new query; "M failed" = `lastCompletedJob.failed_ids.length`). ImportSurface now calls `useSyncJobs({ sourceApp, organizationId })`, holds a local `dismissedJobIds` `Set<string>` (never a DB delete, never a timer), filters `visibleTerminalJobs`, and renders `[...activeJobs, ...visibleTerminalJobs]` at the `:474` seam + the chip in the connected-status toolbar. Retired the PRESERVED "Auto-dismissing…" copy + 5-min "Appears Stuck" heuristic. Frontend-only — no DB/edge/prod contact.
- **Outcome:** 2 atomic TDD commits — `6d659cf` (RED 9 tests) + `08fbf6a` (GREEN impl + mount). 9/9 new tests green; 17/17 existing ImportSurface tests still green; `tsc -p tsconfig.app.json` clean for the 3 touched files. Grep gates: `useSyncJobs(`=1, `<SyncJobBanner`=1, `<PerProviderSyncChip`=1, `fathom`=0, `Auto-dismissing`=0, `setTimeout`=0 in banner. 2 auto-fixed deviations (brittle test-matcher regex; `string` vs `ConnectorSourceApp` typing). 27-03-SUMMARY.md written; self-check PASSED. NO origin push (batched to 27-04).
- **(prior) 27-02 Activity:** Executed Phase 27 Plan 02 (JOB-02). Wrote the additive `20260623120000_sync_jobs_reaper.sql` migration: `reap_stale_sync_jobs()` SECURITY DEFINER fn (flips `processing`→`failed` for stale-heartbeat >5min OR NULL-heartbeat absolute-fallback created_at >15min; idempotent — predicate only matches `processing`) + `sync-jobs-reaper` pg_cron (every minute, graceful-degradation guarded, in-process pure-SQL — no pg_net/secret). Piggybacked `last_heartbeat_at` onto sync-meetings' existing INSERT + all 3 per-item progress UPDATEs (zero new write sites, no `setInterval`). Wrote a real-DB reaper integration test (5 cases, TEST-ref guarded, zero mocks, donor pattern, try/catch afterAll cleanup). NO db push, NO edge deploy, NO origin push (all gated/batched to 27-04).
- **Outcome:** 2 atomic commits — `6a53b139` (feat reaper+heartbeat) + `60329fc1` (test). Grep gates: 6 reaper/cron refs, 4 heartbeat writes, 0 setInterval, 0 ALTER/DROP. Integration test 5/5 pass via donor-guard short-circuit (TEST project has no sync_jobs rows yet; full reaper assertions go live once 27-04 pushes the migration to TEST + seeds exist). 27-02-SUMMARY.md written. Self-check PASSED.
- **(prior) 27-01 Activity:** Executed Phase 27 Plan 01 (JOB-01/JOB-03/JOB-04). Created the ONE shared `useSyncJobs({ sourceApp, organizationId })` hook (`src/hooks/useSyncJobs.ts` + unit test) by lifting `useSyncTabState`'s hybrid Realtime+poll machinery into a clean provider-agnostic hook. Channel keeps `user_id=eq` as the only `postgres_changes` predicate; source_app+org narrowing is client-side on top of user-OR-org RLS (held in `matchesScopeRef` so scope changes don't re-subscribe). Fixed both Phase-26 carry-forwards (id arrays `string[]` end-to-end; real `source_app` replaces hardcoded `"fathom"`), dropped the SyncTab-specific `removeNewlySyncedMeetings`/`Set<number>` logic, and removed the 8s terminal auto-dismiss (JOB-03). Returns `{ activeJobs, terminalJobs }`; terminal failures persist.
- **Outcome:** 2 atomic TDD commits — `44c783e` (RED test) + `7a20c8d` (GREEN impl). 5/5 unit tests green; `tsc -p tsconfig.app.json` clean for the hook; grep gate 0 (`"fathom"`/parseInt/Number/Set<number>); cleanup has `removeChannel` + `clearInterval`. Did NOT mount in `<ImportSurface>` (27-03) or touch DB/edge (27-02). 27-01-SUMMARY.md written. (Phase 26 Plans 03 + 04 complete in prior sessions: shared `<ImportSurface>` cutover + fork deletion.)

### Next session

- **Trigger:** Phase 27 is COMPLETE (4/4). Backend live in prod (reaper cron + heartbeat). Frontend (27-01/27-03) builds green but is NOT pushed to origin — batched to milestone-end deploy.
- **Action:** `$gsd-verify-phase 27` to verify Phase 27, then plan Phase 28 (SYNC) with `--research-phase` (per-provider list endpoints + chunk budget + pgmq decision). At milestone end, push the batched frontend to origin/main.

### Files of Record

- `.planning/PROJECT.md` — project context, v2.1 workstreams, Key Decisions, Out of Scope
- `.planning/REQUIREMENTS.md` — 19 v2.1 requirements traced to Phases 24–29
- `.planning/ROADMAP.md` — 6-phase v2.1 plan + sequencing rationale + research flags
- `.planning/research/SUMMARY.md` — converged research executive summary + roadmap implications
- `.planning/research/ARCHITECTURE.md` — target component model + dependency-ordered build order
- `.planning/research/PITFALLS.md` — 7 critical pitfalls + pitfall-to-phase mapping
- `.planning/MILESTONES.md` — v1.0 + v2.0 shipped records
- `src/CLAUDE.md` / `supabase/CLAUDE.md` / `docs/CLAUDE.md` — folder-scoped binding rules

---

*STATE.md reset to v2.1 Import/Sync Rebuild milestone: 2026-06-18*

## Performance Metrics

| Phase | Plan | Duration | Notes |
|-------|------|----------|-------|
| Phase 24 P01 | 9 | 2 tasks | 5 files |
| Phase 24 P02 | 12min | 2 tasks | 2 files |
| Phase 24 P03 | 11min | 2 tasks | 2 files |
| Phase 24 P04 | 8min | 2 tasks | 1 file |
| Phase 25 P01 | ~12min | 2 tasks (TDD) | 2 files |
| Phase 26 P01 | 7min | 2 tasks | 6 files |
| Phase 26 P02 | 18min | 2 tasks (TDD) | 4 files |
| Phase 26 P03 | 11min | 2 tasks | 3 files |
| Phase 26 P04 | 15min | 2 tasks | 20 files |
| Phase 27 P01 | ~15min | 2 tasks (TDD) | 2 files |
| Phase 27 P02 | ~10min | 2 tasks | 3 files |
| Phase 27 P03 | ~7min | 2 tasks (TDD) | 5 files |
| Phase 27 P04 | 20min | 2 tasks | 0 files |

## Decisions

- [Phase 24]: Phase 24/24-04: pushed all 3 Phase 24 migrations to PROD (ref vltmrnjsubfzrgrtdqey) + TEST project (ref swjzxiddcrtaqixsfaac), prod-ref-guarded before connect; real-DB integration test (zero mocks, TEST-project-guarded) proves IMP-01..04; fathom_calls is a VIEW over fathom_raw_calls so IMP-04 orphan seed targets the base table; RLS regression green with sync_jobs cross-org isolation
- [Phase ?]: Phase 24/IMP-01: canonical synced-signal reader getSyncStatusForExternalIds on recordings.(source_app, source_call_id) TEXT, no coercion; SyncTab passes literal sourceApp fathom; deleted Fathom-only checkSyncedRecordingIds; cancelSyncJob writes real error column
- [Phase 24]: Phase 24/IMP-03: additive sync_jobs migration adds 9 nullable/defaulted columns; org policy sync_jobs_org_isolation (is_organization_member) ADDED ALONGSIDE retained user_id policy (OR-combined, legacy NULL-org rows stay visible); Realtime verified not re-added; sync_jobs in CROSS_ORG_TABLES; migration write-only, push gated in 24-04
- [Phase ?]: Phase 24/IMP-02 gap: idempotent backfill recordings.source_call_id = fathom_provider_id::text for fathom/fathom-paste where derivable; both-NULL rows documented bounded gap; NULLS NOT DISTINCT deferred; constraint untouched
- [Phase ?]: Phase 24/IMP-04 data side: orphan fathom_calls EXCLUDED+reported into fathom_calls_orphan_report (fathom_call_id BIGINT PK arbiter, ON CONFLICT DO NOTHING); dual-bridge type-safe; no row fabrication; push gated 24-04
- [Phase 25]: Phase 25/25-01 (SEL-01,02): durable persisted Zustand store useImportSelectionStore (first use of zustand/middleware persist; orgContextStore hand-rolls localStorage). sessionStorage NOT localStorage — connector OAuth return is a same-tab full-page redirect read on mount, so SPA boots fresh and rehydrates; sessionStorage survives redirect+nav+unmount, clears on tab close. Scope key = encodeURIComponent(source_app)::dateStart::dateEnd (open bound = *), so date-range change preserves prior range's selection; provider isolation by construction. SEL-02 select-all stored as {mode:'all-matching',filter} descriptor NOT enumerated ids (cursor-paginated unbounded search; enumeration is Phase 28's server job); getSelectionCount returns 'all' sentinel. clearScope is the ONLY clear path (job creation, never refetch); dropSyncedIds reconcile primitive exported for Plan 02 hook. externalId opaque TEXT, no coercion. Zero new packages. 6 tests vs real jsdom sessionStorage green; tsc clean tsconfig.app.json.
- [Phase ?]: Phase 26/26-01 (TBL-04): zero-dependency content-visibility:auto + contain-intrinsic-size on each semantic TableRow skips offscreen row layout while keeping scroll stable; blocking-human checkpoint resolved no-op (NO npm dependency). Added 200 page-size option (20/50/100/200) to kill 'Load 10 at a time'. rowStyle/rowClassName drilldown keeps semantic Table markup intact (Pitfall 4). Three Wave 0 RED scaffolds encode TBL-01/BROWSE-01 + TBL-02 carry-forward triple (CR-02 real source_app, WR-02 org threading, WR-01 merge-not-clobber) for Plan 02; virtualization suite GREEN; tsc clean.
- [Phase 26]: Phase 26/26-02 (TBL-01,TBL-02,BROWSE-01): one shared <ImportSurface sourceApp=...> lifts the SyncTab two-stacked-section shape (find-new live search ABOVE per-provider browse-synced DB read) onto the reused dense TranscriptTable; selection from durable Phase 25 useImportSelection (no useState selection sets), cleared only on job creation. New overlaySyncStatus helper fixes the Phase 24 carry-forward triple: groups rows by REAL source_app + one reader call per provider (CR-02), threads organizationId (WR-02), merges/never-clobbers by returning a Set of imported externalIds (WR-01); ids opaque, never coerced. Inlined findRowKey (two Meeting types exist) to avoid a cross-type cast. Capability-gated for all 7 providers; Phase 27 (job banner) + Phase 28 (sync-all) seams left clean; connectorSearch.ts reused not deleted (26-04 deletes). Both Wave 0 RED scaffolds GREEN (11 tests, 363c255c + dae68c8c); tsc clean.
- [Phase ?]: 26-03: TBL-01 cutover complete — both the Import-tab connector branch (ImportPage) and the Sync tab render the SAME <ImportSurface>. Sync tab routed via a new SyncImportSurface provider picker (reuses connectedPlatforms/useSyncSourceFilter, defaults to first enabled connected provider) preserving John's cross-provider access without making the surface internally multi-provider (locked 26-03). Boot gate GREEN: npm run build exit 0 + oauth-callback-routing 10/10 on committed tree. ConnectorImportWizard, SyncTab.tsx, useSyncTab* hooks, and job-status components (SyncStatusIndicator/ActiveSyncJobsCard) left on disk for 26-04 / Phase 27. Commits 0fc65771 + 7b2a8859.
- [Phase ?]: 26-04: connectorSearch.ts kept as live ImportSurface dependency; deleted the rest of the fork (wizard + useSyncTab* hooks + folded sections + orphaned SyncTabDialogs)
- [Phase ?]: 26-04: useSyncTabState.ts hardcoded sourceApp 'fathom' (~line 202) PRESERVED+annotated for Phase 27 to rewire with real source_app + organizationId
- [Phase 27]: 27-02 (JOB-02): additive 20260623120000_sync_jobs_reaper.sql — reap_stale_sync_jobs() SECURITY DEFINER (SET search_path=public, CTE UPDATE…RETURNING, returns COUNT) flips processing→failed for stale-heartbeat >5min OR NULL-heartbeat absolute-fallback created_at >15min; error=COALESCE(error,'worker died (no heartbeat)'), completed_at=NOW(). Idempotent by construction (predicate only matches status='processing', already-failed rows untouched — test case 5). sync-jobs-reaper pg_cron '* * * * *' is pure-SQL in-process (no pg_net/secret, unlike embedding-worker-backup/fathom-reconcile which http_post), wrapped in undefined_function/OTHERS graceful degradation (free-tier safe). STRICTLY ADDITIVE — no ALTER/DROP (last_heartbeat_at already exists from 20260620120000). Heartbeat piggybacked onto sync-meetings' existing INSERT + all 3 per-item progress UPDATEs (last_heartbeat_at: new Date().toISOString()) — zero new write sites, no setInterval, no Realtime write-volume increase (RESEARCH Pitfall 5); final terminal status UPDATE left as-is. Real-DB integration test (5 cases, zero mocks per BUG-01, describe.skipIf(!integrationDbReachable)+makeIntegrationClient TEST-ref guarded, donor pattern user_id, try/catch afterAll delete-by-id): stale→failed, fresh spared, NULL-old fallback reaps, NULL-young spared, idempotent. Passes today via donor-guard short-circuit (TEST has no sync_jobs rows); rpc('reap_stale_sync_jobs') resolves + assertions go live after 27-04 pushes migration to TEST. NO db push / edge deploy / origin push (gated/batched to 27-04). Commits 6a53b139 (feat) + 60329fc1 (test).
- [Phase 27]: 27-03 (JOB-03/JOB-05): two presentational components driven entirely by the shared useSyncJobs hook, mounted at the clean Phase-26 seams in <ImportSurface> (both Import + Sync tabs get them free). SyncJobBanner — status-switch off the sync_jobs row (processing→progress current/total + spinner; completed→success; completed_with_errors→"{synced} synced, {failed} failed"; failed→job.error). Failures + completed_with_errors are STICKY: NO setTimeout anywhere in the component — terminal banners leave the DOM only via the user's RiCloseLine dismiss control calling onDismiss(job.id). PerProviderSyncChip — persistent "Last synced X · N new · M failed" pill; provider label from getConnectorAdapter(sourceApp).metadata.label (try/catch fallback to slug), never hardcoded; failed segment omitted at 0, "0 new" up-to-date state at 0; date-fns formatDistanceToNow. ImportSurface wiring: useSyncJobs({sourceApp,organizationId}); local dismissedJobIds Set<string> (never DB delete, never timer); visibleTerminalJobs = terminalJobs minus dismissed; [...activeJobs,...visibleTerminalJobs].map at :474 seam; chip in connected-status toolbar; N new = Math.max(0, results.length − importedIds.size) LOCKED (no query); lastCompletedJob = terminalJobs[0]. Retired ActiveSyncJobsCard/SyncStatusIndicator "Auto-dismissing" copy + 5-min "Appears Stuck" heuristic (reaper owns stuck→failed). Counts via string[] .length only (no coercion). 2 auto-fixed deviations: brittle digit-regex test matchers tightened to container.textContent /N\s*new|N\s*failed/; let providerLabel:string typed (string vs ConnectorSourceApp). 9 new tests + 17 existing green; tsc clean tsconfig.app.json (3 touched files); grep gates useSyncJobs(=1, banner+chip rendered, fathom=0, Auto-dismissing=0, setTimeout=0. Frontend-only, no DB/edge/prod. Commits 6d659cf (RED) + 08fbf6a (GREEN).
- [Phase 27]: 27-04 (JOB-02, [BLOCKING] backend prod push): reaper migration 20260623120000_sync_jobs_reaper.sql pushed to TEST (swjzxiddcrtaqixsfaac) then PROD (vltmrnjsubfzrgrtdqey) — prod-ref guard (DATABASE_URL must contain vltmrnjsubfzrgrtdqey, asserted booleans-only at point-of-connect) before the prod write, additive verified (0 destructive DDL). sync-jobs-reaper pg_cron verified active (sched '* * * * *', active=true) + reap_stale_sync_jobs() fn present on BOTH refs via direct pg query. Reaper proven LIVE against real TEST DB: the integration test's donor-guard would have skipped (TEST had 0 sync_jobs/fathom_raw_calls rows) so seeded sync_jobs under a real auth.users id, ran the RPC live, asserted all 5 cases (stale→failed, fresh spared, NULL-old reaped via absolute fallback, NULL-young spared, idempotent), reaper returned 3 reaped, cleaned up 0 remaining — truthful GREEN not a guard skip. sync-meetings (4 last_heartbeat_at writes: 1 INSERT + 3 progress UPDATEs, 0 setInterval) deployed to PROD via --use-api (Docker-less). TEST push needed SUPABASE_TEST_DB_PASSWORD from .env.local; PROD push used SUPABASE_DB_PASSWORD from .env. Phase gate: npm run build exit 0; full unit suite 6 files/20 tests failed = ZERO new failures vs 26-04 baseline (7/21), all pre-existing (MCPTab.permissions, McpConnectionsTab, McpSetupSnippets, rpc-type-smoke, generate-ai-titles auth-invariants, mcp-server sec-jwt-fix). No source files changed (deploy/gate plan); migration/edge authored in 27-02. NO origin push (frontend batched to milestone end). JOB-02 verified-on-DB. Phase 27 COMPLETE 4/4.
- [Phase 27]: 27-01 (JOB-01/03/04): created ONE shared useSyncJobs({sourceApp,organizationId}) hook lifting useSyncTabState's hybrid Realtime+poll machinery into a clean provider-agnostic hook. Channel keeps user_id=eq as the only postgres_changes predicate; source_app+org narrowing is CLIENT-SIDE on top of user-OR-org RLS (RESEARCH Pattern 1) — held in matchesScopeRef so scope changes don't re-subscribe. Fixed both Phase-26 carry-forwards: id arrays are string[] end-to-end (dropped removeNewlySyncedMeetings/processedSyncedIdsRef/Set<number> entirely — SyncTab-specific + the coercion landmine), real source_app replaces hardcoded 'fathom'. JOB-03: deleted the 8s recentlyCompletedJobs auto-dismiss — failed/completed_with_errors persist in terminalJobs (dismissal owned by 27-03 banner). DELETE realtime events only drop locally (RLS-bypass safe); INSERT/UPDATE drive status truth. Returns {activeJobs(pending/processing), terminalJobs(completed/failed/completed_with_errors)}. Poll result cast via `as unknown as SyncJob[]` (generated row type non-overlapping; ids stay opaque). 5 unit tests (vi.hoisted mock supabase + capturable channel/subscribe) green; tsc clean tsconfig.app.json; grep gate 0 ('fathom'/parseInt/Number/Set<number>); removeChannel+clearInterval in cleanup. This plan did NOT mount in <ImportSurface> (27-03) or touch DB/edge (27-02). Commits 44c783e (RED) + 7a20c8d (GREEN).
