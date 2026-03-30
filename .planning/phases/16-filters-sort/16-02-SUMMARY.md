---
phase: 16-filters-sort
plan: "02"
subsystem: filters-sort
tags: [sort, filter, search-syntax, tdd, tests]
dependency_graph:
  requires: []
  provides: [useTableSort tests, status: inline search operator]
  affects: [TranscriptsTab query filtering, filter-utils interfaces]
tech_stack:
  added: []
  patterns: [TDD red-green, client-side filter, URL persistence]
key_files:
  created:
    - src/lib/__tests__/useTableSort.test.ts
  modified:
    - src/lib/filter-utils.ts
    - src/lib/__tests__/filter-utils.test.ts
    - src/components/transcripts/TranscriptsTab.tsx
decisions:
  - "status filter applied client-side only in workspace path — all recordings-table rows are synced:true so ALL CALLS PATH would never produce unsynced results"
  - "status: operator has no short alias — matches plan spec, keeps it unambiguous"
  - "Both statuses in query (status:synced status:unsynced) treated as no-op filter (both match) — natural OR semantics"
metrics:
  duration: "181s"
  completed: "2026-03-30"
  tasks: 2
  files: 4
---

# Phase 16 Plan 02: Sort Hook Tests + status: Operator Summary

**One-liner:** TDD-verified sort hook for all 5 columns + status:synced/unsynced inline search operator restored end-to-end with URL persistence.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add sort hook tests, verify direction indicators | ff44de33 | src/lib/__tests__/useTableSort.test.ts |
| 2 | Restore status: operator and wire into query filtering | dd8e2e73 | src/lib/filter-utils.ts, src/lib/__tests__/filter-utils.test.ts, src/components/transcripts/TranscriptsTab.tsx |

## What Was Built

### Task 1: Sort Hook Tests (FILTER-04)

Created `src/lib/__tests__/useTableSort.test.ts` with 13 tests covering:
- All 5 sort columns: title, date, duration, participants, source
- Both asc and desc directions for each column
- handleSort toggle behavior (same field toggles, new field resets to desc)
- Immutability (original array not mutated)

All tests pass against the existing `useTableSort` implementation which already had correct handlers for all 5 fields. The `SortButton` component in `TranscriptTable.tsx` was confirmed to render `RiArrowUpLine` (asc) / `RiArrowDownLine` (desc) / `RiArrowUpDownLine` (inactive) with `text-foreground` active styling — FILTER-04 "visible direction indicator" requirement satisfied.

### Task 2: status: Operator (FILTER-05)

**filter-utils.ts changes:**
- Added `status?: string[]` to `SearchSyntax.filters` interface
- Added `status?: string[]` to `FilterState` interface
- Added `case 'status'` to `parseSearchSyntax` switch (no short alias)
- Added `status` mapping in `syntaxToFilters` (filters.status = syntax.filters.status)
- Added `status` serialization in `filtersToURLParams` (params 'status' = joined string)
- Added `status` deserialization in `urlParamsToFilters` (split on comma)

**TranscriptsTab.tsx changes:**
- Added `status` to `combinedFilters` useMemo from `syntax.filters.status`
- Added client-side status filter in workspace query path: `call.synced === true` for 'synced', `!isSynced` for 'unsynced', both = no-op

**filter-utils.test.ts changes:**
- Replaced old "status: treated as plain text" assertion with 4 new tests for status: parsing
- Added `syntaxToFilters - Status Filter` describe block (2 tests)
- Added `URL Persistence - Status Filter` describe block (3 tests)
- Total: 56 tests (was 48, +8 new tests replacing 1)

## Test Results

```
Tests: 182 passed (6 files)
TypeScript: 0 errors
```

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written with one note:

**[Clarification] ALL CALLS PATH status filter deferred to client-side note only**
- **Found during:** Task 2
- **Issue:** The ALL CALLS PATH uses server-side pagination; applying client-side status filter after pagination would break counts. All recordings-table rows map to `synced: true` (via `mapRecordingToMeeting`), so filtering by `status:unsynced` on that path would always return 0 results.
- **Resolution:** Status filter applied only in workspace path (client-side on `mappedRecordings`) where unsynced meetings can appear. Added a comment in the ALL CALLS PATH explaining why no filter is applied there.

## Known Stubs

None — all functionality is fully wired.

## Self-Check: PASSED

- FOUND: src/lib/__tests__/useTableSort.test.ts
- FOUND: src/lib/filter-utils.ts
- FOUND: src/lib/__tests__/filter-utils.test.ts
- FOUND: src/components/transcripts/TranscriptsTab.tsx
- FOUND commit: ff44de33 (Task 1)
- FOUND commit: dd8e2e73 (Task 2)
