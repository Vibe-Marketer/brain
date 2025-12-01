import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createOpenRouter } from 'https://esm.sh/@openrouter/ai-sdk-provider@1.2.8';
import { generateObject } from 'https://esm.sh/ai@5.0.102';
import { z } from 'https://esm.sh/zod@3.23.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// OpenRouter configuration - using official AI SDK v5 provider
function createOpenRouterProvider(apiKey: string) {
  return createOpenRouter({
    apiKey,
    headers: {
      'HTTP-Referer': 'https://conversion.brain',
      'X-Title': 'Conversion Brain',
    },
  });
}

interface GenerateTitlesRequest {
  recordingIds?: number[];
  auto_discover?: boolean;  // Find all calls without AI titles
  limit?: number;           // Max calls to process when auto_discover is true
}

const TitleSchema = z.object({
  title: z.string().describe('A concise, descriptive title for the call (3-8 words max)'),
  tag_hint: z.enum([
    'TEAM', 'COACH_GROUP', 'COACH_1ON1', 'WEBINAR', 'SALES',
    'EXTERNAL', 'DISCOVERY', 'ONBOARDING', 'REFUND', 'FREE',
    'EDUCATION', 'PRODUCT', 'SUPPORT', 'REVIEW', 'STRATEGY', 'SKIP'
  ]).describe('Best-fit tag for this call (controls AI analysis)'),
  key_theme: z.string().describe('The single most important theme/topic (2-4 words)'),
  reasoning: z.string().describe('Brief explanation of why this title was chosen'),
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

    const { recordingIds, auto_discover, limit = 50 }: GenerateTitlesRequest = await req.json();

    let idsToProcess: number[] = [];

    if (auto_discover) {
      // Find all calls without AI-generated titles
      console.log(`Auto-discovering calls without AI titles for user ${user.id} (limit: ${limit})`);

      const { data: callsWithoutTitles, error: discoverError } = await supabase
        .from('fathom_calls')
        .select('recording_id')
        .eq('user_id', user.id)
        .is('ai_generated_title', null)
        .not('full_transcript', 'is', null)  // Must have transcript
        .order('created_at', { ascending: false })
        .limit(limit);

      if (discoverError) {
        return new Response(
          JSON.stringify({ error: `Failed to discover calls: ${discoverError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      idsToProcess = (callsWithoutTitles || []).map(c => c.recording_id);
      console.log(`Found ${idsToProcess.length} calls needing AI titles`);

    } else if (recordingIds && recordingIds.length > 0) {
      idsToProcess = recordingIds;
    } else {
      return new Response(
        JSON.stringify({ error: 'Either recordingIds or auto_discover=true is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (idsToProcess.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No calls to process', totalProcessed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating AI titles for ${idsToProcess.length} calls for user ${user.id}`);

    const results = [];
    // Use OpenRouter for model access
    const openrouter = createOpenRouterProvider(openrouterApiKey);

    for (const recordingId of idsToProcess) {
      try {
        // Fetch call data
        const { data: call, error: callError } = await supabase
          .from('fathom_calls')
          .select('recording_id, title, full_transcript, summary, ai_generated_title')
          .eq('recording_id', recordingId)
          .eq('user_id', user.id)
          .single();

        if (callError || !call) {
          console.error(`Call ${recordingId} not found or unauthorized`);
          results.push({
            recordingId,
            success: false,
            error: 'Call not found or unauthorized',
          });
          continue;
        }

        // Skip if no content
        if (!call.full_transcript && !call.summary) {
          console.log(`Call ${recordingId} has no content to analyze`);
          results.push({
            recordingId,
            success: false,
            error: 'No transcript or summary available',
          });
          continue;
        }

        // Prepare content for AI analysis
        const content = [
          `Current title: ${call.title}`,
          call.summary ? `Summary: ${call.summary}` : '',
          call.full_transcript ? `Transcript excerpt: ${call.full_transcript.substring(0, 2000)}` : '',
        ].filter(Boolean).join('\n\n');

        // Generate improved title using OpenRouter
        const result = await generateObject({
          model: openrouter('z-ai/glm-4.6'),
          schema: TitleSchema,
          prompt: `You are an expert at analyzing sales calls, coaching sessions, and business meetings to extract the CORE PURPOSE and PRIMARY OUTCOME.

CALL CONTENT:
${content}

YOUR TASK:
Generate a title that immediately tells someone what this call was about and why it mattered.

TITLE REQUIREMENTS:
1. 3-8 words MAXIMUM (shorter is better)
2. Lead with the PRIMARY ACTION or OUTCOME, not the format
3. Use this pattern: [Action/Topic] + [Context/Who]
4. Be SPECIFIC - avoid generic words like "Meeting", "Call", "Discussion", "Session"
5. Include company/person name ONLY if it's the main subject

GOOD EXAMPLES:
- "Pricing Objections - Enterprise Deal" (not "Sales Call with John")
- "Scaling Facebook Ads Strategy" (not "Marketing Coaching Session")
- "New Feature Walkthrough for Onboarding" (not "Product Demo")
- "Q4 Revenue Goals & OKRs" (not "Team Meeting")
- "Handling Refund Request - Billing Issue" (not "Support Call")
- "Cold Email Teardown & Optimization" (not "Email Review Session")

BAD EXAMPLES (too generic):
- "Weekly Team Sync" → Instead: "Sprint Planning & Blockers"
- "1:1 with Sarah" → Instead: "Sarah's Pipeline Review"
- "Group Coaching" → Instead: "Objection Handling Workshop"
- "Customer Call" → Instead: "Expansion Opportunity - Acme"

TAG GUIDANCE (controls AI analysis):
- TEAM: Internal meetings, founder syncs, team standups
- COACH_GROUP: Paid group coaching/mastermind (2+ participants)
- COACH_1ON1: One-on-one paid coaching
- SALES: Prospect/closing calls
- DISCOVERY: Pre-sales qualification/triage
- ONBOARDING: Customer onboarding/implementation
- SUPPORT: Tech support, troubleshooting
- PRODUCT: Product demos
- WEBINAR: Large group events
- EXTERNAL: Podcasts, collaborations
- FREE: Free community calls
- EDUCATION: Courses/coaching you attend (as student)
- REVIEW: Testimonials, feedback interviews
- REFUND: Retention/cancellation calls
- STRATEGY: Mission/vision planning

Generate the most descriptive, specific title possible.`,
        });

        const { title: aiTitle, tag_hint, key_theme, reasoning } = result.object;
        console.log(`Generated for ${recordingId}: "${aiTitle}" | Tag: ${tag_hint} | Theme: ${key_theme}`);

        // Update database with AI-generated title and timestamp (use composite key)
        const { error: updateError } = await supabase
          .from('fathom_calls')
          .update({
            ai_generated_title: aiTitle,
            ai_title_generated_at: new Date().toISOString(),
          })
          .eq('recording_id', recordingId)
          .eq('user_id', user.id);

        if (updateError) {
          console.error(`Error updating title for ${recordingId}:`, updateError);
          results.push({
            recordingId,
            success: false,
            error: updateError.message,
          });
        } else {
          // Also apply tag if we have a hint and no existing tag
          const { data: existingTag } = await supabase
            .from('call_tag_assignments')
            .select('id')
            .eq('call_recording_id', recordingId)
            .maybeSingle();

          if (!existingTag && tag_hint) {
            // Look up tag ID
            const { data: tag } = await supabase
              .from('call_tags')
              .select('id')
              .eq('name', tag_hint)
              .maybeSingle();

            if (tag) {
              await supabase
                .from('call_tag_assignments')
                .insert({
                  call_recording_id: recordingId,
                  tag_id: tag.id,
                  user_id: user.id,
                  auto_assigned: true,
                  is_primary: true,
                })
                .onConflict('call_recording_id,tag_id')
                .ignore();
            }
          }

          results.push({
            recordingId,
            success: true,
            originalTitle: call.title,
            aiGeneratedTitle: aiTitle,
            tagHint: tag_hint,
            keyTheme: key_theme,
            reasoning,
          });
        }
      } catch (error) {
        console.error(`Error processing ${recordingId}:`, error);
        results.push({
          recordingId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter(r => r.success).length;

    return new Response(
      JSON.stringify({
        success: true,
        totalProcessed: idsToProcess.length,
        successCount,
        failureCount: idsToProcess.length - successCount,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Generate titles error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
