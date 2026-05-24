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
    apiBase?: string;
  }) => Promise<{ sourceId: string }>;

  /** Disconnect a source. Calls the per-source disconnect edge function. */
  disconnect?: (sourceId: string) => Promise<void>;

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
