import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { SearchResult, SearchResultType, SourcePlatform } from '@/types/search';
import { useSearchStore } from '@/stores/searchStore';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { escapeIlike } from '@/lib/filter-utils';

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
  /**
   * Organization ID to scope the search.
   * The hook reads this from useOrganizationContext() — this field is accepted
   * for callsite clarity but the context value is always authoritative.
   */
  organizationId?: string | null;
  /**
   * Workspace ID to further scope the search.
   * Same as organizationId — accepted for callsite clarity; context is authoritative.
   */
  workspaceId?: string | null;
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
 * Sanitize search query to handle edge cases
 */
function sanitizeQuery(query: string): string {
  let sanitized = query.trim().substring(0, SEARCH_CONFIG.maxQueryLength);
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  return sanitized;
}

/**
 * Custom hook for global keyword search across recordings
 *
 * Features:
 * - 300ms debouncing to reduce API calls
 * - Keyword search using ILIKE on title + full_transcript
 * - Organization and workspace scoping
 * - Loading and error states
 * - Query sanitization
 * - Source platform filtering
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
  const { sourceFilters } = useSearchStore();
  const { activeOrganizationId, activeWorkspaceId } = useOrganizationContext();

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
   */
  const setQuery = useCallback((newQuery: string) => {
    setQueryRaw(newQuery);
    setError(null);

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

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
   * Keyword search query
   * Searches recordings.title and recordings.full_transcript using ILIKE
   * Scoped to active organization and optionally workspace
   */
  const {
    data: results = [],
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ['global-search', sanitizedQuery, limit, sourceFilters, activeOrganizationId, activeWorkspaceId],
    queryFn: async (): Promise<SearchResult[]> => {
      if (!user?.id || isQueryTooShort) {
        return [];
      }

      try {
        const escapedQuery = escapeIlike(sanitizedQuery);

        if (activeWorkspaceId) {
          // Workspace-scoped search: join through workspace_entries
          // Use !inner so filters on recordings actually exclude non-matching parent rows
          let q = supabase
            .from('workspace_entries')
            .select(`
              id,
              recording:recordings!inner (
                id,
                legacy_recording_id,
                title,
                full_transcript,
                summary,
                source_app,
                source_metadata,
                duration,
                recording_start_time,
                created_at
              )
            `)
            .eq('workspace_id', activeWorkspaceId)
            .or(`title.ilike.%${escapedQuery}%,full_transcript.ilike.%${escapedQuery}%,summary.ilike.%${escapedQuery}%`, { referencedTable: 'recordings' })
            .order('created_at', { ascending: false, referencedTable: 'recordings' })
            .limit(limit);

          // Apply source filter via .or() with referencedTable (avoids dot-notation with .in())
          if (sourceFilters.length > 0) {
            const sourceOrFilter = sourceFilters.map(s => `source_app.eq.${s}`).join(',');
            q = q.or(sourceOrFilter, { referencedTable: 'recordings' });
          }

          const { data: entries, error: queryError } = await q;
          if (queryError) throw queryError;

          const recs = (entries || [])
            .filter((e: Record<string, unknown>) => e.recording)
            .map((e: Record<string, unknown>) => e.recording as Record<string, unknown>);

          // Fetch participants for the returned recordings
          const recIds = recs.map((r) => r.id as string).filter(Boolean);
          const participantsByRecording = await fetchParticipants(recIds, activeOrganizationId);

          return recs.map((rec) =>
            transformRecordingToResult(rec, participantsByRecording[rec.id as string] ?? [])
          );
        } else {
          // Organization-scoped search: query recordings directly
          let q = supabase
            .from('recordings')
            .select('id, legacy_recording_id, title, full_transcript, summary, source_app, source_metadata, duration, recording_start_time, created_at')
            .or(`title.ilike.%${escapedQuery}%,full_transcript.ilike.%${escapedQuery}%,summary.ilike.%${escapedQuery}%`)
            .order('created_at', { ascending: false })
            .limit(limit);

          // Scope to organization
          if (activeOrganizationId) {
            q = q.eq('organization_id', activeOrganizationId);
          } else {
            q = q.eq('owner_user_id', user.id);
          }

          // Apply source filter
          if (sourceFilters.length > 0) {
            q = q.in('source_app', sourceFilters);
          }

          const { data: recordings, error: queryError } = await q;
          if (queryError) throw queryError;

          // Fetch participants for the returned recordings
          const recIds = (recordings || []).map((r: Record<string, unknown>) => r.id as string).filter(Boolean);
          const participantsByRecording = await fetchParticipants(recIds, activeOrganizationId);

          return (recordings || []).map((rec: Record<string, unknown>) =>
            transformRecordingToResult(rec, participantsByRecording[rec.id as string] ?? [])
          );
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Search failed';
        setError(errorMessage);
        return [];
      }
    },
    enabled: enabled && !!user?.id && !isQueryTooShort && sanitizedQuery.length >= SEARCH_CONFIG.minQueryLength,
    staleTime: 30000,
    gcTime: 60000,
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

/**
 * Fetch participants for a list of recording UUIDs, grouped by recording ID.
 * Returns an empty map when recIds is empty.
 */
async function fetchParticipants(
  recIds: string[],
  orgId: string | null
): Promise<Record<string, Array<{ name: string | null; email: string | null }>>> {
  if (recIds.length === 0) return {};

  const query = supabase
    .from('call_participants')
    .select('recording_id, name, email')
    .in('recording_id', recIds)
    .not('email', 'is', null);

  if (orgId) {
    query.eq('organization_id', orgId);
  }

  const { data } = await query;
  const map: Record<string, Array<{ name: string | null; email: string | null }>> = {};
  (data || []).forEach((p: { recording_id: string; name: string | null; email: string | null }) => {
    if (!map[p.recording_id]) map[p.recording_id] = [];
    map[p.recording_id].push({ name: p.name, email: p.email });
  });
  return map;
}

/**
 * Transform a recording row to a SearchResult
 */
function transformRecordingToResult(
  rec: Record<string, unknown>,
  participants: Array<{ name: string | null; email: string | null }> = []
): SearchResult {
  const title = (rec.title as string) || 'Untitled Recording';
  const transcript = rec.full_transcript as string | null;
  const summary = rec.summary as string | null;
  const snippet = summary
    ? (summary.length > 200 ? summary.substring(0, 200) + '...' : summary)
    : transcript
      ? (transcript.length > 200 ? transcript.substring(0, 200) + '...' : transcript)
      : '';

  const sourceApp = rec.source_app as string | null;
  const meta = (rec.source_metadata ?? {}) as Record<string, unknown>;

  return {
    id: String(rec.id),
    type: 'transcript',
    title,
    snippet,
    timestamp: (rec.recording_start_time as string) || (rec.created_at as string) || undefined,
    sourceCallId: String(rec.legacy_recording_id ?? rec.id),
    sourceCallTitle: title,
    sourcePlatform: (sourceApp as SourcePlatform) || null,
    metadata: {
      speakerName: (meta.recorded_by_name as string) || undefined,
      speakerEmail: (meta.recorded_by_email as string) || undefined,
      participants: participants.length > 0 ? participants : undefined,
      durationSeconds: (rec.duration as number) || null,
    },
  };
}
