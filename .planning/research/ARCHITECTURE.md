# Architecture Research — v2.1 Import/Sync Rebuild (Durable, Observable Import)

**Domain:** Durable, observable, provider-agnostic call import inside React 18 + Zustand + TanStack Query + Supabase (Postgres + Deno Edge Functions)
**Researched:** 2026-06-18
**Confidence:** HIGH (all integration points verified against real files in this repo; no external/training-data claims)

---

## TL;DR for the roadmap

The fault behind every John-from-Clickable complaint is structural: import is a **transient action** scattered across **two forked UIs** with the **trustworthy state held in volatile React `useState`**, and the "is this synced?" signal is **split across two tables read two different ways**. The fix is to model import as a **durable resource**: one DB job ledger (`sync_jobs` extended), one durable client selection store (Zustand persisted), one shared dense table surface, one provider-agnostic adapter contract, and one canonical sync-status read.

Five concrete deliverables, in dependency order:

1. **Unify the sync-status signal** — kill `checkSyncedRecordingIds` (legacy `fathom_calls` + `parseInt`, Fathom-only, breaks Zoom UUIDs). Make `recordings.source_app + source_call_id` the single source of truth via one provider-agnostic batch reader. *(Foundation — everything else depends on it.)*
2. **Durable selection store** — move selection out of `useSyncTabSelection`/wizard `useState` into a persisted Zustand store keyed by `provider::externalId`, scoped by source + date range.
3. **Collapse the fork** — one `<ImportSurface>` built on `TranscriptTable`, consumed by both `ImportPage` and `SyncTab`. Delete the wizard's checkbox list and the divergent paging.
4. **Observable jobs** — one shared `useSyncJobs` poller/Realtime hook + status indicator on every surface; remove the 8-second auto-dismiss.
5. **Server-side sync-all** — a generic `connector-sync-all` job that pages the provider itself, checkpoints into `sync_jobs`, and resumes.

---

## Standard Architecture

### System Overview (target)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          IMPORT SURFACE (UI layer)                         │
│   ImportPage ──┐                                          ┌── SyncTab      │
│                ▼                                          ▼                │
│            ┌──────────────────────────────────────────────────┐           │
│            │            <ImportSurface>  (NEW, shared)          │           │
│            │  TranscriptTable + one paging model + one toolbar  │           │
│            │  + <SyncJobBanner> (partial-success + retry)       │           │
│            └───────┬───────────────────────┬──────────────────┘           │
├────────────────────┼───────────────────────┼──────────────────────────────┤
│                     ▼  (hooks layer)        ▼                               │
│   useImportSelection(persisted)   useProviderCalls   useSyncJobs           │
│   useSyncStatus (canonical)       useSyncAll                                │
├─────────────────────┼───────────────────────┼─────────────────────────────┤
│                     ▼  (service layer)       ▼                              │
│   importSelectionStore   provider-calls.service.ts   sync-jobs.service     │
│   sync-status.service.ts (canonical reader)  connectorRegistry adapters    │
├─────────────────────┼───────────────────────┼─────────────────────────────┤
│                     ▼  (server: Deno Edge)   ▼                              │
│   sync-meetings (MODIFIED)   connector-sync-all (NEW)   <provider>-import  │
│                 └──────────► connector-pipeline.ts (runPipeline) ◄────┘    │
├──────────────────────────────────────────────────────────────────────────┤
│                          DATA (Postgres)                                    │
│   sync_jobs (EXTENDED: source_app, mode, cursor, date range, workspace_id) │
│   recordings (canonical: source_app + source_call_id = synced truth)       │
│   import_sources   workspace_entries                                       │
│   [DEPRECATED for status reads: fathom_calls]                              │
└──────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities (target)

