# Coding Conventions

**Analysis Date:** 2026-05-26

## Naming Patterns

**Files:**
- kebab-case for all source and configuration files (e.g., `folders.service.ts`, `eslint.config.js`).
- PascalCase for React components (e.g., `Layout.tsx`, `ConnectorCard.tsx`), except UI primitives (shadcn) which use kebab-case (e.g., `alert-dialog.tsx`).
- Test files alongside source or in adjacent `__tests__` directory, named as `{filename}.test.ts`, `{filename}.test.tsx` (for unit tests), or `{filename}.integration.test.ts` (for database integration). E2E tests live in the root `/e2e/` folder as `{feature}.spec.ts`.

**Functions:**
- camelCase for functions (e.g., `getFolders`, `processMeetingWebhook`).
- camelCase with `use` prefix for React hook functions (e.g., `useFolders`, `useOrgContextStore`).
- No special prefix for async functions (e.g., `fetchMeetings`).

**Variables:**
- camelCase for standard variables (e.g., `activeWorkspaceId`, `isLoading`).
- UPPER_SNAKE_CASE for constants (e.g., `ORG_CONTEXT_STORAGE_KEY`, `CROSS_ORG_TABLES`).
- Booleans prefixed with `is`, `has`, or `should` (e.g., `isPanelOpen`, `isSharedView`).
- Prefix with `_` to ignore unused variables in parameters or variables when required by ESLint.

**Types:**
- PascalCase for type aliases, interfaces, and enums (e.g., `Folder`, `OrgContextState`). No `I` prefix for interfaces.
- snake_case for database fields (e.g., `recording_id`, `created_at`).
- camelCase for JavaScript object properties (e.g., `membershipRole`, `activeWorkspaceId`).

## Code Style

**Formatting:**
- Indentation: 2 spaces.
- Trailing commas: Used for git diff friendliness.
- Single quotes preferred for strings in TypeScript, double quotes for JSX/HTML attributes.

**Linting:**
- Tool: ESLint with configuration in `eslint.config.js` (uses `@eslint/js` and `typescript-eslint`).
- Rules: Extends standard recommended configs, warns on unused variables starting with `_`, warns on `any` usage, and warns on `@ts-ignore` comments.
- Run command: `npm run lint`.

## Import Organization

**Order:**
1. React core (`react`, `react-router-dom`).
2. External packages (`zustand`, `@tanstack/react-query`, etc.).
3. Components (`@/components/*`, `@/pages/*`).
4. Hooks (`@/hooks/*`).
5. Stores (`@/stores/*`).
6. Utilities and services (`@/lib/*`, `@/services/*`).
7. Type imports (`import type { ... }`).

**Grouping:**
- Blank lines between groups.
- Alphabetical sorting within groups.

**Path Aliases:**
- `@/` maps to `./src/` (e.g., `@/integrations/supabase/client`).
- `@shared/` maps to `./supabase/functions/_shared/`.

**Hard Import Constraints:**
- Icons: Remix Icons ONLY (`@remixicon/react`). Never use Lucide, FontAwesome, or other libraries.
- Animations: Use `motion` from `motion/react`. Never use `framer-motion`.
- Radix UI: Import individual package components (e.g., `import { Dialog } from '@radix-ui/react-dialog'`).

## Error Handling

**Service Layer:**
- Throw descriptive errors for operational failures (e.g., `throw new Error('Failed to update folder: ' + error.message)`).
- Edge cases / missing items can use `maybeSingle()` to return `null` instead of raising an error.

**Edge Functions:**
- Wrap handlers in try-catch and return standardized JSON:
  - Success: Status `200` with `{ success: true, data }`.
  - Error: Status `400` / `401` / `500` with `{ error: string }`.
- Use the shared auth helper `authenticateRequest` from `../_shared/auth.ts` to handle auth tokens securely.

**State Management / UI:**
- Store error strings in Zustand store state (e.g., `error: string | null`) and clear/reset them before starting new operations.
- Display errors gracefully using `sonner` toasts (`toast.error(message)`).
- Wrap pages/sections in `react-error-boundary` to catch render exceptions.

## Logging

**Framework:**
- Custom logger utility in `src/lib/logger.ts` (`logger` instance).
- Levels: `debug`, `info`, `warn`, `error`.

**Patterns:**
- Development: Logs all levels to the console.
- Production: Only logs `warn` and `error` to the console to prevent clutter and sensitive leak.
- Never log passwords, API keys, tokens, or PII.

## Comments

**When to Comment:**
- Explain why, not what (e.g., document invariants, Fathom legacy ID mapping reasons).
- Document non-obvious workarounds, depth-limit constraints, or performance requirements.

**JSDoc/TSDoc:**
- Used for service and hook functions to describe parameters, returns, and specific database/business assumptions (e.g., `@param`, `@returns`).

**TODO Comments:**
- Format: `// TODO: description` or `// TODO(username): description`. Include issue links when possible.

## Function Design

**Size:**
- Keep functions small and focused on a single responsibility. Extract helpers for complex operations.

**Parameters:**
- Max 3 parameters. Use destructured options object for more.

**Return Values:**
- Explicit return statements. Early return/guard clauses to avoid nested `if` blocks.

## Module Design

**Exports:**
- Named exports preferred for utilities and services. Default exports only for React router page elements if required.

**Barrel Files:**
- Avoid thick barrel files (index.ts) to minimize circular dependencies. Use direct imports.

---

*Convention analysis: 2026-05-26*
*Update when patterns change*
