/**
 * Source registry — single typed source-of-truth for every transcript / recording
 * source surfaced in the import flow. Replaces the inline TILES array that used
 * to live in `src/components/import/AddImportSourceDialog.tsx`.
 *
 * Adding a new source = add a single entry here for import navigation/listing
 * metadata. Connector setup behavior lives in the connector registry.
 *
 * Design contract:
 * - `id` is the canonical lowercase kebab-case identifier; it MUST match
 *   `CanonicalRecording.sourceApp` for any source that produces canonical
 *   recordings (see `supabase/functions/_shared/canonical-recording.ts`).
 * - `adapter` selects broad runtime ownership:
 *   - `native` — CallVault owns the OAuth/API code.
 *   - `internal` — In-product surface that doesn't touch an external vendor
 *      (file upload, paste-transcript). Has no auth/webhook.
 */

import {
  RiCloudLine,
  RiVideoLine,
  RiYoutubeLine,
  RiUploadCloud2Line,
  RiClipboardLine,
} from "@remixicon/react";
import type { ComponentType } from "react";

export type SourceAdapter = "native" | "internal";

export type AuthMode =
  | "oauth2"
  | "api-key"
  | "token-paste"
  | "public-url"
  | "none";

export interface SourceConfig {
  id: string;
  label: string;
  subtitle: string;
  icon: ComponentType<{ className?: string }>;
  indicatorClass: string;
  onboardingLink?: {
    href: string;
    label: string;
  };
  adapter: SourceAdapter;
  authMode: AuthMode;
  /** Whether the vendor delivers webhooks (vs polling). */
  hasWebhook: boolean;
  /** Public Edge Function that accepts incoming provider webhook deliveries. */
  webhookFunctionName?: string;
  /** User-authenticated Edge Function that returns or saves webhook setup state. */
  webhookSettingsFunctionName?: string;
  /**
   * Edge Function that registers provider webhooks after connect/token save.
   * Manual webhook setup sources leave this unset.
   */
  webhookRegistrationFunctionName?: string;
  /**
   * Edge Function that can start a sync/import job for this source. Used by
   * retry and post-connect auto-sync flows; sources without a retryable remote
   * fetch leave this unset.
   */
  syncFunctionName?: string;
  /** Edge Function that searches/list-fetches importable remote calls. */
  searchFunctionName?: string;
  /** Edge Function that saves API-key/token-style credentials. */
  credentialFunctionName?: string;
  /** Edge Function that starts OAuth for this source. */
  oauthUrlFunctionName?: string;
  /** Edge Function that completes OAuth for this source. */
  oauthCallbackFunctionName?: string;
  /**
   * Optional Edge Function that performs provider-side cleanup before local
   * disconnect. Connectors without remote teardown use the shared disconnect
   * RPC and leave this unset.
   */
  disconnectFunctionName?: string;
  /**
   * Connector status, surfaced in UI badges.
   * - `stable` — has at least one canonical recording flowing through production.
   * - `beta` — code merged, low usage, may still drift.
   * - `scaffold` — adapter exists but is not exercised end-to-end yet.
   */
  status: "stable" | "beta" | "scaffold";
  /**
   * Whether this source should appear in user-facing picker/list surfaces.
   * Hidden sources can remain registered for historical data and future re-enable.
   */
  uiVisible?: boolean;
}

/**
 * Canonical registry. Ordering controls UI presentation in
 * `AddImportSourceDialog` and `ImportSourcePane`.
 *
 * IMPORTANT: do not reorder or remove existing entries without updating import
 * source pane expectations.
 */
