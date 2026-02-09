# CallVault Chat Backend Architecture Analysis

**Analysis Date:** 2026-02-09  
**Scope:** Supabase Edge Functions - chat-stream-v2, search pipeline, provider architecture

---

## Executive Summary

CallVault's chat backend uses a **Vercel AI SDK**-based architecture with **14 specialized RAG tools** accessing a hybrid search pipeline over meeting transcript embeddings. The system supports multi-tenant vault scoping, business profile context injection, and provider-agnostic model selection through OpenRouter.

**Key Architecture Decision:** Uses Vercel AI SDK 6.x with `@openrouter/ai-sdk-provider` rather than direct OpenAI API or OpenAI Agents SDK.

---

## 1. Tool Architecture

### 1.1 The 14 Tools: Categorized

The chat backend exposes 14 specialized tools organized into four categories:

**Core Search Tools (1-4) - Hybrid Search Pipeline:**
| Tool | Purpose | Execution Pattern |
|------|---------|-------------------|
| `searchTranscriptsByQuery` | General semantic + keyword search | `search()` helper |
| `searchBySpeaker` | Filter by speaker name/email | `search()` + speaker filter |
| `searchByDateRange` | Temporal queries (required for time-based questions) | `search()` + date filters |
| `searchByCategory` | Category-based filtering (sales, demo, etc.) | `search()` + category filter |

**Metadata-Specific Search Tools (5-9) - Hybrid Search Pipeline:**
| Tool | Purpose | Metadata Field |
|------|---------|----------------|
| `searchByIntentSignal` | Find buying signals, objections, concerns | `intent_signals` array |
| `searchBySentiment` | Filter by emotional tone | `sentiment` enum |
| `searchByTopics` | Auto-extracted topic tags | `topics` array |
| `searchByUserTags` | User-assigned organizational tags | `user_tags` array |
| `searchByEntity` | Named entity mentions (companies, people) | JSONB `entities` field |

**Analytical Tools (10-12) - Direct Database Queries:**
| Tool | Purpose | Data Source |
|------|---------|-------------|
| `getCallDetails` | Full call metadata | `fathom_calls` table |
| `getCallsList` | Paginated call summaries | `fathom_calls` + filters |
| `getAvailableMetadata` | Discover available filters | `get_available_metadata` RPC |

**Advanced Tools (13-14) - Composite Operations:**
| Tool | Purpose | Implementation |
|------|---------|----------------|
| `advancedSearch` | Multi-dimensional combined filters | `search()` + merged filters |
| `compareCalls` | Side-by-side call comparison | Multiple RPC calls + aggregation |

### 1.2 Tool Definition Pattern (Good Pattern)

Tools are defined using Vercel AI SDK's `tool()` function with Zod schemas:

```typescript
// From chat-stream-v2/index.ts lines 66-75
searchTranscriptsByQuery: tool({
  description: 'General semantic and keyword search through meeting transcripts...',
  inputSchema: z.object({
    query: z.string().describe('The search query to find relevant transcript chunks'),
    limit: z.number().optional().describe('Maximum number of results (default: 10)'),
  }),
  execute: async ({ query, limit = 10 }) => {
    return search('searchTranscriptsByQuery', query, limit);
  },
}),
```

**Strengths of this pattern:**
- Runtime type validation via Zod
- Self-documenting via `.describe()` (used by LLM for tool selection)
- Consistent error handling via centralized `search()` helper
- Closure-based dependency injection (supabase, userId, API keys available via closure)

### 1.3 Tool Execution Wrapper (Good Pattern)

The `search()` helper provides consistent logging, timing, and error handling:

```typescript
// From chat-stream-v2/index.ts lines 34-57
async function search(toolName: string, query: string, limit: number, toolFilters: Partial<SearchFilters> = {}) {
  const filters = mergeFilters(sessionFilters, toolFilters, bankId, vaultId);
  const startTime = Date.now();
  try {
    const result = await executeHybridSearch({ query, limit, supabase, userId, openaiApiKey, hfApiKey, filters });
    const elapsed = Date.now() - startTime;
    console.log(`[chat-stream-v2] ${toolName} completed in ${elapsed}ms`);
    logToolResult(toolName, { query, limit, filters }, result);
    return result;
  } catch (error) {
    console.error(`[chat-stream-v2] ${toolName} FAILED:`, error);
    return { error: true, message: error instanceof Error ? error.message : 'Search failed' };
  }
}
```

