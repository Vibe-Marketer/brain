# Phase 15: Data Migration - Research

**Researched:** 2026-02-27
**Domain:** PostgreSQL batch migration, Supabase RLS verification, source_metadata normalization
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Migration behavior:**
- Single batch, offline — run once during a maintenance window, not incrementally
- Pause all imports (Fathom sync, Zoom sync, YouTube) during migration window — disable sync edge functions, re-enable after completion
- No dual-read transition — new frontend reads only from recordings after verification passes (clean cut)

**Edge case handling:**
- Clean during migration — apply defaults for NULLs: NULL title -> "Untitled Call", NULL duration -> 0, etc.
- Skip and log on row failures — log the failed row ID and error, continue migrating remaining rows, review failures after batch completes
- Do NOT halt the entire batch on a single failure

**Verification and rollback:**
- Automated verification script first: count comparisons, random row spot-checks, RLS tests with real JWTs
- Manual spot-check second: user personally compares 5-10 calls across old vs new frontend
- Create a second test user account for cross-tenant RLS verification
- Rollback approach: fix and re-run — delete bad rows from recordings, fix migration logic, run again (fathom_calls stays untouched until archive)

**Archive strategy:**
- Rename fathom_calls to fathom_calls_archive — just a safety net, not queryable
- 30-day clock starts when v2 goes live to real users (not from migration completion)
- Archive table dropped in Phase 22 (Backend Cleanup), NOT in Phase 15
- No RLS policies needed on archive table — it sits dormant

### Claude's Discretion

- Dry-run approach (DATA-05): Claude picks between production copy vs transaction rollback based on Supabase constraints and data volume
- Migration monitoring: Claude picks simplest approach that gives enough visibility (console logs vs migration_log table)
- Orphaned rows (no valid user): Claude picks based on data integrity
- source_metadata normalization depth: Claude picks what gives the best foundation for the connector pipeline (Phase 17)
- Edge functions that read fathom_calls: Claude decides whether to update them in Phase 15 or defer to Phase 17 connector pipeline normalization

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

## Summary

Phase 15 runs existing migration infrastructure to completion. The hard work is already done: the `recordings` table, `migrate_fathom_call_to_recording()` single-row RPC, `migrate_batch_fathom_calls()` batch RPC, `get_migration_progress()` progress function, and the `migrate-recordings` edge function are all deployed in production at `vltmrnjsubfzrgrtdqey.supabase.co`. The `get_unified_recordings` RPC referenced in planning docs is actually `hybrid_search_transcripts_scoped` — there is no standalone `get_unified_recordings` function; the v2 frontend queries the `recordings` table directly.

The migration function has one known gap: it passes `v_call.title` without a COALESCE, meaning any NULL title in fathom_calls would fail the `recordings.title TEXT NOT NULL` constraint. Since the CONTEXT requires applying defaults (NULL title → "Untitled Call"), the migration function must be updated before running. Similarly, the `source_metadata` built by the migration function does not include an `external_id` key — this must be added for Phase 17 deduplication. Both fixes require deploying an updated migration SQL function before running the batch.

The v2 frontend (at `/Users/Naegele/dev/callvault`) currently has placeholder "Coming soon" pages for the calls list and call detail. Phase 15 must wire these pages to the `recordings` table so a verified user can see their complete call history. The "clean cut" — no dual-read — means the v2 frontend never touches `fathom_calls` at all.

**Primary recommendation:** Update `migrate_fathom_call_to_recording()` with COALESCE defaults and `external_id` injection first; run a dry-run profiling pass on production data; then run the actual batch via repeated calls to `migrate-recordings` edge function; verify with automated SQL checks and Supabase User Impersonation; wire the v2 frontend calls list to `recordings`; archive `fathom_calls`.

---

## Standard Stack

### Core

This phase is pure SQL + Supabase — no new npm packages required.

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Supabase SQL Editor | — | Run migration RPCs, verification queries, archive rename | Already in use; no external tooling needed |
| `migrate-recordings` edge function | deployed | Admin-triggered batch migration via `migrate_batch_fathom_calls(100)` | Already deployed, Admin-only gated |
| TanStack Query | 5.x | Data fetching hook for recordings in v2 frontend | Already in v2 stack per Phase 14 |
| Supabase JS Client | 2.x | Query `recordings` table from v2 frontend | Already in v2 stack |

### Supporting

| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| Supabase User Impersonation | Public Beta | Test RLS as real user without service_role | RLS verification step after migration |
| `get_migration_progress()` RPC | deployed | Check total/migrated/remaining counts | Before and during batch run |
| pgTAP (alternative) | — | Automated SQL unit tests for RLS | Only if adding automated DB test suite |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Repeated manual curl to migrate-recordings | Script loop in terminal | Script is more reliable for 100+ batches; manual is fine for small datasets |
| Transaction rollback for dry-run | Profiling queries + copy schema | Transaction rollback in Supabase cloud has statement timeout risk; profiling queries are safer |
| migration_log table for monitoring | RAISE WARNING (existing) | `RAISE WARNING` already implemented in `migrate_batch_fathom_calls`; no table needed |