| Component | Responsibility | New / Modified / Delete |
|-----------|----------------|-------------------------|
| `<ImportSurface>` | Single dense table-based import UI (search + select + import + progress). Consumed by both ImportPage and SyncTab. | **NEW** |
| `<SyncJobBanner>` | Renders `sync_jobs` progress + partial-success ("18/30 imported, 12 failed — Retry") where the button was pressed | **NEW** (absorbs `SyncStatusIndicator` + `ActiveSyncJobsCard`) |
| `importSelectionStore.ts` | Persisted Zustand store: selection set keyed `provider::externalId`, scoped by source + date range; survives navigation/OAuth return | **NEW** |
| `sync-status.service.ts` | Canonical provider-agnostic "is this synced?" via `recordings.source_app + source_call_id` | **NEW** (replaces both `checkSyncedRecordingIds` and the synced branch of `fetchSyncedCalls`) |
| `useSyncJobs` | One Realtime+polling hook over `sync_jobs`, filtered by source/surface; replaces the bespoke effect in `useSyncTabState` | **NEW** |
| `useSyncAll` | Kicks `connector-sync-all`, tracks the resulting job | **NEW** |
| `connector-sync-all/` | Server job: pages provider internally over a date range, checkpoints cursor into `sync_jobs`, resumes | **NEW** Edge Function |
| `connectorRegistry.ts` | Adapter dispatch — extended with `syncAll` capability | **MODIFIED** |
| `connector-pipeline.ts` | `runPipeline` dedup/insert — unchanged contract; reused by sync-all | **REUSE as-is** |
| `sync-meetings/index.ts` | Selected-import processor — generalize progress writes; keep as the Fathom selected-import path | **MODIFIED** |
| `useSyncTabState` / `useSyncTabOrchestration` / `useSyncTabSelection` | Bespoke fork logic | **DELETE / fold into shared hooks** |
| `ConnectorImportWizard.tsx` (634 lines) | Custom checkbox list + own paging | **DELETE** (replaced by `<ImportSurface>`) |
| `UnsyncedMeetingsSection.tsx` | Already wraps `TranscriptTable` — the proven reuse pattern | **REUSE as the template for `<ImportSurface>`** |

---

## Q1 — Unified data/state model: one durable sync-status signal

### The split today (verified)

| Reader | Table | Key | Problem |
|--------|-------|-----|---------|
| `fetchSyncedCalls` (sync-tab.service.ts:62) | `recordings` (+ `workspace_entries` when scoped) | `source_call_id`, `source_app` | Correct & provider-agnostic — this is the keeper |
| `checkSyncedRecordingIds` (sync-tab.service.ts:588) | legacy `fathom_calls` | `recording_id` via `Number.parseInt(id, 10)` | **Fathom-only.** `parseInt` silently drops Zoom/Fireflies/Grain UUID `externalId`s (`numericIds.length === 0` → empty Set → every non-Fathom call shows as "not synced"). This is the bug behind "non-Fathom recordings invisible/duplicate." |

`connector-pipeline.ts:checkDuplicate` already proves the canonical truth: a call is "synced" iff a `recordings` row exists with matching `owner_user_id + source_app + source_call_id` **and** it still has `workspace_entries`. That is the contract every reader must use.

### Proposal: `recordings` is the single source of truth; `fathom_calls` is demoted to source-detail only

`fathom_calls` / `fathom_raw_calls` / `fathom_raw_transcripts` stay as **source-specific raw stores** (Fathom API detail, transcript segments). They are NOT a sync-status authority. The sync-status signal is computed once, provider-agnostically:

```ts
// sync-status.service.ts (NEW) — replaces checkSyncedRecordingIds entirely
export async function getSyncStatusForExternalIds(
  sourceApp: ConnectorSourceApp,
  externalIds: string[],          // strings — never parseInt; works for BIGINT and UUID providers
): Promise<Map<string, { recordingUuid: string; hasWorkspaceEntries: boolean }>> {
  // SELECT id, source_call_id FROM recordings
  //   WHERE owner_user_id = ? AND source_app = ? AND source_call_id IN (externalIds::text[])
  // then one workspace_entries existence check, batched (mirror checkDuplicate)
}
```

Why this resolves the milestone's IMP workstream:
- One read path for both "is this in my unsynced list synced?" (was `checkSyncedRecordingIds`) and "show my synced calls" (was the synced branch of `fetchSyncedCalls`).
- `source_call_id` is TEXT and stores the same value for every provider — Fathom BIGINT-as-string and Zoom UUID coexist with zero coercion. Honors the dual-ID rule: `externalId` is the **provider** id (`source_call_id`), never confused with `recordings.id` (UUID) or `fathom_provider_id` (BIGINT bridge).
- Re-importability survives: the `hasWorkspaceEntries` flag mirrors `checkDuplicate` so "removed from all workspaces → re-importable" stays correct.

