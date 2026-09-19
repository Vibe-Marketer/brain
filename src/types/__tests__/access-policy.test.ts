import { describe, expect, it } from 'vitest'

import { queryKeys } from '@/lib/query-config'
import { ACCESS_LEVELS, ACCESS_POLICY_ORIGINS } from '@/types/access-policy'

describe('access policy contracts', () => {
  it('exposes the exact persisted access levels and origins', () => {
    expect(ACCESS_LEVELS).toEqual([
      'private',
      'attendees',
      'invitees',
      'organization',
      'link',
      'public',
    ])
    expect(ACCESS_POLICY_ORIGINS).toEqual(['default', 'custom'])
  })

  it('builds stable UUID-scoped policy and lifecycle query keys', () => {
    const recordingId = '11111111-1111-4111-a111-111111111111'
    const eventId = '22222222-2222-4222-a222-222222222222'

    expect(queryKeys.accessPolicy.accountDefault()).toEqual(['access-policy', 'account-default'])
    expect(queryKeys.accessPolicy.recording(recordingId)).toEqual([
      'access-policy',
      'recording',
      recordingId,
    ])
    expect(queryKeys.accessPolicy.management(recordingId)).toEqual([
      'access-policy',
      'management',
      recordingId,
    ])
    expect(queryKeys.accessPolicy.eventCopies(eventId)).toEqual([
      'access-policy',
      'event-copies',
      eventId,
    ])
    expect(queryKeys.accessPolicy.requests(recordingId)).toEqual([
      'access-policy',
      'requests',
      recordingId,
    ])
    expect(queryKeys.accessPolicy.grants(recordingId)).toEqual([
      'access-policy',
      'grants',
      recordingId,
    ])
  })
})
