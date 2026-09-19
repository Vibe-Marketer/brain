import { describe, expect, it } from 'vitest'

import { useApproveRecordingAccessRequest, useRequestRecordingAccess } from '@/hooks/useRecordingAccess'

describe('recording access hooks', () => {
  it('exports requester and owner lifecycle hooks', () => {
    expect(useRequestRecordingAccess).toBeTypeOf('function')
    expect(useApproveRecordingAccessRequest).toBeTypeOf('function')
  })
})
