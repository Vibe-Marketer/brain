/**
 * SYNC-02 unit safety-net — per-provider `listPage` pagination, mock-fetch driven.
 *
 * Phase 28 (Server-Side Sync-All). This is the unit safety-net for the six
 * list-API providers — it MUST cover ALL SIX, because some providers may not
 * have live TEST credentials available for the integration suite (Plan 28-05).
 *
 * WHY THIS WAS REWRITTEN (28-05, Rule 1):
 * The Plan-01 RED scaffold drove the providers through the populated registry
 * with NO injected `fetchImpl`, so each call hit the REAL provider API with a
 * fake `'test-token'`, every request failed/401'd, and each provider's
 * `catch → { items: [], nextCursor: null }` returned an empty FIRST page. The
 * drain loop then terminated immediately on page 1. Result: `pages >= 1` and
 * `lastCursor === null` passed TRIVIALLY without ever proving multi-page
 * pagination — a hollow green that did not exercise the cursor dialects at all.
 *
 * Every provider `listPage` accepts an injectable `fetchImpl` (positional 2nd
 * arg, or `params.fetchImpl`). This suite injects a deterministic multi-page
 * mock per provider so the drain ACTUALLY walks ≥2 pages to exhaustion, proves
 * the cursor advances and round-trips, and terminates with nextCursor=null on
 * the final page. The provider functions are imported DIRECTLY (the registry
 * casts away the fetchImpl arg). Mock `fetch` is the correct tool for a unit
 * test; the real-DB proofs live in resume/idempotency.integration.test.ts.
 *
 * The four pagination shapes (28-RESEARCH SPIKE Finding 2) are each asserted
 * explicitly with a mock that emits multiple pages:
 *   - opaque cursor        : Fathom (next_cursor), Grain (cursor)
 *   - composite window+token: Zoom (next_page_token within a 30-day window,
 *                             then window advance across a >30-day range)
 *   - offset/skip          : Fireflies, Plaud (nextCursor null when a page
 *                             returns fewer than the page limit)
 *   - last-id, limit ≤ 10  : Read.ai (has_more + last-item id)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ListPageFn, ListPageResult } from '../connector-list-page.ts'
import { fathomListPage } from '../fathom-client.ts'
import { grainListPage } from '../grain-client.ts'
import { zoomListPage } from '../zoom-client.ts'
import { readAiListPage } from '../read-ai-client.ts'
import { firefliesListPage } from '../fireflies-connector.ts'
import { plaudListPage, PLAUD_LIST_PAGE_SIZE } from '../plaud-client.ts'
import { FIREFLIES_LIST_PAGE_LIMIT } from '../fireflies-connector.ts'

const DATE_START = '2026-01-01T00:00:00.000Z'
const DATE_END = '2026-06-01T00:00:00.000Z' // >30 days → exercises Zoom window advance
const BASE = { accessToken: 'test-token', dateStart: DATE_START, dateEnd: DATE_END }

/** A fetch mock helper that returns a JSON Response. */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Drain a provider's pager to exhaustion. `fn` is bound to its mock fetchImpl.
 * Asserts nextCursor terminates at null and the loop actually advanced.
 */
async function drainToExhaustion(
  fn: (params: { accessToken: string; cursor: string | null; dateStart: string | null; dateEnd: string | null }) => Promise<ListPageResult<unknown>>,
): Promise<{ pages: number; totalItems: number; lastCursor: string | null; cursors: (string | null)[] }> {
  let cursor: string | null = null
  let pages = 0
  let totalItems = 0
  const cursors: (string | null)[] = []
  for (let i = 0; i < 1000; i++) {
    const page: ListPageResult<unknown> = await fn({ ...BASE, cursor })
    expect(Array.isArray(page.items)).toBe(true)
    pages += 1
    totalItems += page.items.length
    cursors.push(page.nextCursor)
    cursor = page.nextCursor
    if (cursor === null) break
    expect(typeof cursor).toBe('string') // opaque string round-tripped verbatim
  }
  return { pages, totalItems, lastCursor: cursor, cursors }
}

beforeEach(() => {
  vi.restoreAllMocks()
})
afterEach(() => {
  vi.restoreAllMocks()
})

