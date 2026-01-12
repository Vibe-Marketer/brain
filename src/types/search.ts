/**
 * Global Search Types
 * Used for the global search modal and search functionality across the application
 */

/**
 * The type of content that a search result represents
 */
export type SearchResultType = 'transcript' | 'insight' | 'quote';

/**
 * Insight type for search result metadata
 * Matches the InsightType from InsightCard component
 */
export type SearchInsightType = 'pain' | 'success' | 'objection' | 'question';

/**
 * Metadata specific to different search result types
 */
export interface SearchResultMetadata {
  /** For insight results: the type of insight */
  insightType?: SearchInsightType;
  /** Speaker name for transcript segments */
  speakerName?: string;
  /** Speaker email for transcript segments */
  speakerEmail?: string | null;
  /** Confidence score for insights (0-100) */
  confidence?: number;
  /** Tags associated with the result */
  tags?: string[];
}

/**
 * Source platform for search filtering
 */
export type SourcePlatform = 'fathom' | 'google_meet';

/**
 * A unified search result that can represent transcripts, insights, or quotes
 */
export interface SearchResult {
  /** Unique identifier for the search result */
  id: string;
  /** The type of content this result represents */
  type: SearchResultType;
  /** Display title for the result */
  title: string;
  /** Text snippet/preview of the content */
  snippet: string;
  /** ISO timestamp of when the content was created */
  timestamp?: string;
  /** ID of the source call/recording */
  sourceCallId: string;
  /** Title of the source call/recording */
  sourceCallTitle: string;
  /** Source platform (fathom, google_meet) */
  sourcePlatform?: SourcePlatform | null;
  /** Additional metadata specific to the result type */
  metadata?: SearchResultMetadata;
}

/**
 * Search query parameters
 */
export interface SearchQuery {
  /** The search query string */
  query: string;
  /** Optional filter by result type */
  types?: SearchResultType[];
  /** Maximum number of results to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Search response from the search hook/API
 */
export interface SearchResponse {
  /** Array of search results */
  results: SearchResult[];
  /** Total number of matching results (before limit) */
  total: number;
  /** The query that produced these results */
  query: string;
}

/**
 * Search state for the Zustand store
 */
export interface SearchState {
  /** Whether the search modal is open */
  isModalOpen: boolean;
  /** Current search query */
  query: string;
  /** Search results */
  results: SearchResult[];
  /** Whether a search is in progress */
  isLoading: boolean;
  /** Error message if search failed */
  error: string | null;
  /** Source platform filters (empty = all sources) */
  sourceFilters: SourcePlatform[];
}

/**
 * Search store actions
 */
export interface SearchActions {
  /** Open the search modal */
  openModal: () => void;
  /** Close the search modal and reset state */
  closeModal: () => void;
  /** Set the search query */
  setQuery: (query: string) => void;
  /** Set search results */
  setResults: (results: SearchResult[]) => void;
  /** Set loading state */
  setLoading: (isLoading: boolean) => void;
  /** Set error state */
  setError: (error: string | null) => void;
  /** Set source platform filters */
  setSourceFilters: (filters: SourcePlatform[]) => void;
  /** Reset search state (query, results, error) */
  resetSearch: () => void;
}
