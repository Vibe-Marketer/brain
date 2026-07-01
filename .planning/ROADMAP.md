# Roadmap: CallVault — v2.1 Import/Sync Rebuild

**Milestone:** v2.1 Import/Sync Rebuild — Durable, Observable Import
**Created:** 2026-06-18
**Granularity:** standard
**Phase numbering:** continues from v2.0 (ended at Phase 23) — v2.1 starts at Phase 24

**Core Value:** Importing calls from any provider is a durable, observable, trustworthy resource — selection, progress, and partial-failure survive navigation, and "sync all" actually syncs all.

## Phases

- [x] **Phase 24: Sync-Status Foundation** - One canonical provider-agnostic "is this synced?" reader, an org-scoped idempotency index, and the additive `sync_jobs` migration every later phase builds on
- [x] **Phase 25: Durable Selection** - Selections survive navigation, date change, and OAuth return via a persisted store; select-all-matching-filter
- [x] **Phase 26: Unified Import Surface** - One dense `TranscriptTable`-based `<ImportSurface>` replaces the wizard/sync-tab fork; browse vs. find/import as two stacked sections (completed 2026-06-23)
- [x] **Phase 27: Observable Jobs** - Shared `sync_jobs` poller + Realtime push + heartbeat/reaper; kill the 8s auto-dismiss; persistent per-provider status indicator (completed 2026-06-25)
- [x] **Phase 28: Server-Side Sync-All** - Resumable checkpoint/resume pager that pages the provider itself across a date range, decoupled from UI scroll (completed 2026-06-30)
- [ ] **Phase 29: Partial-Success & Retry** - "18 of 30 imported, 12 failed — Retry" surfaced where the action happened; retry only the failures

## Phase Details

### Phase 24: Sync-Status Foundation
**Goal**: One durable, provider-agnostic answer to "is this call synced?" plus the schema and idempotency constraints every other phase reads and writes against.
**Depends on**: Nothing (first phase of v2.1)
**Requirements**: IMP-01, IMP-02, IMP-03, IMP-04
**Success Criteria** (what must be TRUE):
  1. A Zoom call, a Fathom call, and a pasted recording all report `synced=true` from one canonical query on `recordings.(source_app, source_call_id)` — verified by a real-DB reconciliation test (not mocked).
  2. Importing the same provider call twice (concurrent selective import + sync-all) produces exactly one `recordings` row, enforced by the org-scoped unique index `(organization_id, source_app, source_call_id)` on TEXT `source_call_id` (no numeric coercion).
  3. The extended `sync_jobs` table carries `source_app`, org/workspace scope, `mode`, date range, `provider_cursor`, and `last_heartbeat_at` via an additive (`ADD COLUMN IF NOT EXISTS`) migration that leaves in-flight jobs readable.
  4. `sync_jobs` is org-scoped in RLS, registered in `CROSS_ORG_TABLES`, and its new columns are in the Realtime publication whitelist.
**Plans**: 4 plans across 2 waves
  - [x] 24-01-PLAN.md — Canonical getSyncStatusForExternalIds reader (IMP-01) + cancelSyncJob error-column fix (Wave 1)
  - [x] 24-02-PLAN.md — Additive sync_jobs durable-resource migration + org RLS + CROSS_ORG_TABLES (IMP-03) (Wave 1)
  - [x] 24-03-PLAN.md — NULL source_call_id backfill (IMP-02) + orphan fathom_calls reconciliation report (IMP-04) (Wave 1)
  - [x] 24-04-PLAN.md — [BLOCKING] supabase db push (PROD + TEST) + real-DB integration test for IMP-01/02/03/04 + RLS regression (Wave 2)
**Research flag**: yes — confirm the `fathom_calls → recordings` backfill path (`canonical_recording_id` bridge) and orphan reconciliation before flipping the read; real-DB reconciliation test mandatory (mocked tests passed for this exact bug class in the prior Phase 30/BUG-01 incident).

