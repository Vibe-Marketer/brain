# Phase 27: Observable Jobs — Research

**Researched:** 2026-06-23
**Domain:** Durable/observable import-job UX on Supabase (Postgres + Deno Edge + Realtime) + React 18 (TanStack Query + Zustand)
**Confidence:** HIGH — every claim verified against real files in this repo and the live-DB introspection captured in Phase 24-04. No external libraries are introduced this phase.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **JOB-01 shared poller:** ONE shared `useSyncJobs` hook (reads `sync_jobs`, org/user-scoped), used by the `<ImportSurface>` in BOTH the Import tab and Sync tab — replacing the SyncTab-only poller. Preserve/refactor the existing `useSyncTabState` job-status logic into this shared hook. This is where the Phase-26 carry-forward (`useSyncTabState.ts:209` hardcoded `sourceApp: "fathom"`) gets fixed — thread real `source_app` + `organizationId`.
- **JOB-02 heartbeat + reaper:** Long-running jobs write `last_heartbeat_at` periodically. A `pg_cron` reaper flips `status='processing'` jobs whose heartbeat is stale → `failed`/`stale`. Model after the in-repo `embedding_queue` claim-table/stale-lock pattern. Threshold: Claude's discretion grounded in Edge wall-clock (~400s) — heartbeat every ~30–60s, reap after ~5min of silence. Verify with a real-DB reaper integration test.
- **JOB-03 kill 8s auto-dismiss:** Remove the unconditional 8-second `recentlyCompletedJobs` auto-dismiss (`useSyncTabState.ts:176`). Failed / `completed_with_errors` jobs PERSIST until the user dismisses/resolves them; only clean `completed` jobs may auto-fade (or require explicit dismiss — Claude's discretion, but failures must NOT vanish).
- **JOB-04 Realtime:** Supabase Realtime `postgres_changes` subscription on `sync_jobs` (already in publication per Phase 24) to push job progress, with existing polling as a FALLBACK (not a replacement). Per-user/org filtered. Do NOT use Broadcast (scale-only, out of scope).
- **JOB-05 per-provider chip:** Persistent indicator per provider: "Last synced X · N new available · M failed" — rendered in `<ImportSurface>` (the Phase-26 seam at `ImportSurface.tsx:474`). Reads from durable `sync_jobs` + canonical sync-status. Reuse/evolve the PRESERVED `SyncStatusIndicator.tsx` / `ActiveSyncJobsCard.tsx`.

### Claude's Discretion
- Exact heartbeat cadence + reap threshold.
- Whether to fully merge `SyncStatusIndicator`/`ActiveSyncJobsCard` into the new hook or keep them as presentational.
- Auto-fade behavior for clean-completed jobs.

### Deferred Ideas (OUT OF SCOPE)
- The server-side sync-all job that heartbeat/reaper protect is **Phase 28** (SYNC). This phase makes jobs observable; ensure the heartbeat/reaper contract is ready for Phase 28 to write into.
- Partial-success/retry UI is **Phase 29** (FAIL). This phase persists failures visibly; Phase 29 adds the retry action.
- Realtime Broadcast (scale-only) — out of scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| JOB-01 | Shared `sync_jobs`-backed progress hook (`useSyncJobs`) on every import surface | `useSyncTabState.ts` (PRESERVED) has the full Realtime+poll effect to lift; both surfaces already render `<ImportSurface>` (the single consumer). Schema scope columns (`source_app`, `organization_id`) live (24-04). See §JOB-01. |
| JOB-02 | Heartbeat + zombie-job reaper for stuck "processing" | `last_heartbeat_at` column exists + is empty (no writer yet). `embedding_queue` migration is the in-repo stale-lock + pg_cron precedent. `sync-meetings/index.ts` is the one heartbeat-write site today. See §JOB-02. |
| JOB-03 | Remove unconditional 8s auto-dismiss; failures persist | Exact site: `useSyncTabState.ts:176` `setTimeout(..., 8000)`; the durable replacement reads `failed_ids`/`status` from the DB row. See §JOB-03. |
| JOB-04 | Live progress via `postgres_changes` + polling fallback | `useSyncTabState.ts:270-344` is the working hybrid pattern to lift. `sync_jobs` confirmed in `supabase_realtime` (24-04). RLS org+user policies confirmed live. See §JOB-04. |
| JOB-05 | Persistent per-provider chip "Last synced X · N new · M failed" | `SyncStatusIndicator.tsx` + `ActiveSyncJobsCard.tsx` (PRESERVED). Data feeds: `sync_jobs` (last completed per `source_app`), `useExistingTranscripts`/`fetchSyncedCalls` (N synced/new), `failed_ids.length` (M failed). See §JOB-05. |
</phase_requirements>

## Summary

Phase 27 is a **UI-observability + one-DB-primitive phase**, not a new-infra phase. Four of the five requirements (JOB-01/03/04/05) are React refactors that consolidate the **already-working** Realtime+poll machinery currently trapped inside the PRESERVED `useSyncTabState.ts` into a clean shared `useSyncJobs` hook + a status banner/chip, mounted at the two seams Phase 26 deliberately left clean in `<ImportSurface>` (`ImportSurface.tsx:474` for the banner, the toolbar for the chip). The fifth (JOB-02) adds one additive migration (a `pg_cron` reaper + a SQL reap function) and one Edge-side change (start writing `last_heartbeat_at` on each progress update in `sync-meetings`).

The schema is **already in place and live-verified**: Phase 24-04 pushed the additive `sync_jobs` migration to PROD (`vltmrnjsubfzrgrtdqey`) and TEST (`swjzxiddcrtaqixsfaac`), confirming via `pg` introspection that all 9 new columns exist (`source_app`, `organization_id`, `workspace_id`, `source_id`, `mode`, `date_start`, `date_end`, `provider_cursor`, `last_heartbeat_at`), `sync_jobs` is in `supabase_realtime` with all columns, the `sync_jobs_org_isolation` RLS policy is live alongside the retained user policy, and `recording_ids`/`synced_ids`/`failed_ids` are `TEXT[]` (NOT `number[]`). [VERIFIED: 24-04-SUMMARY.md push-output introspection + 20260620120000 migration header]

Two carry-forward landmines must be fixed here, both flagged by Phase 26: (1) `useSyncTabState.ts` types `recording_ids`/`synced_ids`/`failed_ids` as `number[]` and the poller compares synced ids as numbers — but the live columns are `TEXT[]`, so the new hook must use `string[]` end to end (Pitfall: type drift, Phase 26 deferred-items lists this exact tsc error). (2) The hardcoded `sourceApp: "fathom"` at `useSyncTabState.ts:209` must become a real per-row `source_app` + `organizationId` thread.

**Primary recommendation:** Build a new `src/hooks/useSyncJobs.ts` that lifts the verified hybrid Realtime+poll effect from `useSyncTabState.ts` (string-typed, org/source-filtered, no 8s auto-dismiss), a new `src/components/import/SyncJobBanner.tsx` + per-provider chip absorbing the two preserved presentational components, mount both at the existing `<ImportSurface>` seams, and add one additive `pg_cron` reaper migration + a `last_heartbeat_at` write in `sync-meetings`. Introduce zero new dependencies.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Job progress polling/subscription (JOB-01, JOB-04) | Browser/Client (React hook) | API/Realtime (postgres_changes) | The UI owns the live read of the `sync_jobs` ledger; Realtime is the push transport, polling the fallback. State is per-user/org, tiny fan-out. |
| Heartbeat write (JOB-02) | API/Backend (Edge Function processor) | — | Only the job processor knows it's still alive; `last_heartbeat_at` is written from `sync-meetings` (and Phase 28's sync-all). NOT a client concern. |
| Zombie reaper (JOB-02) | Database (pg_cron + SQL function) | — | A dead worker cannot mark itself failed; only an out-of-band scheduler can. pg_cron owns this, mirroring `embedding_queue`'s stale-lock release. |
| Failure persistence (JOB-03) | Database (durable `sync_jobs` row) | Browser (renders the row) | Failures must survive navigation/refresh → they live in the DB row (`status`, `failed_ids`), never in volatile React state with a `setTimeout`. |
| Per-provider status chip (JOB-05) | Browser/Client (component) | Database (sync_jobs + recordings reads) | Presentational aggregation of last-job-per-provider + synced/new/failed counts; data comes from two cheap DB reads. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | 2.84 (installed) | Realtime `postgres_changes` channel + `sync_jobs` reads | Already the project client; the working subscription pattern lives in `useSyncTabState.ts`. [VERIFIED: package.json + in-repo usage] |
| `@tanstack/react-query` | 5.x (installed) | Cache + invalidation for the browse/synced reads that feed the chip (`useExistingTranscripts`) | Locked project pattern (src/CLAUDE.md). [CITED: src/CLAUDE.md] |
| pg_cron | ≥1.6 (enabled on prod) | Schedules the zombie reaper | Already enabled + in production (3 cron jobs: `embedding-worker-backup`, `fathom-daily-reconcile`, `google-poll-cron`). [VERIFIED: embedding_queue + reconcile_cron migrations] |
| pg_net | enabled | (Only if the reaper calls an Edge fn; a pure-SQL reaper does NOT need it) | Co-deployed with pg_cron. [VERIFIED: 20251128100000 line 232] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `motion/react` | installed | Optional clean-completed-job fade animation (JOB-03 discretion) | Only if you animate the auto-fade. Project forbids `framer-motion` — use `motion/react`. [CITED: src/CLAUDE.md] |
| `sonner` (`toast`) | installed | Already used in `<ImportSurface>` for import-start toasts | Keep; do NOT replace the durable banner with a toast (toasts are the JOB-03 anti-pattern). [CITED: src/CLAUDE.md] |
| `date-fns` | installed | "Last synced X" relative time formatting for the chip | Project date lib. [CITED: src/CLAUDE.md] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Pure-SQL pg_cron reaper (`UPDATE sync_jobs SET status='failed'...`) | pg_cron → pg_net → Edge reaper fn | A pure-SQL reaper is simpler, has no HTTP egress, no secret, and cannot time out. The Edge variant only earns its keep if the reaper must re-enqueue work — which is Phase 28's concern, not Phase 27. **Use pure SQL this phase.** |
| Realtime `postgres_changes` | Realtime Broadcast | Broadcast is the documented scale path; at per-user job-row fan-out it is unjustified and explicitly out of scope (CONTEXT). |
| New `useSyncJobs` hook | Keep the inline effect in `useSyncTabState` | The inline effect is coupled to SyncTab-only meeting-removal logic and the `number[]` typing; lifting it into a clean hook is the JOB-01 requirement. |

