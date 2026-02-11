# Architecture Patterns Comparison

**Research Date:** February 9, 2026  
**Comparison:** CallVault Current Architecture vs OpenAI Agents SDK Architecture

---

## Current CallVault Architecture

### High-Level Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Frontend                          │
│                   (useChat hook from AI SDK)                   │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTP/WebSocket
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│              Supabase Edge Function (Deno Runtime)             │
│                         chat-stream-v2                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Vercel AI SDK: streamText()                            │   │
│  │  ├── Model: OpenRouter (Anthropic, OpenAI, etc.)       │   │
│  │  ├── System Prompt (with business profile injection)   │   │
│  │  └── 14 RAG Tools (search, metadata, analytics)        │   │
│  │       ├── searchTranscriptsByQuery                     │   │
│  │       ├── searchBySpeaker                              │   │
│  │       ├── searchByDateRange                            │   │
│  │       ├── searchByCategory                             │   │
│  │       ├── searchByIntentSignal                         │   │
│  │       ├── searchBySentiment                            │   │
│  │       ├── searchByTopics                               │   │
│  │       ├── searchByUserTags                             │   │
│  │       ├── searchByEntity                               │   │
│  │       ├── getCallDetails                               │   │
│  │       ├── getCallsList                                 │   │
│  │       ├── getAvailableMetadata                         │   │
│  │       ├── advancedSearch                               │   │
│  │       └── compareCalls                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────────┘
                               │
               ┌───────────────┼───────────────┐
               ▼               ▼               ▼
        ┌──────────┐    ┌──────────┐    ┌──────────┐
        │ Supabase │    │ OpenAI   │    │ Hugging  │
        │ Database │    │ (Embeds) │    │ Face     │
        │ (pgvector)│    │          │    │ (Rerank) │
        └──────────┘    └──────────┘    └──────────┘
```

### Key Architectural Decisions

1. **Single Agent, Many Tools**
   - One AI agent with 14 specialized RAG tools
   - Tools encapsulate different search strategies
   - Agent decides which tools to call

2. **Hybrid Search Pipeline**
   - Semantic search (OpenAI embeddings)
   - Full-text search (PostgreSQL)
   - Cross-encoder re-ranking (HuggingFace)
   - Diversity filtering

3. **Streaming-First**
   - Server-Sent Events (SSE) to frontend
   - Real-time token streaming
   - Tool result streaming

4. **Multi-Tenant with Bank/Vault Scoping**
   - User authentication via JWT
   - Bank-level and vault-level scoping
   - RLS policies for data isolation

---

## OpenAI Agents SDK Architecture

### Recommended Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Frontend                          │
│              (Manual integration or ChatKit)                   │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTP
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│              Supabase Edge Function (Deno Runtime)             │
│                    Agent Orchestration                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  OpenAI Agents SDK: Runner.run()                        │   │
│  │  ├── Triage Agent                                       │   │
│  │  │   └── Handoffs: [SearchAgent, AnalyticsAgent]       │   │
│  │  ├── Search Agent                                       │   │
│  │  │   └── Tools: [hybridSearch, semanticSearch]          │   │
│  │  └── Analytics Agent                                    │   │
│  │      └── Tools: [getCallDetails, compareCalls]          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                         OR                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Single Agent (simpler migration path)                  │   │
│  │  └── Agent with 14 tools (similar to current)           │   │
│  └─────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────────┘
                               │
               ┌───────────────┼───────────────┐
               ▼               ▼               ▼
        ┌──────────┐    ┌──────────┐    ┌──────────┐
        │ Supabase │    │ OpenAI/  │    │ Tracing  │
        │ Database │    │ OpenRouter│   │ (Built-in)│
        └──────────┘    └──────────┘    └──────────┘
```

### Key Architectural Patterns

1. **Agent Primitives**
   ```typescript
   interface Agent {
     name: string;
     instructions: string;
     tools: Tool[];
     handoffs?: Agent[];  // For multi-agent
     guardrails?: Guardrail[];
   }
   ```

2. **Runner Loop**
   ```typescript
   // Agents SDK manages the loop
   const result = await Runner.run(
     startingAgent,
     userInput,
     { maxTurns: 10 }
   );
   ```

3. **Sessions for State**
   ```typescript
   // Automatic conversation history
   const session = new Session();
   await Runner.run(agent, input, { session });
   // History persisted across runs
   ```

