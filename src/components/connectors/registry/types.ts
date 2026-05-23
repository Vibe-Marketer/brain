/**
 * Connector Registry — type definitions.
 *
 * See `connectorRegistry.ts` for the runtime registry. Each adapter under
 * `./adapters/` registers itself with a `ConnectorAdapter` describing how to
 * authenticate, fetch status, and render per-source details.
 *
 * Issue #283 tracks the full UI unification this enables.
 */

/** A canonical source identifier used everywhere in the app. */
export type ConnectorSourceApp =
  | "fathom"
  | "zoom"
  | "fireflies"
  | "plaud"
  | "youtube"
  | "file-upload";

/** Auth methods supported by a connector. A connector can advertise multiple. */
export type ConnectorAuthMethod = "oauth" | "api_key" | "webhook_only" | "none";

/** What the UI shell needs to render a connector consistently. */
export interface ConnectorMetadata {
  /** Stable id used in URLs, DB rows, route params. */
  sourceApp: ConnectorSourceApp;
  /** Human-readable label rendered in cards, headers, settings rows. */
  label: string;
  /** One-line description rendered under the label. */
  description: string;
  /** Icon component (Remix or lucide). Caller renders it. */
  icon: React.ComponentType<{ className?: string; size?: number }>;
  /** Brand color hex for the icon background ring (optional). */
  brandColor?: string;
  /** Auth methods this connector advertises. UI shows the right button set. */
  authMethods: readonly ConnectorAuthMethod[];
  /** Order in lists. Lower = first. */
  order: number;
  /** True if the connector is feature-flagged off / pre-launch. UI dims it. */
  comingSoon?: boolean;
}

/**
 * Per-source plumbing. Each adapter owns:
 *   - oauth URL construction (for sources that support OAuth)
 *   - credential save handler (for sources that support API key)
 *   - connection delete handler
 *   - any source-specific status interpretation
 */
export interface ConnectorAdapter {
  metadata: ConnectorMetadata;

  /**
   * Build the OAuth authorize URL by invoking the appropriate edge function.
   * Returns { authUrl, sourceId } or throws.
   *
   * Implementations call edge functions like `fathom-oauth-url`, `zoom-oauth-url`.
   * Sources without OAuth (file-upload) leave this undefined.
   */
  getOAuthAuthUrl?: () => Promise<{ authUrl: string; sourceId?: string }>;

  /**
   * Save API-key style credentials. For Fathom + Fireflies this writes an
   * encrypted row via the per-source `*-save-source` edge function.
   *
   * Sources without API-key support leave this undefined.
   */
  saveApiKeyCredentials?: (params: {
    apiKey: string;
    webhookSecret?: string;
    accountEmail?: string;
  }) => Promise<{ sourceId: string }>;

  /** Disconnect a source. Calls the per-source disconnect edge function. */
  disconnect?: (sourceId: string) => Promise<void>;
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
