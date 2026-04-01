import { useState, useCallback, useMemo } from 'react'
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
  RiRefreshLine,
  RiTimeLine,
  RiCloseLine,
  RiInformationLine,
  RiMailLine,
  RiGroupLine,
  RiUserAddLine,
} from '@remixicon/react'
import { useGenerateWorkspaceInvite } from '@/hooks/useWorkspaceMemberMutations'
import { createInvitation } from '@/services/invitations.service'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
// Tabs removed — both sections shown inline
import { useContactSuggestions } from '@/hooks/useContactSuggestions'
import { ContactSuggestions } from '@/components/contacts/ContactSuggestions'

interface WorkspaceInviteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  workspaceName: string
}

export function WorkspaceInviteDialog({
  open,
  onOpenChange,
  workspaceId,
  workspaceName,
}: WorkspaceInviteDialogProps) {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'link' | 'email'>('link')

  // Link State
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [isCopied, setIsCopied] = useState(false)

  // Email State
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'member' | 'contributor' | 'workspace_admin'>('member')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const contactSuggestions = useContactSuggestions()

  const generateInvite = useGenerateWorkspaceInvite(workspaceId)

  const expiresInDays = useMemo(() => {
    if (!expiresAt) return null
    const msRemaining = new Date(expiresAt).getTime() - Date.now()
    return Math.max(1, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)))
  }, [expiresAt])

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

    setIsSubmitting(true)
    try {
      const invite = await createInvitation(workspaceId, user.id, email, role)
      const link = `${window.location.origin}/join/workspace/${invite.token}`

      // Send invite email via edge function (non-blocking)
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
            orgName: workspaceName,
            inviteUrl: link,
            role,
            context: 'workspace',
          },
        })
        toast.success(`Invitation sent to ${email}`)
      } catch {
        // Email sending is best-effort; the invite record is still created
        toast.success(`Invitation created for ${email}`)
      }

      onOpenChange(false)
    } catch (err: unknown) {
      if (err instanceof Error) { toast.error(err.message) } else { toast.error('Failed to send invite') }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RiGroupLine className="h-5 w-5 text-vibe-orange" />
            Invite to {workspaceName}
          </DialogTitle>
          <DialogDescription>
            Invite others to collaborate in this workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-6">
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
                <Button size="sm" onClick={handleGenerate} disabled={generateInvite.isPending}>
                  {generateInvite.isPending ? 'Generating...' : 'Create Link'}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input readOnly value={inviteUrl} className="font-mono text-xs bg-muted/50" />
                  <Button variant="hollow" size="icon" onClick={handleCopy}>
                    {isCopied ? <RiCheckLine className="h-4 w-4 text-emerald-500" /> : <RiFileCopyLine className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={handleRegenerate} title="Regenerate link">
                    <RiRefreshLine className="h-4 w-4" />
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

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as 'member' | 'contributor' | 'workspace_admin')}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member (Read and organize)</SelectItem>
                  <SelectItem value="contributor">Contributor (Add and route calls)</SelectItem>
                  <SelectItem value="workspace_admin">Admin (Manage members and settings)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              <RiUserAddLine className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Sending...' : 'Send Invite'}
            </Button>
          </form>
        </div>

        <DialogFooter className="border-t border-border/40 pt-4 mt-2">
          <div className="flex-1 flex items-center gap-2 text-[10px] text-muted-foreground">
            <RiInformationLine className="h-3 w-3" />
            <span>Invited members will see all calls available in this workspace.</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
