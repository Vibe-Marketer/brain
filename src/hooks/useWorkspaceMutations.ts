/**
 * useWorkspaceMutations - Mutation hooks for workspace CRUD operations
 *
 * Provides useCreateWorkspace, useUpdateWorkspace, and useDeleteWorkspace hooks
 * with optimistic updates, toast notifications, and query invalidation.
 *
 * @pattern tanstack-query-mutations
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { queryKeys } from '@/lib/query-config'
import { toast } from 'sonner'
import type { WorkspaceWithMeta } from '@/types/workspace'

import type { Database } from '@/types/supabase'

type WorkspaceInsert = Database['public']['Tables']['workspaces']['Insert']

// ─── Create Workspace ───────────────────────────────────────────────────

export interface CreateWorkspaceInput {
  orgId: string
  name: string
  defaultShareLinkTtlDays?: number
}

/**
 * useCreateWorkspace - Creates a new workspace with owner membership
 *
 * Creates the workspace row, adds the creator as workspace_owner, and computes
 * a fresh per-user sort_order for the new membership so the workspace appears
 * at the bottom of the user's sidebar list. No default folders are created —
 * users add their own.
 *
 * The legacy `workspace_type` column is hard-coded to `'team'` for backwards
 * compatibility (Phase 25 retired the column as a behavior switch).
 */
export function useCreateWorkspace() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateWorkspaceInput) => {
      if (!user) throw new Error('Not authenticated')

      // Create workspace (workspace_type hard-coded to 'team' for legacy column compat)
      const { data: workspace, error: workspaceError } = await supabase
        .from('workspaces')
        .insert({
          organization_id: input.orgId,
          name: input.name.trim(),
          workspace_type: 'team',
          ...(input.defaultShareLinkTtlDays !== undefined && {
            default_sharelink_ttl_days: input.defaultShareLinkTtlDays,
          }),
        })
        .select(`
          id,
          organization_id:organization_id,
          name,
          workspace_type:workspace_type,
          default_sharelink_ttl_days,
          created_at,
          updated_at
        `)
        .single()

      if (workspaceError) throw workspaceError

      // Compute next sort_order for the creator's new membership =
      // MAX(existing sort_order across this user's memberships) + 1
      const { data: existingMaxRows } = await supabase
        .from('workspace_memberships')
        .select('sort_order')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: false })
        .limit(1)
      const nextSortOrder = ((existingMaxRows?.[0]?.sort_order as number | null | undefined) ?? -1) + 1

      // Create workspace membership for creator as owner
      const { error: membershipError } = await supabase
        .from('workspace_memberships')
        .insert({
          workspace_id: workspace.id,
          user_id: user.id,
          role: 'workspace_owner',
          sort_order: nextSortOrder,
        })

      if (membershipError) throw membershipError

      return {
        ...workspace,
        member_count: 1,
        user_role: 'workspace_owner',
        organization_id: workspace.organization_id, // alias
        workspace_type: workspace.workspace_type, // alias
      } as WorkspaceWithMeta
    },
    onMutate: async (input) => {
      if (!user) return

      const listKey = queryKeys.workspaces.list(input.orgId)

      await queryClient.cancelQueries({ queryKey: queryKeys.workspaces.list() })

      const previousList = queryClient.getQueryData<WorkspaceWithMeta[]>(listKey)
      const now = new Date().toISOString()
      const tempId = `temp-${Date.now()}`

      const optimisticWorkspace: WorkspaceWithMeta = {
        id: tempId,
        organization_id: input.orgId,
        name: input.name.trim(),
        workspace_type: 'team',
        default_sharelink_ttl_days: input.defaultShareLinkTtlDays ?? 7,
        created_at: now,
        updated_at: now,
        member_count: 1,
        user_role: 'workspace_owner',
      }

      queryClient.setQueryData<WorkspaceWithMeta[]>(listKey, (old = []) => [
        optimisticWorkspace,
        ...old,
      ])

      return { previousList, listKey, tempId }
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previousList && context.listKey) {
        queryClient.setQueryData(context.listKey, context.previousList)
      }
      toast.error(`Failed to create workspace: ${error.message}`)
    },
    onSuccess: (workspace, variables, context) => {
      if (context?.listKey && context.tempId) {
        queryClient.setQueryData<WorkspaceWithMeta[]>(context.listKey, (old = []) =>
          old.map((item) =>
            item.id === context.tempId
              ? {
                  ...workspace,
                  member_count: 1,
                  user_role: 'workspace_owner',
                }
              : item
          )
        )
      }
      toast.success(`Workspace '${variables.name.trim()}' created`)
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.all })
    },
    onSettled: () => {
      // Invalidate workspace queries
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.list() })
      queryClient.invalidateQueries({ queryKey: ['orgContext'] })
    },
  })
}

