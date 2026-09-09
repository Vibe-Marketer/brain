/**
 * MergeOrganizationsDialog — admin-only, type-to-confirm dialog for merging
 * a duplicate organization (36-05, ORG-03).
 *
 * Structurally borrows DeleteOrganizationDialog's shell (header icon
 * circle, confirm Input, footer two-button layout) but NOT its irreversible
 * wording: a merge is a canonical_organization_id pointer only — no
 * recordings or memberships move, and it's reversible by clearing the
 * pointer (T-36-19). The type-to-confirm gate targets the LOSING
 * organization's name to reduce the risk of merging the wrong direction
 * (T-36-17).
 *
 * @pattern dialog-confirmation
 */
import { useCallback, useMemo, useState } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RiAlertLine } from '@remixicon/react'
import { useMergeOrganizations } from '@/hooks/useAdminOrganizations'
import type { AdminOrganization } from '@/services/admin-organizations.service'

export interface MergeOrganizationsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pre-selected losing organization — the row the admin clicked "Merge
   * into…" from. */
  losingOrg: AdminOrganization | null
  /** Full org list, used to populate the winning-org selector (excludes
   * losingOrg itself). */
  organizations: AdminOrganization[]
}

export function MergeOrganizationsDialog({
  open,
  onOpenChange,
  losingOrg,
  organizations,
}: MergeOrganizationsDialogProps) {
  const [winningOrgId, setWinningOrgId] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const mergeOrganizations = useMergeOrganizations()

  const winningCandidates = useMemo(
    () => organizations.filter((org) => org.id !== losingOrg?.id),
    [organizations, losingOrg],
  )

  const isConfirmed = losingOrg ? confirmText === losingOrg.name : false
  const canMerge = isConfirmed && !!winningOrgId

  const resetState = useCallback(() => {
    setWinningOrgId('')
    setConfirmText('')
  }, [])

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) resetState()
      onOpenChange(newOpen)
    },
    [onOpenChange, resetState],
  )

  const handleMerge = useCallback(() => {
    if (!losingOrg || !canMerge) return

    mergeOrganizations.mutate(
      {
        losingOrganizationId: losingOrg.id,
        winningOrganizationId: winningOrgId,
        losingOrganizationName: losingOrg.name,
      },
      {
        onSuccess: () => {
          resetState()
          onOpenChange(false)
        },
      },
    )
  }, [losingOrg, canMerge, winningOrgId, mergeOrganizations, onOpenChange, resetState])

  if (!losingOrg) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10">
              <RiAlertLine className="h-4 w-4 text-destructive" />
            </div>
            <DialogTitle>Merge Organizations</DialogTitle>
          </div>
          <DialogDescription>
            Recordings and memberships are not moved — <strong>{losingOrg.name}</strong> gets a
            canonical_organization_id pointer to the organization you choose below, and nothing is
            deleted. This is fully reversible by clearing the pointer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="merge-winning-org">Merge into</Label>
            <Select value={winningOrgId} onValueChange={setWinningOrgId}>
              <SelectTrigger id="merge-winning-org">
                <SelectValue placeholder="Select the surviving organization" />
              </SelectTrigger>
              <SelectContent>
                {winningCandidates.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="merge-org-confirm">
              Type <strong>{losingOrg.name}</strong> to confirm
            </Label>
            <Input
              id="merge-org-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={losingOrg.name}
              autoComplete="off"
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="hollow"
            onClick={() => handleOpenChange(false)}
            disabled={mergeOrganizations.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleMerge}
            disabled={!canMerge || mergeOrganizations.isPending}
          >
            {mergeOrganizations.isPending ? 'Merging…' : 'Merge organizations'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default MergeOrganizationsDialog
