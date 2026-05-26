/**
 * ConnectorPanel — import overview source card for ANY connector.
 *
 * Setup, reconnect, disconnect, credential editing, webhook verification, and
 * onboarding are owned by ConnectorSetupCluster. This component intentionally
 * has no lifecycle actions so the import overview cannot drift from the shared
 * setup flow.
 */

import * as React from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import { useConnector } from "./hooks/useConnector";
import { getConnectorAdapter } from "./registry/connectorRegistry";
import type {
  ConnectorMetadata,
  ConnectorSourceApp,
  ConnectorStatus,
} from "./registry/types";

interface ConnectorPanelProps {
  sourceApp: ConnectorSourceApp;
  /** Optional callback when the card variant is clicked (Import dashboard). */
  onClick?: () => void;
  /** Optional class override applied to the outer container. */
  className?: string;
  /**
   * Optional per-source call/import count rendered below the status badge.
   * Pass 0 or omit to render an em-dash.
   */
  count?: number;
}

export function ConnectorPanel({
  sourceApp,
  onClick,
  className,
  count,
}: ConnectorPanelProps) {
  const adapter = getConnectorAdapter(sourceApp);
  const { status, isLoading } = useConnector(sourceApp);

  if (isLoading || !status) {
    return (
      <ConnectorPanelSkeleton
        metadata={adapter.metadata}
        className={className}
      />
    );
  }

  return (
    <CardLayout
      metadata={adapter.metadata}
      status={status}
      onClick={onClick}
      className={className}
      count={count}
    />
  );
}

// ────────────────────────────────────────────────────────────────────────
// Shared sub-components
// ────────────────────────────────────────────────────────────────────────

interface StatusBadgeProps {
  status: ConnectorStatus;
}

function ConnectorStatusBadge({ status }: StatusBadgeProps) {
  if (status.errorMessage) {
    return <StatusBadge variant="error" label="Connection error" />;
  }
  if (status.connected) {
    return <StatusBadge variant="connected" />;
  }
  if (status.hasEverConnected && status.tokenExpired) {
    return <StatusBadge variant="warning" label="Expired" />;
  }
  return <StatusBadge variant="setupNeeded" />;
}

interface SourceIconProps {
  metadata: ConnectorMetadata;
  size?: number;
}

function SourceIcon({ metadata, size = 16 }: SourceIconProps) {
  const Icon = metadata.icon;
  return (
    <div
      className="flex items-center justify-center rounded-lg bg-muted border border-border shrink-0"
      style={{ width: size + 20, height: size + 20 }}
    >
      <Icon className="text-muted-foreground" size={size} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Layout: card (Import dashboard)
// ────────────────────────────────────────────────────────────────────────

interface CardLayoutProps {
  metadata: ConnectorMetadata;
  status: ConnectorStatus;
  onClick?: () => void;
  className?: string;
  count?: number;
}

function CardLayout({
  metadata,
  status,
  onClick,
  className,
  count,
}: CardLayoutProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-xl border border-border/60 bg-card p-4 text-left transition-colors",
        "hover:border-border cursor-pointer",
        "flex items-start gap-3 group",
        className,
      )}
    >
      <SourceIcon metadata={metadata} size={16} />
      <div className="flex-1 min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground">
            {metadata.label}
          </p>
          {metadata.badge === "beta" && <StatusBadge variant="beta" />}
        </div>
        <div className="mt-0.5">
          <ConnectorStatusBadge status={status} />
        </div>
        <p className="text-xs text-muted-foreground mt-1 tabular-nums">
          {count && count > 0
            ? `${count} call${count !== 1 ? "s" : ""} imported`
            : "—"}
        </p>
      </div>
    </button>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Skeleton (loading state)
// ────────────────────────────────────────────────────────────────────────

interface SkeletonProps {
  metadata: ConnectorMetadata;
  className?: string;
}

function ConnectorPanelSkeleton({
  metadata,
  className,
}: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4 flex items-start gap-3 opacity-50 animate-pulse",
        className,
      )}
    >
      <SourceIcon metadata={metadata} size={16} />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-4 w-20 bg-muted rounded" />
        <div className="h-3 w-16 bg-muted rounded" />
      </div>
    </div>
  );
}
