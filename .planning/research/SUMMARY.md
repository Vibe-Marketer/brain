# Project Research Summary

**Project:** CallVault — v2.1 Import/Sync Rebuild (Durable, Observable Import)
**Domain:** Durable, observable, provider-agnostic call import/sync subsystem on an existing Supabase (Postgres + Deno Edge) + React 18 (Zustand + TanStack Query) B2B SaaS
**Researched:** 2026-06-18
**Confidence:** HIGH

## Executive Summary

This is not a greenfield "pick a stack" problem. It is a **structural rebuild of an existing import/sync subsystem** whose every customer complaint (John from Clickable: vanishing selections, "only some imported," no status, slow paging) traces to one fault — import was built as a transient, fire-and-forget action across two forked UIs (`ConnectorImportWizard` + `SyncTab`) with the trustworthy state held in volatile React `useState`, and the "is this synced?" signal split across two tables read two different ways. All four research streams converge on the same verdict: **go Supabase-native, add ZERO new vendors, and model import as a durable resource** — one DB job ledger, one durable client selection store, one shared dense table surface, one provider-agnostic adapter contract, one canonical sync-status read.

The recommended approach reuses patterns already proven in *this* codebase rather than inventing infra. The durable job ledger (`sync_jobs`) already exists; the repo already ships a battle-tested claim-table queue pattern (`embedding_queue`: `FOR UPDATE SKIP LOCKED`, exponential backoff, stale-lock release, `dead_letter`, pg_cron + pg_net worker) to copy for the server-side pager. Supabase Queues (pgmq) is GA and an optional clean upgrade, but not required. External queues (Inngest / Trigger.dev / QStash / BullMQ) are a hard no — they add a vendor, a secret, and egress, and break the customer-owned/Supabase-native principle. The genuinely new work is **correctness primitives, not infrastructure**: an org-scoped idempotency key, cursor persistence for resumable sync-all, rate-limit backoff, and optimistic-update reconciliation against the job ledger.

The dominant risk is **silent mid-run death**. The current `sync-meetings` runs its whole batch inside one `EdgeRuntime.waitUntil`, and background tasks share the SAME wall-clock ceiling (400s paid / 150s free) as the request — so a large "sync all" dies mid-batch, freezing the job row at `processing` forever with no completion write. That is the exact "only some imported, no status" bug. Mitigation is non-negotiable and well-defined: the sync-all pager must be **checkpoint/resume** (one cursor page per invocation, persist `provider_cursor` to `sync_jobs`, self-chain + pg_cron heartbeat), backed by a heartbeat column + zombie reaper, with an org-scoped DB unique index `(organization_id, source_app, source_call_id)` on TEXT `source_call_id` (never numeric coercion) making double-import impossible by construction.

## Key Findings

### Recommended Stack

Supabase-native, zero new vendors. Every hard requirement is already solvable with tools that are (a) Supabase-native and (b) already running in production in this codebase. The only optional dependency worth considering is `p-retry` (tiny, MIT, esm.sh) to standardize Edge backoff — and even that is optional since `FathomClient.fetchWithRetry` already exists. See STACK.md.

**Core technologies:**
- **`sync_jobs` table (existing, extend additively)** — durable job ledger (status, progress, synced_ids, failed_ids, cursor) — already the source of truth, already written by `sync-meetings`. Extend with `source_app`, `source_id`, `organization_id`, `workspace_id`, `mode`, `date_start/end`, `provider_cursor`, `last_heartbeat_at` — don't replace.
- **Postgres claim-table queue (existing `embedding_queue` pattern)** — server-side "sync all" pager: durable enqueue, atomic claim, retries, stale-lock release — repo already ships this exact pattern, proven under load, already RLS'd.
- **pg_cron + pg_net (existing, enabled)** — heartbeat to re-kick stuck jobs + backup tick — already in 3 production cron jobs; the standard Supabase way to run a durable worker without an external scheduler.
- **Supabase Realtime `postgres_changes` on `sync_jobs` (existing) + polling fallback** — push live progress to the UI — already wired with graceful degradation; correct at this per-user-row scale. Do NOT migrate to Broadcast (scale-only).
- **Zustand 5.0 `persist` (existing)** — durable selection surviving navigation/unmount/OAuth redirect — lightest durable option, no DB write, no RLS, no migration.
- **TanStack Query 5.90 (existing)** — server cache for cheap browse reads + post-job reconciliation.

