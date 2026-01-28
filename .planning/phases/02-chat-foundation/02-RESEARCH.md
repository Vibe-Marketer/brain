# Phase 2: Chat Foundation - Research

**Researched:** 2026-01-28
**Domain:** Vercel AI SDK migration, chat streaming, tool orchestration, error handling
**Confidence:** HIGH (code analysis) / MEDIUM (SDK + Deno compatibility)

## Summary

This research analyzed 5,000+ lines of existing source code across the chat backend (1993 lines), frontend Chat.tsx (1900+ lines), chat session hooks, store implementations, and reference Edge Functions. The existing `chat-stream` Edge Function is a monolithic hand-rolled OpenRouter SSE implementation that bypasses the Vercel AI SDK entirely due to a zod bundling issue (`safeParseAsync is not a function`). Two other Edge Functions (`generate-ai-titles`, `auto-tag-calls`) already successfully use `@openrouter/ai-sdk-provider` with `generateText()` and `generateObject()` (with zod!) on Deno via `esm.sh`, proving the SDK works on this runtime — but neither uses `streamText()` with tools.

The frontend already uses `useChat` from `@ai-sdk/react` v5 with `DefaultChatTransport` targeting the Supabase Edge Function URL. The backend already manually emits AI SDK v5 Data Stream Protocol events (start, text-start, text-delta, tool-input-start, tool-input-delta, tool-input-available, tool-output-available, finish-step, finish). This means the new `chat-stream-v2` needs to use `streamText()` + `tool()` with `toUIMessageStreamResponse()` or equivalent, and the frontend should work with minimal changes.

**Primary recommendation:** Build `chat-stream-v2` using `streamText()` from `ai@5.0.102` via `esm.sh`, with `@openrouter/ai-sdk-provider@1.2.8`, defining all 14 tools using the AI SDK `tool()` helper with zod schemas. Use `result.toUIMessageStreamResponse()` for the response. Verify zod + `streamText` + tools work together on Deno before building all 14 tools.

---

## Current Implementation Analysis

### Backend (chat-stream) — 1993 lines

**Architecture:** Single monolithic file with these sections:

1. **Type definitions** (lines 1-50) — UIMessage, OpenAIMessage, OpenAITool interfaces
2. **Embedding generation** (lines 56-75) — Direct fetch to OpenAI embeddings API (`text-embedding-3-small`)
3. **Re-ranking** (lines 80-201) — HuggingFace cross-encoder re-ranking (`ms-marco-MiniLM-L-12-v2`) with batch processing and timeouts
4. **Diversity filtering** (lines 203-222) — Max N chunks per recording to ensure diverse results
5. **Tool definitions** (lines 236-634) — 14 tools defined in OpenAI function-calling JSON format
6. **Tool execution handlers** (lines 646-1303) — Individual execute functions per tool
7. **Tool execution router** (lines 1309-1456) — Switch statement dispatching tool name to handler
8. **OpenRouter streaming** (lines 1462-1576) — Manual SSE parsing of OpenRouter chat/completions stream
9. **UI message conversion** (lines 1582-1600) — Converting UIMessage parts to OpenAI message format
10. **Main handler** (lines 1606-1993) — Request parsing, auth, session filters, system prompt, multi-step tool loop, SSE emission

**The 14 RAG Tools:**

| # | Tool Name | Category | Purpose |
|---|-----------|----------|---------|
| 1 | `searchTranscriptsByQuery` | Core Search | General semantic + keyword hybrid search |
| 2 | `searchBySpeaker` | Core Search | Filter by speaker name/email |
| 3 | `searchByDateRange` | Core Search | Temporal filtering |
| 4 | `searchByCategory` | Core Search | Filter by call category |
| 5 | `searchByIntentSignal` | Metadata | buying_signal, objection, question, concern |
| 6 | `searchBySentiment` | Metadata | positive, negative, neutral, mixed |
| 7 | `searchByTopics` | Metadata | Auto-extracted topic tags |
| 8 | `searchByUserTags` | Metadata | User-assigned tags |
| 9 | `searchByEntity` | Metadata | Companies, people, products (JSONB post-filter) |
| 10 | `getCallDetails` | Analytical | Full call details by recording_id |
| 11 | `getCallsList` | Analytical | List calls with optional filters |
| 12 | `getAvailableMetadata` | Analytical | Discover available filter values |
| 13 | `advancedSearch` | Advanced | Multi-dimensional combined filters |
| 14 | `compareCalls` | Advanced | Side-by-side comparison of 2-5 calls |

