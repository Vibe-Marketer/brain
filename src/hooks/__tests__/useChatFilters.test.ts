/**
 * useChatFilters Tests
 * 
 * Tests for chat filter state management hook including:
 * - Initial state with location state
 * - Filter manipulation (toggle, set, clear)
 * - API filter formatting
 * - Context attachments
 * - Computed hasActiveFilters
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChatFilters } from '../useChatFilters';
import type { ChatLocationState, ContextAttachment } from '@/types/chat';

describe('useChatFilters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have empty filters initially without location state', () => {
      const { result } = renderHook(() => useChatFilters());

      expect(result.current.filters.dateStart).toBeUndefined();
      expect(result.current.filters.dateEnd).toBeUndefined();
      expect(result.current.filters.speakers).toEqual([]);
      expect(result.current.filters.categories).toEqual([]);
      expect(result.current.filters.recordingIds).toEqual([]);
    });

    it('should have empty context attachments initially', () => {
      const { result } = renderHook(() => useChatFilters());
      expect(result.current.contextAttachments).toEqual([]);
    });

    it('should have hasActiveFilters=false initially', () => {
      const { result } = renderHook(() => useChatFilters());
      expect(result.current.hasActiveFilters).toBe(false);
    });

    it('should initialize with prefilter recording IDs from location state', () => {
      const initialLocationState: ChatLocationState = {
        prefilter: {
          recordingIds: [123, 456, 789],
        },
      };

      const { result } = renderHook(() =>
        useChatFilters({ initialLocationState })
      );

      expect(result.current.filters.recordingIds).toEqual([123, 456, 789]);
      expect(result.current.hasActiveFilters).toBe(true);
    });

    it('should initialize with initial context from location state', () => {
      const initialContext: ContextAttachment[] = [
        { type: 'call', id: 1, title: 'Test Call', date: '2024-01-01' },
        { type: 'call', id: 2, title: 'Another Call', date: '2024-01-02' },
      ];

      const initialLocationState: ChatLocationState = {
        initialContext,
      };

      const { result } = renderHook(() =>
        useChatFilters({ initialLocationState })
      );

      expect(result.current.contextAttachments).toEqual(initialContext);
    });

    it('should handle location state with both prefilter and initialContext', () => {
      const initialContext: ContextAttachment[] = [
        { type: 'call', id: 1, title: 'Test Call', date: '2024-01-01' },
      ];

      const initialLocationState: ChatLocationState = {
        prefilter: {
          recordingIds: [100],
        },
        initialContext,
      };

      const { result } = renderHook(() =>
        useChatFilters({ initialLocationState })
      );

      expect(result.current.filters.recordingIds).toEqual([100]);
      expect(result.current.contextAttachments).toEqual(initialContext);
    });
  });

  describe('Date Range', () => {
    it('should set date range correctly', () => {
      const { result } = renderHook(() => useChatFilters());

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      act(() => {
        result.current.setDateRange(startDate, endDate);
      });

      expect(result.current.filters.dateStart).toEqual(startDate);
      expect(result.current.filters.dateEnd).toEqual(endDate);
      expect(result.current.hasActiveFilters).toBe(true);
    });

    it('should set only start date', () => {
      const { result } = renderHook(() => useChatFilters());
      const startDate = new Date('2024-01-01');

      act(() => {
        result.current.setDateRange(startDate, undefined);
      });

      expect(result.current.filters.dateStart).toEqual(startDate);
      expect(result.current.filters.dateEnd).toBeUndefined();
      expect(result.current.hasActiveFilters).toBe(true);
    });

    it('should set only end date', () => {
      const { result } = renderHook(() => useChatFilters());
      const endDate = new Date('2024-12-31');

      act(() => {
        result.current.setDateRange(undefined, endDate);
      });

      expect(result.current.filters.dateStart).toBeUndefined();
      expect(result.current.filters.dateEnd).toEqual(endDate);
      expect(result.current.hasActiveFilters).toBe(true);
    });

    it('should clear date range when both undefined', () => {
      const { result } = renderHook(() => useChatFilters());

      // Set dates first
      act(() => {
        result.current.setDateRange(new Date(), new Date());
      });

      // Clear dates
      act(() => {
        result.current.setDateRange(undefined, undefined);
      });

      expect(result.current.filters.dateStart).toBeUndefined();
      expect(result.current.filters.dateEnd).toBeUndefined();
    });
  });

  describe('Speakers', () => {
    it('should toggle speaker on when not present', () => {
      const { result } = renderHook(() => useChatFilters());

      act(() => {
        result.current.toggleSpeaker('John Doe');
      });

      expect(result.current.filters.speakers).toContain('John Doe');
      expect(result.current.hasActiveFilters).toBe(true);
    });

    it('should toggle speaker off when present', () => {
      const { result } = renderHook(() => useChatFilters());

      // Add speaker
      act(() => {
        result.current.toggleSpeaker('John Doe');
      });

      // Remove speaker
      act(() => {
        result.current.toggleSpeaker('John Doe');
      });

      expect(result.current.filters.speakers).not.toContain('John Doe');
      expect(result.current.filters.speakers).toHaveLength(0);
    });

    it('should toggle multiple speakers independently', () => {
      const { result } = renderHook(() => useChatFilters());

      act(() => {
        result.current.toggleSpeaker('John Doe');
        result.current.toggleSpeaker('Jane Smith');
      });

      expect(result.current.filters.speakers).toContain('John Doe');
      expect(result.current.filters.speakers).toContain('Jane Smith');
      expect(result.current.filters.speakers).toHaveLength(2);

      act(() => {
        result.current.toggleSpeaker('John Doe');
      });

      expect(result.current.filters.speakers).not.toContain('John Doe');
      expect(result.current.filters.speakers).toContain('Jane Smith');
      expect(result.current.filters.speakers).toHaveLength(1);
    });
  });

  describe('Categories', () => {
    it('should toggle category on when not present', () => {
      const { result } = renderHook(() => useChatFilters());

      act(() => {
        result.current.toggleCategory('Sales');
      });

      expect(result.current.filters.categories).toContain('Sales');
      expect(result.current.hasActiveFilters).toBe(true);
    });

    it('should toggle category off when present', () => {
      const { result } = renderHook(() => useChatFilters());

      act(() => {
        result.current.toggleCategory('Sales');
      });

      act(() => {
        result.current.toggleCategory('Sales');
      });

      expect(result.current.filters.categories).not.toContain('Sales');
      expect(result.current.filters.categories).toHaveLength(0);
    });

    it('should toggle multiple categories independently', () => {
      const { result } = renderHook(() => useChatFilters());

      act(() => {
        result.current.toggleCategory('Sales');
        result.current.toggleCategory('Support');
        result.current.toggleCategory('Marketing');
      });

      expect(result.current.filters.categories).toEqual(['Sales', 'Support', 'Marketing']);

      act(() => {
        result.current.toggleCategory('Support');
      });

      expect(result.current.filters.categories).toEqual(['Sales', 'Marketing']);
    });
  });

  describe('Recording IDs', () => {
    it('should toggle call on when not present', () => {
      const { result } = renderHook(() => useChatFilters());

      act(() => {
        result.current.toggleCall(123);
      });

      expect(result.current.filters.recordingIds).toContain(123);
      expect(result.current.hasActiveFilters).toBe(true);
    });

    it('should toggle call off when present', () => {
      const { result } = renderHook(() => useChatFilters());

      act(() => {
        result.current.toggleCall(123);
      });

      act(() => {
        result.current.toggleCall(123);
      });

      expect(result.current.filters.recordingIds).not.toContain(123);
    });

    it('should add recording ID only if not already present', () => {
      const { result } = renderHook(() => useChatFilters());

      act(() => {
        result.current.addRecordingId(123);
      });

      expect(result.current.filters.recordingIds).toEqual([123]);

      // Try to add same ID again
      act(() => {
        result.current.addRecordingId(123);
      });

      // Should still only have one
      expect(result.current.filters.recordingIds).toEqual([123]);
    });

    it('should add new recording IDs', () => {
      const { result } = renderHook(() => useChatFilters());

      act(() => {
        result.current.addRecordingId(123);
        result.current.addRecordingId(456);
      });

      expect(result.current.filters.recordingIds).toEqual([123, 456]);
    });
  });

  describe('Clear Filters', () => {
    it('should clear all filters', () => {
      const { result } = renderHook(() => useChatFilters());

      // Set various filters
      act(() => {
        result.current.setDateRange(new Date(), new Date());
        result.current.toggleSpeaker('John');
        result.current.toggleCategory('Sales');
        result.current.toggleCall(123);
      });

      expect(result.current.hasActiveFilters).toBe(true);

      // Clear all
      act(() => {
        result.current.clearFilters();
      });

      expect(result.current.filters.dateStart).toBeUndefined();
      expect(result.current.filters.dateEnd).toBeUndefined();
      expect(result.current.filters.speakers).toEqual([]);
      expect(result.current.filters.categories).toEqual([]);
      expect(result.current.filters.recordingIds).toEqual([]);
      expect(result.current.hasActiveFilters).toBe(false);
    });
  });

  describe('API Filters', () => {
    it('should format filters for API without empty arrays', () => {
      const { result } = renderHook(() => useChatFilters());

      // Empty filters should have undefined values
      expect(result.current.apiFilters.date_start).toBeUndefined();
      expect(result.current.apiFilters.date_end).toBeUndefined();
      expect(result.current.apiFilters.speakers).toBeUndefined();
      expect(result.current.apiFilters.categories).toBeUndefined();
      expect(result.current.apiFilters.recording_ids).toBeUndefined();
    });

    it('should format date to ISO string', () => {
      const { result } = renderHook(() => useChatFilters());

      const startDate = new Date('2024-01-15T10:30:00Z');
      const endDate = new Date('2024-12-31T23:59:59Z');

      act(() => {
        result.current.setDateRange(startDate, endDate);
      });

      expect(result.current.apiFilters.date_start).toBe(startDate.toISOString());
      expect(result.current.apiFilters.date_end).toBe(endDate.toISOString());
    });

    it('should include speakers array when not empty', () => {
      const { result } = renderHook(() => useChatFilters());

      act(() => {
        result.current.toggleSpeaker('John');
        result.current.toggleSpeaker('Jane');
      });

      expect(result.current.apiFilters.speakers).toEqual(['John', 'Jane']);
    });

    it('should include categories array when not empty', () => {
      const { result } = renderHook(() => useChatFilters());

      act(() => {
        result.current.toggleCategory('Sales');
      });

      expect(result.current.apiFilters.categories).toEqual(['Sales']);
    });

    it('should include recording_ids array when not empty', () => {
      const { result } = renderHook(() => useChatFilters());

      act(() => {
        result.current.addRecordingId(123);
        result.current.addRecordingId(456);
      });

      expect(result.current.apiFilters.recording_ids).toEqual([123, 456]);
    });

    it('should be memoized', () => {
      const { result, rerender } = renderHook(() => useChatFilters());

      const firstApiFilters = result.current.apiFilters;

      // Rerender without changing filters
      rerender();

      expect(result.current.apiFilters).toBe(firstApiFilters);
    });
  });

  describe('Context Attachments', () => {
    it('should add call attachment', () => {
      const { result } = renderHook(() => useChatFilters());

      const call = {
        recording_id: 123,
        title: 'Test Meeting',
        created_at: '2024-01-15T10:00:00Z',
      };

      act(() => {
        result.current.addCallAttachment(call);
      });

      expect(result.current.contextAttachments).toHaveLength(1);
      expect(result.current.contextAttachments[0]).toEqual({
        type: 'call',
        id: 123,
        title: 'Test Meeting',
        date: '2024-01-15T10:00:00Z',
      });
    });

    it('should add multiple attachments', () => {
      const { result } = renderHook(() => useChatFilters());

      act(() => {
        result.current.addCallAttachment({
          recording_id: 1,
          title: 'Call 1',
          created_at: '2024-01-01',
        });
        result.current.addCallAttachment({
          recording_id: 2,
          title: 'Call 2',
          created_at: '2024-01-02',
        });
      });

      expect(result.current.contextAttachments).toHaveLength(2);
    });

    it('should remove attachment by ID', () => {
      const { result } = renderHook(() => useChatFilters());

      act(() => {
        result.current.addCallAttachment({
          recording_id: 1,
          title: 'Call 1',
          created_at: '2024-01-01',
        });
        result.current.addCallAttachment({
          recording_id: 2,
          title: 'Call 2',
          created_at: '2024-01-02',
        });
      });

      act(() => {
        result.current.removeAttachment(1);
      });

      expect(result.current.contextAttachments).toHaveLength(1);
      expect(result.current.contextAttachments[0].id).toBe(2);
    });

    it('should set context attachments directly', () => {
      const { result } = renderHook(() => useChatFilters());

      const attachments: ContextAttachment[] = [
        { type: 'call', id: 100, title: 'Direct Set', date: '2024-01-01' },
      ];

      act(() => {
        result.current.setContextAttachments(attachments);
      });

      expect(result.current.contextAttachments).toEqual(attachments);
    });
  });

  describe('hasActiveFilters', () => {
    it('should be true when dateStart is set', () => {
      const { result } = renderHook(() => useChatFilters());

      act(() => {
        result.current.setDateRange(new Date(), undefined);
      });

      expect(result.current.hasActiveFilters).toBe(true);
    });

    it('should be true when dateEnd is set', () => {
      const { result } = renderHook(() => useChatFilters());

      act(() => {
        result.current.setDateRange(undefined, new Date());
      });

      expect(result.current.hasActiveFilters).toBe(true);
    });

    it('should be true when speakers are set', () => {
      const { result } = renderHook(() => useChatFilters());

      act(() => {
        result.current.toggleSpeaker('John');
      });

      expect(result.current.hasActiveFilters).toBe(true);
    });

    it('should be true when categories are set', () => {
      const { result } = renderHook(() => useChatFilters());

      act(() => {
        result.current.toggleCategory('Sales');
      });

      expect(result.current.hasActiveFilters).toBe(true);
    });

    it('should be true when recordingIds are set', () => {
      const { result } = renderHook(() => useChatFilters());

      act(() => {
        result.current.addRecordingId(123);
      });

      expect(result.current.hasActiveFilters).toBe(true);
    });

    it('should be false when all filters are cleared', () => {
      const { result } = renderHook(() => useChatFilters());

      // Add filters
      act(() => {
        result.current.toggleSpeaker('John');
      });

      expect(result.current.hasActiveFilters).toBe(true);

      // Remove filter
      act(() => {
        result.current.toggleSpeaker('John');
      });

      expect(result.current.hasActiveFilters).toBe(false);
    });

    it('should be memoized', () => {
      const { result, rerender } = renderHook(() => useChatFilters());

      // Get initial value
      const initial = result.current.hasActiveFilters;

      // Rerender without changing filters
      rerender();

      // Should be the same reference (primitive, so same value)
      expect(result.current.hasActiveFilters).toBe(initial);
    });
  });

  describe('setFilters Direct Access', () => {
    it('should allow direct filter state modification', () => {
      const { result } = renderHook(() => useChatFilters());

      act(() => {
        result.current.setFilters({
          dateStart: new Date('2024-01-01'),
          dateEnd: new Date('2024-12-31'),
          speakers: ['Direct', 'Set'],
          categories: ['Test'],
          recordingIds: [1, 2, 3],
        });
      });

      expect(result.current.filters.speakers).toEqual(['Direct', 'Set']);
      expect(result.current.filters.categories).toEqual(['Test']);
      expect(result.current.filters.recordingIds).toEqual([1, 2, 3]);
    });

    it('should support functional updates', () => {
      const { result } = renderHook(() => useChatFilters());

      act(() => {
        result.current.toggleSpeaker('Initial');
      });

      act(() => {
        result.current.setFilters((prev) => ({
          ...prev,
          speakers: [...prev.speakers, 'Added'],
        }));
      });

      expect(result.current.filters.speakers).toEqual(['Initial', 'Added']);
    });
  });
});
