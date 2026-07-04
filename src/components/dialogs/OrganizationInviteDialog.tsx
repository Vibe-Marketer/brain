import { useState, useCallback, useEffect } from 'react'
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
  RiLinkM,
  RiFileCopyLine,
  RiCheckLine,
  RiUserAddLine,
  RiMailLine,
  RiAlertLine,
} from '@remixicon/react'
import { toast } from 'sonner'
import { createOrganizationInvitation, getShareableLink } from '@/services/organization-invitations.service'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'
import { useContactSuggestions } from '@/hooks/useContactSuggestions'
import { ContactSuggestions } from '@/components/contacts/ContactSuggestions'
import { useSubscription, TEAM_MEMBER_LIMIT } from '@/hooks/useSubscription'

interface OrganizationInviteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
  organizationName: string
  seatsUsed?: number
  memberLimit?: number
  initialEmail?: string
}

export function OrganizationInviteDialog({
  open,
  onOpenChange,
  organizationId,
  organizationName,
  seatsUsed = 0,
  memberLimit = TEAM_MEMBER_LIMIT,
  initialEmail = '',
}: OrganizationInviteDialogProps) {
  const { user } = useAuth()
  const { tier } = useSubscription()
  const [email, setEmail] = useState(initialEmail)
  const [role, setRole] = useState<'organization_admin' | 'organization_member'>('organization_member')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [isCopied, setIsCopied] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const contactSuggestions = useContactSuggestions()
  const isTeamMemberLimitReached = tier === 'team' && seatsUsed >= memberLimit
  const supportHref = `mailto:support@callvault.ai?subject=${encodeURIComponent('Add seats to CallVault Team plan')}`

  useEffect(() => {
    if (open) {
      setEmail(initialEmail)
      setInviteUrl(null)
      setIsCopied(false)
    }
  }, [initialEmail, open])

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    if (isTeamMemberLimitReached) {
      toast.error('Team member limit reached', {
        description: `Team includes up to ${memberLimit} members. Contact support to upgrade beyond Team.`,
      })
      return
    }

    setIsSubmitting(true)
    try {
      const invite = await createOrganizationInvitation(organizationId, email, role)
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
            orgName: organizationName,
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
            Invite to {organizationName}
          </DialogTitle>
          <DialogDescription>
            Invite teammates to join this organization. They will have access to all public workspaces within the organization.
          </DialogDescription>
        </DialogHeader>

        {/* Warn if org still has default name */}
        {organizationName === 'Personal' && (
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
