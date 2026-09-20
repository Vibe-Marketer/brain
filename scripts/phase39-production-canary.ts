import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { chmodSync, existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config as loadDotenv } from 'dotenv'

export const TEST_PROJECT_REF = 'swjzxiddcrtaqixsfaac'
export const PRODUCTION_PROJECT_REF = 'vltmrnjsubfzrgrtdqey'
export const CANARY_MARKER = 'phase-39-production-canary'

export type CanaryTarget = 'test' | 'production'
export type CanaryAction = 'inventory' | 'provision' | 'verify' | 'cleanup'
export type CanaryRole = 'owner' | 'claimant' | 'unrelated'

export interface CanaryUserSpec {
  role: CanaryRole
  email: string
  password: string
}

export interface CanaryManifestUser extends CanaryUserSpec {
  id: string
}

export interface CanaryGraphIds {
  organizationId: string
  workspaceId: string
  eventId: string
  futureEventId: string
  recordingId: string
  futureRecordingId: string
  participantId: string
  futureParticipantId: string
  invitationId: string
}

export interface CanaryManifest {
  version: 1
  target: CanaryTarget
  projectRef: string
  marker: typeof CANARY_MARKER
  markerDigest: string
  runId: string
  sourceFingerprint: string
  invitedEmail: string
  token: string
  tokenHash: string
  users: CanaryManifestUser[]
  graph: CanaryGraphIds
}

export interface CanaryResidue {
  authUsers: number
  graphRows: number
}

export interface CanaryAdapter {
  createAuthUser(input: CanaryUserSpec & { runId: string; markerDigest: string }): Promise<string>
  deleteAuthUser(id: string): Promise<void>
  createGraph(manifest: CanaryManifest): Promise<void>
  verifyGraph(manifest: CanaryManifest): Promise<Record<string, number | string | boolean>>
  cleanupGraph(manifest: CanaryManifest): Promise<void>
  residue(manifest: CanaryManifest): Promise<CanaryResidue>
}

interface EvidenceInput {
  status: 'PASS' | 'STOP'
  sourceFingerprint: string
  counts: Record<string, number>
  checks?: Record<string, number | string | boolean>
  privateValues?: string[]
}

interface RpcResult {
  data: unknown
  error: { message: string } | null
}

const isMutatingAction = (action: CanaryAction): boolean =>
  action === 'provision' || action === 'cleanup'

export function assertTargetGuard(input: {
  target: CanaryTarget
  projectRef: string
  action: CanaryAction
  confirmation?: string
}): void {
  const expectedRef = input.target === 'test' ? TEST_PROJECT_REF : PRODUCTION_PROJECT_REF
  if (input.projectRef !== expectedRef) {
    throw new Error(`Target guard rejected ${input.target}: expected exact ${input.target === 'test' ? 'TEST' : 'production'} project ref`)
  }
  if (
    input.target === 'production'
    && isMutatingAction(input.action)
    && input.confirmation !== PRODUCTION_PROJECT_REF
  ) {
    throw new Error(`Production mutation requires --confirm-production ${PRODUCTION_PROJECT_REF}`)
  }
}

export function assertSourceFingerprint(expected: string, actual: string): void {
  const pattern = /^sha256:[0-9a-f]{64}$/
  if (!pattern.test(expected) || !pattern.test(actual)) {
    throw new Error('Source fingerprint must be a lowercase SHA-256 digest')
  }
  if (expected !== actual) throw new Error('Source fingerprint drift detected')
}

function assertManifestPath(path: string): void {
  const absolute = resolve(path)
  if (
    (!absolute.startsWith('/tmp/') && !absolute.startsWith('/private/tmp/'))
    || absolute === '/tmp/'
    || absolute === '/private/tmp/'
  ) {
    throw new Error('Canary manifest must use an explicit path below /tmp')
  }
}

function writeManifest(path: string, manifest: CanaryManifest): void {
  assertManifestPath(path)
  writeFileSync(path, `${JSON.stringify(manifest)}\n`, { encoding: 'utf8', mode: 0o600 })
  chmodSync(path, 0o600)
}

export function readManifest(path: string): CanaryManifest {
  assertManifestPath(path)
  const manifest = JSON.parse(readFileSync(path, 'utf8')) as CanaryManifest
  if (
    manifest.version !== 1
    || manifest.marker !== CANARY_MARKER
    || manifest.users.length > 3
    || !/^[0-9a-f]{64}$/.test(manifest.tokenHash)
  ) {
    throw new Error('Invalid Phase 39 canary manifest')
  }
  return manifest
}

