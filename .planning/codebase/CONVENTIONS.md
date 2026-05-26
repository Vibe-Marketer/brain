# Coding Conventions

**Analysis Date:** 2026-05-26

## Naming Patterns

Preserve naming conventions across the frontend and backend. Refer to `docs/architecture/api-naming-conventions.md` for the comprehensive list.

**Files:**
- **React Components:** PascalCase with `.tsx` extension. Use descriptive names. Example: `src/components/connectors/ConnectorCard.tsx`, `src/components/Layout.tsx`.
- **UI Primitives (shadcn):** kebab-case. Example: `src/components/ui/alert-dialog.tsx`.
- **Services:** kebab-case with `.service.ts` extension. Example: `src/services/folders.service.ts`.
- **Hooks:** camelCase with `use` prefix. Example: `src/hooks/useFolders.ts`.
- **Stores:** camelCase with `Store` suffix. Example: `src/stores/panelStore.ts`.
- **Utilities/Libraries:** kebab-case or camelCase. Example: `src/lib/api-client.ts`, `src/lib/recording-ids.ts`.
- **Tests:** Same name as the target file with `.test.ts` or `.test.tsx` (for unit tests) or `.integration.test.ts` (for integration tests). Example: `src/hooks/__tests__/useFolders.test.ts`.

**Functions:**
- **JavaScript/TypeScript Functions:** camelCase. Example: `fetchMeetings`, `completeFathomOAuth`.
- **React Hook Functions:** camelCase with `use` prefix. Example: `useMeetingsSync`.
- **Internal Functions:** camelCase. Example: `processMeetingWebhook`.

**Variables:**
- **General Variables:** camelCase. Example: `syncProgress`, `activeWorkspaceId`.
- **Booleans:** Prefix with `is`, `has`, or `should`. Example: `isLoading`, `isSyncing`.
- **Constant Variables:** UPPER_SNAKE_CASE. Example: `CROSS_ORG_TABLES`.

**Types and Interfaces:**
- **Types/Interfaces:** PascalCase. Example: `Meeting`, `ApiResponse`.
- **Database Fields:** snake_case. Example: `recording_id`, `created_at`.
- **JavaScript Object Properties:** camelCase. Example: `totalCalls`, `participationRate`.

## Code Style

**Formatting:**
- Indentation: 2 spaces.
- Trailing commas: Used for git diff friendliness.

**Linting:**
- **Tool:** ESLint configuration via `eslint.config.js`.
- **Allowed Plugins:** `typescript-eslint`, `react-hooks`, `react-refresh`.
- **Rules:**
  - `@typescript-eslint/no-unused-vars`: Warning, ignoring variables starting with `_`.
  - `@typescript-eslint/no-explicit-any`: Warning. Minimize the use of `any`.
  - `@typescript-eslint/ban-ts-comment`: Warning. Avoid bypassing TypeScript compiler checks.
  - `react-refresh/only-export-components`: Warning.

## Import Organization

**Path Aliases:**
- Use `@/*` to map to the `./src/*` directory. Never use relative imports like `../../components/Layout`.
- Use `@shared/*` to map to `./supabase/functions/_shared/*`.

**Import Order:**
1. React core (`react`, `react-router-dom`)
2. External libraries (`zustand`, `@remixicon/react`, `@tanstack/react-query`)
3. Components (`@/components/*`)
4. Hooks (`@/hooks/*`)
5. Stores (`@/stores/*`)
6. Utilities and services (`@/lib/*`, `@/services/*`)
7. Types (`@/types/*` or `@/integrations/supabase/types.ts`)

**Hard Import Constraints:**
- **Icons:** Use Remix Icons ONLY (`@remixicon/react`). Never use Lucide, FontAwesome, or other libraries.
- **Animations:** Use `motion` from `motion/react`. Never use `framer-motion`.
- **Radix UI:** Import individual package components. Example: `import { Dialog } from '@radix-ui/react-dialog'`.

## Error Handling

**Service Layer:**
- Use the **Result Object Pattern** (matching Supabase structure) instead of throwing errors:
  ```typescript
  return { data: T | null, error: Error | null }
  ```
- Catch exceptions in async calls and log them to `@/lib/logger` before returning the error object.

**Edge Functions:**
- Always wrap handlers in try-catch blocks and return standardized response formats:
  - **Success:** Status `200` with JSON `{ success: true, data }`.
  - **Error:** Appropriate status code (e.g., `400` for inputs, `401` for auth, `500` for exceptions) and JSON `{ error: string }`.

**State Management / UI:**
- Store error strings in the Zustand state (e.g., `itemsError: string | null`) and clear them before starting new operations.
- Display errors gracefully using `sonner` toasts (`toast.error(message)`).
- Wrap pages in `react-error-boundary` to handle rendering-level exceptions.

## Component Patterns

- **Functional Components:** Write functional React components exclusively using named exports.
- **Styling:** Use Tailwind CSS exclusively.
- **Conditional Classnames:** Use the `cn()` utility from `src/lib/utils.ts` to merge class names dynamically.
- **Loading States:** Use `<Skeleton>` components from `src/components/ui/skeleton.tsx` instead of generic spinners.
- **Token System:** Use shadcn/Tailwind semantic tokens (e.g., `text-foreground`, `text-muted-foreground`, `bg-viewport`, `bg-card`, `border-border`, `bg-vibe-orange`). Do not use legacy tokens (`text-ink`, `text-ink-soft`, `bg-hover`, `border-soft`).

## State Management

**Global Client State (Zustand):**
- Use **Zustand v5** for global client states.
- **Double-invocation Syntax:** Always use the locked-in Zustand v5 double-invocation syntax:
  ```typescript
  export const useMyStore = create<MyState>()((set) => ({ ... }))
  ```
- Export selector hooks (e.g., `usePreferencesStore` in `src/stores/preferencesStore.ts`) to prevent unnecessary component re-renders.
- Reset the store state using `act()` inside test suites.

**Server State (TanStack Query):**
- Use TanStack Query hooks for component-level data fetching and mutations (e.g. `useQuery`, `useMutation`).
- Maintain a Query Key Factory: Use query key constants from `src/lib/query-config.ts` (e.g. `queryKeys.folders.list()`) rather than hardcoding string arrays.
- Implement optimistic updates for mutations that affect visible lists or details.

## Database / API

- **Row Level Security (RLS):** All tables MUST have RLS enabled. Write explicit policies in Supabase migrations.
- **Supabase Client:** Import the client from `src/integrations/supabase/client.ts`.
- **JWT Authentication:** Verify authentications inside Edge Functions using the shared helper `authenticateRequest` from `supabase/functions/_shared/auth.ts`.
- **Recording IDs Mapping:** Handle the dual ID system (canonical UUID vs. legacy BIGINT) by routing calls through mapping utilities in `src/lib/recording-ids.ts`.
- **SQL Injection Prevention:** Parameterize all queries using the Supabase PostgREST client rather than interpolating strings.