**Installation:** None. No npm install, no new extension migration (pg_cron + pg_net already enabled).

## Package Legitimacy Audit

No external packages are installed in this phase. The Package Legitimacy Gate is **not applicable** — every dependency (`@supabase/supabase-js`, `@tanstack/react-query`, `date-fns`, `motion`, `sonner`, pg_cron, pg_net) is already present in `package.json` / already enabled on the database and was vetted in prior phases. slopcheck run skipped (zero new packages).

## Architecture Patterns

### System Architecture Diagram

```
                      ┌──────────────── IMPORT SURFACE (UI) ────────────────┐
ImportPage ──────────►│  <ImportSurface sourceApp org sourceId workspaceId> │◄──── SyncImportSurface (Sync tab,
(per connected source)│                                                     │      provider picker → ImportSurface)
                      │  toolbar ── [chip: "Last synced X · N new · M fail"] │  JOB-05  (NEW: PerProviderSyncChip)
                      │  ───────────────────────────────────────────────── │
                      │  Phase-27 SEAM (ImportSurface.tsx:474):             │
                      │     <SyncJobBanner job=…/>  ◄── JOB-03/JOB-01       │  (NEW: absorbs SyncStatusIndicator
                      │  ───────────────────────────────────────────────── │   + ActiveSyncJobsCard)
                      │  Section A: find-new TranscriptTable                 │
                      │  Section B: browse-synced TranscriptTable            │
                      └──────────────────────┬──────────────────────────────┘
                                             │  consumes
                                             ▼
                       ┌──────────── useSyncJobs (NEW hook, JOB-01) ─────────┐
                       │  filter: user_id=eq AND (source_app, org)           │
                       │  Realtime postgres_changes (primary) ──────┐        │  JOB-04
                       │  setInterval poll (fallback 2s / 10s) ──────┤        │
                       │  NO 8s auto-dismiss; failures sticky ───────┘        │  JOB-03
                       │  returns: activeJobs[], terminalJobs[] (string ids)  │
                       └──────────────────────┬──────────────────────────────┘
                                              │ reads
                       ┌──────────────────────▼──────────────────────────────┐
                       │  Postgres  public.sync_jobs   (RLS: user OR org)     │
                       │  in supabase_realtime publication (all cols)         │
                       │  cols: status, progress_*, synced_ids/failed_ids TEXT[],│
                       │        source_app, organization_id, last_heartbeat_at │
                       └─────▲───────────────────────────────────▲────────────┘
              writes per page│  status/progress/last_heartbeat_at  │ reaps stale
                             │                                     │
          ┌──────────────────┴─────────┐         ┌────────────────┴───────────────────┐
          │ sync-meetings/index.ts     │         │ pg_cron 'sync-jobs-reaper' (NEW)    │  JOB-02
          │ (Edge, EdgeRuntime.waitUntil)│       │ every 1 min → reap_stale_sync_jobs()│
          │ JOB-02: ADD last_heartbeat_at│       │ flips processing+stale → 'failed'   │
          │ = NOW() to each progress UPDATE│     │ sets error='worker died (no hb)'    │
          └────────────────────────────┘         └─────────────────────────────────────┘
                                              (Phase 28's connector-sync-all writes the same
                                               heartbeat into the same contract)
```

