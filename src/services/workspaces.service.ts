import { supabase } from '@/integrations/supabase/client'
import type { Database } from '@/types/supabase'
import type { Workspace } from '@/types/workspace'

type WorkspaceMembershipRow = Database['public']['Tables']['workspace_memberships']['Row']

/**
 * Workspace member with profile information for UI display.
 */
export interface WorkspaceMember {
  id: string
  userId: string
  workspaceId: string
  role: string
  displayName: string | null
  email: string | null
  joinedAt: string
}

/**
 * Fetches all workspaces for the given organization.
 *
 * Queries: workspaces table filtered by organization_id (orgId).
 * Ordering: is_default DESC (default workspace first), then name ASC.
 *
 * Note: All Supabase queries use supabase.from('workspaces').
 */
export async function getWorkspaces(orgId: string): Promise<Workspace[]> {
  const { data, error } = await supabase
    .from('workspaces')
    .select(
      'id, name, organization_id:organization_id, workspace_type:workspace_type, default_sharelink_ttl_days, created_at, updated_at'
    )
    .eq('organization_id', orgId)
    .order('name', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch workspaces: ${error.message}`)
  }

  // Sort client-side: is_default first (not in generated types yet), then by name
  // is_default column added via Phase 16 migration; cast to any for access
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workspaces = (data ?? []) as any[]
  workspaces.sort((a, b) => {
    if (a.is_default && !b.is_default) return -1
    if (!a.is_default && b.is_default) return 1
    return a.name.localeCompare(b.name)
  })

  return workspaces as Workspace[]
}

/**
 * Fetches a single workspace by ID.
 * Returns null if not found or not accessible to current user.
 */
export async function getWorkspaceById(workspaceId: string): Promise<Workspace | null> {
  const { data, error } = await supabase
    .from('workspaces')
    .select(
      'id, name, organization_id:organization_id, workspace_type:workspace_type, default_sharelink_ttl_days, created_at, updated_at'
    )
    .eq('id', workspaceId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch workspace ${workspaceId}: ${error.message}`)
  }

  return data as Workspace | null
}

/**
 * Creates a new workspace within the given organization.
 * Inserts into workspaces with organization_id = orgId, then creates workspace_membership for creator as workspace_owner.
 * If isDefault is true, sets is_default = true on the workspace.
 */
export async function createWorkspace(
  orgId: string,
  userId: string,
  name: string,
  isDefault = false
): Promise<Workspace> {
  // 1. Insert the workspace (DB uses organization_id and workspace_type)
  const insertPayload: Record<string, unknown> = {
    organization_id: orgId,
    name,
    workspace_type: 'team', // default to team for business orgs
  }
  if (isDefault) {
    insertPayload.is_default = true
  }

  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .insert(insertPayload as any)
    .select(
      'id, name, organization_id:organization_id, workspace_type:workspace_type, default_sharelink_ttl_days, created_at, updated_at'
    )
    .single()

  if (workspaceError || !workspace) {
    throw new Error(`Failed to create workspace: ${workspaceError?.message ?? 'Unknown error'}`)
  }

  // 2. Create workspace_membership as workspace_owner
  const { error: memberError } = await supabase
    .from('workspace_memberships')
    .insert({ workspace_id: workspace.id, user_id: userId, role: 'workspace_owner' })

  if (memberError) {
    throw new Error(`Workspace created but failed to set membership: ${memberError.message}`)
  }

  return workspace as Workspace
}

/**
 * Fetches the members list for a workspace.
 * Queries workspace_memberships joined with user profile data.
 *
 * Note: Supabase RLS on workspace_memberships controls visibility.
 * display_name and email come from users table via join if available.
 */
export async function getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const { data, error } = await supabase
    .from('workspace_memberships')
    .select(`
      id,
      user_id,
      workspace_id,
      role,
      created_at
    `)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch workspace members: ${error.message}`)
  }

  // Map to WorkspaceMember shape
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    workspaceId: row.workspace_id,
    role: row.role,
    displayName: null, // Populated by UI from user profile if needed
    email: null,       // Populated by UI from user profile if needed
    joinedAt: row.created_at,
  })) as WorkspaceMember[]
}

/**
 * Updates a member's role within a workspace.
 */
export async function updateMemberRole(
  workspaceId: string,
  userId: string,
  newRole: string
): Promise<void> {
  const { error } = await supabase
    .from('workspace_memberships')
    .update({ role: newRole })
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)

  if (error) {
    throw new Error(`Failed to update member role: ${error.message}`)
  }
}

/**
 * Removes a member from a workspace.
 * Cannot remove workspace_owner (enforced by RLS/trigger in DB).
 */
export async function removeMember(workspaceId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('workspace_memberships')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)

  if (error) {
    throw new Error(`Failed to remove member: ${error.message}`)
  }
}

// Re-export type so consumers don't need a separate import
export type { WorkspaceMembershipRow }
export type WorkspaceMembershipRow = WorkspaceMembershipRow // Legacy alias