**Search Pipeline (for tools 1-9):**
1. Generate query embedding via OpenAI `text-embedding-3-small`
2. Call `hybrid_search_transcripts` Supabase RPC (combines full-text + semantic search with RRF)
3. Re-rank results via HuggingFace cross-encoder (batched, with timeout fallback)
4. Apply diversity filter (max 2 chunks per recording)
5. Return formatted results with recording_id, call_title, call_date, speaker, text, relevance %

**Multi-step tool loop:** The handler supports up to 5 steps (maxSteps = 5). After tool calls are detected in the stream, they're executed, results are appended to the conversation as tool messages, and the model is called again.

**SSE Protocol:** Already emits AI SDK v5 Data Stream Protocol events manually:
- `start`, `start-step`, `text-start`, `text-delta`, `text-end`
- `tool-input-start`, `tool-input-delta`, `tool-input-available`, `tool-output-available`
- `finish-step`, `finish`, `error`
- Header: `x-vercel-ai-ui-message-stream: v1`

**Key observation:** The backend is already emulating the exact protocol that `streamText().toUIMessageStreamResponse()` would produce natively. This confirms the migration path is sound.

### Frontend (Chat.tsx + hooks)

**Chat.tsx** (1900+ lines) — Already uses AI SDK v5 patterns:

```typescript
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";

// Transport setup with auth + custom body
const transport = new DefaultChatTransport({
  api: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-stream`,
  headers: { Authorization: `Bearer ${session.access_token}` },
  body: { filters: apiFilters, model: selectedModel, sessionId: currentSessionId },
  fetch: customFetch,  // 2-minute timeout + Sentry tracking
});

const { messages, sendMessage, status, error, setMessages } = useChat({
  transport: transport || undefined,
});
```

**Key frontend patterns already in place:**
- `UIMessage` parts-based rendering (text, tool parts)
- Tool call extraction from `message.parts` (type `tool-*` with states: `input-streaming`, `input-available`, `output-available`, `output-error`)
- Rate limit detection + cooldown timer
- Streaming interruption detection + exponential backoff reconnect (3 attempts)
- Debounced message saving to Supabase (500ms)
- Session management via `useChatSession` hook
- Model selector (OpenRouter format: `provider/model-name`)
- Filter system (date range, speakers, categories, recording IDs)
- Context attachments for specific calls

**Frontend changes needed for v2:** MINIMAL. The frontend already consumes the AI SDK v5 Data Stream Protocol. Switching the transport URL from `chat-stream` to `chat-stream-v2` is the primary change. Tool call display changes (three-state) and citation improvements need component updates but not architectural changes.

**useChatSession.ts** (376 lines):
- CRUD for `chat_sessions` table (create, fetch, update title, pin, archive, delete)
- Message persistence to `chat_messages` table
- Deduplication via content+role matching
- Parts serialized via `JSON.parse(JSON.stringify(parts))` round-trip
- Messages stored with: id (UUID), session_id, user_id, role, content, parts (JSONB), model, created_at

### Store Error Patterns (STORE-01)

Analyzed three stores: `contentLibraryStore`, `contentItemsStore`, `businessProfileStore`.

**Current pattern (silently swallows errors):**
```typescript
// contentLibraryStore.saveContentItem
const { data, error } = await saveContent(input);
if (error) {
  set((state) => ({
    items: state.items.filter((item) => item.id !== tempId),
    itemsError: error.message,  // Sets error state...
  }));
  return null;  // ...but caller gets null with no notification
}
```

**Problem:** All three stores use optimistic updates + rollback on error. On error, they:
1. Rollback the optimistic state update ✅
2. Set `itemsError` / `profilesError` state ✅
3. Return `null` or `false` ✅
4. **Show NO toast notification** ❌ — Caller receives null but nothing tells the user

**Specific stores affected:**

| Store | Silent Failure Methods |
|-------|----------------------|
| `contentLibraryStore` | `saveContentItem` → returns null, `deleteItem` → returns false, `incrementItemUsage` → silent rollback, `saveNewTemplate` → returns null, `deleteTemplateItem` → returns false, `incrementTemplateUsage` → silent rollback, `fetchTags` → silent return |
| `contentItemsStore` | `addItem` → returns null, `updateItem` → returns null, `removeItem` → returns false, `markItemAsUsed` → silent rollback, `markItemAsDraft` → silent rollback |
| `businessProfileStore` | `createProfile` → returns null, `updateProfile` → returns null, `deleteProfile` → returns false, `setAsDefault` → returns null |

**Exception:** `useChatSession` mutations DO use `toast.error()` in `onError` callbacks. This is the correct pattern.

**Fix pattern:** Add `toast.error()` calls to each store method's error path:
```typescript
if (error) {
  set((state) => ({ /* rollback */ }));
  toast.error('Couldn\'t save content item. Please try again.');
  return null;
}
```

Total methods needing toast: ~15 across 3 stores.

---

## SDK Migration Findings

### Vercel AI SDK + Deno Compatibility

**Confidence: MEDIUM** — Proven for `generateText`/`generateObject`, unproven for `streamText` + tools

**What works TODAY on Deno/Supabase Edge Functions:**
- `generate-ai-titles/index.ts`: Uses `generateText` from `https://esm.sh/ai@5.0.102` with `@openrouter/ai-sdk-provider@1.2.8` ✅
- `auto-tag-calls/index.ts`: Uses `generateObject` from `https://esm.sh/ai@5.0.102` with `z` from `https://esm.sh/zod@3.23.8` AND a zod schema ✅