### 1.4 Tool Scalability Assessment

**Current Pattern Scalability: GOOD**

Adding a new tool requires:
1. Define tool schema with Zod
2. Add execute function (can reuse `search()` helper for search tools)
3. Add to `createTools()` return object

**Bottleneck:** The 14 tools already approach practical limits for:
- LLM context window (tool definitions consume tokens)
- LLM tool selection accuracy (too many similar tools causes confusion)
- System prompt complexity (tool descriptions are ~150 lines)

**Recommendation:** For more than 20 tools, consider:
- Tool grouping (meta-tools that delegate)
- Dynamic tool selection based on query classification
- Vector-based tool retrieval (embed tool descriptions, retrieve relevant subset)

### 1.5 Type Safety Assessment

**Strengths:**
- Zod schemas provide runtime validation
- TypeScript interfaces for all tool inputs/outputs
- `SearchFilters` interface centralized in `search-pipeline.ts`

**Weaknesses (Anti-Patterns):**

```typescript
// Line 552: Uses 'any' type
const diverse = diversityFilter(filtered as any[], 2, limit);

// Lines 619-620: 'any' usage in RPC params
const rpcParams: Record<string, unknown> = { ... }

// Chat-stream-legacy has ~20 instances of implicit 'any'
```

---

## 2. Streaming Implementation

### 2.1 Architecture Overview

Uses Vercel AI SDK's `streamText()` with `toUIMessageStreamResponse()`:

```typescript
// From chat-stream-v2/index.ts lines 1325-1374
const result = streamText({
  model: openrouter(selectedModel),
  system: systemPrompt,
  messages: convertedMessages,
  tools: allTools,
  toolChoice: 'auto',
  maxSteps: 5,
  onError: ({ error }) => { /* log error */ },
  onFinish: async ({ text, usage }) => { /* log usage, cleanup */ },
});

return result.toUIMessageStreamResponse({ headers: corsHeaders });
```

### 2.2 SSE Protocol Implementation

**Protocol:** Proper Server-Sent Events (SSE)
- Content-Type: `text/event-stream`
- Format: `data: {...}\n\n`
- Uses AI SDK's built-in `toUIMessageStreamResponse()` which handles:
  - Message serialization
  - Tool call streaming
  - Error propagation
  - CORS headers

**Stream Events Generated:**
- `text` - Text deltas from LLM
- `tool-call-start` - Tool execution beginning
- `tool-call-name` - Tool name identified
- `tool-call-args-delta` - Streaming tool arguments (JSON)
- `tool-call-complete` - Tool execution finished
- `finish` - Stream completion

### 2.3 Streaming Performance Characteristics

**Measured Latencies (from logs):**
- Tool execution: 200-800ms (hybrid search)
- LLM time-to-first-token: 300-1200ms (depends on model)
- Full response time: 2-10 seconds (depends on query complexity)

**Buffering Analysis:**
- Vercel AI SDK handles backpressure automatically
- No manual buffering in edge function
- PostgreSQL streaming responses via `fetch()` (not true streaming, full result buffered)

**Potential Latency Issues:**

1. **Embedding Generation Blocks Stream Start**
   ```typescript
   // Line 93 in search-pipeline.ts - synchronous blocking
   const queryEmbedding = await generateQueryEmbedding(query, openaiApiKey);
   ```
   Every tool execution waits for OpenAI embedding API (~200-500ms)

2. **Re-ranking Adds Serial Latency**
   ```typescript
   // Line 341 - re-ranking happens after search, before response
   const reranked = await rerankResults(query, candidates, hfApiKey, limit * 2);
   ```
   HuggingFace cross-encoder: 1500ms timeout, ~300-800ms typical

