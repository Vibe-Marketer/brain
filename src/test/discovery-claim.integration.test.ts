import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  cleanupPhase39FixtureGraph,
  createPhase39FixtureGraph,
  findPhase39FixtureResidue,
  type Phase39FixtureGraph,
} from '@/test/phase39-fixtures'
import {
  integrationDbReachable,
  makeIntegrationClient,
} from '@/test/integration-setup'

const SUITE_TAG = '[phase-39-01 discovery-claim RED]'
const FORBIDDEN_DISCOVERY_KEYS = new Set([
  'title',
  'owner',
  'owner_id',
  'owner_user_id',
  'provider',
  'source_app',
  'source_call_id',
  'fathom_provider_id',
  'transcript',
  'full_transcript',
  'transcript_segments',
  'summary',
  'roster',
  'participants',
  'participant_count',
  'organization_id',
  'workspace_id',
])

function asRows(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return []
  return value.filter(
    (item): item is Record<string, unknown> => typeof item === 'object' && item !== null,
  )
}

function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys)
    return keys
  }
  if (typeof value !== 'object' || value === null) return keys
  for (const [key, nested] of Object.entries(value)) {
    keys.add(key)
    collectKeys(nested, keys)
  }
  return keys
}

function expectRpcSuccess(
  label: string,
  result: { data: unknown; error: { message: string } | null },
): unknown {
  expect(result.error, `${SUITE_TAG} ${label}: ${result.error?.message}`).toBeNull()
  return result.data
}

