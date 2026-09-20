import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as _tagsService from '../tags.service'

beforeEach(() => {
  vi.clearAllMocks()
})
import {
  getTags,
  getTagById,
  createTag,
  updateTag,
  deleteTag,
  getTagCounts,
  getTagCountById,
  getTagRules,
  createTagRule,
  updateTagRule,
  deleteTagRule,
  getRecurringTitles,
} from '../tags.service'
import { supabase } from '@/integrations/supabase/client'

// ─── Supabase mock ─────────────────────────────────────────────────────────
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}))

/** Build a chainable Supabase query mock that is also directly awaitable. */
function makeChain(result: { data?: unknown; error?: unknown; count?: number | null }) {
  const resolved = { data: null, error: null, count: null, ...result }
  const chain: Record<string, unknown> = {}

  const chainMethods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'in', 'or', 'order', 'not', 'is',
  ] as const

  for (const method of chainMethods) {
    chain[method] = vi.fn().mockReturnValue(chain)
  }

  chain.single = vi.fn().mockResolvedValue(resolved)
  chain.maybeSingle = vi.fn().mockResolvedValue(resolved)

  // Make the chain awaitable (for queries without .single())
  chain.then = (resolve: (v: typeof resolved) => unknown) => Promise.resolve(resolved).then(resolve)
  chain.catch = (reject: (e: unknown) => unknown) => Promise.resolve(resolved).catch(reject)

  return chain as unknown as ReturnType<typeof supabase.from>
}

// ─── getTags ────────────────────────────────────────────────────────────────

// ─── getTagById ─────────────────────────────────────────────────────────────

// ─── createTag ──────────────────────────────────────────────────────────────

// ─── updateTag ──────────────────────────────────────────────────────────────

// ─── deleteTag ──────────────────────────────────────────────────────────────

// ─── getTagCounts ────────────────────────────────────────────────────────────
describe('getTagCounts', () => {
  it('returns empty object when no orgId supplied', async () => {
    const result = await getTagCounts(undefined)
    expect(result).toEqual({})
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('aggregates assignment counts per tag', async () => {
    const orgTags = [{ id: 'tag-1' }, { id: 'tag-2' }]
    const assignments = [
      { tag_id: 'tag-1' },
      { tag_id: 'tag-1' },
      { tag_id: 'tag-2' },
    ]
    // First from() call → getTags; second → call_tag_assignments
    vi.mocked(supabase.from)
      .mockReturnValueOnce(makeChain({ data: orgTags }))
      .mockReturnValueOnce(makeChain({ data: assignments }))

    const result = await getTagCounts('org-123')
    expect(result).toEqual({ 'tag-1': 2, 'tag-2': 1 })
  })

})

// ─── getTagCountById ─────────────────────────────────────────────────────────

// ─── getTagRules ─────────────────────────────────────────────────────────────
describe('getTagRules', () => {

  it('filters rules by org tag IDs when orgId supplied', async () => {
    const orgTags = [{ id: 'tag-1' }]
    const rules = [{ id: 'r1', tag_id: 'tag-1', priority: 10 }]
    vi.mocked(supabase.from)
      .mockReturnValueOnce(makeChain({ data: orgTags }))
      .mockReturnValueOnce(makeChain({ data: rules }))

    const result = await getTagRules('org-123')
    expect(result).toEqual(rules)
  })

})

// ─── createTagRule ───────────────────────────────────────────────────────────
describe('createTagRule', () => {
  const ruleData = {
    name: 'Test Rule',
    rule_type: 'keyword',
    conditions: { keywords: ['meeting'] },
  }

  beforeEach(() => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: 'user-1' } },
    } as ReturnType<typeof supabase.auth.getUser> extends Promise<infer T> ? Promise<T> : never as any)
  })

  it('throws when user is not authenticated', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: null },
    } as any)
    await expect(createTagRule('org-123', ruleData)).rejects.toThrow('Not authenticated')
  })

})

// ─── updateTagRule ───────────────────────────────────────────────────────────

// ─── deleteTagRule ───────────────────────────────────────────────────────────

// ─── getRecurringTitles ──────────────────────────────────────────────────────
describe('getRecurringTitles', () => {
  beforeEach(() => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: 'user-1' } },
    } as any)
  })

  it('throws when user is not authenticated', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: null },
    } as any)
    await expect(getRecurringTitles()).rejects.toThrow('Not authenticated')
  })

  it('returns recurring titles sorted by occurrence count', async () => {
    const calls = [
      { title: 'Weekly Sync' },
      { title: 'Weekly Sync' },
      { title: 'Weekly Sync' },
      { title: '1:1 with Bob' },
      { title: '1:1 with Bob' },
      { title: 'Onboarding' },
    ]
    vi.mocked(supabase.from).mockReturnValue(makeChain({ data: calls }))

    const result = await getRecurringTitles()

    expect(result[0].title).toBe('Weekly Sync')
    expect(result[0].occurrence_count).toBe(3)
    expect(result[1].title).toBe('1:1 with Bob')
    expect(result[1].occurrence_count).toBe(2)
    expect(result[2].title).toBe('Onboarding')
    expect(result[2].occurrence_count).toBe(1)
  })

  it('returns at most 50 titles', async () => {
    const calls = Array.from({ length: 100 }, (_, i) => ({ title: `Meeting ${i}` }))
    vi.mocked(supabase.from).mockReturnValue(makeChain({ data: calls }))

    const result = await getRecurringTitles()
    expect(result.length).toBeLessThanOrEqual(50)
  })

})