3. **No Parallel Tool Execution**
   When LLM calls multiple tools in parallel, they execute sequentially in Vercel AI SDK's tool loop

### 2.4 Error Handling During Streaming

**Three-Layer Error Handling:**

1. **Stream Creation Errors** (catch block at line 1375-1393)
   ```typescript
   } catch (streamError) {
     await flushLangfuse();
     return new Response(JSON.stringify({ error: ... }), { status: 500 });
   }
   ```

2. **Streaming Errors** (onError callback at line 1332-1335)
   ```typescript
   onError: ({ error }) => {
     console.error('[chat-stream-v2] Stream onError callback:', error);
   },
   ```
   Note: Errors after stream starts are logged but don't halt stream

3. **Tool Execution Errors** (wrapped in try-catch per tool)
   Returns `{ error: true, message: ... }` to LLM, allowing graceful degradation

**Gap Identified:** No mechanism to gracefully terminate a stream mid-generation if a critical error occurs after stream starts.

---

## 3. Provider Architecture

### 3.1 OpenRouter Integration

**Configuration Pattern (Good):**

```typescript
// Lines 83-91
function createOpenRouterProvider(apiKey: string) {
  return createOpenRouter({
    apiKey,
    headers: {
      'HTTP-Referer': 'https://app.callvaultai.com',
      'X-Title': 'CallVault',
    },
  });
}
```

**Model Selection Flow:**
1. Frontend fetches available models from `get-available-models` edge function
2. User selects model (or uses default)
3. Model ID passed to `chat-stream-v2` in request body
4. `openrouter(selectedModel)` creates provider instance

### 3.2 Model Validation & Tiering

**Database-Driven Model Access:**

```typescript
// From get-available-models/index.ts lines 59-88
const { data: models } = await supabaseClient
  .from('ai_models')
  .select('*')
  .eq('is_enabled', true)
  .order('is_featured', { ascending: false });

// Filter by user role tier
const accessibleModels = models.filter((m) => {
  const modelTier = m.min_tier || 'FREE';
  const modelLevel = ROLE_LEVELS[modelTier] || 0;
  return currentLevel >= modelLevel;
});
```

**Fallback Mechanism (Good Pattern):**

```typescript
// Lines 93-110 - Safety net for locked-out users
if (accessibleModels.length === 0) {
  console.warn(`User ${userRole} has 0 accessible models. Activating Emergency Fallback.`);
  const defaultModel = models?.find((m) => m.is_default);
  if (defaultModel) {
    accessibleModels = [defaultModel];
  } else {
    // Absolute worst case - hardcoded fallback
    accessibleModels = [{ id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini (Fallback)', ... }];
  }
}
```

### 3.3 Provider Flexibility Assessment

**Current Architecture: MODERATELY FLEXIBLE**

**Strengths:**
- OpenRouter provides access to 300+ models from 20+ providers
- Single code path for all providers (OpenAI, Anthropic, Google, etc.)
- Database-driven model configuration (no code changes for new models)

**Limitations:**
- Embeddings are OpenAI-only (separate API key required)
- Provider-specific features (thinking tokens, citations) not exposed
- Model-specific prompting optimizations not implemented

**Provider Switching Cost:** ZERO for chat models (via OpenRouter), HIGH for embeddings (requires code changes)

### 3.4 Pricing Integration

**Usage Tracking Pattern:**

```typescript
// From _shared/usage-tracker.ts lines 14-54
const PRICING: Record<string, { input: number; output: number }> = {
  'openai/gpt-4o-mini': { input: 0.15, output: 0.60 },
  'anthropic/claude-3-opus': { input: 15.00, output: 75.00 },
  // ... 30+ models
};
```

**Gaps:**
- Pricing is hardcoded, not fetched from database
- New models require code deployment to track costs
- No real-time cost limit enforcement (only tracking)

---

## 4. RAG Pipeline Integration

### 4.1 Hybrid Search Architecture

**Pipeline Steps (in order):**

