import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { queryKeys } from '@/lib/query-config'
import type { DiscoverableRecordingCopy } from '@/types/recording-access'

describe('recording access privacy contracts', () => {
  it('keeps discovery rows anonymous by construction', () => {
    const copy: DiscoverableRecordingCopy = {
      ordinal: 1,
      requestTarget: 'opaque-target',
      requestState: 'available',
      cooldownUntil: null,
    }
    expect(copy).toEqual({
      ordinal: 1,
      requestTarget: 'opaque-target',
      requestState: 'available',
      cooldownUntil: null,
    })

    const source = readFileSync(resolve(process.cwd(), 'src/types/recording-access.ts'), 'utf8')
    const discoveryBlock = source.match(/export interface DiscoverableRecordingCopy[\s\S]*?^}/m)?.[0] ?? ''
    expect(discoveryBlock).not.toMatch(/owner|provider|title|transcript|summary|source|email|evidence/i)
  })

  it('uses the stable Phase 38 query-key family', () => {
    expect(queryKeys.accessPolicy.eventCopies('event-1')).toEqual([
      'access-policy',
      'event-copies',
      'event-1',
    ])
    expect(queryKeys.accessPolicy.management('recording-1')).toEqual([
      'access-policy',
      'management',
      'recording-1',
    ])
  })
})
