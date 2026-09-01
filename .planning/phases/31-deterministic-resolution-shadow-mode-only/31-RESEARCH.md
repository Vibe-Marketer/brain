# Phase 31: Deterministic Resolution, Shadow Mode Only - Research

**Researched:** 2026-09-01
**Domain:** Postgres/Supabase schema + RLS design, deterministic entity-resolution matching, atomic transactional RPCs, background job scheduling
**Confidence:** HIGH (every claim below is grounded in a direct read of this repo's live schema, migrations, and connector code — not training-data assumption)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
All implementation choices are at Claude's discretion within these locked constraints from the source spec (`.orca/drops/SPEC-event-resolution-and-provenance.md`) and REQUIREMENTS.md — not open questions:
- Deterministic tier signals: provider meeting ID (Zoom meeting UUID, Meet conference ID), calendar/iCal UID, meeting URL — read from `recordings.source_metadata`. A hit resolves with NO scoring (MATCH-01) — this is categorically different from the metadata tier's weighted scoring (Phase 32).
- Shadow mode: every proposed merge is computed AND recorded to `event_match_decisions`, but never applied — production `recordings.event_id` stays untouched by this phase's matcher (SAFE-02). "Shadow" is the literal behavior, not a metaphor: the ledger exists, the merge does not.
- Every merge decision (even shadow ones) is reversible in one atomic operation, modeled on the existing `split_recording_atomic` transactional shape (MATCH-10).
- All resolution runs behind a feature flag, off by default, enableable per organization (SAFE-01) — this phase should not need to actually enable it for any org; that's gated on Phase 32's precision proof.
- Hook point: resolution runs after `runPipeline` at the `_shared/canonical-recording.ts` seam per the spec's Implementation Notes — do not invent a new ingest hook.
- `event_match_decisions` schema: both recording IDs, tier, score, signal breakdown, decided_by (auto/user/admin), timestamp (MATCH-09).

### Claude's Discretion
Everything above is delivered at Claude's discretion for exact implementation (table shapes, column types, execution model, file names) — the spec locks *what*, not *how*. This research resolves the *how* with prescriptive recommendations below.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope (skipped; infrastructure-only, spec already locked the design). Explicitly out of scope for Phase 31 per the phase boundary: metadata tier scoring (Phase 32), content-proof tier (Phase 33), F5 false-merge fix (Phase 32), actually enabling the flag for any org (Phase 32, gated on SAFE-06), any UI.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MATCH-01 | Deterministic tier first — shared conference identifier (Zoom meeting UUID, Meet conference ID, calendar UID), read from `source_metadata`. A hit resolves with no scoring. | See "The source_metadata reality" (Common Pitfalls #1) for the verified, per-provider field survey. See "Recommended matcher shape" (Architecture Patterns) for the extraction/comparison design. |
| MATCH-09 | Every decision writes to an `event_match_decisions` ledger — both recording IDs, tier, score, signal breakdown, decided_by (auto/user/admin), timestamp. | See "Recommended `event_match_decisions` schema" (Architecture Patterns), grounded in the `admin_audit_log` append-only precedent. |
| MATCH-10 | Every merge is reversible in one atomic operation, following the `split_recording_atomic` transactional pattern, with the reversal recorded in the same ledger. | See "The `split_recording_atomic` precedent" (Code Examples) and "MATCH-10 vs SAFE-02: build it, don't wire it" (Common Pitfalls #2) — the critical scoping clarification for this phase. |
| SAFE-01 | All resolution runs behind a feature flag, off by default, enableable per organization. | See "Per-organization feature flag: no reusable precedent exists" (Common Pitfalls #4) and the recommended table design (Architecture Patterns). |
| SAFE-02 | Shadow mode computes and records proposed merges without applying them, so precision is measured on real data first. | See "Recommended execution model" (Architecture Patterns) — decoupled cron sweep, zero writes to `recordings.event_id`, proven by a noop-style regression test mirroring Phase 30's `event-schema-noop.integration.test.ts`. |
</phase_requirements>

## Summary

Phase 30 shipped a truthful, empty foundation: `events`, `recordings.event_id`, and `call_participants.event_id/role/has_confirmed_speech` are live in production, all NULL, with RLS already correctly scoped to participation-or-ownership (not organization) after the CR-01 fix. Phase 31 adds exactly two new things on top of that foundation — a deterministic matcher and an append-only decision ledger — and both must be built so that **zero bytes of `recordings.event_id` change in production as a result of this phase.**

The single biggest technical risk, verified by reading all six provider connectors' actual `source_metadata` construction code (not the spec's description of them), is that **no connector today writes a calendar/iCal UID into `source_metadata`, and only Zoom writes a stable per-occurrence conference identifier** (`zoom_meeting_id`, which is actually `recording.uuid`, not Zoom's numeric meeting ID). Fathom's `calendar_invitees` items carry only `{name, email, email_domain, is_external}` — no event ID. Fireflies' `meeting_link` is the closest thing to a cross-provider join URL but nothing else captures a directly comparable field today. This means MATCH-01, implemented exactly as specified, will find real matches almost exclusively for same-provider Zoom duplicates in the current data — which is expected and correct for a shadow-mode phase (Phase 32's metadata tier and Phase 33's content-proof tier are what deliver cross-provider coverage), but the planner and Andrew should know upfront that the shadow-mode ledger will likely stay near-empty for the cross-provider "Fathom + Plaud" scenario that motivates the whole milestone, and that is not a bug.

The second major finding is a scoping subtlety inside the locked requirements themselves: MATCH-10 (build a reversible atomic merge operation) and SAFE-02 (shadow mode never applies a merge) are not in tension if read correctly — Phase 31 must **build and prove** an atomic apply/reverse RPC pair (mirroring `split_recording_atomic` exactly: SECURITY DEFINER, `REVOKE EXECUTE FROM PUBLIC/anon/authenticated`, ownership validated by parameter not `auth.uid()`), but the automatic shadow-mode matcher must **never call the apply half** of that pair. The apply/reverse mechanism exists so MATCH-10 is provably correct and ready for Phase 32, not so shadow mode can use it.

Third: this phase needs no new npm/Deno packages, no new external services, and can lean entirely on patterns this exact codebase has already proven in production — `split_recording_atomic` for atomic writes, the `embedding_queue` + `pg_cron` system for background processing, `route_recording_cross_org`'s `EXCEPTION WHEN unique_violation` idiom for race safety, and the `user_participates_in_event`/`is_organization_member` SECURITY DEFINER helper pattern for RLS that reaches across tables. None of these need to be invented; all of them need to be copied correctly.

**Primary recommendation:** Build the matcher as a pure, unit-testable TypeScript module (`supabase/functions/_shared/event-resolver.ts`, sibling to `dedup-fingerprint.ts`) that extracts a small ordered list of tier-1 candidate identifiers per `source_app` from `source_metadata`, invoked by a new scheduled edge function on a `pg_cron` timer (mirroring `fathom-reconcile`'s cron precedent, not `embedding_queue`'s heavier claim-table — there is no external API to rate-limit against, so the lighter pattern is the correct-complexity choice). Store the per-organization flag as a dedicated `organization_feature_flags` table (not a single column bolted onto `organizations`), because Phase 32 adds at least one more org-scoped flag (SAFE-03's kill switch) and a key-value table avoids a second schema migration for that. Build `event_match_decisions` as an append-only, service-role-only table styled directly on `admin_audit_log`. Build the apply/reverse RPC pair, prove it with a direct integration test, and never call it from the automatic sweep.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tier-1 signal extraction from `source_metadata` | API/Backend | Database/Storage | Comparison logic is TypeScript (testable, shareable with Phase 32/33 matchers per the spec's own file-reuse note); the JSONB it reads lives in Storage. |
| Scheduling / trigger | Database/Storage | — | `pg_cron` executes entirely inside Postgres — this is not a typical "backend server cron," it is a DB-native extension already enabled in this exact prod project for 6 other jobs. |
| `event_match_decisions` ledger writes | Database/Storage | API/Backend | The table and its RLS/constraints are the enforcement boundary (service-role only); the edge function is a thin writer. |
| Atomic merge/reverse mechanism | Database/Storage | API/Backend | Mirrors `split_recording_atomic` — the transactional guarantee must live in a single Postgres function, not be assembled from sequential app-level calls. |
| Per-organization feature flag | Database/Storage | API/Backend | Storage is the source of truth (a table), checked by the backend sweep before doing any work for an org. |
| Browser/Client | N/A | — | Zero UI in this phase (explicitly out of scope). Any plan touching `src/` frontend files for this phase is out of scope creep. |
| Frontend Server (SSR) | N/A | — | Not applicable — this app has no SSR layer for this phase's concern. |
| CDN/Static | N/A | — | Not applicable. |

## Standard Stack

### Core — no new dependencies

This phase introduces **zero new npm or Deno packages**. Everything needed already exists in this codebase or ships with Postgres/Supabase:

| Component | Version (verified in-repo) | Purpose | Why Standard (for this repo) |
|-----------|------|---------|--------------|
| PL/pgSQL `SECURITY DEFINER` functions | Postgres (Supabase-managed) | Atomic multi-table writes, cross-table RLS helper checks | Used by `split_recording_atomic`, `route_recording_cross_org`, `user_participates_in_event`, `is_organization_member`, `claim_embedding_tasks` — the established pattern for exactly this class of problem in this repo. |
| `pg_cron` extension | Already `CREATE EXTENSION IF NOT EXISTS` in 6 prior migrations (verified: `20251128100000`, `20260110000008`, `20260111000008`, `20260512000002`, `20260623120000`, `20260625120000`) | Scheduled background execution | Proven, idempotent-to-reschedule, already live in prod — no new infra. |
| `pg_net` extension | Already enabled alongside `pg_cron` in the same migrations | HTTP call from a cron job to an edge function | Only needed if the sweep is edge-function-triggered (recommended below) rather than pure-SQL. |
| Zod `3.23.8` (via `esm.sh`) | Pinned across every edge function (`import { z } from 'https://esm.sh/zod@3.23.8'`) | Request validation if any new HTTP-triggered endpoint is added | Existing repo-wide convention (`supabase/CLAUDE.md` "Input Validation Requirements"). |
| Vitest | Repo's existing test runner (`package.json`: `"test": "vitest run"`, `"test:integration": "VITEST_INTEGRATION_OK=true vitest run ..."`) | Unit + integration tests for the matcher and the RLS/ledger behavior | Existing convention; `_shared/__tests__/connector-pipeline.test.ts` proves plain TS modules under `_shared/` are directly unit-testable without a Deno runtime. |

### Supporting

None — this phase does not need `fastest-levenshtein` (that's `dedup-fingerprint.ts`'s fuzzy-scoring dependency for Phase 32's metadata tier, not tier-1 exact-match). Do not add it here; MATCH-01 is explicitly "no scoring."

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `pg_cron` + a scheduled edge function (recommended) | `pgmq`-based Supabase Queues | `pgmq` is Supabase's current-generation recommended primitive for durable background work `[CITED: supabase.com/docs/guides/queues]`, but it has **zero prior usage anywhere in this repo** (verified: `grep -rl pgmq supabase/migrations` → 0 hits). Introducing a brand-new, never-used-in-this-project extension in a phase whose explicit goal is "zero data-corruption risk" is the wrong risk trade. Revisit `pgmq` only if a future phase needs true multi-consumer durable delivery with retry/backoff (tier-1 matching needs neither). |
| A single TS module doing exact-match comparison | Reusing/extending `dedup-fingerprint.ts` directly | `dedup-fingerprint.ts` is explicitly the F4/F5-bugged, Zoom-only, fuzzy-scoring matcher slated for Phase 32's provider-agnostic rewrite (CONTEXT.md: "Phase 31 does NOT need to touch or replace this yet"). Adding tier-1 logic into it would entangle this phase's zero-scoring, zero-risk change with the file Phase 32 is about to substantially rewrite. Keep them separate files; Phase 32 can compose them later. |
| A dedicated `organization_feature_flags` table | A single boolean column on `organizations` | Simpler for exactly one flag, but Phase 32 (same milestone) adds SAFE-03 (kill switch), a second per-org toggle. A key-value table avoids a second `ALTER TABLE organizations` migration and mirrors the shape of the now-deleted global `feature_flags` table (re-scoped to org, not reusing the deleted table itself). |

**Installation:** None required.

**Version verification:** N/A — no new packages.

## Package Legitimacy Audit

**Not applicable to this phase.** Zero new external packages are introduced. All patterns recommended below reuse Postgres built-ins (`pg_cron`, `pg_net`, PL/pgSQL) and existing repo dependencies (Zod, Vitest) already vetted in prior phases. The Package Legitimacy Gate protocol is skipped per its own scope ("whenever this phase installs external packages") — none are installed here.

## Architecture Patterns

### System Architecture Diagram

```
 ┌─────────────────────────────────────────────────────────────────────┐
 │  EXISTING INGEST PATHS (14 call sites — zoom-webhook, sync-meetings,  │
 │  fathom-reconcile, grain/fireflies/read-ai/plaud webhooks+syncs,      │
 │  file-upload-transcribe, save-pasted-transcript, youtube-import,      │
 │  connector-sync-all, mcp ingest_transcript)                           │
 │                                                                       │
 │  each builds a ConnectorRecord { source_app, source_metadata, ... }   │
 │  and calls runPipeline() — UNCHANGED BY THIS PHASE, zero call sites   │
 │  touched                                                              │
 └───────────────────────────────┬─────────────────────────────────────┘
                                  │ runPipeline() → checkDuplicate()
                                  │              → resolveRoutingDestination()
                                  │              → insertRecording()
                                  ▼
                     recordings row exists, event_id = NULL
                     (unchanged Phase 30 default state)
                                  │
                                  │  *** no inline call added here ***
                                  │  (decoupled — see below)
                                  ▼
 ┌─────────────────────────────────────────────────────────────────────┐
 │  pg_cron job "event-resolution-sweep" (new, mirrors                   │
 │  fathom-daily-reconcile's schedule+net.http_post shape)               │
 │  runs every N minutes → net.http_post → resolve-events edge function  │
 └───────────────────────────────┬─────────────────────────────────────┘
                                  ▼
 ┌─────────────────────────────────────────────────────────────────────┐
 │  resolve-events edge function                                        │
 │   1. SELECT organization_id FROM organization_feature_flags           │
 │      WHERE flag_key = 'event_resolution' AND enabled = true           │
 │   2. SELECT recordings WHERE event_id IS NULL                         │
 │      AND organization_id = ANY(flagged_org_ids)                       │
 │      AND created_at > cutoff  ORDER BY created_at LIMIT batch_size    │
 │   3. for each recording: extractTier1Signal(source_app, source_metadata) │
 │      (pure fn in _shared/event-resolver.ts)                           │
 │   4. self-join against other unresolved/resolved recordings sharing   │
 │      the same non-null tier-1 signal value                            │
 │   5. on a hit → INSERT INTO event_match_decisions                     │
 │      (tier='deterministic', score=NULL, decision='merge_proposed',    │
 │       applied=false, decided_by='auto', signals={...})                │
 │      guarded by UNIQUE + EXCEPTION WHEN unique_violation              │
 │      (route_recording_cross_org idempotency idiom)                    │
 │   6. *** never writes recordings.event_id or events *** (SAFE-02)     │
 └───────────────────────────────┬─────────────────────────────────────┘
                                  ▼
                     event_match_decisions (append-only ledger)
                     service-role read/write only, no client policy

 ┌─────────────────────────────────────────────────────────────────────┐
 │  SEPARATE, UNCALLED-BY-THE-SWEEP mechanism (MATCH-10, built+tested,   │
 │  never wired to automatic shadow mode this phase):                    │
 │                                                                       │
 │  apply_event_match_atomic(...)   — SECURITY DEFINER RPC, mirrors      │
 │  reverse_event_match_atomic(...) — split_recording_atomic exactly:    │
 │                                     REVOKE EXECUTE FROM PUBLIC/anon/  │
 │                                     authenticated; ownership checked  │
 │                                     by parameter, not auth.uid()      │
 │  proven by a direct integration test calling the RPCs on TEST,        │
 │  not by any UI and not by the sweep                                   │
 └─────────────────────────────────────────────────────────────────────┘
```

A reader tracing "the primary use case" (a new Zoom recording ingested, later found to duplicate an existing capture) follows: ingest → `runPipeline` → `recordings` row with `event_id NULL` → next cron tick → `resolve-events` reads flagged orgs' unresolved recordings → extracts `source_metadata->>'zoom_meeting_id'` → finds another recording with the same value → writes ONE row to `event_match_decisions` → stops. `recordings.event_id` is untouched at every step. That last property is the entire point of the phase.

### Recommended Project Structure
```
supabase/
├── functions/
│   ├── _shared/
│   │   ├── event-resolver.ts       # NEW — pure fns: extractTier1Signal(sourceApp, sourceMetadata), findDeterministicMatch(...)
│   │   ├── event-resolver.test.ts  # unit tests, vitest, no DB needed (mirrors connector-pipeline.test.ts convention)
│   │   ├── dedup-fingerprint.ts    # UNCHANGED this phase (Phase 32 rewrites it)
│   │   └── canonical-recording.ts  # UNCHANGED — CanonicalRecording contract stays the shared type reference
│   └── resolve-events/             # NEW edge function — cron-triggered sweep, calls event-resolver.ts, writes event_match_decisions
│       └── index.ts
├── migrations/
│   ├── <ts>_create_organization_feature_flags.sql   # SAFE-01
│   ├── <ts>_create_event_match_decisions.sql        # MATCH-09
│   ├── <ts>_create_event_match_apply_reverse_rpcs.sql # MATCH-10
│   └── <ts>_event_resolution_sweep_cron.sql          # pg_cron schedule, mirrors fathom-daily-reconcile
src/test/
└── event-resolution-shadow.integration.test.ts  # NEW — SAFE-02 noop proof + event_match_decisions isolation, mirrors event-schema-noop.integration.test.ts and the bespoke `events` isolation block in rls-regression.test.ts
```

### Pattern 1: SECURITY DEFINER atomic RPC for reversible writes (MATCH-10)
**What:** All critical multi-table writes for a merge or reversal happen inside a single `SECURITY DEFINER` PL/pgSQL function, called by the service role only.
**When to use:** Any operation that must be all-or-nothing across more than one table/row (here: setting `recordings.event_id` on two+ rows, possibly creating/updating the `events` row, and writing the ledger entry — all in one transaction).
**Example (verified, existing in this repo — `supabase/migrations/20260309220000_split_recording_rpc.sql`):**
```sql
CREATE OR REPLACE FUNCTION public.split_recording_atomic(
  p_part1_recordings_id UUID, p_part1_fathom_id BIGINT,
  p_part1_title TEXT, p_part1_transcript TEXT,
  p_part2_title TEXT, p_part2_transcript TEXT,
  p_organization_id UUID, p_owner_user_id UUID, -- ownership validated BY PARAMETER
  ...
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public          -- MANDATORY: prevents search_path hijacking
AS $$
BEGIN
  IF p_part1_recordings_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM recordings WHERE id = p_part1_recordings_id AND owner_user_id = p_owner_user_id) THEN
      RAISE EXCEPTION 'Access denied: not the owner of recording %', p_part1_recordings_id;
    END IF;
  END IF;
  -- ...all writes here, one transaction...
END;
$$;

REVOKE EXECUTE ON FUNCTION public.split_recording_atomic FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.split_recording_atomic FROM anon;
REVOKE EXECUTE ON FUNCTION public.split_recording_atomic FROM authenticated;
-- service_role bypasses EXECUTE grants — edge function calls still work.
```
Mirror this exactly for `apply_event_match_atomic` / `reverse_event_match_atomic`: ownership/authorization checked via parameters (never `auth.uid()`, since the caller is the service role), `SET search_path = public`, `REVOKE EXECUTE` from every non-service role.

### Pattern 2: SECURITY DEFINER helper for cross-table RLS checks
**What:** A narrow, single-purpose `SECURITY DEFINER SQL` function used *inside* an RLS policy's `USING` clause, so the policy can check a condition on another table without being subject to that other table's own RLS policy.
**When to use:** Any time an RLS policy on table A needs to check a condition on table B, and table B's own RLS would otherwise silently filter out rows the policy author expected to see.
**Why this matters here:** This is not theoretical — Phase 30's CR-01 finding proved this exact failure mode in this exact codebase. `events`' original participation policy did `EXISTS (SELECT 1 FROM call_participants cp WHERE cp.event_id = events.id AND cp.email = ...)`, and because `call_participants` has its own `FORCE ROW LEVEL SECURITY` policy restricting SELECT to organization members, the subquery silently returned nothing for a real participant outside the org — defeating EVT-04's entire design intent. If `event_match_decisions` or any future policy needs to check participation/ownership through `recordings` or `call_participants`, use this pattern from the start, not after a CR-01-style bug is found.
**Example (verified, existing — `supabase/migrations/20260831020000_fix_events_participation_rls_and_updated_at_trigger.sql`):**
```sql
CREATE OR REPLACE FUNCTION public.user_participates_in_event(p_event_id uuid, p_email text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM call_participants cp WHERE cp.event_id = p_event_id AND cp.email = p_email)
$function$;
```

### Pattern 3: Idempotent writes under concurrency
**What:** Attempt the INSERT directly; on a unique-constraint collision, re-select and reuse the existing row instead of erroring.
**When to use:** Any write that might race with itself (a cron tick overlapping the previous one, a manual re-run, retried edge-function invocations).
**Example (verified, existing — `supabase/migrations/20260730160000_fix_cross_org_copy_dedup.sql`, `route_recording_cross_org`):**
```sql
BEGIN
  INSERT INTO recordings (...) VALUES (...) RETURNING id INTO v_new_recording_id;
  v_did_insert := TRUE;
EXCEPTION WHEN unique_violation THEN
  -- Race: a concurrent copy won first. Reuse the row it created.
  SELECT id INTO v_new_recording_id FROM recordings
  WHERE organization_id = p_target_org_id AND source_app = v_source.source_app AND source_call_id = v_source.source_call_id
  LIMIT 1;
  IF v_new_recording_id IS NULL THEN RAISE; END IF; -- not the dedup constraint after all
END;
```
Apply this to `event_match_decisions` inserts: `UNIQUE (recording_id_a, recording_id_b, tier)` (normalize the pair order before insert, e.g. always store the lexicographically-smaller UUID as `recording_id_a`), with an `EXCEPTION WHEN unique_violation` fallback that no-ops (a duplicate proposal for the same pair+tier is not an error, just a re-run).

### Pattern 4: Decoupled cron sweep, not an inline pipeline hook
**What:** A `pg_cron`-scheduled job calls an edge function (or, for pure-SQL logic with no external calls, a PL/pgSQL function directly) on a timer, rather than adding a synchronous call inside the hot ingest path.
**When to use:** Any "process new rows periodically" need that (a) must never block or fail the primary write path, and (b) doesn't need per-item real-time latency.
**Why recommended over an inline `runPipeline` hook:** `runPipeline` has 14 distinct call sites across every connector. An inline hook would need to be added to (or the function itself modified for) all of them, coupling resolution's success/failure/latency to every single ingest path in the app — exactly the blast radius SAFE-02's "shadow, compute-and-record-only" framing exists to avoid. A cron sweep satisfies "runs after `runPipeline`" (temporally and architecturally — it operates on rows `runPipeline` already created) without touching any of the 14 call sites.
**Example shape (verified precedent — `supabase/migrations/20260512000002_fathom_daily_reconcile_cron.sql`, the lighter of the two cron patterns in this repo; prefer this over `embedding_queue`'s heavier claim-table+worker-lock pattern, which exists to rate-limit against a paid external API — a problem tier-1 matching does not have):**
```sql
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

DO $outer$
BEGIN
  PERFORM cron.schedule(
    'event-resolution-sweep',
    '*/5 * * * *',  -- every 5 minutes; adjust based on ingest volume
    $body$
    SELECT net.http_post(
      url := current_setting('app.supabase_url', true) || '/functions/v1/resolve-events',
      headers := jsonb_build_object('Content-Type', 'application/json', 'X-Reconcile-Secret', current_setting('app.reconcile_secret', true)),
      body := '{"mode": "shadow"}'::jsonb
    );
    $body$
  );
EXCEPTION WHEN undefined_function THEN
  RAISE NOTICE 'pg_cron not available - resolution sweep disabled.';
END $outer$;
```

### Recommended `event_match_decisions` schema (MATCH-09, synthesized from the requirement text + the `admin_audit_log` append-only precedent — Claude's discretion, not spec-mandated column names)
```sql
CREATE TABLE event_match_decisions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id_a         UUID NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  recording_id_b         UUID NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  event_id               UUID REFERENCES events(id) ON DELETE SET NULL,
  tier                   TEXT NOT NULL CHECK (tier IN ('deterministic', 'content_proof', 'metadata')),
  score                  NUMERIC CHECK (score IS NULL OR (score >= 0 AND score <= 1)), -- NULL for tier-1 (MATCH-01: no scoring)
  signals                JSONB NOT NULL DEFAULT '{}'::jsonb, -- e.g. {"matched_field": "zoom_meeting_id"}
  decision               TEXT NOT NULL CHECK (decision IN ('merge_proposed', 'merge_applied', 'reversed', 'rejected')),
  decided_by             TEXT NOT NULL CHECK (decided_by IN ('auto', 'user', 'admin')),
  applied                BOOLEAN NOT NULL DEFAULT false, -- SAFE-02: always false for every row this phase writes automatically
  reverses_decision_id   UUID REFERENCES event_match_decisions(id), -- set on a reversal row, points back at the merge it undoes
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT event_match_decisions_pair_ordered CHECK (recording_id_a < recording_id_b), -- enforce canonical ordering for the UNIQUE constraint below
  UNIQUE (recording_id_a, recording_id_b, tier)
);
ALTER TABLE event_match_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_match_decisions FORCE ROW LEVEL SECURITY;
-- No authenticated/anon policy at all this phase — no user-facing surface yet (CONTEXT.md code_context).
-- Service role bypasses RLS entirely; this table is effectively invisible to every client JWT, which is
-- the same posture as `admin_audit_log` before its admin-read policy existed.
```
Note the `recording_id_a < recording_id_b` check constraint: Postgres UUIDs are comparable, so this enforces a canonical pair ordering at insert time — required for the `UNIQUE (recording_id_a, recording_id_b, tier)` constraint (and thus Pattern 3's idempotency idiom) to actually catch both insertion orders of the same pair.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic multi-table merge/reverse | Sequential app-level `UPDATE` + `INSERT` calls from the edge function with manual try/catch rollback | A `SECURITY DEFINER` PL/pgSQL RPC, one transaction, mirroring `split_recording_atomic` | Postgres transactions are all-or-nothing by construction; app-level sequencing can partially fail mid-way and leave `recordings.event_id` inconsistent — precisely the "data-corruption risk" this phase's goal names explicitly. |
| Background job scheduling | A `setInterval`/long-poll loop inside an edge function, or a client-side "check on page load" trigger | `pg_cron`, already enabled and proven for 6 other jobs in this exact prod project | Edge functions have no persistent process to hold a `setInterval` across invocations; `pg_cron` survives cold starts and needs no client to be open. |
| Race-safe duplicate-ledger-row prevention | `SELECT ... WHERE ...` to check existence, then `INSERT` if none found | A `UNIQUE` constraint + `EXCEPTION WHEN unique_violation` fallback, mirroring `route_recording_cross_org` | The check-then-insert pattern has a race window under concurrent/overlapping cron runs; Postgres's own constraint closes it atomically with no extra round trip. |
| Cross-table RLS visibility checks | A raw `EXISTS` subquery reaching into another RLS-protected table from inside a policy | A narrow `SECURITY DEFINER SQL` helper function, mirroring `user_participates_in_event` / `is_organization_member` | Phase 30's CR-01 proved this exact mistake in this exact codebase: the subquery inherits the target table's own RLS under the querying role and silently returns nothing, defeating the policy's intent. This is not a hypothetical risk — it already happened once, one migration before this phase. |
| Per-provider meeting-ID field lookup | Scattered `if (sourceApp === 'zoom') ... else if (sourceApp === 'fireflies') ...` branches inline in matcher logic | A single small typed table/function mapping `source_app -> candidate source_metadata key(s)` | Six providers name their fields differently today (`zoom_meeting_id`, `fireflies_meeting_link`, `read_ai_platform_id`, `grain_recording_id`, `fathom_call_id`, none for `plaud`) and this list will grow in Phase 32/33. Centralizing it in one place is the only way future phases extend it without re-deriving this research's provider survey from scratch. |

**Key insight:** Every "don't hand-roll" item above already has a working, production-proven implementation somewhere in this exact repository. This phase's job is disciplined imitation of `split_recording_atomic`, `route_recording_cross_org`, `user_participates_in_event`, and the `pg_cron` jobs — not invention.

## Common Pitfalls

### Pitfall 1: The `source_metadata` cross-provider reality does not match the spec's motivating example
**What goes wrong:** Building MATCH-01 assuming every connector already carries a directly comparable "conference ID" field (as the spec's signal list — "Zoom meeting UUID, Meet conference ID, calendar UID" — implies), then being surprised when shadow mode produces almost no cross-provider matches.
**Why it happens:** Verified by reading all six connectors' actual `source_metadata` construction (not the spec's summary of them):

| Provider | Fields actually written to `source_metadata` today | Tier-1-eligible? |
|---|---|---|
| Zoom (`zoom-webhook`, `zoom-sync-meetings`) | `zoom_meeting_id` (= `recording.uuid`, per-occurrence stable), `zoom_numeric_id` (= reusable PMI-style ID, **not safe** — a recurring meeting's numeric ID repeats across occurrences), `zoom_share_url` | Yes, `zoom_meeting_id` only — but only useful for Zoom-to-Zoom dedup |
| Fathom (`webhook`, `sync-meetings`, `fathom-reconcile`) | `fathom_call_id` (Fathom's own internal ID), `fathom_url`/`fathom_share_url` (Fathom's own playback links), `calendar_invitees: [{name, email, email_domain, is_external}]` — **verified via the `FathomMeeting` interface in `fetch-meetings/index.ts:116-138`: no event ID, no iCal UID field exists anywhere in this shape** | No cross-provider signal |
| Fireflies (`fireflies-connector.ts:320`) | `fireflies_transcript_id`, `fireflies_transcript_url`, `fireflies_meeting_link` (`transcript.meeting_link` — the closest thing to a real join URL, since Fireflies' bot joins via the calendar invite link) | Possibly, but nothing else captures a directly comparable field to match it against today |
| Grain (`grain-connector.ts:80`) | `grain_recording_id` (Grain's own ID), `grain_source`, no URL/UID field | No |
| Read.ai (`read-ai-connector.ts:112`) | `read_ai_meeting_id` (Read.ai's own ID), `read_ai_platform` (e.g. `"zoom"`), `read_ai_platform_id`/`platform_meeting_id` — **unverified whether this is the underlying platform's real conference ID or Read.ai's own internal reference; flagged as an Open Question below** | Possibly, pending verification |
| Plaud (`plaud-connector.ts:31`) | Device/file metadata only (`plaud_file_id`, `plaud_serial_number`) — `sourceUrl`/`shareUrl` explicitly `null` | No — device recorder, no calendar linkage at all |

**How to avoid:** Build `extractTier1Signal(sourceApp, sourceMetadata)` to return `null` gracefully for providers/fields that don't have an eligible signal (this is the normal case for 5 of 6 providers today, not an error condition). Do not treat a `null` extraction as a failure or log it as a warning per-row (it would flood logs). Set expectations with the planner/Andrew explicitly: shadow-mode data in production will likely show near-zero cross-provider hits until Phase 32/33 land — this is consistent with, not contrary to, the phase's own goal ("this phase does not build the visible win itself").
**Warning signs:** If a verification step or acceptance test expects to see cross-provider matches (e.g., a Fathom+Zoom pair) appear in `event_match_decisions` from real production data during this phase, that expectation is wrong — write the test against synthetic same-provider (Zoom-to-Zoom) fixtures, or synthetic fixtures with a hand-inserted matching field, not against live cross-provider expectations.

### Pitfall 2: MATCH-10 (build reversibility) and SAFE-02 (never auto-apply) are not in tension — but conflating them is an easy mistake in either direction
**What goes wrong:** Either (a) skipping the apply/reverse RPC entirely because "shadow mode means nothing applies," which fails MATCH-10's explicit requirement text, or (b) wiring the automatic cron sweep to actually call the apply RPC when it finds a tier-1 hit, which violates SAFE-02 and puts unproven auto-merge logic live against production data — the exact risk STATE.md's Blockers section names explicitly ("Shadow mode (Phase 31) must ship with no auto-merge before hardening").
**Why it happens:** MATCH-10 and SAFE-02 are both Phase 31 requirements per REQUIREMENTS.md's traceability table, and read too quickly they sound contradictory (build a merge operation, but never merge).
**How to avoid:** Build the apply/reverse RPC pair as a real, tested, callable capability (proves MATCH-10) — but the automatic shadow-mode sweep only ever calls the *compute-and-record* path (`INSERT INTO event_match_decisions ... decision='merge_proposed', applied=false`), never the apply RPC. Prove the apply/reverse RPC works via a direct integration test that calls it explicitly (service-role client on the TEST project), not via the sweep and not via any UI (there is none this phase).
**Warning signs:** Any code path where the cron sweep's output directly triggers `apply_event_match_atomic` is the SAFE-02 violation to catch in review.

### Pitfall 3: `event_match_decisions` cannot be registered in `rls-regression.test.ts`'s `CROSS_ORG_TABLES` array the way most tables are
**What goes wrong:** Adding `{ table: "event_match_decisions", filterColumn: "recording_id" }` to the generic `CROSS_ORG_TABLES` loop (the pattern used for ~20 other tables) and expecting it to correctly test isolation.
**Why it happens:** `CROSS_ORG_TABLES`'s `filterColumn` union type supports a single FK column (`organization_id | org_id | user_id | recording_id | workspace_id | folder_id | reporter_id | ticket_id`). `event_match_decisions` has **two** recording FKs (`recording_id_a`, `recording_id_b`), structurally incompatible with the loop's single-column assumption. This is not hypothetical: `events` hit the identical structural mismatch in Phase 30 and was proven via a **bespoke isolation block** written directly into `rls-regression.test.ts` (verified: `src/test/rls-regression.test.ts` lines ~1045-1130, explicit comment "events cannot join the CROSS_ORG_TABLES loop above -- its filterColumn options... EVT-04 deliberately forbids an organization_id column on events"), not by adding a row to the array.
**How to avoid:** Given `event_match_decisions` has no authenticated/anon RLS policy at all this phase (service-role only, per the recommended schema above), the correct registration is closer to `CLIENT_DENY_TABLES` (the "authenticated JWT reads ZERO rows even when a row exists" list, currently just `fathom_calls_orphan_report`) than `CROSS_ORG_TABLES`. Add `event_match_decisions` to `CLIENT_DENY_TABLES` and write one assertion proving a signed-in JWT gets zero rows back even when the service role has seeded one. This is a genuinely new registration this phase must make (SAFE-05's literal text names `event_match_decisions` explicitly, even though SAFE-05 as a *tracked requirement ID* is scoped to Phase 30 in REQUIREMENTS.md's traceability table — Phase 30 could not have registered a table that didn't exist yet).
**Warning signs:** A plan that treats SAFE-05 as "already done, nothing to do here" without checking whether the new table needs its own isolation-test registration.

### Pitfall 4: No reusable per-organization feature-flag pattern exists in this codebase — the old `feature_flags` table is the wrong shape and was deleted for unrelated reasons
**What goes wrong:** Assuming the removed `feature_flags` table (migration `20260302000000`, dropped by `20260611000001` per FLAG-01) can be resurrected or partially reused for SAFE-01.
**Why it happens:** The name is suggestive, but verified by reading both migrations: the old table was **global** (no org scoping at all — `id, name, description, is_enabled, enabled_for_roles[]`), gated by a client-facing `ADMIN` role check, and was deleted specifically because "every previously gated surface is now hard-enabled" (a UI-rollout mechanism, not a data-safety mechanism). It is architecturally the wrong shape for "off by default, enableable per organization" regardless of the deletion history. `organizations` itself has no settings/flags column (verified full row shape: `created_at, cross_org_default, id, logo_url, name, slug, type, updated_at` — 8 columns, nothing else). No `organization_settings` table exists anywhere in the schema (verified: zero grep hits).
**How to avoid:** Build a new, purpose-scoped table (`organization_feature_flags`, recommended above), service-role-write-only, with a narrow read policy added only when/if a settings UI needs it later (not this phase). Do not touch or reference the deleted `feature_flags` table or its migration history — it is unrelated.
**Warning signs:** Any migration that does `ALTER TABLE feature_flags` or references `enabled_for_roles`.

### Pitfall 5: Zoom's `zoom_meeting_id` field name is misleading — verify which value it actually holds before using it as MATCH-01's Zoom signal
**What goes wrong:** Assuming `source_metadata->>'zoom_meeting_id'` holds Zoom's numeric meeting ID (which is often a reusable Personal Meeting ID, unsafe for dedup — the same PMI can host many distinct meeting occurrences) rather than the per-occurrence-unique recording UUID.
**Why it happens:** Verified directly in `zoom-webhook/index.ts:443` and `zoom-sync-meetings/index.ts`: the code explicitly does `const recordingId = recording.uuid; // Use UUID not meeting_id (PMI reuse issue)` and then stores that UUID value under the *key* `zoom_meeting_id` in `source_metadata` (confusing key name, correct value) — while the actual reusable numeric ID is stored separately under `zoom_numeric_id`.
**How to avoid:** MATCH-01's Zoom extraction must read `source_metadata->>'zoom_meeting_id'` (the UUID, despite its name) and must **never** use `zoom_numeric_id` as a tier-1 signal — the connector code itself already carries a warning comment about exactly this footgun.
**Warning signs:** A matcher implementation that reads `zoom_numeric_id` for anything other than display/reference.

## Code Examples

### The connector-pipeline.ts fan-in point (verified, `supabase/functions/_shared/connector-pipeline.ts:572-788`)
Every one of the 14 ingest call sites converges here. This is the "seam" CONTEXT.md refers to as "after `runPipeline`" — not a literal function inside `canonical-recording.ts` (that file only defines the `CanonicalRecording` contract and transform helpers; it has no `runPipeline` and no hook mechanism of its own):
```typescript
export interface PipelineResult {
  success: boolean;
  recordingId?: string;
  skipped?: boolean;   // true when the record already existed
  error?: string;
}

export async function runPipeline(
  supabase: SupabaseClient,
  userId: string,
  record: ConnectorRecord,
): Promise<PipelineResult> {
  // ...checkDuplicate, routing resolution...
  const { id } = await insertRecording(supabase, userId, record);
  return { success: true, recordingId: id };
}
```
Phase 31 does not modify this file or any of its 14 callers. The cron sweep operates on `recordings` rows independently, keyed on `event_id IS NULL`, which is exactly the durable signal `runPipeline` leaves behind.

### `checkDuplicate`'s fail-open convention — do not copy it verbatim for the matcher
```typescript
// Fail-open: if the query errors, logs the error and returns { isDuplicate: false }.
// A dedup check failure should never block an import.
```
`checkDuplicate` fails open because a dedup-check failure must never block a user's import. The resolution matcher has the opposite risk profile (SAFE's asymmetric-thresholds ethos: "a false merge is a data-exposure incident") — on any extraction or comparison error, the matcher should fail **closed** (treat as "no match found," write nothing, log and move on), never fail open into an unverified match.

## State of the Art

| Old Approach (this repo, F4/F5) | Current Approach (this phase) | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `dedup-fingerprint.ts`'s `checkMatch`: fuzzy title/time/participant scoring, "any two of three" thresholds, Zoom-only, reads `zoom_raw_calls` | Tiered matching: tier-1 deterministic (exact ID match, no scoring) first, metadata/content-proof scoring only in later tiers, provider-agnostic, reads `recordings`/`call_participants`/`transcript_chunks` | This milestone (Phase 31 starts tier-1; Phase 32/33 add the rest) | Tier-1 is categorically safer than the old fuzzy matcher — no false-merge risk from title/time/participant coincidence, because it only fires on an exact shared identifier. The live F5 false-merge bug in `checkMatch` remains unfixed and unused-by-this-phase until Phase 32; this phase must not accidentally route through it. |
| Global admin-gated `feature_flags` table (deleted 2026-06-11, FLAG-01) | Per-organization `organization_feature_flags` table (recommended, new this phase) | This phase | Different problem entirely — the old table gated UI rollout for admins; the new one gates a backend data-mutation capability per tenant. Not a resurrection, a new design for a new problem. |
| N/A (background jobs previously always used hand-rolled claim tables, e.g. `embedding_queue`) | Supabase's platform-level recommendation has shifted toward `pgmq`-based Supabase Queues for new durable background work `[CITED: supabase.com/docs/guides/queues]` | Supabase platform evolution, not yet adopted anywhere in this repo | Noted for awareness, not adopted this phase — see "Alternatives Considered" above for why `pg_cron` (already proven here) is the correct-risk choice for this specific, simple, non-durable-delivery-critical job. |

**Deprecated/outdated:** The spec's own phrasing "resolution hooks the existing `canonical-recording.ts` seam" should be read as "resolution operates on the `CanonicalRecording`/`source_metadata` contract that file defines," not as "add a call inside that file" — the file contains no hook mechanism and no connector currently imports it for anything but type/transform reuse (and even then, only 4 of 6 providers route through `canonicalToConnectorRecord`; Zoom and Fathom build their `ConnectorRecordLike` inline without it). The true universal seam is `runPipeline`'s return point in `connector-pipeline.ts`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `read_ai_platform_id`/`platform_meeting_id` may or may not be the underlying Zoom/Meet conference's real ID vs. Read.ai's own internal reference | Common Pitfalls #1 | If it IS the real platform ID, Read.ai becomes a second tier-1-eligible provider and the matcher's provider-field map should include it; if not, including it would risk false ties between unrelated Read.ai meetings that happen to share an internal reference scheme. Verify against Read.ai's API docs or a sample payload before wiring it into the tier-1 signal list. |
| A2 | A 5-minute `pg_cron` interval is an adequate sweep cadence for shadow-mode latency needs | Architecture Patterns, Pattern 4 | If ingest volume is much higher than assumed, batch size/interval may need tuning; this has zero data-correctness risk (shadow mode has no user-facing latency requirement), only a lag-before-the-ledger-updates risk. Low impact either way. |
| A3 | The recommended `organization_feature_flags` table design (vs. a single boolean column on `organizations`) is the better tradeoff given Phase 32's SAFE-03 kill switch | Standard Stack, Alternatives Considered | If Phase 32 ends up not needing a second org-scoped flag, this table is mild over-engineering (one extra table, one extra join) rather than a correctness risk. Reversible with a follow-up migration either direction. |
| A4 | `fireflies_meeting_link` reliably contains the original conferencing join URL (not a Fireflies-hosted page) for enough of the corpus to be worth extracting as a tier-1 candidate | Common Pitfalls #1 | If it's usually a Fireflies-hosted transcript page URL instead, including it as a tier-1 signal risks nothing (no other provider would produce the same string, so it just never matches) — low risk, but worth a one-sample verification (`SELECT source_metadata->>'fireflies_meeting_link' FROM recordings WHERE source_app='fireflies' LIMIT 5`) before or during planning. |

**None of these assumptions block planning** — each has a low-risk failure mode and a clear verification path the planner can fold into a task (e.g., a Wave 0 data-sampling step against TEST or a read-only prod query).

## Open Questions

1. **Does `read_ai_platform_id` carry the real underlying platform (Zoom/Meet) conference ID, or Read.ai's own internal reference?**
   - What we know: `read-ai-connector.ts:116` writes `read_ai_platform` (e.g., `"zoom"`) and `read_ai_platform_id ?? meeting.platform_meeting_id` into `source_metadata`. The field exists and is named suggestively.
   - What's unclear: Its actual value shape — this requires either Read.ai's API documentation (not yet fetched) or a sample of real `source_metadata` rows from prod/TEST for `source_app = 'read-ai'`.
   - Recommendation: The planner should add a cheap Wave-0 verification task — a read-only query against TEST or prod (`SELECT source_metadata FROM recordings WHERE source_app = 'read-ai' LIMIT 5`) — before deciding whether Read.ai joins Zoom as a second tier-1-eligible provider in the matcher's field map. This does not block building the matcher's extensible structure, only whether Read.ai's field is included in the initial provider map.

2. **What `pg_cron` interval and batch size fit real ingest volume?**
   - What we know: The pattern (schedule + `net.http_post` + batched `SELECT ... LIMIT`) is proven; `fathom-daily-reconcile` runs once daily, `embedding-worker-backup` runs every minute.
   - What's unclear: This repo's actual recording-ingest rate per organization, which determines whether 5 minutes, 1 minute, or 15 minutes is the right sweep cadence.
   - Recommendation: Start conservative (5-15 minutes) since shadow mode has no user-facing latency requirement; this is a tuning parameter, not a design decision, and can be changed by editing the `cron.schedule` call in a follow-up migration with zero risk.

3. **Should `event_match_decisions` get any authenticated-role SELECT policy at all in this phase, or stay fully service-role-only?**
   - What we know: CONTEXT.md's code_context explicitly says "default to service-role-only writes/reads if no user-facing surface needs it yet (this phase has none)."
   - What's unclear: Whether a future near-term phase (Phase 32 hardening, or an eventual admin review queue) will need a narrow admin-only read policy soon enough that adding it now (mirroring `admin_audit_log`'s `has_role(auth.uid(), 'ADMIN')` pattern) saves a migration later.
   - Recommendation: Ship service-role-only this phase (matches the locked scope exactly); adding a read policy later is a pure-addition migration with no risk to existing behavior, so there's no cost to deferring it.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `pg_cron` extension | Scheduling the resolution sweep | Yes — verified via 6 prior `CREATE EXTENSION IF NOT EXISTS pg_cron` migrations already applied to this exact prod project | Supabase-managed | If ever unavailable (e.g., a lower Supabase tier), every existing cron migration in this repo already degrades gracefully via `EXCEPTION WHEN undefined_function THEN RAISE NOTICE ...` — follow the same pattern; fallback is the Supabase Dashboard's Scheduled Functions UI (documented in `fathom-daily-reconcile`'s migration comments). |
| `pg_net` extension | HTTP call from cron to the edge function | Yes — same migrations enable it alongside `pg_cron` | Supabase-managed | N/A if using the cron→edge-function pattern; not needed at all if the matcher is implemented as a pure PL/pgSQL function instead (an available alternative, see Architecture Patterns). |
| Supabase CLI, linked to prod (`vltmrnjsubfzrgrtdqey`) | Applying migrations, regenerating types | Yes — confirmed live and in active use through Phase 30 | Current CLI per `supabase/CLAUDE.md` | — |
| TEST project (`callvault-test`, ref `swjzxiddcrtaqixsfaac`) | Integration tests (SAFE-02 noop proof, `event_match_decisions` isolation, apply/reverse RPC proof) | Yes — used throughout Phase 30, credentials fetchable via `supabase projects api-keys` per Phase 30 precedent | — | — |
| Docker | Local Supabase stack | No — confirmed not running on this machine (`supabase/CLAUDE.md`) | — | Use the TEST project (Option A), the established default path for this repo. |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None — everything this phase needs is already live in this exact project.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (repo-wide) |
| Config file | `vitest.config.ts` (repo root) |
| Quick run command | `npx vitest run supabase/functions/_shared/event-resolver.test.ts` |
| Full suite command | `npm run test` (unit) + `npm run test:integration` (integration, requires `VITEST_INTEGRATION_OK=true` and TEST project env vars per `supabase/CLAUDE.md`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MATCH-01 | `extractTier1Signal` returns the correct field per provider, `null` for providers with no eligible signal, and never uses `zoom_numeric_id` | unit | `npx vitest run supabase/functions/_shared/event-resolver.test.ts` | ❌ Wave 0 — new file, mirrors `_shared/__tests__/connector-pipeline.test.ts`'s plain-import convention |
| MATCH-01 | Two recordings sharing the same tier-1 signal produce a `merge_proposed` ledger row; two recordings with different/absent signals produce none | integration | `npm run test:integration -- event-resolution-shadow.integration.test.ts` | ❌ Wave 0 |
| MATCH-09 | `event_match_decisions` row shape contains both recording IDs, tier, score (NULL for tier-1), signals, decided_by, timestamp | integration | same file as above | ❌ Wave 0 |
| MATCH-10 | `apply_event_match_atomic` then `reverse_event_match_atomic` round-trips `recordings.event_id` correctly and both are logged in the ledger, called directly (not via the sweep) | integration | new file, e.g. `src/test/event-match-apply-reverse.integration.test.ts` | ❌ Wave 0 |
| SAFE-01 | Sweep run against an org with the flag `false` writes zero ledger rows for that org's recordings; `true` writes rows | integration | `event-resolution-shadow.integration.test.ts` | ❌ Wave 0 |
| SAFE-02 | After a full sweep run, `recordings.event_id` is NULL for every recording touched — the exact "byte-identical/noop" proof style already established in Phase 30 | integration | `event-resolution-shadow.integration.test.ts`, styled directly on `src/test/event-schema-noop.integration.test.ts` | ❌ Wave 0 (but a direct template exists) |
| (isolation) | `event_match_decisions` returns zero rows to any authenticated JWT even when service-role has seeded a row | integration (RLS) | add to `CLIENT_DENY_TABLES` in `src/test/rls-regression.test.ts` | ❌ Wave 0 — one array entry + reuse of existing loop |

### Sampling Rate
- **Per task commit:** `npx vitest run supabase/functions/_shared/event-resolver.test.ts` (fast, no DB)
- **Per wave merge:** `npm run test:integration` (hits TEST project)
- **Phase gate:** Full suite green before `/gsd:verify-work`, plus a manual confirmation that `recordings.event_id` is still NULL across prod after any TEST-then-prod migration apply (mirrors Phase 30's own verification discipline)

### Wave 0 Gaps
- [ ] `supabase/functions/_shared/event-resolver.ts` + its unit test — does not exist yet
- [ ] `src/test/event-resolution-shadow.integration.test.ts` — does not exist yet, template: `src/test/event-schema-noop.integration.test.ts`
- [ ] `src/test/event-match-apply-reverse.integration.test.ts` (or folded into the above) — does not exist yet
- [ ] `event_match_decisions` entry in `CLIENT_DENY_TABLES` (`src/test/rls-regression.test.ts`) — does not exist yet
- [ ] Migrations: `organization_feature_flags`, `event_match_decisions`, apply/reverse RPCs, cron schedule — none exist yet (this phase creates all of them)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | Yes | Every `SECURITY DEFINER` function MUST `SET search_path = public` (verified 100% consistent across `split_recording_atomic`, `route_recording_cross_org`, `user_participates_in_event`, `is_organization_member`, `claim_embedding_tasks` — zero exceptions found in this repo) — prevents search-path hijacking, the classic Postgres `SECURITY DEFINER` footgun. |
| V4 Access Control | Yes | RLS is the enforcement boundary, not application code (`supabase/CLAUDE.md`, spec's own Implementation Notes: "RLS is the boundary, not application code"). New RPCs `REVOKE EXECUTE FROM PUBLIC/anon/authenticated`; ownership/authorization checked by parameter (validated server-side against the JWT before the RPC call), never by trusting a client-supplied ID alone. |
| V5 Input Validation | Yes | JSONB `source_metadata` extraction must fail closed on malformed/missing data (see Common Pitfalls, "checkDuplicate's fail-open convention — do not copy it verbatim"). Any new HTTP-triggered edge function validates its request body with Zod, per repo convention. |
| V6 Cryptography | No | Nothing new in this phase touches encryption/secrets. |
| V2 Authentication / V3 Session Management | No | This phase adds no new authenticated user-facing endpoint; the only new HTTP surface (`resolve-events`) is cron-triggered via a shared secret header (mirroring `fathom-reconcile`'s `X-Reconcile-Secret` pattern), not a user session. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-org data exposure via a false or premature merge | Information Disclosure | This phase structurally cannot cause it — SAFE-02 means `recordings.event_id` is never written by the automatic path. The apply/reverse RPC (built, not auto-wired) inherits `events`' existing RLS (participation/ownership only, no org-admin bypass, verified in the CR-01-fixed policy). |
| `SECURITY DEFINER` privilege escalation via missing/mutable `search_path` | Elevation of Privilege | `SET search_path = public` on every new function, no exceptions — matches 100% of existing precedent. |
| Race condition producing duplicate or conflicting ledger rows | Tampering (data integrity) | `UNIQUE (recording_id_a, recording_id_b, tier)` + `EXCEPTION WHEN unique_violation`, mirroring `route_recording_cross_org`. |
| Direct RPC invocation bypassing edge-function-level checks (a client calling `apply_event_match_atomic` directly via PostgREST) | Elevation of Privilege / Spoofing | `REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC, anon, authenticated` — service role bypasses grants by design, matching `split_recording_atomic` exactly. |
| Cron-triggered edge function invoked by an unauthenticated third party | Spoofing | Shared-secret header check (`X-Reconcile-Secret`-style), mirroring `fathom-reconcile`'s existing pattern — do not leave `resolve-events` open with only CORS as a gate. |

## Sources

### Primary (HIGH confidence — direct repo reads, this session)
- `supabase/functions/_shared/canonical-recording.ts` — full read, confirmed contract shape and absence of any `runPipeline`/hook mechanism in this file
- `supabase/functions/_shared/connector-pipeline.ts` — full read of `runPipeline` (lines 572-788) and its types (lines 1-100), confirmed the true universal fan-in point
- `supabase/functions/_shared/dedup-fingerprint.ts` — full read, confirmed F4/F5 exactly as spec'd (Zoom-only, `checkMatch` "any two of three" fuzzy scoring, no tier-1 logic)
- `supabase/migrations/20260309220000_split_recording_rpc.sql` — full read, the MATCH-10 precedent
- `supabase/migrations/20260730160000_fix_cross_org_copy_dedup.sql` (lines 130-220) — the `unique_violation` idempotency idiom
- `supabase/migrations/20251128100000_embedding_queue_system.sql` — full read, claim-table + `pg_cron` precedent
- `supabase/migrations/20260512000002_fathom_daily_reconcile_cron.sql` — full read, the lighter cron precedent recommended for this phase
- `supabase/migrations/20260831000001_create_events_and_extend_participants.sql` and `20260831020000_fix_events_participation_rls_and_updated_at_trigger.sql` — full reads, current live `events`/`call_participants` schema and the CR-01 SECURITY DEFINER fix
- `supabase/migrations/20260302000000_feature_flags.sql` and `20260611000001_drop_feature_flags.sql` — full reads, confirmed the old flag system's shape and deletion reason
- `supabase/migrations/20260612120000_create_admin_audit_log.sql` — full read, the append-only ledger precedent for `event_match_decisions`
- `src/test/rls-regression.test.ts` — read `CROSS_ORG_TABLES` array and the bespoke `events` isolation block (lines 1045-1130), confirmed the structural mismatch this phase must repeat correctly for `event_match_decisions`
- `src/test/event-schema-noop.integration.test.ts` — full read, the SAFE-02 noop-proof template
- Per-connector `source_metadata` construction, read directly: `zoom-webhook/index.ts`, `zoom-sync-meetings/index.ts`, `webhook/index.ts` (Fathom), `sync-meetings/index.ts` (Fathom), `fireflies-connector.ts`, `grain-connector.ts`, `plaud-connector.ts`, `read-ai-connector.ts`, `fetch-meetings/index.ts` (the `FathomMeeting` interface), `file-upload-transcribe/index.ts`, `youtube-import/index.ts`
- `src/types/supabase.ts` — current live-generated types for `events`, `call_participants`, `organizations`, `transcript_chunks`, `import_routing_rules`, `user_settings`
- `.orca/drops/SPEC-event-resolution-and-provenance.md`, `.planning/REQUIREMENTS.md`, `.planning/phases/31-.../31-CONTEXT.md`, `.planning/STATE.md`, `supabase/SCHEMA_TRUTH.md`, `.planning/phases/30-.../30-04-SUMMARY.md` — all read in full per the task's required reading list
- `CLAUDE.md`, `supabase/CLAUDE.md` — project constraints, read in full

### Secondary (MEDIUM confidence — web search, cross-checked)
- [Supabase Queues](https://supabase.com/docs/guides/queues) and [PGMQ Extension | Supabase Docs](https://supabase.com/docs/guides/queues/pgmq) — confirmed `pgmq`-based Queues is Supabase's current platform-recommended background-job primitive; cross-checked against this repo (zero existing usage) to inform the "don't introduce it here" recommendation
- [Deploying Machine Learning Models in Shadow Mode](https://christophergs.com/machine%20learning/2019/03/30/deploying-machine-learning-applications-in-shadow-mode/), [Shadow Testing - Engineering Fundamentals Playbook (Microsoft)](https://microsoft.github.io/code-with-engineering-playbook/automated-testing/shadow-testing/) — confirmed "shadow mode" as an established, well-defined pattern (compute + log without affecting production output) matching this phase's SAFE-02 usage precisely

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; every reused pattern verified by direct file read in this exact repo
- Architecture: HIGH — hook point, execution model, and schema recommendations are all grounded in existing, proven, in-production precedents (not external best-practice guessing)
- Pitfalls: HIGH for the source_metadata survey (verified against actual connector code, not the spec's summary) and the CROSS_ORG_TABLES mismatch (verified against actual Phase 30 precedent); MEDIUM for the Read.ai `platform_id` open question (flagged, not resolved, in Open Questions/Assumptions Log)

**Research date:** 2026-09-01
**Valid until:** ~14 days, or immediately if the `v2.2-event-resolution` branch's schema changes before this phase executes (this research is tightly coupled to the live, actively-changing branch state, not a stable external library)
