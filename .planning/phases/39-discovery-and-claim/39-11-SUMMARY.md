---
phase: 39-discovery-and-claim
plan: "11"
subsystem: account-settings
tags: [react, tanstack-query, verified-email, privacy, accessibility]

requires:
  - phase: 39-06
    provides: Caller-scoped alias disconnect RPC and immediate derived-visibility revocation
  - phase: 39-09
    provides: Event discovery queries, authorization cache keys, and typed server boundary
  - phase: 39-10
    provides: Dedicated Events destination for the persistent Settings action
provides:
  - Persistent Settings discovery result with loading, retry, zero, and populated states
  - Confirmed non-primary verified-email disconnect through the identity service and hook
  - Immediate refetch of identity, discovery, notification, access, and call caches
affects: [39-14, account-settings, events-route, verified-email-authorization]

tech-stack:
  added: []
  patterns: [server-authoritative revocation, row-scoped pending state, independent query failure]

key-files:
  created: []
  modified:
    - src/components/settings/AccountTab.tsx
    - src/components/settings/__tests__/AccountTab.discovery.test.tsx
    - src/services/identity-alias.service.ts
    - src/hooks/useIdentityAliases.ts

key-decisions:
  - "The authenticated primary email is rendered separately and never receives a disconnect action; only caller-owned alias row IDs enter the disconnect RPC."
  - "Disconnect waits for the server and then refetches every authorization-sensitive cache; no identity, participant, event, or list state is removed optimistically."
  - "Discovery-count loading and failure are isolated from verified-email management, and zero remains an actionable result linked to /events."

patterns-established:
  - "Authorization revocation UX: exact confirmation copy, affected-row-only pending state, generic failure feedback, and server-authoritative refetch."

requirements-completed: [DISCO-01, DISCO-03]

duration: 9min
completed: 2026-09-20
---

# Phase 39 Plan 11: Settings Discovery and Verified Email Disconnect Summary

**Account Settings now persistently reports the caller's distinct discovered-event count and safely disconnects only non-primary verified aliases through an atomic server-authorized mutation.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-09-20T09:12:21Z
- **Completed:** 2026-09-20T09:21:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added the durable “We found N event(s)” Settings result and “View events” action for zero, one, and many results without flashing a false zero while loading.
- Kept count loading, retry, and failure independent so verified-email management remains usable during a discovery outage.
- Added a caller-scoped identity service and TanStack mutation that sends only an opaque alias ID and refetches alias, discovery, notification, access-policy, event-copy, and call-list state on every outcome.
- Added an exact destructive confirmation dialog, affected-row-only pending state, primary-email protection, and privacy-safe success and failure feedback.
- Re-proved against the real TEST database that wrong-user and primary aliases fail closed while a caller-owned non-primary alias revokes derived visibility without changing participant evidence.

## Task Commits

Each task was developed through a failing test followed by its implementation:

1. **Task 1 RED: Alias service and invalidation contract** - `2127b4a9` (test)
2. **Task 1 GREEN: Verified email disconnect mutation** - `5c55b962` (feat)
3. **Task 2 RED: Settings discovery and confirmation contract** - `6f56b091` (test)
4. **Task 2 GREEN: Persistent result and disconnect UI** - `6108c030` (feat)

## Files Created/Modified

- `src/services/identity-alias.service.ts` - Lists alias IDs and wraps the caller-scoped disconnect RPC with `IdentityAliasError` failure mapping.
- `src/hooks/useIdentityAliases.ts` - Exposes row-aware disconnect mutation state and comprehensive authorization-cache invalidation.
- `src/components/settings/AccountTab.tsx` - Renders the persistent discovery result, Events action, verified states, disconnect actions, and exact confirmation flow.
- `src/components/settings/__tests__/AccountTab.discovery.test.tsx` - Covers service failure, invalidation, loading, zero, error, confirmation, feedback, primary protection, and row concurrency.

## Decisions Made

- The primary email remains sourced from the authenticated account and is labelled `Primary`; the owner-scoped alias query supplies only additional verified rows labelled `Verified`.
- The client never predicts disconnect authorization. False, wrong-owner, primary, inactive, and server errors all fail closed, preserve visible state, and show the same generic UI failure.
- Alias rows stay on screen until the server succeeds and invalidated queries return the new authority. This avoids briefly hiding content that the server still authorizes.
- A count error renders its own retry control and does not disable alias rows or the manual six-digit add-email flow.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The full `AccountTab` focused test emits existing React act warnings from unrelated profile and Radix preference initialization. All eight Settings assertions pass, and targeted ESLint and type checks are clean.

## Verification

- `npx vitest run src/components/settings/__tests__/AccountTab.discovery.test.tsx src/hooks/__tests__/useEventDiscovery.test.ts src/test/migrations/phase39-discovery-claim-migrations.test.ts --maxWorkers=1` - **30/30 passed**.
- `VITEST_INTEGRATION_OK=true npx vitest run src/test/discovery-claim.integration.test.ts --maxWorkers=1 --reporter=verbose` - **14/14 passed** against TEST, including owned alias success, wrong-user and primary failure, immediate discovery revocation, notification cleanup, and participant-evidence preservation.
- `npm run type-check` - **PASS**, zero new errors; existing baseline remains 300/300.
- Targeted ESLint across the component, test, hook, and service - **PASS**.
- Privacy and architecture scans - **PASS**, no client delete call, participant mutation, banned icon library, bulk action, or permanent claimed-email class.
- `git diff --check` - **PASS**.

## Known Stubs

None.

## User Setup Required

None.

## Next Phase Readiness

- Plan 39-12 can add owner-only participant invitation controls independently.
- Plan 39-14 can wire the `/events` route so this committed Settings link resolves in the final navigation flow.
- No database, Edge Function, production, deployment, or `main` change was made in this plan.

## Self-Check: PASSED

- All four modified implementation/test files and this summary exist.
- Task commits `2127b4a9`, `5c55b962`, `6f56b091`, and `6108c030` resolve in Git history.
- Focused unit, static, real TEST integration, type, lint, privacy, and diff-hygiene gates passed.

---
*Phase: 39-discovery-and-claim*
*Completed: 2026-09-20*
