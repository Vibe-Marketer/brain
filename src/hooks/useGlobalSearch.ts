import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { semanticSearch, type SemanticSearchResult } from '@/lib/embeddings';
import type { SearchResult, SearchResultType } from '@/types/search';

/**
 * Default search configuration
 */
const SEARCH_CONFIG = {
  /** Debounce delay in milliseconds */
  debounceMs: 300,
  /** Maximum results to return */
  defaultLimit: 20,
  /** Minimum query length to trigger search */
  minQueryLength: 2,
  /** Maximum query length (truncate beyond this) */
  maxQueryLength: 100,
} as const;

/**
 * Search options for the hook
 */
interface UseGlobalSearchOptions {
  /** Override default debounce delay (ms) */
  debounceMs?: number;
  /** Maximum results to return */
  limit?: number;
  /** Filter by specific result types */
  types?: SearchResultType[];
  /** Whether search is enabled */
  enabled?: boolean;
}

/**
 * Return value from the useGlobalSearch hook
 */
interface UseGlobalSearchResult {
  /** Current search query */
  query: string;
  /** Update the search query (triggers debounced search) */
  setQuery: (query: string) => void;
  /** Search results */
  results: SearchResult[];
  /** Whether a search is in progress */
  isLoading: boolean;
  /** Error message if search failed */
  error: string | null;
  /** Clear search state */
  clear: () => void;
  /** Whether query is too short to trigger search */
  isQueryTooShort: boolean;
}

/**
 * Transform semantic search result to SearchResult
 */
function transformSemanticResult(result: SemanticSearchResult): SearchResult {
  const snippet = result.chunk_text.length > 200
    ? result.chunk_text.substring(0, 200) + '...'
    : result.chunk_text;

  return {
    id: result.id,
    type: 'transcript',
    title: result.speaker_name
      ? `${result.speaker_name} in ${result.call_title || 'Untitled Call'}`
      : result.call_title || 'Untitled Call',
    snippet,
    timestamp: result.call_date || undefined,
    sourceCallId: String(result.recording_id),
    sourceCallTitle: result.call_title || 'Untitled Call',
    metadata: {
      speakerName: result.speaker_name || undefined,
      speakerEmail: result.speaker_email,
      // Include relevance score as confidence
      confidence: Math.round(result.relevance_score * 100),
    },
  };
}

/**
 * Sanitize search query to handle edge cases
 */
function sanitizeQuery(query: string): string {
  // Trim and limit length
  let sanitized = query.trim().substring(0, SEARCH_CONFIG.maxQueryLength);

  // Collapse multiple spaces
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  return sanitized;
}

/**
 * Custom hook for global semantic search across transcripts
 *
 * Features:
 * - 300ms debouncing to reduce API calls
 * - Hybrid semantic + keyword search using RRF
 * - Loading and error states
 * - Query sanitization
 * - Automatic user scoping via RLS
 * - Relevance scoring
 *
 * @example
 * ```tsx
 * const { query, setQuery, results, isLoading } = useGlobalSearch();
 *
 * return (
 *   <input value={query} onChange={(e) => setQuery(e.target.value)} />
 *   {isLoading ? <Spinner /> : results.map(r => <ResultItem key={r.id} result={r} />)}
 * );
 * ```
 */
export function useGlobalSearch(options: UseGlobalSearchOptions = {}): UseGlobalSearchResult {
  const {
    debounceMs = SEARCH_CONFIG.debounceMs,
    limit = SEARCH_CONFIG.defaultLimit,
    enabled = true,
  } = options;

  const { user } = useAuth();

  // Raw query input (updates immediately on user input)
  const [query, setQueryRaw] = useState('');
  // Debounced query (updates after delay, triggers search)
  const [debouncedQuery, setDebouncedQuery] = useState('');
  // Error state
  const [error, setError] = useState<string | null>(null);

  // Ref to track debounce timeout
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Debounced query setter
   * Updates raw query immediately, debounces the search trigger
   */
  const setQuery = useCallback((newQuery: string) => {
    setQueryRaw(newQuery);
    setError(null);

    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set new timeout for debounced update
    debounceTimeoutRef.current = setTimeout(() => {
      setDebouncedQuery(newQuery);
    }, debounceMs);
  }, [debounceMs]);

  /**
   * Clear search state
   */
  const clear = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    setQueryRaw('');
    setDebouncedQuery('');
    setError(null);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  // Sanitize and validate query
  const sanitizedQuery = sanitizeQuery(debouncedQuery);
  const isQueryTooShort = sanitizedQuery.length < SEARCH_CONFIG.minQueryLength;

  /**
   * Semantic search query
   * Uses hybrid search (semantic + keyword) with RRF ranking
   */
  const {
    data: results = [],
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ['global-search', sanitizedQuery, limit],
    queryFn: async (): Promise<SearchResult[]> => {
      if (!user?.id || isQueryTooShort) {
        return [];
      }

      try {
        // Call semantic search edge function
        const { results: semanticResults, error: searchError } = await semanticSearch(
          sanitizedQuery,
          { limit }
        );

        if (searchError) {
          throw new Error(searchError);
        }

        // Group by recording_id to avoid showing too many results from same call
        const seenRecordings = new Map<number, number>();
        const maxPerRecording = 3;

        return semanticResults
          .filter((result) => {
            const count = seenRecordings.get(result.recording_id) || 0;
            if (count >= maxPerRecording) {
              return false;
            }
            seenRecordings.set(result.recording_id, count + 1);
            return true;
          })
          .map(transformSemanticResult);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Search failed';
        setError(errorMessage);
        return [];
      }
    },
    enabled: enabled && !!user?.id && !isQueryTooShort && sanitizedQuery.length >= SEARCH_CONFIG.minQueryLength,
    staleTime: 30000, // Cache results for 30 seconds
    gcTime: 60000, // Keep in cache for 1 minute
    refetchOnWindowFocus: false,
  });

  return {
    query,
    setQuery,
    results,
    isLoading: isLoading || isFetching,
    error,
    clear,
    isQueryTooShort: query.trim().length > 0 && isQueryTooShort,
  };
}
