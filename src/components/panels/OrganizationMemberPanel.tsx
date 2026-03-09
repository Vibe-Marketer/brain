/**
 * OrganizationMemberPanel - Slide-in detail panel (4th pane) for org member management
 *
 * Features:
 * - Tabs: "Members" | "Pending Invites"
 * - Member list with roles, avatars, join dates
 * - Role management: change member roles (owner can change admin<->member)
 * - Remove member from org (cascades to all workspace memberships via DB)
 * - Invite member to org via email
 * - View and revoke pending invitations
 *
 * Security: RLS enforces that only admins/owners can mutate. Client-side
 * checks are for UX only (hide buttons for non-admins).
 *
 * @pattern detail-panel
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
  RiBuildingLine,
  RiUserAddLine,
  RiUserLine,
  RiTeamLine,
  RiMoreLine,
  RiShieldUserLine,
  RiDeleteBinLine,
  RiMailLine,
  RiTimeLine,
  RiCloseCircleLine,
} from '@remixicon/react'
import { usePanelStore } from '@/stores/panelStore'
import { useAuth } from '@/contexts/AuthContext'
import { OrganizationInviteDialog } from '@/components/dialogs/OrganizationInviteDialog'
import {
  useOrganizationMembers,
  useOrganizationInvitations,
  useUpdateOrgMemberRole,
  useRemoveOrgMember,
  useRevokeOrgInvitation,
} from '@/hooks/useOrganizationMembers'
import type { OrganizationMember, OrganizationRole } from '@/hooks/useOrganizationMembers'

// ─── Constants ──────────────────────────────────────────────────────

type OrgRole = 'organization_owner' | 'organization_admin' | 'member'

const ROLE_BADGE_STYLES: Record<OrgRole, { bg: string; text: string; border: string }> = {
  organization_owner: { bg: 'bg-vibe-orange/10', text: 'text-vibe-orange', border: 'border-vibe-orange/20' },
  organization_admin: { bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/20' },
  member: { bg: 'bg-muted/50', text: 'text-muted-foreground', border: 'border-border/50' },
}

const ROLE_LABELS: Record<OrgRole, string> = {
  organization_owner: 'Owner',
  organization_admin: 'Admin',
  member: 'Member',
}

type Tab = 'members' | 'invites'

// ─── Sub-components ─────────────────────────────────────────────────

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

// ─── Main Component ─────────────────────────────────────────────────

export interface OrganizationMemberPanelProps {
  organizationId: string
  organizationName: string
}

export function OrganizationMemberPanel({ organizationId, organizationName }: OrganizationMemberPanelProps) {
  const { closePanel } = usePanelStore()
  const { user } = useAuth()

  // Data hooks
  const { members, isLoading: membersLoading } = useOrganizationMembers(organizationId)
  const { invitations, isLoading: invitationsLoading } = useOrganizationInvitations(organizationId)

  // Mutation hooks
  const updateRole = useUpdateOrgMemberRole(organizationId)
  const removeMember = useRemoveOrgMember(organizationId)
  const revokeInvitation = useRevokeOrgInvitation(organizationId)

  // UI state
  const [activeTab, setActiveTab] = useState<Tab>('members')
  const [searchTerm, setSearchTerm] = useState('')
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)

  // Derived state
  const currentUserMembership = useMemo(
    () => members.find((m) => m.user_id === user?.id) || null,
    [members, user?.id]
  )
  const currentUserRole = currentUserMembership?.role || null
  const canManage = currentUserRole === 'organization_owner' || currentUserRole === 'organization_admin'
  const isOwner = currentUserRole === 'organization_owner'

  const ownerCount = useMemo(
    () => members.filter((m) => m.role === 'organization_owner').length,
    [members]
  )

  const filteredMembers = useMemo(() => {
    if (!searchTerm.trim()) return members
    const term = searchTerm.trim().toLowerCase()
    return members.filter((m) => {
      const name = m.display_name?.toLowerCase() || ''
      const email = m.email?.toLowerCase() || ''
      return name.includes(term) || email.includes(term)
    })
  }, [members, searchTerm])

  const pendingInvitations = useMemo(
    () => invitations.filter((inv) => inv.status === 'pending'),
    [invitations]
  )

  // Handlers
  const handleChangeRole = useCallback(
    (member: OrganizationMember, newRole: OrganizationRole) => {
      updateRole.mutate({ membershipId: member.id, newRole })
    },
    [updateRole]
  )

  const handleRemoveMember = useCallback(
    (member: OrganizationMember) => {
      if (member.role === 'organization_owner' && ownerCount <= 1) return
      if (!confirm(`Remove ${member.display_name || member.email} from this organization? This will also remove them from all workspaces.`)) return
      removeMember.mutate({ membershipId: member.id })
    },
    [removeMember, ownerCount]
  )

  const handleRevokeInvitation = useCallback(
    (invitationId: string) => {
      if (!confirm('Revoke this invitation?')) return
      revokeInvitation.mutate({ invitationId })
    },
    [revokeInvitation]
  )

  const showSearch = members.length > 5

  return (
    <div className="h-full flex flex-col bg-card/30 backdrop-blur-xl">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-4 border-b border-border/40 bg-card/50 backdrop-blur-md sticky top-0 z-10 flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-vibe-orange/10 flex items-center justify-center border border-vibe-orange/20">
            <RiBuildingLine className="h-4.5 w-4.5 text-vibe-orange" aria-hidden="true" />
          </div>
          <div className="flex flex-col min-w-0">
            <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] leading-none mb-1">
              Organization
            </h3>
            <p className="text-sm font-bold text-foreground truncate max-w-[180px]">
              {organizationName || 'Members'}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full hover:bg-muted/80 transition-colors"
          onClick={() => closePanel()}
          aria-label="Close members panel"
        >
          <RiCloseLine className="h-4 w-4" aria-hidden="true" />
        </Button>
      </header>

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

      {/* Content */}
      <ScrollArea className="flex-1">
        {activeTab === 'members' ? (
          <div className="p-3 space-y-2">
            {/* Search + Invite */}
            <div className="flex items-center gap-2">
              {showSearch && (
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search members"
                  className="h-8 text-xs flex-1"
                  aria-label="Search organization members"
                />
              )}
              {canManage && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 flex-shrink-0"
                  onClick={() => setInviteDialogOpen(true)}
                  aria-label="Invite member"
                >
                  <RiUserAddLine className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                  <span className="text-xs">Invite</span>
                </Button>
              )}
            </div>

            {/* Member list */}
            {membersLoading ? (
              <MemberListSkeleton />
            ) : filteredMembers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <RiTeamLine className="h-12 w-12 text-muted-foreground/50 mb-3" aria-hidden="true" />
                <p className="text-sm font-medium text-foreground mb-1">
                  {searchTerm ? 'No matches' : 'No members yet'}
                </p>
                <p className="text-xs text-muted-foreground text-center">
                  {searchTerm ? 'Try a different search term.' : 'Invite team members to collaborate.'}
                </p>
              </div>
            ) : (
              filteredMembers.map((member) => {
                const roleKey = member.role as OrgRole
                const roleStyle = ROLE_BADGE_STYLES[roleKey] || ROLE_BADGE_STYLES.member
                const roleLabel = ROLE_LABELS[roleKey] || member.role
                const joinDate = member.created_at
                  ? format(new Date(member.created_at), 'MMM d, yyyy')
                  : null
                const isCurrentUser = member.user_id === user?.id
                const isMemberOwner = member.role === 'organization_owner'
                // Owners can change anyone except themselves; admins can change members only
                const canChangeThisMember =
                  canManage && !isCurrentUser && !isMemberOwner
                // Cannot remove last owner
                const canRemoveThisMember =
                  canChangeThisMember && !(isMemberOwner && ownerCount <= 1)

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

                    {/* Name + email + join date */}
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
                        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                      )}
                      {joinDate && (
                        <p className="text-[10px] text-muted-foreground/70">Joined {joinDate}</p>
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

                    {/* Actions dropdown */}
                    {canChangeThisMember && (
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
                          {/* Role changes */}
                          {isOwner && member.role !== 'organization_admin' && (
                            <DropdownMenuItem onClick={() => handleChangeRole(member, 'organization_admin')}>
                              <RiShieldUserLine className="h-4 w-4 mr-2" />
                              Make Admin
                            </DropdownMenuItem>
                          )}
                          {canManage && member.role !== 'member' && (
                            <DropdownMenuItem onClick={() => handleChangeRole(member, 'member')}>
                              <RiUserLine className="h-4 w-4 mr-2" />
                              Make Member
                            </DropdownMenuItem>
                          )}

                          {/* Remove */}
                          {canRemoveThisMember && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleRemoveMember(member)}
                              >
                                <RiDeleteBinLine className="h-4 w-4 mr-2" />
                                Remove from Org
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                )
              })
            )}
          </div>
        ) : (
          /* Pending Invites Tab */
          <div className="p-3 space-y-2">
            {canManage && (
              <div className="pb-2 mb-2 border-b border-border/30">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setInviteDialogOpen(true)}
                  aria-label="Invite member"
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
                  Invite teammates to join this organization.
                </p>
              </div>
            ) : (
              pendingInvitations.map((invitation) => {
                const roleLabel = ROLE_LABELS[invitation.role as OrgRole] || invitation.role
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
        )}
      </ScrollArea>

      {/* Invite Dialog */}
      <OrganizationInviteDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        organizationId={organizationId}
        organizationName={organizationName}
      />
    </div>
  )
}
