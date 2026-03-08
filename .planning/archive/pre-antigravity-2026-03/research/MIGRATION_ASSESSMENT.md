# Migration Assessment: CallVault to OpenAI Agents SDK

**Research Date:** February 9, 2026  
**Project:** CallVault  
**Current Stack:** Vercel AI SDK 6.0.66 + OpenRouter + Supabase Edge Functions  
**Proposed Stack:** OpenAI Agents SDK TypeScript  
**Assessment Confidence:** HIGH

---

## Executive Summary

### Verdict: **DO NOT MIGRATE** at this time

**Rationale:**
- Current system is working well with no critical pain points
- Migration cost (2-3 weeks) outweighs benefits
- TypeScript SDK is relatively new (8 months old)
- Would lose significant Vercel AI SDK benefits
- No compelling feature gap to close

**Revisit in:** 12+ months or when true multi-agent requirements emerge

---

## Current State Analysis

### Working Well

| Component | Status | Notes |
|-----------|--------|-------|
| chat-stream-v2 | ✅ Stable | 14 RAG tools, streaming, business profile injection |
| useChat hook | ✅ Working | Frontend React integration |
| OpenRouter provider | ✅ Flexible | Access to 300+ models |
| Langfuse tracing | ✅ Integrated | Observability working |
| Hybrid search | ✅ Optimized | Semantic + full-text + re-ranking |
| Tool ecosystem | ✅ Mature | 14 specialized RAG tools |

### Code Statistics

| Metric | Value |
|--------|-------|
| RAG Tools | 14 |
| Lines in chat-stream-v2 | ~1,150 |
| Lines of tool code | ~800 |
| Frontend hooks | Custom useChat integration |
| Edge Functions | 60+ total |

---

## Migration Scope

### Files Requiring Changes

#### High Impact (Must Change)

| File | Lines | Change Type | Risk |
|------|-------|-------------|------|
| `chat-stream-v2/index.ts` | ~1,150 | Complete rewrite | HIGH |
| Frontend chat hooks | ~200 | New implementation | HIGH |
| Tool definitions | ~800 | Refactor to new syntax | MEDIUM |

#### Medium Impact (Likely Change)

| Component | Change | Risk |
|-----------|--------|------|
| OpenRouter configuration | Custom baseURL setup | MEDIUM |
| Langfuse integration | Adapter for new tracing | MEDIUM |
| Streaming response handling | New SSE implementation | HIGH |
| Error handling | Different error patterns | MEDIUM |

#### Low Impact (May Change)

| Component | Change | Risk |
|-----------|--------|------|
| CORS configuration | Likely same | LOW |
| Authentication | Likely same | LOW |
| Database queries | Likely same | LOW |

---

## Detailed Migration Path

### Phase 1: Preparation (2-3 days)

**Tasks:**
1. Set up Agents SDK test environment
2. Verify Supabase Edge Function compatibility
3. Create OpenRouter configuration
4. Design new streaming approach

**Verification:**
- [ ] Agents SDK runs in Deno/Edge Function
- [ ] OpenRouter connection works
- [ ] Basic agent responds to requests

### Phase 2: Tool Migration (3-4 days)

**Current Pattern:**
```typescript
// Vercel AI SDK
tool({
  description: 'Search transcripts by query',
  parameters: z.object({
    query: z.string().describe('The search query'),
    limit: z.number().optional()
  }),
  execute: async ({ query, limit }, { messages }) => {
    // Tool logic with access to conversation
    return await search(query, limit);
  }
})
```

**New Pattern:**
```typescript
// OpenAI Agents SDK
@function_tool
type SearchParams = {
  query: string;
  limit?: number;
};

async function searchTranscripts(params: SearchParams): Promise<SearchResult> {
  // Tool logic - context accessed differently
  return await search(params.query, params.limit);
}

// Or without decorator
const searchTranscripts = function_tool(async (query: string, limit: number = 10) => {
  return await search(query, limit);
});
```

**Migration Steps:**
1. Refactor `searchTranscriptsByQuery`
2. Refactor `searchBySpeaker`
3. Refactor `searchByDateRange`
4. Refactor `searchByCategory`
5. Refactor `searchByIntentSignal`
6. Refactor `searchBySentiment`
7. Refactor `searchByTopics`
8. Refactor `searchByUserTags`
9. Refactor `searchByEntity`
10. Refactor `getCallDetails`
11. Refactor `getCallsList`
12. Refactor `getAvailableMetadata`
13. Refactor `advancedSearch`
14. Refactor `compareCalls`

**Tools Migration Complexity: HIGH**

### Phase 3: Streaming Implementation (2-3 days)

**Current (Vercel AI SDK):**
```typescript
import { useChat } from '@ai-sdk/react';

function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: '/api/chat-stream-v2'
  });
  // ... rendering
}
```

