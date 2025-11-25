import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createOpenAI } from 'https://esm.sh/@ai-sdk/openai@1';
import { generateObject } from 'https://esm.sh/ai@4';
import { z } from 'https://esm.sh/zod@3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateTitlesRequest {
  recordingIds: number[];
}

const TitleSchema = z.object({
  title: z.string().describe('A concise, descriptive title for the call (5-10 words max)'),
  reasoning: z.string().describe('Brief explanation of why this title was chosen'),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;

    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
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

    const { recordingIds }: GenerateTitlesRequest = await req.json();

    if (!recordingIds || recordingIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No recording IDs provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating AI titles for ${recordingIds.length} calls for user ${user.id}`);

    const results = [];
    const openai = createOpenAI({ apiKey: openaiApiKey });

    for (const recordingId of recordingIds) {
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

        // Generate improved title using Vercel AI SDK
        const result = await generateObject({
          model: openai('gpt-4o-mini'),
          schema: TitleSchema,
          prompt: `Analyze this meeting call and generate a concise, descriptive title that captures the main purpose and topics discussed.

Requirements:
- 5-10 words maximum
- Clear and professional
- Action-oriented when possible (e.g., "Q4 Sales Review", "Product Roadmap Planning", "Customer Onboarding - Acme Corp")
- Should be more descriptive than the original title if it's generic
- Include key participants or companies if mentioned prominently

Meeting Content:
${content}

Generate an improved title for this call.`,
        });

        const aiTitle = result.object.title;
        console.log(`Generated title for ${recordingId}: "${aiTitle}" (${result.object.reasoning})`);

        // Update database
        const { error: updateError } = await supabase
          .from('fathom_calls')
          .update({
            ai_generated_title: aiTitle,
          })
          .eq('recording_id', recordingId);

        if (updateError) {
          console.error(`Error updating title for ${recordingId}:`, updateError);
          results.push({
            recordingId,
            success: false,
            error: updateError.message,
          });
        } else {
          results.push({
            recordingId,
            success: true,
            originalTitle: call.title,
            aiGeneratedTitle: aiTitle,
            reasoning: result.object.reasoning,
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
        totalProcessed: recordingIds.length,
        successCount,
        failureCount: recordingIds.length - successCount,
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
