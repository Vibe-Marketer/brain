import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  moveRecordingsToWorkspace,
  copyRecordingsToOrganization,
} from '../data-movement.service'
import { supabase } from '@/integrations/supabase/client'

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── Mocks ─────────────────────────────────────────────────────────────────
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}))

// The untypedRpc wrapper is used by copyRecordingsToOrganization
vi.mock('@/types/db-extensions', () => ({
  untypedRpc: vi.fn(),
}))

import { untypedRpc } from '@/types/db-extensions'

/** Build a chainable, awaitable Supabase query mock. */
function makeChain(result: { data?: unknown; error?: unknown }) {
  const resolved = { data: null, error: null, ...result }
  const chain: Record<string, unknown> = {}

  const methods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'in', 'or', 'order', 'filter', 'is',
  ]

  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }

  chain.single = vi.fn().mockResolvedValue(resolved)
  chain.maybeSingle = vi.fn().mockResolvedValue(resolved)

  chain.then = (resolve: (v: typeof resolved) => unknown) => Promise.resolve(resolved).then(resolve)
  chain.catch = (reject: (e: unknown) => unknown) => Promise.resolve(resolved).catch(reject)

  return chain as unknown as ReturnType<typeof supabase.from>
}

function mockAuthUser(userId: string | null = 'user-1') {
  vi.mocked(supabase.auth.getUser).mockResolvedValue({
    data: { user: userId ? { id: userId } : null },
    error: null,
  } as any)
}

// ─── moveRecordingsToWorkspace ───────────────────────────────────────────────
describe('moveRecordingsToWorkspace', () => {
  const recordingIds = ['rec-1', 'rec-2', 'rec-3']
  const targetWorkspaceId = 'ws-target'
  const sourceWorkspaceId = 'ws-source'

  it('upserts entries to the target workspace', async () => {
    const chain = makeChain({ error: null })
    vi.mocked(supabase.from).mockReturnValue(chain)

    await moveRecordingsToWorkspace(recordingIds, targetWorkspaceId)

    expect(supabase.from).toHaveBeenCalledWith('workspace_entries')
    // Should call upsert (not insert) to avoid duplicate key errors
    expect((chain as any).upsert).toHaveBeenCalledWith(
      recordingIds.map(id => ({ workspace_id: targetWorkspaceId, recording_id: id })),
      { onConflict: 'workspace_id,recording_id' }
    )
  })

  it('does NOT remove from source when keepInSource is true', async () => {
    const chain = makeChain({ error: null })
    vi.mocked(supabase.from).mockReturnValue(chain)

    await moveRecordingsToWorkspace(recordingIds, targetWorkspaceId, {
      sourceWorkspaceId,
      keepInSource: true,
    })

    // Only one call (insert), no delete call
    expect(supabase.from).toHaveBeenCalledTimes(1)
  })

  it('removes from source workspace when keepInSource is false and sourceWorkspaceId is set', async () => {
    // First call: upsert to target
    const insertChain = makeChain({ error: null })
    // Second call: delete from source
    const deleteChain = makeChain({ error: null })

    vi.mocked(supabase.from)
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(deleteChain)

    await moveRecordingsToWorkspace(recordingIds, targetWorkspaceId, {
      sourceWorkspaceId,
      keepInSource: false,
    })

    expect(supabase.from).toHaveBeenCalledTimes(2)
    expect(supabase.from).toHaveBeenNthCalledWith(2, 'workspace_entries')
    expect((deleteChain as any).delete).toHaveBeenCalled()
    expect((deleteChain as any).eq).toHaveBeenCalledWith('workspace_id', sourceWorkspaceId)
    expect((deleteChain as any).in).toHaveBeenCalledWith('recording_id', recordingIds)
  })

  it('does NOT remove from source when source === target', async () => {
    const chain = makeChain({ error: null })
    vi.mocked(supabase.from).mockReturnValue(chain)

    await moveRecordingsToWorkspace(recordingIds, targetWorkspaceId, {
      sourceWorkspaceId: targetWorkspaceId, // same workspace
      keepInSource: false,
    })

    expect(supabase.from).toHaveBeenCalledTimes(1)
  })

  it('throws when upsert to target fails', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ error: { message: 'upsert failed' } })
    )
    await expect(
      moveRecordingsToWorkspace(recordingIds, targetWorkspaceId)
    ).rejects.toThrow('Failed to add to target workspace: upsert failed')
  })

  it('warns (does not throw) when source removal fails after successful insert', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.mocked(supabase.from)
      .mockReturnValueOnce(makeChain({ error: null }))
      .mockReturnValueOnce(makeChain({ error: { message: 'delete denied' } }))

    // Should NOT throw — main action succeeded
    await expect(
      moveRecordingsToWorkspace(recordingIds, targetWorkspaceId, {
        sourceWorkspaceId,
        keepInSource: false,
      })
    ).resolves.toBeUndefined()

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to remove from source workspace')
    )
    consoleSpy.mockRestore()
  })
})

