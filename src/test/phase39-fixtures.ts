import { createHash } from 'node:crypto'

import type { SupabaseClient } from '@supabase/supabase-js'

import {
  makeIntegrationAnonClient,
  makeIntegrationClient,
} from '@/test/integration-setup'

export const PHASE39_TEST_PROJECT_REF = 'swjzxiddcrtaqixsfaac'
const PRODUCTION_PROJECT_REF = 'vltmrnjsubfzrgrtdqey'

export type Phase39FixtureRole =
  | 'owner'
  | 'confirmedPrimary'
  | 'verifiedAlias'
  | 'disconnectedAlias'
  | 'unverifiedAlias'
  | 'conflictingAliasOwner'
  | 'nameOnly'
  | 'organizationOnly'
  | 'calendarOnly'
  | 'unrelated'

export type Phase39EventKey =
  | 'confirmedPrimaryNeedsAction'
  | 'aliasAvailable'
  | 'disconnectedAliasDenied'
  | 'unverifiedAliasDenied'
  | 'conflictingAliasDenied'
  | 'nameOnlyDenied'
  | 'organizationOnlyDenied'
  | 'calendarOnlyDenied'
  | 'mixedCopies'
  | 'requestPending'
  | 'requestApproved'
  | 'requestRejected'
  | 'requestCooldown'
  | 'webinarDenied'
  | 'participants49'
  | 'participants50'
  | 'participants51'
  | 'notificationBaseline'

export interface Phase39FixtureUser {
  id: string
  email: string
  password: string
}

export interface Phase39FixtureEvent {
  id: string
  recordingIds: readonly string[]
  canonicalStartTime: string
}

export interface Phase39FixtureRequest {
  id: string
  status: 'pending' | 'approved' | 'denied'
  recordingId: string
}

export interface Phase39FixtureGraph {
  prefix: string
  admin: SupabaseClient
  organizationId: string
  workspaceId: string
  users: Record<Phase39FixtureRole, Phase39FixtureUser>
  clients: Record<Phase39FixtureRole, SupabaseClient>
  events: Record<Phase39EventKey, Phase39FixtureEvent>
  identities: {
    verifiedAlias: string
    disconnectedAlias: string
    unverifiedAlias: string
    conflictingAlias: string
    boundary: readonly string[]
  }
  participants: {
    confirmedPrimary: { email: string; identityId: null }
    verifiedAlias: { email: string; identityId: null }
    calendarOnly: { email: string; hasConfirmedSpeech: false }
  }
  participantBoundaries: {
    participants49: 49
    participants50: 50
    participants51: 51
  }
  requests: {
    pending: Phase39FixtureRequest
    approved: Phase39FixtureRequest
    rejected: Phase39FixtureRequest
    cooldown: Phase39FixtureRequest
  }
  grantId: string
  notificationId: string
}

export interface Phase39FixtureResidue {
  authUsers: number
  organizations: number
  events: number
  recordings: number
  participants: number
  identities: number
  aliases: number
  requests: number
  grants: number
  notifications: number
}

const FIXTURE_ROLES: readonly Phase39FixtureRole[] = [
  'owner',
  'confirmedPrimary',
  'verifiedAlias',
  'disconnectedAlias',
  'unverifiedAlias',
  'conflictingAliasOwner',
  'nameOnly',
  'organizationOnly',
  'calendarOnly',
  'unrelated',
]

const EVENT_KEYS: readonly Phase39EventKey[] = [
  'confirmedPrimaryNeedsAction',
  'aliasAvailable',
  'disconnectedAliasDenied',
  'unverifiedAliasDenied',
  'conflictingAliasDenied',
  'nameOnlyDenied',
  'organizationOnlyDenied',
  'calendarOnlyDenied',
  'mixedCopies',
  'requestPending',
  'requestApproved',
  'requestRejected',
  'requestCooldown',
  'webinarDenied',
  'participants49',
  'participants50',
  'participants51',
  'notificationBaseline',
]

