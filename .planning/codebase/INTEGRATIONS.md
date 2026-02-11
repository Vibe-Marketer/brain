# CallVault External Integrations

**Analysis Date:** 2026-02-09  
**Scope:** AI/LLM providers, search infrastructure, observability, rate limiting

---

## Integration Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        CallVault Chat Backend                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │   OpenAI     │    │  OpenRouter  │    │ HuggingFace  │              │
│  │  Embeddings  │    │  LLM Models  │    │  Re-ranking  │              │
│  │  text-3-sm   │    │  300+ models │    │  cross-enc   │              │
│  └──────────────┘    └──────────────┘    └──────────────┘              │
│         │                   │                   │                      │
│         ▼                   ▼                   ▼                      │
│  ┌────────────────────────────────────────────────────────────┐       │
│  │              Supabase Edge Functions (Deno)                 │       │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │       │
│  │  │chat-stream-v2│  │search-pipeline│  │  Langfuse    │      │       │
│  │  └──────────────┘  └──────────────┘  └──────────────┘      │       │
│  └────────────────────────────────────────────────────────────┘       │
│                              │                                         │
│                              ▼                                         │
│  ┌────────────────────────────────────────────────────────────┐       │
│  │              Supabase PostgreSQL (pgvector)                 │       │
│  │     transcript_chunks │ recordings │ vault_entries         │       │
│  └────────────────────────────────────────────────────────────┘       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 1. OpenAI - Embeddings Provider

### 1.1 Configuration

**Environment Variables:**
```bash
OPENAI_API_KEY=sk-...        # Required for embeddings
```

**Usage Location:**
- `supabase/functions/_shared/embeddings.ts` - All embedding generation
- Called by: `search-pipeline.ts`, `searchByEntity` tool

### 1.2 Implementation

```typescript
// From _shared/embeddings.ts
const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings';
const EMBEDDING_MODEL = 'text-embedding-3-small';  // 1536 dimensions

export async function generateQueryEmbedding(query: string, openaiApiKey: string): Promise<number[]> {
  const response = await fetch(OPENAI_EMBEDDINGS_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: query }),
  });
  // ... error handling
  return data.data[0].embedding;
}
```

### 1.3 Cost & Limits

| Metric | Value |
|--------|-------|
| Model | text-embedding-3-small |
| Dimensions | 1536 |
| Cost | $0.02 per 1M tokens |
| Rate Limit | 3,000 RPM (Tier 1) |
| Typical Request | ~50-100 tokens per query |
| Cost per Chat | ~$0.000002 (negligible) |

### 1.4 Dependency Risk Assessment

**Risk Level: MEDIUM**

**Concerns:**
- OpenAI is the ONLY embedding provider (no fallback)
- Switching providers requires regenerating all embeddings
- No redundancy if OpenAI API is down

**Mitigation Options:**
- Cache embeddings at query level (not implemented)
- Implement local embedding model fallback (requires ~500MB model)
- Multi-provider strategy with vector alignment (expensive)

---

## 2. OpenRouter - LLM Gateway

### 2.1 Configuration

**Environment Variables:**
```bash
OPENROUTER_API_KEY=sk-or-...  # Required for chat
```

