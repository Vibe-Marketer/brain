# Phase 28: Server-Side Sync-All — Research

**Researched:** 2026-06-25
**Domain:** Resumable checkpoint/resume provider pager on Supabase Edge + Postgres (multi-provider call import)
**Confidence:** HIGH — every claim below is grounded in the real codebase (provider fetch fns, migrations, connector-pipeline) read this session; provider pagination contracts are quoted from the actual `_shared/*-client.ts` files.

---

<user_constraints>
## User Constraints (from 28-CONTEXT.md)

### Locked Decisions
- **The pager (SYNC-01):** New edge function (e.g. `connector-sync-all`) processes ONE provider page per invocation: fetch a page → upsert new calls via the shared connector-pipeline (dedup on `source_call_id`) → persist `provider_cursor` + progress to `sync_jobs` → self-chain OR pg_cron driver picks it up. Must NOT run the whole batch inside one `EdgeRuntime.waitUntil` (the `sync-meetings` anti-pattern). Heartbeat each slice (Phase 27 reaper reaps it if it dies).
- **Adapter contract (SYNC-02):** Add optional `syncAll` to `registry/types.ts`. Implement for list-API providers whose list endpoints expose date-range + cursor paging (CONFIRM each in research). Leave undefined for webhook/manual-only (PLAUD/YouTube/file-upload — surface "imports automatically").
- **Idempotency (SYNC-03):** Pager upserts through the shared connector-pipeline which dedups on `(organization_id, source_app, source_call_id)` — the Phase 24 unique constraint guarantees no duplicates even under concurrent selective-import + sync-all + slice-retry. Verify with a real-DB test.
- **UI seam (Phase 26):** Backend pager deploys this phase; frontend "Sync all" button wiring lands in code but the FRONTEND push is batched to milestone-end.

### Claude's Discretion
- Self-chain vs cron-driver
- pgmq vs claim-table
- Per-provider chunk/page size (size to stay well under ~400s per slice — spike to measure)
- Exact cursor encoding per provider

### Deferred Ideas (OUT OF SCOPE)
- Frontend "Sync all" button push (batched to milestone-end operator review)
- Scheduled auto-sync (AUTO-01)
- Partial-success/retry-failures UI (Phase 29 / FAIL) — BUT the sync-all job MUST record `failed_ids`/`skipped` so Phase 29 can surface/retry
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SYNC-01 | Resumable checkpoint/resume "Sync all" job — one provider page per invocation, persist `provider_cursor`, self-chain + pg_cron heartbeat (NOT one long batch loop) | `sync_jobs` already has `provider_cursor`, `mode`, `date_start/end`, `source_app`, `last_heartbeat_at`, `source_id` (migration `20260620120000`). Reaper already live (`reap_stale_sync_jobs` + `sync-jobs-reaper` cron, `20260623120000`). Claim-table + pg_cron+pg_net precedent in `20251128100000_embedding_queue_system.sql`. Pager architecture + self-chain decision below. |
| SYNC-02 | Optional `syncAll` adapter entry — implemented by list-API providers (Fathom, Zoom, Fireflies, Grain, Read.ai); undefined for webhook/manual-only (PLAUD, YouTube, file-upload) | **Per-provider capability table below — with a MATERIAL CORRECTION: Plaud is NOT webhook-only. It has a working list endpoint + `searchAvailable` + offset pagination + server-side date filter. See "SPIKE Finding 1 — Plaud conflict."** All five named providers confirmed CAN. YouTube + file-upload confirmed CANNOT (no list endpoint). |
| SYNC-03 | Idempotent on `source_call_id`, safe concurrent with selective import (no duplicates) | DB unique constraint `recordings_source_dedup UNIQUE (organization_id, source_app, source_call_id)` exists (migration `20260303000004`). `runPipeline`/`checkDuplicate` in `connector-pipeline.ts` dedups. **One subtle correctness gap flagged below** (`checkDuplicate` queries `owner_user_id` while the DB constraint is org-scoped — concurrency race window). |
</phase_requirements>

## Summary

Phase 28 is well-scaffolded by Phases 24/27: `sync_jobs` already carries every column a resumable pager needs (`provider_cursor`, `mode`, `date_start`, `date_end`, `source_app`, `source_id`, `last_heartbeat_at`), the zombie reaper is already live on PROD+TEST, and the in-repo `embedding_queue` claim-table + pg_cron+pg_net worker is a proven precedent. The genuinely new work is a single checkpoint/resume edge function plus an optional `syncAll` adapter entry — not new infrastructure.

The spike resolved the critical unknown — per-provider list+cursor capability — against the actual provider client code. **All five named providers (Fathom, Zoom, Fireflies, Grain, Read.ai) CAN support server-side sync-all**, but with three materially different pagination shapes that the pager must handle: opaque-cursor (Fathom, Grain), page-token (Zoom, with a hard 30-day window cap), last-id cursor (Read.ai, with a hard `limit ≤ 10`), and offset/skip (Fireflies). **The single biggest correction to the plan's assumptions: Plaud is NOT webhook-only** — it ships a real list endpoint (`/open/third-party/files/?page=&page_size=`), a working `searchAvailable`, offset pagination, and server-side date filtering. The CONTEXT.md/REQUIREMENTS.md classification of Plaud as "no list endpoint, technically impossible" is contradicted by the code. YouTube and file-upload are correctly webhook/manual-only (no `searchAvailable`, no list endpoint).

