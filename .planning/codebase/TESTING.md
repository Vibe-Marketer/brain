# Testing Patterns

**Analysis Date:** 2026-05-27

## Test Framework

**Runner:**
- Vitest 4.x
- Config: `vitest.config.ts`
- Environment: `jsdom` (browser simulation for React component tests)
- Globals: enabled (`globals: true`)

**Assertion Library:**
- Vitest built-in (`expect`, `it`, `describe`)
- `@testing-library/jest-dom` matchers extended via `src/test/setup.ts` — enables `toBeInTheDocument()`, `toHaveValue()`, etc.

**Testing Library:**
- `@testing-library/react` v16 — `renderHook`, `waitFor`, `act`
- `@testing-library/user-event` v14 — user interaction simulation

**Run Commands:**
```bash
npm test                    # Run all tests (vitest run — non-watch)
npm run test:watch          # Watch mode (vitest)
npm run test:ui             # Vitest UI browser interface
npm run test:coverage       # Run with v8 coverage report
npm run test:e2e            # Playwright E2E tests
```

## Test File Organization

**Location patterns:**
- Unit/integration tests co-located with source in `__tests__/` subdirectory
- One-off special test files at `src/test/` (RLS regression, integration setup, RPC smoke)
- Migration-specific tests at `src/test/migrations/`
- Edge Function tests at `supabase/functions/<function-name>/__tests__/`
- Shared utility tests at `supabase/functions/_shared/__tests__/`

**Naming:**
- Unit tests: `*.test.ts` or `*.test.tsx`
- Integration tests (real DB): `*.integration.test.ts`
- Regression tests: `*.regression.test.ts`
- Performance benchmarks: `*.p95.integration.test.ts`
- Registry/conformance tests: `*.registry.test.ts`

**Directory structure:**
```
src/
  test/
    setup.ts                          # Global test setup (jest-dom, Deno shim, localStorage mock)
    integration-setup.ts              # makeIntegrationClient(), integrationDbReachable
    rls-regression.test.ts            # SEC-04C cross-org RLS isolation test
    rpc-type-smoke.test.ts            # RPC type smoke test
    migrations/
      phase25-default-workspace-protection.test.ts
      phase25-workspace-type-retirement.test.ts
      phase39-fathom-reconcile-cron.integration.test.ts
      phase39-fathom-mirror-schema.integration.test.ts
      phase40-fathom-refresh.integration.test.ts
  hooks/
    __tests__/
      useFolders.test.ts
      useGlobalSearch.p95.integration.test.ts
      useSharing.test.ts
      useBulkApplyRules.test.ts
      useWorkspaceMutations.workspaceOrder.test.ts
      useWorkspaceReorder.test.ts
      useTeamHierarchy.test.ts
      useKeyboardShortcut.test.ts
      useAllTranscriptsSettings.test.ts
      useMcpTokenCapabilities.test.ts
      useImportSources.registry.test.ts
  services/
    __tests__/
      folders.integration.test.ts     # BUG-01 — real DB, no mocks
      recordings.service.test.ts
      tags.service.test.ts
      data-movement.service.test.ts
      organizations.service.test.ts
      mcp-token-capabilities.service.test.ts
      raw-calls.registry.test.ts
      import-sources.retry.test.ts
      setDefaultWorkspace.integration.test.ts
  stores/
    __tests__/
      panelStore.test.ts
      searchStore.test.ts
  lib/
    __tests__/
      filter-utils.test.ts
      connector-availability.test.ts
      connector-capabilities.test.ts
      import-source-flow.test.ts
      source-labels.registry.test.ts
      invalidateCallListCaches.realDb.test.ts   # BUG-03 — real DB
  __tests__/
    App.oauth-routing.test.ts
  types/
    __tests__/
      search-source-platform.test.ts
      meeting-source-platform.test.ts

supabase/functions/
  _shared/__tests__/
    vtt-parser.test.ts
    fathom-transcript-parser.test.ts
    canonical-recording.test.ts
    grain-connector.test.ts
    grain-source.test.ts
    read-ai-connector.test.ts
    read-ai-source.test.ts
    fireflies-connector.test.ts
    plaud-connector.test.ts
    connector-function-utils.test.ts
    track-ai-usage-inline.test.ts
  fetch-meetings/__tests__/rate-limit.test.ts
  global-search/__tests__/global-search.test.ts
  fathom-oauth-callback/__tests__/oauth-callback-backfill.test.ts
  fathom-refresh/__tests__/fathom-refresh.test.ts
  grain-sync-recordings/__tests__/grain-sync-recordings.test.ts
  grain-disconnect/__tests__/grain-disconnect.test.ts
  grain-oauth-url/__tests__/grain-oauth-url.test.ts
  share-call/__tests__/share-call.integration.test.ts
  polar-create-customer/__tests__/polar-create-customer.regression.test.ts
  read-ai-connect-token/__tests__/read-ai-connect-token.test.ts
```