**Optional upgrade:** Supabase Queues (pgmq, GA) for first-class queue semantics (visibility timeout, `read_ct` retry, archive) — clean upgrade, not a requirement; has no built-in DLQ (build it on `read_ct`).

### Expected Features

The milestone *is* the MVP — these features make John's failure impossible by construction. The North Star pattern, verified across sources: "The UI must restore the job's latest status correctly when users return and not restart from scratch or show stale information." See FEATURES.md.

**Must have (table stakes):**
- **Selection survives navigation, date change, OAuth return** (SEL) — the canonical John failure; move out of `useState` into durable Zustand store keyed by provider + date range
- **Per-job progress that survives refresh** (JOB) — `sync_jobs` poller on every import surface
- **Partial-success display** (FAIL) — "18 of 30 imported, 12 failed" rendered where the button was pressed, not a vanishing toast
- **Retry just the failures** (FAIL) — `requested − synced`, wired to the existing single-call retry path; never replay the whole batch
- **No silent 8-second auto-dismiss** (JOB) — kill the unconditional dismiss that hides `completed_with_errors`
- **Persistent per-provider status indicator** — "Last synced X · N new available · M failed"
- **Unified sync-status source of truth** (IMP) — one durable answer to "is this synced?"

**Should have (competitive):**
- **Server-side "Sync all from provider"** (SYNC) — flagship differentiator; backend pages the provider cursor itself across a date range, decoupled from UI scroll. Doubles as **select-all-matching-filter** — they are two ends of one capability.
- **One dense shared `TranscriptTable` surface** (TBL) — collapse the fork; one paging model, one selection store, one progress UI (`UnsyncedMeetingsSection` is the reuse template)
- **Live progress via Realtime push** instead of polling — more trustworthy than a spinner (polling is the acceptable fallback, already exists)
- **Faster paging** — virtualized BROWSE table + background-prefetch the FIND cursor page (replace "load 10 at a time")

**Defer (v2.1.x / v2+):**
- Range select (shift-click) — power-user polish after select-all-matching ships
- Scheduled / continuous auto-sync per provider — separate reliability project
- Cross-provider "fetch from all connected sources at once" — only after single-provider sync-all is trusted

**Named anti-features (do NOT build):** two separate destinations for Browse vs Find/Import (this IS the current fork — building two apps is the whole problem); client-side "sync all" that loops only loaded pages (silently under-imports); spinner-only indeterminate progress; reject-whole-batch-on-any-failure; 8s auto-dismiss as the status system.

### Architecture Approach

Model import as a durable resource, not a transient action. The fix is **one canonical sync-status read** (`recordings.source_app + source_call_id`, TEXT, no coercion), **one durable selection store** (Zustand persisted, keyed `provider::externalId` scoped by source + date range), **one shared `<ImportSurface>`** built on the dense `TranscriptTable`, **one provider-agnostic adapter contract** (add optional `syncAll?`, move `alreadyImported` into a shared status overlay so all 7 providers get correct greying for free), and **one generic server-side `connector-sync-all` Edge Function** that owns the provider cursor and checkpoints into `sync_jobs`. See ARCHITECTURE.md.

**Major components:**
1. **`sync-status.service.ts` (`getSyncStatusForExternalIds`)** — canonical provider-agnostic "is this synced?" reader on `recordings.source_call_id`; replaces both `checkSyncedRecordingIds` (the `parseInt`/`fathom_calls` bug) and the synced branch of `fetchSyncedCalls`. **Foundation — everything reads off it.**
2. **`importSelectionStore.ts` (Zustand persist)** — durable selection set, scoped by source + date range; clear only on job creation, never on every fetch
3. **`<ImportSurface>` + `<SyncJobBanner>`** — single dense table-based surface consumed by both ImportPage and SyncTab; absorbs `SyncStatusIndicator` + `ActiveSyncJobsCard`. Deletes the wizard, `UnsyncedMeetingsSection`, and all the bespoke sync-tab hooks.
4. **`useSyncJobs` (consolidated Realtime + poll, no 8s dismiss)** — one hook over the extended `sync_jobs`, filtered by source/org
5. **`connector-sync-all/` Edge Function** — generic, dispatched by `source_app`; pages provider internally, checkpoints `provider_cursor`, resumes; reuses `runPipeline` verbatim for idempotent writes

