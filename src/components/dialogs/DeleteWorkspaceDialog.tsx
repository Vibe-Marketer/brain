/**
 * DeleteWorkspaceDialog - Confirmation dialog for workspace deletion
 *
 * Requires typing the workspace name to confirm deletion.
 * Prevents accidental deletion of workspaces with recordings.
 *
 * @pattern dialog-confirmation
 * @brand-version v4.2
 */

import { useState, useCallback, useEffect, useMemo } from 'react'
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
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RiAlertLine } from '@remixicon/react'
import { useDeleteWorkspace } from '@/hooks/useWorkspaceMutations'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import { useNavigate } from 'react-router-dom'
import type { WorkspaceDetail } from '@/hooks/useWorkspaces'

export interface DeleteWorkspaceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspace: WorkspaceDetail | null
  recordingCount?: number | null
}

export function DeleteWorkspaceDialog({
  open,
  onOpenChange,
  workspace,
  recordingCount,
}: DeleteWorkspaceDialogProps) {
  const [confirmText, setConfirmText] = useState('')
  const [transferEnabled, setTransferEnabled] = useState(false)
  const [transferWorkspaceId, setTransferWorkspaceId] = useState('')
  const deleteWorkspace = useDeleteWorkspace()
  const navigate = useNavigate()
  const { workspaces } = useWorkspaces(workspace?.organization_id || null)

  const transferOptions = useMemo(
    () => workspaces.filter((option) => option.id !== workspace?.id),
    [workspaces, workspace]
  )

  useEffect(() => {
    if (!open) return
    if (transferWorkspaceId || transferOptions.length === 0) return
    setTransferWorkspaceId(transferOptions[0].id)
  }, [open, transferWorkspaceId, transferOptions])

  const isConfirmed = workspace ? confirmText === workspace.name : false
  const needsTransferTarget = transferEnabled && !transferWorkspaceId
  const canDelete = isConfirmed && !needsTransferTarget

  const handleDelete = useCallback(() => {
    if (!workspace || !isConfirmed) return

    deleteWorkspace.mutate(
      {
        workspaceId: workspace.id,
        transferRecordingsToWorkspaceId: transferEnabled ? transferWorkspaceId : undefined,
      },
      {
        onSuccess: () => {
          setConfirmText('')
          setTransferEnabled(false)
          setTransferWorkspaceId('')
          onOpenChange(false)
          // Navigate back to home
          navigate('/')
        },
      }
    )
  }, [workspace, isConfirmed, deleteWorkspace, onOpenChange, navigate, transferEnabled, transferWorkspaceId])

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        setConfirmText('')
        setTransferEnabled(false)
        setTransferWorkspaceId('')
      }
      onOpenChange(newOpen)
    },
    [onOpenChange]
  )

  if (!workspace) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent aria-describedby="delete-workspace-description">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10">
              <RiAlertLine className="h-4 w-4 text-destructive" />
            </div>
            <DialogTitle>Delete Hub</DialogTitle>
          </div>
          <DialogDescription id="delete-workspace-description">
            This action cannot be undone. All recordings will be removed from
            this hub (recordings themselves are not deleted from your organization).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning */}
          <div className="rounded-md bg-destructive/5 border border-destructive/20 p-3">
            <p className="text-sm text-foreground">
              Deleting <strong>{workspace.name}</strong> will:
            </p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground list-disc pl-4">
              <li>Remove all hub memberships ({workspace.member_count} members)</li>
              <li>Remove all hub entry assignments</li>
              <li>Delete all hub-specific notes, tags, and scores</li>
            </ul>
            {typeof recordingCount === 'number' && (
              <p className="mt-2 text-xs text-muted-foreground">
                {recordingCount === 0
                  ? 'This hub has no recordings.'
                  : `This hub has ${recordingCount} recording${recordingCount !== 1 ? 's' : ''}.`}
              </p>
            )}
          </div>

          {typeof recordingCount === 'number' && recordingCount > 0 && transferOptions.length > 0 && (
            <div className="space-y-3 rounded-md border border-border/60 p-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="transfer-recordings"
                  checked={transferEnabled}
                  onCheckedChange={(checked) => setTransferEnabled(Boolean(checked))}
                />
                <Label htmlFor="transfer-recordings">
                  Transfer recordings to another hub
                </Label>
              </div>
              {transferEnabled && (
                <div className="space-y-2">
                  <Label htmlFor="transfer-workspace">Transfer to</Label>
                  <Select value={transferWorkspaceId} onValueChange={setTransferWorkspaceId}>
                    <SelectTrigger id="transfer-workspace">
                      <SelectValue placeholder="Select a hub" />
                    </SelectTrigger>
                    <SelectContent>
                      {transferOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {/* Confirmation input */}
          <div className="space-y-2">
            <Label htmlFor="delete-confirm">
              Type <strong>{workspace.name}</strong> to confirm
            </Label>
            <Input
              id="delete-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={workspace.name}
              autoComplete="off"
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="hollow"
            onClick={() => handleOpenChange(false)}
            disabled={deleteWorkspace.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!canDelete || deleteWorkspace.isPending}
          >
            {deleteWorkspace.isPending ? 'Deleting...' : 'Delete Hub'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DeleteWorkspaceDialog
