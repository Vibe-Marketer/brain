---
phase: 02-chat-foundation
plan: 11
subsystem: api
tags: [llm, prompt-engineering, rag, tool-calling, ai-sdk]

# Dependency graph
requires:
  - phase: 02-05
    provides: 14 RAG tools with getCallDetails tool definition
provides:
  - System prompt with RECORDING ID RULES preventing model hallucination
  - Explicit instructions for using real recording_ids from search results
affects: [chat, rag-tools, model-behavior]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "System prompt includes explicit rules for tool parameter sourcing"
    - "Tool descriptions reinforce parameter requirements"

key-files:
  created: []
  modified:
    - supabase/functions/chat-stream-v2/index.ts

key-decisions:
  - "Added RECORDING ID RULES as CRITICAL section in system prompt"
  - "Included explicit example flow showing correct recording_id extraction"
  - "Updated getCallDetails tool description to reinforce requirement"

patterns-established:
  - "System prompt must explicitly instruct model on parameter sourcing for tools"
  - "Tool descriptions should reinforce critical usage rules"

# Metrics
duration: 3min
completed: 2026-01-28
---

# Phase 02 Plan 11: Recording ID Hallucination Fix Summary

**System prompt updated with CRITICAL recording_id rules preventing model from fabricating IDs when calling getCallDetails**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-28T16:30:00Z
- **Completed:** 2026-01-28T16:33:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added RECORDING ID RULES (CRITICAL) section to system prompt
- Explicit instruction to NEVER invent, guess, or use placeholder IDs like 1, 2, 3
- Example flow demonstrating correct recording_id extraction from search results
- Updated getCallDetails tool description to reinforce requirement

## Task Commits

Each task was committed atomically:

1. **Task 1: Update system prompt with recording_id usage instructions** - `708a746` (fix)

## Files Created/Modified
- `supabase/functions/chat-stream-v2/index.ts` - Added RECORDING ID RULES section to buildSystemPrompt() and updated getCallDetails tool description

## Decisions Made
- Placed RECORDING ID RULES after QUERY EXPANSION GUIDANCE section for logical flow
- Marked section as CRITICAL to emphasize importance
- Included concrete example showing search result -> getCallDetails flow with actual recording_id

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None - single-task plan executed cleanly.

## User Setup Required
None - no external service configuration required. Changes only affect system prompt behavior.

## Next Phase Readiness
- Recording ID hallucination bug addressed at prompt level
- Model now has explicit instructions to extract real recording_ids from search results
- Ready for verification in production to confirm model follows new instructions

---
*Phase: 02-chat-foundation*
*Plan: 11 (gap closure)*
*Completed: 2026-01-28*
