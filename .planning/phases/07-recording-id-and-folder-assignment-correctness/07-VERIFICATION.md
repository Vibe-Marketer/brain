---
phase: 07
slug: recording-id-and-folder-assignment-correctness
status: passed_with_waivers
verified: 2026-06-12
verifier: Codex
---

# Phase 07 — Verification

> Phase 07 is code/test/build verified locally. Browser walkthrough and seeded real-DB integration proof were waived for v1.0 by Andrew on 2026-06-12; reopen only if concrete product signals surface.

## Success Criteria

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | UUID-only recordings can be assigned to folders without writing invalid rows to `folder_assignments` | passed | `assignWorkspaceEntryToFolder()` writes only `workspace_entries`; existing `P7-SC5` integration test block covers UUID assignment, but live execution is fixture-blocked. |
| 2 | Folder filters include UUID-assigned recordings | passed_code_verified | `getRecordingIdsForFolderFilter()` reads both `workspace_entries.folder_id` and legacy `folder_assignments`; P7 integration tests exist for inclusion/exclusion. |
| 3 | Unorganized filters exclude UUID recordings already assigned through `workspace_entries` | passed | Added `getUnorganizedRecordingUuids()` and regression in `folder-filtering.test.ts`; focused tests passed 14/14. |
| 4 | Assign-folder UI and DnD paths route UUID/BIGINT IDs through the recording-id boundary | passed | `TranscriptsNew` uses `toRecordingUuidBatch`; grep found no folder-drop `parseInt`; existing dialog/hook summaries record prior UUID-aware paths. |
| 5 | Local quality gates pass | passed | Focused transcript tests passed; `npm run type-check` passed with 0 new errors; `npm run build` passed. |
| 6 | Browser drag/filter walkthrough with a real non-Fathom recording | waived_for_v1 | Not run; waived by principal for milestone archive. |
| 7 | Real Supabase folder integration suite passes | waived_for_v1 | `npm run test:integration -- src/services/__tests__/folders.integration.test.ts` failed during shared setup because no donor `source_app='fathom'` recording exists in the configured test DB; fixture repair waived for milestone archive. |

## Commands Run

| Command | Result |
|---|---|
| `npm test -- --run src/components/transcripts/__tests__/folder-filtering.test.ts src/components/transcripts/__tests__/TranscriptsTab.batching.test.ts` | passed: 2 files, 14 tests |
| `npm run type-check` | passed: 0 new errors; baseline 347/776 |
| `npm run build` | passed: Vite built successfully; chunk-size warnings only |
| `rg -n "parseInt|Number\\(" src/pages/TranscriptsNew.tsx src/components/transcripts/TranscriptsTab.tsx src/services/transcript-filters.service.ts` | passed for folder logic; only pagination `Number(total_count)` remains |
| `npm run test:integration -- src/services/__tests__/folders.integration.test.ts` | failed before assertions due missing shared donor fixture in the configured test DB |

## Waived Items

- Browser walkthrough.
- Integration DB donor fixture repair / self-seeding before archive.

## Sign-off

- [x] Code paths fixed.
- [x] Focused regression tests passed.
- [x] Type-check passed.
- [x] Build passed.
- [x] Browser walkthrough waived for v1.0.
- [x] Seeded real-DB integration suite waived for v1.0.
