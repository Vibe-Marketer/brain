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

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  RiBuilding4Line,
  RiUserLine,
  RiArrowRightLine,
  RiDeleteBinLine,
  RiInformationLine,
} from '@remixicon/react'
import { useOrganizationContext } from '@/hooks/useOrganizationContext'
import { WorkspaceManagement } from './WorkspaceManagement'
import DeleteOrganizationDialog from '@/components/dialogs/DeleteOrganizationDialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function OrganizationsTab() {
  const navigate = useNavigate()
  const {
    organizations,
    activeOrganization,
    isLoading,
    orgRole,
  } = useOrganizationContext()
  const [deletingOrg, setDeletingOrg] = useState<typeof organizations[0] | null>(null)

  if (isLoading) {
    return <div className="animate-pulse h-64 bg-muted rounded-lg" />
  }

  // Determine if the current user can manage each organization
  const canManageOrg = (role: string | null) => {
    return role === 'organization_owner' || role === 'organization_admin'
  }

  // Default to first organization if no activeOrganization
  const defaultOrgId = activeOrganization?.id || organizations[0]?.id

  return (
    <div className="space-y-6">
       <div>
        <h2 className="text-2xl font-bold">Organizations & Workspaces</h2>
        <p className="text-muted-foreground">
          Manage your organizations and collaboration workspaces
        </p>
      </div>

      {/* Migration banner - workspace management has moved */}
      <div className="flex items-start gap-3 p-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
        <RiInformationLine className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
            Workspace management has moved to the Workspaces page
          </p>
          <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
            Create, manage, and invite members to workspaces from the dedicated Workspaces page.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/workspaces')}
          className="flex-shrink-0 gap-1.5"
          aria-label="Go to Workspaces"
        >
          Go to Workspaces
          <RiArrowRightLine className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Organization list as tabs */}
      {organizations.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            No organizations found. This shouldn't happen - please contact support.
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue={defaultOrgId} className="space-y-4">
          <TabsList>
            {organizations.map((org) => (
              <TabsTrigger
                key={org.id}
                value={org.id}
                className="gap-2"
              >
                {org.type === 'personal' ? (
                  <RiUserLine className="h-4 w-4" />
                ) : (
                  <RiBuilding4Line className="h-4 w-4" />
                )}
                {org.name.toUpperCase()}
              </TabsTrigger>
            ))}
          </TabsList>

          {organizations.map((org) => (
            <TabsContent key={org.id} value={org.id} className="space-y-6">
              {/* Organization details card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{org.name}</CardTitle>
                      <CardDescription>
                        {org.type === 'personal'
                          ? 'Your personal organization for private recordings'
                          : 'Business organization for team collaboration'}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize">
                        {org.type}
                      </Badge>
                      <Badge variant="secondary" className="capitalize">
                        {org.membership.role.replace('bank_', '')}
                      </Badge>
                      {org.type === 'business' && org.membership.role === 'organization_owner' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Delete organization"
                          onClick={() => setDeletingOrg(org)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <RiDeleteBinLine className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                {org.type === 'business' && (
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Cross-Organization Default:</span>
                        <span className="ml-2 capitalize">
                          {org.cross_organization_default.replace('_', ' ')}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Created:</span>
                        <span className="ml-2">
                          {new Date(org.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* Workspace management */}
              <WorkspaceManagement
                orgId={org.id}
                canManage={canManageOrg(org.membership.role)}
              />
            </TabsContent>
          ))}
        </Tabs>
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
