import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
  RiBuilding2Line,
  RiCheckLine,
  RiDeleteBinLine,
  RiFileCopyLine,
  RiLockLine,
  RiRefreshLine,
  RiRobot2Line,
  RiSettings3Line,
  RiTimeLine,
} from '@remixicon/react'
import { toast } from 'sonner'
import { UpgradeButton } from '@/components/billing/UpgradeButton'
import { useMcpOAuthGrantsList, useRevokeMcpOAuthGrant } from '@/hooks/useMcpOAuthGrants'
import { useSetMcpTokenCategories } from '@/hooks/useMcpTokenCapabilities'
import { useCreateMcpToken, useDeleteMcpToken, useMcpTokensList, useRegenerateMcpToken } from '@/hooks/useMcpTokens'
import { POLAR_PRODUCT_IDS, useSubscription } from '@/hooks/useSubscription'
import { useOrganizations } from '@/hooks/useOrganizations'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import {
  type McpManualTokenConnection,
  type McpToken,
  type McpTokenScope,
  buildScopedMcpUrl,
  getMcpUrl,
  toManualTokenConnection,
} from '@/services/mcp-tokens.service'
import { TOOL_CATEGORY_DESCRIPTIONS, type ToolCategory } from '@/lib/mcp-tool-categories'

const ALL_CATEGORIES: ToolCategory[] = ['read', 'write', 'ai', 'admin']

function formatCategoryLabel(category: ToolCategory): string {
  return category === 'ai' ? 'AI' : category.charAt(0).toUpperCase() + category.slice(1)
}

function formatLastUsed(lastUsedAt: string | null): string {
  if (!lastUsedAt) return 'Never used'
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

function deriveToggleState(value: ToolCategory[] | null | undefined): Record<ToolCategory, boolean> {
  if (value === null || value === undefined) {
    return { read: true, write: true, ai: true, admin: true }
  }
  return {
    read: value.includes('read'),
    write: value.includes('write'),
    ai: value.includes('ai'),
    admin: value.includes('admin'),
  }
}

function nextValueFromToggles(state: Record<ToolCategory, boolean>): ToolCategory[] | null {
  const enabled = ALL_CATEGORIES.filter((category) => state[category])
  return enabled.length === ALL_CATEGORIES.length ? null : enabled
}

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
      {copied ? <RiCheckLine className="h-3.5 w-3.5 text-green-500" /> : <RiFileCopyLine className="h-3.5 w-3.5" />}
      {copied ? 'Copied!' : label}
    </Button>
  )
}

function PermissionsPanel({ token }: { token: McpToken }) {
  const setCategories = useSetMcpTokenCategories()
  const toggleState = deriveToggleState(token.enabled_categories)

  const handleToggle = (category: ToolCategory, next: boolean) => {
    const newState: Record<ToolCategory, boolean> = { ...toggleState, [category]: next }
    setCategories.mutate({ tokenId: token.id, value: nextValueFromToggles(newState) })
  }

  return (
    <div className="bg-muted/30 px-4 py-4 space-y-3">
      {ALL_CATEGORIES.map((category) => (
        <div key={category} className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-foreground">{formatCategoryLabel(category)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{TOOL_CATEGORY_DESCRIPTIONS[category]}</div>
          </div>
          <Switch
            checked={toggleState[category]}
            onCheckedChange={(next) => handleToggle(category, next)}
            disabled={setCategories.isPending}
            aria-label={`Toggle ${category} category for token ${token.name}`}
          />
        </div>
      ))}
    </div>
  )
}

