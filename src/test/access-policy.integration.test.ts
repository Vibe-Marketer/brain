/**
 * Phase 38 access-policy acceptance contract.
 *
 * These are real-database contracts for the additive Phase 38 schema and RPCs.
 */

import { randomUUID } from 'node:crypto'

import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  PHASE38_EVENT_AGGREGATION_CASES,
  PHASE38_PARTICIPATION_BOUNDARY_CASES,
  PHASE38_PROVIDER_SIGNAL_CASES,
  type ProviderEventKind,
  type RequesterEvidence,
} from '@/test/fixtures/phase38-provider-event-kind'
import { integrationDbReachable } from '@/test/integration-setup'
import {
  cleanupPhase38FixtureGraph,
  createPhase38FixtureGraph,
  type Phase38FixtureGraph,
  type Phase38FixtureRole,
} from '@/test/phase38-fixtures'

const SUITE_TAG = '[phase-38-02 access-policy]'
const ACCESS_LEVELS = [
  'private',
  'attendees',
  'invitees',
  'organization',
  'link',
  'public',
] as const

type AccessLevel = (typeof ACCESS_LEVELS)[number]

const DISCOVERY_KEYS = [
  'cooldown_until',
  'copy_ordinal',
  'recording_id',
  'request_status',
] as const

const FORBIDDEN_DISCOVERY_KEYS = [
  'owner',
  'owner_id',
  'owner_user_id',
  'provider',
  'source_app',
  'source_call_id',
  'fathom_provider_id',
  'title',
  'transcript',
  'full_transcript',
  'summary',
  'organization_id',
  'workspace_id',
  'audio_url',
  'video_url',
  'share_url',
  'duration',
  'thumbnail_url',
  'evidence',
] as const

const asRows = (value: unknown): Array<Record<string, unknown>> => {
  if (!Array.isArray(value)) return []
  return value.filter(
    (item): item is Record<string, unknown> => typeof item === 'object' && item !== null,
  )
}

const expectRpcSuccess = (
  label: string,
  result: { data: unknown; error: { message: string } | null },
): unknown => {
  expect(result.error, `${SUITE_TAG} ${label}: ${result.error?.message}`).toBeNull()
  return result.data
}

const setProviderSignal = async (
  graph: Phase38FixtureGraph,
  recordingId: string,
  sourceApp: string,
  metadata: Record<string, unknown>,
): Promise<void> => {
  const updated = await graph.admin
    .from('recordings')
    .update({ source_app: sourceApp, source_metadata: metadata })
    .eq('id', recordingId)
  expect(updated.error, `${SUITE_TAG} provider fixture update`).toBeNull()
}

const signalMetadata = (kind: ProviderEventKind): { sourceApp: string; metadata: Record<string, unknown> } => {
  if (kind === 'webinar') return { sourceApp: 'zoom', metadata: { zoom_type: 5 } }
  if (kind === 'non_webinar') return { sourceApp: 'zoom', metadata: { zoom_type: 2 } }
  return { sourceApp: 'grain', metadata: { grain_meeting_type: { name: 'Executive webinar' } } }
}

const configureEventSignals = async (
  graph: Phase38FixtureGraph,
  signals: readonly ProviderEventKind[],
): Promise<void> => {
  const recordingIds = [graph.ids.uuidRecordingId, graph.ids.legacyRecordingId]
  for (let index = 0; index < recordingIds.length; index += 1) {
    const configured = signalMetadata(signals[index] ?? signals[signals.length - 1] ?? 'unknown')
    await setProviderSignal(graph, recordingIds[index], configured.sourceApp, configured.metadata)
  }
}

const supplementalIdentityIds: string[] = []

