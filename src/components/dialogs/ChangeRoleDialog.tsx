/**
 * ChangeRoleDialog - Change a vault member's role
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
  RiEyeLine,
} from '@remixicon/react'
import type { VaultRole } from '@/types/bank'

interface ChangeRoleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  memberName: string
  currentRole: VaultRole
  currentUserRole: VaultRole
  onConfirm: (newRole: VaultRole) => void
  isLoading?: boolean
}

/** All vault roles in hierarchy order */
const VAULT_ROLES: Array<{
  value: VaultRole
  label: string
  description: string
  icon: typeof RiVipCrownLine
  power: number
}> = [
  {
    value: 'vault_owner',
    label: 'Owner',
    description: 'Full control. Can delete vault and manage all members.',
    icon: RiVipCrownLine,
    power: 0,
  },
  {
    value: 'vault_admin',
    label: 'Admin',
    description: 'Can manage members, settings, and invite links.',
    icon: RiShieldUserLine,
    power: 1,
  },
  {
    value: 'manager',
    label: 'Manager',
    description: 'Can view all recordings and manage team members below them.',
    icon: RiGroupLine,
    power: 2,
  },
  {
    value: 'member',
    label: 'Member',
    description: 'Can view and interact with vault recordings.',
    icon: RiUserLine,
    power: 3,
  },
  {
    value: 'guest',
    label: 'Guest',
    description: 'Limited access. Can view shared recordings only.',
    icon: RiEyeLine,
    power: 4,
  },
]

const ROLE_POWER: Record<VaultRole, number> = {
  vault_owner: 0,
  vault_admin: 1,
  manager: 2,
  member: 3,
  guest: 4,
}

export function ChangeRoleDialog({
  open,
  onOpenChange,
  memberName,
  currentRole,
  currentUserRole,
  onConfirm,
  isLoading = false,
}: ChangeRoleDialogProps) {
  const [selectedRole, setSelectedRole] = useState<VaultRole>(currentRole)

  const handleConfirm = () => {
    if (selectedRole !== currentRole) {
      onConfirm(selectedRole)
    }
  }

  const currentUserPower = ROLE_POWER[currentUserRole]
  const hasChanged = selectedRole !== currentRole

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Change Role</DialogTitle>
          <DialogDescription>
            Update role for <span className="font-medium text-foreground">{memberName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          {VAULT_ROLES.map((role) => {
            const Icon = role.icon
            // Disable roles higher than current user's role
            const isDisabled = role.power < currentUserPower
            // vault_owner transfer is not supported via this dialog
            const isOwnerTransfer = role.value === 'vault_owner' && currentRole !== 'vault_owner'
            const disabled = isDisabled || isOwnerTransfer || isLoading
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
                  name="vault-role"
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
                      <span className="text-[10px] px-1.5 py-0 rounded-full bg-muted text-muted-foreground uppercase tracking-wider">
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

        <DialogFooter>
          <Button variant="hollow" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!hasChanged || isLoading}>
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ChangeRoleDialog
