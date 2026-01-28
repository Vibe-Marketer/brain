// PoC Status: PENDING
// streamText + tool: PENDING
// toUIMessageStreamResponse: PENDING
// Date: 2026-01-28
//
// Purpose: Proof-of-concept Edge Function to verify that streamText() + tool() +
// toUIMessageStreamResponse() works on Deno/Supabase Edge Functions via esm.sh.
// This is the single highest-risk item in the Chat Foundation phase.
//
// If toUIMessageStreamResponse() fails on Deno, fall back to result.fullStream
// with manual SSE construction (see FALLBACK section at bottom of file).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { streamText, tool, convertToModelMessages } from 'https://esm.sh/ai@5.0.102';
import { createOpenRouter } from 'https://esm.sh/@openrouter/ai-sdk-provider@1.2.8';
import { z } from 'https://esm.sh/zod@3.23.8';
import { getCorsHeaders } from '../_shared/cors.ts';

// ============================================
// TYPES
// ============================================

interface RequestBody {
  messages: Array<{
    id: string;
    role: 'user' | 'assistant' | 'system';
    content?: string;
    parts?: Array<{ type: string; text?: string; [key: string]: unknown }>;
    [key: string]: unknown;
  }>;
  model?: string;
  filters?: {
    date_start?: string;
    date_end?: string;
    speakers?: string[];
    categories?: string[];
    recording_ids?: number[];
  };
  sessionId?: string;
}

// ============================================
// OPENROUTER PROVIDER SETUP
// ============================================

function createOpenRouterProvider(apiKey: string) {
  return createOpenRouter({
    apiKey,
    headers: {
      'HTTP-Referer': 'https://app.callvaultai.com',
      'X-Title': 'CallVault',
    },
  });
}

// ============================================
// SYSTEM PROMPT (minimal for PoC)
// ============================================

const SYSTEM_PROMPT = `You are CallVault AI, a helpful assistant that answers questions about the user's meeting transcripts and call recordings.

Use the getCallDetails tool when the user asks about a specific call or wants details about a particular recording.

When you don't have specific data from a tool call, respond helpfully based on what you know. Always be honest about what information you do and don't have access to.

Today's date: ${new Date().toISOString().split('T')[0]}`;