describe.skipIf(!integrationDbReachable)(`${SUITE_TAG} real database contracts`, () => {
  const admin = makeIntegrationClient()
  const prefix = `phase39-discovery-${Date.now().toString(36)}`
  let graph: Phase39FixtureGraph

  beforeAll(async () => {
    graph = await createPhase39FixtureGraph(prefix)
  }, 180_000)

  afterAll(async () => {
    if (!graph) return
    await cleanupPhase39FixtureGraph(graph)
    await expect(findPhase39FixtureResidue(admin, prefix)).resolves.toEqual({
      authUsers: 0,
      organizations: 0,
      events: 0,
      recordings: 0,
      participants: 0,
      identities: 0,
      aliases: 0,
      requests: 0,
      grants: 0,
      notifications: 0,
    })
  }, 180_000)

  it('RED: confirmed primary and active verified alias receive caller-scoped counts', async () => {
    const primary = await graph.clients.confirmedPrimary.rpc('count_my_discovered_events')
    const alias = await graph.clients.verifiedAlias.rpc('count_my_discovered_events')

    expect(expectRpcSuccess('primary count', primary)).toEqual([{ event_count: 7 }])
    expect(expectRpcSuccess('verified alias count', alias)).toEqual([{ event_count: 1 }])
  })

  it.each([
    ['disconnected alias', 'disconnectedAlias'],
    ['unverified alias', 'unverifiedAlias'],
    ['matching display name', 'nameOnly'],
    ['organization membership alone', 'organizationOnly'],
    ['calendar invitation alone', 'calendarOnly'],
    ['unrelated account', 'unrelated'],
  ] as const)('RED: %s discovers no events', async (_label, role) => {
    const result = await graph.clients[role].rpc('list_my_discovered_events', {
      p_limit: 50,
      p_cursor: null,
    })
    expect(asRows(expectRpcSuccess(`${role} denied list`, result))).toEqual([])
  })

  it('RED: direct events RLS agrees with confirmed-email discovery evidence', async () => {
    const primary = await graph.clients.confirmedPrimary
      .from('events')
      .select('id')
      .in('id', [
        graph.events.confirmedPrimaryNeedsAction.id,
        graph.events.webinarDenied.id,
      ])
    expect(primary.error).toBeNull()
    expect(primary.data).toEqual([{ id: graph.events.confirmedPrimaryNeedsAction.id }])

    const alias = await graph.clients.verifiedAlias
      .from('events')
      .select('id')
      .eq('id', graph.events.aliasAvailable.id)
    expect(alias.error).toBeNull()
    expect(alias.data).toEqual([{ id: graph.events.aliasAvailable.id }])

    const calendarOnly = await graph.clients.calendarOnly
      .from('events')
      .select('id')
      .eq('id', graph.events.calendarOnlyDenied.id)
    expect(calendarOnly.error).toBeNull()
    expect(calendarOnly.data).toEqual([])
  })

  it('RED: discovery deduplicates events and preserves cap/webinar denials', async () => {
    const primary = await graph.clients.confirmedPrimary.rpc('list_my_discovered_events', {
      p_limit: 50,
      p_cursor: null,
    })
    const rows = asRows(expectRpcSuccess('bounded primary list', primary))
    const ids = rows.map((row) => row.event_id)

    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain(graph.events.participants49.id)
    expect(ids).not.toContain(graph.events.participants50.id)
    expect(ids).not.toContain(graph.events.participants51.id)
    expect(ids).not.toContain(graph.events.webinarDenied.id)
  })

  it('RED: list uses bounded cursor pagination and server action grouping', async () => {
    const first = await graph.clients.confirmedPrimary.rpc('list_my_discovered_events', {
      p_limit: 2,
      p_cursor: null,
    })
    const firstRows = asRows(expectRpcSuccess('first page', first))
    expect(firstRows).toHaveLength(2)
    expect(firstRows[0]).toHaveProperty('next_cursor')

    const cursor = firstRows[0]?.next_cursor
    const second = await graph.clients.confirmedPrimary.rpc('list_my_discovered_events', {
      p_limit: 2,
      p_cursor: cursor,
    })
    const secondRows = asRows(expectRpcSuccess('second page', second))
    expect(secondRows).toHaveLength(2)
    expect(secondRows.map((row) => row.event_id))
      .not.toEqual(expect.arrayContaining(firstRows.map((row) => row.event_id)))

    const all = asRows(expectRpcSuccess(
      'ordered list',
      await graph.clients.confirmedPrimary.rpc('list_my_discovered_events', {
        p_limit: 50,
        p_cursor: null,
      }),
    ))
    const groupOrder = all.map((row) => row.state_group)
    expect(groupOrder).toEqual([...groupOrder].sort((left, right) =>
      ['needs_action', 'available', 'waiting'].indexOf(String(left))
        - ['needs_action', 'available', 'waiting'].indexOf(String(right))))
  })

  it('RED: restricted copies expose only anonymous action state', async () => {
    const result = await graph.clients.confirmedPrimary.rpc('list_my_discovered_events', {
      p_limit: 50,
      p_cursor: null,
    })
    const rows = asRows(expectRpcSuccess('privacy projection', result))
    expect(rows.length).toBeGreaterThan(0)

    const keys = collectKeys(rows)
    for (const forbidden of FORBIDDEN_DISCOVERY_KEYS) expect(keys).not.toContain(forbidden)

    const mixed = rows.find((row) => row.event_id === graph.events.mixedCopies.id)
    expect(mixed).toBeDefined()
    const restrictedCopies = asRows(mixed?.restricted_copies)
    expect(restrictedCopies).toHaveLength(1)
    expect(Object.keys(restrictedCopies[0] ?? {}).sort()).toEqual([
      'cooldown_until',
      'copy_ordinal',
      'request_status',
    ])
  })

  it('RED: notification activation is silent and a future match notifies once', async () => {
    const baseline = await graph.clients.disconnectedAlias.rpc(
      'sync_my_discovered_event_notifications',
    )
    const activated = await graph.admin.from('identity_aliases')
      .update({ verified: true, verified_at: new Date().toISOString() })
      .eq('identity_id', graph.identities.disconnectedAlias)
    expect(activated.error).toBeNull()

    let future: Awaited<ReturnType<typeof graph.clients.disconnectedAlias.rpc>>
    try {
      future = await graph.clients.disconnectedAlias.rpc('sync_my_discovered_event_notifications')
    } finally {
      const restored = await graph.admin.from('identity_aliases')
        .update({ verified: false, verified_at: null })
        .eq('identity_id', graph.identities.disconnectedAlias)
      expect(restored.error).toBeNull()
    }

    expectRpcSuccess('silent baseline', baseline)
    expectRpcSuccess('future sync', future)
    const notices = await admin.from('user_notifications')
      .select('metadata')
      .eq('user_id', graph.users.disconnectedAlias.id)
      .eq('type', 'event_discovered')
    expect(notices.error).toBeNull()
    expect(notices.data).toEqual([{ metadata: {
      kind: 'event_discovered',
      event_id: graph.events.disconnectedAliasDenied.id,
      action: 'view_events',
    } }])
  })

  it('RED: disconnect immediately revokes alias-derived discovery without deleting evidence', async () => {
    const before = await graph.clients.verifiedAlias.rpc('list_my_discovered_events', {
      p_limit: 50,
      p_cursor: null,
    })
    const disconnected = await admin.from('identity_aliases')
      .update({ verified: false, verified_at: null })
      .eq('identity_id', graph.identities.verifiedAlias)
    expect(disconnected.error).toBeNull()

    let after: Awaited<ReturnType<typeof graph.clients.verifiedAlias.rpc>>
    try {
      after = await graph.clients.verifiedAlias.rpc('list_my_discovered_events', {
        p_limit: 50,
        p_cursor: null,
      })
    } finally {
      const restored = await admin.from('identity_aliases')
        .update({ verified: true, verified_at: '2026-08-01T00:00:00.000Z' })
        .eq('identity_id', graph.identities.verifiedAlias)
      expect(restored.error).toBeNull()
    }

    expect(asRows(expectRpcSuccess('before disconnect', before)).map((row) => row.event_id))
      .toContain(graph.events.aliasAvailable.id)
    expect(asRows(expectRpcSuccess('after disconnect', after))).toEqual([])
    const participant = await admin.from('call_participants')
      .select('id')
      .eq('event_id', graph.events.aliasAvailable.id)
    expect(participant.error).toBeNull()
    expect(participant.data).toHaveLength(1)
  })

  it('keeps the legacy organization-scoped People RPC signatures and return keys', async () => {
    const summary = await graph.clients.owner.rpc('get_people_summary', {
      p_organization_id: graph.organizationId,
    })
    const summaryRows = asRows(expectRpcSuccess('legacy get_people_summary', summary))
    expect(summaryRows.length).toBeGreaterThan(0)
    expect(Object.keys(summaryRows[0] ?? {}).sort()).toEqual([
      'call_count',
      'display_name',
      'email',
      'first_call_at',
      'last_call_at',
      'recording_ids',
    ])

    const recordings = await graph.clients.owner.rpc('get_recordings_for_person', {
      p_organization_id: graph.organizationId,
      p_email: graph.users.confirmedPrimary.email,
      p_name: null,
    })
    const recordingRows = asRows(expectRpcSuccess('legacy get_recordings_for_person', recordings))
    expect(recordingRows.length).toBeGreaterThan(0)
    expect(Object.keys(recordingRows[0] ?? {}).sort()).toEqual([
      'duration',
      'participant_count',
      'participant_email',
      'participant_name',
      'participant_type',
      'recording_id',
      'recording_start_time',
      'title',
    ])
  })
})
