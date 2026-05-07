/**
 * useOrganizationContext - Migration bridge for the Organization -> Workspace refactor.
 *
 * This hook overrides the legacy useOrganizationContext and points it to the new
 * useOrgContext (V2 architecture). It maintains the same return shape for
 * backward compatibility while updating internal terminology to "Organization".
 *
 * @pattern context-bridge
 */

import { useEffect, useCallback } from 'react'
import { useOrgContext } from '@/hooks/useOrgContext'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import type { OrganizationWithMembership, WorkspaceWithMembership, OrganizationRole, WorkspaceRole } from '@/types/workspace'

export function useOrganizationContext(): {
  activeOrganizationId: string
  activeOrgId: string
  activeWorkspaceId: string | null
  activeOrganization: OrganizationWithMembership | null
  activeWorkspace: WorkspaceWithMembership | null
  defaultWorkspace: WorkspaceWithMembership | null
  /** @deprecated Use `defaultWorkspace`. Aliased for backward compat — both are keyed on `is_default`. */
  personalWorkspace: WorkspaceWithMembership | null
  organizations: OrganizationWithMembership[]
  workspaces: WorkspaceWithMembership[]
  activeFolderId: string | null
  isSharedView: boolean
  isLoading: boolean
  isInitialized: boolean
  error: null
  switchOrganization: (orgId: string) => void
  switchWorkspace: (workspaceId: string | null) => void
  switchFolder: (folderId: string | null) => void
  switchToFolder: (workspaceId: string, folderId: string | null) => void
  setSharedView: (isShared: boolean) => void
  reset: () => void
  isPersonalOrganization: boolean
  isPersonalOrg: boolean
  isBusinessOrganization: boolean
  organizationRole: OrganizationRole | null
  orgRole: OrganizationRole | null
  workspaceRole: WorkspaceRole | null
} {
  const {
    activeOrgId,
    activeWorkspaceId,
    activeFolderId,
    isSharedView,
    organizations,
    isLoading: orgsLoading,
    isInitialized,
    switchOrg,
    switchWorkspace,
    switchFolder,
    switchToFolder,
    setSharedView,
    reset,
    isPersonalOrg,
  } = useOrgContext()

  // Fetch workspaces for the active organization
  const { workspaces, isLoading: workspacesLoading } = useWorkspaces(activeOrgId)

  // Map Organizations to Organizations (backward compatibility)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const organizationsMapped: OrganizationWithMembership[] = (organizations || []).map((org: any) => ({
    ...org,
    membership: {
      id: org.membershipId,
      organization_id: org.id,
      user_id: '',
      role: org.membershipRole as OrganizationRole,
      created_at: org.created_at,
    },
    member_count: org.member_count || 1,
  }))

  // Map Workspaces to the bridge type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workspacesMapped: WorkspaceWithMembership[] = (workspaces || []).map((ws: any) => ({
    ...ws,
    organization_id: ws.organization_id,
    workspace_type: ws.workspace_type,
    default_sharelink_ttl_days: ws.default_sharelink_ttl_days,
    membership: {
      id: ws.membershipId,
      workspace_id: ws.id,
      user_id: '',
      role: ws.membershipRole as WorkspaceRole,
      created_at: ws.created_at,
    },
  }))

  const activeOrganization = organizationsMapped.find((b) => b.id === activeOrgId) || null
  const activeWorkspaceData = workspacesMapped.find((v) => v.id === activeWorkspaceId) || null
  // The org's default workspace (one per org per Phase 25 partial unique index).
  // For personal orgs the migration set is_default=TRUE on "My Calls"; for business
  // orgs Home is the only is_default. Aliased to `personalWorkspace` for back-compat.
  const defaultWorkspaceData = workspacesMapped.find((v) => v.is_default === true) || null

  const switchOrganizationInternal = useCallback((orgId: string) => switchOrg(orgId), [switchOrg])
  const switchWorkspaceInternal = useCallback((workspaceId: string | null) => switchWorkspace(workspaceId), [switchWorkspace])

  return {
    // State
    activeOrganizationId: activeOrgId, // Legacy alias
    activeOrgId,
    activeWorkspaceId,
    activeFolderId,
    isSharedView,
    activeOrganization,
    activeWorkspace: activeWorkspaceData,
    defaultWorkspace: defaultWorkspaceData,
    // Legacy alias — same workspace as `defaultWorkspace`. Existing consumers
    // (useWorkspaceAssignment.ts, WorkspaceSelector.tsx) keep working.
    personalWorkspace: defaultWorkspaceData,
    organizations: organizationsMapped,
    workspaces: workspacesMapped,

    // Loading
    isLoading: orgsLoading || workspacesLoading,
    isInitialized,
    error: null,

    // Actions
    switchOrganization: switchOrganizationInternal,
    switchWorkspace: switchWorkspaceInternal,
    switchFolder,
    switchToFolder,
    setSharedView,
    reset,

    // Helpers
    isPersonalOrganization: activeOrganization?.type === 'personal', // Legacy alias
    isPersonalOrg: isPersonalOrg, // Already a boolean from useOrgContext
    isBusinessOrganization: activeOrganization?.type === 'business', // Legacy alias
    organizationRole: activeOrganization?.membership.role || null, // Legacy alias
    orgRole: activeOrganization?.membership.role || null,
    workspaceRole: activeWorkspaceData?.membership.role || null,
  }
}