### Phase 25: Durable Selection
**Goal**: A user's selection of calls survives everything that wipes it today — navigation, unmount, date-range change, and the OAuth round-trip.
**Depends on**: Phase 24 (canonical sync-status read reconciles selection against `recordings` truth). Can begin in parallel with Phase 24 since the store is UI-shape-independent.
**Requirements**: SEL-01, SEL-02
**Success Criteria** (what must be TRUE):
  1. A user selects calls, navigates away and back (or returns from an OAuth redirect), and the same calls are still selected.
  2. Changing the date range preserves the prior range's selection instead of clearing it; switching providers shows the correct per-provider/per-range set (store keyed by provider + date range).
  3. A user can select all calls matching the current filter (not just the rows loaded on screen) — the client-side twin of server-side sync-all.
  4. Selection clears only when a job is created, never on background refetch — and any selected call that is now synced drops out automatically.
**Plans**: 2 plans across 2 waves
  - [x] 25-01-PLAN.md — Durable persisted selection store (Zustand persist/sessionStorage, provider+date-range scope, select-all-matching descriptor, clear-on-job) (SEL-01, SEL-02) (Wave 1)
  - [x] 25-02-PLAN.md — useImportSelection reconciliation hook (synced auto-drop via Phase 24 reader, no clear-on-refetch) (SEL-01, SEL-02) (Wave 2)
**UI hint**: yes

### Phase 26: Unified Import Surface
**Goal**: One dense, fast import surface used everywhere, with browsing already-synced calls cleanly separated from finding/importing new ones.
**Depends on**: Phase 24 (canonical sync-status overlay), Phase 25 (selection store)
**Requirements**: TBL-01, TBL-02, TBL-03, TBL-04, BROWSE-01
**Success Criteria** (what must be TRUE):
  1. The Import tab and the Sync tab render the same `<ImportSurface>` built on the dense `TranscriptTable` — one paging model, one selection store, one progress UI.
  2. All 7 connectors correctly grey out already-synced rows via a shared status overlay (not per-adapter logic) — including UUID-id providers like Zoom/Fireflies/Grain.
  3. Browsing already-synced calls (cheap durable DB read) and finding new calls (live provider API) appear as two stacked sections in one surface, with already-synced de-emphasized inline — not two separate apps.
  4. The table is virtualized with larger page sizes and background prefetch — the "Load 10 at a time" experience is gone.
  5. The forked `ConnectorImportWizard` and the duplicate `useSyncTab*` hooks/sections are deleted once both surfaces share the new component, and `OAUTH_CALLBACK_ROUTES.length` passes against a committed-tree build.
**Plans**: 4 plans across 4 waves
  - [x] 26-01-PLAN.md — TBL-04 fast dense table (content-visibility, larger pages) + Wave 0 test scaffolds (Wave 1)
  - [x] 26-02-PLAN.md — <ImportSurface> two-section dense surface + provider-agnostic overlay + carry-forward triple (TBL-01, TBL-02, BROWSE-01) (Wave 2)
  - [x] 26-03-PLAN.md — Rewire ImportPage + Sync tab to <ImportSurface> + build-green boot gate (TBL-01) (Wave 3)
  - [x] 26-04-PLAN.md — Delete ConnectorImportWizard + useSyncTab* fork + connectorSearch behind build-green gate (TBL-03) (Wave 4)
**UI hint**: yes

### Phase 27: Observable Jobs
**Goal**: Import jobs are visible, trustworthy, and never vanish silently — progress survives refresh, failures persist, and dead jobs get reaped.
**Depends on**: Phase 24 (extended `sync_jobs` scope columns), Phase 26 (surface to render banners on)
**Requirements**: JOB-01, JOB-02, JOB-03, JOB-04, JOB-05
**Success Criteria** (what must be TRUE):
  1. A shared `useSyncJobs` hook shows job status on every import surface, surviving a page refresh, via Supabase Realtime (`postgres_changes`) with polling fallback.
  2. The unconditional 8-second auto-dismiss is gone — failed / `completed_with_errors` jobs persist until the user resolves them; only clean `completed` jobs may auto-fade.
  3. A job whose worker dies is detected via `last_heartbeat_at` and flipped to `failed` by a `pg_cron` reaper instead of disappearing as a zombie — verified by a reaper integration test.
  4. A persistent per-provider status indicator reads "Last synced X · N new available · M failed".
