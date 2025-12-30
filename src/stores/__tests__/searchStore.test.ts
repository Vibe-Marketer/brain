import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { useSearchStore } from '../searchStore';
import type { SearchResult } from '@/types/search';

describe('searchStore', () => {
  // Reset store state before each test
  beforeEach(() => {
    act(() => {
      useSearchStore.setState({
        isModalOpen: false,
        query: '',
        results: [],
        isLoading: false,
        error: null,
      });
    });
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = useSearchStore.getState();

      expect(state.isModalOpen).toBe(false);
      expect(state.query).toBe('');
      expect(state.results).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('openModal', () => {
    it('should set isModalOpen to true', () => {
      const { openModal } = useSearchStore.getState();

      act(() => {
        openModal();
      });

      expect(useSearchStore.getState().isModalOpen).toBe(true);
    });

    it('should not affect other state when opening modal', () => {
      // Set some initial state
      act(() => {
        useSearchStore.setState({
          query: 'test query',
          isLoading: true,
        });
      });

      const { openModal } = useSearchStore.getState();

      act(() => {
        openModal();
      });

      const state = useSearchStore.getState();
      expect(state.isModalOpen).toBe(true);
      expect(state.query).toBe('test query');
      expect(state.isLoading).toBe(true);
    });
  });

  describe('closeModal', () => {
    it('should set isModalOpen to false', () => {
      act(() => {
        useSearchStore.setState({ isModalOpen: true });
      });

      const { closeModal } = useSearchStore.getState();

      act(() => {
        closeModal();
      });

      expect(useSearchStore.getState().isModalOpen).toBe(false);
    });

    it('should reset query when closing modal', () => {
      act(() => {
        useSearchStore.setState({
          isModalOpen: true,
          query: 'search query',
        });
      });

      const { closeModal } = useSearchStore.getState();

      act(() => {
        closeModal();
      });

      expect(useSearchStore.getState().query).toBe('');
    });

    it('should clear results when closing modal', () => {
      const mockResults: SearchResult[] = [
        {
          id: '1',
          type: 'transcript',
          title: 'Test Result',
          snippet: 'Test snippet',
          sourceCallId: 'call-1',
          sourceCallTitle: 'Test Call',
        },
      ];

      act(() => {
        useSearchStore.setState({
          isModalOpen: true,
          results: mockResults,
        });
      });

      const { closeModal } = useSearchStore.getState();

      act(() => {
        closeModal();
      });

      expect(useSearchStore.getState().results).toEqual([]);
    });

    it('should reset isLoading and error when closing modal', () => {
      act(() => {
        useSearchStore.setState({
          isModalOpen: true,
          isLoading: true,
          error: 'Some error',
        });
      });

      const { closeModal } = useSearchStore.getState();

      act(() => {
        closeModal();
      });

      const state = useSearchStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('setQuery', () => {
    it('should update the query', () => {
      const { setQuery } = useSearchStore.getState();

      act(() => {
        setQuery('new search query');
      });

      expect(useSearchStore.getState().query).toBe('new search query');
    });

    it('should handle empty string', () => {
      act(() => {
        useSearchStore.setState({ query: 'existing query' });
      });

      const { setQuery } = useSearchStore.getState();

      act(() => {
        setQuery('');
      });

      expect(useSearchStore.getState().query).toBe('');
    });

    it('should handle special characters', () => {
      const { setQuery } = useSearchStore.getState();

      act(() => {
        setQuery('query with "quotes" & <special> chars');
      });

      expect(useSearchStore.getState().query).toBe('query with "quotes" & <special> chars');
    });
  });

  describe('setResults', () => {
    it('should update results', () => {
      const mockResults: SearchResult[] = [
        {
          id: '1',
          type: 'transcript',
          title: 'Result 1',
          snippet: 'Snippet 1',
          sourceCallId: 'call-1',
          sourceCallTitle: 'Call 1',
        },
        {
          id: '2',
          type: 'insight',
          title: 'Result 2',
          snippet: 'Snippet 2',
          sourceCallId: 'call-2',
          sourceCallTitle: 'Call 2',
          metadata: {
            insightType: 'pain',
          },
        },
      ];

      const { setResults } = useSearchStore.getState();

      act(() => {
        setResults(mockResults);
      });

      expect(useSearchStore.getState().results).toEqual(mockResults);
    });

    it('should set isLoading to false when setting results', () => {
      act(() => {
        useSearchStore.setState({ isLoading: true });
      });

      const { setResults } = useSearchStore.getState();

      act(() => {
        setResults([]);
      });

      expect(useSearchStore.getState().isLoading).toBe(false);
    });

    it('should handle empty results array', () => {
      const mockResults: SearchResult[] = [
        {
          id: '1',
          type: 'transcript',
          title: 'Result',
          snippet: 'Snippet',
          sourceCallId: 'call-1',
          sourceCallTitle: 'Call',
        },
      ];

      act(() => {
        useSearchStore.setState({ results: mockResults });
      });

      const { setResults } = useSearchStore.getState();

      act(() => {
        setResults([]);
      });

      expect(useSearchStore.getState().results).toEqual([]);
    });
  });

  describe('setLoading', () => {
    it('should set isLoading to true', () => {
      const { setLoading } = useSearchStore.getState();

      act(() => {
        setLoading(true);
      });

      expect(useSearchStore.getState().isLoading).toBe(true);
    });

    it('should set isLoading to false', () => {
      act(() => {
        useSearchStore.setState({ isLoading: true });
      });

      const { setLoading } = useSearchStore.getState();

      act(() => {
        setLoading(false);
      });

      expect(useSearchStore.getState().isLoading).toBe(false);
    });
  });

  describe('setError', () => {
    it('should set error message', () => {
      const { setError } = useSearchStore.getState();

      act(() => {
        setError('Search failed');
      });

      expect(useSearchStore.getState().error).toBe('Search failed');
    });

    it('should clear error with null', () => {
      act(() => {
        useSearchStore.setState({ error: 'Previous error' });
      });

      const { setError } = useSearchStore.getState();

      act(() => {
        setError(null);
      });

      expect(useSearchStore.getState().error).toBeNull();
    });

    it('should set isLoading to false when setting error', () => {
      act(() => {
        useSearchStore.setState({ isLoading: true });
      });

      const { setError } = useSearchStore.getState();

      act(() => {
        setError('Error occurred');
      });

      expect(useSearchStore.getState().isLoading).toBe(false);
    });
  });

  describe('resetSearch', () => {
    it('should reset query, results, isLoading, and error', () => {
      const mockResults: SearchResult[] = [
        {
          id: '1',
          type: 'quote',
          title: 'Result',
          snippet: 'Snippet',
          sourceCallId: 'call-1',
          sourceCallTitle: 'Call',
        },
      ];

      act(() => {
        useSearchStore.setState({
          query: 'some query',
          results: mockResults,
          isLoading: true,
          error: 'some error',
        });
      });

      const { resetSearch } = useSearchStore.getState();

      act(() => {
        resetSearch();
      });

      const state = useSearchStore.getState();
      expect(state.query).toBe('');
      expect(state.results).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should not affect isModalOpen', () => {
      act(() => {
        useSearchStore.setState({
          isModalOpen: true,
          query: 'query',
        });
      });

      const { resetSearch } = useSearchStore.getState();

      act(() => {
        resetSearch();
      });

      expect(useSearchStore.getState().isModalOpen).toBe(true);
    });
  });

  describe('action combinations', () => {
    it('should handle typical search flow', () => {
      const { openModal, setQuery, setLoading, setResults, closeModal } =
        useSearchStore.getState();

      // Open modal
      act(() => {
        openModal();
      });
      expect(useSearchStore.getState().isModalOpen).toBe(true);

      // Set query
      act(() => {
        setQuery('test search');
      });
      expect(useSearchStore.getState().query).toBe('test search');

      // Start loading
      act(() => {
        setLoading(true);
      });
      expect(useSearchStore.getState().isLoading).toBe(true);

      // Set results
      const results: SearchResult[] = [
        {
          id: '1',
          type: 'transcript',
          title: 'Found',
          snippet: 'Content',
          sourceCallId: 'call-1',
          sourceCallTitle: 'Call',
        },
      ];
      act(() => {
        setResults(results);
      });
      expect(useSearchStore.getState().results).toEqual(results);
      expect(useSearchStore.getState().isLoading).toBe(false);

      // Close modal
      act(() => {
        closeModal();
      });
      const finalState = useSearchStore.getState();
      expect(finalState.isModalOpen).toBe(false);
      expect(finalState.query).toBe('');
      expect(finalState.results).toEqual([]);
    });

    it('should handle error flow', () => {
      const { openModal, setQuery, setLoading, setError, closeModal } =
        useSearchStore.getState();

      act(() => {
        openModal();
        setQuery('failing query');
        setLoading(true);
      });

      act(() => {
        setError('Network error');
      });

      const state = useSearchStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Network error');

      act(() => {
        closeModal();
      });

      expect(useSearchStore.getState().error).toBeNull();
    });
  });
});
