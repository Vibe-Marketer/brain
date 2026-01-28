/**
 * Shared search pipeline for RAG tools.
 * Provides hybrid search (embedding + full-text), cross-encoder re-ranking,
 * and diversity filtering. Used by both chat-stream (legacy) and chat-stream-v2.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generateQueryEmbedding } from './embeddings.ts';

// ============================================
// TYPE DEFINITIONS
// ============================================

/** Shape returned by the hybrid_search_transcripts RPC. */
export interface SearchResult {
  chunk_id: string;
  chunk_text: string;
  recording_id: number;
  speaker_name: string | null;
  call_title: string;
  call_date: string;
  call_category: string | null;
  topics?: string[];
  sentiment?: string;
  intent_signals?: string[];
  user_tags?: string[];
  entities?: { [key: string]: string[] };
  rrf_score: number;
  similarity_score: number;
  rerank_score?: number;
}

/** Optional filters for search queries. */
export interface SearchFilters {
  date_start?: string;
  date_end?: string;
  speakers?: string[];
  categories?: string[];
  topics?: string[];
  sentiment?: string;
  intent_signals?: string[];
  user_tags?: string[];
  recording_ids?: number[];
}

/** Final formatted result returned to tool callers. */
export interface FormattedSearchResult {
  index: number;
  recording_id: number;
  call_title: string;
  call_date: string;
  speaker: string | null;
  category: string | null;
  topics?: string[];
  sentiment?: string;
  text: string;
  relevance: string;
}

// ============================================
// SUPABASE CLIENT TYPE
// ============================================

type SupabaseClient = ReturnType<typeof createClient>;

// ============================================
// RE-RANKING
// ============================================

const HUGGINGFACE_API_URL = 'https://api-inference.huggingface.co/models';
const RERANK_MODEL = 'cross-encoder/ms-marco-MiniLM-L-12-v2';
const RERANK_BATCH_SIZE = 10;
const RERANK_REQUEST_TIMEOUT_MS = 1500;
const RERANK_MAX_CANDIDATES = 30;

/**
 * Extract a relevance score from HuggingFace cross-encoder response.
 * Handles the variable response formats from the inference API.
 */
function extractScore(data: unknown): number {
  if (Array.isArray(data) && data.length > 0) {
    const results = Array.isArray(data[0]) ? data[0] : data;
    const sorted = [...results].sort(
      (a: { label?: string; score?: number }, b: { label?: string; score?: number }) => {
        const labelA = parseInt(a?.label?.match(/\d+/)?.[0] || '0', 10);
        const labelB = parseInt(b?.label?.match(/\d+/)?.[0] || '0', 10);
        return labelB - labelA;
      },
    );
    return sorted[0]?.score ?? 0.5;
  }
  return typeof data === 'number' ? data : 0.5;
}

/**
 * Re-rank search results using HuggingFace cross-encoder model.
 * Processes candidates in batches with per-request timeouts.
 * Falls back to original RRF scores on any failure.
 *
 * @param query - The search query text
 * @param candidates - Raw search results from hybrid search
 * @param hfApiKey - HuggingFace API key
 * @param topK - Number of top results to return (default: 10)
 * @returns Re-ranked results sorted by cross-encoder score
 */
export async function rerankResults(
  query: string,
  candidates: SearchResult[],
  hfApiKey: string,
  topK: number = 10,
): Promise<SearchResult[]> {
  if (!hfApiKey || candidates.length === 0) {
    console.log('Re-ranking skipped (no API key or no candidates)');
    return candidates.slice(0, topK);
  }

  const startTime = Date.now();

  try {
    // Only re-rank the top N candidates from RRF/hybrid search
    const candidatesToRerank = candidates.slice(0, RERANK_MAX_CANDIDATES);
    const scoredCandidates: SearchResult[] = [];

    // Process in batches
    for (let i = 0; i < candidatesToRerank.length; i += RERANK_BATCH_SIZE) {
      const batch = candidatesToRerank.slice(i, i + RERANK_BATCH_SIZE);

      const batchResults = await Promise.all(
        batch.map(async (candidate) => {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), RERANK_REQUEST_TIMEOUT_MS);

            const response = await fetch(
              `${HUGGINGFACE_API_URL}/${RERANK_MODEL}`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${hfApiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  inputs: `${query} [SEP] ${candidate.chunk_text.substring(0, 500)}`,
                  options: { wait_for_model: true, use_cache: true },
                }),
                signal: controller.signal,
              },
            );
            clearTimeout(timeoutId);

            if (!response.ok) {
              return { ...candidate, rerank_score: candidate.rrf_score };
            }

            const data = await response.json();
            const score = extractScore(data);
            return { ...candidate, rerank_score: score };
          } catch {
            return { ...candidate, rerank_score: candidate.rrf_score };
          }
        }),
      );

      scoredCandidates.push(...batchResults);
    }

    console.log(`Re-ranking completed in ${Date.now() - startTime}ms`);

    // Merge re-ranked results with any remaining candidates that weren't re-ranked
    const remainingCandidates = candidates.slice(RERANK_MAX_CANDIDATES).map((c) => ({
      ...c,
      rerank_score: c.rrf_score, // Use RRF score as fallback for tail
    }));

    const allScored = [...scoredCandidates, ...remainingCandidates];

    return allScored
      .sort((a, b) => (b.rerank_score || 0) - (a.rerank_score || 0))
      .slice(0, topK);
  } catch (error) {
    console.error('Re-ranking failed, using original order:', error);
    return candidates.slice(0, topK);
  }
}

