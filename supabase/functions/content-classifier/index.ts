/**
 * Content Classifier (Agent 1)
 *
 * Classifies call transcripts and determines if they should be mined for content.
 * Returns classification result with call_type, stage, outcome, and content potential scores.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { startTrace, flushLangfuse } from '../_shared/langfuse.ts';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_MODEL = 'openai/gpt-5-nano';

interface ClassificationRequest {
  recording_id: number;
  model?: string;
}

interface ClassificationResult {
  call_type: 'sales' | 'onboarding' | 'coaching' | 'support' | 'other';
  stage: 'top' | 'middle' | 'bottom' | 'n/a';
  outcome: 'closed' | 'no' | 'maybe' | 'existing_client' | 'n/a';
  emotional_intensity: number;
  content_potential: number;
  mine_for_content: boolean;
  notes?: string;
}

async function classifyCall(
  transcript: string,
  title: string,
  apiKey: string,
  model: string
): Promise<ClassificationResult> {
  const systemPrompt = `You are a content classification expert for sales and business calls.

Analyze the call transcript and provide a JSON classification with:
1. call_type: "sales" | "onboarding" | "coaching" | "support" | "other"
2. stage: "top" (discovery) | "middle" (demo/negotiation) | "bottom" (closing) | "n/a"
3. outcome: "closed" (deal won) | "no" (rejected) | "maybe" (follow-up needed) | "existing_client" | "n/a"
4. emotional_intensity: 1-5 (how emotionally charged was the conversation)
5. content_potential: 1-5 (how valuable for content creation - stories, insights, objections)
6. mine_for_content: true if content_potential >= 3
7. notes: brief explanation of the classification

Focus on identifying:
- Clear emotional moments (frustration, excitement, breakthroughs)
- Interesting objections or concerns raised
- Compelling stories or analogies shared
- Expert insights or frameworks discussed

Return ONLY valid JSON, no markdown.`;

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://app.callvaultai.com',
      'X-Title': 'CallVault Content Classifier',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Call Title: ${title}\n\nTranscript:\n${transcript.substring(0, 30000)}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('No response from model');
  }

  return JSON.parse(content) as ClassificationResult;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openrouterApiKey = Deno.env.get('OPENROUTER_API_KEY');

    if (!openrouterApiKey) {
      throw new Error('OPENROUTER_API_KEY not configured');
    }

    // Auth
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

    // Parse request
    const body: ClassificationRequest = await req.json();
    const { recording_id, model = DEFAULT_MODEL } = body;

    if (!recording_id) {
      return new Response(
        JSON.stringify({ error: 'recording_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get call details
    const { data: call, error: callError } = await supabase
      .from('fathom_calls')
      .select('title, summary')
      .eq('recording_id', recording_id)
      .eq('user_id', user.id)
      .single();

    if (callError || !call) {
      return new Response(
        JSON.stringify({ error: 'Call not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get transcript chunks
    const { data: chunks, error: chunksError } = await supabase
      .from('transcript_chunks')
      .select('chunk_text, speaker_name')
      .eq('recording_id', recording_id)
      .eq('user_id', user.id)
      .order('chunk_index');

    if (chunksError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch transcript' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build transcript text
    const transcript = chunks
      .map((c: { speaker_name: string | null; chunk_text: string }) =>
        c.speaker_name ? `${c.speaker_name}: ${c.chunk_text}` : c.chunk_text
      )
      .join('\n');

    // Start Langfuse trace
    const trace = startTrace({
      name: 'content-classifier',
      userId: user.id,
      model,
      input: { title: call.title, transcriptLength: transcript?.length || 0 },
      metadata: { recording_id },
    });

    // Classify the call
    let result;
    try {
      result = await classifyCall(
        transcript || call.summary || '',
        call.title,
        openrouterApiKey,
        model
      );
      await trace?.end(result);
    } catch (error) {
      await trace?.end(null, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }

    console.log(`Classified call ${recording_id}: ${result.call_type}, content_potential=${result.content_potential}`);

    // Flush Langfuse traces before response
    await flushLangfuse();

    return new Response(
      JSON.stringify({
        recording_id,
        classification: result,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in content-classifier:', error);
    await flushLangfuse();
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