4. **Handoffs for Multi-Agent**
   ```typescript
   const triageAgent = new Agent({
     name: 'Triage',
     instructions: 'Route to appropriate specialist',
     handoffs: [salesAgent, supportAgent, technicalAgent]
   });
   ```

---

## Architecture Comparison

### 1. Agent Organization

| Aspect | Current (Vercel AI SDK) | OpenAI Agents SDK |
|--------|------------------------|-------------------|
| **Structure** | Single agent, 14 tools | Could be single agent OR multi-agent |
| **Tool Definition** | Inline with `tool()` | Decorated functions or `function_tool()` |
| **Tool Execution** | AI SDK manages loop | Runner manages loop |
| **Agent Boundaries** | Tool-based separation | Agent-based separation (optional) |

### 2. State Management

| Aspect | Current (Vercel AI SDK) | OpenAI Agents SDK |
|--------|------------------------|-------------------|
| **Conversation History** | Manual (pass messages array) | Automatic (Sessions) |
| **Context Management** | Manual token counting | Automatic |
| **Persistence** | External (database) | Built-in + Redis option |
| **Multi-turn Logic** | `maxSteps` in `streamText` | `maxTurns` in Runner |

### 3. Tool Calling Architecture

**Current Pattern:**
```typescript
// Tool defined inline
const searchTool = tool({
  description: 'Search transcripts',
  parameters: z.object({ query: z.string() }),
  execute: async ({ query }, { messages }) => {
    // Access to conversation context via options
    return await search(query);
  }
});

// Used in streamText
const result = streamText({
  model: openRouter('claude-3.5-sonnet'),
  tools: { searchTool },
  // ...
});
```

**Agents SDK Pattern:**
```typescript
// Tool as decorated function
@function_tool
async function searchTranscripts(
  query: string,
  context: ToolContext  // Access to agent context
): Promise<string> {
  return await search(query);
}

// Agent definition
const agent = new Agent({
  name: 'Assistant',
  instructions: '...',
  tools: [searchTranscripts],
});

// Runner handles execution
const result = await Runner.run(agent, userInput);
```

### 4. Multi-Agent Patterns

**Current Approach (Tool-based):**
```
User Query → Single Agent → Routes via Tool Selection
                ↓
    ┌───────────┼───────────┐
    ▼           ▼           ▼
 Search Tool  Analytics  Metadata
```

**Agents SDK Approach (Agent-based):**
```
User Query → Triage Agent
                ↓
        ┌───────┴───────┐
        ▼               ▼
   Search Agent    Analytics Agent
   (specialized)   (specialized)
```

**Key Difference:**
- Current: Single agent decides which tools to call
- Agents SDK: Triage agent decides which agent to handoff to

---

## Migration Architecture Options

### Option 1: Direct Translation (Lowest Risk)

Keep single-agent architecture, translate to Agents SDK syntax.

**Pros:**
- Minimal architectural change
- Can migrate incrementally
- Low risk

**Cons:**
- Doesn't leverage multi-agent capabilities
- Still requires significant code changes
- Loses Vercel AI SDK benefits

### Option 2: Multi-Agent Refactor (Highest Risk)

Restructure into multiple specialized agents.

**Agent Design:**
```typescript
// Triage Agent
const triageAgent = new Agent({
  name: 'CallVault Triage',
  instructions: 'Route to appropriate specialist based on query type',
  handoffs: [searchAgent, analyticsAgent, metadataAgent]
});

// Search Specialist
const searchAgent = new Agent({
  name: 'Search Specialist',
  instructions: 'Handle semantic and keyword searches',
  tools: [searchTranscripts, searchBySpeaker, searchByEntity]
});

// Analytics Specialist  
const analyticsAgent = new Agent({
  name: 'Analytics Specialist',
  instructions: 'Handle call details and comparisons',
  tools: [getCallDetails, compareCalls, getCallsList]
});

// Metadata Specialist
const metadataAgent = new Agent({
  name: 'Metadata Specialist',
  instructions: 'Handle metadata filtering and discovery',
  tools: [searchByCategory, searchBySentiment, getAvailableMetadata]
});
```

**Pros:**
- Leverages Agents SDK strengths
- More modular architecture
- Built-in routing logic

**Cons:**
- High risk - complete refactor
- May not improve actual performance
- More complex to debug

