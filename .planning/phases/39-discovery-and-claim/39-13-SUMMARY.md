---
phase: 39-discovery-and-claim
plan: "13"
subsystem: auth
tags: [react, react-router, session-storage, supabase-auth, privacy]

# Dependency graph
requires:
  - phase: 39-09
    provides: Strict claim inspect/consume service and hook boundary
  - phase: 39-03
    provides: RED claim privacy and authentication-return contracts
provides:
  - Session-only pending participation claim lifecycle with immediate URL scrubbing
  - Non-consuming inspection and explicit different-primary account confirmation
  - Atomic claim completion restored across password, signup, OAuth, callback, and root paths
affects: [39-14-route-wiring, discovery-claim-e2e, authentication-returns]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Dedicated validated sessionStorage credential with a clean router destination
    - Root-only pending destination restoration with claim precedence and share isolation

key-files:
  created:
    - src/lib/pending-participation-claim.ts
    - src/pages/ParticipationClaim.tsx
  modified:
    - src/pages/Login.tsx
    - src/pages/OAuthCallback.tsx
    - src/components/ProtectedRoute.tsx
    - src/pages/__tests__/ParticipationClaim.test.tsx
    - src/pages/__tests__/OAuthCallback.participation-claim.test.tsx
    - src/pages/__tests__/OAuthCallback.routing.test.ts
    - src/services/event-discovery.service.ts
    - src/services/__tests__/event-discovery.service.test.ts

key-decisions:
  - "Scrub the raw credential synchronously with history replacement, then queue a clean router replacement so private UI cannot paint with the token in the address bar."
  - "Restore pending destinations only from the authenticated root; this lets claim completion remain on /events while preserving a separate pending share token."
  - "Treat network and 5xx claim failures as retryable while collapsing 4xx and terminal claim states into the same generic unavailable result."

patterns-established:
  - "Claim credential boundary: the 43-character token exists only in the dedicated pendingParticipationClaim session key and mutation input."
  - "Authentication return precedence: participation claim, then share token, then generic pending-next destination."

requirements-completed: [DISCO-02, DISCO-03]

# Metrics
duration: 12min
completed: 2026-09-20
---

# Phase 39 Plan 13: Secure Claim and Authentication Return Summary

**Single-use participation claims now cross every authentication path through a scrubbed session-only credential, non-consuming account inspection, explicit alias confirmation, and atomic completion to Events.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-20T09:40:51Z
- **Completed:** 2026-09-20T09:52:00Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Captures a valid claim token once, removes it from URL and browser history before account-specific UI can paint, and keeps it out of local storage, router state, query caches, logs, and DOM labels.
- Inspects without mutation, auto-consumes only for the intended account, and offers exactly **Add email and continue** or **Use another account** for a different primary email.
- Restores one pending claim through password login, immediate or confirmation-pending signup, Google OAuth/root return, and successful connector callback without duplicate inspection or consumption.
- Clears the credential only after a terminal result or successful consume, while retaining it for transport retries and account switching.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build the session-only pending claim lifecycle and privacy-safe page** - `ff5244a2` (feat)
2. **Task 2: Restore pending claims after every authentication completion path** - `745e6339` (feat)

The Wave 0 RED contracts originated in `982cb0e1`; both task commits converted the satisfied expected failures into normal passing tests.

## Files Created/Modified

- `src/lib/pending-participation-claim.ts` - Validates, stores, reads, and clears the dedicated session-only claim credential.
- `src/pages/ParticipationClaim.tsx` - Implements privacy-safe capture, inspection, confirmation, consume, retry, account-switch, and terminal states.
- `src/pages/Login.tsx` - Prioritizes the clean pending claim destination after password and signup authentication.
- `src/pages/OAuthCallback.tsx` - Restores a pending claim after a successful callback without query-token propagation.
- `src/components/ProtectedRoute.tsx` - Restores claims from authenticated root once while preserving separate share state.
- `src/pages/__tests__/ParticipationClaim.test.tsx` - Proves URL scrubbing, generic terminal behavior, retry, choices, and single consume.
- `src/pages/__tests__/OAuthCallback.participation-claim.test.tsx` - Proves password, signup, OAuth/root, intended-account, and different-primary return behavior.
- `src/pages/__tests__/OAuthCallback.routing.test.ts` - Guards callback claim precedence and clean routing.
- `src/services/event-discovery.service.ts` - Preserves retryability for network and 5xx claim failures.
- `src/services/__tests__/event-discovery.service.test.ts` - Covers retryable versus terminal HTTP classification.

## Decisions Made

- Used native `history.replaceState` for the immediate credential scrub and a queued router replacement for synchronized React Router state.
- Scoped pending destination restoration to `/` so navigation to `/events` after a successful claim cannot be hijacked by another pending flow.
- Kept pending share and generic-next storage behavior unchanged and separate; claim routing has precedence without deleting either key.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected the generated claim-token test shape**
- **Found during:** Task 1
- **Issue:** The existing RED tests generated a 64-character hexadecimal value while the production invitation and service contract require a 43-character base64url token.
- **Fix:** Kept runtime-generated test credentials but constrained them to the real fixed shape.
- **Files modified:** `src/pages/__tests__/ParticipationClaim.test.tsx`, `src/pages/__tests__/OAuthCallback.participation-claim.test.tsx`
- **Verification:** Both focused claim and authentication-return suites pass with production-valid token shape.
- **Committed in:** `ff5244a2`, `745e6339`

**2. [Rule 1 - Bug] Preserved retryable transport failures at the service boundary**
- **Found during:** Task 1
- **Issue:** Every Edge invocation error was mapped to terminal `CLAIM_UNAVAILABLE`, so real network and 5xx failures would clear a still-valid pending claim.
- **Fix:** Network and 5xx failures now map to `CLAIM_RETRYABLE`; terminal 4xx responses remain generic unavailable failures.
- **Files modified:** `src/services/event-discovery.service.ts`, `src/services/__tests__/event-discovery.service.test.ts`
- **Verification:** Service boundary tests prove 503 is retryable and 404 is terminal; page retry tests prove the session claim survives and completes once.
- **Committed in:** `ff5244a2`

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs).
**Impact on plan:** Both fixes were required for the planned token-shape and retry guarantees. No product scope was added.

## Issues Encountered

- BrowserRouter can retain its initial location snapshot when a child layout effect navigates before the router listener mounts. The implementation now performs the security-critical native scrub synchronously and queues the clean router replacement, keeping both the address bar and router state clean.

## Verification

- `npx vitest run src/pages/__tests__/ParticipationClaim.test.tsx src/pages/__tests__/OAuthCallback.participation-claim.test.tsx --maxWorkers=1 --reporter=verbose` — PASS, 23 tests.
- `npx vitest run src/services/__tests__/event-discovery.service.test.ts src/pages/__tests__/OAuthCallback.routing.test.ts --maxWorkers=1 --reporter=verbose` — PASS, 17 tests.
- `npm run type-check` — PASS, 0 new errors; baseline remains 300/300.
- Token leak scans for local storage, logs, query keys, raw-token redirects, and remaining expected-failure markers — PASS.

## Known Stubs

None.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 14 can wire the public `/claim-participation` and protected `/events` routes to these completed page and restoration contracts.
- No blockers. No database, deployment, production, or `main` changes were made.

## Self-Check: PASSED

- All key files exist on disk.
- Task commits `ff5244a2` and `745e6339` exist in git history.
- All task acceptance criteria and plan-level verification commands pass.

---
*Phase: 39-discovery-and-claim*
*Completed: 2026-09-20*
