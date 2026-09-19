---
phase: 38-access-policy-share-link-key-migration-request-flow
plan: "10"
subsystem: frontend
tags: [react, tanstack-query, supabase, sharing, uuid-migration]

requires:
  - phase: 38-06
    provides: Proven Phase 38 UUID share bridge, v3 shared-with-me RPC, and generated database types
provides:
  - Pure UUID-native frontend sharing service for links, token responses, access logs, and Shared With Me
  - TanStack sharing hooks with canonical UUID cache keys and complete mutation invalidation
  - UUID-native Share dialog and Shared With Me detail navigation without numeric identity coercion
affects: [38-15, sharing-ui, shared-with-me, call-detail]

tech-stack:
  added: []
  patterns:
    - Pure service boundary for authenticated Edge API and UUID-native sharing RPC access
    - Canonical UUID identity carried unchanged from share rows through table and detail views

key-files:
  created:
    - src/services/sharing.service.ts
    - src/services/__tests__/sharing.service.test.ts
    - src/components/transcripts/__tests__/shared-with-me-mapping.test.ts
  modified:
    - src/types/sharing.ts
    - src/hooks/useSharing.ts
    - src/hooks/__tests__/useSharing.test.ts
    - src/components/sharing/ShareCallDialog.tsx
    - src/components/call-detail/CallDetailHeader.tsx
    - src/components/transcripts/TranscriptsTab.tsx
    - type-baseline.json

key-decisions:
  - "Share creation, revocation, access-log reads, and token resolution use the existing share-call Edge API; owner link lists and Shared With Me use their authorized database surfaces."
  - "Call detail disables Share until canonical_uuid is present rather than coercing a provider identifier."
  - "Shared With Me maps the v3 recording UUID into both recording_id and canonical_uuid so UUID-only recordings open correctly."

patterns-established:
  - "Sharing hooks contain no Supabase/fetch implementation; all I/O lives in sharing.service.ts."
  - "Create and revoke mutations invalidate the UUID link key and the centralized call-list cache set in onSettled."

requirements-completed: [ACCESS-07, ACCESS-08]

duration: 23min
completed: 2026-09-19
---

# Phase 38 Plan 10: Frontend UUID Sharing Migration Summary

**UUID-native sharing service and hooks preserve existing share-link UX while making Shared With Me work for legacy-backed and UUID-only recordings.**

## Performance

- **Duration:** 23 min
- **Started:** 2026-09-19T18:26:48Z
- **Completed:** 2026-09-19T18:49:39Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Extracted share link list/create/revoke, token response mapping, access-log reads, and Shared With Me v3 access into a pure async service with bridge-aware types.
- Rebuilt the sharing hooks around that service, UUID cache keys, optimistic create display, and centralized on-settle invalidation while retaining the existing `/s/<token>` copy/revoke experience.
- Removed every frontend sharing numeric-ID conversion; the detail header supplies `canonical_uuid` and safely disables sharing if it is unavailable.
- Replaced TranscriptsTab's embedded v2 RPC with the unconditional `useSharedWithMe(enabled)` hook and canonical UUID mapping for table selection and detail navigation.
- Added focused service, hook, and mapping contracts, including a UUID-only non-Fathom row.

## Task Commits

Each TDD task was committed as RED then GREEN:

1. **Task 1: Extract sharing data access into a UUID-native service**
   - `d906d31f` test: failing UUID service contracts
   - `b83db0e9` feat: UUID-native service and bridge-aware types
2. **Task 2: Refactor sharing hooks and dialog to canonical UUIDs**
   - `d8000fae` test: failing service-boundary hook contracts
   - `437d5cd6` feat: service-backed hooks, dialog, header, and invalidation
3. **Task 3: Move Shared With Me to the UUID-native RPC**
   - `5cff51da` test: failing canonical row-mapping contract
   - `188d4675` feat: v3 hook consumption and UUID detail identity

## Files Created/Modified

