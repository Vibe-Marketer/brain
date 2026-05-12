/**
 * OrganizationsTab Component
 *
 * Settings tab for managing organizations and workspaces.
 * - Shows all organizations user is a member of
 * - Displays workspaces within each organization
 * - Allows workspace creation and management for organization admins/owners
 *
 * @pattern settings-organizations-tab
 */

import { useEffect, useState } from 'react'
import {
  RiBuilding4Line,
  RiUserLine,
  RiDeleteBinLine,
} from '@remixicon/react'
import { useOrganizationContext } from '@/hooks/useOrganizationContext'
import { WorkspaceManagement } from './WorkspaceManagement'
import DeleteOrganizationDialog from '@/components/dialogs/DeleteOrganizationDialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SelectionButton } from '@/components/ui/selection-button'

export function OrganizationsTab() {
  const {
    organizations,
    activeOrganization,
    isLoading,
    orgRole,
  } = useOrganizationContext()
  const [deletingOrg, setDeletingOrg] = useState<typeof organizations[0] | null>(null)

  // Default to active org or first
  const defaultOrgId = activeOrganization?.id || organizations[0]?.id || ''
  const [selectedOrgId, setSelectedOrgId] = useState<string>(defaultOrgId)

  // Keep selection in sync if active org changes externally
  useEffect(() => {
    if (defaultOrgId && !organizations.some((o) => o.id === selectedOrgId)) {
      setSelectedOrgId(defaultOrgId)
    }
  }, [defaultOrgId, organizations, selectedOrgId])

  if (isLoading) {
    return <div className="animate-pulse h-64 bg-muted rounded-lg" />
  }

  // Determine if the current user can manage each organization
  const canManageOrg = (role: string | null) => {
    return role === 'organization_owner' || role === 'organization_admin'
  }

  const selectedOrg =
    organizations.find((o) => o.id === selectedOrgId) || organizations[0]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Workspaces</h2>
        <p className="text-muted-foreground">
          Manage your organizational structure and collaboration workspaces
        </p>
      </div>

      {organizations.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            No organizations found. This shouldn't happen - please contact support.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Vertical canonical-card list of orgs (VIS-05) */}
          <div className="flex flex-col gap-1 max-w-2xl">
            {organizations.map((org) => {
              const memberCount = (org as { member_count?: number }).member_count ?? 1
              const role = (org.membership?.role || 'member').replace('organization_', '')
              const description = `${memberCount} member${memberCount === 1 ? '' : 's'} · ${role}`
              return (
                <SelectionButton
                  key={org.id}
                  selected={selectedOrgId === org.id}
                  icon={
                    org.type === 'personal' ? (
                      <RiUserLine className="h-4 w-4" />
                    ) : (
                      <RiBuilding4Line className="h-4 w-4" />
                    )
                  }
                  label={org.name}
                  description={description}
                  size="md"
                  onClick={() => setSelectedOrgId(org.id)}
                  aria-label={`Select ${org.name}`}
                />
              )
            })}
          </div>

          {/* Selected org detail */}
          {selectedOrg && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{selectedOrg.name}</CardTitle>
                      <CardDescription>
                        {selectedOrg.type === 'personal'
                          ? 'Your personal organization for private recordings'
                          : 'Business organization for team collaboration'}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize">
                        {selectedOrg.type}
                      </Badge>
                      <Badge variant="secondary" className="capitalize">
                        {(selectedOrg.membership?.role || 'member').replace('organization_', '')}
                      </Badge>
                      {selectedOrg.type === 'business' &&
                        selectedOrg.membership?.role === 'organization_owner' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Delete organization"
                            onClick={() => setDeletingOrg(selectedOrg)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <RiDeleteBinLine className="h-4 w-4" />
                          </Button>
                        )}
                    </div>
                  </div>
                </CardHeader>
                {selectedOrg.type === 'business' && (
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Cross-Organization Default:</span>
                        <span className="ml-2 capitalize">
                          {selectedOrg.cross_org_default
                            ? selectedOrg.cross_org_default?.replace('_', ' ')
                            : 'None'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Created:</span>
                        <span className="ml-2">
                          {new Date(selectedOrg.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>

              <WorkspaceManagement
                orgId={selectedOrg.id}
                canManage={canManageOrg(selectedOrg.membership?.role ?? null)}
              />
            </div>
          )}
        </>
      )}

      {/* Delete Organization Dialog */}
      <DeleteOrganizationDialog
        open={!!deletingOrg}
        onOpenChange={(open) => !open && setDeletingOrg(null)}
        organization={deletingOrg}
      />
    </div>
  )
}

export default OrganizationsTab
