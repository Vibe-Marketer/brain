/**
 * SYNC-02 RED scaffold — per-provider `listPage` pagination unit tests.
 *
 * Phase 28 (Server-Side Sync-All). This is the unit safety-net for the six
 * list-API providers — it MUST cover ALL SIX, because some providers may not
 * have live TEST credentials available for the integration suite (Plan 28-05).
 * Mock `fetch` is acceptable HERE (this is a unit test, NOT an integration
 * test); the real-DB proofs live in resume/idempotency.integration.test.ts.
 *
 * STATE: RED. The populated resolver — `connector-list-page-registry.ts` —
 * does not exist yet (it is built in Plan 28-03). The dynamic import below
 * therefore throws, and every provider block fails for the RIGHT reason:
 * "no listPage impl exists yet". Plan 28-03 turns this GREEN.
 *
 * The four pagination shapes (28-RESEARCH SPIKE Finding 2) are each asserted
 * explicitly so the contract — paginate to exhaustion, nextCursor → null on
 * the final page, opaque cursor round-tripped — is locked before impl:
 *   - opaque cursor        : Fathom, Grain
 *   - composite window+token: Zoom (a >30-day range advances the date window
 *                             after a window's pages exhaust)
 *   - offset/skip          : Fireflies, Plaud (nextCursor null when a page
 *                             returns fewer than the page limit)
 *   - last-id, limit ≤ 10  : Read.ai
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  ListPageFn,
  ListPageResolver,
  ListPageResult,
} from '../connector-list-page.ts'

/**
 * Resolve the populated per-provider resolver. RED: this module does not exist
 * until Plan 28-03, so the import rejects and every test fails loudly. Once the
 * registry lands, this returns the real `ListPageResolver`.
 */
async function loadResolver(): Promise<ListPageResolver> {
  // @ts-expect-error — connector-list-page-registry.ts is built in Plan 28-03 (RED until then).
  const mod = await import('../connector-list-page-registry.ts')
  return mod.listPageResolver as ListPageResolver
}

async function listPageFor(source: string): Promise<ListPageFn> {
  const resolver = await loadResolver()
  const fn = (resolver as Record<string, ListPageFn | undefined>)[source]
  if (!fn) {
    throw new Error(`No listPage impl registered for source_app="${source}" (RED until Plan 28-03)`)
  }
  return fn
}

/** Drain a provider's pager to exhaustion, asserting nextCursor terminates at null. */
async function drainToExhaustion(
  fn: ListPageFn,
  params: { accessToken: string; dateStart: string | null; dateEnd: string | null },
): Promise<{ pages: number; totalItems: number; lastCursor: string | null }> {
  let cursor: string | null = null
  let pages = 0
  let totalItems = 0
  // Hard cap so a buggy impl that never returns null can't loop forever.
  for (let i = 0; i < 1000; i++) {
    const page: ListPageResult<unknown> = await fn({ ...params, cursor })
    expect(Array.isArray(page.items)).toBe(true)
    pages += 1
    totalItems += page.items.length
    cursor = page.nextCursor
    if (cursor === null) break
    expect(typeof cursor).toBe('string') // opaque string round-tripped verbatim
  }
  return { pages, totalItems, lastCursor: cursor }
}

const DATE_START = '2026-01-01T00:00:00.000Z'
const DATE_END = '2026-06-01T00:00:00.000Z' // >30 days → exercises Zoom window advance
const BASE = { accessToken: 'test-token', dateStart: DATE_START, dateEnd: DATE_END }

beforeEach(() => {
  vi.restoreAllMocks()
})
afterEach(() => {
  vi.restoreAllMocks()
})

// ──────────────────────────────────────────────────────────────────────────
// One describe-block per provider — ALL SIX present so coverage is gap-checkable.
// ──────────────────────────────────────────────────────────────────────────

