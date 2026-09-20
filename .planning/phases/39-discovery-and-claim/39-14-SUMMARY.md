---
phase: 39-discovery-and-claim
plan: "14"
subsystem: ui
tags: [react-router, playwright, responsive-navigation, accessibility, privacy]

requires:
  - phase: 39-10
    provides: Dedicated privacy-safe Events page and authorized focus behavior
  - phase: 39-13
    provides: Session-only participation claim lifecycle and authentication restoration
  - phase: 39-15
    provides: Authorized notification deep links into Events router state
provides:
  - Public privacy-safe participation claim route and protected Events AppShell route
  - Events page label plus desktop and mobile navigation immediately after Calls
  - Browser-proven password, signup, OAuth/root, account-switch, retry, replay, and token-scrub journeys
affects: [39-16-integrated-verification, 39-17-production-rollout, app-navigation]

tech-stack:
  added: []
  patterns:
    - Dedicated Playwright project for deterministic privacy-sensitive route journeys
    - Router-state focus hints with no restricted identifier in the visible URL

key-files:
  created: []
  modified:
    - src/App.tsx
    - src/components/Layout.tsx
    - src/components/layout/AppShell.tsx
    - src/components/ui/sidebar-nav.tsx
    - src/pages/Events.tsx
    - src/pages/ParticipationClaim.tsx
    - playwright/discovery-claim.spec.ts
    - playwright.config.ts

key-decisions:
  - "Keep /claim-participation outside protected Layout chrome while /events uses the standard ProtectedRoute plus Layout boundary."
  - "Run discovery-claim Playwright journeys in an isolated project against the dedicated TEST Supabase origin with deterministic network responses and runtime-created credentials."
  - "Persist only origin plus pathname in debug navigation trails so security credentials in queries or fragments cannot survive page-load instrumentation."

patterns-established:
  - "Claim completion accessibility: replace to /events with focusHeading router state, then focus the single Events h1 once."
  - "Responsive navigation parity: Events follows Calls with the same Remix icon, active, label, and 44px-plus target conventions on every layout."

requirements-completed: [DISCO-01, DISCO-02, DISCO-03]

duration: 14min
completed: 2026-09-20
---

# Phase 39 Plan 14: Events Routes, Navigation, and Browser Journeys Summary

**Public claim restoration now crosses every authentication branch into a protected, focused Events page whose desktop and mobile navigation is browser-proven without retaining claim credentials.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-09-20T10:06:00Z
- **Completed:** 2026-09-20T10:19:40Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Added lazy public `/claim-participation` and protected `/events` routes with the approved EVENTS top label and existing AppShell composition.
- Added EVENTS immediately after CALLS in expanded, collapsed, and mobile navigation using `RiCalendarEventLine` / `RiCalendarEventFill`, approved copy, active state, and accessible names.
- Proved password sign-in, immediate-session signup, OAuth/root return, intended-account consume, different-primary confirmation, account switching, transport retry, terminal states, parallel consume, replay, URL/history/storage/log scrubbing, and final heading focus in a real browser.
- Captured responsive proof at `test-results/phase39-14-events-desktop.png` and `test-results/phase39-14-events-mobile.png`; both are generated test artifacts and intentionally gitignored.

## Task Commits

Each task followed the failing-test then implementation cycle:

1. **Task 1 RED: Route, authentication, replay, and privacy browser contracts** - `1af8df38` (test)
2. **Task 1 GREEN: Public claim and protected Events route wiring** - `5e1b404a` (feat)
3. **Task 2 RED: Mobile navigation order, active state, and route** - `d4135b5f` (test)
4. **Task 2 RED: Desktop/mobile browser navigation and screenshots** - `9e0a957b` (test)
5. **Task 2 GREEN: Responsive Events navigation** - `6ed2724a` (feat)
6. **Rule 3 fix: Account-switch handler lint compatibility** - `201f89fd` (fix)

## Files Created/Modified

- `src/App.tsx` - Adds public claim and protected Events route boundaries.
- `src/components/Layout.tsx` - Maps `/events` to the EVENTS top label.
- `src/components/layout/AppShell.tsx` - Adds Events to the six-target mobile navigation bar.
- `src/components/ui/sidebar-nav.tsx` - Adds the approved desktop Events destination immediately after Calls.
- `src/components/layout/__tests__/AppShell.mobile.test.tsx` - Proves order, active state, accessible name, and route behavior.
- `src/components/__tests__/Layout.test.tsx` - Proves the EVENTS authenticated page label.
- `src/pages/Events.tsx` - Restores one-time h1 focus after successful claim completion.
- `src/pages/ParticipationClaim.tsx` - Holds retryable claims for explicit retry and preserves account-switch behavior.
- `src/components/debug-panel/DebugPanelContext.tsx` - Removes query strings and fragments from persisted navigation details.
- `playwright/discovery-claim.spec.ts` - Exercises ten real browser route, auth, privacy, concurrency, and responsive cases.
- `playwright.config.ts` - Discovers the approved spec through the normal command and isolates it from persisted operator auth.

## Decisions Made

