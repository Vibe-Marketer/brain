# Phase 24: Sync-Status Foundation - Research

**Researched:** 2026-06-20
**Domain:** Postgres data-model + additive migrations + reconciliation on Supabase (prod ref `vltmrnjsubfzrgrtdqey`)
**Confidence:** HIGH (every claim verified against the live prod schema via read-only introspection, the actual migration SQL, and the real source files — not training data or assumptions)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None hard-locked beyond the non-negotiable constraints below — this is an auto-generated infrastructure phase, discuss was skipped.

### Claude's Discretion
All implementation choices are at Claude's discretion. Use the converged research (`ARCHITECTURE.md`, `PITFALLS.md`, `STACK.md`), ROADMAP success criteria, and codebase conventions.

### Non-negotiable constraints (from PROJECT.md + research — treat as locked)
- **Additive migrations only** against prod (ref `vltmrnjsubfzrgrtdqey`): `ADD COLUMN IF NOT EXISTS`, never mutate/retype columns in-flight jobs depend on. Run old + new consumers in parallel during cutover.
- **Dual recording-ID system:** `source_call_id` is TEXT — never `parseInt`/`Number()`/coerce. Route cross-ID work through `toRecordingUuid`/`toRecordingUuidBatch` (`src/lib/recording-ids.ts`).
- **Real-DB reconciliation test mandatory** (IMP-04) — mocked tests passed for this exact bug class in the Phase 30/BUG-01 incident, so the test MUST hit a real DB (the separate TEST project, never prod).
- Org-scoped RLS on `sync_jobs`; register in `CROSS_ORG_TABLES`; add new columns to the Realtime publication whitelist.
- `.env` (PROD) vs `.env.local`/`.env.test` (TEST) — any migration/DDL reads `.env` and must verify the prod ref before connecting.

### Deferred Ideas (OUT OF SCOPE)
None — phase scope is the data-model foundation only. UI consumption of the canonical reader lands in Phases 26–27.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IMP-01 | A single canonical, provider-agnostic "is this call synced?" reader on `recordings.(source_app, source_call_id)` (TEXT, no numeric coercion) — replacing the Fathom-only `fathom_calls`/`parseInt` path | Exact signature, location, single call site, and `checkDuplicate` canonical pattern documented below. `recordings.source_app` (TEXT) and `recordings.source_call_id` (TEXT) **confirmed present in prod**. |
| IMP-02 | Org-scoped unique constraint `(organization_id, source_app, source_call_id)` so the same provider call can never be double-imported | **Constraint `recordings_source_dedup UNIQUE (organization_id, source_app, source_call_id)` ALREADY EXISTS in prod.** Zero blocking duplicates. The real IMP-02 work is *verify + lock-in* (a regression test) plus closing the NULL-`source_call_id` gap (184 rows escape the constraint). See IMP-02 section. |
| IMP-03 | Additive `sync_jobs` migration: `source_app`, org/workspace, `mode`, date range, `provider_cursor`, + org-scoped RLS + `CROSS_ORG_TABLES` + Realtime whitelist | Exact missing-column list confirmed against live prod. `sync_jobs` already in `supabase_realtime` publication with **ALL columns** (new columns auto-included). RLS + `CROSS_ORG_TABLES` shape documented. |
| IMP-04 | Reconciliation of legacy `fathom_calls` into `recordings` status truth, verified by a real-DB test | `fathom_calls.canonical_recording_id` (UUID) bridge confirmed. **60 truly-orphan `fathom_calls` rows** identified (no match by `fathom_provider_id` AND no valid `canonical_recording_id`). Reconciliation strategy + real-DB test wiring documented. |
</phase_requirements>

## Summary

This is a backend data-model/migration phase with **no UI**. The converged planning research (`ARCHITECTURE.md`, `PITFALLS.md`, `STACK.md`) is accurate on direction but was written before live-schema introspection. Reading the actual prod schema (read-only, prod-ref-guarded) changes the *amount of work* in two of the four requirements materially:

1. **IMP-02 is mostly already done.** The org-scoped unique constraint `recordings_source_dedup UNIQUE (organization_id, source_app, source_call_id)` was created in migration `20260303000004` and **is live in prod right now** with **zero duplicate rows blocking it**. Phase 24's IMP-02 work is therefore *not* "create the constraint" — it's (a) prove it exists and stays (a CI regression test), and (b) decide what to do about the **184 recordings with NULL `source_call_id`** that silently escape the constraint (Postgres treats NULLs as distinct).
2. **IMP-01 is a small, surgical change** — exactly one call site (`useSyncTabStateBridge.ts:45`) consumes the broken `checkSyncedRecordingIds`. The canonical pattern already exists in `connector-pipeline.ts:checkDuplicate`. The new reader generalizes it.
3. **IMP-03 is a clean additive migration** — `sync_jobs` is missing 8 columns; `error` (not `error_message`) and `skipped_count` already exist; the arrays are already TEXT[]. `sync_jobs` is already in the Realtime publication with all columns, so new columns are auto-whitelisted (no publication edit needed — but verify in the migration).
4. **IMP-04 is the real research payoff** — there are **60 truly-orphan `fathom_calls`** rows. The reconciliation must backfill these into `recordings` (or explicitly classify them as un-reconcilable) so the new canonical reader doesn't under-report. Verified by a real-DB integration test against the TEST project.

