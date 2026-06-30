/**
 * Connector list-page contract — Phase 28 (Server-Side Sync-All), SYNC-02.
 *
 * THE UNIFORM PAGINATION CONTRACT every list-API provider implements so the
 * resumable `connector-sync-all` pager can stay 100% provider-agnostic.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * TYPES-ONLY — DO NOT POPULATE HERE.
 * ──────────────────────────────────────────────────────────────────────────
 * This file defines ONLY the contract types + the resolver SIGNATURE. It holds
 * ZERO provider implementations and ZERO populated resolver entries. The six
 * provider `listPage` impls AND the populated `source_app → ListPageFn` map
 * live in `connector-list-page-registry.ts` (built in Plan 28-03). The pager
 * (Plan 28-02) imports the populated registry for runtime resolution and
 * imports ONLY the types from THIS file.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * `nextCursor` IS OPAQUE. THE PAGER MUST NEVER PARSE IT.
 * ──────────────────────────────────────────────────────────────────────────
 * The pager stores `nextCursor` verbatim into `sync_jobs.provider_cursor` and
 * passes it back unmodified on the next slice. Each provider encodes its own
 * pagination dialect INSIDE that string — interpreting it in the pager is the
 * anti-pattern flagged in 28-RESEARCH (SPIKE Finding 2). The four shapes the
 * providers hide behind this one opaque string:
 *   - opaque cursor token       (Fathom, Grain)         — provider token verbatim
 *   - composite window + token  (Zoom)                  — {window_from, window_to, next_page_token}; 30-day window cap
 *   - offset / skip             (Fireflies, Plaud)      — skip offset serialized as a string
 *   - last-item id (limit ≤ 10) (Read.ai)               — id of the last item on the page
 * `nextCursor === null` means the stream is exhausted (terminal).
 */

/**
 * Edge-function-local source ids. Do not import the frontend connector registry
 * here: Deno checks this shared edge module during deploy, and importing React
 * app types pulls unrelated app-only TypeScript into the function graph.
 */
export type ConnectorSourceApp =
  | "fathom"
  | "zoom"
  | "fireflies"
  | "read-ai"
  | "grain"
  | "plaud"
  | "youtube"
  | "file-upload"
  | "manual-mcp-import";

/**
 * One page of provider results plus the opaque cursor for the next page.
 *
 * @typeParam T - The provider's raw item shape (e.g. GrainRecording,
 *                FirefliesTranscript). The pager maps each item into a
 *                ConnectorRecord before calling runPipeline.
 */
export interface ListPageResult<T> {
  /** The items on this page. Empty array is valid (e.g. a window with no calls). */
  items: T[];
  /**
   * Opaque cursor for the NEXT page, or `null` when the stream is exhausted.
   * The pager round-trips this verbatim through `sync_jobs.provider_cursor` —
   * it MUST NOT be parsed outside the provider that produced it.
   */
  nextCursor: string | null;
}

/**
 * Inputs to a single provider list-page fetch. The pager passes the saved
 * `cursor` from `sync_jobs.provider_cursor` and the job's date window.
 */
export interface ListPageParams {
  /** Decrypted OAuth access token / API key for the provider call. */
  accessToken: string;
  /** Opaque cursor from the previous page (== sync_jobs.provider_cursor); null on the first slice. */
  cursor: string | null;
  /** ISO 8601 start of the sync window, or null for "no lower bound". */
  dateStart: string | null;
  /** ISO 8601 end of the sync window, or null for "no upper bound". */
  dateEnd: string | null;
}

/**
 * The uniform provider function the pager calls once per slice. Every list-API
 * provider implements exactly this signature in connector-list-page-registry.ts.
 *
 * @typeParam T - The provider's raw item shape.
 */
export type ListPageFn<T = unknown> = (
  params: ListPageParams,
) => Promise<ListPageResult<T>>;

/**
 * Resolver SIGNATURE the pager resolves a provider against — a partial map
 * keyed by ConnectorSourceApp slug to a ListPageFn.
 *
 * It is `Partial<...>` by design: only list-API providers
 * (fathom, grain, zoom, read-ai, fireflies, plaud) have an entry; webhook /
 * manual-only sources (youtube, file-upload, paste-transcript, manual-mcp-import)
 * have none.
 *
 * CONTRACT-ONLY: this is a TYPE. The populated value lives in
 * connector-list-page-registry.ts (Plan 28-03).
 */
export type ListPageResolver = Partial<
  Record<ConnectorSourceApp, ListPageFn>
>;
