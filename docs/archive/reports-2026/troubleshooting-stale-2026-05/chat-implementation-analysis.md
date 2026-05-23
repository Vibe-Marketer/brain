# Chat Implementation Analysis Report

**Date:** 2026-01-13
**Status:** Comprehensive Research Complete
**Author:** Claude Code Research

---

## Executive Summary

The chat implementation is a **fragmented mess** with:
- **4 different versions** of the core search function across migrations
- **Dead/broken frontend code** that attempts direct API calls
- **Inconsistent provider usage** (OpenRouter vs OpenAI)
- **Missing data** in the transcript_chunks table (embeddings/metadata not populated)
- **Potential schema drift** between code and database

---

## Complete Architecture Map

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React)                                        │
├──────────────────────────────────────────────────────────────────────────────────┤
│  Chat.tsx                              │  ContentGenerator.tsx                    │
│  ├─ useChat (@ai-sdk/react) ✅         │  └─ useAIProcessing() 🔴 BROKEN         │
│  └─ DefaultChatTransport → Edge Fn     │      ├─ Imports ai-agent.ts              │
│                                        │      └─ Tries to call OpenAI from browser│
│  useChatSession.ts                     │                                          │
│  ├─ Session management ✅              │  ai-agent.ts 🔴 DEAD CODE                │
│  └─ Filter handling ✅                 │  ├─ createOpenAI with VITE_OPENAI_API_KEY│
│                                        │  └─ Would expose API key if it worked!   │
├──────────────────────────────────────────────────────────────────────────────────┤
│                           EDGE FUNCTIONS (Deno)                                   │
├──────────────────────────────────────────────────────────────────────────────────┤
│  chat-stream/index.ts ✅ WORKING       │  semantic-search/index.ts ✅             │
│  ├─ Uses OpenRouter for LLM            │  ├─ Uses OpenAI for embeddings           │
│  ├─ Uses OpenAI for embeddings         │  └─ Returns search results               │
│  ├─ Uses HuggingFace for reranking     │                                          │
│  ├─ 14 tools defined                   │  rerank-results/index.ts ✅              │
│  └─ Manually implements AI SDK protocol│  └─ Uses HuggingFace cross-encoder       │
│                                        │                                          │
│  process-embeddings/index.ts ✅        │  enrich-chunk-metadata/index.ts ⚠️       │
│  ├─ Queue-based processing             │  ├─ Uses OpenAI (NOT OpenRouter)         │
│  ├─ Uses OpenAI for embeddings         │  └─ Fire-and-forget from pipeline        │
│  └─ Triggers metadata enrichment       │                                          │
│                                        │  generate-content/index.ts ⚠️            │
│                                        │  └─ Uses OpenAI (NOT OpenRouter)          │
├──────────────────────────────────────────────────────────────────────────────────┤
│                           DATABASE (PostgreSQL)                                   │
├──────────────────────────────────────────────────────────────────────────────────┤
│  transcript_chunks                     │  RPC Functions                           │
│  ├─ id, user_id, recording_id          │  ├─ hybrid_search_transcripts 🔴         │
│  ├─ chunk_text, chunk_index            │  │   (4 DIFFERENT VERSIONS IN MIGRATIONS)│
│  ├─ embedding vector(1536)             │  ├─ get_available_metadata ✅            │
│  ├─ fts (tsvector)                     │  ├─ claim_embedding_tasks ✅             │
│  ├─ topics[], sentiment, intent_signals│  └─ increment_embedding_progress ✅      │
│  ├─ entities (jsonb), user_tags[]      │                                          │
│  └─ source_platform                    │  embedding_queue                         │
│                                        │  └─ Queue-based processing ✅            │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## Critical Issues

### Issue #1: Database Function Version Chaos (MIGRATION DRIFT)

The `hybrid_search_transcripts` function has been redefined **4 times** across migrations:

| Migration | Parameters | Returns | Status |
|-----------|------------|---------|--------|
| `20251125000001_ai_chat_infrastructure.sql` | 12 params | 15 cols | ⚠️ Old |
| `20251125235835_add_metadata_filters.sql` | 15 params | 15 cols | ⚠️ Old |
| `20260108000004_enhance_chat_tools_metadata_filters.sql` | 16 params | 17 cols | ⚠️ Old |
| `20260111000007_add_source_platform_filter_to_search.sql` | **17 params** | **18 cols** | ✅ Current |

**Problem**: If migrations weren't applied in order, or if the database is behind, the function signature won't match what the code expects.

**The latest function signature expects:**
```sql
hybrid_search_transcripts(
  query_text, query_embedding, match_count, full_text_weight, semantic_weight, rrf_k,
  filter_user_id, filter_date_start, filter_date_end, filter_speakers, filter_categories,
  filter_recording_ids, filter_topics, filter_sentiment, filter_intent_signals,
  filter_user_tags, filter_source_platforms  -- 17 params
)
```

---

### Issue #2: Code Not Passing All Parameters

**File:** `supabase/functions/chat-stream/index.ts:670-683`

