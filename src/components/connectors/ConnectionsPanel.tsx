import * as React from "react";
import {
  RiAlertLine,
  RiCheckboxCircleLine,
  RiLoader4Line,
  RiPlugLine,
  RiRefreshLine,
} from "@remixicon/react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { queryKeys } from "@/lib/query-config";
import { cn } from "@/lib/utils";
import {
  type ConnectorAccountWithWorkspace,
} from "@/services/import-sources.service";
import { useConnectorAccounts } from "@/hooks/useImportSources";
import { connectorQueryKey } from "./hooks/useConnector";
import {
  getConnectorAdapter,
  isKnownSourceApp,
} from "./registry/connectorRegistry";
import type {
  ConnectorLifecycleStatus,
  ConnectorSourceApp,
} from "./registry/types";
import { ConnectorManageDialog } from "./ConnectorManageDialog";

export interface ConnectionsPanelProps {
  scope: "workspace" | "global";
  workspaceId?: string | null;
  rows?: ConnectorAccountWithWorkspace[];
  className?: string;
}

export function ConnectionsPanel({
  scope,
  workspaceId,
  rows,
  className,
}: ConnectionsPanelProps) {
  const queryClient = useQueryClient();
  const accountsQuery = useConnectorAccounts();
  const [selected, setSelected] =
    React.useState<ConnectorAccountWithWorkspace | null>(null);
  const [disconnectingId, setDisconnectingId] = React.useState<string | null>(
    null,
  );

  const visibleRows = React.useMemo(() => {
    // Resolve accounts inside memo to avoid logical-expression reference instability
    const accounts = rows ?? accountsQuery.data ?? [];
    return accounts
      .filter((account) => isKnownSourceApp(account.source_app))
      .filter((account) =>
        scope === "workspace" ? account.workspace_id === workspaceId : true,
      )
      .sort((a, b) => {
        const providerCompare = a.source_app.localeCompare(b.source_app);
        if (providerCompare !== 0) return providerCompare;
        return (a.account_email ?? "").localeCompare(b.account_email ?? "");
      });
  }, [rows, accountsQuery.data, scope, workspaceId]);

  const selectedSourceApp = selected?.source_app;
  const selectedAdapter =
    selectedSourceApp && isKnownSourceApp(selectedSourceApp)
      ? getConnectorAdapter(selectedSourceApp)
      : null;
  const selectedLifecycle = selected
    ? deriveAccountLifecycleStatus(selected)
    : "disconnected";
  const selectedStatusLabel = getLifecycleStatusLabel(selectedLifecycle);

  const handleDisconnect = React.useCallback(async () => {
    if (!selected || !selectedAdapter?.disconnect) return;
    setDisconnectingId(selected.id);
    try {
      await selectedAdapter.disconnect(selected.id);
      toast.success(`${selectedAdapter.metadata.label} disconnected`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.imports.sources() }),
        queryClient.invalidateQueries({
          queryKey: connectorQueryKey(selected.source_app as ConnectorSourceApp),
        }),
      ]);
      setSelected(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Disconnect failed",
      );
    } finally {
      setDisconnectingId(null);
    }
  }, [queryClient, selected, selectedAdapter]);

  if (accountsQuery.isLoading && !rows) {
    return (
      <div className={cn("rounded-lg border border-border p-4", className)}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RiLoader4Line className="h-4 w-4 animate-spin" />
          Loading connections
        </div>
      </div>
    );
  }

  return (
    <section className={cn("space-y-3", className)} aria-label="Connections">
      {visibleRows.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          No connector accounts in this view.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="divide-y divide-border">
            {visibleRows.map((account) => (
              <ConnectionRow
                key={account.id}
                account={account}
                disconnecting={disconnectingId === account.id}
                onManage={() => setSelected(account)}
              />
            ))}
          </div>
        </div>
      )}

      <ConnectorManageDialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        account={selected}
        providerLabel={selectedAdapter?.metadata.label ?? "Connector"}
        lifecycleStatus={selectedLifecycle}
        statusLabel={selectedStatusLabel}
        canReconnect={Boolean(
          selectedAdapter?.getOAuthAuthUrl ||
            selectedAdapter?.saveApiKeyCredentials ||
            selected?.source_app === "plaud" ||
            selectedLifecycle === "reconnect_required",
        )}
        canSync={Boolean(
          selected?.is_active &&
            (selectedAdapter?.searchAvailable || selectedAdapter?.importSelected),
        )}
        isPlaud={selected?.source_app === "plaud"}
        onDisconnect={handleDisconnect}
      />
    </section>
  );
}

