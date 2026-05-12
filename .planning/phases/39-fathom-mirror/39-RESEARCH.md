---
phase: 39
phase_name: Fathom Mirror
researched: 2026-05-12
status: Research complete
---

# Phase 39: Fathom Mirror — Research

## User Constraints (from CONTEXT.md — VERBATIM)

**Locked decisions (planner MUST honor):**

1. **Daily reconciliation cron** — Supabase `pg_cron` + edge function (NOT GitHub Actions). Pattern: `cron.schedule()` calling `net.http_post()` to invoke an edge function. Schedule: `0 7 * * *` (07:00 UTC daily).
2. **New `supabase/functions/fathom-reconcile/index.ts`** handles BOTH the daily cron AND the new-user backfill (code reuse).
3. **Backfill is background** — kicked off via `EdgeRuntime.waitUntil()` from `fathom-oauth-callback` after token storage succeeds.
4. **Schema additions** to `fathom_raw_calls` if missing:
   - `synced_at TIMESTAMPTZ NOT NULL DEFAULT now()` (already exists, confirm)
   - `mirror_version INT DEFAULT 1` (new — for future schema migrations)
   - `import_source_id UUID REFERENCES import_sources(id)` (new — for multi-account routing)
5. **Multi-account routing** via `import_sources` FK on `fathom_raw_calls`. Library query unions sources for current user/org, dedupes by `recording_id`.
6. **Restore `create-fathom-webhook`** to source control. **CONFIRMED: already in source** at `supabase/functions/create-fathom-webhook/index.ts` (108 lines, post-Phase-37 with `authenticateRequest`). Auto-fire on OAuth callback: invoke after successful token storage.
7. **Library search MUST hit mirror** — hard cutover. Audit `useGlobalSearch.ts`. **CONFIRMED: already searches `recordings` table** (canonical mirror), NOT Fathom API. Mirror search path is in place — what's missing is reliable POPULATION via backfill/reconcile.

**Discretion areas (planner may decide):**

- Pagination strategy for backfill (batch size, max pages)
- Concurrency limits during reconcile diff
- Cron retry strategy (current pattern: pg_cron fires every 5 min if missed)
- Reconcile cursor strategy (last 30 days vs full history)

**Deferred (ignore):**

- Real-time webhook-driven mirror beyond `create-fathom-webhook` — v2.3
- Zoom + manual-paste mirror — v2.3
- Cross-account dedupe by attendee email — v2.3
- Full-text index on `full_transcript` (pg_trgm / tsvector) — v2.3

---

## Standard Stack

| Component | Choice | Status |
|-----------|--------|--------|
| Cron | `pg_cron` extension `WITH SCHEMA extensions` | `[VERIFIED: 20260110000008_scheduled_rules_fields.sql:259-263]` Already in use |
| HTTP from cron | `pg_net` (`net.http_post`) | `[VERIFIED: 20260110000008_scheduled_rules_fields.sql:282]` Already in use |
| Edge runtime async | `EdgeRuntime.waitUntil()` | `[VERIFIED: sync-meetings/index.ts:727, polar-webhook/index.ts:223, zoom-webhook/index.ts:883]` |
| Fathom API client | `FathomClient.fetchWithRetry` from `_shared/fathom-client.ts` | `[VERIFIED]` |
| Auth helper | `authenticateRequest` from `_shared/auth.ts` | `[VERIFIED: post-Phase-37]` |
| CORS | `getCorsHeaders(origin)` from `_shared/cors.ts` | `[VERIFIED]` |
| OAuth tokens | `import_sources.oauth_access_token` (encrypted via `store_encrypted_oauth_tokens` RPC when `OAUTH_ENCRYPTION_KEY` set; plaintext fallback otherwise) | `[VERIFIED: fathom-oauth-callback/index.ts:104-167]` |
| Mirror table | `fathom_raw_calls` keyed by `(recording_id, user_id)` composite PK | `[VERIFIED: 20251201000001_composite_primary_key_fathom_calls.sql:51,71]` |
| Canonical link | `fathom_raw_calls.canonical_recording_id UUID FK -> recordings.id` | `[VERIFIED: 20260303000005_rename_to_raw_tables.sql]` |