### `sync_jobs` schema/migration shape

Current `sync_jobs` (consolidated_schema.sql:173 + two later migrations) is a **selected-import ledger only**: `user_id, status, type, recording_ids TEXT[], progress_current/total, synced_ids TEXT[], failed_ids TEXT[]`, plus `error_message` + `skipped_count` (written by the Edge Function). It has **no org/workspace scope, no source_app discriminator, no mode, no cursor/date-range** — so it cannot back a resumable server-side sync-all, and cross-org RLS is weak (`user_id` only).

Proposed additive migration (`YYYYMMDDHHMMSS_sync_jobs_durable_resource.sql`):

```sql
ALTER TABLE public.sync_jobs
  ADD COLUMN IF NOT EXISTS source_app   TEXT,          -- 'fathom' | 'zoom' | ... discriminator
  ADD COLUMN IF NOT EXISTS source_id    UUID,          -- import_sources.id (which account)
  ADD COLUMN IF NOT EXISTS organization_id UUID,       -- RLS + status indicator scope
  ADD COLUMN IF NOT EXISTS workspace_id UUID,          -- destination for imported calls
  ADD COLUMN IF NOT EXISTS mode         TEXT DEFAULT 'selected', -- 'selected' | 'sync_all'
  ADD COLUMN IF NOT EXISTS date_start   TIMESTAMPTZ,   -- sync_all range
  ADD COLUMN IF NOT EXISTS date_end     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provider_cursor TEXT,       -- checkpoint for resume (sync_all)
  ADD COLUMN IF NOT EXISTS skipped_count INTEGER DEFAULT 0;  -- formalize (code already writes it)

CREATE INDEX IF NOT EXISTS idx_sync_jobs_source_active
  ON public.sync_jobs(user_id, source_app, status);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_org
  ON public.sync_jobs(organization_id);
-- RLS: add organization_id-scoped policy alongside the existing user_id policy;
-- add `sync_jobs` to CROSS_ORG_TABLES in src/test/rls-regression.test.ts.
```

Backfill: leave existing rows `mode='selected'`, `source_app='fathom'` (every prior job was Fathom selected-import). No destructive change — purely additive, safe on prod (PROD ref `vltmrnjsubfzrgrtdqey`).

**Status indicator** ("Last synced X · N new · M failed") is then a cheap query: latest `sync_jobs` row per `(source_app, source_id)` for the org → `completed_at`, `synced_ids.length`, `failed_ids.length`. No new table needed.

---

## Q2 — Shared import-surface component architecture

### The fork today (verified)

| Surface | Table | Paging | Selection | Progress |
|---------|-------|--------|-----------|----------|
| `ConnectorImportWizard.tsx` (634L) | custom `<Checkbox>` list + `appendUniqueAvailableCalls` | manual cursor (`connectorSearch.ts`, maxPages) | local `useState<AvailableCall[]>` selection | `onImportComplete(jobId)` callback, no shared poller |
| `SyncTab` → `UnsyncedMeetingsSection.tsx` | `TranscriptTable` (the dense one) | client-only `page=1, pageSize=meetings.length` | `useSyncTabSelection` `Set<string>` keyed `platform::recording_id` | `useSyncTabState` bespoke Realtime+poll effect, 8s auto-dismiss |

`UnsyncedMeetingsSection` already wraps `TranscriptTable` correctly (maps `Meeting` → table call shape, keys rows by `getUnsyncedMeetingSelectionKey`). **It is the template.** The wizard is the thing to delete.

### Target: one `<ImportSurface>` consumed by both pages

```
<ImportSurface
  sourceApp                      // which provider (drives adapter dispatch)
  sourceId                       // which account row
  workspaceId                    // import destination
  mode="find" | "browse"         // find = live provider search; browse = cheap DB read
/>
  ├─ <ImportToolbar>             // date range, search, "Sync all", select-all, import-selected
  ├─ <SyncJobBanner>             // sync_jobs progress + partial-success + retry, INLINE here
  └─ <TranscriptTable>           // the dense table, reused exactly as UnsyncedMeetingsSection does
```

