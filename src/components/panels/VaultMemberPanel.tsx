/**
 * VaultMemberPanel - Slide-in detail panel (4th pane) showing vault members
 *
 * Full member management:
 * - Member list with roles, avatars, join dates
 * - Invite members via shareable link (vault_owner/vault_admin)
 * - Change member roles (vault_owner/vault_admin)
 * - Remove members (vault_owner/vault_admin)
 * - Leave vault (self-removal)
 * - "You" badge on current user
 *
 * @pattern detail-panel
 * @brand-version v4.2
 */

import { useState, useCallback, useMemo } from 'react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  RiCloseLine,
  RiGroupLine,
  RiUserAddLine,
  RiUserLine,
  RiTeamLine,
  RiMoreLine,
  RiShieldUserLine,
  RiLogoutCircleLine,
  RiDeleteBinLine,
} from '@remixicon/react'
import { usePanelStore } from '@/stores/panelStore'
import { useVaultMembers, type VaultMember } from '@/hooks/useVaults'
import { useChangeRole, useRemoveMember, useLeaveVault } from '@/hooks/useVaultMemberMutations'
import { useAuth } from '@/contexts/AuthContext'
import { VaultInviteDialog } from '@/components/dialogs/VaultInviteDialog'
import { ChangeRoleDialog } from '@/components/dialogs/ChangeRoleDialog'
import type { VaultRole } from '@/types/bank'

