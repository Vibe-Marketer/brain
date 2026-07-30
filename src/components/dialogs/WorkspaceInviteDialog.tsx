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
  RiRefreshLine,
  RiTimeLine,
  RiInformationLine,
  RiMailLine,
  RiGroupLine,
  RiUserAddLine,
  RiCloseCircleLine,
  RiErrorWarningLine,
} from '@remixicon/react'
import { useGenerateWorkspaceInvite } from '@/hooks/useWorkspaceMemberMutations'
import { useOrganizationWorkspaces } from '@/hooks/useWorkspaces'
import { createInvitation } from '@/services/invitations.service'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
// Tabs removed — both sections shown inline
import { useContactSuggestions } from '@/hooks/useContactSuggestions'
import { ContactSuggestions } from '@/components/contacts/ContactSuggestions'

type EmailInviteRole = 'member' | 'contributor' | 'workspace_admin'

interface WorkspaceSubmitResult {
  status: 'success' | 'error'
  message?: string
}

interface WorkspaceInviteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  workspaceName: string
  organizationId?: string
  organizations?: Array<{ id: string; name: string }>
  initialEmail?: string
}

export function WorkspaceInviteDialog({
  open,
  onOpenChange,
  workspaceId,
  workspaceName,
  organizationId,
  organizations = [],
  initialEmail = '',
}: WorkspaceInviteDialogProps) {
  const { user } = useAuth()
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(organizationId ?? '')
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(workspaceId)

  // Link State
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [isCopied, setIsCopied] = useState(false)

  // Email State
  const [email, setEmail] = useState(initialEmail)
  const [role, setRole] = useState<EmailInviteRole>('member')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const contactSuggestions = useContactSuggestions()
  const organizationOptions = organizations
  const { workspaces: organizationWorkspaces, isLoading: workspacesLoading } = useOrganizationWorkspaces(
    selectedOrganizationId || null
  )
  const shouldUseOrganizationWorkspaces = !!selectedOrganizationId && organizationOptions.length > 0
  const workspaceOptions = useMemo(() => {
    if (shouldUseOrganizationWorkspaces || organizationWorkspaces.length > 0) {
      return organizationWorkspaces.map((workspace) => ({ id: workspace.id, name: workspace.name }))
    }
    return [{ id: workspaceId, name: workspaceName }]
  }, [shouldUseOrganizationWorkspaces, organizationWorkspaces, workspaceId, workspaceName])
  const selectedWorkspace = workspaceOptions.find((workspace) => workspace.id === selectedWorkspaceId)
  const selectedWorkspaceName = selectedWorkspace?.name ?? workspaceName
  const showDestinationPicker = organizationOptions.length > 1 || workspaceOptions.length > 1

  // Bulk-add-to-workspaces state (email invite section only — the shareable
  // link above always targets a single workspace/token, so it keeps using
  // selectedWorkspaceId). Defaults to the workspace this dialog was opened
  // from; when the org has more than one workspace, the user can check
  // additional ones and a single "Role" selection is applied to all of them,
  // with per-workspace overrides available afterward.
  const [selectedWorkspaceIds, setSelectedWorkspaceIds] = useState<Set<string>>(() => new Set([workspaceId]))
  const [roleOverrides, setRoleOverrides] = useState<Record<string, EmailInviteRole>>({})
  const [submitResults, setSubmitResults] = useState<Record<string, WorkspaceSubmitResult>>({})
  const canBulkSelectWorkspaces = workspaceOptions.length > 1
  const allWorkspacesSelected = canBulkSelectWorkspaces && workspaceOptions.every((ws) => selectedWorkspaceIds.has(ws.id))

  const emailTargets = useMemo(
    () => workspaceOptions.filter((ws) => selectedWorkspaceIds.has(ws.id)),
    [workspaceOptions, selectedWorkspaceIds]
  )

  const getEffectiveRole = useCallback(
    (wsId: string): EmailInviteRole => roleOverrides[wsId] ?? role,
    [roleOverrides, role]
  )

  const handleToggleWorkspace = useCallback((wsId: string, checked: boolean) => {
    setSelectedWorkspaceIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(wsId)
      } else {
        next.delete(wsId)
      }
      return next
    })
    // Dropping a workspace clears any per-workspace override so a later
    // re-check falls back to the current global role, not a stale choice.
    if (!checked) {
      setRoleOverrides((prev) => {
        if (!(wsId in prev)) return prev
        const next = { ...prev }
        delete next[wsId]
        return next
      })
    }
    setSubmitResults((prev) => {
      if (!(wsId in prev)) return prev
      const next = { ...prev }
      delete next[wsId]
      return next
    })
  }, [])

  const handleToggleSelectAll = useCallback(
    (checked: boolean) => {
      setSelectedWorkspaceIds(checked ? new Set(workspaceOptions.map((ws) => ws.id)) : new Set())
      if (!checked) setRoleOverrides({})
      setSubmitResults({})
    },
    [workspaceOptions]
  )

  const handleOverrideRole = useCallback((wsId: string, newRole: EmailInviteRole) => {
    setRoleOverrides((prev) => ({ ...prev, [wsId]: newRole }))
  }, [])

  const generateInvite = useGenerateWorkspaceInvite(selectedWorkspaceId)

  useEffect(() => {
    if (open) {
      setSelectedOrganizationId(organizationId ?? '')
      setSelectedWorkspaceId(workspaceId)
      setEmail(initialEmail)
      setInviteUrl(null)
      setExpiresAt(null)
      setIsCopied(false)
      setSelectedWorkspaceIds(new Set([workspaceId]))
      setRoleOverrides({})
      setSubmitResults({})
    }
  }, [initialEmail, open, organizationId, workspaceId])

  useEffect(() => {
    if (!open || !selectedOrganizationId || workspacesLoading || organizationWorkspaces.length === 0) return
    if (organizationWorkspaces.some((workspace) => workspace.id === selectedWorkspaceId)) return

    setSelectedWorkspaceId(organizationWorkspaces[0].id)
    setInviteUrl(null)
    setExpiresAt(null)
    setIsCopied(false)
  }, [open, selectedOrganizationId, workspacesLoading, organizationWorkspaces, selectedWorkspaceId])

  const handleGenerate = useCallback(async () => {
    try {
      const result = await generateInvite.mutateAsync({})
      setInviteUrl(result.invite_url)
      setExpiresAt(result.invite_expires_at)
    } catch {
      // Mutation error handled by TanStack Query UI state
    }
  }, [generateInvite])

  const handleRegenerate = useCallback(async () => {
    setInviteUrl(null)
    setIsCopied(false)
    try {
      const result = await generateInvite.mutateAsync({ force: true })
      setInviteUrl(result.invite_url)
      setExpiresAt(result.invite_expires_at)
    } catch {
      // Mutation error handled by TanStack Query UI state
    }
  }, [generateInvite])

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

  const handleSendEmailInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !user) return
    const targets = emailTargets
    if (targets.length === 0) return

    setIsSubmitting(true)
    setSubmitResults({})

    const inviterName =
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      user?.email ||
      'A teammate'

    // Each target workspace gets its own invitation row + token — createInvitation
    // already de-dupes (reuses/refreshes a pending invite for the same
    // workspace+email, and rejects emails that already belong to that
    // workspace) so calling it once per selected workspace here is safe and
    // cannot create duplicate rows for the same workspace.
    const settled = await Promise.allSettled(
      targets.map(async (ws) => {
        const wsRole = getEffectiveRole(ws.id)
        const invite = await createInvitation(ws.id, user.id, email, wsRole)
        const link = `${window.location.origin}/join/workspace/${invite.token}`

        // Best-effort email notification — each workspace has a distinct
        // accept link, so a distinct email is sent per workspace. Failure
        // to send does not roll back the invitation record.
        try {
          await supabase.functions.invoke('send-org-invite', {
            body: {
              inviteeEmail: email,
              inviterName,
              orgName: ws.name,
              inviteUrl: link,
              role: wsRole,
              context: 'workspace',
            },
          })
        } catch {
          // Non-fatal — invite record still exists and link is still valid
        }
        return ws.id
      })
    )

    const results: Record<string, WorkspaceSubmitResult> = {}
    settled.forEach((result, index) => {
      const ws = targets[index]
      if (result.status === 'fulfilled') {
        results[ws.id] = { status: 'success' }
      } else {
        const message = result.reason instanceof Error ? result.reason.message : 'Failed to send invite'
        results[ws.id] = { status: 'error', message }
      }
    })
    setSubmitResults(results)
    setIsSubmitting(false)

    const successCount = Object.values(results).filter((r) => r.status === 'success').length
    const failCount = targets.length - successCount

    if (successCount > 0) {
      toast.success(
        targets.length === 1
          ? `Invitation sent to ${email}`
          : `Invited ${email} to ${successCount} of ${targets.length} workspaces`
      )
    }
    if (failCount > 0) {
      toast.error(
        failCount === 1
          ? `Failed to invite ${email} to 1 workspace`
          : `Failed to invite ${email} to ${failCount} workspaces`
      )
    } else {
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RiGroupLine className="h-5 w-5 text-vibe-orange" />
            Invite to {selectedWorkspaceName}
          </DialogTitle>
          <DialogDescription>
            Invite others to collaborate in this workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-6">
          {showDestinationPicker && (
            <div className="grid gap-3 sm:grid-cols-2">
              {organizationOptions.length > 1 && (
                <div className="space-y-2">
                  <Label htmlFor="invite-organization">Organization</Label>
                  <Select
                    value={selectedOrganizationId}
                    onValueChange={(value) => {
                      setSelectedOrganizationId(value)
                      setSelectedWorkspaceId('')
                      setInviteUrl(null)
                      setExpiresAt(null)
                      setIsCopied(false)
                    }}
                  >
                    <SelectTrigger id="invite-organization">
                      <SelectValue placeholder="Select organization" />
                    </SelectTrigger>
                    <SelectContent>
                      {organizationOptions.map((organization) => (
                        <SelectItem key={organization.id} value={organization.id}>
                          {organization.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="invite-workspace">Workspace</Label>
                <Select
                  value={selectedWorkspaceId}
                  onValueChange={(value) => {
                    setSelectedWorkspaceId(value)
                    setInviteUrl(null)
                    setExpiresAt(null)
                    setIsCopied(false)
                  }}
                  disabled={workspacesLoading}
                >
                  <SelectTrigger id="invite-workspace">
                    <SelectValue placeholder={workspacesLoading ? 'Loading...' : 'Select workspace'} />
                  </SelectTrigger>
                  <SelectContent>
                    {workspaceOptions.map((workspace) => (
                      <SelectItem key={workspace.id} value={workspace.id}>
                        {workspace.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Shareable Link Section */}
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Shareable Link
            </p>
            {!inviteUrl ? (
              <div className="flex items-center justify-between p-4 border border-dashed border-border rounded-xl bg-muted/20">
                <div className="flex items-center gap-3">
                  <RiLinkM className="h-5 w-5 text-muted-foreground/40" />
                  <div>
                    <p className="text-sm font-medium">Generate an invite link</p>
                    <p className="text-xs text-muted-foreground">Anyone with the link can join as a member</p>
                  </div>
                </div>
                <Button size="sm" onClick={handleGenerate} disabled={generateInvite.isPending || !selectedWorkspaceId}>
                  {generateInvite.isPending ? 'Generating...' : 'Create Link'}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input readOnly value={inviteUrl} className="font-mono text-xs bg-muted/50" />
                  <Button variant="hollow" size="icon" onClick={handleCopy}>
                    {isCopied ? <RiCheckLine className="h-4 w-4 text-emerald-500" /> : <RiFileCopyLine className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <RiTimeLine className="h-3.5 w-3.5" />
                    {expiresAt ? `Expires ${new Date(expiresAt).toLocaleDateString()}` : 'No expiration'}
                  </span>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] uppercase font-bold text-muted-foreground gap-1" onClick={handleRegenerate}>
                    <RiRefreshLine className="h-3 w-3" />
                    Rotate Link
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/50" /></div>
            <div className="relative flex justify-center"><span className="bg-card px-3 text-xs text-muted-foreground">or invite by email</span></div>
          </div>

          {/* Email Invite Section */}
          <form onSubmit={handleSendEmailInvite} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <RiMailLine className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="teammate@example.com"
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

            {canBulkSelectWorkspaces && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Add to workspaces</Label>
                  <label className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground cursor-pointer">
                    <Checkbox
                      checked={allWorkspacesSelected}
                      onCheckedChange={(checked) => handleToggleSelectAll(checked === true)}
                      aria-label="Select all workspaces"
                    />
                    Select all
                  </label>
                </div>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-border/50 divide-y divide-border/40">
                  {workspaceOptions.map((ws) => {
                    const checked = selectedWorkspaceIds.has(ws.id)
                    const result = submitResults[ws.id]
                    return (
                      <div key={ws.id} className="flex items-center gap-2.5 px-3 py-2">
                        <Checkbox
                          id={`ws-${ws.id}`}
                          checked={checked}
                          onCheckedChange={(value) => handleToggleWorkspace(ws.id, value === true)}
                          aria-label={`Add to ${ws.name}`}
                        />
                        <label htmlFor={`ws-${ws.id}`} className="flex-1 min-w-0 text-sm truncate cursor-pointer">
                          {ws.name}
                        </label>
                        {checked && (
                          <Select
                            value={getEffectiveRole(ws.id)}
                            onValueChange={(v) => handleOverrideRole(ws.id, v as EmailInviteRole)}
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
                        {result?.status === 'success' && (
                          <RiCheckLine className="h-4 w-4 text-emerald-500 flex-shrink-0" aria-label="Invited" />
                        )}
                        {result?.status === 'error' && (
                          <span title={result.message} className="flex-shrink-0">
                            <RiCloseCircleLine className="h-4 w-4 text-destructive" aria-label={result.message || 'Failed'} />
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
                {Object.values(submitResults).some((r) => r.status === 'error') && (
                  <div className="flex items-start gap-1.5 text-xs text-destructive">
                    <RiErrorWarningLine className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>
                      Some workspaces failed — hover the red icon for the reason. Re-submit to retry only the checked ones.
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="role">{canBulkSelectWorkspaces ? 'Default Role' : 'Role'}</Label>
              <Select value={role} onValueChange={(v) => setRole(v as EmailInviteRole)}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member (Read and organize)</SelectItem>
                  <SelectItem value="contributor">Contributor (Add and route calls)</SelectItem>
                  <SelectItem value="workspace_admin">Admin (Manage members and settings)</SelectItem>
                </SelectContent>
              </Select>
              {canBulkSelectWorkspaces && (
                <p className="text-[10px] text-muted-foreground">
                  Applied to every newly-checked workspace above. Override any workspace's role individually in the list.
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting || emailTargets.length === 0}>
              <RiUserAddLine className="h-4 w-4 mr-2" />
              {isSubmitting
                ? 'Sending...'
                : emailTargets.length > 1
                ? `Send ${emailTargets.length} Invites`
                : 'Send Invite'}
            </Button>
          </form>
        </div>

        <DialogFooter className="border-t border-border/40 pt-4 mt-2">
          <div className="flex-1 flex items-center gap-2 text-[10px] text-muted-foreground">
            <RiInformationLine className="h-3 w-3" />
            <span>
              {emailTargets.length > 1
                ? `Invited members will see all calls available in ${emailTargets.length} workspaces.`
                : 'Invited members will see all calls available in this workspace.'}
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
