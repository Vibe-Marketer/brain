import { supabase } from '@/integrations/supabase/client'
import { untypedRpc } from '@/types/db-extensions'

export interface MoveOptions {
  sourceWorkspaceId?: string | null
  keepInSource?: boolean
}

export interface CopyOptions {
  removeSource?: boolean
  onProgress?: (current: number, total: number) => void
}

export interface MoveToTargetOptions {
  sourceOrgId: string
  sourceWorkspaceId?: string | null
  keepInSource?: boolean
  onProgress?: (current: number, total: number) => void
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
  const { removeSource = false, onProgress } = options

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
  const total = recordingIds.length
  for (let i = 0; i < total; i++) {
    const { error } = await untypedRpc(supabase, 'copy_recording_to_org', {
      p_recording_id: recordingIds[i],
      p_target_org_id: targetOrgId,
      p_target_workspace_id: workspace.id,
      p_delete_original: removeSource,
    })
    if (error) throw new Error(`Failed to copy recording ${i + 1} of ${total}: ${error.message}`)
    onProgress?.(i + 1, total)
  }
}

/**
 * Moves (or copies) recordings to a target workspace, dispatching to the
 * correct backend operation based on whether the target workspace lives in
 * the same organization as the source, or a different one.
 *
 * Same-org target: cheap workspace_entries re-link via moveRecordingsToWorkspace.
 * Cross-org target: hard copy via copy_recording_to_org RPC (new recording rows),
 * never a bare workspace_entries insert — cross-org recordings don't share a row.
 */
export async function moveRecordingsToTargetWorkspace(
  recordingIds: string[],
  target: { workspaceId: string; organizationId: string },
  options: MoveToTargetOptions
): Promise<void> {
  const { sourceOrgId, sourceWorkspaceId, keepInSource = false, onProgress } = options

  if (target.organizationId === sourceOrgId) {
    await moveRecordingsToWorkspace(recordingIds, target.workspaceId, {
      sourceWorkspaceId,
      keepInSource,
    })
    return
  }

  // Cross-org: hard copy via RPC, once per recording. The RPC enforces the
  // caller's membership in the target org itself; no client-side pre-check.
  const total = recordingIds.length
  for (let i = 0; i < total; i++) {
    const { error } = await untypedRpc(supabase, 'copy_recording_to_org', {
      p_recording_id: recordingIds[i],
      p_target_org_id: target.organizationId,
      p_target_workspace_id: target.workspaceId,
      p_delete_original: !keepInSource,
    })
    if (error) throw new Error(`Failed to move recording ${i + 1} of ${total}: ${error.message}`)
    onProgress?.(i + 1, total)
  }
}
