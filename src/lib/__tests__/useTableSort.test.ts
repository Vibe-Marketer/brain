import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTableSort } from '@/hooks/useTableSort';

// Mock Meeting-like data for sort tests
const mockMeetings = [
  {
    recording_id: 1,
    title: 'Charlie Call',
    recording_start_time: '2024-03-10T10:00:00Z',
    created_at: '2024-03-10T10:00:00Z',
    source_metadata: { duration_seconds: 300 },
    calendar_invitees: [{ email: 'a@x.com' }, { email: 'b@x.com' }, { email: 'c@x.com' }],
    source_platform: 'zoom',
  },
  {
    recording_id: 2,
    title: 'Alpha Meeting',
    recording_start_time: '2024-01-05T09:00:00Z',
    created_at: '2024-01-05T09:00:00Z',
    source_metadata: { duration_seconds: 60 },
    calendar_invitees: [{ email: 'd@x.com' }],
    source_platform: 'fathom',
  },
  {
    recording_id: 3,
    title: 'Beta Session',
    recording_start_time: '2024-06-20T14:00:00Z',
    created_at: '2024-06-20T14:00:00Z',
    source_metadata: { duration_seconds: 120 },
    calendar_invitees: [{ email: 'e@x.com' }, { email: 'f@x.com' }],
    source_platform: 'youtube',
  },
];

describe('useTableSort - title field', () => {
  it('should sort by title ascending', () => {
    const { result } = renderHook(() => useTableSort(mockMeetings, 'title'));
    // initialField='title' starts at desc, one click toggles to asc
    act(() => { result.current.handleSort('title'); });
    expect(result.current.sortDirection).toBe('asc');
    const titles = result.current.sortedData.map((m: any) => m.title);
    expect(titles).toEqual(['Alpha Meeting', 'Beta Session', 'Charlie Call']);
  });

  it('should sort by title descending', () => {
    const { result } = renderHook(() => useTableSort(mockMeetings, 'date'));
    act(() => {
      result.current.handleSort('title');
    });
    // New field starts at desc
    expect(result.current.sortDirection).toBe('desc');
    const titles = result.current.sortedData.map((m: any) => m.title);
    expect(titles).toEqual(['Charlie Call', 'Beta Session', 'Alpha Meeting']);
  });
});

describe('useTableSort - date field', () => {
  it('should sort by date ascending', () => {
    const { result } = renderHook(() => useTableSort(mockMeetings, 'date'));
    act(() => {
      result.current.handleSort('date');
    });
    // toggles from desc to asc
    expect(result.current.sortDirection).toBe('asc');
    const ids = result.current.sortedData.map((m: any) => m.recording_id);
    expect(ids).toEqual([2, 1, 3]); // Jan < Mar < Jun
  });

  it('should sort by date descending', () => {
    const { result } = renderHook(() => useTableSort(mockMeetings, 'date'));
    expect(result.current.sortDirection).toBe('desc');
    const ids = result.current.sortedData.map((m: any) => m.recording_id);
    expect(ids).toEqual([3, 1, 2]); // Jun > Mar > Jan
  });
});

describe('useTableSort - duration field', () => {
  it('should sort by duration ascending (shortest first)', () => {
    const { result } = renderHook(() => useTableSort(mockMeetings, 'date'));
    act(() => {
      result.current.handleSort('duration');
      result.current.handleSort('duration'); // desc -> asc
    });
    expect(result.current.sortDirection).toBe('asc');
    const ids = result.current.sortedData.map((m: any) => m.recording_id);
    expect(ids).toEqual([2, 3, 1]); // 60s < 120s < 300s
  });

  it('should sort by duration descending (longest first)', () => {
    const { result } = renderHook(() => useTableSort(mockMeetings, 'date'));
    act(() => {
      result.current.handleSort('duration');
    });
    expect(result.current.sortDirection).toBe('desc');
    const ids = result.current.sortedData.map((m: any) => m.recording_id);
    expect(ids).toEqual([1, 3, 2]); // 300s > 120s > 60s
  });
});

describe('useTableSort - participants field', () => {
  it('should sort by participant count ascending (fewest first)', () => {
    const { result } = renderHook(() => useTableSort(mockMeetings, 'date'));
    act(() => {
      result.current.handleSort('participants');
      result.current.handleSort('participants'); // desc -> asc
    });
    expect(result.current.sortDirection).toBe('asc');
    const ids = result.current.sortedData.map((m: any) => m.recording_id);
    expect(ids).toEqual([2, 3, 1]); // 1 < 2 < 3
  });

  it('should sort by participant count descending (most first)', () => {
    const { result } = renderHook(() => useTableSort(mockMeetings, 'date'));
    act(() => {
      result.current.handleSort('participants');
    });
    expect(result.current.sortDirection).toBe('desc');
    const ids = result.current.sortedData.map((m: any) => m.recording_id);
    expect(ids).toEqual([1, 3, 2]); // 3 > 2 > 1
  });
});

describe('useTableSort - source field', () => {
  it('should sort by source ascending (alphabetical)', () => {
    const { result } = renderHook(() => useTableSort(mockMeetings, 'date'));
    act(() => {
      result.current.handleSort('source');
      result.current.handleSort('source'); // desc -> asc
    });
    expect(result.current.sortDirection).toBe('asc');
    const platforms = result.current.sortedData.map((m: any) => m.source_platform);
    expect(platforms).toEqual(['fathom', 'youtube', 'zoom']); // alphabetical asc
  });

  it('should sort by source descending (reverse alphabetical)', () => {
    const { result } = renderHook(() => useTableSort(mockMeetings, 'date'));
    act(() => {
      result.current.handleSort('source');
    });
    expect(result.current.sortDirection).toBe('desc');
    const platforms = result.current.sortedData.map((m: any) => m.source_platform);
    expect(platforms).toEqual(['zoom', 'youtube', 'fathom']); // reverse alphabetical
  });
});

describe('useTableSort - handleSort behavior', () => {
  it('should toggle direction when clicking same field', () => {
    const { result } = renderHook(() => useTableSort(mockMeetings, 'date'));
    expect(result.current.sortDirection).toBe('desc');

    act(() => { result.current.handleSort('date'); });
    expect(result.current.sortDirection).toBe('asc');

    act(() => { result.current.handleSort('date'); });
    expect(result.current.sortDirection).toBe('desc');
  });

  it('should reset to desc when clicking a new field', () => {
    const { result } = renderHook(() => useTableSort(mockMeetings, 'date'));
    act(() => { result.current.handleSort('date'); }); // now asc
    expect(result.current.sortDirection).toBe('asc');

    act(() => { result.current.handleSort('title'); }); // new field → resets to desc
    expect(result.current.sortField).toBe('title');
    expect(result.current.sortDirection).toBe('desc');
  });

  it('should not mutate the original data array', () => {
    const originalIds = mockMeetings.map(m => m.recording_id);
    const { result } = renderHook(() => useTableSort(mockMeetings, 'title'));
    act(() => { result.current.handleSort('title'); });
    // sortedData is a new array
    expect(result.current.sortedData).not.toBe(mockMeetings);
    // original remains unchanged
    expect(mockMeetings.map(m => m.recording_id)).toEqual(originalIds);
  });
});
