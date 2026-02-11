# Technology Stack Comparison

**Research Date:** February 9, 2026  
**Comparison:** Vercel AI SDK vs OpenAI Agents SDK

---

## Current Stack (CallVault)

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| AI Orchestration | Vercel AI SDK | 6.0.66 | Streaming, tool calling, React integration |
| AI Provider | OpenRouter | Via `@openrouter/ai-sdk-provider` | Multi-model access (300+ models) |
| Frontend Framework | React + Vite | 18.3.1 | UI layer |
| Backend | Supabase Edge Functions | Deno runtime | Serverless API endpoints |
| Observability | Langfuse | Custom integration | Tracing and monitoring |

---

## OpenAI Agents SDK Stack

| Component | Python SDK | TypeScript SDK |
|-----------|------------|----------------|
| Package | `openai-agents` | `@openai/agents` |
| Version | Stable | 0.4.5 (released June 2025) |
| Runtime | Python 3.9+ | Node.js 22+, Deno, Bun |
| Dependencies | `openai`, `pydantic` | `zod` v4+ |

---

## Direct Comparison

### 1. Provider Support

| Feature | Vercel AI SDK | OpenAI Agents SDK |
|---------|---------------|-------------------|
| Native Providers | 25+ (OpenAI, Anthropic, Google, Mistral, etc.) | OpenAI native, 100+ via OpenAI-compatible APIs |
| OpenRouter Support | ✅ Native provider package | ✅ Via custom baseURL |
| Provider Switching | One-line change | Requires adapter configuration |
| Model Fallbacks | Via AI SDK | Manual implementation |

**Winner:** Vercel AI SDK - More mature provider abstraction

---

### 2. Tool Calling

| Feature | Vercel AI SDK | OpenAI Agents SDK |
|---------|---------------|-------------------|
| Tool Definition | `tool({ description, parameters, execute })` | `@function_tool` decorator or `function_tool()` |
| Schema Generation | Zod-based | Pydantic (Python) / Zod (TypeScript) |
| Parallel Tool Calls | ✅ Supported | ✅ Supported |
| Tool Results | Manual loop handling | Automatic Runner loop |
| Tool Types | Custom functions | Custom + Built-in (WebSearch, FileSearch) |

**Example - Vercel AI SDK:**
```typescript
import { tool } from 'ai';
import { z } from 'zod';

const searchTool = tool({
  description: 'Search transcripts',
  parameters: z.object({ query: z.string() }),
  execute: async ({ query }) => {
    return await performSearch(query);
  },
});
```

**Example - OpenAI Agents SDK:**
```typescript
import { function_tool } from '@openai/agents';
import { z } from 'zod';

@function_tool
async function searchTranscripts(query: string): Promise<string> {
  return await performSearch(query);
}
// or
const searchTool = function_tool(async (query: string) => {
  return await performSearch(query);
});
```

**Winner:** Tie - Both have excellent tool support, different syntax preferences

---

### 3. Streaming

| Feature | Vercel AI SDK | OpenAI Agents SDK |
|---------|---------------|-------------------|
| Streaming API | `streamText()` with async iterator | Streaming via events |
| React Integration | `useChat()` hook, AI UI components | Manual integration |
| SSE Support | Built-in | Manual implementation |
| Token Streaming | ✅ Native | ✅ Supported |

**Winner:** Vercel AI SDK - First-class React streaming support

---

### 4. Multi-Agent Orchestration

| Feature | Vercel AI SDK | OpenAI Agents SDK |
|---------|---------------|-------------------|
| Agent Handoffs | Manual implementation | Native `handoffs` primitive |
| Agent-as-Tools | Manual composition | Built-in support |
| Agent Routing | Custom logic | Declarative handoff functions |
| Context Sharing | Manual message passing | Automatic via Sessions |

**Example - OpenAI Agents SDK Handoff:**
```typescript
import { Agent } from '@openai/agents';

const salesAgent = new Agent({
  name: 'Sales Agent',
  instructions: 'Handle sales inquiries',
});

const supportAgent = new Agent({
  name: 'Support Agent', 
  instructions: 'Handle support tickets',
});

const triageAgent = new Agent({
  name: 'Triage Agent',
  instructions: 'Route to appropriate agent',
  handoffs: [salesAgent, supportAgent],
});
```

**Winner:** OpenAI Agents SDK - Purpose-built for multi-agent

---

### 5. State Management

