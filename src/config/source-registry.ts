/**
 * Source registry — single typed source-of-truth for every transcript / recording
 * source surfaced in the import flow. Replaces the inline TILES array that used
 * to live in `src/components/import/AddImportSourceDialog.tsx`.
 *
 * Adding a new source = add a single entry here. Downstream consumers
 * (AddImportSourceDialog, ConnectorDetailPanel, adapter dispatcher) read from
 * this registry — no other files need to change.
 *
 * Design contract:
 * - `id` is the canonical lowercase kebab-case identifier; it MUST match
 *   `CanonicalRecording.sourceApp` for any source that produces canonical
 *   recordings (see `supabase/functions/_shared/canonical-recording.ts`).
 * - `adapter` selects which front-end + back-end adapter handles the source.
 *   - `native` — CallVault owns the OAuth/API code (today's pattern).
 *   - `composio` — Composio handles auth + transport; CallVault only normalizes
 *      the canonical payload. Requires `composioToolkit`. @composio-unverified
 *      until ADR-006 is accepted and the Composio account is provisioned.
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

/**
 * Stable union derived from registry entries. Keep AddImportSourceChoice
 * importable from this file so callers don't need to depend on the dialog.
 */
export type SourceId =
  | "fathom"
  | "zoom"
  | "fireflies"
  | "read-ai"
  | "grain"
  | "plaud"
  | "youtube"
  | "file-upload"
  | "paste-transcript";

export type SourceAdapter = "native" | "composio" | "internal";

export type AuthMode =
  | "oauth2"
  | "api-key"
  | "token-paste"
  | "public-url"
  | "none";

export interface SourceConfig {
  id: SourceId;
  label: string;
  subtitle: string;
  icon: ComponentType<{ className?: string }>;
  adapter: SourceAdapter;
  authMode: AuthMode;
  /** Whether the vendor delivers webhooks (vs polling). */
  hasWebhook: boolean;
  /** Composio toolkit slug — required iff adapter === 'composio'. */
  composioToolkit?: string;
  /**
   * Connector status, surfaced in UI badges.
   * - `stable` — has at least one canonical recording flowing through production.
   * - `beta` — code merged, low usage, may still drift.
   * - `scaffold` — adapter exists but is not exercised end-to-end yet.
   */
  status: "stable" | "beta" | "scaffold";
}

/**
 * Canonical registry. Ordering controls UI presentation in
 * `AddImportSourceDialog` and `ImportSourcePane`.
 *
 * IMPORTANT: do not reorder or remove existing entries without updating the
 * `SourceId` union and the migration plan in SPEC-connector-framework.md.
 */
export const SOURCE_REGISTRY: readonly SourceConfig[] = [
  {
    id: "fathom",
    label: "Fathom",
    subtitle: "Connect your Fathom account via OAuth",
    icon: RiCloudLine,
    adapter: "native",
    authMode: "oauth2",
    hasWebhook: true,
    status: "stable",
  },
  {
    id: "zoom",
    label: "Zoom",
    subtitle: "Connect Zoom Cloud Recordings via OAuth",
    icon: RiVideoLine,
    adapter: "native",
    authMode: "oauth2",
    hasWebhook: true,
    status: "stable",
  },
  {
    id: "fireflies",
    label: "Fireflies",
    subtitle: "Import Fireflies transcripts with an API key",
    icon: RiCloudLine,
    adapter: "native",
    authMode: "api-key",
    hasWebhook: true,
    status: "stable",
  },
  {
    id: "read-ai",
    label: "Read.ai",
    subtitle: "Import Read.ai meeting reports and transcripts",
    icon: RiCloudLine,
    adapter: "native",
    authMode: "oauth2",
    hasWebhook: false,
    status: "beta",
  },
  {
    id: "grain",
    label: "Grain",
    subtitle: "Import Grain recordings and transcripts",
    icon: RiCloudLine,
    adapter: "native",
    authMode: "oauth2",
    hasWebhook: true,
    status: "beta",
  },
  {
    id: "plaud",
    label: "Plaud",
    subtitle: "Connect Plaud recordings with a web access token",
    icon: RiCloudLine,
    adapter: "native",
    authMode: "token-paste",
    hasWebhook: false,
    status: "stable",
  },
  {
    id: "youtube",
    label: "YouTube",
    subtitle: "Import calls from public YouTube URLs",
    icon: RiYoutubeLine,
    adapter: "native",
    authMode: "public-url",
    hasWebhook: false,
    status: "stable",
  },
  {
    id: "file-upload",
    label: "File Upload",
    subtitle: "Upload audio or video files directly",
    icon: RiUploadCloud2Line,
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
    adapter: "internal",
    authMode: "none",
    hasWebhook: false,
    status: "stable",
  },
] as const;

const REGISTRY_BY_ID: Readonly<Record<SourceId, SourceConfig>> =
  Object.fromEntries(
    SOURCE_REGISTRY.map((entry) => [entry.id, entry]),
  ) as Record<SourceId, SourceConfig>;

export function getSourceConfig(id: SourceId): SourceConfig {
  const config = REGISTRY_BY_ID[id];
  if (!config) {
    throw new Error(`[source-registry] Unknown source id: ${id}`);
  }
  return config;
}

export function tryGetSourceConfig(id: string): SourceConfig | undefined {
  return (REGISTRY_BY_ID as Record<string, SourceConfig | undefined>)[id];
}

/**
 * Source display name resolver. Centralized so detail-panel headers,
 * disconnect dialogs, and the alert dialog don't drift.
 */
export function getSourceDisplayName(id: string): string {
  return tryGetSourceConfig(id)?.label ?? id;
}