export const SOURCE_REGISTRY = [
  {
    id: "fathom",
    label: "Fathom",
    subtitle: "Connect your Fathom account via OAuth",
    icon: RiCloudLine,
    indicatorClass: "bg-blue-400",
    onboardingLink: {
      href: "https://fathom.video/invite/VibeOS",
      label: "Don't have Fathom? Get it free",
    },
    adapter: "native",
    authMode: "oauth2",
    hasWebhook: true,
    webhookFunctionName: "webhook",
    webhookRegistrationFunctionName: "create-fathom-webhook",
    syncFunctionName: "sync-meetings",
    searchFunctionName: "fetch-meetings",
    oauthUrlFunctionName: "fathom-oauth-url",
    oauthCallbackFunctionName: "fathom-oauth-callback",
    status: "stable",
  },
  {
    id: "zoom",
    label: "Zoom",
    subtitle: "Connect Zoom Cloud Recordings via OAuth",
    icon: RiVideoLine,
    indicatorClass: "bg-blue-600",
    adapter: "native",
    authMode: "oauth2",
    hasWebhook: true,
    webhookFunctionName: "zoom-webhook",
    syncFunctionName: "zoom-sync-meetings",
    searchFunctionName: "zoom-fetch-meetings",
    oauthUrlFunctionName: "zoom-oauth-url",
    oauthCallbackFunctionName: "zoom-oauth-callback",
    status: "stable",
  },
  {
    id: "fireflies",
    label: "Fireflies",
    subtitle: "Import Fireflies transcripts with an API key",
    icon: RiCloudLine,
    indicatorClass: "bg-red-400",
    adapter: "native",
    authMode: "api-key",
    hasWebhook: true,
    webhookFunctionName: "fireflies-webhook",
    webhookSettingsFunctionName: "fireflies-connection-details",
    syncFunctionName: "fireflies-sync-meetings",
    searchFunctionName: "fireflies-fetch-meetings",
    credentialFunctionName: "fireflies-save-source",
    status: "stable",
  },
  {
    id: "read-ai",
    label: "Read.ai",
    subtitle: "Import Read.ai meeting reports and transcripts",
    icon: RiCloudLine,
    indicatorClass: "bg-indigo-500",
    adapter: "native",
    authMode: "oauth2",
    hasWebhook: true,
    webhookFunctionName: "read-ai-webhook",
    webhookSettingsFunctionName: "read-ai-webhook-settings",
    syncFunctionName: "read-ai-sync-meetings",
    searchFunctionName: "read-ai-fetch-meetings",
    credentialFunctionName: "read-ai-connect-token",
    oauthUrlFunctionName: "read-ai-oauth-url",
    oauthCallbackFunctionName: "read-ai-oauth-callback",
    status: "beta",
  },
  {
    id: "grain",
    label: "Grain",
    subtitle: "Import Grain recordings and transcripts",
    icon: RiCloudLine,
    indicatorClass: "bg-orange-500",
    adapter: "native",
    authMode: "oauth2",
    hasWebhook: true,
    webhookFunctionName: "grain-webhook",
    webhookRegistrationFunctionName: "grain-create-webhooks",
    syncFunctionName: "grain-sync-recordings",
    searchFunctionName: "grain-fetch-recordings",
    credentialFunctionName: "grain-connect-token",
    oauthUrlFunctionName: "grain-oauth-url",
    oauthCallbackFunctionName: "grain-oauth-callback",
    disconnectFunctionName: "grain-disconnect",
    status: "beta",
    uiVisible: false,
  },
  {
    id: "plaud",
    label: "Plaud",
    subtitle: "Connect Plaud recordings with a web access token",
    icon: RiCloudLine,
    indicatorClass: "bg-violet-500",
    adapter: "native",
    authMode: "token-paste",
    hasWebhook: false,
    syncFunctionName: "plaud-sync-recordings",
    searchFunctionName: "plaud-sync-recordings",
    credentialFunctionName: "plaud-connect-token",
    oauthUrlFunctionName: "plaud-oauth-url",
    oauthCallbackFunctionName: "plaud-oauth-callback",
    status: "beta",
  },
  {
    id: "youtube",
    label: "YouTube",
    subtitle: "Import calls from public YouTube URLs",
    icon: RiYoutubeLine,
    indicatorClass: "bg-red-500",
    adapter: "native",
    authMode: "public-url",
    hasWebhook: false,
    syncFunctionName: "youtube-import",
    status: "stable",
  },
  {
    id: "file-upload",
    label: "File Upload",
    subtitle: "Upload audio or video files directly",
    icon: RiUploadCloud2Line,
    indicatorClass: "bg-muted-foreground",
    adapter: "internal",
    authMode: "none",
    hasWebhook: false,
    status: "stable",
  },
  {
    id: "paste-transcript",
    label: "Paste Transcript",
    subtitle: "Manually paste or upload a transcript",
    icon: RiClipboardLine,
    indicatorClass: "bg-muted-foreground",
    adapter: "internal",
    authMode: "none",
    hasWebhook: false,
    status: "stable",
  },
] as const satisfies readonly SourceConfig[];

export const VISIBLE_SOURCE_REGISTRY = SOURCE_REGISTRY.filter(
  (source) => source.uiVisible !== false,
);

/**
 * Stable union derived from registry entries. Keep AddImportSourceChoice
 * importable from this file so callers don't need to depend on the dialog.
 */
export type SourceId = (typeof SOURCE_REGISTRY)[number]["id"];
export type SourceConfigEntry = (typeof SOURCE_REGISTRY)[number];

/**
 * Legacy or derived source_app values that should display as a canonical
 * registry source. Keep aliases here so labels, icons, indicators, and sort
 * order cannot drift across components.
 */
export const SOURCE_ALIASES = {
  "fathom-paste": "fathom",
} as const satisfies Readonly<Record<string, SourceId>>;

export type SourceAlias = keyof typeof SOURCE_ALIASES;

const REGISTRY_BY_ID: Readonly<Record<SourceId, SourceConfigEntry>> =
  Object.fromEntries(
    SOURCE_REGISTRY.map((entry) => [entry.id, entry]),
  ) as Record<SourceId, SourceConfigEntry>;

export function getSourceConfig(id: SourceId): SourceConfigEntry {
  const config = REGISTRY_BY_ID[id];
  if (!config) {
    throw new Error(`[source-registry] Unknown source id: ${id}`);
  }
  return config;
}

export function tryGetSourceConfig(id: string): SourceConfigEntry | undefined {
  return (REGISTRY_BY_ID as Record<string, SourceConfigEntry | undefined>)[id];
}

export function getCanonicalSourceId(id: SourceId | SourceAlias): SourceId;
export function getCanonicalSourceId(id: string): SourceId | string;
export function getCanonicalSourceId(id: string): SourceId | string {
  return (SOURCE_ALIASES as Record<string, SourceId | undefined>)[id] ?? id;
}

/**
 * Source display name resolver. Centralized so detail-panel headers,
 * disconnect dialogs, and the alert dialog don't drift.
 */
export function getSourceDisplayName(id: string): string {
  return tryGetSourceConfig(getCanonicalSourceId(id))?.label ?? id;
}
