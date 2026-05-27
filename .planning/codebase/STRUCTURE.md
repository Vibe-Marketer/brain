<!-- refreshed: 2026-05-27 -->
# Codebase Structure

**Analysis Date:** 2026-05-27

## Directory Layout

```
brain/                          # Repo root (CallVault single-repo)
├── src/                        # Frontend — Vite 5 + React 18
│   ├── main.tsx                # Bootstrap entry (Sentry init, createRoot)
│   ├── App.tsx                 # Router, providers, all route definitions
│   ├── index.css               # Global CSS
│   ├── pages/                  # Route-level page components (one per route)
│   ├── components/             # Presentational + composite components
│   │   ├── layout/             # AppShell, DetailPaneOutlet, SidebarToggle
│   │   ├── panels/             # Pane 4 detail panel components
│   │   ├── panes/              # Pane 2 secondary panel components
│   │   ├── dialogs/            # Radix Dialog wrappers
│   │   ├── ui/                 # shadcn/ui primitives (button, input, etc.)
│   │   ├── call-detail/        # Call detail view (header, transcript, overview tabs)
│   │   ├── workspace/          # Workspace badges, selectors, filters
│   │   ├── transcripts/        # TranscriptsTab, SyncTab, call list
│   │   ├── connectors/         # Integration setup wizard + connector registry
│   │   │   ├── registry/       # connectorRegistry.ts + per-source adapters/
│   │   │   ├── hooks/          # Connector-specific hooks
│   │   │   ├── primitives/     # Reusable connector UI pieces
│   │   │   └── setup/          # Guided setup flow components
│   │   ├── analytics/          # Analytics page components
│   │   ├── billing/            # Polar billing components
│   │   ├── contacts/           # People/contacts components
│   │   ├── import/             # Import source flow components
│   │   ├── integrations/       # Real-time integration status provider
│   │   ├── onboarding/         # Setup wizard, onboarding modals
│   │   ├── people/             # People page components
│   │   ├── search/             # Global search components
│   │   ├── settings/           # Settings category/detail pane components
│   │   ├── share/              # Single-call share components
│   │   ├── sharing/            # Workspace sharing components
│   │   ├── sync/               # Sync status/progress components
│   │   ├── tags/               # Tag management components
│   │   ├── transcript-library/ # Folder management dialog
│   │   ├── dnd/                # Drag-and-drop helpers
│   │   ├── debug-panel/        # Developer debug panel
│   │   └── shared/             # Cross-domain shared components
│   ├── services/               # Pure async functions — *.service.ts
│   ├── hooks/                  # React hooks wrapping services (TanStack Query)
│   ├── stores/                 # Zustand v5 client-state stores
│   ├── lib/                    # Utility functions and helpers
│   ├── types/                  # TypeScript type definitions
│   ├── integrations/
│   │   └── supabase/           # Supabase client singleton + generated DB types
│   ├── contexts/               # React Context providers (Auth, Theme)
│   ├── config/                 # source-registry.ts
│   ├── styles/                 # Global style overrides (tour.css)
│   └── test/                   # Integration test setup + RLS regression test
├── supabase/                   # Backend — Supabase (Deno Edge Functions + DB)
│   ├── functions/              # ~70 Edge Functions (kebab-case dirs)
│   │   ├── _shared/            # Shared utilities across all functions
│   │   ├── fetch-*/            # Retrieve from external APIs
│   │   ├── sync-*/             # Sync to database
│   │   ├── generate-*/         # AI generation (titles, text)
│   │   ├── fathom-*/           # Fathom source functions
│   │   ├── zoom-*/             # Zoom source functions
│   │   ├── grain-*/            # Grain source functions
│   │   ├── fireflies-*/        # Fireflies source functions
│   │   ├── read-ai-*/          # Read.ai source functions
│   │   ├── plaud-*/            # PLAUD source functions
│   │   ├── polar-*/            # Polar billing functions
│   │   ├── mcp-*/              # MCP OAuth/server functions
│   │   └── youtube-*/          # YouTube import functions
│   ├── migrations/             # 211 timestamped SQL migrations
│   └── tests/                  # Supabase pgTAP tests
├── docs/                       # Documentation (design, ADRs, architecture)
│   ├── design/                 # Brand guidelines, design principles
│   ├── adr/                    # Architecture Decision Records
│   ├── architecture/           # Architecture diagrams + Fathom integration docs
│   ├── operations/             # MCP runbook, secrets setup
│   └── security/               # Security documentation
├── e2e/                        # Playwright E2E tests
├── src/__tests__/              # Unit/integration tests (Vitest)
├── .planning/                  # GSD planning phases and codebase docs
│   └── codebase/               # Codebase maps (this directory)
├── vite.config.ts              # Vite build config (path aliases: @/, @shared)
├── tailwind.config.ts          # Tailwind CSS config
├── vitest.config.ts            # Vitest config
├── playwright.config.ts        # Playwright E2E config
├── tsconfig.app.json           # Frontend TypeScript config
├── components.json             # shadcn/ui component registry config
└── package.json                # npm — no pnpm/bun
```

