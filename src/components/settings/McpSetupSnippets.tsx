import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { RiCheckLine, RiExternalLinkLine, RiFileCopyLine } from '@remixicon/react'
import {
  MCP_PROVIDER_CAPABILITIES,
  MCP_SETUP_PROVIDER_ORDER,
  getProviderSetupActionLabel,
  type McpProviderCapability,
} from '@/components/settings/mcp-provider-capabilities'
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

function ProviderActionButton({ capability }: { capability: McpProviderCapability }) {
  const label = getProviderSetupActionLabel(capability)
  const isOAuth = capability.setupAction === 'connect_oauth'
  const isCopy = capability.setupAction === 'copy_setup'

  const handleClick = async () => {
    if (isOAuth) {
      window.open(getMcpUrl(), '_blank')
      return
    }
    if (isCopy) {
      try {
        await navigator.clipboard.writeText(capability.setupGuideUrl)
        toast.success('Setup guide copied')
      } catch {
        toast.error('Failed to copy setup guide')
      }
      return
    }
    window.open(capability.setupGuideUrl, '_blank')
  }

  return (
    <Button variant="outline" size="sm" className="gap-1.5" onClick={handleClick}>
      {label}
      {capability.setupAction === 'open_setup_guide' ? <RiExternalLinkLine className="h-3.5 w-3.5" /> : null}
    </Button>
  )
}

export function McpSetupSnippets({ workspaceId }: McpSetupSnippetsProps) {
  const orgUrl = getMcpUrl()
  const workspaceUrl = useMemo(() => buildWorkspaceUrl(workspaceId), [workspaceId])

  return (
    <div className="rounded-lg border border-border p-4 space-y-4">
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-foreground">Provider setup snippets</h4>
        <p className="text-xs text-muted-foreground">
          Copy setup values for your AI client. CallVault enforces permissions server-side even if client tool lists refresh later.
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

      <div className="space-y-2">
        {MCP_SETUP_PROVIDER_ORDER.map((providerId) => {
          const capability = MCP_PROVIDER_CAPABILITIES[providerId]
          return (
            <div key={providerId} className="flex items-start justify-between gap-3 rounded-md border border-border/60 px-3 py-2.5">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{capability.label}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {getProviderSetupActionLabel(capability)}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{capability.notes}</p>
              </div>
              <ProviderActionButton capability={capability} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default McpSetupSnippets