### Option 3: Hybrid (Recommended if Migrating)

Keep Vercel AI SDK for main chat, use Agents SDK for specific workflows.

```
Main Chat ──► Vercel AI SDK (current)
                 ↓
        ┌────────┴────────┐
        ▼                 ▼
   RAG Tools        Special Workflow
   (14 tools)       (Agents SDK endpoint)
   (current)        (new, if needed)
```

**Pros:**
- No migration risk to core chat
- Can experiment with Agents SDK
- Best of both worlds

**Cons:**
- Two different patterns to maintain
- Complexity of multiple approaches

---

## Data Flow Comparison

### Current Flow (Vercel AI SDK)

```
1. User sends message
   ↓
2. Frontend: useChat sends to Edge Function
   ↓
3. Edge Function: Build system prompt (with business profile)
   ↓
4. Edge Function: streamText() with OpenRouter
   ↓
5. LLM decides which tool(s) to call
   ↓
6. Tool executes (hybrid search pipeline)
   ↓
7. Tool results appended to conversation
   ↓
8. LLM generates final response
   ↓
9. Tokens stream to frontend
   ↓
10. Frontend displays with citations
```

### Agents SDK Flow

```
1. User sends message
   ↓
2. Frontend: POST to Edge Function
   ↓
3. Edge Function: Runner.run(startingAgent, input)
   ↓
4. Runner loop begins
   ↓
5. Agent decides: respond, call tool, or handoff
   ↓
6a. If handoff: switch to other agent, continue loop
6b. If tool: execute tool, append result
6c. If respond: return final output
   ↓
7. Loop continues until final output or maxTurns
   ↓
8. Response returned to frontend
   ↓
9. Frontend displays (manual integration)
```

---

## Scalability Considerations

### At Current Scale (Single User)

| Aspect | Vercel AI SDK | OpenAI Agents SDK |
|--------|---------------|-------------------|
| Latency | ~500-1500ms | Similar |
| Complexity | Medium | Medium |
| Debugging | Good (Langfuse) | Good (built-in) |

### At 10K Users

| Aspect | Vercel AI SDK | OpenAI Agents SDK |
|--------|---------------|-------------------|
| Stateless Scaling | ✅ Excellent | ✅ Good (Sessions need storage) |
| Caching | Via Vercel AI Gateway | Manual implementation |
| Rate Limiting | OpenRouter handles | Manual implementation |

### At 1M Users

| Aspect | Vercel AI SDK | OpenAI Agents SDK |
|--------|---------------|-------------------|
| Multi-region | Vercel infrastructure | Self-managed |
| Observability | Langfuse/others | Built-in + third-party |
| Cost Optimization | AI Gateway caching | Manual |

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Premature Multi-Agent

**What:** Splitting single-agent workflow into multiple agents unnecessarily.

**Why Bad:** Adds complexity without benefit. Current 14-tool approach works well.

**Instead:** Keep single agent until true multi-agent needs emerge.

### Anti-Pattern 2: Ignoring Streaming

**What:** Using Agents SDK's non-streaming responses for chat UI.

**Why Bad:** Poor user experience, long wait times.

**Instead:** Ensure streaming implementation (more complex with Agents SDK).

### Anti-Pattern 3: Mixing Patterns

**What:** Partial migration leaving two different agent patterns.

**Why Bad:** Hard to maintain, confusing for developers.

**Instead:** Complete migration or stay with current stack.

### Anti-Pattern 4: Losing Provider Flexibility

**What:** Hard-coding to OpenAI models when using Agents SDK.

**Why Bad:** Loses OpenRouter's 300+ model access.

**Instead:** Configure custom baseURL for OpenRouter.

---

## Sources

- [OpenAI Agents SDK Documentation](https://openai.github.io/openai-agents-python/)
- [OpenAI Agents SDK TypeScript](https://openai.github.io/openai-agents-js/)
- [Vercel AI SDK Documentation](https://ai-sdk.dev/)
- [OpenAI Agents SDK vs Vercel AI SDK Comparison](https://sph.sh/en/posts/typescript-ai-sdk-agent-tooling/)
- [LangChain vs Vercel AI SDK vs OpenAI SDK](https://strapi.io/blog/langchain-vs-vercel-ai-sdk-vs-openai-sdk-comparison-guide)