**Primary recommendation:** Treat Phase 24 as four small, independently-verifiable deliverables — (1) `getSyncStatusForExternalIds` + migrate the one call site, (2) a constraint-existence regression test + NULL-`source_call_id` backfill, (3) the additive `sync_jobs` column migration + RLS + `CROSS_ORG_TABLES` + Realtime verification, (4) the `fathom_calls→recordings` orphan reconciliation backfill + mandatory real-DB test. Do NOT add new packages, new tables, or new vendors. Everything is plain SQL + one new service function + one new migration + tests.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Canonical "is synced?" read (IMP-01) | API/Service layer (`src/services/*.service.ts`, pure async fn) | Database (`recordings` query) | The reader is a pure query function; the answer lives in `recordings`. No React, no UI. |
| Idempotency unique constraint (IMP-02) | Database (declared constraint on `recordings`) | — | Idempotency is a *declared DB invariant*, not app logic. Already enforced at the DB. |
| `sync_jobs` schema extension (IMP-03) | Database (additive migration) | API (Edge Functions read/write these columns in later phases) | Schema is the contract every later v2.1 phase reads/writes; it belongs at the DB tier. |
| RLS + cross-org isolation (IMP-03) | Database (RLS policies) | Test harness (`CROSS_ORG_TABLES` CI gate) | Isolation is enforced by RLS; the regression suite proves it. |
| Realtime column whitelist (IMP-03) | Database (publication `supabase_realtime`) | — | Realtime is a Postgres logical-replication publication; managed at the DB. |
| Legacy→canonical reconciliation (IMP-04) | Database (backfill migration / RPC) | Test harness (real-DB integration test) | Reconciliation is a data migration; correctness proven against a real DB. |

## Standard Stack

**No new packages.** This phase is plain SQL migrations + one TypeScript service function + Vitest integration tests. Everything below is already in `package.json` and already in production in this repo.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | 2.x (installed) | Service-layer queries; integration-test service-role client | Already the data-access standard in this repo `[VERIFIED: package.json + src/integrations/supabase/client]` |
| PostgreSQL DDL | 15.x (Supabase prod) | Additive migrations (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, RLS policies) | The only correct place for schema/idempotency invariants `[CITED: supabase/CLAUDE.md migration conventions]` |
| Vitest | 4.x (installed) | Real-DB integration tests (`*.integration.test.ts`) | The project's integration-test framework with the prod-guard already wired `[VERIFIED: package.json scripts + src/test/integration-setup.ts]` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `src/lib/recording-ids.ts` (`toRecordingUuid`/`toRecordingUuidBatch`) | in-repo | Cross-ID translation (UUID ↔ BIGINT) | Any time IMP-04 reconciliation crosses `fathom_provider_id` (BIGINT) → `recordings.id` (UUID) `[VERIFIED: read the file]` |
| `dotenv` | installed | Loads `.env.test` then `.env` in integration-setup | Already wired; do not change the load order `[VERIFIED: src/test/integration-setup.ts:8-11]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reusing/extending `recordings_source_dedup` constraint | Dropping + recreating it | **Reject.** It already exists, is non-destructive, and recreating risks an outage. Additive-only discipline forbids it. |
| Plain `.insert()` + pre-check (current `connector-pipeline`) | `INSERT ... ON CONFLICT (...) DO NOTHING` | The idempotent-insert upgrade is a SYNC-phase (28) concern, NOT Phase 24. Phase 24 only needs the constraint to *exist*. Note it for later. |

**Installation:** None. No `npm install`. No new extensions (pg_cron/pg_net already enabled; not needed in this phase).

## Package Legitimacy Audit

> Not applicable — this phase installs **zero** external packages. It is plain SQL migrations + one in-repo service function + Vitest tests using already-installed dependencies. No slopcheck run needed (nothing to check). If the planner later decides to add a package, gate it behind `checkpoint:human-verify` and run the Package Legitimacy Gate.

## Architecture Patterns

### System Architecture Diagram

```
                         IMP-01 read path (the fix)
   caller (useSyncTabStateBridge.checkSyncStatus, future <ImportSurface>)
        │  externalIds: string[]  (TEXT — never parseInt)
        ▼
   getSyncStatusForExternalIds(sourceApp, externalIds[])   ← NEW canonical reader
        │   SELECT id, source_call_id FROM recordings
        │     WHERE owner_user_id = ? AND source_app = ? AND source_call_id IN (TEXT[])
        │   + batched workspace_entries existence check (mirrors checkDuplicate)
        ▼
   recordings.(source_app TEXT, source_call_id TEXT)   ← single source of truth
        ▲                                   ▲
        │ IMP-02 enforces                   │ IMP-04 reconciles legacy rows INTO here
        │ UNIQUE(organization_id,           │
        │   source_app, source_call_id)     │
   recordings_source_dedup (ALREADY LIVE)   fathom_calls.canonical_recording_id (UUID bridge)
                                            │  60 truly-orphan rows → backfill target

                         IMP-03 ledger extension (additive)
   sync_jobs (EXISTS) ──► ADD COLUMN IF NOT EXISTS:
     source_app, organization_id, workspace_id, source_id,
     mode, date_start, date_end, provider_cursor, last_heartbeat_at
   ──► org-scoped RLS policy (alongside existing user_id policy)
   ──► register {table:"sync_jobs", filterColumn:"organization_id"} in CROSS_ORG_TABLES
   ──► already in supabase_realtime publication (ALL columns → new cols auto-included; verify)