---

## Architecture Patterns

### Recommended Phase 15 Execution Order

```
Step 1: Profile production data (DATA-05 dry-run equivalent)
        → Run profiling queries against fathom_calls
        → Identify NULL rates, row counts per user, encoding anomalies
        → No schema changes, safe to run anytime

Step 2: Update migrate_fathom_call_to_recording() function
        → Add COALESCE defaults (title, duration, etc.)
        → Add external_id to source_metadata
        → Deploy as new migration SQL file

Step 3: Disable sync edge functions (maintenance window start)
        → Disable in Supabase Dashboard: sync-meetings, zoom-sync-meetings, youtube-import
        → Or: document the steps — actual disable is a human action

Step 4: Run batch migration
        → POST /functions/v1/migrate-recordings repeatedly until complete: true
        → Monitor via get_migration_progress() between batches
        → Review RAISE WARNING logs for failed rows

Step 5: Run automated verification SQL
        → Count match: fathom_calls.count == recordings.count (with legacy_recording_id)
        → RLS spot-check: User A cannot read User B's recordings
        → Random 5-row sample: title/transcript/date match

Step 6: Wire v2 frontend calls list to recordings table
        → Create useRecordings hook + recordings.service.ts
        → Replace "Coming soon" placeholder in index.tsx
        → Verify in Vercel preview

Step 7: Manual spot-check (human)
        → User compares 5-10 calls in old vs new frontend

Step 8: Archive fathom_calls
        → ALTER TABLE fathom_calls RENAME TO fathom_calls_archive
        → No RLS needed, no new migrations needed

Step 9: Re-enable sync edge functions
        → Maintenance window ends
        → New imports go to fathom_calls until Phase 17 rewires connectors
```

### Pattern 1: Profiling Queries (DATA-05 Dry-Run)

**What:** Run diagnostic SQL to understand the real data shape before migrating — NULL rates, orphaned rows, row counts per user. This is the "production copy" approach to dry-running: read-only queries against live data.

**When to use:** Before any batch migration runs.

**Why this over transaction rollback:** Supabase cloud enforces a statement timeout (default 8 seconds on most plans, configurable). A transaction wrapping the entire migration batch would hit this limit. Profiling queries are read-only, zero-risk, and give all the same insight.

```sql
-- Source: Supabase SQL Editor
-- Profile NULL rates in key fathom_calls fields
SELECT
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE user_id IS NULL) AS null_user_id,
  COUNT(*) FILTER (WHERE title IS NULL) AS null_title,
  COUNT(*) FILTER (WHERE full_transcript IS NULL) AS null_transcript,
  COUNT(*) FILTER (WHERE recording_start_time IS NULL) AS null_start_time,
  COUNT(*) FILTER (WHERE source_platform IS NULL) AS null_source_platform,
  COUNT(DISTINCT user_id) AS distinct_users,
  MIN(created_at) AS oldest_call,
  MAX(created_at) AS newest_call
FROM fathom_calls;

-- Row counts per user (detect skewed distributions)
SELECT user_id, COUNT(*) AS call_count
FROM fathom_calls
GROUP BY user_id
ORDER BY call_count DESC
LIMIT 20;

-- Orphaned rows: fathom_calls rows with no auth.users entry
SELECT COUNT(*) AS orphaned_count
FROM fathom_calls fc
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users u WHERE u.id = fc.user_id
);

-- Calls already migrated vs total
SELECT * FROM get_migration_progress();
```

### Pattern 2: Updated Migration Function (NULL Defaults + external_id)

**What:** Replace the deployed `migrate_fathom_call_to_recording()` with an updated version that applies NULL defaults and injects `external_id` into `source_metadata`.

**When to use:** Deploy this BEFORE running the batch.

