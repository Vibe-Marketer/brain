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
describe('getTags', () => {
  const fakeTags = [
    { id: 'tag-1', name: 'Alpha', color: '#ff0000', description: null, is_system: false },
    { id: 'tag-2', name: 'Beta',  color: '#00ff00', description: 'desc', is_system: true  },
  ]

  it('returns tags for the given org', async () => {
    vi.mocked(supabase.from).mockReturnValue(makeChain({ data: fakeTags }))

    const result = await getTags('org-123')
    expect(result).toEqual(fakeTags)
    expect(supabase.from).toHaveBeenCalledWith('call_tags')
  })

  it('throws when supabase returns an error', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ error: { message: 'DB error' } })
    )
    await expect(getTags('org-123')).rejects.toThrow('Failed to fetch tags: DB error')
  })
})

// ─── getTagById ─────────────────────────────────────────────────────────────
describe('getTagById', () => {
  it('returns the tag matching the given id', async () => {
    const tag = { id: 'tag-1', name: 'Alpha', color: '#ff0000', description: null, is_system: false }
    vi.mocked(supabase.from).mockReturnValue(makeChain({ data: tag }))

    const result = await getTagById('tag-1')
    expect(result).toEqual(tag)
  })

  it('throws when tag not found', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ error: { message: 'No rows found' } })
    )
    await expect(getTagById('missing-id')).rejects.toThrow('Failed to fetch tag: No rows found')
  })
})

// ─── createTag ──────────────────────────────────────────────────────────────
describe('createTag', () => {
  it('inserts a tag and returns the created row', async () => {
    const created = { id: 'new-tag', name: 'New', color: '#abc', description: null, is_system: false }
    vi.mocked(supabase.from).mockReturnValue(makeChain({ data: created }))

    const result = await createTag('org-123', { name: 'New', color: '#abc' })
    expect(result).toEqual(created)
    expect(supabase.from).toHaveBeenCalledWith('call_tags')
  })

  it('throws on insert error', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ error: { message: 'unique violation' } })
    )
    await expect(createTag('org-123', { name: 'Dup' })).rejects.toThrow(
      'Failed to create tag: unique violation'
    )
  })
})

// ─── updateTag ──────────────────────────────────────────────────────────────
describe('updateTag', () => {
  it('resolves without throwing on success', async () => {
    vi.mocked(supabase.from).mockReturnValue(makeChain({ error: null }))
    await expect(updateTag('tag-1', { name: 'Updated' })).resolves.toBeUndefined()
  })

  it('throws on update error', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ error: { message: 'update failed' } })
    )
    await expect(updateTag('tag-1', { name: 'X' })).rejects.toThrow(
      'Failed to update tag: update failed'
    )
  })
})

// ─── deleteTag ──────────────────────────────────────────────────────────────
describe('deleteTag', () => {
  it('resolves without throwing on success', async () => {
    vi.mocked(supabase.from).mockReturnValue(makeChain({ error: null }))
    await expect(deleteTag('tag-1')).resolves.toBeUndefined()
  })

  it('throws on delete error', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ error: { message: 'delete failed' } })
    )
    await expect(deleteTag('tag-1')).rejects.toThrow('Failed to delete tag: delete failed')
  })
})

// ─── getTagCounts ────────────────────────────────────────────────────────────
describe('getTagCounts', () => {
  it('returns empty object when no orgId supplied', async () => {
    const result = await getTagCounts(undefined)
    expect(result).toEqual({})
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('returns empty object when org has no tags', async () => {
    // First call → getTags returns []
    vi.mocked(supabase.from).mockReturnValueOnce(makeChain({ data: [] }))
    const result = await getTagCounts('org-no-tags')
    expect(result).toEqual({})
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

  it('throws when assignment query fails', async () => {
    const orgTags = [{ id: 'tag-1' }]
    vi.mocked(supabase.from)
      .mockReturnValueOnce(makeChain({ data: orgTags }))
      .mockReturnValueOnce(makeChain({ error: { message: 'query fail' } }))

    await expect(getTagCounts('org-123')).rejects.toThrow(
      'Failed to fetch tag counts: query fail'
    )
  })
})

// ─── getTagCountById ─────────────────────────────────────────────────────────
describe('getTagCountById', () => {
  it('returns the exact count for a tag', async () => {
    vi.mocked(supabase.from).mockReturnValue(makeChain({ count: 7, error: null }))
    const result = await getTagCountById('tag-1')
    expect(result).toBe(7)
  })

  it('returns 0 when count is null', async () => {
    vi.mocked(supabase.from).mockReturnValue(makeChain({ count: null, error: null }))
    const result = await getTagCountById('tag-1')
    expect(result).toBe(0)
  })

  it('throws on error', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ error: { message: 'count failed' } })
    )
    await expect(getTagCountById('tag-1')).rejects.toThrow(
      'Failed to fetch tag count: count failed'
    )
  })
})