**New (OpenAI Agents SDK):**
```typescript
// No built-in useChat equivalent
// Must implement custom streaming

function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Custom SSE handling
    const response = await fetch('/api/chat-agents', {
      method: 'POST',
      body: JSON.stringify({ messages: [...messages, { role: 'user', content: input }] })
    });
    
    const reader = response.body.getReader();
    // ... manual stream handling
  };
}
```

**Streaming Complexity: HIGH**

### Phase 4: Agent Configuration (1-2 days)

**Single Agent Approach (Simplest):**
```typescript
import { Agent, Runner } from '@openai/agents';

const callVaultAgent = new Agent({
  name: 'CallVault AI',
  instructions: buildSystemPrompt(businessProfile, filters),
  tools: [
    searchTranscriptsByQuery,
    searchBySpeaker,
    // ... all 14 tools
  ],
  // No handoffs - single agent
});

// In Edge Function
const result = await Runner.run(callVaultAgent, userInput, {
  maxTurns: 10,
  // ... other options
});
```

**Multi-Agent Approach (More Complex):**
```typescript
const searchAgent = new Agent({
  name: 'Search Specialist',
  instructions: 'Handle search queries',
  tools: [searchTranscriptsByQuery, searchBySpeaker, searchByEntity],
});

const analyticsAgent = new Agent({
  name: 'Analytics Specialist',
  instructions: 'Handle analytics queries',
  tools: [getCallDetails, compareCalls, getCallsList],
});

const triageAgent = new Agent({
  name: 'Triage Agent',
  instructions: 'Route to appropriate specialist',
  handoffs: [searchAgent, analyticsAgent],
});
```

### Phase 5: Testing (3-4 days)

**Test Scenarios:**
1. Basic chat with no tools
2. Single tool call
3. Multiple parallel tool calls
4. Tool call with error
5. Streaming interrupted
6. Long conversation (token limits)
7. Rate limiting
8. Error recovery
9. All 14 tools individually
10. Tool combinations
11. Business profile injection
12. Filter application
13. Multi-vault scenarios

**Testing Complexity: HIGH**

### Phase 6: Observability Migration (1-2 days)

**Current (Langfuse):**
```typescript
import { startChatTrace, flushLangfuse } from '../_shared/langfuse.ts';

const trace = startChatTrace(userId, sessionId);
// ... use trace throughout
await flushLangfuse();
```

**New (Agents SDK + Langfuse):**
```typescript
// Agents SDK has built-in tracing
// Would need to integrate with Langfuse via custom trace processor

import { addTraceProcessor } from '@openai/agents';
import { LangfuseTraceProcessor } from './langfuse-adapter';

addTraceProcessor(new LangfuseTraceProcessor());
```

---

## Code Changes Required

### Example: Tool Definition Change

**Before (Vercel AI SDK):**
```typescript
// supabase/functions/chat-stream-v2/index.ts
import { tool } from 'ai';
import { z } from 'zod';

const searchTranscriptsByQuery = tool({
  description: 'General semantic and keyword search through meeting transcripts',
  parameters: z.object({
    query: z.string().describe('The search query'),
    limit: z.number().optional().describe('Maximum results'),
  }),
  execute: async ({ query, limit = 10 }, { messages }) => {
    const filters = mergeFilters(sessionFilters, {}, bankId, vaultId);
    return await executeHybridSearch({ query, limit, supabase, userId, openaiApiKey, hfApiKey, filters });
  },
});
```

**After (OpenAI Agents SDK):**
```typescript
// supabase/functions/chat-agents/index.ts
import { function_tool, Agent } from '@openai/agents';
import { z } from 'zod';

// Need to pass context differently - closure or context object
function createTools(context: ToolContext) {
  const searchTranscriptsByQuery = function_tool(async (query: string, limit: number = 10) => {
    const filters = mergeFilters(context.sessionFilters, {}, context.bankId, context.vaultId);
    return await executeHybridSearch({ 
      query, 
      limit, 
      supabase: context.supabase, 
      userId: context.userId, 
      openaiApiKey: context.openaiApiKey, 
      hfApiKey: context.hfApiKey, 
      filters 
    });
  });
  
  return { searchTranscriptsByQuery };
}
```

**Key Differences:**
1. No `description` in tool definition (from docstring or metadata)
2. No `parameters` object (inferred from function signature)
3. Context passed via closure, not `execute` options
4. Different error handling

### Example: Main Handler Change

**Before (Vercel AI SDK):**
```typescript
const result = streamText({
  model: openRouter(model),
  messages: convertToModelMessages(messages),
  system: systemPrompt,
  tools: createTools(supabase, userId, openaiApiKey, hfApiKey, sessionFilters, bankId, vaultId),
  maxSteps: 10,
  experimental_activeTools: Object.keys(tools),
  onStepFinish: async (step) => {
    await logStep(step);
  },
});

return result.toUIMessageStreamResponse();
```

