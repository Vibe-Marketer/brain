# Testing Patterns

**Analysis Date:** 2026-05-26

## Test Framework

**Runner:**
- **Unit/Integration Testing:** Vitest (`vitest.config.ts`) running in the `jsdom` environment.
- **End-to-End (E2E) Testing:** Playwright (`playwright.config.ts`) running against Chrome (Chromium), Firefox, WebKit, and Edge.

**Assertion Library:**
- **Vitest:** Built-in `expect` extended with `@testing-library/jest-dom` matchers (configured in `src/test/setup.ts`).
- **Playwright:** Built-in web-first assertions (`expect(page).toHaveTitle(...)`).

**Run Commands:**
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

## Test File Organization

**Location:**
- **Unit/Integration tests:** Co-located in `__tests__` directories next to their target source files.
- **Database Integration tests:** Co-located in `__tests__` folders next to services or lib files.
- **E2E tests:** Located in the root `/e2e/` folder.
- **E2E Page Objects:** Kept in `/e2e/pages/`.

**Naming:**
- Unit/Integration: `{filename}.test.ts` or `{filename}.test.tsx`.
- Database Integration: `{filename}.integration.test.ts`.
- E2E tests: `{feature-name}.spec.ts`.
- E2E Page Objects: `{name}.page.ts` (e.g., `login.page.ts`).

**Structure:**
```
src/
  services/
    folders.service.ts
    __tests__/
      folders.integration.test.ts
  stores/
    panelStore.ts
    __tests__/
      panelStore.test.ts
e2e/
  auth-flows.spec.ts
  pages/
    login.page.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { myMethod } from '../my-service';

describe('ModuleName', () => {
  describe('myMethod', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should perform expected action', async () => {
      // Arrange
      const input = 'test-data';

      // Act
      const result = await myMethod(input);

      // Assert
      expect(result).toBe('expected-output');
    });
  });
});
```

**Patterns:**
- Reset/clear mocks using `beforeEach` with `vi.clearAllMocks()` or `clearMocks: true` in `vitest.config.ts`.
- Use explicit Arrange / Act / Assert comments for test readability in complex scenarios.

## Mocking

**Framework:**
- Vitest built-in mocking utilities (`vi`).
- Module-level mocking at the top of the test file.

**Patterns:**
```typescript
import { vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));
```

**What to Mock:**
- External services and OAuth provider integrations.
- Network boundaries and Deno Edge Function triggers during client testing.
- Global browser/system state (mocked in `src/test/setup.ts` like `localStorage`).

**What NOT to Mock:**
- Pure functions, helper modules, and database clients in database integration tests. Mocks are explicitly avoided in integration tests to prevent false positives.

## Fixtures and Factories

**Test Data:**
```typescript
// Shared utility helper from integration-setup.ts
import { makeIntegrationClient } from '@/test/integration-setup';

// Fixture seeding in beforeAll / Cleanup in afterAll
beforeAll(async () => {
  await db.from('folders').insert({ ...testFolderFixture });
});

afterAll(async () => {
  await db.from('folders').delete().eq('id', folderId);
});
```

**Location:**
- Seeding helpers and database client initializers live in `src/test/integration-setup.ts`.
- Mock JSON data and constants live inside the corresponding test files or dedicated fixtures folder.

## Coverage

**Requirements:**
- Coverage tracked for awareness; c8/v8 engine used.
- Exclusions: `*.test.ts`, configuration files, build paths, and local CLI scripts.

**Configuration:**
- Defined in the `coverage` block of `vitest.config.ts` targeting `src/**/*.{ts,tsx}`.

**View Coverage:**
```bash
npm run test:coverage
# Open coverage/index.html to view interactive HTML report
```

## Test Types

**Unit Tests:**
- Test individual functions or store transitions in isolation.
- Fast: running in < 50ms per test file.

**Integration Tests:**
- Tests interacting with a live Supabase database via the service-role client (RLS bypassed) to verify schema compatibilities.
- Skip safely if DB keys are missing: `describe.skipIf(!integrationDbReachable)`.
- Cleanup mandatory in `afterAll` so test suite is idempotent.

**E2E Tests:**
- Verify user-flows, z-indexes, overlay interactions, and visual accessibility.
- Authenticate once in `e2e/auth.setup.ts` using credentials `CALLVAULTAI_LOGIN` and `CALLVAULTAI_LOGIN_PASSWORD` and persist storage state to `playwright/.auth/user.json`.
- Subsequent tests consume user auth session automatically.

## Common Patterns

**Async Testing:**
```typescript
it('should handle async flow', async () => {
  const result = await asyncCall();
  expect(result).toEqual(expected);
});
```

**Error Testing:**
```typescript
it('should reject with validation error', async () => {
  await expect(invalidCall()).rejects.toThrow('Validation failed');
});
```

**Snapshot Testing:**
- Avoid snapshot testing; prefer explicit, descriptive semantic assertions on selectors/content.

---

*Testing analysis: 2026-05-26*
*Update when test patterns change*
