/**
 * ChangeRoleDialog - Change a workspace member's role
 *
 * Shows current role, radio buttons for available roles,
 * disables roles higher than current user's role.
 *
 * @pattern dialog
 * @brand-version v4.2
 */

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
import { cn } from '@/lib/utils'
import {
  RiShieldUserLine,
  RiUserLine,
  RiGroupLine,
  RiVipCrownLine,
} from '@remixicon/react'
import type { WorkspaceRole } from '@/types/workspace'

interface ChangeRoleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  memberName: string
  currentRole: WorkspaceRole
  currentUserRole: WorkspaceRole
  /** user_id of the member being edited — used for owner self-demotion guard */
  targetUserId?: string
  /** user_id of the currently authenticated user */
  currentUserId?: string
  isLastAdmin?: boolean
  onConfirm: (newRole: WorkspaceRole) => void
  isLoading?: boolean
}

/** All workspace roles in hierarchy order (4-role v2.0 model) */
const WORKSPACE_ROLES: Array<{
  value: WorkspaceRole
  label: string
  description: string
  icon: typeof RiVipCrownLine
  power: number
}> = [
  {
    value: 'workspace_owner',
    label: 'Owner',
    description: 'Full control. Can delete workspace and manage all members.',
    icon: RiVipCrownLine,
    power: 0,
  },
  {
    value: 'workspace_admin',
    label: 'Admin',
    description: 'Can manage members, settings, and invite links.',
    icon: RiShieldUserLine,
    power: 1,
  },
  {
    value: 'contributor',
    label: 'Contributor',
    description: 'Can add and route calls to workspace. Calls permanently copied to owner\'s account.',
    icon: RiGroupLine,
    power: 2,
  },
  {
    value: 'member',
    label: 'Member',
    description: 'Read and organize access only. On removal, owner decides call retention.',
    icon: RiUserLine,
    power: 3,
  },
]

const ROLE_POWER: Record<WorkspaceRole, number> = {
  workspace_owner: 0,
  workspace_admin: 1,
  contributor: 2,
  member: 3,
}

export function ChangeRoleDialog({
  open,
  onOpenChange,
  memberName,
  currentRole,
  currentUserRole,
  targetUserId,
  currentUserId,
  isLastAdmin = false,
  onConfirm,
  isLoading = false,
}: ChangeRoleDialogProps) {
  const [selectedRole, setSelectedRole] = useState<WorkspaceRole>(currentRole)

  const handleConfirm = () => {
    if (selectedRole !== currentRole) {
      onConfirm(selectedRole)
    }
  }

  const currentUserPower = ROLE_POWER[currentUserRole]
  const hasChanged = selectedRole !== currentRole
  const currentRoleLabel = WORKSPACE_ROLES.find((role) => role.value === currentRole)?.label || currentRole

  // Owner self-demotion guard: when the target is the current user AND their role is
  // workspace_owner, hide the role selector entirely — owner role is permanent until
  // explicit ownership transfer (deferred feature).
  const isOwnerSelf =
    currentRole === 'workspace_owner' &&
    targetUserId !== undefined &&
    currentUserId !== undefined &&
    targetUserId === currentUserId

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Change Role for {memberName}</DialogTitle>
          <DialogDescription>
            <span className="text-muted-foreground">Current role:</span>{' '}
            <span className="font-medium text-foreground">{currentRoleLabel}</span>
          </DialogDescription>
        </DialogHeader>

        {isOwnerSelf ? (
          <div className="py-4 px-3 rounded-lg bg-muted/40 border border-border text-sm text-muted-foreground">
            Owner role cannot be changed. To transfer ownership, contact support.
          </div>
        ) : (
          <div className="space-y-2 py-2">
            {WORKSPACE_ROLES.map((role) => {
              const Icon = role.icon
              // Disable roles higher than current user's role
              const isDisabled = role.power < currentUserPower
              // workspace_owner transfer is not supported via this dialog
              const isOwnerTransfer = role.value === 'workspace_owner' && currentRole !== 'workspace_owner'
              const isLastAdminDemotion = currentRole === 'workspace_admin' && isLastAdmin && role.value !== 'workspace_admin'
              const disabled = isDisabled || isOwnerTransfer || isLastAdminDemotion || isLoading
              const isSelected = selectedRole === role.value
              const isCurrent = currentRole === role.value

              return (
                <label
                  key={role.value}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                    isSelected && !disabled
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/50',
                    disabled && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <input
                    type="radio"
                    name="workspace-role"
                    value={role.value}
                    checked={isSelected}
                    onChange={() => !disabled && setSelectedRole(role.value)}
                    disabled={disabled}
                    className="sr-only"
                  />
                  <Icon
                    className={cn(
                      'h-4 w-4 mt-0.5 flex-shrink-0',
                      isSelected ? 'text-primary' : 'text-muted-foreground'
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Label className={cn(
                        'text-sm font-medium',
                        disabled && 'text-muted-foreground'
                      )}>
                        {role.label}
                      </Label>
                      {isCurrent && (
                        <span className="text-2xs px-1.5 py-0 rounded-full bg-muted text-muted-foreground uppercase tracking-wider">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{role.description}</p>
                  </div>
                </label>
              )
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="hollow" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          {!isOwnerSelf && (
            <Button onClick={handleConfirm} disabled={!hasChanged || isLoading}>
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ChangeRoleDialog
