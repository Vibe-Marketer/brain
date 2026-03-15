/**
 * EditWorkspaceDialog - Dialog for editing workspace name and settings
 *
 * Allows renaming workspace and changing share link TTL.
 * Includes a "Delete Workspace" button that opens the DeleteWorkspaceDialog.
 *
 * @pattern dialog-form
 * @brand-version v4.2
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RiDeleteBinLine } from '@remixicon/react'
import { useUpdateWorkspace } from '@/hooks/useWorkspaceMutations'
import type { WorkspaceDetail } from '@/hooks/useWorkspaces'
import type { WorkspaceRole } from '@/types/workspace'

export interface EditWorkspaceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspace: WorkspaceDetail | null
  userRole: WorkspaceRole | null
  onDeleteRequest?: () => void
}

/** Roles that can edit workspace settings */
const CAN_EDIT_ROLES: WorkspaceRole[] = ['workspace_owner', 'workspace_admin']

/** Roles that can delete a workspace */
const CAN_DELETE_ROLES: WorkspaceRole[] = ['workspace_owner']

export function EditWorkspaceDialog({
  open,
  onOpenChange,
  workspace,
  userRole,
  onDeleteRequest,
}: EditWorkspaceDialogProps) {
  const [name, setName] = useState('')
  const [ttlDays, setTtlDays] = useState<number>(7)
  const updateWorkspace = useUpdateWorkspace()

  const canEdit = userRole ? CAN_EDIT_ROLES.includes(userRole) : false
  const canDelete = userRole ? CAN_DELETE_ROLES.includes(userRole) : false

  // Sync form state when workspace changes
  useEffect(() => {
    if (workspace) {
      setName(workspace.name)
      setTtlDays(workspace.default_sharelink_ttl_days || 7)
    }
  }, [workspace])

  const hasChanges =
    workspace &&
    (name.trim() !== workspace.name ||
      ttlDays !== (workspace.default_sharelink_ttl_days || 7))

  const handleSubmit = useCallback(() => {
    if (!workspace || !name.trim() || !hasChanges) return

    updateWorkspace.mutate(
      {
        workspaceId: workspace.id,
        name: name.trim(),
        defaultShareLinkTtlDays: ttlDays,
      },
      {
        onSuccess: () => {
          onOpenChange(false)
        },
      }
    )
  }, [workspace, name, ttlDays, hasChanges, updateWorkspace, onOpenChange])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && hasChanges && !updateWorkspace.isPending) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit, hasChanges, updateWorkspace.isPending]
  )

  if (!workspace) return null

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent aria-describedby="edit-workspace-description">
          <DialogHeader>
            <DialogTitle>Workspace Settings</DialogTitle>
            <DialogDescription id="edit-workspace-description">
              Update workspace name and configuration
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Workspace name */}
            <div className="space-y-2">
              <Label htmlFor="edit-workspace-name">Workspace Name</Label>
              <Input
                id="edit-workspace-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Workspace name"
                disabled={!canEdit}
                autoFocus
                aria-label="Edit workspace name"
              />
            </div>

            {/* Share link TTL */}
            <div className="space-y-2">
              <Label htmlFor="edit-workspace-ttl">Default Share Link Expiration (days)</Label>
              <Input
                id="edit-workspace-ttl"
                type="number"
                min={1}
                max={365}
                value={ttlDays}
                onChange={(e) => setTtlDays(Math.max(1, parseInt(e.target.value) || 1))}
                disabled={!canEdit}
                aria-label="Default share link expiration in days"
              />
              <p className="text-xs text-muted-foreground">
                Shared links will expire after this many days
              </p>
            </div>

            {/* Workspace type (read-only) */}
            <div className="space-y-2">
              <Label>Workspace Type</Label>
              <p className="text-sm text-muted-foreground capitalize">
                {workspace.workspace_type}
              </p>
              <p className="text-xs text-muted-foreground">
                Workspace type cannot be changed after creation.
              </p>
            </div>
          </div>

          {canDelete && workspace.workspace_type !== 'personal' && (
            <div className="pt-4 border-t border-border/40">
              <Button
                variant="destructive"
                onClick={() => {
                  onOpenChange(false)
                  onDeleteRequest?.()
                }}
                className="w-full gap-1.5"
                aria-label="Request to delete this workspace"
              >
                <RiDeleteBinLine className="h-4 w-4" aria-hidden="true" />
                Delete Workspace
              </Button>
            </div>
          )}

          <DialogFooter className="flex items-center justify-end">
            <Button
              variant="hollow"
              onClick={() => onOpenChange(false)}
              disabled={updateWorkspace.isPending}
              aria-label="Cancel changes"
            >
              Cancel
            </Button>
            {canEdit && (
              <Button
                onClick={handleSubmit}
                disabled={!hasChanges || updateWorkspace.isPending}
                aria-label="Save settings changes"
              >
                {updateWorkspace.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default EditWorkspaceDialog