```sql
-- Source: migrations/20260227000001_fix_migration_function.sql
-- Update migrate_fathom_call_to_recording to add COALESCE defaults
-- and external_id in source_metadata for Phase 17 deduplication

CREATE OR REPLACE FUNCTION migrate_fathom_call_to_recording(
  p_recording_id BIGINT,
  p_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bank_id UUID;
  v_vault_id UUID;
  v_new_recording_id UUID;
  v_call RECORD;
BEGIN
  -- [bank/vault lookup logic unchanged — see existing migration] --

  -- Get the fathom_call data
  SELECT * INTO v_call
  FROM fathom_calls
  WHERE recording_id = p_recording_id AND user_id = p_user_id;

  IF v_call IS NULL THEN
    RAISE EXCEPTION 'Call not found: recording_id=%, user_id=%', p_recording_id, p_user_id;
  END IF;

  -- Create recording with NULL defaults applied
  INSERT INTO recordings (
    legacy_recording_id,
    bank_id,
    owner_user_id,
    title,           -- COALESCE to 'Untitled Call'
    audio_url,
    video_url,
    full_transcript,
    summary,
    global_tags,
    source_app,
    source_metadata, -- Add external_id for Phase 17 dedup
    duration,        -- COALESCE to 0
    recording_start_time,
    recording_end_time,
    created_at,
    synced_at
  ) VALUES (
    v_call.recording_id,
    v_bank_id,
    p_user_id,
    COALESCE(NULLIF(TRIM(v_call.title), ''), 'Untitled Call'),
    v_call.url,
    v_call.share_url,
    v_call.full_transcript,
    v_call.summary,
    COALESCE(v_call.auto_tags, '{}'),
    COALESCE(v_call.source_platform, 'fathom'),
    jsonb_build_object(
      'external_id', v_call.recording_id::TEXT,  -- Phase 17 dedup key
      'recorded_by_name', v_call.recorded_by_name,
      'recorded_by_email', v_call.recorded_by_email,
      'calendar_invitees', v_call.calendar_invitees,
      'meeting_fingerprint', v_call.meeting_fingerprint,
      'google_calendar_event_id', v_call.google_calendar_event_id,
      'google_drive_file_id', v_call.google_drive_file_id,
      'sentiment_cache', v_call.sentiment_cache,
      'original_metadata', v_call.metadata
    ),
    COALESCE(
      EXTRACT(EPOCH FROM (v_call.recording_end_time - v_call.recording_start_time))::INTEGER,
      0
    ),  -- Derive duration from timestamps; fallback to 0
    v_call.recording_start_time,
    v_call.recording_end_time,
    v_call.created_at,
    v_call.synced_at
  )
  ON CONFLICT (bank_id, legacy_recording_id) DO NOTHING  -- Idempotency
  RETURNING id INTO v_new_recording_id;

  -- If conflict (already migrated), return existing
  IF v_new_recording_id IS NULL THEN
    SELECT id INTO v_new_recording_id
    FROM recordings
    WHERE legacy_recording_id = p_recording_id AND bank_id = v_bank_id;
    RETURN v_new_recording_id;
  END IF;

  -- Create vault entry in personal vault
  INSERT INTO vault_entries (vault_id, recording_id, local_tags, created_at)
  VALUES (v_vault_id, v_new_recording_id, '{}', v_call.created_at)
  ON CONFLICT (vault_id, recording_id) DO NOTHING;  -- Idempotency

  RETURN v_new_recording_id;
END;
$$;
```

### Pattern 3: Orphaned Row Handling

**What:** Rows in fathom_calls where user_id is NULL or points to a deleted auth.users entry. The `migrate_fathom_call_to_recording()` function already raises an exception on "Call not found," which the batch function catches and logs. The decision is: skip them permanently.

**Recommendation:** Skip orphaned rows (no valid user). Log them as errors via the existing `RAISE WARNING`. After migration completes, query the warnings from Supabase logs to identify orphaned recording_ids. These rows are data that belonged to deleted accounts — no living user can claim them.

```sql
-- Post-migration: verify orphaned count matches error count
-- Run in SQL Editor (service_role level)
SELECT fc.recording_id, fc.user_id, fc.title, fc.created_at
FROM fathom_calls fc
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users u WHERE u.id = fc.user_id
)
ORDER BY fc.created_at;
```

### Pattern 4: Automated Verification SQL

**What:** SQL queries to confirm migration completeness and RLS isolation before any user switch.

```sql
-- 1. Count match: must return 0 for complete migration
--    (orphaned rows are the only legitimate non-zero result)
SELECT COUNT(*) AS unmigrated_non_orphans
FROM fathom_calls fc
WHERE NOT EXISTS (
  SELECT 1 FROM recordings r
  WHERE r.legacy_recording_id = fc.recording_id
)
AND EXISTS (
  SELECT 1 FROM auth.users u WHERE u.id = fc.user_id
);

-- 2. Random spot-check: sample 10 migrated rows
SELECT
  fc.recording_id,
  fc.title AS old_title,
  r.title AS new_title,
  fc.created_at AS old_date,
  r.recording_start_time AS new_date,
  (fc.title = r.title) AS title_match
FROM fathom_calls fc
JOIN recordings r ON r.legacy_recording_id = fc.recording_id
ORDER BY RANDOM()
LIMIT 10;

-- 3. source_metadata has external_id for all migrated rows
SELECT COUNT(*) AS missing_external_id
FROM recordings
WHERE legacy_recording_id IS NOT NULL
  AND (source_metadata->>'external_id') IS NULL;

-- 4. Overall progress (should show 100%)
SELECT * FROM get_migration_progress();
```

### Pattern 5: RLS Verification with Supabase User Impersonation

**What:** Verify cross-tenant isolation without service_role. Supabase Studio has a "User Impersonation" feature (Public Beta) that mints a JWT for any user and runs queries as that user.

**Steps:**
1. In Supabase Dashboard → SQL Editor → click the user selector (top of editor)
2. Select User A → run: `SELECT id, title FROM recordings LIMIT 5;` — should see User A's calls
3. Switch to User B → run: `SELECT COUNT(*) FROM recordings WHERE owner_user_id = '<User_A_id>';` — must return 0
4. Run: `SELECT COUNT(*) FROM vault_entries ve JOIN recordings r ON r.id = ve.recording_id WHERE r.owner_user_id = '<User_A_id>';` — must return 0

