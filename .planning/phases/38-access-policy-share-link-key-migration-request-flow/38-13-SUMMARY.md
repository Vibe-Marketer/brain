---
phase: 38-access-policy-share-link-key-migration-request-flow
plan: "13"
subsystem: frontend
tags: [react, radix-ui, tanstack-query, access-policy, responsive-ui, accessibility]

requires:
  - phase: 38-access-policy-share-link-key-migration-request-flow
    plan: "10"
    provides: Canonical UUID Share dialog integration in CallDetailHeader
  - phase: 38-access-policy-share-link-key-migration-request-flow
    plan: "11"
    provides: Owner request/grant services, hooks, and management contracts
  - phase: 38-access-policy-share-link-key-migration-request-flow
    plan: "12"
    provides: Shared six-level AccessLevelPicker and policy hooks
provides:
  - Responsive owner-only recording access panel using one desktop/tablet Popover or mobile Dialog tree
  - Per-recording inherited/custom policy management with Public confirmation and reset
  - Pending request review plus approve, deny, active-grant, and revoke controls
  - Owner-only ACCESS header control immediately before the separate SHARE control
  - Controlled panel state and focused-request input for Plan 38-14 deep links
affects: [38-14, 38-15, recording-access, call-detail-header]

tech-stack:
  added: []
  patterns:
    - One shared access content tree selected into Popover or Dialog by useBreakpointFlags
    - Components consume only TanStack Query hooks while services own Supabase reads
    - Header ownership derives from Meeting.user_id, the UI adapter for recordings.owner_user_id

key-files:
  created:
    - src/components/sharing/RecordingAccessPanel.tsx
    - src/components/call-detail/__tests__/CallDetailHeader.access.test.tsx
  modified:
    - src/components/call-detail/CallDetailHeader.tsx
    - src/components/sharing/__tests__/RecordingAccessPanel.test.tsx
    - src/services/recording-access.service.ts
    - src/types/recording-access.ts
    - src/hooks/__tests__/useRecordingAccess.test.ts
    - src/services/__tests__/recording-access.service.test.ts
    - src/components/call-detail/__tests__/PasteSourceRendering.test.tsx

key-decisions:
  - "The responsive panel renders one interaction tree: Popover for desktop/tablet and Dialog for mobile."
  - "The existing SHARE dialog remains an independent sibling action; ACCESS receives only call.canonical_uuid."
  - "Request submission time is read from recording_access_requests through its existing owner RLS policy because the management RPC does not return created_at."

patterns-established:
  - "Risky policy and lifecycle actions are confirmed in the component; mutation hooks retain optimistic rollback, invalidation, and toast ownership."
  - "Deep-linked pending requests expand in place, resolved requests show a non-error status, and missing/non-owner targets use one generic unavailable message."

requirements-completed: [ACCESS-01, ACCESS-05, ACCESS-06, ACCESS-08]

duration: 12min
completed: 2026-09-19
---

# Phase 38 Plan 13: Recording Access Panel Summary

**A responsive owner-only recording access panel now manages per-recording policy, pending participant requests, and individual grants beside the unchanged Share action.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-19T21:14:32Z
- **Completed:** 2026-09-19T21:26:00Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Added the exact persistent recording-copy notice, six-level policy picker, inherited/custom badge, reset behavior, Public confirmation, loading skeletons, retryable failure state, and polite status announcements.
- Added compact pending-request review with ordered verified evidence, one-click approval, confirmed denial, active individual grants, and confirmed revocation.
- Added a single responsive interaction tree: a clamped 400px/70vh Popover on desktop and tablet, and a viewport-gutter Dialog with 44px key actions on mobile.
- Added owner-only ACCESS immediately before SHARE while preserving canonical UUID handling and the separate Share dialog.
- Activated all five expected-failure acceptance contracts and added owner, non-owner, canonical UUID, controlled deep-link, destructive confirmation, and mobile-tree coverage.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Activate recording access panel contracts** - `38a73a4c` (test)
2. **Task 1 GREEN: Build the responsive access management panel** - `125ca822` (feat)
3. **Task 2: Add the owner-only ACCESS entry beside SHARE** - `b7766811` (feat)
4. **Task 1 correctness follow-up: Show request submission time** - `b26dae53` (fix)
5. **Task 1 proof follow-up: Verify request submission timestamps** - `b1a0ac59` (test)

## Files Created/Modified