- Kept public claim UI completely outside `Layout`, preventing private authenticated shell content from painting before authentication.
- Used router state for both notification event focus and post-claim heading focus; no event or claim identifier is added to `/events`.
- Expanded the existing mobile grid from five to six equal columns while retaining 56px button height, compact labels, and the existing More destination.
- Used runtime-generated 43-character claim credentials and deterministic intercepted TEST-project boundaries so browser proof exercises the real React application without durable secrets or database mutation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Security Bug] Removed raw claim tokens from the debug action trail**
- **Found during:** Task 1 browser GREEN run
- **Issue:** The debug panel mounted outside the router and persisted `window.location.href` before the claim page's layout effect could scrub `?token=...`, leaving the bearer credential in local storage.
- **Fix:** Navigation instrumentation now records only origin plus pathname for initial load and browser history events.
- **Files modified:** `src/components/debug-panel/DebugPanelContext.tsx`
- **Verification:** Password, signup, OAuth/root, account-switch, retry, and replay browser cases scan URL, history, local storage, session storage, DOM, and console output for the runtime token.
- **Committed in:** `5e1b404a`

**2. [Rule 1 - Bug] Stopped retryable claim inspection from rerunning automatically**
- **Found during:** Task 1 browser GREEN run
- **Issue:** A retryable inspection cleared its guard while the mutation object changed, allowing the effect to rerun and consume without the user's explicit retry action.
- **Fix:** Retryable, terminal, and confirmation states now block effect reentry; the Try again action deliberately returns to processing before one new attempt.
- **Files modified:** `src/pages/ParticipationClaim.tsx`
- **Verification:** Browser proof observes the retained session claim and visible Try again action before one successful retry; existing claim unit tests remain green.
- **Committed in:** `5e1b404a`

**3. [Rule 3 - Blocking] Made the planned Playwright spec discoverable in normal configuration**
- **Found during:** Task 1 RED setup
- **Issue:** The repository's `testDir: './e2e'` excluded `playwright/discovery-claim.spec.ts`, so the plan's required command could not run it.
- **Fix:** The root config now matches both established `e2e/**/*.spec.ts` and approved `playwright/**/*.spec.ts` paths, with a dedicated no-setup discovery project and existing projects explicitly ignoring the new spec.
- **Files modified:** `playwright.config.ts`
- **Verification:** The exact plan command discovers and passes all 10 tests through the `discovery-claim` project.
- **Committed in:** `1af8df38`

**4. [Rule 3 - Blocking] Renamed a false-positive hook-shaped event handler**
- **Found during:** Final focused lint
- **Issue:** `useAnotherAccount` was an event handler, but its name triggered the React Hooks lint rule when called inside an action callback.
- **Fix:** Renamed it to `handleUseAnotherAccount` without changing behavior.
- **Files modified:** `src/pages/ParticipationClaim.tsx`
- **Verification:** Focused ESLint reports zero errors and the 15 claim page tests pass.
- **Committed in:** `201f89fd`

---

**Total deviations:** 4 auto-fixed (2 Rule 1 bugs, 2 Rule 3 blocking issues).
**Impact on plan:** The fixes close token persistence and retry correctness gaps and make the required browser proof executable. No product scope, database, deployment, production, or `main` change was added.

## Issues Encountered

- The existing expanded sidebar tests are intentionally skipped because of their stale historical harness. Desktop order, copy, active state, and accessible names are therefore asserted through the real Playwright application, while the active non-skipped sidebar regressions remain green.
- The build retains existing chunk-size and mixed static/dynamic import warnings. No new build failure or type error was introduced.

## Verification

- `npx playwright test playwright/discovery-claim.spec.ts --workers=1 --reporter=line` - **PASS, 10/10 browser tests**.
- `npx vitest run src/components/layout/__tests__/AppShell.mobile.test.tsx src/pages/__tests__/Events.test.tsx --maxWorkers=1` - **PASS, 13/13 tests**.
- Claim, OAuth/root, Layout, and active sidebar regression run - **PASS, 54 passed; 31 pre-existing intentionally skipped sidebar tests**.
- `npm run type-check` - **PASS, zero new errors; baseline 300/300**.
- `npm run build` against committed source - **PASS, 4,846 modules transformed**.
- Targeted ESLint - **PASS with zero errors**; existing Fast Refresh and Events exhaustive-deps warnings remain unchanged.
- Privacy and dependency scans - **PASS**: no local-storage claim key, raw-token logging, query-string event focus, Lucide, or Framer Motion use in the changed route/navigation surfaces.
- Visual inspection - **PASS**: desktop and 390x844 mobile screenshots show EVENTS after CALLS, active orange treatment, readable labels, and unclipped page content.

## Known Stubs

None.

## Threat Flags

None. The public-to-auth and protected Events boundaries are covered by the plan's threat model and browser verification.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 39-16 can execute integrated TEST discovery, claim, notification, revocation, and responsive browser proof through the completed routes.
- Plan 39-17 remains the only production rollout boundary; this plan changed no database, Edge Function, production frontend, `main`, or live service.
- No blockers remain.

## Self-Check: PASSED

- All 11 implementation/test/config files and this summary exist.
- Task commits `1af8df38`, `5e1b404a`, `d4135b5f`, `9e0a957b`, `6ed2724a`, and `201f89fd` resolve in Git history.
- All task acceptance criteria, plan-level browser proof, type check, build, privacy scans, responsive screenshots, and diff hygiene pass.

---
*Phase: 39-discovery-and-claim*
*Completed: 2026-09-20*
