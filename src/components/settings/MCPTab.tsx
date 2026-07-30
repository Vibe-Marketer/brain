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
  RiRefreshLine,
  RiRobot2Line,
  RiSettings3Line,
  RiTimeLine,
} from '@remixicon/react'
import { toast } from 'sonner'
import McpSetupSnippets from '@/components/settings/McpSetupSnippets'
import { useMcpOAuthGrantsList, useRevokeMcpOAuthGrant } from '@/hooks/useMcpOAuthGrants'
import { useSetMcpTokenCategories } from '@/hooks/useMcpTokenCapabilities'
import { useCreateMcpToken, useDeleteMcpToken, useMcpTokensList, useRegenerateMcpToken } from '@/hooks/useMcpTokens'
import { useOrganizations } from '@/hooks/useOrganizations'
import { useOrganizationContext } from '@/hooks/useOrganizationContext'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import {
  type McpManualTokenConnection,
  type McpToken,
  type McpTokenScope,
  buildScopedMcpUrl,
  toManualTokenConnection,
} from '@/services/mcp-tokens.service'
import { TOOL_CATEGORY_DESCRIPTIONS, type ToolCategory } from '@/lib/mcp-tool-categories'

const ALL_CATEGORIES: ToolCategory[] = ['read', 'write', 'ai', 'admin']

type SetupClient = 'claude-code' | 'cursor' | 'vscode' | 'windsurf' | 'generic'

const SETUP_CLIENTS: Array<{ value: SetupClient; label: string }> = [
  { value: 'claude-code', label: 'Claude Code' },
  { value: 'cursor', label: 'Cursor' },
  { value: 'vscode', label: 'VS Code' },
  { value: 'windsurf', label: 'Windsurf' },
  { value: 'generic', label: 'Generic MCP' },
]

function setupClientLabel(client: SetupClient): string {
  return SETUP_CLIENTS.find((item) => item.value === client)?.label ?? 'Generic MCP'
}

function resolveTokenMcpUrl(token: McpToken | McpManualTokenConnection): string {
  return 'endpoint_url' in token && token.endpoint_url
    ? token.endpoint_url
    : buildScopedMcpUrl(token.scope, token.workspace_id)
}

function buildMcpServerJson(token: McpToken | McpManualTokenConnection, serverKey = 'callvault'): string {
  const url = resolveTokenMcpUrl(token)
  return JSON.stringify(
    {
      mcpServers: {
        [serverKey]: {
          type: 'http',
          url,
          headers: {
            Authorization: `Bearer ${token.token}`,
          },
        },
      },
    },
    null,
    2,
  )
}

function buildVsCodeJson(token: McpToken | McpManualTokenConnection): string {
  const url = resolveTokenMcpUrl(token)
  return JSON.stringify(
    {
      servers: {
        callvault: {
          type: 'http',
          url,
          headers: {
            Authorization: `Bearer ${token.token}`,
          },
        },
      },
    },
    null,
    2,
  )
}

function buildConfiguredSetup(token: McpToken | McpManualTokenConnection, client: SetupClient): string {
  const url = resolveTokenMcpUrl(token)
  if (client === 'claude-code') {
    return `claude mcp add --transport http callvault ${url} --header "Authorization: Bearer ${token.token}"`
  }
  if (client === 'vscode') return buildVsCodeJson(token)
  return buildMcpServerJson(token)
}

function buildInstallPrompt(token: McpToken | McpManualTokenConnection, client: SetupClient): string {
  const clientName = setupClientLabel(client)
  const configuredSetup = buildConfiguredSetup(token, client)
  const targetFile =
    client === 'cursor'
      ? '.cursor/mcp.json or ~/.cursor/mcp.json'
      : client === 'vscode'
        ? '.vscode/mcp.json or VS Code MCP settings'
        : client === 'windsurf'
          ? '~/.codeium/windsurf/mcp_config.json'
          : 'the MCP client configuration'

  if (client === 'claude-code') {
    return [
      'Install the CallVault MCP server for Claude Code.',
      'Run this command exactly, then verify the server is listed:',
      '',
      configuredSetup,
    ].join('\n')
  }

  return [
    `Install the CallVault MCP server for ${clientName}.`,
    `Add this configuration to ${targetFile}. Preserve the Authorization header exactly, then reload MCP tools.`,
    '',
    configuredSetup,
  ].join('\n')
}

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

function buildOAuthClaudeCodeSetup(endpointUrl: string): string {
  return `claude mcp add --transport http callvault ${endpointUrl}`
}

