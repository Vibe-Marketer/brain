---
phase: 30
plan: 04
title: Backfill orphan recordings rows for Fathom raw calls
status: complete
completed: 2026-05-11
requirements:
  - BUG-01
---

# Plan 30-04 — SUMMARY

## Outcome

Inserted 91 missing `recordings` rows for the orphan `fathom_raw_calls`
entries flagged by Plan 30-02's audit. The helper from Plan 30-01
(`toRecordingUuid`) can now resolve a canonical UUID for 100% of current
`fathom_raw_calls.recording_id` values (was 95.5%). Plan 30-03 is now
unblocked.

## Key Files

### key-files.added
- `supabase/migrations/20260512025206_backfill_orphan_fathom_recordings.sql` —
  one-shot CTE-based INSERT, idempotent via `ON CONFLICT (organization_id,
  legacy_recording_id) DO NOTHING`; also UPDATEs
  `fathom_raw_calls.canonical_recording_id` for the newly-inserted rows.

## Verification

| Probe | Expected | Actual |
|-------|----------|--------|
| Probe 1: `count(*) WHERE r.id IS NULL` (orphans) | 0 | **0** |
| Probe 2: backfilled rows by org | 4 + 87 in primary orgs | **04714fb3… = 87, 43a2ae24… = 4** |
| Probe 3: all backfilled rows have a title | 91 | **91** |

```sql
SELECT count(*) AS remaining_orphans
FROM fathom_raw_calls f
LEFT JOIN recordings r ON r.legacy_recording_id = f.recording_id
WHERE r.id IS NULL;
-- 0
```

## Org Assignment

| user_id | org assigned to | count |
|---------|----------------|-------|
| ef054159-3a5a-49e3-9fd8-31fa5a180ee6 | 04714fb3-d42c-42ad-801a-a8a49df6d06f (AI Simple) | 87 |
| abb09c9b-f3af-4250-a240-418b987b9818 | 43a2ae24-927a-4ba6-aa17-5d0a23e58008 (Personal) | 4 |

Rule used: each orphan was assigned to the org where the user had the
highest existing count of `source_app = 'fathom'` recordings. Verified
during plan-phase research — this matches the org where the user's other
1,366 Fathom recordings already live.

## Migration Apply

```bash
supabase db push --include-all
# Applying migration 20260512025206_backfill_orphan_fathom_recordings.sql...
# Finished supabase db push.
```

Migration applied via `--include-all` (note: `--use-api` is for `functions
deploy`, not `db push`). The `db push` command does not need Docker and
streams DDL directly to the remote DB.

## Deviations

- None — followed plan task-for-task.
- Used `db push --include-all` (the migration-push variant) instead of the
  documented `--use-api` flag, which is specific to `functions deploy`.
  The result is the same: server-side bundling without Docker.

## Self-Check: PASSED

- Migration applied cleanly with no SQL errors.
- All 3 verification probes returned expected values (0 orphans, 4+87 split,
  91 titles populated).
- Migration is idempotent — re-running would produce zero new inserts
  because every orphan now has a matching `recordings` row.
