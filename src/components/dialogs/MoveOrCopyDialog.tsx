/**
 * MoveOrCopyDialog — Unified move/copy dialog: pick an organization (defaults to
 * current), pick a workspace scoped to that org, toggle Move vs Copy.
 *
 * Replaces the previously separate same-org workspace-picker dialog and the
 * cross-org organization-picker dialog. The dispatch logic already
 * lives in useMoveRecordings / moveRecordingsToTargetWorkspace, which routes
 * same-org moves through workspace_entries and cross-org moves/copies through the
 * copy_recording_to_org RPC based on target.organizationId vs the source org and
 * options.keepInSource. This component only needs to collect org + workspace +
 * keepInSource and call that single mutation.
 *
 * @pattern move-or-copy-dialog
 */

import { useEffect, useMemo, useState } from 'react'
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
import {
  RiAddLine,
  RiExpandLeftRightLine,
  RiInformationLine,
} from '@remixicon/react'
import { useMoveRecordings } from '@/hooks/useDataMovement'
import { useAllUserWorkspaces } from '@/hooks/useWorkspaces'
import { useOrganizationContext } from '@/hooks/useOrganizationContext'
import { useOrganizations, useCreateOrganization } from '@/hooks/useOrganizations'
import { CreateWorkspaceDialog } from '@/components/dialogs/CreateWorkspaceDialog'
import type { WorkspaceWithMeta } from '@/types/workspace'

interface MoveOrCopyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  recordingIds: string[]
  currentWorkspaceId?: string | null
  onSuccess?: () => void
}

const CREATE_ORG_VALUE = '__create_new_org__'
const CREATE_WORKSPACE_VALUE = '__create_new_ws__'

