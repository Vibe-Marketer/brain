/**
 * OrganizationsTab Component
 *
 * Settings tab for managing organizations and workspaces.
 * - Shows all organizations user is a member of
 * - Displays workspaces within each organization
 * - Allows workspace creation and management for organization admins/owners
 * - Lets owners/admins edit the cross-organization default behavior
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
import { useUpdateCrossOrgDefault } from '@/hooks/useOrganizationMutations'
import { WorkspaceManagement } from './WorkspaceManagement'
import DeleteOrganizationDialog from '@/components/dialogs/DeleteOrganizationDialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SelectionButton } from '@/components/ui/selection-button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'

export function OrganizationsTab() {
  const {
    organizations,
    activeOrganization,
    isLoading,
    orgRole: _orgRole,
  } = useOrganizationContext()
  const [deletingOrg, setDeletingOrg] = useState<typeof organizations[0] | null>(null)
  const updateCrossOrgDefault = useUpdateCrossOrgDefault()

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

      {organizations.length === 0 ? (
        <div className="text-sm text-muted-foreground">No organizations yet.</div>
      ) : (
        <>
          {/* Org selector */}
          <div className="flex flex-wrap gap-2">
            {organizations.map((org) => (
              <SelectionButton
                key={org.id}
                active={org.id === selectedOrgId}
                onClick={() => setSelectedOrgId(org.id)}
              >
                <RiBuilding4Line className="h-4 w-4 mr-2" />
                {org.name}
              </SelectionButton>
            ))}
          </div>

          {selectedOrg && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <RiBuilding4Line className="h-5 w-5" />
                        {selectedOrg.name}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        <RiUserLine className="h-3.5 w-3.5 inline-block mr-1" />
                        {selectedOrg.type === 'personal'
                          ? 'Your personal organization'
                          : 'Business organization'}
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className="space-y-1.5">
                        <Label htmlFor="cross-org-default-select" className="text-muted-foreground text-xs uppercase tracking-wide">
                          Cross-Organization Default
                        </Label>
                        {canManageOrg(selectedOrg.membership?.role ?? null) ? (
                          <>
                            <Select
                              value={selectedOrg.cross_org_default}
                              onValueChange={(value) => {
                                if (value !== selectedOrg.cross_org_default) {
                                  updateCrossOrgDefault.mutate({
                                    organizationId: selectedOrg.id,
                                    crossOrgDefault: value as 'copy_only' | 'copy_and_remove',
                                  })
                                }
                              }}
                              disabled={updateCrossOrgDefault.isPending}
                            >
                              <SelectTrigger id="cross-org-default-select" className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="copy_only">Copy only (keep in source)</SelectItem>
                                <SelectItem value="copy_and_remove">Move (copy and remove from source)</SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="text-[11px] text-muted-foreground">
                              Default behavior when recordings move into this org from another org. Each transfer can override this.
                            </p>
                          </>
                        ) : (
                          <div className="text-sm">
                            {selectedOrg.cross_org_default === 'copy_only'
                              ? 'Copy only (keep in source)'
                              : selectedOrg.cross_org_default === 'copy_and_remove'
                                ? 'Move (copy and remove from source)'
                                : selectedOrg.cross_org_default
                                  ? selectedOrg.cross_org_default.replaceAll('_', ' ')
                                  : 'None'}
                          </div>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <span className="text-muted-foreground text-xs uppercase tracking-wide">Created</span>
                        <div className="text-sm">
                          {new Date(selectedOrg.created_at).toLocaleDateString()}
                        </div>
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
