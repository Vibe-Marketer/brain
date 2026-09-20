---
phase: 39-discovery-and-claim
plan: "10"
subsystem: frontend-ui
tags: [react, tanstack-query, accessibility, privacy, cursor-pagination]

requires:
  - phase: 39-09
    provides: Privacy-safe event discovery types, services, and TanStack hooks
  - phase: 38-access-policy-share-link-key-migration-request-flow
    provides: Opaque recording access request action and lifecycle
provides:
  - Dedicated authenticated Events page with server-authoritative groups and cursor pagination
  - Semantic privacy-safe event cards for readable and anonymous restricted copies
  - Accessible loading, empty, error, pagination, request, and lost-authorization states
affects: [39-12, events-route, notifications, account-settings-discovery]

tech-stack:
  added: []
  patterns: [safe-type-only rendering, server-order preservation, mutation focus restoration]

key-files:
  created:
    - src/pages/Events.tsx
    - src/components/events/EventCard.tsx
    - src/components/events/EventListStates.tsx
  modified:
    - src/pages/__tests__/Events.test.tsx

key-decisions:
  - "Restricted cards derive their heading from the event date and ignore the server heading unless at least one readable copy exists."
  - "Opaque request handles remain inside the mutation closure and never enter DOM attributes, labels, logs, tooltips, or analytics fields."
  - "Notification focus targets use router state, auto-page through the authorized result set, and degrade to one generic unavailable message."

patterns-established:
  - "Safe card boundary: React event cards accept only DiscoveredEvent and never enrich from calls, participants, services, or Supabase."
  - "Focus-safe authorization refresh: request completion refetches the authoritative ordered list before focusing the surviving card."

requirements-completed: [DISCO-01, DISCO-03]

duration: 12min
completed: 2026-09-20
---

# Phase 39 Plan 10: Dedicated Privacy-Safe Events Page Summary

**A card-based Events page now exposes permitted recordings and one-click anonymous access requests while keeping restricted metadata and opaque action handles outside the DOM.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-20T08:57:00Z
- **Completed:** 2026-09-20T09:09:24Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Built semantic event cards that show readable recording actions and anonymous restricted rows from the strict Phase 39 domain type only.
- Added the dedicated EVENTS page with action, available, and waiting groups in authoritative server order plus bounded cursor pagination.
- Added exact loading, empty, error, request, cooldown, success, and lost-authorization states with accessible live regions, focus handling, and 44px actions.
- Proved injected owner, provider, title, transcript, summary, roster, source ID, and opaque request-handle fixtures never render.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build privacy-safe event cards and list states** - `ae6c71f6` (feat)
2. **Task 2: Compose server-ordered groups and bounded load-more page** - `c155b0a8` (feat)

## Files Created/Modified

- `src/components/events/EventCard.tsx` - Safe readable/restricted card composition and Phase 38 request action.
- `src/components/events/EventListStates.tsx` - Accessible skeleton, empty, error, pagination, and generic unavailable states.
- `src/pages/Events.tsx` - AppShell page over `useDiscoveredEvents`, preserving server grouping and pagination.
- `src/pages/__tests__/Events.test.tsx` - Component, privacy, exact-copy, pagination, refetch, focus, and stale-target coverage.

## Decisions Made

- A card without a readable copy always computes `Event on [localized date]` locally, even if an unsafe runtime payload injects a private heading.
- A readable recording opens through the established `/call/:callId` route; restricted rows never create links or expose stable identifiers.
- The page groups only by the server-projected `group` discriminator and preserves item order within every group; it performs no content-based authorization or priority inference.
- A notification focus target travels in router state rather than visible URL text. The page loads additional authorized cursors when needed and never prints a missing target.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Rendering the real AppShell in the focused unit test required unrelated Auth and Query providers. The test now mocks only the shell frame while exercising the real Events page, cards, hooks, states, and router behavior.
- Several approved labels intentionally repeat across cards. Assertions were scoped to counts or roles so the tests reflect valid accessible markup rather than assuming globally unique visible copy.

## Verification

- `npx vitest run src/pages/__tests__/Events.test.tsx --maxWorkers=1 --reporter=verbose` - **11/11 passed**.
- `npm run type-check` - **PASS**, zero new errors; existing baseline remains 300/300.
- `git diff --check` - **PASS**.
- Direct service/Supabase scan across the page and event components - **PASS**, no matches.
- Restricted metadata, logging, hidden DOM, and test-ID scan across production event UI - **PASS**, no matches.

## Known Stubs

None.

## User Setup Required

None.

## Next Phase Readiness

- Plan 39-12 can wire the protected `/events` route, main navigation entry, Settings CTA, and notification activation to this page.
- Invitation and claim UI work can proceed independently; no database, deployment, production, or `main` change was made here.
- No blockers remain.

## Self-Check: PASSED

- All three created UI files and the modified focused test exist.
- Task commits `ae6c71f6` and `c155b0a8` resolve in Git history.
- Focused tests, type check, privacy scans, and diff hygiene all passed after the final edits.

---
*Phase: 39-discovery-and-claim*
*Completed: 2026-09-20*
