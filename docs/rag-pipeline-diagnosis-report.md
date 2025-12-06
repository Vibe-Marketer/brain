# RAG Pipeline Diagnostic Report

**Date:** 2025-11-26
**Status:** Root Cause Analysis Complete
**Branch:** claude/debug-rag-pipeline-01AgzY7zSusJTkLDXRGSZyZj

---

## Executive Summary

A comprehensive end-to-end diagnosis of the Agentic RAG System has been completed. **Three critical root causes** have been identified that prevent correct information flow to the final chat/generation stage:

1. **AI SDK Version Mismatch** - Edge Function uses outdated SDK version
2. **Streaming Protocol Issue** - Tool call parts not transmitted to client
3. **Re-ranking Not Integrated** - Cross-encoder re-ranking exists but is unused

---

## System Architecture Overview

```text
User Query
    ↓
[Chat.tsx] useChat hook (@ai-sdk/react)
    ↓
POST /functions/v1/chat-stream
    ↓
[chat-stream/index.ts] streamText() with tools
    ├─ searchTranscripts → hybrid_search_transcripts() RPC
    ├─ getCallDetails → fathom_calls query
    └─ summarizeCalls → fathom_calls with date filters
    ↓
streamText() → toAIStreamResponse()
    ↓
[Chat.tsx] message.parts extraction for citations
    ↓
[source.tsx] Citation pill rendering
```

---

## Root Cause Analysis

### ROOT CAUSE 1: AI SDK Version Mismatch (CRITICAL)

**Location:** `supabase/functions/chat-stream/index.ts` (lines 1-4)

**Problem:**

```typescript
// Edge Function imports (OUTDATED)
import { createOpenAI } from 'https://esm.sh/@ai-sdk/openai@1.0.0';  // ❌ v1.0.0
import { streamText, tool } from 'https://esm.sh/ai@3.4.33';

// Frontend package.json
"@ai-sdk/openai": "^2.0.72",  // ✅ v2.0.72
"ai": "^3.4.33",
```

**Impact:**

- Protocol incompatibility between Edge Function and Frontend
- Tool call parts may not be serialized correctly in the stream
- The `toAIStreamResponse()` method behavior differs between versions

**Evidence:**

- Debug logging added in recent commit: `console.log('onFinish message.parts:', message.parts);`
- Citation pills not appearing despite tool calls executing
- `message.parts` is undefined during render (Chat.tsx:808)

---

### ROOT CAUSE 2: Streaming Protocol Issue (CRITICAL)

**Location:** `supabase/functions/chat-stream/index.ts` (line 330)

**Problem:**

```typescript
// Current implementation
return result.toAIStreamResponse({
  headers: corsHeaders,
});
```

**Issue:**

The `toAIStreamResponse()` method in AI SDK v3.x uses the "AI Stream" protocol which may not properly stream tool call parts back to the client. The newer `toDataStreamResponse()` method uses the "Data Stream" protocol which properly includes:

- Tool call initiations
- Tool call results
- Message parts with structured data

**Evidence from Chat.tsx:**

```typescript
// Lines 810-812 - Parts extraction expects tool-call and tool-result parts
const toolParts = (message.parts as ToolCallPart[] | undefined)
  ?.filter((p) => p.type === 'tool-call' || p.type === 'tool-result') || [];
```

When `message.parts` is undefined, no sources are extracted.

---

### ROOT CAUSE 3: Re-ranking Not Integrated (MODERATE)

**Location:**

- Exists: `supabase/functions/rerank-results/index.ts`
- Not used in: `supabase/functions/chat-stream/index.ts`

**Problem:**

The `rerank-results` Edge Function implements cross-encoder re-ranking using HuggingFace's `cross-encoder/ms-marco-MiniLM-L-12-v2` model, but it is **never called** from the chat-stream function.

**Current Flow:**

```text
User Query → hybrid_search_transcripts() → Raw RRF results → LLM
```

**Intended Flow:**

```text
User Query → hybrid_search_transcripts() → rerank-results() → diversity_filter() → LLM
```

**Impact:**

- Search results may not be optimally ranked for the query
- More relevant results may be buried below less relevant ones
- The query "What are the two pillars on the roadmap..." may return generic results instead of specific matches

---

## Additional Findings

### Finding 4: Diversity Filter Not Used

**Location:** `supabase/functions/_shared/diversity-filter.ts`

The diversity filter exists to:

- Limit chunks per recording (default: 2)
- Ensure semantic diversity (min distance: 0.3)
- Target diverse result count (default: 5)

But it's not being called from chat-stream.

---

