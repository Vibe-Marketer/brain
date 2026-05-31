/**
 * useConnector — canonical status hook for any integration.
 *
 * Issue #283 — Phase 1. This is the SINGLE source of truth that every
 * consumer surface uses (Settings, Import dashboard, Import detail, Setup
 * Wizard, anywhere else). It collapses the two divergent paths today
 * (`useIntegrationSync` reading user_settings vs. `useImportSources`
 * reading import_sources) into one canonical answer.
 *
 * It reads:
 *   - import_sources rows for this user + source_app (multi-account-aware)
 *   - user_settings.fathom_api_key + oauth_token_expires (legacy fallback)
 *
 * It returns ConnectorStatus with a single `connected: boolean` that every
 * surface can trust.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getSafeUser } from "@/lib/auth-utils";
import { isConnectorAlwaysAvailable } from "@/lib/connector-availability";
import {
  getLegacyConnectorAccountEmail,
  isLegacyConnectorConnected,
  type ConnectorLegacySettings,
} from "@/lib/connector-legacy-status";
import { queryKeys } from "@/lib/query-config";
import type { QueryClient } from "@tanstack/react-query";
import type {
  ConnectorLifecycleStatus,
  ConnectorRow,
  ConnectorSourceApp,
  ConnectorStatus,
} from "../registry/types";
import { getConnectorAdapter } from "../registry/connectorRegistry";
import { disconnectConnectorSource } from "../registry/adapters/adapter-helpers";

/**
 * Query key. Exported so callers can invalidate after connect/disconnect
 * without re-fetching directly. Per-source so disconnecting Fathom doesn't
 * invalidate Zoom.
 */
export function connectorQueryKey(
  sourceApp: ConnectorSourceApp,
): readonly unknown[] {
  return ["connector", sourceApp] as const;
}

interface UserSettingsRow extends ConnectorLegacySettings {
  webhook_secret: string | null;
}

/**
 * Synchronously interpret the rows + settings into ConnectorStatus.
 * Pure function — testable without React.
 */
export function deriveConnectorStatus(args: {
  sourceApp: ConnectorSourceApp;
  rows: ConnectorRow[];
  userSettings: UserSettingsRow | null;
  now?: number;
}): ConnectorStatus {
  const { sourceApp, rows, userSettings } = args;
  const now = args.now ?? Date.now();

  const activeRows = rows.filter((r) => r.is_active);
  const primary = activeRows[0] ?? null;

  const tokenExpiresMs = primary?.oauth_token_expires ?? null;
  const tokenExpired = tokenExpiresMs !== null && tokenExpiresMs < now;

  const legacyConnected = isLegacyConnectorConnected({
    sourceApp,
    settings: userSettings,
    now,
  });

  const alwaysAvailable = isConnectorAlwaysAvailable(sourceApp);

  const connected =
    alwaysAvailable ||
    (Boolean(primary) &&
      (!tokenExpired || hasServerSideOAuthRefresh(sourceApp))) ||
    legacyConnected;

  const errorRow = rows.find((r) => r.error_message);
  const lifecycleStatus = deriveLifecycleStatus({
    primary,
    errorMessage: errorRow?.error_message ?? null,
    tokenExpired,
    connected,
  });

  return {
    sourceApp,
    connected,
    hasEverConnected: rows.length > 0 || legacyConnected || alwaysAvailable,
    accountEmail:
      primary?.account_email ??
      getLegacyConnectorAccountEmail({ sourceApp, settings: userSettings }),
    lastSyncAt: primary?.last_sync_at ?? null,
    tokenExpiresMs,
    tokenExpired,
    errorMessage: errorRow?.error_message ?? null,
    sourceId: primary?.id ?? null,
    workspaceId: primary?.workspace_id ?? null,
    workspaceName: primary?.workspaceName ?? null,
    lifecycleStatus,
    statusLabel: getLifecycleStatusLabel(lifecycleStatus),
    actionNeeded:
      lifecycleStatus === "reconnect_required" ||
      lifecycleStatus === "error" ||
      lifecycleStatus === "disconnected",
    retryAfter: getRetryAfter(primary?.connection_metadata ?? null),
    allRows: rows,
  };
}