### Recommended Project Structure
```
src/
├── hooks/
│   ├── useSyncJobs.ts            # NEW — shared Realtime+poll hook (JOB-01/03/04)
│   └── useSyncTabState.ts        # PRESERVED — lift its effect into useSyncJobs, then it can be retired
├── components/import/
│   ├── SyncJobBanner.tsx         # NEW — durable progress/result banner (absorbs ActiveSyncJobsCard)
│   ├── PerProviderSyncChip.tsx   # NEW — "Last synced X · N new · M failed" (absorbs SyncStatusIndicator)
│   └── ImportSurface.tsx         # MODIFIED — mount banner at :474 seam, chip in toolbar
├── services/
│   └── sync-jobs.service.ts      # NEW (optional) — pure reads: latest job per (source_app, org)
supabase/
├── migrations/
│   └── YYYYMMDDHHMMSS_sync_jobs_reaper.sql   # NEW — reap fn + pg_cron schedule (additive)
└── functions/sync-meetings/index.ts          # MODIFIED — write last_heartbeat_at per progress update
```

### Pattern 1: Lift-and-consolidate the verified hybrid Realtime+poll
**What:** Move the `useEffect` at `useSyncTabState.ts:214-358` into `useSyncJobs.ts` verbatim in *mechanism* (subscribe to `postgres_changes`, fall back to 2s poll on `CHANNEL_ERROR`, drop to 10s poll when `SUBSCRIBED`, clean up channel + interval on unmount) but change three things: (a) type ids as `string[]` not `number[]`; (b) add `source_app` + `organization_id` to the filter; (c) DELETE the 8s `setTimeout`.
**When to use:** This is the JOB-01 + JOB-04 core.
**Example (the proven mechanism to preserve):**
```ts
// Source: src/hooks/useSyncTabState.ts:279-337 (VERIFIED working in prod)
const channel = supabase
  .channel(`sync_jobs_${user.id}`)
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'sync_jobs', filter: `user_id=eq.${user.id}` },
    async (payload) => { /* INSERT → add, UPDATE → merge, DELETE → drop */ })
  .subscribe((status) => {
    if (status === 'SUBSCRIBED')        pollInterval = setInterval(poll, 10000); // backup
    else if (status === 'CHANNEL_ERROR') pollInterval = setInterval(poll, 2000);  // fallback
  });
// cleanup: supabase.removeChannel(channel); clearInterval(pollInterval);
```
> Note on the filter: `postgres_changes` `filter` accepts ONE column predicate. Keep `user_id=eq.<id>` as the channel filter (it is the cheapest correct narrowing and matches RLS), then filter by `source_app`/`organization_id` client-side inside the handler. Combining two predicates server-side is not supported; RLS (user OR org policy, live) is the real isolation boundary. [CITED: supabase.com/docs/guides/realtime/postgres-changes] [VERIFIED: live RLS in 24-04]

