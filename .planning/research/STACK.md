# Stack Research — v2.1 Import/Sync Rebuild (Durable, Observable Import)

**Domain:** Durable, observable, provider-agnostic call-import/sync subsystem on an existing Supabase + React B2B SaaS
**Researched:** 2026-06-18
**Confidence:** HIGH (Edge limits, pgmq GA, Realtime scaling, pg_cron — all verified against official Supabase docs 2026; reinforced by battle-tested patterns already running in this repo)

> NOTE: This file replaces the v2.0 Autonomous-Operations stack research (shipped milestone; preserved in git history). This is the v2.1 import/sync stack research.

---

## TL;DR Verdict

**Go Supabase-native. Add ZERO new vendors.** Every hard requirement for this rebuild is already solvable with tools that are (a) Supabase-native and (b) already running in production in *this* codebase.

- **The durable job ledger already exists** (`sync_jobs`) and the repo already ships a proven worker-queue pattern (`embedding_queue`: atomic claim via `FOR UPDATE SKIP LOCKED`, exponential backoff, stale-lock release, `dead_letter` status, pg_cron + pg_net worker). Reuse it — don't invent a new pattern, and don't add Inngest / Trigger.dev / QStash / BullMQ.
- **The server-side "sync all" pager must NOT be one long Edge Function call.** It will blow the wall-clock budget (400s paid / 150s free — and background `waitUntil` is bound by the SAME cap). It must be checkpoint/resume: one cursor page per invocation, persist `next_cursor` to the job row, self-chain to the next page, with a pg_cron heartbeat to resume stuck jobs.
- **Live progress: keep what already works.** `useSyncTabState.ts` already uses Realtime `postgres_changes` on `sync_jobs` with a polling fallback. At this app's scale (per-user job rows, tiny subscriber fan-out) that's correct. Do NOT migrate to Broadcast — that's a scale-only optimization you don't need.
- **Durable selection: Zustand `persist` middleware** (already in the stack). A DB draft row is overkill; `persist` is the lightest durable option that survives unmount and the full-page OAuth redirect.
- **The genuinely new work is correctness primitives, not infra:** idempotency/dedup keys, cursor persistence on the job row, rate-limit backoff honoring `Retry-After`, and optimistic-update reconciliation against `sync_jobs`.

The only dependency worth *considering* is **`p-retry`** (tiny, MIT, esm.sh) to standardize Edge backoff — and even that is optional since `FathomClient.fetchWithRetry` already exists. No external SaaS is justified.

---

## Question-by-Question Answers

### 1. Background-job durability — pgmq vs `sync_jobs` ledger vs pg_cron vs external queue

**Verdict: extend the existing `sync_jobs` ledger + reuse the in-repo claim-table queue pattern, driven by pg_cron + pg_net. pgmq is an optional clean upgrade; external queues are a hard no.**

- `sync_jobs` is the **ledger** (status, progress, results, cursor). It already exists and is already written by `sync-meetings`. Keep it as the source of truth and the Realtime surface.
- For the **unbounded "sync all" pager**, you need a *queue*, not just a ledger. The repo already has the exact thing: `embedding_queue` with `claim_embedding_tasks` (`FOR UPDATE SKIP LOCKED`, `next_retry_at` exponential backoff, 2-min stale-lock release, `dead_letter` status). Copy that shape for sync. It's RLS'd and proven under load *in this codebase*.
- **pg_cron** is the scheduler/heartbeat, NOT the work loop. It's already enabled and in production here (`embedding-worker-backup`, `fathom-daily-reconcile`, `google-poll-cron`). Use it to re-kick stuck jobs and as a backup tick — never as the primary fast loop (sub-minute cron is unreliable; see §below).
- **Supabase Queues (pgmq) is GA** as of 2026 and is a legitimate upgrade if you want queue semantics without hand-writing claim SQL, or if you'll run multiple concurrent sync workers. It gives visibility timeout, per-message `read_ct`, and an archive table. But it has **no built-in DLQ** (you build that on `read_ct`), and the claim-table the team already knows does everything the single-pager needs. **pgmq = optional, not required.**
- **External queues (Inngest / Trigger.dev / QStash / BullMQ+Redis): rejected.** Each adds a vendor, a secret, outbound egress, and breaks the customer-owned/Supabase-native principle. They solve orchestration problems this app doesn't have.

