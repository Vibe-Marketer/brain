/**
 * WorkspaceManagement Component
 *
 * Workspace management UI for the Organizations settings tab.
 * - Lists workspaces in an organization
 * - Create workspace dialog
 * - Default folders created for team workspaces (Hall of Fame, Manager Reviews)
 *
 * @pattern settings-workspace-management
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  RiAddLine,
  RiTeamLine,
  RiDeleteBinLine,
  RiArrowRightSLine,
  RiArrowRightLine,
  RiInformationLine,
} from '@remixicon/react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { queryKeys } from '@/lib/query-config'
import { usePanelStore } from '@/stores/panelStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { DeleteWorkspaceDialog } from '@/components/dialogs/DeleteWorkspaceDialog'
import type { WorkspaceType, WorkspaceRole } from '@/types/workspace'

interface WorkspaceManagementProps {
  orgId: string
  canManage: boolean
}

// Interface for workspace data returned from query
interface WorkspaceQueryResult {
  id: string
  organization_id: string
  name: string
  workspace_type: string
  default_sharelink_ttl_days: number
  is_default: boolean
  created_at: string
  updated_at: string
  memberships: Array<{
    id: string
    user_id: string
    role: string
  }>
}


export function WorkspaceManagement({ orgId, canManage }: WorkspaceManagementProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [newWorkspaceType, setNewWorkspaceType] = useState<WorkspaceType>('team')

  // Fetch workspaces for this organization
  const { data: workspaces, isLoading } = useQuery({
    queryKey: queryKeys.workspaces.list(orgId),
    queryFn: async (): Promise<WorkspaceQueryResult[]> => {
      const { data, error } = await supabase
        .from('workspaces')
        .select(`
          id,
          organization_id:organization_id,
          name,
          workspace_type:workspace_type,
          default_sharelink_ttl_days,
          is_default,
          created_at,
          updated_at,
          memberships:workspace_memberships (
            id,
            user_id,
            role
          )
        `)
        .eq('organization_id', orgId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as WorkspaceQueryResult[]
    },
    enabled: !!orgId,
  })

  // Create workspace mutation
  const createWorkspace = useMutation({
    mutationFn: async ({ name, type }: { name: string; type: WorkspaceType }) => {
      // Create workspace
      const { data: workspace, error: workspaceError } = await supabase
        .from('workspaces')
        .insert({
          organization_id: orgId,
          name,
          workspace_type: type,
        })
        .select()
        .single()

      if (workspaceError) throw workspaceError

      // Create workspace membership for creator as owner
      const { error: membershipError } = await supabase
        .from('workspace_memberships')
        .insert({
          workspace_id: workspace.id,
          user_id: user!.id,
          role: 'workspace_owner',
        })

      if (membershipError) throw membershipError

      // Create default folders for team workspaces (per CONTEXT.md)
      if (type === 'team') {
        const defaultFolders = [
          { name: 'Hall of Fame', visibility: 'all_members' },
          { name: 'Manager Reviews', visibility: 'managers_only' },
        ]

        for (const folder of defaultFolders) {
          await supabase.from('folders').insert({
            workspace_id: workspace.id,
            user_id: user!.id,
            organization_id: orgId,
            name: folder.name,
            visibility: folder.visibility,
          })
        }
      }

      return workspace
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.list(orgId) })
      queryClient.invalidateQueries({ queryKey: ['orgContext'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.all })
      setCreateDialogOpen(false)
      setNewWorkspaceName('')
      toast.success('Workspace created successfully')
    },
    onError: (error) => {
      toast.error(`Failed to create workspace: ${error.message}`)
    },
  })

  const handleCreateWorkspace = () => {
    if (!newWorkspaceName.trim()) {
      toast.error('Workspace name is required')
      return
    }
    createWorkspace.mutate({ name: newWorkspaceName.trim(), type: newWorkspaceType })
  }

  if (isLoading) {
    return <div className="animate-pulse h-32 bg-muted rounded-lg" />
  }

  return (
    <div className="space-y-4">

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Workspaces</h3>
          <p className="text-sm text-muted-foreground">
            Manage collaboration workspaces within this organization
          </p>
        </div>
        {canManage && (
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" aria-label="Create workspace">
                <RiAddLine className="h-4 w-4 mr-2" />
                Create Workspace
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Workspace</DialogTitle>
                <DialogDescription>
                  A workspace is a shared space inside an organization for one team, client, or community.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Workspace Name</label>
                  <Input
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    placeholder="e.g., Sales, Client A"
                    aria-label="Workspace name"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Workspace Type</label>
                  <Select
                    value={newWorkspaceType}
                    onValueChange={(v) => setNewWorkspaceType(v as WorkspaceType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="team">Team</SelectItem>
                      <SelectItem value="youtube">YouTube</SelectItem>
                      <SelectItem value="coach" disabled>
                        Coach (Coming Soon)
                      </SelectItem>
                      <SelectItem value="client" disabled>
                        Client (Coming Soon)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="hollow"
                  onClick={() => setCreateDialogOpen(false)}
                  aria-label="Cancel workspace creation"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateWorkspace}
                  disabled={createWorkspace.isPending}
                  aria-label="Create workspace"
                >
                  {createWorkspace.isPending ? 'Creating...' : 'Create Workspace'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

          {/* Workspace list */}
      <div className="space-y-3">
        {workspaces?.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              No workspaces yet. Create one to get started.
            </CardContent>
          </Card>
        ) : (
          workspaces?.map((workspace) => (
            <HubCard
              key={workspace.id}
              workspace={workspace}
              canManage={canManage}
            />
          ))
        )}
      </div>
    </div>
  )
}

