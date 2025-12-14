/**
 * Generate Content Edge Function
 * 
 * Generates marketing content from insights:
 * - Follow-up emails
 * - Social media posts
 * - Blog outlines
 * - Case studies
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateContentRequest {
  type: 'email' | 'social-post' | 'blog-outline' | 'case-study';
  insightIds: string[];
  context?: {
    tone?: 'professional' | 'casual' | 'friendly';
    targetAudience?: string;
    additionalContext?: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get request body
    const { type, insightIds, context }: GenerateContentRequest = await req.json();

    if (!type || !insightIds || insightIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: type, insightIds' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch insights from database
    const { data: insights, error: insightsError } = await supabaseClient
      .from('insights')
      .select('*')
      .in('id', insightIds);

    if (insightsError) {
      throw new Error(`Failed to fetch insights: ${insightsError.message}`);
    }

    if (!insights || insights.length === 0) {
      throw new Error('No insights found with provided IDs');
    }

    // Call OpenAI for content generation
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const systemPrompt = `You are an expert content creator specializing in marketing and business communication.
Generate high-quality, engaging content based on insights from business conversations.`;

    const contentTypeInstructions = {
      'email': 'Create a professional follow-up email that references the conversation naturally and provides value. Include a clear subject line, personalized greeting, body with key points, and strong call-to-action.',
      'social-post': 'Create an engaging social media post (LinkedIn style) that shares insights or tells a story. Make it authentic, valuable, and include relevant hashtags.',
      'blog-outline': 'Create a detailed blog post outline with sections, key points, and suggested content for each section. Include an engaging title, introduction, main sections, and conclusion.',
      'case-study': 'Create a compelling case study structure highlighting the problem, solution, and results. Use the STAR format (Situation, Task, Action, Result) and include specific metrics where available.',
    };

    const userPrompt = `Generate a ${type} based on these insights:

${insights.map((insight: any, i: number) => `${i + 1}. [${insight.type.toUpperCase()}] ${insight.content}`).join('\n')}

${context?.tone ? `Tone: ${context.tone}` : ''}
${context?.targetAudience ? `Target Audience: ${context.targetAudience}` : ''}
${context?.additionalContext ? `Additional Context: ${context.additionalContext}` : ''}

Instructions: ${contentTypeInstructions[type]}

Generate the content now:`;

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const openaiData = await openaiResponse.json();
    const generatedContent = openaiData.choices[0].message.content;

    // Store generated content in database
    const { data: savedContent, error: saveError } = await supabaseClient
      .from('generated_content')
      .insert({
        type,
        content: generatedContent,
        insight_ids: insightIds,
        context,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (saveError) {
      console.error('Failed to save generated content:', saveError);
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        content: generatedContent,
        contentId: savedContent?.id,
        type,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in generate-content function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
