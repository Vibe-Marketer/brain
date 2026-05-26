# Codebase Structure

**Analysis Date:** 2026-05-26

## Directory Layout

```
[project-root]/
├── cloudflare/         # Cloudflare Workers vanity proxy layer
│   └── api-proxy/      # Worker script and wrangler configuration
├── docs/               # Host system documentation, brand guidelines, runbooks, and ADRs
├── e2e/                # E2E testing suite (Playwright scripts)
├── scripts/            # Build, test, and sync automation scripts
├── src/                # React / Vite SPA Frontend Application
│   ├── components/     # UI elements divided into domain-specific features and generic primitives
│   ├── contexts/       # React Contexts (Auth, Theme)
│   ├── hooks/          # TanStack Query custom hooks wrapping services
│   ├── integrations/   # Supabase client configurations
│   ├── lib/            # Utilities, config constants, and query key mappings
│   ├── pages/          # SPA route-level views
│   ├── services/       # Pure TypeScript database access service layer
│   └── stores/         # Zustand v5 state stores
├── supabase/           # Supabase backend configuration
│   ├── functions/      # Serverless Edge Functions (MCP, syncs, AI)
│   │   └── _shared/    # Shared Deno backend utility modules
│   └── migrations/     # PostgreSQL schema migrations and database RLS
├── browser-extensions/ # Secondary browser extension tools
│   └── callvault-plaud-connector/ # Plaud integration chrome extension
└── plaud-extension/    # Plaud audio import extension files
```

## Directory Purposes

**cloudflare/api-proxy:**
- Purpose: Proxy layer routing traffic from vanity hostnames (`api.callvaultai.com`, `mcp.callvaultai.com`) to Supabase Edge Functions.
- Contains: Cloudflare Worker files.
- Key files: `cloudflare/api-proxy/worker.ts` handles discovery endpoint routes and target requests.
- Subdirectories: None.

**docs:**
- Purpose: Host system documentation, ADRs, brand guidelines, and runbooks.
- Contains: Markdown files, screenshots, and visual specs.
- Key files: `docs/design/brand-guidelines-v4.4.md` (authoritative UI details), `docs/operations/mcp-runbook.md` (MCP troubleshooting).
- Subdirectories: `adr/`, `architecture/`, `design/`, `operations/`, `security/`, etc.

**scripts:**
- Purpose: Build, sync, and credential setup automation scripts.
- Contains: Shell scripts and tsx/TypeScript execution scripts.
- Key files: `scripts/verify-connectors-live.ts` (connector verification helper), `scripts/setup-secrets.sh` (backend environment setup).
- Subdirectories: `archive/`.

**src/services:**
- Purpose: Encapsulates pure asynchronous database logic using the Supabase client.
- Contains: Pure TypeScript module files.
- Key files: `src/services/recordings.service.ts`, `src/services/folders.service.ts`, `src/services/workspace-entries.service.ts`.
- Subdirectories: `__tests__/`.

**src/hooks:**
- Purpose: Integrates the Service Layer with React components using TanStack React Query.
- Contains: Custom React hook files.
- Key files: `src/hooks/useCallDetailQueries.ts`, `src/hooks/useCallDetailMutations.ts`, `src/hooks/useWorkspaces.ts`.
- Subdirectories: `__tests__/`.

**src/components:**
- Purpose: UI components divided into domain-specific features and generic primitives.
- Contains: TypeScript React component files.
- Key files: `src/components/CallDetailDialog.tsx` (main details overlay dialog), `src/components/Layout.tsx` (app layout wrapper).
- Subdirectories: `ui/` (primitives), `call-detail/` (detail panels), `layout/` (shell structure), and domain-specific subdirectories.

**src/stores:**
- Purpose: Manage client-side transient application state with Zustand v5.
- Contains: Zustand stores.
- Key files: `src/stores/panelStore.ts` (manages details panels slide-in/out), `src/stores/orgContextStore.ts` (current organization context).
- Subdirectories: `__tests__/`.

**supabase/functions:**
- Purpose: Serverless API edge endpoints running on Deno.
- Contains: Index files for Deno deployment and shared utility modules.
- Key files: `supabase/functions/mcp-server/index.ts` (public MCP gateway), `supabase/functions/summarize-call/index.ts` (call summarization pipeline).
- Subdirectories: `_shared/` (shared code), integration sync subdirectories.

**supabase/migrations:**
- Purpose: Incrementally construct and manage the PostgreSQL database schema and policies.
- Contains: Chronological SQL files.
- Key files: `supabase/migrations/00000000000000_consolidated_schema.sql` (baseline schema), migration files for table additions and RLS policy tightenings.
- Subdirectories: None.