### Pattern 2: Durable-row-as-truth status banner (no setTimeout)
**What:** `<SyncJobBanner>` renders directly off the `sync_jobs` row. `completed` → optional fade (discretion). `failed` / `completed_with_errors` → sticky until the user clicks dismiss. The dismiss action is local UI state ("I've seen it"), never a DB delete and never a timer.
**When:** JOB-03 + JOB-05's failed surfacing.
**Anti-pattern it replaces:** `ActiveSyncJobsCard.tsx:66` literally renders "Auto-dismissing..." — remove that text and the timer behind it.

### Pattern 3: Pure-SQL pg_cron reaper modeled on embedding_queue stale-lock
**What:** A `SECURITY DEFINER` SQL function `reap_stale_sync_jobs()` flips `status='processing' AND last_heartbeat_at < NOW() - INTERVAL '<threshold>'` rows to `'failed'`, scheduled by `cron.schedule('sync-jobs-reaper', '* * * * *', ...)`. Mirrors `claim_embedding_tasks`' stale-lock predicate (`locked_at < NOW() - INTERVAL '2 minutes'`, line 120) and the `embedding-worker-backup` cron registration shape (lines 244-278).
**When:** JOB-02.
**Example:**
```sql
-- Source pattern: 20251128100000_embedding_queue_system.sql:120 (stale-lock) + :259 (cron.schedule)
CREATE OR REPLACE FUNCTION public.reap_stale_sync_jobs()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE reaped INT;
BEGIN
  WITH updated AS (
    UPDATE public.sync_jobs
       SET status = 'failed',
           error = COALESCE(error, 'worker died (no heartbeat)'),
           completed_at = NOW()
     WHERE status = 'processing'
       AND last_heartbeat_at IS NOT NULL
       AND last_heartbeat_at < NOW() - INTERVAL '5 minutes'
    RETURNING 1
  ) SELECT COUNT(*) INTO reaped FROM updated;
  RETURN reaped;
END; $$;

-- schedule (guarded exactly like embedding-worker-backup)
DO $outer$ BEGIN
  PERFORM cron.unschedule('sync-jobs-reaper');
EXCEPTION WHEN undefined_function THEN RAISE NOTICE 'pg_cron unavailable';
          WHEN others THEN NULL; END $outer$;
DO $outer$ BEGIN
  PERFORM cron.schedule('sync-jobs-reaper', '* * * * *', $body$ SELECT public.reap_stale_sync_jobs(); $body$);
EXCEPTION WHEN undefined_function THEN RAISE NOTICE 'pg_cron unavailable - reaper disabled';
          WHEN others THEN RAISE NOTICE 'reaper schedule failed: %', SQLERRM; END $outer$;
```
**Heartbeat-null caveat (decide explicitly):** Legacy/in-flight rows and any job started before this phase have `last_heartbeat_at IS NULL`. The reaper above only touches rows with a non-null stale heartbeat, so it will NEVER reap a job that never wrote a heartbeat. Two options — **(A) recommended:** also reap `status='processing' AND last_heartbeat_at IS NULL AND created_at < NOW() - INTERVAL '15 minutes'` (a generous absolute fallback so a processor that died before its first heartbeat still gets reaped); **(B):** require every processor to write `last_heartbeat_at` at job creation (set it in the initial `sync_jobs` INSERT) so NULL never persists. Recommend doing BOTH: write heartbeat at INSERT, and keep the absolute-age fallback as defense. [ASSUMED — exact NULL-handling not yet decided; see Assumptions Log A1]

### Pattern 4: Heartbeat piggybacks the existing per-item progress UPDATE
**What:** `sync-meetings` already runs `UPDATE sync_jobs SET progress_current, synced_ids, failed_ids, skipped_count` per recording (lines 728-737, 765-773, 782-790). Add `last_heartbeat_at: new Date().toISOString()` to each of those three update objects, and to the initial INSERT (line 570). Zero new writes — one extra column on writes that already happen.
**When:** JOB-02 producer side.