The `executeSearchTranscripts` function only passes 12 parameters:
```typescript
{
  query_text, query_embedding, match_count, full_text_weight, semantic_weight, rrf_k,
  filter_user_id, filter_date_start, filter_date_end, filter_speakers,
  filter_categories, filter_recording_ids
  // MISSING: filter_topics, filter_sentiment, filter_intent_signals,
  //          filter_user_tags, filter_source_platforms
}
```

**Why it "works"**: PostgreSQL DEFAULT NULL allows omitting params, but this means:
- Metadata filters from basic search are NEVER applied
- Only the `executeHybridSearch` function (used by advanced tools) passes all filters

---

### Issue #3: Dead Frontend Code (SECURITY RISK)

**Files:**
- `src/lib/ai-agent.ts`
- `src/hooks/useAIProcessing.ts`

```typescript
// src/lib/ai-agent.ts
const openai = createOpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY || '',  // 🔴 FRONTEND ENV VAR!
});
```

**Problems:**
1. `VITE_` vars are embedded at build time and visible in browser
2. Direct API call from browser exposes credentials
3. Used by `ContentGenerator.tsx` which is likely broken

---

### Issue #4: Empty transcript_chunks Table

**Root Cause Chain:**
1. User imports calls from Fathom → `fathom_calls` and `fathom_transcripts` populated
2. Embedding job must be triggered → `embedding_jobs` and `embedding_queue` created
3. `process-embeddings` Edge Function must run → Creates `transcript_chunks` records
4. `enrich-chunk-metadata` must succeed → Populates `topics`, `sentiment`, `intent_signals`, `entities`

**If ANY step fails:**
- `transcript_chunks` is empty → All search tools return "no results"
- Metadata columns are NULL → Metadata-specific tools (`searchByTopics`, etc.) fail

---

### Issue #5: Missing Environment Variables

**Required for chat-stream:**

| Variable | Purpose | Where Used |
|----------|---------|------------|
| `SUPABASE_URL` | Database connection | Everywhere |
| `SUPABASE_SERVICE_ROLE_KEY` | Auth bypass | Everywhere |
| `OPENROUTER_API_KEY` | LLM chat | chat-stream |
| `OPENAI_API_KEY` | Embeddings | chat-stream, process-embeddings, semantic-search |
| `HUGGINGFACE_API_KEY` | Reranking (optional) | chat-stream, rerank-results |

**If `HUGGINGFACE_API_KEY` is missing:**
- Reranking is silently skipped
- Results use RRF scores only (lower quality)

---

### Issue #6: Inconsistent Provider Usage

| Edge Function | Provider | Model | Should Use |
|---------------|----------|-------|------------|
| chat-stream | OpenRouter ✅ | Any | OpenRouter |
| generate-content | OpenAI 🔴 | gpt-4-turbo | OpenRouter |
| enrich-chunk-metadata | OpenAI 🔴 | gpt-4o-mini | OpenRouter |
| process-embeddings | OpenAI ✅ | text-embedding-3-small | OpenAI (correct) |
| semantic-search | OpenAI ✅ | text-embedding-3-small | OpenAI (correct) |

**Note:** OpenRouter doesn't support embeddings, so OpenAI direct for embeddings is correct.

---

### Issue #7: Reranking Can Be Slow/Fail

**File:** `supabase/functions/chat-stream/index.ts:118-206`

The reranking uses HuggingFace Inference API:
- Cold start: 5-second delay if model is loading
- Rate limited: 100ms between batches
- On failure: Silently falls back to original scores

---

## Tool Execution Analysis

### All 14 Tools Status

| Tool | Function | Works? | Issue |
|------|----------|--------|-------|
| `searchTranscriptsByQuery` | `executeSearchTranscripts` | ⚠️ | Missing metadata filters |
| `searchBySpeaker` | `executeSearchBySpeaker` | ✅ | Uses executeHybridSearch |
| `searchByDateRange` | `executeSearchByDateRange` | ✅ | Uses executeHybridSearch |
| `searchByCategory` | `executeSearchByCategory` | ✅ | Uses executeHybridSearch |
| `searchByIntentSignal` | `executeSearchByIntentSignal` | ✅ | Requires metadata population |
| `searchBySentiment` | `executeSearchBySentiment` | ✅ | Requires metadata population |
| `searchByTopics` | `executeSearchByTopics` | ✅ | Requires metadata population |
| `searchByUserTags` | `executeSearchByUserTags` | ✅ | Requires user_tags population |
| `searchByEntity` | `executeSearchByEntity` | ⚠️ | Missing some params, post-filters |
| `getCallDetails` | `executeGetCallDetails` | ✅ | Simple DB query |
| `getCallsList` | `executeGetCallsList` | ✅ | Simple DB query |
| `getAvailableMetadata` | `executeGetAvailableMetadata` | ✅ | Requires metadata population |
| `advancedSearch` | `executeAdvancedSearch` | ✅ | Uses executeHybridSearch |
| `compareCalls` | `executeCompareCalls` | ⚠️ | Missing some params |

---

## Root Cause Summary

### Why Tools Fail

