/**
 * Embeddings and Semantic Search Client
 *
 * Provides semantic search functionality by calling the semantic-search edge function.
 * The edge function handles:
 * - Query embedding generation using OpenAI text-embedding-3-small
 * - Hybrid search using RRF (Reciprocal Rank Fusion)
 * - Results ranking and filtering
 *
 * API keys remain server-side for security.
 */

import { supabase } from '@/integrations/supabase/client';

/**
 * Source platform type for filtering
 */
export type SourcePlatform = 'fathom' | 'google_meet';

/**
 * Result from semantic search
 */
export interface SemanticSearchResult {
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
  relevance_score: number;
  similarity_score: number;
  source_platform?: SourcePlatform | null;
}

/**
 * Response from the semantic-search edge function
 */
export interface SemanticSearchResponse {
  success: boolean;
  query: string;
  results: SemanticSearchResult[];
  total: number;
  timing?: {
    embedding_ms: number;
    search_ms: number;
    total_ms: number;
  };
  error?: string;
}

/**
 * Options for semantic search
 */
export interface SemanticSearchOptions {
  /** Maximum number of results to return (default: 20) */
  limit?: number;
  /** Filter by source platforms (empty/undefined = all sources) */
  sourcePlatforms?: SourcePlatform[];
}

/**
 * Perform semantic search across transcript chunks
 *
 * Uses hybrid search combining:
 * - Semantic similarity (vector embeddings)
 * - Full-text keyword matching
 * - RRF (Reciprocal Rank Fusion) for score combination
 *
 * @param query - The search query text
 * @param options - Optional search configuration
 * @returns Search results with relevance scores
 *
 * @example
 * ```ts
 * const { results, error } = await semanticSearch('frustrated customer');
 * if (error) {
 *   console.error('Search failed:', error);
 * } else {
 *   results.forEach(r => console.log(r.call_title, r.relevance_score));
 * }
 * ```
 */
export async function semanticSearch(
  query: string,
  options: SemanticSearchOptions = {}
): Promise<{ results: SemanticSearchResult[]; error: string | null; timing?: SemanticSearchResponse['timing'] }> {
  const { limit = 20, sourcePlatforms } = options;

  try {
    const { data, error } = await supabase.functions.invoke('semantic-search', {
      body: {
        query,
        limit,
        // Only include sourcePlatforms if it has items
        ...(sourcePlatforms && sourcePlatforms.length > 0 && { sourcePlatforms }),
      },
    });

    if (error) {
      return { results: [], error: error.message };
    }

    const response = data as SemanticSearchResponse;

    if (!response.success) {
      return { results: [], error: response.error || 'Search failed' };
    }

    return {
      results: response.results,
      error: null,
      timing: response.timing,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return { results: [], error: errorMessage };
  }
}
