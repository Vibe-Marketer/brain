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
import type {
  ConnectorRow,
  ConnectorSourceApp,
  ConnectorStatus,
} from "../registry/types";

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

interface UserSettingsRow {
  fathom_api_key: string | null;
  oauth_token_expires: number | null;
  zoom_oauth_token_expires: number | null;
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

  // Legacy user_settings fallback — Fathom can be "connected" via a
  // user_settings.fathom_api_key even if no import_sources row exists yet.
  // Same model for Zoom OAuth (legacy zoom_oauth_token_expires path).
  let legacyConnected = false;
  if (userSettings) {
    if (sourceApp === "fathom") {
      legacyConnected = Boolean(
        userSettings.fathom_api_key ||
        (userSettings.oauth_token_expires &&
          userSettings.oauth_token_expires > now),
      );
    } else if (sourceApp === "zoom") {
      legacyConnected = Boolean(
        userSettings.zoom_oauth_token_expires &&
        userSettings.zoom_oauth_token_expires > now,
      );
    }
  }

  // YouTube + file-upload are always "available" — no auth required.
  const alwaysAvailable =
    sourceApp === "youtube" || sourceApp === "file-upload";

  const connected =
    alwaysAvailable || (Boolean(primary) && !tokenExpired) || legacyConnected;

  const errorRow = rows.find((r) => r.error_message);

  return {
    sourceApp,
    connected,
    hasEverConnected: rows.length > 0 || legacyConnected || alwaysAvailable,
    accountEmail: primary?.account_email ?? null,
    lastSyncAt: primary?.last_sync_at ?? null,
    tokenExpiresMs,
    tokenExpired,
    errorMessage: errorRow?.error_message ?? null,
    sourceId: primary?.id ?? null,
    allRows: rows,
  };
}

/**
 * React hook. Returns ConnectorStatus + a refresh fn. Polls every 30s by
 * default — same cadence the existing useIntegrationSync uses.
 */
export function useConnector(sourceApp: ConnectorSourceApp) {
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

      // Multi-account aware: fetch every row for this user + source_app,
      // not just the first.
      const { data: rowData, error: rowError } = await supabase
        .from("import_sources")
        .select(
          "id, user_id, source_app, is_active, account_email, last_sync_at, error_message, oauth_token_expires, created_at, updated_at",
        )
        .eq("user_id", user.id)
        .eq("source_app", sourceApp)
        .order("updated_at", { ascending: false });

      if (rowError) throw new Error(rowError.message);

      const { data: settingsData } = await supabase
        .from("user_settings")
        .select("fathom_api_key, oauth_token_expires, zoom_oauth_token_expires")
        .eq("user_id", user.id)
        .maybeSingle();

      return deriveConnectorStatus({
        sourceApp,
        rows: (rowData ?? []) as ConnectorRow[],
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
    refresh: () =>
      queryClient.invalidateQueries({
        queryKey: connectorQueryKey(sourceApp),
      }),
  };
}
