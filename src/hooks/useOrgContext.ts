import { useEffect, useCallback } from 'react'
import { useOrgContextStore } from '@/stores/orgContextStore'
import { useOrganizations } from '@/hooks/useOrganizations'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import { isPersonalOrg } from '@/services/organizations.service'
import type { OrganizationWithRole } from '@/services/organizations.service'
import type { Organization } from '@/types/workspace'

/**
 * useOrgContext — convenience hook combining org context store with live org data.
 *
 * Provides:
 * - activeOrg, organizations list
 * - activeOrgId, activeWorkspaceId, activeFolderId from store
 * - switchOrg, switchWorkspace, switchFolder actions
 * - isPersonalOrg helper for the active org
 *
 * On first load: if no activeOrgId is set, auto-selects the personal org.
 * If no personal org exists, falls back to the first org in the list.
 *
 * LOCKED DECISION: switchOrg calls store.setActiveOrg which resets
 * activeWorkspaceId to null (clean slate per org).
 */
export function useOrgContext() {
  const {
    activeOrgId,
    activeWorkspaceId,
    activeFolderId,
    isInitialized,
    setActiveOrg,
    setActiveWorkspace,
    setActiveFolder,
    initialize,
    reset,
  } = useOrgContextStore()

  const { data: organizations, isLoading: orgsLoading } = useOrganizations()
  
  // Also fetch workspaces for the active (or proposed) org to handle auto-init
  const { workspaces, isLoading: workspacesLoading } = useWorkspaces(activeOrgId)

  // Auto-initialize: if no activeOrgId set yet, pick personal org or first org
  useEffect(() => {
    if (isInitialized) return
    if (orgsLoading || !organizations || organizations.length === 0) return

    const personalOrg = organizations.find((org) => isPersonalOrg(org))
    const defaultOrg = personalOrg ?? organizations[0]
    
    // Initialize with org only — no default workspace.
    // null activeWorkspaceId = "All Calls" (every recording in the org).
    // User explicitly picks a workspace from the sidebar to filter.
    initialize(defaultOrg.id)
  }, [organizations, orgsLoading, isInitialized, initialize, workspaces, workspacesLoading])

  // Derived: find the active org object from the list
  const activeOrg: OrganizationWithRole | null =
    organizations?.find((org) => org.id === activeOrgId) ?? null

  /**
   * Switch to a different organization.
   * LOCKED: resets workspace selection to null (clean slate per org).
   */
  const switchOrg = useCallback(
    (orgId: string) => {
      setActiveOrg(orgId)
    },
    [setActiveOrg]
  )

  /** Switch to a different workspace, or null for "All Calls" (org-wide view). */
  const switchWorkspace = useCallback(
    (workspaceId: string | null) => {
      setActiveWorkspace(workspaceId)
    },
    [setActiveWorkspace]
  )

  /** Set or clear the active folder within the active workspace. */
  const switchFolder = useCallback(
    (folderId: string | null) => {
      setActiveFolder(folderId)
    },
    [setActiveFolder]
  )

  return {
    // Store state
    activeOrgId,
    activeWorkspaceId,
    activeFolderId,
    isInitialized,

    // Derived data
    activeOrg,
    organizations: organizations ?? [],
    workspaces: workspaces ?? [],

    // Loading state
    isLoading: orgsLoading || (activeOrgId ? workspacesLoading : false),

    // Actions
    switchOrg,
    switchWorkspace,
    switchFolder,
    reset,

    // Helpers
    isPersonalOrg: activeOrg ? isPersonalOrg(activeOrg as Organization) : false,
    activeOrgRole: activeOrg?.membershipRole ?? null,
  }
}