function buildUsers(runId: string): CanaryUserSpec[] {
  if (!/^[a-z0-9-]+$/i.test(runId)) throw new Error('Canary run ID must be alphanumeric with optional hyphens')
  return (['owner', 'claimant', 'unrelated'] as const).map((role) => ({
    role,
    email: `${role}.${runId}@phase39.invalid`,
    password: `Cv39!${randomBytes(24).toString('base64url')}aA1`,
  }))
}

function graphIds(): CanaryGraphIds {
  return {
    organizationId: randomUUID(),
    workspaceId: randomUUID(),
    eventId: randomUUID(),
    futureEventId: randomUUID(),
    recordingId: randomUUID(),
    futureRecordingId: randomUUID(),
    participantId: randomUUID(),
    futureParticipantId: randomUUID(),
    invitationId: randomUUID(),
  }
}

export async function cleanupCanary(
  adapter: CanaryAdapter,
  manifest: CanaryManifest,
  manifestPath: string,
): Promise<void> {
  const failures: string[] = []
  await adapter.cleanupGraph(manifest).catch((error: unknown) => {
    failures.push(error instanceof Error ? error.message : String(error))
  })
  for (const user of [...manifest.users].reverse()) {
    await adapter.deleteAuthUser(user.id).catch((error: unknown) => {
      failures.push(error instanceof Error ? error.message : String(error))
    })
  }
  const residue = await adapter.residue(manifest)
  if (residue.authUsers !== 0 || residue.graphRows !== 0) {
    throw new Error(`Canary cleanup residue: authUsers=${residue.authUsers}, graphRows=${residue.graphRows}`)
  }
  if (existsSync(manifestPath)) unlinkSync(manifestPath)
  if (failures.length > 0) throw new Error(`Canary cleanup failures: ${failures.join('; ')}`)
}

export async function provisionCanary(
  adapter: CanaryAdapter,
  input: {
    target: CanaryTarget
    projectRef: string
    confirmation?: string
    sourceFingerprint: string
    expectedSourceFingerprint: string
    manifestPath: string
    runId?: string
  },
): Promise<CanaryManifest> {
  assertTargetGuard({
    target: input.target,
    projectRef: input.projectRef,
    action: 'provision',
    confirmation: input.confirmation,
  })
  assertSourceFingerprint(input.expectedSourceFingerprint, input.sourceFingerprint)
  assertManifestPath(input.manifestPath)
  const runId = input.runId ?? randomBytes(12).toString('hex')
  const token = randomBytes(32).toString('base64url')
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const markerDigest = createHash('sha256')
    .update(`${CANARY_MARKER}:${runId}:${tokenHash}`)
    .digest('hex')
  const manifest: CanaryManifest = {
    version: 1,
    target: input.target,
    projectRef: input.projectRef,
    marker: CANARY_MARKER,
    markerDigest,
    runId,
    sourceFingerprint: input.sourceFingerprint,
    invitedEmail: `claim.${markerDigest.slice(0, 24)}@phase39.invalid`,
    token,
    tokenHash,
    users: [],
    graph: graphIds(),
  }
  writeManifest(input.manifestPath, manifest)

  try {
    for (const spec of buildUsers(runId)) {
      const id = await adapter.createAuthUser({ ...spec, runId, markerDigest })
      manifest.users.push({ ...spec, id })
      writeManifest(input.manifestPath, manifest)
    }
    if (manifest.users.length !== 3) throw new Error('Canary provision did not create exactly three auth users')
    await adapter.createGraph(manifest)
    writeManifest(input.manifestPath, manifest)
    return manifest
  } catch (error) {
    await cleanupCanary(adapter, manifest, input.manifestPath).catch(() => undefined)
    throw error
  }
}

export function formatEvidence(input: EvidenceInput): string {
  // This is deliberately allowlist-only. privateValues exists so callers can
  // make the redaction boundary explicit, but none of those values is copied.
  return JSON.stringify({
    marker: CANARY_MARKER,
    status: input.status,
    sourceFingerprint: input.sourceFingerprint,
    counts: input.counts,
    checks: input.checks ?? {},
  })
}