function deriveLifecycleStatus(params: {
  primary: ConnectorRow | null;
  errorMessage: string | null;
  tokenExpired: boolean;
  connected: boolean;
}): ConnectorLifecycleStatus {
  const { primary, errorMessage, tokenExpired, connected } = params;
  const metadata = primary?.connection_metadata ?? {};
  const rawStatus =
    typeof metadata.status === "string" ? metadata.status.toLowerCase() : null;
  const rawError = (errorMessage ?? "").toLowerCase();

  if (!primary && !connected) return "disconnected";
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
    (tokenExpired && !connected) ||
    rawStatus === "reconnect_required" ||
    rawError.includes("reconnect") ||
    rawError.includes("refresh") ||
    rawError.includes("unauthorized") ||
    rawError.includes("invalid_grant")
  ) {
    return "reconnect_required";
  }
  if (errorMessage) return "error";
  if (!primary?.is_active && !connected) return "disconnected";
  return connected ? "connected" : "disconnected";
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

function getRetryAfter(metadata: Record<string, unknown> | null): string | null {
  if (!metadata) return null;
  const value =
    metadata.next_retry_at ??
    metadata.retry_after ??
    metadata.retryAfter ??
    null;
  return typeof value === "string" ? value : null;
}

/**
 * Whether the source's edge functions transparently refresh expired OAuth
 * access tokens (because we store a long-lived refresh token server-side).
 *
 * Sourced from the adapter metadata — see ConnectorMetadata.serverSideOAuthRefresh.
 *
 * Falls back to false (treat as access-token-only) when the adapter isn't
 * registered, since the safest behavior in that edge case is to require
 * re-auth rather than report a stale connector as live.
 */
function hasServerSideOAuthRefresh(sourceApp: ConnectorSourceApp): boolean {
  try {
    return getConnectorAdapter(sourceApp).metadata.serverSideOAuthRefresh ?? false;
  } catch {
    return false;
  }
}

/**
 * Stable React Query key for the shared user_settings + import_sources
 * fetch. Identical across every useConnector call so React Query dedupes
 * the network request — even when 6 ConnectorPanels mount on Settings,
 * only ONE round-trip per table fires.
 *
 * This is the N+1 fix flagged in the 2026-05-23 debug-panel report
 * ("4+ identical requests in 2s to /rest/..."): previously each panel
 * had its own per-source queryKey, so user_settings (which is identical
 * for all panels) was fetched 6× and import_sources was fetched 6× with
 * different source_app filters. Now we fetch all of import_sources once
 * and filter in JS, plus user_settings once.
 */
export const connectorBundleQueryKey = ["connector-bundle"] as const;

export async function invalidateConnectorQueries(
  queryClient: QueryClient,
  sourceApp?: ConnectorSourceApp,
): Promise<void> {
  const invalidations = [
    queryClient.invalidateQueries({ queryKey: connectorBundleQueryKey }),
    queryClient.invalidateQueries({ queryKey: queryKeys.imports.sources() }),
  ];

  if (sourceApp) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: connectorQueryKey(sourceApp) }),
    );
  }

  await Promise.all(invalidations);
}

export { disconnectConnectorSource };

interface ConnectorBundle {
  userId: string | null;
  rowsBySourceApp: Record<string, ConnectorRow[]>;
  userSettings: UserSettingsRow | null;
}

interface WorkspaceLabelRow {
  id: string;
  name: string;
}

