---
phase: 38-access-policy-share-link-key-migration-request-flow
plan: "03"
subsystem: testing
tags: [supabase, mcp, react, playwright, access-policy, privacy]

requires:
  - phase: 38-access-policy-share-link-key-migration-request-flow
    plan: "01"
    provides: Phase 38 schema, RLS, fixture graph, and migration contract
provides:
  - Real-database acceptance contracts for recording-access delivery and public recording reads
  - UUID-first MCP share create/list/revoke contract with isolated legacy fallback coverage
  - Exact-copy React contracts for settings, recording access, discovery, notifications, and public rendering
  - Desktop and mobile Playwright contract for access policy flows and disclosure boundaries
affects: [38-07, 38-08, 38-11, 38-12, 38-13, 38-14, 38-15]

tech-stack:
  added: []
  patterns:
    - Expected-failure tests pin missing Phase 38 behavior while existing behavior stays green
    - Real-database fixtures delete only rows created by their own suite

key-files:
  created:
    - supabase/functions/recording-access/__tests__/recording-access.integration.test.ts
    - supabase/functions/mcp-server/__tests__/sharing-uuid-bridge.test.ts
    - supabase/functions/public-recording/__tests__/public-recording.integration.test.ts
    - src/components/settings/__tests__/PrivacyAccessSettings.test.tsx
    - src/components/sharing/__tests__/RecordingAccessPanel.test.tsx
    - src/components/call-detail/__tests__/OtherRecordingCopies.test.tsx
    - src/pages/__tests__/PublicRecordingView.test.tsx
    - e2e/phase38-access.spec.ts
  modified:
    - src/components/notifications/__tests__/NotificationBell.test.tsx

key-decisions:
  - "Missing Phase 38 behavior is expressed with Vitest expected-failure contracts so collection and baseline regressions remain distinguishable."
  - "The MCP bridge suite borrows an existing organization identity but creates and deletes only its own recording, Fathom, workspace, and share rows."

patterns-established:
  - "Public read tests assert an exact five-key response allowlist and one generic unavailable result for all denied inputs."
  - "Anonymous discovery tests inspect visible text, accessible names, links, test IDs, network payloads, and console output for protected metadata."

requirements-completed: [ACCESS-01, ACCESS-02, ACCESS-04, ACCESS-05, ACCESS-06, ACCESS-07, ACCESS-08, ACCESS-09]

duration: 30min
completed: 2026-09-19
---

# Phase 38 Plan 03: API, MCP, UI, and Browser Acceptance Contracts Summary

**Executable trust-boundary contracts now cover authenticated delivery, UUID sharing, public allowlisted reads, exact UI disclosure rules, and responsive access flows before implementation begins.**

## Performance

- **Duration:** 30 min
- **Started:** 2026-09-19T16:52:00Z
- **Completed:** 2026-09-19T17:22:11Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Added real dedicated-test API contracts for authenticated request delivery, server-owned identity and evidence, idempotent outbox delivery, durable provider failure, public allowlisting, and generic default denial.
- Added MCP module contracts for canonical UUID sharing, legacy BIGINT fallback, `/s/<token>` URLs, and markdown-only `content[0].text` responses.
- Pinned D-07 through D-22 across focused React and Playwright coverage, including desktop/mobile behavior, keyboard and focus handling, deep links, cooldowns, owner decisions, public confirmation, and anonymous metadata leak checks.
- Kept the full unit and integration baselines green while representing unimplemented application behavior as explicit expected failures.

## Task Commits

Each task was committed atomically:

1. **Task 1: Define recording-access email, MCP, and public API contracts** - `4dfcb2a6` (test)
2. **Task 2: Pin settings, access panel, discovery, notification, and public rendering** - `ec89bf42` (test)
3. **Task 3: Define desktop, mobile, and authenticated deep-link browser flows** - `c69f7623` (test)
4. **Task 1 follow-up: Isolate MCP bridge fixtures for parallel execution** - `810b617c` (fix)

## Files Created/Modified

