---
phase: 01-paste-pipeline-polish
plan: 03
subsystem: ui
tags: [import-routing, source-registry, file-upload, compatibility]
requires: []
provides:
  - Hidden route-level file-upload source handling
  - Import route without FileUploadDropzone reachability
  - Compatibility audit for historical file-upload rows
affects: [phase-01-verification, import-source-pane, onboarding]
tech-stack:
  added: []
  patterns:
    - Hidden internal sources can remain in SOURCE_REGISTRY while getImportSourceFlow returns unknown for user navigation
key-files:
  created: []
  modified:
    - src/pages/ImportPage.tsx
    - src/lib/import-source-flow.ts
    - src/config/source-registry.ts
    - src/components/connectors/registry/adapters/file-upload.ts
    - src/pages/__tests__/ImportPage.connector-routing.test.ts
    - src/lib/__tests__/import-source-flow.test.ts
    - src/components/connectors/registry/__tests__/connectorRegistry.test.ts
key-decisions:
  - "The file-upload source remains as hidden compatibility metadata because production has one existing recording row."
  - "The import route no longer contains a FileUploadDropzone branch."
  - "Stale file-upload navigation resolves to unknown instead of opening an upload/transcription surface."
patterns-established:
  - "Internal compatibility sources are hidden through registry visibility plus route-flow classification."
requirements-completed: [MAN-06]
duration: 7min
completed: 2026-05-27
---

# Phase 01 Plan 03: File Upload Route Removal Summary

**The import route no longer exposes the deferred file-upload transcription path while preserving internal compatibility for historical rows.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-27T22:35:00Z
- **Completed:** 2026-05-27T22:42:20Z
- **Tasks:** 1
- **Files modified:** 7

## Accomplishments

- Removed `FileUploadDropzone` import and route branch from `ImportPage.tsx`.
- Changed stale `file-upload` source navigation to resolve to `unknown` in `getImportSourceFlow`.
- Kept the hidden `file-upload` source ID and connector setup compatibility for historical data.
- Updated visible manual route copy to `Import Transcript` and removed audio/video upload guidance.
- Added route/flow/registry tests proving the hidden-source behavior.

## Compatibility Audit

- Source inspection confirms `FileUploadDropzone` remains only in its own hidden component and is not imported by `ImportPage.tsx`.
- Non-destructive Supabase count query found `recordings.source_app = 'file-upload'`: 1 row.
- Non-destructive Supabase count query found `import_sources.source_app = 'file-upload'`: 0 rows.
- Decision: preserve internal source metadata and adapter compatibility; do not delete `file-upload` code in Phase 1.

## Task Commits

1. **Task 1: Audit compatibility and remove file-upload route reachability** - `1987973a` (fix)

## Files Created/Modified

- `src/pages/ImportPage.tsx` - Removes the file-upload branch and updates manual import copy.
- `src/lib/import-source-flow.ts` - Maps hidden `file-upload` navigation to `unknown`.
- `src/config/source-registry.ts` - Keeps `file-upload` hidden and relabels visible manual import to `Import Transcript`.
- `src/components/connectors/registry/adapters/file-upload.ts` - Keeps hidden compatibility adapter copy.
- `src/pages/__tests__/ImportPage.connector-routing.test.ts` - Guards against `FileUploadDropzone` route reachability.
- `src/lib/__tests__/import-source-flow.test.ts` - Locks stale `file-upload` flow to `unknown`.
- `src/components/connectors/registry/__tests__/connectorRegistry.test.ts` - Verifies internal-only compatibility remains.

## Decisions Made

- Preserved the hidden source ID and adapter because production data still references `file-upload`.
- Avoided a broader navigation/sidebar rename; only touched the route-level import flow required by the plan.

## Deviations from Plan

None - plan executed exactly as written.

**Total deviations:** 0 auto-fixed.
**Impact on plan:** No scope change.

## Issues Encountered

Some existing tests assumed `file-upload` was a selectable flow. They were updated to match the Phase 1 hidden-source decision while preserving adapter setup compatibility.

## Verification

- `npm test -- --run src/pages/__tests__/ImportPage.connector-routing.test.ts src/lib/__tests__/import-source-flow.test.ts src/components/connectors/registry/__tests__/connectorRegistry.test.ts` - passed, 38 tests.
- `npm run build` - passed.
- `rg -n "FileUploadDropzone|sourceFlow === \"file-upload\"|Save Transcript|Paste Transcript|audio or video|Upload audio|upload a transcript|upload transcript" src/pages/ImportPage.tsx src/lib/import-source-flow.ts src/config/source-registry.ts src/components/connectors/registry/adapters/file-upload.ts src/components/panes/ImportSourcePane.tsx src/components/onboarding/OnboardingModal.tsx src/lib/onboarding-connectors.ts` - no matches.
- Supabase count audit for `file-upload` references - completed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for plan 01-05 to verify and lock pane/onboarding hidden-source behavior.

---
*Phase: 01-paste-pipeline-polish*
*Completed: 2026-05-27*