**Provider Setup:**
```typescript
// From chat-stream-v2/index.ts lines 83-91
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

### 2.2 Model Access

**Supported Providers (via OpenRouter):**
- OpenAI (GPT-4o, GPT-4o-mini, etc.)
- Anthropic (Claude 3 Opus, Sonnet, Haiku)
- Google (Gemini Pro, Flash)
- Meta (Llama 3.x)
- Mistral, DeepSeek, and 20+ more

**Model Configuration (Database-Driven):**
```typescript
// From get-available-models/index.ts
interface AIModelDB {
  id: string;                    // e.g., "anthropic/claude-3-opus"
  name: string;                  // Display name
  provider: string;              // Provider slug
  context_length: number;        // Max context
  pricing: { prompt: string; completion: string };
  min_tier: string;              // FREE, PRO, TEAM, ADMIN
  is_featured: boolean;
  is_default: boolean;
}
```

### 2.3 Cost Structure

**Pricing Tiers (per 1M tokens):**

| Model | Input | Output | Notes |
|-------|-------|--------|-------|
| gpt-4o-mini | $0.15 | $0.60 | Default model |
| gpt-4o | $2.50 | $10.00 | High quality |
| claude-3-haiku | $0.25 | $1.25 | Fast, cheap |
| claude-3-sonnet | $3.00 | $15.00 | Balanced |
| claude-3-opus | $15.00 | $75.00 | High capability |

**Cost Tracking:**
- Tracked in `embedding_usage_logs` table
- Updated via `_shared/usage-tracker.ts`
- Hardcoded pricing in `PRICING` record

### 2.4 Rate Limiting

**OpenRouter Limits:**
- Varies by model and account tier
- Typically 10-100 RPM for free accounts
- Higher limits with paid OpenRouter accounts

**Application-Level Rate Limiting:**
```typescript
// From _shared/rate-limiter.ts
const result = await checkRateLimit(supabase, userId, { resourceType: 'chat' });
if (!result.allowed) {
  return createRateLimitResponse(result, requestId, corsHeaders);
}
```

### 2.5 Dependency Risk Assessment

**Risk Level: LOW**

**Strengths:**
- 300+ models provide redundancy
- Automatic failover between providers
- Single API key for all providers

**Concerns:**
- Third-party gateway adds latency (~50-100ms)
- Provider-specific features not exposed
- Pricing markup (OpenRouter adds ~10-20%)

---

## 3. HuggingFace - Re-ranking Service

### 3.1 Configuration

**Environment Variables:**
```bash
HUGGINGFACE_API_KEY=hf_...    # Optional but recommended
```

**Model Used:**
```typescript
// From _shared/search-pipeline.ts
const HUGGINGFACE_API_URL = 'https://api-inference.huggingface.co/models';
const RERANK_MODEL = 'cross-encoder/ms-marco-MiniLM-L-12-v2';
```

### 3.2 Implementation

**Batch Processing with Timeout:**
```typescript
// Lines 116-194
export async function rerankResults(query: string, candidates: SearchResult[], hfApiKey: string, topK: number = 10): Promise<SearchResult[]> {
  const RERANK_BATCH_SIZE = 10;
  const RERANK_REQUEST_TIMEOUT_MS = 1500;
  const RERANK_MAX_CANDIDATES = 30;

  // Process in batches with per-request timeout
  for (let i = 0; i < candidatesToRerank.length; i += RERANK_BATCH_SIZE) {
    const batch = candidatesToRerank.slice(i, i + RERANK_BATCH_SIZE);
    
    const batchResults = await Promise.all(
      batch.map(async (candidate) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), RERANK_REQUEST_TIMEOUT_MS);
        
        const response = await fetch(`${HUGGINGFACE_API_URL}/${RERANK_MODEL}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${hfApiKey}` },
          body: JSON.stringify({
            inputs: `${query} [SEP] ${candidate.chunk_text.substring(0, 500)}`,
            options: { wait_for_model: true, use_cache: true },
          }),
          signal: controller.signal,
        });
        // ...
      })
    );
  }
}
```

### 3.3 Performance Characteristics

| Metric | Value |
|--------|-------|
| Model Size | ~50MB |
| Batch Size | 10 candidates |
| Timeout | 1500ms per request |
| Max Candidates | 30 (hard cap) |
| Typical Latency | 300-800ms for 30 candidates |
| Fallback | RRF score if HF fails |

### 3.4 Dependency Risk Assessment

**Risk Level: LOW**

**Resilience Features:**
- Falls back to RRF scores if HF API fails
- Per-request timeouts prevent hanging
- Optional (works without API key using RRF only)

**Concerns:**
- Cold start latency on HF free tier (mitigated by `wait_for_model`)
- Rate limits on free tier (mitigated by batching)

---

## 4. Langfuse - Observability

### 4.1 Configuration

**Environment Variables:**
```bash
LANGFUSE_PUBLIC_KEY=pk-...
LANGFUSE_SECRET_KEY=sk-...
LANGFUSE_URL=https://langfuse.pushthefknbutton.com  # Default
```

**Usage:**
```typescript
// From _shared/langfuse.ts
const langfuseClient = new Langfuse({
  publicKey,
  secretKey,
  baseUrl,
  flushAt: 1,        // Flush immediately
  flushInterval: 100,
});
```

### 4.2 Tracing Coverage

**Traced Operations:**
1. **Chat Requests** - Full prompt, response, tool usage
2. **Tool Calls** - Input/output, duration, errors
3. **Usage Metrics** - Token counts, costs
4. **Metadata** - Bank/vault context, filters, business profile

**Trace Structure:**
```typescript
// From chat-stream-v2/index.ts
const langfuseTrace = startChatTrace({
  userId: user.id,
  sessionId: sessionId || undefined,
  model: selectedModel,
  systemPrompt,
  messages: messagesForTrace,
  metadata: {
    hasBusinessProfile: !!businessProfile,
    hasFilters: !!sessionFilters,
    bankId: bankId || null,
    vaultId: vaultId !== undefined ? vaultId : null,
  },
});
```

### 4.3 Dependency Risk Assessment

**Risk Level: VERY LOW**

**Graceful Degradation:**
```typescript
// Returns null if credentials not configured
const langfuse = getLangfuse();
if (!langfuse) return null;  // Tracing disabled
```

**Non-blocking:**
- Async flush operations
- Errors caught and logged only

---

## 5. Supabase Platform Services

### 5.1 Edge Functions

**Configuration:** `supabase/config.toml`

```toml
[functions.chat-stream-v2]
verify_jwt = true

