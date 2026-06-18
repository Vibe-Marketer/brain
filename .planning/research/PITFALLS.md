# Pitfalls Research

**Domain:** Durable, observable, provider-agnostic call import/sync subsystem on Supabase (Postgres + Deno Edge Functions) + React 18 (Zustand + TanStack Query)
**Researched:** 2026-06-18
**Confidence:** HIGH (codebase-grounded — every pitfall verified against the actual `sync-meetings`, `useSyncTabState`, `recording-ids`, CONCERNS.md; Supabase platform facts verified against current official docs)

> Phase names below are provisional, keyed to the PROJECT.md workstream codes (IMP, SEL, TBL, JOB, FAIL, SYNC, BROWSE). The roadmap will rename them; the **prevention task** and **ordering** are what matter.

---

## Critical Pitfalls

### Pitfall 1: Double-importing the same provider call (idempotency / dedup failure)

**What goes wrong:**
The same provider call lands in `recordings` twice. Three concrete trigger paths in *this* system:
1. **"Sync all" + selective import running concurrently.** The new server-side pager (SYNC) and a user's manual selective import (TBL) both fetch the same `recording_id` from Fathom and both call `runPipeline`. There is no per-(org, provider, provider_call_id) lock.
2. **Retry re-runs work that already succeeded.** A job that timed out mid-batch (see Pitfall 3) gets retried; the already-synced half gets re-inserted because the retry replays the original `recording_ids` array, not "the not-yet-synced subset."
3. **pgmq at-least-once redelivery.** If you move sync-all onto Supabase Queues, a consumer crash *guarantees* the message is redelivered after the visibility timeout — the same page of calls is processed again. pgmq is at-least-once, never exactly-once in practice for your work unit.

Today the only thing standing between you and duplicates is `runPipeline`'s internal dedup (`result.skipped`) plus the `fathom_raw_calls` upsert `onConflict: "recording_id,user_id"`. That conflict key is **user-scoped, not org-scoped**, and only covers the Fathom raw table — the canonical `recordings` row dedup lives elsewhere in the pipeline and is provider-specific.

**Why it happens:**
Dedup is currently an *emergent property* of the pipeline rather than a *declared constraint*. There is no single DB unique index that says "one provider call = one recording per org." Each connector reinvents its own fingerprint (`_shared/dedup-fingerprint.ts` for Zoom, pipeline dedup for Fathom, dead `_shared/deduplication.ts` adding confusion). "Provider-agnostic from day one" means you must pick ONE natural key shape now.

**How to avoid:**
- **Declare the natural key as a DB constraint.** Add a unique index `(organization_id, source_app, source_call_id)` on the canonical resolution path (and on whatever new `import_items`/job-line table you create). `source_call_id` (TEXT) already exists and already stores the provider's call id as a string for every connector — it is the correct provider-agnostic natural key. Do **not** invent a fingerprint when the provider gives you a stable id.
- **Make insert idempotent at the DB, not the app.** `INSERT ... ON CONFLICT (organization_id, source_app, source_call_id) DO NOTHING RETURNING id` — then "did we insert or was it already there" is a single atomic answer, not a read-then-write race.
- **Retry the not-yet-synced subset, never the original array.** Retry must be computed as `requested_ids − synced_ids` from the job ledger, not a blind replay.
- **If using pgmq: make the message handler idempotent on `source_call_id`** so redelivery is a no-op, and treat the work as at-least-once by design.

**CRITICAL — do NOT use `parseInt` / `Number()` on the natural key.** `source_call_id` is TEXT. `recordings.id` is UUID. `recordings.fathom_provider_id` is BIGINT. The natural-key index must key on the TEXT `source_call_id`, never a coerced numeric — coercing breaks the moment a non-Fathom provider (PLAUD, YouTube) uses a non-numeric call id. Route any cross-ID work through `toRecordingUuid` / `toRecordingUuidBatch` from `src/lib/recording-ids.ts`.