**Primary recommendation:** Build one provider-agnostic `connector-sync-all` edge function that processes ONE page per invocation and SELF-CHAINS via `supabase.functions.invoke` (or `pg_net` POST to itself), with the already-live `sync-jobs-reaper` + a new pg_cron resume-heartbeat as the crash safety net. Use the in-repo claim-table pattern (NOT pgmq) — a single-cursor pager needs a ledger row, not a message queue. Drive paging through a per-provider `listPage(cursor, dateStart, dateEnd)` abstraction added to each provider's `_shared/*-client.ts`. Reuse `runPipeline` verbatim for idempotency. Treat `skipped` (duplicate) as success. Persist `provider_cursor` + `synced_ids`/`failed_ids`/`skipped_count` after every page so resume is exact and Phase 29 can read failures.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Provider paging (fetch a page of calls by date+cursor) | API / Edge Function | — | Live external provider API calls; needs service-role + decrypted OAuth tokens. Never the browser. |
| Cursor + progress persistence | Database (`sync_jobs`) | API / Edge | The job row is the source of truth + the Realtime surface. Edge writes it each slice. |
| Self-chain / resume scheduling | API / Edge (self-invoke) | Database (pg_cron heartbeat) | Self-chain is the fast loop; pg_cron is the backup that re-kicks stuck jobs. |
| Idempotency / dedup | Database (unique constraint) | API / Edge (`checkDuplicate`) | The DB constraint is the hard guarantee; `checkDuplicate` is a fast-path optimization that can race (see pitfall). |
| Job observability (progress, failures) | Database (`sync_jobs` + Realtime) | Frontend (Phase 27 `useSyncJobs`) | Already built in Phase 27 — sync-all just writes the same row shape. |
| Failure recording for retry | Database (`sync_jobs.failed_ids`) | Frontend (Phase 29) | Pager records `failed_ids`/`skipped_count`; Phase 29 surfaces/retries. |
| "Sync all" button | Frontend (ImportSurface) | API / Edge | Deferred to milestone-end push per CONTEXT; backend only this phase. |

## Standard Stack

### Core
| Library / Asset | Version | Purpose | Why Standard (for THIS repo) |
|-----------------|---------|---------|------------------------------|
| `sync_jobs` table (existing) | n/a | Durable job ledger + cursor + progress + Realtime surface | Already has all Phase-28 columns; already in `supabase_realtime` publication; already org-RLS'd. `[VERIFIED: migration 20260620120000_sync_jobs_durable_resource.sql]` |
| `connector-pipeline.ts` `runPipeline`/`checkDuplicate` (existing) | n/a | Dedup + insert recording + workspace entry + routing | The idempotency primitive. Returns `{skipped:true}` for duplicates. Reuse verbatim. `[VERIFIED: supabase/functions/_shared/connector-pipeline.ts]` |
| Claim-table queue pattern (`embedding_queue`) | n/a | Atomic claim (`FOR UPDATE SKIP LOCKED`), stale-lock release, `dead_letter`, backoff | Proven in-repo precedent. The pager driver copies this shape. `[VERIFIED: migration 20251128100000_embedding_queue_system.sql]` |
| pg_cron + pg_net (existing, enabled) | pg_cron in `extensions`, pg_net enabled | Resume heartbeat: re-kick stuck `processing` sync-all jobs from saved cursor | Already running 4+ cron jobs incl. `sync-jobs-reaper` and `embedding-worker-backup`. `[VERIFIED: migrations 20260623120000, 20251128100000]` |
| `reap_stale_sync_jobs()` + `sync-jobs-reaper` cron (existing, LIVE) | n/a | Flips stale `processing` jobs to `failed` (heartbeat >5min, or NULL-heartbeat created_at >15min) | The death-detection net is already live on PROD+TEST. `[VERIFIED: migration 20260623120000_sync_jobs_reaper.sql]` |
| `EdgeRuntime.waitUntil` (bounded, existing) | Supabase Edge Runtime | Process ONE bounded page after returning HTTP, then self-chain | Keep the pattern but bound it to one page. `[VERIFIED: sync-meetings/index.ts line 921; connector-function-utils.ts line 660]` |
| Zod | `https://esm.sh/zod@3.23.8` (Edge) / 3.25 (app) | Validate the "start sync-all" payload (sourceId, source_app, dateStart, dateEnd) | Repo validation standard. `[VERIFIED: supabase/CLAUDE.md]` |

