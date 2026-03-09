/**
 * CopyToOrganizationDialog — Copy recordings to a different organization (cross-org).
 *
 * Uses the copy_recordings_to_organization RPC which creates new recording rows
 * in the target org's HOME workspace. Optionally removes from source org (handoff).
 *
 * Uses useCopyToOrganization mutation hook for cache invalidation and toast feedback.
 *
 * @pattern copy-to-organization-dialog
 */

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RiBuildingLine, RiErrorWarningLine } from '@remixicon/react'
import { useCopyToOrganization } from '@/hooks/useDataMovement'
import { useOrganizations } from '@/hooks/useOrganizations'
import { useOrgContext } from '@/hooks/useOrgContext'
import { Checkbox } from '@/components/ui/checkbox'

interface CopyToOrganizationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  recordingIds: string[]
  onSuccess?: () => void
}

export function CopyToOrganizationDialog({
  open,
  onOpenChange,
  recordingIds,
  onSuccess,
}: CopyToOrganizationDialogProps) {
  const { activeOrgId } = useOrgContext()
  const { data: organizations, isLoading } = useOrganizations()
  const [targetOrgId, setTargetOrgId] = useState<string>('')
  const [removeSource, setRemoveSource] = useState(false)

  const copyToOrg = useCopyToOrganization()

  // Reset form state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setTargetOrgId('')
      setRemoveSource(false)
    }
  }, [open])

  const handleCopy = () => {
    if (!targetOrgId) return

    copyToOrg.mutate(
      {
        recordingIds,
        targetOrgId,
        options: { removeSource },
      },
      {
        onSuccess: () => {
          onSuccess?.()
          onOpenChange(false)
        },
      }
    )
  }

  const count = recordingIds.length
  const label = count === 1 ? 'call' : 'calls'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-vibe-orange">
            <RiBuildingLine className="h-5 w-5" />
            Copy to Organization
          </DialogTitle>
          <DialogDescription>
            Copy {count} {label} to another organization.
            This creates new copies with new IDs in the target org.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="org">Target Organization</Label>
            <Select
              value={targetOrgId}
              onValueChange={setTargetOrgId}
              disabled={isLoading}
            >
              <SelectTrigger id="org">
                <SelectValue placeholder={isLoading ? "Loading organizations..." : "Select an organization"} />
              </SelectTrigger>
              <SelectContent>
                {organizations
                  ?.filter(org => org.id !== activeOrgId)
                  .map(org => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="removeSource"
              checked={removeSource}
              onCheckedChange={(checked) => setRemoveSource(!!checked)}
            />
            <Label
              htmlFor="removeSource"
              className="text-xs font-medium leading-none text-muted-foreground/80 cursor-pointer"
            >
              Handoff: Remove from current organization after copy
            </Label>
          </div>

          <div className="p-4 rounded-xl bg-orange-500/5 border border-vibe-orange/20 flex gap-3">
            <RiErrorWarningLine className="h-5 w-5 text-vibe-orange mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-foreground">Cross-Organization Copy</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                This duplicates the transcript, summary, and global tags into the target organization.
                Workspace-specific metadata (folders, local tags, scores) is NOT copied.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="hollow" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCopy}
            disabled={!targetOrgId || copyToOrg.isPending}
            className="bg-vibe-orange hover:bg-vibe-orange/90"
          >
            {copyToOrg.isPending ? 'Copying...' : `Copy ${label}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
