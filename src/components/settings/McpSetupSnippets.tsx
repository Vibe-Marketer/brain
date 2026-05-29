import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { RiCheckLine, RiFileCopyLine } from '@remixicon/react'
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

    </div>
  )
}

export default McpSetupSnippets
