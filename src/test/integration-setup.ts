import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config as loadDotenv } from 'dotenv'
import { resolve } from 'path'

// Load .env.test first (if present), then .env as fallback. Vitest itself
// only stubs VITE_* values from vitest.config.ts (so unit tests don't hit a
// real DB), so we MUST `override: true` to swap the stub URL for the real
// one when running integration tests.
loadDotenv({ path: resolve(process.cwd(), '.env.test'), override: true })
loadDotenv({ path: resolve(process.cwd(), '.env'), override: true })

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

/** True if the integration DB is reachable (env vars set). */
export const integrationDbReachable = Boolean(TEST_URL && TEST_SERVICE_KEY)

/**
 * Create a service-role client for integration tests. Bypasses RLS — only use
 * inside integration tests, never inside production code or unit tests.
 */
export function makeIntegrationClient(): SupabaseClient {
  if (!integrationDbReachable) {
    throw new Error(
      'Integration DB not configured — set SUPABASE_TEST_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE_KEY) and VITE_SUPABASE_URL in your .env'
    )
  }
  return createClient(TEST_URL, TEST_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