### Finding 5: Message Parts Persistence

**Location:** `src/hooks/useChatSession.ts` (lines 187-196)

```typescript
const sanitizeParts = (parts: unknown): unknown => {
  if (!parts) return null;  // ← Returns null when parts undefined
  try {
    return JSON.parse(JSON.stringify(parts));
  } catch {
    return null;
  }
};
```

If parts are undefined at save time (which happens with the streaming protocol issue), null is persisted to the database, losing citation data.

---

### Finding 6: Token Limit Risk

**Observation:** The `searchTranscripts` tool returns up to 10 results by default, each containing full `chunk_text`. With ~400 tokens per chunk, this could add 4,000+ tokens to context.

**Current Mitigation:** None - full chunk text passed to LLM.

**Risk:** Context truncation could lose relevant information.

---

## Recommendations

### Immediate Fixes (High Priority)

#### 1. Update AI SDK Version in Edge Function

```typescript
// supabase/functions/chat-stream/index.ts

// Before:
import { createOpenAI } from 'https://esm.sh/@ai-sdk/openai@1.0.0';

// After:
import { createOpenAI } from 'https://esm.sh/@ai-sdk/openai@2.0.72';
```

#### 2. Switch to Data Stream Protocol

```typescript
// supabase/functions/chat-stream/index.ts

// Before:
return result.toAIStreamResponse({
  headers: corsHeaders,
});

// After:
return result.toDataStreamResponse({
  headers: corsHeaders,
});
```

**Note:** This may require frontend changes to use `useChat` with `streamProtocol: 'data'`.

#### 3. Integrate Re-ranking into Search Pipeline

```typescript
// In searchTranscripts tool execute function:

// 1. Get more candidates from hybrid search
const { data: candidates } = await supabase.rpc('hybrid_search_transcripts', {
  match_count: 30,  // Get more candidates
  // ... other params
});

// 2. Re-rank candidates
const reranked = await rerankResults(query, candidates, 10);

// 3. Apply diversity filter
const diverse = simpleDiversityFilter(reranked, 2, 5);

return { results: diverse };
```

### Medium Priority Fixes

#### 4. Add Explicit Parts Handling in Frontend

```typescript
// Chat.tsx - Handle parts during streaming
const { messages } = useChat({
  // ... existing config
  experimental_telemetry: {
    isEnabled: true,
  },
  // Explicitly handle tool results
  onToolCall: async ({ toolCall }) => {
    console.log('Tool call:', toolCall);
  },
});
```

#### 5. Implement Context Length Management

```typescript
// Truncate chunk text to save tokens
const formatResults = (results) => results.map(r => ({
  ...r,
  text: r.chunk_text.substring(0, 500) + '...',  // Truncate to ~100 tokens
}));
```

### Low Priority Improvements

#### 6. Add Observability Logging

Add structured logging throughout the RAG pipeline:

- Query embedding generation time
- Hybrid search execution time
- Number of results at each stage
- Re-ranking score distribution
- Final context token count

---

## Testing Verification

### Test Script Created

A comprehensive diagnostic script has been created at:

```text
scripts/diagnose-rag-pipeline.ts
```

Run with:

```bash
npm install
npx tsx scripts/diagnose-rag-pipeline.ts [user_id]
```

### Manual Verification Steps

1. **Check browser console** for `message.parts` logs
2. **Check network tab** for stream response format
3. **Query database** for saved message parts:

   ```sql
   SELECT id, role, parts
   FROM chat_messages
   WHERE session_id = 'your-session-id'
   AND role = 'assistant';
   ```

---

## Files Modified/Created

| File | Change |
|------|--------|
| `scripts/diagnose-rag-pipeline.ts` | Created diagnostic script |
| `docs/rag-pipeline-diagnosis-report.md` | This report |

---

## Next Steps

1. [ ] **Fix Root Cause 1:** Update `@ai-sdk/openai` import in chat-stream
2. [ ] **Fix Root Cause 2:** Switch to `toDataStreamResponse()`
3. [ ] **Test streaming:** Verify `message.parts` populated in frontend
4. [ ] **Integrate re-ranking:** Add rerank-results call in searchTranscripts
5. [ ] **Add diversity filter:** Apply diversity filter before returning results
6. [ ] **Run diagnostic script:** Verify fixes with test suite

---

## References

- [AI SDK v3.x Documentation](https://sdk.vercel.ai/docs)
- [Data Stream Protocol](https://sdk.vercel.ai/docs/ai-sdk-ui/stream-protocol#data-stream-protocol)
- ADR-004: `docs/adr/adr-004-pgvector-hybrid-search.md`