- `src/services/sharing.service.ts` - Pure sharing I/O boundary for existing Edge and database contracts.
- `src/types/sharing.ts` - Canonical/legacy bridge types, UUID create input, and v3 Shared With Me rows.
- `src/hooks/useSharing.ts` - TanStack wrappers for sharing, token states, access logs, and Shared With Me.
- `src/components/sharing/ShareCallDialog.tsx` - UUID-only create/list/revoke UI with unchanged token URL and toast behavior.
- `src/components/call-detail/CallDetailHeader.tsx` - Passes canonical UUID and disables Share while it is unresolved.
- `src/components/transcripts/TranscriptsTab.tsx` - Uses the v3-backed hook and maps UUID rows into Meeting identity.
- `src/services/__tests__/sharing.service.test.ts` - Service boundary and response-union contracts.
- `src/hooks/__tests__/useSharing.test.ts` - Hook service delegation and cache invalidation contracts.
- `src/components/transcripts/__tests__/shared-with-me-mapping.test.ts` - UUID-only navigation, search, and pagination contract.
- `type-baseline.json` - Removes resolved sharing/test errors and records the current pre-existing type baseline.

## Decisions Made

- The owner link list stays on the RLS-protected table query because the Edge API has no recording-list route. Mutations and access-log reads use the Edge API where server authorization owns the operation.
- The public token response is mapped in the service into the existing discriminated union so SharedCallView remains source-compatible.
- Shared With Me waits for its dedicated hook before the surrounding table query runs, then uses the hook's data timestamp in the table cache key so loaded shares replace the initial state.
- No provider ID fallback is performed in the UI. The Phase 38 v3 RPC owns legacy-only row resolution and returns canonical UUIDs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reconciled the committed type-error baseline**
- **Found during:** Task 2 verification
- **Issue:** Adding the service changed TypeScript traversal enough to expose one additional pre-existing `useTeamMembers.ts` TS2589 occurrence, while the refactor also eliminated the stale sharing-test, sharing-hook, and recording-service baseline entries.
- **Fix:** Regenerated the baseline after confirming the only added occurrence was the known deep-instantiation class and retained the actual remaining 299 errors.
- **Files modified:** `type-baseline.json`
- **Verification:** `npm run type-check` passes with 0 new errors and 299/299 baseline errors.
- **Committed in:** `437d5cd6`, `188d4675`

---

**Total deviations:** 1 auto-fixed blocking verification issue.
**Impact on plan:** The baseline now reflects current compiler output and removes 22 resolved errors. No runtime behavior or dependency changed.

## Issues Encountered

- The isolated worktree initially lacked its own dependency tree. An ignored local symlink to the repository's existing `node_modules` allowed the required scripts to run without installing packages or changing package files.
- Full real-database and browser verification was intentionally left to Plan 38-15; this parallel workstream ran only focused frontend tests to avoid shared test-project fixture races.

## Verification

- `npm test -- src/services/__tests__/sharing.service.test.ts src/hooks/__tests__/useSharing.test.ts src/components/transcripts/__tests__/shared-with-me-mapping.test.ts src/components/call-detail/__tests__/PasteSourceRendering.test.tsx` - **27/27 passed**.
- `npm run type-check` - **passed**, 0 new errors, 299/299 registered baseline errors.
- Source scan confirmed no `parseInt(` or `Number(` in the migrated sharing service/types/hook/dialog/header files.
- Source scan confirmed no direct `.from(` or `.rpc(` data access in `useSharing.ts`.
- Source scan confirmed `get_calls_shared_with_me_v2` is absent from TranscriptsTab and v3 is called in the service.
- `git diff --exit-code a9507b2d..HEAD -- package.json package-lock.json` - **passed**; no dependencies changed.
- `git diff --check a9507b2d..HEAD` - **passed**.

## TDD Gate Compliance

- Task 1 RED `d906d31f` preceded GREEN `b83db0e9`.
- Task 2 RED `d8000fae` preceded GREEN `437d5cd6`.
- Task 3 RED `5cff51da` preceded GREEN `188d4675`.

## Known Stubs

None. Empty-array defaults are intentional loading/empty-state values backed by active query functions.

## User Setup Required

None - no deployment, production change, test-project mutation, or external configuration occurred.

## Next Phase Readiness

- Plan 38-07's UUID-first share-call implementation can merge under this service contract: POST uses `recording_id`, token outcomes remain the same, and link mutations retain their existing routes.
- Plan 38-15 can run the centralized serial real-database suite and browser verification after all parallel Wave 5 branches integrate.
- No blockers remain for this plan.

## Self-Check: PASSED

- All 10 implementation/test files exist.
- All six RED/GREEN task commits exist in git history.
- Acceptance scans, focused tests, type check, dependency diff, deletion check, and whitespace check passed.
- No tracked files were deleted and the worktree was clean before this summary was written.

---
*Phase: 38-access-policy-share-link-key-migration-request-flow*
*Completed: 2026-09-19*