// ──────────────────────────────────────────────────────────────────────────
// Fathom — opaque next_cursor token (3 pages → null)
// ──────────────────────────────────────────────────────────────────────────
describe('SYNC-02 listPage — Fathom (opaque cursor)', () => {
  function mockFetch(): typeof fetch {
    // Page 0 (no cursor) → next_cursor 'c1'; page 'c1' → 'c2'; page 'c2' → null.
    const pages: Record<string, { items: { recording_id: number }[]; next_cursor: string | null }> = {
      '': { items: [{ recording_id: 1 }, { recording_id: 2 }], next_cursor: 'c1' },
      c1: { items: [{ recording_id: 3 }, { recording_id: 4 }], next_cursor: 'c2' },
      c2: { items: [{ recording_id: 5 }], next_cursor: null },
    }
    return vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      const cur = url.searchParams.get('cursor') ?? ''
      return jsonResponse(pages[cur])
    }) as unknown as typeof fetch
  }

  it('paginates to exhaustion across 3 pages and returns nextCursor=null on the final page', async () => {
    const fetchImpl = mockFetch()
    const { pages, totalItems, lastCursor, cursors } = await drainToExhaustion(
      (p) => fathomListPage(p, fetchImpl),
    )
    expect(pages).toBe(3)
    expect(totalItems).toBe(5)
    expect(lastCursor).toBeNull()
    expect(cursors).toEqual(['c1', 'c2', null]) // cursor advanced then terminated
  })

  it('round-trips the provider opaque cursor verbatim between pages', async () => {
    const seen: string[] = []
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      const cur = url.searchParams.get('cursor')
      if (cur) seen.push(cur)
      if (!cur) return jsonResponse({ items: [{ recording_id: 1 }], next_cursor: 'OPAQUE-✓-token' })
      return jsonResponse({ items: [{ recording_id: 2 }], next_cursor: null })
    }) as unknown as typeof fetch
    const first = await fathomListPage({ ...BASE, cursor: null }, fetchImpl)
    expect(first.nextCursor).toBe('OPAQUE-✓-token')
    await fathomListPage({ ...BASE, cursor: first.nextCursor }, fetchImpl)
    expect(seen).toEqual(['OPAQUE-✓-token']) // forwarded verbatim, unparsed
  })
})

// ──────────────────────────────────────────────────────────────────────────
// Grain — opaque cursor token (POST body) (2 pages → null)
// ──────────────────────────────────────────────────────────────────────────
describe('SYNC-02 listPage — Grain (opaque cursor)', () => {
  it('paginates to exhaustion across 2 pages and returns nextCursor=null on the final page', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { cursor?: string }
      if (!body.cursor) {
        return jsonResponse({ recordings: [{ id: 'g1' }, { id: 'g2' }], cursor: 'grain-cur-1' })
      }
      return jsonResponse({ recordings: [{ id: 'g3' }], cursor: null })
    }) as unknown as typeof fetch
    const { pages, totalItems, lastCursor, cursors } = await drainToExhaustion(
      (p) => grainListPage(p, fetchImpl),
    )
    expect(pages).toBe(2)
    expect(totalItems).toBe(3)
    expect(lastCursor).toBeNull()
    expect(cursors).toEqual(['grain-cur-1', null])
  })
})

