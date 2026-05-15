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
 * Path A (live test project — default): reads `VITE_SUPABASE_TEST_URL`
 * (falls back to `VITE_SUPABASE_URL`) and the SERVICE_ROLE key from
 * `SUPABASE_TEST_SERVICE_ROLE_KEY` (falls back to `SUPABASE_SERVICE_ROLE_KEY`).
 * Tests that hit DB MUST be wrapped in `describe.skipIf(!integrationDbReachable)`
 * so CI/contributors without the key see clean skips, not failures.
 *
 * See `.env.test.example` for setup. See `supabase/CLAUDE.md` →
 * "Running integration tests" for the contributor flow.
 */

const TEST_URL =
  process.env.VITE_SUPABASE_TEST_URL ||
  process.env.VITE_SUPABASE_URL ||
  ''

const TEST_SERVICE_KEY =
  process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  ''

function isRealSupabaseUrl(value: string): boolean {
  return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(value) &&
    value !== 'https://test.supabase.co'
}

function isRealServiceKey(value: string): boolean {
  return Boolean(value) && value !== 'test-service-role-key'
}

/** True if the integration DB is reachable (env vars set). */
export const integrationDbReachable =
  isRealSupabaseUrl(TEST_URL) && isRealServiceKey(TEST_SERVICE_KEY)

/**
 * Create a service-role client for integration tests. Bypasses RLS — only use
 * inside integration tests, never inside production code or unit tests.
 */
export function makeIntegrationClient(): SupabaseClient {
  const url = integrationDbReachable ? TEST_URL : 'https://test.supabase.co'
  const serviceKey = integrationDbReachable ? TEST_SERVICE_KEY : 'test-service-role-key'

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
