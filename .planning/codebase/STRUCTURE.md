# CallVault Codebase Structure

**Analysis Date:** 2026-05-26

## Directory Layout

```
/
├── cloudflare/         # Cloudflare Workers (vanity proxy layer for MCP / API endpoints)
├── docs/               # System documentation, runbooks, and architectural diagrams
├── e2e/                # End-to-end testing suite (Playwright scripts)
├── scripts/            # Build, helper, and deployment automation scripts
├── src/                # React/Vite Frontend Application
│   ├── components/     # UI elements (generic primitives & feature-specific dialogs)
│   ├── contexts/       # React contexts (e.g., Auth, Theme)
│   ├── hooks/          # Custom query & mutation hooks wrapping services
│   ├── integrations/   # Integration points (e.g., Supabase client initializer)
│   ├── lib/            # Business utilities, configuration, and display helpers
│   ├── pages/          # SPA route-level views
│   ├── services/       # Pure TypeScript modules executing Supabase database logic
│   ├── types/          # Type definitions (database schema, raw imports, domain types)
│   ├── App.tsx         # Main SPA router and application setup
│   └── main.tsx        # React entrypoint
└── supabase/           # Backend Supabase Configuration
    ├── functions/      # Serverless Edge Functions (mcp-server, summarize-call, syncs)
    └── migrations/     # Database migration scripts managing tables, triggers, and RLS
```

## Directory Purposes

**cloudflare/api-proxy:**
- Purpose: Acts as a proxy layer routing traffic from vanity hostnames (`api.callvaultai.com` and `mcp.callvaultai.com`) to the Supabase Edge Functions.
- Key files: `cloudflare/api-proxy/worker.ts`.

**src/services:**
- Purpose: Houses pure data-fetching and mutating functions using the Supabase client. Decouples raw database queries from components and hooks to enforce separation of concerns.
- Key files: `src/services/recordings.service.ts`, `src/services/workspace-entries.service.ts`, `src/services/folders.service.ts`.

**src/hooks:**
- Purpose: Envelops service layer queries and mutations in React Query (`@tanstack/react-query`) hooks to handle state management, caching, and cache invalidation.
- Key files: `src/hooks/useCallDetailQueries.ts`, `src/hooks/useCallDetailMutations.ts`, `src/hooks/useWorkspaceRecordings.ts`.

**src/components/call-detail:**
- Purpose: Contains sub-components for the main CallDetailDialog modal overlay (deep-linked via query parameters).
- Key files: `src/components/call-detail/CallOverviewTab.tsx`, `src/components/call-detail/CallTranscriptTab.tsx`.

**supabase/functions:**
- Purpose: Deno serverless edge functions containing backend logic, AI processing, and integrations sync code.
- Key files: `supabase/functions/mcp-server/index.ts` (JSON-RPC MCP gateway), `supabase/functions/summarize-call/index.ts` (OpenRouter GPT summarizer).

## Key File Locations

**Entry Points:**
- `src/main.tsx`: Mounts the React application.
- `src/App.tsx`: Manages React Router client paths and application providers.

**Configuration:**
- `src/integrations/supabase/client.ts`: Initializer for the Supabase client.
- `src/lib/query-config.ts`: Configures global query cache configurations and query keys.
- `vite.config.ts`: Configuration settings for the Vite bundler.
- `supabase/config.toml`: Defines deployment and routing limits for all backend Edge Functions.

**Database & Migration:**
- `supabase/migrations/`: Incremental SQL scripts handling schema changes, table structures, and Row Level Security (RLS) definitions.

## Naming Conventions

**Files:**
- React Components: `PascalCase.tsx` (e.g., `CallDetailDialog.tsx`, `SelectionButton.tsx`).
- Custom Hooks: `camelCase.ts` prefixed with `use` (e.g., `useWorkspaceRecordings.ts`).
- Services: `kebab-case.service.ts` (e.g., `recordings.service.ts`, `workspace-entries.service.ts`).
- Utilities/Helper Scripts: `camelCase.ts` or `kebab-case.ts` (e.g., `source-display.ts`).

**Directories:**
- Directories under `src/` (excluding components): `camelCase` or `kebab-case` (e.g., `call-detail`, `integrations`).
- UI Components directory: `PascalCase` or `kebab-case` based on feature scoping.

## Where to Add New Code

**Adding a New Backend Database Operation:**
1. **Service:** Add a dedicated function inside the matching service file in `src/services/` (or create a new service file `[domain].service.ts` if none exists).
2. **Hook:** Wrap the service call in a query/mutation hook inside `src/hooks/` to interface with React components. Add standard cache-invalidation query keys if executing a mutation.

**Adding a New UI Feature:**
1. **Components:** Create relevant modular components under `src/components/[feature-name]/`.
2. **Tab / View integration:** Integrate the feature into standard layouts or tabs (e.g. CallDetailDialog tabs under `src/components/call-detail/`).

**Adding a New Background Integration / Sync Flow:**
1. **Edge Function:** Create a new folder under `supabase/functions/[integration-name]/` with an `index.ts` processing sync payloads.
2. **Migration:** Write an incremental migration file in `supabase/migrations/` to add integration credentials, status flags, or OAuth state columns if necessary.

---

*Structure analysis: 2026-05-26*
