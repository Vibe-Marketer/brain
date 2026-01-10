# Performance Metrics Verification Guide

## QA Criteria

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Time to First Token | < 2 seconds | Browser DevTools Network tab |
| RAG Search Completion | < 5 seconds | Browser DevTools Network tab (tool-output-available event) |
| Page Load | < 3 seconds | Browser DevTools Performance tab or Lighthouse |

## Architecture Performance Analysis

### Streaming Response Path
```
User Query → chat-stream edge function → OpenRouter API (streaming) → SSE events → UI
```

**Performance characteristics:**
1. **Initial connection**: ~100-200ms (TLS handshake, CORS preflight)
2. **Authentication**: ~50-100ms (JWT validation via Supabase)
3. **Model invocation**: ~500-1500ms (OpenRouter API, model-dependent)
4. **First token**: Should appear within **1-2 seconds** of query submission

### RAG Search Path
```
Query → Embedding generation (OpenAI) → Hybrid search (pgvector + FTS) → Re-ranking (HuggingFace) → Results
```

**Performance characteristics:**
1. **Embedding generation**: ~100-300ms (text-embedding-3-small via OpenAI)
2. **Hybrid search (pgvector + FTS)**: ~100-500ms (depends on data size, HNSW index: m=16, ef_construction=64)
3. **Re-ranking (optional)**: ~1000-3000ms (HuggingFace inference, batched, timeout 1.5s per request)
4. **Total RAG pipeline**: Should complete within **2-5 seconds**

### Page Load Path
```
Browser → Vite dev server → React app → Auth check → Chat page render
```

**Performance characteristics:**
1. **Bundle size**: Vite code-splitting + lazy loading for components
2. **Auth initialization**: ~200-500ms (Supabase session check)
3. **Initial data fetch**: ~100-300ms (sessions list, models list)
4. **Target**: First contentful paint < **3 seconds**

---

## Manual Verification Steps

### 1. Time to First Token (< 2 seconds)

**Steps:**
1. Open Chrome DevTools → Network tab
2. Filter by "chat-stream" or "EventStream"
3. Navigate to http://localhost:3000/chat (or production URL)
4. Type a simple query: "Hello, what can you help me with?"
5. Click Send

**What to measure:**
- Look for the first `data:` event in the EventStream response
- Note the timestamp from when the send button was clicked
- First `text-delta` event should appear within 2 seconds

**Expected Events Flow:**
```
0ms     - Request sent
~200ms  - Connection established
~500ms  - data: {"type":"start","messageId":"..."}
~800ms  - data: {"type":"start-step"}
<2000ms - data: {"type":"text-delta","id":"...","delta":"..."}  ← FIRST TOKEN
```

### 2. RAG Search Completion (< 5 seconds)

**Steps:**
1. Open Chrome DevTools → Network tab
2. Navigate to http://localhost:3000/chat
3. Type a query that triggers RAG: "What topics were discussed in recent calls?"
4. Click Send

**What to measure:**
- Look for `tool-input-start` event (tool call begins)
- Look for `tool-output-available` event (search complete)
- Time between these events should be < 5 seconds

**Expected Events Flow:**
```
0ms     - Query sent
~1000ms - data: {"type":"tool-input-start","toolCallId":"...","toolName":"searchByDateRange"}
~1500ms - data: {"type":"tool-input-available",...}  ← Tool arguments ready
<5000ms - data: {"type":"tool-output-available","toolCallId":"...","output":{...}}  ← SEARCH COMPLETE
```

**Note on Re-ranking:**
- Re-ranking is optional (requires HUGGINGFACE_API_KEY)
- With re-ranking: ~3-5 seconds
- Without re-ranking: ~1-2 seconds

### 3. Page Load Time (< 3 seconds)

**Method 1: DevTools Performance Tab**
1. Open Chrome DevTools → Performance tab
2. Click "Record" button
3. Navigate to http://localhost:3000/chat
4. Stop recording when page is interactive
5. Look for "First Contentful Paint" and "Largest Contentful Paint"

**Method 2: Lighthouse**
1. Open Chrome DevTools → Lighthouse tab
2. Select "Performance" category
3. Click "Analyze page load"
4. Review metrics:
   - First Contentful Paint (FCP) < 1.8s = Good
   - Largest Contentful Paint (LCP) < 2.5s = Good
   - Time to Interactive (TTI) < 3.0s = Good

**What to verify:**
- Chat page renders without errors
- Input field is visible and focusable
- Model selector dropdown shows available models
- No console errors during load

---

## Performance Optimizations in Place

### Database Layer
```sql
-- HNSW index for vector search (optimal for RAG)
CREATE INDEX idx_transcript_chunks_embedding
  ON transcript_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- GIN index for full-text search
CREATE INDEX idx_transcript_chunks_fts
  ON transcript_chunks USING gin(fts);

-- GIN indexes for array filters
CREATE INDEX idx_transcript_chunks_topics ON transcript_chunks USING gin(topics);
CREATE INDEX idx_transcript_chunks_intent_signals ON transcript_chunks USING gin(intent_signals);
```

### Edge Function Layer
```typescript
// Optimizations in chat-stream/index.ts:

// 1. Batch re-ranking with timeout (line 152-153)
const batchSize = 10;
const maxCandidates = 30; // Hard cap

// 2. Per-request timeout for re-ranking (line 153)
setTimeout(() => controller.abort(), 1500); // 1.5s timeout

// 3. Diversity filtering to reduce results (line 209-228)
function diversityFilter<T>(chunks: T[], maxPerRecording: number = 5, targetCount: number = 20)

// 4. Result capping for responsiveness (lines 136-137)
const baseCount = hasSpecificRecordingFilters ? 60 : 40;
const candidateCount = Math.min(limit * 3, baseCount);
```

### Frontend Layer
```typescript
// Optimizations in Chat.tsx:

// 1. Debounced message persistence (500ms)
// 2. Optimistic UI updates via useChat hook
// 3. Lazy loading of chat skeleton component
// 4. Streaming responses render progressively
```

---

## Troubleshooting Slow Performance

### If Time to First Token > 2 seconds:
1. Check OpenRouter API status: https://status.openrouter.ai
2. Verify model selection (some models are slower)
3. Check network latency to OpenRouter
4. Review edge function cold start (first request may be slower)

### If RAG Search > 5 seconds:
1. Check if re-ranking is enabled (HUGGINGFACE_API_KEY set)
2. Disable re-ranking for faster results (edit chat-stream/index.ts line 125-128)
3. Verify HNSW index exists: `SELECT indexname FROM pg_indexes WHERE tablename = 'transcript_chunks'`
4. Check dataset size (very large datasets may need index tuning)

### If Page Load > 3 seconds:
1. Check for console errors blocking render
2. Verify Supabase auth session is valid
3. Check network connectivity to Supabase
4. Review bundle size with `npm run build -- --analyze`

---

## Automated Performance Testing Script

Run from project root:
```bash
# Test streaming latency
./scripts/test-performance.sh

# Or use curl directly:
time curl -X POST "https://your-supabase-url/functions/v1/chat-stream" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"id":"test","role":"user","parts":[{"type":"text","text":"Hello"}]}],"model":"openai/gpt-4o-mini"}'
```

---

## Sign-off Checklist

- [ ] Time to first token < 2 seconds (verified with DevTools)
- [ ] RAG search completion < 5 seconds (verified with DevTools)
- [ ] Page load < 3 seconds (verified with Lighthouse)
- [ ] No performance regressions from baseline
- [ ] Console free of performance warnings
- [ ] Streaming renders progressively (no blocking)