// ─── Update Workspace ───────────────────────────────────────────────────

export interface UpdateWorkspaceInput {
  workspaceId: string
  name?: string
  defaultShareLinkTtlDays?: number
}

/**
 * useUpdateWorkspace - Updates workspace name and/or settings
 *
 * Optimistically updates the workspace name in the list, rolling back on error.
 */
export function useUpdateWorkspace() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpdateWorkspaceInput) => {
      const updates: Record<string, unknown> = {}
      if (input.name !== undefined) updates.name = input.name.trim()
      if (input.defaultShareLinkTtlDays !== undefined) {
        updates.default_sharelink_ttl_days = input.defaultShareLinkTtlDays
      }

      const { data, error } = await supabase
        .from('workspaces')
        .update(updates)
        .eq('id', input.workspaceId)
        .select(`
          id,
          organization_id:organization_id,
          name,
          workspace_type:workspace_type,
          default_sharelink_ttl_days,
          created_at,
          updated_at
        `)
        .single()

      if (error) throw error
      return data
    },
    onMutate: async (input) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.workspaces.list() })
      await queryClient.cancelQueries({
        queryKey: queryKeys.workspaces.detail(input.workspaceId),
      })

      // Snapshot previous values for rollback
      const previousDetail = queryClient.getQueryData(
        queryKeys.workspaces.detail(input.workspaceId)
      )
      const previousLists = queryClient.getQueriesData<WorkspaceWithMeta[]>({
        queryKey: queryKeys.workspaces.list(),
      })

      const nextName = input.name?.trim()
      const nextTtl = input.defaultShareLinkTtlDays

      // Optimistically update the detail cache
      queryClient.setQueryData(
        queryKeys.workspaces.detail(input.workspaceId),
        (old: WorkspaceWithMeta | undefined) => {
          if (!old) return old
          return {
            ...old,
            ...(nextName !== undefined ? { name: nextName } : {}),
            ...(nextTtl !== undefined ? { default_sharelink_ttl_days: nextTtl } : {}),
          }
        }
      )

      // Optimistically update all list caches
      queryClient.setQueriesData<WorkspaceWithMeta[]>(
        { queryKey: queryKeys.workspaces.list() },
        (old) => {
          if (!old) return old
          return old.map((workspace) =>
            workspace.id === input.workspaceId
              ? {
                  ...workspace,
                  ...(nextName !== undefined ? { name: nextName } : {}),
                  ...(nextTtl !== undefined ? { default_sharelink_ttl_days: nextTtl } : {}),
                }
              : workspace
          )
        }
      )

      return { previousDetail, previousLists }
    },
    onError: (_err, input, context) => {
      // Rollback optimistic update
      if (context?.previousDetail) {
        queryClient.setQueryData(
          queryKeys.workspaces.detail(input.workspaceId),
          context.previousDetail
        )
      }
      if (context?.previousLists) {
        for (const [key, data] of context.previousLists) {
          queryClient.setQueryData(key, data)
        }
      }
      toast.error('Failed to update workspace')
    },
    onSettled: (_data, _error, input) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.list() })
      queryClient.invalidateQueries({
        queryKey: queryKeys.workspaces.detail(input.workspaceId),
      })
      queryClient.invalidateQueries({ queryKey: ['orgContext'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.all })
    },
    onSuccess: () => {
      toast.success('Workspace updated')
    },
  })
}

