/**
 * WorkspaceMemberPanel - Slide-in detail panel (4th pane) showing workspace members
 *
 * Full member management:
 * - Member list with roles, avatars, join dates
 * - Invite members via shareable link (workspace_owner/workspace_admin)
 * - Change member roles (workspace_owner/workspace_admin)
 * - Remove members (workspace_owner/workspace_admin)
 * - Leave workspace (self-removal)
 * - "You" badge on current user
 *
 * @pattern detail-panel
 * @brand-version v4.2
 */

import { useState, useCallback, useMemo } from 'react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PaneHeader } from '@/components/ui/pane-header'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
  RiMailLine,
  RiTimeLine,
  RiCloseCircleLine,
  RiRefreshLine,
} from '@remixicon/react'
import { usePanelStore } from '@/stores/panelStore'
import { useWorkspaceMembers, useWorkspaceDetail, type WorkspaceMember } from '@/hooks/useWorkspaces'
import {
  useChangeRole,
  useRemoveMember,
  useLeaveWorkspace,
  useWorkspaceInvitations,
  useRevokeWorkspaceInvitation,
  useResendWorkspaceInvitation,
} from '@/hooks/useWorkspaceMemberMutations'
import { useAuth } from '@/contexts/AuthContext'
import { WorkspaceInviteDialog } from '@/components/dialogs/WorkspaceInviteDialog'
import { ChangeRoleDialog } from '@/components/dialogs/ChangeRoleDialog'
import type { WorkspaceRole } from '@/types/workspace'

type Tab = 'members' | 'invites'

