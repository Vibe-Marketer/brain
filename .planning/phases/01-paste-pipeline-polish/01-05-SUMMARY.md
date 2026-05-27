---
phase: 01-paste-pipeline-polish
plan: 05
subsystem: ui
tags: [import-pane, onboarding, source-registry, hidden-sources]
requires:
  - phase: 01-03
    provides: Hidden route-level file-upload source handling
provides:
  - Import source pane tests for hidden upload-source behavior
  - Onboarding tests for omitted recording-file import cues
  - Source comments aligned with transcript-import positioning
affects: [phase-01-verification, onboarding, import-page]
tech-stack:
  added: []
  patterns:
    - Import source pane reads from VISIBLE_SOURCE_REGISTRY
    - Onboarding connector choices read from ONBOARDING_CONNECTORS
key-files:
  created: []
  modified:
    - src/components/panes/ImportSourcePane.tsx
    - src/components/onboarding/OnboardingModal.tsx
    - src/components/panes/__tests__/ImportSourcePane.registry.test.ts
    - src/components/onboarding/__tests__/OnboardingModal.registry.test.ts
    - src/lib/__tests__/onboarding-connectors.test.ts
key-decisions:
  - "Pane visibility remains registry-driven through VISIBLE_SOURCE_REGISTRY."
  - "Onboarding does not offer recording-file import in Phase 1."
  - "Transcript import remains separate from first-run connector setup cards."
patterns-established:
  - "Hidden upload-source behavior is locked by source-inspection tests at pane and onboarding boundaries."
requirements-completed: [MAN-06]
duration: 5min
completed: 2026-05-27
---

# Phase 01 Plan 05: Pane And Onboarding Upload Cleanup Summary

**Import pane and onboarding surfaces now lock the hidden upload-source rule through shared metadata and focused regression tests.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-27T22:39:00Z
- **Completed:** 2026-05-27T22:43:48Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Updated ImportSourcePane documentation to describe visible transcript-import sources instead of File Upload.
- Reworded the onboarding omission comment so it does not carry user-facing upload/transcription language.
- Added pane tests proving the pane reads from `VISIBLE_SOURCE_REGISTRY` and contains no visible upload-source copy.
- Added onboarding tests proving recording-file import cues are absent.
- Added onboarding-helper coverage proving both `file-upload` and `paste-transcript` stay out of first-run connector cards.

## Task Commits

1. **Task 1: Remove upload cues from import source panes using shared visibility rules** - `b473e2fd` (fix)
2. **Task 2: Remove onboarding upload cues without unrelated navigation work** - `b473e2fd` (fix)

## Files Created/Modified

- `src/components/panes/ImportSourcePane.tsx` - Aligns source description with visible transcript-import model.
- `src/components/onboarding/OnboardingModal.tsx` - Keeps recording-file import omitted without visible upload/transcription wording.
- `src/components/panes/__tests__/ImportSourcePane.registry.test.ts` - Guards pane hidden-source behavior.
- `src/components/onboarding/__tests__/OnboardingModal.registry.test.ts` - Guards onboarding source-card copy.
- `src/lib/__tests__/onboarding-connectors.test.ts` - Guards onboarding connector helper output.

## Decisions Made

- Kept pane/onboarding behavior centralized in existing registry/helper flows.
- Did not rename global navigation or redesign onboarding beyond the Phase 1 upload-cue cleanup.

## Deviations from Plan

None - plan executed exactly as written.

**Total deviations:** 0 auto-fixed.
**Impact on plan:** No scope change.

## Issues Encountered

None.

## Verification

- `npm test -- --run src/components/panes/__tests__/ImportSourcePane.registry.test.ts src/components/onboarding/__tests__/OnboardingModal.registry.test.ts src/lib/__tests__/onboarding-connectors.test.ts` - passed, 10 tests.
- `npm run build` - passed.
- Source inspection confirmed pane/onboarding implementation files contain no File Upload, audio/video, transcription, Save Transcript, or Paste Transcript cues.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for plan 01-04 final behavioral verification and browser/UI inspection.

---
*Phase: 01-paste-pipeline-polish*
*Completed: 2026-05-27*
