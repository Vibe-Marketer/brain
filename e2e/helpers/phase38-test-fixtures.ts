import { randomUUID } from 'node:crypto'
import { chmod, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import { config as loadDotenv } from 'dotenv'

import {
  createPhase38FixtureGraph,
  type Phase38FixtureGraph,
  type Phase38FixtureRole,
} from '../../src/test/phase38-fixtures'

const TEST_PROJECT_REF = 'swjzxiddcrtaqixsfaac'
const PRODUCTION_PROJECT_REF = 'vltmrnjsubfzrgrtdqey'
const THIS_DIR = dirname(fileURLToPath(import.meta.url))

export const PHASE38_BROWSER_FIXTURE_FILE = resolve('/tmp/callvault-phase38-browser-fixtures.json')
export const PHASE38_EVIDENCE_DIR = resolve(process.cwd(), 'test-results/phase38-evidence')

export interface BrowserStorageState {
  cookies: []
  origins: Array<{
    origin: string
    localStorage: Array<{ name: string; value: string }>
  }>
}

export interface Phase38BrowserFixtures {
  prefix: string
  ownerUserId: string
  organizationId: string
  workspaceId: string
  participantWorkspaceId: string
  eventId: string
  ownerRecordingId: string
  publicRecordingId: string
  requestId: string
  legacyShareLinkId: string
  legacyShareToken: string
  auth: Record<'owner' | 'confirmedParticipant' | 'unrelated', BrowserStorageState>
  credentials: {
    ownerEmail: string
    ownerPassword: string
  }
  cleanup: {
    authUserIds: string[]
    identityIds: string[]
    supplementalIdentityIds: string[]
    recordingIds: string[]
  }
}

function loadTestEnvironment(): void {
  loadDotenv({ path: resolve(process.cwd(), '.env.test'), override: true })
  const target = process.env.VITE_SUPABASE_TEST_URL ?? ''
  if (!target.includes(TEST_PROJECT_REF) || target.includes(PRODUCTION_PROJECT_REF)) {
    throw new Error(`Phase 38 browser fixtures require dedicated TEST ref ${TEST_PROJECT_REF}.`)
  }
  if (!process.env.VITE_SUPABASE_TEST_ANON_KEY || !process.env.SUPABASE_TEST_SERVICE_ROLE_KEY) {
    throw new Error('Phase 38 browser fixtures require the TEST anon and service-role keys.')
  }
}

function requireNoError(label: string, error: { message: string } | null): void {
  if (error) throw new Error(`[phase-38 browser fixture] ${label}: ${error.message}`)
}

async function sessionFor(graph: Phase38FixtureGraph, role: Phase38FixtureRole): Promise<Session> {
  const result = await graph.clients.signedIn[role].auth.getSession()
  if (result.error || !result.data.session) {
    throw new Error(`[phase-38 browser fixture] missing ${role} session: ${result.error?.message ?? 'no session'}`)
  }
  return result.data.session
}

function storageState(
  session: Session,
  graph: Phase38FixtureGraph,
  workspaceId = graph.ids.workspaceId,
): BrowserStorageState {
  const origin = process.env.BASE_URL ?? 'http://localhost:3001'
  return {
    cookies: [],
    origins: [{
      origin,
      localStorage: [
        { name: `sb-${TEST_PROJECT_REF}-auth-token`, value: JSON.stringify(session) },
        {
          name: 'callvault-org-context',
          value: JSON.stringify({
            activeOrgId: graph.ids.organizationId,
            activeWorkspaceId: workspaceId,
            activeWorkspaceMode: 'workspace',
          }),
        },
      ],
    }],
  }
}

function makeAdmin(): SupabaseClient {
  loadTestEnvironment()
  return createClient(
    process.env.VITE_SUPABASE_TEST_URL!,
    process.env.SUPABASE_TEST_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function seedPhase38BrowserFixtures(): Promise<Phase38BrowserFixtures> {
  loadTestEnvironment()
  await cleanupPhase38BrowserFixtures().catch(() => undefined)

  const prefix = `phase38-b-${Date.now().toString(36)}`
  const graph = await createPhase38FixtureGraph(prefix)
  const participantWorkspaceId = randomUUID()
  const recordingIds = [graph.ids.uuidRecordingId, graph.ids.legacyRecordingId]

  const onboarding = await graph.admin.from('user_profiles').update({
    onboarding_completed: true,
  }).in('user_id', Object.values(graph.users).map((user) => user.id))
  requireNoError('complete fixture onboarding', onboarding.error)

  const participantOrgMembership = await graph.admin.from('organization_memberships').insert({
    organization_id: graph.ids.organizationId,
    user_id: graph.users.confirmedParticipant.id,
    role: 'organization_member',
  })
  requireNoError('create participant organization membership', participantOrgMembership.error)
  const participantWorkspace = await graph.admin.from('workspaces').insert({
    id: participantWorkspaceId,
    organization_id: graph.ids.organizationId,
    name: `${prefix} participant workspace`,
    slug: `${prefix.replace(/[^a-z0-9]+/gi, '').toLowerCase()}participant`.slice(0, 40),
    workspace_type: 'team',
    is_default: false,
    is_home: false,
  })
  requireNoError('create participant workspace', participantWorkspace.error)
  const participantWorkspaceMembership = await graph.admin.from('workspace_memberships').insert({
    workspace_id: participantWorkspaceId,
    user_id: graph.users.confirmedParticipant.id,
    role: 'member',
  })
  requireNoError('create participant workspace membership', participantWorkspaceMembership.error)

  const recordingUpdate = await graph.admin.from('recordings').upsert([
    {
      id: graph.ids.uuidRecordingId,
      organization_id: graph.ids.organizationId,
      owner_user_id: graph.users.owner.id,
      event_id: graph.ids.eventId,
      title: 'Phase 38 private access target',
      source_app: 'grain',
      source_call_id: `${prefix}-private`,
      source_metadata: { fixture: prefix },
      recording_start_time: '2026-09-19T15:00:00.000Z',
      recording_end_time: '2026-09-19T15:30:00.000Z',
      duration: 1800,
      summary: 'Protected fixture summary',
      full_transcript: 'Owner: protected fixture transcript',
      access_level: 'private',
      access_policy_origin: 'custom',
    },
    {
      id: graph.ids.legacyRecordingId,
      organization_id: graph.ids.organizationId,
      owner_user_id: graph.users.owner.id,
      event_id: graph.ids.eventId,
      title: 'Phase 38 public source copy',
      source_app: 'fathom',
      source_call_id: String(graph.legacyProviderId),
      fathom_provider_id: graph.legacyProviderId,
      source_metadata: { fixture: prefix },
      recording_start_time: '2026-09-19T15:00:00.000Z',
      recording_end_time: '2026-09-19T15:30:00.000Z',
      duration: 1800,
      summary: 'Public fixture summary',
      full_transcript: 'Speaker: public fixture transcript',
      access_level: 'public',
      access_policy_origin: 'custom',
    },
  ])
  requireNoError('configure recordings', recordingUpdate.error)

  const workspaceEntries = await graph.admin.from('workspace_entries').insert(
    recordingIds.map((recordingId) => ({
      workspace_id: graph.ids.workspaceId,
      recording_id: recordingId,
    })),
  )
  requireNoError('create workspace entries', workspaceEntries.error)
  const participantEntry = await graph.admin.from('workspace_entries').insert({
    workspace_id: participantWorkspaceId,
    recording_id: graph.ids.legacyRecordingId,
  })
  requireNoError('create participant recording entry', participantEntry.error)

  const request = await graph.clients.signedIn.confirmedParticipant.rpc(
    'request_recording_access',
    { p_recording_id: graph.ids.uuidRecordingId },
  )
  requireNoError('create pending access request', request.error)
  const requestRow = Array.isArray(request.data) ? request.data[0] as Record<string, unknown> : null
  if (!requestRow || typeof requestRow.request_id !== 'string') {
    throw new Error('[phase-38 browser fixture] request RPC returned no request UUID')
  }

  const fixtures: Phase38BrowserFixtures = {
    prefix,
    ownerUserId: graph.users.owner.id,
    organizationId: graph.ids.organizationId,
    workspaceId: graph.ids.workspaceId,
    participantWorkspaceId,
    eventId: graph.ids.eventId,
    ownerRecordingId: graph.ids.uuidRecordingId,
    publicRecordingId: graph.ids.legacyRecordingId,
    requestId: requestRow.request_id,
    legacyShareLinkId: graph.ids.legacyShareLinkId,
    legacyShareToken: `${prefix.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 32)}-legacy`.slice(0, 48),
    auth: {
      owner: storageState(await sessionFor(graph, 'owner'), graph),
      confirmedParticipant: storageState(
        await sessionFor(graph, 'confirmedParticipant'),
        graph,
        participantWorkspaceId,
      ),
      unrelated: storageState(await sessionFor(graph, 'unrelated'), graph),
    },
    credentials: {
      ownerEmail: graph.users.owner.email,
      ownerPassword: graph.users.owner.password,
    },
    cleanup: {
      authUserIds: Object.values(graph.users).map((user) => user.id),
      identityIds: [graph.ids.confirmedIdentityId, graph.ids.inviteeIdentityId],
      supplementalIdentityIds: [],
      recordingIds,
    },
  }

  await writeFile(PHASE38_BROWSER_FIXTURE_FILE, JSON.stringify(fixtures), { mode: 0o600 })
  await chmod(PHASE38_BROWSER_FIXTURE_FILE, 0o600)
  return fixtures
}

async function removeRows(
  label: string,
  operation: PromiseLike<{ error: { message: string } | null }>,
): Promise<void> {
  const result = await operation
  requireNoError(`cleanup ${label}`, result.error)
}

export async function cleanupPhase38BrowserFixtures(): Promise<void> {
  let fixture: Phase38BrowserFixtures
  try {
    fixture = JSON.parse(await readFile(PHASE38_BROWSER_FIXTURE_FILE, 'utf8')) as Phase38BrowserFixtures
  } catch {
    return
  }

  const admin = makeAdmin()
  const recordingIds = fixture.cleanup.recordingIds
  await removeRows('email outbox', admin.from('recording_access_email_outbox').delete().in('recording_id', recordingIds))
  await removeRows('audit log', admin.from('recording_access_audit_log').delete().in('recording_id', recordingIds))
  await removeRows('grants', admin.from('recording_access_grants').delete().in('recording_id', recordingIds))
  await removeRows('requests', admin.from('recording_access_requests').delete().in('recording_id', recordingIds))
  await removeRows('share access log', admin.from('call_share_access_log').delete().eq('share_link_id', fixture.legacyShareLinkId))
  await removeRows('share links', admin.from('call_share_links').delete().eq('id', fixture.legacyShareLinkId))
  await removeRows('workspace entries', admin.from('workspace_entries').delete().in('recording_id', recordingIds))
  await removeRows('participants', admin.from('call_participants').delete().in('recording_id', recordingIds))
  if (fixture.cleanup.supplementalIdentityIds.length > 0) {
    await removeRows('supplemental aliases', admin.from('identity_aliases').delete().in('identity_id', fixture.cleanup.supplementalIdentityIds))
    await removeRows('supplemental identities', admin.from('identities').delete().in('id', fixture.cleanup.supplementalIdentityIds))
  }
  await removeRows('aliases', admin.from('identity_aliases').delete().in('identity_id', fixture.cleanup.identityIds))
  await removeRows('identities', admin.from('identities').delete().in('id', fixture.cleanup.identityIds))
  await removeRows('recordings', admin.from('recordings').delete().in('id', recordingIds))
  await removeRows('fathom call', admin.from('fathom_calls').delete().eq('canonical_recording_id', fixture.publicRecordingId))
  await removeRows('event', admin.from('events').delete().eq('id', fixture.eventId))
  await removeRows('workspace memberships', admin.from('workspace_memberships').delete().in('workspace_id', [fixture.workspaceId, fixture.participantWorkspaceId]))
  await removeRows('organization memberships', admin.from('organization_memberships').delete().eq('organization_id', fixture.organizationId))
  await removeRows('workspaces', admin.from('workspaces').delete().in('id', [fixture.workspaceId, fixture.participantWorkspaceId]))
  await removeRows('organization', admin.from('organizations').delete().eq('id', fixture.organizationId))
  await removeRows('auth users', admin.rpc('cleanup_test_fixture_users', { p_max_age_minutes: 0 }))
  await rm(PHASE38_BROWSER_FIXTURE_FILE, { force: true })
}

export async function readPhase38BrowserFixtures(): Promise<Phase38BrowserFixtures> {
  const raw = await readFile(PHASE38_BROWSER_FIXTURE_FILE, 'utf8')
  const fixture = JSON.parse(raw) as Phase38BrowserFixtures
  if (!fixture.ownerRecordingId || !fixture.requestId || !fixture.auth.owner) {
    throw new Error('Phase 38 browser fixture file is incomplete.')
  }
  return fixture
}

export async function resetPhase38PendingRequest(): Promise<void> {
  const fixture = await readPhase38BrowserFixtures()
  const admin = makeAdmin()
  await removeRows('reset grants', admin.from('recording_access_grants').delete().eq('source_request_id', fixture.requestId))
  const reset = await admin.from('recording_access_requests').update({
    status: 'pending',
    resolved_at: null,
    resolved_by_user_id: null,
    denied_at: null,
    cooldown_until: null,
  }).eq('id', fixture.requestId)
  requireNoError('reset pending request', reset.error)
}

export async function setPhase38AccountDefault(accessLevel: string): Promise<void> {
  const fixture = await readPhase38BrowserFixtures()
  const admin = makeAdmin()
  const result = await admin.from('user_settings').upsert({
    user_id: fixture.ownerUserId,
    default_recording_access_level: accessLevel,
  }, { onConflict: 'user_id' })
  requireNoError('set account default precondition', result.error)
}

export async function setPhase38RecordingPolicy(accessLevel: string): Promise<void> {
  const fixture = await readPhase38BrowserFixtures()
  const admin = makeAdmin()
  const result = await admin.from('recordings').update({
    access_level: accessLevel,
    access_policy_origin: 'custom',
  }).eq('id', fixture.ownerRecordingId)
  requireNoError('set recording policy precondition', result.error)
}

export async function clearPhase38AccessLifecycle(): Promise<void> {
  const fixture = await readPhase38BrowserFixtures()
  const admin = makeAdmin()
  await removeRows('clear email outbox', admin.from('recording_access_email_outbox').delete().eq('recording_id', fixture.ownerRecordingId))
  await removeRows('clear audit log', admin.from('recording_access_audit_log').delete().eq('recording_id', fixture.ownerRecordingId))
  await removeRows('clear grants', admin.from('recording_access_grants').delete().eq('recording_id', fixture.ownerRecordingId))
  await removeRows('clear requests', admin.from('recording_access_requests').delete().eq('recording_id', fixture.ownerRecordingId))
}

export async function refreshPhase38RequestId(): Promise<string> {
  const fixture = await readPhase38BrowserFixtures()
  const admin = makeAdmin()
  const result = await admin.from('recording_access_requests')
    .select('id')
    .eq('recording_id', fixture.ownerRecordingId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  requireNoError('load browser request', result.error)
  if (!result.data?.id) throw new Error('[phase-38 browser fixture] pending request was not created')
  fixture.requestId = result.data.id
  await writeFile(PHASE38_BROWSER_FIXTURE_FILE, JSON.stringify(fixture), { mode: 0o600 })
  return result.data.id
}

export async function configurePhase38DiscoveryScenario(
  signal: 'unknown' | 'non_webinar' | 'webinar',
  confirmedIdentityCount: 49 | 50,
): Promise<void> {
  const fixture = await readPhase38BrowserFixtures()
  const admin = makeAdmin()

  if (fixture.cleanup.supplementalIdentityIds.length > 0) {
    await removeRows(
      'previous supplemental participants',
      admin.from('call_participants').delete().in('identity_id', fixture.cleanup.supplementalIdentityIds),
    )
    await removeRows(
      'previous supplemental aliases',
      admin.from('identity_aliases').delete().in('identity_id', fixture.cleanup.supplementalIdentityIds),
    )
    await removeRows(
      'previous supplemental identities',
      admin.from('identities').delete().in('id', fixture.cleanup.supplementalIdentityIds),
    )
  }

  const source = signal === 'unknown'
    ? { source_app: 'grain', source_metadata: { fixture: fixture.prefix } }
    : {
        source_app: 'zoom',
        source_metadata: {
          fixture: fixture.prefix,
          zoom_meeting_type: signal === 'webinar' ? 5 : 1,
        },
      }
  const configured = await admin.from('recordings').update(source).in('id', fixture.cleanup.recordingIds)
  requireNoError('configure discovery provider signal', configured.error)

  const supplemental = Array.from({ length: confirmedIdentityCount - 1 }, (_, index) => ({
    id: randomUUID(),
    email: `${fixture.prefix}-boundary-${index}@example.invalid`,
  }))
  const identities = await admin.from('identities').insert(
    supplemental.map(({ id }) => ({ id })),
  )
  requireNoError('create supplemental identities', identities.error)
  const aliases = await admin.from('identity_aliases').insert(
    supplemental.map(({ id, email }) => ({
      identity_id: id,
      alias_type: 'email',
      value: email,
      verified: true,
      verified_at: '2026-09-19T14:00:00.000Z',
      evidence: 'phase38_browser_boundary',
      confidence: 1,
    })),
  )
  requireNoError('create supplemental aliases', aliases.error)
  const participants = await admin.from('call_participants').insert(
    supplemental.map(({ id, email }, index) => ({
      recording_id: fixture.publicRecordingId,
      organization_id: fixture.organizationId,
      event_id: fixture.eventId,
      identity_id: id,
      name: `Boundary participant ${index}`,
      email,
      participant_type: 'speaker',
      role: 'speaker',
      has_confirmed_speech: true,
      sources: ['transcript_speaker'],
    })),
  )
  requireNoError('create supplemental participants', participants.error)

  fixture.cleanup.supplementalIdentityIds = supplemental.map(({ id }) => id)
  await writeFile(PHASE38_BROWSER_FIXTURE_FILE, JSON.stringify(fixture), { mode: 0o600 })
}

async function runCli(): Promise<void> {
  const action = process.argv[2]
  if (action === 'seed') {
    await seedPhase38BrowserFixtures()
    return
  }
  if (action === 'cleanup') {
    await cleanupPhase38BrowserFixtures()
    return
  }
  throw new Error('Usage: phase38-test-fixtures.ts <seed|cleanup>')
}

if (resolve(process.argv[1] ?? '') === resolve(fileURLToPath(import.meta.url))) {
  await runCli()
}