**After (OpenAI Agents SDK):**
```typescript
const tools = createTools({ supabase, userId, openaiApiKey, hfApiKey, sessionFilters, bankId, vaultId });

const agent = new Agent({
  name: 'CallVault AI',
  instructions: systemPrompt,
  tools: Object.values(tools),
});

const result = await Runner.run(agent, messages[messages.length - 1].content, {
  maxTurns: 10,
  // Streaming handled differently
});

// Manual streaming implementation needed
return new Response(createStream(result), {
  headers: { 'Content-Type': 'text/event-stream' },
});
```

---

## Compatibility Assessment

### Supabase Edge Functions

| Aspect | Status | Notes |
|--------|--------|-------|
| Deno Runtime | ⚠️ Likely works | Claims Deno support |
| Environment Variables | ✅ Compatible | Same pattern |
| Fetch API | ✅ Compatible | Standard fetch |
| npm Modules | ⚠️ Check | Uses `npm:@openai/agents` |
| Bundle Size | ⚠️ Unknown | May affect cold start |

### OpenRouter

| Aspect | Status | Notes |
|--------|--------|-------|
| API Compatibility | ✅ Works | OpenAI-compatible endpoint |
| Configuration | ⚠️ Manual | Set custom baseURL |
| Headers | ⚠️ Manual | Pass Referer and Title |
| Model Selection | ✅ Works | Via model name |

### Frontend

| Aspect | Status | Notes |
|--------|--------|-------|
| React Integration | ❌ Custom needed | No `useChat` equivalent |
| Streaming | ⚠️ Manual | Custom SSE handling |
| TypeScript | ✅ Supported | Full type safety |

---

## Effort Estimation

### Time Breakdown

| Phase | Days | Risk |
|-------|------|------|
| Preparation | 2-3 | Low |
| Tool Migration | 3-4 | High |
| Streaming | 2-3 | High |
| Agent Config | 1-2 | Medium |
| Testing | 3-4 | High |
| Observability | 1-2 | Medium |
| Bug Fixes | 2-3 | High |
| **Total** | **14-21** | **High** |

### Resource Requirements

- 1 Senior Developer full-time for 2-3 weeks
- Testing environment with OpenRouter credits
- Feature flag system for gradual rollout
- Rollback plan

---

## Risk Matrix

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Edge Function incompatibility | Medium | Critical | Test early in Deno environment |
| Streaming bugs | High | High | Extensive testing, fallback to polling |
| Tool refactoring errors | Medium | High | Comprehensive test suite |
| Performance regression | Medium | Medium | Benchmark before/after |
| User experience degradation | Low | High | A/B testing, gradual rollout |
| Third-party integration issues | Medium | Medium | Adapter patterns |

---

## Alternative: Gradual Adoption

Instead of full migration, consider:

### Option A: Feature-Specific Agents SDK

Use Agents SDK only for new multi-agent features:
```
/api/chat-stream-v2     → Vercel AI SDK (current)
/api/chat-agents        → OpenAI Agents SDK (new features)
```

### Option B: Experimental Branch

Maintain branch with Agents SDK for evaluation:
- No production deployment
- Compare performance
- Team learning
- Decision after 1 month

### Option C: Wait and Monitor

Continue with current stack, monitor Agents SDK:
- Wait for TypeScript SDK maturity (12+ months)
- Watch for compelling features
- Re-evaluate quarterly

---

## Final Recommendation

### DO NOT MIGRATE at this time

**Primary Reasons:**
1. Current system works well
2. High migration cost (2-3 weeks)
3. TypeScript SDK is new and relatively unproven
4. Would lose Vercel AI SDK ecosystem benefits
5. No critical pain points requiring migration

### When to Reconsider

1. **True multi-agent requirement** emerges
2. **Vercel AI SDK** falls significantly behind
3. **OpenAI Agents SDK TypeScript** matures (12+ months)
4. **New project** where migration cost is lower
5. **Compelling feature** only available in Agents SDK

### Immediate Actions

1. ✅ **Monitor** OpenAI Agents SDK development
2. ✅ **Maintain** current Vercel AI SDK architecture
3. ✅ **Document** this research for future reference
4. ✅ **Re-evaluate** in 6-12 months

---

## Sources

- [OpenAI Agents SDK Documentation](https://openai.github.io/openai-agents-python/)
- [OpenAI Agents SDK TypeScript](https://openai.github.io/openai-agents-js/)
- CallVault codebase analysis (chat-stream-v2, search-pipeline.ts)
- Community comparisons and migration experiences