### Supporting
| Asset | Version | Purpose | When to Use |
|-------|---------|---------|-------------|
| `fetchSyncedSourceCallIds` (existing helper) | n/a | Batch "already synced?" lookup by `source_call_id` | Already used by Grain/Read.ai/Fireflies fetch fns. Pager can skip a pre-check and rely on `runPipeline` dedup instead. `[VERIFIED: connector-function-utils.ts line 470]` |
| `getConnectorDateWindow` / `getConnectorDateWindowMs` (existing) | n/a | Normalize `createdAfter/createdBefore/dateStart/dateEnd` into a single window | Reuse so the pager speaks each provider's date dialect. `[VERIFIED: connector-function-utils.ts line 31]` |
| `runConnectorSyncJob` (existing) | n/a | Generic bounded sync-job runner (creates `sync_jobs` row, loops ids, writes progress) | **Do NOT use as-is for sync-all** — it loops ALL ids inside one `waitUntil` (the anti-pattern). Useful as a reference for the per-page write shape. `[VERIFIED: connector-function-utils.ts line 546]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Claim-table (single cursor row) | pgmq (Supabase Queues, GA) | pgmq gives visibility-timeout + `read_ct` but no DLQ and adds queue semantics a single-cursor pager doesn't need. The job row IS the cursor — a message queue is the wrong shape here. Keep claim-table. `[CITED: STACK.md §1]` |
| Self-chain via `functions.invoke` | pg_cron driver advances all 'processing' sync-all jobs | Cron min interval is 1 min (sub-minute flaky) → slow throughput if cron is the primary loop. Use self-chain as primary, cron as backup. `[CITED: STACK.md §1, §2]` |
| New `connector-sync-all` fn | Extend `sync-meetings` | `sync-meetings` is Fathom-only + the anti-pattern. Build provider-agnostic from day one. `[VERIFIED: sync-meetings/index.ts]` |

**Installation:** No new npm packages. No new vendors. Everything is in-repo or Supabase-native. (Hard requirement from REQUIREMENTS.md "Out of Scope": no Inngest/Trigger.dev/QStash/BullMQ.)

## Package Legitimacy Audit

> Not applicable — Phase 28 installs ZERO external packages. All dependencies (`@supabase/supabase-js`, `zod`) are already in the repo and Supabase-native. The "Out of Scope" table in REQUIREMENTS.md explicitly forbids external job-queue vendors. No slopcheck needed.

## SPIKE RESULTS — Per-Provider Capability (the critical unknown)

### Per-Provider Capability Table

| Provider | List endpoint? | Date-range filter? | Pagination shape | Page-size cap | Verdict | Cursor to persist in `provider_cursor` |
|----------|---------------|--------------------|------------------|---------------|---------|----------------------------------------|
| **Fathom** | YES — `GET /external/v1/meetings` | YES — `created_after` / `created_before` | Opaque cursor (`next_cursor` in body, `?cursor=`) | not enforced in code (uses default) | **CAN** | opaque `next_cursor` string |
| **Grain** | YES — `POST /_/public-api/v2/recordings` | YES — `filter.after_datetime` / `before_datetime` | Opaque cursor (`cursor` in/out) | server default | **CAN** (cleanest) | opaque `cursor` string |
| **Zoom** | YES — `GET /users/me/recordings` | YES — `from` / `to` (**HARD 30-day window**) | Page token (`next_page_token`) | `page_size=300` (max) | **CAN — with date-window caveat** | composite: `{window_from, window_to, next_page_token}` |
| **Read.ai** | YES — `GET /v1/meetings` | YES — `start_time_ms.gte` / `.lte` | Last-id cursor (`?cursor=`, derived from last item id; `has_more`) | **HARD `limit ≤ 10`** (`clampReadAiLimit`) | **CAN — small pages, more slices** | last item `id` (cursor) |
| **Fireflies** | YES — GraphQL `transcripts(...)` | YES — `fromDate` / `toDate` | **OFFSET** (`skip` / `limit`, max `limit=50`) | `limit ≤ 50` | **CAN — offset not cursor** | `skip` offset as string |
| **Plaud** | **YES — `/open/third-party/files/?page=&page_size=`** | **Server-side filter (fetch page → `isWithinDateRange`)** | **OFFSET** (`listFilesByOffset(skip, limit)`; cursor = skip string) | `page_size` default 50 | **CAN — CONTRADICTS CONTEXT (see Finding 1)** | `skip` offset as string |
| **YouTube** | NO list endpoint (URL-driven import only) | n/a | n/a | n/a | **CANNOT** — `authMethods: ["none"]`, no `searchAvailable` | — |
| **file-upload** | NO list endpoint (manual upload) | n/a | n/a | n/a | **CANNOT** — no `searchAvailable` | — |

`[VERIFIED]` every row above against the named source files:
- Fathom: `sync-meetings/index.ts` lines 600–635 (`?cursor=`, `created_after/before`, `data.next_cursor`).
- Grain: `_shared/grain-client.ts` `listRecordings()` lines 195–215 (`body.cursor`, `filter.after_datetime/before_datetime`, returns `cursor`).
- Zoom: `zoom-fetch-meetings/index.ts` lines 204–315 (30-day window chunking, `next_page_token`, `page_size=300`).
- Read.ai: `_shared/read-ai-client.ts` `listMeetings()` lines 151–171 + `clampReadAiLimit` lines 217–220 (`limit` clamped to 10); cursor derived in `read-ai-fetch-meetings/index.ts` line 55.
- Fireflies: `_shared/fireflies-connector.ts` `FIREFLIES_TRANSCRIPTS_QUERY` lines 21–48 + `fetchFirefliesTranscripts` lines 202–226 (`skip`/`limit`).
- Plaud: `_shared/plaud-client.ts` `listFiles`/`listFilesByOffset` lines 282–360 + `plaud-sync-recordings/index.ts` lines 317–344, 424–430 (`isWithinDateRange`, `nextCursor = String(skip)`).

### SPIKE Finding 1 — Plaud conflict (MUST resolve in planning)

**CONTEXT.md and REQUIREMENTS.md both classify Plaud as "webhook/manual-only — no provider list endpoint exists; server-side sync-all is technically impossible."** The code contradicts this:

- `_shared/plaud-client.ts` exposes `listFiles(page, pageSize)` and `listFilesByOffset(skip, limit)` against `/open/third-party/files/`.
- `plaud-sync-recordings/index.ts` has a `mode: 'search'` branch that pages files, filters by date server-side (`isWithinDateRange`), and returns `nextCursor`.
- `src/components/connectors/registry/adapters/plaud.ts` already implements `searchAvailable` AND `importSelected`.

**So Plaud technically CAN support server-side sync-all** — same offset-paging shape as Fireflies. The Plaud list endpoint has **no native date filter** (filtering is done in code after fetching each page), which makes a "sync all in a date range" slightly less efficient (must page through and discard out-of-range files) but fully functional.

**Recommendation:** Treat this as a SCOPE DECISION for the planner/operator, not a silent assumption. Options:
1. **Keep Plaud out of SYNC-02** (honor CONTEXT's locked decision) — defensible because Plaud's primary mode is webhook/bulk-sync and the date filter is post-fetch (inefficient for large backfills). Document WHY (operator chose webhook-first), not "impossible."
2. **Add Plaud to SYNC-02** — the offset-pager covers it for free once Fireflies' offset shape is built. Low marginal cost.

Either is valid. What's NOT valid is shipping the "technically impossible" rationale in the plan — that's factually wrong per the code. `[VERIFIED: plaud-client.ts, plaud-sync-recordings/index.ts, plaud.ts]`

### SPIKE Finding 2 — three pagination shapes, not one

The pager cannot assume "opaque cursor." It must handle:
- **Opaque cursor** (Fathom, Grain): persist the provider's token verbatim; pass back next slice.
- **Page token + bounded date window** (Zoom): the cursor is NOT enough — Zoom caps `from`→`to` at 30 days. A sync-all over >30 days must iterate date windows AND page-token within each window. `provider_cursor` must encode `{current_window_from, current_window_to, next_page_token}`.
- **Offset** (Fireflies, Plaud): persist the `skip` offset as a string; advance by page size. Termination when a page returns fewer than `limit` rows.
- **Last-id cursor with tiny pages** (Read.ai): `limit ≤ 10` means ~10 calls/page → many more slices for the same volume. Budget accordingly.

**Recommendation:** Define a per-provider `listPage` adapter in each `_shared/*-client.ts` returning a uniform `{ items, nextCursor: string | null }` where `nextCursor` is an OPAQUE STRING the pager round-trips into `provider_cursor` without interpreting. Each provider encodes its own dialect (token / offset / composite window+token / last-id) inside that string. The pager stays provider-agnostic; the encoding lives with the provider. `[VERIFIED: shapes from each *-client.ts]`

### SPIKE Finding 3 — page-size / slice budget (SYNC-01 §4)

Edge wall-clock is **400s paid / 150s free**; `waitUntil` shares the same cap; CPU 2s/request (excludes async I/O). `[CITED: STACK.md Verified Facts, supabase.com/docs/guides/functions/limits]`

The dominant cost per page is N detail-fetches (transcript + summary) + N `runPipeline` inserts, not the list call. From `sync-meetings`: ~500ms inter-item delay + 2 parallel detail fetches per item + rate-limiter throttle. Empirically, the existing per-item loop is the slow part.

**Recommendation — conservative defaults + a measure-first task:**
- **Start at one LIST page per invocation**, and within it process detail-fetch+upsert for that page's items, capping items processed per slice at a safe number well under the wall clock.
- Safe conservative default per slice: **list page size 25–50**, but cap detail-fetch+upsert work to **~20–25 items per slice** (at ~1–1.5s/item incl. throttle + 2 detail calls, 25 items ≈ 30–40s — comfortably under 150s free / 400s paid even with retries).
- Read.ai is constrained to 10/page by the API → 10 items/slice naturally.
- Zoom can return up to 300/page but you do NOT have to process all 300 in one slice — process a sub-batch and persist a within-page offset in `provider_cursor` if needed.
- **Add a Wave-0/early task: measure real page latency per provider on TEST** (one slice, log elapsed) and tune the per-slice item cap from data. Do not hard-code a number that assumes uniform provider speed — Read.ai (tiny pages) and Zoom (huge pages, 30-day windows) are outliers. `[VERIFIED: sync-meetings/index.ts loop timing; STACK.md Edge limits]`

## Architecture Patterns

### System Architecture Diagram

```
User clicks "Sync all from <provider>"  (Frontend — deferred to milestone-end push)
            │  (creates sync_jobs row: mode='all', source_app, source_id, date_start/end, status='processing', provider_cursor=NULL)
            ▼
   ┌─────────────────────────────────────────────────────────────┐
   │  connector-sync-all  (NEW edge fn — service role)            │
   │                                                              │
   │  1. Load job row (by jobId) → read provider_cursor + dates   │
   │  2. Resolve provider listPage() via source_app              │
   │  3. fetch ONE page: listPage(cursor, dateStart, dateEnd)     │◀──────────┐
   │         │                                                    │           │
   │  4. for each item in page:                                   │           │
   │         runPipeline(...)  → 'synced' | 'skipped' | 'failed'  │           │
   │  5. write sync_jobs: synced_ids/failed_ids/skipped_count,    │           │
   │         provider_cursor = page.nextCursor,                   │           │
   │         last_heartbeat_at = now()                            │           │
   │  6. if page.nextCursor != null:                              │           │
   │         SELF-CHAIN: functions.invoke('connector-sync-all',   │───────────┘  (next slice)
   │                      { jobId })   [fire-and-forget]          │
   │     else: status = completed | completed_with_errors | failed│
   └─────────────────────────────────────────────────────────────┘
            │ writes                                  ▲ re-kick if stuck
            ▼                                         │
   ┌──────────────────┐         ┌──────────────────────────────────────┐
   │   sync_jobs (DB) │◀────────│ pg_cron heartbeat (NEW) +             │
   │  cursor+progress │         │ sync-jobs-reaper (LIVE) — resumes /   │
   │  Realtime source │         │ fails stale 'processing' sync-all jobs│
   └──────────────────┘         └──────────────────────────────────────┘
            │ postgres_changes (Realtime) + polling fallback
            ▼
   Phase 27 useSyncJobs → progress banner/chip (already built)
```

### Recommended Project Structure
```
supabase/functions/
├── connector-sync-all/
│   └── index.ts            # NEW: provider-agnostic one-page-per-invocation pager
├── _shared/
│   ├── connector-pipeline.ts      # REUSE runPipeline (idempotency)
│   ├── connector-function-utils.ts# REUSE date-window + synced-id helpers
│   ├── fathom-client.ts           # ADD listPage(cursor, start, end) → {items, nextCursor}
│   ├── grain-client.ts            # ADD listPage wrapper around listRecordings
│   ├── zoom-client.ts             # ADD listPage with 30-day-window+token cursor encoding
│   ├── read-ai-client.ts          # ADD listPage (limit<=10, last-id cursor)
│   └── fireflies-connector.ts     # ADD listPage (skip/limit offset cursor)
supabase/migrations/
└── YYYYMMDDHHMMSS_sync_all_resume_heartbeat.sql  # NEW: pg_cron resume re-kick for mode='all'
src/components/connectors/registry/
└── types.ts               # ADD optional syncAll? to ConnectorAdapter
```

### Pattern 1: One page per invocation + self-chain
**What:** Each invocation does exactly one provider page, persists `provider_cursor`, then fires the next invocation (or stops). The DB row is the resume point.
**When to use:** Always for unbounded sync-all. Never a `for`-loop over all pages inside one `waitUntil`.
**Example (shape, grounded in existing code):**
```typescript
// Source: derived from sync-meetings/index.ts + connector-function-utils runConnectorSyncJob,
//         inverted so the SERVER owns the cursor and chains one page at a time.
const job = await loadSyncJob(supabase, jobId);            // reads provider_cursor, dates, source_app
const page = await listPageFor(job.source_app)({           // per-provider opaque cursor
  cursor: job.provider_cursor,
  dateStart: job.date_start,
  dateEnd: job.date_end,
  accessToken,
});
for (const item of page.items) {
  const r = await runPipeline(supabase, userId, toConnectorRecord(item)); // dedup verbatim
  if (r.success) synced.push(item.externalId);
  else if (r.skipped) skippedCount++;        // skipped == success (duplicate) — DO NOT count as failure
  else failed.push(item.externalId);
}
await supabase.from('sync_jobs').update({
  synced_ids: synced, failed_ids: failed, skipped_count: skippedCount,
  provider_cursor: page.nextCursor,
  last_heartbeat_at: new Date().toISOString(),               // heartbeat EVERY slice (reaper net)
  ...(page.nextCursor ? {} : { status: finalStatus, completed_at: new Date().toISOString() }),
}).eq('id', jobId);
if (page.nextCursor) {
  // fire-and-forget self-chain — do NOT await; return HTTP immediately
  supabase.functions.invoke('connector-sync-all', { body: { jobId }, headers: { Authorization: `Bearer ${jwt}` } });
}
```

### Anti-Patterns to Avoid
- **The `sync-meetings` / `runConnectorSyncJob` whole-batch loop:** iterating every id (or `maxPages=100`) inside one `EdgeRuntime.waitUntil`. Shares the 400s cap; dies silently mid-run with no completion write — the exact "only some imported, nothing told me" bug this phase kills. `[VERIFIED: sync-meetings/index.ts line 599 maxPages=100 + line 921 waitUntil; connector-function-utils.ts line 660]`
- **Counting `skipped` (duplicate) as a failure:** would mark idempotent re-runs as errors. `runPipeline` returns `{skipped:true}` for dups — treat as success. `[VERIFIED: connector-pipeline.ts line 576]`
- **Interpreting `provider_cursor` in the pager:** keep it opaque; each provider encodes its own dialect. Otherwise the pager grows a `switch` per provider quirk.
- **Sub-minute pg_cron as the primary loop:** unreliable; use self-chain as primary, cron as backup heartbeat. `[CITED: STACK.md §1]`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dedup / "already imported?" | A new uniqueness check | `runPipeline` (DB unique constraint + `checkDuplicate`) | Constraint `recordings_source_dedup` is the hard guarantee; pipeline handles re-import (row exists, no workspace entry) too. `[VERIFIED: connector-pipeline.ts, migration 20260303000004]` |
| Zombie-job detection | A new reaper | `reap_stale_sync_jobs` + `sync-jobs-reaper` cron (LIVE) | Already on PROD+TEST; heartbeat each slice and the existing reaper covers death. `[VERIFIED: migration 20260623120000]` |
| Atomic claim / stale-lock release | New SQL | Copy `claim_embedding_tasks` `FOR UPDATE SKIP LOCKED` shape | Proven precedent. `[VERIFIED: migration 20251128100000]` |
| Date-window normalization | Per-provider date parsing | `getConnectorDateWindow` / `getConnectorDateWindowMs` | Already handles `createdAfter/Before` + `dateStart/End`. `[VERIFIED: connector-function-utils.ts line 31]` |
| OAuth token refresh per provider | Inline refresh | `resolveOAuthAccessToken` (Grain/Read.ai) + per-provider refreshers | Already abstracted with reconnect-required marking. `[VERIFIED: connector-function-utils.ts line 404]` |
| Cron → edge invocation | New HTTP plumbing | `net.http_post` (pg_net) — same shape as `embedding-worker-backup` | Already in production with the prod ref. `[VERIFIED: migration 20251128100000 lines 261–271]` |

**Key insight:** Phase 28's only genuinely new code is (a) one provider-agnostic pager fn, (b) a per-provider `listPage` wrapper, (c) an optional `syncAll` adapter entry, (d) one resume-heartbeat cron migration. Everything else — ledger, reaper, dedup, date-window, OAuth refresh, Realtime, claim pattern — already exists.

## Runtime State Inventory

> Phase 28 is primarily NEW code (a pager) + an additive migration. It does NOT rename/migrate existing stored state. Inventory included for the additive-migration + cron + cursor-state surface.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `sync_jobs` rows: new sync-all jobs write `mode='all'` + `provider_cursor`. Existing rows unaffected (additive cols already shipped Phase 24). | None — additive only. |
| Live service config | **pg_cron**: a NEW `sync-all-resume-heartbeat` cron job will be registered in `cron.job` (lives in the DB, not git beyond the migration). `sync-jobs-reaper` + `embedding-worker-backup` already live. | New cron registration via migration; verify in `cron.job` post-deploy (PROD ref `vltmrnjsubfzrgrtdqey`). |
| OS-registered state | None — no OS-level tasks. | None. |
| Secrets/env vars | Reuses existing per-provider OAuth client id/secret env (`FATHOM_OAUTH_*`, `GRAIN_OAUTH_*`, `READAI_OAUTH_*`, `ZOOM_*`), `OAUTH_ENCRYPTION_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. No new secrets. | None — verified all already read by existing fetch fns. |
| Build artifacts | New edge fn must be deployed `--use-api` (Docker-less). Cron migration applied via prod-ref-guarded `supabase db push`. | Deploy `connector-sync-all --use-api`; push migration to TEST then PROD. |

**The canonical question — after files are updated, what runtime state still references old behavior?** The `sync-jobs-reaper` cron's 5-min stale-heartbeat threshold assumes a job writes a heartbeat at least every 5 min. The self-chaining pager writes a heartbeat EVERY slice — verify slice cadence stays well under 5 min (it will at 25-item slices). If a provider stalls a single slice past 5 min, the reaper will (correctly) fail it. `[VERIFIED: migration 20260623120000 line 55]`

## Common Pitfalls

### Pitfall 1: `checkDuplicate` is user-scoped but the unique constraint is org-scoped (SYNC-03 race)
**What goes wrong:** Two concurrent slices (or selective-import + sync-all) for the same call can BOTH pass `checkDuplicate` (which queries `recordings WHERE owner_user_id = ... AND source_app = ... AND source_call_id = ...`) before either inserts, then BOTH attempt `insertRecording`.
**Why it happens:** `checkDuplicate` reads `owner_user_id` (`connector-pipeline.ts` line 99–104) but the hard guarantee is the DB constraint on `(organization_id, source_app, source_call_id)` (`migration 20260303000004`). The check is a fast-path, not a lock.
**How to avoid:** This is actually SAFE for correctness — the DB unique constraint catches the second insert and `insertRecording` throws, `runPipeline` returns `{success:false, error}`. The risk is the loser slice records a spurious `failed` instead of `skipped`. **Mitigation for the plan:** in the pager, treat a unique-violation error from `runPipeline` as `skipped` (duplicate), not `failed`. Detect the Postgres unique-violation (code `23505`) message and reclassify. Add this to the real-DB concurrency test.
**Warning signs:** A concurrent selective-import + sync-all test shows `failed_ids` containing calls that actually got imported by the other path.
`[VERIFIED: connector-pipeline.ts lines 91–104 (user-scoped check) + 259–281 (insert throws on constraint); migration 20260303000004 (org-scoped constraint)]`

### Pitfall 2: NULL `source_call_id` defeats the unique constraint
**What goes wrong:** Postgres treats NULLs as distinct in a unique constraint, so two rows with NULL `source_call_id` would both insert.
**Why it happens:** Legacy rows had NULL `source_call_id`; a provider returning a null/empty external id would slip through.
**How to avoid:** The pager must NEVER pass an empty `external_id` to `runPipeline`. Every provider's `listPage` already maps a non-empty `recording_id`/`id` — assert it. (Migration `20260620120500_backfill_null_source_call_id.sql` already backfilled legacy NULLs.)
**Warning signs:** Duplicate rows for calls whose provider id failed to map.
`[VERIFIED: migration 20260620120500_backfill_null_source_call_id.sql comments]`

### Pitfall 3: Zoom's 30-day window cap silently truncates a large backfill
**What goes wrong:** A "sync all" over a year of Zoom calls passes `from`/`to` >30 days apart → Zoom rejects or truncates.
**Why it happens:** Zoom API hard-limits `from`→`to` to 30 days (`zoom-fetch-meetings/index.ts` lines 204–226 already chunk into 30-day windows).
**How to avoid:** Zoom's `listPage` cursor must encode BOTH the current 30-day window AND the `next_page_token`. When a window's pages exhaust, advance to the next window; only return `nextCursor=null` when the final window's final page is done.
**Warning signs:** Sync-all "completes" but only the most recent 30 days imported.
`[VERIFIED: zoom-fetch-meetings/index.ts lines 204–315]`

### Pitfall 4: Read.ai's `limit ≤ 10` means many slices — heartbeat/cron interaction
**What goes wrong:** A large Read.ai backfill needs hundreds of 10-item slices; if self-chain ever drops a link, the resume must be exact.
**Why it happens:** `clampReadAiLimit` hard-caps page size to 10 (`read-ai-client.ts` lines 217–220).
**How to avoid:** Persist the last-id cursor every slice (already the design). The pg_cron resume-heartbeat re-kicks any `processing` sync-all job whose `last_heartbeat_at` is stale but before the reaper's 5-min fail threshold — i.e., schedule the resume cron to re-invoke stuck jobs at e.g. 2 min, leaving the 5-min reaper as the final give-up.
**Warning signs:** Read.ai sync-all stalls partway with a non-null `provider_cursor` and no further heartbeats.
`[VERIFIED: read-ai-client.ts lines 217–220]`

### Pitfall 5: `EdgeRuntime.waitUntil` after returning HTTP can still be killed at the cap
**What goes wrong:** Even one bounded page in `waitUntil` can hit the wall clock if a provider is slow.
**Why it happens:** `waitUntil` shares the same 400s/150s cap; `beforeunload` fires just before shutdown.
**How to avoid:** Keep per-slice work small (Finding 3), write progress+cursor BEFORE self-chaining, and optionally flush partial progress in a `beforeunload` handler. The reaper + resume-cron recover any slice that dies before its write.
**Warning signs:** A slice with no progress write and a stale heartbeat.
`[CITED: STACK.md Verified Facts; supabase.com/docs/guides/functions/background-tasks]`

## Code Examples

### Per-provider `listPage` uniform contract (the abstraction the pager depends on)
```typescript
// Source: synthesized from the 5 provider client signatures read this session.
// Each provider implements this; nextCursor is an OPAQUE string the pager round-trips.
interface ListPageResult<T> { items: T[]; nextCursor: string | null; }

interface ListPageParams {
  accessToken: string;
  cursor: string | null;       // == sync_jobs.provider_cursor (opaque)
  dateStart: string | null;    // ISO
  dateEnd: string | null;      // ISO
}

// Grain (opaque cursor — cleanest):  Source: grain-client.ts listRecordings()
async function grainListPage(p: ListPageParams): Promise<ListPageResult<GrainRecording>> {
  const res = await listRecordings<GrainRecording>({
    token: p.accessToken, cursor: p.cursor,
    afterDateTime: p.dateStart, beforeDateTime: p.dateEnd, fetchImpl: fetch,
  });
  return { items: res.recordings ?? [], nextCursor: res.cursor ?? null };
}

// Fireflies (offset cursor):  Source: fireflies-connector.ts fetchFirefliesTranscripts()
async function firefliesListPage(p: ListPageParams): Promise<ListPageResult<FirefliesTranscript>> {
  const skip = p.cursor ? parseInt(p.cursor, 10) : 0;
  const limit = 50;
  const items = await fetchFirefliesTranscripts(apiKey, {
    fromDate: p.dateStart, toDate: p.dateEnd, skip, limit,
  });
  return { items, nextCursor: items.length === limit ? String(skip + limit) : null };
}

// Read.ai (last-id cursor, limit<=10):  Source: read-ai-client.ts listMeetings()
async function readAiListPage(p: ListPageParams): Promise<ListPageResult<ReadAiMeeting>> {
  const res = await listMeetings<ReadAiMeeting>({
    token: p.accessToken, limit: clampReadAiLimit(10), cursor: p.cursor,
    startTimeMsGte: p.dateStart ? Date.parse(p.dateStart) : null,
    startTimeMsLte: p.dateEnd ? Date.parse(p.dateEnd) : null, fetchImpl: fetch,
  });
  const data = res.data ?? [];
  return { items: data, nextCursor: res.has_more && data.length ? data[data.length - 1].id : null };
}
```

### Resume-heartbeat cron (model the existing reaper/backup-worker)
```sql
-- Source: model of migration 20251128100000 (embedding-worker-backup) + 20260623120000 (reaper).
-- Re-kicks 'processing' sync-all jobs whose heartbeat is stale (>2min) but not yet reaper-failed (<5min).
SELECT cron.schedule(
  'sync-all-resume-heartbeat', '* * * * *',
  $body$
  SELECT net.http_post(
    url := 'https://vltmrnjsubfzrgrtdqey.supabase.co/functions/v1/connector-sync-all',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := json_build_object('jobId', sj.id)::jsonb
  )
  FROM public.sync_jobs sj
  WHERE sj.status = 'processing' AND sj.mode = 'all'
    AND sj.provider_cursor IS NOT NULL
    AND sj.last_heartbeat_at < NOW() - INTERVAL '2 minutes';
  $body$
);
```
> NOTE: `net.http_post` from cron will not carry a user JWT — `connector-sync-all` must authenticate the cron path via service role (the job row carries `user_id`/`organization_id`). Plan must define how the cron-invoked path authorizes (service-role + job-row ownership), distinct from the user-invoked start path.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `sync-meetings` whole-batch `waitUntil` (Fathom-only, maxPages=100) | One-page-per-invocation self-chaining provider-agnostic pager | Phase 28 | Eliminates silent mid-run death; resumable; provider-agnostic |
| Fathom-only `fathom_calls` synced check | Canonical `recordings.(source_app, source_call_id)` + org unique constraint | Phase 24 (IMP-01/02) | Every provider dedups correctly |
| Silent job death | `last_heartbeat_at` + `reap_stale_sync_jobs` cron (LIVE) | Phase 27 (JOB-02) | Dead jobs become visible failures |

**Deprecated/outdated:** Do not extend `sync-meetings` or `runConnectorSyncJob` for sync-all — both are the bounded/anti-pattern path.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Per-slice item cap of ~20–25 keeps a slice under the wall clock | SPIKE Finding 3 / Slice budget | If a provider is far slower, slices die at the cap — mitigated by reaper+resume-cron, but throughput suffers. **Add a measure-first task.** |
| A2 | Self-chain via `functions.invoke` from inside the fn reliably starts the next slice | Pattern 1 | If invoke-from-edge is unreliable, fall back to pg_cron resume-heartbeat as primary. The cron net is already specced. |
| A3 | Fathom/Grain/Read.ai opaque cursors remain stable across slices (no expiry within a backfill) | Capability table | If a cursor expires mid-backfill, resume restarts the window. Low risk; date-range bounds re-derive. |
| A4 | Zoom 30-day window + token can be encoded in a single `provider_cursor` string | Pitfall 3 | If encoding is lossy, Zoom backfill truncates — covered by the composite-cursor design + a Zoom-specific test. |
| A5 | Plaud SHOULD or SHOULD NOT be in SYNC-02 | SPIKE Finding 1 | Operator/planner decision. Code says CAN; CONTEXT says exclude. Must be decided explicitly, not assumed. |

## Open Questions

1. **Is Plaud in or out of SYNC-02?**
   - What we know: Plaud has a real list endpoint + offset paging + server-side date filter + working `searchAvailable`/`importSelected`. It technically CAN.
   - What's unclear: CONTEXT/REQUIREMENTS lock it OUT as "impossible" — which is factually wrong, but the *intent* (webhook-first) may still be valid.
   - Recommendation: Surface to operator in discuss/plan. If kept out, change the rationale from "impossible" to "webhook-first by choice; post-fetch date filter inefficient for backfill."

2. **Cron-invoked auth path for `connector-sync-all`.**
   - What we know: `net.http_post` from cron carries no user JWT; the job row has `user_id`/`organization_id`.
   - What's unclear: exact authorization for the cron/resume path vs the user-start path.
   - Recommendation: service-role path that loads the job row, derives `user_id`, and proceeds — distinct branch from the JWT-authenticated start. Plan must specify.

3. **Where does the sync-all job get `organization_id` for `runPipeline`?**
   - What we know: `runPipeline` resolves personal org if `organization_id` omitted; `sync_jobs` now has `organization_id`.
   - Recommendation: write `organization_id` onto the job at creation and pass it into `runPipeline` so the org-scoped dedup constraint is hit deterministically (avoids the user-vs-org scope race in Pitfall 1).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| pg_cron | Resume heartbeat + reaper | ✓ (in `extensions`, running 4+ jobs) | — | Self-chain is primary; cron is backup |
| pg_net | Cron → edge HTTP | ✓ (enabled, used by embedding-worker-backup) | — | — |
| `supabase functions deploy --use-api` | Deploy `connector-sync-all` (Docker-less) | ✓ (project default; Docker NOT running) | — | — |
| Per-provider OAuth secrets | Token refresh in pager | ✓ (already read by existing fetch fns) | — | — |
| Supabase TEST project | Real-DB concurrency + slice-latency tests | ✓ (separate project; `.env.test`) | — | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** Self-chain reliability (A2) — pg_cron resume is the fallback.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (integration via `*.integration.test.ts`, real Supabase TEST project) |
| Config file | `vitest.config.ts` (excludes integration unless `VITEST_INTEGRATION_OK=true`) |
| Quick run command | `npx vitest run <file>` |
| Full suite command | `npm run test:integration` (sets opt-in flag, points at integration globs) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SYNC-01 | Pager processes one page, persists `provider_cursor`, resumes from it | integration (real DB) | `npx vitest run supabase/functions/connector-sync-all/__tests__/resume.integration.test.ts` | ❌ Wave 0 |
| SYNC-01 | Reaper fails a stalled sync-all slice; resume-cron re-kicks before fail | integration | same suite | ❌ Wave 0 |
| SYNC-02 | Each list-API provider's `listPage` returns `{items, nextCursor}` and paginates to exhaustion | unit (mock fetch) | `npx vitest run supabase/functions/_shared/__tests__/listPage.test.ts` | ❌ Wave 0 |
| SYNC-03 | Concurrent selective-import + sync-all → exactly one `recordings` row per call (no dup) | integration (real DB) | `npx vitest run supabase/functions/connector-sync-all/__tests__/idempotency.integration.test.ts` | ❌ Wave 0 |
| SYNC-03 | Slice retry after simulated crash → no duplicate; loser reclassified `skipped` not `failed` | integration | same suite | ❌ Wave 0 |
| SYNC-01 | Failure recording: `failed_ids`/`skipped_count` written for Phase 29 | integration | resume suite | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run <touched test file>`
- **Per wave merge:** `npm run test:integration` (real TEST DB)
- **Phase gate:** full integration suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `supabase/functions/connector-sync-all/__tests__/resume.integration.test.ts` — SYNC-01 cursor persist/resume + reaper interaction
- [ ] `supabase/functions/connector-sync-all/__tests__/idempotency.integration.test.ts` — SYNC-03 concurrent + retry (the real-DB concurrency test CONTEXT requires)
- [ ] `supabase/functions/_shared/__tests__/listPage.test.ts` — per-provider pagination unit tests (offset/token/last-id/window)
- [ ] Slice-latency measurement task on TEST per provider (tunes per-slice item cap — A1)
- [ ] Integration test fixtures must follow `supabase/CLAUDE.md` cleanup contract (capture-before-mutate, `afterAll` restore, `cleanup_test_fixture_users` RPC). Mocks rejected for integration tests.

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | User-start path: `authenticateRequest` shared helper (JWT). Cron/resume path: service-role + job-row ownership (Open Question 2). |
| V3 Session Management | no | Stateless edge fn. |
| V4 Access Control | yes | `sync_jobs` org RLS (`sync_jobs_org_isolation`) + retained user policy; `runPipeline` resolves org; never trust client-provided org/workspace without membership check (`validateWorkspaceMembership`). |
| V5 Input Validation | yes | Zod on the start payload (`sourceId`, `source_app`, `dateStart`, `dateEnd`). Reject empty `external_id` before `runPipeline` (Pitfall 2). |
| V6 Cryptography | yes (delegated) | OAuth tokens decrypted via `getDecryptedOAuthTokens` / `resolveOAuthAccessToken`; never log tokens; `OAUTH_ENCRYPTION_KEY`. Do not hand-roll. |

### Known Threat Patterns for Supabase Edge + Postgres
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-org data leak via sync-all into wrong org | Elevation/Info disclosure | Org-scoped unique constraint + `runPipeline` org resolution + `sync_jobs` RLS; write `organization_id` onto job at creation. |
| IDOR on `jobId` (resume someone else's job) | Elevation | Cron/resume path must verify job-row ownership; user path scoped by JWT. |
| Token exposure in logs | Info disclosure | Never log `access_token`/headers; existing fns already avoid this. |
| Replay/duplicate inserts on retry | Tampering | DB unique constraint (`23505`) + reclassify violation as `skipped`. |
| Prod/test DB confusion (catastrophic) | Tampering | Integration tests use TEST project only (triple-guarded); migrations push prod-ref-guarded (`vltmrnjsubfzrgrtdqey`). |

## Project Constraints (from CLAUDE.md / supabase/CLAUDE.md)
- **Additive migrations only.** `ADD COLUMN IF NOT EXISTS`; guard publication/cron re-adds. The sync_jobs columns are already shipped — Phase 28's migration is the NEW resume-heartbeat cron only.
- **Edge deploy `--use-api`** (Docker not running on this machine).
- **`.env` = PROD ref `vltmrnjsubfzrgrtdqey`** vs `.env.test`. Migrations/DDL read `.env`; verify prod ref before connecting.
- **Never coerce IDs** — `source_call_id` is TEXT; provider ids stay strings.
- **RLS on all tables; CI RLS-regression test** — `sync_jobs` already covered. No new user-facing table needed (reuse `sync_jobs`); if a claim-table is added, register it in `CROSS_ORG_TABLES` + add RLS.
- **Shared `authenticateRequest`** for the user path; do not inline JWT parsing.
- **Integration tests:** real TEST DB only, `VITEST_INTEGRATION_OK=true`, mandatory `afterAll` cleanup, mocks rejected.
- **Function naming:** kebab-case folder (`connector-sync-all`), `sync*`/`fetch*` prefix conventions.

## Sources

### Primary (HIGH confidence — read directly this session)
- `supabase/functions/sync-meetings/index.ts` — the anti-pattern (waitUntil whole-batch, maxPages=100), Fathom cursor+date paging, sync_jobs write shape, heartbeat.
- `supabase/functions/_shared/connector-pipeline.ts` — `runPipeline`/`checkDuplicate` (dedup on `owner_user_id`+`source_app`+`source_call_id`; re-import path; insert throws on constraint).
- `supabase/functions/_shared/connector-function-utils.ts` — date-window helpers, `fetchSyncedSourceCallIds`, `resolveOAuthAccessToken`, `runConnectorSyncJob` (bounded reference).
- `supabase/functions/{zoom-fetch-meetings, fireflies-fetch-meetings, grain-fetch-recordings, read-ai-fetch-meetings, plaud-sync-recordings}/index.ts` — per-provider list+date+pagination.
- `supabase/functions/_shared/{grain-client, read-ai-client, fireflies-connector, plaud-client}.ts` — pagination contracts.
- `supabase/migrations/20260620120000_sync_jobs_durable_resource.sql` — sync_jobs columns + org RLS + Realtime.
- `supabase/migrations/20260623120000_sync_jobs_reaper.sql` — reaper fn + cron (LIVE).
- `supabase/migrations/20251128100000_embedding_queue_system.sql` — claim-table + pg_cron+pg_net precedent.
- `supabase/migrations/20260303000004_add_source_call_id.sql` — `recordings_source_dedup UNIQUE (organization_id, source_app, source_call_id)`.
- `supabase/migrations/20260620120500_backfill_null_source_call_id.sql` — NULL-distinct caveat.
- `src/components/connectors/registry/types.ts` — `ConnectorAdapter` (`searchAvailable`/`importSelected`; add `syncAll?`).
- `src/components/connectors/registry/adapters/*.ts` — which adapters have `searchAvailable` (all but youtube/file-upload, INCLUDING plaud).
- `supabase/CLAUDE.md` — additive migrations, `--use-api`, integration-test safety, prod-ref guard.

### Secondary (MEDIUM — verified against official docs in STACK.md)
- `.planning/research/STACK.md` — Edge limits (400s/150s, 2s CPU, 256MB), pgmq GA, pg_cron sub-minute flakiness, Realtime scaling. Sourced from supabase.com/docs (2026).

## Metadata
**Confidence breakdown:**
- Per-provider capability (the spike): HIGH — quoted from actual client code, not inferred.
- Pager architecture: HIGH — every building block already exists in-repo.
- Slice budget (page size): MEDIUM — conservative estimate; A1 flags a measure-first task.
- Plaud classification: HIGH that it CAN technically; the in/out decision is an operator call (A5).

**Research date:** 2026-06-25
**Valid until:** 2026-07-25 (stable — in-repo facts; re-check only if provider APIs change)
