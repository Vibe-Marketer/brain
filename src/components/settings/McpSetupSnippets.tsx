import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { RiCheckLine, RiFileCopyLine, RiKey2Line } from '@remixicon/react'
import { useRegisterMcpOAuthClient } from '@/hooks/useMcpOAuthClientRegistration'
import type { RegisteredMcpOAuthClient } from '@/services/mcp-oauth-clients.service'
import { getMcpUrl } from '@/services/mcp-tokens.service'

interface McpSetupSnippetsProps {
  workspaceId?: string | null
}

function buildWorkspaceUrl(workspaceId?: string | null): string {
  const baseUrl = getMcpUrl()
  if (!workspaceId) return baseUrl
  return `${baseUrl}/w/${workspaceId}`
}

function SnippetCopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy setup')
    }
  }

  return (
    <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={handleCopy}>
      {copied ? <RiCheckLine className="h-3.5 w-3.5 text-green-500" /> : <RiFileCopyLine className="h-3.5 w-3.5" />}
      {copied ? 'Copied!' : label}
    </Button>
  )
}

const PERPLEXITY_REDIRECT_URI = 'https://www.perplexity.ai/rest/connections/oauth_callback'
const PERPLEXITY_REDIRECT_URIS = [
  PERPLEXITY_REDIRECT_URI,
  'https://perplexity.ai/rest/connections/oauth_callback',
]

function PerplexityOAuthCredentials() {
  const [registeredClient, setRegisteredClient] = useState<RegisteredMcpOAuthClient | null>(null)
  const registerClient = useRegisterMcpOAuthClient()

  const handleGenerate = async () => {
    try {
      const client = await registerClient.mutateAsync({
        clientName: 'Perplexity',
        redirectUris: PERPLEXITY_REDIRECT_URIS,
      })
      setRegisteredClient(client)
      toast.success('Perplexity OAuth client generated')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate Perplexity OAuth client'
      toast.error(message)
    }
  }
  const secretPreview = registeredClient?.client_secret
    ? `${registeredClient.client_secret.slice(0, 4)}...${registeredClient.client_secret.slice(-4)}`
    : null

  return (
    <div className="rounded-md border border-border/60 px-3 py-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <RiKey2Line className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Perplexity fallback credentials</span>
            <Badge variant="outline" className="text-[10px]">Advanced</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Only generate these if Perplexity asks for a client ID and secret instead of using OAuth discovery.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={handleGenerate}
          disabled={registerClient.isPending}
        >
          {registerClient.isPending ? 'Generating...' : 'Generate'}
        </Button>
      </div>

      {registeredClient ? (
        <div className="grid gap-2 border-t border-border/60 pt-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">Client ID</span>
              <SnippetCopyButton text={registeredClient.client_id} label="Copy" />
            </div>
            <code className="block rounded-md bg-muted px-2 py-1.5 text-xs break-all">{registeredClient.client_id}</code>
          </div>
          {registeredClient.client_secret ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">Client secret</span>
                <SnippetCopyButton text={registeredClient.client_secret} label="Copy" />
              </div>
              <code className="block rounded-md bg-muted px-2 py-1.5 text-xs break-all">{secretPreview}</code>
            </div>
          ) : null}
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">Auth method</span>
              <SnippetCopyButton text={registeredClient.token_endpoint_auth_method} label="Copy" />
            </div>
            <code className="block rounded-md bg-muted px-2 py-1.5 text-xs break-all">{registeredClient.token_endpoint_auth_method}</code>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function McpSetupSnippets({ workspaceId }: McpSetupSnippetsProps) {
  const orgUrl = getMcpUrl()
  const workspaceUrl = useMemo(() => buildWorkspaceUrl(workspaceId), [workspaceId])

  return (
    <div className="rounded-lg border border-border p-4 space-y-4">
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-foreground">Setup values</h4>
        <p className="text-xs text-muted-foreground">
          Use the organization endpoint for org-wide access. Use the workspace endpoint for a single workspace.
        </p>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">Organization MCP endpoint</span>
            <SnippetCopyButton text={orgUrl} label="Copy URL" />
          </div>
          <code className="block rounded-md bg-muted px-2 py-1.5 text-xs break-all">{orgUrl}</code>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">Workspace MCP endpoint</span>
            <SnippetCopyButton text={workspaceUrl} label="Copy URL" />
          </div>
          <code className="block rounded-md bg-muted px-2 py-1.5 text-xs break-all">{workspaceUrl}</code>
        </div>
      </div>

      <PerplexityOAuthCredentials />
    </div>
  )
}

export default McpSetupSnippets
