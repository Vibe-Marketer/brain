import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
};

// Cross-encoder model for re-ranking
// ms-marco-MiniLM-L-12-v2 is specifically trained for passage ranking
const RERANK_MODEL = 'cross-encoder/ms-marco-MiniLM-L-12-v2';

interface ChunkCandidate {
  chunk_id: string;
  chunk_text: string;
  recording_id: number;
  speaker_name?: string;
  call_title?: string;
  rrf_score: number;  // Original hybrid search score
}

interface RerankedResult extends ChunkCandidate {
  rerank_score: number;
  final_rank: number;
}

/**
 * Score query-document pairs using HuggingFace cross-encoder model
 * Cross-encoders directly compare query and document for more accurate relevance scoring
 */
async function scorePairWithCrossEncoder(
  query: string,
  document: string,
  hfApiKey: string
): Promise<number> {
  try {
    // HuggingFace cross-encoder expects the input as a single string with [SEP] token
    // Format: "query [SEP] document"
    const inputText = `${query} [SEP] ${document}`;

    const response = await fetch(
      `https://api-inference.huggingface.co/models/${RERANK_MODEL}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hfApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: inputText,
          options: {
            wait_for_model: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`HuggingFace API error for cross-encoder: ${response.status}`, errorText);

      // If model is loading, wait and retry once
      if (response.status === 503) {
        console.log('Model is loading, waiting 5 seconds...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        const retryResponse = await fetch(
          `https://api-inference.huggingface.co/models/${RERANK_MODEL}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${hfApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              inputs: inputText,
              options: {
                wait_for_model: true,
              },
            }),
          }
        );

        if (!retryResponse.ok) {
          throw new Error(`Retry failed: ${retryResponse.status}`);
        }

        const retryData = await retryResponse.json();
        return extractRelevanceScore(retryData);
      }

      throw new Error(`HuggingFace API error: ${response.status}`);
    }

    const data = await response.json();
    return extractRelevanceScore(data);

  } catch (err) {
    console.error('Error scoring with cross-encoder:', err);
    throw err;
  }
}

/**
 * Extract relevance score from HuggingFace response
 * Cross-encoder models output classification scores - we want the "positive" relevance score
 */
function extractRelevanceScore(data: unknown): number {
  // Response format: [[{label: "LABEL_0", score: 0.2}, {label: "LABEL_1", score: 0.8}]]
  // or: [{label: "LABEL_0", score: 0.2}, {label: "LABEL_1", score: 0.8}]

  const results = Array.isArray(data[0]) ? data[0] : data;

  // Find the positive relevance score (usually LABEL_1 or higher index)
  // For ms-marco models, higher label index = more relevant
  if (Array.isArray(results) && results.length > 0) {
    // Sort by label and take the highest one (most relevant)
    // Use safe label extraction that handles unexpected formats
    const extractLabelNumber = (label: string | undefined): number => {
      if (!label) return 0;
      const match = label.match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    };

    const sorted = [...results].sort((a: {label?: string; score?: number}, b: {label?: string; score?: number}) => {
      const labelA = extractLabelNumber(a?.label);
      const labelB = extractLabelNumber(b?.label);
      return labelB - labelA;
    });

    // Safe access with fallback
    return sorted[0]?.score ?? 0.5;
  }

  // Fallback: if it's a single number, use that
  if (typeof data === 'number') {
    return data;
  }

  // Default fallback
  console.warn('Unexpected response format from cross-encoder:', data);
  return 0.5;
}

/**
 * Batch score multiple chunks against a query with rate limiting
 * Processes in batches to avoid overwhelming the API
 */
async function batchScoreChunks(
  query: string,
  chunks: ChunkCandidate[],
  hfApiKey: string,
  batchSize: number = 5,
  delayMs: number = 100
): Promise<(ChunkCandidate & { rerank_score: number })[]> {
  const results: (ChunkCandidate & { rerank_score: number })[] = [];

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);

    // Process batch in parallel
    const batchPromises = batch.map(async (chunk) => {
      try {
        const score = await scorePairWithCrossEncoder(query, chunk.chunk_text, hfApiKey);
        return {
          ...chunk,
          rerank_score: score,
        };
      } catch (err) {
        console.error(`Failed to score chunk ${chunk.chunk_id}:`, err);
        // Fallback to original hybrid search score
        return {
          ...chunk,
          rerank_score: chunk.rrf_score,
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Rate limiting delay between batches
    if (i + batchSize < chunks.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const hfApiKey = Deno.env.get('HUGGINGFACE_API_KEY');

    if (!hfApiKey) {
      throw new Error('HUGGINGFACE_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user authentication
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

    const { query, chunks, top_k = 5, batch_size = 5 } = await req.json();

    if (!query || !chunks || !Array.isArray(chunks)) {
      return new Response(
        JSON.stringify({
          error: 'query (string) and chunks (array) are required',
          example: {
            query: "What are the key insights from customer calls?",
            chunks: [
              {
                chunk_id: "uuid-1",
                chunk_text: "chunk content here",
                recording_id: 123,
                speaker_name: "John Doe",
                call_title: "Customer Discovery Call",
                rrf_score: 0.75
              }
            ],
            top_k: 5
          }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (chunks.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          query,
          total_candidates: 0,
          returned: 0,
          results: [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Re-ranking ${chunks.length} chunks for query: "${query.substring(0, 50)}..."`);
    console.log(`Top-K: ${top_k}, Batch size: ${batch_size}`);

    // Score all chunks against the query using cross-encoder
    const scoredChunks = await batchScoreChunks(query, chunks, hfApiKey, batch_size);

    // Sort by rerank score (highest first) and assign final rank
    const rerankedResults: RerankedResult[] = scoredChunks
      .sort((a, b) => b.rerank_score - a.rerank_score)
      .map((chunk, index) => ({
        ...chunk,
        final_rank: index + 1,
      }));

    // Log score distribution for debugging (safe for empty arrays)
    if (rerankedResults.length > 0) {
      const scores = rerankedResults.map(r => r.rerank_score);
      console.log('Score distribution:', {
        min: Math.min(...scores),
        max: Math.max(...scores),
        avg: scores.reduce((a, b) => a + b, 0) / scores.length,
      });
    }

    // Return top_k results
    const topResults = rerankedResults.slice(0, top_k);

    return new Response(
      JSON.stringify({
        success: true,
        query,
        model: RERANK_MODEL,
        total_candidates: chunks.length,
        returned: topResults.length,
        results: topResults,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in rerank-results:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
