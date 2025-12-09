import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAllTranscriptsSettings } from '../useAllTranscriptsSettings';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('useAllTranscriptsSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  describe('initialization', () => {
    it('should return default settings when localStorage is empty', () => {
      const { result } = renderHook(() => useAllTranscriptsSettings());

      expect(result.current.settings).toEqual({
        name: 'All Transcripts',
        icon: 'file-text',
      });
    });

    it('should load settings from localStorage on mount', () => {
      const storedSettings = { name: 'My Calls', icon: 'phone' };
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(storedSettings));

      const { result } = renderHook(() => useAllTranscriptsSettings());

      // Wait for useEffect to run
      expect(result.current.settings).toEqual(storedSettings);
    });

    it('should use defaults for invalid localStorage data', () => {
      localStorageMock.getItem.mockReturnValueOnce('invalid json');

      const { result } = renderHook(() => useAllTranscriptsSettings());

      expect(result.current.settings).toEqual({
        name: 'All Transcripts',
        icon: 'file-text',
      });
    });

    it('should use defaults when localStorage values are wrong types', () => {
      // Test defensive typing: non-string values should fall back to defaults
      const invalidSettings = { name: 123, icon: ['array'] };
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(invalidSettings));

      const { result } = renderHook(() => useAllTranscriptsSettings());

      expect(result.current.settings).toEqual({
        name: 'All Transcripts',
        icon: 'file-text',
      });
    });

    it('should use defaults for null/undefined values in stored settings', () => {
      const partialSettings = { name: null, icon: undefined };
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(partialSettings));

      const { result } = renderHook(() => useAllTranscriptsSettings());

      expect(result.current.settings).toEqual({
        name: 'All Transcripts',
        icon: 'file-text',
      });
    });
  });

  describe('updateSettings', () => {
    it('should update settings and persist to localStorage', () => {
      const { result } = renderHook(() => useAllTranscriptsSettings());

      act(() => {
        result.current.updateSettings({ name: 'My Library' });
      });

      expect(result.current.settings.name).toBe('My Library');
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'all-transcripts-settings',
        expect.stringContaining('My Library')
      );
    });

    it('should partially update settings while preserving others', () => {
      const { result } = renderHook(() => useAllTranscriptsSettings());

      act(() => {
        result.current.updateSettings({ icon: '📞' });
      });

      expect(result.current.settings).toEqual({
        name: 'All Transcripts', // unchanged
        icon: '📞', // updated
      });
    });

    it('should handle localStorage errors gracefully', () => {
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('QuotaExceeded');
      });

      const { result } = renderHook(() => useAllTranscriptsSettings());

      // Should not throw
      act(() => {
        result.current.updateSettings({ name: 'New Name' });
      });

      // Settings should still be updated in memory
      expect(result.current.settings.name).toBe('New Name');
    });
  });

  describe('resetSettings', () => {
    it('should reset settings to defaults', () => {
      const { result } = renderHook(() => useAllTranscriptsSettings());

      // First update settings
      act(() => {
        result.current.updateSettings({ name: 'Custom Name', icon: '🎯' });
      });

      expect(result.current.settings.name).toBe('Custom Name');

      // Then reset
      act(() => {
        result.current.resetSettings();
      });

      expect(result.current.settings).toEqual({
        name: 'All Transcripts',
        icon: 'file-text',
      });
    });

    it('should remove settings from localStorage on reset', () => {
      const { result } = renderHook(() => useAllTranscriptsSettings());

      act(() => {
        result.current.resetSettings();
      });

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('all-transcripts-settings');
    });

    it('should handle localStorage errors gracefully on reset', () => {
      localStorageMock.removeItem.mockImplementationOnce(() => {
        throw new Error('StorageError');
      });

      const { result } = renderHook(() => useAllTranscriptsSettings());

      // Should not throw
      act(() => {
        result.current.resetSettings();
      });

      // Settings should still be reset in memory
      expect(result.current.settings).toEqual({
        name: 'All Transcripts',
        icon: 'file-text',
      });
    });
  });

  describe('defaultSettings', () => {
    it('should expose defaultSettings', () => {
      const { result } = renderHook(() => useAllTranscriptsSettings());

      expect(result.current.defaultSettings).toEqual({
        name: 'All Transcripts',
        icon: 'file-text',
      });
    });

    it('defaultSettings should be constant', () => {
      const { result, rerender } = renderHook(() => useAllTranscriptsSettings());

      const initialDefaults = result.current.defaultSettings;

      act(() => {
        result.current.updateSettings({ name: 'Changed' });
      });
      rerender();

      // defaultSettings should remain the same reference
      expect(result.current.defaultSettings).toEqual(initialDefaults);
    });
  });
});
