/**
 * Connector Registry — type definitions.
 *
 * See `connectorRegistry.ts` for the runtime registry. Each adapter under
 * `./adapters/` registers itself with a `ConnectorAdapter` describing how to
 * authenticate, fetch status, and render per-source details.
 *
 * Issue #283 tracks the full UI unification this enables.
 */

import type { SourceId } from "@/config/source-registry";

/** A canonical source identifier backed by a connector adapter. */
export type ConnectorSourceApp = Exclude<SourceId, "paste-transcript">;

/** Auth methods supported by a connector. A connector can advertise multiple. */
export type ConnectorAuthMethod = "oauth" | "api_key" | "webhook_only" | "none";

/** High-level setup UI pattern a connector needs. */
export type ConnectorSetupKind =
  | "oauth"
  | "api_key"
  | "api_key_webhook"
  | "browser_bridge"
  | "none";

/** Canonical credential field names understood by connector setup surfaces. */
export type ConnectorCredentialFieldName =
  | "apiKey"
  | "webhookSecret"
  | "accountEmail"
  | "apiBase";

export interface ConnectorCredentialField {
  name: ConnectorCredentialFieldName;
  label: string;
  required?: boolean;
  secret?: boolean;
  placeholder?: string;
  helperText?: string;
  autoComplete?: string;
  options?: readonly Array<{ label: string; value: string }>;
}

export interface ConnectorWebhookConfig {
  required?: boolean;
  providerLabel: string;
  urlLabel: string;
  signingSecretLabel: string;
  signingSecretPlaceholder?: string;
  signingSecretHelperText?: string;
  signingSecretField: Extract<
    ConnectorCredentialFieldName,
    "webhookSecret"
  >;
  /** Edge function path used to build the public destination URL. */
  destinationPath: string;
  /** Some webhook URLs include a source-specific path token after save. */
  pathTokenField?: "webhookPathToken";
  verification?: {
    required?: boolean;
    lastVerifiedAtField: "lastVerifiedAt";
    lastMessageField?: "lastMessage";
  };
  eventTypes?: readonly string[];
  helperText?: string;
}

export interface ConnectorSetupConfig {
  kind: ConnectorSetupKind;
  /** Secondary setup paths kept for migration compatibility. */
  alternateKinds?: readonly ConnectorSetupKind[];
  /** True when the same CallVault user can connect multiple provider accounts. */
  supportsMultipleAccounts?: boolean;
  beta?: boolean;
  accountLabelField?: "email" | "hostEmail" | "accountName";
  credentialFields?: readonly ConnectorCredentialField[];
  webhook?: ConnectorWebhookConfig;
  helperCopy?: {
    disconnected?: string;
    connected?: string;
    saveSuccess?: string;
    verificationWaiting?: string;
  };
}

export interface WebhookVerificationResult {
  verified: boolean;
  lastVerifiedAt: string | null;
  lastMessage?: string | null;
}

/** What the UI shell needs to render a connector consistently. */
export interface ConnectorMetadata {
  /** Stable id used in URLs, DB rows, route params. */
  sourceApp: ConnectorSourceApp;
  /** Human-readable label rendered in cards, headers, settings rows. */
  label: string;
  /** One-line description rendered under the label. */
  description: string;
  /** Icon component (Remix Icons only). Caller renders it. */
  icon: React.ComponentType<{ className?: string; size?: number }>;
  /** Brand color hex for the icon background ring (optional). */
  brandColor?: string;
  /** Auth methods this connector advertises. UI shows the right button set. */
  authMethods: readonly ConnectorAuthMethod[];
  /** Order in lists. Lower = first. */
  order: number;
  /** Optional product maturity badge rendered on connector cards and headers. */
  badge?: "beta";
  /**
   * Whether the source's edge functions transparently refresh expired OAuth
   * access tokens (because we store a long-lived refresh token server-side).
   * When true, `deriveConnectorStatus` keeps the connector reported as
   * `connected` even when the access token has expired — the next sync call
   * will refresh it server-side. Defaults to false.
   */
  serverSideOAuthRefresh?: boolean;
  /**
   * Whether the connector should appear in user-facing surfaces. Hidden
   * connectors stay registered for historical data and future re-enable,
   * but are filtered out of `listConnectorAdapters` / picker UIs.
   *
   * Single source of truth: this overrides the legacy `uiVisible` flag on
   * `SourceConfig` for any source backed by a connector adapter.
   */
  uiVisible?: boolean;
}

/**
 * A discoverable call/recording that could be imported. Returned by
 * `searchAvailable()` on each adapter. Universal shape — per-source quirks
 * normalize into this.
 */
export interface AvailableCall {
  /** Source-specific identifier (passed back to `importSelected`). */
  externalId: string;
  /** Display title (e.g. meeting name, recording filename). */
  title: string;
  /** ISO 8601 start time of the recording. */
  startTime: string | null;
  /** Duration in seconds, if known. */
  durationSeconds: number | null;
  /** Attendees / participants, if known. */
  participants?: Array<{ name: string | null; email: string | null }>;
  /** Whether this call has already been imported (so UI can grey it out). */
  alreadyImported: boolean;
  /** Source-specific link for "view original" affordance. */
  externalUrl?: string | null;
  /** Free-form metadata the per-source detail pane may render. */
  metadata?: Record<string, unknown>;
}