// ─── Delete Workspace ───────────────────────────────────────────────────

export interface DeleteWorkspaceInput {
  workspaceId: string
  transferRecordingsToWorkspaceId?: string
}

/**
 * useDeleteWorkspace - Deletes a workspace and its memberships/entries
 *
 * The database cascades deletions via foreign keys.
 * Invalidates all relevant queries after deletion.
 */
export function useDeleteWorkspace() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: DeleteWorkspaceInput) => {
      // Use server-side RPC that safely bypasses the last-owner trigger
      // when deleting the entire workspace (not just removing a member)
      const { error } = await supabase.rpc('delete_workspace', {
        p_workspace_id: input.workspaceId,
        p_transfer_to_workspace_id: input.transferRecordingsToWorkspaceId ?? null,
      })

      if (error) throw error
      return { workspaceId: input.workspaceId }
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.workspaces.list() })
      await queryClient.cancelQueries({
        queryKey: queryKeys.workspaces.detail(input.workspaceId),
      })

      const previousDetail = queryClient.getQueryData(
        queryKeys.workspaces.detail(input.workspaceId)
      )
      const previousLists = queryClient.getQueriesData<WorkspaceWithMeta[]>({
        queryKey: queryKeys.workspaces.list(),
      })

      queryClient.setQueriesData<WorkspaceWithMeta[]>(
        { queryKey: queryKeys.workspaces.list() },
        (old) => old?.filter((workspace) => workspace.id !== input.workspaceId) || old
      )
      queryClient.setQueryData(queryKeys.workspaces.detail(input.workspaceId), null)

      return { previousDetail, previousLists }
    },
    onSuccess: (_data, variables) => {
      // Invalidate all workspace-related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaceEntries.all })
      queryClient.invalidateQueries({ queryKey: ['orgContext'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.all })
      toast.success('Workspace deleted')
    },
    onError: (error: Error, input, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(
          queryKeys.workspaces.detail(input.workspaceId),
          context.previousDetail
        )
      }
      if (context?.previousLists) {
        for (const [key, data] of context.previousLists) {
          queryClient.setQueryData(key, data)
        }
      }
      toast.error(`Failed to delete workspace: ${error.message}`)
    },
  })
}
// ─── Set Default Workspace ─────────────────────────────────────────────

export interface SetDefaultWorkspaceInput {
  workspaceId: string
}

/**
 * useSetDefaultWorkspace - Marks a workspace as the default for its organization
 *
 * First unsets is_default for all other workspaces in the same organization,
 * then sets it for the target workspace.
 */
export function useSetDefaultWorkspace() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (input: SetDefaultWorkspaceInput) => {
      if (!user) throw new Error('Not authenticated')

      // 1. Get the organization_id for the target workspace
      const { data: targetWs, error: fetchError } = await supabase
        .from('workspaces')
        .select('organization_id')
        .eq('id', input.workspaceId)
        .single()

      if (fetchError) throw fetchError

      // 2. Unset default for all workspaces in that organization
      const { error: unsetError } = await supabase
        .from('workspaces')
        .update({ is_default: false })
        .eq('organization_id', targetWs.organization_id)

      if (unsetError) throw unsetError

      // 3. Set default for the target workspace
      const { data: updatedWs, error: setError } = await supabase
        .from('workspaces')
        .update({ is_default: true })
        .eq('id', input.workspaceId)
        .select()
        .single()

      if (setError) throw setError
      return updatedWs
    },
    onSuccess: () => {
      toast.success('Default workspace updated')
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all })
      queryClient.invalidateQueries({ queryKey: ['orgContext'] }) // Legacy context
    },
    onError: (error: Error) => {
      toast.error(`Failed to set default workspace: ${error.message}`)
    },
  })
}