const setConfirmedIdentityCount = async (
  graph: Phase38FixtureGraph,
  requestedCount: number,
): Promise<void> => {
  if (supplementalIdentityIds.length > 0) {
    await graph.admin
      .from('call_participants')
      .delete()
      .in('identity_id', [...supplementalIdentityIds])
    await graph.admin.from('identity_aliases').delete().in('identity_id', [...supplementalIdentityIds])
    await graph.admin.from('identities').delete().in('id', [...supplementalIdentityIds])
    supplementalIdentityIds.splice(0)
  }

  const additionalCount = Math.max(0, requestedCount - 1)
  if (additionalCount === 0) return

  const identities = Array.from({ length: additionalCount }, (_, index) => ({
    id: randomUUID(),
    owner_user_id: graph.users.confirmedParticipant.id,
    index,
  }))
  supplementalIdentityIds.push(...identities.map(({ id }) => id))

  const identityInsert = await graph.admin
    .from('identities')
    .insert(identities.map(({ id, owner_user_id }) => ({ id, owner_user_id })))
  expect(identityInsert.error, `${SUITE_TAG} supplemental identities`).toBeNull()

  const aliasInsert = await graph.admin.from('identity_aliases').insert(
    identities.map(({ id, index }) => ({
      identity_id: id,
      alias_type: 'email',
      value: `${graph.prefix}-confirmed-${index}@example.invalid`,
      verified: true,
      verified_at: '2026-09-19T14:00:00.000Z',
      evidence: 'phase38_boundary_fixture',
      confidence: 1,
    })),
  )
  expect(aliasInsert.error, `${SUITE_TAG} supplemental verified aliases`).toBeNull()

  const participantInsert = await graph.admin.from('call_participants').insert(
    identities.map(({ id, index }) => ({
      recording_id: graph.ids.uuidRecordingId,
      organization_id: graph.ids.organizationId,
      event_id: graph.ids.eventId,
      identity_id: id,
      name: `Confirmed boundary participant ${index}`,
      email: `${graph.prefix}-confirmed-${index}@example.invalid`,
      participant_type: 'speaker',
      role: 'speaker',
      has_confirmed_speech: true,
      sources: ['transcript_speaker'],
    })),
  )
  expect(participantInsert.error, `${SUITE_TAG} supplemental confirmed participants`).toBeNull()
}

const requesterForEvidence = (
  graph: Phase38FixtureGraph,
  evidence: RequesterEvidence,
): SupabaseClient => {
  if (evidence === 'verified_confirmed') return graph.clients.signedIn.confirmedParticipant
  if (evidence === 'invitee_only') return graph.clients.signedIn.inviteeOnly
  if (evidence === 'organization_only') return graph.clients.signedIn.teamMember
  return graph.clients.signedIn.unrelated
}

const resetAccessLifecycle = async (graph: Phase38FixtureGraph): Promise<void> => {
  const privatePolicy = await graph.admin
    .from('recordings')
    .update({ access_level: 'private', access_policy_origin: 'custom' })
    .eq('id', graph.ids.uuidRecordingId)
  expect(privatePolicy.error, `${SUITE_TAG} reset private policy`).toBeNull()

  for (const table of [
    'recording_access_audit_log',
    'recording_access_email_outbox',
    'recording_access_grants',
    'recording_access_requests',
  ] as const) {
    const deleted = await graph.admin.from(table).delete().eq('recording_id', graph.ids.uuidRecordingId)
    expect(deleted.error, `${SUITE_TAG} reset ${table}`).toBeNull()
  }
  const notices = await graph.admin
    .from('user_notifications')
    .delete()
    .eq('user_id', graph.users.owner.id)
    .in('type', [
      'recording_access_requested',
      'recording_access_approved',
      'recording_access_denied',
      'recording_access_revoked',
    ])
  expect(notices.error, `${SUITE_TAG} reset access notifications`).toBeNull()
}

