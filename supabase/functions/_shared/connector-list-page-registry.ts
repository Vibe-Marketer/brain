/**
 * Connector list-page REGISTRY — Phase 28 (Server-Side Sync-All), SYNC-02.
 *
 * THE POPULATED resolver the resumable `connector-sync-all` pager imports.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * This is the runtime resolution the contract-only `connector-list-page.ts`
 * deliberately does NOT provide. That file holds the TYPES; this file holds the
 * populated `source_app → ListPageFn` map + `resolveListPage(source_app)`.
 * Built in Plan 28-03 (Wave 2) BEFORE the pager (Plan 28-02, Wave 3) so the
 * pager has something to resolve against.
 *
 * Each provider hides its own pagination dialect behind the opaque cursor
 * string (28-RESEARCH SPIKE Finding 2); the pager round-trips that string
 * verbatim through `sync_jobs.provider_cursor` and never interprets it:
 *   - fathom    : opaque next_cursor token            (fathomListPage)
 *   - grain     : opaque cursor token                 (grainListPage)
 *   - zoom      : composite {window+next_page_token}  (zoomListPage)   — 30-day window cap
 *   - read-ai   : last-item id, limit ≤ 10            (readAiListPage)
 *   - fireflies : offset / skip                       (firefliesListPage)
 *   - plaud     : offset / skip + post-fetch date filter (plaudListPage)
 *
 * DELIBERATELY ABSENT — youtube and file-upload have NO list endpoint, so a
 * sync-all start for those resolves to `undefined` and the surface shows
 * "imports automatically" rather than offering a server-side backfill.
 * (paste-transcript / manual-mcp-import are likewise list-less and absent.)
 */

import type {
  ListPageFn,
  ListPageResolver,
} from "./connector-list-page.ts";
import { fathomListPage } from "./fathom-client.ts";
import { grainListPage } from "./grain-client.ts";
import { zoomListPage } from "./zoom-client.ts";
import { readAiListPage } from "./read-ai-client.ts";
import { firefliesListPage } from "./fireflies-connector.ts";
import { plaudListPage } from "./plaud-client.ts";

/**
 * POPULATED resolver map — exactly the 6 list-API providers.
 *
 * The provider impls take an optional second `fetchImpl` arg (for tests); the
 * map exposes them as the strict `ListPageFn` (one-arg) the pager calls. The
 * cast erases the optional tail arg only — the call shape the pager uses
 * (`fn(params)`) is unchanged.
 */
export const listPageResolver: ListPageResolver = {
  fathom: fathomListPage as ListPageFn,
  grain: grainListPage as ListPageFn,
  zoom: zoomListPage as ListPageFn,
  "read-ai": readAiListPage as ListPageFn,
  fireflies: firefliesListPage as ListPageFn,
  plaud: plaudListPage as ListPageFn,
  // youtube      — NO list endpoint (URL-driven import only): intentionally absent.
  // file-upload  — NO list endpoint (manual upload): intentionally absent.
};

/**
 * Resolve a provider's listPage by `source_app`. Returns `undefined` for
 * webhook/manual-only sources (youtube, file-upload, …) — the pager treats an
 * undefined resolution as "this source has no server-side sync-all".
 */
export function resolveListPage(sourceApp: string): ListPageFn | undefined {
  return (listPageResolver as Record<string, ListPageFn | undefined>)[sourceApp];
}