**Vitest include/exclude:**
```typescript
include: ['src/**/*.test.{ts,tsx}', 'supabase/functions/**/__tests__/*.test.ts']
exclude: ['**/node_modules/**', '**/dist/**', '**/.worktrees/**', '**/e2e/**',
          'src/lib/__tests__/template-engine.test.ts']  // intentionally excluded
```

## Test Setup

**Global setup file:** `src/test/setup.ts`

What it does:
1. Installs jest-dom matchers: `expect.extend(matchers)`
2. Shims the `Deno` global so Edge Function shared modules (`_shared/*.ts`) can be imported in jsdom without `ReferenceError` — falls back to `process.env`
3. Mocks `localStorage` for Supabase auth flows
4. Calls `cleanup()` and clears localStorage `afterEach`

```typescript
// Deno shim (allows importing supabase/functions/_shared/* in Vitest)
if (!globalThis.Deno) {
  globalThis.Deno = { env: { get: (key) => process.env[key] } };
}
```

**Env stubs in vitest.config.ts** (prevent Supabase client init errors during imports):
```typescript
env: {
  VITE_SUPABASE_URL: 'https://test.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'test-anon-key',
}
```

## Test Structure

**Standard unit test suite:**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ComponentOrFunction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('specificBehavior', () => {
    it('should do the expected thing', () => {
      // arrange
      // act
      // assert
      expect(result).toBe(expected);
    });
  });
});
```

**Hook test with QueryClient wrapper:**
```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

const { result } = renderHook(() => useMyHook(), { wrapper: createWrapper() });
await waitFor(() => expect(result.current.data).toBeDefined());
```

**Zustand store test:**
```typescript
import { act } from '@testing-library/react';
import { useMyStore } from '../myStore';

beforeEach(() => {
  act(() => {
    useMyStore.setState({ /* reset to defaults */ });
  });
});

it('should update state', () => {
  const { doAction } = useMyStore.getState();
  act(() => { doAction(); });
  expect(useMyStore.getState().someField).toBe(expected);
});
```

## Mocking

**Framework:** Vitest's built-in `vi.mock`, `vi.fn`, `vi.hoisted`

**Standard Supabase client mock pattern:**
```typescript
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getUser: vi.fn() },
    rpc: vi.fn(),
  },
}));
```

**Chainable query builder mock (reusable helper pattern):**
```typescript
function makeChain(result: { data?: unknown; error?: unknown; count?: number | null }) {
  const resolved = { data: null, error: null, count: null, ...result };
  const chain: Record<string, unknown> = {};
  const chainMethods = ['select', 'insert', 'update', 'delete', 'upsert',
                        'eq', 'in', 'or', 'order', 'not', 'is'] as const;
  for (const method of chainMethods) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }
  chain.single = vi.fn().mockResolvedValue(resolved);
  chain.maybeSingle = vi.fn().mockResolvedValue(resolved);
  chain.then = (resolve) => Promise.resolve(resolved).then(resolve);
  chain.catch = (reject) => Promise.resolve(resolved).catch(reject);
  return chain as unknown as ReturnType<typeof supabase.from>;
}
```

**`vi.hoisted` for mocks that must be hoisted before imports:**
```typescript
const mocks = vi.hoisted(() => ({
  authGetUser: vi.fn(),
  recordingsSelect: vi.fn(),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { getUser: mocks.authGetUser }, from: (table) => ({ select: mocks.recordingsSelect }) }
}));
```

**Common mocked modules:**
- `@/integrations/supabase/client` — Supabase client
- `@/contexts/AuthContext` — `useAuth` returns `{ user: { id: 'test-user-id' }, session: ... }`
- `@/stores/orgContextStore` — `useOrgContextStore` returns test workspace/org IDs
- `@/lib/logger` — silences all `logger.*` calls
- `sonner` — `toast.success`, `toast.error`, `toast.info` as `vi.fn()`

**What to mock:**
- `@/integrations/supabase/client` in unit tests
- External SDKs (Polar, Grain, Fathom clients) in Edge Function unit tests
- Context providers and stores not under test

**What NOT to mock (BUG-01 / Phase 30 rule):**
- The database for the `save-pasted-transcript` path and UUID/BIGINT boundary tests
- Any test where the purpose is to verify the real Supabase query shape executes correctly
- The RLS regression test (`src/test/rls-regression.test.ts`) — must hit real JWTs and real DB

## Integration Tests (Real Supabase DB)

**Skip gate — always wrap DB-touching suites:**
```typescript
import { integrationDbReachable, makeIntegrationClient } from '@/test/integration-setup';