**Alternative (SQL Editor, no impersonation UI):**
```sql
-- Test as User A (set JWT context manually)
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"<USER_A_UUID>"}';

SELECT COUNT(*) FROM recordings;
-- Should return only User A's count

SELECT COUNT(*) FROM recordings WHERE owner_user_id = '<USER_B_UUID>';
-- Must return 0
```

Note: Supabase User Impersonation in the Dashboard SQL Editor is simpler and more reliable than manual SET LOCAL. Use the UI approach first. Manual SET LOCAL is a fallback.

### Pattern 6: v2 Frontend — recordings.service.ts + useRecordings

**What:** Wire the v2 calls list page to query `recordings` via the Supabase JS client. No `fathom_calls` queries ever appear in the v2 codebase.

```typescript
// /Users/Naegele/dev/callvault/src/services/recordings.service.ts
// Source: Supabase JS client v2 docs + Phase 14 established patterns
import { supabase } from '@/lib/supabase'

export interface Recording {
  id: string
  title: string
  recording_start_time: string | null
  duration: number | null
  source_app: string | null
  summary: string | null
}

export async function getRecordings(userId: string): Promise<Recording[]> {
  const { data, error } = await supabase
    .from('recordings')
    .select('id, title, recording_start_time, duration, source_app, summary')
    .eq('owner_user_id', userId)
    .order('recording_start_time', { ascending: false })

  if (error) throw error
  return (data ?? []) as Recording[]
}

export async function getRecordingById(id: string): Promise<Recording | null> {
  const { data, error } = await supabase
    .from('recordings')
    .select('id, title, recording_start_time, duration, source_app, summary, full_transcript')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data as Recording | null
}
```

```typescript
// /Users/Naegele/dev/callvault/src/hooks/useRecordings.ts
import { useQuery } from '@tanstack/react-query'
import { getRecordings } from '@/services/recordings.service'
import { queryKeys } from '@/lib/query-config'
import { useAuth } from '@/hooks/useAuth'

export function useRecordings() {
  const { user } = useAuth()

  return useQuery({
    queryKey: queryKeys.recordings.list(),
    queryFn: () => getRecordings(user!.id),
    enabled: !!user,
  })
}
```

### Pattern 7: fathom_calls Archive (ALTER TABLE RENAME TO)

**What:** Rename fathom_calls to fathom_calls_archive after migration and verification complete.

**Lock behavior:** `ALTER TABLE RENAME` acquires `AccessExclusiveLock` — the highest table-level lock. It blocks all reads and writes while held. However, the operation itself is near-instantaneous (metadata only, no data movement). In a maintenance window with syncs disabled, this is zero risk.

```sql
-- Deploy as migration: 20260227000002_archive_fathom_calls.sql
-- Run AFTER: migration complete + verification passed + v2 frontend verified

ALTER TABLE fathom_calls RENAME TO fathom_calls_archive;

COMMENT ON TABLE fathom_calls_archive IS
  'Archived 2026-02-27. Original fathom_calls data. Do NOT query directly.
   30-day hold from v2 go-live. Scheduled for DROP in Phase 22 (Backend Cleanup).';

-- No RLS needed — table is dormant, no app reads it
-- No indexes needed to add — existing indexes rename automatically
```

Note: PostgreSQL automatically renames all indexes and triggers associated with the table when you rename the table. No manual index work needed.

### Pattern 8: Disabling Sync Edge Functions (Maintenance Window)

**What:** Stop new imports during migration to prevent race conditions — a new Fathom webhook arriving during batch migration could insert a new fathom_calls row that the batch hasn't processed yet.

**Options:**
1. Supabase Dashboard → Edge Functions → toggle each function off (UI action — human step)
2. Set an environment variable `MIGRATION_LOCK=true` and check it at function start (code change)
3. Accept the race: since `migrate_batch_fathom_calls` uses `WHERE NOT EXISTS (SELECT 1 FROM recordings WHERE legacy_recording_id = fc.recording_id)`, any new rows added during migration will simply be caught on the next batch iteration

**Recommendation:** Option 3 (accept the race) for Fathom/Zoom/YouTube **writes** to fathom_calls — the batch function naturally handles them. The maintenance window concern is really about the import functions being re-enabled AFTER migration completes and pointing to the correct table. Since connectors still write to fathom_calls (that's Phase 17's job to change), no lock is needed.

The only thing that needs a maintenance window is the `ALTER TABLE RENAME` in step 8. Document that as the one human-coordinated action.

### Anti-Patterns to Avoid

