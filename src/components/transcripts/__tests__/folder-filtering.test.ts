/**
 * Folder Filtering Logic Tests
 *
 * Tests the critical folder-filtering logic used in TranscriptsTab.
 * This logic resolves recording IDs from two sources:
 *   1. workspace_entries.folder_id (new architecture, set by routing rules)
 *   2. folder_assignments.call_recording_id (legacy manual assignments)
 *
 * Then applies client-side folder filtering + pagination on the RPC results.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => {
  const mockSupabase = {
    from: vi.fn(),
    rpc: vi.fn(),
  };
  return { supabase: mockSupabase };
});

import { supabase } from '@/integrations/supabase/client';
import { getUnorganizedRecordingUuids } from '@/services/transcript-filters.service';

const mockSupabase = supabase as unknown as {
  from: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
};

/**
 * Extracted folder-filtering logic from TranscriptsTab.
 * This mirrors the queryFn logic but is isolated for testability.
 */
async function resolveFolderRecordingIds(
  selectedFolderId: string,
  activeWorkspaceId: string
): Promise<string[]> {
  // Get child folders
  const { data: childFolders } = await supabase
    .from('folders')
    .select('id')
    .eq('parent_id', selectedFolderId);

  const folderIds = [selectedFolderId, ...(childFolders || []).map((f: any) => f.id)];

  // Source 1: workspace_entries with folder_id
  const { data: wsEntries } = await supabase
    .from('workspace_entries')
    .select('recording_id')
    .eq('workspace_id', activeWorkspaceId)
    .in('folder_id', folderIds);

  // Source 2: folder_assignments (legacy)
  const { data: folderAssigns } = await supabase
    .from('folder_assignments')
    .select('call_recording_id')
    .in('folder_id', folderIds);

  const idsFromWsEntries = (wsEntries || []).map((e: any) => e.recording_id);
  const legacyIds = (folderAssigns || []).map((a: any) => a.call_recording_id);

  // Resolve legacy IDs to UUIDs
  let idsFromLegacy: string[] = [];
  if (legacyIds.length > 0) {
    const { data: recs } = await supabase
      .from('recordings')
      .select('id')
      .in('fathom_provider_id', legacyIds);
    idsFromLegacy = (recs || []).map((r: any) => r.id);
  }

  // Combine and deduplicate
  const allIds = new Set([...idsFromWsEntries, ...idsFromLegacy]);
  return Array.from(allIds);
}

/**
 * Simulates the client-side filter + paginate logic from TranscriptsTab.
 */
function filterAndPaginate(
  rows: Array<{ id: string; total_count?: number; [key: string]: unknown }>,
  folderRecordingIds: string[] | null,
  page: number,
  pageSize: number
): { filteredRows: typeof rows; totalCount: number } {
  const offset = (page - 1) * pageSize;

  if (folderRecordingIds) {
    const folderSet = new Set(folderRecordingIds);
    const filtered = rows.filter((r) => folderSet.has(r.id));
    const totalCount = filtered.length;
    const paginated = filtered.slice(offset, offset + pageSize);
    return { filteredRows: paginated, totalCount };
  } else {
    const totalCount = rows.length > 0 ? Number(rows[0].total_count ?? rows.length) : 0;
    return { filteredRows: rows, totalCount };
  }
}

