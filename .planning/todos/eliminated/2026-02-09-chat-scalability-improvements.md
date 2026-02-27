# Chat System Scalability Improvements

**Date:** 2026-02-09  
**Priority:** HIGH  
**Category:** Performance & Scalability  
**Source:** Comprehensive chat system analysis

---

## Context

Comprehensive analysis of CallVault chat system identified critical scalability bottlenecks. Current capacity ~150 concurrent users. Target: 1000+ users.

**Key Finding:** Current Vercel AI SDK + OpenRouter + Supabase architecture is the RIGHT choice. Do NOT migrate to OpenAI Agents SDK.

**Related Documents:**
- `.planning/codebase/CONCERNS.md` - Detailed technical concerns
- `.planning/codebase/ARCHITECTURE.md` - Backend architecture analysis
- `.planning/research/SUMMARY.md` - OpenAI Agents SDK research
- `.planning/research/MIGRATION_ASSESSMENT.md` - Migration path analysis

---

## Immediate Priority Tasks (This Week)

### 1. Add Query Result Caching with Redis

**Priority:** 🔴 CRITICAL  
**Effort:** 2 days  
**Impact:** 5-10x capacity increase, 60-80% latency reduction

**Problem:**
Every chat request re-executes full 600-1500ms pipeline. With 3-5 parallel tool calls, this compounds to 1.8-7.5s latency.

**Files to Change:**
- `supabase/functions/_shared/search-pipeline.ts`
- `supabase/functions/_shared/embeddings.ts`

**Implementation:**
```typescript
// Add to _shared/search-pipeline.ts
import { Redis } from 'https://deno.land/x/upstash_redis/mod.ts';

const redis = new Redis({
  url: Deno.env.get('UPSTASH_REDIS_REST_URL'),
  token: Deno.env.get('UPSTASH_REDIS_REST_TOKEN'),
});

const CACHE_TTL_SECONDS = 300; // 5 minutes

async function getCachedSearch(query: string, filters: SearchFilters): Promise<HybridSearchResponse | null> {
  const cacheKey = `search:${hashQuery(query, filters)}`;
  const cached = await redis.get(cacheKey);
  return cached ? JSON.parse(cached) : null;
}

async function cacheSearchResults(query: string, filters: SearchFilters, results: HybridSearchResponse): Promise<void> {
  const cacheKey = `search:${hashQuery(query, filters)}`;
  await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(results));
}
```

**Dependencies:**
- Upstash Redis account
- Environment variables: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

---

### 2. Implement Embedding Cache

**Priority:** 🟡 MEDIUM  
**Effort:** 1 day  
**Impact:** 50-70% embedding API cost reduction

**Problem:**
Identical queries generate identical embeddings every time. Wasteful API calls and increased latency.

**Files to Change:**
- `supabase/functions/_shared/embeddings.ts`

**Implementation:**
```typescript
// Add to _shared/embeddings.ts
const embeddingCache = new Map<string, { embedding: number[]; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function generateQueryEmbeddingCached(query: string, openaiApiKey: string): Promise<number[]> {
  const cacheKey = hashString(query.toLowerCase().trim());
  const cached = embeddingCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log('[embeddings] Cache hit for query');
    return cached.embedding;
  }
  
  const embedding = await generateQueryEmbedding(query, openaiApiKey);
  embeddingCache.set(cacheKey, { embedding, timestamp: Date.now() });
  return embedding;
}
```

**Note:** In-memory cache only works within single function invocation. For cross-request caching, use Redis (see task 1).

---

### 3. Upgrade AI SDK from v3.x to v4+

**Priority:** 🟡 MEDIUM  
**Effort:** 1 day  
**Impact:** Fixes stale closure bugs, improves frontend stability

**Problem:**
Currently using `@ai-sdk/react ^3.0.68` but code references v5 patterns. Causes stale closure bugs requiring extensive ref workarounds in Chat.tsx (lines 125-211).

**Files to Change:**
- `package.json`
- `src/pages/Chat.tsx` (cleanup ref workarounds)
- `src/hooks/useChatSession.ts`
- `src/hooks/useChatStreaming.ts`

**Steps:**
1. Update `package.json`: `"@ai-sdk/react": "^4.0.0"` (or latest v4/v5)
2. Review breaking changes in AI SDK changelog
3. Remove ref workarounds in Chat.tsx that were needed for v3 stale closures
4. Test streaming, tool calls, and error handling
5. Run E2E tests: `npx playwright test e2e/chat-*.spec.ts`

---

## Short-term Tasks (Next Month)

### 4. Parallelize Re-ranking

**Priority:** 🔴 HIGH  
**Effort:** 2 days  
**Impact:** 50-70% reduction in p99 latency

**Problem:**
HuggingFace re-ranking is synchronous with 1500ms timeout per batch. Sequential processing blocks entire pipeline (up to 45s worst case).

**Files to Change:**
- `supabase/functions/_shared/search-pipeline.ts` (lines 340-389)