- **Querying fathom_calls from v2 frontend code:** Phase 15 establishes the hard cut. Zero `fathom_calls` references in `/Users/Naegele/dev/callvault/src/`.
- **Running migration without profiling first:** The existing migration function has gaps (no COALESCE on title). Profile first, fix function, then run.
- **Dropping fathom_calls in Phase 15:** CONTEXT says archive only. DROP happens in Phase 22.
- **Using `service_role` for RLS verification:** DATA-02 specifically requires real JWT verification. Service role bypasses RLS entirely — it proves nothing.
- **Running ALTER TABLE RENAME without syncs disabled:** While near-instantaneous, it blocks all reads during the lock. Coordinate as a maintenance window moment.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-tenant RLS testing | Custom JWT minting script | Supabase User Impersonation (Dashboard) | Already in Supabase Studio; mints valid JWT; works in SQL Editor |
| Migration progress tracking | Custom migration_log table | `get_migration_progress()` RPC (deployed) | Already deployed; returns total/migrated/remaining/percent |
| Batch skip-and-continue | Custom savepoint logic | `EXCEPTION WHEN OTHERS` in PL/pgSQL (existing) | Already in `migrate_batch_fathom_calls`; each row wrapped in BEGIN/EXCEPTION block |
| Idempotent re-run | Delete-and-reinsert logic | `UNIQUE(bank_id, legacy_recording_id)` constraint (existing) | Already deployed; prevents duplicates on re-run |

**Key insight:** All the hard migration infrastructure is already deployed. Phase 15 is about running it correctly, not rebuilding it.

---

## Common Pitfalls

### Pitfall 1: NULL Title Constraint Violation

**What goes wrong:** `migrate_fathom_call_to_recording()` passes `v_call.title` directly. The `recordings.title TEXT NOT NULL` constraint means any NULL title in fathom_calls causes the row to fail with a NOT NULL violation. The EXCEPTION WHEN OTHERS block catches it, logs it, and continues — but those rows are silently skipped.

**Why it happens:** `fathom_calls.title TEXT NOT NULL` — but historical data may have been inserted with non-standard paths or the constraint was added after data existed.

**How to avoid:** The profiling query `COUNT(*) FILTER (WHERE title IS NULL)` reveals actual NULL count. The updated migration function applies `COALESCE(NULLIF(TRIM(v_call.title), ''), 'Untitled Call')`.

**Warning signs:** `error_count` from `migrate_batch_fathom_calls` is non-zero. Check Supabase logs for `RAISE WARNING` messages.

### Pitfall 2: Bank Not Found for Users Without Personal Bank

**What goes wrong:** `migrate_fathom_call_to_recording()` creates a personal bank if one doesn't exist. If a user signed up before the Bank/Vault architecture (Phase 9), they may not have a personal bank. The function handles this with an INSERT into `banks` and `bank_memberships`. However, concurrent calls to the migration function for the same user could create duplicate banks if run in parallel.

**Why it happens:** The existing batch function runs sequentially in a FOR loop, so concurrent calls to the edge function are the risk. Running `migrate-recordings` from two browser tabs simultaneously could trigger this.

**How to avoid:** Run migration from a single terminal/browser session. The UNIQUE constraints on `bank_memberships` would catch the duplicate membership insert, but two bank rows for the same user would be a problem.

**Warning signs:** User appears in both `banks` twice with `type = 'personal'`.

### Pitfall 3: RLS Policy Uses bank_id Membership, Not owner_user_id

**What goes wrong:** The recordings RLS policy is `is_bank_member(bank_id, auth.uid())`, not `owner_user_id = auth.uid()`. This means a user must have bank membership to read their own recordings. If a user has recordings in a bank but lost bank membership, they cannot read their own recordings.

**Why it happens:** Bank membership is the access primitive in this architecture. Recording ownership alone is not sufficient.

**How to avoid:** Verify after migration that every user whose fathom_calls were migrated also has `bank_memberships` for the bank containing their recordings. The profiling query should check this.

```sql
-- Check: any migrated recordings without corresponding bank membership
SELECT r.owner_user_id, COUNT(*) AS recording_count
FROM recordings r
WHERE r.legacy_recording_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM bank_memberships bm
    WHERE bm.bank_id = r.bank_id AND bm.user_id = r.owner_user_id
  )
GROUP BY r.owner_user_id;
-- Should return 0 rows
```

### Pitfall 4: source_metadata Missing external_id Breaks Phase 17 Dedup

**What goes wrong:** If the migration runs without the updated migration function, all Fathom records in `recordings.source_metadata` will lack an `external_id` key. Phase 17's connector pipeline assumes `source_metadata->>'external_id'` for deduplication. A migration without this would require a backfill migration in Phase 17.

**Why it happens:** The original migration function was written before the `external_id` convention was established in ARCHITECTURE.md.

**How to avoid:** Deploy the updated migration function (adding `external_id` to `source_metadata`) before running the batch.

**Warning signs:** `SELECT COUNT(*) FROM recordings WHERE legacy_recording_id IS NOT NULL AND (source_metadata->>'external_id') IS NULL` returns non-zero.

### Pitfall 5: alter TABLE RENAME Blocks for Longer Than Expected

