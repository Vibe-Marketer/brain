---
phase: 39-discovery-and-claim
plan: "15"
subsystem: notifications
tags: [react, tanstack-query, supabase, privacy, notifications]

requires:
  - phase: 39-04
    provides: Exact-once notification ledger, silent baseline, and caller sync RPC
  - phase: 39-09
    provides: Strict event-discovery service wrapper and client cache boundaries
  - phase: 39-10
    provides: Authorized Events focus behavior and generic unavailable fallback
provides:
  - Existing notification polling activates future-match sync once per query cycle
  - Exact metadata guard for event discovery notifications
  - Generic event notification copy and authorized Events focus navigation
  - Safe neutralization of malformed or private-rich event notifications
affects: [39-16, 39-17, event-discovery, notification-bell]

tech-stack:
  added: []
  patterns:
    - Best-effort caller-pull sync before the existing notification list fetch
    - Exact-key metadata validation before notification navigation
    - Fixed privacy-safe presentation for event discovery rows

key-files:
  created: []
  modified:
    - src/hooks/useNotifications.ts
    - src/components/notifications/notification-metadata.ts
    - src/components/notifications/NotificationBell.tsx
    - src/components/notifications/__tests__/NotificationBell.test.tsx

key-decisions:
  - "Discovery sync failure does not replace or erase the existing notification inbox; polling continues with a generic internal warning."
  - "Event discovery metadata is actionable only when it contains exactly kind, event_id, and the approved view_events action."
  - "The bell constructs /events navigation with router state from a validated UUID and never trusts a metadata route or server-provided private display copy."

patterns-established:
  - "Event notification boundary: recognize the exact event_discovered row type, validate exact metadata keys, then render fixed generic copy."

requirements-completed: [DISCO-01, DISCO-03]

duration: 7min
completed: 2026-09-20
---

# Phase 39 Plan 15: Future Event Notifications Summary

**The existing notification bell now idempotently discovers later event matches, renders only generic event copy, and focuses the authorized Events card without trusting stored routes or private metadata.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-09-20T09:55:22Z
- **Completed:** 2026-09-20T10:02:22Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added one best-effort `sync_my_discovered_event_notifications()` service call before every existing notification query cycle, preserving stored notifications when sync is temporarily unavailable.
- Added an exact-key guard that accepts only the server-approved event kind, UUID, and `view_events` action while rejecting route, title, owner, provider, email, recording, roster, and count fields.
- Rendered fixed **New event found** copy and a **View event →** action through the existing bell without a second inbox, toast-only alert, email, or digest.
- Constructed `/events` navigation internally with the validated event UUID in router state. The Events page reauthorizes through its caller-scoped list and shows the existing generic unavailable result when access has disappeared.
- Preserved reporter, health, recording-access, dismiss, unread, and mark-read behavior.

## Task Commits

Each task followed the failing-test then implementation cycle:

1. **Task 1 RED: Notification sync and metadata boundary** - `ce5b9492` (test)
2. **Task 1 GREEN: Idempotent sync and exact metadata validation** - `957eed14` (feat)
3. **Task 2 RED: Generic event action and neutralization behavior** - `9c98cb3b` (test)
4. **Task 2 GREEN: Privacy-safe event notification UI** - `a2011005` (feat)

## Files Created/Modified

- `src/hooks/useNotifications.ts` - Runs discovery sync before the existing authenticated list fetch and keeps the inbox available on sync failure.
- `src/components/notifications/notification-metadata.ts` - Defines and validates the exact event discovery metadata contract.
- `src/components/notifications/NotificationBell.tsx` - Renders fixed generic event content and navigates with a validated focus hint.
- `src/components/notifications/__tests__/NotificationBell.test.tsx` - Covers repeated query cycles, sync failure, strict metadata, generic copy, navigation, and neutralization while retaining existing notification regressions.

## Decisions Made

- Treated sync as best effort at the client boundary because the database transaction and retained unique ledger remain authoritative for exact-once creation. A temporary sync failure cannot hide already stored notifications.
- Required the `event_discovered` notification row type in addition to exact metadata before applying special presentation or navigation.
- Replaced stored event title and body values with fixed approved copy for every event notification. Invalid metadata gets only **This event is no longer available.** and no action.
- Passed the event UUID in router state rather than a URL parameter. The Events page performs the authorization-sensitive list read and supplies the generic stale result.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The repository's existing focused test emits React Router v7 future-flag warnings and the real TEST fixture emits the known multiple-GoTrueClient warning. All assertions passed.

## Verification

- `npx vitest run src/components/notifications/__tests__/NotificationBell.test.tsx --maxWorkers=1 --reporter=verbose` - **38/38 passed**, including existing reporter and recording-access cases.
- `VITEST_INTEGRATION_OK=true npx vitest run src/test/discovery-claim.integration.test.ts --maxWorkers=1 --reporter=verbose` - **14/14 passed** against the dedicated TEST Supabase project, including silent baseline, exact-once future sync, repeat dedupe, disconnect cleanup, authorization revocation, and legacy People RPC preservation.
- `npm run type-check` - **PASS**, zero new errors; baseline remains 300/300.
- Targeted ESLint - **PASS**, zero errors; one existing Fast Refresh warning remains on the component's exported reporter metadata helper.
- Privacy, route-trust, email/digest, and diff-hygiene scans - **PASS**.

## Known Stubs

None.

## Threat Flags

None. This plan calls an existing authenticated RPC and existing protected route; it adds no endpoint, schema, file-access path, or authentication surface.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 39-16 can exercise the complete discovery, notification, claim, and revocation flows against TEST using the committed notification boundary.
- No database migration, Edge Function deployment, production Supabase mutation, production frontend change, or `main` change was made.

## Self-Check: PASSED

- All four modified implementation/test files and this summary exist.
- Task commits `ce5b9492`, `957eed14`, `9c98cb3b`, and `a2011005` resolve in Git history.
- Focused unit, real TEST integration, type, lint, privacy, and diff-hygiene gates passed.

---
*Phase: 39-discovery-and-claim*
*Completed: 2026-09-20*
