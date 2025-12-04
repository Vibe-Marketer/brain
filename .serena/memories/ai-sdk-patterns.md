# AI SDK Patterns - Conversion Brain

## Last Updated: 2025-12-04

## Mandatory Stack
- **Vercel AI SDK v5** (`ai`, `@ai-sdk/react`) - Frontend chat hooks
- **OpenRouter** - ALL LLM model routing (300+ models, OpenAI-compatible API)
- **Direct OpenRouter API** - Backend streaming (bypasses AI SDK due to zod/esm.sh bundling issues)
- Default model: `openai/gpt-4o-mini` (cost-efficient default)

## Current Architecture

### Frontend (AI SDK v5)
```typescript
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

const transport = new DefaultChatTransport({
  api: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-stream`,
  headers: {
    Authorization: `Bearer ${session?.access_token}`,
  },
  body: {
    filters: apiFilters,
    model: selectedModel, // Format: 'provider/model-name'
  },
});

const { messages, sendMessage, status } = useChat({ transport });
```

### Backend - Direct OpenRouter API (Supabase Edge Functions)
**IMPORTANT**: We bypass the AI SDK on the backend due to zod bundling issues with esm.sh in Deno.
The error "safeParseAsync is not a function" occurs when tool calls are returned via AI SDK.

```typescript
// Direct OpenRouter streaming (bypasses AI SDK)
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

async function* streamOpenRouterChat(
  apiKey: string,
  model: string,
  messages: OpenAIMessage[],
  systemPrompt: string
): AsyncGenerator<{ type: string; data: unknown }> {
  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://conversionbrain.ai',
      'X-Title': 'Conversion Brain',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      tools,
      tool_choice: 'auto',
      stream: true,
    }),
  });
  
  // Parse SSE stream and yield UI Message Stream Protocol events
  // ... streaming implementation
}
```

### Embeddings (OpenAI Direct - Required)
OpenRouter doesn't support embeddings - use OpenAI directly:
```typescript
const response = await fetch('https://api.openai.com/v1/embeddings', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${openaiApiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'text-embedding-3-small',
    input: text,
  }),
});
```

## Environment Variables
```bash
OPENROUTER_API_KEY=sk-or-v1-xxx  # Required for all LLM chat calls
OPENAI_API_KEY=sk-xxx            # Required for embeddings only
```

## Model Format
OpenRouter uses `provider/model-name` format:
- `openai/gpt-4o-mini` (default)
- `openai/gpt-4o`
- `anthropic/claude-sonnet-4`
- `anthropic/claude-3.5-sonnet`
- `google/gemini-2.0-flash`
- `z-ai/glm-4.6`
- etc.

## Available Providers via OpenRouter (300+ models)
- **OpenAI**: gpt-4o, gpt-4o-mini, o1, o3-mini, gpt-4.1
- **Anthropic**: claude-opus-4, claude-sonnet-4, claude-3.5-sonnet, claude-3.5-haiku
- **Google**: gemini-2.0-flash, gemini-2.5-pro, gemma-3
- **Z.AI**: glm-4.6, glm-4.5
- **xAI**: grok-3, grok-3-mini, grok-4
- **Meta**: llama-3.3-70b, llama-4-maverick, llama-4-scout
- **DeepSeek**: deepseek-v3, deepseek-r1
- **Mistral**: mistral-large, codestral, magistral
- **Qwen**: qwen3-max, qwen3-235b
- **Perplexity**: sonar, sonar-pro
- **Cohere**: command-a, command-r
- **NVIDIA**: nemotron, llama-nemotron
- And 300+ more...

## Model Selector Component
Location: `src/components/chat/model-selector.tsx`
- Fetches available models from `/functions/v1/get-available-models`
- Groups models by provider with color-coded icons
- Passes model ID in OpenRouter format to chat transport

## AI SDK v5 Tool Part States
When parsing tool invocations from message parts:
```typescript
// AI SDK v5 tool part states
'input-streaming'   // Tool is receiving input → UI: 'running'
'input-available'   // Input ready, waiting for output → UI: 'running'
'output-available'  // Tool completed successfully → UI: 'success'
'output-error'      // Tool failed with error → UI: 'error'
```

**IMPORTANT**: Do NOT use legacy states like `'output'`, `'result'`, `'streaming'`.

## Key Files
- `src/pages/Chat.tsx` - Frontend chat with AI SDK useChat hook
- `src/components/chat/model-selector.tsx` - Model selection dropdown
- `supabase/functions/chat-stream/index.ts` - Backend streaming with direct OpenRouter API
- `supabase/functions/get-available-models/index.ts` - Fetches model list from OpenRouter

## Known Issues & Workarounds
1. **AI SDK + zod + esm.sh**: "safeParseAsync is not a function" error on tool calls
   - **Workaround**: Use direct OpenRouter API with native fetch instead of AI SDK on backend
   - Frontend AI SDK works fine (bundled properly by Vite)

2. **Embeddings via OpenRouter**: Not supported
   - **Workaround**: Use OpenAI API directly for embeddings

## Key Rule
**ALWAYS fetch official documentation before implementing new AI features**
- APIs change between versions
- Never assume from memory - verify current patterns
