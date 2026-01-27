/**
 * Content Insight Miner (Agent 2)
 *
 * Extracts marketing-ready insights from call transcripts.
 * Finds pain points, dream outcomes, objections, stories, and expert frameworks.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_MODEL = 'openai/gpt-4o-mini';

type InsightCategory = 'pain' | 'dream_outcome' | 'objection_or_fear' | 'story_or_analogy' | 'expert_framework';
type EmotionCategory = 'anger_outrage' | 'awe_surprise' | 'social_currency' | 'relatable' | 'practical_value' | 'humor_sharp' | 'neutral';

interface InsightMinerRequest {
  recording_id: number;
  model?: string;
}

interface InsightOutput {
  category: InsightCategory;
  exact_quote: string;
  speaker: string | null;
  timestamp: string | null;
  why_it_matters: string | null;
  score: number;
  emotion_category: EmotionCategory | null;
  virality_score: number | null;
  topic_hint: string | null;
}

interface InsightMinerResult {
  insights: InsightOutput[];
  summary?: string;
}

async function mineInsights(
  transcript: string,
  title: string,
  apiKey: string,
  model: string
): Promise<InsightMinerResult> {
  const systemPrompt = `You are an expert content strategist extracting marketing-ready insights from sales calls.

Your job is to find and extract the BEST moments for content creation. Look for:

1. **Pain Points (pain)**: Frustrations, challenges, problems the customer describes
2. **Dream Outcomes (dream_outcome)**: Ideal states, goals, transformations desired
3. **Objections/Fears (objection_or_fear)**: Concerns, pushback, hesitations expressed
4. **Stories/Analogies (story_or_analogy)**: Compelling narratives, metaphors, real examples
5. **Expert Frameworks (expert_framework)**: Mental models, methodologies, unique perspectives

For each insight, provide:
- category: The insight category
- exact_quote: The EXACT words from the transcript (verbatim)
- speaker: Who said it (if identifiable)
- why_it_matters: Why this is valuable for content (1 sentence)
- score: 1-5 how powerful this insight is
- emotion_category: What emotion it triggers
  - "anger_outrage": Makes people angry at status quo
  - "awe_surprise": Unexpected or mind-blowing
  - "social_currency": Makes sharer look smart
  - "relatable": "That's so me!" moment
  - "practical_value": Immediately useful
  - "humor_sharp": Clever or funny
  - "neutral": No strong emotion
- virality_score: 1-5 likelihood of being shared
- topic_hint: 2-3 word topic descriptor

Find 5-15 of the BEST insights. Quality over quantity.
Return valid JSON with: { insights: [...], summary: "brief summary" }`;

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://app.callvaultai.com',
      'X-Title': 'CallVault Insight Miner',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Call Title: ${title}\n\nTranscript:\n${transcript.substring(0, 50000)}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
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

  return JSON.parse(content) as InsightMinerResult;
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
    const body: InsightMinerRequest = await req.json();
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

    // Mine insights
    const result = await mineInsights(
      transcript || call.summary || '',
      call.title,
      openrouterApiKey,
      model
    );

    console.log(`Mined ${result.insights.length} insights from call ${recording_id}`);

    // Save insights to database
    if (result.insights.length > 0) {
      const insightsToInsert = result.insights.map((insight) => ({
        user_id: user.id,
        recording_id,
        category: insight.category,
        exact_quote: insight.exact_quote,
        speaker: insight.speaker,
        timestamp: insight.timestamp,
        why_it_matters: insight.why_it_matters,
        score: insight.score,
        emotion_category: insight.emotion_category,
        virality_score: insight.virality_score,
        topic_hint: insight.topic_hint,
      }));

      const { error: insertError } = await supabase
        .from('insights')
        .insert(insightsToInsert);

      if (insertError) {
        console.error('Error inserting insights:', insertError);
      }
    }

    return new Response(
      JSON.stringify({
        recording_id,
        insights: result.insights,
        summary: result.summary,
        count: result.insights.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in content-insight-miner:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
