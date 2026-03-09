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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RiBuildingLine, RiErrorWarningLine, RiAddLine } from '@remixicon/react'
import { useCopyToOrganization } from '@/hooks/useDataMovement'
import { useOrganizations, useCreateOrganization } from '@/hooks/useOrganizations'
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
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')

  const copyToOrg = useCopyToOrganization()
  const createOrg = useCreateOrganization()

  const otherOrgs = organizations?.filter(org => org.id !== activeOrgId) ?? []

  // Reset form state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setTargetOrgId('')
      setRemoveSource(false)
      setShowCreateForm(false)
      setNewOrgName('')
    }
  }, [open])

  const handleOrgValueChange = (value: string) => {
    if (value === '__create_new__') {
      setShowCreateForm(true)
      setTargetOrgId('')
    } else {
      setShowCreateForm(false)
      setTargetOrgId(value)
    }
  }

  const handleCreateOrg = () => {
    if (!newOrgName.trim() || newOrgName.trim().length < 3) return
    createOrg.mutate(
      { name: newOrgName.trim() },
      {
        onSuccess: (org) => {
          setTargetOrgId(org.id)
          setShowCreateForm(false)
          setNewOrgName('')
        },
      }
    )
  }

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
            {showCreateForm ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    autoFocus
                    placeholder="Organization name (min 3 chars)"
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateOrg()
                      if (e.key === 'Escape') {
                        setShowCreateForm(false)
                        setNewOrgName('')
                      }
                    }}
                    disabled={createOrg.isPending}
                  />
                  <Button
                    size="sm"
                    onClick={handleCreateOrg}
                    disabled={newOrgName.trim().length < 3 || createOrg.isPending}
                    className="shrink-0"
                  >
                    {createOrg.isPending ? 'Creating...' : 'Create'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setShowCreateForm(false); setNewOrgName('') }}
                    disabled={createOrg.isPending}
                    className="shrink-0"
                  >
                    Cancel
                  </Button>
                </div>
                {newOrgName.trim().length > 0 && newOrgName.trim().length < 3 && (
                  <p className="text-xs text-destructive">Name must be at least 3 characters</p>
                )}
              </div>
            ) : (
              <Select
                value={targetOrgId}
                onValueChange={handleOrgValueChange}
                disabled={isLoading}
              >
                <SelectTrigger id="org">
                  <SelectValue placeholder={isLoading ? "Loading organizations..." : "Select an organization"} />
                </SelectTrigger>
                <SelectContent>
                  {otherOrgs.map(org => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="__create_new__">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <RiAddLine className="h-3.5 w-3.5" />
                      Create new organization…
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
            {!isLoading && !showCreateForm && otherOrgs.length === 0 && (
              <p className="text-xs text-muted-foreground">
                You only have one organization. Select "Create new organization…" above to add another.
              </p>
            )}
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
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCopy}
            disabled={!targetOrgId || copyToOrg.isPending || showCreateForm}
            className="bg-vibe-orange hover:bg-vibe-orange/90"
          >
            {copyToOrg.isPending ? 'Copying...' : `Copy ${label}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