**Warning signs:**
- Two `recordings` rows with the same `source_call_id` and `organization_id`.
- Retry counts that exceed the original batch size.
- `skipped_count` climbing on a "fresh" sync (means the natural key isn't catching the dup at insert and you're relying on a downstream skip).

**Phase to address:** IMP (sync-status foundation) — this is the *first* phase. Land the unique constraint before any new write path is built on top of it.

---

### Pitfall 2: The split "is this synced?" signal — wrong reconciliation corrupts the whole surface

**What goes wrong:**
"Is this call already imported?" is answered today by reading `fathom_calls` (legacy, BIGINT-keyed, `user_id`-scoped) in `sync-tab.service.ts` (the Phase 9 TODO at lines 73–83). But canonical truth lives in `recordings` (UUID-keyed, `organization_id`-scoped). The two disagree in predictable ways:
- A Zoom/Grain/Read.ai/paste recording exists in `recordings` but has **no** `fathom_calls` row → the sync tab thinks it's *not* synced and offers to import it again → **duplicate** (loops back into Pitfall 1).
- A recording imported by a *teammate* in the same org is in `recordings` (org-scoped) but the current user's `fathom_calls` query (user-scoped) misses it → the UI shows "new, import me" → duplicate + cross-user confusion.
- A `fathom_calls` row whose canonical `recordings` row was deleted → "synced" badge for a call that no longer exists.

**Why it happens:**
Two sources of truth with different keys *and different scopes* (user vs org). Any new "N new available / M failed" status indicator (JOB) computed off the wrong table will be confidently wrong. This is the structural fault PROJECT.md's Iceberg analysis is pointing at.

**How to avoid:**
- **Pick `recordings` as the single source of truth, org-scoped, keyed on `(organization_id, source_app, source_call_id)`.** Legacy `fathom_calls` becomes a *detail/raw* table, never the synced-signal authority.
- **Compute "is synced?" as a set-difference against `recordings.source_call_id`** for the active org + provider, not a per-table existence check. The "N new available" count = `provider_call_ids − recordings.source_call_id (org, provider)`.
- **Backfill before you switch the read.** Verify every legacy `fathom_calls` row has a corresponding `recordings` row (the `canonical_recording_id` bridge column on `fathom_raw_calls` is the join). Reconcile orphans *before* flipping the signal, or the new surface will under- or over-report on day one.
- **Write a reconciliation integration test** (real DB, not mocked — the Phase 30/BUG-01 incident proved a mocked test passes for the exact UUID/BIGINT bug that broke prod) that seeds a Zoom recording + a Fathom recording + a paste recording and asserts all three report `synced=true` from one query.

**Warning signs:**
- Non-Fathom recordings showing as "not yet imported."
- The "new available" count differing between two users in the same org.
- `invalid input syntax for type uuid: "143800259"` in logs — someone passed a BIGINT where the org-scoped UUID path expected a UUID.

**Phase to address:** IMP (sync-status foundation) — must precede JOB (status indicator) and BROWSE (already-synced reads). Everything reads off this signal; get it right first.

---

### Pitfall 3: Edge Function wall-clock timeout kills "sync all" mid-batch

**What goes wrong:**
`sync-meetings` runs its whole batch inside `EdgeRuntime.waitUntil(processSyncJob())`. Supabase Edge Functions have a **hard wall-clock ceiling of 400s (paid plan), 150s (free)** — and `waitUntil` background tasks share that *same worker lifetime*, they do not get a separate budget. When the worker is killed:
- The job row is frozen at `status: "processing"` forever (zombie — see Pitfall 4).
- `synced_ids` reflects only what finished before the kill; the rest silently vanish.
- This is *exactly* John-from-Clickable's "only some imported, no status" complaint.

