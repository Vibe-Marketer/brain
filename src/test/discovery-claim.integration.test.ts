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

  it('confirmed primary and active verified alias receive caller-scoped counts', async () => {
    const primary = await graph.clients.confirmedPrimary.rpc('count_my_discovered_events')
    const alias = await graph.clients.verifiedAlias.rpc('count_my_discovered_events')

    expect(expectRpcSuccess('primary count', primary)).toEqual([{ event_count: 7 }])
    expect(expectRpcSuccess('verified alias count', alias)).toEqual([{ event_count: 1 }])
  })

  for (const [label, role] of [
    ['disconnected alias', 'disconnectedAlias'],
    ['unverified alias', 'unverifiedAlias'],
    ['matching display name', 'nameOnly'],
    ['organization membership alone', 'organizationOnly'],
    ['calendar invitation alone', 'calendarOnly'],
    ['unrelated account', 'unrelated'],
  ] as const) {
    it(`${label} discovers no events`, async () => {
      const result = await graph.clients[role].rpc('list_my_discovered_events', {
        p_limit: 50,
        p_cursor: null,
      })
      expect(asRows(expectRpcSuccess(`${role} denied list`, result))).toEqual([])
    })
  }

  it('direct events RLS agrees with confirmed-email discovery evidence', async () => {
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

  it('discovery deduplicates events and preserves cap/webinar denials', async () => {
    const boundaryKeys = ['participants49', 'participants50', 'participants51'] as const
    const originals = await Promise.all(boundaryKeys.map(async (key) => {
      const result = await admin.from('call_participants')
        .select('id,email')
        .eq('event_id', graph.events[key].id)
        .limit(1)
        .single()
      expect(result.error).toBeNull()
      expect(result.data).not.toBeNull()
      return { id: String(result.data?.id), email: String(result.data?.email) }
    }))

    let primary!: Awaited<ReturnType<typeof graph.clients.confirmedPrimary.rpc>>
    try {
      for (const original of originals) {
        const updated = await admin.from('call_participants')
          .update({ email: graph.users.confirmedPrimary.email })
          .eq('id', original.id)
        expect(updated.error).toBeNull()
      }
      primary = await graph.clients.confirmedPrimary.rpc('list_my_discovered_events', {
        p_limit: 50,
        p_cursor: null,
      })
    } finally {
      for (const original of originals) {
        const restored = await admin.from('call_participants')
          .update({ email: original.email })
          .eq('id', original.id)
        expect(restored.error).toBeNull()
      }
    }
    const rows = asRows(expectRpcSuccess('bounded primary list', primary))
    const ids = rows.map((row) => row.event_id)

    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain(graph.events.participants49.id)
    expect(ids).not.toContain(graph.events.participants50.id)
    expect(ids).not.toContain(graph.events.participants51.id)
    expect(ids).not.toContain(graph.events.webinarDenied.id)
  })

  it('list uses bounded cursor pagination and server action grouping', async () => {
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

  it('restricted copies expose only anonymous action state', async () => {
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

  it('notification activation is silent and a future match notifies exactly once', async () => {
    const primaryBaseline = await graph.clients.confirmedPrimary.rpc(
      'sync_my_discovered_event_notifications',
    )
    expect(expectRpcSuccess('primary silent baseline', primaryBaseline)).toEqual(0)

    const primaryNotices = await admin.from('user_notifications')
      .select('id')
      .eq('user_id', graph.users.confirmedPrimary.id)
      .eq('type', 'event_discovered')
    expect(primaryNotices.error).toBeNull()
    expect(primaryNotices.data).toEqual([])

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
      expect(expectRpcSuccess(
        'repeated future sync',
        await graph.clients.disconnectedAlias.rpc('sync_my_discovered_event_notifications'),
      )).toEqual(0)
    } finally {
      const restored = await graph.admin.from('identity_aliases')
        .update({ verified: false, verified_at: null })
        .eq('identity_id', graph.identities.disconnectedAlias)
      expect(restored.error).toBeNull()
    }

    expect(expectRpcSuccess('silent baseline', baseline)).toEqual(0)
    expect(expectRpcSuccess('future sync', future)).toEqual(1)
    const notices = await admin.from('user_notifications')
      .select('title,body,metadata')
      .eq('user_id', graph.users.disconnectedAlias.id)
      .eq('type', 'event_discovered')
    expect(notices.error).toBeNull()
    expect(notices.data).toEqual([{
      title: 'New event found',
      body: 'A new event connected to your verified email is ready to review.',
      metadata: {
        kind: 'event_discovered',
        event_id: graph.events.disconnectedAliasDenied.id,
        action: 'view_events',
      },
    }])
    expect([...collectKeys(notices.data?.[0]?.metadata)].sort()).toEqual([
      'action',
      'event_id',
      'kind',
    ])
    expect(JSON.stringify(notices.data)).not.toContain(graph.prefix)
    expect(JSON.stringify(notices.data)).not.toContain(graph.users.disconnectedAlias.email)

    const ledger = await admin.from('event_discovery_notification_ledger')
      .select('event_id,notified_at')
      .eq('user_id', graph.users.disconnectedAlias.id)
      .eq('event_id', graph.events.disconnectedAliasDenied.id)
    expect(ledger.error).toBeNull()
    expect(ledger.data).toHaveLength(1)
    expect(ledger.data?.[0]?.notified_at).not.toBeNull()

    const browserLedger = await graph.clients.disconnectedAlias
      .from('event_discovery_notification_ledger')
      .select('event_id')
    expect(browserLedger.data).toBeNull()
    expect(browserLedger.error).not.toBeNull()

    const crossUserNotices = await graph.clients.unrelated.from('user_notifications')
      .select('id')
      .eq('user_id', graph.users.disconnectedAlias.id)
      .eq('type', 'event_discovered')
    expect(crossUserNotices.error).toBeNull()
    expect(crossUserNotices.data).toEqual([])
  })

  it('atomically disconnects a non-primary alias and revokes only derived access', async () => {
    const alias = await admin.from('identity_aliases')
      .select('id,value')
      .eq('identity_id', graph.identities.verifiedAlias)
      .eq('alias_type', 'email')
      .single()
    expect(alias.error).toBeNull()
    expect(alias.data).not.toBeNull()

    const primaryAliasIdentityId = crypto.randomUUID()
    const sharedParticipantEmail = graph.users.verifiedAlias.email
    const targetParticipant = await admin.from('call_participants')
      .select('id,recording_id,event_id,identity_id,email,name,participant_type,role,has_confirmed_speech,sources')
      .eq('event_id', graph.events.aliasAvailable.id)
    expect(targetParticipant.error).toBeNull()
    expect(targetParticipant.data).toHaveLength(1)

    let primaryAliasId: string | null = null
    try {
      const sharedParticipant = await admin.from('call_participants').insert({
        recording_id: graph.events.confirmedPrimaryNeedsAction.recordingIds[0],
        organization_id: graph.organizationId,
        event_id: graph.events.confirmedPrimaryNeedsAction.id,
        identity_id: null,
        name: 'Verified Alias Primary',
        email: sharedParticipantEmail,
        participant_type: 'speaker',
        role: 'speaker',
        has_confirmed_speech: true,
        sources: ['transcript_speaker'],
      })
      expect(sharedParticipant.error).toBeNull()

      const primaryIdentity = await admin.from('identities').insert({
        id: primaryAliasIdentityId,
        owner_user_id: graph.users.verifiedAlias.id,
        display_name: 'Primary guard fixture',
      })
      expect(primaryIdentity.error).toBeNull()
      const primaryAlias = await admin.from('identity_aliases').insert({
        identity_id: primaryAliasIdentityId,
        alias_type: 'email',
        value: graph.users.verifiedAlias.email,
        verified: true,
        verified_at: new Date().toISOString(),
        confidence: 1,
        evidence: 'phase39_primary_disconnect_guard',
      }).select('id').single()
      expect(primaryAlias.error).toBeNull()
      primaryAliasId = primaryAlias.data?.id ?? null

      expect(expectRpcSuccess(
        'verified alias baseline',
        await graph.clients.verifiedAlias.rpc('sync_my_discovered_event_notifications'),
      )).toBe(0)

      const seededNotice = await admin.from('user_notifications').insert({
        user_id: graph.users.verifiedAlias.id,
        type: 'event_discovered',
        title: 'New event found',
        body: 'A new event connected to your verified email is ready to review.',
        metadata: {
          kind: 'event_discovered',
          event_id: graph.events.aliasAvailable.id,
          action: 'view_events',
        },
      })
      expect(seededNotice.error).toBeNull()

      const before = asRows(expectRpcSuccess(
        'before disconnect',
        await graph.clients.verifiedAlias.rpc('list_my_discovered_events', {
          p_limit: 50,
          p_cursor: null,
        }),
      ))
      expect(before.map((row) => row.event_id)).toEqual(expect.arrayContaining([
        graph.events.aliasAvailable.id,
        graph.events.confirmedPrimaryNeedsAction.id,
      ]))

      expect(expectRpcSuccess(
        'wrong caller disconnect',
        await graph.clients.unrelated.rpc('disconnect_my_verified_email_alias', {
          p_alias_id: alias.data?.id,
        }),
      )).toBe(false)
      expect(expectRpcSuccess(
        'primary email disconnect guard',
        await graph.clients.verifiedAlias.rpc('disconnect_my_verified_email_alias', {
          p_alias_id: primaryAliasId,
        }),
      )).toBe(false)
      expect(expectRpcSuccess(
        'owned alias disconnect',
        await graph.clients.verifiedAlias.rpc('disconnect_my_verified_email_alias', {
          p_alias_id: alias.data?.id,
        }),
      )).toBe(true)

      const aliasAfter = await admin.from('identity_aliases')
        .select('verified,verified_at')
        .eq('id', alias.data?.id)
        .single()
      expect(aliasAfter.error).toBeNull()
      expect(aliasAfter.data).toEqual({ verified: false, verified_at: null })

      const after = asRows(expectRpcSuccess(
        'after disconnect',
        await graph.clients.verifiedAlias.rpc('list_my_discovered_events', {
          p_limit: 50,
          p_cursor: null,
        }),
      ))
      expect(after.map((row) => row.event_id)).not.toContain(graph.events.aliasAvailable.id)
      expect(after.map((row) => row.event_id)).toContain(graph.events.confirmedPrimaryNeedsAction.id)

      const directRevoked = await graph.clients.verifiedAlias.from('events')
        .select('id')
        .eq('id', graph.events.aliasAvailable.id)
      expect(directRevoked.error).toBeNull()
      expect(directRevoked.data).toEqual([])

      const noticesAfter = await admin.from('user_notifications')
        .select('id')
        .eq('user_id', graph.users.verifiedAlias.id)
        .eq('type', 'event_discovered')
      expect(noticesAfter.error).toBeNull()
      expect(noticesAfter.data).toEqual([])
      expect(expectRpcSuccess(
        'disconnected sync',
        await graph.clients.verifiedAlias.rpc('sync_my_discovered_event_notifications'),
      )).toBe(0)

      const participantAfter = await admin.from('call_participants')
        .select('id,recording_id,event_id,identity_id,email,name,participant_type,role,has_confirmed_speech,sources')
        .eq('event_id', graph.events.aliasAvailable.id)
      expect(participantAfter.error).toBeNull()
      expect(participantAfter.data).toEqual(targetParticipant.data)

      const restored = await admin.from('identity_aliases')
        .update({ verified: true, verified_at: '2026-08-01T00:00:00.000Z' })
        .eq('id', alias.data?.id)
      expect(restored.error).toBeNull()
      expect(expectRpcSuccess(
        'reconnect does not replay',
        await graph.clients.verifiedAlias.rpc('sync_my_discovered_event_notifications'),
      )).toBe(0)
      const replayed = await admin.from('user_notifications')
        .select('id')
        .eq('user_id', graph.users.verifiedAlias.id)
        .eq('type', 'event_discovered')
      expect(replayed.error).toBeNull()
      expect(replayed.data).toEqual([])
    } finally {
      await admin.from('user_notifications')
        .delete()
        .eq('user_id', graph.users.verifiedAlias.id)
        .eq('type', 'event_discovered')
      await admin.from('identity_aliases')
        .update({ verified: true, verified_at: '2026-08-01T00:00:00.000Z' })
        .eq('identity_id', graph.identities.verifiedAlias)
      await admin.from('call_participants')
        .delete()
        .eq('recording_id', graph.events.confirmedPrimaryNeedsAction.recordingIds[0])
        .eq('email', sharedParticipantEmail)
      if (primaryAliasId) await admin.from('identity_aliases').delete().eq('id', primaryAliasId)
      await admin.from('identities').delete().eq('id', primaryAliasIdentityId)
    }
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
