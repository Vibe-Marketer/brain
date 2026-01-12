/**
 * Content Hook Generator (Agent 3)
 *
 * Transforms insights into attention-grabbing hooks for content.
 * Creates hooks optimized for virality and engagement.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_MODEL = 'openai/gpt-4o-mini';

type EmotionCategory = 'anger_outrage' | 'awe_surprise' | 'social_currency' | 'relatable' | 'practical_value' | 'humor_sharp' | 'neutral';

interface HookGeneratorRequest {
  recording_id: number;
  insight_ids?: string[];
  business_profile?: BusinessProfileContext;
  model?: string;
}

interface BusinessProfileContext {
  avatar: string;
  target_audience: string;
  offer_name: string;
  offer_promise: string;
  price_point: string;
  brand_voice: string;
  prohibited_terms: string;
}

interface HookOutput {
  hook_text: string;
  insight_ids: string[];
  emotion_category: EmotionCategory | null;
  virality_score: number | null;
  topic_hint: string | null;
}

interface HookGeneratorResult {
  hooks: HookOutput[];
}

async function generateHooks(
  insights: Array<{ id: string; exact_quote: string; category: string; emotion_category: string | null; topic_hint: string | null }>,
  businessContext: BusinessProfileContext | null,
  apiKey: string,
  model: string
): Promise<HookGeneratorResult> {
  const contextSection = businessContext
    ? `
BUSINESS CONTEXT:
- Target Audience: ${businessContext.target_audience || 'General business audience'}
- Offer: ${businessContext.offer_name || 'Business solution'}
- Brand Voice: ${businessContext.brand_voice || 'Professional but approachable'}
- Avoid: ${businessContext.prohibited_terms || 'None specified'}
`
    : '';

  const systemPrompt = `You are an expert content hook writer who transforms raw insights into attention-grabbing hooks.

A great hook:
1. Stops the scroll - creates immediate curiosity or reaction
2. Is specific - uses concrete details, not generics
3. Creates an open loop - makes reader need to know more
4. Triggers emotion - anger, surprise, relatability, or value
5. Is shareable - people want to repost or forward it

HOOK PATTERNS THAT WORK:
- "The [specific thing] that [surprising result]"
- "Why [counterintuitive statement]"
- "I asked [X] about [Y]. Here's what they said:"
- "[Specific moment] that changed everything"
- "Stop doing [common thing]. Here's why:"
- "[Number] things I learned after [specific experience]"
${contextSection}
RULES:
1. Each hook should be 1-3 sentences max
2. Use the EXACT quotes or data from insights when powerful
3. Don't make it sound like marketing copy - make it sound like a real person
4. Create 1-3 hooks per insight (only the best variations)
5. Maintain the original emotion/energy of the insight

For each hook, provide:
- hook_text: The hook itself
- insight_ids: Array of insight IDs this hook is based on
- emotion_category: What emotion it triggers
- virality_score: 1-5 likelihood of being shared
- topic_hint: 2-3 word topic

Return valid JSON: { hooks: [...] }`;

  const insightsList = insights.map((i) => ({
    id: i.id,
    quote: i.exact_quote,
    category: i.category,
    emotion: i.emotion_category,
    topic: i.topic_hint,
  }));

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://app.callvaultai.com',
      'X-Title': 'CallVault Hook Generator',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Transform these insights into powerful hooks:\n\n${JSON.stringify(insightsList, null, 2)}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
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

  return JSON.parse(content) as HookGeneratorResult;
}

Deno.serve(async (req: Request) => {
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
    const body: HookGeneratorRequest = await req.json();
    const { recording_id, insight_ids, business_profile, model = DEFAULT_MODEL } = body;

    if (!recording_id) {
      return new Response(
        JSON.stringify({ error: 'recording_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get insights for this recording
    let insightsQuery = supabase
      .from('insights')
      .select('id, exact_quote, category, emotion_category, topic_hint')
      .eq('recording_id', recording_id)
      .eq('user_id', user.id);

    if (insight_ids && insight_ids.length > 0) {
      insightsQuery = insightsQuery.in('id', insight_ids);
    }

    const { data: insights, error: insightsError } = await insightsQuery;

    if (insightsError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch insights' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!insights || insights.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No insights found for this recording' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate hooks
    const result = await generateHooks(
      insights,
      business_profile || null,
      openrouterApiKey,
      model
    );

    console.log(`Generated ${result.hooks.length} hooks from ${insights.length} insights`);

    // Save hooks to database
    if (result.hooks.length > 0) {
      const hooksToInsert = result.hooks.map((hook) => ({
        user_id: user.id,
        recording_id,
        hook_text: hook.hook_text,
        insight_ids: hook.insight_ids,
        emotion_category: hook.emotion_category,
        virality_score: hook.virality_score,
        topic_hint: hook.topic_hint,
        status: 'generated',
        is_starred: false,
      }));

      const { data: insertedHooks, error: insertError } = await supabase
        .from('hooks')
        .insert(hooksToInsert)
        .select();

      if (insertError) {
        console.error('Error inserting hooks:', insertError);
      } else {
        // Return the inserted hooks with their IDs
        return new Response(
          JSON.stringify({
            recording_id,
            hooks: insertedHooks,
            count: insertedHooks?.length || 0,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({
        recording_id,
        hooks: result.hooks,
        count: result.hooks.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in content-hook-generator:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
