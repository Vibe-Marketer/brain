---
phase: 39-discovery-and-claim
plan: "12"
subsystem: call-participants
tags: [react, tanstack-query, invitations, privacy, accessibility]

requires:
  - phase: 39-05
    provides: Owner-only participation invitation lifecycle and server-derived status RPC
  - phase: 39-07
    provides: TEST-deployed invitation delivery, reminder, cancellation, and resend functions
  - phase: 39-09
    provides: Typed invitation service and TanStack Query hooks with call-cache invalidation
provides:
  - Canonical call_participants IDs preserved through call-detail speaker merging
  - Owner-only participant invitation controls with optional one-time reminder
  - Server-authorized invitation status, cancellation, and seven-day resend UI
  - Exact stale-state feedback followed by invitation and call cache refetch
affects: [39-13, 39-14, call-detail, participation-claim]

tech-stack:
  added: []
  patterns: [canonical participant authority, server-authorized row actions, participant-scoped pending state]

key-files:
  created: []
  modified:
    - src/types/meetings.ts
    - src/hooks/useCallDetailQueries.ts
    - src/components/CallDetailDialog.tsx
    - src/components/call-detail/CallParticipantsTab.tsx
    - src/components/call-detail/__tests__/CallParticipantsTab.claim-invite.test.tsx
    - src/components/call-detail/__tests__/CallParticipantsTab.identityEvidence.test.tsx
    - src/services/event-discovery.service.ts
    - src/services/__tests__/event-discovery.service.test.ts
    - src/hooks/useEventDiscovery.ts
    - src/hooks/__tests__/useEventDiscovery.test.ts

key-decisions:
  - "Invitation controls require a persisted call_participants.id, a canonical recording UUID, recording ownership, an email, and a status returned by the owner-scoped server RPC."
  - "Transcript, calendar, contact, display-name, and client-clock evidence never creates invitation authority or enables resend."
  - "Each participant row owns its reminder choice and pending state; the switch starts off and resets after every successful send or resend."

patterns-established:
  - "Participant-row authority: render no invitation UI until a canonical participant ID exactly matches a server-returned status."

requirements-completed: [DISCO-02, DISCO-03]

duration: 12min
completed: 2026-09-20
---

# Phase 39 Plan 12: Recording Owner Participation Invitations Summary

**Recording owners can now invite one canonical participant at a time from the existing Participants section, with server-controlled eligibility, reminder, status, cancellation, and resend behavior.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-20T09:24:06Z
- **Completed:** 2026-09-20T09:36:32Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Added `participant_id` only from persisted `call_participants.id` rows and preserved it through transcript merging without granting transcript-only speakers a canonical key.
- Passed only a validated canonical recording UUID and exact recording-owner state into the existing Participants tab; numeric legacy calls keep their existing display with no invitation controls.
- Added row-scoped send and resend actions, a visible one-time reminder switch that defaults off, scheduled-reminder cancellation, and text plus absolute dates for sent, available, scheduled, reminded, claimed, expired, and inactive states.
- Kept non-owner, weak, transcript-only, calendar-only, no-email, owner, and already-claimed rows free of invitation actions and private eligibility explanations.
- Preserved server 404/409 invitation changes as a typed stale-state result so the hook shows the approved message and refetches participant, recording-detail, and call-list state.
- Re-proved the entire owner and invitation lifecycle against the dedicated TEST Supabase project without changing production, deploying functions, or touching `main`.

## Task Commits

Each task was developed through a failing test followed by its implementation:

1. **Task 1 RED: Canonical participant invitation keys** - `69e08231` (test)
2. **Task 1 GREEN: Participant identity and recording-owner wiring** - `9e86ff1d` (feat)
3. **Task 2 RED: Invitation lifecycle controls** - `560013e0` (test)
4. **Task 2 GREEN: Owner invitation actions and status UI** - `7c98d879` (feat)

## Files Created/Modified