interface HubCardProps {
  workspace: WorkspaceQueryResult
  canManage: boolean
}

function HubCard({ workspace, canManage }: HubCardProps) {
  const { openPanel } = usePanelStore()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const memberCount = workspace.memberships?.length || 0

  return (
    <>
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RiTeamLine className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  {workspace.name}
                  {workspace.is_default && (
                    <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-vibe-orange/10 text-vibe-orange border-vibe-orange/20">
                      Default
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-xs">
                  {memberCount} member{memberCount !== 1 ? 's' : ''} &middot; {workspace.workspace_type}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="capitalize">
                {workspace.workspace_type}
              </Badge>
              {canManage && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete workspace"
                  onClick={() => setDeleteDialogOpen(true)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <RiDeleteBinLine className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                aria-label="Open workspace detail"
                onClick={() => openPanel('workspace-detail', { type: 'workspace-detail', workspaceId: workspace.id })}
              >
                <RiArrowRightSLine className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Delete workspace dialog - uses same dialog as WorkspacesPage */}
      {deleteDialogOpen && (
        <DeleteWorkspaceDialogWrapper
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          workspace={workspace}
        />
      )}
    </>
  )
}

/**
 * Wrapper to adapt WorkspaceQueryResult to DeleteWorkspaceDialog's expected WorkspaceDetail type
 */
function DeleteWorkspaceDialogWrapper({
  open,
  onOpenChange,
  workspace,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspace: WorkspaceQueryResult
}) {
  const memberCount = workspace.memberships?.length || 0

  return (
    <DeleteWorkspaceDialog
      open={open}
      onOpenChange={onOpenChange}
      workspace={{
        id: workspace.id,
        organization_id: workspace.organization_id,
        name: workspace.name,
        workspace_type: workspace.workspace_type as WorkspaceType,
        default_sharelink_ttl_days: workspace.default_sharelink_ttl_days,
        created_at: workspace.created_at,
        updated_at: workspace.updated_at,
        member_count: memberCount,
        user_role: 'workspace_owner',
        memberships: (workspace.memberships || []).map((m) => ({
          ...m,
          role: m.role as WorkspaceRole,
          created_at: workspace.created_at,
        })),
      } as any}
      recordingCount={0}
    />
  )
}

export default WorkspaceManagement
