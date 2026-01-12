import { create } from 'zustand';
import type { SearchResult, SearchState, SearchActions } from '@/types/search';

/**
 * Event name for focusing inline search inputs
 * Components with inline search should listen for this event
 */
export const FOCUS_INLINE_SEARCH_EVENT = 'focus-inline-search';

/**
 * Helper to dispatch the focus inline search event
 */
export const dispatchFocusInlineSearch = () => {
  window.dispatchEvent(new CustomEvent(FOCUS_INLINE_SEARCH_EVENT));
};

/**
 * Global Search Store
 * Manages state for the global search modal and search functionality
 */
export const useSearchStore = create<SearchState & SearchActions>((set) => ({
  // State
  isModalOpen: false,
  query: '',
  results: [],
  isLoading: false,
  error: null,
  sourceFilters: [], // Empty means show all sources

  // Actions
  openModal: () => {
    set({ isModalOpen: true });
  },

  closeModal: () => {
    set({
      isModalOpen: false,
      query: '',
      results: [],
      isLoading: false,
      error: null,
      // Don't reset sourceFilters - persist user preference
    });
  },

  setQuery: (query: string) => {
    set({ query });
  },

  setResults: (results: SearchResult[]) => {
    set({ results, isLoading: false });
  },

  setLoading: (isLoading: boolean) => {
    set({ isLoading });
  },

  setError: (error: string | null) => {
    set({ error, isLoading: false });
  },

  setSourceFilters: (sourceFilters) => {
    set({ sourceFilters });
  },

  resetSearch: () => {
    set({
      query: '',
      results: [],
      isLoading: false,
      error: null,
      // Don't reset sourceFilters - persist user preference
    });
  },
}));