function OAuthConnectionRow({
  grant,
  onRevoke,
}: {
  grant: {
    id: string
    client_name: string
    scope: 'organization' | 'workspace'
    org_name: string
    workspace_name: string
    endpoint_url: string
    categories_summary: string
    last_used_at: string | null
    created_at: string
  }
  onRevoke: (id: string, name: string) => void
}) {
  return (
    <div className="px-4 py-4 flex items-start gap-4">
      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <RiRobot2Line className="h-4.5 w-4.5 text-primary" />
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{grant.client_name}</span>
          <Badge variant="secondary" className="text-xs">OAuth</Badge>
          <Badge variant={grant.scope === 'workspace' ? 'outline' : 'default'} className="text-xs">
            {grant.scope === 'workspace' ? 'Workspace' : 'Organization'}
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1"><RiBuilding2Line className="h-3 w-3" />{grant.scope === 'workspace' ? grant.workspace_name : grant.org_name}</span>
          <span className="flex items-center gap-1"><RiTimeLine className="h-3 w-3" />{formatLastUsed(grant.last_used_at)}</span>
          <span>Created {formatCreated(grant.created_at)}</span>
        </div>
        <div className="text-xs text-muted-foreground">Categories: {grant.categories_summary}</div>
        <div className="flex items-center gap-2">
          <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono break-all">{grant.endpoint_url}</code>
          <CopyButton text={grant.endpoint_url} label="Copy URL" />
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-destructive flex-shrink-0"
        aria-label={`Revoke AI client ${grant.client_name}`}
        onClick={() => onRevoke(grant.id, grant.client_name)}
      >
        <RiDeleteBinLine className="h-4 w-4" />
      </Button>
    </div>
  )
}

function ManualTokenRow({
  token,
  onDelete,
  onRegenerate,
}: {
  token: McpManualTokenConnection
  onDelete: (id: string, name: string) => void
  onRegenerate: (id: string, name: string) => void
}) {
  const [permsOpen, setPermsOpen] = useState(false)

  return (
    <Collapsible open={permsOpen} onOpenChange={setPermsOpen}>
      <div className="px-4 py-4 flex items-start gap-4">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <RiSettings3Line className="h-4.5 w-4.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{token.name}</span>
            <Badge variant="outline" className="text-xs">Manual token</Badge>
            <Badge variant={token.scope === 'workspace' ? 'outline' : 'default'} className="text-xs">{token.scope_label}</Badge>
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1"><RiTimeLine className="h-3 w-3" />{formatLastUsed(token.last_used_at)}</span>
            <span>Created {formatCreated(token.created_at)}</span>
          </div>
          <div className="text-xs text-muted-foreground">Categories: {token.categories_summary}</div>
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{token.token_preview}</code>
            <CopyButton text={token.token} label="Copy token" />
            <CopyButton text={token.endpoint_url} label="Copy URL" />
          </div>
        </div>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-primary flex-shrink-0"
            aria-label={`Toggle permissions for ${token.name}`}
            aria-expanded={permsOpen}
          >
            <RiSettings3Line className="h-4 w-4" />
          </Button>
        </CollapsibleTrigger>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-primary flex-shrink-0"
          aria-label={`Regenerate token ${token.name}`}
          onClick={() => onRegenerate(token.id, token.name)}
        >
          <RiRefreshLine className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive flex-shrink-0"
          aria-label={`Delete token ${token.name}`}
          onClick={() => onDelete(token.id, token.name)}
        >
          <RiDeleteBinLine className="h-4 w-4" />
        </Button>
      </div>
      <CollapsibleContent>
        <PermissionsPanel token={token} />
      </CollapsibleContent>
    </Collapsible>
  )
}

interface NewTokenDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (token: McpToken) => void
  existingTokens: McpToken[]
}

