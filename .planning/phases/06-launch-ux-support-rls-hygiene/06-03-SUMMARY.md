---
phase: 06-launch-ux-support-rls-hygiene
plan: 03
subsystem: ui
tags: [onboarding, empty-states, import-flow, tests]
requires:
  - phase: 06-launch-ux-support-rls-hygiene
    provides: first-run import routing and explicit sync controls from 06-01
provides:
  - Canonical no-calls empty state now directs users to connect a source
  - Launch-critical empty states in contacts/import history include concrete source CTAs
  - Registry tests that block file-upload/transcription-upload copy drift in launch entry surfaces
affects: [onboarding, import, contacts, workspace-management]
tech-stack:
  added: []
  patterns:
    - Empty states use one concrete primary action aligned to launch path
    - Import/onboarding tests enforce no hidden file-upload entry language
key-files:
  created: []
  modified:
    - src/components/transcript-library/EmptyStates.tsx
    - src/components/contacts/ContactsTable.tsx
    - src/components/import/ImportHistoryPanel.tsx
    - src/pages/__tests__/ImportPage.connector-routing.test.ts
    - src/components/panes/__tests__/ImportSourcePane.registry.test.ts
key-decisions:
  - "No-calls and contacts empty states prioritize Connect a source over dead-end/manual-only guidance."
  - "Launch regression tests explicitly ban reintroduction of file-upload promises while preserving Import Transcript wording."
patterns-established:
  - "Primary CTA consistency across launch empty states: Connect a source."
  - "Registry-level tests gate import-entry copy drift."
requirements-completed: [ONB-02]
duration: 15min
completed: 2026-06-01
---

# Phase 06 Plan 03: Launch UX Support RLS Hygiene Summary

**Launch-facing empty states now direct users to real import actions and tests prevent file-upload copy regressions.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-06-01T06:13:30Z
- **Completed:** 2026-06-01T06:28:30Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Updated canonical no-calls state copy/action to `Connect a source` with `/import` navigation.
- Patched launch-critical contacts and import history empty states so each presents a direct source-connection action.
- Added registry tests that block `FileUploadDropzone`/upload-promise copy drift while preserving `Import Transcript`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix canonical no-calls empty state copy and actions** - `3c65c045` (feat)
2. **Task 2: Patch launch-critical empty states across calls, contacts, workspaces, folders, and import history** - `a6532360` (feat)
3. **Task 3: Add registry tests preventing file-upload copy drift** - `4ac3153e` (test)

## Files Created/Modified
- `src/components/transcript-library/EmptyStates.tsx` - Canonical no-calls copy and primary CTA label aligned to launch contract.
- `src/components/contacts/ContactsTable.tsx` - Contacts empty-state copy and primary CTA now route toward source connection/import flow.
- `src/components/import/ImportHistoryPanel.tsx` - Added explicit empty-state `Connect a source` CTA.
- `src/pages/__tests__/ImportPage.connector-routing.test.ts` - Added launch-copy regression guards and explicit Import Transcript assertion.
- `src/components/panes/__tests__/ImportSourcePane.registry.test.ts` - Added registry guardrails against upload-copy drift and preserved paste-transcript label assertions.

## Decisions Made
- Kept workspace/folder management surfaces on structure-first create actions (`Create workspace`) because users are already in management context.
- Limited copy/regression checks to launch entry surfaces while leaving deferred v2 file-upload implementation code untouched.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- ONB-02 launch empty-state contract is enforced in code and tests.
- Ready for subsequent launch UX/support tasks in Phase 06.

## Verification

- `rg -n "Connect a recorder to bring your calls into CallVault|Connect a source|upload a file directly" src/components/transcript-library/EmptyStates.tsx` ✅
- `rg -n "No calls yet|Connect a source|Import transcript|Create workspace|Create folder|No contacts yet|audio or video|upload a file" src/components/transcripts src/components/panes src/components/settings src/components/contacts src/components/import` ✅ (matches in `src/components/import/FileUploadDropzone.tsx` are expected existing v2-deferred code; no regressions in edited launch surfaces)
- `npm run test -- --run src/pages/__tests__/ImportPage.connector-routing.test.ts src/components/panes/__tests__/ImportSourcePane.registry.test.ts` ✅
- `npm run build` ✅

## Self-Check: PASSED

---
*Phase: 06-launch-ux-support-rls-hygiene*
*Completed: 2026-06-01*
