/**
 * Integrations Service — pure async functions, no React imports.
 *
 * Single source of truth for "what integrations does this user have?" and
 * "fire off a manual sync for this integration". Consumed by the
 * `useIntegrationStatuses` / `useTriggerSync` hooks in
 * `@/hooks/useIntegrationSync`.
 *
 * SEC-03D (Phase 38): only `_token_expires` columns are pulled to the client.
 * Provider tokens themselves never leave the server.
 */

import { supabase } from "@/integrations/supabase/client";
import { isLegacyConnectorConnected } from "@/lib/connector-legacy-status";
import { getConnectorSyncFunctionName } from "@/lib/connector-sync-functions";
import {
  INTEGRATION_PLATFORMS,
  usesLegacySourceLessSync,
  type IntegrationPlatform,
} from "@/lib/integration-platforms";

export type { IntegrationPlatform };

export interface IntegrationStatus {
  platform: IntegrationPlatform;
  connected: boolean;
  lastSyncAt: string | null;
  syncStatus: "idle" | "syncing" | "error";
  syncError?: string;
  email?: string;
  sourceId?: string | null;
}

interface UserSettingsRow {
  user_id: string;
  fathom_api_key: string | null;
  oauth_token_expires: number | null;
  google_oauth_token_expires: number | null;
  google_oauth_email: string | null;
  google_last_poll_at: string | null;
  zoom_oauth_token_expires: number | null;
}

interface ImportSourceRow {
  id: string;
  source_app: IntegrationPlatform;
  is_active: boolean;
  account_email: string | null;
  last_sync_at: string | null;
  error_message: string | null;
  oauth_token_expires: number | null;
  updated_at: string;
}

/**
 * Read user_settings + import_sources for the given user, and derive a
 * per-platform connection/sync/error snapshot for every entry in
 * INTEGRATION_PLATFORMS. Pure: no React, no toasts, no caching.
 */
export async function getIntegrationStatuses(
  userId: string,
): Promise<IntegrationStatus[]> {
  const [
    { data: settings, error: settingsError },
    { data: sourceRows, error: sourcesError },
  ] = await Promise.all([
    supabase
      .from("user_settings")
      .select(`
        user_id,
        fathom_api_key,
        oauth_token_expires,
        google_oauth_token_expires,
        google_oauth_email,
        google_last_poll_at,
        zoom_oauth_token_expires
      `)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("import_sources")
      .select(
        "id, source_app, is_active, account_email, last_sync_at, error_message, oauth_token_expires, updated_at",
      )
      .eq("user_id", userId)
      .in("source_app", [...INTEGRATION_PLATFORMS])
      .order("updated_at", { ascending: false }),
  ]);

  if (settingsError) throw settingsError;
  if (sourcesError) throw sourcesError;

  const now = Date.now();
  const activeSourceByPlatform = new Map<IntegrationPlatform, ImportSourceRow>();

  for (const source of (sourceRows ?? []) as ImportSourceRow[]) {
    const tokenValid =
      source.oauth_token_expires === null ||
      source.oauth_token_expires > now ||
      hasServerSideOAuthRefresh(source.source_app);
    if (
      source.is_active &&
      tokenValid &&
      !activeSourceByPlatform.has(source.source_app)
    ) {
      activeSourceByPlatform.set(source.source_app, source);
    }
  }

  const result: IntegrationStatus[] = [];
  for (const platform of INTEGRATION_PLATFORMS) {
    const source = activeSourceByPlatform.get(platform);
    result.push({
      platform,
      connected:
        Boolean(source) ||
        isLegacyConnectorConnected({
          sourceApp: platform,
          settings: (settings as UserSettingsRow | null) ?? null,
          now,
        }),
      lastSyncAt: source?.last_sync_at ?? null,
      syncStatus: "idle",
      syncError: source?.error_message ?? undefined,
      email: source?.account_email ?? undefined,
      sourceId: source?.id ?? null,
    });
  }

  return result;
}

/**
 * Invoke the connector sync edge function for `platform`. If `sourceId` is
 * present, the source-aware function body is used; otherwise the legacy
 * source-less path is invoked.
 *
 * Throws when:
 *   - the platform uses the legacy source-less Fathom flow (caller must
 *     route them to the SyncTab date picker instead)
 *   - no sync function is registered for the platform
 *   - the edge function returns a non-2xx
 */
export async function triggerIntegrationSync(
  platform: IntegrationPlatform,
  sourceId: string | null,
): Promise<void> {
  if (usesLegacySourceLessSync({ platform, sourceId })) {
    throw new LegacySourceLessSyncError(platform);
  }

  const fnName = getConnectorSyncFunctionName(platform);
  if (!fnName) {
    throw new Error(`No sync function configured for ${platform}`);
  }

  const { error: invokeError } = await supabase.functions.invoke(fnName, {
    body: sourceId ? { sourceId } : {},
  });

  if (invokeError) {
    throw invokeError;
  }
}

/**
 * Thrown by `triggerIntegrationSync` when the platform requires the legacy
 * date-scoped SyncTab flow rather than an edge-function sync. Callers should
 * catch and route the user to the date picker.
 */
export class LegacySourceLessSyncError extends Error {
  readonly platform: IntegrationPlatform;
  constructor(platform: IntegrationPlatform) {
    super(`Platform ${platform} uses the legacy source-less sync flow`);
    this.name = "LegacySourceLessSyncError";
    this.platform = platform;
  }
}

/**
 * Zoom and Read.ai refresh access tokens server-side, so an expired
 * `oauth_token_expires` in the client snapshot is not authoritative for
 * "is the integration connected?" — the refresh job repairs it.
 */
function hasServerSideOAuthRefresh(platform: IntegrationPlatform): boolean {
  return platform === "read-ai" || platform === "grain";
}
