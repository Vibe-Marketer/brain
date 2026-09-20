import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { chmodSync, existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config as loadDotenv } from 'dotenv'

export const TEST_PROJECT_REF = 'swjzxiddcrtaqixsfaac'
export const PRODUCTION_PROJECT_REF = 'vltmrnjsubfzrgrtdqey'
export const CANARY_MARKER = 'phase-38-production-canary'
export const EXPECTED_ROLES = [
  'owner',
  'organizationAdmin',
  'teamActor',
  'coach',
  'confirmedParticipant',
  'inviteeOnly',
] as const

export type CanaryRole = typeof EXPECTED_ROLES[number]
export type CanaryTarget = 'test' | 'production'
export type CanaryAction = 'inventory' | 'provision' | 'verify' | 'cleanup'

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
  uuidRecordingId: string
  legacyRecordingId: string
  confirmedIdentityId: string
  inviteeIdentityId: string
  coachIdentityId: string
  legacyShareLinkId: string
  legacyAccessLogId: string
  legacyProviderId: number
}

export interface CanaryManifest {
  version: 1
  target: CanaryTarget
  projectRef: string
  marker: typeof CANARY_MARKER
  runId: string
  users: CanaryManifestUser[]
  graph: CanaryGraphIds
}

export interface CanaryResidue {
  authUsers: number
  graphRows: number
}

export interface CanaryAdapter {
  createAuthUser(input: CanaryUserSpec & { runId: string }): Promise<string>
  deleteAuthUser(id: string): Promise<void>
  createGraph(manifest: CanaryManifest): Promise<void>
  cleanupGraph(manifest: CanaryManifest): Promise<void>
  residue(manifest: CanaryManifest): Promise<CanaryResidue>
}

interface ShareLinkInventoryRow {
  id: string
  user_id: string
  recording_id: string | null
  call_recording_id: number | null
}

interface RecordingInventoryRow {
  id: string
  owner_user_id: string
  fathom_provider_id: number | null
}

export function isMissingCanonicalShareLinkColumn(error: { code?: string; message: string }): boolean {
  return error.code === '42703' && /call_share_links\.recording_id|column .*recording_id.*does not exist/i.test(error.message)
}

export function isMissingOptionalAccessLogTable(error: { code?: string; message: string }): boolean {
  const namesAccessLog = /(?:public\.)?call_share_access_log/i.test(error.message)
  return namesAccessLog && (
    error.code === '42P01'
    || error.code === 'PGRST205'
  )
}

type UnresolvedClassification = 'source_absent' | 'cross_owner_only'

interface UnresolvedIdentity {
  identity: string
  classification: UnresolvedClassification
}

export interface LegacyInventoryResult {
  unresolvedCount: number
  sourceAbsentCount: number
  crossOwnerOnlyCount: number
  ambiguousCount: number
  unsafeCrossOwnerAssignments: number
  keylessCount: number
  fingerprint: string
  status: 'PASS' | 'STOP'
}