// ──────────────────────────────────────────────────────────────────────────
// Zoom — composite {window_from, window_to, next_page_token, range_to}.
// Jan 1 → Jun 1 spans ~5 thirty-day windows; each window paginates by token.
// ──────────────────────────────────────────────────────────────────────────
describe('SYNC-02 listPage — Zoom (composite window + page-token)', () => {
  function mockFetch(): typeof fetch {
    // For each window (from/to), serve 2 token-pages then exhaust (token=null),
    // forcing the cursor to advance the date window until range_to is reached.
    return vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      const token = url.searchParams.get('next_page_token')
      const from = url.searchParams.get('from')
      if (!token) {
        // first page of this window → hand back a token to force a 2nd page
        return jsonResponse({ meetings: [{ uuid: `${from}-a` }], next_page_token: 't2' })
      }
      // second page of this window → exhaust (no token) → cursor advances window
      return jsonResponse({ meetings: [{ uuid: `${from}-b` }], next_page_token: '' })
    }) as unknown as typeof fetch
  }

  it('advances the 30-day window after a window’s pages exhaust, then terminates', async () => {
    const fetchImpl = mockFetch()
    const { pages, lastCursor } = await drainToExhaustion((p) => zoomListPage(p, fetchImpl))
    // >1 window × 2 pages each → many pages; must terminate at null.
    expect(pages).toBeGreaterThan(2)
    expect(lastCursor).toBeNull()
  })

  it('does not truncate a >30-day backfill to a single window (cursor non-null after window 1 page 1)', async () => {
    const fetchImpl = mockFetch()
    const first = await zoomListPage({ ...BASE, cursor: null }, fetchImpl)
    expect(first.nextCursor).not.toBeNull() // more windows / pages remain
    const cur = JSON.parse(first.nextCursor as string) as { range_to: string; window_to: string }
    // The composite cursor must still carry the full range_to (not collapsed to one window).
    expect(cur.range_to).toBe('2026-06-01')
  })
})

// ──────────────────────────────────────────────────────────────────────────
// Read.ai — last-id cursor, limit ≤ 10, has_more flag (2 pages → null)
// ──────────────────────────────────────────────────────────────────────────
describe('SYNC-02 listPage — Read.ai (last-id cursor, limit ≤ 10)', () => {
  it('uses last-item id as the cursor and terminates when has_more is false', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      const cursor = url.searchParams.get('cursor')
      if (!cursor) {
        return jsonResponse({ data: [{ id: 'r1' }, { id: 'r2' }], has_more: true })
      }
      return jsonResponse({ data: [{ id: 'r3' }], has_more: false })
    }) as unknown as typeof fetch
    const { pages, totalItems, lastCursor, cursors } = await drainToExhaustion(
      (p) => readAiListPage(p, fetchImpl),
    )
    expect(pages).toBe(2)
    expect(totalItems).toBe(3)
    expect(lastCursor).toBeNull()
    expect(cursors).toEqual(['r2', null]) // cursor = last id of page 1, then null
  })

  it('never requests more than 10 items per page (clampReadAiLimit)', async () => {
    let requestedLimit = -1
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      requestedLimit = Number(url.searchParams.get('limit'))
      return jsonResponse({ data: [{ id: 'r1' }], has_more: false })
    }) as unknown as typeof fetch
    const page = await readAiListPage({ ...BASE, cursor: null }, fetchImpl)
    expect(requestedLimit).toBeLessThanOrEqual(10)
    expect(page.items.length).toBeLessThanOrEqual(10)
  })
})

// ──────────────────────────────────────────────────────────────────────────
// Fireflies — offset/skip (GraphQL). Full page (== limit) → advance; short → null.
// ──────────────────────────────────────────────────────────────────────────
describe('SYNC-02 listPage — Fireflies (offset/skip)', () => {
  it('advances the skip offset and returns nextCursor=null when a page is short', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const parsed = JSON.parse(String(init?.body ?? '{}')) as { variables?: { skip?: number } }
      const skip = parsed.variables?.skip ?? 0
      if (skip === 0) {
        // full page (== limit) forces another page
        const transcripts = Array.from({ length: FIREFLIES_LIST_PAGE_LIMIT }, (_v, i) => ({ id: `f${i}` }))
        return jsonResponse({ data: { transcripts } })
      }
      // short page → terminate
      return jsonResponse({ data: { transcripts: [{ id: 'last' }] } })
    }) as unknown as typeof fetch
    const { pages, totalItems, lastCursor, cursors } = await drainToExhaustion(
      (p) => firefliesListPage(p, fetchImpl),
    )
    expect(pages).toBe(2)
    expect(totalItems).toBe(FIREFLIES_LIST_PAGE_LIMIT + 1)
    expect(lastCursor).toBeNull()
    // First cursor is the numeric offset serialized as a string.
    expect(cursors[0]).toBe(String(FIREFLIES_LIST_PAGE_LIMIT))
    expect(cursors[1]).toBeNull()
  })

  it('serializes the offset as a numeric string cursor', async () => {
    const fetchImpl = vi.fn(async () => {
      const transcripts = Array.from({ length: FIREFLIES_LIST_PAGE_LIMIT }, (_v, i) => ({ id: `f${i}` }))
      return jsonResponse({ data: { transcripts } })
    }) as unknown as typeof fetch
    const first = await firefliesListPage({ ...BASE, cursor: null }, fetchImpl)
    expect(typeof first.nextCursor).toBe('string')
    expect(Number.isNaN(Number(first.nextCursor))).toBe(false)
  })
})

