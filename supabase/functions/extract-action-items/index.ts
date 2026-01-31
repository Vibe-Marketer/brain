/**
 * EXTRACT-ACTION-ITEMS EDGE FUNCTION
 *
 * AI-powered action items extraction using OpenRouter (Vercel AI SDK).
 * Part of the automation engine action system (run_ai_analysis: 'extract_action_items').
 *
 * Features:
 * - Uses Vercel AI SDK v5 with OpenRouter provider
 * - Structured output via Zod schemas for reliable JSON parsing
 * - Extracts tasks, assignees (if mentioned), and due dates (if mentioned)
 * - User ownership verification via RLS
 *
 * Endpoints:
 * - POST /functions/v1/extract-action-items
 *   Body: { recording_id: number }
 *   Returns: { success, action_items: Array<{ task, assignee?, due_date? }>, extracted_at }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createOpenRouter } from 'https://esm.sh/@openrouter/ai-sdk-provider@1.2.8';
import { generateObject } from 'https://esm.sh/ai@5.0.102';
import { z } from 'https://esm.sh/zod@3.23.8';
import { getCorsHeaders } from '../_shared/cors.ts';

// OpenRouter configuration - using official AI SDK v5 provider
function createOpenRouterProvider(apiKey: string) {
  return createOpenRouter({
    apiKey,
    headers: {
      'HTTP-Referer': 'https://app.callvaultai.com',
      'X-Title': 'CallVault',
    },
  });
}

// Request schema
const RequestSchema = z.object({
  recording_id: z.number().int().positive('recording_id must be a positive integer'),
});

// Action item schema for structured output
const ActionItemSchema = z.object({
  task: z.string().describe('The action item or task that needs to be done'),
  assignee: z.string().optional().describe('The person responsible for the task, if mentioned'),
  due_date: z.string().optional().describe('The deadline or timeframe mentioned, if any (e.g., "next week", "by Friday", "end of month")'),
});

// Response schema for structured output
const ActionItemsResponseSchema = z.object({
  action_items: z.array(ActionItemSchema).describe('List of action items extracted from the transcript'),
});

// Type for request body
type ExtractRequest = z.infer<typeof RequestSchema>;

// Type for action items
type ActionItem = z.infer<typeof ActionItemSchema>;

/**
 * Extract action items using AI with structured output
 */
async function extractActionItems(
  transcript: string,
  callTitle: string,
  openrouter: ReturnType<typeof createOpenRouter>
): Promise<ActionItem[]> {
  // Limit transcript to first 15k characters for performance
  const limitedTranscript = transcript.length > 15000
    ? transcript.substring(0, 15000) + '\n\n[Transcript truncated for extraction...]'
    : transcript;

  const result = await generateObject({
    model: openrouter('anthropic/claude-3-haiku-20240307'),
    schema: ActionItemsResponseSchema,
    prompt: `Extract all action items, tasks, and to-dos from this meeting/call transcript.

Meeting Title: ${callTitle || 'Unknown'}

For each action item, identify:
1. TASK: The specific action that needs to be done (be concise but complete)
2. ASSIGNEE: Who is responsible (if explicitly mentioned in the transcript)
3. DUE DATE: Any deadline or timeframe mentioned (e.g., "by Friday", "next week", "end of Q1")

Guidelines:
- Only extract explicit action items mentioned in the conversation
- Include tasks like "I'll send you...", "We need to...", "Can you...", "Let's schedule..."
- Don't infer or create action items that weren't discussed
- If no action items are found, return an empty array
- Keep task descriptions concise but actionable
- Only include assignee/due_date if explicitly mentioned

Transcript:
${limitedTranscript}

Extract all action items:`,
  });

  return result.object.action_items;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Environment setup
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openrouterApiKey = Deno.env.get('OPENROUTER_API_KEY');

    if (!openrouterApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenRouter API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validation = RequestSchema.safeParse(body);
    if (!validation.success) {
      const errorMessage = validation.error.errors[0]?.message || 'Invalid input';
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { recording_id } = validation.data;

    // Fetch the call - verify user ownership
    const { data: call, error: callError } = await supabase
      .from('fathom_calls')
      .select('recording_id, title, full_transcript')
      .eq('recording_id', recording_id)
      .eq('user_id', user.id)
      .single();

    if (callError || !call) {
      return new Response(
        JSON.stringify({ error: 'Recording not found or unauthorized' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate transcript exists
    if (!call.full_transcript || call.full_transcript.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'No transcript available for this recording' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract action items using AI
    const openrouter = createOpenRouterProvider(openrouterApiKey);
    const action_items = await extractActionItems(call.full_transcript, call.title || '', openrouter);

    return new Response(
      JSON.stringify({
        success: true,
        recording_id,
        action_items,
        action_items_count: action_items.length,
        extracted_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Extract-action-items error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
