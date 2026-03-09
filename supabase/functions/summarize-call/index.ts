/**
 * SUMMARIZE-CALL EDGE FUNCTION
 *
 * AI-powered call summarization using OpenRouter (Vercel AI SDK).
 * Part of the automation engine action system (run_ai_analysis: 'summarize').
 *
 * Features:
 * - Uses Vercel AI SDK v5 with OpenRouter provider
 * - Structured output via Zod schemas
 * - Database caching in fathom_calls.summary column
 * - User ownership verification via RLS
 *
 * Endpoints:
 * - POST /functions/v1/summarize-call
 *   Body: { recording_id: number|string, organization_id?: string, force_refresh?: boolean }
 *   Returns: { success, summary, cached, summarized_at }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createOpenRouter } from 'https://esm.sh/@openrouter/ai-sdk-provider@1.2.8';
import { generateText } from 'https://esm.sh/ai@5.0.102';
import { z } from 'https://esm.sh/zod@3.23.8';
import { getCorsHeaders } from '../_shared/cors.ts';
import { startTrace, flushLangfuse } from '../_shared/langfuse.ts';

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

// Request schema — accepts both legacy BIGINT recording IDs and UUID-based IDs
// (UUIDs are used for recordings created via split or the new recordings table)
const RequestSchema = z.object({
  recording_id: z.union([
    z.number().int().positive('recording_id must be a positive integer'),
    z.string().uuid('recording_id must be a UUID or a positive integer'),
  ]),
  organization_id: z.string().uuid('organization_id must be a valid UUID').optional(),
  force_refresh: z.boolean().optional().default(false),
});

// Type for request body
type SummarizeRequest = z.infer<typeof RequestSchema>;

/**
 * Generate a summary using AI
 */