// ──────────────────────────────────────────────────────────────────────────
// Plaud — offset/skip + post-fetch date filter. Mock the workspace-token dance
// (listWorkspaces → mintWorkspaceToken) then the /file/simple/web pages.
// ──────────────────────────────────────────────────────────────────────────
describe('SYNC-02 listPage — Plaud (offset/skip)', () => {
  function plaudFetch(pages: Record<number, { id: string; start_at: string }[]>): typeof fetch {
    return vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = new URL(String(input))
      const path = url.pathname
      if (path.includes('/team-app/workspaces/list')) {
        return jsonResponse({ status: 0, data: { workspaces: [{ workspace_id: 'ws1', workspace_type: '0' }] } })
      }
      if (path.includes('/user-app/auth/workspace/token/')) {
        return jsonResponse({ status: 0, data: { status: 0, workspace_token: 'wt-token', workspace_id: 'ws1' } })
      }
      if (path.includes('/file/simple/web')) {
        const skip = Number(url.searchParams.get('skip') ?? '0')
        const files = pages[skip] ?? []
        return jsonResponse({ status: 0, data_file_total: 999, data_file_list: files })
      }
      return jsonResponse({ status: 0, data_file_list: [] })
    }) as unknown as typeof fetch
  }

  it('advances the skip offset and returns nextCursor=null when a raw page is short', async () => {
    // Page skip=0: a FULL raw page (== PLAUD_LIST_PAGE_SIZE) → advance.
    // Page skip=PLAUD_LIST_PAGE_SIZE: a SHORT raw page → terminate.
    const inRange = (i: number) => ({ id: `p${i}`, start_at: '2026-03-01T00:00:00.000Z' })
    const fullPage = Array.from({ length: PLAUD_LIST_PAGE_SIZE }, (_v, i) => inRange(i))
    const shortPage = [inRange(1000), inRange(1001)]
    const fetchImpl = plaudFetch({ 0: fullPage, [PLAUD_LIST_PAGE_SIZE]: shortPage })

    const { pages, lastCursor, cursors } = await drainToExhaustion((p) => plaudListPage(p, fetchImpl))
    expect(pages).toBe(2)
    expect(lastCursor).toBeNull()
    expect(cursors[0]).toBe(String(PLAUD_LIST_PAGE_SIZE)) // offset advanced
    expect(cursors[1]).toBeNull()
  })

  it('applies the post-fetch date filter without losing the offset cursor', async () => {
    // A full raw page where HALF are out of the [DATE_START, DATE_END] window.
    // The filtered items drop out, but the cursor still advances on raw length.
    const half = PLAUD_LIST_PAGE_SIZE / 2
    const inRange = (i: number) => ({ id: `in${i}`, start_at: '2026-03-01T00:00:00.000Z' })
    const outOfRange = (i: number) => ({ id: `out${i}`, start_at: '2030-01-01T00:00:00.000Z' })
    const mixed = [
      ...Array.from({ length: half }, (_v, i) => inRange(i)),
      ...Array.from({ length: PLAUD_LIST_PAGE_SIZE - half }, (_v, i) => outOfRange(i)),
    ]
    const fetchImpl = plaudFetch({ 0: mixed })
    const first = await plaudListPage({ ...BASE, cursor: null }, fetchImpl)
    // Raw page is full (== page size) → cursor advances despite filtering.
    expect(first.nextCursor).toBe(String(PLAUD_LIST_PAGE_SIZE))
    // Out-of-range files were filtered out.
    expect(first.items.length).toBe(half)
    expect((first.items as { id: string }[]).every((f) => f.id.startsWith('in'))).toBe(true)
  })
})
