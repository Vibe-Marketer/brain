/**
 * VaultMemberPanel - Slide-in detail panel (4th pane) showing vault members
 *
 * Shows member list with roles, avatars, and join dates.
 * Invite/role management actions are stubs for Plan 04.
 *
 * @pattern detail-panel
 * @brand-version v4.2
 */

import { useCallback } from 'react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  RiCloseLine,
  RiGroupLine,
  RiUserAddLine,
  RiUserLine,
} from '@remixicon/react'
import { usePanelStore } from '@/stores/panelStore'
import { useVaultMembers } from '@/hooks/useVaults'
import type { VaultRole } from '@/types/bank'

/** Role badge styling */
const ROLE_BADGE_STYLES: Record<VaultRole, { bg: string; text: string }> = {
  vault_owner: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300' },
  vault_admin: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' },
  manager: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300' },
  member: { bg: 'bg-gray-100 dark:bg-gray-800/50', text: 'text-gray-600 dark:text-gray-400' },
  guest: { bg: 'bg-gray-50 dark:bg-gray-900/30', text: 'text-gray-500 dark:text-gray-500' },
}

/** Human-readable role labels */
const ROLE_LABELS: Record<VaultRole, string> = {
  vault_owner: 'Owner',
  vault_admin: 'Admin',
  manager: 'Manager',
  member: 'Member',
  guest: 'Guest',
}

export interface VaultMemberPanelProps {
  vaultId: string
}

/** Loading skeleton for member list */
function MemberListSkeleton() {
  return (
    <div className="space-y-3 p-4" aria-label="Loading members">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-5 w-14" />
        </div>
      ))}
    </div>
  )
}

export function VaultMemberPanel({ vaultId }: VaultMemberPanelProps) {
  const { closePanel } = usePanelStore()
  const { members, isLoading } = useVaultMembers(vaultId)

  const handleClose = useCallback(() => {
    closePanel()
  }, [closePanel])

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border/40 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <RiGroupLine className="h-4 w-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wide truncate">
            Vault Members
          </h3>
          {!isLoading && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 h-5 tabular-nums"
            >
              {members.length}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClose}
          aria-label="Close members panel"
        >
          <RiCloseLine className="h-4 w-4" aria-hidden="true" />
        </Button>
      </header>

      {/* Member list */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <MemberListSkeleton />
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <RiGroupLine className="h-10 w-10 text-muted-foreground/20 mb-3" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground mb-1">No members yet</p>
            <p className="text-xs text-muted-foreground text-center">
              Invite team members to collaborate in this vault.
            </p>
            {/* Invite button stub for Plan 04 */}
            <Button
              variant="hollow"
              size="sm"
              className="mt-4"
              disabled
              aria-label="Invite members (coming soon)"
            >
              <RiUserAddLine className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
              Invite Members
            </Button>
          </div>
        ) : (
          <div className="p-3 space-y-1">
            {/* Invite button stub at top */}
            <div className="pb-2 mb-2 border-b border-border/30">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-xs text-muted-foreground hover:text-foreground"
                disabled
                aria-label="Invite members (coming soon)"
              >
                <RiUserAddLine className="h-3.5 w-3.5 mr-2" aria-hidden="true" />
                Invite Members
                <Badge variant="outline" className="ml-auto text-[9px] px-1 h-4">
                  Soon
                </Badge>
              </Button>
            </div>

            {/* Member rows */}
            {members.map((member) => {
              const roleStyle = ROLE_BADGE_STYLES[member.role] || ROLE_BADGE_STYLES.member
              const roleLabel = ROLE_LABELS[member.role] || member.role
              const joinDate = member.created_at
                ? format(new Date(member.created_at), 'MMM d, yyyy')
                : null

              return (
                <div
                  key={member.id}
                  className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  {/* Avatar */}
                  {member.avatar_url ? (
                    <img
                      src={member.avatar_url}
                      alt=""
                      className="h-8 w-8 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <RiUserLine className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    </div>
                  )}

                  {/* Name + email */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {member.display_name || member.email || 'Unknown user'}
                    </p>
                    {member.display_name && member.email && (
                      <p className="text-xs text-muted-foreground truncate">
                        {member.email}
                      </p>
                    )}
                    {joinDate && (
                      <p className="text-[10px] text-muted-foreground/70">
                        Joined {joinDate}
                      </p>
                    )}
                  </div>

                  {/* Role badge */}
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] px-1.5 py-0 h-5 uppercase tracking-wider font-medium border-0 flex-shrink-0',
                      roleStyle.bg,
                      roleStyle.text
                    )}
                  >
                    {roleLabel}
                  </Badge>
                </div>
              )
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

export default VaultMemberPanel