function roleUser(manifest: CanaryManifest, role: CanaryRole): CanaryManifestUser {
  const user = manifest.users.find((candidate) => candidate.role === role)
  if (!user) throw new Error(`Canary manifest is missing role ${role}`)
  return user
}

function requireNoError(label: string, error: { message: string } | null): void {
  if (error) throw new Error(`${label}: ${error.message}`)
}

function rows(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value as Array<Record<string, unknown>> : []
}

async function invokeRpc(
  client: SupabaseClient,
  name: string,
  args?: Record<string, unknown>,
): Promise<RpcResult> {
  return client.rpc(name as never, args as never) as unknown as Promise<RpcResult>
}

export class SupabaseCanaryAdapter implements CanaryAdapter {
  constructor(
    private readonly admin: SupabaseClient,
    private readonly url: string,
    private readonly anonKey: string,
  ) {}

  async createAuthUser(input: CanaryUserSpec & { runId: string; markerDigest: string }): Promise<string> {
    const result = await this.admin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        integration_test: CANARY_MARKER,
        run_id_digest: createHash('sha256').update(input.runId).digest('hex'),
        marker_digest: input.markerDigest,
        role: input.role,
      },
    })
    if (result.error || !result.data.user) throw new Error(`create synthetic ${input.role} failed`)
    return result.data.user.id
  }

  async deleteAuthUser(id: string): Promise<void> {
    const cleanup = await invokeRpc(this.admin, 'admin_delete_user', { p_target_user_id: id })
    if (cleanup.error && !/not found/i.test(cleanup.error.message)) requireNoError('cleanup exact synthetic graph', cleanup.error)
    const deleted = await this.admin.auth.admin.deleteUser(id)
    if (deleted.error && !/not found/i.test(deleted.error.message)) throw new Error('delete synthetic auth user failed')
  }

  private async insert(table: string, values: unknown): Promise<void> {
    const result = await this.admin.from(table).insert(values as never)
    requireNoError(`insert ${table}`, result.error)
  }

  private async signedIn(user: CanaryManifestUser): Promise<SupabaseClient> {
    const client = createClient(this.url, this.anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const result = await client.auth.signInWithPassword({ email: user.email, password: user.password })
    if (result.error) throw new Error(`sign in synthetic ${user.role} failed`)
    return client
  }

  async createGraph(manifest: CanaryManifest): Promise<void> {
    const owner = roleUser(manifest, 'owner')
    const marker = { integration_test: CANARY_MARKER, marker_digest: manifest.markerDigest }
    const slug = `p39${manifest.markerDigest.slice(0, 16)}`
    const now = Date.now()

    await this.insert('organizations', {
      id: manifest.graph.organizationId,
      name: `Phase 39 canary ${manifest.markerDigest.slice(0, 12)}`,
      slug,
      type: 'business',
    })
    await this.insert('workspaces', {
      id: manifest.graph.workspaceId,
      organization_id: manifest.graph.organizationId,
      name: 'Phase 39 synthetic canary',
      slug: 'canary',
      workspace_type: 'team',
      is_default: false,
      is_home: false,
    })
    await this.insert('organization_memberships', {
      organization_id: manifest.graph.organizationId,
      user_id: owner.id,
      role: 'organization_owner',
    })
    await this.insert('workspace_memberships', {
      workspace_id: manifest.graph.workspaceId,
      user_id: owner.id,
      role: 'workspace_admin',
    })
    await this.insert('events', {
      id: manifest.graph.eventId,
      canonical_start_time: new Date(now - 3_600_000).toISOString(),
      canonical_end_time: new Date(now - 1_800_000).toISOString(),
      resolution_confidence: 1,
    })
    await this.insert('recordings', {
      id: manifest.graph.recordingId,
      organization_id: manifest.graph.organizationId,
      owner_user_id: owner.id,
      event_id: manifest.graph.eventId,
      title: 'Phase 39 private synthetic recording',
      source_app: 'grain',
      source_call_id: `p39-${manifest.markerDigest.slice(0, 20)}`,
      source_metadata: marker,
    })
    await this.insert('workspace_entries', {
      workspace_id: manifest.graph.workspaceId,
      recording_id: manifest.graph.recordingId,
    })
    await this.insert('call_participants', {
      id: manifest.graph.participantId,
      recording_id: manifest.graph.recordingId,
      organization_id: manifest.graph.organizationId,
      event_id: manifest.graph.eventId,
      identity_id: null,
      name: 'Synthetic participant',
      email: manifest.invitedEmail,
      participant_type: 'speaker',
      role: 'speaker',
      has_confirmed_speech: true,
      sources: ['transcript_speaker'],
    })
    await this.insert('participation_claim_invitations', {
      id: manifest.graph.invitationId,
      recording_id: manifest.graph.recordingId,
      participant_id: manifest.graph.participantId,
      event_id: manifest.graph.eventId,
      inviter_user_id: owner.id,
      invited_email: manifest.invitedEmail,
      token_hash: manifest.tokenHash,
      state: 'sent',
      sent_at: new Date(now).toISOString(),
      expires_at: new Date(now + 7 * 24 * 60 * 60_000).toISOString(),
      reminder_opt_in: true,
      reminder_scheduled_for: new Date(now + 5 * 24 * 60 * 60_000).toISOString(),
      reminder_provider_id: `synthetic-${manifest.markerDigest.slice(0, 20)}`,
      delivery_provider_id: `synthetic-${manifest.markerDigest.slice(20, 40)}`,
      delivery_status: 'sent',
    })
  }

  async verifyGraph(manifest: CanaryManifest): Promise<Record<string, number | string | boolean>> {
    const claimant = await this.signedIn(roleUser(manifest, 'claimant'))
    const unrelated = await this.signedIn(roleUser(manifest, 'unrelated'))

    const inspectBefore = await this.admin.from('participation_claim_invitations')
      .select('state,claimed_at,claimed_by_user_id')
      .eq('id', manifest.graph.invitationId)
      .single()
    requireNoError('snapshot invitation before inspect', inspectBefore.error)
    const inspect = await invokeRpc(claimant, 'inspect_my_participation_claim', {
      p_token_hash: manifest.tokenHash,
    })
    requireNoError('inspect claim', inspect.error)
    const inspected = rows(inspect.data)[0]
    if (inspected?.available !== true || inspected?.confirmation_required !== true) {
      throw new Error('inspect claim contract failed')
    }
    const inspectAfter = await this.admin.from('participation_claim_invitations')
      .select('state,claimed_at,claimed_by_user_id')
      .eq('id', manifest.graph.invitationId)
      .single()
    requireNoError('snapshot invitation after inspect', inspectAfter.error)
    if (JSON.stringify(inspectAfter.data) !== JSON.stringify(inspectBefore.data)) {
      throw new Error('inspect mutated invitation state')
    }

    const denied = await invokeRpc(unrelated, 'consume_my_participation_claim', {
      p_token_hash: manifest.tokenHash,
      p_confirm_email_attachment: false,
    })
    requireNoError('decline attachment claim', denied.error)
    if (rows(denied.data)[0]?.success !== false) throw new Error('attachment confirmation was not required')

    const parallel = await Promise.all([
      invokeRpc(claimant, 'consume_my_participation_claim', {
        p_token_hash: manifest.tokenHash,
        p_confirm_email_attachment: true,
      }),
      invokeRpc(claimant, 'consume_my_participation_claim', {
        p_token_hash: manifest.tokenHash,
        p_confirm_email_attachment: true,
      }),
    ])
    for (const result of parallel) requireNoError('parallel claim', result.error)
    const claimRows = parallel.flatMap((result) => rows(result.data))
    const winners = claimRows.filter((row) => row.success === true).length
    if (winners !== 1) throw new Error('parallel claim did not have exactly one winner')

    const replay = await invokeRpc(claimant, 'consume_my_participation_claim', {
      p_token_hash: manifest.tokenHash,
      p_confirm_email_attachment: true,
    })
    requireNoError('claim replay', replay.error)
    if (rows(replay.data)[0]?.success !== false) throw new Error('claim replay was not denied')

    const discovered = await invokeRpc(claimant, 'list_my_discovered_events', {
      p_limit: 25,
      p_cursor: null,
    })
    requireNoError('list discovery', discovered.error)
    const discoveryRows = rows(discovered.data)
    if (discoveryRows.length !== 1) throw new Error('claimed event was not discovered exactly once')
    const projection = discoveryRows[0]
    if (rows(projection.readable_copies).length !== 0 || rows(projection.restricted_copies).length !== 1) {
      throw new Error('readable/restricted projection contract failed')
    }
    const directEvent = await claimant.from('events').select('id').eq('id', manifest.graph.eventId)
    requireNoError('direct event RLS', directEvent.error)
    if (directEvent.data?.length !== 1) throw new Error('direct event RLS did not agree with discovery')
    const content = await claimant.from('recordings')
      .select('id,title,full_transcript')
      .eq('id', manifest.graph.recordingId)
    requireNoError('Phase 38 content denial', content.error)
    if (content.data?.length !== 0) throw new Error('claim incorrectly granted recording content')

    const firstSync = await invokeRpc(claimant, 'sync_my_discovered_event_notifications')
    requireNoError('notification baseline', firstSync.error)
    if (firstSync.data !== 0) throw new Error('notification baseline was not silent')

    await this.insert('events', {
      id: manifest.graph.futureEventId,
      canonical_start_time: new Date(Date.now() + 3_600_000).toISOString(),
      canonical_end_time: new Date(Date.now() + 5_400_000).toISOString(),
      resolution_confidence: 1,
    })
    await this.insert('recordings', {
      id: manifest.graph.futureRecordingId,
      organization_id: manifest.graph.organizationId,
      owner_user_id: roleUser(manifest, 'owner').id,
      event_id: manifest.graph.futureEventId,
      title: 'Phase 39 private future synthetic recording',
      source_app: 'grain',
      source_call_id: `p39-future-${manifest.markerDigest.slice(0, 20)}`,
      source_metadata: { integration_test: CANARY_MARKER, marker_digest: manifest.markerDigest },
    })
    await this.insert('workspace_entries', {
      workspace_id: manifest.graph.workspaceId,
      recording_id: manifest.graph.futureRecordingId,
    })
    await this.insert('call_participants', {
      id: manifest.graph.futureParticipantId,
      recording_id: manifest.graph.futureRecordingId,
      organization_id: manifest.graph.organizationId,
      event_id: manifest.graph.futureEventId,
      identity_id: null,
      name: 'Synthetic future participant',
      email: manifest.invitedEmail,
      participant_type: 'speaker',
      role: 'speaker',
      has_confirmed_speech: true,
      sources: ['transcript_speaker'],
    })
    const futureFirst = await invokeRpc(claimant, 'sync_my_discovered_event_notifications')
    const futureSecond = await invokeRpc(claimant, 'sync_my_discovered_event_notifications')
    requireNoError('future notification first sync', futureFirst.error)
    requireNoError('future notification dedupe sync', futureSecond.error)
    if (futureFirst.data !== 1 || futureSecond.data !== 0) throw new Error('future notification was not exact once')

    const identity = await this.admin.from('identities')
      .select('id')
      .eq('owner_user_id', roleUser(manifest, 'claimant').id)
      .single()
    requireNoError('claim identity lookup', identity.error)
    const alias = await this.admin.from('identity_aliases')
      .select('id')
      .eq('identity_id', String(identity.data?.id))
      .eq('value', manifest.invitedEmail)
      .eq('verified', true)
      .single()
    requireNoError('claim alias lookup', alias.error)
    const disconnect = await invokeRpc(claimant, 'disconnect_my_verified_email_alias', {
      p_alias_id: alias.data?.id,
    })
    requireNoError('disconnect claim alias', disconnect.error)
    if (disconnect.data !== true) throw new Error('disconnect did not revoke alias')

    const afterDisconnect = await invokeRpc(claimant, 'count_my_discovered_events')
    requireNoError('count after disconnect', afterDisconnect.error)
    if (Number(rows(afterDisconnect.data)[0]?.event_count ?? -1) !== 0) {
      throw new Error('disconnect did not revoke derived discovery')
    }
    const participants = await this.admin.from('call_participants')
      .select('id', { count: 'exact', head: true })
      .in('id', [manifest.graph.participantId, manifest.graph.futureParticipantId])
    requireNoError('participant preservation', participants.error)
    if (participants.count !== 2) throw new Error('disconnect rewrote participant evidence')

    return {
      inspect_non_consuming: true,
      confirmation_required: true,
      discovery_count: 1,
      direct_rls_agrees: true,
      restricted_projection_count: 1,
      claim_winners: winners,
      claim_replay_denied: true,
      notification_count: Number(futureFirst.data),
      notification_deduped: true,
      content_rows: content.data?.length ?? -1,
      disconnect_revoked: true,
      participants_preserved: participants.count ?? 0,
    }
  }

  async cleanupGraph(manifest: CanaryManifest): Promise<void> {
    const eventIds = [manifest.graph.eventId, manifest.graph.futureEventId]
    const recordingIds = [manifest.graph.recordingId, manifest.graph.futureRecordingId]
    const participantIds = [manifest.graph.participantId, manifest.graph.futureParticipantId]
    const userIds = manifest.users.map((user) => user.id)
    const steps: Array<[string, PromiseLike<{ error: { message: string } | null }>]> = [
      ['notifications', this.admin.from('user_notifications').delete().in('user_id', userIds)],
      ['notification ledger', this.admin.from('event_discovery_notification_ledger').delete().in('user_id', userIds)],
      ['invitations', this.admin.from('participation_claim_invitations').delete().eq('id', manifest.graph.invitationId)],
      ['participants', this.admin.from('call_participants').delete().in('id', participantIds)],
      ['aliases', this.admin.from('identity_aliases').delete().eq('value', manifest.invitedEmail)],
      ['identities', this.admin.from('identities').delete().in('owner_user_id', userIds)],
      ['workspace entries', this.admin.from('workspace_entries').delete().in('recording_id', recordingIds)],
      ['recordings', this.admin.from('recordings').delete().in('id', recordingIds)],
      ['events', this.admin.from('events').delete().in('id', eventIds)],
      ['workspace memberships', this.admin.from('workspace_memberships').delete().eq('workspace_id', manifest.graph.workspaceId)],
      ['organization memberships', this.admin.from('organization_memberships').delete().eq('organization_id', manifest.graph.organizationId)],
      ['workspace', this.admin.from('workspaces').delete().eq('id', manifest.graph.workspaceId)],
      ['organization', this.admin.from('organizations').delete().eq('id', manifest.graph.organizationId)],
    ]
    for (const [label, operation] of steps) {
      const result = await operation
      if (result.error) throw new Error(`cleanup ${label} failed`)
    }
  }

  async residue(manifest: CanaryManifest): Promise<CanaryResidue> {
    const auth = await this.admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (auth.error) throw new Error('auth residue query failed')
    const listedUsers = auth.data.users as Array<{ user_metadata?: Record<string, unknown> }>
    const authUsers = listedUsers.filter((user) =>
      user.user_metadata?.marker_digest === manifest.markerDigest,
    ).length
    const counts = await Promise.all([
      this.admin.from('organizations').select('*', { count: 'exact', head: true }).eq('id', manifest.graph.organizationId),
      this.admin.from('events').select('*', { count: 'exact', head: true }).in('id', [manifest.graph.eventId, manifest.graph.futureEventId]),
      this.admin.from('recordings').select('*', { count: 'exact', head: true }).in('id', [manifest.graph.recordingId, manifest.graph.futureRecordingId]),
      this.admin.from('call_participants').select('*', { count: 'exact', head: true }).in('id', [manifest.graph.participantId, manifest.graph.futureParticipantId]),
      this.admin.from('participation_claim_invitations').select('*', { count: 'exact', head: true }).eq('id', manifest.graph.invitationId),
      this.admin.from('identity_aliases').select('*', { count: 'exact', head: true }).eq('value', manifest.invitedEmail),
      this.admin.from('event_discovery_notification_ledger').select('*', { count: 'exact', head: true }).in('user_id', manifest.users.map((user) => user.id)),
    ])
    let graphRows = 0
    for (const result of counts) {
      requireNoError('residue query', result.error)
      graphRows += result.count ?? 0
    }
    return { authUsers, graphRows }
  }
}

