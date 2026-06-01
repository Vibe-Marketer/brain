---
phase: 06-launch-ux-support-rls-hygiene
plan: 02
subsystem: ui
tags: [support, sidebar, resend, edge-functions, onboarding]
requires:
  - phase: 06-launch-ux-support-rls-hygiene
    provides: launch UX routing/onboarding baseline from 06-01
provides:
  - Single sidebar Support popout above Settings with required support actions
  - In-app support ticket dialog and frontend invoke wrapper
  - Authenticated send-support-ticket Edge Function using Resend
affects: [onboarding, sidebar, support, edge-functions]
tech-stack:
  added: []
  patterns:
    - Support actions consolidated into a single anchored popover
    - Support ticket transport uses authenticated edge-function invoke with bounded context
key-files:
  created:
    - src/components/support/SupportPopover.tsx
    - src/components/support/SupportTicketDialog.tsx
    - src/services/support-ticket.service.ts
    - supabase/functions/send-support-ticket/index.ts
  modified:
    - src/components/ui/sidebar-nav.tsx
    - src/components/ui/__tests__/sidebar-nav.test.tsx
key-decisions:
  - "Support docs opens docs.callvaultai.com in a new tab with noopener/noreferrer."
  - "Ticket payload carries only bounded basic context fields and never displays raw IDs in UI copy."
patterns-established:
  - "Support entry point is one bottom-sidebar trigger above Settings."
  - "Edge auth for support tickets is centralized through authenticateRequest."
requirements-completed: [ONB-05]
duration: 4min
completed: 2026-06-01
---

# Phase 06 Plan 02: Launch UX Support RLS Hygiene Summary

**Sidebar help is now unified into one Support popout with launch-required actions, plus a simple authenticated ticket-to-support email flow.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-06-01T06:28:00Z
- **Completed:** 2026-06-01T06:31:49Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Replaced separate sidebar help buttons with a single Support trigger above Settings and added all five required support actions in order.
- Added `SupportTicketDialog` and `submitSupportTicket()` service wrapper to send bounded ticket context through `send-support-ticket`.
- Implemented authenticated `send-support-ticket` Edge Function with Zod validation, HTML escaping, bounded fields, and Resend delivery to `support@callvaultai.com`.

## Task Commits

1. **Task 1: Replace separate sidebar help buttons with one Support popout** - `c5460d93` (feat)
2. **Task 2: Add support ticket UI and service wrapper** - `1a0fe5bd` (feat)
3. **Task 3: Add authenticated Resend-backed ticket Edge Function** - `f418232e` (feat)

## Files Created/Modified
- `src/components/ui/sidebar-nav.tsx` - Replaces separate tour/how-it-works buttons with `SupportPopover`.
- `src/components/support/SupportPopover.tsx` - Adds anchored support action popover and wiring for video/tour/how-it-works/docs/ticket.
- `src/components/support/SupportTicketDialog.tsx` - Adds ticket form UI with optional fallback reply email and exact toast copy.
- `src/services/support-ticket.service.ts` - Adds pure service function invoking `send-support-ticket` with URL/user agent/user/org/workspace context.
- `supabase/functions/send-support-ticket/index.ts` - Adds authenticated, validated, escaped Resend ticket sender endpoint.
- `src/components/ui/__tests__/sidebar-nav.test.tsx` - Adds support-popover checks and dialog mock for isolated sidebar tests.

## Decisions Made
- None - followed plan as specified.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Sidebar unit test failed due to missing AuthProvider after adding ticket dialog**
- **Found during:** Plan verification loop after Task 3
- **Issue:** `SidebarNav` test suite failed because `SupportTicketDialog` calls `useAuth`, which requires provider context not present in this unit test.
- **Fix:** Mocked `SupportTicketDialog` in `sidebar-nav.test.tsx` to keep this unit focused on sidebar/support-popover behavior.
- **Files modified:** `src/components/ui/__tests__/sidebar-nav.test.tsx`
- **Verification:** `npm run test -- --run src/components/ui/__tests__/sidebar-nav.test.tsx`
- **Commit:** `161ce139`

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** No scope change; fix was required to satisfy verification gates.

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None.

## Verification

- `npm run test -- --run src/components/ui/__tests__/sidebar-nav.test.tsx` ✅
- `rg -n "Watch the Onboarding Video|Support Docs|docs.callvaultai.com" src/components/support src/components/ui/sidebar-nav.tsx` ✅
- `rg -n "authenticateRequest|z\.object|support@callvaultai.com|RESEND_API_KEY|cc" supabase/functions/send-support-ticket/index.ts` ✅
- `npm run build` ✅

## Self-Check: PASSED