| Layer | New file | Replaces |
|-------|----------|----------|
| Component | `src/components/import/ImportSurface.tsx` | `ConnectorImportWizard.tsx` (delete), `UnsyncedMeetingsSection.tsx` (delete) |
| Component | `src/components/import/SyncJobBanner.tsx` | `SyncStatusIndicator.tsx` + `ActiveSyncJobsCard.tsx` (merge) |
| Hook | `src/hooks/useProviderCalls.ts` | the fetch/paging in `useSyncTabOrchestration.fetchMeetings` + wizard search |
| Hook | `src/hooks/useImportSelection.ts` | `useSyncTabSelection.ts` (delete) — backed by persisted store |
| Hook | `src/hooks/useSyncJobs.ts` | the Realtime+poll effect in `useSyncTabState.ts` (delete) |
| Hook | `src/hooks/useSyncAll.ts` | — (new capability) |
| Service | `src/services/provider-calls.service.ts` | search/paging glue; calls `connectorRegistry` + `connectorSearch` |
| Service | `src/services/sync-status.service.ts` | `checkSyncedRecordingIds` (delete) + synced branch of `fetchSyncedCalls` (refactor) |
| Store | `src/stores/importSelectionStore.ts` | volatile selection `useState` everywhere |

**Browse vs find/import (BROWSE workstream):** `mode="browse"` reads already-synced calls via `fetchSyncedCalls` (cheap DB, no provider API). `mode="find"` calls the provider via the adapter (expensive). Same table, same selection store, two data sources — keeps the One-Click Promise while separating cost classes.

**Deleted on completion:** `ConnectorImportWizard.tsx`, `UnsyncedMeetingsSection.tsx`, `useSyncTabState.ts`, `useSyncTabOrchestration.ts`, `useSyncTabSelection.ts`, `useSyncTabStateBridge.ts`, `SyncStatusIndicator.tsx`, `ActiveSyncJobsCard.tsx`, `checkSyncedRecordingIds`. (Their `.registry.test.ts` files migrate to cover `<ImportSurface>`.)

---

## Q3 — Provider-agnostic adapter contract

### Today (verified)

`ConnectorAdapter` (registry/types.ts:214) already has the right spine:
- `searchAvailable(params) → { items: AvailableCall[]; nextCursor }`  ✓ (search)
- `importSelected(params) → ImportJob { jobId, total }`  ✓ (import-selected)

Gaps for the milestone: **no `syncAll`**, and `alreadyImported` is currently baked into each adapter's `searchAvailable` via `wasAlreadySynced` — which for Fathom relies on the edge function and for others is inconsistent (status is not provider-agnostic today).

### Proposal: extend the existing interface (one contract, all 7 benefit)

```ts
export interface ConnectorAdapter {
  // ...existing: metadata, setup, getOAuthAuthUrl, saveApiKeyCredentials,
  //              disconnect, searchAvailable, importSelected...

  /**
   * NEW — kick a server-side "import everything in this date range" job.
   * Returns a sync_jobs id immediately; the server pages the provider itself.
   * Adapters whose provider has no list endpoint (file-upload) leave undefined.
   */
  syncAll?: (params: {
    sourceId: string;
    workspaceId: string;
    dateStart: Date;
    dateEnd: Date;
  }) => Promise<ImportJob>;
}
```

Two design rules that make it provider-agnostic from day one:

1. **`alreadyImported` is no longer the adapter's job.** Remove `wasAlreadySynced` reliance from `searchAvailable`. The shared `<ImportSurface>` overlays sync status by calling `sync-status.service.getSyncStatusForExternalIds(sourceApp, items.map(i => i.externalId))` after a search. Every provider gets correct "already synced" greying for free — fixes the Zoom-UUID bug at the source.

2. **`syncAll` just maps to a server function name**, exactly like `importSelected` maps via `createSelectedImporter`. Add a sibling helper in `adapter-helpers.ts`:

```ts
// adapter-helpers.ts (NEW helper, mirrors createSelectedImporter)
export function createSyncAll(config: {
  functionName: string;          // 'connector-sync-all'
  buildBody?: (...) => Record<string, unknown>;
}): NonNullable<ConnectorAdapter["syncAll"]>;
```