**Current state/limitations:**
- pgmq: GA, `send`/`read(vt)`/`pop`/`archive`/`delete`, per-message `read_ct`, client access via `pgmq_public` schema (disabled by default — server/service-role is unrestricted), no built-in DLQ, partitioned queues "coming soon."
- pg_cron: standard minimum interval 1 minute; Supabase advertises 1–59s but community reports seconds-intervals are flaky. Design the pager to **self-chain**, with cron only as a heartbeat.

### 2. Long-running work vs Edge Function wall-clock limits

**Current limits (verified, official docs):** wall-clock **400s paid / 150s free**, CPU **2s/request** (excludes async I/O), memory **256MB**, request idle timeout **150s**. Background tasks via `EdgeRuntime.waitUntil` are bound by the **same** wall-clock/CPU/memory caps — the function shuts down at the first limit hit, with a `beforeunload` event firing just before shutdown.

**Right pattern: checkpoint/resume, queue-driven steps.**
- One invocation = fetch ONE provider page from the persisted cursor → run each item through `connector-pipeline.ts` → write `synced_ids`/`failed_ids` + `next_cursor` back to the `sync_jobs` row.
- Then either self-chain (more pages remain → `functions.invoke`/`pg_net` the next step) or mark terminal status.
- A pg_cron heartbeat re-kicks any job stuck in `processing` past a stale threshold, resuming from the persisted cursor.
- Size each chunk to finish *well* inside the wall-clock cap with rate-limit pauses accounted for. The current `sync-meetings` allows `maxPages = 100` per recording lookup inside one `waitUntil` — that is the wall-clock-death risk this milestone must eliminate. Use `beforeunload` to flush partial progress before shutdown so a killed worker never leaves a silent gap.

### 3. Live progress to the UI — Realtime vs polling

**Verdict: keep Realtime `postgres_changes` on `sync_jobs` WITH the polling fallback. Do not migrate to Broadcast.**
- The existing hook already does this correctly: subscribes to `postgres_changes` filtered by `user_id`, falls back to 2s polling on `CHANNEL_ERROR`, drops to 10s polling when Realtime is healthy.
- `postgres_changes` scaling limits (one auth check per subscriber per change, single-threaded ordering) are NOT reached here — job rows are per-user with single-digit subscriber fan-out.
- **Broadcast-from-database** is the documented scale path, but it's a future optimization, not a current need. Revisit only if Realtime CPU shows up in metrics.
- **Keep the polling fallback.** Removing it reintroduces silent-failure risk — the exact bug class this milestone exists to kill.

### 4. Durable client selection surviving navigation/unmount/OAuth-return