// ─── copyRecordingsToOrganization ────────────────────────────────────────────
describe('copyRecordingsToOrganization', () => {
  const recordingIds = ['rec-1', 'rec-2']
  const targetOrgId = 'org-target'
  const targetWorkspace = { id: 'ws-home' }
  const membership = { id: 'mem-1' }

  beforeEach(() => {
    mockAuthUser('user-1')
    vi.mocked(untypedRpc).mockResolvedValue({ error: null } as any)
  })

  it('verifies membership, finds HOME workspace, then calls RPC per recording', async () => {
    vi.mocked(supabase.from)
      .mockReturnValueOnce(makeChain({ data: membership }))      // membership check
      .mockReturnValueOnce(makeChain({ data: targetWorkspace })) // HOME workspace lookup

    await copyRecordingsToOrganization(recordingIds, targetOrgId)

    // RPC called once per recording
    expect(untypedRpc).toHaveBeenCalledTimes(recordingIds.length)
    expect(untypedRpc).toHaveBeenCalledWith(supabase, 'copy_recording_to_org', {
      p_recording_id: 'rec-1',
      p_target_org_id: targetOrgId,
      p_target_workspace_id: targetWorkspace.id,
      p_delete_original: false,
    })
  })

  it('throws when user is not authenticated', async () => {
    mockAuthUser(null)
    await expect(
      copyRecordingsToOrganization(recordingIds, targetOrgId)
    ).rejects.toThrow('Not authenticated')
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('throws when user is not a member of the target org', async () => {
    vi.mocked(supabase.from)
      .mockReturnValueOnce(makeChain({ data: null })) // no membership found

    await expect(
      copyRecordingsToOrganization(recordingIds, targetOrgId)
    ).rejects.toThrow('You do not have access to the target organization')
  })

  it('throws when target org has no HOME workspace', async () => {
    vi.mocked(supabase.from)
      .mockReturnValueOnce(makeChain({ data: membership }))
      .mockReturnValueOnce(makeChain({ data: null })) // no HOME workspace

    await expect(
      copyRecordingsToOrganization(recordingIds, targetOrgId)
    ).rejects.toThrow('Target organization has no HOME workspace')
  })

  it('calls onProgress callback after each successful RPC', async () => {
    vi.mocked(supabase.from)
      .mockReturnValueOnce(makeChain({ data: membership }))
      .mockReturnValueOnce(makeChain({ data: targetWorkspace }))

    const onProgress = vi.fn()
    await copyRecordingsToOrganization(recordingIds, targetOrgId, { onProgress })

    expect(onProgress).toHaveBeenCalledTimes(2)
    expect(onProgress).toHaveBeenNthCalledWith(1, 1, 2)
    expect(onProgress).toHaveBeenNthCalledWith(2, 2, 2)
  })

  it('throws when RPC fails for a recording', async () => {
    vi.mocked(supabase.from)
      .mockReturnValueOnce(makeChain({ data: membership }))
      .mockReturnValueOnce(makeChain({ data: targetWorkspace }))

    vi.mocked(untypedRpc).mockResolvedValueOnce({ error: { message: 'RPC failed' } } as any)

    await expect(
      copyRecordingsToOrganization(['rec-1'], targetOrgId)
    ).rejects.toThrow('Failed to copy recording 1 of 1: RPC failed')
  })

  it('passes removeSource=true to RPC when option is set', async () => {
    vi.mocked(supabase.from)
      .mockReturnValueOnce(makeChain({ data: membership }))
      .mockReturnValueOnce(makeChain({ data: targetWorkspace }))

    await copyRecordingsToOrganization(['rec-1'], targetOrgId, { removeSource: true })

    expect(untypedRpc).toHaveBeenCalledWith(supabase, 'copy_recording_to_org', expect.objectContaining({
      p_delete_original: true,
    }))
  })

  it('throws when membership verification query fails', async () => {
    vi.mocked(supabase.from)
      .mockReturnValueOnce(makeChain({ error: { message: 'auth check failed' } }))

    await expect(
      copyRecordingsToOrganization(recordingIds, targetOrgId)
    ).rejects.toThrow('Failed to verify organization membership: auth check failed')
  })
})
