---
phase: 02-chat-foundation
plan: 09
subsystem: api
tags: [vercel-ai-sdk, switchover, chat, legacy-fallback, v2-backend, end-to-end-verification]

# Dependency graph
requires:
  - phase: 02-01
    provides: chat-stream-v2 Edge Function with streamText + tool pattern
  - phase: 02-05
    provides: All 14 RAG tools defined with zod schemas in chat-stream-v2
  - phase: 02-06
    provides: /chat2 test path with conditional transport URL
  - phase: 02-07
    provides: Inline citations with hover preview and SourceList
  - phase: 02-08
    provides: Streaming error handling, retry UX, connection stability
provides:
  - /chat always serves from chat-stream-v2 backend
  - Legacy chat-stream renamed to chat-stream-legacy as deployable fallback
  - /chat2 test route removed (no longer needed)
  - All 6 Phase 2 success criteria verified end-to-end
affects: [phase-7-refactor]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Direct v2 endpoint: chatEndpoint constant replaces conditional isV2 detection"

key-files:
  created: []
  modified:
    - src/pages/Chat.tsx
    - src/App.tsx
    - supabase/functions/chat-stream-legacy/index.ts (renamed from chat-stream)

key-decisions:
  - "Renamed chat-stream to chat-stream-legacy (not deleted) — preserves deployable fallback"
  - "Removed chatBasePath/chatEndpoint from dependency arrays since they are now constants"
  - "Kept useLocation import — still needed for location.state (filters, context attachments)"

patterns-established:
  - "Single backend: all /chat routes use chat-stream-v2 — no more conditional path detection"

# Metrics
duration: 2min
completed: 2026-01-28
---

# Phase 2 Plan 9: Switchover /chat → v2 Backend Summary

**/chat now always serves from chat-stream-v2 with all 14 RAG tools, inline citations, streaming error handling — legacy renamed to chat-stream-legacy as fallback**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-28T06:30:07Z
- **Completed:** 2026-01-28T06:32:46Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Switched /chat from legacy chat-stream to chat-stream-v2 (AI SDK streamText + tool backend)
- Renamed legacy function to chat-stream-legacy as a deployable fallback
- Removed /chat2 test route — no longer needed post-switchover
- Removed all conditional v2 code (isV2, chatBasePath ternary, v2 badge)
- All 6 Phase 2 success criteria verified programmatically and pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Rename legacy chat-stream and switch /chat to v2** - `782635c` (feat)
2. **Task 2: End-to-end verification of all Phase 2 success criteria** - No code changes (verification only, results below)

## Files Created/Modified
- `src/pages/Chat.tsx` - Removed isV2/chatBasePath conditionals, always uses chat-stream-v2, removed v2 badge, cleaned dependency arrays
- `src/App.tsx` - Removed /chat2 and /chat2/:sessionId route definitions
- `supabase/functions/chat-stream-legacy/index.ts` - Renamed from chat-stream/ (content unchanged)

## Decisions Made
- **Renamed not deleted:** Legacy chat-stream preserved as chat-stream-legacy for rollback capability. Can be deployed independently if v2 has issues.
- **Kept useLocation:** Despite removing isV2 path detection, useLocation() is still needed for location.state (filters, context attachments, newSession flag).
- **Cleaned dependency arrays:** chatBasePath and chatEndpoint are now constants, removed from useCallback/useMemo dependency arrays to avoid lint warnings.

## Phase 2 Success Criteria Verification Results

### SC1: User can send chat message and receive complete streamed response
- **Status:** PASS
- chat-stream-v2/index.ts: 3 streamText calls, 2 toUIMessageStreamResponse calls
- Chat.tsx uses chat-stream-v2 endpoint directly

### SC2: All 14 RAG tools fire when relevant to query
- **Status:** PASS
- chat-stream-v2/index.ts: 14 `tool({` definitions confirmed
- System prompt includes 4 query expansion guidance references

### SC3: Tool calls that find data return that data to the UI
- **Status:** PASS
- tool-call.tsx: getToolStatus function with 3+ state mappings
- 10 state/status/icon/color references for success/empty/error visual states

### SC4: Citations appear inline in chat responses
- **Status:** PASS
- message.tsx: 4 citation-related functions (parseCitations, MarkdownWithCitations, etc.)
- source.tsx: 8 CitationMarker/SourceList references

### SC5: Chat connection stays stable for 10+ consecutive messages
- **Status:** PASS
- Chat.tsx: 21 handleRetry/toast.error references for error recovery
- 9 incompleteMessageIds/partial references for response preservation
- 11 reconnectAttempts/MAX_RECONNECT references for connection stability

### SC6: Store errors surface to user with actionable error messages
- **Status:** PASS
- contentLibraryStore.ts: 7 toast.error calls
- contentItemsStore.ts: 5 toast.error calls
- businessProfileStore.ts: 4 toast.error calls
- **Total:** 16 toast.error calls across 3 stores

### Overall: 6/6 criteria PASS

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- **Phase 2 complete** — all 9 plans executed, all 6 success criteria pass
- Chat is now fully powered by AI SDK v2 backend with all features:
  - 14 RAG tools with zod schemas
  - Inline citations with hover preview
  - Streaming error handling with retry
  - Three-state tool call display
  - Store error toasts
- Legacy fallback available at chat-stream-legacy if needed
- Ready for Phase 3 (Integration OAuth Flows) or Phase 7 (Chat.tsx refactor)
- Phase 2 requirements addressed: CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05, STORE-01

---
*Phase: 02-chat-foundation*
*Completed: 2026-01-28*