**Critical finding:** `auto-tag-calls` successfully uses `generateObject` with a zod schema (`z.object({ tag: z.enum(...), confidence: z.number(), reasoning: z.string() })`). This means **zod works fine on Deno via esm.sh** — the original `safeParseAsync` error was likely a version mismatch or bundling issue specific to the older setup, not a fundamental incompatibility.

**Import pattern for Deno Edge Functions (proven):**
```typescript
import { createOpenRouter } from 'https://esm.sh/@openrouter/ai-sdk-provider@1.2.8';
import { generateText } from 'https://esm.sh/ai@5.0.102';
import { z } from 'https://esm.sh/zod@3.23.8';
```

**What needs verification (new territory):**
- `streamText()` + `tool()` definitions with zod schemas + `toUIMessageStreamResponse()`
- Multi-step tool execution (the `stopWhen: stepCountIs(N)` pattern)
- Tool result streaming back to client
- `convertToModelMessages()` for UIMessage → ModelMessage conversion

**Risk assessment:** LOW-MEDIUM. The SDK, provider, and zod all work on Deno. The `streamText` function produces a `ReadableStream` response which Deno natively supports. The main risk is an edge case in how `toUIMessageStreamResponse()` constructs the Response object — Deno's `Response` class should be compatible but needs testing.

**Version pinning strategy:** Pin to exact versions used by working Edge Functions:
- `ai@5.0.102` (or newer — `package.json` has `ai@^5.0.113`)
- `@openrouter/ai-sdk-provider@1.2.8`
- `zod@3.23.8` (or `3.25.76` from package.json — test both)

### OpenRouter Provider

**Confidence: HIGH** — Already proven in production

The `@openrouter/ai-sdk-provider` is already used in two Edge Functions:

```typescript
import { createOpenRouter } from 'https://esm.sh/@openrouter/ai-sdk-provider@1.2.8';

function createOpenRouterProvider(apiKey: string) {
  return createOpenRouter({
    apiKey,
    headers: {
      'HTTP-Referer': 'https://app.callvaultai.com',
      'X-Title': 'CallVault',
    },
  });
}

// Usage:
const openrouter = createOpenRouterProvider(apiKey);
const result = await generateText({
  model: openrouter('google/gemini-2.5-flash'),
  // ...
});
```

For `streamText` + tools, the usage would be:
```typescript
const result = streamText({
  model: openrouter('openai/gpt-4o-mini'),  // or any OpenRouter model
  tools: { /* AI SDK tool definitions */ },
  messages: convertedMessages,
  // ...
});
```

**OpenRouter model format:** Already used by frontend — `'openai/gpt-4o-mini'`, `'anthropic/claude-3-5-sonnet'`, etc. No change needed.

### Existing Working Patterns