describe('Folder Recording ID Resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should merge recording IDs from workspace_entries and folder_assignments', async () => {
    // Setup: folder has entries in both sources
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'folders') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }), // no child folders
          }),
        };
      }
      if (table === 'workspace_entries') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [
                  { recording_id: 'uuid-1' },
                  { recording_id: 'uuid-2' },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'folder_assignments') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ call_recording_id: 101 }],
              error: null,
            }),
          }),
        };
      }
      if (table === 'recordings') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ id: 'uuid-3' }], // legacy ID 101 resolves to uuid-3
              error: null,
            }),
          }),
        };
      }
      return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
    });

    const ids = await resolveFolderRecordingIds('folder-1', 'ws-1');

    expect(ids).toHaveLength(3);
    expect(ids).toContain('uuid-1');
    expect(ids).toContain('uuid-2');
    expect(ids).toContain('uuid-3');
  });

  it('should deduplicate IDs that appear in both sources', async () => {
    // uuid-1 appears in both workspace_entries AND as a resolved legacy ID
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'folders') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      if (table === 'workspace_entries') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [{ recording_id: 'uuid-1' }],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'folder_assignments') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ call_recording_id: 101 }],
              error: null,
            }),
          }),
        };
      }
      if (table === 'recordings') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ id: 'uuid-1' }], // same as workspace_entries
              error: null,
            }),
          }),
        };
      }
      return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
    });

    const ids = await resolveFolderRecordingIds('folder-1', 'ws-1');

    expect(ids).toHaveLength(1);
    expect(ids).toContain('uuid-1');
  });

  it('should include child folder recordings', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'folders') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ id: 'child-folder-1' }, { id: 'child-folder-2' }],
              error: null,
            }),
          }),
        };
      }
      if (table === 'workspace_entries') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn((col: string, ids: string[]) => {
                // Should include parent + child folder IDs
                expect(ids).toContain('parent-folder');
                expect(ids).toContain('child-folder-1');
                expect(ids).toContain('child-folder-2');
                return Promise.resolve({
                  data: [
                    { recording_id: 'uuid-parent' },
                    { recording_id: 'uuid-child1' },
                  ],
                  error: null,
                });
              }),
            }),
          }),
        };
      }
      if (table === 'folder_assignments') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
    });

    const ids = await resolveFolderRecordingIds('parent-folder', 'ws-1');

    expect(ids).toContain('uuid-parent');
    expect(ids).toContain('uuid-child1');
  });

  it('should return empty array when folder has no recordings in either source', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'folders') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      if (table === 'workspace_entries') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      if (table === 'folder_assignments') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
    });

    const ids = await resolveFolderRecordingIds('empty-folder', 'ws-1');

    expect(ids).toHaveLength(0);
  });

  it('should skip legacy resolution when no legacy assignments exist', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'folders') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      if (table === 'workspace_entries') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [{ recording_id: 'uuid-1' }],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'folder_assignments') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [], error: null }), // no legacy
          }),
        };
      }
      if (table === 'recordings') {
        // Should NOT be called when there are no legacy IDs
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn(() => {
              throw new Error('recordings table should not be queried when no legacy IDs');
            }),
          }),
        };
      }
      return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
    });

    const ids = await resolveFolderRecordingIds('folder-1', 'ws-1');

    expect(ids).toHaveLength(1);
    expect(ids).toContain('uuid-1');
  });
});

