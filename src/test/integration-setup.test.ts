import { describe, expect, it } from 'vitest'

import {
  assertDedicatedTestProject,
  resolveIntegrationTestEnvironment,
} from '@/test/integration-setup'

const TEST_PROJECT_URL = 'https://swjzxiddcrtaqixsfaac.supabase.co'

describe('integration test environment boundary', () => {
  it('disables integration clients when any dedicated-test credential is missing', () => {
    expect(resolveIntegrationTestEnvironment({})).toBeNull()
    expect(resolveIntegrationTestEnvironment({
      VITE_SUPABASE_TEST_URL: TEST_PROJECT_URL,
      VITE_SUPABASE_TEST_ANON_KEY: 'anon-test-key',
    })).toBeNull()
    expect(resolveIntegrationTestEnvironment({
      VITE_SUPABASE_TEST_URL: TEST_PROJECT_URL,
      SUPABASE_TEST_SERVICE_ROLE_KEY: 'service-test-key',
    })).toBeNull()
  })

  it('rejects the production project before client construction', () => {
    expect(() => assertDedicatedTestProject(
      'https://vltmrnjsubfzrgrtdqey.supabase.co',
    )).toThrowError(
      'FATAL: integration tests cannot target the production Supabase project vltmrnjsubfzrgrtdqey.',
    )
  })

  it('accepts the dedicated test project when all test credentials are present', () => {
    expect(assertDedicatedTestProject(TEST_PROJECT_URL)).toBe(TEST_PROJECT_URL)
    expect(resolveIntegrationTestEnvironment({
      VITE_SUPABASE_TEST_URL: TEST_PROJECT_URL,
      VITE_SUPABASE_TEST_ANON_KEY: 'anon-test-key',
      SUPABASE_TEST_SERVICE_ROLE_KEY: 'service-test-key',
    })).toEqual({
      url: TEST_PROJECT_URL,
      anonKey: 'anon-test-key',
      serviceRoleKey: 'service-test-key',
    })
  })
})
