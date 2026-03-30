---
phase: 14-onboarding-e2e
plan: "01"
subsystem: onboarding
tags: [onboarding, routing, wizard, auth]
dependency_graph:
  requires: []
  provides: [working-onboarding-e2e-flow]
  affects: [ProtectedRoute, OnboardingModal, Layout]
tech_stack:
  added: []
  patterns: [window.open for new-tab flows without unmounting wizard]
key_files:
  created: []
  modified:
    - src/components/ProtectedRoute.tsx
    - src/components/onboarding/OnboardingModal.tsx
    - src/components/Layout.tsx
    - src/pages/OAuthCallback.tsx
decisions:
  - "ProtectedRoute is now a pure auth guard — no onboarding/wizard/transcript redirect logic; Layout.tsx owns all onboarding concerns"
  - "Connect source buttons use window.open(_blank) so OnboardingModal stays mounted while user completes OAuth in new tab"
  - "Post-onboarding navigation done in Layout via handleOnboardingComplete wrapper — not inside OnboardingModal itself"
metrics:
  duration: "2m11s"
  completed_date: "2026-03-30"
  tasks_completed: 2
  files_modified: 4
---

# Phase 14 Plan 01: Onboarding E2E Flow Fixes Summary

**One-liner:** Removed wizard redirect from ProtectedRoute, switched connect buttons to window.open new-tab pattern, and added navigate('/') post-completion in Layout — enabling full onboarding flow without page navigation hijacking.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix ProtectedRoute — pure auth guard | ea3c31c6 | src/components/ProtectedRoute.tsx |
| 2 | Fix OnboardingModal + Layout post-completion nav | f3000f7e | src/components/onboarding/OnboardingModal.tsx, src/components/Layout.tsx, src/pages/OAuthCallback.tsx |

## What Was Built

Three specific bugs in the onboarding E2E flow were fixed:

**Bug 1 (ONBOARD-01) — ProtectedRoute hijacking new users:**
ProtectedRoute was using `useSetupWizard` to redirect new users to `/settings` before Layout.tsx could render the OnboardingModal. The fix strips ProtectedRoute down to ~20 lines — auth loading spinner, auth redirect to `/login`, render children. Nothing else.

**Bug 2 (ONBOARD-02) — Connect buttons navigating away:**
The three SourceCard buttons in OnboardingModal Step 1 called `navigate()` which navigated the page, unmounting the Dialog and prematurely completing onboarding. Changed all three to `window.open(..., "_blank")` — Fathom, Zoom, and Upload each open their destination in a new tab while the wizard stays open.

**Bug 3 (ONBOARD-03) — No post-completion navigation:**
After `completeOnboarding()` resolved, users stayed wherever they were. Added `handleOnboardingComplete` in Layout.tsx that awaits `completeOnboarding()` then calls `navigate('/')`, ensuring users always land at the default 4-pane workspace.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed missing zoom-api-client import in OAuthCallback.tsx**
- **Found during:** Task 2 build verification
- **Issue:** `src/pages/OAuthCallback.tsx` imported `completeZoomOAuth` from `@/lib/zoom-api-client` which does not exist, causing `npm run build` to fail. This was a pre-existing issue unrelated to our changes.
- **Fix:** Moved `completeZoomOAuth` import to `@/lib/api-client` where the function already exists.
- **Files modified:** src/pages/OAuthCallback.tsx
- **Commit:** f3000f7e (included in Task 2 commit)

## Verification Results

- ProtectedRoute: zero references to useSetupWizard, wizardCompleted, hasTranscripts, checkingTranscripts — PASS
- OnboardingModal: 3 window.open calls (Fathom, Zoom, Upload) — PASS
- Layout.tsx: navigate('/') called after completeOnboarding() — PASS
- npm run build: passes cleanly — PASS

## Known Stubs

None.

## Self-Check: PASSED

Files verified:
- src/components/ProtectedRoute.tsx — FOUND
- src/components/onboarding/OnboardingModal.tsx — FOUND
- src/components/Layout.tsx — FOUND
- src/pages/OAuthCallback.tsx — FOUND

Commits verified:
- ea3c31c6 — FOUND
- f3000f7e — FOUND