## Directory Purposes

**`src/pages/`:**
- Purpose: One component per application route
- Contains: Route-level page files — `TranscriptsNew.tsx` (home/calls), `Settings.tsx`, `CallDetailPage.tsx`, `ImportPage.tsx`, `Analytics.tsx`, `RoutingRulesPage.tsx`, `PeoplePage.tsx`, `OrganizationPage.tsx`, auth pages (`Login.tsx`, `ForgotPassword.tsx`, `ResetPassword.tsx`), `SharedCallView.tsx`, `SetupWizard.tsx`
- Key files: `src/pages/TranscriptsNew.tsx` (main landing page), `src/pages/CallDetailPage.tsx`

**`src/components/layout/`:**
- Purpose: AppShell pane infrastructure — the 4-pane layout system
- Contains: `AppShell.tsx` (master layout), `DetailPaneOutlet.tsx` (Pane 4 renderer), `SidebarToggle.tsx`
- Key files: `src/components/layout/AppShell.tsx`

**`src/components/panels/`:**
- Purpose: Pane 4 (detail panel) content components — rendered by `DetailPaneOutlet`
- Contains: `FolderDetailPanel.tsx`, `WorkspaceDetailPanel.tsx`, `TagDetailPanel.tsx`, `ContactDetailPanel.tsx`, `OrganizationMemberPanel.tsx`, `SettingHelpPanel.tsx`, `UserDetailPanel.tsx`, `WorkspaceMemberPanel.tsx`, `RoutingRulePanel.tsx`, `AutomationRulePanel.tsx`

**`src/components/panes/`:**
- Purpose: Pane 2 (secondary panel) content components — passed as `secondaryPane` to AppShell
- Contains: `WorkspaceSidebarPane.tsx`, `SettingsCategoryPane.tsx`, `SettingsDetailPane.tsx`, `AnalyticsCategoryPane.tsx`, `AnalyticsDetailPane.tsx`, `ImportSourcePane.tsx`, `OrganizationCategoryPane.tsx`, `PeopleCategoryPane.tsx`