interface CliOptions {
  action: CanaryAction
  target: CanaryTarget
  projectRef: string
  confirmation?: string
  manifestPath: string
  sourceFingerprint: string
  expectedSourceFingerprint: string
}

function valueAfter(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag)
  return index >= 0 ? args[index + 1] : undefined
}

function parseCli(args: string[]): CliOptions {
  const action = valueAfter(args, '--action') as CanaryAction | undefined
  const target = valueAfter(args, '--target') as CanaryTarget | undefined
  const projectRef = valueAfter(args, '--project-ref')
  const manifestPath = valueAfter(args, '--manifest')
  const sourceFingerprint = valueAfter(args, '--source-fingerprint')
  const expectedSourceFingerprint = valueAfter(args, '--expected-source-fingerprint')
  if (!action || !['inventory', 'provision', 'verify', 'cleanup'].includes(action)) throw new Error('Valid --action is required')
  if (!target || !['test', 'production'].includes(target)) throw new Error('Valid --target is required')
  if (!projectRef || !manifestPath || !sourceFingerprint || !expectedSourceFingerprint) {
    throw new Error('--project-ref, --manifest, and both source fingerprints are required')
  }
  return {
    action,
    target,
    projectRef,
    confirmation: valueAfter(args, '--confirm-production'),
    manifestPath,
    sourceFingerprint,
    expectedSourceFingerprint,
  }
}