**Implementation:**
```typescript
// Option 1: Parallel batch processing
async function rerankResultsParallel(
  query: string,
  candidates: SearchResult[],
  hfApiKey: string,
  topK: number
): Promise<SearchResult[]> {
  const batches = chunk(candidates.slice(0, RERANK_MAX_CANDIDATES), RERANK_BATCH_SIZE);
  
  // Process all batches in parallel
  const batchResults = await Promise.all(
    batches.map(batch => rerankBatch(query, batch, hfApiKey))
  );
  
  const scored = batchResults.flat();
  return scored.sort((a, b) => (b.rerank_score || 0) - (a.rerank_score || 0)).slice(0, topK);
}

// Option 2: Skip re-ranking for simple queries
async function executeHybridSearch(params: HybridSearchParams): Promise<...> {
  // ... search code ...
  
  // Skip re-ranking if query is simple (single word, no filters)
  const shouldRerank = query.split(' ').length > 2 || hasComplexFilters(filters);
  
  if (!shouldRerank) {
    return formatResults(candidates.slice(0, limit));
  }
  
  const reranked = await rerankResultsParallel(query, candidates, hfApiKey, limit * 2);
  // ...
}
```

---

### 5. Add Cost Limits Per User

**Priority:** 🟡 MEDIUM  
**Effort:** 1 day  
**Impact:** Prevents runaway costs, protects against abuse

**Problem:**
Usage is tracked but not limited. No protection against abuse.

**Files to Change:**
- `supabase/functions/_shared/usage-tracker.ts`
- `supabase/functions/chat-stream-v2/index.ts`

**Implementation:**
```typescript
async function checkCostLimit(supabase: SupabaseClient, userId: string, estimatedCost: number): Promise<boolean> {
  const { data: usage } = await supabase
    .from('embedding_usage_logs')
    .select('cost_cents')
    .eq('user_id', userId)
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // 30 days
  
  const totalCost = usage.reduce((sum, row) => sum + row.cost_cents, 0);
  const limitCents = 1000; // $10 limit
  
  return totalCost + estimatedCost <= limitCents;
}

// In chat-stream-v2/index.ts
const canProceed = await checkCostLimit(supabase, userId, estimatedCost);
if (!canProceed) {
  return new Response(JSON.stringify({ error: 'Monthly cost limit exceeded' }), {
    status: 429,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
```

---

### 6. Fix RLS Vulnerabilities

**Priority:** 🔴 HIGH  
**Effort:** 2 days  
**Impact:** Security - prevents cross-bank data access

**Problem:**
1. Chat session filters can reference recordings user doesn't own
2. Search function can return chunks from all user's banks
3. `transcript_chunks` still references deprecated `fathom_calls` table

**Files to Change:**
- New migration: `supabase/migrations/YYYYMMDD_fix_chat_rls_vulnerabilities.sql`

**Implementation:**
```sql
-- 1. Add validation trigger to prevent accessing recordings user doesn't own
CREATE OR REPLACE FUNCTION validate_chat_session_filters()
RETURNS TRIGGER AS $$
BEGIN
  -- Check that all recording_ids in filter belong to user
  IF NEW.filter_recording_ids IS NOT NULL AND array_length(NEW.filter_recording_ids, 1) > 0 THEN
    IF EXISTS (
      SELECT 1 FROM recordings
      WHERE recording_id = ANY(NEW.filter_recording_ids)
      AND user_id != NEW.user_id
    ) THEN
      RAISE EXCEPTION 'Cannot filter by recordings you do not own';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chat_session_filters_validation
  BEFORE INSERT OR UPDATE ON chat_sessions
  FOR EACH ROW
  EXECUTE FUNCTION validate_chat_session_filters();

-- 2. Update FK from fathom_calls to recordings
ALTER TABLE transcript_chunks
  DROP CONSTRAINT IF EXISTS transcript_chunks_recording_id_fkey,
  ADD CONSTRAINT transcript_chunks_recording_id_fkey
    FOREIGN KEY (recording_id, user_id)
    REFERENCES recordings(recording_id, user_id)
    ON DELETE CASCADE;

-- 3. Add bank_id filtering to hybrid_search_transcripts
-- (Update function to include bank_id parameter and WHERE clause)
```

---

### 7. Add Missing Composite Indexes

**Priority:** 🟡 MEDIUM  
**Effort:** 1 day  
**Impact:** Query performance improvement

**Problem:**
Missing index on common query pattern `(user_id, call_date)`.

**Files to Change:**
- New migration: `supabase/migrations/YYYYMMDD_add_chat_composite_indexes.sql`

**Implementation:**
```sql
-- Composite index for date-based queries
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_user_date 
  ON transcript_chunks(user_id, call_date DESC);

-- Composite index for speaker queries
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_user_speaker 
  ON transcript_chunks(user_id, speaker_name);

-- Composite index for category queries
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_user_category 
  ON transcript_chunks(user_id, call_category);

-- Analyze tables after index creation
ANALYZE transcript_chunks;
```

