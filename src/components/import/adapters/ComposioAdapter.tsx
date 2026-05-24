/**
 * ComposioAdapter — @composio-unverified
 *
 * UI surface for sources whose OAuth + transport are delegated to Composio
 * (composio.dev). Designed for the enterprise call-platform tier covered by
 * Composio's catalog: Gong, Dialpad, Webex, Microsoft Teams, Google Meet.
 *
 * Status: SCAFFOLD. This component is not exercised end-to-end yet. The
 * supporting edge functions (`composio-oauth-callback`,
 * `composio-trigger-webhook`) and Composio account provisioning land in
 * Phase B per ADR-006. Until Phase B is accepted:
 *   - This adapter MUST NOT be wired into ImportPage's render path.
 *   - It MUST NOT be referenced from a registry entry with adapter='composio'
 *     unless that entry's `status` is 'scaffold'.
 *
 * Reviewers: if you see this rendered in production traffic, that is the bug.
 */

import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import type { SourceConfig } from "@/config/source-registry";
import type { ImportSource } from "@/services/import-sources.service";

export interface ComposioAdapterProps {
  source: SourceConfig;
  sourceRow: ImportSource | null;
  onDisconnect?: (source: ImportSource) => void;
}

export function ComposioAdapter({
  source,
  sourceRow,
  onDisconnect,
}: ComposioAdapterProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const composioAccountId = readComposioAccountId(sourceRow);
  const isConnected = !!sourceRow?.is_active && !!composioAccountId;

  if (!source.composioToolkit) {
    return (
      <UnconfiguredNotice
        sourceLabel={source.label}
        reason={`No Composio toolkit slug is configured for ${source.id} — fix the registry entry.`}
      />
    );
  }

  async function handleConnect() {
    setIsConnecting(true);
    try {
      // @composio-unverified — the `composio-oauth-callback` edge function
      // does not exist yet. This call WILL fail until Phase B ships and a
      // Composio account is provisioned with API credentials.
      const { data, error } = await supabase.functions.invoke(
        "composio-oauth-callback",
        {
          body: {
            action: "initiate",
            toolkit: source.composioToolkit,
            sourceId: sourceRow?.id ?? null,
          },
        },
      );

      if (error || !data?.authUrl) {
        throw new Error(error?.message || "Composio OAuth initiation failed");
      }

      window.open(data.authUrl as string, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Composio connect failed",
      );
    } finally {
      setIsConnecting(false);
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <PageHeader
        title={source.label}
        subtitle={source.subtitle}
        icon={source.icon}
      />

      <div className="px-6 py-4 max-w-2xl space-y-4">
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              {isConnected
                ? `${source.label} connected`
                : `Connect ${source.label}`}
            </h3>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground/80 px-1.5 py-0.5 rounded border border-border">
              via Composio
            </span>
          </div>
          {sourceRow?.account_email && (
            <p className="text-xs text-muted-foreground">
              Connected as {sourceRow.account_email}
            </p>
          )}
          {composioAccountId && (
            <p className="text-[11px] text-muted-foreground font-mono">
              composio:{composioAccountId.slice(0, 8)}…
            </p>
          )}
          {sourceRow?.last_sync_at && (
            <p className="text-xs text-muted-foreground">
              Last sync: {new Date(sourceRow.last_sync_at).toLocaleString()}
            </p>
          )}
          {sourceRow?.error_message && (
            <p className="text-xs text-destructive">
              {sourceRow.error_message}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {source.label} is routed through Composio. OAuth credentials, token
            refresh, and webhook signing are managed by Composio's
            infrastructure (see ADR-006).
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="default"
            onClick={() => void handleConnect()}
            disabled={isConnecting}
          >
            {isConnecting
              ? "Opening Composio…"
              : isConnected
                ? `Reconnect ${source.label}`
                : `Connect ${source.label}`}
          </Button>
          {isConnected && sourceRow && onDisconnect && (
            <Button variant="hollow" onClick={() => onDisconnect(sourceRow)}>
              Disconnect
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function UnconfiguredNotice({
  sourceLabel,
  reason,
}: {
  sourceLabel: string;
  reason: string;
}) {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-6 py-4 max-w-2xl">
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground">
            {sourceLabel} — configuration error
          </h3>
          <p className="text-xs text-muted-foreground">{reason}</p>
        </div>
      </div>
    </div>
  );
}

function readComposioAccountId(row: ImportSource | null): string | null {
  if (!row) return null;
  // Prefer the dedicated column (typed, indexed). Fall back to the legacy
  // JSONB key only if a row was written by a pre-fix client and never
  // upserted again — once the row goes through composio-oauth-callback
  // post-fix the typed column is the source of truth.
  if (
    typeof row.composio_connected_account_id === "string" &&
    row.composio_connected_account_id.trim()
  ) {
    return row.composio_connected_account_id;
  }
  const legacy = row.connection_metadata?.["composio_connected_account_id"];
  return typeof legacy === "string" && legacy.trim() ? legacy : null;
}

export default ComposioAdapter;
