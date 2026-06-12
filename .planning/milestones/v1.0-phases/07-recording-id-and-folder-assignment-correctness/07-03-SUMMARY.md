---
phase: "07"
plan: "03"
subsystem: "folder-assignment-dnd"
tags: [folder, uuid, workspace_entries, dnd, recording-ids]
dependency_graph:
  requires:
    - assignWorkspaceEntryToFolder (folders.service.ts) — from 07-01
    - getAssignedWorkspaceEntryFolderUuids (transcript-filters.service.ts) — from 07-01
  provides:
    - UUID-aware drag-to-folder assignment in TranscriptsNew
    - shared canonical UUID unorganized-filter helper
    - regression coverage for UUID/workspace_entries unorganized filtering
  affects:
    - src/pages/TranscriptsNew.tsx
    - src/components/transcripts/TranscriptsTab.tsx
    - src/services/transcript-filters.service.ts
    - src/components/transcripts/__tests__/folder-filtering.test.ts
tech_stack:
  added: []
  patterns:
    - toRecordingUuidBatch boundary for UUID/BIGINT split
    - workspace_entries assignment for canonical UUID recordings
    - shared pure helper for unorganized canonical UUID filtering
key_files:
  created: []
  modified:
    - src/pages/TranscriptsNew.tsx
    - src/components/transcripts/TranscriptsTab.tsx
    - src/services/transcript-filters.service.ts
    - src/components/transcripts/__tests__/folder-filtering.test.ts
decisions:
  - "TranscriptsNew DnD routes mixed drag IDs through toRecordingUuidBatch instead of local parseInt/Number coercion."
  - "UUID DnD assignment is skipped with an explicit console error if no active workspace id exists; it does not call the service with an empty workspace id."
  - "Both TranscriptsTab unorganized-filter paths share getUnorganizedRecordingUuids so workspace_entries-assigned recordings are excluded consistently."
metrics:
  completed: "2026-06-12T00:34:00Z"
  tasks_completed: 2
  files_modified: 4
---

# Phase 07 Plan 03: DnD UUID Folder Assignment and Remaining Filter Drift Summary

Closed the remaining Phase 07 folder correctness gaps found by the milestone audit.

## What Was Built

- `TranscriptsNew.tsx`: drag-to-folder assignment now normalizes dragged IDs once, resolves them through `toRecordingUuidBatch`, keeps legacy numeric assignments on the existing `assignToFolder` path, and sends originally-UUID recordings to `assignWorkspaceEntryToFolder`.
- `TranscriptsNew.tsx`: removed the folder-drop `parseInt` branch from both sidebar folder drops and legacy inline `folder-zone` drops.
- `TranscriptsTab.tsx`: the workspace-scoped filter-bar "unorganized" path now uses `getAssignedWorkspaceEntryFolderUuids`, matching the all-calls path.
- `transcript-filters.service.ts`: added `getUnorganizedRecordingUuids()` to dedupe canonical UUIDs and remove any UUID already assigned through `workspace_entries` or resolved legacy assignments.
- `folder-filtering.test.ts`: added a regression proving a canonical UUID already assigned through `workspace_entries` is not treated as unorganized.

## Verification

- `npm test -- --run src/components/transcripts/__tests__/folder-filtering.test.ts src/components/transcripts/__tests__/TranscriptsTab.batching.test.ts` — passed, 14/14 tests.
- `npm run type-check` — passed with 0 new errors; baseline remains 347/776.
- `npm run build` — passed; Vite chunk-size warnings only.
- `rg -n "parseInt|Number\\(" src/pages/TranscriptsNew.tsx src/components/transcripts/TranscriptsTab.tsx src/services/transcript-filters.service.ts` — no folder-drop parseInt remains; only `Number(filteredRows[0].total_count)` remains in pagination count handling.
- `npm run test:integration -- src/services/__tests__/folders.integration.test.ts` — blocked by test-fixture setup, not by the Phase 07 assertions: configured integration DB has no donor `source_app='fathom'` recording, and existing folder/auto-tag/share-call suites fail on the same missing donor fixture.

## Deviations from Plan

- The plan suggested local `isLegacyId` + `parseInt` branching. The final implementation uses the repository's stronger boundary, `toRecordingUuidBatch`, to comply with the locked rule that UUID/BIGINT crossings go through `src/lib/recording-ids.ts`.
- No new integration test block was added because `src/services/__tests__/folders.integration.test.ts` already contains `P7-SC5: UUID recording folder assignment round-trip` with the required UUID assign/filter/unassign cases.

## Human-Needed Verification

- Browser walkthrough remains human_needed because this session did not authenticate into the app and manually drag a live non-Fathom/canonical recording into a folder.
- Seeded real-DB folder integration remains human_needed until the Supabase test project has a donor Fathom recording or the integration fixtures are made self-seeding.

## Self-Check: PASSED
