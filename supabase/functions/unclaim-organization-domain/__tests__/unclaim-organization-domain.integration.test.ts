/**
 * unclaim-organization-domain edge function integration proof (Phase 36,
 * Plan 04, Task 2).
 *
 * unclaim-organization-domain is deploy-deferred (prod apply is Plan 06's
 * job) -- this suite proves the REAL edge function code against a REAL
 * TEST-project database without deploying to Supabase Cloud: it spawns the
 * actual index.ts under `deno run` (Phase 35 P03 precedent, mirrors
 * merge-organizations.integration.test.ts from this same plan), pointed at
 * the TEST project's URL/anon key/service-role key via env vars, and
 * drives it over real HTTP with real signed-in JWTs.
 *
 * Proves ORG-03's has_role gate end-to-end:
 *  - no Authorization header -> 401 before any DB work
 *  - a non-admin caller (no user_roles row, not a member of the domain's
 *    org) -> 403, the organization_domains row survives
 *  - a malformed payload from an admin caller -> 400
 *  - a platform-ADMIN caller (has_role ADMIN, member of NEITHER the domain's
 *    org -- proving the gate really is has_role and not org membership,
 *    36-RESEARCH.md Pitfall 5) unclaims a seeded domain -> the
 *    organization_domains row is deleted
 *
 * Run: VITEST_INTEGRATION_OK=true npx vitest run supabase/functions/unclaim-organization-domain/__tests__/unclaim-organization-domain.integration.test.ts --reporter=verbose
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { integrationDbReachable, makeIntegrationClient } from '@/test/integration-setup'

const SUITE_TAG = '[phase-36-04 unclaim-organization-domain]'
// Distinct from merge-organizations' test port (8031) and
// resolve-speakers.integration.test.ts's port (8000, Phase 35 P03) -- all
// three are deploy-deferred edge-function suites that spawn a real
// `deno run` server, and `npm run test:integration` can run them in the
// same invocation. See LOCAL_DENO_TEST_PORT in the function's own index.ts
// for why this is safe to set here without touching deployed behavior.
const FUNCTION_PORT = 8032
const FUNCTION_URL = `http://localhost:${FUNCTION_PORT}`
const REPO_ROOT = resolve(__dirname, '../../../..')
const FUNCTION_ENTRY = resolve(REPO_ROOT, 'supabase/functions/unclaim-organization-domain/index.ts')

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
  throw new Error(`${SUITE_TAG} unclaim-organization-domain server did not become reachable: ${String(lastError)}`)
}

describe.skipIf(!integrationDbReachable)(
  `${SUITE_TAG} ORG-03 has_role gate + unclaim_organization_domain_atomic wiring`,
  () => {
    const admin = makeIntegrationClient() // service-role, TEST project only
    let denoProc: ChildProcessWithoutNullStreams | null = null

    const stamp = Date.now()

    // Platform-admin authority is BY PARAMETER (has_role), never org
    // membership -- this user is deliberately NOT a member of the domain's
    // org, proving the gate really is has_role(user, 'ADMIN') and not
    // is_organization_admin_or_owner (36-RESEARCH.md Pitfall 5).
    let adminUserId = ''
    let adminEmail = ''
    const adminPassword = `phase36-04-unclaim-admin-${stamp}-pwd!`
    let adminAccessToken = ''

    // A plain authenticated user with no user_roles row at all.
    let nonAdminUserId = ''
    let nonAdminEmail = ''
    const nonAdminPassword = `phase36-04-unclaim-nonadmin-${stamp}-pwd!`
    let nonAdminAccessToken = ''

    let orgId = ''
    let domainId = ''
    let malformedTestDomainId = '' // stays claimed the whole suite; only used for the 400 assertion's control read

    beforeAll(async () => {
      if (!integrationDbReachable) return

      adminEmail = `phase36-04-unclaim-admin-${stamp}@callvault.test`
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

      nonAdminEmail = `phase36-04-unclaim-nonadmin-${stamp}@callvault.test`
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

      const org = await admin
        .from('organizations')
        .insert({ name: `${SUITE_TAG} Org ${stamp}`, type: 'business' })
        .select('id')
        .single()
      if (org.error || !org.data) {
        throw new Error(`${SUITE_TAG} insert org failed: ${org.error?.message}`)
      }
      orgId = org.data.id as string

      const domain = await admin
        .from('organization_domains')
        .insert({ organization_id: orgId, domain: `phase36-04-unclaim-${stamp}.test` })
        .select('id')
        .single()
      if (domain.error || !domain.data) {
        throw new Error(`${SUITE_TAG} insert domain failed: ${domain.error?.message}`)
      }
      domainId = domain.data.id as string

      const malformedTestDomain = await admin
        .from('organization_domains')
        .insert({ organization_id: orgId, domain: `phase36-04-unclaim-malformed-check-${stamp}.test` })
        .select('id')
        .single()
      if (malformedTestDomain.error || !malformedTestDomain.data) {
        throw new Error(`${SUITE_TAG} insert malformed-check domain failed: ${malformedTestDomain.error?.message}`)
      }
      malformedTestDomainId = malformedTestDomain.data.id as string

      // Spawn the REAL edge function under `deno run`, pointed at the TEST
      // project via env vars -- never deployed to Supabase Cloud.
      denoProc = spawn('deno', ['run', '--allow-net', '--allow-env', FUNCTION_ENTRY], {
        cwd: REPO_ROOT,
        env: {
          ...process.env,
          SUPABASE_URL: TEST_URL,
          SUPABASE_ANON_KEY: TEST_ANON_KEY,
          SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_TEST_SERVICE_ROLE_KEY,
          LOCAL_DENO_TEST_PORT: String(FUNCTION_PORT),
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
        const idsToClear = [domainId, malformedTestDomainId].filter(Boolean)
        if (idsToClear.length > 0) {
          const { error } = await admin.from('organization_domains').delete().in('id', idsToClear)
          if (error) console.warn(`${SUITE_TAG} organization_domains cleanup failed:`, error.message)
        }
      } catch (err) {
        console.warn(`${SUITE_TAG} organization_domains cleanup threw:`, err)
      }

      try {
        if (orgId) {
          const { error } = await admin.from('organizations').delete().eq('id', orgId)
          if (error) console.warn(`${SUITE_TAG} organizations delete failed:`, error.message)
        }
      } catch (err) {
        console.warn(`${SUITE_TAG} organizations cleanup threw:`, err)
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
        body: JSON.stringify({ domain_id: domainId }),
      })
      expect(res.status).toBe(401)
    })

    it('non-admin caller receives 403 and the domain row survives', async () => {
      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${nonAdminAccessToken}` },
        body: JSON.stringify({ domain_id: domainId }),
      })
      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.success).toBe(false)

      const row = await admin.from('organization_domains').select('id').eq('id', domainId)
      expect(row.data?.length, 'a rejected (non-admin) unclaim attempt must not delete the row').toBe(1)
    })

    it('rejects a malformed payload from an admin caller with 400', async () => {
      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminAccessToken}` },
        body: JSON.stringify({ domain_id: 'not-a-uuid' }),
      })
      expect(res.status).toBe(400)

      const row = await admin.from('organization_domains').select('id').eq('id', malformedTestDomainId)
      expect(row.data?.length).toBe(1)
    })

    it('platform admin unclaims the domain -> organization_domains row deleted', async () => {
      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminAccessToken}` },
        body: JSON.stringify({ domain_id: domainId }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)

      const row = await admin.from('organization_domains').select('id').eq('id', domainId)
      expect(row.data?.length, 'a successful admin unclaim must delete the row').toBe(0)
    })
  },
)