// ============================================
// MAIN HANDLER
// ============================================

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ---- Environment ----
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openrouterApiKey = Deno.env.get('OPENROUTER_API_KEY');

    if (!openrouterApiKey) {
      return new Response(
        JSON.stringify({ error: 'OPENROUTER_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ---- Auth: Verify Supabase JWT ----
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ---- Parse Request Body ----
    const body: RequestBody = await req.json();
    const { messages, model: requestedModel } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Messages array required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const selectedModel = requestedModel || 'openai/gpt-4o-mini';
    console.log(`[chat-stream-v2] User: ${user.id}, Model: ${selectedModel}, Messages: ${messages.length}`);

    // ---- OpenRouter Provider ----
    const openrouter = createOpenRouterProvider(openrouterApiKey);

    // ---- Tool Definitions (single PoC tool) ----
    // Tools are defined inside the handler so execute functions have closure
    // access to supabase client and user context.
    const pocTools = {
      getCallDetails: tool({
        description: 'Get full details of a specific call/meeting by its recording ID. Returns call title, date, duration, speakers, summary, and action items.',
        parameters: z.object({
          recording_id: z.string().describe('The recording ID of the call'),
        }),
        execute: async ({ recording_id }) => {
          console.log(`[chat-stream-v2] Tool getCallDetails called with recording_id: ${recording_id}`);

          // Parse recording_id — model may send it as string or number
          const numericId = parseInt(recording_id, 10);
          if (isNaN(numericId)) {
            return { error: 'Invalid recording_id — must be a number' };
          }

          // Query fathom_calls for the specific recording
          const { data: call, error: callError } = await supabase
            .from('fathom_calls')
            .select('recording_id, title, created_at, recording_start_time, recording_end_time, recorded_by_name, summary, url')
            .eq('recording_id', numericId)
            .eq('user_id', user.id)
            .single();

          if (callError || !call) {
            console.log(`[chat-stream-v2] Call not found: ${numericId}`);
            return { error: 'Call not found or not accessible' };
          }

          // Get speakers from transcripts
          const { data: speakers } = await supabase
            .from('fathom_transcripts')
            .select('speaker_name, speaker_email')
            .eq('recording_id', numericId)
            .eq('user_id', user.id)
            .eq('is_deleted', false);

          const uniqueSpeakers = [
            ...new Set(
              speakers?.map((s: { speaker_name: string | null }) => s.speaker_name).filter(Boolean)
            ),
          ];

          // Calculate duration
          let duration = 'Unknown';
          if (call.recording_start_time && call.recording_end_time) {
            const mins = Math.round(
              (new Date(call.recording_end_time).getTime() -
                new Date(call.recording_start_time).getTime()) /
                60000
            );
            duration = `${mins} minutes`;
          }

          console.log(`[chat-stream-v2] Returning call details for: ${call.title}`);

          return {
            recording_id: call.recording_id,
            title: call.title,
            date: call.created_at,
            duration,
            recorded_by: call.recorded_by_name,
            participants: uniqueSpeakers,
            summary: call.summary || 'No summary available',
            url: call.url,
          };
        },
      }),
    };

    // ---- Convert messages ----
    const convertedMessages = convertToModelMessages(messages);

    // ---- Stream response ----
    const result = streamText({
      model: openrouter(selectedModel),
      system: SYSTEM_PROMPT,
      messages: convertedMessages,
      tools: pocTools,
      toolChoice: 'auto',
      maxSteps: 3,
      onError: ({ error }) => {
        console.error('[chat-stream-v2] Stream error:', error);
      },
    });

    // Primary approach: Use toUIMessageStreamResponse() for native AI SDK v5 protocol
    return result.toUIMessageStreamResponse({
      headers: corsHeaders,
    });

  } catch (error) {
    console.error('[chat-stream-v2] Handler error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ============================================
// FALLBACK: Manual SSE construction from fullStream
// ============================================
// If toUIMessageStreamResponse() doesn't work on Deno, uncomment this section
// and replace the return statement above with: return manualStreamResponse(result, corsHeaders);
//
// async function manualStreamResponse(
//   result: ReturnType<typeof streamText>,
//   corsHeaders: Record<string, string>
// ) {
//   const encoder = new TextEncoder();
//   const messageId = crypto.randomUUID();
//
//   const stream = new ReadableStream({
//     async start(controller) {
//       const send = (data: Record<string, unknown>) => {
//         controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
//       };
//
//       try {
//         send({ type: 'start', messageId });
//         send({ type: 'start-step' });
//
//         let textId = '';
//         let textStarted = false;
//
//         for await (const part of result.fullStream) {
//           switch (part.type) {
//             case 'text-delta': {
//               if (!textStarted) {
//                 textId = crypto.randomUUID();
//                 send({ type: 'text-start', id: textId });
//                 textStarted = true;
//               }
//               send({ type: 'text-delta', id: textId, delta: part.textDelta });
//               break;
//             }
//             case 'tool-call': {
//               if (textStarted) {
//                 send({ type: 'text-end', id: textId });
//                 textStarted = false;
//               }
//               send({
//                 type: 'tool-input-start',
//                 toolCallId: part.toolCallId,
//                 toolName: part.toolName,
//               });
//               send({
//                 type: 'tool-input-available',
//                 toolCallId: part.toolCallId,
//                 toolName: part.toolName,
//                 input: part.args,
//               });
//               break;
//             }
//             case 'tool-result': {
//               send({
//                 type: 'tool-output-available',
//                 toolCallId: part.toolCallId,
//                 output: part.result,
//               });
//               break;
//             }
//             case 'step-finish': {
//               if (textStarted) {
//                 send({ type: 'text-end', id: textId });
//                 textStarted = false;
//               }
//               send({ type: 'finish-step' });
//               send({ type: 'start-step' });
//               textId = '';
//               break;
//             }
//             case 'finish': {
//               if (textStarted) {
//                 send({ type: 'text-end', id: textId });
//                 textStarted = false;
//               }
//               break;
//             }
//             case 'error': {
//               console.error('[chat-stream-v2] Fallback stream error:', part.error);
//               send({ type: 'error', errorText: String(part.error) });
//               break;
//             }
//           }
//         }
//
//         send({ type: 'finish-step' });
//         send({ type: 'finish' });
//         controller.enqueue(encoder.encode('data: [DONE]\n\n'));
//         controller.close();
//       } catch (error) {
//         console.error('[chat-stream-v2] Fallback error:', error);
//         send({
//           type: 'error',
//           errorText: error instanceof Error ? error.message : 'Stream error',
//         });
//         controller.enqueue(encoder.encode('data: [DONE]\n\n'));
//         controller.close();
//       }
//     },
//   });
//
//   return new Response(stream, {
//     headers: {
//       ...corsHeaders,
//       'Content-Type': 'text/event-stream',
//       'Cache-Control': 'no-cache',
//       'Connection': 'keep-alive',
//       'x-vercel-ai-ui-message-stream': 'v1',
//     },
//   });
// }
