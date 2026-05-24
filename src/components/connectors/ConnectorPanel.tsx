/**
 * ConnectorPanel — the single UI primitive for ANY integration in the app.
 *
 * Issue #283 — Phase 2. Renders one of 4 layout variants:
 *
 *   layout="settings"  — matches Settings/IntegrationsTab "Manage Fathom
 *                         Connection" section style (montserrat extrabold
 *                         uppercase header, left-side title + right-side
 *                         action group, two-column grid).
 *   layout="card"      — matches Import dashboard source card (icon +
 *                         label + status + count, clickable).
 *   layout="detail"    — matches per-source ImportDetail pane (large
 *                         header + credentials block + sync log slot).
 *   layout="wizard"    — matches SetupWizard step (centered, larger
 *                         icon + description + single primary action).
 *
 * Every consumer becomes:
 *
 *   <ConnectorPanel sourceApp="fathom" layout="settings" />
 *
 * Status is read via useConnector(sourceApp) — both Settings and Import
 * see the same canonical answer. No consumer reads import_sources or
 * user_settings directly anymore (once migrations land in Phases 3-6).
 *
 * Layout variants share:
 *   - Status badge (Connected / Setup needed / Expired / Error)
 *   - Connect / Disconnect / Edit Credentials action group (filtered by
 *     adapter.metadata.authMethods)
 *   - onClick handler for card variant
 */

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { queryKeys } from "@/lib/query-config";
import {
  RiExternalLinkLine,
  RiSettings3Line,
  RiLoader2Line,
} from "@remixicon/react";
import { toast } from "sonner";
import { useConnector } from "./hooks/useConnector";
import { getConnectorAdapter } from "./registry/connectorRegistry";
import type {
  ConnectorMetadata,
  ConnectorSourceApp,
  ConnectorStatus,
} from "./registry/types";

export type ConnectorPanelLayout = "settings" | "card" | "detail" | "wizard";

interface ConnectorPanelProps {
  sourceApp: ConnectorSourceApp;
  layout: ConnectorPanelLayout;
  /** Optional callback when the card variant is clicked (Import dashboard). */
  onClick?: () => void;
  /** Optional class override applied to the outer container. */
  className?: string;
  /**
   * Optional consumer-supplied actions rendered alongside the canonical
   * Connect / Disconnect / Reconnect buttons. Use for things like
   * "Edit API key" inline forms that the adapter doesn't model.
   *
   * Currently only rendered by the `settings` and `detail` layouts.
   */
  extraActions?: React.ReactNode;
  /** Optional consumer-supplied content rendered BELOW the action group,
   * inside the layout. Used for inline forms (e.g. Fathom credential editor). */
  extraContent?: React.ReactNode;
  /**
   * Optional per-source call/import count rendered below the status badge.
   * Currently only used by the `card` layout (Import dashboard). Pass 0 or
   * omit to render an em-dash.
   */
  count?: number;
}