/** Role badge styling */
const ROLE_BADGE_STYLES: Record<VaultRole, { bg: string; text: string }> = {
  vault_owner: { bg: 'bg-vibe-orange/15', text: 'text-vibe-orange' },
  vault_admin: { bg: 'bg-info-bg', text: 'text-info-text' },
  manager: { bg: 'bg-success-bg', text: 'text-success-text' },
  member: { bg: 'bg-neutral-bg', text: 'text-neutral-text' },
  guest: { bg: 'bg-neutral-bg', text: 'text-neutral-text' },
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
  vaultName?: string
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

export function VaultMemberPanel({ vaultId, vaultName }: VaultMemberPanelProps) {
  const { closePanel } = usePanelStore()
  const { user } = useAuth()
  const { members, isLoading } = useVaultMembers(vaultId)

  // Mutation hooks
  const changeRole = useChangeRole(vaultId)
  const removeMember = useRemoveMember(vaultId)
  const leaveVault = useLeaveVault(vaultId)

  // Dialog state
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [changeRoleTarget, setChangeRoleTarget] = useState<VaultMember | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const handleClose = useCallback(() => {
    closePanel()
  }, [closePanel])

  // Find current user's membership
  const currentUserMembership = useMemo(
    () => members.find((m) => m.user_id === user?.id) || null,
    [members, user?.id]
  )

  const currentUserRole = currentUserMembership?.role || null
  const canManage = currentUserRole === 'vault_owner' || currentUserRole === 'vault_admin'

  const adminCount = useMemo(
    () => members.filter((member) => member.role === 'vault_admin').length,
    [members]
  )

  const showSearch = members.length > 10
  const hasOnlyOwner = members.length <= 1
  const filteredMembers = useMemo(() => {
    if (!searchTerm.trim()) return members
    const term = searchTerm.trim().toLowerCase()
    return members.filter((member) => {
      const name = member.display_name?.toLowerCase() || ''
      const email = member.email?.toLowerCase() || ''
      return name.includes(term) || email.includes(term)
    })
  }, [members, searchTerm])

  // Handle role change
  const handleChangeRole = useCallback(
    (newRole: VaultRole) => {
      if (!changeRoleTarget || !currentUserRole) return
      changeRole.mutate(
        {
          membershipId: changeRoleTarget.id,
          userId: changeRoleTarget.user_id,
          newRole,
          currentUserRole,
          targetRole: changeRoleTarget.role,
          isLastAdmin: changeRoleTarget.role === 'vault_admin' && adminCount <= 1,
        },
        {
          onSuccess: () => setChangeRoleTarget(null),
        }
      )
    },
    [changeRoleTarget, currentUserRole, changeRole, adminCount]
  )

  // Handle member removal
  const handleRemoveMember = useCallback(
    (member: VaultMember) => {
      if (!currentUserRole) return
      if (!confirm(`Remove ${member.display_name || member.email || 'this member'} from the hub?`)) return
      removeMember.mutate({
        membershipId: member.id,
        targetRole: member.role,
        currentUserRole,
      })
    },
    [removeMember, currentUserRole]
  )

  // Handle leave vault
  const handleLeaveVault = useCallback(() => {
    if (!currentUserMembership || !currentUserRole) return
    if (!confirm('Are you sure you want to leave this hub?')) return
    leaveVault.mutate({
      membershipId: currentUserMembership.id,
      userRole: currentUserRole,
    })
  }, [currentUserMembership, currentUserRole, leaveVault])

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border/40 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <RiGroupLine className="h-4 w-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wide truncate">
            Hub Members
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
        ) : hasOnlyOwner ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <RiTeamLine className="h-12 w-12 text-muted-foreground/50 mb-3" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground mb-1">No members yet</p>
            <p className="text-xs text-muted-foreground text-center">
              Invite team members to collaborate
            </p>
            {canManage && (
              <Button
                variant="hollow"
                size="sm"
                className="mt-4"
                onClick={() => setInviteDialogOpen(true)}
                aria-label="Invite members"
              >
                <RiUserAddLine className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                Invite Members
              </Button>
            )}
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {showSearch && (
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search members"
                className="h-8 text-xs"
                aria-label="Search hub members"
              />
            )}
            {/* Invite button at top — only for vault_owner/vault_admin */}
            {canManage && (
              <div className="pb-2 mb-2 border-b border-border/30">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setInviteDialogOpen(true)}
                  aria-label="Invite members"
                >
                  <RiUserAddLine className="h-3.5 w-3.5 mr-2" aria-hidden="true" />
                  Invite Members
                </Button>
              </div>
            )}

            {/* Member rows */}
            {filteredMembers.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No members match that search.
              </div>
            ) : (
              filteredMembers.map((member) => {
                const roleStyle = ROLE_BADGE_STYLES[member.role] || ROLE_BADGE_STYLES.member
                const roleLabel = ROLE_LABELS[member.role] || member.role
                const joinDate = member.created_at
                  ? format(new Date(member.created_at), 'MMM d, yyyy')
                  : null
              const isCurrentUser = member.user_id === user?.id
              const canChangeThisMember = canManage && !isCurrentUser && member.role !== 'vault_owner'

              return (
                <div
                  key={member.id}
                  className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted/50 transition-colors group"
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
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-foreground truncate">
                        {member.display_name || member.email || 'Unknown user'}
                      </p>
                      {isCurrentUser && (
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1 py-0 h-4 uppercase tracking-wider"
                        >
                          You
                        </Badge>
                      )}
                    </div>
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

                  {/* Actions menu */}
                  {(canChangeThisMember || isCurrentUser) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                          aria-label="Member actions"
                        >
                          <RiMoreLine className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      {/* Change role (not for self, not for owner) */}
                      {canChangeThisMember && (
                        <DropdownMenuItem onClick={() => setChangeRoleTarget(member)}>
                          <RiShieldUserLine className="h-4 w-4 mr-2" />
                          Change Role
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem disabled>
                        <RiUserLine className="h-4 w-4 mr-2" />
                        View Profile
                      </DropdownMenuItem>
                      {/* Remove from vault (not for self, not for owner) */}
                      {canChangeThisMember && (
                        <>
                          <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleRemoveMember(member)}
                            >
                              <RiDeleteBinLine className="h-4 w-4 mr-2" />
                              Remove from Hub
                            </DropdownMenuItem>
                          </>
                        )}
                        {/* Leave vault (self only, not owner) */}
                        {isCurrentUser && currentUserRole !== 'vault_owner' && (
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={handleLeaveVault}
                          >
                            <RiLogoutCircleLine className="h-4 w-4 mr-2" />
                            Leave Hub
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              )
              })
            )}
          </div>
        )}
      </ScrollArea>

      {/* Invite Dialog */}
      <VaultInviteDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        vaultId={vaultId}
        vaultName={vaultName || 'this hub'}
      />

      {/* Change Role Dialog */}
      {changeRoleTarget && currentUserRole && (
        <ChangeRoleDialog
          open={!!changeRoleTarget}
          onOpenChange={(open) => !open && setChangeRoleTarget(null)}
          memberName={changeRoleTarget.display_name || changeRoleTarget.email || 'Unknown'}
          currentRole={changeRoleTarget.role}
          currentUserRole={currentUserRole}
          isLastAdmin={changeRoleTarget.role === 'vault_admin' && adminCount <= 1}
          onConfirm={handleChangeRole}
          isLoading={changeRole.isPending}
        />
      )}
    </div>
  )
}

export default VaultMemberPanel