```

### Recommended Project Structure (files this phase touches/creates)
```
src/
├── services/
│   ├── sync-tab.service.ts          # MODIFY: delete checkSyncedRecordingIds (keep fetchSyncedCalls)
│   └── sync-status.service.ts       # NEW: getSyncStatusForExternalIds (canonical reader)
├── hooks/
│   └── useSyncTabStateBridge.ts     # MODIFY: line 45 call site → new reader
└── test/
    ├── rls-regression.test.ts       # MODIFY: add sync_jobs to CROSS_ORG_TABLES
    └── migrations/
        └── phase24-sync-status-foundation.integration.test.ts  # NEW: IMP-02 constraint + IMP-04 reconciliation (real DB)
supabase/
└── migrations/
    └── YYYYMMDDHHMMSS_sync_jobs_durable_resource.sql   # NEW: additive sync_jobs columns + RLS + realtime verify
    └── YYYYMMDDHHMMSS_reconcile_orphan_fathom_calls.sql # NEW (or RPC): IMP-04 backfill of 60 orphans
```

### Pattern 1: Canonical-read, source-detail-write
**What:** Status is read from one canonical table (`recordings`); provider-specific tables (`fathom_calls`) are write-only detail stores never consulted for status.
**When to use:** IMP-01. The new `getSyncStatusForExternalIds` reads `recordings` only; `fathom_calls` is demoted to source-detail.
**Example (the proven canonical pattern to generalize):**
```ts
// Source: supabase/functions/_shared/connector-pipeline.ts:91-136 (checkDuplicate)
// VERIFIED: read the file. This is the contract the new reader generalizes.
const { data } = await supabase
  .from('recordings')
  .select('id')
  .eq('owner_user_id', userId)
  .eq('source_app', sourceApp)
  .eq('source_call_id', externalId)   // externalId is a STRING — never coerced
  .maybeSingle();
// then a workspace_entries existence check so "removed from all workspaces → re-importable"
```
**Note on scoping:** `checkDuplicate` is `owner_user_id`-scoped. `fetchSyncedCalls` (sync-tab.service.ts:62) is `owner_user_id`-scoped with an optional `organization_id` filter. The new reader should accept org scope to honor the org-scoped-truth principle, but match `checkDuplicate`'s `owner_user_id` filter for parity with the dedup path. **This scoping choice is a real decision — see Open Questions Q1.**

### Pattern 2: Additive-only schema evolution
**What:** `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`; never rename/retype a column in-flight jobs depend on; expand status enums (treat unknown as non-terminal).
**When to use:** IMP-03. The existing `recording_ids`/`synced_ids`/`failed_ids` are already TEXT[] — do NOT touch them.
**Example:**
```sql
-- Source: existing pattern in 20251124010359_add_sync_jobs_progress_columns.sql (VERIFIED)
ALTER TABLE public.sync_jobs
  ADD COLUMN IF NOT EXISTS source_app      TEXT,
  ADD COLUMN IF NOT EXISTS organization_id UUID,
  ADD COLUMN IF NOT EXISTS workspace_id    UUID,
  ADD COLUMN IF NOT EXISTS source_id       UUID,
  ADD COLUMN IF NOT EXISTS mode            TEXT DEFAULT 'selected',
  ADD COLUMN IF NOT EXISTS date_start      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS date_end        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provider_cursor TEXT,
  ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ;
