---
phase: 01-paste-pipeline-polish
plan: 02
subsystem: ui
tags: [manual-import, react, tanstack-query, transcript-files]
requires:
  - phase: 01-01
    provides: Backend parser contract for supported manual transcript formats
provides:
  - Import Transcript modal copy and action labeling
  - Transcript-only file chooser for VTT, SRT, TXT, and Markdown
  - Canonical call-list cache invalidation after manual import
affects: [phase-01-verification, import-page, onboarding]
tech-stack:
  added: []
  patterns:
    - Manual import success uses invalidateCallListCaches(queryClient)
    - Transcript files are selected as text transcript inputs, not upload/transcription jobs
key-files:
  created: []
  modified:
    - src/components/import/PasteTranscriptModal.tsx
    - src/components/import/__tests__/PasteTranscriptModal.test.tsx
key-decisions:
  - "The modal title and submit action use Import Transcript."
  - "Transcript file selection accepts .vtt, .srt, .txt, and .md without audio/video language."
  - "Manual import success invalidates the shared call-list cache hubs."
patterns-established:
  - "Manual import UI uses choose/select transcript-file wording instead of upload/transcription wording."
requirements-completed: [MAN-02, MAN-05]
duration: 8min
completed: 2026-05-27
---

# Phase 01 Plan 02: Import Transcript Modal Summary

**The manual import modal now presents transcript import as the primary action, supports Markdown transcript files, and refreshes all call-list caches after success.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-27T22:32:00Z
- **Completed:** 2026-05-27T22:39:52Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Renamed the modal title and submit state from save-oriented copy to `Import Transcript` / `Importing...`.
- Reframed transcript-file selection with `Choose transcript file` copy and `.vtt,.txt,.srt,.md,text/vtt,text/plain,text/markdown` acceptance.
- Replaced remaining `Unknown` UI speaker fallback with `Unknown Speaker`.
- Swapped partial success invalidation for `invalidateCallListCaches(queryClient)`.
- Extended modal tests for `Import Transcript`, Markdown transcript-file affordances, no audio/video copy, and shared cache invalidation.

## Task Commits

1. **Task 1: Rename and constrain the modal to transcript import only** - `8a972d9b` (fix)
2. **Task 2: Keep the UI fresh after manual import success** - `8a972d9b` (fix)

## Files Created/Modified

- `src/components/import/PasteTranscriptModal.tsx` - Updates manual import copy, file accept list, speaker fallback, and success invalidation.
- `src/components/import/__tests__/PasteTranscriptModal.test.tsx` - Updates behavioral assertions for the new label, transcript-file support, and cache refresh behavior.

## Decisions Made

- Kept transcript-file selection available because Phase 1 supports transcript text files, while removing user-facing upload/transcription framing from this modal.
- Used the existing cache-invalidation helper rather than adding modal-specific invalidation keys.

## Deviations from Plan

None - plan executed exactly as written.

**Total deviations:** 0 auto-fixed.
**Impact on plan:** No scope change.

## Issues Encountered

The initial copy update caused the heading and button to share the same text, so the test was tightened to assert the heading role explicitly.

## Verification

- `npm test -- --run src/components/import/__tests__/PasteTranscriptModal.test.tsx` - passed, 22 tests.
- `npm run build` - passed.
- `git diff --check` - passed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for plan 01-03 and 01-05 upload-entry removal across import routing, panes, and onboarding.

---
*Phase: 01-paste-pipeline-polish*
*Completed: 2026-05-27*
