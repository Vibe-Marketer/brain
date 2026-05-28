/**
 * CopyToOrganizationDialog — Copy recordings to a different organization (cross-org).
 *
 * Uses the copy_recordings_to_organization RPC which creates new recording rows
 * in the target org's HOME workspace. Optionally removes from source org (handoff).
 *
 * The "Handoff" checkbox auto-syncs with the target org's `cross_org_default` whenever
 * the target selection changes — making the per-transaction default reflect the org
 * default, with the option for a one-off override.
 *
 * Uses useCopyToOrganization mutation hook for cache invalidation and toast feedback.
 *
 * @pattern copy-to-organization-dialog
 */

import { useState, useEffect, useMemo } from 'react'
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
import { RiBuildingLine, RiErrorWarningLine, RiAddLine, RiSettings3Line } from '@remixicon/react'
import { useCopyToOrganization } from '@/hooks/useDataMovement'
import { useOrganizations, useCreateOrganization } from '@/hooks/useOrganizations'
import { useOrganizationContext } from '@/hooks/useOrganizationContext'
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
  const { activeOrgId } = useOrganizationContext()
  const { data: organizations, isLoading } = useOrganizations()
  const [targetOrgId, setTargetOrgId] = useState<string>('')
  const [removeSource, setRemoveSource] = useState(false)
  // Tracks whether the user has manually toggled the handoff state. Once they have,
  // we stop auto-syncing with the target org's default so we don't clobber their choice.
  const [userOverrodeHandoff, setUserOverrodeHandoff] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)

  const copyToOrg = useCopyToOrganization()
  const createOrg = useCreateOrganization()

  const otherOrgs = useMemo(
    () => organizations?.filter(org => org.id !== activeOrgId) ?? [],
    [organizations, activeOrgId]
  )

  const targetOrg = useMemo(
    () => otherOrgs.find(org => org.id === targetOrgId) ?? null,
    [otherOrgs, targetOrgId]
  )

  // Auto-sync the handoff checkbox with the target org's cross_org_default. Only
  // fires until the user manually overrides. Reset on dialog close so the next open
  // starts fresh.
  useEffect(() => {
    if (userOverrodeHandoff) return
    if (!targetOrg) return
    setRemoveSource(targetOrg.cross_org_default === 'copy_and_remove')
  }, [targetOrg, userOverrodeHandoff])

  // Reset form state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setTargetOrgId('')
      setRemoveSource(false)
      setUserOverrodeHandoff(false)
      setShowCreateForm(false)
      setNewOrgName('')
      setProgress(null)
    }
  }, [open])

  const handleOrgValueChange = (value: string) => {
    if (value === '__create_new__') {
      setShowCreateForm(true)
      setTargetOrgId('')
    } else {
      setShowCreateForm(false)
      setTargetOrgId(value)
      // New target — reset the manual override flag so the new org's default applies
      setUserOverrodeHandoff(false)
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
          // Fresh org will start with its default; let the effect above sync.
          setUserOverrodeHandoff(false)
        },
      }
    )
  }

  const handleHandoffToggle = (checked: boolean) => {
    setRemoveSource(checked)
    setUserOverrodeHandoff(true)
  }

  const handleCopy = () => {
    if (!targetOrgId) return

    setProgress({ current: 0, total: recordingIds.length })

    copyToOrg.mutate(
      {
        recordingIds,
        targetOrgId,
        options: {
          removeSource,
          onProgress: (current, total) => setProgress({ current, total }),
        },
      },
      {
        onSuccess: () => {
          onSuccess?.()
          onOpenChange(false)
        },
        onError: () => {
          setProgress(null)
        },
      }
    )
  }

  const count = recordingIds.length
  const label = count === 1 ? 'call' : 'calls'

  // Helper text below the modal updates based on removeSource (move vs copy semantics).
  const helperHeading = removeSource ? 'Cross-Organization Move' : 'Cross-Organization Copy'
  const helperBody = removeSource
    ? 'The recordings will be removed from this organization after being transferred. Workspace-specific metadata (folders, local tags, scores) does NOT travel with them.'
    : 'This duplicates the transcript, summary, and global tags into the target organization. Workspace-specific metadata (folders, local tags, scores) is NOT copied. Originals stay here.'

  // Reflect whether the per-transaction selection matches the org default
  const matchesOrgDefault =
    targetOrg &&
    ((removeSource && targetOrg.cross_org_default === 'copy_and_remove') ||
      (!removeSource && targetOrg.cross_org_default === 'copy_only'))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-vibe-orange">
            <RiBuildingLine className="h-5 w-5" />
            {removeSource ? 'Move to Organization' : 'Copy to Organization'}
          </DialogTitle>
          <DialogDescription>
            {removeSource
              ? `Transfer ${count} ${label} into another organization. Originals will be removed from this one.`
              : `Copy ${count} ${label} into another organization. Originals stay here.`}
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

          {/* Handoff control — auto-synced with target org's cross_org_default until user overrides */}
          <div className="space-y-2 pt-1">
            <div className="flex items-start gap-2">
              <Checkbox
                id="removeSource"
                checked={removeSource}
                onCheckedChange={(checked) => handleHandoffToggle(!!checked)}
                className="mt-0.5"
                disabled={!targetOrgId}
              />
              <div className="space-y-0.5">
                <Label
                  htmlFor="removeSource"
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                  Handoff: remove from this organization after transfer
                </Label>
                {targetOrg && (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <RiSettings3Line className="h-3 w-3 flex-shrink-0" />
                    {matchesOrgDefault
                      ? <>Matches <strong className="font-medium">{targetOrg.name}</strong>'s default ({targetOrg.cross_org_default === 'copy_and_remove' ? 'MOVE' : 'COPY'}). Change in Settings → Organizations.</>
                      : <>One-off override of <strong className="font-medium">{targetOrg.name}</strong>'s default ({targetOrg.cross_org_default === 'copy_and_remove' ? 'MOVE' : 'COPY'}).</>}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Helper text updates with removeSource state */}
          <div className="p-4 rounded-xl bg-orange-500/5 border border-vibe-orange/20 flex gap-3">
            <RiErrorWarningLine className="h-5 w-5 text-vibe-orange mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-foreground">{helperHeading}</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {helperBody}
              </p>
            </div>
          </div>
        </div>

        {progress && copyToOrg.isPending && (
          <div className="px-0 pb-2 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{removeSource ? 'Moving' : 'Copying'} calls…</span>
              <span className="tabular-nums">{progress.current} / {progress.total}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-vibe-orange transition-all duration-300"
                style={{ width: progress.total > 0 ? `${Math.round((progress.current / progress.total) * 100)}%` : '0%' }}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="hollow" onClick={() => onOpenChange(false)} disabled={copyToOrg.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleCopy}
            disabled={!targetOrgId || copyToOrg.isPending || showCreateForm}
            className="bg-vibe-orange hover:bg-vibe-orange/90"
          >
            {copyToOrg.isPending
              ? `${removeSource ? 'Moving' : 'Copying'}…`
              : `${removeSource ? 'Move' : 'Copy'} ${count} ${label}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
