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

  describe('closeModal', () => {

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

  });

  describe('setResults', () => {

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

  });

  describe('setError', () => {

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

});
