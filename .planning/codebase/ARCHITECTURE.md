# Architecture

**Analysis Date:** 2026-05-26

## Pattern Overview

**Overall:** Client-Server Single Page Application (SPA) with a Serverless Backend, vanity domain proxy layer, and a Model Context Protocol (MCP) public AI gateway.

**Key Characteristics:**
- **Decoupled Client & Server:** React SPA (Vite 5) frontend deployed to Vercel; serverless backend using Supabase Edge Functions (Deno) and PostgreSQL database.
- **Unified Organization Boundaries:** Enforces multi-tenant workspace/organization boundaries using Postgres Row-Level Security (RLS) and scoped session tokens.
- **Model Context Protocol (MCP) Server Gateway:** Public AI gateway serving JSON-RPC over HTTP, authenticated via custom OAuth 2.1, executing with service-role privileges under token-scoped security boundaries.
- **AI-Ready Not AI-Powered Design:** Zero AI processing in frontend; all AI analysis (OpenRouter GPT, Langfuse observability, credit systems) is offloaded to backend Edge Functions.

## Layers

Conceptual layers of the CallVault system and their responsibilities:

**Proxy Layer (Cloudflare Workers):**
- Purpose: Vanity domain routing, path rewriting, CORS handling, and OAuth discovery documents.
- Contains: Cloudflare Worker script `cloudflare/api-proxy/worker.ts` and wrangler configuration.
- Depends on: Supabase Edge Functions.
- Used by: External AI clients (Claude Desktop, Cursor, ChatGPT, Perplexity) hitting `api.callvaultai.com` or `mcp.callvaultai.com`.

**Presentation Layer (Vite React SPA):**
- Purpose: User workspace interface, transcript rendering, and search visualization.
- Contains: React components, lazy-loaded page route views (`src/pages/`), Radix UI/shadcn primitive wrappers (`src/components/ui/`), and CSS.
- Depends on: State Layer, Service Layer.
- Used by: Web browsers (end users).

**State Layer (TanStack Query & Zustand):**
- Purpose: Synchronous client-side stores and async server-state caching, invalidation, and optimistic UI mutations.
- Contains: Zustand stores (`src/stores/`), React Context (`src/contexts/`), custom hooks (`src/hooks/`), and QueryClient config (`src/lib/query-config.ts`).
- Depends on: Service Layer, Supabase Client.
- Used by: Presentation Layer.

**Service Layer (Frontend Modules):**
- Purpose: Decouple raw database queries and Edge Function requests from React components.
- Contains: Pure TypeScript service modules (`src/services/`) and the general API client (`src/lib/api-client.ts`).
- Depends on: Supabase Client SDK, API endpoints.
- Used by: State Layer (hooks and mutations).

**API Layer (Supabase Edge Functions):**
- Purpose: Handle transactional business logic, background integrations, and AI pipelines.
- Contains: Deno serverless edge functions (`supabase/functions/`), shared helpers (`supabase/functions/_shared/`).
- Depends on: Database Layer, OpenRouter/Vercel AI SDK, Integration APIs (Fathom, Zoom, Grain, etc.), Langfuse.
- Used by: Presentation Layer, Proxy Layer (external AI clients).

**Database Layer (PostgreSQL / Supabase):**
- Purpose: Single Source of Truth (SSoT) storage, transactional integrity, and database-level security policy enforcement.
- Contains: Database tables (`recordings`, `workspace_entries`, `mcp_tokens`, etc.), RLS policies, migrations, schema triggers, and RPC procedures.
- Depends on: PostgreSQL engine.
- Used by: API Layer, Service Layer (via client auth JWT).

## Data Flow

Description of key request and execution lifecycles:

**1. External MCP Tool Invocation:**
1. External client makes a JSON-RPC request to `mcp.callvaultai.com` with a Bearer OAuth token.
2. Cloudflare Worker proxies request to the `supabase/functions/mcp-server` edge function.
3. MCP Server validates the token scope (`workspace` or `organization`) against the `mcp_tokens` table.
4. If valid, the query is executed using the service-role client, filtered strictly to the token's scoped workspace or organization IDs.
5. If the tool is an AI tool (e.g., `get_sentiment`), the server checks the read-through cache on the `recordings` table. On miss, it calls OpenRouter, registers usage in `ai_usage_logs`, updates the cache, and logs the trace to Langfuse.
6. The JSON-RPC 2.0 response wrapper containing the markdown results is returned to the client.

**2. Meeting Sync & Integration Flow:**
1. External webhook trigger or sync trigger hits a connector-specific Edge Function (e.g., `zoom-webhook`, `grain-sync-recordings`).
2. Edge Function calls the shared Connector Pipeline (`_shared/connector-pipeline.ts`).
3. Meeting data is normalized into a canonical recording structure (`_shared/canonical-recording.ts`).
4. Duplication checker (`_shared/deduplication.ts`) verifies the meeting does not already exist.
5. Canonical record is written to the `recordings` table.
6. Routing Engine (`_shared/routing-engine.ts`) runs rule-based logic to auto-apply tags and route the recording to its target workspace.

**3. Frontend User Request (CRUD):**
1. React UI triggers an action (e.g., user moves a call).
2. UI component calls a mutation hook (e.g., `useWorkspaceAssignment`).
3. Hook calls a Service Layer function (`workspace-entries.service.ts`).
4. Service interacts with the database via `supabase-js` client containing the user's JWT.
5. Database checks RLS (ensuring the user has write permissions on both source and target workspaces) and performs updates.
6. React Query invalidates cached queries and does an optimistic update on the UI.

