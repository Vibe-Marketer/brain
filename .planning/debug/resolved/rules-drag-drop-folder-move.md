# Debug: Dragging THE TABLE to Folder Toasted Success But Did Not Move

Date: 2026-06-09
Status: resolved

## Symptom

Dragging the `THE TABLE` call into the `THE TABLE` folder showed a success toast, but the call did not appear in the expected destination workspace/folder.

## Production Evidence

- Recording: `0352f7db-1ecf-4ed5-a61e-81bbe6760a63`
- Legacy recording ID: `152706780`
- Source: `fathom`
- Current workspace entry after drag:
  - workspace: `INBOX` (`2e57f0aa-e0bb-4e54-a602-33c9e606f2bf`)
  - folder_id: `5a8fb68c-8d71-4233-92b7-33b218f0e42b`
- Target folder:
  - folder: `THE TABLE` (`5a8fb68c-8d71-4233-92b7-33b218f0e42b`)
  - folder workspace: `AI Simple Founders` (`a8a541a6-51be-4b11-8b13-69fe55f6b2d5`)

The drag wrote the folder ID, but it left the `workspace_entries` row anchored to `INBOX`.

## Root Cause

`DndCallProvider` used `useAssignToFolder`, which called `assignCallToFolder(callRecordingId, folderId, user.id)` without passing workspace context.

`assignCallToFolder` only updated `workspace_entries.folder_id` for an existing row in the provided workspace. It never resolved the folder's actual workspace and never moved the recording into that workspace. For calls stuck in `INBOX`, this allowed a success toast after writing only legacy `folder_assignments` or after setting the target folder on the wrong workspace row.

## Fix

`assignCallToFolder` and `moveCallToFolder` now:

1. Resolve the canonical `recordings.id` from `legacy_recording_id`.
2. Resolve the target workspace from the destination folder.
3. Upsert the `workspace_entries` row for the folder's workspace with `folder_id`.
4. Remove stale workspace entries outside the target workspace.
5. Throw on source-of-truth write failures so the UI cannot show success after a partial move.

## THE LAB Comparison

The latest Fathom webhook `THE LAB` row found in production (`822d2ec8-260a-4ccc-a815-72d7881b71f5`, created `2026-06-02T20:13:11.362Z`) is also in `INBOX` with no routing stamp while the active `THE LAB` rule targets `AI Simple Founders`.

That historical row matches the connector fallback/routing precedence defect fixed in `5df1c0b65f2f5395570cf298f15422698184fd69`. It is not the same drag/drop bug, but it shares the same visible outcome: a call remained in `INBOX` when it should have been in `AI Simple Founders`.

## Verification

- `npm run test -- src/services/__tests__/folders.service.test.ts src/hooks/__tests__/useFolders.test.ts`
- `npm run build`
