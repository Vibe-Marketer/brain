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

  const { error: insertError } = await supabase
    .from('workspace_entries')
    .upsert(entries, { onConflict: 'workspace_id,recording_id' })

  if (insertError) throw new Error(`Failed to add to target workspace: ${insertError.message}`)

  // 2. Remove from source workspace if requested and not the same as target
  if (!keepInSource && sourceWorkspaceId && sourceWorkspaceId !== targetWorkspaceId) {
    const { error: deleteError } = await supabase
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
 * Uses copy_recording_to_org RPC (per-recording), targeting the org's HOME workspace.
 */
export async function copyRecordingsToOrganization(
  recordingIds: string[],
  targetOrgId: string,
  options: CopyOptions = {}
): Promise<void> {
  const { removeSource = false } = options

  // Verify current user has membership in the target organization
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: membership, error: memberError } = await supabase
    .from('organization_memberships')
    .select('id')
    .eq('organization_id', targetOrgId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (memberError) throw new Error(`Failed to verify organization membership: ${memberError.message}`)
  if (!membership) throw new Error('You do not have access to the target organization')

  // Look up the HOME workspace for the target org (required by the RPC)
  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .select('id')
    .eq('organization_id', targetOrgId)
    .eq('is_home', true)
    .maybeSingle()

  if (wsError) throw new Error(`Failed to look up target workspace: ${wsError.message}`)
  if (!workspace) throw new Error('Target organization has no HOME workspace')

  // Call RPC once per recording (current DB function is per-recording)
  for (const recordingId of recordingIds) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc('copy_recording_to_org', {
      p_recording_id: recordingId,
      p_target_org_id: targetOrgId,
      p_target_workspace_id: workspace.id,
      p_delete_original: removeSource,
    })
    if (error) throw new Error(`Failed to copy recording: ${error.message}`)
  }
}