```

### Anti-Patterns to Avoid
- **`parseInt`/`Number()` on `source_call_id`:** This is the exact `checkSyncedRecordingIds` bug (sync-tab.service.ts:595-598) that drops every UUID-id provider (Zoom, Fireflies, Grain, Read.ai, file-upload). `source_call_id` is TEXT. Keep it TEXT end-to-end. `[VERIFIED: read sync-tab.service.ts:588-613]`
- **Recreating `recordings_source_dedup`:** It already exists. Dropping/recreating violates additive-only and risks an outage.
- **Editing the Realtime publication to add columns:** Unnecessary — the publication tracks `sync_jobs` with ALL columns (`prattrs IS NULL`), so new columns are automatically replicated. **Verify** this in the migration with an assertion query; do not blindly `ALTER PUBLICATION ... ADD TABLE` (it's already there and would error). `[VERIFIED: pg_publication_rel introspection]`
- **Mocked reconciliation test:** Phase 30/BUG-01 proved a mocked test passes for this exact UUID/BIGINT bug class. IMP-04's test MUST hit the real TEST DB.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-ID translation (BIGINT `fathom_provider_id` ↔ UUID `recordings.id`) in reconciliation | A new inline `parseInt`/lookup | `toRecordingUuidBatch()` from `src/lib/recording-ids.ts` | Passing a BIGINT where UUID is expected throws `invalid input syntax for type uuid`. The canonical boundary already handles mixed inputs. `[VERIFIED: read recording-ids.ts]` |
| Idempotency / dedup | App-side read-then-write race | The existing DB constraint `recordings_source_dedup` | It's already declared and live; a declared constraint beats emergent app logic. `[VERIFIED: pg_constraint]` |
| Integration-test prod safety | A new env-guard | `integrationDbReachable` + `makeIntegrationClient()` from `src/test/integration-setup.ts` | The triple-layered prod guard already exists and threw fatally on the 2026-05 incident config. `[VERIFIED: read integration-setup.ts]` |
| "Is this synced?" canonical query | A new query shape | Generalize `connector-pipeline.ts:checkDuplicate` | Battle-tested, fail-open, handles the re-importable case. `[VERIFIED]` |

**Key insight:** Almost everything Phase 24 needs already exists in the repo or the live DB. The work is *connecting and verifying*, not building.

## Runtime State Inventory

> This is a data-model phase that touches stored data and a live publication. Inventory completed against live prod (read-only).

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | (1) `recordings`: 2,759 rows across 9 `source_app` values (fathom 2186, plaud 472, loom 59, fireflies 14, read-ai 11, youtube 8, zoom 4, fathom-paste 3, file-upload 2). (2) **184 `recordings` rows with NULL `source_call_id`** (182 fathom + 2 fathom-paste) — these evade `recordings_source_dedup` (Postgres NULLs are distinct). (3) `fathom_calls`: 2,094 rows; 2,017 have a valid `canonical_recording_id`, **60 are truly orphan** (no `recordings` match by `fathom_provider_id` AND no valid `canonical_recording_id`). | IMP-02: decide NULL-`source_call_id` handling (backfill from `fathom_provider_id`/metadata, or accept as a known gap). IMP-04: backfill/classify the 60 orphans (data migration). |
| **Live service config** | `supabase_realtime` publication: `sync_jobs` is a member with **ALL columns** replicated (`puballtables=false` overall, but the `sync_jobs` table entry has `prattrs IS NULL`). `recordings` is NOT in the publication. | IMP-03: **no publication edit needed** for the new `sync_jobs` columns (auto-included). Verify with an assertion query; do NOT re-add the table. |
| **OS-registered state** | None — no Task Scheduler / launchd / cron registrations carry these identifiers. (pg_cron jobs exist in DB but are not part of Phase 24 scope.) | None. |
| **Secrets/env vars** | `.env` holds prod `DATABASE_URL` (ref `vltmrnjsubfzrgrtdqey`); `.env.test` holds the separate TEST project creds. No secret *renames* in this phase. | None — but every migration/DDL run must verify the prod ref before connecting (the gsd-runner already does). The integration test must use TEST creds only. |
| **Build artifacts / installed packages** | None — no compiled artifacts or installed packages carry these identifiers. | None. |

**The canonical question — "after every file in the repo is updated, what runtime systems still have stale state?"** Answer: the 60 orphan `fathom_calls` rows and the 184 NULL-`source_call_id` `recordings` rows are *data* state that a code change alone does NOT fix — they require the IMP-04 backfill (orphans) and an IMP-02 decision (NULLs). Both are explicit tasks, not emergent.

## Common Pitfalls

### Pitfall 1: Believing IMP-02 still needs the constraint created
**What goes wrong:** Planner writes a task to `ADD CONSTRAINT recordings_source_dedup ...`; it fails with "constraint already exists" or, worse, someone drops-and-recreates it and causes a write outage.
**Why it happens:** The converged `ARCHITECTURE.md` (line 27 of PITFALLS) was written before live introspection and frames IMP-02 as net-new.
**How to avoid:** The constraint is LIVE. IMP-02's task is a **CI regression test** asserting the constraint exists (query `pg_constraint`) + closing the NULL-`source_call_id` gap. Verify, don't recreate.
**Warning signs:** A migration in the plan containing `ADD CONSTRAINT recordings_source_dedup`.

### Pitfall 2: NULL `source_call_id` silently defeats the unique constraint
**What goes wrong:** 184 `recordings` rows have NULL `source_call_id`. Postgres treats NULLs as distinct in a UNIQUE constraint, so two NULL-`source_call_id` rows for the same call never collide — duplicates can slip through for legacy/paste rows.
**Why it happens:** Old Fathom imports predate the `source_call_id` column; paste imports may not set it.
**How to avoid:** Backfill `source_call_id` from `fathom_provider_id::text` (for fathom rows) or the metadata `external_id` where derivable; for genuinely-unkeyable rows, document them as a known, bounded gap (they cannot be double-imported via the connector path because they have no provider id to re-fetch). A `UNIQUE NULLS NOT DISTINCT` upgrade is Postgres 15+ but is a **destructive constraint change** — defer it (out of additive-only scope).
**Warning signs:** New duplicate `recordings` rows appearing only for fathom/paste with NULL `source_call_id`.

### Pitfall 3: Reconciling orphans by the wrong key
**What goes wrong:** Joining `fathom_calls.recording_id` (BIGINT) directly against `recordings.id` (UUID) throws `invalid input syntax for type uuid`, or matching only by one of the two bridge paths under-counts.
**Why it happens:** Two bridge paths exist: `fathom_calls.recording_id` (BIGINT) → `recordings.fathom_provider_id` (BIGINT), AND `fathom_calls.canonical_recording_id` (UUID) → `recordings.id` (UUID). The 60 orphans fail BOTH.
**How to avoid:** Reconciliation must check both paths (the introspection query already does). Route any BIGINT→UUID crossing through `toRecordingUuidBatch`. For the 60 true orphans, either (a) create the missing `recordings` rows from `fathom_calls` detail, or (b) classify them as un-reconcilable (e.g., calls deleted from `recordings` deliberately) and exclude — a product decision (Open Questions Q3).
**Warning signs:** `invalid input syntax for type uuid: "143800259"` in logs.

### Pitfall 4: `error` vs `error_message` column-name confusion
**What goes wrong:** Code/migrations reference `sync_jobs.error_message`, but the live column is `error` (TEXT). `ARCHITECTURE.md` line 112 and PITFALLS reference `error_message`; `sync-tab.service.ts:cancelSyncJob` writes `error_message` too.
**Why it happens:** The research docs and some code assumed `error_message`; prod has `error`.
**How to avoid:** **The live column is `error`.** `[VERIFIED: information_schema.columns]` Either standardize on `error` (no migration) or add `error_message` additively if a consumer truly needs it — but check `cancelSyncJob` (sync-tab.service.ts:258-269) which currently writes a non-existent `error_message` (likely silently dropped by PostgREST or erroring). **Flag this as a latent bug to confirm during planning.**
**Warning signs:** `cancelSyncJob` writing `error_message`; PostgREST "column does not exist" errors.

### Pitfall 5: Migrating the `sync_jobs` consumer mid-flight
**What goes wrong:** In-flight jobs created by old code become unreadable by new code (or vice versa) during cutover.
**Why it happens:** `sync_jobs` is a shared contract between two repos (this one + `~/dev/autopilot`).
**How to avoid:** Additive columns only (all the new IMP-03 columns are nullable/defaulted). Backfill existing rows `mode='selected'`, `source_app='fathom'` (every prior job was Fathom selected-import). Never retype `recording_ids` (already TEXT[] — leave it). `[VERIFIED: arrays are _text in prod]`

## Code Examples

### IMP-01 — the new canonical reader (proposed signature)
```ts
// src/services/sync-status.service.ts (NEW)
// Source signature derived from ARCHITECTURE.md:95 + checkDuplicate (connector-pipeline.ts:91)
// VERIFIED: recordings.source_app + source_call_id are both TEXT in prod.
import { supabase } from "@/integrations/supabase/client";
import { getSafeUser } from "@/lib/auth-utils";

