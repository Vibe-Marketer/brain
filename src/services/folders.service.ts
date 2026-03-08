import { supabase } from '@/integrations/supabase/client'
import type { Folder } from '@/types/workspace'

/**
 * Folder Service — CRUD, archive/restore, and call-assignment operations.
 *
 * All queries use supabase.from('folders') scoped by workspaceId.
 *
 * NOTE: The DB uses `parent_id` (not `parent_folder_id`) — this is the actual
 * FK column on the folders table.
 *
 * folder_assignments uses `call_recording_id: number` (legacy numeric ID from
 * fathom_calls) and `user_id`.
 */

// ─────────────────────────────────────────────────────────────
// Read Operations
// ─────────────────────────────────────────────────────────────

/**
 * Fetches active (non-archived) folders for the given workspace.
 * When includeArchived is true, returns all folders regardless of archive state.
 * Ordered by position ASC.
 */
export async function getFolders(
  workspaceId: string,
  includeArchived = false
): Promise<Folder[]> {
  let query = supabase
    .from('folders')
    .select(
      'id, name, user_id, organization_id, workspace_id, parent_id, description, color, icon, visibility, position, is_archived, archived_at, created_at, updated_at'
    )
    .eq('workspace_id', workspaceId)

  if (!includeArchived) {
    query = query.eq('is_archived', false)
  }

  query = query.order('position', { ascending: true })

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch folders: ${error.message}`)
  }

  // Map parent_id to parent_folder_id for Folder interface compatibility
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    user_id: row.user_id,
    organization_id: row.organization_id,
    workspace_id: row.workspace_id,
    parent_id: row.parent_id,
    parent_folder_id: row.parent_id ?? null,
    description: row.description,
    color: row.color,
    icon: row.icon,
    visibility: row.visibility,
    position: row.position ?? 0,
    is_archived: row.is_archived ?? false,
    archived_at: row.archived_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  })) as Folder[]
}

/**
 * Fetches archived folders for the given workspace.
 * Ordered by archived_at DESC (most recently archived first).
 */
export async function getArchivedFolders(workspaceId: string): Promise<Folder[]> {
  const { data, error } = await supabase
    .from('folders')
    .select(
      'id, name, user_id, organization_id, workspace_id, parent_id, description, color, icon, visibility, position, is_archived, archived_at, created_at, updated_at'
    )
    .eq('workspace_id', workspaceId)
    .eq('is_archived', true)
    .order('archived_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch archived folders: ${error.message}`)
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    user_id: row.user_id,
    organization_id: row.organization_id,
    workspace_id: row.workspace_id,
    parent_id: row.parent_id,
    parent_folder_id: row.parent_id ?? null,
    description: row.description,
    color: row.color,
    icon: row.icon,
    visibility: row.visibility,
    position: row.position ?? 0,
    is_archived: row.is_archived ?? false,
    archived_at: row.archived_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  })) as Folder[]
}

/**
 * Fetches all folder assignments.
 * Returns a map of callRecordingId (number) -> folderId[] (string[]).
 */
export async function getFolderAssignments({
  workspaceId,
  organizationId,
}: {
  workspaceId?: string | null
  organizationId?: string | null
}): Promise<Record<string, string[]>> {
  if (!workspaceId && !organizationId) return {}

  // 1. Get all folder IDs for this scope
  let folderQuery = supabase
    .from('folders')
    .select('id')
    
  if (workspaceId) {
    folderQuery = folderQuery.eq('workspace_id', workspaceId)
  } else if (organizationId) {
    folderQuery = folderQuery.eq('organization_id', organizationId)
  }

  const { data: folderIdsData } = await folderQuery

  const folderIds = (folderIdsData ?? []).map((f) => f.id)

  if (folderIds.length === 0) return {}

  // 2. Fetch all assignments for these folder IDs
  const { data, error } = await supabase
    .from('folder_assignments')
    .select('call_recording_id, folder_id')
    .in('folder_id', folderIds)

  if (error) {
    throw new Error(`Failed to fetch folder assignments: ${error.message}`)
  }

  const assignments: Record<string, string[]> = {}
  ;(data ?? []).forEach((row) => {
    const callId = String(row.call_recording_id)
    if (!assignments[callId]) {
      assignments[callId] = []
    }
    assignments[callId].push(row.folder_id)
  })

  return assignments
}

// ─────────────────────────────────────────────────────────────
// Write Operations
// ─────────────────────────────────────────────────────────────

