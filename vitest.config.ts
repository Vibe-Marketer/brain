import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

// Integration tests hit a REAL Supabase DB and are gated behind an explicit
// opt-in. Without VITEST_INTEGRATION_OK=true, every *.integration.test.ts
// file is excluded from the run so a stray `npm test` invocation cannot
// accidentally execute against any live DB (let alone prod). See
// supabase/CLAUDE.md → "Running integration tests safely".
const integrationOptIn = process.env.VITEST_INTEGRATION_OK === 'true';
const testEnv = loadEnv('test', process.cwd(), '');
const integrationExcludes = integrationOptIn
  ? []
  : ['**/*.integration.test.ts'];

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [path.resolve(__dirname, './src/test/setup.ts')],
    clearMocks: true,
    env: {
      // Provide stub values so supabase/client.ts doesn't throw during test imports
      VITE_SUPABASE_URL: integrationOptIn
        ? testEnv.VITE_SUPABASE_TEST_URL || testEnv.VITE_SUPABASE_URL || 'https://test.supabase.co'
        : 'https://test.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: integrationOptIn
        ? testEnv.VITE_SUPABASE_PUBLISHABLE_KEY || testEnv.SUPABASE_ANON_KEY || testEnv.SUPABASE_TEST_SERVICE_ROLE_KEY || 'test-anon-key'
        : 'test-anon-key',
      VITE_INTEGRATION_TEST_TARGET: integrationOptIn ? 'true' : 'false',
    },
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.worktrees/**',
      '**/e2e/**',
      'src/lib/__tests__/template-engine.test.ts',
      // Deno-runtime edge-function unit tests (https://deno.land / esm.sh
      // imports + Deno.test) — run via `deno test`, never collectable by
      // Vitest's Node ESM loader. The `.deno.test.ts` suffix is the marker.
      '**/*.deno.test.ts',
      ...integrationExcludes,
    ],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/__tests__/*.test.ts', 'supabase/functions/**/__tests__/*.test.ts', 'cloudflare/**/__tests__/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './supabase/functions/_shared'),
      // Test-time-only resolution for dedup-fingerprint.ts's runtime (non-type-only)
      // esm.sh import. The Deno edge function still resolves this exact pinned URL
      // at deploy time, unchanged -- this alias only lets Vitest's Node ESM loader
      // (which cannot load `https:` URLs) collect the module's otherwise-untestable
      // pure functions. Phase 32 Plan 01 Task 1 (MATCH-04 / F5 test coverage).
      'https://esm.sh/fastest-levenshtein@1.0.16': 'fastest-levenshtein',
    },
  },
});