**State Management:**
- **Stateless Edge Functions:** Background processing is stateless, relying on the PostgreSQL database for all metadata and temporary states.
- **Client Zustand Stores:** Manages transient dashboard UI states (active panels, org context, sidebar toggle state, search queries).
- **React Query Cache:** Manages server-data synchrony, tracking query keys like `queryKeys.recordings.detail(id)` with a 5-minute stale time and 10-minute garbage collection.

## Key Abstractions

Core patterns and concepts utilized:

**Connector Pipeline (`supabase/functions/_shared/connector-pipeline.ts`):**
- Purpose: Normalized meeting ingestion flow across all 8 supported providers.
- Examples: `zoom-sync-meetings`, `fathom-reconcile`, `grain-sync-recordings`
- Pattern: Strategy pattern mapping provider-specific payloads to a unified format.

**Routing Engine (`supabase/functions/_shared/routing-engine.ts`):**
- Purpose: Automated organizing of recordings.
- Examples: `routingRules`, `apply-routing-rules`
- Pattern: Rules Engine evaluating user-configured conditions against import metadata.

**Service Layer (`src/services/*.service.ts`):**
- Purpose: Decoupled data access functions.
- Examples: `src/services/recordings.service.ts`, `src/services/folders.service.ts`
- Pattern: Module exports representing repositories for domain models.

**Zustand Store Double-Invocation (`src/stores/*.ts`):**
- Purpose: Safe Zustand v5 store instantiation.
- Examples: `src/stores/panelStore.ts`, `src/stores/preferencesStore.ts`
- Pattern: `create<T>()((set) => ({ ... }))` ensuring correct type matching.

**Read-Through Cache (`supabase/functions/mcp-server/index.ts` / `summarize-call/index.ts`):**
- Purpose: Optimize LLM API cost and latency for heavy analyses.
- Examples: `summary`, `action_items`, `sentiment`, `coaching_notes` columns in `recordings`
- Pattern: Checking cache columns on the `recordings` table before calling OpenRouter.

## Entry Points

Where system execution begins:

**Vite React SPA Entry:**
- Location: `src/main.tsx` → `src/App.tsx`
- Triggers: Browser loading the application.
- Responsibilities: Initialize Sentry, mount the React application container inside `#root` with `App.tsx`.

**Vite Dev Server:**
- Location: `vite.config.ts`
- Triggers: Command `npm run dev`.
- Responsibilities: Configures local asset bundling and runs dev server on port 3001.

**Supabase Edge Functions:**
- Location: `supabase/functions/*/index.ts`
- Triggers: Incoming HTTP requests (from webhook, SPA client, or Cloudflare Worker proxy).
- Responsibilities: CORS preflight verification, JWT validation, execution of backend logic.

**API Proxy Worker:**
- Location: `cloudflare/api-proxy/worker.ts`
- Triggers: DNS request to `api.callvaultai.com` or `mcp.callvaultai.com`.
- Responsibilities: Path rewriting, HTTP-to-edge function forwarding, serving `.well-known` discovery files.

**Database Schema & Migrations:**
- Location: `supabase/migrations/`
- Triggers: Deployment via CLI (`supabase db push`) or seed commands.
- Responsibilities: Establishing tables, views, RLS policies, indexing, and internal DB triggers.

## Error Handling

**Strategy:** Clean exception propagation with boundary-level trapping, Sentry integration, and user-friendly visual feedback.

**Patterns:**
- **Frontend Dialog Boundaries:** Global `ErrorBoundary` wrapper around `App.tsx` and custom page routes catches crashes and reports to Sentry.
- **Edge Function Safe JSON:** API functions wrap execution in a try-catch block, returning `500 Internal Server Error` with JSON error messages and logging detail to console, bypassing sensitive data.
- **Validation Fail-Fast:** Zod schemas are used in both frontend validation and backend requests (`safeParse`) to catch schema mismatches before executing downstream logic.

## Cross-Cutting Concerns

Aspects affecting multiple layers of the system:

**Logging & Observability:**
- **Telemetry:** Edge functions log LLM prompts, input/output tokens, and model choices to Langfuse via the custom tracer in `supabase/functions/_shared/langfuse.ts`.
- **Error Tracking:** React components and hooks report runtime client exceptions to Sentry via `@sentry/react`.

**Validation:**
- **Zod Schemas:** Enforce inputs at API boundaries (Edge Functions) and validate responses and configuration objects in the frontend.
- **Type Checking:** Strict TypeScript compilation (`tsc --noEmit`) verified via package scripts and IDE testing.

**Authentication & Security:**
- **OAuth 2.1 Server:** Houses a dynamic registration and consent mechanism allowing external AI systems to retrieve scoped bearer access tokens.
- **Supabase JWT:** Direct frontend-to-database calls use standard Supabase Auth tokens verified in the client context.
- **Row-Level Security (RLS):** All user-facing tables have RLS policies ensuring tenant isolation. Verified by a dedicated RLS regression test suite (`src/test/rls-regression.test.ts`) that runs in the CI pipeline.

---

*Architecture analysis: 2026-05-26*