- `src/types/meetings.ts` - Adds the optional canonical participant ID to speaker data.
- `src/hooks/useCallDetailQueries.ts` - Selects and maps `call_participants.id` while keeping synthesized transcript speakers noncanonical.
- `src/components/CallDetailDialog.tsx` - Validates the recording UUID and passes exact owner context to the Participants tab.
- `src/components/call-detail/CallParticipantsTab.tsx` - Renders owner-only invitation actions, reminder choice, lifecycle status, dates, cancellation, and server-authorized resend.
- `src/components/call-detail/__tests__/CallParticipantsTab.claim-invite.test.tsx` - Covers canonical merging, owner privacy, send, reminder, pending, cancelled, reminded, claimed, expired, inactive, and resend behavior.
- `src/components/call-detail/__tests__/CallParticipantsTab.identityEvidence.test.tsx` - Preserves the existing identity-evidence contract with the new hook dependency isolated.
- `src/services/event-discovery.service.ts` - Maps server 404/409 invitation conflicts to a narrow stale-state error.
- `src/services/__tests__/event-discovery.service.test.ts` - Proves stale-state mapping without widening service responses.
- `src/hooks/useEventDiscovery.ts` - Adds participant-specific feedback and retains the complete settlement invalidation contract.
- `src/hooks/__tests__/useEventDiscovery.test.ts` - Proves exact feedback and stale-state refetch behavior.

## Decisions Made

- Invitation UI is absent unless the server returns a status for the exact canonical participant ID. Client-visible email, display name, participant type, and merged transcript data never infer eligibility.
- `canResend` is the only resend authority. The displayed expiry date is informational and is never compared to the client clock.
- A pending send, resend, or reminder cancellation disables only that participant row. Other eligible rows remain interactive while the hook serializes recording-scoped mutations.
- Revoked and superseded records use the same neutral “No active invitation” copy and expose no internal reason.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Preserved the server stale-invitation signal**
- **Found during:** Task 2
- **Issue:** The existing service collapsed every Edge Function error to `REQUEST_FAILED`, so a server 404/409 could not produce the required concurrent-state feedback even though settlement invalidated the right caches.
- **Fix:** Mapped only 404/409 invitation responses to `INVITATION_CHANGED`; the hook now renders the approved stale-state message and retains exact participant and call-cache invalidation.
- **Files modified:** `src/services/event-discovery.service.ts`, `src/services/__tests__/event-discovery.service.test.ts`, `src/hooks/useEventDiscovery.ts`, `src/hooks/__tests__/useEventDiscovery.test.ts`
- **Verification:** Focused service/hook tests pass, including stale response mapping, exact feedback, and invalidation.
- **Commit:** `7c98d879`

**2. [Rule 3 - Blocking test fixture] Isolated the new invitation hook in the identity-evidence test**
- **Found during:** Task 2 verification
- **Issue:** The existing focused identity badge test rendered `CallParticipantsTab` without a QueryClient because the component previously had no query dependency.
- **Fix:** Added the same narrow invitation-hook mock used by the participant UI tests; identity badge assertions remain unchanged.
- **Files modified:** `src/components/call-detail/__tests__/CallParticipantsTab.identityEvidence.test.tsx`
- **Verification:** Both identity-evidence tests and all participant invitation tests pass together.
- **Commit:** `7c98d879`

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking test fixture). **Impact:** Exact concurrent feedback now works without changing invitation authority, schema, endpoint shape, or product scope.

## Issues Encountered

- The real TEST invitation suite emits Supabase's existing multiple-GoTrueClient fixture warning while creating isolated actors. All 19 owner, eligibility, reminder, resend, concurrency, and RLS assertions passed.

## Verification

- Focused participant, identity, merge, service, and hook suite - **53/53 passed**.
- `VITEST_INTEGRATION_OK=true npx vitest run supabase/functions/send-participation-claim/__tests__/send-participation-claim.integration.test.ts --maxWorkers=1 --reporter=verbose` - **19/19 passed** against TEST.
- `npm run type-check` - **PASS**, zero new errors; existing baseline remains 300/300.
- Targeted ESLint across all modified implementation and test files - **PASS**.
- Privacy scans - **PASS**, no free-form email input, bulk invitation, client-clock resend authorization, numeric ID coercion, or rendered ineligibility reason.
- `git diff --check` - **PASS**.

## Known Stubs

None.

## User Setup Required

None.

## Next Phase Readiness

- Plan 39-13 can implement secure claim capture and authentication return using the committed invitation lifecycle.
- No database migration, Edge Function deployment, production Supabase mutation, production frontend change, or `main` change was made in this plan.

## Self-Check: PASSED

- All ten modified implementation/test files and this summary exist.
- Task commits `69e08231`, `9e86ff1d`, `560013e0`, and `7c98d879` resolve in Git history.
- Focused unit, real TEST integration, type, lint, privacy, and diff-hygiene gates passed.

---
*Phase: 39-discovery-and-claim*
*Completed: 2026-09-20*