Most adapters become a one-liner: `syncAll: createSyncAll({ functionName: "connector-sync-all" })`. The single `connector-sync-all` Edge Function dispatches per `source_app` internally (see Q4), so adapters don't each need their own function.

**`connectorRegistry.ts` change:** none structural — the registry already dispatches by `source_app`. The new method rides the existing `getConnectorAdapter()` lookup. `connector-pipeline.ts` change: **none** — `runPipeline(supabase, userId, ConnectorRecord)` is already the universal write path; sync-all reuses it verbatim.

---

## Q4 — Server-side "sync all from provider" job

### Where it lives

**NEW Edge Function `supabase/functions/connector-sync-all/index.ts`.** One generic function, dispatched by `source_app` (do not fork per provider). It reuses the proven pattern in `sync-meetings/index.ts`:

- Create a `sync_jobs` row up front (`mode='sync_all'`, `source_app`, `source_id`, `organization_id`, `workspace_id`, `date_start`, `date_end`, `status='processing'`).
- Return `{ jobId }` immediately; do the work in `EdgeRuntime.waitUntil(...)` (identical to sync-meetings:912).

### How it pages the provider internally

Today `sync-meetings` is given an explicit `recordingIds[]` and the UI decided the list (the root fault — "sync all" only syncs what the UI scrolled). `connector-sync-all` inverts this: **the server owns the cursor.**

Per `source_app`, a small `listProviderCalls(authHeaders, { dateStart, dateEnd, cursor })` adapter (server-side, in `_shared/`) returns `{ items, nextCursor }` — Fathom already has this shape (`sync-meetings:597` walks `next_cursor`). Loop:

```
cursor = job.provider_cursor ?? null            // resume point
loop:
  page = listProviderCalls(creds, { dateStart, dateEnd, cursor })
  for call in page.items:
     runPipeline(supabase, userId, toConnectorRecord(call))   // dedup is built-in → skipped
     update sync_jobs: progress_current++, synced_ids/failed_ids/skipped_count
  cursor = page.nextCursor
  update sync_jobs.provider_cursor = cursor       // CHECKPOINT every page
  if !cursor: break
finalize status: completed | completed_with_errors | failed
```

### Progress reporting into `sync_jobs`

Identical mechanism to the verified `processSyncJob` in sync-meetings (per-item `UPDATE sync_jobs SET progress_current, synced_ids, failed_ids, skipped_count`). Realtime then pushes those updates to every subscribed surface (Q5). Final status uses the same three-way rule already in sync-meetings:795 (`completed` / `failed` / `completed_with_errors`).

### Checkpoint / resume

`sync_jobs.provider_cursor` + `date_start/date_end` make the job resumable. Two resume triggers:
- **Edge timeout / crash:** a watchdog (or the next `useSyncAll` invocation) finds a `processing` job older than N minutes for that `(source_app, source_id)` and re-invokes `connector-sync-all` with the existing `jobId`; the loop reads `provider_cursor` and continues. Because `runPipeline` dedups on `source_call_id`, re-processing a partially-done page is safe (already-imported calls return `skipped`).
- **Date-range continuation:** because dedup is idempotent, a user re-running "sync all" over an overlapping range never double-imports.

Reuse note: credential resolution + OAuth refresh in `sync-meetings:324-540` is substantial and provider-specific. Extract it to `_shared/connector-credentials.ts` so both `sync-meetings` and `connector-sync-all` share one tested path rather than copy-pasting the 200-line refresh block.

---

## Q5 — Data flow: live progress + durable selection

### Live progress (DB → client)

```
connector-sync-all / sync-meetings (Edge, waitUntil)
   │  per-page UPDATE sync_jobs SET progress_current, synced_ids, failed_ids
   ▼
Postgres sync_jobs ── Supabase Realtime (postgres_changes, filter source_app+org) ──►
   ▼
useSyncJobs (NEW, single hook)
   │  Realtime primary + polling fallback (the proven hybrid from useSyncTabState:206)
   ▼
<SyncJobBanner> on EVERY surface  ── "Syncing 18/30" → "18 imported, 12 failed — Retry"
```

