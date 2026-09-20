/**
 * Integration test — share-call Edge Function (Phase 32, SHARE-02 / QA-22).
 *
 * Validates the response shape matrix:
 *   - 404 LINK_NOT_FOUND for unknown token
 *   - 200 public-view for unauthenticated valid token (safe-subset payload only)
 *   - 200 ok for correct-recipient authenticated request
 *   - 403 WRONG_RECIPIENT for wrong-account authenticated request (with masked email)
 *   - 200 ok for sender-views-own-link (sender bypass)
 *   - 403 LINK_REVOKED for revoked token
 *   - 200 signup-prefill returning the recipient_email
 *   - server-side email masking format check
 *
 * Skips cleanly unless every dedicated-test credential is set.
 *
 * Uses the donor pattern (pick an existing org+user pair from `recordings`) to
 * avoid needing auth.users admin permissions for fixture creation. Sender,
 * recipient, and wrong-recipient are simulated via JWT tokens fetched from
 * existing test accounts (sign-in via password) — falls back to skipping the
 * auth-dependent tests when test accounts are absent.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  cleanupPhase38FixtureGraph,
  createPhase38FixtureGraph,
  type Phase38FixtureGraph,
} from '../../../../src/test/phase38-fixtures'
import {
  getIntegrationTestFetchConfig,
  integrationDbReachable,
  makeIntegrationAnonClient,
  makeIntegrationClient,
} from '../../../../src/test/integration-setup'

const TEST_LEGACY_ID = 999000032 // Phase 32 fixture marker
const TEST_TITLE = '[phase-32 share-call integration] do-not-touch'
const TEST_TOKEN = `phase32-test-${Date.now()}`
const TEST_REVOKED_TOKEN = `phase32-revoked-${Date.now()}`
const TEST_RECIPIENT_EMAIL = `phase32-recipient-${Date.now()}@vibeos.com`

async function fetchShareCall(
  token: string,
  mode?: 'signup-prefill',
  authenticatedClient?: SupabaseClient,
  logAccess = false,
): Promise<Response> {
  const config = getIntegrationTestFetchConfig()
  if (!config) {
    throw new Error('Dedicated test fetch configuration is unavailable')
  }
  const query = new URLSearchParams({ token })
  if (mode) query.set('mode', mode)
  if (logAccess) query.set('log_access', 'true')
  const headers: Record<string, string> = {
    apikey: config.anonKey,
    'Content-Type': 'application/json',
  }
  if (authenticatedClient) {
    const session = await authenticatedClient.auth.getSession()
    const accessToken = session.data.session?.access_token
    if (!accessToken) throw new Error('Phase 38 fixture client has no signed-in session')
    headers.Authorization = `Bearer ${accessToken}`
  }
  return fetch(`${config.url}/functions/v1/share-call?${query.toString()}`, {
    headers,
  })
}

async function mutateShareCall(
  method: 'POST' | 'DELETE',
  authenticatedClient: SupabaseClient,
  options: { recordingId?: string; shareLinkId?: string; recipientEmail?: string },
): Promise<Response> {
  const config = getIntegrationTestFetchConfig()
  if (!config) throw new Error('Dedicated test fetch configuration is unavailable')
  const session = await authenticatedClient.auth.getSession()
  const accessToken = session.data.session?.access_token
  if (!accessToken) throw new Error('Phase 38 fixture client has no signed-in session')

  const query = options.shareLinkId ? `?id=${encodeURIComponent(options.shareLinkId)}` : ''
  return fetch(`${config.url}/functions/v1/share-call${query}`, {
    method,
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: method === 'POST'
      ? JSON.stringify({
          recording_id: options.recordingId,
          recipient_email: options.recipientEmail,
        })
      : undefined,
  })
}

describe.skipIf(!integrationDbReachable)('Phase 32: share-call response matrix', () => {
  const db = makeIntegrationClient()
  const anonClient = makeIntegrationAnonClient()

  let orgId: string
  let senderUserId: string
  let shareLinkId: string
  let revokedShareLinkId: string

  beforeAll(async () => {
    // Donor: pick the first existing fathom recording — gives us a valid
    // org_id + user_id pair without provisioning new auth.users.
    const donor = await db
      .from('recordings')
      .select('organization_id, owner_user_id')
      .eq('source_app', 'fathom')
      .limit(1)
      .maybeSingle()

    if (donor.error || !donor.data) {
      throw new Error(
        `Integration setup failed — no donor recording found: ${donor.error?.message}`
      )
    }

    orgId = donor.data.organization_id as string
    senderUserId = donor.data.owner_user_id as string

    // Cleanup leftover fixtures from a prior aborted run
    await db.from('call_share_links').delete().eq('share_token', TEST_TOKEN)
    await db.from('call_share_links').delete().eq('share_token', TEST_REVOKED_TOKEN)
    await db.from('recordings').delete().eq('fathom_provider_id', TEST_LEGACY_ID)
    await db.from('fathom_raw_calls').delete().eq('recording_id', TEST_LEGACY_ID)

    // Seed a fathom_raw_calls row owned by the donor sender.
    // Note: column is `title` (not `call_name`) — the test asserts the public-view
    // payload's `call_title` field matches this string.
    const fathomInsert = await db.from('fathom_raw_calls').insert({
      recording_id: TEST_LEGACY_ID,
      user_id: senderUserId,
      title: 'Phase 32 Test Call',
      recorded_by_email: 'sender@example.com',
      full_transcript: 'Phase 32 share-call integration test transcript.',
      summary: 'Phase 32 share-call integration test.',
      source_platform: 'fathom',
      recording_start_time: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      recording_end_time: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
    })

    if (fathomInsert.error) {
      throw new Error(`Failed to seed fathom_raw_calls: ${fathomInsert.error.message}`)
    }

    // Seed a recordings mirror row
    await db.from('recordings').insert({
      fathom_provider_id: TEST_LEGACY_ID,
      organization_id: orgId,
      owner_user_id: senderUserId,
      title: TEST_TITLE,
      source_app: 'fathom',
      source_call_id: String(TEST_LEGACY_ID),
      full_transcript: 'Phase 32 share-call integration test transcript.',
      summary: 'Phase 32 share-call integration test.',
      source_metadata: { integration_test: 'phase-32-share-call' },
    })

    // Seed the active share link
    const activeLink = await db
      .from('call_share_links')
      .insert({
        call_recording_id: TEST_LEGACY_ID,
        user_id: senderUserId,
        created_by_user_id: senderUserId,
        share_token: TEST_TOKEN,
        recipient_email: TEST_RECIPIENT_EMAIL,
        status: 'active',
      })
      .select('id')
      .single()
    if (activeLink.error || !activeLink.data) {
      throw new Error(`Failed to seed active share link: ${activeLink.error?.message}`)
    }
    shareLinkId = activeLink.data.id as string

    // Seed the revoked share link
    const revokedLink = await db
      .from('call_share_links')
      .insert({
        call_recording_id: TEST_LEGACY_ID,
        user_id: senderUserId,
        created_by_user_id: senderUserId,
        share_token: TEST_REVOKED_TOKEN,
        recipient_email: TEST_RECIPIENT_EMAIL,
        status: 'revoked',
        revoked_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (revokedLink.error || !revokedLink.data) {
      throw new Error(`Failed to seed revoked share link: ${revokedLink.error?.message}`)
    }
    revokedShareLinkId = revokedLink.data.id as string
  }, 60_000)

  afterAll(async () => {
    if (shareLinkId) await db.from('call_share_links').delete().eq('id', shareLinkId)
    if (revokedShareLinkId) await db.from('call_share_links').delete().eq('id', revokedShareLinkId)
    await db.from('recordings').delete().eq('fathom_provider_id', TEST_LEGACY_ID)
    await db.from('fathom_raw_calls').delete().eq('recording_id', TEST_LEGACY_ID)
  })

  // --- Tests --------------------------------------------------------------

  it('returns 404 LINK_NOT_FOUND for an unknown token', async () => {
    const { data, error } = await anonClient.functions.invoke('share-call', {
      method: 'GET',
      // Pass the token as a query param — supabase-js encodes the function name
      // but does not append search params, so we use the raw URL via a fetch fallback.
      body: undefined,
    })
    // Fallback: hit the function endpoint directly via fetch with the query string.
    const fetchRes = await fetchShareCall(`does-not-exist-32-${Date.now()}`)
    expect(fetchRes.status).toBe(404)
    const body = await fetchRes.json()
    expect(body.code).toBe('LINK_NOT_FOUND')
    // Sanity-check the supabase-js invoke path also returned something (or
    // gave an error) — don't strict-assert because it may go through 404.
    expect(data ?? error).toBeDefined()
  }, 30_000)

  it('returns 200 public-view for unauthenticated valid token (no transcript leak)', async () => {
    const res = await fetchShareCall(TEST_TOKEN)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.is_public_view).toBe(true)
    expect(typeof body.inviter_name).toBe('string')
    expect(body.call_title).toBe('Phase 32 Test Call')
    // Server-side mask format check
    expect(body.recipient_masked).toMatch(/^[a-z0-9]{2}\*{3}@vibeos\.com$/)
    // No transcript / recording_id leakage
    expect(body).not.toHaveProperty('full_transcript')
    expect(body).not.toHaveProperty('recording_id')
    expect(body.call).toBeUndefined()
  }, 30_000)

  it('returns 200 signup-prefill returning the recipient_email', async () => {
    const res = await fetchShareCall(TEST_TOKEN, 'signup-prefill')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.recipient_email).toBe(TEST_RECIPIENT_EMAIL)
    // Should NOT include inviter/title/etc
    expect(body.inviter_name).toBeUndefined()
    expect(body.call_title).toBeUndefined()
  }, 30_000)

  it('returns 403 LINK_REVOKED for a revoked token', async () => {
    const res = await fetchShareCall(TEST_REVOKED_TOKEN)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.code).toBe('LINK_REVOKED')
  }, 30_000)

  // Note: WRONG_RECIPIENT, sender-bypass, and correct-recipient tests require
  // real JWT tokens for distinct users. We cannot mint JWTs without password
  // credentials for known test accounts. Document this as manual UAT in the
  // VERIFY doc; the four tests above cover the response-shape primitives
  // (404, 200 public-view, 200 signup-prefill, 403 LINK_REVOKED) and the
  // server-side masking format. WRONG_RECIPIENT and sender-bypass are
  // verified end-to-end via dev-browser cross-account flow per SHARE-04 UAT.
})

describe.skipIf(!integrationDbReachable)('Phase 38: legacy token and UUID-native bridge contract', () => {
  const db = makeIntegrationClient()
  let graph: Phase38FixtureGraph
  let legacyToken: string
  let expiredLinkId: string
  let expiredToken: string
  let uuidShareLinkId: string | null = null
  let unresolvedLegacyLinkId: string | null = null
  let unresolvedLegacyProviderId: number | null = null
  let unresolvedLegacyToken: string | null = null
  let legacySnapshot: {
    id: string
    share_token: string | null
    status: string
    recipient_email: string | null
  }

  beforeAll(async () => {
    graph = await createPhase38FixtureGraph(`phase38-share-${Date.now()}`)
    const link = await db
      .from('call_share_links')
      .select('id, share_token, status, recipient_email')
      .eq('id', graph.ids.legacyShareLinkId)
      .single()
    if (link.error || !link.data?.share_token) {
      throw new Error(`Phase 38 legacy link setup failed: ${link.error?.message}`)
    }
    legacySnapshot = link.data
    legacyToken = link.data.share_token

    expiredToken = `phase38-expired-${Date.now()}`
    const expired = await db
      .from('call_share_links')
      .insert({
        call_recording_id: graph.legacyProviderId,
        user_id: graph.users.owner.id,
        created_by_user_id: graph.users.owner.id,
        share_token: expiredToken,
        recipient_email: graph.users.grantRecipient.email,
        status: 'active',
        expires_at: new Date(Date.now() - 60_000).toISOString(),
      })
      .select('id')
      .single()
    if (expired.error || !expired.data) {
      throw new Error(`Phase 38 expired link setup failed: ${expired.error?.message}`)
    }
    expiredLinkId = expired.data.id
  }, 60_000)

  afterAll(async () => {
    if (unresolvedLegacyLinkId) {
      await db.from('call_share_links').delete().eq('id', unresolvedLegacyLinkId)
    }
    if (unresolvedLegacyProviderId) {
      await db.from('fathom_raw_calls').delete().eq('recording_id', unresolvedLegacyProviderId)
    }
    if (uuidShareLinkId) await db.from('call_share_links').delete().eq('id', uuidShareLinkId)
    if (expiredLinkId) await db.from('call_share_links').delete().eq('id', expiredLinkId)
    if (graph) await cleanupPhase38FixtureGraph(graph)
  }, 60_000)

  it('preserves the legacy row, token, recipient, status, and access-log relationship', async () => {
    const publicResponse = await fetchShareCall(legacyToken)
    expect(publicResponse.status).toBe(200)

    const afterResolve = await db
      .from('call_share_links')
      .select('id, share_token, status, recipient_email')
      .eq('id', graph.ids.legacyShareLinkId)
      .single()
    expect(afterResolve.error).toBeNull()
    expect(afterResolve.data).toEqual(legacySnapshot)

    const accessLog = await db
      .from('call_share_access_log')
      .select('id, share_link_id')
      .eq('id', graph.ids.legacyAccessLogId)
      .single()
    expect(accessLog.error).toBeNull()
    expect(accessLog.data).toEqual({
      id: graph.ids.legacyAccessLogId,
      share_link_id: graph.ids.legacyShareLinkId,
    })
  }, 30_000)

  it('keeps anonymous safe-subset resolution for an old /s/<token> link', async () => {
    const response = await fetchShareCall(legacyToken)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.is_public_view).toBe(true)
    expect(body).not.toHaveProperty('full_transcript')
    expect(body).not.toHaveProperty('recording_id')
    expect(body).not.toHaveProperty('owner_user_id')
  }, 30_000)

  it('keeps wrong-recipient rejection for an old token', async () => {
    const response = await fetchShareCall(
      legacyToken,
      undefined,
      graph.clients.signedIn.unrelated,
    )
    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({ code: 'WRONG_RECIPIENT' })
  }, 30_000)

  it('keeps correct-recipient and owner access for an old token', async () => {
    const recipientResponse = await fetchShareCall(
      legacyToken,
      undefined,
      graph.clients.signedIn.grantRecipient,
      true,
    )
    expect(recipientResponse.status).toBe(200)
    await expect(recipientResponse.json()).resolves.toMatchObject({ is_valid: true })

    const ownerResponse = await fetchShareCall(
      legacyToken,
      undefined,
      graph.clients.signedIn.owner,
    )
    expect(ownerResponse.status).toBe(200)
    await expect(ownerResponse.json()).resolves.toMatchObject({ is_valid: true })
  }, 30_000)

  it('keeps expired links out of the recipient list', async () => {
    const expired = await graph.clients.signedIn.grantRecipient
      .from('call_share_links')
      .select('id')
      .eq('id', expiredLinkId)
    expect(expired.error).toBeNull()
    expect(expired.data).toEqual([])
  })

  it.each([
    ['anonymous', undefined],
    ['recipient', 'grantRecipient'],
    ['sender', 'owner'],
  ] as const)('rejects an expired token for %s content access', async (_label, role) => {
    const response = await fetchShareCall(
      expiredToken,
      undefined,
      role ? graph.clients.signedIn[role] : undefined,
    )
    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({ code: 'LINK_NOT_FOUND' })
  }, 30_000)

  it('rejects signup prefill for an expired token', async () => {
    const response = await fetchShareCall(expiredToken, 'signup-prefill')
    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({ code: 'LINK_NOT_FOUND' })
  }, 30_000)

  it('a UUID-only non-Fathom recording can create, resolve, list, and revoke a share link', async () => {
    expect(graph.recordings.uuidOnly.fathomProviderId).toBeNull()
    const createResponse = await mutateShareCall('POST', graph.clients.signedIn.owner, {
      recordingId: graph.recordings.uuidOnly.id,
      recipientEmail: graph.users.grantRecipient.email,
    })
    expect(createResponse.status).toBe(200)
    const createBody = await createResponse.json()
    expect(createBody.share_link).toMatchObject({
      recording_id: graph.recordings.uuidOnly.id,
      call_recording_id: null,
      user_id: graph.users.owner.id,
      status: 'active',
    })
    const uuidToken = createBody.share_link.share_token as string
    uuidShareLinkId = createBody.share_link.id as string

    const resolved = await fetchShareCall(uuidToken)
    expect(resolved.status, 'UUID token resolution must use recording_id before legacy fallback.').toBe(200)

    const listed = await db
      .from('call_share_links')
      .select('id, recording_id, status')
      .eq('recording_id', graph.recordings.uuidOnly.id)
      .single()
    expect(listed.error, 'UUID share listing must filter by recording_id.').toBeNull()

    const revokeResponse = await mutateShareCall('DELETE', graph.clients.signedIn.owner, {
      shareLinkId: uuidShareLinkId,
    })
    expect(revokeResponse.status).toBe(200)
    const revoked = await db
      .from('call_share_links')
      .select('status')
      .eq('id', uuidShareLinkId)
      .single()
    expect(revoked.error, 'UUID share revocation must preserve the UUID-linked row.').toBeNull()
    expect(revoked.data?.status).toBe('revoked')
  }, 30_000)

  it('lets only the owner list and revoke resolved and unresolved legacy-only links safely', async () => {
    unresolvedLegacyProviderId = graph.legacyProviderId + 99_000_000
    const rawCall = await db.from('fathom_raw_calls').insert({
      recording_id: unresolvedLegacyProviderId,
      user_id: graph.users.owner.id,
      title: 'Unresolved canonical legacy share management fixture',
      source_platform: 'fathom',
      created_at: new Date().toISOString(),
    })
    expect(rawCall.error).toBeNull()

    unresolvedLegacyToken = `phase38-unresolved-${Date.now()}`
    const unresolved = await db
      .from('call_share_links')
      .insert({
        call_recording_id: unresolvedLegacyProviderId,
        recording_id: null,
        user_id: graph.users.owner.id,
        created_by_user_id: graph.users.owner.id,
        share_token: unresolvedLegacyToken,
        recipient_email: graph.users.inviteeOnly.email,
        status: 'active',
      })
      .select('id')
      .single()
    expect(unresolved.error).toBeNull()
    unresolvedLegacyLinkId = unresolved.data?.id ?? null

    const ownerList = await graph.clients.signedIn.owner.rpc('list_owner_share_links_v2', {
      p_recording_id: graph.ids.legacyRecordingId,
    })
    expect(ownerList.error).toBeNull()
    expect(ownerList.data).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: graph.ids.legacyShareLinkId,
        recording_id: null,
        resolved_recording_id: graph.ids.legacyRecordingId,
        resolution_status: 'legacy_unique',
      }),
      expect.objectContaining({
        id: unresolvedLegacyLinkId,
        recording_id: null,
        resolved_recording_id: null,
        resolution_status: 'legacy_unresolved',
      }),
    ]))

    const unrelatedList = await graph.clients.signedIn.unrelated.rpc('list_owner_share_links_v2', {
      p_recording_id: graph.ids.legacyRecordingId,
    })
    expect(unrelatedList.error).toBeNull()
    expect(unrelatedList.data).toEqual([])

    for (const shareLinkId of [graph.ids.legacyShareLinkId, unresolvedLegacyLinkId]) {
      expect(shareLinkId).toBeTruthy()
      const revokeResponse = await mutateShareCall('DELETE', graph.clients.signedIn.owner, {
        shareLinkId: shareLinkId!,
      })
      expect(revokeResponse.status).toBe(200)
    }

    const revoked = await db
      .from('call_share_links')
      .select('id, status')
      .in('id', [graph.ids.legacyShareLinkId, unresolvedLegacyLinkId!])
    expect(revoked.error).toBeNull()
    expect(revoked.data).toHaveLength(2)
    expect(revoked.data?.every((link) => link.status === 'revoked')).toBe(true)
  }, 30_000)

  it('fails closed for ambiguity, cross-owner candidates, unsafe UUID sharing, and keyless rows', async () => {
    const seed = Date.now()
    const ambiguousProviderId = graph.legacyProviderId + 110_000_000
    const crossOwnerProviderId = graph.legacyProviderId + 120_000_000
    const recordingIds = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()]
    const shareIds: string[] = []

    try {
      const secondOrganization = await db
        .from('organizations')
        .select('id')
        .neq('id', graph.ids.organizationId)
        .limit(1)
        .single()
      expect(secondOrganization.error).toBeNull()

      const recordingInsert = await db.from('recordings').insert([
        {
          id: recordingIds[0],
          organization_id: graph.ids.organizationId,
          owner_user_id: graph.users.owner.id,
          event_id: graph.ids.eventId,
          title: 'Phase 38 ambiguous legacy candidate A',
          source_app: 'fathom',
          source_call_id: `${ambiguousProviderId}-a`,
          fathom_provider_id: ambiguousProviderId,
          source_metadata: { integration_test: 'phase-38-legacy-invariant' },
        },
        {
          id: recordingIds[1],
          organization_id: secondOrganization.data!.id,
          owner_user_id: graph.users.owner.id,
          event_id: graph.ids.eventId,
          title: 'Phase 38 ambiguous legacy candidate B',
          source_app: 'fathom',
          source_call_id: `${ambiguousProviderId}-b`,
          fathom_provider_id: ambiguousProviderId,
          source_metadata: { integration_test: 'phase-38-legacy-invariant' },
        },
        {
          id: recordingIds[2],
          organization_id: graph.ids.organizationId,
          owner_user_id: graph.users.unrelated.id,
          event_id: graph.ids.eventId,
          title: 'Phase 38 cross-owner-only candidate',
          source_app: 'fathom',
          source_call_id: String(crossOwnerProviderId),
          fathom_provider_id: crossOwnerProviderId,
          source_metadata: { integration_test: 'phase-38-legacy-invariant' },
        },
      ])
      expect(recordingInsert.error).toBeNull()

      const rawCalls = await db.from('fathom_raw_calls').insert([
        {
          recording_id: ambiguousProviderId,
          user_id: graph.users.owner.id,
          title: 'Phase 38 ambiguous legacy raw source',
          source_platform: 'fathom',
          created_at: new Date().toISOString(),
        },
        {
          recording_id: crossOwnerProviderId,
          user_id: graph.users.owner.id,
          title: 'Phase 38 cross-owner-only legacy raw source',
          source_platform: 'fathom',
          created_at: new Date().toISOString(),
        },
      ])
      expect(rawCalls.error).toBeNull()

      const tokens = [
        `p38-amb-${seed}`.slice(0, 32),
        `p38-cross-${seed}`.slice(0, 32),
      ]
      const links = await db.from('call_share_links').insert([
        {
          call_recording_id: ambiguousProviderId,
          recording_id: null,
          user_id: graph.users.owner.id,
          created_by_user_id: graph.users.owner.id,
          share_token: tokens[0],
          status: 'active',
        },
        {
          call_recording_id: crossOwnerProviderId,
          recording_id: null,
          user_id: graph.users.owner.id,
          created_by_user_id: graph.users.owner.id,
          share_token: tokens[1],
          status: 'active',
        },
      ]).select('id')
      expect(links.error).toBeNull()
      shareIds.push(...(links.data ?? []).map((link) => link.id))

      const ownerInventory = await graph.clients.signedIn.owner.rpc('list_owner_share_links_v2', {
        p_recording_id: graph.ids.uuidRecordingId,
      })
      expect(ownerInventory.error).toBeNull()
      expect(ownerInventory.data).toEqual(expect.arrayContaining([
        expect.objectContaining({ resolution_status: 'legacy_ambiguous', resolved_recording_id: null }),
        expect.objectContaining({ resolution_status: 'legacy_unresolved', resolved_recording_id: null }),
      ]))

      const unsafeUuidShare = await mutateShareCall('POST', graph.clients.signedIn.owner, {
        recordingId: recordingIds[2],
        recipientEmail: graph.users.inviteeOnly.email,
      })
      expect(unsafeUuidShare.status).toBe(404)

      const keyless = await db.from('call_share_links').insert({
        call_recording_id: null,
        recording_id: null,
        user_id: graph.users.owner.id,
        created_by_user_id: graph.users.owner.id,
        share_token: `phase38-keyless-${seed}`,
        status: 'active',
      })
      expect(keyless.error?.message).toMatch(/call_share_links_has_recording_key/i)
    } finally {
      if (shareIds.length > 0) await db.from('call_share_links').delete().in('id', shareIds)
      await db.from('fathom_raw_calls').delete().in('recording_id', [ambiguousProviderId, crossOwnerProviderId])
      await db.from('workspace_entries').delete().in('recording_id', recordingIds)
      await db.from('recordings').delete().in('id', recordingIds)
    }
  }, 60_000)
})
