/**
 * useOrganizationMutations - Mutation hooks for organization operations
 *
 * Provides useCreateBusinessOrganization hook for creating business organizations
 * with auto-created default workspace, membership, and organization context switch.
 *
 * @pattern tanstack-query-mutations
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useOrganizationContext } from '@/hooks/useOrganizationContext'
import { queryKeys } from '@/lib/query-config'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import type { OrganizationWithMembership } from '@/types/workspace'

// Type-safe supabase client wrapper for tables not yet in generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

// ─── Create Business Organization ───────────────────────────────────

export interface CreateBusinessOrganizationInput {
  name: string
  crossOrganizationDefault?: 'copy_only' | 'copy_and_remove'
  logoUrl?: string
  defaultWorkspaceName?: string
}

/**
 * useCreateBusinessOrganization - Creates a business organization with owner membership and default workspace
 *
 * Flow:
 * 1. Create organization record (type='business')
 * 2. Create organization membership for creator as 'organization_owner'
 * 3. Create default workspace in the organization
 * 4. Create workspace membership for creator as 'workspace_owner' on default workspace
 * 5. Invalidate queries, auto-switch to new organization, navigate to /workspaces
 */
export function useCreateBusinessOrganization() {
  const { user } = useAuth()
  const { switchOrganization } = useOrganizationContext()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async (input: CreateBusinessOrganizationInput) => {
      if (!user) throw new Error('Not authenticated')

      const orgName = input.name.trim()
      if (orgName.length < 3 || orgName.length > 50) {
        throw new Error('Organization name must be between 3 and 50 characters')
      }

      const { data: createResult, error: createError } = await db
        .rpc('create_business_organization', {
          p_name: orgName,
          p_cross_org_default: input.crossOrganizationDefault || 'copy_only',
          p_logo_url: input.logoUrl || null,
          p_default_workspace_name: input.defaultWorkspaceName || null,
        })
        .single()

      if (createError) throw createError
      if (!createResult?.organization_id) {
        throw new Error('Business organization creation did not return an organization id')
      }

      const { data: organization, error: orgError } = await db
        .from('organizations')
        .select('*')
        .eq('id', createResult.organization_id)
        .single()

      if (orgError) throw orgError

      return { organization, workspace: { id: createResult.workspace_id } }
    },
    onSuccess: (data, variables) => {
      // Invalidate organization context queries to pick up new organization
      queryClient.invalidateQueries({ queryKey: ['orgContext'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.list() })

      // Auto-switch to the new organization
      switchOrganization(data.organization.id)

      // Navigate to /workspaces so user sees the new organization's default workspace
      navigate('/workspaces')

      toast.success(`Business organization "${variables.name}" created`, {
        description: "You're now viewing it",
      })
    },
    onError: (error: Error) => {
      toast.error(`Failed to create business organization: ${error.message}`)
    },
  })
}

// ─── Delete Organization ───────────────────────────────────────────

export interface DeleteOrganizationInput {
  organizationId: string
  /** If true, move calls back to personal organization before deleting */
  moveCallsToPersonal?: boolean
}

/**
 * useDeleteOrganization - Deletes a business organization
 *
 * Flow:
 * 1. Optionally move recordings from the organization back to user's personal organization
 * 2. Delete all workspace memberships, workspaces, organization memberships
 * 3. Delete the organization itself (cascading deletes handle related data)
 * 4. Switch to personal organization, invalidate queries
 *
 * Cannot delete personal organizations.
 */
export function useDeleteOrganization() {
  const { user } = useAuth()
  const { organizations, switchOrganization } = useOrganizationContext()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async (input: DeleteOrganizationInput) => {
      if (!user) throw new Error('Not authenticated')

      // Find the organization to verify it's a business organization
      const organization = organizations.find((b: OrganizationWithMembership) => b.id === input.organizationId)
      if (!organization) throw new Error('Organization not found')
      if (organization.type === 'personal') throw new Error('Cannot delete personal organization')
      
      // Allow both owner and admin roles
      const userRole = organization.membership.role
      if (
        userRole !== 'organization_owner' &&
        userRole !== 'organization_admin'
      ) {
        throw new Error('Only organization owners and admins can delete organizations')
      }

      // If moveCallsToPersonal, move recordings to personal organization
      if (input.moveCallsToPersonal) {
        const personalOrg = organizations.find((b: OrganizationWithMembership) => b.type === 'personal')
        if (personalOrg) {
          // Update recordings to point to personal organization
          const { error: moveError } = await db
            .from('recordings')
            .update({ organization_id: personalOrg.id })
            .eq('organization_id', input.organizationId)

          if (moveError) throw moveError
        }
      }

      // Delete the organization (cascading deletes handle workspaces, memberships, workspace_entries)
      const { error: deleteError } = await db
        .from('organizations')
        .delete()
        .eq('id', input.organizationId)

      if (deleteError) throw deleteError

      return { organizationId: input.organizationId }
    },
    onSuccess: () => {
      // Switch to personal organization
      const personalOrg = organizations.find((b: OrganizationWithMembership) => b.type === 'personal')
      if (personalOrg) {
        switchOrganization(personalOrg.id)
      }

      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['orgContext'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.list() })

      navigate('/')
      toast.success('Organization deleted successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete organization: ${error.message}`)
    },
  })
}