export function ConnectorPanel({
  sourceApp,
  layout,
  onClick,
  className,
  extraActions,
  extraContent,
  count,
}: ConnectorPanelProps) {
  const adapter = getConnectorAdapter(sourceApp);
  const { status, isLoading, refresh } = useConnector(sourceApp);
  const queryClient = useQueryClient();
  const [isActing, setIsActing] = React.useState(false);

  const handleConnectOAuth = async () => {
    if (!adapter.getOAuthAuthUrl) return;
    setIsActing(true);
    try {
      const { authUrl } = await adapter.getOAuthAuthUrl();
      window.open(authUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(
        `Could not start OAuth: ${err instanceof Error ? err.message : "unknown error"}`,
      );
    } finally {
      setIsActing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!adapter.disconnect || !status?.sourceId) return;
    setIsActing(true);
    try {
      await adapter.disconnect(status.sourceId);
      toast.success(`${adapter.metadata.label} disconnected`);
      await refresh();
      await queryClient.invalidateQueries({
        queryKey: queryKeys.imports.sources(),
      });
    } catch (err) {
      toast.error(
        `Disconnect failed: ${err instanceof Error ? err.message : "unknown error"}`,
      );
    } finally {
      setIsActing(false);
    }
  };

  if (isLoading || !status) {
    return (
      <ConnectorPanelSkeleton
        layout={layout}
        metadata={adapter.metadata}
        className={className}
      />
    );
  }

  switch (layout) {
    case "settings":
      return (
        <SettingsLayout
          metadata={adapter.metadata}
          status={status}
          isActing={isActing}
          onConnectOAuth={
            adapter.getOAuthAuthUrl ? handleConnectOAuth : undefined
          }
          onDisconnect={adapter.disconnect ? handleDisconnect : undefined}
          className={className}
          extraActions={extraActions}
          extraContent={extraContent}
        />
      );

    case "card":
      return (
        <CardLayout
          metadata={adapter.metadata}
          status={status}
          onClick={onClick}
          className={className}
          count={count}
        />
      );

    case "detail":
      return (
        <DetailLayout
          metadata={adapter.metadata}
          status={status}
          isActing={isActing}
          onConnectOAuth={
            adapter.getOAuthAuthUrl ? handleConnectOAuth : undefined
          }
          onDisconnect={adapter.disconnect ? handleDisconnect : undefined}
          className={className}
        />
      );

    case "wizard":
      return (
        <WizardLayout
          metadata={adapter.metadata}
          status={status}
          isActing={isActing}
          onConnectOAuth={
            adapter.getOAuthAuthUrl ? handleConnectOAuth : undefined
          }
          className={className}
        />
      );
  }
}

// ────────────────────────────────────────────────────────────────────────
// Shared sub-components
// ────────────────────────────────────────────────────────────────────────

interface StatusBadgeProps {
  status: ConnectorStatus;
}

function StatusBadge({ status }: StatusBadgeProps) {
  if (status.errorMessage) {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
        Connection error
      </span>
    );
  }
  if (status.connected) {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
        Connected
      </span>
    );
  }
  if (status.hasEverConnected && status.tokenExpired) {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
        Expired
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
      Setup needed
    </span>
  );
}

interface ActionGroupProps {
  status: ConnectorStatus;
  isActing: boolean;
  onConnectOAuth?: () => void;
  onDisconnect?: () => void;
  emphasis?: "primary" | "compact";
}