Keep the **hybrid Realtime+poll** pattern from `useSyncTabState` (it already handles `CHANNEL_ERROR` by falling back to 2s polling) — but consolidate it into one `useSyncJobs` hook instead of an inline effect, and **remove the 8-second auto-dismiss** (`completedJobTimeoutsRef`, the `setTimeout(..., 8000)` at useSyncTabState:176). Completed/failed jobs persist in the banner until the user dismisses or navigates intentionally — that is the JOB-workstream requirement ("no silent 8-second auto-dismiss").

### Durable selection (client store ↔ server truth)

```
User checks rows in <TranscriptTable>
   ▼
useImportSelection → importSelectionStore (Zustand, persist middleware → localStorage)
   key: `${sourceApp}::${externalId}`   scoped by { sourceId, dateStart, dateEnd }
   ▼  (survives navigation, date change*, OAuth redirect/return)
"Import selected" → adapter.importSelected({ externalIds: selectionForScope })
   ▼
sync_jobs row created → selection store CLEARS the imported keys on job creation (not on completion)
   ▼
sync-status.service overlays recordings truth on next search → imported rows grey out
```

- **Store, not component state.** This is the core fix: selection lives in `src/stores/importSelectionStore.ts` (Zustand v5 double-invocation `create<T>()(persist(...))`), never in `useState`. Navigation, background refetch, and the OAuth round-trip no longer wipe it.
- **Scope discipline:** selections are stored per `(sourceId, dateStart, dateEnd)` so switching providers or date ranges shows the right set; *changing date range preserves the prior range's selection rather than nuking it (`clearUnsyncedSelection` on every fetch is exactly what loses John's selections today — useSyncTabOrchestration:232).
- **Server truth wins for "synced".** The store tracks *intent* (what the user picked). Whether something is *imported* always comes from `sync-status.service` reading `recordings` — never from the store. On reconciliation, any selected key that is now synced is dropped from the selection automatically.

---

## Architectural Patterns

### Pattern 1: Resource over action (job ledger as source of truth)
**What:** Every import is a `sync_jobs` row, not a fire-and-forget invoke. The UI renders the ledger.
**When:** Any operation whose progress/result must survive navigation.
**Trade-off:** One extra write per page of progress (already paid today); buys durability + observability + retry for free.

### Pattern 2: Canonical-read, source-detail-write
**What:** Status is read from one canonical table (`recordings`); provider-specific tables (`fathom_calls`) are write-only detail stores never consulted for status.
**When:** Multi-provider systems where each provider has bespoke detail.
**Trade-off:** Slight denormalization (`source_call_id` duplicated as the cross-provider key) in exchange for one read path and no `parseInt`-class bugs.

### Pattern 3: Registry dispatch + thin adapters + one server function
**What:** `connectorRegistry` dispatches by `source_app`; adapters are ~30-line declarations (`createSyncAll`, `createSelectedImporter`); one generic Edge Function dispatches server-side.
**When:** N providers needing identical lifecycle.
**Trade-off:** Indirection, but adding provider #8 stays ≤2 days (issue #283 acceptance) and a fix to the pipeline benefits all 7 at once.

---

## Anti-Patterns (the ones that caused this milestone)

### Anti-Pattern 1: Selection in volatile component state
**What people do:** `useState<Set>()` for selection (current `useSyncTabSelection`, wizard) + `clearUnsyncedSelection()` on every fetch.
**Why it's wrong:** wiped by navigation, background refetch, OAuth redirect, and re-fetch → John's vanishing selections.
**Instead:** persisted Zustand store scoped by source + date range; clear only on job creation.

### Anti-Pattern 2: Provider-specific status reads with numeric coercion
**What people do:** `checkSyncedRecordingIds` → `parseInt(externalId)` against `fathom_calls`.
**Why it's wrong:** drops every UUID-id provider (Zoom/Fireflies/Grain) → "non-Fathom recordings invisible," duplicate imports.
**Instead:** one `getSyncStatusForExternalIds(sourceApp, string[])` against `recordings.source_call_id` (TEXT).

### Anti-Pattern 3: UI-driven "sync all"
**What people do:** "sync all" = import whatever the client has scrolled into memory (the `recordingIds[]` the UI passes to sync-meetings).
**Why it's wrong:** silently incomplete; depends on paging luck.
**Instead:** server owns the cursor (`connector-sync-all`), decoupled from UI scroll, checkpointed in `sync_jobs.provider_cursor`.

