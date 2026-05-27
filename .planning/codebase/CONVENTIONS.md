# Coding Conventions

**Analysis Date:** 2026-05-27

## Naming Patterns

**Files:**
- React components: PascalCase `.tsx` — `FolderDetailPanel.tsx`, `WorkspaceSidebarPane.tsx`
- Hooks: camelCase with `use` prefix `.ts` — `useFolders.ts`, `useGlobalSearch.ts`
- Services: kebab-case with `.service.ts` suffix — `folders.service.ts`, `tags.service.ts`, `data-movement.service.ts`
- Stores: camelCase with `Store` suffix — `panelStore.ts`, `searchStore.ts`
- Edge Function folders: kebab-case — `fetch-meetings/`, `grain-sync-recordings/`, `polar-create-customer/`
- Test files: `*.test.ts` / `*.test.tsx` for unit/integration (see TESTING.md)
- Migration files: `YYYYMMDDHHMMSS_descriptive_name.sql` — `20260108000001_create_single_call_share_tables.sql`

**Functions:**
- React components: PascalCase — `FolderDetailPanel`, `EditWorkspaceDialog`
- Hooks: camelCase with `use` prefix — `useFolders`, `usePanelStore`, `useBreakpointFlags`
- Service functions: camelCase verbs — `getTags`, `createTag`, `moveRecordingsToWorkspace`
- Edge Function internal helpers: camelCase — `processMeetingWebhook`

**Variables:**
- TypeScript source: camelCase — `queryClient`, `workspaceId`, `authResult`
- Database columns: snake_case — `user_id`, `recording_id`, `created_at`, `full_transcript`
- Database tables: snake_case — `user_settings`, `workspace_entries`, `folder_assignments`

**Types/Interfaces:**
- PascalCase — `Folder`, `PanelType`, `Meeting`, `ApiResponse`
- DB-generated types imported from `src/integrations/supabase/types.ts`

## Code Style

**Formatting:**
- No Prettier config present — formatting is editor/CI enforced by convention
- TypeScript ESLint (`typescript-eslint`) enforces type safety
- `tsconfig.json` enables `noUnusedLocals`, `noUnusedParameters`, `skipLibCheck`
- `strictNullChecks` is OFF (set to `false` in root `tsconfig.json`)
- `noImplicitAny` is OFF — `@typescript-eslint/no-explicit-any` is a warning, not error

**Linting:**
- Config: `eslint.config.js` (flat config format)
- Rules active: `eslint-plugin-react-hooks` (recommended), `eslint-plugin-react-refresh`
- `@typescript-eslint/no-unused-vars`: warn, with `argsIgnorePattern: "^_"` and `varsIgnorePattern: "^_"`
- `@typescript-eslint/no-explicit-any`: warn
- `@typescript-eslint/ban-ts-comment`: warn
- Supabase Edge Functions (`supabase/functions/**`) are excluded from ESLint — linted by `deno lint` in CI
- Run: `npm run lint`
- Type-check: `npm run type-check` (runs `tsc --noEmit`)

## Import Organization

**Order (enforced by convention, not tooling):**
1. React and React ecosystem (`react`, `react-dom`, `react-router-dom`)
2. External libraries (`@tanstack/react-query`, `sonner`, `motion/react`, `zod`)
3. Components (`@/components/...`)
4. Hooks (`@/hooks/...`)
5. Stores (`@/stores/...`)
6. Services (`@/services/...`)
7. Utils/lib (`@/lib/...`)
8. Types (`@/types/...`)

**Path Aliases — always use `@/`, never relative paths:**
- `@/` → `./src/` (configured in `tsconfig.json` and `vitest.config.ts`)
- `@shared/` → `./supabase/functions/_shared/` (for test access to shared Edge Function utilities)
- Never use `../../../` relative paths — use `@/` throughout `src/`

**Radix UI:** Import from individual packages — `import { Dialog } from '@radix-ui/react-dialog'`

**Animation:** `import { motion } from 'motion/react'` — NOT `framer-motion`

**Icons:** `import { RiArrowRightLine } from '@remixicon/react'` — ONLY `@remixicon/react`, never Lucide/FontAwesome

**Toasts:** `import { toast } from 'sonner'` — `toast.success()`, `toast.error()`

**Edge Functions shared imports:**
```typescript
import { FathomClient } from '../_shared/fathom-client.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { authenticateRequest } from '../_shared/auth.ts';
```

## State Management

### Zustand v5 — Double-Invocation Syntax (MANDATORY)

```typescript
// CORRECT
import { create } from 'zustand';

interface PanelState { /* ... */ }
export const usePanelStore = create<PanelState>()((set) => ({
  isPanelOpen: false,
  // ...
}));
```

```typescript
// WRONG — single-invocation is the pre-v5 syntax
export const usePanelStore = create<PanelState>((set) => ({
```

The double-invocation (`create<T>()((set) => ({`) is the locked-in pattern for all stores. See `src/stores/panelStore.ts`.

**Store reset in tests:** Use `usePanelStore.setState({ ... })` inside `beforeEach` wrapped in `act()`.

### TanStack Query

