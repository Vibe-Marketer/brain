/**
 * VaultInviteDialog - Generate and share vault invite links
 *
 * Follows the TeamInviteDialog pattern but simpler:
 * - Generate invite link (or show existing valid link)
 * - Copy to clipboard
 * - Show expiry date
 * - Regenerate link option
 *
 * Permission: Only vault_owner or vault_admin can generate/see invite link
 *
 * @pattern dialog
 * @brand-version v4.2
 */

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
import {
  RiLinkM,
  RiFileCopyLine,
  RiCheckLine,
  RiRefreshLine,
  RiTimeLine,
  RiCloseLine,
  RiInformationLine,
} from '@remixicon/react'
import { useGenerateVaultInvite } from '@/hooks/useVaultMemberMutations'

interface VaultInviteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vaultId: string
  vaultName: string
}

export function VaultInviteDialog({
  open,
  onOpenChange,
  vaultId,
  vaultName,
}: VaultInviteDialogProps) {
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [isCopied, setIsCopied] = useState(false)

  const generateInvite = useGenerateVaultInvite(vaultId)

  const expiresInDays = useMemo(() => {
    if (!expiresAt) return null
    const msRemaining = new Date(expiresAt).getTime() - Date.now()
    const daysRemaining = Math.max(1, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)))
    return daysRemaining
  }, [expiresAt])

  const handleGenerate = useCallback(async () => {
    try {
      const result = await generateInvite.mutateAsync({})
      setInviteUrl(result.invite_url)
      setExpiresAt(result.invite_expires_at)
    } catch {
      // Error handled by mutation's onError toast
    }
  }, [generateInvite])

  const handleRegenerate = useCallback(async () => {
    // Clear existing to force new token generation
    setInviteUrl(null)
    setIsCopied(false)
    try {
      const result = await generateInvite.mutateAsync({ force: true })
      setInviteUrl(result.invite_url)
      setExpiresAt(result.invite_expires_at)
    } catch {
      // Error handled by mutation's onError toast
    }
  }, [generateInvite])

  const handleCopy = useCallback(async () => {
    if (!inviteUrl) return
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = inviteUrl
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    }
  }, [inviteUrl])

  // Auto-generate on open
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (newOpen && !inviteUrl && !generateInvite.isPending) {
      handleGenerate()
    }
    if (!newOpen) {
      // Reset state on close
      setInviteUrl(null)
      setExpiresAt(null)
      setIsCopied(false)
    }
    onOpenChange(newOpen)
  }, [inviteUrl, generateInvite.isPending, handleGenerate, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RiLinkM className="h-5 w-5" />
            Invite to {vaultName}
          </DialogTitle>
          <DialogDescription>
            Share this link with anyone you want to invite. They'll join as a member.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Link display + copy */}
          {generateInvite.isPending ? (
            <div className="flex items-center justify-center py-6">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="ml-2 text-sm text-muted-foreground">Generating link...</span>
            </div>
          ) : inviteUrl ? (
            <>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={inviteUrl}
                  className="text-sm font-mono"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button
                  variant="hollow"
                  size="sm"
                  onClick={handleCopy}
                  className="flex-shrink-0"
                  aria-label={isCopied ? 'Copied!' : 'Copy link'}
                >
                  {isCopied ? (
                    <>
                      <RiCheckLine className="h-4 w-4 mr-1 text-green-600" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <RiFileCopyLine className="h-4 w-4 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              </div>

              {/* Expiry info */}
              {expiresAt && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <RiTimeLine className="h-3.5 w-3.5" />
                  <span>
                    Expires in {expiresInDays ?? 7} {expiresInDays === 1 ? 'day' : 'days'} ({new Date(expiresAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })})
                  </span>
                </div>
              )}

              {/* Info note */}
              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-3">
                <RiInformationLine className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>
                  Anyone with this link can join as a member. You can change their role after they join.
                </span>
              </div>

              {/* Regenerate */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRegenerate}
                disabled={generateInvite.isPending}
                className="text-xs text-muted-foreground"
              >
                <RiRefreshLine className="h-3.5 w-3.5 mr-1" />
                Regenerate Link
              </Button>
            </>
          ) : (
            <div className="text-center py-6 text-sm text-muted-foreground">
              Failed to generate link. Please try again.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="hollow" onClick={() => onOpenChange(false)}>
            <RiCloseLine className="h-4 w-4 mr-2" />
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default VaultInviteDialog
