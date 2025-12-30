import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
 * Database row type for transcript_chunks
 */
interface TranscriptChunkRow {
  id: string;
  recording_id: number;
  chunk_text: string;
  call_title: string | null;
  call_date: string | null;
  speaker_name: string | null;
  speaker_email: string | null;
  timestamp_start: string | null;
  created_at: string | null;
}

/**
 * Transform database row to SearchResult
 */
function transformChunkToSearchResult(chunk: TranscriptChunkRow): SearchResult {
  const snippet = chunk.chunk_text.length > 200
    ? chunk.chunk_text.substring(0, 200) + '...'
    : chunk.chunk_text;

  return {
    id: chunk.id,
    type: 'transcript',
    title: chunk.speaker_name
      ? `${chunk.speaker_name} in ${chunk.call_title || 'Untitled Call'}`
      : chunk.call_title || 'Untitled Call',
    snippet,
    timestamp: chunk.timestamp_start || chunk.created_at || undefined,
    sourceCallId: String(chunk.recording_id),
    sourceCallTitle: chunk.call_title || 'Untitled Call',
    metadata: {
      speakerName: chunk.speaker_name || undefined,
      speakerEmail: chunk.speaker_email,
    },
  };
}

/**
 * Sanitize search query to prevent injection and handle edge cases
 */
function sanitizeQuery(query: string): string {
  // Trim and limit length
  let sanitized = query.trim().substring(0, SEARCH_CONFIG.maxQueryLength);

  // Escape special characters for Postgres full-text search
  // Replace characters that have special meaning in to_tsquery
  sanitized = sanitized
    .replace(/[&|!():*<>'"\\]/g, ' ') // Replace special chars with space
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim();

  return sanitized;
}

/**
 * Custom hook for global search across transcripts
 *
 * Features:
 * - 300ms debouncing to reduce API calls
 * - Full-text search on transcript_chunks table
 * - Loading and error states
 * - Query sanitization
 * - Automatic user scoping via RLS
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
   * Supabase search query
   * Uses ilike for simple text matching on chunk_text
   * Full-text search (textSearch) requires proper FTS setup with tsvector
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
        // Search transcript_chunks using ilike for broad matching
        // The fts column could be used for better performance with:
        // .textSearch('fts', sanitizedQuery.split(' ').join(' & '))
        const { data, error: queryError } = await supabase
          .from('transcript_chunks')
          .select('id, recording_id, chunk_text, call_title, call_date, speaker_name, speaker_email, timestamp_start, created_at')
          .eq('user_id', user.id)
          .ilike('chunk_text', `%${sanitizedQuery}%`)
          .order('call_date', { ascending: false, nullsFirst: false })
          .limit(limit);

        if (queryError) {
          throw new Error(queryError.message);
        }

        if (!data) {
          return [];
        }

        // Transform and deduplicate results
        // Group by recording_id to avoid showing too many results from same call
        const seenRecordings = new Map<number, number>();
        const maxPerRecording = 3;

        return data
          .filter((chunk) => {
            const count = seenRecordings.get(chunk.recording_id) || 0;
            if (count >= maxPerRecording) {
              return false;
            }
            seenRecordings.set(chunk.recording_id, count + 1);
            return true;
          })
          .map(transformChunkToSearchResult);
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

// TODO: Add support for searching insights when insights table is available
// TODO: Add support for searching quotes when quotes table is available