function NewTokenDialog({ open, onOpenChange, onCreated, existingTokens }: NewTokenDialogProps) {
  const [name, setName] = useState('My MCP Token')
  const [scope, setScope] = useState<McpTokenScope>('workspace')
  const [selectedOrgId, setSelectedOrgId] = useState<string>('')
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('')

  const { data: orgs = [], isLoading: orgsLoading } = useOrganizations()
  const { workspaces, isLoading: wsLoading } = useWorkspaces(selectedOrgId || null)
  const createToken = useCreateMcpToken({ onSuccess: onCreated })

  const hasOrgToken = selectedOrgId ? existingTokens.some((token) => token.org_id === selectedOrgId) : false

  const defaultOrgId = useMemo(() => (orgs.length > 0 ? orgs[0].id : ''), [orgs])
  const orgId = selectedOrgId || defaultOrgId

  const handleSubmit = () => {
    if (!orgId) {
      toast.error('Please select an organization')
      return
    }
    if (scope === 'workspace' && !selectedWorkspaceId) {
      toast.error('Please select a workspace')
      return
    }

    createToken.mutate(
      {
        name: name.trim() || 'My MCP Token',
        scope,
        org_id: orgId,
        workspace_id: scope === 'workspace' ? selectedWorkspaceId : undefined,
      },
      {
        onSuccess: () => {
          setSelectedWorkspaceId('')
          onOpenChange(false)
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create scoped token</DialogTitle>
          <DialogDescription>
            Use tokens when you need category-level control or when a provider does not support CallVault OAuth yet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="token-name">Token name</Label>
            <Input id="token-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
          </div>

          <div className="space-y-1.5">
            <Label>Organization</Label>
            {orgsLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Select value={orgId} onValueChange={(value) => {
                setSelectedOrgId(value)
                setSelectedWorkspaceId('')
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {orgs.map((org) => (
                    <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Scope</Label>
            <Select value={scope} onValueChange={(value) => setScope(value as McpTokenScope)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="workspace">Workspace</SelectItem>
                <SelectItem value="organization">Organization</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {scope === 'workspace' && (
            <div className="space-y-1.5">
              <Label>Workspace</Label>
              {wsLoading ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <Select value={selectedWorkspaceId} onValueChange={setSelectedWorkspaceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select workspace" />
                  </SelectTrigger>
                  <SelectContent>
                    {workspaces.map((workspace) => (
                      <SelectItem key={workspace.id} value={workspace.id}>{workspace.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </div>

        {hasOrgToken && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            This organization already has an MCP token. Delete the existing one first.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={createToken.isPending || !orgId || (scope === 'workspace' && !selectedWorkspaceId) || hasOrgToken}
          >
            {createToken.isPending ? 'Creating...' : 'Create scoped token'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TokenRevealDialog({ token, onClose }: { token: McpToken | null; onClose: () => void }) {
  if (!token) return null

  const mcpUrl = buildScopedMcpUrl(token.scope, token.workspace_id)

  return (
    <Dialog open={!!token} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Token Created</DialogTitle>
          <DialogDescription>Copy this token now. CallVault will not show the full token again.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Token</Label>
              <CopyButton text={token.token} label="Copy" />
            </div>
            <div className="rounded-md bg-muted p-3 font-mono text-xs break-all">{token.token}</div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">MCP endpoint URL</Label>
              <CopyButton text={mcpUrl} label="Copy" />
            </div>
            <div className="rounded-md bg-muted p-3 font-mono text-xs break-all">{mcpUrl}</div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function MCPTab() {
  const { isPaid } = useSubscription()
  const { grants, isLoading: grantsLoading, error: grantsError } = useMcpOAuthGrantsList()
  const {
    tokens,
    tokenConnections: rawTokenConnections,
    isLoading: tokensLoading,
    error: tokensError,
  } = useMcpTokensList()
  const revokeGrant = useRevokeMcpOAuthGrant()
  const deleteToken = useDeleteMcpToken()
  const regenerateToken = useRegenerateMcpToken()

  const [showNewDialog, setShowNewDialog] = useState(false)
  const [newlyCreatedToken, setNewlyCreatedToken] = useState<McpToken | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; name: string } | null>(null)
  const [regenerateTarget, setRegenerateTarget] = useState<{ id: string; name: string } | null>(null)
  const tokenConnections = rawTokenConnections ?? tokens.map(toManualTokenConnection)

  if (!isPaid) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center space-y-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mx-auto">
          <RiLockLine className="h-5 w-5 text-primary" />
        </div>
        <h2 className="font-medium text-sm">AI connectors are a Pro feature</h2>
        <p className="text-xs text-muted-foreground">Upgrade to Pro to connect AI clients with OAuth or manual scoped tokens.</p>
        <UpgradeButton productId={POLAR_PRODUCT_IDS.PRO_MONTHLY}>Upgrade to Pro</UpgradeButton>
      </div>
    )
  }

  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
        <div>
          <h2 className="flex items-center gap-2 font-montserrat font-extrabold uppercase tracking-wide text-sm text-foreground">
            <RiRobot2Line className="h-4 w-4 shrink-0" />
            AI connectors
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            OAuth is the simplest way to connect CallVault to an AI client. Access is scoped to the selected organization or workspace and can be revoked here.
          </p>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">Connected AI clients</h3>
            <p className="text-xs text-muted-foreground">
              Changes take effect on CallVault immediately. Some AI clients may need a refresh or reconnect before their tool list updates.
            </p>
          </div>

          {grantsLoading ? (
            <div className="space-y-3">{[1, 2].map((item) => <Skeleton key={item} className="h-20 w-full" />)}</div>
          ) : grantsError ? (
            <div className="p-4 rounded-lg bg-destructive/10 text-sm text-destructive">Failed to load AI clients: {grantsError.message}</div>
          ) : grants.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6">
              <p className="text-sm font-medium">No AI clients connected yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Connect an AI client with OAuth, or create a scoped token for clients that need manual setup.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border">
              {grants.map((grant) => (
                <OAuthConnectionRow key={grant.id} grant={grant} onRevoke={(id, name) => setRevokeTarget({ id, name })} />
              ))}
            </div>
          )}

          <Button variant="outline" size="sm" className="gap-2" onClick={() => window.open(getMcpUrl(), '_blank')}>
            <RiAddLine className="h-4 w-4" />
            Connect AI client
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
        <div>
          <h3 className="font-semibold text-foreground">Manual token connectors</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Use tokens when you need category-level control or when a provider does not support CallVault OAuth yet.
          </p>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {tokensLoading ? (
            <div className="space-y-3">{[1, 2].map((item) => <Skeleton key={item} className="h-20 w-full" />)}</div>
          ) : tokensError ? (
            <div className="p-4 rounded-lg bg-destructive/10 text-sm text-destructive">Failed to load tokens: {tokensError.message}</div>
          ) : tokenConnections.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
              No manual token connectors yet.
            </div>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border">
              {tokenConnections.map((token) => (
                <ManualTokenRow
                  key={token.id}
                  token={token as McpManualTokenConnection}
                  onDelete={(id, name) => setDeleteTarget({ id, name })}
                  onRegenerate={(id, name) => setRegenerateTarget({ id, name })}
                />
              ))}
            </div>
          )}

          <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowNewDialog(true)}>
            <RiAddLine className="h-4 w-4" />
            Create scoped token
          </Button>
        </div>
      </div>

      <NewTokenDialog open={showNewDialog} onOpenChange={setShowNewDialog} onCreated={setNewlyCreatedToken} existingTokens={tokens} />
      <TokenRevealDialog token={newlyCreatedToken} onClose={() => setNewlyCreatedToken(null)} />

      <AlertDialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke AI client?</AlertDialogTitle>
            <AlertDialogDescription>
              Revoke access for {revokeTarget?.name}? CallVault will reject future requests from this client. You may also need to disconnect it in the AI client.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (!revokeTarget) return
              revokeGrant.mutate(revokeTarget.id, { onSettled: () => setRevokeTarget(null) })
            }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete manual token?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete token {deleteTarget?.name}? Any client using this token will stop working immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (!deleteTarget) return
              deleteToken.mutate(deleteTarget.id, { onSettled: () => setDeleteTarget(null) })
            }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!regenerateTarget} onOpenChange={(open) => !open && setRegenerateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate token?</AlertDialogTitle>
            <AlertDialogDescription>
              The current token for {regenerateTarget?.name} will immediately stop working. You will receive a new token to configure in its place.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (!regenerateTarget) return
              regenerateToken.mutate(regenerateTarget.id, {
                onSuccess: (token) => setNewlyCreatedToken(token),
                onSettled: () => setRegenerateTarget(null),
              })
            }}>
              Regenerate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
