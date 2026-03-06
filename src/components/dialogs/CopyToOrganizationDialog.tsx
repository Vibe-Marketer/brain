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
import { RiBuildingLine, RiErrorWarningLine } from '@remixicon/react'
import { toast } from 'sonner'
import { copyRecordingsToOrganization } from '@/services/data-movement.service'
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
  const { organizations, isLoading } = useOrganizations()
  const [targetOrgId, setTargetOrgId] = useState<string>('')
  const [removeSource, setRemoveSource] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleCopy = async () => {
    if (!targetOrgId) return

    setIsSubmitting(true)
    try {
      await copyRecordingsToOrganization(recordingIds, targetOrgId, {
        removeSource,
      })
      onSuccess?.()
      onOpenChange(false)
    } catch (error: any) {
      toast.error(error.message || 'Failed to copy calls')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-vibe-orange">
            <RiBuildingLine className="h-5 w-5" />
            Copy to Organization
          </DialogTitle>
          <DialogDescription>
            You are copying {recordingIds.length} call(s) to another organization. 
            This creates a completely new copy of the calls.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="org">Select Target Organization</Label>
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
              <p className="text-xs font-bold text-foreground">Hard Boundary Warning</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Organization boundaries are strictly enforced. Copying a call duplicates the transcript, 
                summary, and global tags. Personal folders and tags are NOT copied.
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
            disabled={!targetOrgId || isSubmitting}
            className="bg-vibe-orange hover:bg-vibe-orange/90"
          >
            {isSubmitting ? 'Copying...' : 'Confirm Copy'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
