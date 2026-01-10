---
title: Deepgram
description: Learn how to use the Deepgram provider for the AI SDK.
---

# Deepgram Provider

[Deepgram](https://deepgram.com/) is a powerful speech recognition platform that offers state-of-the-art transcription capabilities through its API.

## Setup

The Deepgram provider is available via the `@ai-sdk/deepgram` module. You can install it with:

<Tabs items={['pnpm', 'npm', 'yarn', 'bun']}>
  <Tab>
    <Snippet text="pnpm add @ai-sdk/deepgram" dark />
  </Tab>
  <Tab>
    <Snippet text="npm install @ai-sdk/deepgram" dark />
  </Tab>
  <Tab>
    <Snippet text="yarn add @ai-sdk/deepgram" dark />
  </Tab>
  <Tab>
    <Snippet text="bun add @ai-sdk/deepgram" dark />
  </Tab>
</Tabs>

## Provider Instance

You can import the default provider instance `deepgram` from `@ai-sdk/deepgram`:

```ts
import { deepgram } from '@ai-sdk/deepgram';
```

If you need a customized setup, you can import `createDeepgram` from `@ai-sdk/deepgram` and create a provider instance with your settings:

```ts
import { createDeepgram } from '@ai-sdk/deepgram';

const deepgram = createDeepgram({
  // custom settings, e.g.
  fetch: customFetch,
});
```

You can use the following optional settings to customize the Deepgram provider instance:

- **apiKey** _string_

  API key that is being sent using the `Authorization` header.
  It defaults to the `DEEPGRAM_API_KEY` environment variable.

- **headers** _Record&lt;string,string&gt;_

  Custom headers to include in the requests.

- **fetch** _(input: RequestInfo, init?: RequestInit) => Promise&lt;Response&gt;_

  Custom [fetch](https://developer.mozilla.org/en-US/docs/Web/API/fetch) implementation.
  Defaults to the global `fetch` function.
  You can use it as a middleware to intercept requests,
  or to provide a custom fetch implementation for e.g. testing.

## Transcription Models

You can create models that call the [Deepgram transcription API](https://developers.deepgram.com/docs/getting-started-with-pre-recorded-audio)
using the `.transcription()` factory method.

The first argument is the model id e.g. `nova-2`.

```ts
const model = deepgram.transcription('nova-2');
```

You can also pass additional provider-specific options using the `providerOptions` argument.

```ts
import { experimental_transcribe as transcribe } from 'ai';
import { deepgram } from '@ai-sdk/deepgram';
import { readFile } from 'fs/promises';

const result = await transcribe({
  model: deepgram.transcription('nova-2'),
  audio: await readFile('audio.mp3'),
  providerOptions: { deepgram: { language: 'en' } },
});
```

The following provider options are available:

- **audioStartAt** _number_

  Start time of the audio in milliseconds.
  Optional.

- **audioEndAt** _number_

  End time of the audio in milliseconds.
  Optional.

- **language** _string_

  BCP-47 language tag that hints at the primary spoken language.
  Optional.

- **smart_format** _boolean_

  Whether to apply additional formatting to improve readability.
  Optional.

- **punctuate** _boolean_

  Whether to add punctuation to the transcript.
  Optional.

- **diarize** _boolean_

  Whether to identify different speakers in the audio.
  Optional.

- **paragraphs** _boolean_

  Whether to split the transcript into paragraphs.
  Optional.

- **utterances** _boolean_

  Whether to split the transcript into utterances.
  Optional.

- **detect_topics** _boolean_

  Whether to detect topics in the transcript.
  Optional.

- **detect_entities** _boolean_

  Whether to detect entities in the transcript.
  Optional.

- **summarize** _boolean or string_

  Whether to generate a summary. Can be `true` or a string like 'v2'.
  Optional.

### Model Capabilities

| Model    | Transcription       | Duration            | Segments            | Language            |
| -------- | ------------------- | ------------------- | ------------------- | ------------------- |
| `nova-2` | <Check size={18} /> | <Check size={18} /> | <Check size={18} /> | <Check size={18} /> |
| `nova`   | <Check size={18} /> | <Check size={18} /> | <Check size={18} /> | <Check size={18} /> |
| `base`   | <Check size={18} /> | <Check size={18} /> | <Check size={18} /> | <Check size={18} /> |

<Note>
  For a complete list of available models, see the [Deepgram
  models page](https://developers.deepgram.com/docs/model).
</Note>
