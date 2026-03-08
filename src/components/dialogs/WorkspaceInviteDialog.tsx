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
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

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
  const [role, setRole] = useState<'member' | 'manager' | 'workspace_admin'>('member')
  const [isSubmitting, setIsSubmitting] = useState(false)

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
    } catch {}
  }, [generateInvite])

  const handleRegenerate = useCallback(async () => {
    setInviteUrl(null)
    setIsCopied(false)
    try {
      const result = await generateInvite.mutateAsync({ force: true })
      setInviteUrl(result.invite_url)
      setExpiresAt(result.invite_expires_at)
    } catch {}
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
      const invite = await createInvitation(workspaceId, user.id, email, role as any)
      const link = `${window.location.origin}/join/workspace/${invite.token}`
      
      // In a real app, we'd send an email here. 
      // For now, we'll just show the link and success message.
      toast.success(`Invitation created for ${email}`)
      onOpenChange(false)
      // Optionally show a "success" state with the specific token/link
    } catch (err: any) {
      toast.error(err.message || 'Failed to send invite')
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
            Invite others to collaborate in this hub.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="py-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="link">Shareable Link</TabsTrigger>
            <TabsTrigger value="email">Email Invite</TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="pt-4 space-y-6">
            {!inviteUrl ? (
              <div className="flex flex-col items-center justify-center py-6 px-4 text-center border-2 border-dashed border-border rounded-xl bg-muted/20">
                <RiLinkM className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <h4 className="text-sm font-semibold mb-1">Generate an invite link</h4>
                <p className="text-xs text-muted-foreground mb-4 max-w-[240px]">
                  Anyone with the link will be able to join as a member.
                </p>
                <Button size="sm" onClick={handleGenerate} disabled={generateInvite.isPending}>
                  {generateInvite.isPending ? 'Generating...' : 'Create Link'}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Share Link</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={inviteUrl} className="font-mono text-xs bg-muted/50" />
                    <Button variant="outline" size="icon" onClick={handleCopy}>
                      {isCopied ? <RiCheckLine className="h-4 w-4 text-success-text" /> : <RiFileCopyLine className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-info-bg/10 border border-info-border/20">
                  <div className="flex items-center gap-2 text-xs text-info-text">
                    <RiTimeLine className="h-3.5 w-3.5" />
                    <span>Expires in {expiresInDays} days</span>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-[10px] uppercase font-bold text-muted-foreground" onClick={handleRegenerate}>
                    <RiRefreshLine className="h-3 w-3 mr-1" />
                    Regenerate
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="email" className="pt-4 space-y-4">
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
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={role} onValueChange={(v: any) => setRole(v)}>
                  <SelectTrigger id="role focus:ring-vibe-orange">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member (Can view/add calls)</SelectItem>
                    <SelectItem value="manager">Manager (Can manage folders)</SelectItem>
                    <SelectItem value="workspace_admin">Hub Admin (Can manage members)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-2">
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Invite Person'}
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>

        <DialogFooter className="border-t border-border/40 pt-4 mt-2">
          <div className="flex-1 flex items-center gap-2 text-[10px] text-muted-foreground">
            <RiInformationLine className="h-3 w-3" />
            <span>Invited members will see all calls available in this hub.</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
