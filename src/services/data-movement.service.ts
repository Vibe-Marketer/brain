import { supabase } from '@/integrations/supabase/client'

export interface MoveOptions {
  sourceWorkspaceId?: string | null
  keepInSource?: boolean
}

export interface CopyOptions {
  removeSource?: boolean
}

/**
 * Moves recordings to a target workspace.
 * In CallVault, "moving" within an organization means:
 * 1. Adding a workspace_entry for the target workspace.
 * 2. Optionally removing the workspace_entry for the source workspace.
 */
export async function moveRecordingsToWorkspace(
  recordingIds: string[],
  targetWorkspaceId: string,
  options: MoveOptions = {}
): Promise<void> {
  const { sourceWorkspaceId, keepInSource = false } = options

  // 1. Add to target workspace (upsert to avoid duplicates)
  // workspace_entries has a unique constraint on (workspace_id, recording_id)
  const entries = recordingIds.map(id => ({
    workspace_id: targetWorkspaceId,
    recording_id: id,
  }))

  const { error: insertError } = await (supabase as any)
    .from('workspace_entries')
    .upsert(entries, { onConflict: 'workspace_id,recording_id' })

  if (insertError) throw new Error(`Failed to add to target workspace: ${insertError.message}`)

  // 2. Remove from source workspace if requested and not the same as target
  if (!keepInSource && sourceWorkspaceId && sourceWorkspaceId !== targetWorkspaceId) {
    const { error: deleteError } = await (supabase as any)
      .from('workspace_entries')
      .delete()
      .eq('workspace_id', sourceWorkspaceId)
      .in('recording_id', recordingIds)

    if (deleteError) {
      console.warn(`Failed to remove from source workspace: ${deleteError.message}`)
      // We don't throw here because the main action (adding to target) succeeded
    }
  }
}

/**
 * Copies recordings to another organization.
 * This is a "hard" copy: new recording IDs are generated.
 * This should ideally be handled by a database function (RPC) or an Edge Function
 * to ensure all related data (transcripts, etc) are copied atomically.
 */
export async function copyRecordingsToOrganization(
  recordingIds: string[],
  targetOrgId: string,
  options: CopyOptions = {}
): Promise<void> {
  const { removeSource = false } = options

  // For now, we'll use an RPC for this complex operation
  const { data, error } = await (supabase as any).rpc('copy_recordings_to_organization', {
    p_recording_ids: recordingIds,
    p_target_organization_id: targetOrgId,
    p_remove_source: removeSource,
  })

  if (error) throw new Error(`Failed to copy to organization: ${error.message}`)
}
