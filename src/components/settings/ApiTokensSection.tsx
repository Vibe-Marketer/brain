/**
 * ApiTokensSection
 *
 * Settings section for generating and managing CallVault REST API tokens.
 * These tokens authenticate integrations with the CallVault REST API
 * (api.callvaultai.com/v1/*).
 *
 * Pattern: token-reveal pattern consistent with MCPTab — raw token shown exactly once.
 * UI Contract: Phase 06.2 UI-SPEC.md — approved 2026-06-09.
 *
 * Security (T-06.2-02): token metadata only in list; raw token never re-exposed after creation.
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
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
  RiAddLine,
  RiCheckLine,
  RiDeleteBinLine,
  RiDownloadLine,
  RiFileCopyLine,
  RiKey2Line,
  RiTimeLine,
} from '@remixicon/react'
import { toast } from 'sonner'
import { useApiTokensList, useGenerateApiToken, useRevokeApiToken } from '@/hooks/useApiTokens'
import { useOrganizations } from '@/hooks/useOrganizations'
import { exportToObsidian } from '@/lib/export-utils'
import {
  fetchAllCallsForObsidianExport,
  type GeneratedApiToken,
  type ApiToken,
} from '@/services/api-tokens.service'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatLastUsed(lastUsedAt: string | null): string {
  if (!lastUsedAt) return 'Never'
  const date = new Date(lastUsedAt)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays <= 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 30) return `${diffDays} days ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatCreated(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ─── CopyButton ───────────────────────────────────────────────────────────────

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy to clipboard')
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 gap-1 text-xs">
      {copied ? (
        <RiCheckLine className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <RiFileCopyLine className="h-3.5 w-3.5" />
      )}
      {copied ? 'Copied!' : label}
    </Button>
  )
}

// ─── Token reveal box ─────────────────────────────────────────────────────────

function TokenRevealBox({ token }: { token: GeneratedApiToken }) {
  return (
    <div className="rounded-md border border-amber-500/40 bg-amber-50/60 dark:bg-amber-950/20 p-4 space-y-3">
      <div className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
        <span className="text-xs font-semibold leading-5">
          Copy your API token now — it won't be shown again.
        </span>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">
            This token is shown once. Store it somewhere secure before closing this message.
          </Label>
          <CopyButton text={token.token} label="Copy token" />
        </div>
        <div className="rounded-md bg-background border border-border p-3 font-mono text-xs break-all select-all">
          {token.token}
        </div>
      </div>
    </div>
  )
}

// ─── Token row ────────────────────────────────────────────────────────────────

function TokenRow({
  token,
  onRevoke,
}: {
  token: ApiToken
  onRevoke: (token: ApiToken) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-border/60 last:border-b-0">
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate">{token.name}</span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground/60 bg-muted/60 rounded px-1.5 py-0.5">
            {token.scope}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>Created {formatCreated(token.created_at)}</span>
          <span className="flex items-center gap-1">
            <RiTimeLine className="h-3 w-3" />
            Last used: {formatLastUsed(token.last_used_at)}
          </span>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onRevoke(token)}
        className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 gap-1 text-xs shrink-0"
        aria-label={`Revoke token ${token.name}`}
      >
        <RiDeleteBinLine className="h-3.5 w-3.5" />
        Revoke
      </Button>
    </div>
  )
}

// ─── Generate form ────────────────────────────────────────────────────────────

function GenerateForm({
  orgId,
  onGenerated,
}: {
  orgId: string
  onGenerated: (token: GeneratedApiToken) => void
}) {
  const [name, setName] = useState('')
  const generateToken = useGenerateApiToken({ onSuccess: onGenerated })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('Token name is required')
      return
    }
    generateToken.mutate({ org_id: orgId, name: trimmed })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="api-token-name" className="text-sm">
          Token name
        </Label>
        <Input
          id="api-token-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Obsidian Plugin, My Script"
          maxLength={50}
          autoComplete="off"
          className="max-w-sm"
        />
        <p className="text-xs text-muted-foreground">
          A label so you can identify and revoke this token later.
        </p>
      </div>
      <Button
        type="submit"
        size="sm"
        disabled={generateToken.isPending || !name.trim()}
        className="gap-1.5"
      >
        {generateToken.isPending ? (
          'Generating...'
        ) : (
          <>
            <RiAddLine className="h-3.5 w-3.5" />
            Generate API token
          </>
        )}
      </Button>
    </form>
  )
}

// ─── Main section ─────────────────────────────────────────────────────────────

export default function ApiTokensSection() {
  const { data: orgs = [], isLoading: orgsLoading } = useOrganizations()
  const { tokens, isLoading: tokensLoading } = useApiTokensList()
  const revokeToken = useRevokeApiToken()

  const [newlyGeneratedToken, setNewlyGeneratedToken] = useState<GeneratedApiToken | null>(null)
  const [showGenerateForm, setShowGenerateForm] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<ApiToken | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  // Use the first org by default (same pattern as MCPTab)
  const defaultOrgId = orgs[0]?.id ?? ''
  const orgName = orgs[0]?.name ?? 'My Organization'

  const handleExportAll = async () => {
    if (!defaultOrgId) return
    try {
      setIsExporting(true)
      const calls = await fetchAllCallsForObsidianExport(defaultOrgId)
      if (calls.length === 0) {
        toast.info('No calls to export')
        return
      }
      await exportToObsidian(calls, orgName)
      toast.success(`Exported ${calls.length} calls to Obsidian ZIP`)
    } catch {
      toast.error('Export failed — please try again')
    } finally {
      setIsExporting(false)
    }
  }

  const handleGenerated = (token: GeneratedApiToken) => {
    setNewlyGeneratedToken(token)
    setShowGenerateForm(false)
  }

  const handleRevoke = (token: ApiToken) => {
    setRevokeTarget(token)
  }

  const handleConfirmRevoke = () => {
    if (!revokeTarget) return
    revokeToken.mutate(revokeTarget.id, {
      onSettled: () => setRevokeTarget(null),
    })
  }

  const isLoading = orgsLoading || tokensLoading

  return (
    <>
      <Separator className="mb-12" />

      <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
        {/* Left column — description */}
        <div>
          <h2 className="flex items-center gap-2 font-montserrat font-extrabold uppercase tracking-wide text-sm text-foreground">
            <RiKey2Line className="h-4 w-4 shrink-0" />
            API Tokens
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate tokens to authenticate integrations with the CallVault REST API.
            Use your token as the bearer credential in <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">Authorization: Bearer &lt;token&gt;</code>.
          </p>
        </div>

        {/* Right column — content */}
        <div className="lg:col-span-2 space-y-6">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-9 w-40" />
            </div>
          ) : !defaultOrgId ? (
            <p className="text-sm text-muted-foreground">
              You need to be part of an organization to generate an API token.
            </p>
          ) : (
            <>
              {/* Obsidian one-click export (client-side utility, no token required) */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-0.5">
                  Export vault
                </p>
                <div className="rounded-md border border-border/60 bg-card px-4 py-4 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Download all calls as a browser-generated Obsidian ZIP. Drop it into your vault
                    root and the CallVault/ folder is created automatically.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportAll}
                    disabled={isExporting}
                    className="gap-1.5"
                  >
                    {isExporting ? (
                      'Exporting...'
                    ) : (
                      <>
                        <RiDownloadLine className="h-3.5 w-3.5" />
                        Download all calls
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Newly generated token reveal (shown once — T-06.2-02) */}
              {newlyGeneratedToken && (
                <div className="space-y-3">
                  <TokenRevealBox token={newlyGeneratedToken} />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setNewlyGeneratedToken(null)}
                    className="text-xs"
                  >
                    Done — I've saved my token
                  </Button>
                </div>
              )}

              {/* Active tokens list */}
              {tokens.length > 0 && (
                <div className="rounded-md border border-border/60 divide-y-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 px-0.5">
                    Active tokens
                  </p>
                  <div className="rounded-md border border-border/60 bg-card px-4">
                    {tokens.map((token) => (
                      <TokenRow key={token.id} token={token} onRevoke={handleRevoke} />
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {tokens.length === 0 && !newlyGeneratedToken && !showGenerateForm && (
                <p className="text-sm text-muted-foreground">No API tokens yet</p>
              )}

              {/* Generate button / form */}
              {!newlyGeneratedToken && (
                <>
                  {showGenerateForm ? (
                    <div className="rounded-md border border-border/60 bg-muted/20 p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">New API token</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowGenerateForm(false)}
                          className="text-xs h-7"
                        >
                          Cancel
                        </Button>
                      </div>
                      <GenerateForm orgId={defaultOrgId} onGenerated={handleGenerated} />
                    </div>
                  ) : (
                    <Button
                      variant={tokens.length === 0 ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setShowGenerateForm(true)}
                      className="gap-1.5"
                    >
                      <RiAddLine className="h-3.5 w-3.5" />
                      {tokens.length === 0 ? 'Generate API token' : 'Generate another token'}
                    </Button>
                  )}
                </>
              )}
            </>
          )}

          {/* Obsidian setup instructions */}
          <details className="group rounded-md border border-border/60 bg-card">
            <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium select-none">
              <span>Obsidian setup instructions</span>
              <span className="text-muted-foreground text-xs group-open:hidden">Show</span>
              <span className="text-muted-foreground text-xs hidden group-open:block">Hide</span>
            </summary>
            <div className="px-4 pb-4 space-y-3 text-sm text-muted-foreground border-t border-border/60 pt-3">
              <ol className="list-decimal list-inside space-y-2">
                <li>
                  Generate a CallVault API token above.
                </li>
                <li>
                  Install the CallVault Obsidian plugin:{' '}
                  <a
                    href="obsidian://show-plugin?id=callvault"
                    className="text-foreground underline underline-offset-2 hover:no-underline"
                  >
                    Open in Obsidian
                  </a>
                </li>
                <li>
                  In Obsidian: Settings &rarr; CallVault &rarr; paste your API token
                </li>
                <li>
                  Configure your sync folder and interval (default: <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">CallVault/</code> folder, every 15 min)
                </li>
                <li>
                  First sync imports all calls; subsequent syncs import only new calls
                </li>
              </ol>
            </div>
          </details>
        </div>
      </div>

      {/* Revoke confirmation dialog */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API token?</AlertDialogTitle>
            <AlertDialogDescription>
              Revoking <strong>{revokeTarget?.name}</strong> immediately blocks integrations that use it.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRevoke}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke token
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
