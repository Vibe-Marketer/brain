---
phase: 06-launch-ux-support-rls-hygiene
plan: 01
subsystem: ui
tags: [onboarding, import-flow, connector-sync, trial-routing]
requires:
  - phase: 05-connector-reliability-workspace-binding-connections
    provides: connector setup/routing defaults and import source persistence
provides:
  - Trial completion routes into contextual connector import flow
  - One-time founder onboarding video modal over import surface
  - Explicit Sync all CTA for historical connector imports
affects: [onboarding, import, connectors, setup]
tech-stack:
  added: []
  patterns:
    - Route/query onboarding hints consumed once and cleared from URL
    - Explicit user CTA required before historical import execution
key-files:
  created:
    - src/components/onboarding/OnboardingVideoModal.tsx
  modified:
    - src/pages/SetupTrialUpsell.tsx
    - src/pages/ImportPage.tsx
    - src/components/connectors/ConnectorImportWizard.tsx
    - src/components/connectors/__tests__/ConnectorImportWizard.test.tsx
    - src/pages/__tests__/ImportPage.connector-routing.test.ts
key-decisions:
  - "First-run onboarding video trigger is URL/localStorage hint only and does not change data access."
  - "OAuth return no longer triggers historical connector sync automatically."
patterns-established:
  - "Import first-run context is preserved through trial exit and consumed safely by ImportPage."
  - "Connector historical import remains explicit through Sync all / Sync selected controls."
requirements-completed: [ONB-01, ONB-04]
duration: 18min
completed: 2026-06-01
---

# Phase 06 Plan 01: Launch UX Support RLS Hygiene Summary

**Post-trial onboarding now lands directly in the relevant connector import surface, shows a one-time founder video, and requires explicit Sync all for historical imports.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-06-01T05:55:00Z
- **Completed:** 2026-06-01T06:13:21Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Preserved onboarding connector context across `/setup/trial` app entry and checkout success, routing into `/import` with source context and first-run video marker.
- Added reusable `OnboardingVideoModal` with env-backed video embed and fallback copy while keeping CTA available when URL is absent.
- Updated connector import UX to surface `Sync all` as primary and removed auto-sync of historical calls on OAuth return.

## Task Commits

1. **Task 1: Preserve trial completion context and route into the first connector import surface** - `6ed66c8d` (feat)
2. **Task 2: Add reusable founder onboarding video modal** - `e526f4ef` (feat)
3. **Task 3: Make historical import explicit with `Sync all` as primary** - `a86593ce` (feat)

## Files Created/Modified
- `src/components/onboarding/OnboardingVideoModal.tsx` - New reusable onboarding video dialog with fallback mode.
- `src/pages/SetupTrialUpsell.tsx` - Carries connector context and first-run marker into import success paths.
- `src/pages/ImportPage.tsx` - Consumes onboarding params safely, opens one-time video modal, and stops auto historical sync.
- `src/components/connectors/ConnectorImportWizard.tsx` - Adds explicit `Sync all` primary and `Sync selected` secondary actions.
- `src/components/connectors/__tests__/ConnectorImportWizard.test.tsx` - Updated assertions for sync controls and setup payload shape.
- `src/pages/__tests__/ImportPage.connector-routing.test.ts` - Updated routing assertions to enforce no auto historical sync.

## Decisions Made
- Keep onboarding route/localStorage markers as UI hints only; no server authorization or data scope derives from them.
- Require explicit user action (`Sync all`/`Sync selected`) before historical imports.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added missing `useOrgContext` mock in ConnectorImportWizard unit tests**
- **Found during:** Task 3 verification
- **Issue:** test suite failed with `useNavigate() may be used only in the context of a <Router>` due ConnectorSetupCluster dependency.
- **Fix:** mocked `@/hooks/useOrgContext` and normalized existing assertions to `objectContaining` where setup payload includes workspace/source ids.
- **Files modified:** `src/components/connectors/__tests__/ConnectorImportWizard.test.tsx`
- **Verification:** `npm run test -- --run src/components/connectors/__tests__/ConnectorImportWizard.test.tsx src/pages/__tests__/ImportPage.connector-routing.test.ts`
- **Commit:** `a86593ce`

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** No scope creep; fix was required to satisfy plan verification gates.

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None.

## Verification

- `npm run test -- --run src/pages/__tests__/SetupTrialUpsell.registry.test.ts src/pages/__tests__/ImportPage.connector-routing.test.ts` ✅
- `rg -n "Start with your call library|Start syncing calls|callvault_onboarding_video_seen|VITE_ONBOARDING_VIDEO_URL" src/components/onboarding/OnboardingVideoModal.tsx src/pages/ImportPage.tsx` ✅
- `npm run test -- --run src/components/connectors/__tests__/ConnectorImportWizard.test.tsx src/pages/__tests__/ImportPage.connector-routing.test.ts && npm run build` ✅

## Self-Check: PASSED