**Verdict: Zustand `persist` middleware (already in stack). DB draft row only if cross-device sync is required (it isn't).**
- `persist` rehydrates from `localStorage`/`sessionStorage` on mount, so selection survives unmount and the full-page OAuth redirect. Key the persisted slice by `provider + date-range` so a different search context doesn't clobber an in-progress selection.
- A DB draft row (`import_drafts`) adds a write path, an RLS surface, and a migration for no benefit unless selection must survive on *another device*. The milestone only requires same-browser durability → `persist` is the lightest option.
- Note the Zustand v5 double-invocation requirement still applies with `persist`: `create<T>()(persist((set) => ({...}), { name, storage }))`.

### 5. Anything else the rebuild needs (correctness primitives)

- **Idempotency / dedup keys:** the pipeline already dedups (`runPipeline` returns `skipped`); ensure the sync-all path treats `skipped` as success (not failure) and that re-running a page is safe. The `(job_id, recording_id)` UNIQUE pattern from `embedding_queue` is the model for queue-level dedup.
- **Cursor persistence:** add `cursor`/`next_cursor` to `sync_jobs` so resume is exact. Without it, a killed worker restarts from page 0 and double-processes.
- **Rate-limit backoff:** honor `Retry-After` on 429s. The current `RateLimiter` is a fixed window; upgrade to respect the provider's header (optionally via `p-retry`). Provider-agnostic backoff belongs in `_shared`, not per-connector.
- **Optimistic-update reconciliation:** after a job completes, reconcile the optimistic "imported" UI state against the authoritative `sync_jobs.synced_ids`/`failed_ids` via `invalidateCallListCaches(queryClient)` (the existing unified-invalidation hub), so partial failures correct the optimistic view instead of leaving phantom "imported" rows.
- **Browse vs find/import split:** browse already-synced = cheap cached DB reads (TanStack Query); find/import new = expensive live provider calls (`functions.invoke`). Map the two surfaces onto these two data sources explicitly.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended (for THIS stack) |
|------------|---------|---------|-----------------|
| **`sync_jobs` table (existing)** | n/a | Durable job ledger: status, progress, synced_ids, failed_ids, cursor | Already the source of truth, already written by `sync-meetings`. Extend (add `cursor`, `provider`, `source_id`, `date_start/end`, `kind`) — don't replace. |
| **Postgres claim-table queue (existing `embedding_queue` pattern)** | n/a | Server-side "sync all" pager: durable enqueue, atomic claim, retries, stale-lock release | Repo already ships this exact pattern. Copy it. Zero new infra, zero vendor, already RLS'd, already proven under load. |
| **pg_cron + pg_net (existing, enabled)** | pg_cron ≥1.6, pg_net enabled | Heartbeat: re-kick stuck jobs; backup tick for the worker | Already in production here (3 cron jobs). Standard Supabase way to run a durable worker without an external scheduler. |
| **`EdgeRuntime.waitUntil` (existing) — bounded** | Deno Edge Runtime | Process a SINGLE bounded chunk after returning the HTTP response | Already used by `sync-meetings`. Keep it, but size the chunk to finish inside the wall-clock cap; use `beforeunload` to flush partial progress. |
| **Supabase Realtime `postgres_changes` (existing)** | `@supabase/supabase-js` 2.84 | Push `sync_jobs` updates to the UI live | Already wired with polling fallback. Correct at this scale. |
| **TanStack Query 5.90 (existing)** | 5.90 | Server cache for browse reads + post-job reconciliation | Locked pattern. Browse = cached DB reads; import = live Edge calls. |
| **Zustand 5.0 `persist` (existing)** | 5.0 | Durable selection surviving navigation/unmount/OAuth | Locked client-state tool. Lightest durable option — no DB write, no RLS, no migration. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **`@supabase/supabase-js`** | 2.84 (existing) | `pgmq_public` RPC (if pgmq adopted); Realtime channels | Already installed. No new dep even for the pgmq route. |
| **`p-retry`** | 6.x | Standardized exponential backoff + `Retry-After` in Edge worker | OPTIONAL. Only to retire ad-hoc `RateLimiter`/`fetchWithRetry`. Tiny, MIT, esm.sh-importable. |
| **`zod`** | 3.25 (existing) | Validate the "start sync-all" payload (provider, date range, source_id) | Already the validation standard. |
| **`date-fns` / `date-fns-tz`** | 3.6 / 3.2 (existing) | Pager date-range math; per-provider "Last synced X" | Already installed. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Supabase Dashboard → Database → Cron | Inspect/trigger the pager heartbeat | `cron.job` + `cron.job_run_details` already in repo runbooks |
| Supabase Dashboard → Queues (if pgmq adopted) | Visual queue depth/archive monitoring | Only if adopting pgmq; claim-table inspects via plain SQL |
| `supabase functions deploy --use-api` | Deploy the new worker (Docker-free) | Mandatory on this machine — already project default |

## Installation

```bash
# Core — NOTHING NEW required. All present in package.json:
#   @supabase/supabase-js@2.84, @tanstack/react-query@5.90, zustand@5.0,
#   zod@3.25, date-fns@3.6

# OPTIONAL (Edge-side backoff) — no npm install; import in Deno:
#   import pRetry from "https://esm.sh/p-retry@6";
```

Database side (migrations, not npm):

```sql
-- Reuse the in-repo claim-table pattern. Either:
--   (A) extend sync_jobs + add a sync_queue claim table modeled on embedding_queue, OR
--   (B) adopt pgmq:  CREATE EXTENSION IF NOT EXISTS pgmq;  select pgmq.create('provider_sync');
-- pg_cron + pg_net already enabled — no new extension migration for the scheduler.
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **Claim-table queue (`embedding_queue` pattern)** | **Supabase Queues (pgmq, GA)** | Adopt pgmq for first-class queue semantics (visibility timeout, `read_ct` retry, archive) without hand-writing claim SQL, or if running multiple concurrent sync workers. For a single per-provider pager the claim-table is simpler and already known. Clean upgrade, not a requirement. |
| **claim-table / pgmq** | **`sync_jobs`-as-ledger only (no queue)** | Fine for the BOUNDED path (user picked N specific calls — already works via `waitUntil`). The queue is only for the UNBOUNDED "sync all across a date range" pager. Don't over-engineer the bounded path. |
| **pg_cron + pg_net worker** | **Inngest / Trigger.dev / QStash / BullMQ+Redis** | Only for cross-cloud orchestration, step-level durable-workflow UIs, or high-volume sub-second scheduling. None apply. All add a vendor + secret + egress and break Supabase-native. Hard no. |
| **Realtime `postgres_changes`** | **Broadcast from Database (`realtime.broadcast_changes` trigger)** | Switch only if subscriber fan-out per change grows large or you hit the single-threaded `postgres_changes` ceiling. Not at per-user job-row scale. |
| **Zustand `persist`** | **DB draft row (`import_drafts`)** | Only if selection must sync across devices or be readable server-side. Milestone requires same-browser durability → `persist` covers it with far less weight. |
| **TanStack Query polling fallback** | **Realtime-only (no polling)** | Keep polling. Realtime drops on network blips; the existing hook degrades gracefully. Removing it reintroduces silent-failure — the bug this milestone kills. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Inngest / Trigger.dev / QStash / BullMQ+Redis** | New vendor, secret, egress; breaks customer-owned/Supabase-native; solves problems this app doesn't have | pg_cron + pg_net + claim-table (or pgmq), all in-repo |
| **One long `waitUntil` that pages the whole provider** | Background tasks share the **same 400s/150s wall-clock cap**. A multi-hundred-page sync can silently die mid-run with no completion write — exactly the "only some imported, no status" failure | Checkpoint/resume: one cursor page per invocation, persist `next_cursor`, self-chain + cron heartbeat |
| **Dropping RLS for a "public" Realtime table to scale** | RLS is the CI-gated multi-org isolation guarantee. Don't trade it for throughput you don't need | Keep RLS'd `postgres_changes`; move to Broadcast-from-database (still RLS-respecting) only if scale demands |
| **A brand-new third job table** | Repo already has `sync_jobs` (ledger) + `embedding_queue` (claim table). A third concept = more divergence, the root cause this milestone fixes | Extend `sync_jobs`; model the queue on `embedding_queue` |
| **Sub-minute pg_cron as a hard latency dependency** | Seconds-interval cron is community-reported unreliable; standard minimum is 1 minute | Self-chaining worker (immediate next-chunk re-invoke); cron only as backup heartbeat (the `embedding-worker-backup` model) |
| **Selection only in React `useState`** | This IS the bug — wiped on navigation, date change, refetch, OAuth redirect | Zustand `persist` (selection) + `sync_jobs` (progress/results) |

## Integration Points (named against actual files)

| Concern | File | Change |
|---------|------|--------|
| Server pager (bounded) | `supabase/functions/sync-meetings/index.ts` | Bound the chunk; persist `next_cursor`; add `beforeunload` partial-progress flush; treat `skipped` as success |
| Server pager (unbounded "sync all") | NEW `supabase/functions/sync-all/index.ts` + claim table | Modeled on `embedding_queue` + `claim_embedding_tasks`; cursor-paged; provider-agnostic via `connector-pipeline.ts` |
| Queue claim SQL precedent | `supabase/migrations/20251128100000_embedding_queue_system.sql` | Copy `FOR UPDATE SKIP LOCKED` claim, `next_retry_at` backoff, stale-lock release, `dead_letter` |
| Cron heartbeat precedent | `supabase/migrations/20260512000002_fathom_daily_reconcile_cron.sql` | Same `cron.schedule` + `net.http_post` shape for the resume heartbeat |
| Live progress | `src/hooks/useSyncTabState.ts` | Keep Realtime + polling; remove the 8s auto-dismiss; surface `failed_ids` |
| Durable selection | NEW Zustand store + `src/stores/` | `persist`-wrapped, keyed by provider+date-range; rehydrate on mount |
| Enqueue from UI | `src/components/connectors/registry/adapters/adapter-helpers.ts` | `createSelectedImporter` already returns `jobId` — wire selection-from-store and post-job reconciliation |
| Reconciliation | `src/lib/query-config.ts` (`invalidateCallListCaches`) | Call on job completion to correct optimistic state from `synced_ids`/`failed_ids` |

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `@supabase/supabase-js@2.84` | pgmq via `pgmq_public` schema | Client queue access disabled by default; expose `pgmq_public` + RLS. Server (service-role Edge) unrestricted. |
| pg_cron | pg_net (both enabled) | Already co-deployed in 3 production cron jobs. pg_cron calls Edge via `net.http_post`. |
| Realtime `postgres_changes` | RLS on `sync_jobs` | Realtime respects RLS — the `user_id=eq.<id>` channel filter + RLS is the isolation boundary. Keep both. |
| Zustand 5.0 `persist` | React 18 / Vite 5 | v5 double-invocation still applies: `create<T>()(persist((set) => ({...}), { name, storage }))` |

## Verified Facts (2026, official Supabase docs — not memory)

| Fact | Value | Source |
|------|-------|--------|
| Edge wall-clock (paid) | **400 s** | docs/guides/functions/limits |
| Edge wall-clock (free) | **150 s** | docs/guides/functions/limits |
| Edge CPU/request | **2 s** (excludes async I/O) | docs/guides/functions/limits |
| Edge memory | **256 MB** all plans | docs/guides/functions/limits |
| Request idle timeout | **150 s** (else 504) | docs/guides/functions/limits |
| Background tasks (`waitUntil`) | Bound by SAME wall-clock/CPU/memory caps; shuts down at first limit; `beforeunload` fires before shutdown | docs/guides/functions/background-tasks |
| Supabase Queues / pgmq | **GA**; `send`/`read(vt)`/`pop`/`archive`/`delete`; per-message `read_ct`; client access via `pgmq_public` (off by default); **no built-in DLQ**; partitioned queues "coming soon" | blog/supabase-queues, docs/guides/queues/api |
| pg_cron sub-minute | Advertised 1–59 s but community-reported unreliable; standard minimum 1 min | docs/guides/cron, supabase discussion #18274 |
| Realtime Postgres Changes scaling | One auth check per subscriber per change; single-threaded ordering; Broadcast recommended for scale | docs/guides/realtime/postgres-changes |

## Sources

- https://supabase.com/docs/guides/functions/limits — wall-clock (400s paid / 150s free), CPU (2s), memory (256MB), idle (150s). HIGH.
- https://supabase.com/docs/guides/functions/background-tasks — `waitUntil` bound by same limits; `beforeunload` shutdown hook. HIGH.
- https://supabase.com/blog/supabase-queues — pgmq GA, send/read/pop/archive, `pgmq_public` off by default, partitioned queues coming soon. HIGH.
- https://supabase.com/docs/guides/queues/api — pgmq signatures, `read(queue, vt, qty)`, `read_ct`, no built-in DLQ. HIGH.
- https://supabase.com/docs/guides/realtime/postgres-changes — postgres_changes scaling limits; Broadcast-from-database as scale path. HIGH.
- https://supabase.com/docs/guides/cron + https://github.com/orgs/supabase/discussions/18274 — pg_cron sub-minute advertised but flaky; 1-min standard minimum. MEDIUM.
- In-repo proof (read directly): `supabase/migrations/20251128100000_embedding_queue_system.sql` (claim-table queue: `FOR UPDATE SKIP LOCKED`, backoff, stale-lock release, dead_letter, pg_cron+pg_net worker); `supabase/functions/sync-meetings/index.ts` (`waitUntil`, `sync_jobs` writes, 100-page pager, completed_with_errors/failed_ids); `src/hooks/useSyncTabState.ts` (Realtime postgres_changes + polling fallback); `supabase/migrations/20260512000002_fathom_daily_reconcile_cron.sql` + google-poll cron (pg_cron in production). HIGH — decisive evidence the Supabase-native path is already proven in this exact codebase.

---
*Stack research for: v2.1 durable/observable import-sync rebuild (Supabase + React)*
*Researched: 2026-06-18*