- `supabase/functions/recording-access/__tests__/recording-access.integration.test.ts` - Request-ID-only authentication, authorization, trusted-field, idempotency, escaping, and retry contracts.
- `supabase/functions/mcp-server/__tests__/sharing-uuid-bridge.test.ts` - UUID create/list/revoke, legacy fallback, URL, and markdown response contracts using exact-row cleanup.
- `supabase/functions/public-recording/__tests__/public-recording.integration.test.ts` - Public-only five-key allowlist and uniform denial contracts.
- `src/components/settings/__tests__/PrivacyAccessSettings.test.tsx` - Six default choices, future-only copy, rollback, and Public confirmation.
- `src/components/sharing/__tests__/RecordingAccessPanel.test.tsx` - Owner-only access entry, notice persistence, inherited/custom/reset, request/grant ordering, and destructive action semantics.
- `src/components/call-detail/__tests__/OtherRecordingCopies.test.tsx` - Anonymous-copy disclosure, request state, cooldown, and protected DOM absence contracts.
- `src/components/notifications/__tests__/NotificationBell.test.tsx` - Typed access-request deep link and independent dismissal coverage.
- `src/pages/__tests__/PublicRecordingView.test.tsx` - Allowlisted public rendering and generic unavailable state.
- `e2e/phase38-access.spec.ts` - Desktop, mobile, keyboard, deep-link, policy-boundary, reduced-motion, overflow, and disclosure browser flows.

## Decisions Made

- Used expected-failure tests only for implementation that later Phase 38 plans must add. Existing behavior and the legacy MCP fallback use normal passing assertions.
- Kept authorization and UUID/BIGINT coverage on the real dedicated Supabase test project. React tests mock hooks and services only at the component boundary.
- Replaced shared Phase 38 graph teardown in the MCP unit suite with a narrow fixture that uses an existing organization identity and removes only rows created by that suite.

## Verification

- `npm run test:integration` - passed: 32 files passed, 2 skipped; 234 tests passed, 19 skipped.
- `npm test -- supabase/functions/mcp-server/__tests__/sharing-uuid-bridge.test.ts` - passed: 1 file, 2 tests.
- Focused Phase 38 React command from the plan - passed: 5 files, 33 tests.
- `npm run test:e2e -- e2e/phase38-access.spec.ts --list` - passed: 41 tests listed across configured projects, including authentication setup.
- `npm run type-check` - passed with 0 new errors; the checked-in baseline remains 321/321.
- `npm test` - passed: 269 files passed, 1 skipped; 2,425 tests passed, 50 skipped.
- `git diff --check` - passed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Shortened the public API fixture prefix to satisfy the combined generated slug constraint**
- **Found during:** Task 1 (public-recording integration contract)
- **Issue:** The first fixture prefix produced a generated organization slug longer than the database accepts.
- **Fix:** Used a shorter unique prefix and removed the partial test organization before rerunning.
- **Files modified:** `supabase/functions/public-recording/__tests__/public-recording.integration.test.ts`
- **Verification:** The focused public suite and the complete integration suite passed.
- **Committed in:** `4dfcb2a6`

**2. [Rule 1 - Bug] Isolated the MCP bridge fixture from parallel unit suites**
- **Found during:** Overall verification after Task 3
- **Issue:** Shared graph cleanup could delete fixture users belonging to another real-database test running in parallel.
- **Fix:** Created a narrow MCP fixture with unique recording/provider IDs and exact-row teardown, without creating or globally deleting users or organizations.
- **Files modified:** `supabase/functions/mcp-server/__tests__/sharing-uuid-bridge.test.ts`
- **Verification:** The focused MCP suite passed 2/2 and the complete unit suite passed 2,425/2,425 non-skipped tests.
- **Committed in:** `810b617c`

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs)
**Impact on plan:** Both fixes make the acceptance suites deterministic and safe for the dedicated shared test project; no product scope or runtime behavior changed.

## Issues Encountered

- The first complete integration run hit the known `reporter-comms.integration.test.ts` five-second timing flake at 5.257 seconds. Its isolated rerun passed 6/6 at 5.047 seconds, and the repeated complete integration run passed all 234 non-skipped tests.
- Supabase emitted existing multiple-GoTrueClient warnings during real-database tests. They did not fail the suite or change the contracts.

## TDD Gate Compliance

- All three tasks are acceptance-only RED contracts committed with `test(38-03)` commits before Phase 38 application implementation.
- Missing behavior is explicitly marked with `it.fails`; no product implementation was added in this plan.

## Known Stubs

None. Expected-failure cases are intentional executable contracts assigned to later Phase 38 implementation plans.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 38-07, 38-08, and 38-11 through 38-15 can implement against explicit API, MCP, component, and browser acceptance contracts.
- No production deployment, frontend release, branch switch, or push occurred.

## Self-Check: PASSED

- All nine planned test files exist.
- Task commits `4dfcb2a6`, `ec89bf42`, `c69f7623`, and `810b617c` exist in history.
- No tracked files were deleted by these commits.
- Stub and threat-surface scans found no untracked runtime implementation or new trust boundary; all changes are test and planning artifacts.

---
*Phase: 38-access-policy-share-link-key-migration-request-flow*
*Completed: 2026-09-19*
