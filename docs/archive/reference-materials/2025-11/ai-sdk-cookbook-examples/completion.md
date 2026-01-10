---
title: Completion
description: Learn how to use the useCompletion hook.
---

# Completion

Completions allow you to generate text from a prompt in a non-chat context. For example, you might want to generate a blog post from a title, or autocomplete a user's input.

<Note>
  The useCompletion hook is available in the `@ai-sdk/react` package.
</Note>

## Example

```tsx filename='app/page.tsx'
'use client';

import { useCompletion } from '@ai-sdk/react';

export default function Page() {
  const { completion, input, handleInputChange, handleSubmit } =
    useCompletion();

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
        <button type="submit">Submit</button>
      </form>
      <p>{completion}</p>
    </div>
  );
}
```

## API route

```ts filename='app/api/completion/route.ts'
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function POST(req: Request) {
  const { prompt }: { prompt: string } = await req.json();

  const result = streamText({
    model: openai('gpt-4.1'),
    prompt,
  });

  return result.toTextStreamResponse();
}
```

## API Reference

See the [useCompletion API Reference](/docs/reference/ai-sdk-ui/use-completion) for more details.
