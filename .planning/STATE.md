---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: Import/Sync Rebuild
status: executing
last_updated: "2026-06-23T20:25:41.921Z"
last_activity: 2026-06-23
progress:
  total_phases: 6
  completed_phases: 2
  total_plans: 10
  completed_plans: 9
  percent: 33
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

**Current focus:** Phase 26 — Unified Import Surface

---

## Current Position

Phase: 26 (Unified Import Surface) — EXECUTING
Plan: 4 of 4
Status: Ready to execute (26-03 complete: both consumers render <ImportSurface>; boot gate green; deletion is 26-04)
Last activity: 2026-06-23

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

- **Date:** 2026-06-23
- **Activity:** Executed Phase 26 Plan 03 (TBL-01 cutover). Rewired BOTH consumers to the shared `<ImportSurface>`: ImportPage's `isConnectorWizardImportSource` connector branch now renders `<ImportSurface sourceApp organizationId={activeOrgId}>` (replacing `<ConnectorImportWizard>`), and the Sync tab (`TranscriptsNew` `TabsContent value="sync"`) renders a new `SyncImportSurface` — a provider picker reusing `connectedPlatforms`/`useSyncSourceFilter`, defaulting to the first enabled connected provider — which renders `<ImportSurface>` for the selected provider. Locked 26-03 resolution preserves cross-provider access without making the surface internally multi-provider.
- **Outcome:** 2 atomic commits (0fc65771 feat ImportPage, 7b2a8859 feat Sync tab + SyncImportSurface). Boot-crash gate GREEN: `npm run build` exit 0 + `oauth-callback-routing.test.ts` 10/10 on the committed tree. tsc: zero NEW errors in touched files (pre-existing ImportPage Remix-icon + TranscriptsNew DragHelpers errors confirmed via git stash, out of scope). Wizard, SyncTab.tsx, useSyncTab* hooks, and job-status components (SyncStatusIndicator/ActiveSyncJobsCard) left on disk for 26-04 / Phase 27. 26-03-SUMMARY.md written.

### Next session

- **Trigger:** Both consumers are rewired — delete the forks in dependency-leaf order.
- **Action:** `$gsd-execute-phase 26` to run Plan 04 — delete `ConnectorImportWizard` (+ tests + ImportPage import line), `SyncTab.tsx` / `UnsyncedMeetingsSection.tsx` / `SyncedTranscriptsSection.tsx`, and the `useSyncTab*` hooks; delete `connectorSearch.ts` ONLY after orchestration is gone (Pitfall 3). Confirm the Phase 26/27 boundary before deleting `SyncStatusIndicator` / `ActiveSyncJobsCard` (RESEARCH A3/A4 — job-status is arguably Phase 27's). Gate every step with `npm run build`.

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
