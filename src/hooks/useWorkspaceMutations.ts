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
import type { WorkspaceType, WorkspaceWithMeta } from '@/types/workspace'

// Type-safe supabase client wrapper for tables not yet in generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

// ─── Create Workspace ───────────────────────────────────────────────────

export interface CreateWorkspaceInput {
  orgId: string // Renamed from bankId
  name: string
  workspaceType: WorkspaceType
  defaultShareLinkTtlDays?: number
}

/**
 * useCreateWorkspace - Creates a new workspace with owner membership and default folders
 *
 * Follows the WorkspaceManagement.tsx pattern: creates workspace, adds creator as workspace_owner,
 * and creates default folders for team workspaces.
 */
export function useCreateWorkspace() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateWorkspaceInput) => {
      if (!user) throw new Error('Not authenticated')

      // Create workspace
      const { data: workspace, error: workspaceError } = await db
        .from('workspaces')
        .insert({
          organization_id: input.orgId,
          name: input.name.trim(),
          workspace_type: input.workspaceType,
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

      // Create workspace membership for creator as owner
      const { error: membershipError } = await db
        .from('workspace_memberships')
        .insert({
          workspace_id: workspace.id,
          user_id: user.id,
          role: 'workspace_owner',
        })

      if (membershipError) throw membershipError

      // Create default folders for team workspaces (per CONTEXT.md)
      if (input.workspaceType === 'team') {
        const defaultFolders = [
          { name: 'Hall of Fame', visibility: 'all_members' },
          { name: 'Manager Reviews', visibility: 'managers_only' },
        ]

        for (const folder of defaultFolders) {
          const { error: folderError } = await supabase.from('folders').insert({
            workspace_id: workspace.id,
            user_id: user.id,
            organization_id: input.orgId,
            name: folder.name,
            visibility: folder.visibility,
          })

          if (folderError) throw folderError
        }
      }

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
        workspace_type: input.workspaceType,
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
      queryClient.invalidateQueries({ queryKey: ['bankContext'] })
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

      const { data, error } = await db
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (old: any) => {
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
      queryClient.invalidateQueries({ queryKey: ['bankContext'] })
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
      if (
        input.transferRecordingsToWorkspaceId &&
        input.transferRecordingsToWorkspaceId !== input.workspaceId
      ) {
        const { error: transferError } = await db
          .from('workspace_entries')
          .update({ workspace_id: input.transferRecordingsToWorkspaceId })
          .eq('workspace_id', input.workspaceId)

        if (transferError) throw transferError
      }

      const { error } = await db
        .from('workspaces')
        .delete()
        .eq('id', input.workspaceId)

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
      queryClient.invalidateQueries({ queryKey: ['bankContext'] })
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