describe.skipIf(!integrationDbReachable)('suite name', () => {
  const db = makeIntegrationClient(); // service-role — bypasses RLS
  // ...
});
```

**Environment setup:**
- Copy `.env.test.example` → `.env.test`
- Set `SUPABASE_TEST_SERVICE_ROLE_KEY` (or fallback `SUPABASE_SERVICE_ROLE_KEY`)
- `integration-setup.ts` loads `.env.test` then `.env` via `dotenv`
- Tests that need user-scoped JWTs (not service-role) call `supabase.auth.signInWithPassword`

**Fixture cleanup requirement:**
Tests MUST clean up their own fixtures in `afterAll` so the suite is idempotent (re-runnable):
```typescript
afterAll(async () => {
  await db.from('recordings').delete().eq('source_call_id', `${SEED_PREFIX}%`);
});
```

**Donor pattern (common):**
Rather than creating full auth users + orgs, integration tests borrow an existing org + user from `recordings` via the service-role client:
```typescript
const donor = await db.from('recordings')
  .select('organization_id, owner_user_id')
  .eq('source_app', 'fathom')
  .limit(1)
  .maybeSingle();
```

## Static Analysis ("Source-Level") Tests

Some tests assert properties of source files rather than running code — used to pin architectural invariants and hard constraints (FOUND-09, auth contract, etc.):

```typescript
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = readFileSync(resolve(process.cwd(), 'supabase/functions/global-search/index.ts'), 'utf8');

it('does not include google_meet in VALID_SOURCE_APPS', () => {
  const match = src.match(/const VALID_SOURCE_APPS = \[([^\]]+)\]/);
  expect(match?.[1]).not.toMatch(/['"]google.?meet['"]/i);
});
```

Used in: `src/test/migrations/phase25-*.test.ts`, `supabase/functions/global-search/__tests__/global-search.test.ts`, `supabase/functions/polar-create-customer/__tests__/polar-create-customer.regression.test.ts`

## RLS Regression Test

**Location:** `src/test/rls-regression.test.ts`
**Phase:** 38 (SEC-04C)

Creates 2 orgs, 2 users, 1 workspace + folder + recording per org via service-role. Signs in each user with `signInWithPassword`. Queries every table in `CROSS_ORG_TABLES` from each user's JWT and asserts the other org's rows return 0 rows.

**Adding a new user-facing table:** append to `CROSS_ORG_TABLES` in `src/test/rls-regression.test.ts`:
```typescript
const CROSS_ORG_TABLES = [
  { table: 'recordings', filterColumn: 'organization_id' },
  // ...
  { table: 'your_new_table', filterColumn: 'organization_id' }, // add here
];
```

**On failure:** message format is `RLS LEAK: table=<name> filter=<col>=<value>`. Fix the RLS policy in a new migration; rerun locally with `npx vitest run src/test/rls-regression.test.ts`.

**CI gate:** `.github/workflows/ci.yml` job `rls-regression`. Runs only when `vars.SUPABASE_SECRETS_CONFIGURED == 'true'`. A `RLS LEAK:` assertion failure fails the build.

## E2E Tests

**Framework:** Playwright (`@playwright/test`) + `@axe-core/playwright` for accessibility
**Config:** `playwright.config.ts` (not shown)
**Location:** `e2e/` directory (excluded from Vitest runs)
**Commands:**
```bash
npm run test:e2e           # Headless
npm run test:e2e:ui        # Playwright UI
npm run test:e2e:headed    # Headed (visible browser)
```

## Coverage

**Provider:** `@vitest/coverage-v8`

**View coverage:**
```bash
npm run test:coverage
```

**Configuration:**
```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html'],
  include: ['src/**/*.{ts,tsx}'],
  exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**'],
}
```

**Requirements:** No enforced coverage percentage threshold. Coverage is used for visibility, not as a merge gate.

## Async Testing

```typescript
// With @testing-library/react hooks
const { result } = renderHook(() => useMyHook(), { wrapper: createWrapper() });
await waitFor(() => expect(result.current.isLoading).toBe(false));
expect(result.current.data).toEqual(expected);

// With Vitest directly
it('should resolve async', async () => {
  const result = await someAsyncFunction();
  expect(result).toBeDefined();
});
```

## Error Testing

```typescript
it('returns error state on DB failure', async () => {
  mockSupabase.from.mockReturnValue(
    makeChain({ data: null, error: { message: 'DB error' } })
  );
  const { result } = renderHook(() => useMyHook(), { wrapper: createWrapper() });
  await waitFor(() => expect(result.current.error).toBeTruthy());
});
```

---

*Testing analysis: 2026-05-27*