1. **Embedding Generation** (OpenAI text-embedding-3-small)
   ```typescript
   // From _shared/embeddings.ts
   const response = await fetch(OPENAI_EMBEDDINGS_URL, {
     body: JSON.stringify({ model: EMBEDDING_MODEL, input: query }),
   });
   ```

2. **Hybrid Search RPC** (PostgreSQL function)
   ```typescript
   // From _shared/search-pipeline.ts lines 301-327
   const { data: candidates, error } = await supabase.rpc(
     useScopedSearch ? 'hybrid_search_transcripts_scoped' : 'hybrid_search_transcripts',
     rpcParams
   );
   ```

3. **Cross-Encoder Re-ranking** (HuggingFace inference API)
   ```typescript
   // Lines 340-341
   const reranked = await rerankResults(query, candidates, hfApiKey, limit * 2);
   ```

4. **Diversity Filtering** (max 2 chunks per recording)
   ```typescript
   // Line 344
   const diverse = diversityFilter(reranked, 2, limit);
   ```

5. **Share URL Lookup** (separate query)
   ```typescript
   // Lines 349-364
   const { data: calls } = await supabase
     .from('fathom_calls')
     .select('recording_id, share_url')
     .in('recording_id', uniqueRecordingIds);
   ```

### 4.2 Search Performance Characteristics

**Measured Performance (from logs):**
| Operation | Typical Time | Notes |
|-----------|-------------|-------|
| Embedding generation | 200-500ms | OpenAI API call |
| Hybrid search RPC | 50-200ms | PostgreSQL vector search |
| Re-ranking | 300-800ms | HuggingFace API (batched) |
| Diversity filter | <1ms | In-memory operation |
| Share URL lookup | 20-50ms | Indexed query |
| **Total pipeline** | **600-1500ms** | End-to-end |

**Scalability Concerns:**

1. **Re-ranking is Serial and Slow**
   - 1500ms timeout per batch
   - Sequential batch processing (not parallel)
   - 30 candidates × 1500ms max = 45 seconds worst case

2. **No Result Caching**
   - Identical queries re-execute full pipeline
   - Embeddings regenerated each time

3. **Cross-encoder Quality vs Speed Tradeoff**
   - Using `ms-marco-MiniLM-L-12-v2` (small, fast)
   - Larger models would improve quality but increase latency

### 4.3 Search Result Format

**Response Format (returned to LLM):**

```typescript
{
  results: [
    {
      index: 1,
      recording_id: 847291,
      call_title: "Sales Call with John",
      call_date: "2026-01-15T10:30:00Z",
      speaker: "Jane Smith",
      category: "sales",
      topics: ["pricing", "objections"],
      sentiment: "positive",
      text: "I'm really interested in the premium plan...",
      relevance: "87%",
      share_url: "https://share.callvaultai.com/c/abc123",
      vault_id: "vault-uuid",
      vault_name: "Q1 Sales"
    },
    // ... more results
  ],
  total_found: 45,
  reranked: 20,
  returned: 10
}
```

### 4.4 Multi-Tenant Scoping (Bank/Vault)

**Scoped Search Function:**

```sql
-- From migrations/20260209081900_fix_hybrid_search_transcripts.sql
LEFT JOIN recordings r ON r.legacy_recording_id = fc.recording_id
WHERE 
  -- ... other filters ...
  AND (filter_bank_id IS NULL OR r.bank_id = filter_bank_id)
```

**Application-Level Scoping:**

```typescript
// Lines 288-325 in search-pipeline.ts
const useScopedSearch = !!(filters.bank_id || filters.vault_id);
const rpcFunction = useScopedSearch ? 'hybrid_search_transcripts_scoped' : 'hybrid_search_transcripts';
```

**Security Note:** Scoping is enforced at both SQL level (via JOIN) and application level (via vault membership verification in tools 10-14).

---

## 5. System Architecture Patterns

### 5.1 Request Lifecycle