- Query keys via factory from `src/lib/query-config.ts` — `queryKeys.folders.list()`, `queryKeys.calls.detail(id)`
- Always use optimistic updates for mutations affecting visible UI
- `QueryClient` in tests: `retry: false` on both queries and mutations to prevent flaky async behavior

## Service + Hook Separation (Locked-In Pattern)

```
src/services/        ← Pure async TypeScript functions (database queries, no React)
src/hooks/           ← React hooks wrapping services with TanStack Query
```

- **Service files** contain only: async functions that hit Supabase, return typed data
- **Hook files** contain only: `useQuery` / `useMutation` wrappers around services, optimistic updates, loading/error states
- Never import React in service files
- Never write raw Supabase queries inside hooks — delegate to services

## Error Handling

**Frontend (React):**
- Use `toast.error('message')` from `sonner` for user-visible errors
- Use `toast.success('message')` for confirmations
- Wrap pages with `react-error-boundary`
- TanStack Query handles loading/error states — surface via `isLoading`, `error` from `useQuery`

**Edge Functions:**
```typescript
try {
  // main logic
} catch (error) {
  console.error('Error in function-name:', error);
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  return new Response(
    JSON.stringify({ error: errorMessage }),
    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

- Specific errors return early with appropriate HTTP codes (400, 401, 403, 404, 429)
- Never expose env vars or secrets in error responses
- Always use `console.error` (not `console.log`) for errors in Edge Functions

## Input Validation (Edge Functions)

Use Zod for all request body validation in Edge Functions:

```typescript
import { z } from 'https://esm.sh/zod@3.23.8';

const inputSchema = z.object({
  apiKey: z.string().trim().min(20).max(500),
});

const validation = inputSchema.safeParse(body);
if (!validation.success) {
  return new Response(
    JSON.stringify({ error: validation.error.errors[0]?.message }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

## Token System (Tailwind Semantic Classes)

Use shadcn/Tailwind semantic tokens — no hardcoded hex values, no v1 alias tokens.

| Use Case | Correct Token | NEVER Use |
|----------|---------------|-----------|
| Primary text | `text-foreground` | `text-ink`, hardcoded hex |
| Secondary text | `text-muted-foreground` | `text-ink-soft`, `text-cb-ink-muted` |
| Page background | `bg-viewport` | hardcoded hex |
| Pane/card background | `bg-card` | hardcoded hex |
| Hover states | `bg-muted` | `bg-hover` |
| Borders | `border-border` | `border-soft` |
| Active accent (structural only) | `text-vibe-orange` / `bg-vibe-orange` | hardcoded `#FF8800` |

The tokens `text-ink`, `text-ink-muted`, `bg-hover`, `border-soft` are v1 aliases that do not exist in the current design system. They appear in `tailwind.config.ts` as legacy `cb.*` aliases but must not be used in new code.

## Typography Classes

| Context | Classes |
|---------|---------|
| Pane headings | `font-montserrat font-extrabold uppercase tracking-wide text-sm` |
| Section labels | `text-[10px] uppercase tracking-wide text-muted-foreground/60` |
| Body text | `text-sm` (Inter, default sans) |
| Metadata / timestamps | `text-xs text-muted-foreground` |
| Numeric data | Always add `tabular-nums` |

## Button Variants

| Context | Variant |
|---------|---------|
| Primary CTA | `variant="default"` (slate gradient) |
| Secondary action | `variant="hollow"` (bordered) |
| Destructive action | `variant="destructive"` (red gradient) |
| Icon-only | `variant="ghost"` (transparent) |
| Dialog submit | `bg-foreground text-background` or `bg-brand-500 text-white` |

Primary and destructive buttons never change in dark mode.

## Logging

**Frontend:** Use `src/lib/logger.ts` — `logger.info(...)`, `logger.error(...)`, `logger.warn(...)`, `logger.debug(...)`

**Edge Functions:** Use bare `console.log` / `console.error` — never log secrets, API keys, tokens, or PII

## Recording ID Routing (Critical)

CallVault has two parallel ID types per recording:
- UUID (`recordings.id`) — used by: `workspace_entries`, `call_tag_assignments`, `transcript_tag_assignments`, `call_speakers`, `call_participants`
- Legacy BIGINT (`recordings.legacy_recording_id`) — used by: `fathom_calls`, `fathom_transcripts`, `folder_assignments.call_recording_id`

**Always route mixed-ID inputs through `@/lib/recording-ids`** using `toRecordingUuid` / `toRecordingUuidBatch`. Never hand-roll legacy↔UUID translation logic.

## CORS (Edge Functions)

Required on every Edge Function:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
};

// First thing in Deno.serve handler:
if (req.method === 'OPTIONS') {
  return new Response(null, { headers: corsHeaders });
}
```

## Hard Constraints Summary

| Constraint | Rule |
|------------|------|
| AI-02 | Zero AI/RAG/embedding code in the frontend — ever |
| FOUND-09 | Zero Google Meet references anywhere |
| Icons | `@remixicon/react` ONLY — no Lucide, FontAwesome, or others |
| Auth (Edge) | Always use `authenticateRequest` from `supabase/functions/_shared/auth.ts` — never inline JWT boilerplate |
| Animation | `motion/react` ONLY — never `framer-motion` |
| Package manager | `npm` only — no pnpm, no bun, no yarn |

---

*Convention analysis: 2026-05-27*
