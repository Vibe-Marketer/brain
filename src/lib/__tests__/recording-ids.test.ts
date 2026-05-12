import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  isLegacyId,
  isRecordingUuid,
  toRecordingUuid,
  toRecordingUuidBatch,
} from '../recording-ids'
import { supabase } from '@/integrations/supabase/client'
import { logger } from '@/lib/logger'

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── Mocks ─────────────────────────────────────────────────────────────────
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

/** Build a chainable, awaitable Supabase query mock. */
function makeChain(result: { data?: unknown; error?: unknown }) {
  const resolved = { data: null, error: null, ...result }
  const chain: Record<string, unknown> = {}
  const calls: Record<string, unknown[][]> = {}

  const methods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'in', 'or', 'order', 'filter', 'is',
  ]

  for (const m of methods) {
    calls[m] = []
    chain[m] = vi.fn((...args: unknown[]) => {
      calls[m].push(args)
      return chain
    })
  }

  chain.single = vi.fn().mockResolvedValue(resolved)
  chain.maybeSingle = vi.fn().mockResolvedValue(resolved)
  chain.then = (resolve: (v: typeof resolved) => unknown) => Promise.resolve(resolved).then(resolve)
  chain.catch = (reject: (e: unknown) => unknown) => Promise.resolve(resolved).catch(reject)

  // Attach a getter so tests can inspect call args directly.
  ;(chain as any).__calls = calls
  return chain as unknown as ReturnType<typeof supabase.from> & { __calls: typeof calls }
}

// ─── isLegacyId ────────────────────────────────────────────────────────────
describe('isLegacyId', () => {
  it('returns true for a JS number', () => {
    expect(isLegacyId(143800259)).toBe(true)
  })

  it('returns true for a numeric string', () => {
    expect(isLegacyId('143800259')).toBe(true)
  })

  it('returns false for a UUID string', () => {
    expect(isLegacyId('550e8400-e29b-41d4-a716-446655440000')).toBe(false)
  })

  it('returns false for non-numeric strings', () => {
    expect(isLegacyId('abc-123')).toBe(false)
    expect(isLegacyId('not-a-number')).toBe(false)
  })

  it('returns false for non-finite numbers', () => {
    expect(isLegacyId(Number.NaN)).toBe(false)
    expect(isLegacyId(Number.POSITIVE_INFINITY)).toBe(false)
  })
})

// ─── isRecordingUuid ───────────────────────────────────────────────────────
describe('isRecordingUuid', () => {
  it('returns true for a canonical UUID v4 string', () => {
    expect(isRecordingUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isRecordingUuid('550E8400-E29B-41D4-A716-446655440000')).toBe(true)
  })

  it('returns false for a number', () => {
    expect(isRecordingUuid(143800259)).toBe(false)
  })

  it('returns false for non-UUID strings', () => {
    expect(isRecordingUuid('not-a-uuid')).toBe(false)
    expect(isRecordingUuid('143800259')).toBe(false)
    // Missing a hex char in the last segment.
    expect(isRecordingUuid('550e8400-e29b-41d4-a716-44665544000')).toBe(false)
  })
})