```
Client Request
    ↓
CORS Preflight (if OPTIONS)
    ↓
JWT Authentication (Supabase)
    ↓
Parse Request Body
    ↓
Resolve Session Filters (from DB or request)
    ↓
Resolve Folder IDs → Recording IDs
    ↓
Fetch Business Profile (optional)
    ↓
streamText() with tools
    ↓
Tool Execution Loop
    ↓
onFinish() - Log usage, flush Langfuse
    ↓
SSE Response to Client
```

### 5.2 Error Handling Strategy

**Three-Tier Error Handling:**

| Tier | Scope | Behavior |
|------|-------|----------|
| Handler Level | Request parsing, auth, init | Returns HTTP 4xx/5xx |
| Stream Level | LLM streaming errors | Logs, continues stream |
| Tool Level | Individual tool failures | Returns error object to LLM |

### 5.3 Observability Integration

**Langfuse Tracing:**

```typescript
// Lines 1300-1368
const langfuseTrace: ChatTraceResult | null = startChatTrace({
  userId: user.id,
  sessionId: sessionId || undefined,
  model: selectedModel,
  systemPrompt,
  messages: messagesForTrace,
  metadata: { /* bank/vault context */ },
});

// Async flush (non-blocking)
langfuseTrace.endTrace().catch(err => {
  console.error('[chat-stream-v2] Failed to flush Langfuse:', err);
});
```

**Usage Tracking:**

```typescript
// Fire-and-forget usage logging
logUsage(supabase, {
  userId: user.id,
  operationType: 'chat',
  model: selectedModel,
  inputTokens,
  outputTokens,
  latencyMs,
}).catch(err => { /* log but don't throw */ });
```

---

## 6. Architecture Strengths

1. **Clean Separation of Concerns**
   - `chat-stream-v2/` - HTTP handling, auth, orchestration
   - `_shared/search-pipeline.ts` - Search logic
   - `_shared/embeddings.ts` - Embedding generation
   - `_shared/usage-tracker.ts` - Cost tracking

2. **Type-Safe Tool Definitions**
   - Zod schemas for all tool inputs
   - TypeScript interfaces throughout

3. **Multi-Tenant Security**
   - Bank/vault scoping at SQL level
   - User ownership verification on all queries

4. **Graceful Degradation**
   - Tool failures return error objects, not exceptions
   - Fallback mechanisms for models, pricing, rate limits

5. **Provider Flexibility**
   - OpenRouter enables 300+ models without code changes
   - Database-driven model configuration

---

## 7. Architecture Weaknesses

1. **Monolithic Edge Function**
   - 1410 lines in single file
   - All 14 tools defined inline
   - Hard to test individual tools

2. **Synchronous, Blocking Pipeline**
   - No parallel tool execution
   - Re-ranking blocks response
   - Embedding generation per tool call

3. **No Result Caching**
   - Repeated queries re-execute full pipeline
   - Embeddings regenerated every time

4. **Limited Streaming Control**
   - Cannot gracefully terminate stream mid-generation
   - No way to cancel in-flight tool executions

5. **Hardcoded Pricing**
   - New models require code deployment
   - Pricing changes need code updates

6. **Type Safety Gaps**
   - Multiple `any` type usages
   - `Record<string, unknown>` for RPC params

---

## 8. File Reference Map

**Core Files:**
- `supabase/functions/chat-stream-v2/index.ts` - Main chat handler (1410 lines)
- `supabase/functions/_shared/search-pipeline.ts` - Hybrid search pipeline (390 lines)
- `supabase/functions/_shared/embeddings.ts` - OpenAI embedding client (58 lines)
- `supabase/functions/_shared/usage-tracker.ts` - Cost tracking (208 lines)
- `supabase/functions/_shared/langfuse.ts` - Observability (246 lines)
- `supabase/functions/get-available-models/index.ts` - Model configuration (154 lines)

**Legacy:**
- `supabase/functions/chat-stream-legacy/index.ts` - Previous implementation (1974 lines)

**Database:**
- `supabase/migrations/20260209081900_fix_hybrid_search_transcripts.sql` - Search function
- `supabase/config.toml` - Edge function configuration

---

*Architecture analysis: 2026-02-09*