**What goes wrong:** If long-running transactions are open on `fathom_calls` when `ALTER TABLE RENAME` runs, the RENAME will wait for them to complete before acquiring its `AccessExclusiveLock`. This can feel like a hang.

**Why it happens:** Supabase has background processes and connection pooling. Any open query touching `fathom_calls` will block the RENAME.

**How to avoid:** Run the RENAME immediately after disabling sync edge functions and waiting 30 seconds for in-flight requests to drain. Consider adding `lock_timeout = '5s'` before the RENAME statement to prevent indefinite waits.

```sql
SET lock_timeout = '5s';
ALTER TABLE fathom_calls RENAME TO fathom_calls_archive;
```

### Pitfall 6: v2 Frontend Uses fathom_calls Instead of recordings

**What goes wrong:** A developer adds a query to `fathom_calls` in the v2 codebase to "make it work faster." This violates the clean cut, creates a second source of truth, and makes Phase 17 connector work harder.

**Why it happens:** `fathom_calls` has data immediately and `recordings` requires the migration to complete first.

**How to avoid:** Phase 15 must complete migration AND wire v2 frontend to recordings before declaring success. The "Coming soon" placeholders in index.tsx and $callId.tsx must be replaced with real recordings queries as part of this phase.

---

## Code Examples

### Running the Migration via migrate-recordings Edge Function

```bash
# Source: migrate-recordings/index.ts (deployed)
# Call repeatedly until complete: true
# Must be called with an ADMIN user's JWT token

curl -X POST \
  'https://vltmrnjsubfzrgrtdqey.supabase.co/functions/v1/migrate-recordings' \
  -H 'Authorization: Bearer <ADMIN_USER_JWT>' \
  -H 'Content-Type: application/json'

# Expected response shape:
# {
#   "success": true,
#   "batch": { "migrated": 100, "errors": 0, "batch_size": 100 },
#   "overall": {
#     "total_calls": 1500,
#     "migrated": 100,
#     "remaining": 1400,
#     "complete": false
#   }
# }
```

### Shell Loop to Drive Migration to Completion

```bash
# Run until complete: true
# Requires: SUPABASE_JWT (admin user's access token)
# Get this by logging in as admin and copying from browser dev tools > Network > any Supabase request > Authorization header

SUPABASE_URL="https://vltmrnjsubfzrgrtdqey.supabase.co"
ADMIN_JWT="<paste admin JWT here>"

while true; do
  RESPONSE=$(curl -s -X POST \
    "$SUPABASE_URL/functions/v1/migrate-recordings" \
    -H "Authorization: Bearer $ADMIN_JWT" \
    -H "Content-Type: application/json")

  echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Migrated: {d[\"overall\"][\"migrated\"]}/{d[\"overall\"][\"total_calls\"]} ({d[\"overall\"][\"remaining\"]} remaining)')"

  COMPLETE=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['overall']['complete'])")

  if [ "$COMPLETE" = "True" ]; then
    echo "Migration complete!"
    break
  fi

  sleep 2
done
```

### v2 Frontend: useRecordings Hook (TanStack Query Pattern)

```typescript
// Source: Phase 14 established TanStack Query + queryKeys pattern
// /Users/Naegele/dev/callvault/src/lib/query-config.ts additions needed:
// recordings: { list: () => ['recordings', 'list'] as const }

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

const recordingQueryKeys = {
  list: () => ['recordings', 'list'] as const,
  detail: (id: string) => ['recordings', 'detail', id] as const,
}

export function useRecordings() {
  const { session } = useAuth()

  return useQuery({
    queryKey: recordingQueryKeys.list(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recordings')
        .select('id, title, recording_start_time, duration, source_app, summary')
        .order('recording_start_time', { ascending: false, nullsFirst: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!session,
  })
}
```

---

## What Exists vs What Needs Building

This section is critical — it maps what's already deployed vs what Phase 15 must create.

### Already Deployed (do NOT recreate)

| Item | Location | Status |
|------|----------|--------|
| `recordings` table + RLS | migration `20260131000007` | Deployed in prod |
| `vault_entries` table + RLS | migration `20260131000007` | Deployed in prod |
| `migrate_fathom_call_to_recording()` | migration `20260131000008` | Deployed — NEEDS UPDATE |
| `migrate_batch_fathom_calls()` | migration `20260131000008` | Deployed — works as-is |
| `get_migration_progress()` | migration `20260131000008` | Deployed |
| `migrate-recordings` edge function | supabase/functions/migrate-recordings | Deployed |
| `hybrid_search_transcripts_scoped()` | migration `20260131300001` | Deployed (the "unified" RPC) |
| v2 frontend routes (placeholder) | /Users/Naegele/dev/callvault/src/routes | Phase 14 complete |
| Supabase types (recordings, vault_entries) | /Users/Naegele/dev/callvault/src/types/supabase.ts | In v2 types |
| `migrate_batch_fathom_calls` RPC types | supabase.ts | In v2 types |

### Needs Building in Phase 15

