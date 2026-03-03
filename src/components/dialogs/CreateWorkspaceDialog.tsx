/**
 * CreateWorkspaceDialog - Dialog for creating new workspaces
 *
 * Supports workspace name, type selection (team default),
 * and optional share link TTL setting.
 *
 * @pattern dialog-form
 * @brand-version v4.2
 */

import { useState, useCallback, useEffect, useMemo } from 'react'
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
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useOrganizationContext } from '@/hooks/useOrganizationContext'
import { useCreateWorkspace } from '@/hooks/useWorkspaceMutations'
import { useFeatureFlags } from '@/hooks/useFeatureFlags'
import { useUserRole } from '@/hooks/useUserRole'
import type { WorkspaceType } from '@/types/workspace'

export interface CreateWorkspaceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orgId?: string // Renamed from bankId, made optional to allow auto-select
  onWorkspaceCreated?: (workspaceId: string) => void
}

/** Type descriptions for the select menu */
const WORKSPACE_TYPE_OPTIONS: Array<{
  value: WorkspaceType
  label: string
  description: string
  disabled?: boolean
}> = [
  {
    value: 'team',
    label: 'Team',
    description: 'Shared workspace for your team',
  },
  {
    value: 'youtube',
    label: 'YouTube',
    description: 'Video intelligence and channel content',
  },
  {
    value: 'coach',
    label: 'Coach',
    description: 'Coaching sessions and feedback',
    disabled: true,
  },
  {
    value: 'community',
    label: 'Community',
    description: 'Community-shared content',
    disabled: true,
  },
  {
    value: 'client',
    label: 'Client',
    description: 'Client-facing recordings',
    disabled: true,
  },
]

export function CreateWorkspaceDialog({
  open,
  onOpenChange,
  orgId,
  onWorkspaceCreated,
}: CreateWorkspaceDialogProps) {
  const [name, setName] = useState('')
  const [workspaceType, setWorkspaceType] = useState<WorkspaceType>('team')
  const [ttlDays, setTtlDays] = useState('7')
  const [selectedOrgId, setSelectedOrgId] = useState(orgId || '')
  
  const { organizations, activeOrgId } = useOrganizationContext()
  const createWorkspace = useCreateWorkspace()
  const { role } = useUserRole();
  const { isFeatureEnabled } = useFeatureFlags(role);

  const businessOrganizations = useMemo(
    () => organizations.filter((org) => org.type === 'business'),
    [organizations]
  )

  const showOrgSelect = businessOrganizations.length > 1

  const availableOptions = useMemo(() => {
    return WORKSPACE_TYPE_OPTIONS.filter((opt) => {
      if (opt.value === 'youtube') return isFeatureEnabled('beta_youtube');
      return true;
    });
  }, [isFeatureEnabled]);

  useEffect(() => {
    if (!open) return
    
    // Auto-select logic
    const businessDefault =
      businessOrganizations.find((org) => org.id === activeOrgId)?.id ||
      businessOrganizations[0]?.id ||
      ''
      
    const fallbackOrg = showOrgSelect
      ? businessDefault
      : orgId || activeOrgId || businessDefault
      
    setSelectedOrgId(fallbackOrg)
  }, [open, orgId, activeOrgId, businessOrganizations, showOrgSelect])

  const trimmedName = name.trim()
  const isNameValid = trimmedName.length >= 3 && trimmedName.length <= 50
  const ttlValue = ttlDays.trim() === '' ? null : Number(ttlDays)
  const shareLinkTtl = ttlValue !== null && Number.isFinite(ttlValue)
    ? Math.min(365, Math.max(1, ttlValue))
    : undefined
  const canSubmit = isNameValid && !!selectedOrgId && !createWorkspace.isPending

  const handleSubmit = useCallback(() => {
    if (!isNameValid || !selectedOrgId) return

    createWorkspace.mutate(
      {
        orgId: selectedOrgId,
        name: trimmedName,
        workspaceType: workspaceType,
        defaultShareLinkTtlDays: shareLinkTtl,
      },
      {
        onSuccess: (workspace) => {
          setName('')
          setWorkspaceType('team')
          setTtlDays('7')
          onOpenChange(false)
          onWorkspaceCreated?.(workspace.id)
        },
      }
    )
  }, [
    createWorkspace,
    isNameValid,
    onOpenChange,
    onWorkspaceCreated,
    selectedOrgId,
    shareLinkTtl,
    trimmedName,
    workspaceType,
  ])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && canSubmit) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [canSubmit, handleSubmit]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="create-workspace-description">
        <DialogHeader>
          <DialogTitle>Create New Workspace</DialogTitle>
          <DialogDescription id="create-workspace-description">
            A workspace is a shared space inside an organization for one team, client, or community.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Workspace name */}
          <div className="space-y-2">
            <Label htmlFor="workspace-name">Workspace Name</Label>
            <Input
              id="workspace-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., Sales Hub, Client A"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              3-50 characters
            </p>
            {name.length > 0 && !isNameValid && (
              <p className="text-xs text-destructive">
                Workspace name must be between 3 and 50 characters.
              </p>
            )}
          </div>

          {/* Workspace type */}
          <div className="space-y-2">
            <Label htmlFor="workspace-type">Workspace Type</Label>
            <Select
              value={workspaceType}
              onValueChange={(v) => setWorkspaceType(v as WorkspaceType)}
            >
              <SelectTrigger id="workspace-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableOptions.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    disabled={opt.disabled}
                  >
                    <div className="flex items-center justify-between w-full gap-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{opt.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {opt.description}
                        </span>
                      </div>
                      {opt.disabled && (
                        <Badge variant="outline" className="text-2xs">
                          Coming Soon
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Default share link TTL */}
          <div className="space-y-2">
            <Label htmlFor="workspace-ttl">Default Share Link Expiration (days)</Label>
            <Input
              id="workspace-ttl"
              type="number"
              min={1}
              max={365}
              value={ttlDays}
              onChange={(e) => setTtlDays(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Shared links expire after this many days (default 7)
            </p>
          </div>

          {/* Organization selection */}
          {showOrgSelect && (
            <div className="space-y-2">
              <Label htmlFor="workspace-org">Organization</Label>
              <Select
                value={selectedOrgId}
                onValueChange={setSelectedOrgId}
              >
                <SelectTrigger id="workspace-org">
                  <SelectValue placeholder="Select an organization" />
                </SelectTrigger>
                <SelectContent>
                  {businessOrganizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={createWorkspace.isPending}
            aria-label="Cancel workspace creation"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            aria-label="Create workspace"
          >
            {createWorkspace.isPending ? 'Creating...' : 'Create Workspace'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default CreateWorkspaceDialog