function ActionGroup({
  status,
  isActing,
  onConnectOAuth,
  onDisconnect,
  emphasis = "primary",
}: ActionGroupProps) {
  const size = emphasis === "compact" ? "sm" : "default";

  if (status.connected) {
    return (
      <div className="flex items-center gap-2">
        {onConnectOAuth && (
          <Button
            variant="hollow"
            size={size}
            onClick={onConnectOAuth}
            disabled={isActing}
          >
            {isActing ? (
              <RiLoader2Line className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RiExternalLinkLine className="mr-2 h-4 w-4" />
            )}
            Reconnect
          </Button>
        )}
        {onDisconnect && (
          <Button
            variant="hollow"
            size={size}
            onClick={onDisconnect}
            disabled={isActing}
          >
            Disconnect
          </Button>
        )}
      </div>
    );
  }

  if (onConnectOAuth) {
    return (
      <Button size={size} onClick={onConnectOAuth} disabled={isActing}>
        {isActing ? (
          <RiLoader2Line className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <RiExternalLinkLine className="mr-2 h-4 w-4" />
        )}
        Connect
      </Button>
    );
  }

  return null;
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
// Layout: settings
// ────────────────────────────────────────────────────────────────────────

interface LayoutProps {
  metadata: ConnectorMetadata;
  status: ConnectorStatus;
  isActing: boolean;
  onConnectOAuth?: () => void;
  onDisconnect?: () => void;
  className?: string;
}

function SettingsLayout({
  metadata,
  status,
  isActing,
  onConnectOAuth,
  onDisconnect,
  className,
  extraActions,
  extraContent,
}: LayoutProps & {
  extraActions?: React.ReactNode;
  extraContent?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3",
        className,
      )}
    >
      <div>
        <h2 className="flex items-center gap-2 font-montserrat font-extrabold uppercase tracking-wide text-sm text-foreground">
          <RiSettings3Line className="h-4 w-4 shrink-0" />
          {metadata.label}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {metadata.description}
        </p>
      </div>
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SourceIcon metadata={metadata} size={20} />
            <div>
              <p className="text-sm font-medium text-foreground">
                {metadata.label}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {status.accountEmail ?? "Not connected"}
              </p>
            </div>
          </div>
          <StatusBadge status={status} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ActionGroup
            status={status}
            isActing={isActing}
            onConnectOAuth={onConnectOAuth}
            onDisconnect={onDisconnect}
          />
          {extraActions}
        </div>
        {extraContent}
      </div>
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
        <p className="text-sm font-medium text-foreground truncate">
          {metadata.label}
        </p>
        <div className="mt-0.5">
          <StatusBadge status={status} />
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
// Layout: detail (per-source ImportDetail pane)
// ────────────────────────────────────────────────────────────────────────

function DetailLayout({
  metadata,
  status,
  isActing,
  onConnectOAuth,
  onDisconnect,
  className,
}: LayoutProps) {
  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <SourceIcon metadata={metadata} size={24} />
          <div>
            <h1 className="font-montserrat font-extrabold uppercase tracking-wide text-base text-foreground">
              {metadata.label}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {metadata.description}
            </p>
            <div className="mt-2">
              <StatusBadge status={status} />
            </div>
          </div>
        </div>
        <ActionGroup
          status={status}
          isActing={isActing}
          onConnectOAuth={onConnectOAuth}
          onDisconnect={onDisconnect}
        />
      </div>
      {status.accountEmail && (
        <p className="text-xs text-muted-foreground">
          Connected as{" "}
          <span className="font-medium text-foreground">
            {status.accountEmail}
          </span>
          {status.lastSyncAt && (
            <>
              {" "}
              · Last sync{" "}
              <time>{new Date(status.lastSyncAt).toLocaleString()}</time>
            </>
          )}
        </p>
      )}
      {status.errorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {status.errorMessage}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Layout: wizard (SetupWizard step)
// ────────────────────────────────────────────────────────────────────────

function WizardLayout({
  metadata,
  status,
  isActing,
  onConnectOAuth,
  className,
}: Omit<LayoutProps, "onDisconnect">) {
  return (
    <div
      className={cn(
        "flex flex-col items-center text-center space-y-6 py-8",
        className,
      )}
    >
      <SourceIcon metadata={metadata} size={32} />
      <div className="space-y-2 max-w-md">
        <h2 className="font-montserrat font-extrabold uppercase tracking-wide text-lg text-foreground">
          Connect {metadata.label}
        </h2>
        <p className="text-sm text-muted-foreground">{metadata.description}</p>
      </div>
      {status.connected ? (
        <div className="space-y-2">
          <StatusBadge status={status} />
          <p className="text-xs text-muted-foreground">
            {metadata.label} is already connected. You can continue.
          </p>
        </div>
      ) : (
        <ActionGroup
          status={status}
          isActing={isActing}
          onConnectOAuth={onConnectOAuth}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Skeleton (loading state)
// ────────────────────────────────────────────────────────────────────────

interface SkeletonProps {
  layout: ConnectorPanelLayout;
  metadata: ConnectorMetadata;
  className?: string;
}

function ConnectorPanelSkeleton({
  layout,
  metadata,
  className,
}: SkeletonProps) {
  if (layout === "card") {
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
  return (
    <div
      className={cn(
        "flex items-center gap-3 opacity-50 animate-pulse",
        className,
      )}
    >
      <SourceIcon metadata={metadata} size={20} />
      <div className="space-y-2">
        <div className="h-4 w-24 bg-muted rounded" />
        <div className="h-3 w-32 bg-muted rounded" />
      </div>
    </div>
  );
}