export function MoveOrCopyDialog({
  open,
  onOpenChange,
  recordingIds,
  currentWorkspaceId,
  onSuccess,
}: MoveOrCopyDialogProps) {
  const { activeOrgId } = useOrganizationContext()
  const { workspaces, isLoading: workspacesLoading } = useAllUserWorkspaces()
  const { data: organizations, isLoading: orgsLoading } = useOrganizations()
  const createOrg = useCreateOrganization()

  const [selectedOrgId, setSelectedOrgId] = useState<string>('')
  const [selectedWorkspace, setSelectedWorkspace] = useState<WorkspaceWithMeta | null>(null)
  const [keepInSource, setKeepInSource] = useState(false)
  const [showCreateOrgForm, setShowCreateOrgForm] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)

  const moveRecordings = useMoveRecordings()

  // Default the org selection to the current active org whenever the dialog opens,
  // and reset all other local state.
  useEffect(() => {
    if (open) {
      setSelectedOrgId(activeOrgId || '')
    } else {
      setSelectedOrgId('')
      setSelectedWorkspace(null)
      setKeepInSource(false)
      setShowCreateOrgForm(false)
      setNewOrgName('')
      setShowCreateWorkspace(false)
      setProgress(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Re-scope the workspace select whenever the selected org changes; reset the
  // selected workspace so a stale cross-org workspace can't be submitted.
  useEffect(() => {
    setSelectedWorkspace(null)
  }, [selectedOrgId])

  const workspacesInSelectedOrg = useMemo(
    () =>
      (workspaces || []).filter(
        ws => ws.organization_id === selectedOrgId && ws.id !== currentWorkspaceId
      ),
    [workspaces, selectedOrgId, currentWorkspaceId]
  )

  const isCrossOrg = !!selectedOrgId && selectedOrgId !== activeOrgId

  const handleOrgValueChange = (value: string) => {
    if (value === CREATE_ORG_VALUE) {
      setShowCreateOrgForm(true)
      return
    }
    setShowCreateOrgForm(false)
    setSelectedOrgId(value)
  }

  const handleCreateOrg = () => {
    const trimmed = newOrgName.trim()
    if (trimmed.length < 3) return
    createOrg.mutate(
      { name: trimmed },
      {
        onSuccess: (org) => {
          setSelectedOrgId(org.id)
          setShowCreateOrgForm(false)
          setNewOrgName('')
        },
      }
    )
  }

  const handleWorkspaceValueChange = (value: string) => {
    if (value === CREATE_WORKSPACE_VALUE) {
      setShowCreateWorkspace(true)
      return
    }
    const ws = workspacesInSelectedOrg.find(w => w.id === value) || null
    setSelectedWorkspace(ws)
  }

  const handleSubmit = () => {
    if (!selectedWorkspace || !activeOrgId) return

    setProgress({ current: 0, total: recordingIds.length })

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
  const verb = keepInSource ? 'Copy' : 'Move'

  const helperText = isCrossOrg
    ? `${keepInSource ? 'Copying' : 'Moving'} a call to a workspace in another organization ${keepInSource ? 'duplicates' : 'transfers'} it into that org. Workspace-specific metadata (folders, local tags, scores) does not travel with it.${keepInSource ? '' : ' The original is removed.'}`
    : keepInSource
      ? `Copying a call adds it to the selected workspace while keeping it in this workspace too. The call stays in the same organization.`
      : `Moving a call removes it from this workspace and adds it to the selected workspace. The call stays in the same organization.`

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RiExpandLeftRightLine className="h-5 w-5 text-vibe-orange" />
              {verb} {count} {label}
            </DialogTitle>
            <DialogDescription>
              Choose a destination organization and workspace, then {verb.toLowerCase()}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center gap-1 rounded-lg border border-border p-1 w-fit">
              <Button
                type="button"
                size="sm"
                variant={!keepInSource ? 'default' : 'ghost'}
                onClick={() => setKeepInSource(false)}
                className="h-7"
              >
                Move
              </Button>
              <Button
                type="button"
                size="sm"
                variant={keepInSource ? 'default' : 'ghost'}
                onClick={() => setKeepInSource(true)}
                className="h-7"
              >
                Copy
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="org">Organization</Label>
              {showCreateOrgForm ? (
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
                          setShowCreateOrgForm(false)
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
                      onClick={() => { setShowCreateOrgForm(false); setNewOrgName('') }}
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
                  value={selectedOrgId}
                  onValueChange={handleOrgValueChange}
                  disabled={orgsLoading}
                >
                  <SelectTrigger id="org">
                    <SelectValue placeholder={orgsLoading ? 'Loading organizations...' : 'Select an organization'} />
                  </SelectTrigger>
                  <SelectContent>
                    {(organizations || []).map(org => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                        {org.id === activeOrgId ? ' (current)' : ''}
                      </SelectItem>
                    ))}
                    <SelectItem value={CREATE_ORG_VALUE}>
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <RiAddLine className="h-3.5 w-3.5" />
                        + New Organization
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="workspace">Workspace</Label>
              <Select
                value={selectedWorkspace?.id ?? ''}
                onValueChange={handleWorkspaceValueChange}
                disabled={workspacesLoading || !selectedOrgId || showCreateOrgForm}
              >
                <SelectTrigger id="workspace">
                  <SelectValue placeholder={workspacesLoading ? 'Loading workspaces...' : 'Select a workspace'} />
                </SelectTrigger>
                <SelectContent>
                  {workspacesInSelectedOrg.map(ws => (
                    <SelectItem key={ws.id} value={ws.id}>
                      {ws.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={CREATE_WORKSPACE_VALUE}>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <RiAddLine className="h-3.5 w-3.5" />
                      + New Workspace
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-3 rounded-lg bg-info-bg/10 border border-info-border/20 flex gap-3">
              <RiInformationLine className="h-4 w-4 text-info-text mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-info-text leading-relaxed">{helperText}</p>
            </div>
          </div>

          {progress && moveRecordings.isPending && (
            <div className="px-0 pb-2 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{verb === 'Copy' ? 'Copying' : 'Moving'} calls…</span>
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
            <Button variant="hollow" onClick={() => onOpenChange(false)} disabled={moveRecordings.isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!selectedWorkspace || moveRecordings.isPending || showCreateOrgForm || showCreateWorkspace}
            >
              {moveRecordings.isPending
                ? `${verb === 'Copy' ? 'Copying' : 'Moving'}...`
                : `${verb} ${label}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateWorkspaceDialog
        open={showCreateWorkspace}
        onOpenChange={setShowCreateWorkspace}
        orgId={selectedOrgId || undefined}
        onWorkspaceCreated={(workspaceId) => {
          if (selectedOrgId) {
            setSelectedWorkspace({
              id: workspaceId,
              organization_id: selectedOrgId,
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