export type SyncStatus = { recordingUuid: string; hasWorkspaceEntries: boolean };

export async function getSyncStatusForExternalIds(
  sourceApp: string,
  externalIds: string[],            // STRINGS — never parseInt; works for BIGINT-as-string AND UUID providers
  opts?: { organizationId?: string | null },
): Promise<Map<string, SyncStatus>> {
  const result = new Map<string, SyncStatus>();
  if (externalIds.length === 0) return result;
  const { user, error } = await getSafeUser();
  if (error || !user) return result;

  let q = supabase
    .from("recordings")
    .select("id, source_call_id")
    .eq("owner_user_id", user.id)
    .eq("source_app", sourceApp)
    .in("source_call_id", externalIds);     // TEXT IN — no coercion
  if (opts?.organizationId) q = q.eq("organization_id", opts.organizationId);

  const { data } = await q;
  if (!data?.length) return result;

  // Batched workspace_entries existence check (mirror checkDuplicate's re-importable semantics)
  const ids = data.map((r) => r.id);
  const { data: entries } = await supabase
    .from("workspace_entries").select("recording_id").in("recording_id", ids);
  const withEntries = new Set((entries ?? []).map((e) => e.recording_id));

  for (const r of data) {
    if (r.source_call_id != null) {
      result.set(r.source_call_id, {
        recordingUuid: r.id,
        hasWorkspaceEntries: withEntries.has(r.id),
      });
    }
  }
  return result;
}
```

### IMP-01 — migrating the single call site
```ts
// src/hooks/useSyncTabStateBridge.ts:44-49 (MODIFY — the ONLY call site)
// Was: const syncedIds = await checkSyncedRecordingIds(recordingIds);  // Fathom-only parseInt set
const statusMap = await getSyncStatusForExternalIds(sourceApp, recordingIds); // needs sourceApp threaded in
setMeetingsRef.current?.((prev) =>
  prev.map((m) => ({ ...m, synced: statusMap.has(m.recording_id) })),
);
// NOTE: this call site currently has no sourceApp in scope — it must be threaded
// from useSyncTabOrchestration. Flag as a small wiring task. (Open Questions Q2)
```

### IMP-02 — constraint-existence regression assertion (real-DB test)
```ts
// In phase24 integration test (TEST project, service-role)
const { data } = await supabase.rpc('exec_sql', { /* or a pg_constraint select via a helper */ });
// Simplest: query pg_constraint through an existing smoke RPC pattern (see rpc-type-smoke.test.ts).
// Assert: recordings_source_dedup exists with def 'UNIQUE (organization_id, source_app, source_call_id)'.
```

### IMP-03 — Realtime publication assertion (verify, don't re-add)
```sql
-- Include as a guard in the migration or test. VERIFIED shape against prod.
-- sync_jobs is already in supabase_realtime with ALL columns (prattrs IS NULL).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='sync_jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_jobs;
  END IF;
