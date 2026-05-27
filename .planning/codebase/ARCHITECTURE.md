<!-- refreshed: 2026-05-27 -->
# Architecture

**Analysis Date:** 2026-05-27

## System Overview

```text
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (React 18 / Vite 5)              │
│                        src/main.tsx → src/App.tsx               │
├────────────────┬────────────────────┬───────────────────────────┤
│  Auth/Theme    │  Route Pages       │  Global State             │
│  contexts/     │  pages/            │  stores/ (Zustand v5)     │
│  AuthContext   │  TranscriptsNew    │  panelStore               │
│  ThemeContext  │  Settings, etc.    │  orgContextStore          │
└────────┬───────┴────────┬───────────┴───────────────────────────┘
         │                │
         ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Component Layer                                │
│  Layout/AppShell (4-pane)  ·  Domain components  ·  UI prims   │
│  components/layout/AppShell.tsx                                  │
│  components/{domain}/  ·  components/ui/                        │
└────────────────────────────────┬────────────────────────────────┘
                                 │
         ┌───────────────────────┼────────────────────────┐
         ▼                       ▼                        ▼
┌────────────────┐  ┌─────────────────────────┐  ┌──────────────┐
│  hooks/        │  │  stores/ (Zustand v5)   │  │  lib/        │
│  TanStack Query│  │  Client state only       │  │  Utilities   │
│  wrappers      │  │  panelStore, orgContext  │  │  query-config│
│  useFolders.ts │  │  preferencesStore        │  │  recording-  │
│  useCallDetail │  │  searchStore             │  │  ids.ts      │
└───────┬────────┘  └─────────────────────────┘  └──────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    services/ layer                               │
│          Pure async TypeScript — no React dependencies          │
│  recordings.service.ts  ·  folders.service.ts  ·  tags.service  │
└────────────────────────────┬────────────────────────────────────┘
                             │
        ┌────────────────────┴────────────────────┐
        ▼                                         ▼
┌───────────────────────────┐        ┌────────────────────────────┐
│  integrations/supabase/   │        │  supabase/functions/       │
│  client.ts                │        │  Edge Functions (Deno)     │
│  Supabase JS client       │        │  fetch-meetings/index.ts   │
└───────────────────────────┘        │  sync-meetings/index.ts    │
        │                            └────────────────────────────┘
        ▼                                         │
┌─────────────────────────────────────────────────▼──────────────┐
│                   Supabase (PostgreSQL + Auth + Storage)        │
│         RLS on all tables  ·  211 migrations                    │
└─────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| `AppShell` | 4-pane layout orchestrator — nav rail, secondary, main, detail | `src/components/layout/AppShell.tsx` |
| `Layout` | Top-level viewport wrapper — TopBar, onboarding redirect, debug panel gate | `src/components/Layout.tsx` |
| `AuthContext` | Supabase session lifecycle, cross-org cache clearing | `src/contexts/AuthContext.tsx` |
| `ThemeContext` | Light/dark mode provider | `src/contexts/ThemeContext.tsx` |
| `panelStore` | Pane 4 open/close state, panel type, drill-down history | `src/stores/panelStore.ts` |
| `orgContextStore` | Active org/workspace/folder selection, cross-tab sync | `src/stores/orgContextStore.ts` |
| `preferencesStore` | Auto-processing prefs with DB persistence + cross-tab sync | `src/stores/preferencesStore.ts` |
| `queryKeys` | Factory-pattern TanStack Query key registry | `src/lib/query-config.ts` |
| `recording-ids` | UUID ↔ legacy Fathom BIGINT translation boundary | `src/lib/recording-ids.ts` |
| `source-registry` | Canonical metadata for all recording sources (Fathom, Zoom, etc.) | `src/config/source-registry.ts` |
| `connectorRegistry` | Per-source setup flow and adapter dispatch | `src/components/connectors/registry/connectorRegistry.ts` |
| Edge Functions | Server-side data fetch, sync, AI processing | `supabase/functions/<name>/index.ts` |
| `_shared/auth.ts` | Shared JWT authentication helper for all Edge Functions | `supabase/functions/_shared/auth.ts` |

## Pattern Overview

**Overall:** Feature-sliced service + hook separation, with Zustand for client state and TanStack Query for server state.

**Key Characteristics:**
- `services/` = pure async TypeScript that speaks directly to Supabase; zero React
- `hooks/` = React wrappers around services via TanStack Query (caching, optimistic updates, loading states)
- Zustand v5 stores hold client-only UI state (panel open/type, active org, preferences)
- AppShell owns all pane layout; pages provide content via `children` and optional `secondaryPane` slot
- All Edge Functions are Deno runtime under `supabase/functions/` and follow a single structural template

## Layers

**Context Layer:**
- Purpose: Auth session, theme
- Location: `src/contexts/`
- Contains: `AuthContext.tsx`, `ThemeContext.tsx`
- Depends on: `integrations/supabase/client.ts`, Zustand stores
- Used by: `src/App.tsx`, any component needing `useAuth()`

**Page Layer:**
- Purpose: Route-level components — one file per route
- Location: `src/pages/`
- Contains: Route components (`TranscriptsNew.tsx`, `Settings.tsx`, `CallDetailPage.tsx`, etc.)
- Depends on: `AppShell`, domain components, hooks, stores
- Used by: `src/App.tsx` via react-router-dom v6

**Component Layer:**
- Purpose: Presentational and composite UI components
- Location: `src/components/`
- Sub-directories: `layout/` (AppShell, pane infrastructure), `panels/` (Pane 4 content), `panes/` (Pane 2 content), `dialogs/` (Radix Dialog wrappers), `ui/` (shadcn/ui primitives), domain dirs (`call-detail/`, `workspace/`, `transcripts/`, `connectors/`, etc.)
- Depends on: hooks, stores, lib utilities
- Used by: pages, other components

**Hook Layer:**
- Purpose: React bindings for data fetching and mutations
- Location: `src/hooks/`
- Contains: `use*.ts` files — each wraps one or more service calls with TanStack Query
- Depends on: `services/`, `integrations/supabase/client.ts`, `lib/query-config.ts`
- Used by: pages, components

**Service Layer:**
- Purpose: Pure async data access — no React, no hooks, fully testable
- Location: `src/services/`
- Contains: `*.service.ts` files (e.g., `recordings.service.ts`, `folders.service.ts`, `tags.service.ts`)
- Depends on: `integrations/supabase/client.ts`, `lib/` utilities
- Used by: hooks (exclusively — never call services directly from components)

**Store Layer:**
- Purpose: Client-side ephemeral UI state not owned by the server
- Location: `src/stores/`
- Contains: Zustand v5 stores (`panelStore.ts`, `orgContextStore.ts`, `preferencesStore.ts`, `searchStore.ts`, `routingRuleStore.ts`, `integrationModalStore.ts`)
- Depends on: nothing (self-contained); some stores persist to localStorage
- Used by: components, hooks, Layout, AppShell

**Integration Layer:**
- Purpose: Supabase client singleton + generated DB types
- Location: `src/integrations/supabase/`
- Contains: `client.ts` (createClient singleton), `types` (generated from DB schema)
- Depends on: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
- Used by: services, hooks, contexts

**Edge Function Layer:**
- Purpose: Server-side operations — external API calls, AI generation, sync jobs, webhooks
- Location: `supabase/functions/<function-name>/index.ts`
- Contains: ~70 Deno Edge Functions organized by prefix convention (see below)
- Depends on: `supabase/functions/_shared/` utilities
- Used by: frontend hooks (called via `supabase.functions.invoke()`) and external webhooks

## Data Flow

### Primary Read Path (calls list)

1. Page mounts → calls hook (e.g., `useWorkspaces()`) (`src/hooks/useWorkspaces.ts`)
2. Hook calls TanStack Query `useQuery` with factory key `queryKeys.workspaces.list(orgId)` (`src/lib/query-config.ts`)
3. Query calls service function (e.g., `getWorkspaces(orgId)`) (`src/services/organizations.service.ts`)
4. Service executes Supabase JS query — RLS applied on server
5. Result cached by TanStack Query; component re-renders with data

### Primary Write Path (mutation)

1. User action in component → calls mutation hook (e.g., `useAssignCallToFolder()`) (`src/hooks/useFolders.ts`)
2. Hook calls TanStack Query `useMutation`; applies optimistic update to local cache
3. Mutation calls service function; service executes Supabase upsert/insert/delete
4. On `onSettled`: calls `invalidateCallListCaches(queryClient)` (`src/lib/query-config.ts:263`)
5. TanStack Query refetches the six canonical cache hubs: `calls.all`, `recordings.all`, `workspaceEntries.all`, `folders.all`, `folderAssignments.all`, `tagAssignments.all`

### Edge Function Call Path

1. Hook calls `supabase.functions.invoke('<function-name>', { body })` — JWT auto-attached
2. Edge Function receives request at `supabase/functions/<name>/index.ts`
3. CORS preflight handled first
4. `authenticateRequest(req, supabase, corsHeaders)` validates JWT (`supabase/functions/_shared/auth.ts`)
5. Main logic executes using service-role client (bypasses RLS for server ops)
6. Returns `{ success: true, data: ... }` or `{ error: '...' }`

### Pane 4 (Detail Panel) Flow

1. Component calls `usePanelStore().openPanel(type, data)` with a `PanelType` and optional payload
2. `panelStore` sets `isPanelOpen: true`, `panelType`, `panelData`, appends current panel to history
3. `AppShell` renders `<DetailPaneOutlet>` which reads `panelStore` and renders the matching panel component
4. Panel closes on route change (unless pinned via `isPinned`)

**State Management:**
- Server state: TanStack Query (`staleTime: 5min`, `gcTime: 10min`, `refetchOnWindowFocus: false`)
- Client UI state: Zustand v5 (panel, org context, preferences, search)
- Auth state: React Context (`AuthContext`) backed by Supabase session
- Cross-tab sync: `localStorage` storage events for org context and preferences

## Key Abstractions

**`queryKeys` factory:**
- Purpose: Single source of truth for all TanStack Query cache keys — prevents key collision and enables targeted invalidation
- File: `src/lib/query-config.ts`
- Pattern: Nested object with factory functions returning `as const` tuples

**Recording ID boundary:**
- Purpose: Translates between canonical UUID (`recordings.id`) and legacy Fathom BIGINT (`recordings.legacy_recording_id`)
- File: `src/lib/recording-ids.ts`
- Pattern: All code crossing ID systems must use `toRecordingUuid()` / `toRecordingUuidBatch()` — never inline translation

**`invalidateCallListCaches()`:**
- Purpose: Unified cache invalidation covering all six hubs that back the call list surfaces
- File: `src/lib/query-config.ts:263`
- Pattern: Every mutation hook calls this in `onSettled`

**Connector Registry:**
- Purpose: Per-source setup flow dispatch — maps source ID to its React setup wizard component
- Files: `src/components/connectors/registry/connectorRegistry.ts`, `src/components/connectors/registry/adapters/*.ts`
- Pattern: Adapter pattern — each source (Fathom, Zoom, Grain, Fireflies, Read.ai, PLAUD, YouTube, file upload) has its own adapter file

**`_shared/auth.ts` (Edge Functions):**
- Purpose: Shared JWT authentication for all Edge Functions — handles case-insensitive Bearer parsing, whitespace trimming, missing-header 401s
- File: `supabase/functions/_shared/auth.ts`
- Pattern: Every new Edge Function uses `authenticateRequest(req, supabase, corsHeaders)` — never inline auth boilerplate

**`@shared` path alias:**
- Purpose: Allows Vite-bundled frontend to import zero-dependency shared utilities from Edge Functions without Deno globals
- Config: `vite.config.ts` — `"@shared"` → `./supabase/functions/_shared`
- Constraint: Only import modules with no `Deno.*` or `https://esm.sh/` references

## Entry Points

**Frontend bootstrap:**
- Location: `src/main.tsx`
- Triggers: Browser loads `index.html`, Vite bundles from this entry
- Responsibilities: Sentry init, `createRoot()`, top-level error boundary, `<App />`

**App routing:**
- Location: `src/App.tsx`
- Triggers: `main.tsx` renders `<App />`
- Responsibilities: `QueryClientProvider`, `AuthProvider`, `ThemeProvider`, `BrowserRouter`, all route definitions (lazy-loaded for Analytics, Settings, RoutingRulesPage, PeoplePage, OrganizationPage)

**AppShell:**
- Location: `src/components/layout/AppShell.tsx`
- Triggers: Every protected page renders `<AppShell>`
- Responsibilities: Pane 1 (nav rail 220px/72px collapsed), Pane 2 (secondary 280px, optional), Pane 3 (main, flex-1), Pane 4 (detail 360/320px, via `<DetailPaneOutlet>`)

**Edge Function handler:**
- Location: `supabase/functions/<name>/index.ts`
- Triggers: `Deno.serve()` — invoked via Supabase Edge Runtime
- Responsibilities: CORS preflight, auth, main logic, standard response shape

## Architectural Constraints

- **Zustand v5 double-invocation:** `create<T>()((set) => ({` — NOT `create<T>((set) => ({`. The extra `()` is required by v5 API; wrong syntax compiles but loses type inference.
- **Icon library:** `@remixicon/react` exclusively — Lucide, FontAwesome are hard-banned
- **Animation:** `import { motion } from 'motion/react'` — NOT `framer-motion`
- **Package manager:** `npm` only — no pnpm, no bun, no yarn
- **No AI/RAG/embedding code in frontend:** AI constraint AI-02 — all LLM/embedding work goes through Edge Functions
- **No Google Meet references:** FOUND-09 — removed from v2
- **`@/` import aliases:** All frontend imports use `@/` path alias (maps to `src/`), never relative paths
- **Import order:** React → external libs → components → hooks → stores → utils → types
- **Service-role key:** Never exposed to frontend — only used server-side in Edge Functions via `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`
- **Docker not available:** Edge Functions must deploy with `supabase functions deploy --use-api` — standard deploy hangs
- **Pane layout:** All four panes operate on the same z-index plane — no drawer overlays covering content

## Anti-Patterns

### Calling services directly from components

**What happens:** A component imports from `src/services/` and calls a service function directly without going through a hook.
**Why it's wrong:** Bypasses TanStack Query caching and optimistic updates. Mutations won't trigger `invalidateCallListCaches()`. Loading/error states unavailable.
**Do this instead:** Always use or create a hook in `src/hooks/` that wraps the service with `useQuery` or `useMutation`.

### Inlining recording ID translation

**What happens:** A function converts between Fathom BIGINT and UUID with inline logic (e.g., `String(legacyId)` passed to a UUID field).
**Why it's wrong:** Produces `invalid input syntax for type uuid` Postgres errors silently in some code paths.
**Do this instead:** Route all cross-ID-system conversions through `toRecordingUuid()` / `toRecordingUuidBatch()` in `src/lib/recording-ids.ts`.

### Inlining Edge Function auth boilerplate

**What happens:** A new Edge Function directly calls `req.headers.get('Authorization')` and `supabase.auth.getUser(token)` inline.
**Why it's wrong:** Doesn't inherit security fixes (case-insensitive Bearer, whitespace trimming) and diverges from the contract tested in regression coverage.
**Do this instead:** Use `authenticateRequest(req, supabase, corsHeaders)` from `supabase/functions/_shared/auth.ts`.

### Partial cache invalidation after mutations

**What happens:** A mutation hook only invalidates the specific query it directly touched (e.g., only `folders.list`), skipping the call list caches.
**Why it's wrong:** Stale data shows up in the home table, workspace table, or folder views until the next full refresh.
**Do this instead:** Call `invalidateCallListCaches(queryClient)` in the mutation's `onSettled` callback (`src/lib/query-config.ts:263`).

## Error Handling

**Strategy:** Layer-appropriate error surfacing — services throw, hooks catch and expose `isError`/`error`, components show `<toast.error()>` or fallback UI.

**Patterns:**
- Services: throw `new Error(message)` on Supabase errors
- Hooks: TanStack Query catches errors; `isError` + `error` available to consumers
- Edge Functions: try-catch with `console.error('Error in function-name:', error)` + `{ status: 500, body: { error: message } }`
- Components: `toast.error()` from Sonner for user-visible errors; `react-error-boundary` wraps pages
- Auth errors: Handled in `AuthContext` — SIGNED_OUT clears entire query cache and org context

## Cross-Cutting Concerns

**Logging:** `src/lib/logger.ts` — structured logger with `logger.debug()`, `logger.info()`, `logger.error()`. Edge Functions use `console.error()` / `console.log()` (Deno).
**Validation:** Frontend uses Zod (`src/lib/validations.ts`). Edge Functions use Zod via `https://esm.sh/zod@3.23.8`.
**Authentication:** Supabase Auth — JWT session stored in localStorage, auto-refreshed. Frontend: `AuthContext` + `ProtectedRoute`. Backend: `authenticateRequest` shared helper.
**Multi-org isolation:** RLS on all tables + `organization_id` defense-in-depth filter in service queries. CI regression test: `src/test/rls-regression.test.ts` (SEC-04C).
**Error monitoring:** Sentry (`@sentry/react`) initialized in `src/main.tsx` via `src/lib/sentry.ts`. Source maps uploaded during CI builds.

---

*Architecture analysis: 2026-05-27*