| Item | Where | Why |
|------|-------|-----|
| Updated `migrate_fathom_call_to_recording()` | New migration SQL file | Add COALESCE defaults + external_id |
| Profiling queries (document) | SQL to run in editor | DATA-05 dry-run |
| Automated verification queries | SQL to run in editor | DATA-02 + DATA-01 check |
| `fathom_calls_archive` rename migration | New migration SQL file | DATA-04 archive |
| `recordings.service.ts` | /Users/Naegele/dev/callvault/src/services/ | v2 frontend reads recordings |
| `useRecordings` hook | /Users/Naegele/dev/callvault/src/hooks/ | v2 frontend calls list |
| Update `/` route (index.tsx) | v2 calls list page | Replace "Coming soon" placeholder |
| Update `/calls/$callId.tsx` | v2 call detail page | Replace "Coming soon" placeholder |
| Add `recordings` domain to queryKeys | query-config.ts | Per Phase 14 established pattern |

### Clarification on "get_unified_recordings"

The CONTEXT.md and ROADMAP reference `get_unified_recordings` as a deployed RPC. Investigation shows:
- There is NO function named `get_unified_recordings` in any migration file
- The function named in `20260131300001_chat_vault_search_function.sql` is `hybrid_search_transcripts_scoped` — a search/chat function, not a list function
- The v2 frontend should query the `recordings` table directly (with RLS providing tenant isolation), not via a special RPC
- The `supabase.ts` types file has no `get_unified_recordings` in its Functions type

**Conclusion (HIGH confidence):** Query `recordings` table directly for the calls list. Use `hybrid_search_transcripts_scoped` only when implementing search/AI chat features in later phases.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Query `fathom_calls` for all call data | Query `recordings` table; `fathom_calls` archived | Phase 15 cutover | Single source of truth for all call data |
| `source_metadata` varies per connector | `source_metadata` always has `external_id` key | Phase 15 update to migration function | Phase 17 dedup works without connector-specific logic |
| Imports write to `fathom_calls` | Imports still write to `fathom_calls` until Phase 17 | Stays this way through Phase 15 | Phase 17 rewires all connectors to `recordings` directly |

