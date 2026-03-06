---
phase: 02-chat-foundation
plan: 08
subsystem: ui
tags: [react, streaming, error-handling, retry, toast, sonner, connection-stability]

# Dependency graph
requires:
  - phase: 02-chat-foundation
    plan: 06
    provides: /chat2 test path with v2 backend endpoint
provides:
  - Streaming error handling with toast notifications and retry actions
  - Partial response preservation on streaming failure
  - Inline retry button and incomplete response indicator
  - Rate limit vs connection error distinction in UX
affects: [02-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "handleRetryRef pattern for breaking circular dependency between error effect and retry handler"
    - "incompleteMessageIds Set for tracking failed streaming messages"
    - "Toast action buttons for error recovery UX"

key-files:
  created: []
  modified:
    - src/pages/Chat.tsx

key-decisions:
  - "Ref pattern (handleRetryRef) to avoid circular dependency between error useEffect and handleRetry callback"
  - "incompleteMessageIds as Set<string> state for tracking which assistant messages were interrupted"
  - "Retry removes incomplete assistant message before resending — prevents duplication"
  - "lastUserMessageRef.current preserved on max reconnect (not nulled) so retry button works"

patterns-established:
  - "Error recovery UX: toast.error with action button + inline retry below message"
  - "Partial response preservation: never clear messages on error, mark incomplete instead"

# Metrics
duration: 3min
completed: 2026-01-28
---

# Phase 2 Plan 8: Streaming Error Handling Summary

**Toast-based error recovery with retry actions, partial response preservation, and inline incomplete message indicators for graceful streaming failure UX**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-28T06:21:47Z
- **Completed:** 2026-01-28T06:25:44Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Streaming failures show toast notification with "Connection lost. Your partial response has been saved." message and Retry action button
- Partial responses preserved on streaming failure — never wiped, marked with amber "Incomplete response" label
- Inline retry button below incomplete assistant messages with `↻ Retry` link
- `handleRetry()` removes incomplete assistant message and resends last user query without duplication
- Rate limit errors (429) remain distinguished from connection errors with separate UX flows
- Non-streaming errors also show retry toast action when a retryable message exists
- Incomplete message markers cleared automatically when streaming completes successfully
- Connection stability: existing reconnection logic (exponential backoff, 3 attempts) enhanced with retry UX after max attempts exhausted

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement streaming error handling and retry UX** - `eb74eb9` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified
- `src/pages/Chat.tsx` - Added incompleteMessageIds state, handleRetry callback, handleRetryRef for error effect, inline retry button, incomplete response indicator, toast retry actions

## Decisions Made
- **handleRetryRef pattern:** The error useEffect needs to reference handleRetry in toast action callbacks, but handleRetry is defined after the effect. Used a ref pattern (`handleRetryRef`) to break the circular dependency while keeping both hooks reactive.
- **lastUserMessageRef preserved on max reconnect:** Previously nulled on max retries, now preserved so the retry button in both toast and inline UI can resend the message.
- **Retry removes incomplete message:** When user clicks retry, the incomplete assistant message is removed from the conversation before resending. This prevents duplicate messages — the new response replaces the failed one.
- **incompleteMessageIds as state (not ref):** Needs to trigger re-render for the inline UI indicator, so must be React state rather than a ref.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Non-streaming errors also get retry toast actions**
- **Found during:** Task 1
- **Issue:** Plan only specified retry for streaming interruption errors, but general errors (e.g., server 500) with a retryable message should also offer retry
- **Fix:** Added retry toast action for all non-auth errors when `lastUserMessageRef.current` exists
- **Files modified:** src/pages/Chat.tsx
- **Committed in:** eb74eb9

**2. [Rule 2 - Missing Critical] Incomplete markers cleared on successful streaming**
- **Found during:** Task 1
- **Issue:** If user retries successfully, the incomplete markers from the previous attempt need cleanup
- **Fix:** Added effect to clear incompleteMessageIds when status becomes 'ready'
- **Files modified:** src/pages/Chat.tsx
- **Committed in:** eb74eb9

---

**Total deviations:** 2 auto-fixed (2 missing critical)
**Impact on plan:** Both additions improve robustness of error recovery UX. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Error handling and retry UX complete for both /chat and /chat2 paths
- CHAT-03 (streaming doesn't error out mid-response) addressed with graceful recovery
- Success criterion #5 (stable for 10+ messages) supported by connection stability improvements
- Ready for 02-09-PLAN.md (switchover: /chat → v2, legacy rename, final verification)

---
*Phase: 02-chat-foundation*
*Completed: 2026-01-28*