The current code makes this **dramatically worse**: `fetchMeetingMetadata` pages the Fathom `/meetings` list **up to 100 pages per recording** (line 594), inside a loop that also throttles at 30 req/min and `setTimeout(500ms)` between recordings. A 200-call "sync all" can issue tens of thousands of API calls and will blow 400s long before finishing. The server-side pager (SYNC) inherits this pathology if you lift the existing code.

**Why it happens:**
The function was built for small interactive batches and treats `waitUntil` as if it were a real durable worker. It is not — it is a best-effort "finish what you can before the worker dies" primitive.

**How to avoid:**
- **Chunk the work and make it resumable.** A sync-all job is a *plan* in the DB (a job row + a cursor), not a single function invocation. Each Edge Function invocation processes a bounded slice (e.g. one provider page or N recordings, well under 400s with margin), persists the cursor + progress, then **re-enqueues itself** (pgmq message, or `pg_cron`/`pg_net` self-trigger) for the next slice.
- **Never paginate-per-recording.** Fetch the provider's list page once, derive the set-difference against `recordings.source_call_id`, then fetch detail only for the genuinely-new ids. Kill the 100-pages-per-recording loop entirely.
- **Budget defensively.** Track elapsed time inside the slice; stop and re-enqueue at ~300s even if the slice isn't "full." Leave headroom for the final DB writes.
- **Use pgmq for the sync-all pager** (PROJECT.md's stated direction). Its visibility-timeout + redelivery gives you crash recovery for free — *provided* the handler is idempotent (Pitfall 1).

**Warning signs:**
- Jobs that consistently stall around the same elapsed time (~150s or ~400s).
- `progress_current` < `progress_total` on a "completed"-but-actually-killed job.
- Provider API call volume wildly disproportionate to recordings synced.

**Phase to address:** SYNC (server-side sync-all). Design the resumable/chunked model *before* writing the pager. Do not port `sync-meetings`' batch loop.

---

### Pitfall 4: Zombie jobs stuck "processing" forever (no heartbeat, no reaper)

**What goes wrong:**
A job dies (worker killed, crash, deploy mid-run) and its row stays `status: "processing"` permanently. The UI poller in `useSyncTabState` only looks at jobs `updated_at` within the last 60s — so a zombie *disappears from the active list* but is never marked failed. The user sees the spinner vanish with no result. There is currently **no heartbeat, no zombie reaping, and no max-age timeout** anywhere in the job lifecycle.

**Why it happens:**
The happy path updates `status` to a terminal value at the end of `processSyncJob`. The unhappy path (worker killed before that line runs) has no owner. Nothing periodically asks "is this 'processing' job actually still alive?"

**How to avoid:**
- **Add a heartbeat column.** The worker writes `last_heartbeat_at = NOW()` on every progress update (it already updates the row per-recording — piggyback on that). A job is "alive" only if its heartbeat is recent.
- **Add a reaper.** A `pg_cron` job (every 1–2 min) flips any `processing` job whose `last_heartbeat_at` is older than a threshold (e.g. 2× the slice budget, ~10 min) to `failed` with `error_message: "worker died (no heartbeat)"`, and — critically — re-enqueues its unfinished work if recoverable.
- **If using pgmq, lean on visibility timeout as the reaper** for the queue side: an un-acked message reappears automatically. But the *job ledger* row still needs the heartbeat+cron reaper, because the ledger is what the UI reads.
- **Make the terminal-status write resilient.** Wrap the final status update so a partial failure still records *something* terminal.

**Warning signs:**
- `SELECT count(*) FROM sync_jobs WHERE status='processing' AND updated_at < now() - interval '15 min'` returns > 0.
- Users reporting "the progress bar just disappeared."
- Growth in `processing` rows over time (they should always drain to terminal).

**Phase to address:** JOB (observable jobs) — heartbeat + reaper are part of making jobs *observable and trustworthy*, not an afterthought. Verification: a reaper integration test that inserts a stale `processing` row and asserts the cron flips it.

---

### Pitfall 5: The 8-second auto-dismiss hides failures (the original sin, ported forward)

**What goes wrong:**
`useSyncTabState.handleJobCompleted` (lines 175–184) starts an 8-second `setTimeout` that removes the completed job — **including `failed` and `completed_with_errors` jobs** — from `recentlyCompletedJobs`. A user who looks away for 9 seconds never learns that 12 of 30 calls failed. This is a primary cause of the "no status to tell him what happened" complaint, and it is trivially easy to re-introduce because it *feels* like good UX ("don't leave stale toasts around").

**Why it happens:**
Success and failure share one dismissal path. Auto-dismiss is correct for success, catastrophic for failure. The volatile React state means there's nowhere durable to *go back and check* after dismissal, so dismissal = permanent loss.

**How to avoid:**
- **Failure and partial-failure are durable, not ephemeral.** `completed_with_errors` / `failed` status and `failed_ids` live in the DB (they already do — surface them, don't auto-hide them). The status indicator ("18 of 30 imported, 12 failed — Retry") persists until the user acts (retries or dismisses explicitly).
- **Only auto-dismiss clean successes.** Branch on status: `completed` → optional 8s fade; anything with failures → sticky until acknowledged.
- **Surface results where the action happened** (PROJECT.md FAIL requirement) — the Retry affordance reads `failed_ids` from the job row, not from component state that's already been wiped.

**Warning signs:**
- A `setTimeout` that removes a job without checking `status`.
- Any failure surface that depends on `useState`/`recentlyCompletedJobs` rather than a DB read.
- Users asking "did it work?" after an import.

**Phase to address:** FAIL (partial-success + retry) and JOB. Remove the unconditional 8s dismiss in JOB; build the durable retry surface in FAIL.

---

### Pitfall 6: `source-registry.ts` boot-time crash during the connector refactor

**What goes wrong:**
`OAUTH_CALLBACK_ROUTES` is built at module load from `source-registry.ts`'s `oauthCallbackFunctionName` entries. If those entries are missing/empty, **React fails to mount — the entire app is a white screen in production.** This has already happened once (commit `9b6e3338`: working tree had 6 entries, committed tree had 0, prod crashed at runtime with `OAUTH_CALLBACK_ROUTES is empty`). Since "provider-agnostic from day one" means heavy churn in the connector registry, this is a *live* re-occurrence risk, not a historical note.

The deeper trap: the **uncommitted-files-as-real-code pattern** (CONCERNS.md). Refactors create new files imported by tracked code but never `git add`ed. Local build passes (files on disk); Vercel build fails (files not in the tree) — or worse, builds but crashes at runtime.

**Why it happens:**
A critical runtime invariant (every active source has a callback route) is enforced only implicitly by "did you remember to keep the registry in sync," and the build/test gate runs against the *working* tree, masking missing-from-committed-tree gaps.

**How to avoid:**
- **Build against the committed tree before every push during this milestone.** `git stash -u && npm run build && git stash pop` (or a clean checkout build). This is the only reliable catch for the untracked-file gap.
- **`git status --short | grep "^??"` before every commit** during connector work — explicitly look for untracked files that tracked code imports.
- **Add a runtime assertion + a unit test** that asserts `OAUTH_CALLBACK_ROUTES.length === <expected active source count>`. Make it a CI gate so a zeroed registry fails the build instead of prod.
- **Consider a pre-push hook** that runs `npm run build` on a clean stash (CONCERNS.md already recommends this).

**Warning signs:**
- White screen on prod after a connector deploy.
- `OAUTH_CALLBACK_ROUTES is empty` in the browser console.
- Vercel build failing on imports that resolve fine locally.

**Phase to address:** TBL (unified surface) and SYNC — any phase that touches `source-registry.ts` or connector wiring. Bake the build-against-committed-tree step and the registry-length test into the phase's done-criteria.

---

### Pitfall 7: Migrating import while live customers are mid-import

**What goes wrong:**
Customers import calls *today* via both `ConnectorImportWizard` and `SyncTab`, both writing `sync_jobs` rows that `useSyncTabState` reads. If the new durable model changes the `sync_jobs` schema (new columns, changed status enum, new required fields) or replaces the consumer, an in-flight job created by the *old* code becomes unreadable by the *new* code (or vice versa) → a customer's import silently breaks during the cutover window.

Specific landmines:
- The status enum is consumed in multiple places (`['pending','processing','completed','failed','completed_with_errors']` hardcoded in the poller). Adding/renaming a status without updating every consumer drops jobs from the active list.
- `recording_ids` is typed `number[]` in the client (`useSyncTabState` SyncJob interface). A provider-agnostic model needs TEXT/`source_call_id` ids — changing the column type breaks every in-flight numeric-id job.
- Removing the old poller before the new surface is proven leaves a window with *no* observability.

**Why it happens:**
The job ledger is a shared contract between two repos' worth of producers/consumers, and a "rebuild" is tempting to do as a big-bang replacement.

**How to avoid:**
- **Additive migrations only.** Add new columns (`source_call_ids TEXT[]`, `last_heartbeat_at`, natural-key fields) alongside the old ones. Backfill. Keep old columns until every consumer is migrated. Never rename/retype a column that in-flight jobs depend on in a single deploy.
- **Expand status enum, don't mutate it.** New statuses are additive; old consumers must tolerate unknown statuses (treat unknown as non-terminal, keep polling) rather than dropping the row.
- **Run old and new consumers in parallel** during cutover. The new durable poller reads the same `sync_jobs` rows; flip the UI surface only after confirming parity.
- **Drain before destructive changes.** Before any breaking schema change, check `SELECT count(*) FROM sync_jobs WHERE status IN ('pending','processing')` — wait for/migrate in-flight jobs, don't truncate them.
- **Build against the committed tree** (Pitfall 6) so the migration's client consumers actually ship together.

**Warning signs:**
- An in-flight job created seconds before deploy never reaching a terminal state.
- The poller's hardcoded status `.in([...])` list diverging from the DB enum.
- Type errors around `recording_ids: number[]` when introducing TEXT ids.

**Phase to address:** Cross-cutting, but anchor the additive-migration discipline in IMP (schema foundation) and enforce it in every subsequent phase that touches `sync_jobs`. Verification: a test that an old-shape job row is still readable by the new consumer.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Rely on `runPipeline`'s emergent dedup instead of a DB unique constraint | No migration needed | Concurrent sync-all + selective import duplicate calls; every connector reinvents dedup | **Never** for this milestone — the unique index is the whole point of IMP |
| Keep reading the synced-signal from `fathom_calls` | No backfill needed | Non-Fathom recordings invisible; cross-user miscounts; contradicts "unified vault" | **Never** — this is the root fault being rebuilt |
| Port `sync-meetings`' `waitUntil` batch loop into the sync-all pager | Reuses working code | Wall-clock timeout on large syncs; zombie jobs; no resumability | **Never** for sync-all; OK only for tiny interactive single-call retries |
| 100-pages-per-recording metadata fetch | Already written | Tens of thousands of API calls; guaranteed timeout + 429s | **Never** — replace with one list-page + set-difference |
| Selection in volatile `useState` | Simplest to write | Selections vanish on navigation/OAuth return (the original complaint) | **Never** — SEL exists to kill this |
| Auto-dismiss all completed jobs after 8s | Tidy UI | Hides failures permanently (no durable record to revisit) | OK for `completed` only; **never** for failures |
| Big-bang `sync_jobs` schema replacement | Cleaner final schema | Breaks in-flight customer imports during cutover | **Never** — additive + parallel-run only |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Provider APIs (Fathom/Zoom/etc.) — rate limits | Fixed `setTimeout` delays; per-recording pagination | Respect `429` + `Retry-After` with backoff (Fathom client has `fetchWithRetry` — use it everywhere); one list-page per sync, not per-recording |
| Provider pagination cursors | Assuming a cursor stays valid across a long-running job | Cursors expire; persist the cursor in the job row and re-fetch from a stable filter (date range) if a cursor 400s mid-resume |
| OAuth token refresh mid-job | Refreshing in one code path, reading stale token in another | Refresh once at slice start, persist new tokens to `import_sources` **and** `user_settings` (current code does both — keep it); on a long resumable job, re-check expiry at each slice boundary |
| Partial provider outage | Treating any failure as a hard job failure | Per-item `failed_ids` (current model is right); distinguish transient (retryable: 429/5xx/timeout) from permanent (404/403) so retry doesn't replay un-retryable items |
| Supabase Queues (pgmq) | Assuming exactly-once | It's **at-least-once** — message reappears after visibility timeout if not deleted/archived; handler MUST be idempotent on `source_call_id` |
| pgmq poison messages | No max-retry → message redelivers forever | Track `read_ct`; route to a dead-letter table after N reads (no native DLQ — you build it) |
| Supabase Realtime Postgres Changes | Subscribing every client to `sync_jobs` changes at scale | Change processing is **single-threaded** and runs a per-subscriber RLS check per event; filter tightly (`user_id=eq` — current code does this) and keep the polling fallback. For org-wide fan-out at scale, consider Broadcast instead |
| Realtime DELETE events | Expecting filtered DELETE or RLS on deletes | DELETE events **can't be filtered** and **bypass RLS** — never rely on DELETE events for the synced-signal; use INSERT/UPDATE |
| `generate-ai-titles` / `auto-tag-calls` fire-and-forget | Treating the `.then()` as confirmation | These are fire-and-forget (lines 826–895); failures only log. If a synced call must be tagged/titled, that's a separate observable step, not assumed-done |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| 100-pages-per-recording metadata fetch | Sync time grows super-linearly; 429 storms | One list-page → set-difference → detail only for new ids | Already broken at ~50+ calls over old date ranges |
| Dense import table renders all rows | Jank, slow scroll, frozen tab | Virtualize (`@tanstack/react-virtual`); paginate the data source; never render thousands of DOM rows | A few hundred rows in a non-virtualized table |
| `useState`-held selection over a large set | Re-render storms on every checkbox toggle | Selection in a Zustand store (SEL) keyed by id `Set`; subscribe granularly | ~500+ selectable rows |
| Per-recording `UPDATE sync_jobs` (current code updates the row every item) | Write amplification; Realtime event storm (single-threaded processing chokes) | Batch progress writes (every N items or every M seconds), not every item | Hundreds of items per job |
| TanStack Query refetch wiping the table mid-import | Rows jump/reset while user selects (made worse by "load 10 at a time") | Separate the durable "already-synced" query (cheap DB, BROWSE) from the live "find new" query (expensive provider, TBL); don't refetch the live list under the user | Any background refetch during active selection |
| Realtime channel leak | Memory growth; duplicate event handlers; "ghost" updates | One channel per surface, cleaned up in `useEffect` return (current code does this — preserve it); never create a channel per render | Long sessions, repeated mount/unmount |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Natural-key index scoped by `user_id` not `organization_id` | Cross-user dup within an org; teammate's import re-imported | Org-scope the natural key `(organization_id, source_app, source_call_id)` |
| New job/import tables without RLS in `CROSS_ORG_TABLES` | Cross-org leak of one customer's import activity | Add every new table to `CROSS_ORG_TABLES` in `rls-regression.test.ts` (CI gate); `import_sources`/`import_routing_rules` are already flagged as missing in CONCERNS.md |
| Realtime DELETE bypasses RLS | A client could observe other rows' deletes | Don't subscribe to or act on DELETE events for cross-tenant tables |
| Service-role Edge Function trusting client-supplied org/workspace id | IDOR — import into another org's vault | `validateRequestedWorkspaceId` already gates this (sync-meetings:543) — reuse it on every new write path, never trust the raw body |
| Logging provider tokens during refresh debugging | Secret leakage | Never log `oauth_access_token`/`refresh_token` (current code logs only status — keep it) |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Two divergent import UIs (wizard checkbox list + sync tab) | Inconsistent behavior, two paging models, double the bugs | One shared `TranscriptTable`-based surface (TBL) — one selection store, one paging model |
| Selection lost on navigation / date change / OAuth return | "My selections vanished" (the originating complaint) | Durable selection store keyed by provider + date range (SEL) |
| Spinner disappears with no result | "Did it work?" — no trust | Persistent per-provider status ("Last synced X · N new · M failed") (JOB) |
| "Sync all" syncs only what's scrolled into view | "It said all but missed half my calls" | Server-side pager that pages the provider itself (SYNC), decoupled from UI scroll |
| Browse (already-synced) mixed with find/import (new) on one expensive query | Slow load every time, even just to look | Separate cheap DB read (BROWSE) from expensive provider call (find/import) |
| Over-engineering two separate apps/surfaces | Doubled maintenance, drift, scope blowout | One surface, two *modes* (browse vs find) — not two apps |
| Retry button that replays the whole batch | Re-imports successes, wastes time, risks dups | Retry computes `requested − synced`; wired to existing single-call retry path |

## "Looks Done But Isn't" Checklist

- [ ] **Idempotency:** Often missing the *org-scoped DB unique constraint* — verify two concurrent imports of the same `source_call_id` produce one `recordings` row (integration test, real DB).
- [ ] **Sync-status signal:** Often still reading `fathom_calls` — verify a Zoom + a paste recording both report `synced=true` from the new single-source query.
- [ ] **Zombie reaping:** Often missing the cron reaper — verify a stale `processing` row (old heartbeat) gets flipped to `failed` automatically.
- [ ] **Resumability:** Often `waitUntil` "works in the demo" with 5 calls — verify a 200+ call sync-all completes across multiple slices without timing out.
- [ ] **Failure visibility:** Often auto-dismissed — verify a `completed_with_errors` result is still visible after 30s and shows a working Retry.
- [ ] **Retry correctness:** Often replays the full batch — verify retry only re-attempts `failed_ids`, not `synced_ids`.
- [ ] **Migration safety:** Often big-bang — verify an old-shape in-flight job created before deploy still reaches a terminal state under the new consumer.
- [ ] **Boot safety:** Often a registry gap — verify `OAUTH_CALLBACK_ROUTES.length` equals the active source count via a build run against the **committed** tree.
- [ ] **Recording IDs:** Often a coercion sneaks in — grep the new code for `parseInt`/`Number(`/string coercion on any recording or call id; all cross-ID work routes through `recording-ids.ts`.
- [ ] **RLS:** Often a new table omitted — verify every new import/job table is in `CROSS_ORG_TABLES`.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Duplicate recordings already inserted | MEDIUM | Dedup query on `(organization_id, source_app, source_call_id)`, keep oldest, repoint child rows (workspace_entries, tags) via `toRecordingUuidBatch`, delete dups; then add the unique index to prevent recurrence |
| Zombie `processing` jobs accumulated | LOW | One-time `UPDATE sync_jobs SET status='failed' WHERE status='processing' AND updated_at < now()-interval '15 min'`; then ship the reaper |
| Sync-all timing out | MEDIUM | Re-architect to chunked/resumable slices; until then, cap batch size client-side as a stopgap |
| In-flight jobs broken by a schema change | HIGH | If columns were renamed/retyped: write a backfill that reconstructs the new shape from old data; worst case, mark affected jobs failed and prompt re-import. Avoid by additive-only migrations |
| `OAUTH_CALLBACK_ROUTES is empty` in prod | LOW (once known) | Re-add `oauthCallbackFunctionName` entries to `source-registry.ts`, build against committed tree, redeploy; add the length assertion test so it can't recur |
| Synced-signal miscount after switching tables | MEDIUM | Run the reconciliation backfill (match `fathom_calls` → `recordings` via `canonical_recording_id`), fix orphans, re-derive counts |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1 — Double-import / dedup | **IMP** (first) | Concurrent-import integration test yields one row; unique index exists |
| 2 — Split synced-signal | **IMP** (first) | Zoom + paste + Fathom all report synced from one query; reconciliation backfill complete |
| 3 — Edge Function timeout | **SYNC** | 200+ call sync-all completes across slices; no per-recording pagination |
| 4 — Zombie jobs | **JOB** | Reaper cron flips stale `processing` rows; heartbeat column written per slice |
| 5 — 8s auto-dismiss hides failures | **JOB** + **FAIL** | `completed_with_errors` persists; Retry works after 30s |
| 6 — `source-registry` boot crash | **TBL** + **SYNC** (any registry-touching phase) | `OAUTH_CALLBACK_ROUTES.length` test passes against committed-tree build |
| 7 — Live-customer migration | **IMP** (discipline) + every `sync_jobs` phase | Old-shape in-flight job still reaches terminal under new consumer; additive migrations only |

**Recommended ordering rationale:** IMP must be first — both idempotency (1) and the synced-signal (2) are the foundation every other phase reads and writes against, and the additive-migration discipline (7) is set here. SEL/TBL build the surface on that foundation. JOB adds observability (4, 5). SYNC adds the resumable pager (3) and must not port the old timeout-prone loop. FAIL closes the retry loop (5). The boot-crash risk (6) is a standing gate on any phase touching the connector registry.

## Sources

- `supabase/functions/sync-meetings/index.ts` — current `waitUntil` batch model, 100-page-per-recording fetch, per-item progress writes, fire-and-forget downstream, OAuth refresh flow (read 2026-06-18)
- `src/hooks/useSyncTabState.ts` — 8s auto-dismiss (lines 175–184), 60s active-job window, hardcoded status enum, Realtime channel + polling fallback (read 2026-06-18)
- `src/lib/recording-ids.ts` + `src/CLAUDE.md` — dual UUID/BIGINT/TEXT id system, `toRecordingUuid`/`toRecordingUuidBatch`, `source_call_id` semantics (read 2026-06-18)
- `.planning/codebase/CONCERNS.md` — uncommitted-files pattern, `source-registry.ts` boot crash history (commit `9b6e3338`), `fathom_calls` Phase 9 TODO, dual-ID fragile areas, missing RLS tables (read 2026-06-18)
- `.planning/PROJECT.md` — v2.1 scope, workstream codes, known fragile surfaces, Supabase-native job direction (read 2026-06-18)
- `supabase/CLAUDE.md` — Phase 30/BUG-01 mocked-test incident, integration-test discipline, RLS regression gate (read 2026-06-18)
- Supabase Edge Functions limits — 400s paid / 150s free wall-clock; `waitUntil` shares worker lifetime; 2s CPU per request — https://supabase.com/docs/guides/functions/limits (verified 2026-06-18, HIGH)
- Supabase Queues / pgmq — at-least-once delivery, visibility-timeout redelivery on un-acked crash, `read_ct` for poison handling, no native DLQ — https://supabase.com/docs/guides/queues + https://github.com/tembo-io/pgmq (verified 2026-06-18, HIGH)
- Supabase Realtime Postgres Changes — single-threaded change processing, per-subscriber RLS check at scale, DELETE events unfilterable + bypass RLS, Broadcast recommended for fan-out — https://supabase.com/docs/guides/realtime/postgres-changes (verified 2026-06-18, HIGH)

---
*Pitfalls research for: durable call import/sync on Supabase + React*
*Researched: 2026-06-18*
