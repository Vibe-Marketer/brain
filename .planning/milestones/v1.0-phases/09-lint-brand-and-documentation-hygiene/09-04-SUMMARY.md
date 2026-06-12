---
phase: 09-lint-brand-and-documentation-hygiene
plan: 04
subsystem: ui
tags: [react, hooks, eslint, exhaustive-deps, react-hooks]

# Dependency graph
requires:
  - phase: 09-01
    provides: stale-eslint-disable auto-fixes already applied
  - phase: 09-03
    provides: unused-vars renamed to _prefix
provides:
  - All react-hooks/exhaustive-deps warnings resolved across 10 files
  - Safe dep additions (scalar .length values, stable queryClient singleton)
  - Risky dep suppressions with mandatory explanatory comments (realtime subscriptions, inline function patterns)
affects: [09-lint-brand-and-documentation-hygiene]

# Tech tracking
tech-stack:
  added: []
  patterns: [eslint-disable-next-line with explanatory comment for risky hook dep suppressions]

key-files:
  created: []
  modified:
    - src/components/SmartExportDialog.tsx
    - src/components/import/PasteTranscriptModal.tsx
    - src/pages/OrganizationPage.tsx
    - src/components/contacts/ReengagementEmailModal.tsx
    - src/components/connectors/ConnectionsPanel.tsx
    - src/hooks/useSyncTabState.ts
    - src/hooks/useCategorySync.ts
    - src/components/settings/AccountTab.tsx
    - src/pages/Analytics.tsx
    - src/pages/SetupWizard.tsx

key-decisions:
  - "useCategorySync activeOrgId added to createTag useCallback — reactive context value, safe to include"
  - "ConnectionsPanel accounts logical expression moved inside useMemo to prevent reference instability"
  - "OrganizationPage suppresseed with eslint-disable-next-line — activeOrganization from outer-scope context is reactive but ESLint treats nested component closures as non-reactive outer scope"
  - "useSyncTabState realtime subscription suppressions — all three warnings from the hybrid realtime+polling effect suppressed to prevent re-subscription on job state changes"
  - "Analytics selectedCategory dep suppressed — adding would create feedback loop between URL-sync effects"

patterns-established:
  - "Safe dep add: scalar .length values and stable singletons (queryClient) are always safe to add"
  - "Risky suppress: eslint-disable-next-line react-hooks/exhaustive-deps with mandatory adjacent comment naming the specific re-subscription or re-render risk"

requirements-completed: []

# Metrics
duration: 35min
completed: 2026-06-10
---

# Phase 09 Plan 04: react-hooks/exhaustive-deps Fixes Summary

**All react-hooks/exhaustive-deps warnings eliminated: safe dep additions for scalar values and queryClient singleton, risky suppressions with mandatory explanatory comments for realtime subscriptions and inline function patterns**

## Performance

- **Duration:** 35 min
- **Started:** 2026-06-10T07:00:00Z
- **Completed:** 2026-06-10T07:35:00Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Eliminated all `react-hooks/exhaustive-deps` warnings across the codebase (0 remaining in full lint run)
- Applied 4 safe dep additions without semantic behavior changes (scalar `.length` values, stable `queryClient` singleton, `activeOrgId` reactive context value)
- Applied 7 risky suppressions with mandatory explanatory comments (realtime subscriptions, inline async functions, init effects)
- Moved `accounts` logical expression inside `useMemo` in `ConnectionsPanel` to prevent new-array-on-every-render reference instability
- `npm run type-check` exits 0, `npm run build` passes at 24.68s

## Task Commits

1. **Task 1: Apply safe hook dep fixes** - `ba99d7d3` (fix)
2. **Task 2: Suppress risky hook dep warnings with explanatory comments** - `3269e99d` (fix)

## Files Created/Modified