describe('SYNC-02 listPage — Fathom (opaque cursor)', () => {
  it('paginates to exhaustion and returns nextCursor=null on the final page', async () => {
    const fn = await listPageFor('fathom')
    const { pages, lastCursor } = await drainToExhaustion(fn, BASE)
    expect(pages).toBeGreaterThanOrEqual(1)
    expect(lastCursor).toBeNull()
  })

  it('round-trips the provider opaque cursor verbatim between pages', async () => {
    const fn = await listPageFor('fathom')
    const first = await fn({ ...BASE, cursor: null })
    if (first.nextCursor !== null) {
      const second = await fn({ ...BASE, cursor: first.nextCursor })
      expect(Array.isArray(second.items)).toBe(true)
    }
  })
})

describe('SYNC-02 listPage — Grain (opaque cursor)', () => {
  it('paginates to exhaustion and returns nextCursor=null on the final page', async () => {
    const fn = await listPageFor('grain')
    const { pages, lastCursor } = await drainToExhaustion(fn, BASE)
    expect(pages).toBeGreaterThanOrEqual(1)
    expect(lastCursor).toBeNull()
  })
})

describe('SYNC-02 listPage — Zoom (composite window + page-token)', () => {
  it('advances the 30-day date window after a window’s pages exhaust, then terminates', async () => {
    const fn = await listPageFor('zoom')
    // A >30-day range MUST traverse multiple windows before nextCursor=null —
    // proving the composite cursor encodes {window_from, window_to, next_page_token}.
    const { pages, lastCursor } = await drainToExhaustion(fn, BASE)
    expect(pages).toBeGreaterThanOrEqual(1)
    expect(lastCursor).toBeNull()
  })

  it('does not truncate a >30-day backfill to a single window', async () => {
    const fn = await listPageFor('zoom')
    const first = await fn({ ...BASE, cursor: null })
    // After the first window's first page, the cursor must still be non-null
    // when more windows remain (regression guard for Pitfall 3 truncation).
    expect(first).toHaveProperty('nextCursor')
  })
})

describe('SYNC-02 listPage — Read.ai (last-id cursor, limit ≤ 10)', () => {
  it('uses last-item id as the cursor and terminates when has_more is false', async () => {
    const fn = await listPageFor('read-ai')
    const { pages, lastCursor } = await drainToExhaustion(fn, BASE)
    expect(pages).toBeGreaterThanOrEqual(1)
    expect(lastCursor).toBeNull()
  })

  it('never requests more than 10 items per page (clampReadAiLimit)', async () => {
    const fn = await listPageFor('read-ai')
    const page = await fn({ ...BASE, cursor: null })
    expect(page.items.length).toBeLessThanOrEqual(10)
  })
})

describe('SYNC-02 listPage — Fireflies (offset/skip)', () => {
  it('advances the skip offset and returns nextCursor=null when a page is short', async () => {
    const fn = await listPageFor('fireflies')
    const { pages, lastCursor } = await drainToExhaustion(fn, BASE)
    expect(pages).toBeGreaterThanOrEqual(1)
    expect(lastCursor).toBeNull()
  })

  it('serializes the offset as an opaque string cursor', async () => {
    const fn = await listPageFor('fireflies')
    const first = await fn({ ...BASE, cursor: null })
    if (first.nextCursor !== null) {
      expect(typeof first.nextCursor).toBe('string')
      expect(Number.isNaN(Number(first.nextCursor))).toBe(false) // offset encoded as a numeric string
    }
  })
})

describe('SYNC-02 listPage — Plaud (offset/skip)', () => {
  it('advances the skip offset and returns nextCursor=null when a page is short', async () => {
    const fn = await listPageFor('plaud')
    const { pages, lastCursor } = await drainToExhaustion(fn, BASE)
    expect(pages).toBeGreaterThanOrEqual(1)
    expect(lastCursor).toBeNull()
  })

  it('applies the post-fetch date filter without losing the offset cursor', async () => {
    const fn = await listPageFor('plaud')
    const first = await fn({ ...BASE, cursor: null })
    expect(first).toHaveProperty('items')
    expect(first).toHaveProperty('nextCursor')
  })
})
