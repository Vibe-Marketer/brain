/**
 * MCPTab — MCP Token Management
 *
 * Lets users create, view, and delete MCP tokens that expose their CallVault
 * calls to external AI tools (Claude Desktop, Cursor, ChatGPT, etc.).
 *
 * - PRO+ feature: shown with upgrade gate for free users
 * - Workspace-scoped tokens expose a single workspace's calls
 * - Org-scoped tokens expose all calls across an organization
 * - Token values are shown exactly once on creation
 */

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  RiAddLine,
  RiDeleteBinLine,
  RiFileCopyLine,
  RiCheckLine,
  RiRobot2Line,
  RiLockLine,
  RiTimeLine,
  RiAlertLine,
} from "@remixicon/react";
import { useSubscription } from "@/hooks/useSubscription";
import { useMcpTokensList, useCreateMcpToken, useDeleteMcpToken } from "@/hooks/useMcpTokens";
import { useOrganizations } from "@/hooks/useOrganizations";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { getMcpUrl, type McpToken, type McpTokenScope } from "@/services/mcp-tokens.service";
import { UpgradeButton } from "@/components/billing/UpgradeButton";
import { toast } from "sonner";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatLastUsed(lastUsedAt: string | null): string {
  if (!lastUsedAt) return "Never used";
  const date = new Date(lastUsedAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 30) return `${diffDays} days ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatCreated(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Claude Desktop config snippet ────────────────────────────────────────────

function buildClaudeConfig(mcpUrl: string, token: string, tokenName: string): string {
  const safeName = tokenName.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  return JSON.stringify(
    {
      mcpServers: {
        [`callvault-${safeName}`]: {
          url: mcpUrl,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      },
    },
    null,
    2,
  );
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 gap-1 text-xs">
      {copied ? (
        <RiCheckLine className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <RiFileCopyLine className="h-3.5 w-3.5" />
      )}
      {copied ? "Copied!" : label}
    </Button>
  );
}

// ─── Token row ────────────────────────────────────────────────────────────────

function TokenRow({
  token,
  mcpUrl,
  onDelete,
}: {
  token: McpToken;
  mcpUrl: string;
  onDelete: (id: string, name: string) => void;
}) {
  return (
    <div className="flex items-start gap-4 py-4">
      {/* Icon */}
      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <RiRobot2Line className="h-4.5 w-4.5 text-primary" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium truncate">{token.name}</span>
          <Badge variant={token.scope === "organization" ? "default" : "outline"} className="text-xs">
            {token.scope === "organization" ? "Org" : "Workspace"}
          </Badge>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <RiTimeLine className="h-3 w-3" />
            {formatLastUsed(token.last_used_at)}
          </span>
          <span>Created {formatCreated(token.created_at)}</span>
        </div>

        {/* Token value (masked) */}
        <div className="mt-2 flex items-center gap-2">
          <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono truncate max-w-[200px]">
            {token.token.slice(0, 8)}...{token.token.slice(-4)}
          </code>
          <CopyButton text={token.token} label="Copy token" />
          <CopyButton text={mcpUrl} label="Copy URL" />
        </div>
      </div>

      {/* Delete */}
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-destructive flex-shrink-0"
        onClick={() => onDelete(token.id, token.name)}
        aria-label={`Delete token ${token.name}`}
      >
        <RiDeleteBinLine className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ─── New token dialog ─────────────────────────────────────────────────────────

interface NewTokenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (token: McpToken) => void;
}

function NewTokenDialog({ open, onOpenChange, onCreated }: NewTokenDialogProps) {
  const [name, setName] = useState("My MCP Token");
  const [scope, setScope] = useState<McpTokenScope>("workspace");
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("");

  const { data: orgs = [], isLoading: orgsLoading } = useOrganizations();
  const { workspaces, isLoading: wsLoading } = useWorkspaces(selectedOrgId || null);

  const createToken = useCreateMcpToken({ onSuccess: onCreated });

  // Auto-select first org
  if (!selectedOrgId && orgs.length > 0) {
    setSelectedOrgId(orgs[0].id);
  }

  // Reset workspace when org changes
  const handleOrgChange = (orgId: string) => {
    setSelectedOrgId(orgId);
    setSelectedWorkspaceId("");
  };

  const handleSubmit = () => {
    if (!selectedOrgId) {
      toast.error("Please select an organization");
      return;
    }
    if (scope === "workspace" && !selectedWorkspaceId) {
      toast.error("Please select a workspace");
      return;
    }

    createToken.mutate(
      {
        name: name.trim() || "My MCP Token",
        scope,
        org_id: selectedOrgId,
        workspace_id: scope === "workspace" ? selectedWorkspaceId : undefined,
      },
      {
        onSuccess: () => onOpenChange(false),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create MCP Token</DialogTitle>
          <DialogDescription>
            Generate an API token to connect your CallVault calls to Claude
            Desktop, Cursor, or any MCP-compatible AI tool.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Token name */}
          <div className="space-y-1.5">
            <Label htmlFor="token-name">Token name</Label>
            <Input
              id="token-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My MCP Token"
              maxLength={80}
            />
          </div>

          {/* Organization */}
          <div className="space-y-1.5">
            <Label>Organization</Label>
            {orgsLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Select value={selectedOrgId} onValueChange={handleOrgChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {orgs.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Scope */}
          <div className="space-y-1.5">
            <Label>Scope</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as McpTokenScope)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="workspace">Workspace — single workspace only</SelectItem>
                <SelectItem value="organization">Organization — all org workspaces</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {scope === "workspace"
                ? "The AI will only see calls in the selected workspace."
                : "The AI will see all calls across this organization."}
            </p>
          </div>

          {/* Workspace selector (only for workspace scope) */}
          {scope === "workspace" && (
            <div className="space-y-1.5">
              <Label>Workspace</Label>
              {wsLoading ? (
                <Skeleton className="h-9 w-full" />
              ) : workspaces.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">
                  No workspaces found in this organization.
                </p>
              ) : (
                <Select value={selectedWorkspaceId} onValueChange={setSelectedWorkspaceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select workspace" />
                  </SelectTrigger>
                  <SelectContent>
                    {workspaces.map((ws) => (
                      <SelectItem key={ws.id} value={ws.id}>
                        {ws.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createToken.isPending || !selectedOrgId || (scope === "workspace" && !selectedWorkspaceId)}
          >
            {createToken.isPending ? "Creating..." : "Create Token"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Token reveal dialog (shown once after creation) ──────────────────────────

function TokenRevealDialog({
  token,
  onClose,
}: {
  token: McpToken | null;
  onClose: () => void;
}) {
  const mcpUrl = getMcpUrl();

  if (!token) return null;

  const claudeConfig = buildClaudeConfig(mcpUrl, token.token, token.name);

  return (
    <Dialog open={!!token} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Token Created</DialogTitle>
          <DialogDescription>
            Copy your token now — it won't be shown again in full.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Warning */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
            <RiAlertLine className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Store this token securely. It grants read access to your CallVault calls.
            </p>
          </div>

          {/* Token value */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Token</Label>
              <CopyButton text={token.token} label="Copy" />
            </div>
            <div className="rounded-md bg-muted p-3 font-mono text-xs break-all">
              {token.token}
            </div>
          </div>

          {/* MCP URL */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">MCP Server URL</Label>
              <CopyButton text={mcpUrl} label="Copy" />
            </div>
            <div className="rounded-md bg-muted p-3 font-mono text-xs break-all">
              {mcpUrl}
            </div>
          </div>

          {/* Claude Desktop config */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">
                claude_desktop_config.json snippet
              </Label>
              <CopyButton text={claudeConfig} label="Copy" />
            </div>
            <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
              {claudeConfig}
            </pre>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MCPTab() {
  const { tier, isPaid } = useSubscription();
  const { tokens, isLoading, error } = useMcpTokensList();
  const deleteToken = useDeleteMcpToken();

  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newlyCreatedToken, setNewlyCreatedToken] = useState<McpToken | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const mcpUrl = getMcpUrl();
  const isProPlus = isPaid;

  const handleTokenCreated = (token: McpToken) => {
    setNewlyCreatedToken(token);
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    deleteToken.mutate(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <div>
      <Separator className="mb-12" />

      {/* Header section */}
      <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-50">MCP Access</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
            Connect your calls to Claude Desktop, Cursor, and other AI tools via the Model Context
            Protocol.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Requires Pro or Team plan.
          </p>
        </div>

        <div className="lg:col-span-2">
          {/* Upgrade gate for free users */}
          {!isProPlus ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center space-y-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mx-auto">
                <RiLockLine className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-sm">MCP access is a Pro feature</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Upgrade to Pro to expose your calls to any AI assistant via MCP.
                </p>
              </div>
              <UpgradeButton productId="pro-monthly" className="mt-2">
                Upgrade to Pro
              </UpgradeButton>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Token list */}
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="flex items-start gap-4 py-4">
                      <Skeleton className="h-9 w-9 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-64" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg text-sm text-red-600 dark:text-red-400">
                  Failed to load tokens: {error.message}
                </div>
              ) : tokens.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No MCP tokens yet. Create one to connect your first AI tool.
                </div>
              ) : (
                <div className="divide-y divide-border rounded-lg border border-border">
                  {tokens.map((token) => (
                    <div key={token.id} className="px-4">
                      <TokenRow
                        token={token}
                        mcpUrl={mcpUrl}
                        onDelete={(id, name) => setDeleteTarget({ id, name })}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Create button */}
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setShowNewDialog(true)}
              >
                <RiAddLine className="h-4 w-4" />
                Create Token
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* How it works section */}
      <Separator className="my-16" />
      <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-50">How it works</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
            Connect any MCP-compatible AI to your calls.
          </p>
        </div>
        <div className="lg:col-span-2 space-y-4 text-sm text-muted-foreground">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                step: "1",
                title: "Create a token",
                desc: "Choose workspace or org scope. Each token is an independent API key.",
              },
              {
                step: "2",
                title: "Paste the config",
                desc: 'Add the MCP server URL and token to your AI tool\'s config (e.g. claude_desktop_config.json).',
              },
              {
                step: "3",
                title: "Ask questions",
                desc: "Your AI can now search transcripts, get summaries, and list calls from CallVault.",
              },
            ].map(({ step, title, desc }) => (
              <div
                key={step}
                className="p-4 rounded-lg bg-muted/40 border border-border space-y-1.5"
              >
                <div className="text-xs font-bold text-primary uppercase tracking-wide">
                  Step {step}
                </div>
                <div className="font-medium text-foreground">{title}</div>
                <div className="text-xs leading-relaxed">{desc}</div>
              </div>
            ))}
          </div>

          {/* MCP URL callout */}
          <div className="p-4 rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">MCP Server URL</span>
              <CopyButton text={mcpUrl} label="Copy" />
            </div>
            <code className="text-xs font-mono text-foreground break-all">{mcpUrl}</code>
          </div>

          {/* Available tools */}
          <div>
            <h4 className="font-medium text-foreground mb-2">Available tools</h4>
            <ul className="space-y-1.5 text-xs">
              {[
                ["callvault/search_calls", "Search calls by keyword across titles, transcripts, and tags"],
                ["callvault/list_calls", "List recent calls with pagination"],
                ["callvault/get_transcript", "Retrieve the full transcript for a specific call"],
                ["callvault/get_recording_context", "Get metadata, AI summary, speakers, and tags"],
                ["callvault/list_workspaces", "Enumerate workspaces accessible to the token"],
              ].map(([name, desc]) => (
                <li key={name} className="flex items-start gap-2">
                  <code className="text-primary bg-primary/5 px-1.5 py-0.5 rounded font-mono whitespace-nowrap">
                    {name}
                  </code>
                  <span className="text-muted-foreground">{desc}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <NewTokenDialog
        open={showNewDialog}
        onOpenChange={setShowNewDialog}
        onCreated={handleTokenCreated}
      />

      <TokenRevealDialog
        token={newlyCreatedToken}
        onClose={() => setNewlyCreatedToken(null)}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete token?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.name}" will be permanently deleted. Any AI tool using this token
              will lose access immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
