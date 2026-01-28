# Coding Conventions

**Analysis Date:** 2026-01-26

## Naming Patterns

**Files:**
- Components: PascalCase (e.g., `ThemeSwitcher.tsx`)
- UI Primitives (shadcn): kebab-case (e.g., `alert-dialog.tsx`)
- Logic/Stores/Utils: camelCase (e.g., `contentLibraryStore.ts`, `auth-utils.ts` seems mixed, `authUtils.ts` preferred but `auth-utils.ts` seen in imports)
  - *Correction based on `src/lib/content-library.ts`*: k-ebab-case used for lib files.
- Tests: `*.test.ts` or `*.test.tsx` inside `__tests__` directories.

**Functions:**
- camelCase (e.g., `fetchContentItems`, `saveContent`)
- Hook prefix: `use` (e.g., `useContentLibraryStore`)

**Variables:**
- camelCase (e.g., `isLoading`, `contentItems`)
- Booleans: `is`, `has`, `should` prefix (e.g., `isLoading`)

**Types:**
- PascalCase (e.g., `ContentLibraryItem`, `ContentLibraryState`)
- Interfaces prefixed with `I` are NOT observed (just `ContentLibraryResult`).

## Code Style

**Formatting:**
- Prettier (inferred from package.json and clean formatting)
- Indentation: 2 spaces

**Linting:**
- Tool: ESLint (Flat Config `eslint.config.js`)
- Plugins: `react-hooks`, `typescript-eslint`
- Rules:
  - `no-unused-vars`: Warn (ignore `_` prefix)
  - `react-refresh/only-export-components`: Warn

## Import Organization

**Path Aliases:**
- `@/*` maps to `./src/*`

**Order:**
1. External libraries (`react`, `zustand`, `@remixicon/react`)
2. Internal types (`@/types/*`)
3. Internal utils/hooks/components (`@/lib/*`, `@/components/*`)

## Error Handling

**Service Layer:**
- Return Result Object Pattern (Supabase style):
  ```typescript
  return { data: T | null, error: Error | null }
  ```
- Do not throw errors from services; catch and return error object.
- Use custom error classes (e.g., `ContentLibraryError`).

**Logging:**
- Use `@/lib/logger` instead of `console.log`.

**Stores:**
- Store error strings in state (e.g., `itemsError: string | null`).
- Clear errors before new operations.

## Component Patterns

**Structure:**
- Functional Components used exclusively.
- Named exports preferred (e.g., `export const ThemeSwitcher = ...`).

**Styling:**
- Tailwind CSS via `className`.
- `cn()` utility for conditional class merging.
- `framer-motion` for animations.

**Icons:**
- `@remixicon/react` (e.g., `RiSunLine`).

## State Management

**Global Client State:**
- **Zustand**
- Pattern: Create store with types `State & Actions`.
- Use `create<...>()`
- Export selector hooks (e.g., `useContentItems`) to avoid unnecessary re-renders.
- Support optimistic updates (update state immediately, rollback on error).

**Server State:**
- **TanStack React Query**
- Used for data fetching in components (`useQuery`, `useMutation`).
- *Note:* Codebase shows mix of Zustand fetching (in stores) and React Query (in components).

## Database/API

**Pattern:**
- Direct Supabase client usage in `src/lib/*`.
- RLS (Row Level Security) handles authorization.
- `requireUser()` helper for verifying auth in services.

---

*Convention analysis: 2026-01-26*
