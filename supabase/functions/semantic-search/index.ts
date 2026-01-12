import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * SEMANTIC SEARCH - Query embedding and hybrid search
 *
 * This edge function handles semantic search for the global search UI:
 * 1. Generates query embedding using OpenAI text-embedding-3-small
 * 2. Calls hybrid_search_transcripts RPC with the embedding
 * 3. Returns formatted search results with relevance scores
 *
 * Security: API keys stay server-side, never exposed to client
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
};

/**
 * Generate query embedding using OpenAI API
 */
async function generateQueryEmbedding(text: string, openaiApiKey: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Embedding API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Result type from hybrid_search_transcripts RPC
 */
interface HybridSearchResult {
  chunk_id: string;
  recording_id: number;
  chunk_text: string;
  chunk_index: number;
  speaker_name: string | null;
  speaker_email: string | null;
  call_date: string;
  call_title: string;
  call_category: string | null;
  topics: string[] | null;
  sentiment: string | null;
  intent_signals: string[] | null;
  source_platform: string;
  similarity_score: number;
  fts_rank: number;
  rrf_score: number;
}

/**
 * Formatted search result for the UI
 */
interface SearchResultForUI {
  id: string;
  recording_id: number;
  chunk_text: string;
  speaker_name: string | null;
  speaker_email: string | null;
  call_date: string;
  call_title: string;
  call_category: string | null;
  topics: string[] | null;
  sentiment: string | null;
  source_platform: string;
  relevance_score: number;
  similarity_score: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    // Get user from auth header
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

    // Parse request body
    const body = await req.json();
    const { query, limit = 20, sourcePlatforms } = body;

    // Validate sourcePlatforms if provided
    const validPlatforms = ['fathom', 'google_meet', 'zoom', 'other'];
    let filterSourcePlatforms: string[] | null = null;
    if (sourcePlatforms && Array.isArray(sourcePlatforms)) {
      filterSourcePlatforms = sourcePlatforms.filter(p => validPlatforms.includes(p));
      if (filterSourcePlatforms.length === 0) {
        filterSourcePlatforms = null; // Search all platforms if none are valid
      }
    }

    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Query string is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      return new Response(
        JSON.stringify({ error: 'Query must be at least 2 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate embedding for the query
    const startTime = Date.now();
    const queryEmbedding = await generateQueryEmbedding(trimmedQuery, openaiApiKey);
    const embeddingTime = Date.now() - startTime;

    // Call hybrid search RPC
    const searchStartTime = Date.now();
    const rpcParams: Record<string, unknown> = {
      query_text: trimmedQuery,
      query_embedding: queryEmbedding,
      match_count: limit,
      full_text_weight: 1.0,
      semantic_weight: 1.0,
      rrf_k: 60,
      filter_user_id: user.id,
    };

    // Add source platform filter if specified
    if (filterSourcePlatforms) {
      rpcParams.filter_source_platforms = filterSourcePlatforms;
    }

    const { data: candidates, error: searchError } = await supabase.rpc('hybrid_search_transcripts', rpcParams);

    if (searchError) {
      console.error('Hybrid search error:', searchError);
      return new Response(
        JSON.stringify({ error: 'Search failed', details: searchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const searchTime = Date.now() - searchStartTime;

    // Format results for UI
    const results: SearchResultForUI[] = (candidates || []).map((r: HybridSearchResult) => ({
      id: r.chunk_id,
      recording_id: r.recording_id,
      chunk_text: r.chunk_text,
      speaker_name: r.speaker_name,
      speaker_email: r.speaker_email,
      call_date: r.call_date,
      call_title: r.call_title,
      call_category: r.call_category,
      topics: r.topics,
      sentiment: r.sentiment,
      source_platform: r.source_platform || 'fathom',
      relevance_score: r.rrf_score,
      similarity_score: r.similarity_score,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        query: trimmedQuery,
        results,
        total: results.length,
        timing: {
          embedding_ms: embeddingTime,
          search_ms: searchTime,
          total_ms: Date.now() - startTime,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in semantic-search:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