**Plans**: 4 plans across 3 waves
  - [x] 27-01-PLAN.md — Shared useSyncJobs hook: lift Realtime+poll, string ids, real source_app/org, kill 8s dismiss (JOB-01, JOB-03, JOB-04) (Wave 1)
  - [x] 27-02-PLAN.md — Additive pg_cron reaper + last_heartbeat_at writes in sync-meetings + real-DB reaper integration test (JOB-02) (Wave 1)
  - [x] 27-03-PLAN.md — Durable SyncJobBanner (sticky failures) + per-provider chip mounted in <ImportSurface> (JOB-03, JOB-05) (Wave 2)
  - [x] 27-04-PLAN.md — [BLOCKING] prod push reaper migration (prod-ref guarded) + deploy sync-meetings --use-api + phase gate (JOB-02) (Wave 3)
**UI hint**: yes

### Phase 28: Server-Side Sync-All
**Goal**: "Sync all from this provider" actually syncs every call in the date range — the server pages the provider itself, decoupled from what the UI has scrolled, and resumes if interrupted.
**Depends on**: Phase 24 (cursor/scope schema, idempotency index), Phase 27 (observable job state + heartbeat/reaper)
**Requirements**: SYNC-01, SYNC-02, SYNC-03
**Success Criteria** (what must be TRUE):
  1. A 200+ call "sync all" completes across multiple self-chaining slices without hitting the Edge wall-clock ceiling — one provider page per invocation, `provider_cursor` checkpointed to `sync_jobs`, re-kicked by a `pg_cron` heartbeat (NOT one long `waitUntil` batch loop, NOT the per-recording 100-page loop).
  2. Sync-all is idempotent on `source_call_id` and safe to run concurrently with selective import — no duplicate recordings.
  3. Every list-API provider (Fathom, Zoom, Fireflies, Grain, Read.ai, **Plaud** — spike-confirmed paginated list endpoint) exposes `syncAll` via the adapter contract; YouTube + file-upload (no list endpoint) leave it undefined and surface "imports automatically."
  4. The per-recording metadata loop is replaced by one list-page → set-difference → detail-only-for-new-ids; `OAUTH_CALLBACK_ROUTES.length` passes against a committed-tree build.
**Plans**: 5 plans
- [x] 28-01-PLAN.md — interface-first listPage/syncAll contracts + 3 RED requirement-proof test scaffolds (SYNC-01/02/03)
- [x] 28-02-PLAN.md — connector-sync-all pager: one-page/invocation, dual auth (JWT + service-role resume), 23505→skipped, org_id at creation (SYNC-01/03 — built; proven on DB in 28-05)
- [x] 28-03-PLAN.md — 6 provider listPage impls (4 pagination shapes) + resolver registry; youtube/file-upload excluded (SYNC-02)
- [x] 28-04-PLAN.md — additive resume-heartbeat cron + slice-budget measurement + 6 adapter syncAll + Sync-all button (build-green, unpushed) (SYNC-01/02)
- [x] 28-05-PLAN.md — [BLOCKING] real-DB concurrency/resume proofs GREEN on TEST + prod push (migration + --use-api deploy) (SYNC-01/02/03)
**Research flag**: yes — HIGHEST-RISK phase. Spike first: confirm each non-Fathom provider (`fetch-*`/`*-sync-meetings`) exposes a date-range + cursor list endpoint before wiring `connector-sync-all`; size per-provider chunk budgets to ~300s with margin; decide pgmq vs. in-repo claim-table for the pager. Do NOT port the existing `sync-meetings` `waitUntil` batch loop.

