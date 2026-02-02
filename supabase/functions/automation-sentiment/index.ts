/**
 * AUTOMATION SENTIMENT ANALYSIS
 *
 * Edge Function that analyzes call transcripts for sentiment using AI.
 * Returns structured sentiment data (positive/neutral/negative) with confidence scores.
 *
 * Features:
 * - Uses Vercel AI SDK v5 with OpenRouter provider
 * - Structured output via Zod schemas
 * - Multi-layer caching to prevent duplicate API costs:
 *   1. Database cache: fathom_calls.sentiment_cache for recording_id-based lookups
 *   2. In-memory cache: SHA-256 transcript hash for same-content detection
 * - Supports both direct analysis and batch processing
 * - Force refresh option to bypass cache when needed
 *
 * Caching Strategy:
 * - When recording_id provided: Check/store in fathom_calls.sentiment_cache column
 * - For all requests: Compute SHA-256 hash of transcript (first 10k chars)
 * - In-memory cache persists during function lifetime (same edge function instance)
 * - Response includes cache_type field: 'database' | 'in_memory' | undefined (fresh)
 *
 * Endpoints:
 * - POST /functions/v1/automation-sentiment
 *   Body: { transcript: string, recording_id?: number, force_refresh?: boolean }
 *   Returns: { success, sentiment, confidence, reasoning, cached, cache_type?, analyzed_at }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createOpenRouter } from 'https://esm.sh/@openrouter/ai-sdk-provider@1.2.8';
import { generateObject } from 'https://esm.sh/ai@5.0.102';
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

// Sentiment values - typed enum for structured output
const SENTIMENT_VALUES = ['positive', 'neutral', 'negative'] as const;

// Sentiment analysis schema - typed output from AI
// Uses Zod for structured output validation with generateObject()
const SentimentSchema = z.object({
  sentiment: z.enum(SENTIMENT_VALUES).describe(
    'The overall sentiment of the transcript. positive = enthusiastic, happy, satisfied; neutral = matter-of-fact, balanced; negative = frustrated, unhappy, dissatisfied'
  ),
  confidence: z.number().min(0).max(1).describe(
    'Confidence score from 0.0 to 1.0 indicating how certain the analysis is'
  ),
  reasoning: z.string().describe(
    'Brief explanation of why this sentiment was detected, with key phrases or indicators'
  ),
});

// Type for the sentiment result
type SentimentResult = z.infer<typeof SentimentSchema>;

// Request body types
interface SentimentRequest {
  transcript?: string;
  recording_id?: number;
  force_refresh?: boolean; // Force re-analysis even if cached
}

// Cached sentiment structure (stored in fathom_calls.sentiment_cache)
interface SentimentCache {
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: number;
  reasoning?: string;
  analyzed_at: string;
}

/**
 * In-memory cache for transcript hashes during function lifetime
 * Maps transcript hash -> sentiment result
 * This prevents duplicate API calls within the same function invocation
 */
const transcriptHashCache = new Map<string, SentimentResult>();

/**
 * Compute SHA-256 hash of transcript content for cache lookup
 * Uses first 10k characters to match the analysis limit
 */
async function computeTranscriptHash(transcript: string): Promise<string> {
  const encoder = new TextEncoder();
  // Use the same truncated content that would be analyzed
  const contentToHash = transcript.length > 10000
    ? transcript.substring(0, 10000)
    : transcript;

  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(contentToHash));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Check if we have a valid cached sentiment result
 */
function getCachedSentiment(sentimentCache: SentimentCache | null): SentimentCache | null {
  if (!sentimentCache) return null;
  if (!sentimentCache.sentiment || !sentimentCache.analyzed_at) return null;

  // Cache is valid indefinitely unless force_refresh is requested
  // The transcript content doesn't change after analysis
  return sentimentCache;
}

/**
 * Analyze sentiment using AI SDK with structured output
 */
async function analyzeSentiment(
  transcript: string,
  openrouter: ReturnType<typeof createOpenRouter>
): Promise<SentimentResult> {
  // Limit transcript to first 10k characters for performance (as per spec)
  const limitedTranscript = transcript.length > 10000
    ? transcript.substring(0, 10000) + '\n\n[Transcript truncated for analysis...]'
    : transcript;

  const result = await generateObject({
    model: openrouter('anthropic/claude-3-haiku-20240307'),
    schema: SentimentSchema,
    prompt: `Analyze the overall sentiment of this meeting/call transcript.

Consider:
- The emotional tone throughout the conversation
- Key phrases that indicate satisfaction, frustration, or neutrality
- The outcome or resolution of the conversation
- Body language cues mentioned (if any)
- Overall energy and engagement level

Classify as:
- POSITIVE: The conversation had an enthusiastic, satisfied, or happy tone. Participants seemed engaged and pleased.
- NEUTRAL: The conversation was matter-of-fact, professional, or balanced. No strong emotions either way.
- NEGATIVE: The conversation showed frustration, dissatisfaction, or unhappiness. There may have been complaints or unresolved issues.

Transcript:
${limitedTranscript}

Analyze the sentiment and provide your assessment with confidence level.`,
  });

  return result.object;
}

