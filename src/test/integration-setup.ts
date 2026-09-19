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

const PRODUCTION_PROJECT_REF = 'vltmrnjsubfzrgrtdqey'
const MISSING_CLIENT_ERROR =
  'Integration test client unavailable: set VITE_SUPABASE_TEST_URL, VITE_SUPABASE_TEST_ANON_KEY, and SUPABASE_TEST_SERVICE_ROLE_KEY for the dedicated test project.'

export interface IntegrationTestEnvironment {
  url: string
  anonKey: string
  serviceRoleKey: string
}

type IntegrationEnvironmentSource = Readonly<Record<string, string | undefined>>

/**
 * Validate a Supabase target before any client can be constructed.
 *
 * The production project ref check is deliberately independent of the local
 * production env vars. A missing or incorrect `.env` therefore cannot weaken
 * the hard stop.
 */
export function assertDedicatedTestProject(value: string): string {
  const trimmed = value.trim()
  if (!trimmed || trimmed === 'https://test.supabase.co') {
    throw new Error('FATAL: VITE_SUPABASE_TEST_URL is missing or is not a real Supabase target.')
  }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new Error('FATAL: VITE_SUPABASE_TEST_URL is not a valid URL.')
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
    throw new Error('FATAL: VITE_SUPABASE_TEST_URL is not a valid HTTP(S) Supabase target.')
  }

  if (parsed.hostname.toLowerCase().includes(PRODUCTION_PROJECT_REF)) {
    throw new Error(
      `FATAL: integration tests cannot target the production Supabase project ${PRODUCTION_PROJECT_REF}.`,
    )
  }

  const isHostedProject = /^[a-z0-9-]+\.supabase\.co$/i.test(parsed.hostname)
  const isLocalProject = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)
  if (!isHostedProject && !isLocalProject) {
    throw new Error('FATAL: VITE_SUPABASE_TEST_URL is not a recognized Supabase project URL.')
  }

  return parsed.toString().replace(/\/$/, '')
}

function isRealKey(value: string, placeholder: string): boolean {
  return Boolean(value) && value !== placeholder
}

/** Resolve test-only credentials. Missing credentials disable live suites. */
export function resolveIntegrationTestEnvironment(
  source: IntegrationEnvironmentSource,
): IntegrationTestEnvironment | null {
  const url = source.VITE_SUPABASE_TEST_URL?.trim() ?? ''
  const anonKey = source.VITE_SUPABASE_TEST_ANON_KEY?.trim() ?? ''
  const serviceRoleKey = source.SUPABASE_TEST_SERVICE_ROLE_KEY?.trim() ?? ''

  if (
    !url ||
    !isRealKey(anonKey, 'test-anon-key') ||
    !isRealKey(serviceRoleKey, 'test-service-role-key')
  ) {
    return null
  }

  const guardedUrl = assertDedicatedTestProject(url)
  const appClientUsesTestTarget = source.VITE_INTEGRATION_TEST_TARGET === 'true'
  if (
    source.VITE_SUPABASE_URL &&
    guardedUrl === source.VITE_SUPABASE_URL.replace(/\/$/, '') &&
    !appClientUsesTestTarget
  ) {
    throw new Error(
      'FATAL: VITE_SUPABASE_TEST_URL equals VITE_SUPABASE_URL. Integration tests must run against a separate Supabase test project. See .env.test.example.',
    )
  }
  if (
    source.SUPABASE_SERVICE_ROLE_KEY &&
    serviceRoleKey === source.SUPABASE_SERVICE_ROLE_KEY
  ) {
    throw new Error(
      'FATAL: SUPABASE_TEST_SERVICE_ROLE_KEY equals SUPABASE_SERVICE_ROLE_KEY. Integration tests must run against a separate Supabase test project. See .env.test.example.',
    )
  }

  return { url: guardedUrl, anonKey, serviceRoleKey }
}

const integrationEnvironment = resolveIntegrationTestEnvironment(process.env)

/** True if the integration DB is reachable (test-specific env vars set). */
export const integrationDbReachable =
  integrationEnvironment !== null

function makeUnavailableClient(): SupabaseClient {
  return new Proxy({}, {
    get() {
      throw new Error(MISSING_CLIENT_ERROR)
    },
  }) as SupabaseClient
}

/**
 * Create a service-role client for integration tests. Bypasses RLS — only use
 * inside integration tests, never inside production code or unit tests.
 *
 * Suites that hit DB MUST wrap themselves in
 * `describe.skipIf(!integrationDbReachable)`. During skipped-suite collection,
 * this returns a throwing proxy rather than calling `createClient` with a fake
 * or production-derived target.
 */
export function makeIntegrationClient(): SupabaseClient {
  if (!integrationEnvironment) return makeUnavailableClient()
  const url = assertDedicatedTestProject(integrationEnvironment.url)

  return createClient(url, integrationEnvironment.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/** Create an anonymous client for real RLS and public-function probes. */
export function makeIntegrationAnonClient(): SupabaseClient {
  if (!integrationEnvironment) return makeUnavailableClient()
  const url = assertDedicatedTestProject(integrationEnvironment.url)

  return createClient(url, integrationEnvironment.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/** Test-only fetch configuration for direct Edge Function requests. */
export function getIntegrationTestFetchConfig(): { url: string; anonKey: string } | null {
  if (!integrationEnvironment) return null
  return {
    url: assertDedicatedTestProject(integrationEnvironment.url),
    anonKey: integrationEnvironment.anonKey,
  }
}