---

## Medium-term Tasks (Next Quarter)

### 8. Modularize chat-stream-v2 Edge Function

**Priority:** 🟡 MEDIUM  
**Effort:** 3 days  
**Impact:** Improved maintainability, testability

**Problem:**
`chat-stream-v2/index.ts` is 1,410 lines with 14 tool definitions, multiple helpers, all in one file.

**Target Structure:**
```
supabase/functions/chat-stream-v2/
├── index.ts              # HTTP handler, auth (200 lines)
├── tools/
│   ├── index.ts          # Tool registry
│   ├── search-tools.ts   # Tools 1-9 (search pipeline)
│   ├── analytical-tools.ts # Tools 10-12
│   └── advanced-tools.ts   # Tools 13-14
├── lib/
│   ├── prompts.ts        # System prompt builder
│   ├── filters.ts        # Filter resolution
│   └── context.ts        # Business profile fetching
└── types.ts              # Shared types
```

**Benefits:**
- Easier to test individual tools
- Reduced merge conflicts
- Better separation of concerns
- Faster navigation and understanding

---

### 9. Move Model Pricing to Database

**Priority:** 🟢 LOW  
**Effort:** 2 days  
**Impact:** Easier pricing updates, no code deployments

**Problem:**
Model pricing hardcoded in `_shared/usage-tracker.ts` (30+ models). Price changes need code updates.

**Implementation:**
1. Create `model_pricing` table
2. Add sync job to fetch pricing from OpenRouter API daily
3. Update usage-tracker.ts to read from database
4. Add admin UI for manual pricing overrides

---

### 10. Add Message Virtualization

**Priority:** 🟡 MEDIUM  
**Effort:** 2 days  
**Impact:** Performance for long conversations

**Problem:**
Message list will degrade with large conversations (>50 messages).

**Files to Change:**
- `src/components/chat/ChatMessageList.tsx`

**Implementation:**
```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

function ChatMessageList({ messages }) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100, // Estimate message height
  });
  
  // Render only visible messages
}
```

---

### 11. Implement Error Boundaries

**Priority:** 🟡 MEDIUM  
**Effort:** 1 day  
**Impact:** Prevents full app crashes

**Problem:**
Chat crashes crash entire app. No graceful error handling.

**Files to Create:**
- `src/components/chat/ChatErrorBoundary.tsx`

**Files to Change:**
- `src/pages/Chat.tsx` (wrap in error boundary)

**Implementation:**
```typescript
import { ErrorBoundary } from 'react-error-boundary';

function ChatErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div className="p-4 text-center">
      <h2 className="text-lg font-semibold text-destructive">Chat Error</h2>
      <p className="text-sm text-muted-foreground">{error.message}</p>
      <Button onClick={resetErrorBoundary} className="mt-4">
        Try again
      </Button>
    </div>
  );
}

// In Chat.tsx
<ErrorBoundary FallbackComponent={ChatErrorFallback}>
  <ChatContainer>
    {/* chat components */}
  </ChatContainer>
</ErrorBoundary>
```

---

## Long-term Tasks (Future)

### 12. Multi-Provider Embedding Fallback

**Priority:** 🟡 MEDIUM  
**Effort:** 1 week  
**Impact:** Business continuity, reduced OpenAI dependency

**Problem:**
OpenAI is the ONLY embedding provider. If OpenAI API is down, search completely breaks.

**Implementation:**
Multi-provider strategy with fallback to local embedding model or alternative provider.

---

### 13. Streaming Cancellation Support

**Priority:** 🟢 LOW  
**Effort:** 2 days  
**Impact:** Better UX, reduced compute waste

**Problem:**
Once a stream starts, no way to gracefully cancel it. Wastes compute if user navigates away.

**Implementation:**
Add AbortController support and frontend "stop generation" button.

---

## Success Metrics

**Before Improvements:**
- Max concurrent users: ~150
- Average latency: 2-4 seconds
- p99 latency: 5-10 seconds
- Embedding API cost: $X/month

**Target After Improvements:**
- Max concurrent users: 1000+
- Average latency: 0.5-1.5 seconds
- p99 latency: 2-3 seconds
- Embedding API cost: 30-50% reduction

---

## Testing Strategy

For each improvement:
1. **Unit tests** for new functions (caching, re-ranking)
2. **E2E tests** for chat flows: `npx playwright test e2e/chat-*.spec.ts`
3. **Load testing** with k6 or Artillery
4. **Monitoring** latency and error rates in production

---

## Notes

- **DO NOT migrate to OpenAI Agents SDK** - current architecture is better for this use case
- **Redis caching is the highest ROI** - implement first
- **Database schema fixes are security-critical** - prioritize after caching
- **Frontend improvements can run in parallel** with backend work

---

**Status:** Pending  
**Next Review:** After completing immediate priority tasks
