# Plan 05-04 Summary: Canonical SyncTab Synced Transcripts

## Completed

- Replaced the Synced Transcripts read path with canonical `recordings` rows.
- Added workspace-scoped synced results through `workspace_entries -> recordings`.
- Preserved SyncTab’s Import Meetings workflow, source/date controls, active jobs, unsynced section, and synced table section.
- Added `workspaceId` to `useExistingTranscripts` query keys and service filters.
- Kept tag assignment lookup on canonical recording UUIDs via `toRecordingUuidBatch()`.
- Mapped share/source URLs through `resolveShareUrl()` instead of reading a top-level `recordings.share_url`.
- Widened synced selection state to support canonical UUIDs while preserving legacy numeric IDs.

## Verification

- `npm test -- --run src/services/__tests__/sync-tab.service.test.ts`
  - Passed: 3 tests.
- `npm run build`
  - Passed.
  - Existing warnings only: Vite CJS API deprecation, `jspdf`/`docx` mixed dynamic/static imports, large chunk warnings.
- Source guard confirmed `fetchSyncedCalls()` contains `.from("recordings")`, workspace ID wiring, and no `.from("fathom_calls")` in the synced-list path.

## Notes

- `checkSyncedRecordingIds()` still uses `fathom_calls` for the unsynced Fathom preview marker path; the Plan 05-04 replacement target was `fetchSyncedCalls()` / Synced Transcripts.
