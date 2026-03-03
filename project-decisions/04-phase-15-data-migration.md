# Phase 15: Data Migration

**Type:** Data migration + frontend wiring

**Goal:** Run the existing migration infrastructure to completion, wire the v2 frontend to show real call history, archive fathom_calls (rename, not drop), and verify RLS isolation with real JWTs.

---

## Pre-Existing Infrastructure

The following already exists in Supabase (built during v1):
- `recordings` table
- `vault_entries` table
- `migrate_fathom_call_to_recording()` function
- `migrate_batch_fathom_calls()` function
- `get_migration_progress()` function
- `migrate-recordings` edge function

**Important:** `get_unified_recordings` RPC referenced in ROADMAP does NOT exist in production. Query the `recordings` table directly.

---

## Plan 01 — Profile, Fix Migration Function, Run Batch

### Profile the Current State

- [ ] Run `get_migration_progress()` to determine how many fathom_calls are already migrated vs remaining
- [ ] Identify any orphaned records (deleted fathom_calls that were already migrated, YouTube imports, etc.)
- [ ] Establish canonical completion metric: `unmigrated_non_orphans = 0` (not the percentage, which can exceed 100% due to orphans)

### Fix Two Gaps in the Existing Migration Function

- [ ] Add `COALESCE` for NULL title fields — without this, the NOT NULL constraint on `recordings.title` will cause failures
- [ ] Add `external_id` to `source_metadata` during migration — without this, Phase 17's dedup pipeline (`checkDuplicate` by external_id) won't work for migrated records

### Backfill external_id on Already-Migrated Records

- [ ] Run UPDATE on all recordings where `source_metadata->>'external_id' IS NULL AND legacy_recording_id IS NOT NULL`
- [ ] Set `source_metadata = source_metadata || jsonb_build_object('external_id', legacy_recording_id::TEXT)`

### Run the Migration Batch

- [ ] Use psql directly: `PGHOST=aws-1-us-east-1.pooler.supabase.com PGUSER=postgres.vltmrnjsubfzrgrtdqey psql`
- [ ] Decide whether to disable Fathom sync functions during migration (they may create new fathom_calls while migration runs)
- [ ] Execute `SELECT migrate_batch_fathom_calls(100)` in batches until `unmigrated_non_orphans = 0`

### Verify Migration Integrity

- [ ] Confirm `unmigrated_non_orphans = 0`
- [ ] Confirm `missing_external_id = 0` across all recordings
- [ ] Run RLS verification using transaction pattern:
  ```sql
  BEGIN;
  SET LOCAL ROLE authenticated;
  SET LOCAL 'request.jwt.claims' = '{"sub":"user-b-uuid",...}';
  -- Verify User B cannot see User A's recordings (should return 0)
  -- Verify User B can see own recordings
  -- Verify User B cannot see User A's vault_entries
  ROLLBACK;
  ```
- [ ] Spot-check 10 random records: compare title, duration, source between fathom_calls and recordings

---

## Plan 02 — Wire v2 Frontend to Recordings

### Create the Service Layer

- [ ] Create `src/services/recordings.service.ts`:
  - `getRecordings()` — list ordered by date desc, use `Pick<>` type to exclude `full_transcript` from list queries (heavy column)
  - `getRecordingById(id)` — full detail including transcript, use `.maybeSingle()` for single record
- [ ] Add `recordings` domain to `queryKeys` factory in `src/lib/query-config.ts`

### Create the Hook Layer

- [ ] Create `src/hooks/useRecordings.ts`:
  - `useRecordings()` — list hook, gated on `enabled: !!session`
  - `useRecording(id)` — detail hook, uses `queryKeys.recordings.detail(id)`

### Replace Placeholders with Real Data

- [ ] Replace "Coming soon" placeholder on `/` (index.tsx) with real call list
- [ ] Replace "Coming soon" placeholder on `/calls/$callId` with real call detail + transcript
- [ ] Ensure zero `fathom_calls` references in authored v2 source (only auto-generated supabase.ts types file should reference it)
- [ ] Verify `pnpm build` passes with zero TypeScript or bundler errors

---

## Plan 03 — Archive fathom_calls + Verify

### Rename the Table (Not Drop)

- [ ] Create migration: `supabase/migrations/20260227000002_archive_fathom_calls.sql`
- [ ] Use `SET lock_timeout = '5s'` before the rename (prevents indefinite waits on concurrent transactions)
- [ ] `ALTER TABLE fathom_calls RENAME TO fathom_calls_archive`
- [ ] Add COMMENT: "Archived by Phase 15. 30-day hold from v2 go-live. Scheduled for DROP in Phase 22."

### Handle v1 Backward Compatibility

- [ ] After rename, the v1 frontend (still live in brain repo) will break because it queries `fathom_calls` by name
- [ ] Create compatibility VIEW: `CREATE VIEW fathom_calls AS SELECT * FROM fathom_calls_archive`
- [ ] This keeps v1 working during the transition period
- [ ] Phase 22 will DROP both the archive table and this VIEW

### Verify End-to-End

- [ ] Confirm calls are visible on `callvault.vercel.app` with correct title, date, duration, source badge
- [ ] Select a call and verify transcript displays correctly
- [ ] Verify v1 app still works (compatibility VIEW serving reads)

### CI Consideration

- [ ] `tsc -b` may fail in CI because `routeTree.gen.ts` is gitignored and CI doesn't run `pnpm dev` to generate it
- [ ] If this happens, change build command to `vite build` only — Vite compilation catches both TS and bundler errors
