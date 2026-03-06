---
phase: 02-chat-foundation
plan: 03
subsystem: api
tags: [search-pipeline, embeddings, openai, huggingface, cross-encoder, reranking, diversity-filter, deno, edge-functions, shared-modules]

# Dependency graph
requires:
  - phase: 02-01
    provides: chat-stream-v2 skeleton with streamText + tool pattern
provides:
  - Shared embedding generation module (_shared/embeddings.ts)
  - Shared search pipeline module (_shared/search-pipeline.ts) with hybrid search, re-ranking, diversity filtering
  - Type definitions for SearchResult, SearchFilters, FormattedSearchResult
affects: [02-05, 02-06, 02-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared module extraction pattern for Deno Edge Functions (_shared/ directory)"
    - "HuggingFace API key passed as parameter (not read from Deno.env inside shared module)"

key-files:
  created:
    - supabase/functions/_shared/embeddings.ts
    - supabase/functions/_shared/search-pipeline.ts
  modified: []

key-decisions:
  - "rerankResults takes hfApiKey as parameter instead of reading Deno.env internally — enables testability and explicit dependency"
  - "executeHybridSearch takes userId string instead of User object — simpler interface for tool callers"
  - "Kept inline diversityFilter (simple version) rather than importing from existing diversity-filter.ts — exact match to chat-stream logic"

patterns-established:
  - "Shared search pipeline: embeddings → hybrid RPC → rerank → diversity → format"
  - "Type exports from _shared modules for downstream consumers"

# Metrics
duration: 2min
completed: 2026-01-28
---

# Phase 2 Plan 3: Extract Search Pipeline to Shared Modules Summary

**Hybrid search pipeline (embedding → RPC → cross-encoder re-rank → diversity filter) extracted to reusable _shared/ modules with typed exports for all 14 RAG tools**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-28T06:06:21Z
- **Completed:** 2026-01-28T06:08:22Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Extracted `generateQueryEmbedding()` to `_shared/embeddings.ts` with typed `EmbeddingError` class and OpenAI API constants
- Extracted full search pipeline to `_shared/search-pipeline.ts`: `rerankResults()`, `diversityFilter()`, and new `executeHybridSearch()` orchestrator
- Exported type definitions (`SearchResult`, `SearchFilters`, `FormattedSearchResult`) for downstream tool implementations
- Zero behavior changes — all algorithms match `chat-stream/index.ts` exactly
- Legacy `chat-stream/index.ts` untouched — both legacy and v2 can independently import shared modules

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract embedding generation to _shared/embeddings.ts** - `2759763` (feat)
2. **Task 2: Extract search pipeline to _shared/search-pipeline.ts** - `0a12cf1` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified
- `supabase/functions/_shared/embeddings.ts` - Shared OpenAI embedding generation (text-embedding-3-small)
- `supabase/functions/_shared/search-pipeline.ts` - Hybrid search, cross-encoder re-ranking, diversity filtering, orchestrator

## Decisions Made
- **hfApiKey as parameter:** `rerankResults()` takes the HuggingFace API key as an explicit parameter rather than reading `Deno.env.get('HUGGINGFACE_API_KEY')` internally. This makes the shared module testable and avoids hidden Deno runtime dependencies.
- **userId string over User object:** `executeHybridSearch()` accepts `userId: string` instead of a `User` interface. Simpler interface — callers only need the ID for the RPC filter.
- **Inline diversityFilter:** Used the simple `diversityFilter()` from `chat-stream/index.ts` (max-per-recording only) rather than the more complex `_shared/diversity-filter.ts` (which also does cosine similarity). The simple version matches production behavior exactly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added typed EmbeddingError class**
- **Found during:** Task 1 (embeddings extraction)
- **Issue:** Plan said "throw a typed error" but didn't specify a class. The original code throws a generic `Error`.
- **Fix:** Created `EmbeddingError` class extending `Error` with `statusCode` property for proper error handling downstream.
- **Files modified:** supabase/functions/_shared/embeddings.ts
- **Verification:** Class exported and usable by consumers
- **Committed in:** 2759763

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Minor enhancement for better error handling. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Both shared modules ready for plan 02-05 (define all 14 RAG tools with zod schemas)
- `executeHybridSearch()` provides single entry point for all search-based tools
- Type exports enable strong typing in tool implementations
- Legacy `chat-stream` continues working independently — zero regression risk

---
*Phase: 02-chat-foundation*
*Completed: 2026-01-28*
