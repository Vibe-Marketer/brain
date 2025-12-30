import { create } from 'zustand';
import type { SearchResult, SearchState, SearchActions } from '@/types/search';

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

  resetSearch: () => {
    set({
      query: '',
      results: [],
      isLoading: false,
      error: null,
    });
  },
}));