/** A pending or completed import job. Returned by `importSelected()`. */
export interface ImportJob {
  /** Async job id the UI can poll for progress. */
  jobId: string;
  /** Total calls this job will import. */
  total: number;
  /** Optional friendly message to surface to the user. */
  message?: string;
}

export interface SaveApiKeyCredentialsParams {
  sourceId?: string | null;
  apiKey: string;
  webhookSecret?: string;
  webhookPathToken?: string;
  accountEmail?: string;
  apiBase?: string;
}

export interface SaveCredentialResult {
  sourceId: string;
  webhookSigningSecret?: string | null;
  webhookPathToken?: string | null;
  webhookUrl?: string;
  verification?: WebhookVerificationResult | null;
}

export interface WebhookDetailsResult {
  webhookUrl?: string;
  webhookPathToken?: string | null;
  webhookSigningSecret?: string | null;
  verification?: WebhookVerificationResult | null;
}

export interface WebhookDetailsArgs {
  sourceId: string;
}

export interface SaveWebhookConfigArgs {
  sourceId: string;
  webhookSigningSecret?: string | null;
  webhookPathToken?: string | null;
  apiKey?: string | null;
}

export interface WebhookVerificationArgs {
  sourceId: string;
}

/**
 * Per-source plumbing. Each adapter owns:
 *   - oauth URL construction (for sources that support OAuth)
 *   - credential save handler (for sources that support API key)
 *   - connection delete handler
 *   - call discovery (Phase 8 / #295 — unified import wizard)
 *   - call import into a workspace
 *   - any source-specific status interpretation
 */
export interface ConnectorAdapter {
  metadata: ConnectorMetadata;
  setup: ConnectorSetupConfig;

  /**
   * Build the OAuth authorize URL by invoking the appropriate edge function.
   * Returns { authUrl, sourceId } or throws.
   *
   * Implementations call edge functions like `fathom-oauth-url`, `zoom-oauth-url`.
   * Sources without OAuth (file-upload) leave this undefined.
   */
  getOAuthAuthUrl?: (params?: {
    sourceId?: string | null;
  }) => Promise<{ authUrl: string; sourceId?: string; state?: string }>;

  /**
   * Save API-key style credentials. For Fathom + Fireflies this writes an
   * encrypted row via the per-source `*-save-source` edge function.
   *
   * Sources without API-key support leave this undefined.
   */
  saveApiKeyCredentials?: (
    params: SaveApiKeyCredentialsParams,
  ) => Promise<SaveCredentialResult>;

  getWebhookDetails?: (
    params: WebhookDetailsArgs,
  ) => Promise<WebhookDetailsResult>;

  saveWebhookConfig?: (
    params: SaveWebhookConfigArgs,
  ) => Promise<SaveCredentialResult>;

  getWebhookVerification?: (
    params: WebhookVerificationArgs,
  ) => Promise<WebhookVerificationResult>;

  /**
   * Disconnect a source. `sourceId` can be null for legacy-only connections
   * that are represented by user_settings instead of import_sources.
   */
  disconnect?: (sourceId?: string | null) => Promise<void>;

  /**
   * Phase 8 (#295) — fetch available calls from the provider for a date
   * range. Returns a paginated list of calls the user can choose to import.
   *
   * Adapters that don't support date-filtered search (e.g. file-upload,
   * youtube) leave this undefined; the ImportWizard hides the search UI
   * for those connectors and falls back to per-source detail panes.
   */
  searchAvailable?: (params: {
    sourceId: string;
    dateStart: Date;
    dateEnd: Date;
    cursor?: string;
    limit?: number;
  }) => Promise<{ items: AvailableCall[]; nextCursor?: string | null }>;

  /**
   * Phase 8 (#295) — import a user-selected subset of calls into a target
   * workspace. Returns a job id the UI can poll.
   *
   * Adapters that don't support selective import (e.g. webhook-only sources
   * like Plaud's current bulk-sync mode) leave this undefined; the
   * ImportWizard then shows a "this connector imports automatically"
   * message instead of the selection UI.
   */
  importSelected?: (params: {
    sourceId: string;
    externalIds: string[];
    workspaceId: string;
  }) => Promise<ImportJob>;
}

/** The canonical status shape returned by `useConnector`. */
export interface ConnectorStatus {
  sourceApp: ConnectorSourceApp;
  /** True if the connector has at least one active row and a valid credential. */
  connected: boolean;
  /** True if the connector has any row at all (even disconnected). */
  hasEverConnected: boolean;
  /** Account email for the active row, if known. */
  accountEmail: string | null;
  /** Last sync timestamp (ISO 8601) if recorded. */
  lastSyncAt: string | null;
  /** Token expiry (ms since epoch) if this is an OAuth connector. */
  tokenExpiresMs: number | null;
  /** True if there's an oauth_token_expires in the past. */
  tokenExpired: boolean;
  /** Last error message, if any. Surfaced as 'Connection error' state. */
  errorMessage: string | null;
  /** The active import_sources row id, if connected. */
  sourceId: string | null;
  /** Raw rows for advanced consumers (multi-account, debugging). */
  allRows: ConnectorRow[];
}

/** Subset of `import_sources` columns the hook reads. */
export interface ConnectorRow {
  id: string;
  user_id: string;
  source_app: ConnectorSourceApp;
  is_active: boolean;
  account_email: string | null;
  last_sync_at: string | null;
  error_message: string | null;
  oauth_token_expires: number | null;
  created_at: string;
  updated_at: string;
}