END $$;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `checkSyncedRecordingIds` reads `fathom_calls` with `parseInt(externalId)` | `getSyncStatusForExternalIds` reads `recordings.source_call_id` (TEXT) | This phase (IMP-01) | Fixes the Zoom/Fireflies/Grain/Read.ai/file-upload "invisible/duplicate" bug |
| Idempotency as emergent `checkDuplicate` read-then-write | Declared DB constraint `recordings_source_dedup` | Already shipped `20260303000004` | Constraint exists; IMP-02 verifies + closes NULL gap |
| `sync_jobs` as selected-import ledger only | Provider-agnostic durable resource (org/workspace scope, mode, cursor, heartbeat) | This phase (IMP-03) | Enables resumable sync-all (Phase 28) + observable jobs (Phase 27) |

**Deprecated/outdated:**
- `checkSyncedRecordingIds` (sync-tab.service.ts:588) — delete after migrating the one call site.
- The research-doc references to `sync_jobs.error_message` — the live column is `error`. Treat `error_message` as the outdated name.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The 60 truly-orphan `fathom_calls` should be backfilled INTO `recordings` (vs. classified as deliberately-deleted and excluded) | IMP-04 / Pitfall 3 | Backfilling resurrects calls a user deleted; excluding leaves them invisible. Product decision — see Q3. |
| A2 | NULL-`source_call_id` rows (184) can be safely backfilled from `fathom_provider_id::text` for fathom rows | IMP-02 / Pitfall 2 | If a fathom row's `fathom_provider_id` is also null, the backfill leaves a residual gap (bounded, documented). |
| A3 | The new reader should be `owner_user_id`-scoped (parity with `checkDuplicate`) with optional org filter | IMP-01 / Q1 | Wrong scope causes either cross-user miscounts (too broad) or teammate-import duplicates (too narrow). |
| A4 | `cancelSyncJob` writing `error_message` to a table whose column is `error` is a latent bug | Pitfall 4 | If PostgREST silently drops it, cancellations record no reason; confirm during planning. |

## Open Questions

1. **Reader scope: `owner_user_id` vs `organization_id`?**
   - What we know: `checkDuplicate` and `fetchSyncedCalls` are `owner_user_id`-scoped (with optional org filter). `recordings_source_dedup` is org-scoped. PITFALLS warns a user-scoped synced-signal causes teammate-import duplicates.
   - What's unclear: whether IMP-01 must be org-scoped to match the constraint, or user-scoped to match existing readers.
   - Recommendation: accept BOTH — scope by `owner_user_id` for parity with the dedup path but expose an optional `organizationId` filter; default the SyncTab call to org scope to prevent teammate dup. Confirm with the planner.

2. **Threading `sourceApp` into the call site.**
   - What we know: `useSyncTabStateBridge.checkSyncStatus(recordingIds)` has no `sourceApp` in scope today (the old reader was Fathom-only).
   - What's unclear: the cleanest place to thread `sourceApp` from `useSyncTabOrchestration`.
   - Recommendation: small wiring task — pass `sourceApp` through `checkSyncStatus`. Trivial; flag in the plan.