Deno.serve(async (req) => {
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

    const body: SentimentRequest = await req.json();
    const { transcript, recording_id, force_refresh = false } = body;

    // Validate request
    if (!transcript && !recording_id) {
      return new Response(
        JSON.stringify({ error: 'Either transcript or recording_id must be provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let transcriptToAnalyze = transcript;
    let callData: { sentiment_cache: SentimentCache | null } | null = null;
    let transcriptHash: string | null = null;

    // If recording_id is provided, fetch the call and check cache
    if (recording_id) {
      const { data: call, error: callError } = await supabase
        .from('fathom_calls')
        .select('recording_id, full_transcript, sentiment_cache')
        .eq('recording_id', recording_id)
        .eq('user_id', user.id)
        .single();

      if (callError || !call) {
        return new Response(
          JSON.stringify({ error: 'Call not found or unauthorized' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      callData = call;

      // Check for cached sentiment (unless force_refresh)
      if (!force_refresh) {
        const cachedResult = getCachedSentiment(call.sentiment_cache);
        if (cachedResult) {
          return new Response(
            JSON.stringify({
              success: true,
              recording_id,
              sentiment: cachedResult.sentiment,
              confidence: cachedResult.confidence,
              reasoning: cachedResult.reasoning,
              cached: true,
              cache_type: 'database',
              analyzed_at: cachedResult.analyzed_at,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Use call's transcript if not provided directly
      if (!transcriptToAnalyze) {
        transcriptToAnalyze = call.full_transcript;
      }
    }

    // Validate we have transcript content
    if (!transcriptToAnalyze || transcriptToAnalyze.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'No transcript content available for analysis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Compute transcript hash for cache lookup (unless force_refresh)
    if (!force_refresh) {
      transcriptHash = await computeTranscriptHash(transcriptToAnalyze);

      // Check in-memory cache for transcript hash
      const inMemoryCached = transcriptHashCache.get(transcriptHash);
      if (inMemoryCached) {
        return new Response(
          JSON.stringify({
            success: true,
            recording_id: recording_id || null,
            sentiment: inMemoryCached.sentiment,
            confidence: inMemoryCached.confidence,
            reasoning: inMemoryCached.reasoning,
            cached: true,
            cache_type: 'in_memory',
            analyzed_at: new Date().toISOString(),
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Perform sentiment analysis via AI
    const openrouter = createOpenRouterProvider(openrouterApiKey);

    // Start Langfuse trace
    const trace = startTrace({
      name: 'automation-sentiment',
      userId: user.id,
      model: 'anthropic/claude-3-haiku-20240307',
      input: { transcriptLength: transcriptToAnalyze.length },
      metadata: { recording_id: recording_id || null },
    });

    let sentimentResult;
    try {
      sentimentResult = await analyzeSentiment(transcriptToAnalyze, openrouter);
      await trace?.end(sentimentResult);
    } catch (error) {
      await trace?.end(null, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }

    // Store in in-memory cache for subsequent calls with same transcript
    if (transcriptHash) {
      transcriptHashCache.set(transcriptHash, sentimentResult);
    }

    // Cache the result if recording_id was provided
    if (recording_id) {
      const cacheData: SentimentCache = {
        sentiment: sentimentResult.sentiment,
        confidence: sentimentResult.confidence,
        reasoning: sentimentResult.reasoning,
        analyzed_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('fathom_calls')
        .update({ sentiment_cache: cacheData })
        .eq('recording_id', recording_id)
        .eq('user_id', user.id);

      if (updateError) {
        // Log but don't fail the request - sentiment was still analyzed successfully
        console.error('Failed to cache sentiment result:', updateError);
      }
    }

    // Flush Langfuse traces before response
    await flushLangfuse();

    return new Response(
      JSON.stringify({
        success: true,
        recording_id: recording_id || null,
        sentiment: sentimentResult.sentiment,
        confidence: sentimentResult.confidence,
        reasoning: sentimentResult.reasoning,
        cached: false,
        analyzed_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Sentiment analysis error:', error);
    await flushLangfuse();
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
