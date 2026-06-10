import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchAllCallsForObsidianExport } from '../api-tokens.service'

const fromSpy = vi.fn()

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => fromSpy(...args),
  },
}))

interface QueryResult<Row> {
  data: Row[] | null
  error: { message: string } | null
}

class QueryMock<Row extends Record<string, unknown>> {
  readonly operations: unknown[][] = []

  constructor(
    private rows: Row[],
    private error: { message: string } | null = null,
  ) {}

  select(columns: string) {
    this.operations.push(['select', columns])
    return this
  }

  eq(column: string, value: unknown) {
    this.operations.push(['eq', column, value])
    return this
  }

  in(column: string, values: unknown[]) {
    this.operations.push(['in', column, values])
    return this
  }

  order(column: string, options?: unknown) {
    this.operations.push(['order', column, options])
    return this
  }

  async range(from: number, to: number): Promise<QueryResult<Row>> {
    this.operations.push(['range', from, to])
    return {
      data: this.error ? null : this.rows.slice(from, to + 1),
      error: this.error,
    }
  }
}

const workspaceRows = [
  { id: 'ws-sales', name: 'Sales' },
  { id: 'ws-success', name: 'Customer Success' },
]

const workspaceEntryRows = [
  { recording_id: 'rec-0001', workspace_id: 'ws-sales' },
  { recording_id: 'rec-4999', workspace_id: 'ws-success' },
]

function makeRecordingRows() {
  return Array.from({ length: 5000 }, (_, index) => {
    const padded = String(index).padStart(4, '0')
    const source_metadata =
      index === 0
        ? { fathom_url: 'https://fathom.video/share/abc', recorded_by_name: 'Ada Lovelace' }
        : index === 1
          ? { zoom_share_url: 'https://zoom.us/rec/share/def' }
          : index === 2
            ? {}
            : { share_url: `https://calls.example/${padded}` }

    return {
      id: `rec-${padded}`,
      fathom_provider_id: index === 0 ? 9001 : null,
      title: `Exported call ${padded}`,
      created_at: `2026-06-01T${String(index % 24).padStart(2, '0')}:00:00.000Z`,
      recording_start_time: `2026-06-01T${String(index % 24).padStart(2, '0')}:00:00.000Z`,
      recording_end_time: `2026-06-01T${String(index % 24).padStart(2, '0')}:30:00.000Z`,
      full_transcript: `Transcript for exported call ${padded}`,
      transcript_segments: index === 0 ? [{ text: 'Structured export transcript', speaker_name: 'Ada' }] : null,
      summary: `Summary for exported call ${padded}`,
      source_metadata,
    }
  })
}

describe('fetchAllCallsForObsidianExport', () => {
  const queries: Record<string, QueryMock<Record<string, unknown>>[]> = {}
  const recordingRows = makeRecordingRows()

  beforeEach(() => {
    vi.clearAllMocks()
    queries.workspaces = []
    queries.workspace_entries = []
    queries.recordings = []

    fromSpy.mockImplementation((table: string) => {
      const rowsByTable: Record<string, Record<string, unknown>[]> = {
        workspaces: workspaceRows,
        workspace_entries: workspaceEntryRows,
        recordings: recordingRows,
      }
      const rows = rowsByTable[table]
      if (!rows) throw new Error(`Unexpected table ${table}`)

      const query = new QueryMock(rows)
      queries[table].push(query)
      return query
    })
  })

  it('pages every export table and returns 5,000 calls without truncation', async () => {
    const calls = await fetchAllCallsForObsidianExport('org-1')

    expect(calls.length).toBe(5000)
    expect(calls.at(-1)?.title).toBe('Exported call 4999')
    expect(calls.at(-1)?.canonical_uuid).toBe('rec-4999')
    expect(calls.at(-1)?.workspace_name).toBe('Customer Success')
    expect(calls[0]).toMatchObject({
      recording_id: 9001,
      canonical_uuid: 'rec-0000',
      url: 'https://fathom.video/share/abc',
      recorded_by_name: 'Ada Lovelace',
      transcript_segments: [{ text: 'Structured export transcript', speaker_name: 'Ada' }],
    })

    const recordingSelect = queries.recordings[0].operations.find((operation) => operation[0] === 'select')
    expect(recordingSelect?.[1]).toContain('transcript_segments')

    const recordingRanges = queries.recordings.flatMap((query) =>
      query.operations.filter((operation) => operation[0] === 'range'),
    )
    expect(recordingRanges).toEqual([
      ['range', 0, 999],
      ['range', 1000, 1999],
      ['range', 2000, 2999],
      ['range', 3000, 3999],
      ['range', 4000, 4999],
      ['range', 5000, 5999],
    ])
  })

  it('maps workspace_entries, canonical UUIDs, and provider share URLs', async () => {
    const calls = await fetchAllCallsForObsidianExport('org-1')

    expect(calls.find((call) => call.canonical_uuid === 'rec-0001')).toMatchObject({
      title: 'Exported call 0001',
      workspace_name: 'Sales',
      url: 'https://zoom.us/rec/share/def',
    })
    expect(calls.find((call) => call.canonical_uuid === 'rec-0002')).toMatchObject({
      title: 'Exported call 0002',
      url: null,
    })
    expect(calls.every((call) => typeof call.canonical_uuid === 'string')).toBe(true)
  })
})
