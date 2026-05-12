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

describe('useTableSort - BUG-04 date sort chronological regression', () => {
  // Real-world data shape from production: mixed recording_start_time presence,
  // dates spanning ~12 months that previously produced "Apr → Nov → Mar"
  // ordering in the same direction (the Phase 36 BUG-04 symptom).
  const mixedDateMeetings = [
    {
      recording_id: 100,
      title: 'Apr 2026 call',
      recording_start_time: '2026-04-15T10:00:00Z',
      created_at: '2026-04-15T10:00:00Z',
    },
    {
      recording_id: 101,
      title: 'Nov 2025 call',
      recording_start_time: null, // null primary — must fall back to created_at
      created_at: '2025-11-20T10:00:00Z',
    },
    {
      recording_id: 102,
      title: 'Mar 2026 call',
      recording_start_time: '2026-03-01T10:00:00Z',
      created_at: '2026-03-01T10:00:00Z',
    },
    {
      recording_id: 103,
      title: 'Nov 2026 call',
      recording_start_time: '2026-11-30T10:00:00Z',
      created_at: '2026-11-30T10:00:00Z',
    },
    {
      recording_id: 104,
      title: 'No date',
      recording_start_time: null,
      created_at: null,
    },
  ];

  it('sorts mixed recording_start_time and null fields chronologically (desc)', () => {
    const { result } = renderHook(() => useTableSort(mixedDateMeetings, 'date'));
    expect(result.current.sortDirection).toBe('desc');
    const ids = result.current.sortedData.map((m: any) => m.recording_id);
    // Expected desc order: Nov 2026 > Apr 2026 > Mar 2026 > Nov 2025 > null-last
    expect(ids).toEqual([103, 100, 102, 101, 104]);
  });

  it('does NOT produce Apr → Nov → Mar ordering in descending direction', () => {
    const { result } = renderHook(() => useTableSort(mixedDateMeetings, 'date'));
    expect(result.current.sortDirection).toBe('desc');
    const titles = result.current.sortedData
      .map((m: any) => String(m.title))
      .filter((t) => t !== 'No date');
    // The literal Phase 36 BUG-04 symptom: assert that no "Apr" entry precedes
    // a "Nov" entry of a year that should come later.
    const aprIdx = titles.findIndex((t) => t.startsWith('Apr 2026'));
    const novOlderIdx = titles.findIndex((t) => t.startsWith('Nov 2025'));
    expect(aprIdx).toBeLessThan(novOlderIdx); // Apr 2026 must come before Nov 2025 in desc
    const novNewerIdx = titles.findIndex((t) => t.startsWith('Nov 2026'));
    expect(novNewerIdx).toBeLessThan(aprIdx); // Nov 2026 must come before Apr 2026 in desc
  });

  it('puts null/missing date rows last in ascending order', () => {
    const { result } = renderHook(() => useTableSort(mixedDateMeetings, 'date'));
    act(() => { result.current.handleSort('date'); }); // desc → asc
    expect(result.current.sortDirection).toBe('asc');
    const ids = result.current.sortedData.map((m: any) => m.recording_id);
    // Expected asc order: Nov 2025 (oldest) < Mar 2026 < Apr 2026 < Nov 2026 (newest) < null-last
    expect(ids).toEqual([101, 102, 100, 103, 104]);
    // null-row MUST be last in ascending too (not first — that's the trap)
    expect(ids[ids.length - 1]).toBe(104);
  });

  it('puts null/missing date rows last in descending order', () => {
    const { result } = renderHook(() => useTableSort(mixedDateMeetings, 'date'));
    expect(result.current.sortDirection).toBe('desc');
    const ids = result.current.sortedData.map((m: any) => m.recording_id);
    expect(ids[ids.length - 1]).toBe(104);
  });

  it('handles invalid date strings without crashing or interleaving', () => {
    const bogusDates = [
      { recording_id: 200, title: 'A', recording_start_time: 'not-a-date', created_at: null },
      { recording_id: 201, title: 'B', recording_start_time: '2026-05-01T00:00:00Z', created_at: null },
      { recording_id: 202, title: 'C', recording_start_time: '', created_at: null },
    ];
    const { result } = renderHook(() => useTableSort(bogusDates, 'date'));
    expect(result.current.sortDirection).toBe('desc');
    const ids = result.current.sortedData.map((m: any) => m.recording_id);
    // Only the real date (201) should be first; the two invalid-date rows go to bottom
    expect(ids[0]).toBe(201);
    // Last two must be the bogus rows (order between them is implementation-defined)
    expect(ids.slice(1).sort()).toEqual([200, 202]);
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
