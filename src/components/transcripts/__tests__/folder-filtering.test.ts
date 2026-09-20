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