describe.skipIf(!integrationDbReachable)(`${SUITE_TAG} real database contract`, () => {
  let graph: Phase38FixtureGraph

  beforeAll(async () => {
    graph = await createPhase38FixtureGraph(`phase38-a-${Date.now().toString(36)}`)
  }, 120_000)

  afterAll(async () => {
    if (!graph) return
    await setConfirmedIdentityCount(graph, 1)
    await cleanupPhase38FixtureGraph(graph)
  }, 120_000)

  for (const level of ACCESS_LEVELS) {
    it(`D-02 accepts the ${level} recording access level`, async () => {
      const result = await graph.clients.signedIn.owner.rpc('set_recording_access_level', {
        p_recording_id: graph.ids.uuidRecordingId,
        p_access_level: level,
      })
      expectRpcSuccess(`set ${level}`, result)

      const policy = await graph.clients.signedIn.owner.rpc('get_recording_access_policy', {
        p_recording_id: graph.ids.uuidRecordingId,
      })
      const rows = asRows(expectRpcSuccess(`get ${level}`, policy))
      expect(rows[0]?.access_level).toBe(level)
      expect(rows[0]?.access_policy_origin).toBe('custom')
    })
  }

  it('D-01/D-03/D-05 snapshots Private by default and changes only future recordings', async () => {
    const resetDefault = await graph.admin
      .from('user_settings')
      .update({ default_recording_access_level: 'private' })
      .eq('user_id', graph.users.owner.id)
    expect(resetDefault.error).toBeNull()
    const resetRecording = await graph.admin
      .from('recordings')
      .update({ access_level: 'private', access_policy_origin: 'default' })
      .eq('id', graph.ids.uuidRecordingId)
    expect(resetRecording.error).toBeNull()

    const original = await graph.clients.signedIn.owner.rpc('get_recording_access_policy', {
      p_recording_id: graph.ids.uuidRecordingId,
    })
    const originalRows = asRows(expectRpcSuccess('read initial policy', original))
    expect(originalRows[0]).toMatchObject({ access_level: 'private', access_policy_origin: 'default' })

    const changed = await graph.clients.signedIn.owner.rpc('set_default_recording_access_level', {
      p_access_level: 'attendees',
    })
    expectRpcSuccess('change future default', changed)

    const existing = await graph.clients.signedIn.owner.rpc('get_recording_access_policy', {
      p_recording_id: graph.ids.uuidRecordingId,
    })
    expect(asRows(expectRpcSuccess('existing policy unchanged', existing))[0]?.access_level).toBe('private')

    const created = await graph.admin
      .from('recordings')
      .insert({
        organization_id: graph.ids.organizationId,
        owner_user_id: graph.users.owner.id,
        title: `${graph.prefix} future-default recording`,
        source_app: 'manual-mcp-import',
        source_call_id: `${graph.prefix}-future-default`,
      })
      .select('id, access_level, access_policy_origin')
      .single()
    expect(created.error).toBeNull()
    expect(created.data).toMatchObject({ access_level: 'attendees', access_policy_origin: 'default' })
    if (created.data?.id) {
      const workspaceEntries = await graph.admin
        .from('workspace_entries')
        .delete()
        .eq('recording_id', created.data.id)
      expect(workspaceEntries.error).toBeNull()
      const removed = await graph.admin.from('recordings').delete().eq('id', created.data.id)
      expect(removed.error).toBeNull()
    }
  })

  it('D-04 reset snapshots the current default and clears the custom state', async () => {
    expectRpcSuccess('set custom', await graph.clients.signedIn.owner.rpc('set_recording_access_level', {
      p_recording_id: graph.ids.uuidRecordingId,
      p_access_level: 'organization',
    }))
    expectRpcSuccess('set account default', await graph.clients.signedIn.owner.rpc('set_default_recording_access_level', {
      p_access_level: 'invitees',
    }))
    expectRpcSuccess('reset recording policy', await graph.clients.signedIn.owner.rpc('reset_recording_access_level', {
      p_recording_id: graph.ids.uuidRecordingId,
    }))
    const policy = await graph.clients.signedIn.owner.rpc('get_recording_access_policy', {
      p_recording_id: graph.ids.uuidRecordingId,
    })
    expect(asRows(expectRpcSuccess('read reset policy', policy))[0]).toMatchObject({
      access_level: 'invitees',
      access_policy_origin: 'default',
    })
  })

  for (const role of ['admin', 'teamMember', 'coach', 'confirmedParticipant', 'inviteeOnly', 'grantRecipient', 'unrelated'] as const) {
    it(`D-06 denies policy mutation by ${role}`, async () => {
      const result = await graph.clients.signedIn[role].rpc('set_recording_access_level', {
        p_recording_id: graph.ids.uuidRecordingId,
        p_access_level: 'public',
      })
      expect(result.error, `${SUITE_TAG} actor=${role} expected owner-only mutation denial`).not.toBeNull()
      const policy = await graph.clients.signedIn.owner.rpc('get_recording_access_policy', {
        p_recording_id: graph.ids.uuidRecordingId,
      })
      expect(asRows(expectRpcSuccess(`owner verifies ${role} denial`, policy))[0]?.access_level).not.toBe('public')
    })
  }

  it('D-07/D-08 returns only the event existence allowlist and anonymous copy keys', async () => {
    const existence = await graph.clients.signedIn.confirmedParticipant.rpc(
      'get_event_existence_for_participant',
      { p_event_id: graph.ids.eventId },
    )
    const existenceRows = asRows(expectRpcSuccess('event existence', existence))
    expect(existenceRows).toHaveLength(1)
    expect(Object.keys(existenceRows[0] ?? {}).sort()).toEqual(['event_id', 'has_other_copies'])

    const discovery = await graph.clients.signedIn.confirmedParticipant.rpc(
      'list_discoverable_recording_copies',
      { p_event_id: graph.ids.eventId },
    )
    const rows = asRows(expectRpcSuccess('discovery', discovery))
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual([...DISCOVERY_KEYS].sort())
      for (const key of FORBIDDEN_DISCOVERY_KEYS) expect(row).not.toHaveProperty(key)
    }
  })

  for (const role of ['inviteeOnly', 'teamMember', 'unrelated'] as const) {
    it(`D-09 returns no existence/discovery rows for ${role}`, async () => {
      const existence = await graph.clients.signedIn[role].rpc('get_event_existence_for_participant', {
        p_event_id: graph.ids.eventId,
      })
      expect(asRows(expectRpcSuccess(`${role} existence`, existence))).toEqual([])
      const discovery = await graph.clients.signedIn[role].rpc('list_discoverable_recording_copies', {
        p_event_id: graph.ids.eventId,
      })
      expect(asRows(expectRpcSuccess(`${role} discovery`, discovery))).toEqual([])
    })
  }

  for (const fixture of PHASE38_PROVIDER_SIGNAL_CASES) {
    it(`D-10 classifies provider fixture ${fixture.id} as ${fixture.expected}`, async () => {
      await setProviderSignal(
        graph,
        graph.ids.uuidRecordingId,
        fixture.sourceApp,
        fixture.metadata,
      )
      await setProviderSignal(graph, graph.ids.legacyRecordingId, 'fathom', {})
      const result = await graph.clients.signedIn.confirmedParticipant.rpc(
        'list_discoverable_recording_copies',
        { p_event_id: graph.ids.eventId },
      )
      const rows = asRows(expectRpcSuccess(`provider fixture ${fixture.id}`, result))
      expect(rows.length > 0).toBe(fixture.expected !== 'webinar')
    })
  }

  for (const fixture of PHASE38_EVENT_AGGREGATION_CASES) {
    it(`D-10 aggregates provider case ${fixture.id}`, async () => {
      await configureEventSignals(graph, fixture.signals)
      const result = await graph.clients.signedIn.confirmedParticipant.rpc(
        'list_discoverable_recording_copies',
        { p_event_id: graph.ids.eventId },
      )
      const rows = asRows(expectRpcSuccess(`aggregation ${fixture.id}`, result))
      expect(rows.length === 0).toBe(fixture.suppressesDiscovery)
    })
  }

  for (const fixture of PHASE38_PARTICIPATION_BOUNDARY_CASES) {
    it(`D-09/D-10 enforces boundary ${fixture.id}`, async () => {
      await resetAccessLifecycle(graph)
      await configureEventSignals(graph, fixture.providerSignals)
      await setConfirmedIdentityCount(graph, fixture.confirmedIdentityCount)
      try {
        const client = requesterForEvidence(graph, fixture.requesterEvidence)
        const result = await client.rpc('list_discoverable_recording_copies', {
          p_event_id: graph.ids.eventId,
        })
        const rows = asRows(expectRpcSuccess(`boundary ${fixture.id}`, result))
        expect(rows.length > 0).toBe(fixture.mayDiscover)

        const request = await client.rpc('request_recording_access', {
          p_recording_id: graph.ids.uuidRecordingId,
        })
        if (fixture.mayDiscover) expectRpcSuccess(`request boundary ${fixture.id}`, request)
        else expect(request.error, `${SUITE_TAG} request gate ${fixture.id}`).not.toBeNull()
      } finally {
        await resetAccessLifecycle(graph)
        await setConfirmedIdentityCount(graph, 1)
      }
    })
  }

  it('D-11 keeps the direct share path valid when webinar discovery is suppressed', async () => {
    await configureEventSignals(graph, ['webinar', 'unknown'])
    const result = await graph.clients.signedIn.confirmedParticipant.rpc(
      'list_discoverable_recording_copies',
      { p_event_id: graph.ids.eventId },
    )
    expect(asRows(expectRpcSuccess('webinar discovery suppression', result))).toEqual([])
    const share = await graph.clients.signedIn.grantRecipient
      .from('call_share_links')
      .select('id, share_token, status')
      .eq('id', graph.ids.legacyShareLinkId)
      .single()
    expect(share.error, `${SUITE_TAG} direct share survives webinar suppression`).toBeNull()
    expect(share.data?.status).toBe('active')
  })

  it('D-12 makes request retries one pending row, owner notification, audit, and outbox item', async () => {
    await resetAccessLifecycle(graph)
    await configureEventSignals(graph, ['unknown'])
    const client = graph.clients.signedIn.confirmedParticipant
    const first = await client.rpc('request_recording_access', {
      p_recording_id: graph.ids.uuidRecordingId,
    })
    const second = await client.rpc('request_recording_access', {
      p_recording_id: graph.ids.uuidRecordingId,
    })
    const firstData = expectRpcSuccess('first request', first)
    const secondData = expectRpcSuccess('retry request', second)
    expect(secondData).toEqual(firstData)

    for (const [table, filter] of [
      ['recording_access_requests', 'recording_id'],
      ['recording_access_audit_log', 'recording_id'],
      ['recording_access_email_outbox', 'recording_id'],
    ] as const) {
      const rows = await graph.admin.from(table).select('*').eq(filter, graph.ids.uuidRecordingId)
      expect(rows.error, `${SUITE_TAG} inspect ${table}`).toBeNull()
      expect(rows.data).toHaveLength(1)
    }
    const notices = await graph.admin
      .from('user_notifications')
      .select('*')
      .eq('user_id', graph.users.owner.id)
      .eq('type', 'recording_access_requested')
    expect(notices.error).toBeNull()
    expect(notices.data).toHaveLength(1)
  })

  for (const action of ['approve', 'deny'] as const) {
    it(`D-13/D-15 owner-only ${action} exposes only approved review evidence`, async () => {
      await resetAccessLifecycle(graph)
      const requested = await graph.clients.signedIn.confirmedParticipant.rpc('request_recording_access', {
        p_recording_id: graph.ids.uuidRecordingId,
      })
      const requestRows = asRows(expectRpcSuccess(`create ${action} request`, requested))
      const requestId = String(requestRows[0]?.request_id ?? requested.data)
      const rpc = action === 'approve' ? 'approve_recording_access_request' : 'deny_recording_access_request'

      const forbidden = await graph.clients.signedIn.admin.rpc(rpc, { p_request_id: requestId })
      expect(forbidden.error, `${SUITE_TAG} non-owner ${action} must fail`).not.toBeNull()
      const ownerResult = await graph.clients.signedIn.owner.rpc(rpc, { p_request_id: requestId })
      expectRpcSuccess(`owner ${action}`, ownerResult)

      const management = await graph.clients.signedIn.owner.rpc('get_recording_access_management', {
        p_recording_id: graph.ids.uuidRecordingId,
      })
      const payload = asRows(expectRpcSuccess(`owner review after ${action}`, management))
      expect(payload[0]).toMatchObject({
        requester_name: expect.any(String),
        requester_verified_email: graph.users.confirmedParticipant.email,
        meeting_title: expect.any(String),
        meeting_date: expect.any(String),
        evidence: expect.anything(),
      })
      expect(payload[0]).not.toHaveProperty('requester_message')
      expect(payload[0]).not.toHaveProperty('denial_reason')
    })
  }

  it('D-15/D-16 approval grants until owner revocation and preserves audit history', async () => {
    await resetAccessLifecycle(graph)
    const requested = await graph.clients.signedIn.confirmedParticipant.rpc('request_recording_access', {
      p_recording_id: graph.ids.uuidRecordingId,
    })
    const requestId = String(asRows(expectRpcSuccess('request for approval', requested))[0]?.request_id ?? requested.data)
    expectRpcSuccess('approve', await graph.clients.signedIn.owner.rpc('approve_recording_access_request', {
      p_request_id: requestId,
    }))
    const grants = await graph.admin
      .from('recording_access_grants')
      .select('id, revoked_at')
      .eq('recording_id', graph.ids.uuidRecordingId)
      .eq('grantee_user_id', graph.users.confirmedParticipant.id)
      .is('revoked_at', null)
      .single()
    expect(grants.error).toBeNull()
    expect(grants.data?.revoked_at).toBeNull()

    const nonOwner = await graph.clients.signedIn.admin.rpc('revoke_recording_access_grant', {
      p_grant_id: grants.data?.id,
    })
    expect(nonOwner.error).not.toBeNull()
    expectRpcSuccess('owner revoke', await graph.clients.signedIn.owner.rpc('revoke_recording_access_grant', {
      p_grant_id: grants.data?.id,
    }))

    const audit = await graph.admin
      .from('recording_access_audit_log')
      .select('action')
      .eq('recording_id', graph.ids.uuidRecordingId)
    expect(audit.error).toBeNull()
    expect(audit.data?.map((row: { action: string }) => row.action)).toEqual(
      expect.arrayContaining(['requested', 'approved', 'revoked']),
    )
  })

  it('D-17 denies retries before but permits them at the exact 30-day boundary', async () => {
    await resetAccessLifecycle(graph)
    const client = graph.clients.signedIn.confirmedParticipant
    const requested = await client.rpc('request_recording_access', {
      p_recording_id: graph.ids.uuidRecordingId,
    })
    const requestId = String(asRows(expectRpcSuccess('request for denial', requested))[0]?.request_id ?? requested.data)
    expectRpcSuccess('deny', await graph.clients.signedIn.owner.rpc('deny_recording_access_request', {
      p_request_id: requestId,
    }))

    const denied = await graph.admin
      .from('recording_access_requests')
      .select('denied_at, cooldown_until')
      .eq('id', requestId)
      .single()
    expect(denied.error).toBeNull()
    const deniedAt = new Date(String(denied.data?.denied_at))
    const cooldownUntil = new Date(String(denied.data?.cooldown_until))
    expect(cooldownUntil.getTime() - deniedAt.getTime()).toBe(30 * 24 * 60 * 60 * 1000)

    const beforeBoundary = new Date('2026-09-19T12:00:00.000Z')
    const boundary = new Date(beforeBoundary.getTime() + 30 * 24 * 60 * 60 * 1000)
    const controlled = await graph.admin
      .from('recording_access_requests')
      .update({ denied_at: beforeBoundary.toISOString(), cooldown_until: boundary.toISOString() })
      .eq('id', requestId)
    expect(controlled.error).toBeNull()

    const stillDenied = await client.rpc('request_recording_access', {
      p_recording_id: graph.ids.uuidRecordingId,
      p_test_now: new Date(boundary.getTime() - 1).toISOString(),
    })
    expect(stillDenied.error).not.toBeNull()
    const atBoundary = await client.rpc('request_recording_access', {
      p_recording_id: graph.ids.uuidRecordingId,
      p_test_now: boundary.toISOString(),
    })
    expectRpcSuccess('request at cooldown boundary', atBoundary)
  })

  for (const { table, operations } of [
    { table: 'recording_access_requests', operations: ['insert', 'update', 'delete'] },
    { table: 'recording_access_grants', operations: ['insert', 'update', 'delete'] },
    { table: 'recording_access_audit_log', operations: ['insert', 'update', 'delete'] },
    { table: 'recording_access_email_outbox', operations: ['insert', 'update', 'delete'] },
    // Existing notification owners must retain update/delete for read and
    // dismissal state. Phase 38 specifically removes only client INSERT.
    { table: 'user_notifications', operations: ['insert'] },
  ] as const) {
    for (const operation of operations) {
      it(`T-38-02-03 denies authenticated ${operation} on ${table}`, async () => {
        const existence = await graph.admin.from(table).select('*').limit(0)
        expect(existence.error, `${SUITE_TAG} expected Phase 38 object ${table}`).toBeNull()

        const client = graph.clients.signedIn.confirmedParticipant
        let error: { message: string } | null = null
        if (operation === 'insert') {
          const attemptedId = randomUUID()
          const payload = table === 'user_notifications'
            ? {
                id: attemptedId,
                user_id: graph.users.confirmedParticipant.id,
                type: 'recording_access_requested',
                title: 'forged client notification',
                body: 'must be rejected by RLS',
              }
            : { id: attemptedId }
          try {
            const result = await client.from(table).insert(payload)
            error = result.error
          } finally {
            await graph.admin.from(table).delete().eq('id', attemptedId)
          }
        } else if (operation === 'update') {
          const result = await client.from(table).update({ id: randomUUID() }).eq('id', randomUUID())
          error = result.error
        } else {
          const result = await client.from(table).delete().eq('id', randomUUID())
          error = result.error
        }
        expect(error, `${SUITE_TAG} table=${table} actor=confirmedParticipant expected client ${operation} denial`).not.toBeNull()
      })
    }
  }

  it('ACCESS-03 keeps event membership separate from recording content access', async () => {
    await resetAccessLifecycle(graph)
    expectRpcSuccess('set private content-separation policy', await graph.clients.signedIn.owner.rpc(
      'set_recording_access_level',
      { p_recording_id: graph.ids.uuidRecordingId, p_access_level: 'private' satisfies AccessLevel },
    ))
    const client = graph.clients.signedIn.confirmedParticipant
    const existence = await client.rpc('get_event_existence_for_participant', {
      p_event_id: graph.ids.eventId,
    })
    expect(asRows(expectRpcSuccess('participant existence proof', existence))).toHaveLength(1)
    const content = await client
      .from('recordings')
      .select('id, title, full_transcript, summary, audio_url, video_url')
      .eq('id', graph.ids.uuidRecordingId)
    expect(content.error).toBeNull()
    expect(content.data, `${SUITE_TAG} event participant must not receive recording content`).toEqual([])
  })

  const continuityActors: ReadonlyArray<{ role: Phase38FixtureRole; canRead: boolean }> = [
    { role: 'owner', canRead: true },
    { role: 'admin', canRead: true },
    { role: 'teamMember', canRead: true },
    // There is no active coach-specific recordings SELECT policy in the
    // pre-Phase-38 schema; preserving its false outcome proves no widening.
    { role: 'coach', canRead: false },
    { role: 'confirmedParticipant', canRead: false },
    { role: 'inviteeOnly', canRead: false },
    { role: 'grantRecipient', canRead: true },
    { role: 'unrelated', canRead: false },
  ]

  for (const actor of continuityActors) {
    it(`ACCESS-08 preserves Private access outcome for ${actor.role}`, async () => {
      expectRpcSuccess('set private continuity policy', await graph.clients.signedIn.owner.rpc(
        'set_recording_access_level',
        { p_recording_id: graph.ids.legacyRecordingId, p_access_level: 'private' satisfies AccessLevel },
      ))
      if (actor.role === 'teamMember') {
        const workspaceEntry = await graph.admin.from('workspace_entries').upsert({
          workspace_id: graph.ids.workspaceId,
          recording_id: graph.ids.legacyRecordingId,
        })
        expect(workspaceEntry.error, `${SUITE_TAG} seed explicit workspace access`).toBeNull()
      }
      try {
        const read = await graph.clients.signedIn[actor.role]
          .from('recordings')
          .select('id')
          .eq('id', graph.ids.legacyRecordingId)
        expect(read.error).toBeNull()
        expect((read.data?.length ?? 0) > 0).toBe(actor.canRead)
      } finally {
        if (actor.role === 'teamMember') {
          const removed = await graph.admin
            .from('workspace_entries')
            .delete()
            .eq('workspace_id', graph.ids.workspaceId)
            .eq('recording_id', graph.ids.legacyRecordingId)
          expect(removed.error, `${SUITE_TAG} remove explicit workspace access`).toBeNull()
        }
      }
    })
  }
})