3. **What to do with the 60 truly-orphan `fathom_calls`.**
   - What we know: they have no `recordings` match by either bridge path.
   - What's unclear: are they deliberately-deleted calls or genuine data loss?
   - Recommendation: backfill into `recordings` (preserves the "unified vault" truth) UNLESS the user confirms they were intentionally removed. Make the reconciliation backfill idempotent and reversible. Decide before flipping the read.

4. **`cancelSyncJob` `error_message` write — bug or dropped?**
   - What we know: live column is `error`, not `error_message`.
   - Recommendation: confirm behavior during planning; if it's a silent no-op, fix to write `error` (tiny additive fix, in-scope as a correctness clean-up since the phase touches `sync_jobs`).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL (Supabase prod) | All migrations | ✓ | 15.x | — (prod-ref-guarded runner `~/dev/autopilot/src/gsd-runner.ts`) |
| `pg` node module | Read-only introspection (this research) | ✓ | installed | — |
| `@supabase/supabase-js` | Service fn + integration tests | ✓ | 2.x | — |
| Vitest | Integration test (IMP-04) | ✓ | 4.x | — |
| **Separate Supabase TEST project** | IMP-04 real-DB test | ✗ (must be configured) | — | `describe.skipIf(!integrationDbReachable)` cleanly skips if `.env.test` unset; **test cannot run/verify without it** |
| Docker (local Supabase) | Optional TEST stack | ✗ (not running on this machine) | — | Use free-tier TEST project (Option A in supabase/CLAUDE.md) |

**Missing dependencies with no fallback:**
- The IMP-04 real-DB test is **mandatory** but requires `.env.test` pointing at a real, separate TEST project with this repo's migrations applied. If not configured, the test skips silently — which would let IMP-04 "pass" without verification. **The planner must add a task to confirm `integrationDbReachable === true` before claiming IMP-04 verified**, and run `npm run test:integration` (not `npm run test`, which excludes integration tests).