**From `generate-ai-titles` (proven pattern):**
```typescript
import { createOpenRouter } from 'https://esm.sh/@openrouter/ai-sdk-provider@1.2.8';
import { generateText } from 'https://esm.sh/ai@5.0.102';

const openrouter = createOpenRouterProvider(apiKey);
const result = await generateText({
  model: openrouter('google/gemini-2.5-flash'),
  system: SYSTEM_PROMPT,
  prompt: userPrompt,
  temperature: 0.7,
});
```

**From `auto-tag-calls` (proven with zod schemas):**
```typescript
import { createOpenRouter } from 'https://esm.sh/@openrouter/ai-sdk-provider@1.2.8';
import { generateObject } from 'https://esm.sh/ai@5.0.102';
import { z } from 'https://esm.sh/zod@3.23.8';

const TagSchema = z.object({
  tag: z.enum(APPROVED_TAGS),
  confidence: z.number().min(0).max(100),
  reasoning: z.string(),
});

const result = await generateObject({
  model: openrouter('z-ai/glm-4.6'),
  schema: TagSchema,
  prompt: `...`,
});
```

---

## Migration Strategy

### What Must Be Replicated

1. **All 14 tool definitions** — Convert from OpenAI JSON format to AI SDK `tool()` with zod `inputSchema`
2. **All tool execution handlers** — Same Supabase queries, embeddings, re-ranking, diversity filtering
3. **Hybrid search pipeline** — `generateQueryEmbedding()` + `hybrid_search_transcripts` RPC + re-ranking + diversity
4. **Multi-step tool loop** — AI SDK's `stopWhen: stepCountIs(5)` replaces the manual while loop
5. **System prompt** — All 14 tool descriptions, usage guide, temporal references, filter context
6. **Auth flow** — Supabase JWT verification
7. **Session filters** — Request body filters AND session-based fallback
8. **Message conversion** — UIMessage → model messages (AI SDK provides `convertToModelMessages()`)
9. **SSE protocol** — `toUIMessageStreamResponse()` handles this natively
10. **CORS headers** — Must still be added manually

### What Changes

| Current | New |
|---------|-----|
| Manual OpenAI JSON tool definitions (400 lines) | AI SDK `tool()` with zod schemas (~200 lines) |
| Manual SSE streaming/parsing (~150 lines) | `streamText()` + `toUIMessageStreamResponse()` (~5 lines) |
| Manual multi-step while loop (~50 lines) | `stopWhen: stepCountIs(5)` (1 line) |
| Manual tool call accumulation from deltas | SDK handles tool call parsing natively |
| `convertUIMessagesToOpenAI()` | `convertToModelMessages()` from SDK |
| Manual `data: {...}\n\n` encoding | SDK handles protocol encoding |
| Green checkmark for all states | Three-state: ✅/⚠️/❌ with result counts |
| No inline citations | Numbered inline `[1]` markers + bottom source list |

### What Stays The Same