### Critical Pitfalls

Top 5 from PITFALLS.md (all codebase-grounded, verified against actual files):

1. **Double-importing the same provider call** — concurrent sync-all + selective import, retry replaying the original array, or pgmq at-least-once redelivery all duplicate rows. Avoid: declare an org-scoped DB unique index `(organization_id, source_app, source_call_id)` on **TEXT** `source_call_id` and `INSERT ... ON CONFLICT DO NOTHING`. Never `parseInt`/`Number()` the key (breaks PLAUD/YouTube non-numeric ids). Retry = `requested − synced`, never blind replay.
2. **Split "is this synced?" signal** — `checkSyncedRecordingIds` reads legacy `fathom_calls` via `Number.parseInt(externalId)`, so every UUID-id provider (Zoom/Fireflies/Grain) shows "not synced" → duplicates + invisible recordings. Avoid: one canonical provider-agnostic reader on `recordings.(source_app, source_call_id)`, set-difference for counts. Backfill before flipping the read; write a **real-DB** reconciliation test (mocked tests passed for this exact bug class in the Phase 30/BUG-01 incident).
3. **Edge wall-clock timeout kills "sync all" mid-batch** — the whole batch runs in one `waitUntil`, which shares the 400s/150s ceiling; current code pages Fathom up to 100 pages *per recording*. Avoid: checkpoint/resume — one bounded slice per invocation, persist cursor + progress, re-enqueue (self-chain + pg_cron heartbeat); kill the per-recording pagination (one list-page → set-difference → detail only for new ids); budget to ~300s with margin.
4. **Zombie jobs stuck "processing" forever** — a killed worker freezes the row; the poller's 60s window hides it but never marks it failed → spinner vanishes with no result. Avoid: `last_heartbeat_at` column written per progress update + a pg_cron reaper that flips stale `processing` rows to `failed` and re-enqueues recoverable work.
5. **The 8-second auto-dismiss hides failures (the original sin)** — success and failure share one dismissal path; a user who looks away for 9s never learns 12 of 30 failed. Avoid: branch on status — only auto-dismiss clean `completed`; `failed`/`completed_with_errors` persist (durable in DB) until the user acts; surface results where the action happened.