async function fetchConnectorBundle(): Promise<ConnectorBundle> {
  const { user, error: authError } = await getSafeUser();
  if (authError || !user) {
    return { userId: null, rowsBySourceApp: {}, userSettings: null };
  }

  const [{ data: rowData, error: rowError }, { data: settingsData }] =
    await Promise.all([
      supabase
        .from("import_sources")
        .select(
          "id, user_id, source_app, is_active, account_email, last_sync_at, error_message, oauth_token_expires, workspace_id, connection_metadata, created_at, updated_at",
        )
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("user_settings")
        .select(
          "fathom_api_key, host_email, webhook_secret, oauth_token_expires, zoom_oauth_token_expires",
        )
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

  if (rowError) throw new Error(rowError.message);

  const rawRows = (rowData ?? []) as ConnectorRow[];
  const workspaceIds = Array.from(
    new Set(rawRows.map((row) => row.workspace_id).filter(Boolean)),
  ) as string[];
  const workspaceNameById = new Map<string, string>();

  if (workspaceIds.length > 0) {
    const { data: workspaceRows, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id, name")
      .in("id", workspaceIds);

    if (workspaceError) throw new Error(workspaceError.message);

    for (const workspace of (workspaceRows ?? []) as WorkspaceLabelRow[]) {
      workspaceNameById.set(workspace.id, workspace.name);
    }
  }

  const rowsBySourceApp: Record<string, ConnectorRow[]> = {};
  for (const row of rawRows) {
    row.workspaceName = row.workspace_id
      ? workspaceNameById.get(row.workspace_id) ?? null
      : null;
    const key = row.source_app;
    if (!rowsBySourceApp[key]) rowsBySourceApp[key] = [];
    rowsBySourceApp[key].push(row);
  }

  return {
    userId: user.id,
    rowsBySourceApp,
    userSettings: (settingsData as UserSettingsRow | null) ?? null,
  };
}

/**
 * React hook. Returns ConnectorStatus + a refresh fn. Polls every 30s by
 * default — same cadence the existing useIntegrationSync uses.
 *
 * Internally calls a single bundle query (deduped across mounts via
 * shared queryKey) and derives per-source status from it. 6 mounted
 * panels = 2 network requests total (not 12).
 */
export function useConnector(sourceApp: ConnectorSourceApp) {
  const queryClient = useQueryClient();

  const bundleQuery = useQuery<ConnectorBundle>({
    queryKey: connectorBundleQueryKey,
    queryFn: fetchConnectorBundle,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const status: ConnectorStatus | null = bundleQuery.data
    ? deriveConnectorStatus({
        sourceApp,
        rows: bundleQuery.data.rowsBySourceApp[sourceApp] ?? [],
        userSettings: bundleQuery.data.userSettings,
      })
    : null;

  return {
    status,
    isLoading: bundleQuery.isLoading,
    error:
      bundleQuery.error instanceof Error ? bundleQuery.error.message : null,
    refresh: () => invalidateConnectorQueries(queryClient, sourceApp),
  };
}

/**
 * @deprecated kept temporarily so any external caller that relied on the
 * per-source query key still compiles. New code should not use this — it
 * triggers redundant fetches. Will be removed once Phase 7 cleanup lands.
 */
export function useConnectorLegacy(sourceApp: ConnectorSourceApp) {
  const queryClient = useQueryClient();

  const query = useQuery<ConnectorStatus>({
    queryKey: connectorQueryKey(sourceApp),
    queryFn: async () => {
      const { user, error: authError } = await getSafeUser();
      if (authError || !user) {
        return deriveConnectorStatus({
          sourceApp,
          rows: [],
          userSettings: null,
        });
      }

      const { data: rowData, error: rowError } = await supabase
        .from("import_sources")
        .select(
          "id, user_id, source_app, is_active, account_email, last_sync_at, error_message, oauth_token_expires, workspace_id, connection_metadata, created_at, updated_at",
        )
        .eq("user_id", user.id)
        .eq("source_app", sourceApp)
        .order("updated_at", { ascending: false });

      if (rowError) throw new Error(rowError.message);

      const rawRows = (rowData ?? []) as ConnectorRow[];
      const workspaceIds = Array.from(
        new Set(rawRows.map((row) => row.workspace_id).filter(Boolean)),
      ) as string[];
      const workspaceNameById = new Map<string, string>();

      if (workspaceIds.length > 0) {
        const { data: workspaceRows, error: workspaceError } = await supabase
          .from("workspaces")
          .select("id, name")
          .in("id", workspaceIds);

        if (workspaceError) throw new Error(workspaceError.message);

        for (const workspace of (workspaceRows ?? []) as WorkspaceLabelRow[]) {
          workspaceNameById.set(workspace.id, workspace.name);
        }
      }

      const { data: settingsData } = await supabase
        .from("user_settings")
        .select(
          "fathom_api_key, host_email, webhook_secret, oauth_token_expires, zoom_oauth_token_expires",
        )
        .eq("user_id", user.id)
        .maybeSingle();

      return deriveConnectorStatus({
        sourceApp,
        rows: rawRows.map((row) => ({
          ...row,
          workspaceName: row.workspace_id
            ? workspaceNameById.get(row.workspace_id) ?? null
            : null,
        })),
        userSettings: (settingsData as UserSettingsRow | null) ?? null,
      });
    },
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  return {
    status: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    refresh: () => invalidateConnectorQueries(queryClient, sourceApp),
  };
}
