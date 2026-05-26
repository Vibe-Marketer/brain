---
status: awaiting_human_verify
trigger: "fathom-import-failed: User selected 4 Fathom calls to import (previously imported, deleted, now re-available). Import starts then immediately shows 'Import failed' toast. 0/4 calls imported."
created: 2026-04-14T00:00:00Z
updated: 2026-04-14T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — checkDuplicate() in connector-pipeline.ts fails to find the existing recordings row because of a buggy PostgREST filter syntax ("source_metadata->>'external_id'" with inner quotes is NOT equivalent to fetch-meetings working syntax 'source_metadata->>external_id'). The dedup check returns isDuplicate: false (fail-open). insertRecording() then tries to INSERT a new recordings row which hits the recordings_source_dedup unique constraint (organization_id, source_app, source_call_id). The insert fails, runPipeline() catches it and returns { success: false, error: "duplicate key..." }, syncMeeting() returns 'failed'. All 4 fail → finalStatus = 'failed' → frontend shows "Import failed".

test: Compare filter syntax in connector-pipeline.ts vs fetch-meetings.ts
expecting: Filter syntax mismatch confirmed → fix checkDuplicate to use source_call_id column directly instead of JSONB filter
next_action: Fix connector-pipeline.ts checkDuplicate() to use source_call_id column (which exists since migration 20260303000004) AND make insertRecording() use UPSERT or handle the case where the recordings row exists but has no workspace_entries

## Symptoms

expected: 4 selected Fathom calls should import successfully into the FATHOM workspace
actual: Import fails immediately — "Import failed" toast appears, 0/4 imported
errors: "Import failed" toast in the UI, no detailed error shown
reproduction: Import > Fathom > Search date range > Select all 4 calls > Click Import > Fails
started: After commit 79a65556 (fix: pass workspace_id through syncMeeting) and 278b377c (fix: re-importable after workspace remove)

## Eliminated

- hypothesis: workspace_id regression in commit 79a65556 broke the function signature
  evidence: workspace_id is correctly passed through syncMeeting → runPipeline → ConnectorRecord.workspace_id. The import failure happens earlier in the pipeline at the dedup check / insert stage.
  timestamp: 2026-04-14

- hypothesis: all 4 calls are silently skipped (duplicate) and frontend misinterprets this as failure
  evidence: If checkDuplicate() correctly detected duplicates, all 4 would be 'skipped', finalStatus = 'completed', frontend would show "Successfully imported 0 calls". The "Import failed" toast requires job.status === 'failed', which requires failed.length > 0 AND synced.length === 0.
  timestamp: 2026-04-14

## Evidence

- timestamp: 2026-04-14T00:00:00Z
  checked: connector-pipeline.ts checkDuplicate() function (line 88)
  found: Filter uses .filter("source_metadata->>'external_id'", 'eq', externalId) — the key has inner single quotes in the PostgREST column expression.
  implication: This is likely INVALID PostgREST filter syntax. PostgREST parses the column as a literal string including the quotes, which won't match any real column. The query returns no rows → isDuplicate: false (fail-open). The existing recording is NOT detected as a duplicate.

- timestamp: 2026-04-14T00:01:00Z
  checked: fetch-meetings/index.ts line 409 (the working dedup check)
  found: Uses .filter('source_metadata->>external_id', 'in', ...) — no inner quotes around external_id.
  implication: Confirms the syntax difference. fetch-meetings works correctly; connector-pipeline does not.

- timestamp: 2026-04-14T00:02:00Z
  checked: supabase/migrations/20260303000004_add_source_call_id.sql
  found: A UNIQUE CONSTRAINT recordings_source_dedup exists on (organization_id, source_app, source_call_id). The source_call_id column is populated from source_metadata->>'external_id'. checkDuplicate() should be querying this column directly, not via JSONB filter.
  implication: When checkDuplicate() misses the existing row and insertRecording() tries to INSERT, Postgres throws a unique constraint violation on (organization_id, source_app, source_call_id). runPipeline() catches this → { success: false, error: "Failed to insert recording: duplicate key value violates unique constraint recordings_source_dedup" } → syncMeeting() returns 'failed' → all 4 calls fail → job.status = 'failed' → "Import failed" toast.

- timestamp: 2026-04-14T00:03:00Z
  checked: connector-pipeline.ts insertRecording() lines 171-188
  found: Uses plain INSERT (not upsert). If the recording row already exists, it will fail on the unique constraint rather than recover.
  implication: Even if we fix checkDuplicate(), the correct final behavior for re-importing a call (where the recordings row exists but has no workspace_entries) is NOT to insert a new recordings row, but to create a new workspace_entries row for the existing recording. insertRecording() doesn't handle this case.

## Resolution

root_cause: Two compounding bugs. (1) checkDuplicate() in connector-pipeline.ts uses invalid PostgREST JSONB filter syntax "source_metadata->>'external_id'" (inner quotes cause it to match nothing), making the dedup check always return isDuplicate=false. (2) insertRecording() then tries to INSERT a new recordings row which hits the recordings_source_dedup unique constraint (organization_id, source_app, source_call_id), causing a DB error. runPipeline returns { success: false, error: "..." } → syncMeeting returns 'failed' → all 4 fail → job.status = 'failed' → "Import failed" toast.
fix: In connector-pipeline.ts: (1) Rewrote checkDuplicate() to query source_call_id column directly (.eq('source_call_id', externalId)) instead of broken JSONB filter. Also added workspace_entries check — if recording exists but has zero entries, returns isDuplicate=false + existingRecordingId. (2) Added re-import path in runPipeline(): when existingRecordingId is set and hasWorkspaceEntries is false, creates a new workspace_entries row for the existing recording instead of attempting a new INSERT (which would hit the unique constraint). Deployed via: supabase functions deploy sync-meetings --use-api
verification: Awaiting user confirmation
files_changed: [supabase/functions/_shared/connector-pipeline.ts]
