# Testing Patterns

**Analysis Date:** 2026-05-26

## Test Frameworks

The codebase employs two testing frameworks:
- **Unit/Integration Testing:** Vitest (`vitest.config.ts`) using `jsdom` environment.
- **End-to-End (E2E) Testing:** Playwright (`playwright.config.ts`) running against Chromium, Firefox, WebKit, and Microsoft Edge.

## Test File Organization

- **Unit/Integration Tests:** Co-located in `__tests__` folders next to target code files. Named as `{filename}.test.ts` or `{filename}.test.tsx`.
  - Example: `src/hooks/__tests__/useFolders.test.ts` for hooks, `src/stores/__tests__/panelStore.test.ts` for stores, and `src/services/__tests__/organizations.service.test.ts` for services.
- **Database Integration Tests:** Co-located in `__tests__` folders next to services or lib files, named as `{filename}.integration.test.ts`.
  - Example: `src/services/__tests__/folders.integration.test.ts`.
- **E2E Tests:** Isolated in `/e2e/` folder at the root directory. Named as `{feature-name}.spec.ts`.
  - Example: `e2e/auth-flows.spec.ts`.
- **E2E Page Objects:** Kept in `/e2e/pages/`.
  - Example: `e2e/pages/login.page.ts`.

## Unit/Integration Testing Patterns (Vitest)

### Test Structure & Setup
- Group scenarios using `describe` blocks and define individual test cases with `it` or `test` blocks.
- Configure global setups in `src/test/setup.ts` to extend Vitest's `expect` with `@testing-library/jest-dom` matchers and mock the global `localStorage` object.
- Always clear/reset mocks in `beforeEach` or `afterEach` via `vi.clearAllMocks()` or `clearMocks: true` in `vitest.config.ts`.

### Mocking External Modules
- Use `vi.mock()` at the top of the test file to isolate modules.
  - Example:
    ```typescript
    vi.mock('@/integrations/supabase/client', () => ({
      supabase: {
        from: vi.fn(),
        rpc: vi.fn(),
      },
    }));
    ```

### React Custom Hooks Testing
- Use `renderHook` and `waitFor` from `@testing-library/react`.
- When testing hooks that use TanStack Query, wrap them in a custom `QueryClientProvider`:
  ```typescript
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
  ```

### Zustand Store Testing
- Reset Zustand stores before each test to prevent test cross-contamination:
  ```typescript
  beforeEach(() => {
    act(() => {
      usePanelStore.setState({
        isPanelOpen: false,
        panelType: null,
      });
    });
  });
  ```
- Wrap state modification calls in `act()` from `@testing-library/react` to ensure state updates flush synchronously.

### Database Integration Tests
- Integration tests hit a REAL Supabase database to avoid false positives associated with mocks.
- **Skip Helper:** Skip database integration tests when database environment variables are missing (for contributors/CI without access):
  ```typescript
  import { integrationDbReachable } from '@/test/integration-setup';
  describe.skipIf(!integrationDbReachable)('Database integration tests', () => { ... });
  ```
- **Cleanup Requirement:** Database integration tests MUST delete their seeded fixtures in `afterAll` so that test suite runs remain idempotent.

## RLS Regression Safety Net

The RLS regression suite acts as a safety net ensuring cross-org tenant isolation:
- **Location:** `src/test/rls-regression.test.ts`.
- **Methodology:**
  1. Bootstraps 2 distinct organizations, users, workspaces, and records using the service-role client (`makeIntegrationClient()` in `src/test/integration-setup.ts`).
  2. Authenticates separate anon-key clients for each user using `signInWithPassword`.
  3. Queries all user-facing tables listed in `CROSS_ORG_TABLES` using the authenticated anon-key clients.
  4. Asserts that Org A's client receives exactly `0` rows when querying Org B's records, and vice versa.
- **Failures:** On failure, the assertion message outputs `RLS LEAK: table=<table_name> filter=<column_name>=<value>`.
- **Maintenance:** Append any newly created user-facing table to the `CROSS_ORG_TABLES` array in `src/test/rls-regression.test.ts`.
- **CI Gate:** Run automatically in the GitHub Actions workflows (`.github/workflows/ci.yml`) under the `rls-regression` job.

## E2E Testing Patterns (Playwright)

### Shared Authentication Setup
- Authenticate once before the E2E test runs using `e2e/auth.setup.ts`.
- The setup signs in using credentials `CALLVAULTAI_LOGIN` and `CALLVAULTAI_LOGIN_PASSWORD` and stores the authenticated cookies/origins into `playwright/.auth/user.json`.
- Subsequent E2E tests consume the authenticated state automatically via Playwright project dependencies configured in `playwright.config.ts`:
  ```typescript
  {
    name: 'chromium',
    use: { 
      ...devices['Desktop Chrome'],
      storageState: 'playwright/.auth/user.json',
    },
    dependencies: ['setup'],
  }
  ```

### Page Object Model (POM)
- Encapsulate page-specific locators and assertions within Page Object classes subclassed from `BasePage` in `e2e/pages/base.page.ts`.
- Ensure Page Objects wait for loading transitions and network idle states before returning control.
- Example from `e2e/pages/login.page.ts`:
  ```typescript
  import { BasePage } from './base.page';
  export class LoginPage extends BasePage {
    // page-specific elements and actions
  }
  ```

### Visual and Z-Index Checks
- Verify UI state overlay behaviors using CSS queries and assertions to ensure proper layout structures (e.g. detailed in `e2e/z-index-check.spec.ts`).
- Perform screen reader accessibility audits using `@axe-core/playwright` in accessibility specs (e.g. `e2e/accessibility-audit.spec.ts`).

## Run Commands

Execute tests using the npm scripts configured in `package.json`:

```bash
# Unit/Integration Tests
npm run test            # Run all unit/integration tests once
npm run test:watch      # Run vitest in interactive watch mode
npm run test:ui         # Run vitest with UI dashboard
npm run test:coverage   # Run vitest with coverage reporting

# E2E Tests
npm run test:e2e        # Run Playwright E2E tests headlessly
npm run test:e2e:ui     # Run Playwright E2E tests with the UI dashboard
npm run test:e2e:headed # Run Playwright E2E tests in headed browsers
```