1. **No Data**: `transcript_chunks` empty because:
   - Embedding job never triggered
   - `process-embeddings` failed silently
   - Metadata enrichment failed

2. **Schema Mismatch**: Database function signature doesn't match code

3. **Missing Filters**: `executeSearchTranscripts` doesn't pass metadata filters

4. **Cold Models**: HuggingFace reranking can timeout on first call

5. **Environment**: Missing API keys cause silent failures

---

## Required Environment Variables (Complete List)

```bash
# Supabase (REQUIRED)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# LLM - OpenRouter (REQUIRED for chat)
OPENROUTER_API_KEY=sk-or-v1-...

# OpenAI (REQUIRED for embeddings)
OPENAI_API_KEY=sk-...

# HuggingFace (OPTIONAL - reranking falls back gracefully)
HUGGINGFACE_API_KEY=hf_...
```

---

## Recommended Fixes (Priority Order)

### P0: Verify Data Exists

```sql
-- Check if transcript_chunks has data
SELECT COUNT(*) FROM transcript_chunks WHERE user_id = 'YOUR_USER_ID';

-- Check if metadata is populated
SELECT COUNT(*) FROM transcript_chunks
WHERE user_id = 'YOUR_USER_ID'
AND topics IS NOT NULL;

-- Check embedding jobs
SELECT * FROM embedding_jobs WHERE user_id = 'YOUR_USER_ID';
```

### P1: Fix executeSearchTranscripts

Add missing metadata filter parameters to match `executeHybridSearch`:

```typescript
// Add these to the RPC call:
filter_topics: null,
filter_sentiment: null,
filter_intent_signals: null,
filter_user_tags: null,
filter_source_platforms: null,
```

### P2: Delete Dead Frontend Code

```bash
rm src/lib/ai-agent.ts
rm src/hooks/useAIProcessing.ts
# Then fix imports in ContentGenerator.tsx
```

### P3: Standardize Providers

Update `generate-content` and `enrich-chunk-metadata` to use OpenRouter.

### P4: Add Error Handling

Add explicit logging when:
- Embedding job fails
- Metadata enrichment fails
- Reranking times out

---

## Debugging Checklist

To diagnose why chat is failing:

1. **Check transcript_chunks table**
   - Empty? → Run embedding job
   - Has data but no metadata? → Run `enrich-chunk-metadata`

2. **Check environment variables**
   - Missing `OPENROUTER_API_KEY`? → Chat LLM won't work
   - Missing `OPENAI_API_KEY`? → Embeddings/search won't work
   - Missing `HUGGINGFACE_API_KEY`? → Lower quality results

3. **Check Edge Function logs**
   - Look for "Search error:" messages
   - Look for "Embedding error:" messages
   - Look for "Re-ranking skipped" messages

4. **Check database migrations**
   - Verify `hybrid_search_transcripts` signature matches latest migration

---

## Component Status Summary

| Component | Status | Impact |
|-----------|--------|--------|
| **Frontend Chat** | ✅ Works | AI SDK v5 properly implemented |
| **Backend chat-stream** | ⚠️ Partial | Missing filter params in some tools |
| **ai-agent.ts** | 🔴 Dead | Direct API calls from browser |
| **transcript_chunks** | ❓ Check | Likely empty or missing metadata |
| **hybrid_search_transcripts** | 🔴 4 versions | Migration drift risk |
| **Provider consistency** | ⚠️ Mixed | Some use OpenAI instead of OpenRouter |

---

## File References

### Frontend Files
- `src/pages/Chat.tsx` - Main chat page (working)
- `src/hooks/useChatSession.ts` - Session management (working)
- `src/components/chat/chat-container.tsx` - Chat container (working)
- `src/lib/ai-agent.ts` - **DEAD CODE - DELETE**
- `src/hooks/useAIProcessing.ts` - **DEAD CODE - DELETE**

### Backend Edge Functions
- `supabase/functions/chat-stream/index.ts` - Main chat endpoint
- `supabase/functions/semantic-search/index.ts` - Search endpoint
- `supabase/functions/rerank-results/index.ts` - Reranking endpoint
- `supabase/functions/process-embeddings/index.ts` - Embedding pipeline
- `supabase/functions/enrich-chunk-metadata/index.ts` - Metadata extraction
- `supabase/functions/generate-content/index.ts` - Content generation

### Database Migrations
- `supabase/migrations/20251125000001_ai_chat_infrastructure.sql`
- `supabase/migrations/20251125235835_add_metadata_filters.sql`
- `supabase/migrations/20260108000004_enhance_chat_tools_metadata_filters.sql`
- `supabase/migrations/20260111000007_add_source_platform_filter_to_search.sql`
- `supabase/migrations/20251128100000_embedding_queue_system.sql`

---

## Related Documentation

- `docs/design/brand-guidelines-v4.1.md` - UI design standards
- `docs/architecture/api-naming-conventions.md` - API naming rules
- `CLAUDE.md` - Development instructions (requires OpenRouter for all LLM calls)

---

*Report generated by Claude Code Research - 2026-01-13*