### Anti-Patterns to Avoid
- **`number[]` recording ids.** The live columns are `TEXT[]`. `useSyncTabState`'s `SyncJob` interface (`recording_ids: number[]`, lines 24-26) is WRONG against the live schema and is a deferred tsc error (26-04). The new hook MUST type these `string[]`. Never `parseInt`/`Number()` a `source_call_id`. [VERIFIED: 24-04 introspection "`recording_ids` = `_text`"; src/CLAUDE.md dual-ID rule]
- **`setTimeout(dismiss, 8000)` on any job.** The original sin (Pitfall 5). Branch on `status`; failures are sticky.
- **Subscribing every client to all `sync_jobs` changes.** Keep the `user_id=eq` channel filter; rely on RLS for org isolation. (Realtime change processing is single-threaded + per-subscriber RLS-checked.) [CITED: realtime/postgres-changes docs]
- **Acting on Realtime DELETE events for status truth.** DELETE events can't be filtered and bypass RLS — only use INSERT/UPDATE for the synced signal. The existing handler only removes from the active list on DELETE, which is safe; do not derive "synced" from DELETE. [CITED: realtime docs; PITFALLS.md]
- **A pg_cron interval shorter than 1 minute as a hard dependency.** 1-min is the reliable minimum; the reaper at `* * * * *` is correct. [CITED: STACK.md verified facts]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Live job updates | A bespoke WebSocket / SSE channel | `supabase.channel().on('postgres_changes')` (already wired) | The hybrid Realtime+poll already works in prod; reuse it. |
| Crash recovery for dead jobs | A Node watchdog process / external cron | pg_cron + a SQL reap function | pg_cron is enabled, in-prod, and needs no egress/secret. `embedding_queue` is the proven precedent. |
| "Is this synced?" counts for the chip | A new query against `fathom_calls` or a fresh table | `getSyncStatusForExternalIds` / `fetchSyncedCalls` (canonical reader, Phase 24) | Reading any other table reintroduces the Zoom-UUID bug (Pitfall 2). |
| Durable selection (for select-all twin) | New store | `useImportSelection` + `importSelectionStore` (Phase 25, persisted) | Already built and reconciled against server truth. |
| Provider picker on the Sync tab | New multi-provider surface | `SyncImportSurface` (already wraps `<ImportSurface>` with a picker) | The chip/banner render inside `<ImportSurface>`, so both tabs get them for free. |

**Key insight:** Phase 27 ships almost no new logic — it relocates verified machinery into a shared hook + two components, fixes two carry-forward type/literal bugs, and adds one DB reaper. The risk is regression (breaking the working Realtime path or the `number[]`→`string[]` migration), not greenfield complexity.

## Runtime State Inventory

> This phase is partly a refactor of a PRESERVED file (`useSyncTabState.ts`) and adds a DB cron job. Inventory of runtime state that a file-grep would miss:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `sync_jobs` rows currently in PROD with `last_heartbeat_at IS NULL` (every existing row — no writer exists yet) and `organization_id IS NULL` (legacy rows, deliberately un-backfilled in 24-02). | Code: write heartbeat going forward. Reaper MUST tolerate NULL heartbeat (see Pattern 3 caveat) so it doesn't mass-reap or never-reap legacy rows. No data migration needed. |
| Live service config | `pg_cron` jobs registered IN THE DATABASE (not git): `embedding-worker-backup`, `fathom-daily-reconcile`, `google-poll-cron`. The new `sync-jobs-reaper` will be a 4th. These live in `cron.job`, applied only when the migration is pushed. | The reaper migration must be pushed to PROD + TEST (prod-ref-guarded `supabase db push`) for the cron to exist — writing the migration file alone does nothing. Verify via `SELECT jobname FROM cron.job`. |
| OS-registered state | None — no OS-level registrations involved. | None — verified by scope (browser + Edge + Postgres only). |
| Secrets/env vars | A pure-SQL reaper needs NO secret (unlike `fathom-daily-reconcile` which needs `app.reconcile_secret`). If you instead route the reaper through pg_net→Edge, you'd need a DB setting + Edge secret — avoid by using pure SQL. | None if pure-SQL reaper (recommended). |
| Build artifacts | None — no package build/egg-info concerns. | None. |

**The canonical question — after every file is updated, what runtime systems still hold old state?** Two: (1) the `cron.job` table won't have `sync-jobs-reaper` until the migration is pushed; (2) existing `processing` rows have NULL heartbeat — the reaper's NULL-handling decision determines whether they're recoverable.

## Common Pitfalls

### Pitfall 1: `number[]` ↔ `TEXT[]` id type drift
**What goes wrong:** Lifting `useSyncTabState`'s `SyncJob` interface as-is carries `recording_ids/synced_ids/failed_ids: number[]`. The live columns are `TEXT[]`. Comparisons like `processedSyncedIdsRef = Set<number>` and `job.synced_ids.map(id => String(id))` silently work for Fathom numeric ids but break the moment a Zoom/Grain UUID id flows through, and they produce the tsc errors already deferred in 26-04.
**Why it happens:** The preserved hook predates the provider-agnostic `TEXT[]` schema.
**How to avoid:** Type every id field `string[]` in the new `useSyncJobs`. Remove numeric `Set`s. Never coerce.
**Warning signs:** `Set<number>`, `parseInt`, `Number(`, or `recording_ids: number[]` anywhere in the new hook.

### Pitfall 2: Hardcoded `"fathom"` carry-forward (CR-02)
**What goes wrong:** `useSyncTabState.ts:209` calls `checkSyncStatusRef.current("fathom", ...)`. If the new hook/surface re-uses this, non-Fathom rows read unsynced forever.
**How to avoid:** Thread the real `sourceApp` (already a prop on `<ImportSurface>`) + `organizationId` into every sync-status read. The overlay (`importSurfaceSyncStatus.ts`) already does this correctly per-provider — model the chip's counts on it, not on the preserved literal.
**Warning signs:** any literal `"fathom"` in new code.