**After Phase 15, still in place:**
- `sync-meetings`, `zoom-sync-meetings`, `youtube-import` still write to `fathom_calls` (Phase 17's job)
- New imports go to `fathom_calls` but are not visible in v2 frontend until Phase 17 completes
- This is acceptable: the CONTEXT says "no dual-read" for the v2 frontend, but new imports can continue going to `fathom_calls` during Phase 15–16 since Phase 17 will migrate those connectors

---

## Claude's Discretion Recommendations

### Dry-Run (DATA-05)

**Recommendation: Profiling queries against production data (not transaction rollback)**

Transaction rollback in Supabase cloud risks hitting statement timeout limits. The production data profiling approach (Pattern 1) is read-only, zero-risk, and answers the same questions: what are the NULL rates, how many rows, what encoding issues exist. Deploy the updated migration function, run profiling first, then run the batch.

### Migration Monitoring

**Recommendation: RAISE WARNING logs (existing) — no migration_log table needed**

`migrate_batch_fathom_calls` already emits `RAISE WARNING` for every failed row. These appear in Supabase Dashboard → Edge Functions → migrate-recordings → Logs. The `get_migration_progress()` RPC gives real-time counts. No additional infrastructure needed.

### Orphaned Rows (No Valid User)

**Recommendation: Skip permanently, log for review**

Orphaned fathom_calls rows (where `user_id` points to a deleted auth.users entry) belong to accounts that no longer exist. The `migrate_fathom_call_to_recording()` function already raises an exception for these (caught by EXCEPTION WHEN OTHERS). After the batch completes, run the orphaned-row diagnostic query to confirm the count. As long as the orphan count explains the `error_count`, the migration is complete.

Do NOT attempt to migrate orphaned rows to a "system" user or delete them from fathom_calls. Leave them in fathom_calls_archive — they'll be dropped in Phase 22 along with the archive table.

### source_metadata Normalization Depth

**Recommendation: Add `external_id` key only; preserve all existing keys**

Phase 15 adds `external_id: recording_id.toString()` to every Fathom row's source_metadata during migration. This is the minimum needed for Phase 17 deduplication. Zoom and YouTube records already have distinct identifiers in their source_metadata (Zoom: `meeting_id`, YouTube: `youtube_video_id`). Phase 17 will normalize those connectors to also use `external_id` when they're rewritten to write to `recordings` directly.

Do NOT attempt to normalize Zoom or YouTube source_metadata in Phase 15 — those are live connectors still writing to fathom_calls. Changing their normalization in Phase 15 risks breaking their current dedup logic.

### Edge Functions That Read fathom_calls

**Recommendation: Defer all connector updates to Phase 17**

`sync-meetings`, `zoom-sync-meetings`, `youtube-import` all still write to `fathom_calls`. In Phase 15, leave them unchanged. They will continue writing new imports to `fathom_calls`, which is fine — the v2 frontend reads from `recordings` only, and the archive won't happen until after Phase 17 rewires the connectors. The 30-day archive clock starts at v2 go-live anyway.

The only edge function to leave alone that READS `fathom_calls` is `sync-meetings` (the Fathom sync) — it reads fathom_calls to check existing records before upsert. This is fine through Phase 15.

---

## Open Questions

1. **Does the admin user account have the `ADMIN` role in `user_roles`?**
   - What we know: `migrate-recordings` checks `user_roles` for `role = 'ADMIN'` before running
   - What's unclear: Whether the developer's production account has this role assigned
   - Recommendation: Verify with `SELECT * FROM user_roles WHERE user_id = auth.uid();` in Supabase SQL Editor before trying to call the edge function. If missing, run `INSERT INTO user_roles (user_id, role) VALUES ('<your_user_id>', 'ADMIN');`.

2. **Actual data volume in fathom_calls**
   - What we know: The profiling query will reveal this
   - What's unclear: Could be 50 rows (fast migration) or 5,000+ rows (needs monitoring)
   - Recommendation: Run `SELECT COUNT(*) FROM fathom_calls` first. At 100 rows/batch, 1,000 rows = 10 curl calls. 10,000 rows = 100 calls. Both are manageable with the shell loop.

3. **Is there an existing second test user account for cross-tenant RLS verification?**
   - What we know: CONTEXT requires creating a second test user account
   - What's unclear: Whether one already exists in production
   - Recommendation: Check Supabase Dashboard → Authentication → Users for any existing test accounts. If none, create one during the verification step.

4. **Are there any active Supabase statement timeouts that affect the migration function?**
   - What we know: Supabase has default statement timeouts; `migrate_batch_fathom_calls` runs inside a PL/pgSQL function (not a raw statement)
   - What's unclear: Whether PL/pgSQL function execution hits the same timeout
   - Recommendation: Test with a small batch (p_batch_size = 10) first. If it completes in <8 seconds, the default 100-batch size should be fine for datasets under ~5,000 rows.

---

## Sources

### Primary (HIGH confidence)

- `/Users/Naegele/dev/brain/supabase/migrations/20260131000007_create_recordings_tables.sql` — recordings table schema, RLS policies, vault_entries schema
- `/Users/Naegele/dev/brain/supabase/migrations/20260131000008_migration_function.sql` — migrate_fathom_call_to_recording(), migrate_batch_fathom_calls(), get_migration_progress()
- `/Users/Naegele/dev/brain/supabase/migrations/00000000000000_consolidated_schema.sql` — fathom_calls full column list
- `/Users/Naegele/dev/brain/supabase/functions/migrate-recordings/index.ts` — existing edge function, admin gate, batch size=100
- `/Users/Naegele/dev/brain/.planning/research/ARCHITECTURE.md` — migration sequence, get_unified_recordings clarification
- `/Users/Naegele/dev/brain/supabase/migrations/20260131162000_add_youtube_source_and_metadata.sql` — fathom_calls.metadata JSONB, source_platform constraint
- `/Users/Naegele/dev/callvault/src/types/supabase.ts` — confirmed deployed RPCs: get_migration_progress, migrate_batch_fathom_calls, migrate_fathom_call_to_recording; NO get_unified_recordings
- `https://pglocks.org/?pgcommand=ALTER+TABLE+RENAME` — ALTER TABLE RENAME acquires AccessExclusiveLock (verified)
- `https://supabase.com/features/user-impersonation` — User Impersonation feature for RLS testing (verified as Public Beta)

### Secondary (MEDIUM confidence)

- `https://github.com/orgs/supabase/discussions/22482` — SQL editor SET LOCAL pattern for JWT claims (community discussion, not official docs)
- `https://supabase.com/docs/guides/local-development/testing/overview` — pgTAP and Vitest patterns for RLS testing (official docs)

### Tertiary (LOW confidence)

- WebSearch: PostgreSQL SAVEPOINT pattern for skip-and-continue — used to confirm existing EXCEPTION WHEN OTHERS approach is correct. Not directly verified against a specific doc, but consistent with PostgreSQL docs.

---

## Metadata

**Confidence breakdown:**
- What's already deployed: HIGH — verified by reading actual migration files and supabase.ts types
- Migration function gap (NULL title): HIGH — read the actual function code; `v_call.title` has no COALESCE
- source_metadata external_id gap: HIGH — searched all functions; none use `external_id` key
- get_unified_recordings clarification: HIGH — grepped entire codebase; no such function exists
- RLS verification approach: HIGH — Supabase User Impersonation confirmed in official feature page
- ALTER TABLE RENAME lock behavior: HIGH — confirmed via pglocks.org official resource
- Batch loop shell script: MEDIUM — pattern is standard; specific Supabase URL verified; JWT extraction step is manual
- Statement timeout risk: LOW — based on Supabase general knowledge; not verified against this specific project's config

**Research date:** 2026-02-27
**Valid until:** 2026-03-27 (30 days — Supabase stable, migration infrastructure stable)