// ─── toRecordingUuid ───────────────────────────────────────────────────────
describe('toRecordingUuid', () => {
  it('short-circuits when input is already a UUID (no DB call)', async () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000'
    const result = await toRecordingUuid(uuid)
    expect(result).toBe(uuid)
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('looks up a numeric input via recordings.legacy_recording_id and returns the UUID', async () => {
    const chain = makeChain({ data: { id: 'resolved-uuid-1' }, error: null })
    vi.mocked(supabase.from).mockReturnValue(chain)

    const result = await toRecordingUuid(143800259)

    expect(result).toBe('resolved-uuid-1')
    expect(supabase.from).toHaveBeenCalledWith('recordings')
    expect((chain as any).select).toHaveBeenCalledWith('id')
    expect((chain as any).eq).toHaveBeenCalledWith('legacy_recording_id', 143800259)
    expect((chain as any).maybeSingle).toHaveBeenCalledTimes(1)
  })

  it('accepts a numeric-string input and looks it up as a number', async () => {
    const chain = makeChain({ data: { id: 'resolved-uuid-2' }, error: null })
    vi.mocked(supabase.from).mockReturnValue(chain)

    const result = await toRecordingUuid('143800259')

    expect(result).toBe('resolved-uuid-2')
    expect((chain as any).eq).toHaveBeenCalledWith('legacy_recording_id', 143800259)
  })

  it('returns null + warns on orphan rows (no throw)', async () => {
    const chain = makeChain({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(chain)

    const result = await toRecordingUuid(99999999)

    expect(result).toBeNull()
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('orphan legacy recording id'),
      expect.objectContaining({ legacyId: 99999999 }),
    )
  })

  it('adds .eq("organization_id", orgId) when opts.orgId is provided', async () => {
    const chain = makeChain({ data: { id: 'org-scoped-uuid' }, error: null })
    vi.mocked(supabase.from).mockReturnValue(chain)

    await toRecordingUuid(143800259, { orgId: 'org-abc' })

    expect((chain as any).eq).toHaveBeenCalledWith('legacy_recording_id', 143800259)
    expect((chain as any).eq).toHaveBeenCalledWith('organization_id', 'org-abc')
  })

  it('returns null and warns when input is neither a UUID nor a numeric ID', async () => {
    const result = await toRecordingUuid('garbage-input')
    expect(result).toBeNull()
    expect(supabase.from).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalled()
  })
})

// ─── toRecordingUuidBatch ──────────────────────────────────────────────────
describe('toRecordingUuidBatch', () => {
  it('runs two .in() queries when input is mixed', async () => {
    // Capture the from() calls so we can inspect both queries.
    const numericChain = makeChain({
      data: [
        { id: 'uuid-from-numeric', legacy_recording_id: 143800259, source_app: 'fathom' },
      ],
      error: null,
    })
    const uuidChain = makeChain({
      data: [
        { id: '550e8400-e29b-41d4-a716-446655440000', legacy_recording_id: null, source_app: 'zoom' },
      ],
      error: null,
    })

    let callIdx = 0
    vi.mocked(supabase.from).mockImplementation(() => {
      const chain = callIdx === 0 ? numericChain : uuidChain
      callIdx += 1
      return chain as unknown as ReturnType<typeof supabase.from>
    })

    const result = await toRecordingUuidBatch([
      143800259,
      '550e8400-e29b-41d4-a716-446655440000',
    ])

    expect(supabase.from).toHaveBeenCalledTimes(2)
    expect((numericChain as any).in).toHaveBeenCalledWith('legacy_recording_id', [143800259])
    expect((uuidChain as any).in).toHaveBeenCalledWith('id', ['550e8400-e29b-41d4-a716-446655440000'])
    expect(result.resolved).toHaveLength(2)
    expect(result.uuids).toContain('uuid-from-numeric')
    expect(result.uuids).toContain('550e8400-e29b-41d4-a716-446655440000')
    expect(result.legacyIds).toEqual([143800259])
  })

  it('runs only one query when all inputs are UUIDs', async () => {
    const chain = makeChain({
      data: [
        { id: '550e8400-e29b-41d4-a716-446655440000', legacy_recording_id: null, source_app: 'zoom' },
        { id: '660e8400-e29b-41d4-a716-446655440001', legacy_recording_id: null, source_app: 'manual' },
      ],
      error: null,
    })
    vi.mocked(supabase.from).mockReturnValue(chain)

    const result = await toRecordingUuidBatch([
      '550e8400-e29b-41d4-a716-446655440000',
      '660e8400-e29b-41d4-a716-446655440001',
    ])

    expect(supabase.from).toHaveBeenCalledTimes(1)
    expect((chain as any).in).toHaveBeenCalledWith('id', [
      '550e8400-e29b-41d4-a716-446655440000',
      '660e8400-e29b-41d4-a716-446655440001',
    ])
    expect(result.uuids).toHaveLength(2)
  })

  it('runs only one query when all inputs are numerics', async () => {
    const chain = makeChain({
      data: [
        { id: 'uuid-1', legacy_recording_id: 100, source_app: 'fathom' },
        { id: 'uuid-2', legacy_recording_id: 200, source_app: 'fathom' },
      ],
      error: null,
    })
    vi.mocked(supabase.from).mockReturnValue(chain)

    const result = await toRecordingUuidBatch([100, 200])

    expect(supabase.from).toHaveBeenCalledTimes(1)
    expect((chain as any).in).toHaveBeenCalledWith('legacy_recording_id', [100, 200])
    expect(result.uuids).toEqual(['uuid-1', 'uuid-2'])
    expect(result.legacyIds).toEqual([100, 200])
  })
})