- `src/components/SmartExportDialog.tsx` - Added `availableWorkspaces.length`, `excludedWorkspaces.length` to `outputDescription` useMemo dep array
- `src/components/import/PasteTranscriptModal.tsx` - Added `sourceLinkMetadata?.author_name` to parsed useMemo dep array
- `src/pages/OrganizationPage.tsx` - Suppressed outer-scope context false-positive with explanatory comment
- `src/components/contacts/ReengagementEmailModal.tsx` - Suppressed with comment: contact?.id is the identity key, full object not needed
- `src/components/connectors/ConnectionsPanel.tsx` - Moved `accounts` logical expression inside useMemo callback; updated dep array to `[rows, accountsQuery.data, scope, workspaceId]`
- `src/hooks/useSyncTabState.ts` - Added `queryClient` to `handleJobCompleted` useCallback (safe stable singleton); suppressed stale-ref cleanup warning on `.clear()`, realtime subscription missing-deps, and `loadTags` inline function dep
- `src/hooks/useCategorySync.ts` - Added `activeOrgId` to `createTag` useCallback dep array; suppressed `loadTags` inline function dep in useEffect
- `src/components/settings/AccountTab.tsx` - Suppressed mount-only init effect (loadProfileData, loadPreferences defined inline)
- `src/pages/Analytics.tsx` - Suppressed `selectedCategory` dep to prevent feedback loop between URL-sync effects
- `src/pages/SetupWizard.tsx` - Suppressed `connectedMeta`/`connectedSources` deps to prevent initialization re-run loop

## Decisions Made

- `activeOrgId` in `useCategorySync.createTag` is a safe add — reactive context state must be current when creating tags for the correct organization
- `ConnectionsPanel.accounts` restructure chosen over the alternative `useMemo(accounts, [rows, accountsQuery.data])` wrapper — keeping the resolution inside the existing memo is simpler and avoids a double-memo pattern
- `OrganizationPage` outer-scope false-positive suppressed rather than restructuring to a direct child component — too large a refactor for a lint hygiene phase
- `Analytics.selectedCategory` suppressed not added — the effect checks it as an idempotent guard; adding it would cause the two URL-sync effects to feed back into each other

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] AccountTab.tsx is the file with loadPreferences warning, not useUserPreferences.ts**
- **Found during:** Task 2 setup
- **Issue:** Research doc attributed the `loadPreferences` missing-dep warning to `useUserPreferences.ts`, but the actual warning was in `src/components/settings/AccountTab.tsx` (which imports `loadPreferences` from `usePreferencesStore` and calls it in a mount effect)
- **Fix:** Applied suppression to `AccountTab.tsx` instead
- **Files modified:** `src/components/settings/AccountTab.tsx`
- **Verification:** 0 exhaustive-deps warnings in full lint run

---

**Total deviations:** 1 auto-fixed (Rule 1 — research file mapping discrepancy)
**Impact on plan:** No scope change — same fix applied to the correct file.

## Issues Encountered

- ESLint OOM (exit 137) when running scoped lint on individual large component files — worked around by verifying via full `npm run lint` which ran successfully
- `completedJobTimeoutsRef.current` stale-ref suppression required `// eslint-disable-line` inline syntax on the specific `.clear()` line rather than `// eslint-disable-next-line` on the preceding line, because the warning fires on the `.clear()` call specifically
- `OrganizationPage` suppression required trial of three dep array variants before landing on `// eslint-disable-next-line` placed immediately before the closing `}, [dep])` line

## Known Stubs

None — this plan makes no UI or data changes; it only modifies ESLint directive comments and hook dep arrays.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced.

## Next Phase Readiness

- Phase 09 exhaustive-deps cleanup complete (0 warnings remaining)
- All phase 09 lint gates pass: type-check exit 0, build passes, exhaustive-deps count 0
- Phase 09-05 (if any) can proceed without exhaustive-deps noise obscuring other warnings

---
*Phase: 09-lint-brand-and-documentation-hygiene*
*Completed: 2026-06-10*
