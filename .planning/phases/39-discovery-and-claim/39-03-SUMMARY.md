---
phase: 39-discovery-and-claim
plan: "03"
subsystem: testing
tags: [vitest, testing-library, playwright, react-query, privacy, tdd]

requires:
  - phase: 38-access-policy-share-link-key-migration-request-flow
    provides: Recording request behavior, notification metadata, and shared cache invalidation patterns
  - phase: 39-discovery-and-claim
    provides: Approved UI specification and Phase 39 security boundaries
provides:
  - Collectable RED service and hook contracts for strict projection parsing and cache invalidation
  - Settings, Events, participant invitation, and notification UI behavior/privacy contracts
  - Claim capture, authentication return, account-choice, and browser journey contracts
affects: [39-09, 39-10, 39-11, 39-12, 39-13, 39-14, discovery, claims, notifications]

tech-stack:
  added: []
  patterns:
    - Vitest it.fails marks only implementation-dependent Wave 0 contracts
    - Missing future modules load dynamically so RED suites still collect
    - Opaque claim values are generated at runtime and never checked into fixtures

key-files:
  created:
    - src/services/__tests__/event-discovery.service.test.ts
    - src/hooks/__tests__/useEventDiscovery.test.ts
    - src/pages/__tests__/Events.test.tsx
    - src/components/settings/__tests__/AccountTab.discovery.test.tsx
    - src/components/call-detail/__tests__/CallParticipantsTab.claim-invite.test.tsx
    - src/pages/__tests__/ParticipationClaim.test.tsx
    - src/pages/__tests__/OAuthCallback.participation-claim.test.tsx
    - playwright/discovery-claim.spec.ts
  modified:
    - src/components/notifications/__tests__/NotificationBell.test.tsx

key-decisions:
  - "Implementation-dependent frontend assertions use Vitest it.fails; existing negative privacy behavior remains ordinarily green."
  - "Claim tokens are generated only at test runtime so no opaque claim value is stored in source fixtures or test output."
  - "The Phase 39 Playwright file stays at its plan-owned path and is listed with a temporary testDir override because the repository config scans e2e/ only."

patterns-established:
  - "Wave 0 frontend RED: dynamic module loading moves absent-module failures inside it.fails instead of failing suite collection."
  - "Privacy contracts inspect DOM, history, storage, query caches, and navigation while keeping restricted metadata inert."

requirements-completed: [DISCO-01, DISCO-02, DISCO-03]

duration: 9min
completed: 2026-09-20
---

# Phase 39 Plan 03: Frontend Discovery and Claim Contracts Summary

**Sixty-one collectable Vitest contracts and five Playwright journeys now pin the privacy-safe discovery, invitation, claim, and authentication-return experience before production UI code exists.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-09-20T05:33:00Z
- **Completed:** 2026-09-20T05:42:00Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Added strict service and hook boundary contracts for allowlisted server data,
  bounded pagination, authoritative ordering, generic claim failures, token
  isolation, and success/error cache invalidation.
- Added exact UI-SPEC contracts for Events, the Settings discovery callout and
  disconnect confirmation, canonical participant invitations, lifecycle
  states, and privacy-safe notification navigation.
- Added claim entry and authentication restoration contracts for immediate URL
  scrubbing, session-only storage, intended-account auto-completion,
  different-account choices, terminal equivalence, and replay handling.
- Added five browser journeys covering signed-out capture, password sign-in,
  signup/OAuth-root restoration, explicit account choice, and parallel consume.

## Task Commits

1. **Task 1: Safe service and hook RED contracts** — `3b9d3606`
2. **Task 2: Settings, Events, participant, and notification RED contracts** — `208954dc`
3. **Task 3: Claim entry and authentication-return RED contracts** — `982cb0e1`
4. **Security correction: Runtime-only opaque claim values** — `78547309`

## Files Created/Modified

- `src/services/__tests__/event-discovery.service.test.ts` — strict response,
  pagination, ordering, and generic claim error boundary.
- `src/hooks/__tests__/useEventDiscovery.test.ts` — session-safe claim mutations
  and complete authorization cache invalidation on both outcomes.
- `src/pages/__tests__/Events.test.tsx` — event grouping, semantic card,
  redaction, empty/error, and pagination contracts.
- `src/components/settings/__tests__/AccountTab.discovery.test.tsx` — persistent
  discovery count and confirmed alias disconnection.