function SetupCopyActions({
  token,
  defaultClient = 'claude-code',
}: {
  token: McpToken | McpManualTokenConnection
  defaultClient?: SetupClient
}) {
  const [client, setClient] = useState<SetupClient>(defaultClient)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-xs text-muted-foreground">Setup for</Label>
        <Select value={client} onValueChange={(value) => setClient(value as SetupClient)}>
          <SelectTrigger className="h-8 w-[180px] bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SETUP_CLIENTS.map((item) => (
              <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap gap-2">
        <CopyButton text={buildConfiguredSetup(token, client)} label="Copy manual setup" />
        <CopyButton text={buildInstallPrompt(token, client)} label="Copy manual instructions" />
      </div>
    </div>
  )
}

function ClaudeCodeTroubleshootingPanel() {
  const commands = [
    'claude mcp list',
    'claude mcp get "<name>"',
    'claude mcp remove "<name>" -s claudeai',
  ].join('\n')

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <div className="font-medium">Claude Code auth-header warning</div>
      <p className="mt-1 text-xs leading-5">
        OAuth connectors use the endpoint URL only. If Claude Code says OAuth fallback is disabled because
        <code className="mx-1 rounded bg-amber-100 px-1 py-0.5">headers.Authorization</code>
        is set, remove the stale connector entry and reconnect without a bearer header.
      </p>
      <div className="mt-3 flex flex-col gap-3 rounded-md bg-white/70 p-3 sm:flex-row sm:items-start sm:justify-between">
        <pre className="max-w-full flex-1 overflow-x-auto whitespace-pre-wrap text-xs font-mono leading-5">{commands}</pre>
        <CopyButton text={commands} label="Copy recovery commands" />
      </div>
    </div>
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
    <div className="px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
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
        <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          OAuth setup uses this endpoint URL only. Do not configure an Authorization header for this connector.
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <code className="max-w-full text-xs bg-muted px-2 py-0.5 rounded font-mono break-all">{grant.endpoint_url}</code>
          <CopyButton text={grant.endpoint_url} label="Copy URL" />
          <CopyButton text={buildOAuthClaudeCodeSetup(grant.endpoint_url)} label="Copy Claude Code setup" />
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
  const [detailsOpen, setDetailsOpen] = useState(false)

  return (
    <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
      <div className="px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
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
          <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Advanced manual bearer-token setup. Use this only for clients that cannot use CallVault OAuth.
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <code className="max-w-full text-xs bg-muted px-2 py-0.5 rounded font-mono break-all">{token.token_preview}</code>
            <CopyButton text={token.token} label="Copy manual token" />
            <CopyButton text={token.endpoint_url} label="Copy URL" />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:ml-auto">
          <CollapsibleTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              aria-label={`Configure manual token ${token.name}`}
              aria-expanded={detailsOpen}
            >
              <RiSettings3Line className="h-4 w-4" />
              Configure
            </Button>
          </CollapsibleTrigger>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-primary"
            aria-label={`Regenerate token ${token.name}`}
            onClick={() => onRegenerate(token.id, token.name)}
          >
            <RiRefreshLine className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            aria-label={`Delete token ${token.name}`}
            onClick={() => onDelete(token.id, token.name)}
          >
            <RiDeleteBinLine className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <CollapsibleContent>
        <div className="border-t border-border/60 px-4 py-4">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-2">
              <div>
                <div className="text-sm font-medium text-foreground">Manual setup</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Copy these only for clients that cannot use the OAuth connector URL.
                </p>
              </div>
              <SetupCopyActions token={token} />
            </div>
            <div className="space-y-2">
              <div>
                <div className="text-sm font-medium text-foreground">Tool access</div>
                <p className="mt-1 text-xs text-muted-foreground">Choose which MCP tool groups this token can use.</p>
              </div>
              <PermissionsPanel token={token} />
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

interface NewTokenDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (token: McpToken, client: SetupClient) => void
}

function NewTokenDialog({ open, onOpenChange, onCreated }: NewTokenDialogProps) {
  const [setupClient, setSetupClient] = useState<SetupClient>('claude-code')
  const [name, setName] = useState(`${setupClientLabel('claude-code')} Token`)
  const [scope, setScope] = useState<McpTokenScope>('organization')
  const [selectedOrgId, setSelectedOrgId] = useState<string>('')
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('')

  const { data: orgs = [], isLoading: orgsLoading } = useOrganizations()
  const { workspaces, isLoading: wsLoading } = useWorkspaces(selectedOrgId || null)
  const createToken = useCreateMcpToken()

  const defaultOrgId = useMemo(() => (orgs.length > 0 ? orgs[0].id : ''), [orgs])
  const orgId = selectedOrgId || defaultOrgId

  const handleClientChange = (value: string) => {
    const nextClient = value as SetupClient
    const previousDefault = `${setupClientLabel(setupClient)} Token`
    const nextDefault = `${setupClientLabel(nextClient)} Token`
    setSetupClient(nextClient)
    setName((current) => (current.trim() === '' || current === previousDefault || current === 'My MCP Token' ? nextDefault : current))
  }

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
        onSuccess: (token) => {
          setSelectedWorkspaceId('')
          onCreated(token, setupClient)
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
            Choose a client, organization, and optional workspace. CallVault will generate the exact setup to copy.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Client</Label>
            <Select value={setupClient} onValueChange={handleClientChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SETUP_CLIENTS.map((client) => (
                  <SelectItem key={client.value} value={client.value}>{client.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={createToken.isPending || !orgId || (scope === 'workspace' && !selectedWorkspaceId)}
          >
            {createToken.isPending ? 'Creating...' : 'Create scoped token'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TokenRevealDialog({
  token,
  defaultClient,
  onClose,
}: {
  token: McpToken | null
  defaultClient: SetupClient
  onClose: () => void
}) {
  if (!token) return null

  const mcpUrl = resolveTokenMcpUrl(token)

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

          <SetupCopyActions token={token} defaultClient={defaultClient} />
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function MCPTab() {
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
  const { data: orgs = [] } = useOrganizations()
  // Show the ACTIVE organization's endpoint, not orgs[0] — picking the first org
  // in the list surfaced a subdomain the user isn't currently in (e.g. another
  // org's slug leaking into the manual-config "Organization endpoint").
  const { activeOrgId } = useOrganizationContext()
  const activeOrg = orgs.find((org) => org.id === activeOrgId) ?? orgs[0] ?? null
  const defaultOrgId = activeOrg?.id ?? null
  const defaultOrgSlug = activeOrg?.slug ?? null
  const { workspaces: snippetWorkspaces } = useWorkspaces(defaultOrgId)

  const [showNewDialog, setShowNewDialog] = useState(false)
  const [newlyCreatedToken, setNewlyCreatedToken] = useState<McpToken | null>(null)
  const [newlyCreatedSetupClient, setNewlyCreatedSetupClient] = useState<SetupClient>('claude-code')
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; name: string } | null>(null)
  const [regenerateTarget, setRegenerateTarget] = useState<{ id: string; name: string } | null>(null)
  const tokenConnections = rawTokenConnections ?? tokens.map((token) => toManualTokenConnection(token))
  const snippetWorkspaceId = useMemo(() => {
    const workspaceGrant = grants.find((grant) => grant.scope === 'workspace' && grant.workspace_id)
    if (workspaceGrant?.workspace_id) return workspaceGrant.workspace_id

    const workspaceToken = tokenConnections.find((token) => token.scope === 'workspace' && token.workspace_id)
    return workspaceToken?.workspace_id ?? null
  }, [grants, tokenConnections])
  const snippetWorkspaceSlug = useMemo(() => {
    if (!snippetWorkspaceId) return null
    return snippetWorkspaces.find((workspace) => workspace.id === snippetWorkspaceId)?.slug ?? null
  }, [snippetWorkspaceId, snippetWorkspaces])

  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
        <div>
          <h2 className="flex items-center gap-2 font-montserrat font-extrabold uppercase tracking-wide text-sm text-foreground">
            <RiRobot2Line className="h-4 w-4 shrink-0" />
            AI connectors
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect AI clients with OAuth, or create manual tokens for clients that need copy-paste setup.
          </p>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <ClaudeCodeTroubleshootingPanel />

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

          <Button variant="outline" size="sm" className="gap-2" onClick={() => window.open('https://docs.callvaultai.com/mcp', '_blank', 'noopener,noreferrer')}>
            <RiAddLine className="h-4 w-4" />
            Connect AI client
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
        <div>
          <h2 className="flex items-center gap-2 font-montserrat font-extrabold uppercase tracking-wide text-sm text-foreground">
            <RiSettings3Line className="h-4 w-4 shrink-0" />
            Manual tokens
          </h2>
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

          <McpSetupSnippets
            workspaceId={snippetWorkspaceId}
            orgSlug={defaultOrgSlug}
            wsSlug={snippetWorkspaceSlug}
          />
        </div>
      </div>

      <NewTokenDialog
        open={showNewDialog}
        onOpenChange={setShowNewDialog}
        onCreated={(token, client) => {
          setNewlyCreatedSetupClient(client)
          setNewlyCreatedToken(token)
        }}
      />
      <TokenRevealDialog
        token={newlyCreatedToken}
        defaultClient={newlyCreatedSetupClient}
        onClose={() => setNewlyCreatedToken(null)}
      />

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
