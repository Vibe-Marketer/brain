/**
 * DeleteOrganizationDialog - Confirmation dialog for organization deletion
 *
 * When deleting an organization that has recordings:
 * - Option 1: Delete all recordings in the organization
 * - Option 2: Move recordings back to personal organization before deleting
 * Requires typing organization name to confirm.
 *
 * @pattern dialog-confirmation
 */

import { useState, useCallback } from 'react'
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
import { RiAlertLine } from '@remixicon/react'
import { useDeleteOrganization } from '@/hooks/useOrganizationMutations'
import type { OrganizationWithMembership } from '@/types/workspace'

export interface DeleteOrganizationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  organization: OrganizationWithMembership | null
}

export function DeleteOrganizationDialog({
  open,
  onOpenChange,
  organization,
}: DeleteOrganizationDialogProps) {
  const [confirmText, setConfirmText] = useState('')
  const [dataHandling, setDataHandling] = useState<'delete' | 'move'>('move')
  const deleteOrg = useDeleteOrganization()

  const isConfirmed = organization ? confirmText === organization.name : false
  const canDelete = isConfirmed

  const handleDelete = useCallback(() => {
    if (!organization || !isConfirmed) return

    deleteOrg.mutate(
      {
        organizationId: organization.id,
        moveCallsToPersonal: dataHandling === 'move',
      },
      {
        onSuccess: () => {
          setConfirmText('')
          setDataHandling('move')
          onOpenChange(false)
        },
      }
    )
  }, [organization, isConfirmed, deleteOrg, dataHandling, onOpenChange])

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        setConfirmText('')
        setDataHandling('move')
      }
      onOpenChange(newOpen)
    },
    [onOpenChange]
  )

  if (!organization) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent aria-describedby="delete-organization-description">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10">
              <RiAlertLine className="h-4 w-4 text-destructive" />
            </div>
            <DialogTitle>Delete Organization</DialogTitle>
          </div>
          <DialogDescription id="delete-organization-description">
            This action cannot be undone. The organization and all its workspaces will be permanently deleted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning */}
          <div className="rounded-md bg-destructive/5 border border-destructive/20 p-3">
            <p className="text-sm text-foreground">
              Deleting <strong>{organization.name}</strong> will:
            </p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground list-disc pl-4">
              <li>Remove all workspaces within this organization</li>
              <li>Remove all team memberships</li>
              <li>Remove all workspace-specific notes, tags, and scores</li>
            </ul>
          </div>

          {/* Data handling options */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">What should happen to recordings in this organization?</Label>
            <div className="space-y-2">
              <label className="flex items-start gap-3 rounded-md border border-border p-3 cursor-pointer hover:bg-hover transition-colors">
                <input
                  type="radio"
                  name="data-handling"
                  value="move"
                  checked={dataHandling === 'move'}
                  onChange={() => setDataHandling('move')}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium">Move recordings to Personal organization</p>
                  <p className="text-xs text-muted-foreground">
                    Recordings will be moved back to your personal organization before deletion.
                  </p>
                </div>
              </label>
              <label className="flex items-start gap-3 rounded-md border border-border p-3 cursor-pointer hover:bg-hover transition-colors">
                <input
                  type="radio"
                  name="data-handling"
                  value="delete"
                  checked={dataHandling === 'delete'}
                  onChange={() => setDataHandling('delete')}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium">Delete all recordings</p>
                  <p className="text-xs text-muted-foreground">
                    All recordings in this organization will be permanently deleted.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Confirmation input */}
          <div className="space-y-2">
            <Label htmlFor="delete-org-confirm">
              Type <strong>{organization.name}</strong> to confirm
            </Label>
            <Input
              id="delete-org-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={organization.name}
              autoComplete="off"
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="hollow"
            onClick={() => handleOpenChange(false)}
            disabled={deleteOrg.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!canDelete || deleteOrg.isPending}
          >
            {deleteOrg.isPending ? 'Deleting...' : 'Delete Organization'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DeleteOrganizationDialog
