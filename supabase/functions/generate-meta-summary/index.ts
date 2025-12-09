import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createOpenRouter } from 'https://esm.sh/@openrouter/ai-sdk-provider@1.2.8';
import { generateObject } from 'https://esm.sh/ai@5.0.102';
import { z } from 'https://esm.sh/zod@3.23.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
};

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

interface MetaSummaryRequest {
  recording_ids: number[];
  include_transcripts?: boolean;
  focus_areas?: string[];
}

const MetaSummarySchema = z.object({
  executive_summary: z.string().describe('A comprehensive 2-3 paragraph executive summary synthesizing all meetings'),
  key_themes: z.array(z.string()).describe('Main recurring themes across all meetings (3-7 items)'),
  key_decisions: z.array(z.string()).describe('Important decisions made across meetings'),
  action_items: z.array(z.string()).describe('Action items and next steps identified'),
  notable_insights: z.array(z.string()).describe('Key insights, learnings, or revelations from the meetings'),
  participant_highlights: z.array(z.object({
    name: z.string(),
    key_contributions: z.array(z.string()),
  })).describe('Notable contributions from key participants'),
  timeline_summary: z.string().describe('Narrative of how topics/themes evolved across the time period'),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    // Verify authorization
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

    const { recording_ids, include_transcripts = false, focus_areas = [] }: MetaSummaryRequest = await req.json();

    if (!recording_ids || recording_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No recording IDs provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating meta-summary for ${recording_ids.length} meetings for user ${user.id}`);

    // Fetch all calls
    const { data: calls, error: callsError } = await supabase
      .from('fathom_calls')
      .select('recording_id, title, summary, full_transcript, recording_start_time, recording_end_time, calendar_invitees, recorded_by_name, created_at')
      .in('recording_id', recording_ids)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (callsError || !calls || calls.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No calls found or unauthorized' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate total duration
    let totalDurationMinutes = 0;
    for (const call of calls) {
      if (call.recording_start_time && call.recording_end_time) {
        const duration = (new Date(call.recording_end_time).getTime() - new Date(call.recording_start_time).getTime()) / (1000 * 60);
        totalDurationMinutes += Math.round(duration);
      }
    }

    // Build meeting summaries for analysis
    const meetingSummaries = calls.map((call, index) => {
      const date = new Date(call.created_at).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const participants = call.calendar_invitees?.map((inv: {name?: string}) => inv.name).filter(Boolean) || [];
      const duration = call.recording_start_time && call.recording_end_time
        ? Math.round((new Date(call.recording_end_time).getTime() - new Date(call.recording_start_time).getTime()) / (1000 * 60))
        : null;

      let content = `MEETING ${index + 1}: ${call.title}\n`;
      content += `Date: ${date}\n`;
      if (duration) content += `Duration: ${duration} minutes\n`;
      if (call.recorded_by_name) content += `Host: ${call.recorded_by_name}\n`;
      if (participants.length > 0) content += `Participants: ${participants.join(', ')}\n`;
      content += '\n';

      if (call.summary) {
        content += `Summary:\n${call.summary}\n\n`;
      }

      // Include transcript excerpt if requested and available
      if (include_transcripts && call.full_transcript) {
        // Limit transcript to avoid token limits
        const transcriptExcerpt = call.full_transcript.substring(0, 3000);
        content += `Transcript Excerpt:\n${transcriptExcerpt}\n`;
        if (call.full_transcript.length > 3000) {
          content += '... [transcript truncated]\n';
        }
        content += '\n';
      }

      return content;
    }).join('\n---\n\n');

    // Build focus areas context
    const focusContext = focus_areas.length > 0
      ? `\n\nFOCUS AREAS: Pay special attention to these topics:\n${focus_areas.map(a => `- ${a}`).join('\n')}\n`
      : '';

    // Date range
    const startDate = new Date(calls[0].created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const endDate = new Date(calls[calls.length - 1].created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    // Generate meta-summary using OpenRouter (GLM-4.6 via OpenRouter)
    const openrouter = createOpenRouterProvider(openrouterApiKey);

    const result = await generateObject({
      model: openrouter('z-ai/glm-4.6'),
      schema: MetaSummarySchema,
      prompt: `Analyze these ${calls.length} meeting summaries and create a comprehensive meta-summary.

TIME PERIOD: ${startDate} to ${endDate}
TOTAL MEETINGS: ${calls.length}
TOTAL DURATION: ${totalDurationMinutes} minutes
${focusContext}

MEETINGS TO ANALYZE:
${meetingSummaries}

Your task:
1. Create a comprehensive executive summary that synthesizes key points across ALL meetings
2. Identify recurring themes and patterns
3. Extract key decisions that were made
4. List action items and next steps that were identified
5. Note any significant insights or revelations
6. Highlight notable contributions from key participants (if discernible)
7. Describe how topics/themes evolved over time

Be thorough but concise. Focus on what matters most for someone who wants to understand what happened across all these meetings.`,
    });

    console.log(`Meta-summary generated for ${calls.length} meetings`);

    return new Response(
      JSON.stringify({
        success: true,
        meta_summary: result.object,
        meetings_analyzed: calls.length,
        total_duration_minutes: totalDurationMinutes,
        date_range: {
          start: startDate,
          end: endDate,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Meta-summary generation error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