/**
 * Creates a new folder inside the given workspace.
 *
 * Depth limit enforcement: max 2 levels (one level of nesting).
 * If parentFolderId is provided, queries the parent to verify it has no
 * parent of its own. If the parent already has a parent, throws an error.
 *
 * Position is set to max(position) + 1 for siblings in the same workspace/parent.
 */
export async function createFolder(
  workspaceId: string,
  organizationId: string,
  userId: string,
  name: string,
  parentFolderId?: string,
  metadata?: Partial<Pick<Folder, 'description' | 'color' | 'icon' | 'visibility'>>
): Promise<Folder> {
  // Enforce depth limit: if a parent is provided, verify it has no parent
  if (parentFolderId) {
    const { data: parent, error: parentError } = await supabase
      .from('folders')
      .select('id, parent_id')
      .eq('id', parentFolderId)
      .maybeSingle()

    if (parentError) {
      throw new Error(`Failed to verify parent folder: ${parentError.message}`)
    }

    if (!parent) {
      throw new Error('Parent folder not found')
    }

    if (parent.parent_id !== null) {
      throw new Error('Folders can only be nested one level deep.')
    }
  }

  // Calculate next position for siblings
  let positionQuery = supabase
    .from('folders')
    .select('position')
    .eq('workspace_id', workspaceId)

  if (parentFolderId) {
    positionQuery = positionQuery.eq('parent_id', parentFolderId)
  } else {
    positionQuery = positionQuery.is('parent_id', null)
  }

  const { data: siblings } = await positionQuery

  const maxPosition = siblings && siblings.length > 0
    ? Math.max(...siblings.map((s: { position: number | null }) => s.position ?? 0))
    : -1

  const insertPayload: Record<string, unknown> = {
    workspace_id: workspaceId,
    organization_id: organizationId,
    user_id: userId,
    name,
    position: maxPosition + 1,
    is_archived: false,
    ...metadata,
  }

  if (parentFolderId) {
    insertPayload.parent_id = parentFolderId
  }

  const { data, error } = await supabase
    .from('folders')
    .insert(insertPayload)
    .select(
      'id, name, user_id, organization_id, workspace_id, parent_id, position, is_archived, archived_at, created_at, updated_at'
    )
    .single()

  if (error || !data) {
    throw new Error(`Failed to create folder: ${error?.message ?? 'Unknown error'}`)
  }

  return {
    id: data.id,
    name: data.name,
    user_id: data.user_id,
    organization_id: data.organization_id,
    workspace_id: data.workspace_id,
    parent_folder_id: data.parent_id ?? null,
    position: data.position ?? 0,
    is_archived: data.is_archived ?? false,
    archived_at: data.archived_at ?? null,
    created_at: data.created_at,
    updated_at: data.updated_at,
  } as Folder
}

/**
 * Updates a folder's properties.
 */
export async function updateFolder(
  folderId: string,
  updates: Partial<Pick<Folder, 'name' | 'description' | 'color' | 'icon' | 'visibility' | 'parent_id' | 'position'>>
): Promise<void> {
  const { error } = await supabase
    .from('folders')
    .update(updates)
    .eq('id', folderId)

  if (error) {
    throw new Error(`Failed to update folder: ${error.message}`)
  }
}

/**
 * Legacy rename folder function (kept for compatibility)
 */
export async function renameFolder(folderId: string, name: string): Promise<void> {
  return updateFolder(folderId, { name })
}

/**
 * Archives a folder.
 * Sets is_archived = true and archived_at = NOW().
 *
 * Per locked decision: "Calls stay inside the archived folder. Folder is hidden
 * from main sidebar view. Can be fully restored."
 */
export async function archiveFolder(folderId: string): Promise<void> {
  const { error } = await supabase
    .from('folders')
    .update({ is_archived: true, archived_at: new Date().toISOString() })
    .eq('id', folderId)

  if (error) {
    throw new Error(`Failed to archive folder: ${error.message}`)
  }
}

/**
 * Restores an archived folder.
 * Sets is_archived = false and archived_at = null.
 */
export async function restoreFolder(folderId: string): Promise<void> {
  const { error } = await supabase
    .from('folders')
    .update({ is_archived: false, archived_at: null })
    .eq('id', folderId)

  if (error) {
    throw new Error(`Failed to restore folder: ${error.message}`)
  }
}

/**
 * Hard deletes a folder.
 * Only allowed for folders with no call assignments.
 * Checks folder_assignments count first to prevent data loss.
 */
