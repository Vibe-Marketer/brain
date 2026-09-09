/**
 * merge-organizations edge function integration proof (Phase 36, Plan 04, Task 1).
 *
 * merge-organizations is deploy-deferred (prod apply is Plan 06's job) --
 * this suite proves the REAL edge function code against a REAL TEST-project
 * database without deploying to Supabase Cloud: it spawns the actual
 * index.ts under `deno run` (Phase 35 P03 precedent, resolve-speakers.
 * integration.test.ts), pointed at the TEST project's URL/anon key/
 * service-role key via env vars, and drives it over real HTTP with real
 * signed-in JWTs. This is the genuine code path -- not a reimplementation
 * of its logic in the test.
 *
 * Proves ORG-03's has_role gate end-to-end:
 *  - no Authorization header -> 401 before any DB work
 *  - a non-admin caller (no user_roles row, member of neither org) -> 403,
 *    no mutation
 *  - a malformed payload from an admin caller -> 400
 *  - a platform-ADMIN caller (has_role ADMIN, member of NEITHER org --
 *    proving the gate really is has_role and not org membership, 36-
 *    RESEARCH.md Pitfall 5) merges two seeded orgs -> the loser's
 *    canonical_organization_id/merged_at/merged_by are set correctly
 *  - a self-merge (losing == winning) surfaces the underlying RPC's own
 *    rejection as a generic non-2xx response (no raw Postgres text), no
 *    mutation
 *
 * Run: VITEST_INTEGRATION_OK=true npx vitest run supabase/functions/merge-organizations/__tests__/merge-organizations.integration.test.ts --reporter=verbose
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { integrationDbReachable, makeIntegrationClient } from '@/test/integration-setup'

const SUITE_TAG = '[phase-36-04 merge-organizations]'
const FUNCTION_PORT = 8000
const FUNCTION_URL = `http://localhost:${FUNCTION_PORT}`
const REPO_ROOT = resolve(__dirname, '../../../..')
const FUNCTION_ENTRY = resolve(REPO_ROOT, 'supabase/functions/merge-organizations/index.ts')

const TEST_URL = process.env.VITE_SUPABASE_TEST_URL || ''
const TEST_ANON_KEY = process.env.VITE_SUPABASE_TEST_ANON_KEY || ''

/** Poll the spawned Deno server until it accepts connections (or timeout). */
async function waitForServer(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let lastError: unknown
  while (Date.now() < deadline) {
    try {
      await fetch(FUNCTION_URL, { method: 'OPTIONS' })
      return
    } catch (err) {
      lastError = err
      await new Promise((r) => setTimeout(r, 200))
    }
  }
  throw new Error(`${SUITE_TAG} merge-organizations server did not become reachable: ${String(lastError)}`)
}

