import { useState, useCallback, useEffect, useMemo } from 'react'
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
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  RiLinkM,
  RiFileCopyLine,
  RiCheckLine,
  RiUserAddLine,
  RiMailLine,
  RiAlertLine,
} from '@remixicon/react'
import { toast } from 'sonner'
import {
  createOrganizationInvitation,
  getShareableLink,
  type WorkspaceInviteRole,
  type WorkspaceSelection,
} from '@/services/organization-invitations.service'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'
import { useContactSuggestions } from '@/hooks/useContactSuggestions'
import { ContactSuggestions } from '@/components/contacts/ContactSuggestions'
import { useSubscription, TEAM_MEMBER_LIMIT } from '@/hooks/useSubscription'
import { useOrganizationWorkspaces } from '@/hooks/useWorkspaces'

interface OrganizationInviteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
  organizationName: string
  organizations?: Array<{ id: string; name: string }>
  seatsUsed?: number
  memberLimit?: number
  initialEmail?: string
}

export function OrganizationInviteDialog({
  open,
  onOpenChange,
  organizationId,
  organizationName,
  organizations = [],
  seatsUsed = 0,
  memberLimit = TEAM_MEMBER_LIMIT,
  initialEmail = '',
}: OrganizationInviteDialogProps) {
  const { user } = useAuth()
  const { tier } = useSubscription()
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(organizationId)
  const [email, setEmail] = useState(initialEmail)
  const [role, setRole] = useState<'organization_admin' | 'organization_member'>('organization_member')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [isCopied, setIsCopied] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const contactSuggestions = useContactSuggestions()
  const isTeamMemberLimitReached = tier === 'team' && seatsUsed >= memberLimit
  const supportHref = `mailto:support@callvault.ai?subject=${encodeURIComponent('Add seats to CallVault Team plan')}`
  const organizationOptions = organizations.length > 0
    ? organizations
    : [{ id: organizationId, name: organizationName }]
  const selectedOrganization = organizationOptions.find((org) => org.id === selectedOrganizationId)
  const selectedOrganizationName = selectedOrganization?.name ?? organizationName

  // Which of the org's workspaces this invite grants access to, decided by
  // the inviter here rather than defaulting to every workspace after the
  // invite is already accepted (the previous per-workspace-only flow).
  const { workspaces: organizationWorkspaces, isLoading: workspacesLoading } = useOrganizationWorkspaces(
    selectedOrganizationId || null
  )
  const [selectedWorkspaceIds, setSelectedWorkspaceIds] = useState<Set<string>>(new Set())
  const [workspaceRoleOverrides, setWorkspaceRoleOverrides] = useState<Record<string, WorkspaceInviteRole>>({})
  const allWorkspacesSelected =
    organizationWorkspaces.length > 0 && organizationWorkspaces.every((ws) => selectedWorkspaceIds.has(ws.id))
  const defaultWorkspaceRole: WorkspaceInviteRole = 'member'

  const getWorkspaceRole = useCallback(
    (workspaceId: string): WorkspaceInviteRole => workspaceRoleOverrides[workspaceId] ?? defaultWorkspaceRole,
    [workspaceRoleOverrides]
  )

  const handleToggleWorkspace = useCallback((workspaceId: string, checked: boolean) => {
    setSelectedWorkspaceIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(workspaceId)
      } else {
        next.delete(workspaceId)
      }
      return next
    })
  }, [])

  const handleToggleAllWorkspaces = useCallback(
    (checked: boolean) => {
      setSelectedWorkspaceIds(checked ? new Set(organizationWorkspaces.map((ws) => ws.id)) : new Set())
    },
    [organizationWorkspaces]
  )

  useEffect(() => {
    if (open) {
      setSelectedOrganizationId(organizationId)
      setEmail(initialEmail)
      setInviteUrl(null)
      setIsCopied(false)
      setSelectedWorkspaceIds(new Set())
      setWorkspaceRoleOverrides({})
    }
  }, [initialEmail, open, organizationId])

  // Default to every current workspace selected once they load — the
  // inviter can uncheck the ones they don't want to grant access to.
  useEffect(() => {
    if (!open || workspacesLoading || organizationWorkspaces.length === 0) return
    setSelectedWorkspaceIds((prev) => (prev.size === 0 ? new Set(organizationWorkspaces.map((ws) => ws.id)) : prev))
  }, [open, workspacesLoading, organizationWorkspaces])

  const workspaceSelections: WorkspaceSelection[] = useMemo(
    () =>
      organizationWorkspaces
        .filter((ws) => selectedWorkspaceIds.has(ws.id))
        .map((ws) => ({ workspaceId: ws.id, role: getWorkspaceRole(ws.id) })),
    [organizationWorkspaces, selectedWorkspaceIds, getWorkspaceRole]
  )

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !selectedOrganizationId) return
    if (isTeamMemberLimitReached) {
      toast.error('Team member limit reached', {
        description: `Team includes up to ${memberLimit} members. Contact support to upgrade beyond Team.`,
      })
      return
    }

    setIsSubmitting(true)
    try {
      const invite = await createOrganizationInvitation(selectedOrganizationId, email, role, workspaceSelections)
      const url = getShareableLink(invite.invite_token)
      setInviteUrl(url)

      // Send invite email via edge function (non-blocking — link shown regardless)
      try {
        const inviterName =
          user?.user_metadata?.full_name ||
          user?.user_metadata?.name ||
          user?.email ||
          'A teammate'

        await supabase.functions.invoke('send-org-invite', {
          body: {
            inviteeEmail: email,
            inviterName,
            orgName: selectedOrganizationName,
            inviteUrl: url,
            role,
            context: 'organization',
          },
        })
        toast.success(`Invitation sent to ${email}`)
      } catch {
        // Email sending is best-effort; the invite link is still valid
        toast.success(`Invite created for ${email}`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create invitation')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCopy = useCallback(async () => {
    if (!inviteUrl) return
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch {
      toast.error('Failed to copy to clipboard')
    }
  }, [inviteUrl])

  const handleReset = () => {
    setEmail('')
    setInviteUrl(null)
    setIsCopied(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RiUserAddLine className="h-5 w-5 text-vibe-orange" />
            Invite to {selectedOrganizationName}
          </DialogTitle>
          <DialogDescription>
            Invite teammates to join this organization, then choose which workspaces they get access to.
          </DialogDescription>
        </DialogHeader>

        {/* Warn if org still has default name */}
        {selectedOrganizationName === 'Personal' && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-vibe-orange/5 border border-vibe-orange/20">
            <RiAlertLine className="h-4 w-4 text-vibe-orange shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Your organization is still named "Personal." Members will see this name when they switch organizations. <strong className="text-foreground">Rename it first</strong> in Organization → Overview so it's clear what they're joining.
            </p>
          </div>
        )}

        {isTeamMemberLimitReached && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-vibe-orange/5 border border-vibe-orange/20">
            <RiAlertLine className="h-4 w-4 text-vibe-orange shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-medium text-foreground">
                Team member limit reached
              </p>
              <p className="text-xs text-muted-foreground">
                This plan includes up to {memberLimit} members. Contact support to upgrade beyond Team.
              </p>
              <a
                href={supportHref}
                className="inline-flex text-xs font-medium text-vibe-orange hover:underline"
              >
                Contact support
              </a>
            </div>
          </div>
        )}

        {!inviteUrl ? (
          <form onSubmit={handleSendInvite} className="space-y-4 py-4">
            {organizationOptions.length > 1 && (
              <div className="space-y-2">
                <Label htmlFor="organization">Organization</Label>
                <Select
                  value={selectedOrganizationId}
                  onValueChange={(value) => {
                    setSelectedOrganizationId(value)
                    setInviteUrl(null)
                    setIsCopied(false)
                  }}
                >
                  <SelectTrigger id="organization">
                    <SelectValue placeholder="Select an organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizationOptions.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <RiMailLine className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  className="pl-9"
                  autoComplete="off"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setShowSuggestions(true)
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setShowSuggestions(false)}
                  required
                />
                {showSuggestions && (
                  <ContactSuggestions
                    query={email}
                    suggestions={contactSuggestions}
                    onSelect={(selectedEmail) => {
                      setEmail(selectedEmail)
                      setShowSuggestions(false)
                    }}
                  />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={role}
                onValueChange={(value) => setRole(value as 'organization_admin' | 'organization_member')}
              >
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="organization_member">Member (Can view all calls)</SelectItem>
                  <SelectItem value="organization_admin">Admin (Can manage members)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {organizationWorkspaces.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Workspace access</Label>
                  <label className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground cursor-pointer">
                    <Checkbox
                      checked={allWorkspacesSelected}
                      onCheckedChange={(checked) => handleToggleAllWorkspaces(checked === true)}
                      aria-label="Select all workspaces"
                    />
                    Select all
                  </label>
                </div>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-border/50 divide-y divide-border/40">
                  {organizationWorkspaces.map((ws) => {
                    const checked = selectedWorkspaceIds.has(ws.id)
                    return (
                      <div key={ws.id} className="flex items-center gap-2.5 px-3 py-2">
                        <Checkbox
                          id={`org-invite-ws-${ws.id}`}
                          checked={checked}
                          onCheckedChange={(value) => handleToggleWorkspace(ws.id, value === true)}
                          aria-label={`Grant access to ${ws.name}`}
                        />
                        <label htmlFor={`org-invite-ws-${ws.id}`} className="flex-1 min-w-0 text-sm truncate cursor-pointer">
                          {ws.name}
                        </label>
                        {checked && (
                          <Select
                            value={getWorkspaceRole(ws.id)}
                            onValueChange={(v) =>
                              setWorkspaceRoleOverrides((prev) => ({ ...prev, [ws.id]: v as WorkspaceInviteRole }))
                            }
                          >
                            <SelectTrigger className="h-7 w-[124px] text-xs" aria-label={`Role for ${ws.name}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="member">Member</SelectItem>
                              <SelectItem value="contributor">Contributor</SelectItem>
                              <SelectItem value="workspace_admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    )
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Only the checked workspaces will be visible to this member. You can change this later from Organization → Members.
                </p>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="hollow"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || isTeamMemberLimitReached}>
                {isSubmitting ? 'Creating...' : 'Create Invite Link'}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-6 py-4">
            <div className="p-4 rounded-lg bg-success-bg/10 border border-success-border/20 flex items-start gap-3">
              <div className="h-2 w-2 rounded-full bg-success-text mt-1.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-success-text">Invite link generated!</p>
                <p className="text-xs text-muted-foreground">
                  Share this link with <strong>{email}</strong>. This link expires in 7 days.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Shareable Link</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <RiLinkM className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    readOnly
                    value={inviteUrl}
                    className="pl-9 bg-muted/50 font-mono text-xs"
                  />
                </div>
                <Button variant="outline" size="icon" onClick={handleCopy} className="flex-shrink-0">
                  {isCopied ? (
                    <RiCheckLine className="h-4 w-4 text-success-text" />
                  ) : (
                    <RiFileCopyLine className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button variant="ghost" className="text-xs" onClick={handleReset}>
                Invite another person
              </Button>
              <Button onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