function environmentFor(target: CanaryTarget): { url: string; serviceKey: string; anonKey: string } {
  loadDotenv({ path: target === 'test' ? '.env.test' : '.env', override: false, quiet: true })
  const url = target === 'test'
    ? process.env.VITE_SUPABASE_TEST_URL
    : process.env.VITE_SUPABASE_URL
  const serviceKey = target === 'test'
    ? process.env.SUPABASE_TEST_SERVICE_ROLE_KEY
    : process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = target === 'test'
    ? process.env.VITE_SUPABASE_TEST_ANON_KEY
    : process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !serviceKey || !anonKey) throw new Error('Canary environment is incomplete')
  return { url, serviceKey, anonKey }
}

async function main(): Promise<void> {
  const options = parseCli(process.argv.slice(2))
  // These checks intentionally precede dotenv loading and client construction.
  assertTargetGuard({
    target: options.target,
    projectRef: options.projectRef,
    action: options.action,
    confirmation: options.confirmation,
  })
  assertSourceFingerprint(options.expectedSourceFingerprint, options.sourceFingerprint)
  const environment = environmentFor(options.target)
  if (!environment.url.includes(options.projectRef)) throw new Error('Environment URL does not match guarded project ref')
  const admin = createClient(environment.url, environment.serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const adapter = new SupabaseCanaryAdapter(admin, environment.url, environment.anonKey)

  if (options.action === 'provision') {
    const manifest = await provisionCanary(adapter, {
      target: options.target,
      projectRef: options.projectRef,
      confirmation: options.confirmation,
      sourceFingerprint: options.sourceFingerprint,
      expectedSourceFingerprint: options.expectedSourceFingerprint,
      manifestPath: options.manifestPath,
    })
    console.log(formatEvidence({
      status: 'PASS', sourceFingerprint: options.sourceFingerprint,
      counts: { auth_users: manifest.users.length, graph_rows: 1 },
      privateValues: [manifest.invitedEmail, manifest.token, ...manifest.users.map((user) => user.id)],
    }))
    return
  }

  const manifest = readManifest(options.manifestPath)
  if (manifest.target !== options.target || manifest.projectRef !== options.projectRef) {
    throw new Error('Manifest target does not match guarded target')
  }
  assertSourceFingerprint(options.sourceFingerprint, manifest.sourceFingerprint)
  if (options.action === 'verify') {
    const checks = await adapter.verifyGraph(manifest)
    console.log(formatEvidence({
      status: 'PASS', sourceFingerprint: options.sourceFingerprint,
      counts: { checks: Object.keys(checks).length }, checks,
      privateValues: [manifest.invitedEmail, manifest.token, ...manifest.users.map((user) => user.id)],
    }))
    return
  }
  if (options.action === 'cleanup') {
    await cleanupCanary(adapter, manifest, options.manifestPath)
    console.log(formatEvidence({
      status: 'PASS', sourceFingerprint: options.sourceFingerprint,
      counts: { auth_users: 0, graph_rows: 0 },
    }))
    return
  }
  const residue = await adapter.residue(manifest)
  console.log(formatEvidence({
    status: residue.authUsers === 0 && residue.graphRows === 0 ? 'PASS' : 'STOP',
    sourceFingerprint: options.sourceFingerprint,
    counts: { auth_users: residue.authUsers, graph_rows: residue.graphRows },
  }))
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ''
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'unknown failure'
    const safeCode = createHash('sha256').update(message).digest('hex').slice(0, 16)
    console.error(JSON.stringify({ marker: CANARY_MARKER, status: 'STOP', error_code: safeCode }))
    process.exitCode = 1
  })
}