| Feature | Vercel AI SDK | OpenAI Agents SDK |
|---------|---------------|-------------------|
| Conversation History | Manual management | Automatic Sessions |
| State Persistence | External (database) | Built-in + Redis option |
| Context Windows | Manual token counting | Automatic handling |
| Multi-turn Logic | `maxSteps` parameter | `maxTurns` in Runner |

**Winner:** OpenAI Agents SDK - Better built-in state management

---

### 6. Observability

| Feature | Vercel AI SDK | OpenAI Agents SDK |
|---------|---------------|-------------------|
| Built-in Tracing | ❌ None | ✅ Native tracing |
| External Integration | Langfuse, LangSmith, etc. | Logfire, AgentOps, Braintrust, etc. |
| Debug Visibility | Via external tools | Built-in trace visualization |
| Token Usage Tracking | Manual | Automatic |

**Winner:** OpenAI Agents SDK - Built-in observability

---

### 7. Edge Runtime Support

| Runtime | Vercel AI SDK | OpenAI Agents SDK |
|---------|---------------|-------------------|
| Node.js | ✅ Full support | ✅ 22+ required |
| Deno (Supabase) | ✅ Full support | ✅ Supported |
| Bun | ✅ Supported | ✅ Supported |
| Cloudflare Workers | ✅ Full support | ⚠️ Experimental |
| Browser | ✅ React integration | ✅ Realtime agents |

**Winner:** Vercel AI SDK - More mature edge runtime support

---

### 8. TypeScript Experience

| Aspect | Vercel AI SDK | OpenAI Agents SDK |
|--------|---------------|-------------------|
| Type Safety | Full TypeScript | Full TypeScript |
| IntelliSense | Excellent | Good |
| Learning Curve | Moderate | Moderate |
| Documentation | Comprehensive | Good (newer) |
| Community | Large | Growing |

**Winner:** Vercel AI SDK - More mature ecosystem

---

## Stack Recommendations

### For CallVault (Current Project)

**Stay with Vercel AI SDK because:**

1. **Already invested** - 14 RAG tools built, Langfuse integrated
2. **Works well** - No major pain points with current approach
3. **TypeScript maturity** - 2+ years vs 8 months for Agents SDK TS
4. **Provider flexibility** - OpenRouter integration is seamless
5. **React integration** - `useChat()` hook is essential for UI

### When to Choose OpenAI Agents SDK

Choose OpenAI Agents SDK for new projects when:

1. **Multi-agent is core requirement** - True agent handoffs needed
2. **Python-first team** - Python SDK is more mature
3. **Observability priority** - Want built-in tracing without third-party
4. **OpenAI-focused** - Primarily using OpenAI models
5. **New project** - No existing AI SDK code to migrate

### Hybrid Approach

Consider hybrid if:
- Use Vercel AI SDK for primary chat (React integration)
- Use OpenAI Agents SDK for specific multi-agent workflows
- Both can coexist via different API endpoints

---

## Integration with OpenRouter

### Vercel AI SDK (Current)
```typescript
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

const openRouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  headers: {
    'HTTP-Referer': 'https://app.example.com',
    'X-Title': 'My App',
  },
});

const model = openRouter('anthropic/claude-3.5-sonnet');
```

### OpenAI Agents SDK (Hypothetical)
```typescript
import { Agent } from '@openai/agents';

const agent = new Agent({
  name: 'Assistant',
  instructions: '...',
  // Configure OpenAI client with OpenRouter baseURL
  // Requires manual OpenAI client configuration
});
```

**OpenAI Agents SDK CAN work with OpenRouter** by configuring the underlying OpenAI client with a custom `baseURL` pointing to `https://openrouter.ai/api/v1`.

---

## Installation Commands

### Current (Vercel AI SDK)
```bash
npm install ai @ai-sdk/react @ai-sdk/openai
npm install @openrouter/ai-sdk-provider
```

### Alternative (OpenAI Agents SDK)
```bash
npm install @openai/agents zod
# Would need to configure OpenAI client with OpenRouter baseURL
```

---

## Summary Matrix

| Criterion | Vercel AI SDK | OpenAI Agents SDK | Winner |
|-----------|---------------|-------------------|--------|
| Provider Flexibility | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Vercel |
| Multi-Agent | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Agents SDK |
| React Integration | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Vercel |
| TypeScript Maturity | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Vercel |
| Built-in Observability | ⭐⭐ | ⭐⭐⭐⭐⭐ | Agents SDK |
| Edge Runtime | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Vercel |
| Tool Calling | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Tie |
| State Management | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Agents SDK |
| Community/Ecosystem | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Vercel |
| Production Readiness | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Vercel |

**Overall for CallVault:** Vercel AI SDK is the better choice.
