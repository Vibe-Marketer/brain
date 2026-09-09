/**
 * UnclaimDomainDialog — admin-only, lighter-weight confirm dialog for
 * releasing a claimed domain (36-05, ORG-03).
 *
 * Unlike MergeOrganizationsDialog, this is metadata-only and reversible (the
 * domain can simply be re-claimed later), so there is no type-to-confirm
 * Input — the confirm button is enabled immediately on open, mirroring
 * DeleteOrganizationDialog's shell without its confirm-text gate.
 *
 * @pattern dialog-confirmation
 */
import { useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RiAlertLine } from '@remixicon/react'
import { useUnclaimOrganizationDomain } from '@/hooks/useAdminOrganizations'
import type { AdminOrganization, AdminOrganizationDomain } from '@/services/admin-organizations.service'

export interface UnclaimDomainDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  domain: AdminOrganizationDomain | null
  /** The organization that currently owns the claim — only .name is used
   * for the confirmation copy. */
  org: AdminOrganization | null
}

export function UnclaimDomainDialog({ open, onOpenChange, domain, org }: UnclaimDomainDialogProps) {
  const unclaimDomain = useUnclaimOrganizationDomain()

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      onOpenChange(newOpen)
    },
    [onOpenChange],
  )

  const handleUnclaim = useCallback(() => {
    if (!domain) return

    unclaimDomain.mutate(domain.id, {
      onSuccess: () => {
        onOpenChange(false)
      },
    })
  }, [domain, unclaimDomain, onOpenChange])

  if (!domain || !org) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10">
              <RiAlertLine className="h-4 w-4 text-destructive" />
            </div>
            <DialogTitle>Unclaim Domain</DialogTitle>
          </div>
          <DialogDescription>
            Unclaim {domain.domain}? {org.name} will lose its verified badge. Any organization with
            a verified email on this domain can claim it again later.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            variant="hollow"
            onClick={() => handleOpenChange(false)}
            disabled={unclaimDomain.isPending}
          >
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleUnclaim} disabled={unclaimDomain.isPending}>
            {unclaimDomain.isPending ? 'Unclaiming…' : 'Unclaim domain'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default UnclaimDomainDialog
