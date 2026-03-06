---
phase: 05-demo-polish
plan: 05
subsystem: ui
tags: [bulk-actions, 4th-pane, layout, panel-store, react]

# Dependency graph
requires:
  - phase: 02-chat-foundation
    provides: Panel store pattern
provides:
  - Bulk action toolbar as 4th pane component
  - bulk-actions panel type in panelStore
affects: [07-differentiators]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "4th pane pattern for bulk selection actions"
    - "Flex row layout for content + action pane"

key-files:
  created: []
  modified:
    - src/stores/panelStore.ts
    - src/components/transcript-library/BulkActionToolbarEnhanced.tsx
    - src/components/transcripts/TranscriptsTab.tsx

key-decisions:
  - "Inline pane rendering instead of DetailPaneOutlet for selection state co-location"
  - "Actions organized into vertical sections (Tags, Export, AI, Organize)"

patterns-established:
  - "Bulk actions as 4th pane: w-[360px], slide-in-from-right, 500ms animation"

# Metrics
duration: 3min
completed: 2026-01-31
---

# Phase 05 Plan 05: Bulk Action Toolbar 4th Pane Summary

**Refactored bulk action toolbar from bottom Mac-style bar to right-side 4th pane for UI consistency with other detail panels**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-31T10:50:49Z
- **Completed:** 2026-01-31T10:54:41Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Added `bulk-actions` panel type to panelStore for type safety
- Converted BulkActionToolbarEnhanced from portal-based bottom bar to 4th pane component
- Restructured TranscriptsTab layout to accommodate pane-style bulk actions
- Actions now organized vertically in sections (Tags, Export, AI, Organize)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add bulk-actions panel type to store** - `f837d44` (feat)
2. **Task 2: Create BulkActionsPane component** - `f8ec15d` (feat)
3. **Task 3: Integrate with TranscriptsTab layout** - `41cce31` (feat)

## Files Created/Modified

- `src/stores/panelStore.ts` - Added 'bulk-actions' to PanelType union
- `src/components/transcript-library/BulkActionToolbarEnhanced.tsx` - Refactored from portal to pane component
- `src/components/transcripts/TranscriptsTab.tsx` - Changed layout from column to row for pane support

## Decisions Made

1. **Inline pane rendering vs DetailPaneOutlet:** Chose inline rendering because selection state is local to TranscriptsTab. Using panelStore would require lifting state up unnecessarily.
2. **Vertical action organization:** Grouped related actions into sections (Tags, Export, AI, Organize) for better discoverability in vertical layout.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- FIX-06 addressed: Bulk action toolbar uses 4th pane pattern
- No createPortal to bottom of screen
- Actions organized vertically in pane
- Animations follow 500ms standard (per brand guidelines)
- Consistent with other detail panes in the app

---
*Phase: 05-demo-polish*
*Completed: 2026-01-31*