// ============================================
// DIVERSITY FILTERING
// ============================================

/**
 * Filter results to ensure diversity across recordings.
 * Limits max N chunks per recording to ensure results span multiple calls.
 *
 * @param results - Ranked search results
 * @param maxPerRecording - Max chunks from a single recording (default: 2)
 * @param targetCount - Target number of diverse results (default: 5)
 * @returns Filtered results with diversity constraint applied
 */
export function diversityFilter<T extends { recording_id: number }>(
  results: T[],
  maxPerRecording: number = 2,
  targetCount: number = 5,
): T[] {
  const diverse: T[] = [];
  const recordingCounts = new Map<number, number>();

  for (const result of results) {
    if (diverse.length >= targetCount) break;

    const count = recordingCounts.get(result.recording_id) || 0;
    if (count >= maxPerRecording) continue;

    diverse.push(result);
    recordingCounts.set(result.recording_id, count + 1);
  }

  return diverse;
}

// ============================================
// HYBRID SEARCH ORCHESTRATOR
// ============================================

/** Parameters for the full hybrid search pipeline. */
export interface HybridSearchParams {
  query: string;
  limit?: number;
  supabase: SupabaseClient;
  userId: string;
  openaiApiKey: string;
  hfApiKey: string;
  filters?: SearchFilters;
}

/** Result of the full hybrid search pipeline. */
export interface HybridSearchResponse {
  results: FormattedSearchResult[];
  total_found: number;
  reranked: number;
  returned: number;
}

/** Error response for search failures. */
export interface SearchError {
  error: string;
  details?: string;
}

/** Empty result message. */
export interface SearchEmpty {
  message: string;
}

/**
 * Execute the full hybrid search pipeline:
 * 1. Generate query embedding via OpenAI
 * 2. Call hybrid_search_transcripts RPC (full-text + semantic + RRF)
 * 3. Re-rank via HuggingFace cross-encoder
 * 4. Apply diversity filtering
 * 5. Format results
 *
 * @param params - Search parameters including query, filters, and API clients
 * @returns Formatted search results, error, or empty message
 */
export async function executeHybridSearch(
  params: HybridSearchParams,
): Promise<HybridSearchResponse | SearchError | SearchEmpty> {
  const {
    query,
    limit = 10,
    supabase,
    userId,
    openaiApiKey,
    hfApiKey,
    filters = {},
  } = params;

  console.log(`Hybrid search: "${query}" with filters:`, filters);
  const searchStartTime = Date.now();

  // Step 1: Generate embedding
  const queryEmbedding = await generateQueryEmbedding(query, openaiApiKey);

  // Step 2: Call hybrid_search_transcripts RPC
  const hasSpecificRecordingFilters = filters.recording_ids && filters.recording_ids.length > 0;
  const baseCount = hasSpecificRecordingFilters ? 60 : 40;
  const candidateCount = Math.min(limit * 3, baseCount);

  const { data: candidates, error } = await supabase.rpc('hybrid_search_transcripts', {
    query_text: query,
    query_embedding: queryEmbedding,
    match_count: candidateCount,
    full_text_weight: 1.0,
    semantic_weight: 1.0,
    rrf_k: 60,
    filter_user_id: userId,
    filter_date_start: filters.date_start || null,
    filter_date_end: filters.date_end || null,
    filter_speakers: filters.speakers || null,
    filter_categories: filters.categories || null,
    filter_recording_ids: filters.recording_ids || null,
    filter_topics: filters.topics || null,
    filter_sentiment: filters.sentiment || null,
    filter_intent_signals: filters.intent_signals || null,
    filter_user_tags: filters.user_tags || null,
  });

  if (error) {
    console.error('Search error:', error);
    return { error: 'Search failed', details: error.message };
  }

  if (!candidates || candidates.length === 0) {
    return { message: 'I could not find relevant information in your transcripts for this query.' };
  }

  console.log(`Hybrid search returned ${candidates.length} candidates in ${Date.now() - searchStartTime}ms`);

  // Step 3: Re-rank via cross-encoder
  const reranked = await rerankResults(query, candidates, hfApiKey, limit * 2);

  // Step 4: Diversity filter — max 2 chunks per recording
  const diverse = diversityFilter(reranked, 2, limit);

  console.log(`Search pipeline complete: ${candidates.length} → ${reranked.length} → ${diverse.length} results`);

  // Step 5: Format results
  return {
    results: diverse.map((r: SearchResult, i: number) => ({
      index: i + 1,
      recording_id: r.recording_id,
      call_title: r.call_title,
      call_date: r.call_date,
      speaker: r.speaker_name,
      category: r.call_category,
      topics: r.topics,
      sentiment: r.sentiment,
      text: r.chunk_text,
      relevance: r.rerank_score
        ? Math.round(r.rerank_score * 100) + '%'
        : Math.round(r.rrf_score * 100) + '%',
    })),
    total_found: candidates.length,
    reranked: reranked.length,
    returned: diverse.length,
  };
}
