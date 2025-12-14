/**
 * Extract Knowledge Edge Function
 * 
 * Automatically processes call transcripts and extracts:
 * - PROFITS framework insights
 * - Key quotes and pain points
 * - Sentiment analysis
 * - Action items
 * - Tags and categorization
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExtractKnowledgeRequest {
  callId: string;
  transcript: string;
  metadata?: {
    title?: string;
    participants?: string[];
    date?: string;
  };
}

interface PROFITSInsights {
  pain: string[];
  results: string[];
  obstacles: string[];
  fears: string[];
  identity: string[];
  triggers: string[];
  success: string[];
}

interface ExtractedInsight {
  type: 'pain' | 'success' | 'objection' | 'question';
  content: string;
  confidence: number;
  context: string;
  tags: string[];
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
    const { callId, transcript, metadata }: ExtractKnowledgeRequest = await req.json();

    if (!callId || !transcript) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: callId, transcript' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call OpenAI for analysis
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const systemPrompt = `You are an expert AI analyst specializing in extracting actionable insights from business conversations.

Your task is to analyze call transcripts and extract:
1. PROFITS Framework elements (Pain, Results, Obstacles, Fears, Identity, Triggers, Success)
2. Key insights categorized as: pain points, success stories, objections, questions
3. Sentiment analysis
4. Action items
5. Notable quotes
6. Key topics

Be thorough, accurate, and provide confidence scores for insights.`;

    const userPrompt = `Analyze this call transcript and extract all valuable insights:

${metadata?.title ? `Call Title: ${metadata.title}` : ''}
${metadata?.participants ? `Participants: ${metadata.participants.join(', ')}` : ''}
${metadata?.date ? `Date: ${metadata.date}` : ''}

Transcript:
${transcript}

Provide a comprehensive analysis in JSON format with the following structure:
{
  "summary": "Brief summary of the call",
  "sentiment": "positive|neutral|negative",
  "sentimentScore": 0-100,
  "keyTopics": ["topic1", "topic2"],
  "participants": ["name1", "name2"],
  "actionItems": ["action1", "action2"],
  "insights": [
    {
      "type": "pain|success|objection|question",
      "content": "The actual insight text",
      "confidence": 0-100,
      "context": "Surrounding context",
      "tags": ["tag1", "tag2"]
    }
  ],
  "profitsFramework": {
    "pain": ["pain point 1", "pain point 2"],
    "results": ["desired result 1"],
    "obstacles": ["obstacle 1"],
    "fears": ["fear 1"],
    "identity": ["identity statement 1"],
    "triggers": ["trigger 1"],
    "success": ["success story 1"]
  },
  "quotes": [
    {
      "text": "The quote",
      "speaker": "Speaker name",
      "timestamp": "optional timestamp",
      "significance": 0-100
    }
  ]
}`;

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
        temperature: 0.3,
        max_tokens: 4000,
      }),
    });

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const openaiData = await openaiResponse.json();
    const analysisText = openaiData.choices[0].message.content;

    // Extract JSON from response
    const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from AI response');
    }

    const analysis = JSON.parse(jsonMatch[0]);

    // Store insights in database
    const { data: call, error: callError } = await supabaseClient
      .from('calls')
      .select('*')
      .eq('id', callId)
      .single();

    if (callError) {
      throw new Error(`Failed to fetch call: ${callError.message}`);
    }

    // Update call with analysis
    const { error: updateError } = await supabaseClient
      .from('calls')
      .update({
        summary: analysis.summary,
        sentiment: analysis.sentiment,
        sentiment_score: analysis.sentimentScore,
        key_topics: analysis.keyTopics,
        action_items: analysis.actionItems,
        profits_framework: analysis.profitsFramework,
        ai_processed: true,
        ai_processed_at: new Date().toISOString(),
      })
      .eq('id', callId);

    if (updateError) {
      throw new Error(`Failed to update call: ${updateError.message}`);
    }

    // Store individual insights
    for (const insight of analysis.insights) {
      const { error: insightError } = await supabaseClient
        .from('insights')
        .insert({
          call_id: callId,
          type: insight.type,
          content: insight.content,
          confidence: insight.confidence,
          context: insight.context,
          tags: insight.tags,
          created_at: new Date().toISOString(),
        });

      if (insightError) {
        console.error('Failed to insert insight:', insightError);
      }
    }

    // Store quotes
    for (const quote of analysis.quotes) {
      const { error: quoteError } = await supabaseClient
        .from('quotes')
        .insert({
          call_id: callId,
          text: quote.text,
          speaker: quote.speaker,
          timestamp: quote.timestamp,
          significance: quote.significance,
          created_at: new Date().toISOString(),
        });

      if (quoteError) {
        console.error('Failed to insert quote:', quoteError);
      }
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        callId,
        analysis: {
          summary: analysis.summary,
          sentiment: analysis.sentiment,
          insightsCount: analysis.insights.length,
          quotesCount: analysis.quotes.length,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in extract-knowledge function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