// ─── getTagRules ─────────────────────────────────────────────────────────────
describe('getTagRules', () => {
  it('returns all rules via RLS when no orgId', async () => {
    const rules = [{ id: 'r1', name: 'Rule 1', priority: 100 }]
    vi.mocked(supabase.from).mockReturnValue(makeChain({ data: rules }))
    const result = await getTagRules()
    expect(result).toEqual(rules)
  })

  it('filters rules by org tag IDs when orgId supplied', async () => {
    const orgTags = [{ id: 'tag-1' }]
    const rules = [{ id: 'r1', tag_id: 'tag-1', priority: 10 }]
    vi.mocked(supabase.from)
      .mockReturnValueOnce(makeChain({ data: orgTags }))
      .mockReturnValueOnce(makeChain({ data: rules }))

    const result = await getTagRules('org-123')
    expect(result).toEqual(rules)
  })

  it('throws when rule query fails', async () => {
    vi.mocked(supabase.from)
      .mockReturnValueOnce(makeChain({ data: [] })) // getTags succeeds
      .mockReturnValueOnce(makeChain({ error: { message: 'rule query fail' } }))

    await expect(getTagRules('org-123')).rejects.toThrow(
      'Failed to fetch tag rules: rule query fail'
    )
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

  it('resolves without throwing on success', async () => {
    vi.mocked(supabase.from).mockReturnValue(makeChain({ error: null }))
    await expect(createTagRule('org-123', ruleData)).resolves.toBeUndefined()
  })

  it('throws when user is not authenticated', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: null },
    } as any)
    await expect(createTagRule('org-123', ruleData)).rejects.toThrow('Not authenticated')
  })

  it('throws on insert error', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ error: { message: 'insert fail' } })
    )
    await expect(createTagRule('org-123', ruleData)).rejects.toThrow(
      'Failed to create tag rule: insert fail'
    )
  })
})

// ─── updateTagRule ───────────────────────────────────────────────────────────
describe('updateTagRule', () => {
  it('resolves without throwing on success', async () => {
    vi.mocked(supabase.from).mockReturnValue(makeChain({ error: null }))
    await expect(updateTagRule('rule-1', { name: 'Updated' })).resolves.toBeUndefined()
  })

  it('throws on update error', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ error: { message: 'rule update fail' } })
    )
    await expect(updateTagRule('rule-1', { is_active: false })).rejects.toThrow(
      'Failed to update tag rule: rule update fail'
    )
  })
})

// ─── deleteTagRule ───────────────────────────────────────────────────────────
describe('deleteTagRule', () => {
  it('resolves without throwing on success', async () => {
    vi.mocked(supabase.from).mockReturnValue(makeChain({ error: null }))
    await expect(deleteTagRule('rule-1')).resolves.toBeUndefined()
  })

  it('throws on delete error', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ error: { message: 'rule delete fail' } })
    )
    await expect(deleteTagRule('rule-1')).rejects.toThrow(
      'Failed to delete tag rule: rule delete fail'
    )
  })
})

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

  it('returns empty array when no calls exist', async () => {
    vi.mocked(supabase.from).mockReturnValue(makeChain({ data: [] }))
    const result = await getRecurringTitles()
    expect(result).toEqual([])
  })

  it('throws on supabase error', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ error: { message: 'fetch fail' } })
    )
    await expect(getRecurringTitles()).rejects.toThrow(
      'Failed to fetch recurring titles: fetch fail'
    )
  })
})