---

## Architecture Patterns

### Backfill / Reconcile Edge Function Pattern

Mirror existing `sync-meetings/index.ts` structure but driven by **time range** rather than recording_id list:

1. authenticateRequest (or service-role w/ JWT-bypass for cron path)
2. Resolve OAuth credentials from import_sources (one per fathom account)
3. Paginate Fathom /external/v1/meetings (created_after cursor)
4. For each meeting: check fathom_raw_calls; if missing, write via `runPipeline()`; if exists with content drift, leave alone (Phase 40 owns re-import)
5. Return `{ synced, skipped, errored }`

The function must support TWO invocation modes:
- **Per-user backfill** — caller supplies `userId` and optional `sourceId`; runs full pagination.
- **Daily reconcile** — no caller user; iterates ALL active fathom import_sources and runs incremental diff for last 30 days.

### Cron -> Edge Function Pattern (verified from automation-scheduler)

```sql
DO $outer$
BEGIN
  PERFORM cron.schedule(
    'fathom-daily-reconcile',
    '0 7 * * *',
    $body$
    SELECT net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/fathom-reconcile',
      headers := jsonb_build_object('Content-Type', 'application/json', 'X-Reconcile-Secret', current_setting('app.reconcile_secret')),
      body := '{"mode": "reconcile"}'::jsonb
    );
    $body$
  );
EXCEPTION WHEN undefined_function THEN
  RAISE NOTICE 'pg_cron not available - reconcile cron disabled';
END $outer$;
```

Existing `automation-scheduler` cron uses NO auth (function has `verify_jwt = false`). For our reconcile function, match: deploy with `verify_jwt = false` and check `X-Reconcile-Secret` body/header against `RECONCILE_SECRET` env var.

### Background Backfill from OAuth Callback Pattern

```typescript
const backfillPromise = (async () => {
  try {
    await supabase.functions.invoke('fathom-reconcile', {
      body: { mode: 'backfill', userId, sourceId: pendingSourceId },
      headers: { Authorization: req.headers.get('Authorization') || '' },
    });
  } catch (err) {
    console.error('Background backfill failed (non-blocking):', err);
  }
})();
EdgeRuntime.waitUntil(backfillPromise);
```

This pattern is verified in `polar-webhook/index.ts:215-225`.

### Multi-Account Routing Pattern

`import_sources` already supports multiple rows per `(user_id, source_app)`. Each row holds its own OAuth tokens. The reconcile job iterates all active fathom sources per user. The mirror table tracks WHICH source brought in each row via `import_source_id UUID`. Library search at the `recordings` level is already correctly union'd across all of a user's calls. The `import_source_id` on `fathom_raw_calls` is for operator visibility + per-source diffing.

---

## Don't Hand-Roll

- **Pagination retry/backoff** — use `FathomClient.fetchWithRetry`, NOT custom fetch.
- **Auth on cron-invoked function** — follow existing `verify_jwt = false` + body/header-secret pattern from `automation-scheduler`, NOT custom JWT validation.
- **Token decryption** — use `decrypt_oauth_tokens()` RPC (Phase 37) when reading encrypted tokens; check `OAUTH_ENCRYPTION_KEY` presence.
- **Recording insert** — use `runPipeline()` from `_shared/connector-pipeline.ts` (handles dedup + routing + insert).
- **Cron schedule** — use the EXACT pattern from `20260110000008_scheduled_rules_fields.sql:282-298` (DO block with `EXCEPTION WHEN undefined_function` graceful fallback).

---

## Common Pitfalls

