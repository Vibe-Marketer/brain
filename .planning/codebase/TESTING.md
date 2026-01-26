# Testing Patterns

**Analysis Date:** 2026-01-26

## Test Framework

**Runners:**
- **Unit/Integration:** Vitest (`vitest.config.ts`)
- **E2E:** Playwright (`playwright.config.ts`)

**Assertion Library:**
- Vitest `expect` extended with `@testing-library/jest-dom` matchers.

**Run Commands:**
```bash
npm run test           # Run unit tests
npm run test:watch     # Watch mode
npm run test:coverage  # Run with coverage
npm run test:e2e       # Run E2E tests
```

## Test File Organization

**Location:**
- Co-located `__tests__` directories (e.g., `src/stores/__tests__/`).
- Files named `*.test.ts` or `*.test.tsx`.

**E2E Location:**
- `e2e/` directory at root.

## Unit/Integration Testing Patterns

**Structure:**
- `describe` blocks for grouping (by function/module).
- `it` blocks for scenarios.
- `beforeEach` for resetting state/mocks.

**Setup:**
- `src/test/setup.ts`: Configures `jest-dom` matchers and cleanup.

**Mocking:**
- **Tool:** `vi.mock()` (Vitest).
- **Pattern:** Mock external modules at the top of the file.
- **Example:**
  ```typescript
  vi.mock('@/lib/content-library', () => ({
    fetchContentItems: vi.fn(),
  }));
  ```
- **Resets:** `vi.clearAllMocks()` in `beforeEach`.

**State Management Testing (Zustand):**
- Test the store directly (not via components).
- Reset store state between tests (`useStore.getState().reset()`).
- Use `act()` when calling store actions to ensure updates flush.
- Test optimistic updates:
  1. Trigger action.
  2. Verify optimistic state change.
  3. Verify rollback on error OR confirmation on success.

**Component Testing:**
- Library: `@testing-library/react`.
- Render components and interact like a user.
- *Note:* Component tests seen in `src/components/__tests__` (inferred structure).

## Coverage

**Configuration:**
- Provider: v8
- Reporters: text, json, html
- Includes: `src/**/*.{ts,tsx}`
- Excludes: Tests, setup files.

## E2E Testing Patterns

**Framework:** Playwright
**Browsers:** Chromium, Firefox, WebKit, Edge.
**Base URL:** `http://localhost:8080`
**Artifacts:** Screenshots on failure, traces on first retry.

---

*Testing analysis: 2026-01-26*