### Pitfall 3: Breaking the working Realtime path during the lift
**What goes wrong:** Re-implementing the subscription from scratch reintroduces channel leaks (channel-per-render), missing cleanup, or losing the polling fallback — the exact silent-failure class this milestone kills.
**How to avoid:** Lift the existing effect's structure verbatim (one channel per surface, cleanup in the `useEffect` return, poll fallback retained). Add a test that asserts the channel is removed on unmount.
**Warning signs:** No `supabase.removeChannel` in cleanup; `setInterval` without a paired `clearInterval`; subscribing inside render.

### Pitfall 4: Reaper mass-reaps healthy jobs or never reaps zombies
**What goes wrong:** Threshold too tight (< Edge wall-clock ~400s + heartbeat cadence) flips live jobs to failed; threshold logic that ignores NULL heartbeat never reaps pre-heartbeat zombies.
**How to avoid:** Threshold ≥ ~5 min (well above the 400s wall-clock + 30–60s cadence). Handle NULL heartbeat with an absolute `created_at` fallback (Pattern 3). Test BOTH: a stale-heartbeat row gets reaped; a fresh-heartbeat row does NOT.
**Warning signs:** A `processing` job younger than the threshold flipped to `failed`; `processing` rows older than 15 min still alive.

### Pitfall 5: Realtime event storm from per-item progress writes
**What goes wrong:** `sync-meetings` updates the row per recording; adding heartbeat doesn't add writes, but a large job already emits one Realtime event per item (single-threaded change processing chokes). [CITED: PITFALLS.md performance traps]
**How to avoid (note for the planner, not blocking):** This is a pre-existing characteristic, acceptable at current scale. If it surfaces, batch progress writes every N items — but that is an optimization, not a Phase 27 requirement. Keep the heartbeat on the existing cadence; do NOT add a separate heartbeat write loop.

## Code Examples

### Mounting the banner + chip at the existing seams (JOB-01/03/05)
```tsx
// Source: src/components/import/ImportSurface.tsx — the two Phase-27 seams already exist.
// Chip in the toolbar; banner at line ~474 ("Phase 27 SEAM: job-status banner mounts here").
const { activeJobs, terminalJobs } = useSyncJobs({ sourceApp, organizationId });
// toolbar:
<PerProviderSyncChip sourceApp={sourceApp} organizationId={organizationId}
  lastSyncedAt={lastJob?.completed_at} newCount={browseRows.length /* or computed */}
  failedCount={lastJob?.failed_ids?.length ?? 0} />
// :474 seam:
{[...activeJobs, ...terminalJobs].map(job => (
  <SyncJobBanner key={job.id} job={job} onDismiss={() => dismiss(job.id)} />
))}
```

### Reaper integration test (TEST-DB guarded, real DB, zero mocks)
```ts
// Source pattern: src/test/migrations/phase24-sync-status-foundation.integration.test.ts
// + supabase/CLAUDE.md "Running integration tests safely" (VITEST_INTEGRATION_OK, TEST ref guard).
// 1. Insert a sync_jobs row: status='processing', last_heartbeat_at = NOW() - INTERVAL '10 min'
//    (service-role client against TEST ref swjzxiddcrtaqixsfaac — NEVER prod).
// 2. SELECT public.reap_stale_sync_jobs();
// 3. Assert the row is now status='failed', error LIKE '%no heartbeat%'.
// 4. Insert a fresh-heartbeat processing row; run reaper; assert it is UNTOUCHED.
// 5. afterAll: delete both seeded rows (try/catch each).
```
Run via `npm run test:integration` (sets `VITEST_INTEGRATION_OK=true`; guards throw if TEST ref equals prod). [CITED: supabase/CLAUDE.md]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SyncTab-only inline poller in `useSyncTabState` | Shared `useSyncJobs` on `<ImportSurface>` (both tabs) | Phase 27 | One observable surface everywhere import happens. |
| 8s auto-dismiss of all jobs | Sticky failures, optional clean-completed fade | Phase 27 (JOB-03) | Users always learn what happened. |
| Zombie `processing` rows forever | pg_cron reaper → `failed` | Phase 27 (JOB-02) | Silent death becomes a visible failure. |
| `number[]` ids in the client SyncJob type | `string[]` (matches live `TEXT[]`) | Phase 27 | Provider-agnostic ids; fixes deferred tsc errors. |

