// Langfuse Tracing Utility for Supabase Edge Functions
// Provides observability for LLM calls via PromptForge infrastructure
//
// Environment variables required:
// - LANGFUSE_PUBLIC_KEY
// - LANGFUSE_SECRET_KEY
// - LANGFUSE_URL (defaults to https://langfuse.pushthefknbutton.com)

import { Langfuse } from 'https://esm.sh/langfuse@3.34.1';

// Singleton Langfuse client - initialized lazily
let langfuseClient: Langfuse | null = null;

/**
 * Get or create the Langfuse client singleton.
 * Returns null if credentials aren't configured (graceful degradation).
 */
export function getLangfuse(): Langfuse | null {
  if (langfuseClient) return langfuseClient;

  const publicKey = Deno.env.get('LANGFUSE_PUBLIC_KEY');
  const secretKey = Deno.env.get('LANGFUSE_SECRET_KEY');
  const baseUrl = Deno.env.get('LANGFUSE_URL') || 'https://langfuse.pushthefknbutton.com';

  if (!publicKey || !secretKey) {
    console.warn('[langfuse] Missing LANGFUSE_PUBLIC_KEY or LANGFUSE_SECRET_KEY - tracing disabled');
    return null;
  }

  langfuseClient = new Langfuse({
    publicKey,
    secretKey,
    baseUrl,
    // Flush events before Deno function terminates
    flushAt: 1,
    flushInterval: 100,
  });

  console.log(`[langfuse] Initialized with baseUrl: ${baseUrl}`);
  return langfuseClient;
}

/**
 * Trace a chat completion request.
 * Creates a trace with generation span for the LLM call.
 */
export interface ChatTraceParams {
  userId: string;
  sessionId?: string;
  model: string;
  systemPrompt: string;
  messages: Array<{ role: string; content: string | unknown }>;
  metadata?: Record<string, unknown>;
}

export interface ChatTraceResult {
  traceId: string;
  generationId: string;
  endGeneration: (output: string, usage?: { promptTokens?: number; completionTokens?: number }) => void;
  endTrace: () => Promise<void>;
}

/**
 * Start tracing a chat request.
 * Returns handles to end the generation and trace when complete.
 */
export function startChatTrace(params: ChatTraceParams): ChatTraceResult | null {
  const langfuse = getLangfuse();
  if (!langfuse) {
    return null;
  }

  const { userId, sessionId, model, systemPrompt, messages, metadata } = params;

  // Create main trace
  const trace = langfuse.trace({
    name: 'chat-stream-v2',
    userId,
    sessionId,
    metadata: {
      model,
      messageCount: messages.length,
      ...metadata,
    },
  });

  // Create generation span
  const generation = trace.generation({
    name: 'llm-generation',
    model,
    input: {
      system: systemPrompt,
      messages,
    },
    modelParameters: {
      maxSteps: 5,
      toolChoice: 'auto',
    },
  });

  return {
    traceId: trace.id,
    generationId: generation.id,
    endGeneration: (output: string, usage?: { promptTokens?: number; completionTokens?: number }) => {
      generation.end({
        output,
        usage: usage ? {
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: (usage.promptTokens || 0) + (usage.completionTokens || 0),
        } : undefined,
      });
    },
    endTrace: async () => {
      // Flush to ensure events are sent before function terminates
      await langfuse.flushAsync();
    },
  };
}

/**
 * Log a tool call within a trace.
 */
export function logToolCall(
  traceId: string,
  toolName: string,
  input: unknown,
  output: unknown,
  durationMs: number,
): void {
  const langfuse = getLangfuse();
  if (!langfuse) return;

  // Create a span for the tool call
  const span = langfuse.span({
    traceId,
    name: `tool:${toolName}`,
    input,
    output,
    metadata: {
      durationMs,
      toolName,
    },
  });
  span.end();
}

/**
 * Add a score to a trace (e.g., user feedback).
 */
export function scoreTrace(
  traceId: string,
  name: string,
  value: number,
  comment?: string,
): void {
  const langfuse = getLangfuse();
  if (!langfuse) return;

  langfuse.score({
    traceId,
    name,
    value,
    comment,
  });
}

/**
 * Flush all pending events to Langfuse.
 * Call this before the edge function terminates.
 */
export async function flushLangfuse(): Promise<void> {
  const langfuse = getLangfuse();
  if (!langfuse) return;

  try {
    await langfuse.flushAsync();
  } catch (error) {
    console.error('[langfuse] Flush error:', error);
  }
}