### Anti-Pattern 4: Timed auto-dismiss of job results
**What people do:** `setTimeout(dismiss, 8000)` on completed jobs.
**Why it's wrong:** the user navigates away mid-import and the result (esp. failures) is gone.
**Instead:** persist in `<SyncJobBanner>` until explicit dismissal; retry button wired to the existing single-call retry (`sync-meetings` `singleCallId`, sync-meetings:297).

---

## Integration Points

### Internal boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `<ImportSurface>` ↔ adapters | `getConnectorAdapter(sourceApp)` → `searchAvailable`/`importSelected`/`syncAll` | Boot-time constraint: a missing adapter throws (registry.ts:56). Adding `syncAll` is additive; safe. |
| adapters ↔ Edge Functions | `supabase.functions.invoke` via `invokeConnectorFunction` (adapter-helpers.ts:41) | `syncAll` reuses `createSyncAll` → `connector-sync-all` |
| Edge Functions ↔ DB | service-role client; `runPipeline` for writes; `sync_jobs` for progress | `connector-pipeline.ts` unchanged |
| client ↔ job progress | Supabase Realtime `postgres_changes` on `sync_jobs` + poll fallback | one `useSyncJobs` hook |
| selection store ↔ server truth | store = intent; `recordings` = truth; reconcile on search | never trust the store for "synced" |

### Boot-time / fragile constraints (must respect)
- **`source-registry.ts` `oauthCallbackFunctionName`** entries are load-bearing — missing entry crashes React mount. Run `npm run build` against the **committed** tree before every push during the refactor (PROJECT.md:120).
- **Dual recording-ID rule** — `externalId` = `source_call_id` (provider id, TEXT). Never `parseInt` it; never confuse with `recordings.id` (UUID) or `fathom_provider_id` (BIGINT bridge). Route any UUID/legacy crossing through `src/lib/recording-ids.ts`.
- **`recordings.share_url`** is not a column — use `resolveShareUrl()`.
- **RLS** — new `sync_jobs` columns need an `organization_id`-scoped policy; add `sync_jobs` to `CROSS_ORG_TABLES` in `src/test/rls-regression.test.ts` (CI gate).
- **Env safety** — any migration runs against `.env` PROD ref `vltmrnjsubfzrgrtdqey`; the proposed migration is additive (`ADD COLUMN IF NOT EXISTS`) — non-destructive.

---

## Suggested Build Order (dependency-ordered; NEW vs MODIFIED)

| # | Deliverable | Type | Depends on | Why this order |
|---|-------------|------|------------|----------------|
| 1 | `sync-status.service.ts` (`getSyncStatusForExternalIds`) + delete `checkSyncedRecordingIds` | NEW + DELETE | — | Foundation. Provider-agnostic truth must exist before any surface can render correct "synced" state. Fixes the Zoom-UUID bug immediately. |
| 2 | `sync_jobs` durable-resource migration (+RLS, +regression-test row) | NEW (migration, additive) | — | Schema must land before sync-all and the consolidated poller can use scope/cursor. Parallel with #1. |
| 3 | `importSelectionStore.ts` + `useImportSelection.ts` | NEW | — | Durable selection is independent of UI shape; build it standalone with tests. Parallel with #1/#2. |
| 4 | `useSyncJobs.ts` (consolidated Realtime+poll, no 8s dismiss) | NEW | #2 | Needs the extended `sync_jobs` scope columns to filter per source/org. |
| 5 | `<ImportSurface>` + `<SyncJobBanner>` (`TranscriptTable`-based) | NEW | #1, #3, #4 | The shared surface consumes status + selection + jobs. Model on `UnsyncedMeetingsSection`. |
| 6 | Wire `ImportPage` + `SyncTab` to `<ImportSurface>`; delete wizard + sync-tab hooks/sections | MODIFIED + DELETE | #5 | Collapse the fork once the replacement is proven on one page. |
| 7 | Adapter contract: add `syncAll` + `createSyncAll`; drop `wasAlreadySynced` from `searchAvailable` | MODIFIED | #1 | `getSyncStatus` overlay (from #1) must exist before removing per-adapter `alreadyImported`. |
| 8 | `connector-sync-all/` Edge Function + extract `_shared/connector-credentials.ts` | NEW + MODIFIED | #2, #7 | Needs the schema (cursor/scope) and the adapter `syncAll` entry. Reuses `runPipeline` as-is. |
| 9 | `sync-meetings/index.ts` — generalize progress writes, share credential helper, keep as Fathom selected-import path | MODIFIED | #8 | Refactor after the shared credential module exists; lowest-risk last. |
| 10 | Partial-success + retry banner wired to `singleCallId` retry path | MODIFIED | #5, #9 | Final UX polish on the durable foundation. |

