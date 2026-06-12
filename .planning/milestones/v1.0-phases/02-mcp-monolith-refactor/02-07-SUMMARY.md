---
phase: 02-mcp-monolith-refactor
plan: 07
subsystem: backend
tags: [mcp, edge-functions, ai, dynamic-imports, vitest]

requires:
  - phase: 02-mcp-monolith-refactor
    provides: Complete read, write, admin registry extraction and dispatcher pattern
provides:
  - All 4 current AI-category MCP tools live under tools/ai/
  - AI SDK, OpenRouter, and Zod dependencies moved out of mcp-server/index.ts
  - AI invariant tests follow extracted modules and assert non-AI hot-path cleanliness
affects: [mcp-server, phase-02, phase-08]

tech-stack:
  added: []
  patterns: [ToolModule, registry-dispatch, dynamic-ai-imports, source-anchor-tests]

key-files:
  created:
    - supabase/functions/mcp-server/tools/ai/extract_action_items.ts
    - supabase/functions/mcp-server/tools/ai/ask_call.ts
    - supabase/functions/mcp-server/tools/ai/get_sentiment.ts
    - supabase/functions/mcp-server/tools/ai/get_coaching_notes.ts
  modified:
    - supabase/functions/mcp-server/index.ts
    - supabase/functions/mcp-server/tools/registry.ts
    - supabase/functions/mcp-server/__tests__/ai-tools-invariants.test.ts
    - supabase/functions/mcp-server/__tests__/contract-surface.test.ts
    - supabase/functions/mcp-server/__tests__/golden-replay.test.ts

key-decisions:
  - "Placed OpenRouter, AI SDK, and Zod dynamic imports after cache checks and usage gates so cache hits do not load AI dependencies."
  - "Kept enforceMcpAiUsage as a static module import inside AI modules because it is a local shared guard, not an AI SDK dependency."
  - "Preserved index.ts fallback switch for final Plan 02-08 cleanup instead of deleting dispatcher structure in this plan."

patterns-established:
  - "AI tools are extracted one file per tool with category: ai and the existing ToolModule handler contract."
  - "AI invariant tests scan extracted handler bodies while hot-path tests scan index/protocol/auth/gating and non-AI modules for forbidden AI dependencies."

requirements-completed: [MCP-05]

duration: 16 min
completed: 2026-05-28
---

# Phase 02 Plan 07: AI Tool Extraction Summary

**Complete AI-category MCP module extraction with dynamic AI SDK/OpenRouter/Zod loading**

## Performance

- **Duration:** 16 min
- **Started:** 2026-05-28T13:52:54Z
- **Completed:** 2026-05-28T14:08:39Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Extracted `extract_action_items`, `ask_call`, `get_sentiment`, and `get_coaching_notes` into `supabase/functions/mcp-server/tools/ai/`.
- Removed top-level `@openrouter/ai-sdk-provider`, `ai`, `zod`, and `enforceMcpAiUsage` imports from `mcp-server/index.ts`.
- Registered all four AI modules in `tools/registry.ts` with `category: 'ai'`.
- Preserved AI cache/usage ordering: cache hits return before quota enforcement, LLM paths call `enforceMcpAiUsage` before model calls.
- Added test coverage proving AI dependencies are absent from `index.ts` and non-AI tool modules.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract action-items and ask-call AI tools with dynamic imports** - `bdfc3985` (feat)
2. **Task 2: Extract sentiment and coaching AI tools with cache invariants** - `bdfc3985` (feat)
3. **Task 3: Verify non-AI hot path has no AI top-level imports** - `bdfc3985` (feat)

## Files Created/Modified

