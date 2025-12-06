---
title: Groq
description: Learn how to use Groq with the Vercel AI SDK.
---

# Groq Provider

Groq is an AI solutions company focused on ultra-low latency inference with their Language Processing Unit (LPU) technology. The Groq provider enables integration with Groq's high-performance API through the AI SDK.

## Setup

The Groq provider is available via the `@ai-sdk/groq` module. You can install it with:

```bash
npm install @ai-sdk/groq
```

## Provider Instance

You can import the default provider instance `groq` from `@ai-sdk/groq`:

```typescript
import { groq } from '@ai-sdk/groq';
```

If you need a customized setup, you can import `createGroq` from `@ai-sdk/groq` and create a provider instance with your settings:

```typescript
import { createGroq } from '@ai-sdk/groq';

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});
```

You can use the following optional settings to customize the Groq provider instance:

- **baseURL** _string_

  Use a different URL prefix for API calls, e.g. to use proxy servers.
  The default prefix is `https://api.groq.com/openai/v1`.

- **apiKey** _string_

  API key that is being sent using the `Authorization` header.
  It defaults to the `GROQ_API_KEY` environment variable.

- **headers** _Record&lt;string,string&gt;_

  Custom headers to include in the requests.

## Language Models

You can create Groq language models using a provider instance. The first argument is the model id, for example `llama-3.3-70b-versatile`.

```typescript
import { groq } from '@ai-sdk/groq';

const model = groq('llama-3.3-70b-versatile');
```

You can use Groq language models to generate text with the `generateText` function:

```typescript
import { groq } from '@ai-sdk/groq';
import { generateText } from 'ai';

const { text } = await generateText({
  model: groq('llama-3.3-70b-versatile'),
  prompt: 'Write a vegetarian lasagna recipe for 4 people.',
});
```

Groq language models can also be used in the `streamText` function (see [AI SDK Core](/docs/ai-sdk-core)).

### Example: Streaming Text

```typescript
import { groq } from '@ai-sdk/groq';
import { streamText } from 'ai';

const result = streamText({
  model: groq('llama-3.3-70b-versatile'),
  prompt: 'Invent a new holiday and describe its traditions.',
});

for await (const textPart of result.textStream) {
  process.stdout.write(textPart);
}
```

### Model Capabilities

| Model                          | Tool Usage | Tool Streaming | Object Generation |
| ------------------------------ | ---------- | -------------- | ----------------- |
| `llama-3.3-70b-versatile`      | ✓          | ✓              | ✓                 |
| `llama-3.1-70b-versatile`      | ✓          | ✓              | ✓                 |
| `llama-3.1-8b-instant`         | ✓          | ✓              | ✓                 |
| `mixtral-8x7b-32768`           | ✓          | ✓              | ✓                 |
| `gemma2-9b-it`                 | ✓          | ✓              | ✓                 |

Please see the [Groq documentation](https://console.groq.com/docs/models) for a full list of available models.

## Performance Features

Groq's LPU technology provides:

- Ultra-low latency inference (typically &lt;100ms for first token)
- High throughput for batch processing
- Consistent performance across model sizes
- Cost-effective pricing structure

## Best Practices

When using Groq with the AI SDK:

1. **Leverage streaming** - Take advantage of Groq's fast first-token latency by using `streamText` for better UX
2. **Choose appropriate models** - Use `llama-3.1-8b-instant` for speed-critical applications, larger models for complex tasks
3. **Handle rate limits** - Implement proper retry logic and respect API rate limits
4. **Monitor usage** - Track token consumption to optimize costs

## Additional Resources

- [Groq Console](https://console.groq.com)
- [Groq Documentation](https://console.groq.com/docs)
- [AI SDK Documentation](/docs)