**Critical path:** #1 → #5 → #6 (sync-status unblocks the surface, which unblocks the fork collapse). #2 → #4/#8 (schema unblocks observability + server sync-all). #1, #2, #3 can run in parallel as the foundation tier.

---

## Confidence

| Area | Confidence | Reason |
|------|------------|--------|
| Sync-status split + reconciliation | HIGH | Both readers + `checkDuplicate` read directly; `parseInt` Fathom-only bug verified |
| `sync_jobs` schema gaps | HIGH | Read base table + both progress migrations; current cols enumerated |
| Adapter contract extension | HIGH | `ConnectorAdapter` interface + fathom adapter + helper factories read |
| Fork collapse targets | HIGH | Wizard (634L), SyncTab, UnsyncedMeetingsSection, all sync-tab hooks read |
| Server sync-all design | MEDIUM-HIGH | Pattern is a direct generalization of verified `sync-meetings`; per-provider `listProviderCalls` shapes for the 6 non-Fathom providers not individually verified in this pass (each provider's `fetch-*` function should be confirmed during phase planning) |
| Realtime vs poll for progress | HIGH | Existing hybrid pattern verified in `useSyncTabState` |

## Gaps to resolve in phase planning

- Per-provider server-side list endpoint shapes (Zoom/Fireflies/Grain/Read.ai/PLAUD list+cursor) — confirm each `fetch-*`/`*-sync-meetings` function exposes a date-range + cursor list before wiring `connector-sync-all` for that provider. Fathom is confirmed.
- Whether PLAUD/YouTube/file-upload should advertise `syncAll` at all (webhook-only / no list endpoint → leave `syncAll` undefined, surface "imports automatically").
- Exact Realtime payload column whitelist (ensure new `sync_jobs` columns are in the publication).

---

## Sources

- `supabase/functions/sync-meetings/index.ts` — verified job processor, EdgeRuntime.waitUntil, provider paging, three-way status, single-call retry
- `supabase/functions/_shared/connector-pipeline.ts` — verified `runPipeline`/`checkDuplicate` canonical write + dedup contract
- `src/services/sync-tab.service.ts` (`fetchSyncedCalls`:62, `checkSyncedRecordingIds`:588) — verified the sync-status split
- `src/hooks/useSyncTabState.ts` / `useSyncTabOrchestration.ts` / `useSyncTabSelection.ts` — verified volatile-state fork + Realtime+poll pattern + 8s auto-dismiss + `clearUnsyncedSelection`-on-fetch
- `src/components/connectors/registry/types.ts` + `connectorRegistry.ts` + `adapters/fathom.ts` + `adapter-helpers.ts` — verified adapter contract + dispatch + helper factories
- `src/components/transcripts/UnsyncedMeetingsSection.tsx` + `SyncStatusIndicator.tsx` — verified `TranscriptTable` reuse template + status indicator
- `src/components/connectors/ConnectorImportWizard.tsx` (634L) + `src/pages/ImportPage.tsx` — verified the to-delete forked surface + routing
- `src/lib/recording-ids.ts` + `src/CLAUDE.md` — verified dual recording-ID rules
- `supabase/migrations/00000000000000_consolidated_schema.sql:173` + `20251124010359` + `20260410180000` — verified current `sync_jobs` schema
- `.planning/PROJECT.md` — milestone scope, constraints, fragile-surface list

---
*Architecture research for: durable/observable/provider-agnostic call import (CallVault v2.1)*
*Researched: 2026-06-18*