[functions.process-embeddings]
verify_jwt = false  # Worker function (service role)
```

**Deployment Limits:**
- Max execution time: 400 seconds (configurable)
- Memory: 256MB - 2GB (configurable)
- Concurrent invocations: Depends on plan

### 5.2 PostgreSQL + pgvector

**Extensions:**
```sql
-- Vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Full-text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

**Key Tables:**
| Table | Purpose |
|-------|---------|
| `transcript_chunks` | Embeddings + metadata |
| `fathom_calls` | Call metadata |
| `recordings` | Vault-scoped recordings |
| `vault_entries` | Vault membership mapping |
| `embedding_usage_logs` | Usage tracking |
| `ai_models` | Model configuration |

### 5.3 Row Level Security (RLS)

All tables enforce user isolation:
```sql
CREATE POLICY "Users can view their own chunks"
  ON transcript_chunks
  FOR SELECT USING (auth.uid() = user_id);
```

---

## 6. Comparison: Vercel AI SDK vs OpenAI Agents SDK

### 6.1 OpenAI Agents SDK Overview

**Core Primitives:**
1. **Agents** - LLMs with instructions, tools, handoffs
2. **Handoffs** - Delegate control between agents
3. **Guardrails** - Input/output validation
4. **Tracing** - Built-in observability

**Example Pattern:**
```python
# Python example (TypeScript SDK similar)
from agents import Agent, Runner

research_agent = Agent(name="Research", instructions="Find information...")
summary_agent = Agent(name="Summary", instructions="Summarize findings...")

triage_agent = Agent(
    name="Triage",
    instructions="Route to appropriate agent",
    handoffs=[research_agent, summary_agent]
)

result = await Runner.run(triage_agent, input="What did they say about pricing?")
```

### 6.2 Feature Comparison

| Feature | Vercel AI SDK (Current) | OpenAI Agents SDK |
|---------|------------------------|-------------------|
| **Multi-Agent Workflows** | Manual orchestration | Native handoffs |
| **Agent-to-Agent Communication** | Custom implementation | Built-in message passing |
| **Tool Orchestration** | Single agent with many tools | Multi-agent tool distribution |
| **Provider Support** | 70+ providers | Primarily OpenAI (with adapters) |
| **Handoffs/Delegation** | Not natively supported | First-class primitive |
| **Guardrails** | Manual validation | Built-in |
| **Streaming** | Excellent (UI SDK) | Basic |
| **React Integration** | Native hooks | Manual |
| **Edge Runtime** | Full support | Partial |

### 6.3 Migration Assessment

**Should CallVault migrate to OpenAI Agents SDK?**

**NO - Current Vercel AI SDK is sufficient for these reasons:**

1. **Single-Agent Architecture**
   - CallVault uses one chat agent with 14 tools
   - No multi-agent workflows currently needed
   - Handoffs would add complexity without benefit