- `src/components/call-detail/__tests__/CallParticipantsTab.claim-invite.test.tsx`
  — canonical owner-only invitation controls and server-authorized states.
- `src/components/notifications/__tests__/NotificationBell.test.tsx` — safe
  New event found routing and private-metadata rejection.
- `src/pages/__tests__/ParticipationClaim.test.tsx` — token capture, inspect,
  consume, explicit account choices, and generic terminal behavior.
- `src/pages/__tests__/OAuthCallback.participation-claim.test.tsx` — clean root
  restoration and separation from the existing share token flow.
- `playwright/discovery-claim.spec.ts` — five full browser journeys for later
  activation by the implementation and route-wiring plans.

## Decisions Made

- Kept absent future modules inside dynamic imports so Vitest registers every
  contract and reports the expected RED reason rather than failing transform.
- Kept already-satisfied negative guarantees as ordinary green tests. Only
  behavior that is absent until Plans 09-14 uses expected-failure semantics.
- Generated claim values at runtime across unit and browser tests so no opaque
  claim value is persisted in a fixture, snapshot, or command output.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test correctness] Preserved existing green privacy behavior**

- **Found during:** Task 2 verification
- **Issue:** Two negative assertions already passed before Phase 39: non-owners
  had no invitation controls, and private notification metadata was inert.
  Marking them with `it.fails` made Vitest correctly reject the suite.
- **Fix:** Left those two safeguards as ordinary green tests and kept only the
  absent Phase 39 behavior in expected-failure mode.
- **Files modified:**
  `src/components/call-detail/__tests__/CallParticipantsTab.claim-invite.test.tsx`,
  `src/components/notifications/__tests__/NotificationBell.test.tsx`
- **Verification:** Task 2 focused run passed 36/36.
- **Committed in:** `208954dc`

**2. [Rule 2 - Security] Removed static opaque claim values from fixtures**

- **Found during:** Plan-level privacy review
- **Issue:** Initial unit scaffolds used clearly synthetic but static token-shaped
  strings, contrary to the plan's rule that raw claim values never live in
  fixtures or output.
- **Fix:** Generate every opaque claim value at runtime with Web Crypto.
- **Files modified:** Service, hook, ParticipationClaim, and authentication-return tests.
- **Verification:** Combined focused Vitest run passed 61/61; source scan found
  no checked-in opaque claim value.
- **Committed in:** `78547309`

---

**Total deviations:** 2 auto-fixed (1 test-correctness, 1 security).
**Impact on plan:** Both changes make the RED signal precise and strengthen token privacy; no product scope changed.

## Issues Encountered

- The repository Playwright config has `testDir: './e2e'`, while the approved
  plan owns `playwright/discovery-claim.spec.ts`. The exact plan command therefore
  reports zero files. A temporary, uncommitted config containing only
  `testDir: './playwright'` listed all 5 tests successfully. The later route
  activation plan must either run this file with an explicit config or move it
  through an approved config/path change.
- Existing AccountTab tests emit its pre-existing missing-list-key and async
  React `act` warnings. Assertions and collection still pass; no production
  component was changed in this Wave 0 plan.

## Verification

- Combined focused Vitest run: **8 files, 61/61 passed**. Implementation-dependent
  tests passed via explicit `it.fails`; existing behavior remained ordinary green.
- Playwright collection with temporary testDir override: **5 tests in 1 file**.
- Task 1 focused run: **2 files, 9/9 passed**.
- Task 2 focused run: **4 files, 36/36 passed**.
- Task 3 focused unit run: **2 files, 16/16 passed**.
- No package, lockfile, application source, deployment, database, or `main`
  branch change occurred.

## Known Stubs

None. The expected-failure cases are executable contracts assigned to Plans
09-14, not placeholder product code.

## User Setup Required

None.

## Next Phase Readiness

- Plans 09-14 can implement against explicit behavior and privacy contracts,
  removing each `it.fails` marker only when the corresponding behavior passes.
- The Playwright journey file is ready for route activation; its repository
  test-directory mismatch is documented for the implementing plan.
- No unresolved HIGH threat remains in this test-plan scope.

## Self-Check: PASSED

- All nine assigned test artifacts exist.
- All four implementation/test commits resolve in Git history.
- Combined Vitest and Playwright collection evidence was captured.
- No raw claim token, product implementation, production mutation, or untracked
  artifact remains.

---
*Phase: 39-discovery-and-claim*
*Completed: 2026-09-20*
