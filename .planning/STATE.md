---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: Import/Sync Rebuild
status: executing
last_updated: "2026-06-20T06:28:10.207Z"
last_activity: 2026-06-20
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 4
  completed_plans: 1
  percent: 0
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

**Current focus:** Phase 24 — Sync-Status Foundation

---

## Current Position

Phase: 24 (Sync-Status Foundation) — EXECUTING
Plan: 2 of 4
Status: Plan 24-01 complete (IMP-01 canonical synced-signal reader); ready to execute 24-02
Last activity: 2026-06-20 -- Completed 24-01-PLAN.md (IMP-01)

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

- **Date:** 2026-06-18
- **Activity:** Created the v2.1 roadmap — 6 phases (24–29) from the converged SUMMARY/ARCHITECTURE/PITFALLS research. Mapped all 19 v2.1 requirements to exactly one phase each; updated REQUIREMENTS.md traceability.
- **Outcome:** ROADMAP.md + STATE.md written; coverage 19/19. Ready to plan Phase 24.

### Next session

- **Trigger:** Plan the first v2.1 phase.
- **Action:** `$gsd-plan-phase 24` (IMP — Sync-Status Foundation), with `--research-phase` for the `fathom_calls → recordings` backfill/reconciliation.

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

## Decisions

- [Phase ?]: Phase 24/IMP-01: canonical synced-signal reader getSyncStatusForExternalIds on recordings.(source_app, source_call_id) TEXT, no coercion; SyncTab passes literal sourceApp fathom; deleted Fathom-only checkSyncedRecordingIds; cancelSyncJob writes real error column