function ConnectionRow({
  account,
  disconnecting,
  onManage,
}: {
  account: ConnectorAccountWithWorkspace;
  disconnecting: boolean;
  onManage: () => void;
}) {
  const sourceApp = account.source_app as ConnectorSourceApp;
  const adapter = getConnectorAdapter(sourceApp);
  const Icon = adapter.metadata.icon;
  const lifecycle = deriveAccountLifecycleStatus(account);
  const statusLabel = getLifecycleStatusLabel(lifecycle);
  const accountLabel = account.account_email ?? "Connected account";
  const workspaceLabel = account.workspaceName ?? "Default workspace";
  const isPlaud = account.source_app === "plaud";

  return (
    <div className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] sm:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </span>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">
              {adapter.metadata.label}
            </p>
            <LifecycleIcon lifecycle={lifecycle} />
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {accountLabel}
          </p>
        </div>
      </div>

      <div className="grid min-w-0 gap-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <p className="truncate text-sm text-foreground">{workspaceLabel}</p>
        <StatusBadge
          variant={getStatusVariant(lifecycle)}
          label={statusLabel}
        />
      </div>

      <Button
        type="button"
        variant="hollow"
        className="justify-center sm:min-w-[116px]"
        onClick={onManage}
        disabled={disconnecting}
      >
        {disconnecting ? (
          <RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />
        ) : isPlaud ? (
          <RiPlugLine className="mr-2 h-4 w-4" />
        ) : (
          <RiRefreshLine className="mr-2 h-4 w-4" />
        )}
        {isPlaud ? "Manage bridge" : "Manage"}
      </Button>
    </div>
  );
}

function LifecycleIcon({
  lifecycle,
}: {
  lifecycle: ConnectorLifecycleStatus;
}) {
  if (lifecycle === "connected" || lifecycle === "syncing") {
    return <RiCheckboxCircleLine className="h-4 w-4 text-emerald-600" />;
  }
  if (
    lifecycle === "rate_limited" ||
    lifecycle === "partial_sync" ||
    lifecycle === "retrying"
  ) {
    return <RiAlertLine className="h-4 w-4 text-amber-600" />;
  }
  return <RiAlertLine className="h-4 w-4 text-rose-600" />;
}

function deriveAccountLifecycleStatus(
  account: ConnectorAccountWithWorkspace,
): ConnectorLifecycleStatus {
  const metadata = account.connection_metadata ?? {};
  const rawStatus =
    typeof metadata.status === "string" ? metadata.status.toLowerCase() : null;
  const rawError = (account.error_message ?? "").toLowerCase();

  if (rawStatus === "syncing") return "syncing";
  if (rawStatus === "retrying") return "retrying";
  if (rawStatus === "rate_limited" || rawError.includes("rate limit")) {
    return "rate_limited";
  }
  if (
    rawStatus === "partial_sync" ||
    rawStatus === "completed_with_warnings" ||
    rawError.includes("partial")
  ) {
    return "partial_sync";
  }
  if (
    rawStatus === "reconnect_required" ||
    rawError.includes("reconnect") ||
    rawError.includes("refresh") ||
    rawError.includes("unauthorized") ||
    rawError.includes("invalid_grant")
  ) {
    return "reconnect_required";
  }
  if (account.error_message) return "error";
  if (!account.is_active) return "disconnected";
  return "connected";
}

function getLifecycleStatusLabel(status: ConnectorLifecycleStatus): string {
  switch (status) {
    case "connected":
      return "Connected";
    case "syncing":
      return "Syncing";
    case "retrying":
      return "Retrying";
    case "rate_limited":
      return "Rate limited";
    case "partial_sync":
      return "Partial sync";
    case "reconnect_required":
      return "Reconnect required";
    case "error":
      return "Connection error";
    case "disconnected":
      return "Disconnected";
  }
}

function getStatusVariant(status: ConnectorLifecycleStatus) {
  if (status === "connected" || status === "syncing") return "connected";
  if (status === "rate_limited" || status === "partial_sync" || status === "retrying") {
    return "warning";
  }
  if (status === "disconnected") return "inactive";
  return "error";
}
