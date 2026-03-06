---
phase: 02-chat-foundation
plan: 06
subsystem: ui
tags: [react-router, chat, transport, parallel-testing, v2-backend]

# Dependency graph
requires:
  - phase: 02-chat-foundation
    plan: 01
    provides: chat-stream-v2 Edge Function skeleton
provides:
  - /chat2 route serving Chat.tsx connected to chat-stream-v2
  - Conditional transport URL based on route path
  - Visual v2 backend indicator for testers
affects: [02-07, 02-08, 02-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Path-based backend selection via useLocation for parallel testing"
    - "chatBasePath pattern for route-aware navigation in shared components"

key-files:
  created: []
  modified:
    - src/App.tsx
    - src/pages/Chat.tsx

key-decisions:
  - "chatBasePath variable ensures all navigation stays within /chat or /chat2 context"
  - "Purple pill badge for v2 indicator — distinct from orange brand, signals 'experimental'"

patterns-established:
  - "Parallel testing via route-based backend selection (no feature flags needed)"

# Metrics
duration: 2min
completed: 2026-01-28
---

# Phase 2 Plan 6: Frontend /chat2 Test Path Summary

**Path-based parallel testing: /chat2 routes to chat-stream-v2 backend while /chat stays on legacy chat-stream, with visual v2 badge indicator**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-28T06:12:48Z
- **Completed:** 2026-01-28T06:15:31Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Added `/chat2` and `/chat2/:sessionId` routes in App.tsx pointing to same Chat component
- Chat.tsx detects path via `useLocation()` and conditionally selects `chat-stream-v2` or `chat-stream` endpoint
- All 6 navigation calls in Chat.tsx updated to use `chatBasePath` — sessions stay within their /chat or /chat2 context
- Purple "v2 backend" badge shown in header only on /chat2 path
- Zero changes to /chat behavior — legacy endpoint completely untouched

## Task Commits

Each task was committed atomically:

1. **Task 1: Add /chat2 route and conditional transport URL** - `13a208b` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified
- `src/App.tsx` - Added /chat2 and /chat2/:sessionId route definitions
- `src/pages/Chat.tsx` - Added isV2/chatEndpoint/chatBasePath detection, v2 badge, route-aware navigation

## Decisions Made
- **chatBasePath for route-aware navigation:** All navigate() calls use `chatBasePath` instead of hardcoded `/chat` — prevents accidentally switching from v2 to legacy when creating sessions, selecting sessions, or deleting sessions
- **Purple pill badge for v2 indicator:** Chose purple (distinct from brand orange) to signal "experimental/test" without confusion with production UI elements
- **chatEndpoint added to transport useMemo deps:** Ensures transport is recreated when switching between /chat and /chat2 (though in practice users don't switch mid-session)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Route-aware navigation for all navigate() calls**
- **Found during:** Task 1 (conditional transport URL)
- **Issue:** Plan only mentioned transport URL change, but Chat.tsx has 6 navigate() calls hardcoded to `/chat/...` — if user is on /chat2 and creates a session, they'd be redirected to /chat and lose the v2 backend
- **Fix:** Added `chatBasePath` variable and updated all 6 navigate() calls + their useCallback dependency arrays
- **Files modified:** src/pages/Chat.tsx
- **Verification:** grep confirms all navigation uses chatBasePath, tsc --noEmit passes
- **Committed in:** 13a208b

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential for correct parallel testing. Without this, sessions created on /chat2 would navigate to /chat and use legacy backend.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- /chat2 test path ready for manual testing once chat-stream-v2 has all 14 tools (02-05)
- Frontend transport URL switch is complete — switching /chat to v2 (02-09) only needs route change
- Citations (02-07) and error handling (02-08) can be tested on /chat2 in isolation
- Live verification requires Docker for `supabase functions serve` or remote deployment

---
*Phase: 02-chat-foundation*
*Completed: 2026-01-28*
