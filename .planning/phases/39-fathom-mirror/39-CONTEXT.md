---
phase: 39
phase_name: Fathom Mirror
gathered: 2026-05-11
status: Ready for planning
mode: Interactive discuss (gsd-autonomous)
---

# Phase 39: Fathom Mirror — Context

<domain>
## Phase Boundary

Make Fathom searches return in under 200ms by reading from a local `fathom_raw_calls` mirror table instead of hitting Fathom's API. Includes new-user backfill on OAuth completion and a daily reconciliation cron.

Out of scope: Fathom re-import / overwrite of individual calls (Phase 40), Zoom/manual-paste mirror (separate phase if ever needed), Fathom-side data model changes.
</domain>

<decisions>
## Implementation Decisions

### Daily Reconciliation Cron — Supabase pg_cron + Edge Function

Andrew's call: use Supabase's native pg_cron extension to schedule a daily call to an existing edge function for reconciliation.

**Setup:**
- Migration: `CREATE EXTENSION IF NOT EXISTS pg_cron;` (Supabase has this pre-installed on Pro+ tiers; verify availability).
- Edge function: `supabase/functions/fathom-reconcile/index.ts` (new) — runs the gap-detection logic.
- Schedule: `SELECT cron.schedule('fathom-daily-reconcile', '0 7 * * *', $$SELECT net.http_post(url := '<edge_fn_url>', headers := jsonb_build_object('Authorization', 'Bearer <service_role>'), body := '{}')$$);` (or similar; pg_cron + pg_net pattern). Runs at 7am UTC daily.
- The edge function calls Fathom's API per active integration, diffs against `fathom_raw_calls`, and upserts any missing rows.

**Why pg_cron over GitHub Actions:** lives in Supabase (no external infra), uses existing service-role auth (no new GH secret), failures visible in Supabase logs.

### New-User Backfill on OAuth Completion

- `fathom-oauth-callback` already exists. After successful OAuth completion, trigger a backfill job:
  - Synchronous: too slow if user has 500+ historical calls.
  - Background (recommended): kick off async `EdgeRuntime.waitUntil()` task that paginates Fathom history, writes to `fathom_raw_calls` in batches.
- User sees: "Connecting to Fathom..." → "Connected! Your calls are syncing in the background. They'll appear in a few minutes." (toast or banner).
- The same edge function (`fathom-reconcile` or new `fathom-backfill`) does this — code reuse.

### Mirror Table Schema

`fathom_raw_calls` already exists. Audit its current schema vs Fathom API response:
- Has `recording_id`, `title`, `full_transcript`, `summary`, `calendar_invitees` per Phase 30 finding.
- Needs: `recording_start_time`, `duration`, `attendees`, any other fields the UI currently fetches.
- Add `synced_at TIMESTAMPTZ NOT NULL DEFAULT now()` if missing — used by reconciliation to identify stale rows.
- Add `mirror_version INT DEFAULT 1` — for future schema migrations.

### Multi-Account Routing

Per success criteria #4: a user with 2+ Fathom accounts sees meetings from ALL accounts in their library.

**Implementation:**
- Each Fathom OAuth integration creates its own row in `import_sources` with a unique `oauth_account_id` (Fathom's user identifier).
- Mirror table rows include `import_source_id` FK to distinguish sources.
- Library query: union all integration sources for the current user/org, deduplicate by `recording_id` (Fathom assigns IDs globally, so duplicates would be the SAME meeting).

### `create-fathom-webhook` Restoration

Per success criteria #5: restore `create-fathom-webhook` to source control. The function lives in production but not in source (per deployed-vs-source delta noted in Phase 37 scope).

**Action:**
- Fetch the deployed source via `supabase functions download create-fathom-webhook` (if supported) or via Supabase dashboard.
- Commit to `supabase/functions/create-fathom-webhook/index.ts` with proper kebab-case naming.
- Auto-fire on OAuth callback: at end of `fathom-oauth-callback`, invoke `create-fathom-webhook` via `supabase.functions.invoke()` (so new calls hit our webhook in real-time, not just batch sync).

### Test Strategy

- **Real-DB integration test**: full backfill of a test user with N calls (using Fathom test/staging API if available, OR a mock Fathom API), verify `fathom_raw_calls` populated.
- **p95 latency test**: run 100 searches against the mirror table, measure 95th percentile, assert <200ms. Use real DB seeded with 5000 calls.
- **Dev-browser**: connect a Fathom account live, observe sync banner, wait for calls to appear, search for one, measure timing via Network panel.
- **Reconciliation test**: artificially delete 5 rows from mirror, run the reconcile cron manually, assert rows reappear.
- **Multi-account test**: connect 2 Fathom accounts, verify calls from both appear in the library.

### Sequencing

1. Audit + extend `fathom_raw_calls` schema.
2. Build `fathom-reconcile` edge function (used by both cron + backfill).
3. Wire pg_cron schedule.
4. Restore `create-fathom-webhook` from prod.
5. Wire backfill on `fathom-oauth-callback` completion.
6. Multi-account routing verification + fix if needed.
7. Mirror reads — switch library/search queries from Fathom API to `fathom_raw_calls`.

### Performance Gating

Library search MUST hit the mirror, NOT Fathom API. Add a feature flag or hard cutover. Plan-phase decides; cutover is simpler. Audit `src/hooks/useGlobalSearch.ts` + any `fathom-client.ts` calls in edge functions for residual Fathom-API search.
</decisions>

<code_context>
## Existing Code Insights

**Already in place:**
- `fathom_raw_calls` table (per Phase 30 work)
- `supabase/functions/fathom-oauth-callback/index.ts` — OAuth flow + (post-Phase-37) token encryption
- `supabase/functions/_shared/fathom-client.ts` — Fathom API client with retry
- `supabase/functions/sync-meetings/index.ts` — existing sync logic (model for backfill)
- `import_sources` table — multi-account routing already supported

**New work:**
- `supabase/functions/fathom-reconcile/index.ts` — new
- pg_cron migration — new
- Restore `create-fathom-webhook/` to source — new (recover from prod)
- Switch library search to mirror — modify `src/hooks/useGlobalSearch.ts` and any Fathom-API search paths
</code_context>

<specifics>
- **FEAT-01** — Fathom mirror with backfill + reconcile cron
- Success criteria 1-5 per ROADMAP

## Verification Strategy

- p95 <200ms search benchmark
- Backfill within 2 minutes of OAuth completion
- Reconcile closes the existing 7-row gap on test account
- Multi-account routing works
- `create-fathom-webhook` in source + auto-fires
</specifics>

<canonical_refs>
- `.planning/ROADMAP.md` — Phase 39
- `.planning/REQUIREMENTS.md` — FEAT-01
- `supabase/functions/_shared/fathom-client.ts` — Fathom API client
- `supabase/functions/sync-meetings/index.ts` — existing sync model
- `supabase/functions/fathom-oauth-callback/index.ts` — OAuth + backfill trigger
- Fathom API docs (Fathom team should have these documented)
- Supabase pg_cron docs
</canonical_refs>

<deferred>
## Deferred Ideas

- **Real-time webhook-driven mirror** — beyond `create-fathom-webhook`, push every Fathom event into the mirror immediately. v2.3 (current daily cron is fine for now).
- **Mirror for Zoom + manual-paste** — extend the pattern. v2.3.
- **Cross-account dedupe by attendee email** — if two users have the same Fathom meeting on their accounts, dedupe to one canonical recording. v2.3.
- **Full-text search index on `full_transcript`** — pg_trgm or tsvector. Defer unless mirror search is still slow after this phase.
</deferred>