## Key File Locations

**Entry Points:**
- `src/main.tsx`: SPA UI bootstrap entry point mounting the React root.
- `src/App.tsx`: App shell routing configuration, global query client, and context providers.
- `supabase/functions/*/index.ts`: HTTP request endpoints for serverless backend tasks.
- `cloudflare/api-proxy/worker.ts`: Entry point for vanity routing and CORS handling.

**Configuration:**
- `package.json`: Frontend and development dependencies, package manager script definitions.
- `vite.config.ts`: Vite bundler configuration.
- `supabase/config.toml`: Service routing configuration and function deployment parameters.
- `wrangler.toml`: Cloudflare Worker setup configuration.
- `tsconfig.json`: Global TypeScript compilation rules.

**Core Logic:**
- `supabase/functions/_shared/connector-pipeline.ts`: Central sync coordinator handling incoming calls from 8 external channels.
- `supabase/functions/_shared/routing-engine.ts`: Core rules processor for organizing calls.
- `src/lib/query-config.ts`: React Query global cache durations configuration.
- `src/integrations/supabase/client.ts`: Supabase client instance initializer.

**Testing:**
- `playwright.config.ts`: Configuration settings for Playwright E2E testing.
- `vitest.config.ts`: Settings for Vitest unit/integration testing.
- `src/test/rls-regression.test.ts`: CI-enforced RLS safety regression checks.

**Documentation:**
- `CLAUDE.md`: Main instruction reference guide for codebase constraints and tools.
- `src/CLAUDE.md`: Style guidelines and typography constants for frontend work.
- `supabase/CLAUDE.md`: Specific edge function protocols, coding constraints, and migrations conventions.

## Naming Conventions

**Files:**
- React Components: `PascalCase.tsx` (e.g., `CallDetailDialog.tsx`).
- React Hooks: `camelCase.ts` prefixed with `use` (e.g., `useWorkspaces.ts`).
- Services: `kebab-case.service.ts` (e.g., `workspace-entries.service.ts`).
- Zustand Stores: `camelCaseStore.ts` or `camelCase.ts` with Store suffix (e.g., `panelStore.ts`).
- Migrations: `YYYYMMDDHHMMSS_descriptive_name.sql` (e.g., `20260310160000_mcp_tokens.sql`).

**Directories:**
- Frontend Folders (except components): `camelCase` or `kebab-case` (e.g., `integrations`, `contexts`).
- Edge Function Folders: `kebab-case` only (e.g., `mcp-server`, `summarize-call`).
- Shared Component Directories: `kebab-case` feature folders (e.g., `call-detail`).

**Special Patterns:**
- `__tests__/`: Subdirectories housing test scripts matching the parent structure.
- `_shared/`: Houses helper scripts imported by sibling edge functions.

## Where to Add New Code

**New Feature:**
- Primary code: Create a folder under `src/components/{feature-name}/`.
- Data Services: Add service modules inside `src/services/` using standard name format.
- Queries & Mutations: Write hooks wrapping services in `src/hooks/`.
- Tests: Add tests to `__tests__/` subdirectories matching the source files path.

**New Component/Module:**
- Implementation: Write component under `src/components/{feature}/` or `src/components/ui/` if it's a shared primitive.
- CSS Styles: Add class mappings in `src/index.css` or Tailwind configurations.

**New Route/Command:**
- Definition: Register the route in `src/App.tsx`.
- Handler: Create a view page under `src/pages/` (lazy-loaded when possible).

**Utilities:**
- Shared Frontend Helpers: Place under `src/lib/`.
- Shared Backend Helpers: Place in `supabase/functions/_shared/`.

**New Background Integration / Sync Flow:**
- Edge Function: Create folder `supabase/functions/[integration-name]/` with `index.ts` handler.
- DB Table/RLS Schema: Add incremental migration script in `supabase/migrations/`.

## Special Directories

**supabase/functions/_shared/**
- Purpose: Deno modules sharing logic like database utilities, cryptography, and external connectors.
- Source: Shared library code accessed during Edge Function compilation.
- Committed: Yes.

**dist/**
- Purpose: Production asset bundling output directory.
- Source: Auto-generated on `npm run build` by Vite.
- Committed: No (configured in `.gitignore`).

**node_modules/**
- Purpose: Local package dependency installation folders.
- Source: Built via package manager commands (`npm install`).
- Committed: No.

---

*Structure analysis: 2026-05-26*