function fixtureUuid(prefix: string, label: string): string {
  const hex = createHash('sha256').update(`${prefix}:${label}`).digest('hex').slice(0, 32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`
}

function fixtureSlug(prefix: string): string {
  return prefix.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 28)
}

function requireNoError(label: string, error: { message: string } | null): void {
  if (error) throw new Error(`[phase-39 fixture] ${label}: ${error.message}`)
}

/** Phase 39 fixture I/O is allowed against one hosted project and nowhere else. */
export function assertPhase39TestProject(value: string): string {
  const trimmed = value.trim().replace(/\/$/, '')
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new Error('[phase-39 fixture] dedicated TEST project URL is invalid')
  }

  const hostname = parsed.hostname.toLowerCase()
  if (hostname.includes(PRODUCTION_PROJECT_REF)) {
    throw new Error(`[phase-39 fixture] production project ${PRODUCTION_PROJECT_REF} is forbidden`)
  }
  if (parsed.protocol !== 'https:' || hostname !== `${PHASE39_TEST_PROJECT_REF}.supabase.co`) {
    throw new Error(`[phase-39 fixture] expected dedicated TEST project ${PHASE39_TEST_PROJECT_REF}`)
  }
  return parsed.toString().replace(/\/$/, '')
}

function assertPhase39Environment(): void {
  assertPhase39TestProject(process.env.VITE_SUPABASE_TEST_URL ?? '')
}

async function createUser(
  admin: SupabaseClient,
  prefix: string,
  role: Phase39FixtureRole,
): Promise<Phase39FixtureUser> {
  const email = `${fixtureSlug(prefix)}-${role.toLowerCase()}@example.invalid`
  const password = `Cv39-${fixtureUuid(prefix, role).slice(0, 18)}!aA1`
  const result = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { fixture: prefix, role },
  })
  if (result.error || !result.data.user) {
    throw new Error(`[phase-39 fixture] create auth user ${role}: ${result.error?.message}`)
  }
  return { id: result.data.user.id, email, password }
}

async function signIn(user: Phase39FixtureUser): Promise<SupabaseClient> {
  const client = makeIntegrationAnonClient()
  const result = await client.auth.signInWithPassword({ email: user.email, password: user.password })
  if (result.error) throw new Error(`[phase-39 fixture] sign in ${user.email}: ${result.error.message}`)
  return client
}

function buildEvents(prefix: string): Record<Phase39EventKey, Phase39FixtureEvent> {
  return Object.fromEntries(EVENT_KEYS.map((key, index) => {
    const copies = key === 'mixedCopies' ? 2 : 1
    const canonicalStartTime = new Date(Date.UTC(2026, 8, 1 + index, 15, 0, 0)).toISOString()
    return [key, {
      id: fixtureUuid(prefix, `event-${key}`),
      recordingIds: Array.from({ length: copies }, (_, copyIndex) =>
        fixtureUuid(prefix, `recording-${key}-${copyIndex}`)),
      canonicalStartTime,
    }]
  })) as unknown as Record<Phase39EventKey, Phase39FixtureEvent>
}

export async function createPhase39FixtureGraph(prefix: string): Promise<Phase39FixtureGraph> {
  if (!prefix.startsWith('phase39-')) {
    throw new Error('[phase-39 fixture] prefix must start with "phase39-"')
  }
  assertPhase39Environment()
  const admin = makeIntegrationClient()
  const organizationId = fixtureUuid(prefix, 'organization')
  const workspaceId = fixtureUuid(prefix, 'workspace')
  const events = buildEvents(prefix)

  const userEntries: Array<[Phase39FixtureRole, Phase39FixtureUser]> = []
  for (const role of FIXTURE_ROLES) userEntries.push([role, await createUser(admin, prefix, role)])
  const users = Object.fromEntries(userEntries) as Record<Phase39FixtureRole, Phase39FixtureUser>

  requireNoError('create organization', (await admin.from('organizations').insert({
    id: organizationId,
    name: `${prefix} organization`,
    slug: `${fixtureSlug(prefix)}org`,
    type: 'business',
  })).error)
  requireNoError('create workspace', (await admin.from('workspaces').insert({
    id: workspaceId,
    organization_id: organizationId,
    name: `${prefix} workspace`,
    slug: `${fixtureSlug(prefix)}workspace`.slice(0, 40),
    workspace_type: 'team',
    is_default: false,
    is_home: false,
  })).error)
  requireNoError('create memberships', (await admin.from('organization_memberships').insert([
    { organization_id: organizationId, user_id: users.owner.id, role: 'organization_owner' },
    { organization_id: organizationId, user_id: users.organizationOnly.id, role: 'organization_member' },
  ])).error)
  requireNoError('create workspace membership', (await admin.from('workspace_memberships').insert({
    workspace_id: workspaceId,
    user_id: users.owner.id,
    role: 'workspace_admin',
  })).error)

  requireNoError('create events', (await admin.from('events').insert(EVENT_KEYS.map((key) => ({
    id: events[key].id,
    canonical_start_time: events[key].canonicalStartTime,
    canonical_end_time: new Date(new Date(events[key].canonicalStartTime).getTime() + 30 * 60_000).toISOString(),
    resolution_confidence: 1,
  })))).error)

  const recordingRows = EVENT_KEYS.flatMap((key) => events[key].recordingIds.map((id, copyIndex) => ({
    id,
    organization_id: organizationId,
    owner_user_id: users.owner.id,
    event_id: events[key].id,
    title: `${prefix} ${key} ${copyIndex}`,
    source_app: key === 'webinarDenied' ? 'zoom' : 'fathom',
    source_call_id: `${fixtureSlug(prefix)}-${key}-${copyIndex}`,
    source_metadata: key === 'webinarDenied'
      ? { fixture: prefix, zoom_type: 5 }
      : { fixture: prefix },
    recording_start_time: events[key].canonicalStartTime,
    access_level: 'private',
    access_policy_origin: 'custom',
  })))
  requireNoError('create recordings', (await admin.from('recordings').insert(recordingRows)).error)

  const identities = {
    verifiedAlias: fixtureUuid(prefix, 'identity-verified-alias'),
    disconnectedAlias: fixtureUuid(prefix, 'identity-disconnected-alias'),
    unverifiedAlias: fixtureUuid(prefix, 'identity-unverified-alias'),
    conflictingAlias: fixtureUuid(prefix, 'identity-conflicting-alias'),
    boundary: Array.from({ length: 150 }, (_, index) => fixtureUuid(prefix, `identity-boundary-${index}`)),
  }
  requireNoError('create identities', (await admin.from('identities').insert([
    { id: identities.verifiedAlias, owner_user_id: users.verifiedAlias.id, display_name: 'Verified Alias' },
    { id: identities.disconnectedAlias, owner_user_id: users.disconnectedAlias.id, display_name: 'Disconnected Alias' },
    { id: identities.unverifiedAlias, owner_user_id: users.unverifiedAlias.id, display_name: 'Unverified Alias' },
    { id: identities.conflictingAlias, owner_user_id: users.conflictingAliasOwner.id, display_name: 'Conflicting Alias Owner' },
    ...identities.boundary.map((id, index) => ({ id, owner_user_id: null, display_name: `Boundary ${index}` })),
  ])).error)

  const verifiedAliasEmail = `${fixtureSlug(prefix)}-verified-evidence@example.invalid`
  const disconnectedAliasEmail = `${fixtureSlug(prefix)}-disconnected-evidence@example.invalid`
  const unverifiedAliasEmail = `${fixtureSlug(prefix)}-unverified-evidence@example.invalid`
  const conflictingAliasEmail = `${fixtureSlug(prefix)}-conflicting-evidence@example.invalid`
  requireNoError('create aliases', (await admin.from('identity_aliases').insert([
    { identity_id: identities.verifiedAlias, alias_type: 'email', value: verifiedAliasEmail, verified: true, verified_at: '2026-08-01T00:00:00.000Z', evidence: 'phase39_fixture_verified_alias', confidence: 1 },
    { identity_id: identities.disconnectedAlias, alias_type: 'email', value: disconnectedAliasEmail, verified: false, verified_at: null, evidence: 'phase39_fixture_disconnected_alias', confidence: 1 },
    { identity_id: identities.unverifiedAlias, alias_type: 'email', value: unverifiedAliasEmail, verified: false, verified_at: null, evidence: 'phase39_fixture_unverified_alias', confidence: 0.5 },
    { identity_id: identities.conflictingAlias, alias_type: 'email', value: conflictingAliasEmail, verified: true, verified_at: '2026-08-01T00:00:00.000Z', evidence: 'phase39_fixture_conflicting_alias', confidence: 1 },
    ...identities.boundary.map((identityId, index) => ({
      identity_id: identityId,
      alias_type: 'email',
      value: `${fixtureSlug(prefix)}-boundary-${index}@example.invalid`,
      verified: true,
      verified_at: '2026-08-01T00:00:00.000Z',
      evidence: 'phase39_fixture_boundary',
      confidence: 1,
    })),
  ])).error)

  const participantRows: Array<Record<string, unknown>> = [
    confirmedParticipant(events.confirmedPrimaryNeedsAction, organizationId, users.confirmedPrimary.email, 'Confirmed Primary'),
    confirmedParticipant(events.aliasAvailable, organizationId, verifiedAliasEmail, 'Verified Alias'),
    confirmedParticipant(events.disconnectedAliasDenied, organizationId, disconnectedAliasEmail, 'Disconnected Alias'),
    confirmedParticipant(events.unverifiedAliasDenied, organizationId, unverifiedAliasEmail, 'Unverified Alias'),
    confirmedParticipant(events.conflictingAliasDenied, organizationId, conflictingAliasEmail, 'Conflicting Alias'),
    {
      recording_id: events.nameOnlyDenied.recordingIds[0], organization_id: organizationId,
      event_id: events.nameOnlyDenied.id, identity_id: null, name: users.nameOnly.email.split('@')[0],
      email: null, participant_type: 'speaker', role: 'speaker', has_confirmed_speech: true,
      sources: ['transcript_speaker'],
    },
    confirmedParticipant(events.organizationOnlyDenied, organizationId, `${fixtureSlug(prefix)}-somebody-else@example.invalid`, 'Somebody Else'),
    {
      recording_id: events.calendarOnlyDenied.recordingIds[0], organization_id: organizationId,
      event_id: events.calendarOnlyDenied.id, identity_id: null, name: 'Calendar Only',
      email: users.calendarOnly.email, participant_type: 'attendee', role: 'invitee',
      has_confirmed_speech: false, sources: ['calendar_invitees'],
    },
    confirmedParticipant(events.mixedCopies, organizationId, users.confirmedPrimary.email, 'Confirmed Primary'),
    confirmedParticipant(events.requestPending, organizationId, users.confirmedPrimary.email, 'Confirmed Primary'),
    confirmedParticipant(events.requestApproved, organizationId, users.confirmedPrimary.email, 'Confirmed Primary'),
    confirmedParticipant(events.requestRejected, organizationId, users.confirmedPrimary.email, 'Confirmed Primary'),
    confirmedParticipant(events.requestCooldown, organizationId, users.confirmedPrimary.email, 'Confirmed Primary'),
    confirmedParticipant(events.webinarDenied, organizationId, users.confirmedPrimary.email, 'Confirmed Primary'),
    confirmedParticipant(events.notificationBaseline, organizationId, users.confirmedPrimary.email, 'Confirmed Primary'),
  ]

  let boundaryOffset = 0
  for (const [key, count] of [
    ['participants49', 49],
    ['participants50', 50],
    ['participants51', 51],
  ] as const) {
    for (let index = 0; index < count; index += 1) {
      const identityId = identities.boundary[boundaryOffset]
      participantRows.push({
        ...confirmedParticipant(events[key], organizationId, `${fixtureSlug(prefix)}-boundary-${boundaryOffset}@example.invalid`, `Boundary ${boundaryOffset}`),
        identity_id: identityId,
      })
      boundaryOffset += 1
    }
  }
  requireNoError('create participants', (await admin.from('call_participants').insert(participantRows)).error)

  const requestIds = {
    pending: fixtureUuid(prefix, 'request-pending'),
    approved: fixtureUuid(prefix, 'request-approved'),
    rejected: fixtureUuid(prefix, 'request-rejected'),
    cooldown: fixtureUuid(prefix, 'request-cooldown'),
  }
  const deniedAt = new Date('2026-09-18T12:00:00.000Z')
  const cooldownUntil = new Date(deniedAt.getTime() + 30 * 24 * 60 * 60_000)
  requireNoError('create requests', (await admin.from('recording_access_requests').insert([
    requestRow(requestIds.pending, events.requestPending.recordingIds[0], users.confirmedPrimary, 'pending'),
    { ...requestRow(requestIds.approved, events.requestApproved.recordingIds[0], users.confirmedPrimary, 'approved'), resolved_by_user_id: users.owner.id, resolved_at: '2026-09-17T12:00:00.000Z', approved_at: '2026-09-17T12:00:00.000Z' },
    { ...requestRow(requestIds.rejected, events.requestRejected.recordingIds[0], users.confirmedPrimary, 'denied'), resolved_by_user_id: users.owner.id, resolved_at: '2026-08-01T12:00:00.000Z', denied_at: '2026-08-01T12:00:00.000Z' },
    { ...requestRow(requestIds.cooldown, events.requestCooldown.recordingIds[0], users.confirmedPrimary, 'denied'), resolved_by_user_id: users.owner.id, resolved_at: deniedAt.toISOString(), denied_at: deniedAt.toISOString(), cooldown_until: cooldownUntil.toISOString() },
  ])).error)

  const grantId = fixtureUuid(prefix, 'mixed-readable-grant')
  requireNoError('create readable-copy grant', (await admin.from('recording_access_grants').insert({
    id: grantId,
    recording_id: events.mixedCopies.recordingIds[0],
    grantee_user_id: users.confirmedPrimary.id,
    granted_by_user_id: users.owner.id,
  })).error)

  const notificationId = fixtureUuid(prefix, 'notification-baseline')
  requireNoError('create notification baseline', (await admin.from('user_notifications').insert({
    id: notificationId,
    user_id: users.confirmedPrimary.id,
    type: 'event_discovery_baseline',
    title: 'Phase 39 fixture baseline',
    body: null,
    metadata: { fixture: prefix, event_id: events.notificationBaseline.id, baseline: true },
    read_at: '2026-09-19T00:00:00.000Z',
  })).error)

  const clientEntries: Array<[Phase39FixtureRole, SupabaseClient]> = []
  for (const role of FIXTURE_ROLES) clientEntries.push([role, await signIn(users[role])])

  return {
    prefix,
    admin,
    organizationId,
    workspaceId,
    users,
    clients: Object.fromEntries(clientEntries) as Record<Phase39FixtureRole, SupabaseClient>,
    events,
    identities,
    participants: {
      confirmedPrimary: { email: users.confirmedPrimary.email, identityId: null },
      verifiedAlias: { email: verifiedAliasEmail, identityId: null },
      calendarOnly: { email: users.calendarOnly.email, hasConfirmedSpeech: false },
    },
    participantBoundaries: { participants49: 49, participants50: 50, participants51: 51 },
    requests: {
      pending: { id: requestIds.pending, status: 'pending', recordingId: events.requestPending.recordingIds[0] },
      approved: { id: requestIds.approved, status: 'approved', recordingId: events.requestApproved.recordingIds[0] },
      rejected: { id: requestIds.rejected, status: 'denied', recordingId: events.requestRejected.recordingIds[0] },
      cooldown: { id: requestIds.cooldown, status: 'denied', recordingId: events.requestCooldown.recordingIds[0] },
    },
    grantId,
    notificationId,
  }
}

function confirmedParticipant(
  event: Phase39FixtureEvent,
  organizationId: string,
  email: string,
  name: string,
): Record<string, unknown> {
  return {
    recording_id: event.recordingIds[0], organization_id: organizationId, event_id: event.id,
    identity_id: null, name, email, participant_type: 'speaker', role: 'speaker',
    has_confirmed_speech: true, sources: ['transcript_speaker'],
  }
}

function requestRow(
  id: string,
  recordingId: string,
  requester: Phase39FixtureUser,
  status: Phase39FixtureRequest['status'],
): Record<string, unknown> {
  return {
    id,
    recording_id: recordingId,
    requester_user_id: requester.id,
    requester_verified_email: requester.email,
    requester_name: 'Confirmed Primary',
    evidence: { source: 'phase39_fixture' },
    status,
  }
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

export async function cleanupPhase39FixtureGraph(graph: Phase39FixtureGraph): Promise<void> {
  assertPhase39Environment()
  const failures: string[] = []
  const recordingIds = EVENT_KEYS.flatMap((key) => [...graph.events[key].recordingIds])
  const eventIds = EVENT_KEYS.map((key) => graph.events[key].id)
  const identityIds = [
    graph.identities.verifiedAlias,
    graph.identities.disconnectedAlias,
    graph.identities.unverifiedAlias,
    graph.identities.conflictingAlias,
    ...graph.identities.boundary,
  ]
  const requestIds = Object.values(graph.requests).map((request) => request.id)

  await cleanupStep(failures, 'notifications', () => graph.admin.from('user_notifications').delete().eq('id', graph.notificationId))
  await cleanupStep(failures, 'grants', () => graph.admin.from('recording_access_grants').delete().eq('id', graph.grantId))
  await cleanupStep(failures, 'requests', () => graph.admin.from('recording_access_requests').delete().in('id', requestIds))
  await cleanupStep(failures, 'participants', () => graph.admin.from('call_participants').delete().in('recording_id', recordingIds))
  await cleanupStep(failures, 'aliases', () => graph.admin.from('identity_aliases').delete().in('identity_id', identityIds))
  await cleanupStep(failures, 'identities', () => graph.admin.from('identities').delete().in('id', identityIds))
  await cleanupStep(failures, 'workspace entries', () => graph.admin.from('workspace_entries').delete().in('recording_id', recordingIds))
  await cleanupStep(failures, 'recordings', () => graph.admin.from('recordings').delete().in('id', recordingIds))
  await cleanupStep(failures, 'events', () => graph.admin.from('events').delete().in('id', eventIds))
  await cleanupStep(failures, 'workspace memberships', () => graph.admin.from('workspace_memberships').delete().eq('workspace_id', graph.workspaceId))
  await cleanupStep(failures, 'organization memberships', () => graph.admin.from('organization_memberships').delete().eq('organization_id', graph.organizationId))
  await cleanupStep(failures, 'workspace', () => graph.admin.from('workspaces').delete().eq('id', graph.workspaceId))
  await cleanupStep(failures, 'organization', () => graph.admin.from('organizations').delete().eq('id', graph.organizationId))
  await cleanupStep(failures, 'auth users', () => graph.admin.rpc('cleanup_test_fixture_users', { p_max_age_minutes: 0 }))

  if (failures.length > 0) throw new Error(`[phase-39 fixture] cleanup failures:\n${failures.join('\n')}`)
}

async function countRows(
  label: string,
  query: PromiseLike<{ count: number | null; error: { message: string } | null }>,
): Promise<number> {
  const result = await query
  if (result.error) throw new Error(`[phase-39 residue] ${label}: ${result.error.message}`)
  return result.count ?? 0
}

export async function findPhase39FixtureResidue(
  admin: SupabaseClient,
  prefix: string,
): Promise<Phase39FixtureResidue> {
  assertPhase39Environment()
  const events = buildEvents(prefix)
  const eventIds = EVENT_KEYS.map((key) => events[key].id)
  const recordingIds = EVENT_KEYS.flatMap((key) => [...events[key].recordingIds])
  const identityIds = [
    fixtureUuid(prefix, 'identity-verified-alias'),
    fixtureUuid(prefix, 'identity-disconnected-alias'),
    fixtureUuid(prefix, 'identity-unverified-alias'),
    fixtureUuid(prefix, 'identity-conflicting-alias'),
    ...Array.from({ length: 150 }, (_, index) => fixtureUuid(prefix, `identity-boundary-${index}`)),
  ]
  const requestIds = ['pending', 'approved', 'rejected', 'cooldown']
    .map((status) => fixtureUuid(prefix, `request-${status}`))
  const listedUsers = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (listedUsers.error) throw new Error(`[phase-39 residue] auth users: ${listedUsers.error.message}`)
  const slug = fixtureSlug(prefix)
  const listedAuthUsers = listedUsers.data.users as Array<{ email?: string }>
  const authUsers = listedAuthUsers.filter((user) => user.email?.startsWith(slug)).length

  const counts = await Promise.all([
    countRows('organizations', admin.from('organizations').select('*', { count: 'exact', head: true }).eq('id', fixtureUuid(prefix, 'organization'))),
    countRows('events', admin.from('events').select('*', { count: 'exact', head: true }).in('id', eventIds)),
    countRows('recordings', admin.from('recordings').select('*', { count: 'exact', head: true }).in('id', recordingIds)),
    countRows('participants', admin.from('call_participants').select('*', { count: 'exact', head: true }).in('recording_id', recordingIds)),
    countRows('identities', admin.from('identities').select('*', { count: 'exact', head: true }).in('id', identityIds)),
    countRows('aliases', admin.from('identity_aliases').select('*', { count: 'exact', head: true }).in('identity_id', identityIds)),
    countRows('requests', admin.from('recording_access_requests').select('*', { count: 'exact', head: true }).in('id', requestIds)),
    countRows('grants', admin.from('recording_access_grants').select('*', { count: 'exact', head: true }).eq('id', fixtureUuid(prefix, 'mixed-readable-grant'))),
    countRows('notifications', admin.from('user_notifications').select('*', { count: 'exact', head: true }).eq('id', fixtureUuid(prefix, 'notification-baseline'))),
  ])
  const [organizations, eventCount, recordings, participants, identities, aliases, requests, grants, notifications] = counts
  return { authUsers, organizations, events: eventCount, recordings, participants, identities, aliases, requests, grants, notifications }
}