export async function deleteFolder(folderId: string): Promise<void> {
  // Check for existing assignments
  const { count, error: countError } = await supabase
    .from('folder_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('folder_id', folderId)

  if (countError) {
    throw new Error(`Failed to check folder assignments: ${countError.message}`)
  }

  if (count && count > 0) {
    throw new Error(
      `Cannot delete folder: it contains ${count} call assignment${count === 1 ? '' : 's'}. Move or remove calls first.`
    )
  }

  const { error } = await supabase
    .from('folders')
    .delete()
    .eq('id', folderId)

  if (error) {
    throw new Error(`Failed to delete folder: ${error.message}`)
  }
}

// ─────────────────────────────────────────────────────────────
// Call Assignment Operations
// ─────────────────────────────────────────────────────────────

/**
 * Assigns a call (recording) to a folder.
 *
 * Note: folder_assignments uses call_recording_id (legacy numeric ID from
 * fathom_calls) and user_id. Uses upsert to avoid duplicate assignment errors.
 */
export async function assignCallToFolder(
  callRecordingId: number,
  folderId: string,
  userId: string,
  workspaceId?: string | null
): Promise<void> {
  const { error } = await supabase
    .from('folder_assignments')
    .upsert(
      {
        call_recording_id: callRecordingId,
        folder_id: folderId,
        user_id: userId,
        assigned_at: new Date().toISOString(),
        assigned_by: userId,
      },
      { onConflict: 'call_recording_id,folder_id' }
    )

  if (error) {
    throw new Error(`Failed to assign call to folder: ${error.message}`)
  }

  // 2. NEW ARCHITECTURE: Update workspace_entries.folder_id if we have a recording UUID
  // This ensures that non-Fathom calls (YT, Zoom) also move correctly
  const { data: rec } = await supabase
    .from('recordings')
    .select('id')
    .eq('legacy_recording_id', callRecordingId)
    .maybeSingle()

  if (rec && workspaceId) {
    const { error: entryError } = await supabase
      .from('workspace_entries')
      .update({ folder_id: folderId })
      .eq('recording_id', rec.id)
      .eq('workspace_id', workspaceId)

    if (entryError) {
      console.error('Failed to update workspace entry folder assignment:', entryError)
    }
  }
}

/**
 * Removes a call from a folder.
 */
export async function removeCallFromFolder(
  callRecordingId: number,
  folderId: string
): Promise<void> {
  const { error } = await supabase
    .from('folder_assignments')
    .delete()
    .eq('call_recording_id', callRecordingId)
    .eq('folder_id', folderId)

  if (error) {
    throw new Error(`Failed to remove call from folder: ${error.message}`)
  }
}

/**
 * Moves a call from one folder to another.
 * Removes from old folder then adds to new folder sequentially.
 * The assignment to the new folder uses upsert to handle the case where
 * the call is already assigned.
 */
export async function moveCallToFolder(
  callRecordingId: number,
  fromFolderId: string,
  toFolderId: string,
  userId: string,
  workspaceId?: string | null
): Promise<void> {
  // 1. LEGACY: Remove from old folder and add to new folder
  const { error: removeError } = await supabase
    .from('folder_assignments')
    .delete()
    .eq('call_recording_id', callRecordingId)
    .eq('folder_id', fromFolderId)

  if (removeError) {
    throw new Error(`Failed to remove call from source folder: ${removeError.message}`)
  }

  // Add to new folder
  const { error: addError } = await supabase
    .from('folder_assignments')
    .upsert(
      {
        call_recording_id: callRecordingId,
        folder_id: toFolderId,
        user_id: userId,
        assigned_at: new Date().toISOString(),
        assigned_by: userId,
      },
      { onConflict: 'call_recording_id,folder_id' }
    )

  if (addError) {
    throw new Error(`Failed to add call to destination folder: ${addError.message}`)
  }

  // 2. NEW ARCHITECTURE: Update workspace_entries.folder_id if we have a recording UUID
  const { data: rec } = await supabase
    .from('recordings')
    .select('id')
    .eq('legacy_recording_id', callRecordingId)
    .maybeSingle()

  if (rec && workspaceId) {
    const { error: entryError } = await supabase
      .from('workspace_entries')
      .update({ folder_id: toFolderId })
      .eq('recording_id', rec.id)
      .eq('workspace_id', workspaceId)

    if (entryError) {
      console.error('Failed to update workspace entry folder assignment during move:', entryError)
    }
  }
}
