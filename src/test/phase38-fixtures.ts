import { createHash } from 'node:crypto'

import type { SupabaseClient } from '@supabase/supabase-js'

import {
  makeIntegrationAnonClient,
  makeIntegrationClient,
} from '@/test/integration-setup'

export type Phase38FixtureRole =
  | 'owner'
  | 'admin'
  | 'teamMember'
  | 'coach'
  | 'confirmedParticipant'
  | 'inviteeOnly'
  | 'unrelated'
  | 'grantRecipient'

export interface Phase38FixtureUser {
  id: string
  email: string
  password: string
}

export interface Phase38LifecycleFixtureIds {
  requestId: string
  grantId: string
  auditIds: readonly string[]
}

export interface Phase38FixtureGraph {
  prefix: string
  admin: SupabaseClient
  ids: {
    organizationId: string
    workspaceId: string
    eventId: string
    uuidRecordingId: string
    legacyRecordingId: string
    confirmedIdentityId: string
    inviteeIdentityId: string
    legacyShareLinkId: string
    legacyAccessLogId: string
  }
  legacyProviderId: number
  users: Record<Phase38FixtureRole, Phase38FixtureUser>
  clients: {
    signedIn: Record<Phase38FixtureRole, SupabaseClient>
    anonymous: SupabaseClient
  }
  recordings: {
    uuidOnly: { id: string; fathomProviderId: null }
    legacy: { id: string; fathomProviderId: number }
  }
  participants: {
    confirmed: { identityId: string; email: string }
    inviteeOnly: { identityId: string; email: string }
  }
  lifecycle: Phase38LifecycleFixtureIds | null
}

export interface Phase38FixtureResidue {
  authUsers: number
  organizations: number
  events: number
  recordings: number
  participants: number
  identities: number
  aliases: number
  shareLinks: number
  accessLogs: number
}

const FIXTURE_ROLES: readonly Phase38FixtureRole[] = [
  'owner',
  'admin',
  'teamMember',
  'coach',
  'confirmedParticipant',
  'inviteeOnly',
  'unrelated',
  'grantRecipient',
]