- `supabase/functions/mcp-server/tools/ai/*.ts` - Complete current AI tool module set with dynamic OpenRouter/AI SDK/Zod imports.
- `supabase/functions/mcp-server/index.ts` - Removed AI dependency imports and inline AI case bodies.
- `supabase/functions/mcp-server/tools/registry.ts` - Registers every current AI tool module.
- `supabase/functions/mcp-server/__tests__/ai-tools-invariants.test.ts` - Resolves extracted handler bodies and asserts AI dependencies stay out of the non-AI hot path.
- `supabase/functions/mcp-server/__tests__/contract-surface.test.ts` - Asserts all four AI modules exist, export `category: 'ai'`, and are included in the registry.
- `supabase/functions/mcp-server/__tests__/golden-replay.test.ts` - Maps `ask_call` to the extracted AI module for replay fixture anchoring.

## Decisions Made

- Kept cache checks before dynamic AI imports so cached AI outputs do not load OpenRouter, Vercel AI SDK, or Zod.
- Kept `enforceMcpAiUsage` statically imported in the AI modules because usage enforcement is local policy code and must remain visible to invariant tests.
- Left the empty fallback switch in `index.ts` for Plan 02-08 final trim, because this plan's scope was AI extraction and dynamic dependency movement.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated AI invariant source anchors for extracted modules**
- **Found during:** Task 1/2 verification
- **Issue:** `ai-tools-invariants.test.ts` originally scanned inline `case` bodies in `index.ts`; after extraction it had to follow module files. The first update scanned full module source, which included `enforceMcpAiUsage` import lines before the handler body and caused false ordering failures.
- **Fix:** The test now resolves AI module files and slices from the `async handler` body for runtime ordering checks.
- **Files modified:** `supabase/functions/mcp-server/__tests__/ai-tools-invariants.test.ts`
- **Verification:** AI invariant, usage registry, contract, category, golden replay, and build gates pass.
- **Committed in:** `bdfc3985`

---

**Total deviations:** 1 auto-fixed test-anchor update.  
**Impact on plan:** No MCP behavior scope was broadened; the fix keeps source-level invariants accurate after module extraction.

## Issues Encountered

- Initial AI invariant run failed on source-anchor ordering because module imports were included in the scanned block. Runtime ordering was preserved; the test anchor was narrowed to handler bodies.
- Vite build emitted existing chunk-size and mixed static/dynamic import warnings for `jspdf` and `docx`; build exited 0.

## Verification

- `npm test -- --run supabase/functions/mcp-server/__tests__/ai-tools-invariants.test.ts supabase/functions/mcp-server/__tests__/track-ai-usage-registry.test.ts supabase/functions/mcp-server/__tests__/contract-surface.test.ts` - initially failed on test-anchor ordering, then passed with 89 tests.
- `npm test -- --run supabase/functions/mcp-server/__tests__/ai-tools-invariants.test.ts supabase/functions/mcp-server/__tests__/track-ai-usage-registry.test.ts supabase/functions/mcp-server/__tests__/category-gating.test.ts supabase/functions/mcp-server/__tests__/contract-surface.test.ts` - 108 passed.
- `rg -n "openrouter|generateText|generateObject|zod" supabase/functions/mcp-server/index.ts supabase/functions/mcp-server/tools/read supabase/functions/mcp-server/tools/write supabase/functions/mcp-server/tools/admin` - no matches.
- `rg -n "case '(extract_action_items|ask_call|get_sentiment|get_coaching_notes)'" supabase/functions/mcp-server/index.ts` - no matches.
- `npm test -- --run supabase/functions/mcp-server/__tests__/ai-tools-invariants.test.ts supabase/functions/mcp-server/__tests__/contract-surface.test.ts && npm run build` - 73 tests passed; build passed.
- `npm test -- --run supabase/functions/mcp-server/__tests__/golden-replay.test.ts supabase/functions/mcp-server/__tests__/contract-surface.test.ts` - 15 passed.
- `npm run build` - passed after commit against committed source state.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 02-08 can now remove final monolith remnants, verify the full 41-tool modular dispatcher, and capture live/cold-start evidence. Read, write, admin, and AI categories are all modularized.

---
*Phase: 02-mcp-monolith-refactor*
*Completed: 2026-05-28*