2. **Multi-Provider Requirement**
   - OpenRouter provides access to 300+ models
   - OpenAI Agents SDK is OpenAI-first (requires adapters)
   - Would lose model flexibility

3. **React/Streaming Integration**
   - Vercel AI SDK has native React hooks (`useChat`)
   - UI SDK provides excellent streaming UI components
   - OpenAI Agents SDK requires manual React integration

4. **Edge Runtime**
   - CallVault runs on Supabase Edge Functions (Deno)
   - Vercel AI SDK is optimized for edge
   - OpenAI Agents SDK has limited edge support

**When OpenAI Agents SDK WOULD help:**

1. **Multi-Agent Workflows** - If adding specialized agents:
   - Research agent for complex queries
   - Analysis agent for insights
   - Summary agent for report generation

2. **Agent Collaboration** - If agents need to:
   - Pass context between each other
   - Delegate subtasks
   - Build on each other's work

3. **Complex Guardrails** - If needing:
   - Structured validation pipelines
   - Input/output safety checks
   - Multi-stage approval workflows

### 6.4 Hybrid Approach Recommendation

**Current State:** Pure Vercel AI SDK ✓  
**Future Consideration:** Add LangGraph for complex workflows

**If multi-agent needs emerge:**
```typescript
// Recommended: LangGraph + Vercel AI SDK
// LangGraph provides workflow orchestration
// Vercel AI SDK provides provider flexibility
```

---

## 7. Integration Security

### 7.1 API Key Management

**Storage:**
- All API keys in Supabase Edge Function secrets (environment variables)
- Never exposed to clients
- Service role key for database operations

**Access Pattern:**
```typescript
const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
if (!openaiApiKey) {
  return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }), { status: 500 });
}
```

### 7.2 Rate Limiting Strategy

**Multi-Layer Approach:**

| Layer | Implementation | Scope |
|-------|---------------|-------|
| OpenRouter | Provider-level | Account-wide |
| Application | Database-backed per-user | User-specific |
| Future: Token bucket | Redis/in-memory | Burst protection |

**Current Database Rate Limiting:**
```typescript
// Uses check_and_increment_rate_limit RPC
const { data: rpcResult } = await supabase.rpc('check_and_increment_rate_limit', {
  p_user_id: userId,
  p_resource_type: 'chat',
  p_max_requests: limit,
  p_window_duration_ms: windowMs,
});
```

### 7.3 Fallback & Resilience

**Provider Failures:**
- OpenAI down → OpenRouter routes to other providers
- HuggingFace down → Falls back to RRF scores
- Langfuse down → Tracing disabled (graceful)

**Embeddings Single Point of Failure:**
- OpenAI embeddings are the ONLY weak link
- Recommendation: Implement query result caching to reduce dependency

---

## 8. Cost Optimization Opportunities

### 8.1 Current Costs (Estimated)

| Operation | Cost per Request | Monthly (10k requests) |
|-----------|-----------------|----------------------|
| Embeddings | $0.000002 | $0.02 |
| LLM (gpt-4o-mini) | $0.0001 | $1.00 |
| Re-ranking (HF) | Free tier | $0 |
| **Total** | ~$0.0001 | **~$1.02** |

### 8.2 Optimization Strategies

**1. Embedding Caching (High Impact)**
```typescript
// Cache embeddings in Redis/Upstash
const cacheKey = `emb:${hash(query)}`;
const cached = await redis.get(cacheKey);
if (cached) return cached;
// ... generate and cache
```

**2. Semantic Cache (High Impact)**
Cache entire search results for similar queries:
```typescript
// Use embedding similarity to find cached results
const similarQuery = await findSimilarCachedQuery(queryEmbedding);
if (similarQuery && similarQuery.score > 0.95) {
  return similarQuery.results;
}
```

**3. Model Tiering (Medium Impact)**
- Simple queries → gpt-4o-mini ($0.15/M tokens)
- Complex queries → gpt-4o ($2.50/M tokens)
- Use query complexity classifier to route

**4. Re-ranking Optimization (Low Impact)**
- Skip re-ranking for < 10 candidates
- Use cheaper cross-encoder model
- Cache re-ranking results

---

*Integration analysis: 2026-02-09*
