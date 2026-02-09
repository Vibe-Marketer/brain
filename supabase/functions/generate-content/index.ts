/**
 * Generate Content from Insights
 *
 * Creates marketing content (emails, social posts, blog outlines, case studies)
 * from extracted call insights.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_MODEL = 'openai/gpt-4o-mini';

type ContentType = 'email' | 'social-post' | 'blog-outline' | 'case-study';
type Tone = 'professional' | 'casual' | 'friendly';

interface ContentGeneratorRequest {
  insights: Array<{
    type: string;
    content: string;
    context?: string;
  }>;
  content_type: ContentType;
  tone: Tone;
  target_audience?: string;
  additional_context?: string;
  model?: string;
}

function buildSystemPrompt(contentType: ContentType, tone: Tone, targetAudience?: string): string {
  const toneDescriptions = {
    professional: 'Maintain a professional, authoritative tone. Use clear, concise language.',
    casual: 'Be conversational and approachable. Use everyday language without being unprofessional.',
    friendly: 'Be warm and personable. Create a sense of connection and understanding.',
  };

  const contentTypeInstructions = {
    'email': `Create a follow-up email based on the conversation insights.
Structure:
- Subject line: Compelling, 5-8 words
- Opening: Reference the conversation naturally
- Body: 2-3 key points from the insights
- Closing: Clear next step or call-to-action
Keep it concise (150-200 words max).`,

    'social-post': `Create a LinkedIn-style social media post.
Structure:
- Hook: Attention-grabbing opening line
- Value: 2-3 insights or lessons learned
- Engagement: End with a question or call-to-action
Format: Short paragraphs, use line breaks. 200-300 words. Include 2-3 relevant hashtags.`,

    'blog-outline': `Create a detailed blog post outline.
Structure:
- Title: SEO-friendly, compelling
- Introduction hook
- 4-6 main sections with:
  - Section heading
  - 2-3 key points per section
  - Suggested examples or quotes
- Conclusion with takeaways
- Suggested CTA`,

    'case-study': `Create a case study framework.
Structure:
- Headline: Result-focused
- Challenge: What problem was being solved?
- Solution: What approach was taken?
- Results: What outcomes were achieved?
- Key Learnings: 2-3 takeaways
Use specific details from the insights where possible.`,
  };

  return `You are an expert content creator helping users turn conversation insights into compelling content.

${toneDescriptions[tone]}
${targetAudience ? `\nTarget Audience: ${targetAudience}` : ''}

${contentTypeInstructions[contentType]}

Important guidelines:
- Base your content on the provided insights
- Don't invent statistics or quotes not in the insights
- Maintain authenticity - this should sound like it came from a real conversation
- Focus on value and relevance to the reader`;
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
      return new Response(
        JSON.stringify({ error: 'OPENROUTER_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
    const body: ContentGeneratorRequest = await req.json();
    const {
      insights,
      content_type,
      tone,
      target_audience,
      additional_context,
      model = DEFAULT_MODEL,
    } = body;

    if (!insights || insights.length === 0) {
      return new Response(
        JSON.stringify({ error: 'insights array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!content_type) {
      return new Response(
        JSON.stringify({ error: 'content_type is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build user message with insights
    const insightsText = insights
      .map((i, idx) => `${idx + 1}. [${i.type.toUpperCase()}] ${i.content}${i.context ? `\n   Context: ${i.context}` : ''}`)
      .join('\n\n');

    const userMessage = `Based on these conversation insights, create ${content_type.replace('-', ' ')}:

INSIGHTS:
${insightsText}
${additional_context ? `\nADDITIONAL CONTEXT:\n${additional_context}` : ''}`;

    const systemPrompt = buildSystemPrompt(content_type, tone, target_audience);

    // Call OpenRouter
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://app.callvaultai.com',
        'X-Title': 'CallVault Content Generator',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter error:', errorText);
      return new Response(
        JSON.stringify({ error: `AI generation failed: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await response.json();
    const generatedContent = result.choices?.[0]?.message?.content || '';

    if (!generatedContent) {
      return new Response(
        JSON.stringify({ error: 'No content generated' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        content: generatedContent,
        content_type,
        model,
        tokens_used: result.usage?.total_tokens || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-content:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