Plus two standing cross-cutting risks: **`source-registry.ts` boot crash** (`OAUTH_CALLBACK_ROUTES` empty → prod white screen — add a CI length assertion + build against the COMMITTED tree before every push), and **live-customer migration** (additive migrations only, expand status enum don't mutate, run old + new consumers in parallel during cutover).

## Implications for Roadmap

Based on research, the convergent dependency-ordered phase structure (workstream codes from PROJECT.md):

### Phase 1: IMP — Sync-status foundation + idempotency + sync_jobs migration
**Rationale:** This is the foundation every other phase reads and writes against. Until "is this synced?" has one durable answer, the inline badge, per-provider indicator, and browse/find split all sit on sand. The additive-migration discipline is set here.
**Delivers:** `sync-status.service.ts` (`getSyncStatusForExternalIds` on TEXT `source_call_id`, delete `checkSyncedRecordingIds`); org-scoped unique index `(organization_id, source_app, source_call_id)`; additive `sync_jobs` migration (`source_app`, `source_id`, `organization_id`, `workspace_id`, `mode`, `date_start/end`, `provider_cursor`, `last_heartbeat_at`) + org-scoped RLS + `CROSS_ORG_TABLES` registration + Realtime publication whitelist.
**Addresses:** Unified sync-status source of truth (IMP), trustworthy inline "imported" badge
**Avoids:** Pitfalls 1 (double-import) and 2 (split signal) — both must be fixed before any new write path is built on top

### Phase 2: SEL — Durable selection store
**Rationale:** Selection durability is independent of UI shape; build standalone with tests so the shared table later just reads from it. Can run in parallel with IMP.
**Delivers:** `importSelectionStore.ts` (Zustand `persist`) + `useImportSelection.ts`, keyed `provider::externalId`, scoped by source + date range; clears only on job creation
**Uses:** Zustand 5.0 `persist` (existing stack)
**Avoids:** Selection-in-volatile-`useState` anti-pattern (the originating complaint)

### Phase 3: TBL — Unified import surface
**Rationale:** The shared surface consumes status (IMP) + selection (SEL) + jobs (JOB). Model on `UnsyncedMeetingsSection` (the proven `TranscriptTable` reuse). Collapse the fork only after the replacement is proven on one page.
**Delivers:** `<ImportSurface>` + `<SyncJobBanner>` on the dense `TranscriptTable`; delete `ConnectorImportWizard`, `UnsyncedMeetingsSection`, and the bespoke sync-tab hooks; wire both ImportPage and SyncTab. Browse-vs-find = two stacked sections (cheap DB read above expensive provider call) — one surface, two modes.
**Implements:** One shared table component; browse/find split (BROWSE)
**Avoids:** Named anti-feature "two separate apps"; Pitfall 6 (registry boot crash — build against committed tree)

### Phase 4: JOB — Observable jobs (poller + heartbeat/reaper + kill 8s dismiss)
**Rationale:** You can't show partial-success/retry or watch a server-side sync-all without the poller on the surface. Heartbeat + reaper make jobs trustworthy, not an afterthought.
**Delivers:** consolidated `useSyncJobs` (Realtime + poll); remove the unconditional 8s auto-dismiss; heartbeat column written per slice; pg_cron zombie reaper; persistent per-provider status indicator
**Avoids:** Pitfalls 4 (zombies) and 5 (auto-dismiss hides failures)

### Phase 5: SYNC — Server-side sync-all (resumable chunked pager + adapter syncAll)
**Rationale:** The flagship differentiator and the highest-risk phase. Must be designed as checkpoint/resume from the start — do NOT port the `sync-meetings` `waitUntil` batch loop.
**Delivers:** generic `connector-sync-all/` Edge Function (dispatched by `source_app`, owns the cursor, checkpoints `provider_cursor`, self-chains + cron heartbeat); adapter contract `syncAll?` + `createSyncAll` helper; extract `_shared/connector-credentials.ts`; one list-page → set-difference (kill per-recording pagination)
**Uses:** claim-table pattern (`embedding_queue`), pg_cron + pg_net, `runPipeline` (idempotent writes)
**Avoids:** Pitfall 3 (wall-clock death) — the core reason this milestone exists

### Phase 6: FAIL — Partial-success + retry-failures-only
**Rationale:** Closes the retry loop on the durable foundation. Final UX polish.
**Delivers:** partial-success banner ("18 of 30 imported, 12 failed — Retry") rendered where the action happened; retry computes `requested − synced`, wired to the existing single-call retry path
**Avoids:** retry-replays-whole-batch anti-pattern (loops back into Pitfall 1)

### Phase 7: BROWSE — Browse/find separation (largely landed in TBL)
**Rationale:** Cheap durable DB reads for already-synced calls, distinct from expensive live provider calls. Structurally delivered by the two-mode `<ImportSurface>` in TBL; this phase finalizes virtualization + prefetch and the cost-class separation.
**Delivers:** virtualized BROWSE table + larger page size; background-prefetch the FIND cursor page

### Phase Ordering Rationale
- **IMP, SEL can run in parallel as the foundation tier** — sync-status and selection are independent; both must exist before the surface.
- **Critical path: IMP → TBL → (fork collapse)** — the canonical sync-status read unblocks the surface, which unblocks killing the fork.
- **Schema (IMP) → JOB/SYNC** — the extended `sync_jobs` scope/cursor columns must land before the consolidated poller and the resumable pager can use them.
- **SYNC and select-all-matching-filter are one capability** — scope them together; don't budget twice.
- **Additive-migration discipline anchored in IMP, enforced in every later `sync_jobs`-touching phase** — protects in-flight customer imports during cutover.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 5 (SYNC):** Per-provider server-side list endpoint shapes (Zoom / Fireflies / Grain / Read.ai / PLAUD list + cursor + date-range) are NOT individually verified — confirm each `fetch-*`/`*-sync-meetings` function exposes a date-range + cursor list before wiring `connector-sync-all` for that provider. Fathom is confirmed. Also confirm pgmq-vs-claim-table decision and the exact chunk budget. Flag `--research-phase`.
- **Phase 1 (IMP):** Confirm the `fathom_calls → recordings` backfill path (the `canonical_recording_id` bridge) and orphan reconciliation before flipping the read. Real-DB reconciliation test is mandatory.

Phases with standard patterns (skip research-phase):
- **Phase 2 (SEL):** Zustand `persist` is a locked, well-understood pattern in the stack.
- **Phase 4 (JOB):** Realtime + poll hybrid already proven in `useSyncTabState`; heartbeat/reaper mirrors the in-repo `embedding-worker-backup` cron.
- **Phase 6 (FAIL):** Pure UI on the durable foundation; retry path already exists.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Edge limits / pgmq GA / Realtime scaling / pg_cron all verified against official Supabase docs 2026 AND reinforced by patterns already running in this repo |
| Features | HIGH | UX patterns from multiple verified sources + direct read of both existing CallVault surfaces; MEDIUM only on competitor internals (AI-notetakers don't publish import-UX docs) |
| Architecture | HIGH | Every integration point verified against real files; MEDIUM-HIGH only on per-provider sync-all (direct generalization of verified `sync-meetings`, but 6 non-Fathom list endpoints unverified) |
| Pitfalls | HIGH | Every pitfall verified against actual `sync-meetings`, `useSyncTabState`, `recording-ids`, CONCERNS.md; Supabase platform facts verified against current docs |

**Overall confidence:** HIGH

### Gaps to Address

- **Per-provider list+cursor+date-range endpoints (Zoom/Fireflies/Grain/Read.ai/PLAUD):** confirm each exposes the shape `connector-sync-all` needs during Phase 5 planning. Fathom confirmed.
- **Whether PLAUD/YouTube/file-upload advertise `syncAll` at all:** webhook-only / no list endpoint → leave `syncAll` undefined and surface "imports automatically." Decide per-provider during Phase 5.
- **Exact Realtime payload column whitelist:** ensure the new `sync_jobs` columns are in the publication (Phase 1 migration).
- **pgmq vs hand-written claim-table for the pager:** claim-table is the known-quantity default; pgmq is the optional upgrade. Decide in Phase 5 based on whether multiple concurrent sync workers are needed.
- **`fathom_calls → recordings` backfill orphans:** reconcile before switching the synced-signal read (Phase 1); guard with a real-DB reconciliation test.

## Sources

### Primary (HIGH confidence)
- Supabase official docs (2026): Edge Functions limits (400s paid / 150s free wall-clock, `waitUntil` shares worker lifetime, 2s CPU), background-tasks, Queues/pgmq (GA, at-least-once, no native DLQ), Realtime postgres-changes (single-threaded, DELETE bypasses RLS), cron (sub-minute flaky)
- In-repo proof (read directly): `supabase/migrations/20251128100000_embedding_queue_system.sql` (claim-table queue pattern), `supabase/functions/sync-meetings/index.ts` (waitUntil + 100-page-per-recording bug), `supabase/functions/_shared/connector-pipeline.ts` (`runPipeline`/`checkDuplicate` canonical dedup), `src/services/sync-tab.service.ts` (the `fetchSyncedCalls` vs `checkSyncedRecordingIds` split), `src/hooks/useSyncTabState.ts` (Realtime+poll + 8s auto-dismiss), `src/lib/recording-ids.ts` + `src/CLAUDE.md` (dual-ID rules), `src/components/connectors/registry/types.ts` + adapters (adapter contract), `.planning/codebase/CONCERNS.md` (boot-crash history, uncommitted-files pattern), `supabase/CLAUDE.md` (Phase 30/BUG-01 mocked-test incident)

### Secondary (MEDIUM confidence)
- LogRocket / AppMaster / Smart Interface Design Patterns / Eleken / ImportCSV — async-job UI patterns, bulk-import UX, partial-success/retry, restore-status-on-return, select-all-matching, "rejecting whole file on one bad row is hostile"
- pg_cron sub-minute reliability (Supabase discussion #18274)

### Tertiary (LOW confidence)
- AI-notetaker competitor comparisons (Otter/Fireflies/Fathom) — category norms only; no published import-UX internals

---
*Research completed: 2026-06-18*
*Ready for roadmap: yes*