describe.skipIf(!integrationDbReachable)(`${SUITE_TAG} ORG-03 has_role gate + merge_organizations_atomic wiring`, () => {
  const admin = makeIntegrationClient() // service-role, TEST project only
  let denoProc: ChildProcessWithoutNullStreams | null = null

  const stamp = Date.now()

  // Platform-admin authority is BY PARAMETER (has_role), never org
  // membership -- this user is deliberately a member of NEITHER test org
  // below, proving the gate really is has_role(user, 'ADMIN') and not
  // is_organization_admin_or_owner (36-RESEARCH.md Pitfall 5).
  let adminUserId = ''
  let adminEmail = ''
  const adminPassword = `phase36-04-admin-${stamp}-pwd!`
  let adminAccessToken = ''

  // A plain authenticated user with no user_roles row at all.
  let nonAdminUserId = ''
  let nonAdminEmail = ''
  const nonAdminPassword = `phase36-04-nonadmin-${stamp}-pwd!`
  let nonAdminAccessToken = ''

  let orgLosingId = ''
  let orgWinningId = ''
  let selfMergeOrgId = ''

  beforeAll(async () => {
    if (!integrationDbReachable) return

    adminEmail = `phase36-04-admin-${stamp}@callvault.test`
    const createAdmin = await admin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
    })
    if (createAdmin.error || !createAdmin.data.user) {
      throw new Error(`${SUITE_TAG} createUser admin failed: ${createAdmin.error?.message}`)
    }
    adminUserId = createAdmin.data.user.id

    const roleGrant = await admin.from('user_roles').insert({ user_id: adminUserId, role: 'ADMIN' })
    if (roleGrant.error) {
      throw new Error(`${SUITE_TAG} grant ADMIN role failed: ${roleGrant.error.message}`)
    }

    nonAdminEmail = `phase36-04-nonadmin-${stamp}@callvault.test`
    const createNonAdmin = await admin.auth.admin.createUser({
      email: nonAdminEmail,
      password: nonAdminPassword,
      email_confirm: true,
    })
    if (createNonAdmin.error || !createNonAdmin.data.user) {
      throw new Error(`${SUITE_TAG} createUser non-admin failed: ${createNonAdmin.error?.message}`)
    }
    nonAdminUserId = createNonAdmin.data.user.id

    // Real signed-in JWTs -- authenticateRequest inside the edge function
    // calls supabase.auth.getUser(token), which requires a genuine access
    // token, not just a user id.
    const adminClient: SupabaseClient = createClient(TEST_URL, TEST_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const adminSignIn = await adminClient.auth.signInWithPassword({ email: adminEmail, password: adminPassword })
    if (adminSignIn.error || !adminSignIn.data.session) {
      throw new Error(`${SUITE_TAG} admin signIn failed: ${adminSignIn.error?.message}`)
    }
    adminAccessToken = adminSignIn.data.session.access_token

    const nonAdminClient: SupabaseClient = createClient(TEST_URL, TEST_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const nonAdminSignIn = await nonAdminClient.auth.signInWithPassword({
      email: nonAdminEmail,
      password: nonAdminPassword,
    })
    if (nonAdminSignIn.error || !nonAdminSignIn.data.session) {
      throw new Error(`${SUITE_TAG} non-admin signIn failed: ${nonAdminSignIn.error?.message}`)
    }
    nonAdminAccessToken = nonAdminSignIn.data.session.access_token

    const orgLosing = await admin
      .from('organizations')
      .insert({ name: `${SUITE_TAG} Losing ${stamp}`, type: 'business' })
      .select('id')
      .single()
    if (orgLosing.error || !orgLosing.data) {
      throw new Error(`${SUITE_TAG} insert losing org failed: ${orgLosing.error?.message}`)
    }
    orgLosingId = orgLosing.data.id as string

    const orgWinning = await admin
      .from('organizations')
      .insert({ name: `${SUITE_TAG} Winning ${stamp}`, type: 'business' })
      .select('id')
      .single()
    if (orgWinning.error || !orgWinning.data) {
      throw new Error(`${SUITE_TAG} insert winning org failed: ${orgWinning.error?.message}`)
    }
    orgWinningId = orgWinning.data.id as string

    const selfMergeOrg = await admin
      .from('organizations')
      .insert({ name: `${SUITE_TAG} SelfMerge ${stamp}`, type: 'business' })
      .select('id')
      .single()
    if (selfMergeOrg.error || !selfMergeOrg.data) {
      throw new Error(`${SUITE_TAG} insert self-merge org failed: ${selfMergeOrg.error?.message}`)
    }
    selfMergeOrgId = selfMergeOrg.data.id as string

    // Spawn the REAL edge function under `deno run`, pointed at the TEST
    // project via env vars -- never deployed to Supabase Cloud.
    denoProc = spawn('deno', ['run', '--allow-net', '--allow-env', FUNCTION_ENTRY], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        SUPABASE_URL: TEST_URL,
        SUPABASE_ANON_KEY: TEST_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_TEST_SERVICE_ROLE_KEY,
      },
    })
    let stderrBuf = ''
    denoProc.stderr.on('data', (chunk) => {
      stderrBuf += String(chunk)
    })
    denoProc.on('exit', (code) => {
      if (code !== null && code !== 0) {
        console.error(`${SUITE_TAG} deno run exited early (code=${code}): ${stderrBuf}`)
      }
    })

    await waitForServer(20_000)
  }, 60_000)

  afterAll(async () => {
    if (denoProc) {
      denoProc.kill()
      denoProc = null
    }
    if (!integrationDbReachable) return

    try {
      const idsToClear = [orgLosingId, selfMergeOrgId].filter(Boolean)
      if (idsToClear.length > 0) {
        const { error } = await admin
          .from('organizations')
          .update({ canonical_organization_id: null, merged_at: null, merged_by: null })
          .in('id', idsToClear)
        if (error) console.warn(`${SUITE_TAG} clear canonical_organization_id failed:`, error.message)
      }
    } catch (err) {
      console.warn(`${SUITE_TAG} clear canonical_organization_id threw:`, err)
    }

    for (const orgId of [orgLosingId, orgWinningId, selfMergeOrgId]) {
      try {
        if (orgId) {
          const { error } = await admin.from('organizations').delete().eq('id', orgId)
          if (error) console.warn(`${SUITE_TAG} organizations delete failed for ${orgId}:`, error.message)
        }
      } catch (err) {
        console.warn(`${SUITE_TAG} organizations cleanup threw:`, err)
      }
    }

    try {
      if (adminUserId) {
        const { error } = await admin.from('user_roles').delete().eq('user_id', adminUserId)
        if (error) console.warn(`${SUITE_TAG} user_roles delete failed:`, error.message)
      }
    } catch (err) {
      console.warn(`${SUITE_TAG} user_roles cleanup threw:`, err)
    }

    try {
      const { error } = await admin.rpc('cleanup_test_fixture_users', { p_max_age_minutes: 0 })
      if (error) console.warn(`${SUITE_TAG} cleanup_test_fixture_users RPC failed:`, error.message)
    } catch (err) {
      console.warn(`${SUITE_TAG} cleanup threw:`, err)
    }
  }, 60_000)

  it('rejects a request with no Authorization header with 401 before any DB work', async () => {
    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ losing_organization_id: orgLosingId, winning_organization_id: orgWinningId }),
    })
    expect(res.status).toBe(401)
  })

  it('non-admin caller receives 403 and no mutation occurs', async () => {
    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${nonAdminAccessToken}` },
      body: JSON.stringify({ losing_organization_id: orgLosingId, winning_organization_id: orgWinningId }),
    })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.success).toBe(false)

    const org = await admin
      .from('organizations')
      .select('canonical_organization_id')
      .eq('id', orgLosingId)
      .single()
    expect(org.data?.canonical_organization_id, 'a rejected (non-admin) merge attempt must not set the pointer').toBeNull()
  })

  it('rejects a malformed payload from an admin caller with 400', async () => {
    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminAccessToken}` },
      body: JSON.stringify({ losing_organization_id: 'not-a-uuid', winning_organization_id: orgWinningId }),
    })
    expect(res.status).toBe(400)

    const org = await admin
      .from('organizations')
      .select('canonical_organization_id')
      .eq('id', orgLosingId)
      .single()
    expect(org.data?.canonical_organization_id).toBeNull()
  })

  it('platform admin merges two orgs -> canonical_organization_id/merged_at/merged_by set on the loser', async () => {
    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminAccessToken}` },
      body: JSON.stringify({ losing_organization_id: orgLosingId, winning_organization_id: orgWinningId }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)

    const org = await admin
      .from('organizations')
      .select('canonical_organization_id, merged_at, merged_by')
      .eq('id', orgLosingId)
      .single()
    expect(org.data?.canonical_organization_id).toBe(orgWinningId)
    expect(org.data?.merged_at).not.toBeNull()
    expect(org.data?.merged_by, 'p_admin_user_id must be the JWT-verified caller id, never a body value').toBe(
      adminUserId,
    )
  })

  it('self-merge is rejected by the underlying RPC: non-2xx response, generic message, no mutation', async () => {
    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminAccessToken}` },
      body: JSON.stringify({ losing_organization_id: selfMergeOrgId, winning_organization_id: selfMergeOrgId }),
    })
    expect(res.status).not.toBe(200)
    const body = await res.json()
    expect(body.success).toBe(false)
    // No raw Postgres/RPC error text leaked to the client.
    expect(body.error).not.toMatch(/RAISE|EXCEPTION|SQLSTATE|pg_/i)

    const org = await admin
      .from('organizations')
      .select('canonical_organization_id')
      .eq('id', selfMergeOrgId)
      .single()
    expect(org.data?.canonical_organization_id).toBeNull()
  })
})