**Deprecated/outdated:**
- `useSyncTabState.ts` — once `useSyncJobs` + the banner/chip subsume it, it can be retired (it's only PRESERVED to harvest its effect). The hardcoded `"fathom"` and `number[]` typing are the reasons NOT to import it as-is.
- `ActiveSyncJobsCard`'s "Auto-dismissing..." text + 5-min "Appears Stuck" client heuristic (line 77) — the reaper makes stuck-state a real DB status, so the client guess is no longer needed.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Exact reaper threshold (~5 min) and NULL-heartbeat handling (absolute `created_at` fallback + heartbeat-at-INSERT) — CONTEXT marks the threshold as Claude's discretion; the NULL-handling specifics are my recommendation, not a locked decision. | JOB-02 / Pattern 3 | Too tight → live jobs reaped; NULL ignored → pre-heartbeat zombies never reaped. Confirm threshold with the planner. |
| A2 | Pure-SQL reaper (no pg_net/Edge) is sufficient for Phase 27 because re-enqueue is Phase 28's job. | Stack / JOB-02 | If the user wants the reaper to also re-kick jobs now, it'd need pg_net + an Edge target. Out of scope per CONTEXT (sync-all is Phase 28). |
| A3 | "N new available" for the chip is derivable from the existing browse/synced reads + provider search counts; no new aggregate query/table is required. | JOB-05 | If "N new" must mean "unsynced provider calls not yet fetched," it needs a provider list-count which is a live API call (Phase 28 territory). Recommend "N new" = synced-count-in-range or new-since-last-job; confirm semantics with the planner. |
| A4 | The reaper runs as a pure pg_cron SQL job at 1-min cadence; sub-minute is not required. | JOB-02 | If near-real-time reaping is wanted, 1-min is the floor; acceptable since the threshold is ~5 min. |

## Open Questions

1. **What exactly does "N new available" count in the chip (JOB-05)?**
   - What we know: `sync_jobs` gives last-job synced/failed counts; `fetchSyncedCalls` gives synced-in-range; a true "available but not imported" count needs a provider list call.
   - What's unclear: whether "N new" means "synced recently," "rows found in last search not yet imported," or "live unimported provider calls."
   - Recommendation: Define "N new" as the count of find-section rows NOT already imported (already computed in `<ImportSurface>` as `results.length - importedIds.size`) — cheap, no new query, and matches what the user sees. Confirm with the planner.

2. **Merge or keep the two preserved presentational components?**
   - CONTEXT leaves this to discretion. Recommendation: keep them PRESENTATIONAL (rename/relocate into `SyncJobBanner` + `PerProviderSyncChip`), drive them from `useSyncJobs` — do not re-embed Realtime logic in them.

3. **Should `last_heartbeat_at` be set at job INSERT?**
   - Recommendation: Yes (eliminates the NULL window and simplifies the reaper). Low cost — one field on the existing INSERT at `sync-meetings:570`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| pg_cron | JOB-02 reaper | ✓ (enabled, 3 jobs in prod) | ≥1.6 | Migration's `EXCEPTION WHEN undefined_function` degrades to a NOTICE (free-tier-safe), same as existing crons |
| pg_net | Only if Edge reaper | ✓ (enabled) | — | Not needed for pure-SQL reaper |
| Supabase Realtime | JOB-01/04 | ✓ (`sync_jobs` in publication) | — | Polling fallback (already in the lifted hook) |
| TEST Supabase project | Reaper integration test | ✓ (ref `swjzxiddcrtaqixsfaac`) | — | `describe.skipIf` clean-skip if `.env.test` unset |
| psql (local) | Live DB introspection during dev | ✗ | — | `supabase db push` + `supabase` CLI (available); schema truth already captured in 24-04 |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** Local `psql` is absent — use the Supabase CLI and the 24-04-verified schema facts; do not block on installing psql against PROD.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (unit) + Vitest integration (`*.integration.test.ts`, real TEST DB) |
| Config file | `vitest.config.ts` (integration excluded unless `VITEST_INTEGRATION_OK=true`) |
| Quick run command | `npx vitest run src/hooks/__tests__/useSyncJobs.test.ts` |
| Full suite command | `npm run test` ; integration: `npm run test:integration` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| JOB-01 | `useSyncJobs` reads/filters `sync_jobs` by source_app+org, ids are strings | unit | `npx vitest run src/hooks/__tests__/useSyncJobs.test.ts` | ❌ Wave 0 |
| JOB-02 | Reaper flips stale processing → failed; spares fresh | integration (real TEST DB) | `npm run test:integration -- sync-jobs-reaper` | ❌ Wave 0 |
| JOB-03 | No `setTimeout`-based dismissal; failed job persists after render cycle | unit (source assertion + behavior) | `npx vitest run src/components/import/__tests__/SyncJobBanner.test.tsx` | ❌ Wave 0 |
| JOB-04 | Channel subscribed with user filter; removed on unmount; poll fallback on CHANNEL_ERROR | unit (mock Realtime) | `npx vitest run src/hooks/__tests__/useSyncJobs.test.ts` | ❌ Wave 0 |
| JOB-05 | Chip renders last-synced/new/failed from job + reads; no literal "fathom" | unit | `npx vitest run src/components/import/__tests__/PerProviderSyncChip.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the touched file's vitest test + `npx tsc -p tsconfig.app.json --noEmit` (scoped to changed file; pre-existing errors are deferred per 26-04).
- **Per wave merge:** `npm run test` (unit) + `npm run build` (exit 0; boot gate).
- **Phase gate:** `npm run test:integration` reaper test green against TEST DB; full unit suite delta vs baseline = 0 new failures; `npm run build` exit 0; reaper migration pushed to PROD+TEST and `SELECT jobname FROM cron.job WHERE jobname='sync-jobs-reaper'` returns 1 row.

### Wave 0 Gaps
- [ ] `src/hooks/__tests__/useSyncJobs.test.ts` — covers JOB-01, JOB-04 (string ids, filter, channel lifecycle, poll fallback)
- [ ] `src/components/import/__tests__/SyncJobBanner.test.tsx` — covers JOB-03 (sticky failures, no timer)
- [ ] `src/components/import/__tests__/PerProviderSyncChip.test.tsx` — covers JOB-05
- [ ] `supabase/.../sync-jobs-reaper.integration.test.ts` (under `src/test/migrations/` per the 24-04 precedent) — covers JOB-02 against TEST DB
- [ ] Reaper SQL migration file (`supabase/migrations/YYYYMMDDHHMMSS_sync_jobs_reaper.sql`)

## Security Domain

> `security_enforcement` not explicitly false → included.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `getSafeUser()` / `authenticateRequest` (shared helper) — all reads gated by the authed user. [CITED: supabase/CLAUDE.md] |
| V3 Session Management | no | Supabase-managed; no change. |
| V4 Access Control | yes | RLS on `sync_jobs` (user policy OR `is_organization_member` org policy, live per 24-04). `sync_jobs` registered in `CROSS_ORG_TABLES` (RLS regression CI gate). Realtime respects RLS — the `user_id=eq` channel filter + RLS is the isolation boundary. |
| V5 Input Validation | yes | Ids stay opaque TEXT — never coerced; `source_app`/`organizationId` threaded, never trusted from a raw body in Edge writes (reaper takes no client input). |
| V6 Cryptography | no | No crypto introduced (pure-SQL reaper needs no secret). |

### Known Threat Patterns for Supabase + React
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-org leak of another tenant's job activity via Realtime | Information Disclosure | RLS-respecting `postgres_changes` + `user_id=eq` filter; `sync_jobs` in `CROSS_ORG_TABLES` CI gate. [VERIFIED: 24-02/24-04] |
| Realtime DELETE bypasses RLS / unfilterable | Information Disclosure | Never derive synced-truth from DELETE; only INSERT/UPDATE drive status. [CITED: realtime docs] |
| `SECURITY DEFINER` reaper over-privileged | Elevation of Privilege | Reaper only UPDATEs `sync_jobs.status/error/completed_at` on stale rows; `SET search_path = public` (matches `claim_embedding_tasks`). No dynamic SQL, no client input. |
| New cron job as an unguarded prod-write path | Tampering | Pure-SQL, deterministic predicate (stale heartbeat); idempotent (re-running is a no-op on already-failed rows); pushed via prod-ref-guarded `supabase db push`. |

## Sources

### Primary (HIGH confidence)
- `src/hooks/useSyncTabState.ts` — the working hybrid Realtime+poll effect (270-358), the 8s auto-dismiss (176-184), the `number[]` typing (24-26), the hardcoded `"fathom"` (209). Read in full.
- `supabase/migrations/20251128100000_embedding_queue_system.sql` — stale-lock predicate (120), pg_cron registration shape (244-278), `SECURITY DEFINER` SQL function pattern.
- `supabase/migrations/20260620120000_sync_jobs_durable_resource.sql` — additive columns incl. `last_heartbeat_at`, org RLS policy, Realtime-membership guard.
- `.planning/phases/24-sync-status-foundation/24-04-SUMMARY.md` — LIVE-DB introspection: 9/9 columns, `sync_jobs` in `supabase_realtime`, `recording_ids` = `_text` (TEXT[]), org policy live, PROD ref `vltmrnjsubfzrgrtdqey`, TEST ref `swjzxiddcrtaqixsfaac`.
- `supabase/functions/sync-meetings/index.ts` — job INSERT (568-577, no heartbeat/scope today), per-item progress UPDATEs (728-790), three-way final status (795-809), `EdgeRuntime.waitUntil` (912).
- `src/components/import/ImportSurface.tsx` — Phase-27 banner seam (473-477), toolbar (388-471), org/sourceApp props (63-73).
- `src/components/transcripts/SyncStatusIndicator.tsx` + `ActiveSyncJobsCard.tsx` — the PRESERVED presentational components to evolve.
- `src/services/sync-status.service.ts` + `src/components/import/importSurfaceSyncStatus.ts` + `src/hooks/useImportSelection.ts` + `src/hooks/useExistingTranscripts.ts` — canonical sync-status + counts feeds for the chip.
- `supabase/migrations/20260512000002_fathom_daily_reconcile_cron.sql` — pg_cron registration + graceful-degradation precedent.
- `supabase/CLAUDE.md` + `src/CLAUDE.md` — integration-test safety, additive-migration discipline, dual-ID rule, tech-stack constraints.

### Secondary (MEDIUM confidence)
- `.planning/research/STACK.md`, `ARCHITECTURE.md`, `PITFALLS.md` — milestone-level verified facts (Edge limits, Realtime scaling, pg_cron minimums) cross-checked against Supabase official docs 2026.

### Tertiary (LOW confidence)
- None — no unverified web-only claims in this research.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new deps; all primitives in-repo and live-verified.
- Architecture: HIGH — both mount seams + the hook source exist and were read; schema confirmed via 24-04 live introspection.
- Pitfalls: HIGH — every pitfall maps to a specific verified line (8s timer, number[] typing, "fathom" literal, NULL heartbeat).
- JOB-05 "N new" semantics: MEDIUM — flagged as an open question (A3) for the planner/user to confirm.

**Research date:** 2026-06-23
**Valid until:** 2026-07-23 (stable — internal codebase + enabled DB extensions; re-verify only if `sync_jobs` schema or the Realtime publication changes)
