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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RiAddLine, RiExpandLeftRightLine, RiInformationLine } from '@remixicon/react'
import { useMoveRecordings } from '@/hooks/useDataMovement'
import { useAllUserWorkspaces } from '@/hooks/useWorkspaces'
import { useOrganizationContext } from '@/hooks/useOrganizationContext'
import { useOrganizations } from '@/hooks/useOrganizations'
import { Checkbox } from '@/components/ui/checkbox'
import { CreateWorkspaceDialog } from '@/components/dialogs/CreateWorkspaceDialog'
import type { WorkspaceWithMeta } from '@/types/workspace'

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
  const { activeOrgId } = useOrganizationContext()
  const { workspaces, isLoading } = useAllUserWorkspaces()
  const { data: organizations } = useOrganizations()
  const [selectedWorkspace, setSelectedWorkspace] = useState<WorkspaceWithMeta | null>(null)
  const [keepInSource, setKeepInSource] = useState(false)
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false)

  const moveRecordings = useMoveRecordings()

  // Reset form state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setSelectedWorkspace(null)
      setKeepInSource(false)
      setShowCreateWorkspace(false)
    }
  }, [open])

  const targetWorkspaces = useMemo(
    () => (workspaces || []).filter(ws => ws.id !== currentWorkspaceId),
    [workspaces, currentWorkspaceId]
  )

  const orgNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const org of organizations || []) map.set(org.id, org.name)
    return map
  }, [organizations])

  const groupedByOrg = useMemo(() => {
    const groups = new Map<string, WorkspaceWithMeta[]>()
    for (const ws of targetWorkspaces) {
      const orgId = ws.organization_id
      if (!groups.has(orgId)) groups.set(orgId, [])
      groups.get(orgId)!.push(ws)
    }
    return groups
  }, [targetWorkspaces])

  const isCrossOrg = !!selectedWorkspace && selectedWorkspace.organization_id !== activeOrgId

  const handleWorkspaceValueChange = (value: string) => {
    if (value === '__create_new__') {
      setShowCreateWorkspace(true)
      return
    }

    const ws = targetWorkspaces.find(w => w.id === value) || null
    setSelectedWorkspace(ws)
  }

  const handleMove = () => {
    if (!selectedWorkspace || !activeOrgId) return

    moveRecordings.mutate(
      {
        recordingIds,
        target: {
          workspaceId: selectedWorkspace.id,
          organizationId: selectedWorkspace.organization_id,
        },
        options: {
          sourceOrgId: activeOrgId,
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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RiExpandLeftRightLine className="h-5 w-5 text-vibe-orange" />
              {keepInSource ? 'Copy to Workspace' : 'Move to Workspace'}
            </DialogTitle>
            <DialogDescription>
              Move {count} {label} to another workspace.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="workspace">Target Workspace</Label>
              <Select
                value={selectedWorkspace?.id ?? ''}
                onValueChange={handleWorkspaceValueChange}
                disabled={isLoading}
              >
                <SelectTrigger id="workspace">
                  <SelectValue placeholder={isLoading ? "Loading workspaces..." : "Select a workspace"} />
                </SelectTrigger>
                <SelectContent>
                  {Array.from(groupedByOrg.entries()).map(([orgId, orgWorkspaces]) => (
                    <SelectGroup key={orgId}>
                      <SelectLabel>
                        {orgNameById.get(orgId) || 'Organization'}
                        {orgId === activeOrgId ? ' (current)' : ''}
                      </SelectLabel>
                      {orgWorkspaces.map(ws => (
                        <SelectItem key={ws.id} value={ws.id}>
                          {ws.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                  <SelectItem value="__create_new__">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <RiAddLine className="h-3.5 w-3.5" />
                      Create new workspace…
                    </span>
                  </SelectItem>
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
                {isCrossOrg
                  ? "Moving a call to a workspace in another organization copies the call into that org. Workspace-specific metadata (folders, local tags, scores) does not travel with it."
                  : "Moving a call to another workspace shares it with that workspace's members. The call stays in the same organization."}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="hollow" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleMove}
              disabled={!selectedWorkspace || moveRecordings.isPending || showCreateWorkspace}
            >
              {moveRecordings.isPending
                ? (keepInSource ? 'Copying...' : 'Moving...')
                : (keepInSource ? `Copy ${label}` : `Move ${label}`)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateWorkspaceDialog
        open={showCreateWorkspace}
        onOpenChange={setShowCreateWorkspace}
        orgId={activeOrgId || undefined}
        onWorkspaceCreated={(workspaceId) => {
          // Freshly created workspace always belongs to the active org (CreateWorkspaceDialog
          // is scoped to activeOrgId). The workspace list refetch will backfill the rest of
          // the metadata; the mutation only needs id + organizationId.
          if (activeOrgId) {
            setSelectedWorkspace({
              id: workspaceId,
              organization_id: activeOrgId,
              name: '',
              slug: null,
              workspace_type: 'team',
              default_sharelink_ttl_days: 0,
              is_default: false,
              created_at: '',
              updated_at: '',
              member_count: 0,
              user_role: null,
            })
          }
          setShowCreateWorkspace(false)
        }}
      />
    </>
  )
}