- `src/components/sharing/RecordingAccessPanel.tsx` - Shared responsive policy, request, and grant management surface with confirmations and live announcements.
- `src/components/sharing/__tests__/RecordingAccessPanel.test.tsx` - Eight active acceptance tests; no Plan 13 `it.fails` markers remain.
- `src/components/call-detail/CallDetailHeader.tsx` - Owner-only ACCESS trigger before the unchanged SHARE trigger plus controlled deep-link props.
- `src/components/call-detail/__tests__/CallDetailHeader.access.test.tsx` - Owner/non-owner, action order, canonical UUID, and focused-request coverage.
- `src/components/call-detail/__tests__/PasteSourceRendering.test.tsx` - Auth-context fixture required by the owner-aware header.
- `src/services/recording-access.service.ts` - Owner-RLS request creation-time lookup for accurate relative request time.
- `src/types/recording-access.ts` - Typed request submission timestamp.
- `src/hooks/__tests__/useRecordingAccess.test.ts` - Updated typed owner-request fixture.
- `src/services/__tests__/recording-access.service.test.ts` - Proof that request and meeting times remain distinct.

## Decisions Made

- Used the existing `Meeting.user_id` field for owner comparison because `mapRecordingToMeeting` already maps `recordings.owner_user_id` into that UI-domain field.
- Kept the panel mounted beside Share and accepted optional controlled open/focus props so Plan 38-14 can open the same surface from notifications without creating another access UI.
- Kept lifecycle feedback split by layer: hooks own toasts and cache rollback; the panel adds the required polite live-region announcements.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Added the real request submission timestamp**
- **Found during:** Overall verification after Task 2
- **Issue:** The owner management RPC returns the meeting date but not `recording_access_requests.created_at`; using it for the row's relative request time would show incorrect information.
- **Fix:** Read request IDs and creation timestamps from the existing RLS-protected request table in the service and added `requestedAt` to the owner contract. No migration, database deployment, or policy change was required.
- **Files modified:** `src/services/recording-access.service.ts`, `src/types/recording-access.ts`, panel and hook/service tests
- **Verification:** Service mapping proof, focused panel/hook suites, type check, and build all passed.
- **Committed in:** `b26dae53`, `b1a0ac59`

---

**Total deviations:** 1 auto-fixed (1 missing critical functionality).
**Impact on plan:** The correction completes the approved pending-row contract without expanding database or deployment scope.

## Issues Encountered

- The isolated worktree initially contained only a partial generated `node_modules` directory. It was replaced locally with an ignored symlink to the repository's existing installed dependencies; no package or lockfile changed.
- Browser screenshot verification could not exercise the owner-only surface because the isolated browser had no authenticated local CallVault owner session or seeded owner recording. Plan 38-15 remains the designated integrated desktop/mobile visual proof. Component behavior, responsive tree selection, type check, lint, and production build were verified here.

## Verification

- Focused Vitest command covering panel, owner header, preserved Share dialog, preserved paste-source header, hooks, and service mapping - **6 files, 33 tests passed**.
- Focused ESLint across all owned source and test files - **passed with zero errors**.
- `npm run type-check` - **passed**, zero new errors against the repository baseline.
- `npm run build` against the committed tree - **passed**, 4,837 modules transformed; only existing bundle-size and Browserslist-age warnings were reported.
- Acceptance scans - no Plan 13 `it.fails`, Lucide, `framer-motion`, schema migration, package, lockfile, production, or TEST Supabase change.

## Known Stubs

None.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: owner-request-timestamp-read | `src/services/recording-access.service.ts` | Adds an authenticated read of request IDs and creation timestamps; the existing owner/requester RLS policy remains the authorization boundary and the UI receives no new owner data. |

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 38-14 can drive `accessPanelOpen`, `onAccessPanelOpenChange`, and `focusedAccessRequestId` from notification and email deep links.
- Plan 38-15 can perform authenticated desktop/mobile visual proof and the complete integrated Phase 38 verification suite.
- No production or TEST Supabase change, deployment, push, or protected-branch mutation occurred.

## Self-Check: PASSED

- All nine created/modified implementation and test artifacts exist.
- Commits `38a73a4c`, `125ca822`, `b7766811`, `b26dae53`, and `b1a0ac59` exist in repository history.
- Focused tests, preserved sharing/header tests, type check, lint, build, acceptance scan, deletion check, and whitespace check passed.

---
*Phase: 38-access-policy-share-link-key-migration-request-flow*
*Completed: 2026-09-19*