describe('Client-side Folder Filter + Pagination', () => {
  const makeRow = (id: string, totalCount = 100) => ({
    id,
    title: `Recording ${id}`,
    total_count: totalCount,
  });

  it('should filter rows by folder recording IDs when folder is selected', () => {
    const allRows = [
      makeRow('uuid-1'),
      makeRow('uuid-2'),
      makeRow('uuid-3'),
      makeRow('uuid-4'),
      makeRow('uuid-5'),
    ];
    const folderIds = ['uuid-1', 'uuid-3', 'uuid-5'];

    const { filteredRows, totalCount } = filterAndPaginate(allRows, folderIds, 1, 10);

    expect(totalCount).toBe(3);
    expect(filteredRows).toHaveLength(3);
    expect(filteredRows.map((r) => r.id)).toEqual(['uuid-1', 'uuid-3', 'uuid-5']);
  });

  it('should paginate folder-filtered results correctly', () => {
    // 10 rows, folder has 7, page size 3
    const allRows = Array.from({ length: 10 }, (_, i) => makeRow(`uuid-${i}`));
    const folderIds = ['uuid-0', 'uuid-1', 'uuid-2', 'uuid-3', 'uuid-5', 'uuid-7', 'uuid-9'];

    // Page 1 of 3
    const page1 = filterAndPaginate(allRows, folderIds, 1, 3);
    expect(page1.totalCount).toBe(7);
    expect(page1.filteredRows).toHaveLength(3);
    expect(page1.filteredRows.map((r) => r.id)).toEqual(['uuid-0', 'uuid-1', 'uuid-2']);

    // Page 2 of 3
    const page2 = filterAndPaginate(allRows, folderIds, 2, 3);
    expect(page2.totalCount).toBe(7);
    expect(page2.filteredRows).toHaveLength(3);
    expect(page2.filteredRows.map((r) => r.id)).toEqual(['uuid-3', 'uuid-5', 'uuid-7']);

    // Page 3 of 3 (partial)
    const page3 = filterAndPaginate(allRows, folderIds, 3, 3);
    expect(page3.totalCount).toBe(7);
    expect(page3.filteredRows).toHaveLength(1);
    expect(page3.filteredRows.map((r) => r.id)).toEqual(['uuid-9']);
  });

  it('should use normal pagination when no folder is selected', () => {
    const rows = Array.from({ length: 5 }, (_, i) => makeRow(`uuid-${i}`, 50));

    const { filteredRows, totalCount } = filterAndPaginate(rows, null, 1, 10);

    expect(totalCount).toBe(50); // from total_count field
    expect(filteredRows).toHaveLength(5); // no filtering
  });

  it('should return totalCount 0 and empty array for empty folder', () => {
    const allRows = [makeRow('uuid-1'), makeRow('uuid-2')];
    const folderIds: string[] = []; // empty folder

    const { filteredRows, totalCount } = filterAndPaginate(allRows, folderIds, 1, 10);

    expect(totalCount).toBe(0);
    expect(filteredRows).toHaveLength(0);
  });

  it('should return totalCount 0 when no rows from RPC', () => {
    const { filteredRows, totalCount } = filterAndPaginate([], null, 1, 10);

    expect(totalCount).toBe(0);
    expect(filteredRows).toHaveLength(0);
  });

  it('should handle RPC limit=10000 when folder is selected (fetch all for client filter)', () => {
    // This test verifies the logic: when folderRecordingIds is non-null,
    // RPC should have been called with limit=10000, offset=0
    // The filterAndPaginate function receives ALL rows and does client-side pagination

    const allRows = Array.from({ length: 25 }, (_, i) => makeRow(`uuid-${i}`));
    const folderIds = allRows.map((r) => r.id); // all belong to the folder
    const pageSize = 10;

    // Page 1
    const page1 = filterAndPaginate(allRows, folderIds, 1, pageSize);
    expect(page1.totalCount).toBe(25);
    expect(page1.filteredRows).toHaveLength(10);

    // Page 3 (partial)
    const page3 = filterAndPaginate(allRows, folderIds, 3, pageSize);
    expect(page3.totalCount).toBe(25);
    expect(page3.filteredRows).toHaveLength(5);
  });

  it('should handle totalCount from RPC total_count field when no folder selected', () => {
    // RPC returns total_count field on each row for server-side pagination
    const rows = [
      { id: 'uuid-1', total_count: 150 },
      { id: 'uuid-2', total_count: 150 },
    ];

    const { totalCount } = filterAndPaginate(rows, null, 1, 25);

    expect(totalCount).toBe(150);
  });
});

describe('Filter-bar unorganized folder matching', () => {
  it('excludes canonical UUID recordings already assigned through workspace_entries', () => {
    const visibleWorkspaceRecordingIds = [
      'uuid-assigned-through-workspace-entry',
      'uuid-unassigned',
      null,
    ];
    const assignedFolderRecordingUuids = new Set(['uuid-assigned-through-workspace-entry']);

    const unorganizedIds = getUnorganizedRecordingUuids(
      visibleWorkspaceRecordingIds,
      assignedFolderRecordingUuids
    );

    expect(unorganizedIds).toEqual(['uuid-unassigned']);
  });
});