**`src/components/ui/`:**
- Purpose: shadcn/ui primitive components — the base design system
- Contains: `button.tsx`, `input.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, `tooltip.tsx`, `skeleton.tsx`, `table.tsx`, `tabs.tsx`, `top-bar.tsx`, `sidebar-nav.tsx`, `page-header.tsx`, `status-badge.tsx`, `spinner.tsx`, and all other shadcn/ui primitives

**`src/components/connectors/`:**
- Purpose: Integration connector setup system — source-agnostic wizard with per-source adapters
- Key files: `src/components/connectors/registry/connectorRegistry.ts` (dispatch), `src/components/connectors/registry/adapters/fathom.ts`, `zoom.ts`, `grain.ts`, `fireflies.ts`, `read-ai.ts`, `plaud.ts`, `youtube.ts`, `file-upload.ts`

**`src/services/`:**
- Purpose: Pure async TypeScript data access — no React, fully testable
- Naming: `kebab-case.service.ts`
- Key files: `src/services/recordings.service.ts`, `src/services/folders.service.ts`, `src/services/tags.service.ts`, `src/services/organizations.service.ts`, `src/services/workspace-entries.service.ts`

**`src/hooks/`:**
- Purpose: React bindings for data fetching and mutations via TanStack Query
- Naming: `use<PascalCase>.ts` or `use<PascalCase>.tsx`
- Key files: `src/hooks/useFolders.ts`, `src/hooks/useWorkspaces.ts`, `src/hooks/useCallDetailQueries.ts`, `src/hooks/useCallDetailMutations.ts`, `src/hooks/useTags.ts`, `src/hooks/useOrganizationContext.ts`, `src/hooks/useIntegrationSync.ts`

**`src/stores/`:**
- Purpose: Zustand v5 client-side state — UI state not owned by server
- Naming: `camelCaseStore.ts`
- Key files: `src/stores/panelStore.ts` (Pane 4 state), `src/stores/orgContextStore.ts` (active org/workspace), `src/stores/preferencesStore.ts` (auto-processing prefs), `src/stores/searchStore.ts`, `src/stores/routingRuleStore.ts`, `src/stores/integrationModalStore.ts`

**`src/lib/`:**
- Purpose: Shared utility functions and helpers
- Key files: `src/lib/query-config.ts` (queryKeys factory + invalidateCallListCaches), `src/lib/recording-ids.ts` (UUID/BIGINT boundary), `src/lib/logger.ts`, `src/lib/auth-utils.ts`, `src/lib/utils.ts` (cn/clsx), `src/lib/sentry.ts`, `src/lib/tour.ts`

**`src/types/`:**
- Purpose: TypeScript type definitions
- Key files: `src/types/index.ts` (re-exports), `src/types/supabase.ts` (generated DB types), `src/types/panel.ts` (PanelType union), `src/types/workspace.ts`, `src/types/meetings.ts`, `src/types/folders.ts`

**`src/integrations/supabase/`:**
- Purpose: Supabase client singleton (only import point for the JS client)
- Key files: `src/integrations/supabase/client.ts` — import as `import { supabase } from '@/integrations/supabase/client'`

**`src/config/`:**
- Purpose: App-wide configuration registries
- Key files: `src/config/source-registry.ts` (all recording sources metadata — Fathom, Zoom, Grain, Fireflies, Read.ai, PLAUD, YouTube, file upload, paste)

**`supabase/functions/_shared/`:**
- Purpose: Shared Deno utilities used across Edge Functions
- Key files: `_shared/auth.ts` (authenticateRequest helper), `_shared/cors.ts`, `_shared/fathom-client.ts`, `_shared/google-client.ts`, `_shared/zoom-client.ts`, `_shared/vtt-parser.ts`, `_shared/response.ts`, `_shared/dedup-fingerprint.ts`, `_shared/usage-tracker.ts`

**`supabase/migrations/`:**
- Purpose: 211 timestamped SQL migration files — source of truth for DB schema
- Naming: `YYYYMMDDHHMMSS_descriptive_name.sql`
- Key files: `00000000000000_consolidated_schema.sql` (baseline), all subsequent incremental migrations

**`docs/`:**
- Purpose: Architecture docs, brand guidelines, ADRs, operational runbooks
- Key files: `docs/design/brand-guidelines-v4.4.md` (authoritative design system), `docs/adr/` (architecture decisions), `docs/architecture/api-naming-conventions.md`

## Key File Locations

**Entry Points:**
- `src/main.tsx`: Application bootstrap (Sentry, root render)
- `src/App.tsx`: All routes and provider tree
- `supabase/functions/<name>/index.ts`: Each Edge Function handler

**Configuration:**
- `vite.config.ts`: Build config, `@/` and `@shared` path aliases
- `tailwind.config.ts`: Design token configuration
- `tsconfig.app.json`: Frontend TypeScript settings
- `components.json`: shadcn/ui config
- `src/lib/query-config.ts`: TanStack Query key registry and cache invalidation helpers

**Core Logic:**
- `src/components/layout/AppShell.tsx`: Master 4-pane layout
- `src/stores/panelStore.ts`: Pane 4 open/close + drill-down history
- `src/stores/orgContextStore.ts`: Active org/workspace context
- `src/lib/recording-ids.ts`: Recording ID translation boundary
- `supabase/functions/_shared/auth.ts`: Edge Function JWT authentication

**Testing:**
- `src/test/rls-regression.test.ts`: RLS cross-org isolation test (CI-gated, SEC-04C)
- `src/test/rpc-type-smoke.test.ts`: DB RPC type smoke tests
- `src/__tests__/`: Unit/integration tests co-located near source
- `e2e/`: Playwright E2E test specs

## Naming Conventions

**Files:**
- React components: `PascalCase.tsx` — e.g., `FolderDetailPanel.tsx`, `WorkspaceBadge.tsx`
- Hooks: `camelCase.ts` with `use` prefix — e.g., `useFolders.ts`, `useCallDetailMutations.ts`
- Services: `kebab-case.service.ts` — e.g., `folders.service.ts`, `workspace-entries.service.ts`
- Zustand stores: `camelCaseStore.ts` — e.g., `panelStore.ts`, `orgContextStore.ts`
- Type files: `camelCase.ts` — e.g., `panel.ts`, `workspace.ts`
- Edge Functions: kebab-case directory with `index.ts` — e.g., `fetch-meetings/index.ts`
- Migrations: `YYYYMMDDHHMMSS_snake_case_description.sql`

**Directories:**
- Domain component directories: kebab-case — `call-detail/`, `transcript-library/`, `debug-panel/`
- Edge Function directories: kebab-case — `fetch-meetings/`, `zoom-sync-meetings/`

**Identifiers:**
- React components: `PascalCase`
- Hooks: `camelCase` with `use` prefix
- Type names / interfaces: `PascalCase`
- Database tables and columns: `snake_case`
- Edge Function internal functions: `camelCase`
- Environment variables: `SCREAMING_SNAKE_CASE`

## Where to Add New Code

**New route/page:**
- Page component: `src/pages/NewPage.tsx`
- Route definition: add to `src/App.tsx` inside `<Routes>`, wrap with `<ProtectedRoute><Layout>` pattern
- If page uses AppShell (almost always): wrap content in `<AppShell config={...}>...</AppShell>`

**New domain component:**
- Create a new subdirectory `src/components/<domain>/` if a new domain
- Place component file: `src/components/<domain>/ComponentName.tsx`
- Tests: `src/components/<domain>/__tests__/ComponentName.test.tsx`

**New data operation (read):**
1. Service function: add to existing `src/services/<domain>.service.ts` or create `src/services/<domain>.service.ts`
2. Hook: add to existing `src/hooks/use<Domain>.ts` or create new hook file
3. Add query key to `src/lib/query-config.ts`

**New data operation (write/mutation):**
1. Service function in `src/services/<domain>.service.ts`
2. `useMutation` in `src/hooks/use<Domain>.ts`
3. Call `invalidateCallListCaches(queryClient)` in `onSettled` if mutation affects call list
4. Add optimistic update if mutation affects visible list items

**New Zustand store:**
- File: `src/stores/camelCaseStore.ts`
- Use Zustand v5 double-invocation syntax: `create<T>()((set, get) => ({`

**New Edge Function:**
- Directory: `supabase/functions/<prefix>-<name>/` (kebab-case)
- Entry: `supabase/functions/<prefix>-<name>/index.ts`
- Follow the `supabase/CLAUDE.md` template: CORS preflight → init client → `authenticateRequest` → parse body → logic → return
- Import shared utilities: `import { authenticateRequest } from '../_shared/auth.ts'`
- Deploy with: `supabase functions deploy <name> --use-api` (no Docker)

**New database table:**
1. Create migration: `supabase/migrations/YYYYMMDDHHMMSS_create_<table>.sql`
2. Follow migration template in `supabase/CLAUDE.md` (table → indexes → RLS → policies → comments)
3. Add table to `CROSS_ORG_TABLES` in `src/test/rls-regression.test.ts`
4. Update generated types in `src/integrations/supabase/` after running `supabase gen types`

**New recording source connector:**
1. Add source metadata to `src/config/source-registry.ts`
2. Create adapter: `src/components/connectors/registry/adapters/<source>.ts`
3. Register in `src/components/connectors/registry/connectorRegistry.ts`
4. Create Edge Functions following the `<source>-oauth-url/`, `<source>-oauth-callback/`, `<source>-sync-*/` pattern

**Utilities:**
- Shared helpers: `src/lib/<utility-name>.ts`
- If zero-dependency and usable in both frontend and Edge Functions: place in `supabase/functions/_shared/` and import via `@shared/<util>` alias in frontend

## Special Directories

**`.planning/`:**
- Purpose: GSD planning phases and codebase documentation
- Generated: No (hand-maintained + GSD tooling)
- Committed: Yes

**`dist/`:**
- Purpose: Vite production build output
- Generated: Yes
- Committed: No (gitignored)

**`node_modules/`:**
- Purpose: npm dependencies
- Generated: Yes
- Committed: No

**`supabase/.branches/` and `supabase/.temp/`:**
- Purpose: Supabase CLI state and temp files
- Generated: Yes
- Committed: No

**`src/integrations/supabase/` (types):**
- Purpose: Auto-generated TypeScript types from Supabase DB schema
- Generated: Yes (via `supabase gen types typescript`)
- Committed: Yes (checked in, regenerate after migrations)

---

*Structure analysis: 2026-05-27*