### Phase 29: Partial-Success & Retry
**Goal**: After an import, the user sees exactly what happened and can retry only the failures — never a vanishing toast, never a full-batch replay.
**Depends on**: Phase 27 (durable job state + `failed_ids`), Phase 28 (sync-all failure paths)
**Requirements**: FAIL-01, FAIL-02
**Success Criteria** (what must be TRUE):
  1. Partial success is rendered where the import was triggered — "18 of 30 imported, 12 failed" — read from `completed_with_errors` / `failed_ids`, and still visible after 30 seconds.
  2. Retry re-attempts only the failures (retry set = requested − synced), wired to the existing single-call retry path — it never replays successes and never creates duplicates.
**Plans**: 2 plans across 2 waves
  - [ ] 29-01-PLAN.md — Extend SyncJobBanner: precise "{synced} of {requested} imported, {failed} failed" breakdown + skipped-vs-failed distinction, no timer (FAIL-01) (Wave 1)
  - [ ] 29-02-PLAN.md — "Retry failed (N)" banner action wired to the existing singleCallId retry path (failed_ids only, idempotent, org-scoped) (FAIL-02) (Wave 2)
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 24. Sync-Status Foundation | 4/4 | Complete |  |
| 25. Durable Selection | 2/2 | Complete | - |
| 26. Unified Import Surface | 4/4 | Complete   | 2026-06-23 |
| 27. Observable Jobs | 4/4 | Complete   | 2026-06-25 |
| 28. Server-Side Sync-All | 5/5 | Complete   | 2026-06-30 |
| 29. Partial-Success & Retry | 0/2 | Planned | - |

## Phase Ordering Rationale

- **IMP (24) is the load-bearing foundation** — both idempotency and the canonical synced-signal are read/written by every later phase, and the additive-migration discipline is set here. PITFALLS flags this as the must-be-first phase; a REAL-DB reconciliation test is mandatory (mocked tests failed in the prior Phase 30/BUG-01 incident).
- **SEL (25) can run in parallel with IMP** as the foundation tier — selection durability is independent of UI shape — but is sequenced after IMP so it reconciles against canonical `recordings` truth.
- **TBL (26) collapses the fork** only after sync-status (24) and selection (25) exist. BROWSE-01 is folded in here as the two-mode (`browse` / `find`) `<ImportSurface>` rather than a standalone phase — the converged research recommends this.
- **JOB (27) gates FAIL and sync-all observability** — you can't show partial-success or watch a server-side sync-all without the poller, heartbeat, and reaper.
- **SYNC (28) is the highest-risk phase** — designed checkpoint/resume from the start; the existing `waitUntil` batch loop is NOT ported (it shares the 400s/150s Edge ceiling and dies mid-run). SYNC-02's `syncAll` is list-API providers only. Select-all-matching (SEL-02) and SYNC are the two ends of one capability, sequenced client-side first (25), server-side here (28).
- **FAIL (29) comes after JOB** since partial-success/retry depend on observable durable job state; it closes the retry loop without looping back into the double-import pitfall.

## Standing Constraints (every phase)

- **Dual recording-ID system:** never `parseInt`/`Number()`/coerce recording or call IDs; route cross-ID work through `toRecordingUuid`/`toRecordingUuidBatch` (`src/lib/recording-ids.ts`). `source_call_id` is TEXT.
- **`source-registry.ts` boot-crash risk:** build against the COMMITTED tree before every push during connector churn; add/keep a CI assertion on `OAUTH_CALLBACK_ROUTES.length` (zeroed registry = prod white screen).
- **Additive, non-destructive migrations only** against prod (ref `vltmrnjsubfzrgrtdqey`); expand status enums, never mutate/retype columns in-flight jobs depend on; run old + new consumers in parallel during cutover.
- **npm only;** no `framer-motion`, no Lucide; Remix Icons only; Supabase-native (zero new job-queue vendors — claim-table / pgmq + Realtime + Zustand + TanStack Query).

---
*Roadmap created: 2026-06-18 — v2.1 Import/Sync Rebuild, 6 phases (24–29), continuing phase numbering from v2.0.*