async function generateSummary(
  transcript: string,
  callTitle: string,
  openrouter: ReturnType<typeof createOpenRouter>
): Promise<string> {
  // Limit transcript to first 15k characters for performance
  const limitedTranscript = transcript.length > 15000
    ? transcript.substring(0, 15000) + '\n\n[Transcript truncated for summarization...]'
    : transcript;

  const result = await generateText({
    model: openrouter('openai/gpt-5-nano'),
    prompt: `Summarize this meeting/call transcript in 3-5 concise paragraphs.

Meeting Title: ${callTitle || 'Unknown'}

Focus on:
- Key topics discussed
- Important decisions made
- Action items or next steps mentioned
- Any notable insights or outcomes

Keep the summary professional and factual. Use bullet points for action items if any were mentioned.

Transcript:
${limitedTranscript}

Provide a clear, well-structured summary:`,
    maxTokens: 1000,
  });

  return result.text;
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

    const { recording_id, organization_id: organizationId, force_refresh } = validation.data as SummarizeRequest;
    const isUuid = typeof recording_id === 'string';

    // Warn if organization_id is missing (backwards compat — will be required in future)
    if (!organizationId) {
      console.warn(
        `[summarize-call] organization_id not provided by user ${user.id} for recording ${recording_id}. ` +
        'This will be required in a future release.'
      );
    }

    // If organization_id was provided, verify the user is a member
    if (organizationId) {
      const { data: membership, error: memberError } = await supabase
        .from('organization_memberships')
        .select('id')
        .eq('user_id', user.id)
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (memberError || !membership) {
        return new Response(
          JSON.stringify({ error: 'Not a member of this organization' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Fetch the call — UUID-based recordings use the `recordings` table;
    // legacy BIGINT IDs use `fathom_raw_calls`.
    let callTitle = '';
    let fullTranscript = '';
    let currentSummary: string | null = null;
    let summaryEditedByUser = false;

    if (isUuid) {
      // Build query with organization_id filter when available
      let recQuery = supabase
        .from('recordings')
        .select('id, title, full_transcript, summary, owner_user_id, organization_id')
        .eq('id', recording_id);

      if (organizationId) {
        recQuery = recQuery.eq('organization_id', organizationId);
      }

      const { data: rec, error: recError } = await recQuery.single();

      if (recError || !rec) {
        return new Response(
          JSON.stringify({ error: 'Recording not found or unauthorized' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify user has access: either owns the recording or is an org member
      if (rec.owner_user_id !== user.id) {
        // If no org_id was passed, verify membership via the recording's own org
        if (!organizationId) {
          const { data: orgMembership } = await supabase
            .from('organization_memberships')
            .select('id')
            .eq('user_id', user.id)
            .eq('organization_id', rec.organization_id)
            .maybeSingle();

          if (!orgMembership) {
            return new Response(
              JSON.stringify({ error: 'Recording not found or unauthorized' }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
        // If organizationId was provided, membership was already verified above
      }

      callTitle = rec.title || '';
      fullTranscript = rec.full_transcript || '';
      currentSummary = rec.summary || null;
      summaryEditedByUser = false; // recordings table has no summary_edited_by_user flag
    } else {
      // Legacy path: fathom_raw_calls uses user_id for ownership
      const { data: call, error: callError } = await supabase
        .from('fathom_raw_calls')
        .select('recording_id, title, full_transcript, summary, summary_edited_by_user, canonical_recording_id')
        .eq('recording_id', recording_id)
        .eq('user_id', user.id)
        .single();

      if (callError || !call) {
        return new Response(
          JSON.stringify({ error: 'Recording not found or unauthorized' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // If organization_id was provided, verify the recording belongs to that org
      // by checking via the canonical recordings table
      if (organizationId && call.canonical_recording_id) {
        const { data: canonicalRec } = await supabase
          .from('recordings')
          .select('id')
          .eq('id', call.canonical_recording_id)
          .eq('organization_id', organizationId)
          .maybeSingle();

        if (!canonicalRec) {
          return new Response(
            JSON.stringify({ error: 'Recording not found or unauthorized' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      callTitle = call.title || '';
      fullTranscript = call.full_transcript || '';
      currentSummary = call.summary || null;
      summaryEditedByUser = call.summary_edited_by_user || false;
    }

    // Check if we already have a summary (and respect user edits unless force_refresh)
    if (!force_refresh && currentSummary) {
      // If user has edited the summary, never overwrite
      if (summaryEditedByUser) {
        return new Response(
          JSON.stringify({
            success: true,
            recording_id,
            summary: currentSummary,
            cached: true,
            user_edited: true,
            message: 'Summary was edited by user and will not be regenerated',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Return cached summary
      return new Response(
        JSON.stringify({
          success: true,
          recording_id,
          summary: currentSummary,
          cached: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate transcript exists
    if (!fullTranscript || fullTranscript.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'No transcript available for this recording' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate summary using AI
    const openrouter = createOpenRouterProvider(openrouterApiKey);

    // Start Langfuse trace
    const trace = startTrace({
      name: 'summarize-call',
      userId: user.id,
      model: 'openai/gpt-5-nano',
      input: { title: callTitle, transcriptLength: fullTranscript.length },
      metadata: { recording_id },
    });

    let summary: string;
    try {
      summary = await generateSummary(fullTranscript, callTitle, openrouter);
      await trace?.end(summary);
    } catch (error) {
      await trace?.end(null, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }

    // Store the summary back in the appropriate table
    if (isUuid) {
      let updateQuery = supabase
        .from('recordings')
        .update({ summary })
        .eq('id', recording_id);

      if (organizationId) {
        updateQuery = updateQuery.eq('organization_id', organizationId);
      }

      const { error: updateError } = await updateQuery;

      if (updateError) {
        console.error('Failed to store summary in recordings:', updateError);
      }
    } else {
      const { error: updateError } = await supabase
        .from('fathom_raw_calls')
        .update({ summary })
        .eq('recording_id', recording_id)
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Failed to store summary in fathom_raw_calls:', updateError);
      }
    }

    // Flush Langfuse traces before response
    await flushLangfuse();

    return new Response(
      JSON.stringify({
        success: true,
        recording_id,
        summary,
        cached: false,
        summarized_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Summarize-call error:', error);
    await flushLangfuse();
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
