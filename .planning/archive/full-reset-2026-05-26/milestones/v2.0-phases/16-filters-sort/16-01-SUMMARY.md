---
phase: 16-filters-sort
plan: "01"
subsystem: transcript-library
tags: [filters, popover, staged-apply, integration-tests]
dependency_graph:
  requires: []
  provides: [FILTER-01, FILTER-02, FILTER-03]
  affects: [FilterBar, SourceFilterPopover, ContactsFilterPopover]
tech_stack:
  added: []
  patterns: [staged-Apply-Clear-popover, pure-data-layer-tests]
key_files:
  created:
    - src/lib/__tests__/filter-bar-integration.test.ts
  modified:
    - src/components/transcript-library/SourceFilterPopover.tsx
    - src/components/transcript-library/ContactsFilterPopover.tsx
key_decisions:
  - "SourceFilterPopover uses controlled Popover (open/onOpenChange) + stagedSources state — matches TagFilterPopover, FolderFilterPopover, ContactsFilterPopover, DurationFilterPopover pattern"
  - "Integration tests operate at pure data layer (no React rendering) — tests filter state spread/removal logic directly"
  - "ContactsFilterPopover action buttons p-3 padding fix — aligns with TagFilterPopover border-t p-3 style"
metrics:
  duration: "4m"
  completed_date: "2026-03-30"
  tasks_completed: 2
  files_changed: 3
---

# Phase 16 Plan 01: Filter Popover Consistency and Integration Tests Summary

All 6 filter popovers now use consistent staged Apply/Clear pattern; integration tests verify AND stacking and pill removal independence.

## What Was Built

**Task 1 — SourceFilterPopover staged Apply/Clear pattern**

Rewrote `SourceFilterPopover` from immediate-apply (checkbox toggle directly called `onSourcesChange`) to a staged pattern matching the other 5 popovers:

- Added `isOpen` + `stagedSources` state
- `handleOpenChange` syncs `stagedSources` from `selectedSources` on open (prevents stale staged state across multiple popover open/close cycles)
- `handleSourceToggle` modifies `stagedSources` only (no side effects until Apply)
- `handleApply` commits `stagedSources` and closes popover
- `handleClear` resets to `[]`, commits, and closes popover
- Apply/Clear buttons styled with `border-t p-3 flex justify-end gap-2` (identical to TagFilterPopover)
- `<Popover>` changed to controlled: `open={isOpen} onOpenChange={handleOpenChange}`

Also fixed `ContactsFilterPopover`: action buttons container changed from `flex justify-end gap-2 pt-2 border-t` to `flex justify-end gap-2 border-t p-3` — now matches TagFilterPopover spacing.

**Task 2 — Integration tests for filter stacking and pill removal**

Created `src/lib/__tests__/filter-bar-integration.test.ts` with 11 test cases across 4 describe blocks:

- **AND stacking (3 tests):** Tags then sources produces combined state; 3 simultaneous filters all preserved; applying same dimension replaces not duplicates
- **Pill removal independence (4 tests):** Removing tags preserves sources+duration; removing sources preserves tags+duration; removing duration preserves tags+sources; removing participants preserves folders+tags
- **Clear all (1 test):** Resetting to `{}` removes all active filters; original object unchanged (immutability)
- **URL round-trip (3 tests):** Full combined state (all 8 filter dimensions) survives URL serialization; removing one filter from restored state leaves others intact; sources URL round-trip verified

## Verification

- TypeScript: 0 errors
- New integration tests: 11/11 passed
- Existing filter-utils tests: 48/48 passed (no regressions)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

Files created/modified:
- FOUND: src/components/transcript-library/SourceFilterPopover.tsx
- FOUND: src/components/transcript-library/ContactsFilterPopover.tsx
- FOUND: src/lib/__tests__/filter-bar-integration.test.ts

Commits:
- FOUND: 2158cc18 (feat(16-01): add staged Apply/Clear pattern to SourceFilterPopover)
- FOUND: 7b61aede (test(16-01): add integration tests for filter stacking and pill removal)
