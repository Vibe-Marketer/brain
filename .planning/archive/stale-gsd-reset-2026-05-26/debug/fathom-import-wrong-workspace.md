---
status: awaiting_human_verify
trigger: "fathom-import-wrong-workspace — Imported Fathom calls appear in MY CALLS workspace instead of selected FATHOM destination workspace"
created: 2026-04-14T00:00:00Z
updated: 2026-04-14T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — workspace_id never reaches runPipeline(); the pipeline creates workspace_entry in personal/home workspace, then the trigger duplicates in HOME. Outer code tries to add a second FATHOM workspace_entry but calls are already in MY CALLS.
test: N/A — root cause confirmed through code trace
expecting: N/A
next_action: Fix syncMeeting() to accept and pass workspace_id into runPipeline()

## Symptoms

expected: Imported Fathom calls should appear in the "FATHOM" workspace that was selected as the destination
actual: All 4 imported calls appear in "MY CALLS" workspace. FATHOM workspace is empty.
errors: No visible errors — import seems to "succeed" but routes to wrong workspace
reproduction: Go to Import > Fathom, set destination to "FATHOM (personal)" workspace, search and import calls. Calls appear in MY CALLS instead.
started: Current production behavior on app.callvaultai.com

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-04-14
  checked: FathomImportDetail.tsx handleImport (line 327-334)
  found: workspace_id IS correctly included in the sync-meetings invocation body
  implication: The frontend sends the workspace_id — problem is in the backend

- timestamp: 2026-04-14
  checked: sync-meetings/index.ts lines 446-463
  found: workspace_id is parsed and validated against workspace_memberships, stored as validatedVaultId
  implication: Backend receives and validates workspace_id correctly

- timestamp: 2026-04-14
  checked: sync-meetings/index.ts syncMeeting() function signature (line 51-58) and its runPipeline() call (line 131-140)
  found: syncMeeting() does NOT accept a workspace_id parameter. Its runPipeline() call has no workspace_id field.
  implication: workspace_id is validated at the top but NEVER reaches the pipeline. Pipeline falls back to personal workspace (MY CALLS).

- timestamp: 2026-04-14
  checked: sync-meetings/index.ts lines 625-651 (after syncMeeting returns 'synced')
  found: Code attempts to create a workspace_entry in validatedVaultId AFTER the fact by querying the recording back. This is a second insertion, AFTER pipeline already created the home entry.
  implication: Even this second insertion may fail or create a duplicate if connector-pipeline's insertRecording already handled workspace. The recording is still visible in MY CALLS because the trigger auto_home_workspace_entry fires on INSERT and creates a HOME entry, and the pipeline's insertRecording() also creates a personal workspace entry.

- timestamp: 2026-04-14
  checked: connector-pipeline.ts insertRecording() lines 206-273
  found: When record.workspace_id is NOT set, pipeline creates workspace_entry in personal workspace. When record.workspace_id IS set (explicit), it creates entry in that workspace AND deletes the HOME entry. But since workspace_id is never passed to runPipeline(), the explicit-workspace path never executes.
  implication: The fix is to pass workspace_id from the outer processSyncJob scope into syncMeeting() → runPipeline(). The pipeline already has perfect logic for explicit workspace destinations including HOME entry cleanup.

- timestamp: 2026-04-14
  checked: ensure_recording_home_entry trigger (lifecycle_rules migration)
  found: Trigger fires AFTER INSERT on recordings, adds entry to is_home workspace (MY CALLS). connector-pipeline's insertRecording() explicitly removes this HOME entry when an explicit workspace_id is set (lines 248-262).
  implication: The trigger is not the bug — the pipeline handles it correctly when workspace_id flows through. Bug is purely the broken data flow.

## Resolution

root_cause: syncMeeting() in sync-meetings/index.ts did not accept or pass workspace_id to runPipeline(). workspace_id was validated in the request handler (stored as validatedVaultId) but never flowed into the per-meeting sync function. The pipeline received no workspace_id, fell back to the personal/home workspace (MY CALLS), and the auto_home_workspace_entry trigger fired on INSERT adding the recording to MY CALLS. The redundant post-hoc workspace_entry insertion block was dead code that could never fix the underlying misrouting.
fix: Added workspaceId optional parameter to syncMeeting(). Spread it into the runPipeline() ConnectorRecord when truthy. Removed the redundant post-hoc workspace_entry insertion block in processSyncJob. The connector pipeline's insertRecording() already has correct explicit-workspace logic: when workspace_id is set, it creates the entry in the chosen workspace and deletes the auto-created HOME entry.
verification: Deployed to production via `supabase functions deploy sync-meetings --use-api`. Commit 79a65556.
files_changed: [supabase/functions/sync-meetings/index.ts]
