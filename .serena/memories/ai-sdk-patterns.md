# AI SDK Patterns - Conversion Brain

## Mandatory Stack
- **Vercel AI SDK v5** (`ai`, `@ai-sdk/react`) - ALL AI features
- **OpenRouter** - ALL LLM model routing (OpenAI-compatible API)
- Default model: `z-ai/glm-4.6`

## Frontend Chat Pattern
```typescript
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

const transport = new DefaultChatTransport({
  api: '/api/chat',
});

const { messages, sendMessage, status } = useChat({ transport });
```

## Backend OpenRouter Pattern
```typescript
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

function createOpenRouterProvider(apiKey: string) {
  return createOpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
    headers: {
      'HTTP-Referer': 'https://conversion.brain',
      'X-Title': 'Conversion Brain',
    },
  });
}

const openrouter = createOpenRouterProvider(process.env.OPENROUTER_API_KEY);

const result = await streamText({
  model: openrouter('z-ai/glm-4.6'),
  messages,
});
```

## Embeddings (OpenAI Direct)
OpenRouter doesn't support embeddings - use OpenAI directly:
```typescript
const response = await fetch('https://api.openai.com/v1/embeddings', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
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
OPENROUTER_API_KEY=sk-or-v1-xxx  # Required for LLM calls
OPENAI_API_KEY=sk-xxx            # Required for embeddings only
```

## Available Providers via OpenRouter
- Z.AI: glm-4.6 (default)
- OpenAI: gpt-4o, gpt-4o-mini, o1, o3-mini
- Anthropic: claude-opus-4, claude-sonnet-4, claude-3.5-sonnet
- Google: gemini-2.0-flash, gemini-2.5-pro
- xAI: grok-3-beta, grok-2
- Meta: llama-3.3-70b, llama-3.1-405b
- DeepSeek: deepseek-chat-v3, deepseek-r1
- Mistral: mistral-large, codestral
- 300+ more models

## AI SDK v5 Tool Part States
When parsing tool invocations from message parts, use these correct states:
```typescript
// AI SDK v5 tool part states
'input-streaming'   // Tool is receiving input → UI: 'running'
'input-available'   // Input ready, waiting for output → UI: 'running'
'output-available'  // Tool completed successfully → UI: 'success'
'output-error'      // Tool failed with error → UI: 'error'
```

**IMPORTANT**: Do NOT use legacy states like `'output'`, `'result'`, `'streaming'` - these are incorrect.

## Key Rule
**ALWAYS fetch official documentation before implementing AI features**
- APIs change between versions
- Never assume from memory - verify current patterns