interface InventoryInput {
  shareLinks: ShareLinkInventoryRow[]
  recordings: RecordingInventoryRow[]
  expectedFingerprint?: string
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

export function buildCanaryUsers(runId: string): CanaryUserSpec[] {
  if (!/^[a-z0-9-]+$/i.test(runId)) throw new Error('Canary run ID must be alphanumeric with optional hyphens')
  return EXPECTED_ROLES.map((role) => ({
    role,
    email: `${role.toLowerCase()}.${runId}@phase38.invalid`,
    password: `Cv38!${randomBytes(24).toString('base64url')}aA1`,
  }))
}

function graphIds(runId: string): CanaryGraphIds {
  const providerDigest = createHash('sha256').update(`phase38:${runId}:provider`).digest()
  const legacyProviderId = 1_300_000_000 + providerDigest.readUInt32BE(0) % 600_000_000
  return {
    organizationId: randomUUID(),
    workspaceId: randomUUID(),
    eventId: randomUUID(),
    uuidRecordingId: randomUUID(),
    legacyRecordingId: randomUUID(),
    confirmedIdentityId: randomUUID(),
    inviteeIdentityId: randomUUID(),
    coachIdentityId: randomUUID(),
    legacyShareLinkId: randomUUID(),
    legacyAccessLogId: randomUUID(),
    legacyProviderId,
  }
}

function assertManifestPath(path: string): void {
  const absolute = resolve(path)
  if (!absolute.startsWith('/tmp/') || absolute === '/tmp/') {
    throw new Error('Canary manifest must use an explicit file path under /tmp')
  }
}

function writeManifest(path: string, manifest: CanaryManifest): void {
  assertManifestPath(path)
  writeFileSync(path, `${JSON.stringify(manifest)}\n`, { encoding: 'utf8', mode: 0o600 })
  chmodSync(path, 0o600)
}

export function readManifest(path: string): CanaryManifest {
  assertManifestPath(path)
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as CanaryManifest
  if (parsed.version !== 1 || parsed.marker !== CANARY_MARKER || parsed.users.length > 6) {
    throw new Error('Invalid Phase 38 canary manifest')
  }
  return parsed
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
  input: { target: CanaryTarget; projectRef: string; manifestPath: string; runId?: string },
): Promise<CanaryManifest> {
  assertManifestPath(input.manifestPath)
  const runId = input.runId ?? randomBytes(12).toString('hex')
  const manifest: CanaryManifest = {
    version: 1,
    target: input.target,
    projectRef: input.projectRef,
    marker: CANARY_MARKER,
    runId,
    users: [],
    graph: graphIds(runId),
  }
  writeManifest(input.manifestPath, manifest)

  try {
    for (const spec of buildCanaryUsers(runId)) {
      const id = await adapter.createAuthUser({ ...spec, runId })
      manifest.users.push({ ...spec, id })
      writeManifest(input.manifestPath, manifest)
    }
    if (manifest.users.length !== 6) throw new Error('Canary provision did not create exactly six auth users')
    await adapter.createGraph(manifest)
    writeManifest(input.manifestPath, manifest)
    return manifest
  } catch (error) {
    await cleanupCanary(adapter, manifest, input.manifestPath).catch(() => undefined)
    throw error
  }
}

export function stableUnresolvedFingerprint(rows: UnresolvedIdentity[]): string {
  const canonical = [...rows]
    .sort((left, right) => left.identity.localeCompare(right.identity))
    .map((row) => `${row.classification}:${row.identity}`)
    .join('\n')
  return `sha256:${createHash('sha256').update(canonical).digest('hex')}`
}

export function evaluateLegacyInventory(input: InventoryInput): LegacyInventoryResult {
  const recordingsById = new Map(input.recordings.map((row) => [row.id, row]))
  const unresolved: UnresolvedIdentity[] = []
  let ambiguousCount = 0
  let unsafeCrossOwnerAssignments = 0
  let keylessCount = 0

  for (const link of input.shareLinks) {
    if (!link.recording_id && link.call_recording_id === null) {
      keylessCount += 1
      continue
    }
    if (link.recording_id) {
      const assigned = recordingsById.get(link.recording_id)
      if (!assigned || assigned.owner_user_id !== link.user_id) unsafeCrossOwnerAssignments += 1
      continue
    }

    const candidates = input.recordings.filter(
      (recording) => recording.fathom_provider_id === link.call_recording_id,
    )
    const sameOwner = candidates.filter((recording) => recording.owner_user_id === link.user_id)
    if (sameOwner.length > 1) {
      ambiguousCount += 1
    } else if (sameOwner.length === 0) {
      const classification: UnresolvedClassification = candidates.length === 0
        ? 'source_absent'
        : 'cross_owner_only'
      unresolved.push({
        identity: `${link.id}|${link.user_id}|${link.call_recording_id}`,
        classification,
      })
    }
  }

  const fingerprint = stableUnresolvedFingerprint(unresolved)
  const sourceAbsentCount = unresolved.filter((row) => row.classification === 'source_absent').length
  const crossOwnerOnlyCount = unresolved.filter((row) => row.classification === 'cross_owner_only').length
  const baselineMatches = input.expectedFingerprint === fingerprint
  const status = unresolved.length === 2
    && sourceAbsentCount === 1
    && crossOwnerOnlyCount === 1
    && ambiguousCount === 0
    && unsafeCrossOwnerAssignments === 0
    && keylessCount === 0
    && baselineMatches
    ? 'PASS'
    : 'STOP'

  return {
    unresolvedCount: unresolved.length,
    sourceAbsentCount,
    crossOwnerOnlyCount,
    ambiguousCount,
    unsafeCrossOwnerAssignments,
    keylessCount,
    fingerprint,
    status,
  }
}

export function formatInventoryEvidence(result: LegacyInventoryResult): string {
  return JSON.stringify({
    unresolvedCount: result.unresolvedCount,
    sourceAbsentCount: result.sourceAbsentCount,
    crossOwnerOnlyCount: result.crossOwnerOnlyCount,
    ambiguousCount: result.ambiguousCount,
    unsafeCrossOwnerAssignments: result.unsafeCrossOwnerAssignments,
    keylessCount: result.keylessCount,
    fingerprint: result.fingerprint,
    status: result.status,
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

export class SupabaseCanaryAdapter implements CanaryAdapter {
  constructor(private readonly client: SupabaseClient) {}

  async createAuthUser(input: CanaryUserSpec & { runId: string }): Promise<string> {
    const created = await this.client.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { integration_test: CANARY_MARKER, run_id: input.runId, role: input.role },
    })
    if (created.error || !created.data.user) throw new Error(`create synthetic ${input.role}: ${created.error?.message}`)
    return created.data.user.id
  }

  async deleteAuthUser(id: string): Promise<void> {
    // Auth provisioning invokes the normal signup trigger, which creates a
    // protected personal org/workspace. The exact-ID admin RPC is the existing
    // sanctioned trigger-bypass cascade; it never scans by domain or marker.
    const accountCleanup = await this.client.rpc('admin_delete_user', { p_target_user_id: id })
    requireNoError('cleanup exact synthetic auth graph', accountCleanup.error)
    const deleted = await this.client.auth.admin.deleteUser(id)
    if (deleted.error && !/not found/i.test(deleted.error.message)) throw deleted.error
  }

  private async insert(table: string, values: unknown): Promise<void> {
    const result = await this.client.from(table).insert(values as never)
    requireNoError(`insert ${table}`, result.error)
  }

  private async insertOptionalAccessLog(values: unknown): Promise<void> {
    const result = await this.client.from('call_share_access_log').insert(values as never)
    if (result.error && isMissingOptionalAccessLogTable(result.error)) return
    requireNoError('insert call_share_access_log', result.error)
  }

  async createGraph(manifest: CanaryManifest): Promise<void> {
    const { graph, runId } = manifest
    const owner = roleUser(manifest, 'owner')
    const admin = roleUser(manifest, 'organizationAdmin')
    const team = roleUser(manifest, 'teamActor')
    const coach = roleUser(manifest, 'coach')
    const confirmed = roleUser(manifest, 'confirmedParticipant')
    const invitee = roleUser(manifest, 'inviteeOnly')
    const slug = `p38${runId}`.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)
    const marker = { integration_test: CANARY_MARKER, run_id: runId }

    await this.insert('organizations', {
      id: graph.organizationId, name: `Phase 38 canary ${runId}`, slug, type: 'business',
    })
    await this.insert('workspaces', {
      id: graph.workspaceId, organization_id: graph.organizationId,
      name: `Phase 38 canary ${runId}`, slug: 'team',
      workspace_type: 'team', is_default: false, is_home: false,
    })
    await this.insert('organization_memberships', [
      { organization_id: graph.organizationId, user_id: owner.id, role: 'organization_owner' },
      { organization_id: graph.organizationId, user_id: admin.id, role: 'organization_admin' },
      { organization_id: graph.organizationId, user_id: team.id, role: 'organization_member' },
    ])
    await this.insert('workspace_memberships', [
      { workspace_id: graph.workspaceId, user_id: owner.id, role: 'workspace_admin' },
    ])
    await this.insert('events', {
      id: graph.eventId,
      canonical_start_time: '2026-09-19T15:00:00.000Z',
      canonical_end_time: '2026-09-19T15:30:00.000Z',
      resolution_confidence: 1,
    })
    await this.insert('recordings', [
      {
        id: graph.uuidRecordingId, organization_id: graph.organizationId,
        owner_user_id: owner.id, event_id: graph.eventId,
        title: `Phase 38 UUID canary ${runId}`, source_app: 'grain',
        source_call_id: `phase38-${runId}-uuid`, fathom_provider_id: null,
        source_metadata: marker,
      },
      {
        id: graph.legacyRecordingId, organization_id: graph.organizationId,
        owner_user_id: owner.id, event_id: graph.eventId,
        title: `Phase 38 legacy canary ${runId}`, source_app: 'fathom',
        source_call_id: String(graph.legacyProviderId), fathom_provider_id: graph.legacyProviderId,
        source_metadata: marker,
      },
    ])
    await this.insert('workspace_entries', [
      { workspace_id: graph.workspaceId, recording_id: graph.uuidRecordingId },
      { workspace_id: graph.workspaceId, recording_id: graph.legacyRecordingId },
    ])
    await this.insert('identities', [
      { id: graph.confirmedIdentityId, owner_user_id: confirmed.id },
      { id: graph.inviteeIdentityId, owner_user_id: invitee.id },
      { id: graph.coachIdentityId, owner_user_id: coach.id },
    ])
    await this.insert('identity_aliases', [
      {
        identity_id: graph.confirmedIdentityId, alias_type: 'email', value: confirmed.email,
        verified: true, verified_at: new Date().toISOString(), evidence: CANARY_MARKER, confidence: 1,
      },
      {
        identity_id: graph.inviteeIdentityId, alias_type: 'email', value: invitee.email,
        verified: true, verified_at: new Date().toISOString(), evidence: CANARY_MARKER, confidence: 1,
      },
      {
        identity_id: graph.coachIdentityId, alias_type: 'email', value: coach.email,
        verified: false, evidence: CANARY_MARKER, confidence: 0.5,
      },
    ])
    await this.insert('call_participants', [
      {
        recording_id: graph.uuidRecordingId, organization_id: graph.organizationId,
        event_id: graph.eventId, identity_id: graph.confirmedIdentityId,
        name: 'Confirmed Participant', email: confirmed.email,
        participant_type: 'speaker', role: 'speaker', has_confirmed_speech: true,
        sources: ['transcript_speaker'],
      },
      {
        recording_id: graph.uuidRecordingId, organization_id: graph.organizationId,
        event_id: graph.eventId, identity_id: graph.inviteeIdentityId,
        name: 'Invitee Only', email: invitee.email,
        participant_type: 'attendee', role: 'invitee', has_confirmed_speech: false,
        sources: ['calendar_invitees'],
      },
      {
        recording_id: graph.uuidRecordingId, organization_id: graph.organizationId,
        event_id: graph.eventId, identity_id: graph.coachIdentityId,
        name: 'Coach Unverified', email: coach.email,
        participant_type: 'speaker', role: 'speaker', has_confirmed_speech: true,
        sources: ['transcript_speaker'],
      },
    ])
    await this.insert('fathom_raw_calls', {
      recording_id: graph.legacyProviderId, user_id: owner.id,
      title: `Phase 38 legacy canary ${runId}`, source_platform: 'fathom',
      metadata: marker, created_at: new Date().toISOString(),
    })
    await this.insert('call_share_links', {
      id: graph.legacyShareLinkId, call_recording_id: graph.legacyProviderId,
      recording_id: null, user_id: owner.id, created_by_user_id: owner.id,
      share_token: `p38-${runId}`.slice(0, 32), recipient_email: invitee.email, status: 'active',
    })
    await this.insertOptionalAccessLog({
      id: graph.legacyAccessLogId, share_link_id: graph.legacyShareLinkId,
      accessed_by_user_id: null, ip_address: '192.0.2.38',
    })
  }

  private async deleteBy(
    table: string,
    column: string,
    values: string[] | number[],
    allowMissingAccessLog = false,
  ): Promise<void> {
    if (values.length === 0) return
    const result = await this.client.from(table).delete().in(column, values)
    if (allowMissingAccessLog && result.error && isMissingOptionalAccessLogTable(result.error)) return
    requireNoError(`cleanup ${table}`, result.error)
  }

  async cleanupGraph(manifest: CanaryManifest): Promise<void> {
    const { graph } = manifest
    const recordingIds = [graph.uuidRecordingId, graph.legacyRecordingId]
    const identityIds = [graph.confirmedIdentityId, graph.inviteeIdentityId, graph.coachIdentityId]
    await this.deleteBy('recording_access_audit_log', 'recording_id', recordingIds)
    await this.deleteBy('recording_access_grants', 'recording_id', recordingIds)
    await this.deleteBy('recording_access_requests', 'recording_id', recordingIds)
    await this.deleteBy('call_share_access_log', 'share_link_id', [graph.legacyShareLinkId], true)
    await this.deleteBy('call_share_links', 'id', [graph.legacyShareLinkId])
    await this.deleteBy('call_participants', 'recording_id', recordingIds)
    await this.deleteBy('identity_aliases', 'identity_id', identityIds)
    await this.deleteBy('identities', 'id', identityIds)
    await this.deleteBy('workspace_entries', 'recording_id', recordingIds)
    await this.deleteBy('recordings', 'id', recordingIds)
    await this.deleteBy('fathom_raw_calls', 'recording_id', [graph.legacyProviderId])
    await this.deleteBy('events', 'id', [graph.eventId])
    await this.deleteBy('workspace_memberships', 'workspace_id', [graph.workspaceId])
    await this.deleteBy('organization_memberships', 'organization_id', [graph.organizationId])
    await this.deleteBy('workspaces', 'id', [graph.workspaceId])
    await this.deleteBy('organizations', 'id', [graph.organizationId])
  }

  private async count(
    table: string,
    column: string,
    values: string[] | number[],
    allowMissingAccessLog = false,
  ): Promise<number> {
    const result = await this.client.from(table).select('*', { count: 'exact', head: true }).in(column, values)
    if (allowMissingAccessLog && result.error && isMissingOptionalAccessLogTable(result.error)) return 0
    requireNoError(`count ${table}`, result.error)
    return result.count ?? 0
  }

  async residue(manifest: CanaryManifest): Promise<CanaryResidue> {
    let authUsers = 0
    for (const user of manifest.users) {
      const result = await this.client.auth.admin.getUserById(user.id)
      if (result.data.user) authUsers += 1
      else if (result.error && !/not found/i.test(result.error.message)) throw result.error
    }
    const graphCounts = await Promise.all([
      this.count('organizations', 'id', [manifest.graph.organizationId]),
      this.count('workspaces', 'id', [manifest.graph.workspaceId]),
      this.count('recordings', 'id', [manifest.graph.uuidRecordingId, manifest.graph.legacyRecordingId]),
      this.count('call_share_links', 'id', [manifest.graph.legacyShareLinkId]),
      this.count('call_share_access_log', 'id', [manifest.graph.legacyAccessLogId], true),
    ])
    return { authUsers, graphRows: graphCounts.reduce((sum, count) => sum + count, 0) }
  }

  async loadInventory(): Promise<{ shareLinks: ShareLinkInventoryRow[]; recordings: RecordingInventoryRow[] }> {
    const extendedLinks = await this.client
      .from('call_share_links')
      .select('id,user_id,recording_id,call_recording_id')
    let shareLinks: ShareLinkInventoryRow[]
    if (extendedLinks.error && isMissingCanonicalShareLinkColumn(extendedLinks.error)) {
      const legacyLinks = await this.client
        .from('call_share_links')
        .select('id,user_id,call_recording_id')
      requireNoError('inventory legacy share links', legacyLinks.error)
      shareLinks = ((legacyLinks.data ?? []) as Omit<ShareLinkInventoryRow, 'recording_id'>[])
        .map((link) => ({ ...link, recording_id: null }))
    } else {
      requireNoError('inventory share links', extendedLinks.error)
      shareLinks = (extendedLinks.data ?? []) as ShareLinkInventoryRow[]
    }
    const providerIds = [...new Set(shareLinks
      .map((link) => link.call_recording_id)
      .filter((value): value is number => value !== null))]
    const canonicalIds = [...new Set(shareLinks
      .map((link) => link.recording_id)
      .filter((value): value is string => value !== null))]
    const byProvider = providerIds.length > 0
      ? await this.client.from('recordings').select('id,owner_user_id,fathom_provider_id').in('fathom_provider_id', providerIds)
      : { data: [] as RecordingInventoryRow[], error: null }
    requireNoError('inventory provider recordings', byProvider.error)
    const byCanonical = canonicalIds.length > 0
      ? await this.client.from('recordings').select('id,owner_user_id,fathom_provider_id').in('id', canonicalIds)
      : { data: [] as RecordingInventoryRow[], error: null }
    requireNoError('inventory canonical recordings', byCanonical.error)
    const deduplicated = new Map<string, RecordingInventoryRow>()
    for (const row of [...(byProvider.data ?? []), ...(byCanonical.data ?? [])] as RecordingInventoryRow[]) {
      deduplicated.set(row.id, row)
    }
    return {
      shareLinks,
      recordings: [...deduplicated.values()],
    }
  }
}

interface CliOptions {
  action: CanaryAction
  target: CanaryTarget
  projectRef: string
  confirmation?: string
  manifestPath?: string
  expectedFingerprint?: string
}

function parseCli(argv: string[]): CliOptions {
  const action = argv[0] as CanaryAction
  if (!['inventory', 'provision', 'verify', 'cleanup'].includes(action)) {
    throw new Error('Usage: phase38-production-canary.ts <inventory|provision|verify|cleanup> --target <test|production> --project-ref <ref>')
  }
  const value = (flag: string): string | undefined => {
    const index = argv.indexOf(flag)
    return index >= 0 ? argv[index + 1] : undefined
  }
  const target = value('--target') as CanaryTarget
  if (target !== 'test' && target !== 'production') throw new Error('--target must be test or production')
  const projectRef = value('--project-ref')
  if (!projectRef) throw new Error('--project-ref is required')
  return {
    action,
    target,
    projectRef,
    confirmation: value('--confirm-production'),
    manifestPath: value('--manifest'),
    expectedFingerprint: value('--expected-unresolved-fingerprint'),
  }
}

function credentials(target: CanaryTarget, projectRef: string): { url: string; serviceKey: string } {
  loadDotenv({ path: resolve(process.cwd(), '.env.test') })
  loadDotenv({ path: resolve(process.cwd(), '.env') })
  const url = target === 'test' ? process.env.VITE_SUPABASE_TEST_URL : process.env.VITE_SUPABASE_URL
  const serviceKey = target === 'test'
    ? process.env.SUPABASE_TEST_SERVICE_ROLE_KEY
    : process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error(`Missing explicit ${target} Supabase API credentials`)
  const parsed = new URL(url)
  if (!parsed.hostname.includes(projectRef)) throw new Error(`Credential URL does not match asserted ${target} project ref`)
  return { url: parsed.toString().replace(/\/$/, ''), serviceKey }
}

async function main(): Promise<void> {
  const options = parseCli(process.argv.slice(2))
  assertTargetGuard({
    target: options.target,
    projectRef: options.projectRef,
    action: options.action,
    confirmation: options.confirmation,
  })
  const credential = credentials(options.target, options.projectRef)
  const client = createClient(credential.url, credential.serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const adapter = new SupabaseCanaryAdapter(client)

  if (options.action === 'inventory') {
    const inventory = await adapter.loadInventory()
    const result = evaluateLegacyInventory({
      ...inventory,
      expectedFingerprint: options.expectedFingerprint,
    })
    process.stdout.write(`${formatInventoryEvidence(result)}\n`)
    if (result.status !== 'PASS') process.exitCode = 2
    return
  }

  if (!options.manifestPath) throw new Error('--manifest with an explicit /tmp path is required')
  if (options.action === 'provision') {
    const manifest = await provisionCanary(adapter, {
      target: options.target,
      projectRef: options.projectRef,
      manifestPath: options.manifestPath,
    })
    const residue = await adapter.residue(manifest)
    if (residue.authUsers !== 6 || residue.graphRows === 0) throw new Error('Canary provision verification failed')
    process.stdout.write(`${JSON.stringify({ createdUsers: 6, graphPresent: true, status: 'PASS' })}\n`)
    return
  }

  const manifest = readManifest(options.manifestPath)
  if (manifest.target !== options.target || manifest.projectRef !== options.projectRef) {
    throw new Error('Manifest target does not match asserted target')
  }
  if (options.action === 'cleanup') {
    await cleanupCanary(adapter, manifest, options.manifestPath)
    process.stdout.write(`${JSON.stringify({ authUsers: 0, graphRows: 0, status: 'PASS' })}\n`)
    return
  }

  const residue = await adapter.residue(manifest)
  const status = residue.authUsers === 6 && residue.graphRows > 0 ? 'PASS' : 'STOP'
  process.stdout.write(`${JSON.stringify({ ...residue, status })}\n`)
  if (status !== 'PASS') process.exitCode = 2
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ''
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`Phase 38 canary stopped: ${message}\n`)
    process.exitCode = 1
  })
}
