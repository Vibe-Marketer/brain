import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config as loadDotenv } from 'dotenv'
import { resolve } from 'path'

// Load .env.test first (if present), then .env as fallback when integration
// tests are intentionally enabled. Unit-test CI can disable this so live DB
// tests remain skipped even if a runner has local dotenv files.
if (process.env.VITEST_LOAD_INTEGRATION_ENV !== 'false') {
  loadDotenv({ path: resolve(process.cwd(), '.env.test'), override: true })
  loadDotenv({ path: resolve(process.cwd(), '.env'), override: true })
}

/**
 * Integration test client + skip helper.
 *
 * **HARD REQUIREMENT (post data-incident, 2026-05):** integration tests MUST
 * run against a SEPARATE Supabase test project, never the production project.
 *
 * Before this guard, the helper fell back from `VITE_SUPABASE_TEST_URL` to
 * `VITE_SUPABASE_URL` (and from `SUPABASE_TEST_SERVICE_ROLE_KEY` to
 * `SUPABASE_SERVICE_ROLE_KEY`) when the *_TEST_* vars were unset. Result:
 * tests silently ran against prod, renamed real workspace rows, and never
 * restored them (`[phase-36-01 integration] do-not-touch A/B`, `Home A`,
 * `Home B` left orphaned in prod).
 *
 * The fallback is removed. The TEST vars are read directly, with NO fallback
 * to the prod vars. Equality with the prod URL/key is a fatal error. If the
 * test vars are unset, `integrationDbReachable` is false and the integration
 * suites cleanly `describe.skipIf` out.
 *
 * See `.env.test.example` for the contract. See `supabase/CLAUDE.md` →
 * "Running integration tests safely" for setup.
 */

const TEST_URL = process.env.VITE_SUPABASE_TEST_URL || ''
const TEST_SERVICE_KEY = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY || ''

const PROD_URL = process.env.VITE_SUPABASE_URL || ''
const PROD_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// HARD GUARD: refuse to run if the test URL or service key matches prod.
// Throw at module-load time so the runner cannot even import this helper
// against a misconfigured environment. The message must be loud and
// actionable — operator should be able to fix the config in 30 seconds.
if (TEST_URL && PROD_URL && TEST_URL === PROD_URL) {
  throw new Error(
    'FATAL: VITE_SUPABASE_TEST_URL equals VITE_SUPABASE_URL. Integration tests must run against a separate Supabase test project. See .env.test.example.',
  )
}
if (TEST_SERVICE_KEY && PROD_SERVICE_KEY && TEST_SERVICE_KEY === PROD_SERVICE_KEY) {
  throw new Error(
    'FATAL: SUPABASE_TEST_SERVICE_ROLE_KEY equals SUPABASE_SERVICE_ROLE_KEY. Integration tests must run against a separate Supabase test project. See .env.test.example.',
  )
}

function isRealSupabaseUrl(value: string): boolean {
  return /^https?:\/\/[a-z0-9-]+(\.supabase\.co|:\d+)$/i.test(value) &&
    value !== 'https://test.supabase.co'
}

function isRealServiceKey(value: string): boolean {
  return Boolean(value) && value !== 'test-service-role-key'
}

/** True if the integration DB is reachable (test-specific env vars set). */
export const integrationDbReachable =
  isRealSupabaseUrl(TEST_URL) && isRealServiceKey(TEST_SERVICE_KEY)

/**
 * Create a service-role client for integration tests. Bypasses RLS — only use
 * inside integration tests, never inside production code or unit tests.
 *
 * Falls back to a non-functional stub URL/key when `integrationDbReachable`
 * is false; suites that hit DB MUST wrap themselves in
 * `describe.skipIf(!integrationDbReachable)` so they never instantiate
 * against the stub at run time.
 */
export function makeIntegrationClient(): SupabaseClient {
  const url = integrationDbReachable ? TEST_URL : 'https://test.supabase.co'
  const serviceKey = integrationDbReachable ? TEST_SERVICE_KEY : 'test-service-role-key'

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