/** Role badge styling */
const ROLE_BADGE_STYLES: Record<WorkspaceRole, { bg: string; text: string; border: string }> = {
  workspace_owner: { bg: 'bg-vibe-orange/10', text: 'text-vibe-orange', border: 'border-vibe-orange/20' },
  workspace_admin: { bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/20' },
  contributor: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/20' },
  member: { bg: 'bg-muted/50', text: 'text-muted-foreground', border: 'border-border/50' },
}

/** Human-readable role labels */
const ROLE_LABELS: Record<WorkspaceRole, string> = {
  workspace_owner: 'Owner',
  workspace_admin: 'Admin',
  contributor: 'Contributor',
  member: 'Member',
}

export interface WorkspaceMemberPanelProps {
  workspaceId: string
  workspaceName?: string
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

export function WorkspaceMemberPanel({ workspaceId, workspaceName }: WorkspaceMemberPanelProps) {
  const { closePanel } = usePanelStore()
  const { user } = useAuth()
  const { members, isLoading } = useWorkspaceMembers(workspaceId)
  const { invitations, isLoading: invitationsLoading } = useWorkspaceInvitations(workspaceId)
  // Organization id lets the invite dialog offer "add to multiple workspaces
  // in this org at once" — otherwise it falls back to single-workspace invite.
  const { workspace: workspaceDetail } = useWorkspaceDetail(workspaceId)
  const organizationId = workspaceDetail?.organization_id

  // Mutation hooks
  const changeRole = useChangeRole(workspaceId)
  const removeMember = useRemoveMember(workspaceId)
  const leaveWorkspace = useLeaveWorkspace(workspaceId)
  const revokeInvitation = useRevokeWorkspaceInvitation(workspaceId)
  const resendInvitation = useResendWorkspaceInvitation(workspaceId)

  // Dialog state
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [changeRoleTarget, setChangeRoleTarget] = useState<WorkspaceMember | null>(null)
  const [removeTarget, setRemoveTarget] = useState<WorkspaceMember | null>(null)
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('members')

  const handleClose = useCallback(() => {
    closePanel()
  }, [closePanel])

  // Find current user's membership
  const currentUserMembership = useMemo(
    () => members.find((m) => m.user_id === user?.id) || null,
    [members, user?.id]
  )

  const currentUserRole = currentUserMembership?.role || null
  const canManage = currentUserRole === 'workspace_owner' || currentUserRole === 'workspace_admin'

  const adminCount = useMemo(
    () => members.filter((member) => member.role === 'workspace_admin').length,
    [members]
  )

  const pendingInvitations = useMemo(
    () => invitations.filter((inv) => inv.status === 'pending'),
    [invitations]
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
    (newRole: WorkspaceRole) => {
      if (!changeRoleTarget || !currentUserRole) return
      changeRole.mutate(
        {
          membershipId: changeRoleTarget.id,
          userId: changeRoleTarget.user_id,
          newRole,
          currentUserRole,
          targetRole: changeRoleTarget.role,
          isLastAdmin: changeRoleTarget.role === 'workspace_admin' && adminCount <= 1,
        },
        {
          onSuccess: () => setChangeRoleTarget(null),
        }
      )
    },
    [changeRoleTarget, currentUserRole, changeRole, adminCount]
  )

  // Handle member removal — opens AlertDialog
  const handleRemoveWorkspaceMember = useCallback(
    (member: WorkspaceMember) => {
      if (!currentUserRole) return
      setRemoveTarget(member)
    },
    [currentUserRole]
  )

  // Confirmed member removal
  const handleConfirmRemove = useCallback(() => {
    if (!removeTarget || !currentUserRole) return
    removeMember.mutate({
      membershipId: removeTarget.id,
      targetRole: removeTarget.role,
      currentUserRole,
    })
    setRemoveTarget(null)
  }, [removeTarget, removeMember, currentUserRole])

  // Handle leave workspace — opens AlertDialog
  const handleLeaveWorkspace = useCallback(() => {
    if (!currentUserMembership || !currentUserRole) return
    setLeaveConfirmOpen(true)
  }, [currentUserMembership, currentUserRole])

  // Confirmed leave workspace
  const handleConfirmLeave = useCallback(() => {
    if (!currentUserMembership || !currentUserRole) return
    leaveWorkspace.mutate({
      membershipId: currentUserMembership.id,
      userRole: currentUserRole,
    })
    setLeaveConfirmOpen(false)
  }, [currentUserMembership, currentUserRole, leaveWorkspace])

  // Revoke a pending invitation
  const handleRevokeInvitation = useCallback(
    (invitationId: string) => {
      revokeInvitation.mutate({ invitationId })
    },
    [revokeInvitation]
  )

  // Resend (refresh) a pending invitation
  const handleResendInvitation = useCallback(
    (invitationId: string, role: WorkspaceRole) => {
      if (role === 'workspace_owner') return
      resendInvitation.mutate({ invitationId, role: role as 'member' | 'contributor' | 'workspace_admin' })
    },
    [resendInvitation]
  )

  return (
    <div className="h-full flex flex-col bg-card/30 backdrop-blur-xl">
      {/* Premium Header */}
      <PaneHeader
        icon={<RiGroupLine className="h-4 w-4" aria-hidden="true" />}
        title={workspaceName || 'Members'}
        subtitle="Workspace members"
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            aria-label="Close members panel"
          >
            <RiCloseLine className="h-4 w-4" aria-hidden="true" />
          </Button>
        }
      />

      {/* Tabs */}
      <div className="flex border-b border-border/40 px-3 flex-shrink-0">
        <button
          className={cn(
            'px-3 py-2 text-xs font-medium transition-colors relative',
            activeTab === 'members'
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
          onClick={() => setActiveTab('members')}
        >
          Members
          <Badge variant="secondary" className="ml-1.5 text-[9px] px-1 h-4 min-w-[16px]">
            {members.length}
          </Badge>
          {activeTab === 'members' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-vibe-orange rounded-full" />
          )}
        </button>
        {canManage && (
          <button
            className={cn(
              'px-3 py-2 text-xs font-medium transition-colors relative',
              activeTab === 'invites'
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setActiveTab('invites')}
          >
            Pending Invites
            {pendingInvitations.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[9px] px-1 h-4 min-w-[16px]">
                {pendingInvitations.length}
              </Badge>
            )}
            {activeTab === 'invites' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-vibe-orange rounded-full" />
            )}
          </button>
        )}
      </div>

      {/* Member list */}
      <ScrollArea className="flex-1">
        {activeTab === 'invites' ? (
          <div className="p-3 space-y-2">
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
                  Send New Invite
                </Button>
              </div>
            )}

            {invitationsLoading ? (
              <MemberListSkeleton />
            ) : pendingInvitations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <RiMailLine className="h-12 w-12 text-muted-foreground/50 mb-3" aria-hidden="true" />
                <p className="text-sm font-medium text-foreground mb-1">No pending invites</p>
                <p className="text-xs text-muted-foreground text-center">
                  Invite teammates to join this workspace.
                </p>
              </div>
            ) : (
              pendingInvitations.map((invitation) => {
                const roleLabel = ROLE_LABELS[invitation.role as WorkspaceRole] || invitation.role
                const expiresDate = invitation.expires_at
                  ? format(new Date(invitation.expires_at), 'MMM d, yyyy')
                  : null

                return (
                  <div
                    key={invitation.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/50 transition-all duration-200 border border-transparent hover:border-border/40 group"
                  >
                    <div className="h-8 w-8 rounded-full bg-muted/60 flex items-center justify-center flex-shrink-0">
                      <RiMailLine className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {invitation.email}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">
                          {roleLabel}
                        </span>
                        {expiresDate && (
                          <>
                            <span className="text-[10px] text-muted-foreground/40">|</span>
                            <span className="text-[10px] text-muted-foreground/70 flex items-center gap-0.5">
                              <RiTimeLine className="h-2.5 w-2.5" aria-hidden="true" />
                              Expires {expiresDate}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                      onClick={() => handleResendInvitation(invitation.id, invitation.role as WorkspaceRole)}
                      aria-label="Resend invitation"
                    >
                      <RiRefreshLine className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 text-destructive hover:text-destructive"
                      onClick={() => handleRevokeInvitation(invitation.id)}
                      aria-label="Revoke invitation"
                    >
                      <RiCloseCircleLine className="h-4 w-4" />
                    </Button>
                  </div>
                )
              })
            )}
          </div>
        ) : isLoading ? (
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
                aria-label="Search workspace members"
              />
            )}
            {/* Invite button at top — only for workspace_owner/workspace_admin */}
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
              const canChangeThisMember = canManage && !isCurrentUser && member.role !== 'workspace_owner'

              return (
                <div
                  key={member.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/50 transition-all duration-200 border border-transparent hover:border-border/40 group"
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
                      <p className="text-2xs text-muted-foreground/70">
                        Joined {joinDate}
                      </p>
                    )}
                  </div>

                  {/* Role badge */}
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[9px] px-1.5 py-0 h-5 uppercase tracking-[0.1em] font-bold border flex-shrink-0',
                      roleStyle.bg,
                      roleStyle.text,
                      roleStyle.border
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
                        {/* Remove from workspace (not for self, not for owner) */}
                        {canChangeThisMember && (
                          <>
                            <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleRemoveWorkspaceMember(member)}
                              >
                                <RiDeleteBinLine className="h-4 w-4 mr-2" />
                                Remove from Workspace
                              </DropdownMenuItem>
                            </>
                          )}
                          {/* Leave workspace (self only, not owner) */}
                          {isCurrentUser && currentUserRole !== 'workspace_owner' && (
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={handleLeaveWorkspace}
                             >
                              <RiLogoutCircleLine className="h-4 w-4 mr-2" />
                              Leave Workspace
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

      <footer className="shrink-0 px-4 py-2" />

      {/* Invite Dialog */}
      <WorkspaceInviteDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        workspaceId={workspaceId}
        workspaceName={workspaceName || 'this workspace'}
        organizationId={organizationId}
      />

      {/* Change Role Dialog */}
      {changeRoleTarget && currentUserRole && (
        <ChangeRoleDialog
          open={!!changeRoleTarget}
          onOpenChange={(open) => !open && setChangeRoleTarget(null)}
          memberName={changeRoleTarget.display_name || changeRoleTarget.email || 'Unknown'}
          currentRole={changeRoleTarget.role}
          currentUserRole={currentUserRole}
          isLastAdmin={changeRoleTarget.role === 'workspace_admin' && adminCount <= 1}
          onConfirm={handleChangeRole}
          isLoading={changeRole.isPending}
        />
      )}

      {/* Remove Member Confirmation */}
      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {removeTarget?.display_name || removeTarget?.email}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Their calls will remain in the workspace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Leave Workspace Confirmation */}
      <AlertDialog open={leaveConfirmOpen} onOpenChange={setLeaveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave this workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              You will lose access to all calls in this workspace. You can only rejoin if re-invited.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmLeave}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Leave Workspace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default WorkspaceMemberPanel