**Missing dependencies with fallback:**
- Docker is absent → use the free-tier TEST-project path (already the project default per supabase/CLAUDE.md).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `vitest.config.ts` (integration tests excluded unless `VITEST_INTEGRATION_OK=true`) |
| Quick run command | `npm run test` (unit only — integration excluded by config) |
| Full suite command | `npm run test:integration` (sets `VITEST_INTEGRATION_OK=true`, globs `src/**/*.integration.test.ts` + edge `__tests__`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IMP-01 | `getSyncStatusForExternalIds` returns synced=true for a Zoom (UUID), a Fathom (BIGINT-string), and a paste recording from ONE query; never coerces | integration (real DB) | `npm run test:integration -- phase24-sync-status-foundation` | ❌ Wave 0 |
| IMP-01 | unit: no `parseInt`/`Number(` on any id in the new reader | unit (grep/AST) | `npm run test` + a lint assertion | ❌ Wave 0 |
| IMP-02 | `recordings_source_dedup` constraint exists with the exact org-scoped definition | integration (real DB) | `npm run test:integration -- phase24-sync-status-foundation` | ❌ Wave 0 |
| IMP-02 | two concurrent inserts of the same `(org, source_app, source_call_id)` yield ONE row (constraint blocks the 2nd) | integration (real DB) | same | ❌ Wave 0 |
| IMP-03 | new `sync_jobs` columns exist, nullable/defaulted; `recording_ids` still TEXT[]; org-scoped RLS present; `sync_jobs` in `supabase_realtime` | integration (real DB) | same | ❌ Wave 0 |
| IMP-03 | RLS: another org's `sync_jobs` rows return 0 from a user JWT | integration (CI gate) | `npx vitest run src/test/rls-regression.test.ts` (after adding `sync_jobs` to `CROSS_ORG_TABLES`) | ✅ extend existing |
| IMP-04 | seed a Fathom + Zoom + paste recording → all report synced=true; seed an orphan `fathom_calls` → reconciliation backfills it; re-running is idempotent | integration (real DB) | `npm run test:integration -- phase24-sync-status-foundation` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test` (unit) + `tsc -p tsconfig.app.json` (root tsconfig is hollow — see MEMORY: "brain type-check is hollow")
- **Per wave merge:** `npm run test:integration` (requires `.env.test`) + `npx vitest run src/test/rls-regression.test.ts`
- **Phase gate:** full integration suite green + RLS regression green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/test/migrations/phase24-sync-status-foundation.integration.test.ts` — covers IMP-01, IMP-02, IMP-03, IMP-04 against the real TEST DB (model on `phase39-fathom-reconcile-cron.integration.test.ts`: donor-user pattern, `randomUUID` seeds, `afterAll` cleanup wrapped in try/catch)
- [ ] Add `{ table: "sync_jobs", filterColumn: "organization_id" }` to `CROSS_ORG_TABLES` in `src/test/rls-regression.test.ts` (covers IMP-03 RLS)
- [ ] Confirm `.env.test` configured (`integrationDbReachable === true`) — without it the IMP-04 test skips and CANNOT verify
- [ ] `src/services/__tests__/sync-status.service.test.ts` — unit test asserting no numeric coercion (mock-free, pure logic)

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth changes in this phase |
| V3 Session Management | no | — |
| V4 Access Control | **yes** | Org-scoped RLS on `sync_jobs` + `CROSS_ORG_TABLES` CI gate. New columns must NOT widen access; the org-scoped policy is additive alongside the existing `user_id` policy. `[CITED: supabase/CLAUDE.md RLS regression]` |
| V5 Input Validation | partial | The reader takes `externalIds: string[]` — keep as TEXT, no coercion. Supabase parameterizes the `.in()` query (no SQL injection). |
| V6 Cryptography | no | No crypto in this phase |

### Known Threat Patterns for {Postgres RLS + multi-org SaaS}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-org leak of one customer's import/job activity via new `sync_jobs` columns | Information Disclosure | Org-scoped RLS policy + register `sync_jobs` in `CROSS_ORG_TABLES` (CI gate fails the build on a leak) `[VERIFIED: rls-regression.test.ts shape]` |
| Natural-key scoped by `user_id` not `organization_id` → teammate's import re-imported as new | Tampering / data integrity | The constraint is ALREADY org-scoped `(organization_id, source_app, source_call_id)` `[VERIFIED: pg_constraint]` |
| Realtime DELETE events bypass RLS + can't be filtered | Information Disclosure | Don't rely on DELETE events for the synced-signal; INSERT/UPDATE only (relevant to later phases, noted for the contract) `[CITED: Supabase Realtime docs via PITFALLS]` |
| SQL injection via external ids | Tampering | Supabase `.in()` is parameterized; never string-interpolate ids `[CITED: supabase/CLAUDE.md OWASP §1]` |

## Sources

### Primary (HIGH confidence — verified this session)
- **Live prod schema introspection** (read-only, prod-ref-guarded via `pg` + `DATABASE_URL`): `sync_jobs` columns, `recordings` constraints (`recordings_source_dedup` confirmed live), `fathom_calls`/`fathom_raw_calls` bridge columns, duplicate-row check (0), orphan count (60), NULL-`source_call_id` count (184), `supabase_realtime` publication membership + column list, `sync_jobs` RLS policies.
- `supabase/migrations/20260303000004_add_source_call_id.sql` — the constraint + `source_call_id` column origin
- `supabase/migrations/20251124010359_add_sync_jobs_progress_columns.sql` + `20260410180000_sync_jobs_text_arrays.sql` — sync_jobs progress columns + TEXT[] conversion
- `supabase/migrations/00000000000000_consolidated_schema.sql:173,645` — base `sync_jobs` table + RLS policies
- `supabase/migrations/20260131000007_create_recordings_tables.sql` + `20260301000001_rename_vaults_to_workspaces.sql:30` — recordings origin + `bank_id→organization_id` rename
- `src/services/sync-tab.service.ts:62,258,588` — `fetchSyncedCalls` (keeper), `cancelSyncJob` (`error_message` bug), `checkSyncedRecordingIds` (to delete)
- `src/hooks/useSyncTabStateBridge.ts:45` — the single call site
- `supabase/functions/_shared/connector-pipeline.ts:91-136,212-282` — `checkDuplicate` canonical pattern + `insertRecording` (naive insert, no ON CONFLICT)
- `src/lib/recording-ids.ts` — `toRecordingUuid`/`toRecordingUuidBatch`
- `src/test/integration-setup.ts` + `src/test/rls-regression.test.ts:40-75` + `src/test/migrations/phase39-fathom-reconcile-cron.integration.test.ts` — test harness, CROSS_ORG_TABLES, real-DB test template
- `supabase/CLAUDE.md` — integration-test safety, migration conventions, RLS regression gate
- `.planning/research/{ARCHITECTURE,PITFALLS,STACK}.md` + `.planning/STATE.md` — converged direction (cross-checked against live schema)

### Secondary (MEDIUM confidence)
- Supabase Edge/Realtime/pgmq facts cited in STACK.md/PITFALLS.md (official docs, verified 2026-06-18 by prior research; not re-verified this session — not load-bearing for Phase 24's DB-only scope)

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; everything verified present in package.json + prod
- Schema/constraints (IMP-02, IMP-03): HIGH — read live prod via introspection, not migrations alone
- Reconciliation (IMP-04): HIGH on the data facts (60 orphans, bridge columns), MEDIUM on the product decision (backfill vs exclude — Q3)
- Pitfalls: HIGH — every pitfall grounded in a verified live-schema or source fact

**Research date:** 2026-06-20
**Valid until:** 2026-07-20 (stable schema; re-introspect if any migration touches `recordings`, `sync_jobs`, or `fathom_calls` before planning)