1. `pg_cron` schedule rejected on Free tier — gracefully fallback handled by `EXCEPTION WHEN undefined_function` block. NOT a blocker on production (Pro+ tier).
2. Fathom API rate limits (60 req/min) — use existing `throttleShared('global', 55, 60000)` pattern from `fetch-meetings/index.ts:42-44`.
3. Token refresh inside reconcile — long-running reconciles can outlive 1-hour OAuth tokens. Must call refresh path same as sync-meetings (lines 333-432).
4. Background backfill silently fails — `EdgeRuntime.waitUntil()` does NOT propagate errors back to the caller. Log to console AND surface via `sync_jobs` row state for UI banner.
5. Cron invocation auth — `verify_jwt = true` would block `pg_net` calls. Deploy `fathom-reconcile` with `verify_jwt = false` AND validate `RECONCILE_SECRET` in body/header.
6. `fathom_raw_calls.user_id` is composite PK — every upsert must include both `recording_id` AND `user_id`. The `onConflict` clause must be `'recording_id,user_id'` (verified pattern from `sync-meetings/index.ts:179`).
7. Multi-account same-recording_id — Fathom `recording_id` is globally unique per call. The composite PK `(recording_id, user_id)` already prevents duplicates. Document `import_source_id` as "first-source-that-imported".
8. Existing 91-row backfill collision — Phase 30-04 just backfilled orphan `recordings`. Our new backfill MUST be idempotent (uses `runPipeline()` which dedupes via fingerprint).

---

## Validation Architecture (Nyquist)

| Dimension | Validation Approach |
|-----------|---------------------|
| Correctness | Real-DB integration tests for backfill + reconcile gap-fill. |
| Performance | p95 benchmark: 100 queries on 5000-row mirror, assert <200ms. |
| Concurrency | Two concurrent backfills for same user: assert composite PK + ON CONFLICT prevents duplicate rows. |
| Failure modes | Fathom 429 mid-backfill: assert retry via FathomClient. Token expired mid-reconcile: assert refresh succeeds. |
| Security | `verify_jwt = false` offset by `RECONCILE_SECRET`. Confirm secret stored externally + rotatable. |
| Observability | `sync_jobs` row state: progress_current, progress_total, status. Console logs use structured prefixes. |
| Idempotency | All upserts use `ON CONFLICT (recording_id, user_id) DO ...`. Running reconcile twice produces same end state. |
| Boundary cases | Empty fathom account -> reconcile returns `{synced: 0}`. 2 fathom accounts same recording_id collision -> composite PK enforces. |

---

## Project Constraints (from CLAUDE.md)

- **Supabase deploy:** Always `--use-api`. Docker not available.
- **Migration naming:** `YYYYMMDDHHMMSS_descriptive_name.sql`. Today's date: `20260512`.
- **Real-DB integration tests required** — per Phase 30 / BUG-01, mocked tests are explicitly rejected.
- **Folder naming:** kebab-case -> `fathom-reconcile/` (matches existing `fathom-oauth-callback/`).
- **No AI/RAG/embedding code in frontend** (AI-02) — not relevant here.
- **Remix Icons only** if any UI changes — only the OAuth completion banner uses `RiCheckLine`.

---

## Coordination Status (Phase 37 conflict check)

| Concern | Status |
|---------|--------|
| `_shared/auth.ts` modified by Phase 37? | OK. Phase 37-01 confirmed migration complete; helper signature stable; `fathom-oauth-callback` already uses `authenticateRequest` (line 19). |
| Token encryption in `fathom-oauth-callback`? | OK. Already added in current source (lines 104-167). SEC-09 closed per 37-01-SUMMARY.md. |
| `create-fathom-webhook` restored to source? | OK. Already in source at `supabase/functions/create-fathom-webhook/index.ts` (108 lines, post-Phase-37 with `authenticateRequest`). NO restoration needed — this CONTEXT.md item was stale. |
| Phase 37 plans 37-02..37-05 in-flight? | Plans exist but not executed. They don't touch fathom-reconcile, fathom-raw-calls, or fathom-oauth-callback further. NO conflict. |

**Verdict: NO Phase 37 conflicts. Proceed with planning.**

---

## RESEARCH COMPLETE
