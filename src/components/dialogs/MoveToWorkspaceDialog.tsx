/**
 * MoveToWorkspaceDialog — Move or copy recordings between workspaces (same org).
 *
 * Shows a workspace picker (filtered to available targets) with an option to
 * keep the recording in the source workspace (copy mode).
 *
 * Uses useMoveToWorkspace mutation hook for cache invalidation and toast feedback.
 *
 * @pattern move-to-workspace-dialog
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
import { RiExpandLeftRightLine, RiInformationLine } from '@remixicon/react'
import { useMoveToWorkspace } from '@/hooks/useDataMovement'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import { useOrgContext } from '@/hooks/useOrgContext'
import { Checkbox } from '@/components/ui/checkbox'

interface MoveToWorkspaceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  recordingIds: string[]
  currentWorkspaceId?: string | null
  onSuccess?: () => void
}

export function MoveToWorkspaceDialog({
  open,
  onOpenChange,
  recordingIds,
  currentWorkspaceId,
  onSuccess,
}: MoveToWorkspaceDialogProps) {
  const { activeOrgId } = useOrgContext()
  const { workspaces, isLoading } = useWorkspaces(activeOrgId)
  const [targetWorkspaceId, setTargetWorkspaceId] = useState<string>('')
  const [keepInSource, setKeepInSource] = useState(false)

  const moveToWorkspace = useMoveToWorkspace()

  // Reset form state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setTargetWorkspaceId('')
      setKeepInSource(false)
    }
  }, [open])

  const handleMove = () => {
    if (!targetWorkspaceId) return

    moveToWorkspace.mutate(
      {
        recordingIds,
        targetWorkspaceId,
        options: {
          sourceWorkspaceId: currentWorkspaceId,
          keepInSource,
        },
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
          <DialogTitle className="flex items-center gap-2">
            <RiExpandLeftRightLine className="h-5 w-5 text-vibe-orange" />
            {keepInSource ? 'Copy to Workspace' : 'Move to Workspace'}
          </DialogTitle>
          <DialogDescription>
            Move {count} {label} to another workspace within this organization.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="workspace">Target Workspace</Label>
            <Select
              value={targetWorkspaceId}
              onValueChange={setTargetWorkspaceId}
              disabled={isLoading}
            >
              <SelectTrigger id="workspace">
                <SelectValue placeholder={isLoading ? "Loading workspaces..." : "Select a workspace"} />
              </SelectTrigger>
              <SelectContent>
                {workspaces
                  ?.filter(ws => ws.id !== currentWorkspaceId)
                  .map(ws => (
                    <SelectItem key={ws.id} value={ws.id}>
                      {ws.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="keepInSource"
              checked={keepInSource}
              onCheckedChange={(checked) => setKeepInSource(!!checked)}
            />
            <Label
              htmlFor="keepInSource"
              className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              Also keep in current workspace (copy instead of move)
            </Label>
          </div>

          <div className="p-3 rounded-lg bg-info-bg/10 border border-info-border/20 flex gap-3">
            <RiInformationLine className="h-4 w-4 text-info-text mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-info-text leading-relaxed">
              Moving a call to another workspace shares it with that workspace's members.
              The call stays in the same organization.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="hollow" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleMove}
            disabled={!targetWorkspaceId || moveToWorkspace.isPending}
          >
            {moveToWorkspace.isPending
              ? (keepInSource ? 'Copying...' : 'Moving...')
              : (keepInSource ? `Copy ${label}` : `Move ${label}`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
