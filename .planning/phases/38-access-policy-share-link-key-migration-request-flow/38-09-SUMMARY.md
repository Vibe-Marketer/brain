---
phase: 38-access-policy-share-link-key-migration-request-flow
plan: "09"
subsystem: frontend-data
tags: [react, tanstack-query, supabase, access-policy, optimistic-updates]

requires:
  - phase: 38-access-policy-share-link-key-migration-request-flow
    plan: "06"
    provides: Proven Phase 38 access-policy RPCs and generated database types
provides:
  - UUID-only access-policy contracts and stable TanStack Query keys
  - Pure owner-safe account-default and recording-policy service boundary
  - Optimistic account and recording policy hooks with rollback and complete invalidation
affects: [38-10, 38-11, 38-12, 38-13, privacy-access-settings, recording-access-panel]

tech-stack:
  added: []
  patterns:
    - Pure service functions own database access while TanStack Query hooks own cache behavior
    - Optimistic policy mutations snapshot and restore both access level and policy origin

key-files:
  created:
    - src/types/access-policy.ts
    - src/services/access-policy.service.ts
    - src/hooks/useAccessPolicy.ts
    - src/types/__tests__/access-policy.test.ts
    - src/services/__tests__/access-policy.service.test.ts
    - src/hooks/__tests__/useAccessPolicy.test.ts
  modified:
    - src/lib/query-config.ts

key-decisions:
  - "Read the account default through the existing owner-scoped user_settings RLS policy because Phase 38 provides a setter RPC but no getter RPC."
  - "Reject non-UUID recording identities before any policy RPC and fail closed when no authenticated user exists."
  - "Keep Public confirmation in the UI while the hooks treat every confirmed level as an immediate optimistic mutation."

patterns-established:
  - "Policy query keys use only canonical UUID strings and share one access-policy root."
  - "Recording set/reset onSettled invalidates policy, management, and every call-list cache."

requirements-completed: [ACCESS-01, ACCESS-03, ACCESS-06]

duration: 10min
completed: 2026-09-19
---

# Phase 38 Plan 09: Access Policy Service and Hooks Summary

**Typed UUID-native policy services and optimistic TanStack Query hooks with owner-derived authorization, exact feedback copy, rollback, and complete call-list invalidation.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-09-19T18:13:59Z
- **Completed:** 2026-09-19T18:23:30Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Added exact six-level access policy and default/custom origin contracts, plus stable keys for policy, management, discovery, requests, and grants.
- Added a pure service layer for account defaults and recording set/reset operations using owner-derived authorization and hardened mutation RPCs.
- Added optimistic hooks that restore complete policy state after errors, use the approved UI copy, and refresh all policy and call-list caches after recording mutations.
- Added focused unit tests for contracts, service validation and security behavior, optimistic updates, rollback, toasts, and invalidation.

## Task Commits

Each TDD task was committed with a failing test before implementation:

1. **Task 1: Define policy contracts and stable query keys** - `2d260395` (test), `81c86f23` (feat)
2. **Task 2: Implement the pure access-policy RPC service** - `7735ae8a` (test), `18e6a578` (feat), `de8a3b19` (fix)
3. **Task 3: Add optimistic policy hooks with rollback and complete invalidation** - `7deff1d7` (test), `c3b4d378` (feat)

## Files Created/Modified

- `src/types/access-policy.ts` - Exact persisted level/origin types and shared policy response contracts.
- `src/lib/query-config.ts` - Stable access-policy query-key family for current and later Phase 38 slices.
- `src/services/access-policy.service.ts` - Pure account-default and recording-policy data access with validation and typed stable errors.
- `src/hooks/useAccessPolicy.ts` - Query and optimistic mutation hooks with rollback, toasts, and invalidation.
- `src/types/__tests__/access-policy.test.ts` - Persisted-value and query-key contracts.
- `src/services/__tests__/access-policy.service.test.ts` - Owner-safe arguments, response validation, auth, UUID, and error contracts.
- `src/hooks/__tests__/useAccessPolicy.test.ts` - Query, optimistic update, rollback, toast, and invalidation contracts.

## Decisions Made

- The account-default getter uses the existing authenticated user's ID only to select their RLS-protected `user_settings` row. All account and recording mutations remain on Phase 38 RPCs and accept no owner ID.
- A missing `user_settings` row resolves to Private, matching the database default for a user who has never changed the setting.
- Hook success copy converts stored values to their approved display labels, including `link` to "Anyone with link."

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Failed closed for unauthenticated reads and non-UUID recording identities**
- **Found during:** Task 2 final security review
- **Issue:** The initial getter could interpret an unauthenticated empty result as Private, and recording service methods did not reject numeric provider IDs before an RPC.
- **Fix:** Added an explicit authenticated-user gate and canonical UUID validation before every recording policy RPC.
- **Files modified:** `src/services/access-policy.service.ts`, `src/services/__tests__/access-policy.service.test.ts`
- **Verification:** Dedicated auth and numeric-ID rejection tests pass; RPC is not called for a numeric ID.
- **Committed in:** `de8a3b19`

---

**Total deviations:** 1 auto-fixed (1 Rule 2).
**Impact on plan:** The fix completes the plan's owner-auth and UUID-only threat mitigations without changing architecture or scope.

## Issues Encountered

- The isolated worktree initially lacked a complete local `node_modules`, so the type-check wrapper could not find TypeScript. The worktree now uses the repository's existing shared dependency directory; no package was installed and no lockfile changed.
- The Phase 38 UI contract files remain intentional `it.fails` acceptance placeholders until Plans 12 and 13 create those components. Their expected-failure contracts ran successfully alongside this plan's 13 active unit tests.

## Known Stubs

None.

## Verification

- Focused Vitest gate: 5 files, 23 tests passed.
- ESLint on all seven changed source/test files: no issues.
- Type check: passed with 0 new errors against the existing baseline.
- Static service scan: no React, TanStack Query, Sonner, or direct recording-table access.
- Static hook scan: no direct Supabase table or RPC access.
- Dependency guard: `package.json` and `package-lock.json` unchanged.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 38-10 can build the shared access-level picker and Settings surface on these exact hooks and contracts.
- Plan 38-11 can reuse the management, event-copy, request, and grant query keys for lifecycle operations.
- No production deploy, migration, push, or branch switch occurred.

## Self-Check: PASSED

- All seven implementation/test files and this summary exist.
- All seven TDD/task commits exist in repository history.
- Final verification passed before close-out.

---
*Phase: 38-access-policy-share-link-key-migration-request-flow*
*Completed: 2026-09-19*
