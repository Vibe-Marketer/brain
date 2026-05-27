---
last_mapped_commit: 5e223262c0f2cbc3f24c166d5ea56c793cbb6574
last_mapped_at: 2026-05-27
---

# Testing Patterns

**Analysis Date:** 2026-05-27

## Test Framework

**Runner:**
- Vitest 4 for unit/component/integration-style tests.
- Playwright 1.57 for browser E2E and API smoke tests.
- k6 for load testing via `load-tests/callvault.k6.js`.

**Config:**
- `vitest.config.ts` uses jsdom, `src/test/setup.ts`, globals, V8 coverage, and safe Supabase test env defaults.
- `playwright.config.ts` defines `api`, `setup`, `chromium`, `firefox`, `webkit`, and `edge` projects.
- CI config lives in `.github/workflows/ci.yml`.

**Assertion Library:**
- Vitest `expect`.
- Testing Library React and `@testing-library/jest-dom` for component assertions.
- Playwright `expect` for E2E/API checks.

## Run Commands

```bash
npm run test
npm run test:watch
npm run test:coverage
npm run test:e2e
npm run test:e2e:headed
npm run lint
npm run type-check
npm run verify:connectors:live
```

**Single-file examples:**

```bash
npx vitest run src/lib/__tests__/connector-capabilities.test.ts
npx vitest run src/services/__tests__/recordings.service.test.ts
npx playwright test e2e/mcp-server.spec.ts --project=api
```

## Test File Organization

**Unit and Component Tests:**
- Colocated under `__tests__` directories.
- Examples:
  - `src/lib/__tests__/connector-capabilities.test.ts`
  - `src/components/connectors/__tests__/ConnectorPanel.registry.test.ts`
  - `src/hooks/__tests__/useMcpTokenCapabilities.test.ts`
  - `src/pages/__tests__/OAuthCallback.routing.test.ts`

**Service Tests:**
- `src/services/__tests__/`.
- Some tests are pure unit tests with mocked Supabase calls.
- Some are live/integration tests gated by environment availability.

**Edge Function Tests:**
- `supabase/functions/**/__tests__/*.test.ts`.
- Included by `vitest.config.ts`.

**E2E Tests:**
- `e2e/*.spec.ts`.
- Page objects in `e2e/pages/`.
- Fixtures in `e2e/fixtures/`.
- Screenshots under `e2e/screenshots/`.

## Test Structure

**Vitest Pattern:**

```typescript
describe('feature or module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles the expected behavior', async () => {
    // arrange
    // act
    // assert
  });
});
```

**Component Pattern:**
- Render with Testing Library.
- Use `screen`, `within`, and `userEvent`.
- Mock hooks/services at module boundary when testing component behavior.

**Store Pattern:**
- Reset Zustand state in `beforeEach`.
- Use `act()` around store mutations, as in `src/stores/__tests__/panelStore.test.ts`.

**Integration Pattern:**
- Live DB tests use service-role clients and cleanup in dependency order.
- Some suites use `describe.skipIf(!integrationDbReachable)`.
- Test files document incident/bug context when they protect a regression.

## Mocking

**Framework:**
- Vitest `vi.mock`, `vi.fn`, `vi.mocked`, and lifecycle helpers.

**What to Mock:**
- Supabase client calls for frontend services/hooks unless the test is explicitly live.
- React Router/navigation for route tests.
- Provider/API calls in connector unit tests.
- Browser APIs where jsdom lacks runtime support.

**What Not to Mock:**
- Pure utilities in `src/lib/` unless isolating a caller.
- Registry metadata/capability functions when the goal is parity across all connectors.
- RLS or real DB behavior in tests that explicitly claim live verification.

## Coverage

**Configuration:**
- V8 provider.
- Coverage includes `src/**/*.{ts,tsx}`.
- Excludes tests and `src/test/**`.
- CI uploads coverage artifacts.

**Enforcement:**
- CI runs `npm run test:coverage -- --reporter=verbose`.
- No explicit coverage percentage threshold was identified.

## Test Types

**Unit Tests:**
- Scope: Pure utilities, registry behavior, adapter metadata, services with mocked Supabase.
- Speed: Should run in Vitest without external network.
- Examples: `src/lib/__tests__/source-labels.registry.test.ts`, `src/components/connectors/registry/__tests__/connectorRegistry.test.ts`.

**Component Tests:**
- Scope: UI rendering, interaction, routing, connector cards, dialogs, setup flows.
- Tools: Testing Library with jsdom.
- Examples: `src/components/connectors/primitives/__tests__/ConnectorCard.test.tsx`.

**Integration Tests:**
- Scope: Real Supabase behavior, RLS regressions, migration invariants, service paths.
- Tools: Vitest plus service-role/test env vars.
- Examples: `src/test/rls-regression.test.ts`, `src/services/__tests__/folders.integration.test.ts`.

**E2E Tests:**
- Scope: Authenticated app flows, import page, call detail, org isolation, routing rules, MCP API.
- Tools: Playwright.
- `auth.setup.ts` creates authenticated storage state for browser projects.
- API project runs `e2e/mcp-server.spec.ts` without browser auth.

**Load Tests:**
- `load-tests/callvault.k6.js` for performance/load scenarios.

## CI Test Gates

`.github/workflows/ci.yml` runs:
- `npm run lint`
- `npm run type-check`
- `npm audit --omit=dev --audit-level=high`
- `npm run test:coverage`
- Conditional Playwright API smoke tests when Supabase secrets are configured.
- Conditional RLS regression tests with secret validation.

## Common Gotchas

- `src/integrations/supabase/client.ts` throws without Vite Supabase env vars; Vitest stubs them in config.
- Playwright browser tests start the dev server on port `3001` unless `BASE_URL` is set.
- API-only Playwright runs skip the local web server when `PLAYWRIGHT_PROJECT=api`.
- Integration tests may hit live Supabase and must clean up their own fixtures.
- Edge Function tests run in a Node/Vitest context, so Deno-specific APIs may need mocks or file-level invariant testing.

---
*Testing analysis: 2026-05-27*
*Update when test framework, CI gates, or live verification requirements change*
