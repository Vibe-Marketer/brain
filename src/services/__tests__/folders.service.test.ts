import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  folderAssignmentUpsert: vi.fn(),
  recordingMaybeSingle: vi.fn(),
  folderMaybeSingle: vi.fn(),
  workspaceEntryUpsert: vi.fn(),
  workspaceEntryDeleteEq: vi.fn(),
  workspaceEntryDeleteNeq: vi.fn(),
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mocks.from,
  },
}))

import { assignCallToFolder } from '../folders.service'

describe('folders.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.folderAssignmentUpsert.mockResolvedValue({ error: null })
    mocks.recordingMaybeSingle.mockResolvedValue({
      data: { id: 'recording-uuid' },
      error: null,
    })
    mocks.folderMaybeSingle.mockResolvedValue({
      data: { workspace_id: 'target-workspace' },
      error: null,
    })
    mocks.workspaceEntryUpsert.mockResolvedValue({ error: null })
    mocks.workspaceEntryDeleteNeq.mockResolvedValue({ error: null })
    mocks.workspaceEntryDeleteEq.mockReturnValue({
      neq: mocks.workspaceEntryDeleteNeq,
    })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'folder_assignments') {
        return {
          upsert: mocks.folderAssignmentUpsert,
        }
      }

      if (table === 'recordings') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: mocks.recordingMaybeSingle,
            }),
          }),
        }
      }

      if (table === 'folders') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: mocks.folderMaybeSingle,
            }),
          }),
        }
      }

      if (table === 'workspace_entries') {
        return {
          upsert: mocks.workspaceEntryUpsert,
          delete: vi.fn().mockReturnValue({
            eq: mocks.workspaceEntryDeleteEq,
          }),
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    })
  })

  it('moves a dragged call into the folder workspace when no active workspace is supplied', async () => {
    await assignCallToFolder(152706780, 'folder-id', 'user-id')

    expect(mocks.workspaceEntryUpsert).toHaveBeenCalledWith(
      {
        workspace_id: 'target-workspace',
        recording_id: 'recording-uuid',
        folder_id: 'folder-id',
      },
      { onConflict: 'workspace_id,recording_id' }
    )
    expect(mocks.workspaceEntryDeleteEq).toHaveBeenCalledWith('recording_id', 'recording-uuid')
    expect(mocks.workspaceEntryDeleteNeq).toHaveBeenCalledWith('workspace_id', 'target-workspace')
  })

  it('does not report success when the workspace entry move fails', async () => {
    mocks.workspaceEntryUpsert.mockResolvedValueOnce({
      error: { message: 'permission denied' },
    })

    await expect(assignCallToFolder(152706780, 'folder-id', 'user-id')).rejects.toThrow(
      'Failed to move call to folder workspace: permission denied'
    )
  })
})