function fixtureUuid(prefix: string, label: string): string {
  const hex = createHash('sha256').update(`${prefix}:${label}`).digest('hex').slice(0, 32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`
}

function fixtureSlug(prefix: string): string {
  return prefix.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 32)
}

function legacyProviderId(prefix: string): number {
  const digest = createHash('sha256').update(`${prefix}:legacy-provider`).digest()
  const offset = digest.subarray(0, 4).reduce(
    (value, byte) => ((value * 257) + byte) % 700_000_000,
    0,
  )
  return 1_200_000_000 + offset
}

function requireData<T>(
  label: string,
  result: { data: T | null; error: { message: string } | null },
): T {
  if (result.error || result.data === null) {
    throw new Error(`[phase-38 fixture] ${label}: ${result.error?.message ?? 'missing data'}`)
  }
  return result.data
}

function requireNoError(label: string, error: { message: string } | null): void {
  if (error) throw new Error(`[phase-38 fixture] ${label}: ${error.message}`)
}

async function createUser(
  admin: SupabaseClient,
  prefix: string,
  role: Phase38FixtureRole,
): Promise<Phase38FixtureUser> {
  const password = `Cv38-${fixtureUuid(prefix, role).slice(0, 18)}!aA1`
  const email = `${fixtureSlug(prefix)}-${role.toLowerCase()}@example.invalid`
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { fixture: prefix, role },
  })
  if (created.error || !created.data.user) {
    throw new Error(`[phase-38 fixture] create auth user ${role}: ${created.error?.message}`)
  }
  return { id: created.data.user.id, email, password }
}

async function signInUser(user: Phase38FixtureUser): Promise<SupabaseClient> {
  const client = makeIntegrationAnonClient()
  const signedIn = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  })
  if (signedIn.error) {
    throw new Error(`[phase-38 fixture] sign in ${user.email}: ${signedIn.error.message}`)
  }
  return client
}

export async function createPhase38FixtureGraph(prefix: string): Promise<Phase38FixtureGraph> {
  if (!prefix.startsWith('phase38-')) {
    throw new Error('[phase-38 fixture] prefix must start with "phase38-"')
  }

  const admin = makeIntegrationClient()
  const ids = {
    organizationId: fixtureUuid(prefix, 'organization'),
    workspaceId: fixtureUuid(prefix, 'workspace'),
    eventId: fixtureUuid(prefix, 'event'),
    uuidRecordingId: fixtureUuid(prefix, 'recording-uuid'),
    legacyRecordingId: fixtureUuid(prefix, 'recording-legacy'),
    confirmedIdentityId: fixtureUuid(prefix, 'identity-confirmed'),
    inviteeIdentityId: fixtureUuid(prefix, 'identity-invitee'),
    legacyShareLinkId: fixtureUuid(prefix, 'share-link'),
    legacyAccessLogId: fixtureUuid(prefix, 'share-access-log'),
  }
  const providerId = legacyProviderId(prefix)

  const userEntries: Array<[Phase38FixtureRole, Phase38FixtureUser]> = []
  for (const role of FIXTURE_ROLES) {
    userEntries.push([role, await createUser(admin, prefix, role)])
  }
  const users = Object.fromEntries(userEntries) as Record<Phase38FixtureRole, Phase38FixtureUser>

  const organization = await admin.from('organizations').insert({
    id: ids.organizationId,
    name: `${prefix} organization`,
    slug: `${fixtureSlug(prefix)}org`,
    type: 'business',
  })
  requireNoError('create organization', organization.error)

  const workspace = await admin.from('workspaces').insert({
    id: ids.workspaceId,
    organization_id: ids.organizationId,
    name: `${prefix} workspace`,
    slug: `${fixtureSlug(prefix)}workspace`.slice(0, 40),
    workspace_type: 'team',
    is_default: false,
    is_home: false,
  })
  requireNoError('create workspace', workspace.error)

  const orgMemberships = await admin.from('organization_memberships').insert([
    { organization_id: ids.organizationId, user_id: users.owner.id, role: 'organization_owner' },
    { organization_id: ids.organizationId, user_id: users.admin.id, role: 'organization_admin' },
    { organization_id: ids.organizationId, user_id: users.teamMember.id, role: 'organization_member' },
    { organization_id: ids.organizationId, user_id: users.coach.id, role: 'organization_member' },
    { organization_id: ids.organizationId, user_id: users.grantRecipient.id, role: 'organization_member' },
  ])
  requireNoError('create organization memberships', orgMemberships.error)

  const workspaceMemberships = await admin.from('workspace_memberships').insert([
    { workspace_id: ids.workspaceId, user_id: users.owner.id, role: 'workspace_admin' },
    { workspace_id: ids.workspaceId, user_id: users.admin.id, role: 'contributor' },
    { workspace_id: ids.workspaceId, user_id: users.teamMember.id, role: 'member' },
  ])
  requireNoError('create workspace memberships', workspaceMemberships.error)

  const event = await admin.from('events').insert({
    id: ids.eventId,
    canonical_start_time: '2026-09-19T15:00:00.000Z',
    canonical_end_time: '2026-09-19T15:30:00.000Z',
    resolution_confidence: 1,
  })
  requireNoError('create event', event.error)

  const recordings = await admin.from('recordings').insert([
    {
      id: ids.uuidRecordingId,
      organization_id: ids.organizationId,
      owner_user_id: users.owner.id,
      event_id: ids.eventId,
      title: `${prefix} UUID recording`,
      source_app: 'grain',
      source_call_id: `${prefix}-grain`,
      fathom_provider_id: null,
      source_metadata: { fixture: prefix, grain_meeting_type: { name: 'Executive webinar' } },
    },
    {
      id: ids.legacyRecordingId,
      organization_id: ids.organizationId,
      owner_user_id: users.owner.id,
      event_id: ids.eventId,
      title: `${prefix} legacy recording`,
      source_app: 'fathom',
      source_call_id: String(providerId),
      fathom_provider_id: providerId,
      source_metadata: { fixture: prefix },
    },
  ])
  requireNoError('create recordings', recordings.error)

  const identities = await admin.from('identities').insert([
    { id: ids.confirmedIdentityId, owner_user_id: users.confirmedParticipant.id },
    { id: ids.inviteeIdentityId, owner_user_id: users.inviteeOnly.id },
  ])
  requireNoError('create identities', identities.error)

  const aliases = await admin.from('identity_aliases').insert([
    {
      identity_id: ids.confirmedIdentityId,
      alias_type: 'email',
      value: users.confirmedParticipant.email,
      verified: true,
      verified_at: '2026-09-19T14:00:00.000Z',
      evidence: 'phase38_fixture_verified_email',
      confidence: 1,
    },
    {
      identity_id: ids.inviteeIdentityId,
      alias_type: 'email',
      value: users.inviteeOnly.email,
      verified: true,
      verified_at: '2026-09-19T14:00:00.000Z',
      evidence: 'phase38_fixture_verified_email',
      confidence: 1,
    },
  ])
  requireNoError('create verified aliases', aliases.error)

  const participants = await admin.from('call_participants').insert([
    {
      recording_id: ids.uuidRecordingId,
      organization_id: ids.organizationId,
      event_id: ids.eventId,
      identity_id: ids.confirmedIdentityId,
      name: 'Confirmed Participant',
      email: users.confirmedParticipant.email,
      participant_type: 'speaker',
      role: 'speaker',
      has_confirmed_speech: true,
      sources: ['transcript_speaker'],
    },
    {
      recording_id: ids.legacyRecordingId,
      organization_id: ids.organizationId,
      event_id: ids.eventId,
      identity_id: ids.inviteeIdentityId,
      name: 'Invitee Only',
      email: users.inviteeOnly.email,
      participant_type: 'attendee',
      role: 'invitee',
      has_confirmed_speech: false,
      sources: ['calendar_invitees'],
    },
  ])
  requireNoError('create participants', participants.error)

  const fathomCall = await admin.from('fathom_calls').insert({
    recording_id: providerId,
    user_id: users.owner.id,
    canonical_recording_id: ids.legacyRecordingId,
    title: `${prefix} legacy recording`,
    source_platform: 'fathom',
    metadata: { fixture: prefix },
    created_at: new Date().toISOString(),
  })
  requireNoError('create legacy fathom call', fathomCall.error)

  const share = await admin.from('call_share_links').insert({
    id: ids.legacyShareLinkId,
    call_recording_id: providerId,
    user_id: users.owner.id,
    created_by_user_id: users.owner.id,
    share_token: `${fixtureSlug(prefix).slice(0, 32)}-legacy`.slice(0, 48),
    recipient_email: users.grantRecipient.email,
    status: 'active',
  })
  requireNoError('create legacy share link', share.error)

  const accessLog = await admin.from('call_share_access_log').insert({
    id: ids.legacyAccessLogId,
    share_link_id: ids.legacyShareLinkId,
    accessed_by_user_id: users.grantRecipient.id,
    ip_address: '192.0.2.38',
  })
  requireNoError('create legacy share access log', accessLog.error)

  const signedInEntries: Array<[Phase38FixtureRole, SupabaseClient]> = []
  for (const role of FIXTURE_ROLES) {
    signedInEntries.push([role, await signInUser(users[role])])
  }

  return {
    prefix,
    admin,
    ids,
    legacyProviderId: providerId,
    users,
    clients: {
      signedIn: Object.fromEntries(signedInEntries) as Record<Phase38FixtureRole, SupabaseClient>,
      anonymous: makeIntegrationAnonClient(),
    },
    recordings: {
      uuidOnly: { id: ids.uuidRecordingId, fathomProviderId: null },
      legacy: { id: ids.legacyRecordingId, fathomProviderId: providerId },
    },
    participants: {
      confirmed: { identityId: ids.confirmedIdentityId, email: users.confirmedParticipant.email },
      inviteeOnly: { identityId: ids.inviteeIdentityId, email: users.inviteeOnly.email },
    },
    lifecycle: null,
  }
}

/** Seed the additive request/grant/audit tables after the Phase 38 schema lands. */
export async function createPhase38LifecycleFixtures(
  graph: Phase38FixtureGraph,
): Promise<Phase38LifecycleFixtureIds> {
  const requestId = fixtureUuid(graph.prefix, 'access-request')
  const grantId = fixtureUuid(graph.prefix, 'access-grant')
  const auditIds = [
    fixtureUuid(graph.prefix, 'audit-request'),
    fixtureUuid(graph.prefix, 'audit-grant'),
  ] as const

  const request = await graph.admin.from('recording_access_requests').insert({
    id: requestId,
    recording_id: graph.ids.uuidRecordingId,
    requester_user_id: graph.users.confirmedParticipant.id,
    requester_verified_email: graph.users.confirmedParticipant.email,
    evidence: { source: 'transcript_speaker', fixture: graph.prefix },
    status: 'approved',
    resolved_by_user_id: graph.users.owner.id,
  })
  requireNoError('create access request', request.error)

  const grant = await graph.admin.from('recording_access_grants').insert({
    id: grantId,
    recording_id: graph.ids.uuidRecordingId,
    grantee_user_id: graph.users.grantRecipient.id,
    source_request_id: requestId,
    granted_by_user_id: graph.users.owner.id,
  })
  requireNoError('create access grant', grant.error)

  const audit = await graph.admin.from('recording_access_audit_log').insert([
    {
      id: auditIds[0],
      recording_id: graph.ids.uuidRecordingId,
      request_id: requestId,
      actor_user_id: graph.users.confirmedParticipant.id,
      action: 'requested',
      metadata: { fixture: graph.prefix },
    },
    {
      id: auditIds[1],
      recording_id: graph.ids.uuidRecordingId,
      request_id: requestId,
      actor_user_id: graph.users.owner.id,
      action: 'approved',
      metadata: { fixture: graph.prefix },
    },
  ])
  requireNoError('create access audit rows', audit.error)

  const lifecycle = { requestId, grantId, auditIds }
  graph.lifecycle = lifecycle
  return lifecycle
}

async function cleanupStep(
  failures: string[],
  label: string,
  operation: () => PromiseLike<{ error: { message: string } | null }>,
): Promise<void> {
  try {
    const result = await operation()
    if (result.error) failures.push(`${label}: ${result.error.message}`)
  } catch (error) {
    failures.push(`${label}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export async function cleanupPhase38FixtureGraph(graph: Phase38FixtureGraph): Promise<void> {
  const failures: string[] = []
  const { admin, ids } = graph

  if (graph.lifecycle) {
    await cleanupStep(failures, 'recording_access_audit_log', () =>
      admin.from('recording_access_audit_log').delete().in('id', [...graph.lifecycle!.auditIds]))
    await cleanupStep(failures, 'recording_access_grants', () =>
      admin.from('recording_access_grants').delete().eq('id', graph.lifecycle!.grantId))
    await cleanupStep(failures, 'recording_access_requests', () =>
      admin.from('recording_access_requests').delete().eq('id', graph.lifecycle!.requestId))
  }

  await cleanupStep(failures, 'call_share_access_log', () =>
    admin.from('call_share_access_log').delete().eq('id', ids.legacyAccessLogId))
  await cleanupStep(failures, 'call_share_links', () =>
    admin.from('call_share_links').delete().eq('id', ids.legacyShareLinkId))
  await cleanupStep(failures, 'call_participants', () =>
    admin.from('call_participants').delete().in('recording_id', [ids.uuidRecordingId, ids.legacyRecordingId]))
  await cleanupStep(failures, 'identity_aliases', () =>
    admin.from('identity_aliases').delete().in('identity_id', [ids.confirmedIdentityId, ids.inviteeIdentityId]))
  await cleanupStep(failures, 'identities', () =>
    admin.from('identities').delete().in('id', [ids.confirmedIdentityId, ids.inviteeIdentityId]))
  await cleanupStep(failures, 'workspace_entries', () =>
    admin.from('workspace_entries').delete().in('recording_id', [ids.uuidRecordingId, ids.legacyRecordingId]))
  await cleanupStep(failures, 'recordings', () =>
    admin.from('recordings').delete().in('id', [ids.uuidRecordingId, ids.legacyRecordingId]))
  await cleanupStep(failures, 'fathom_calls', () =>
    admin.from('fathom_calls').delete().eq('recording_id', graph.legacyProviderId))
  await cleanupStep(failures, 'events', () => admin.from('events').delete().eq('id', ids.eventId))
  await cleanupStep(failures, 'workspace_memberships', () =>
    admin.from('workspace_memberships').delete().eq('workspace_id', ids.workspaceId))
  await cleanupStep(failures, 'organization_memberships', () =>
    admin.from('organization_memberships').delete().eq('organization_id', ids.organizationId))
  await cleanupStep(failures, 'workspaces', () => admin.from('workspaces').delete().eq('id', ids.workspaceId))
  await cleanupStep(failures, 'organizations', () => admin.from('organizations').delete().eq('id', ids.organizationId))
  await cleanupStep(failures, 'auth users', () =>
    admin.rpc('cleanup_test_fixture_users', { p_max_age_minutes: 0 }))

  if (failures.length > 0) {
    throw new Error(`[phase-38 fixture] cleanup failures:\n${failures.join('\n')}`)
  }
}

async function countRows(
  label: string,
  query: PromiseLike<{ count: number | null; error: { message: string } | null }>,
): Promise<number> {
  const result = await query
  if (result.error) throw new Error(`[phase-38 residue] ${label}: ${result.error.message}`)
  return result.count ?? 0
}

export async function findPhase38FixtureResidue(
  admin: SupabaseClient,
  prefix: string,
): Promise<Phase38FixtureResidue> {
  const ids = {
    organizationId: fixtureUuid(prefix, 'organization'),
    eventId: fixtureUuid(prefix, 'event'),
    uuidRecordingId: fixtureUuid(prefix, 'recording-uuid'),
    legacyRecordingId: fixtureUuid(prefix, 'recording-legacy'),
    confirmedIdentityId: fixtureUuid(prefix, 'identity-confirmed'),
    inviteeIdentityId: fixtureUuid(prefix, 'identity-invitee'),
    legacyShareLinkId: fixtureUuid(prefix, 'share-link'),
    legacyAccessLogId: fixtureUuid(prefix, 'share-access-log'),
  }
  const listedUsers = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (listedUsers.error) {
    throw new Error(`[phase-38 residue] auth users: ${listedUsers.error.message}`)
  }
  const emailPrefix = fixtureSlug(prefix)
  const authUsers = listedUsers.data.users.filter(
    (user: { email?: string }) => user.email?.startsWith(emailPrefix),
  ).length

  const [organizations, events, recordings, participants, identities, aliases, shareLinks, accessLogs] =
    await Promise.all([
      countRows('organizations', admin.from('organizations').select('*', { count: 'exact', head: true }).eq('id', ids.organizationId)),
      countRows('events', admin.from('events').select('*', { count: 'exact', head: true }).eq('id', ids.eventId)),
      countRows('recordings', admin.from('recordings').select('*', { count: 'exact', head: true }).in('id', [ids.uuidRecordingId, ids.legacyRecordingId])),
      countRows('participants', admin.from('call_participants').select('*', { count: 'exact', head: true }).in('recording_id', [ids.uuidRecordingId, ids.legacyRecordingId])),
      countRows('identities', admin.from('identities').select('*', { count: 'exact', head: true }).in('id', [ids.confirmedIdentityId, ids.inviteeIdentityId])),
      countRows('aliases', admin.from('identity_aliases').select('*', { count: 'exact', head: true }).in('identity_id', [ids.confirmedIdentityId, ids.inviteeIdentityId])),
      countRows('share links', admin.from('call_share_links').select('*', { count: 'exact', head: true }).eq('id', ids.legacyShareLinkId)),
      countRows('access logs', admin.from('call_share_access_log').select('*', { count: 'exact', head: true }).eq('id', ids.legacyAccessLogId)),
    ])

  return { authUsers, organizations, events, recordings, participants, identities, aliases, shareLinks, accessLogs }
}
