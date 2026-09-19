import { describe, expect, it } from 'vitest'
import { mapSharedWithMeRows } from '../TranscriptsTab'

const FIRST_UUID = '11111111-1111-4111-8111-111111111111'
const SECOND_UUID = '22222222-2222-4222-8222-222222222222'

describe('mapSharedWithMeRows', () => {
  const rows = [
    {
      recording_id: FIRST_UUID,
      call_name: 'UUID-only customer call',
      recording_start_time: '2026-09-19T10:00:00.000Z',
      duration: null,
      owner_user_id: '33333333-3333-4333-8333-333333333333',
      source_type: 'share_link',
      source_label: 'Direct Link',
    },
    {
      recording_id: SECOND_UUID,
      call_name: 'Legacy-backed team call',
      recording_start_time: '2026-09-18T10:00:00.000Z',
      duration: '1800',
      owner_user_id: '44444444-4444-4444-8444-444444444444',
      source_type: 'share_link',
      source_label: 'Direct Link',
    },
  ]

  it('uses the canonical UUID for row identity, detail navigation, search, and paging', () => {
    const firstPage = mapSharedWithMeRows(rows, 'call', 0, 1)

    expect(firstPage.total).toBe(2)
    expect(firstPage.calls).toHaveLength(1)
    expect(firstPage.calls[0]).toMatchObject({
      recording_id: FIRST_UUID,
      canonical_uuid: FIRST_UUID,
      fathom_provider_id: null,
      title: 'UUID-only customer call',
      sourceLabel: 'Direct Link',
    })

    const filtered = mapSharedWithMeRows(rows, 'legacy-backed', 0, 20)
    expect(filtered.total).toBe(1)
    expect(filtered.calls[0].recording_id).toBe(SECOND_UUID)
    expect(filtered.calls[0].canonical_uuid).toBe(SECOND_UUID)
  })
})
