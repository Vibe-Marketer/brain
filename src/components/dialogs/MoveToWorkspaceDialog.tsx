import { useState } from 'react'
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
import { toast } from 'sonner'
import { moveRecordingsToWorkspace } from '@/services/data-movement.service'
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
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleMove = async () => {
    if (!targetWorkspaceId) return

    setIsSubmitting(true)
    try {
      await moveRecordingsToWorkspace(recordingIds, targetWorkspaceId, {
        sourceWorkspaceId: currentWorkspaceId,
        keepInSource,
      })
      toast.success(`Successfully moved ${recordingIds.length} call(s)`)
      onSuccess?.()
      onOpenChange(false)
    } catch (error: any) {
      toast.error(error.message || 'Failed to move calls')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RiExpandLeftRightLine className="h-5 w-5 text-vibe-orange" />
            Move to Hub
          </DialogTitle>
          <DialogDescription>
            Move {recordingIds.length} call(s) to another hub within this organization.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="workspace">Select Target Hub</Label>
            <Select 
              value={targetWorkspaceId} 
              onValueChange={setTargetWorkspaceId}
              disabled={isLoading}
            >
              <SelectTrigger id="workspace">
                <SelectValue placeholder={isLoading ? "Loading hubs..." : "Select a hub"} />
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
              className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Also keep in current hub (creates a dual entry)
            </Label>
          </div>

          <div className="p-3 rounded-lg bg-info-bg/10 border border-info-border/20 flex gap-3">
            <RiInformationLine className="h-4 w-4 text-info-text mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-info-text leading-relaxed">
              Moving a call to another hub shares it with that hub's members. 
              The call will always remain visible in the HOME workspace.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleMove} 
            disabled={!targetWorkspaceId || isSubmitting}
          >
            {isSubmitting ? 'Moving...' : 'Move Calls'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