- **Embedding generation** — Still direct OpenAI API call (OpenRouter doesn't support embeddings)
- **HuggingFace re-ranking** — Same cross-encoder API
- **Diversity filtering** — Same algorithm
- **Supabase queries** — All RPC and table queries stay identical
- **Auth flow** — Same JWT verification pattern
- **System prompt** — Same content, may add query expansion guidance

### Risk Areas

1. **`streamText` + tools on Deno via esm.sh** — MEDIUM RISK. `generateText`/`generateObject` proven, but `streamText` + tools is new territory. Mitigation: Build proof-of-concept first.

2. **`toUIMessageStreamResponse()` on Deno** — LOW-MEDIUM RISK. This returns a Web Standard `Response` object, which Deno supports. But there may be edge cases with how Supabase Edge Functions handle long-running streaming responses. Mitigation: If `toUIMessageStreamResponse()` doesn't work, fall back to `result.fullStream` and manually construct SSE (the current code already does this).

3. **Zod version mismatch** — LOW RISK. Two versions in play: `3.23.8` (esm.sh import) vs `3.25.76` (package.json). The Edge Function uses its own import, so this is isolated. Pin to `3.23.8` for consistency with working Edge Functions.

4. **Tool execution timeout** — MEDIUM RISK. HuggingFace re-ranking adds 1-3s per search. With 6-8 parallel queries (ACQ AI pattern), total time could reach 10-20s. Supabase Edge Functions have a 150-second timeout, so this should be fine, but monitor.

5. **Citation data serialization** — LOW RISK. Tool results already survive JSON round-trip. The key is ensuring `parts` with tool results are stored with enough data for citations to render after page reload. Current `sanitizeParts` in `useChatSession.ts` uses `JSON.parse(JSON.stringify(parts))` which preserves all JSON-serializable data.

6. **Frontend `useChat` compatibility** — LOW RISK. The frontend already uses `useChat` + `DefaultChatTransport` targeting the Supabase URL. Switching to `chat-stream-v2` is just a URL change. The message protocol is identical.

---

## Architecture Patterns

### Recommended Backend Structure (chat-stream-v2)

```
supabase/functions/chat-stream-v2/
  index.ts              # Main handler: auth, request parsing, streamText call
                        # Tool definitions inline (simpler) or imported

supabase/functions/_shared/
  cors.ts               # Already exists
  search-pipeline.ts    # NEW: Extract hybrid search + rerank + diversity
  embeddings.ts         # NEW: Extract embedding generation
```

**Decision point (Claude's discretion):** Single file vs modular. The existing working Edge Functions are single files. Given that the 14 tool execute functions share the same search pipeline, extracting `search-pipeline.ts` makes sense for maintainability. But keep tool definitions in `index.ts` for visibility.

### Recommended Tool Definition Pattern

```typescript
import { streamText, tool, convertToModelMessages, stepCountIs } from 'https://esm.sh/ai@5.0.102';
import { createOpenRouter } from 'https://esm.sh/@openrouter/ai-sdk-provider@1.2.8';
import { z } from 'https://esm.sh/zod@3.23.8';

const tools = {
  searchTranscriptsByQuery: tool({
    description: 'General semantic and keyword search through meeting transcripts...',
    inputSchema: z.object({
      query: z.string().describe('The search query...'),
      limit: z.number().optional().describe('Max results (default: 10)'),
    }),
    execute: async ({ query, limit = 10 }) => {
      return executeHybridSearch(query, limit, supabase, user, openaiApiKey);
    },
  }),
  // ... 13 more tools
};

const result = streamText({
  model: openrouter(selectedModel),
  system: systemPrompt,
  messages: await convertToModelMessages(messages),
  tools,
  toolChoice: 'auto',
  stopWhen: stepCountIs(5),
  onError: ({ error }) => console.error('Stream error:', error),
});

return result.toUIMessageStreamResponse({
  headers: corsHeaders,
});
```

### Tool Call Three-State Pattern

On the frontend, determine state from tool result data:

```typescript
function getToolStatus(toolPart: ToolCallPart): 'success' | 'empty' | 'error' {
  if (toolPart.state === 'output-error' || toolPart.error) return 'error';
  if (toolPart.state !== 'output-available') return 'pending'; // still running
  
  const result = toolPart.result;
  if (!result) return 'empty';
  if (result.error) return 'error';
  if (result.message?.includes('could not find')) return 'empty';
  if (result.results && result.results.length === 0) return 'empty';
  
  return 'success';
}
```

### Citation Pattern

Tool results already contain `recording_id`, `call_title`, `call_date`, `speaker`, `text` per result. For citations:

1. **Backend:** System prompt instructs model to cite sources with `[recording_id]` markers
2. **Frontend:** Parse response text for `[N]` markers, match to tool result data
3. **Storage:** Tool result data in `parts` JSONB column survives reload
4. **Render:** Inline `[N]` badges + bottom source list, both clickable to CallDetailDialog

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSE stream encoding | Manual `data: {...}\n\n` | `streamText().toUIMessageStreamResponse()` | Handles protocol, backpressure, errors |
| Tool call parsing from stream | Manual delta accumulation | AI SDK `tool()` with execute | SDK parses, validates, executes |
| Multi-step tool loop | Manual while loop + message append | `stopWhen: stepCountIs(5)` | SDK manages conversation history |
| Message format conversion | `convertUIMessagesToOpenAI()` | `convertToModelMessages()` | SDK handles UIMessage → ModelMessage |
| Zod schema validation | JSON Schema objects (400 lines) | Zod schemas (~200 lines) | Type inference, validation, better DX |
| Stream protocol compliance | Manual event types | SDK built-in | Protocol updates automatically |

---

## Common Pitfalls

### Pitfall 1: esm.sh Version Drift
**What goes wrong:** Different Edge Functions import different versions, causing subtle type mismatches
**Why it happens:** Each file imports from esm.sh URLs independently
**How to avoid:** Pin EXACT versions in all imports. Use the proven versions: `ai@5.0.102`, `@openrouter/ai-sdk-provider@1.2.8`, `zod@3.23.8`
**Warning signs:** TypeScript errors about incompatible types between imported modules

### Pitfall 2: Tool Execute Context Loss
**What goes wrong:** Tool execute functions can't access supabase client, user, API keys
**Why it happens:** AI SDK tools are defined as plain objects, not closures with access to request context
**How to avoid:** Define tools inside the request handler (closure) OR use `experimental_context` to pass context
**Example:**
```typescript
// Inside Deno.serve handler, after auth:
const tools = {
  searchTranscriptsByQuery: tool({
    // ... schema
    execute: async ({ query, limit }) => {
      // supabase, user, openaiApiKey are available via closure
      return executeSearch(query, limit, supabase, user, openaiApiKey);
    },
  }),
};
```

### Pitfall 3: CORS Headers Not Set on Stream Response
**What goes wrong:** Browser blocks streaming response due to missing CORS headers
**Why it happens:** `toUIMessageStreamResponse()` doesn't know about CORS
**How to avoid:** Pass headers to `toUIMessageStreamResponse({ headers: corsHeaders })` or construct response manually
**Warning signs:** CORS errors in browser console, stream never starts

### Pitfall 4: Citation Data Lost on Reload
**What goes wrong:** Citations show on first render but disappear after page reload
**Why it happens:** Tool result data not properly serialized to database, or parts sanitization strips data
**How to avoid:** Ensure `parts` JSONB column stores full tool output including results array. Test the save → reload cycle early.
**Warning signs:** Reloading a chat shows tool call indicators but no source links

### Pitfall 5: Empty Results Shown as Success
**What goes wrong:** Tool returns `{ message: "I could not find..." }` but UI shows green checkmark
**Why it happens:** Backend returns 200 with a "no results" message — technically successful
**How to avoid:** Check result content, not just HTTP status. A "no results" response needs the ⚠️ amber state.
**Warning signs:** User sees ✅ but response says "I couldn't find anything" — THIS IS THE EXACT BUG BEING FIXED (CHAT-02)

### Pitfall 6: Parallel Tool Execution Timeout
**What goes wrong:** When model fires 6-8 tools (ACQ AI pattern), HuggingFace re-ranking for each causes timeout
**Why it happens:** Each search tool generates embeddings + runs RPC + re-ranks. 6 parallel = 6x the HuggingFace API calls
**How to avoid:** Re-ranking already has individual 1.5s timeout per candidate. But consider disabling re-ranking for parallel queries or using a shared embedding cache.
**Warning signs:** Streaming takes 30+ seconds before first text appears

---

## Code Examples

### Verified: AI SDK Tool Definition with Zod (from auto-tag-calls)
```typescript
// Source: supabase/functions/auto-tag-calls/index.ts
import { generateObject } from 'https://esm.sh/ai@5.0.102';
import { z } from 'https://esm.sh/zod@3.23.8';

const TagSchema = z.object({
  tag: z.enum(APPROVED_TAGS).describe('The SINGLE most appropriate tag'),
  confidence: z.number().min(0).max(100).describe('Confidence score'),
  reasoning: z.string().describe('Why this tag was chosen'),
});

const result = await generateObject({
  model: openrouter('z-ai/glm-4.6'),
  schema: TagSchema,
  prompt: `...`,
});
// result.object.tag, result.object.confidence, result.object.reasoning
```

### Verified: OpenRouter Provider Setup (from generate-ai-titles)
```typescript
// Source: supabase/functions/generate-ai-titles/index.ts
import { createOpenRouter } from 'https://esm.sh/@openrouter/ai-sdk-provider@1.2.8';
import { generateText } from 'https://esm.sh/ai@5.0.102';

function createOpenRouterProvider(apiKey: string) {
  return createOpenRouter({
    apiKey,
    headers: {
      'HTTP-Referer': 'https://app.callvaultai.com',
      'X-Title': 'CallVault',
    },
  });
}

const result = await generateText({
  model: openrouter('google/gemini-2.5-flash'),
  system: SYSTEM_PROMPT,
  prompt: userPrompt,
  temperature: 0.7,
});
```

### Expected: streamText + tools pattern for chat-stream-v2
```typescript
// Based on: Vercel AI SDK official docs + existing patterns
import { streamText, tool, convertToModelMessages, stepCountIs } from 'https://esm.sh/ai@5.0.102';
import { createOpenRouter } from 'https://esm.sh/@openrouter/ai-sdk-provider@1.2.8';
import { z } from 'https://esm.sh/zod@3.23.8';

Deno.serve(async (req) => {
  // ... auth, parse body, get filters ...

  const openrouter = createOpenRouter({ apiKey, headers: { ... } });

  const tools = {
    searchTranscriptsByQuery: tool({
      description: 'General semantic and keyword search...',
      inputSchema: z.object({
        query: z.string().describe('Search query'),
        limit: z.number().optional().describe('Max results'),
      }),
      execute: async ({ query, limit = 10 }) => {
        return await executeHybridSearch(query, limit, supabase, user, openaiApiKey, filters);
      },
    }),
    // ... 13 more tools
  };

  const result = streamText({
    model: openrouter(selectedModel),
    system: systemPrompt,
    messages: await convertToModelMessages(uiMessages),
    tools,
    toolChoice: 'auto',
    stopWhen: stepCountIs(5),
    onError: ({ error }) => console.error('Stream error:', error),
  });

  return result.toUIMessageStreamResponse({
    headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
  });
});
```

### Frontend: Three-State Tool Display
```typescript
// Enhancement to src/components/chat/tool-call.tsx
const statusConfig = {
  pending: { icon: RiLoader4Line, color: 'text-ink-muted', label: 'Pending' },
  running: { icon: RiLoader4Line, color: 'text-blue-500', label: 'Running' },
  success: { icon: RiCheckLine, color: 'text-green-500', label: 'Completed', suffix: '(N results)' },
  empty: { icon: RiAlertLine, color: 'text-amber-500', label: '0 results' },
  error: { icon: RiErrorWarningLine, color: 'text-red-500', label: 'Failed' },
};
```

---

## Key Files

### Backend (to replicate in v2)
| File | Lines | Purpose |
|------|-------|---------|
| `supabase/functions/chat-stream/index.ts` | 1993 | Current monolith — full reference |
| `supabase/functions/generate-ai-titles/index.ts` | 407 | **Proven pattern**: AI SDK + OpenRouter + Deno |
| `supabase/functions/auto-tag-calls/index.ts` | 411 | **Proven pattern**: AI SDK + OpenRouter + Zod + Deno |
| `supabase/functions/_shared/cors.ts` | ~20 | CORS helper (reuse) |
| `supabase/functions/_shared/diversity-filter.ts` | ~30 | May already be extracted |

### Frontend (minimal changes)
| File | Lines | Purpose |
|------|-------|---------|
| `src/pages/Chat.tsx` | 1900+ | Main chat page — transport URL change + tool display |
| `src/hooks/useChatSession.ts` | 376 | Message persistence — no changes needed |
| `src/components/chat/tool-call.tsx` | 144 | Tool call UI — add three-state display |
| `src/components/chat/source.tsx` | 281 | Citation components — enhance for inline citations |
| `src/components/chat/message.tsx` | ~200 | Message rendering — citation marker parsing |

### Stores (STORE-01)
| File | Lines | Methods to Fix |
|------|-------|---------------|
| `src/stores/contentLibraryStore.ts` | 424 | 7 methods need toast.error() |
| `src/stores/contentItemsStore.ts` | 485 | 5 methods need toast.error() |
| `src/stores/businessProfileStore.ts` | 320 | 4 methods need toast.error() |

### Reference
| File | Purpose |
|------|---------|
| `docs/reference/technical-reverse-engineering-report-ACQai.md` | ACQ AI architecture reference |
| `package.json` | Current SDK versions: `ai@^5.0.113`, `@ai-sdk/react@^2.0.102`, `zod@^3.25.76` |

---

## Recommendations for Planner

### Task Ordering (Critical Path)

1. **FIRST: Proof of concept** — Create minimal `chat-stream-v2` Edge Function that uses `streamText()` + `tool()` with ONE simple tool (e.g., `getCallDetails`) and verify it works end-to-end on Deno. This is the single highest-risk item and must be validated before investing in 14 tool definitions. If `toUIMessageStreamResponse()` doesn't work on Deno, the fallback is using `result.fullStream` with manual SSE construction.

2. **SECOND: Extract search pipeline** — Pull `generateQueryEmbedding()`, `rerankResults()`, `diversityFilter()`, `executeHybridSearch()` into a shared module that both `chat-stream` (legacy) and `chat-stream-v2` can use. This is a zero-risk refactor.

3. **THIRD: Define all 14 tools** — Convert OpenAI JSON schemas to zod `inputSchema` + wire execute functions. This is mechanical but substantial work. Each tool needs its zod schema + execute function calling the shared search pipeline.

4. **FOURTH: System prompt + query expansion** — Update the system prompt to encourage multi-query patterns (per ACQ AI reference). This is a prompt engineering concern.

5. **FIFTH: Frontend test path** — Add `/chat2` route that uses `chat-stream-v2` endpoint. Keep `/chat` using `chat-stream` (legacy).

6. **SIXTH: Tool call three-state UI** — Update `tool-call.tsx` to show ✅/⚠️/❌ based on result content.

7. **SEVENTH: Citations** — Add inline `[N]` markers and bottom source list to message rendering.

8. **EIGHTH: STORE-01 fixes** — Add `toast.error()` to all 16 silent failure methods across 3 stores. This is independent and can be parallelized.

9. **NINTH: Streaming error handling** — Toast + partial response preservation + Retry button on stream failure.

10. **TENTH: Switchover** — Once v2 is proven, swap `/chat` to use `chat-stream-v2`. Rename old to `chat-stream-legacy`.

### Parallelization Opportunities

- **STORE-01 fixes** (step 8) are fully independent — can be done in parallel with all other work
- **Tool call three-state UI** (step 6) can be built against existing backend — check result data structure
- **Citation components** (step 7) can be designed/built before backend is complete

### Key Dependencies

- Steps 3-5 depend on step 1 (proof of concept must pass)
- Step 10 depends on steps 1-9 all passing
- Step 2 should happen before step 3 (shared modules before tool definitions)

### Test Strategy

- **Backend E2E test:** Send a known user query to `chat-stream-v2`, verify SSE stream contains tool-input-start → tool-input-available → tool-output-available → text-delta events
- **Frontend integration:** Open `/chat2`, send a query, verify tool calls render with correct states, citations are clickable, and messages persist on reload
- **Regression:** `/chat` (original) must continue working throughout development
- **Store tests:** Trigger error conditions in stores, verify toast notifications appear

---

## Sources

### Primary (HIGH confidence)
- `supabase/functions/chat-stream/index.ts` — Full source code analysis
- `supabase/functions/generate-ai-titles/index.ts` — Working AI SDK + Deno pattern
- `supabase/functions/auto-tag-calls/index.ts` — Working AI SDK + Zod + Deno pattern
- `src/pages/Chat.tsx` — Frontend architecture analysis
- `src/hooks/useChatSession.ts` — Message persistence analysis
- `src/stores/*.ts` — Store error pattern analysis
- `package.json` — Current dependency versions
- Vercel AI SDK official docs (sdk.vercel.ai) — `streamText`, `tool()`, `useChat`, Data Stream Protocol

### Secondary (MEDIUM confidence)
- `docs/reference/technical-reverse-engineering-report-ACQai.md` — ACQ AI architecture patterns
- `.planning/phases/02-chat-foundation/02-CONTEXT.md` — User decisions

### Tertiary (LOW confidence)
- `streamText()` + `tool()` + `toUIMessageStreamResponse()` on Deno — Extrapolated from working patterns but not yet tested in this exact combination

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Already in use, versions verified from source code
- Architecture: HIGH — Direct code analysis of existing implementation
- SDK Migration: MEDIUM — `generateText`/`generateObject` proven, `streamText` + tools extrapolated
- Pitfalls: HIGH — Derived from actual code patterns and known issues
- STORE-01: HIGH — Full store code analyzed, exact methods identified

**Research date:** 2026-01-28
**Valid until:** 2026-02-28 (stable — AI SDK v5 is released, no major changes expected)
