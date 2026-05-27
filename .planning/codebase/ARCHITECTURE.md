---
last_mapped_commit: 5e223262c0f2cbc3f24c166d5ea56c793cbb6574
last_mapped_at: 2026-05-27
---

# Architecture

**Analysis Date:** 2026-05-27

## Pattern Overview

**Overall:** Supabase-backed React SaaS with serverless connector pipeline.

**Key Characteristics:**
- Browser-first React app with protected routes and client-side data fetching.
- Supabase Edge Functions own privileged provider/API work.
- PostgreSQL/RLS is the tenant isolation foundation.
- Connector registry and source registry drive import UI and connector behavior.
- Canonical `recordings` table is the main product data model; source-specific raw tables preserve provider details.
- MCP server exposes the same call library as JSON-RPC tools with scoped token access.

## Layers

**Route and Shell Layer:**
- Purpose: Defines app navigation, protected routes, lazy-loaded pages, and layout.
- Contains: `src/App.tsx`, `src/components/Layout.tsx`, route pages under `src/pages/`.
- Depends on: Auth context, React Router, shared layout components.
- Used by: Browser entry point in `src/main.tsx`.

**UI Component Layer:**
- Purpose: Reusable UI primitives and feature-specific views.
- Contains: `src/components/ui/`, `src/components/connectors/`, `src/components/import/`, `src/components/transcripts/`, `src/components/settings/`, `src/components/panes/`.
- Depends on: hooks, stores, Radix/Tailwind/Remix Icon.
- Used by: Pages and feature shells.

**Hook Layer:**
- Purpose: Encapsulates React Query calls, mutations, local orchestration, and feature state access.
- Contains: `src/hooks/useImportSources.ts`, `src/hooks/useMcpTokens.ts`, `src/hooks/useOrganizations.ts`, `src/hooks/useDataMovement.ts`, `src/hooks/useIntegrationSync.ts`, etc.
- Depends on: services, query keys, auth/org context, stores.
- Used by: Pages and components.

**Service Layer:**
- Purpose: Thin data access and mutation functions around Supabase client calls.
- Contains: `src/services/*.service.ts`.
- Depends on: `src/integrations/supabase/client.ts`, helpers in `src/lib/`.
- Used by: hooks and occasional page-level orchestration.

**Registry and Utility Layer:**
- Purpose: Centralized metadata, capability checks, display names, source routing, error formatting, and reusable utilities.
- Contains: `src/config/source-registry.ts`, `src/components/connectors/registry/`, `src/lib/query-config.ts`, `src/lib/connector-sync-functions.ts`, `src/lib/source-labels.ts`, `src/lib/source-display.ts`.
- Depends on: mostly pure TypeScript, occasional Supabase helpers.
- Used by: hooks, pages, connector UI, Edge Function contracts.

**Backend Edge Function Layer:**
- Purpose: Authenticated server-side work that needs service role, provider secrets, webhook verification, AI calls, or long-running sync behavior.
- Contains: `supabase/functions/*/index.ts` and shared helpers in `supabase/functions/_shared/`.
- Depends on: Supabase service role, provider APIs, environment secrets, shared connector pipeline.
- Used by: frontend `supabase.functions.invoke`, provider webhooks, OAuth redirects, MCP clients.

**Database Layer:**
- Purpose: Tenant data, canonical recordings, raw source data, RLS policies, RPCs, triggers, and migrations.
- Contains: `supabase/migrations/*.sql`, generated types in `src/integrations/supabase/types.ts`.
- Depends on: Supabase/Postgres runtime.
- Used by: frontend client under RLS and Edge Functions under service role.

## Data Flow

**Browser App Load:**
1. `src/main.tsx` mounts `src/App.tsx`.
2. `QueryClientProvider`, `AuthProvider`, `ThemeProvider`, and realtime/debug providers initialize global app state.
3. Protected routes use Supabase Auth session state from `src/contexts/AuthContext.tsx`.
4. `Layout` renders top navigation and fixed app viewport.
5. Pages call hooks, hooks call services, services call Supabase tables/functions.

**Connector Setup and Import:**
1. A connector card is rendered from `src/components/connectors/registry/connectorRegistry.ts`.
2. Adapter methods start OAuth, save credentials, fetch available calls, or import selected calls.
3. Edge Functions authenticate the user with `_shared/auth.ts` or provider-specific webhook/auth logic.
4. Provider payloads normalize into `CanonicalRecording` or `ConnectorRecord`.
5. `_shared/connector-pipeline.ts` deduplicates by user/source/external id, resolves routing defaults/rules, inserts into `recordings`, and creates `workspace_entries`.
6. Frontend invalidates query keys from `src/lib/query-config.ts`.

**OAuth Callback:**
1. Provider redirects to `/oauth/callback/*`.
2. `src/pages/OAuthCallback.tsx` and `src/lib/oauth-callback-routing.ts` route the provider callback.
3. Provider-specific Edge Function exchanges code/token and updates `import_sources` or legacy `user_settings`.
4. Some callbacks kick off background sync/reconcile/webhook registration.

**Call Library Use:**
1. `src/pages/TranscriptsNew.tsx` coordinates active tab, workspace/folder context, search, and drag/drop.
2. `src/components/transcripts/TranscriptsTab` and related hooks fetch recordings, tags, folders, workspace entries, and counts.
3. Mutations call service functions or Edge Functions, then invalidate centralized cache hubs.

**MCP Request:**
1. Client sends JSON-RPC request to `supabase/functions/mcp-server/index.ts`.
2. MCP server validates bearer token or OAuth JWT and loads token scope.
3. Tool category gating and tier checks run before tool execution.
4. Service-role Supabase queries are filtered by token organization/workspace scope in code.
5. Response is returned as MCP content or structured JSON-RPC error.

## Key Abstractions

**Connector Adapter:**
- Purpose: Per-source UI and action contract.
- Examples: `src/components/connectors/registry/adapters/fathom.ts`, `zoom.ts`, `read-ai.ts`.
- Pattern: Flat object implementing `ConnectorAdapter`; registry sorts and exposes adapters.

**Source Registry:**
- Purpose: Canonical list of source ids, labels, auth modes, Edge Function names, and maturity.
- Location: `src/config/source-registry.ts`.
- Pattern: Typed constant array with derived union types.

**Canonical Recording:**
- Purpose: Normal form for provider recordings before database insertion.
- Location: `supabase/functions/_shared/canonical-recording.ts`.
- Pattern: Validation plus conversion to connector pipeline input.

**Connector Pipeline:**
- Purpose: Shared dedup, routing, insert, participant, workspace-entry, and progress mechanics.
- Location: `supabase/functions/_shared/connector-pipeline.ts`.
- Pattern: Flat exported functions, not classes.

**Query Keys and Cache Invalidation:**
- Purpose: Avoid stale UI across call list, workspace, folder, tag, and import mutations.
- Location: `src/lib/query-config.ts`.
- Pattern: Central query key factory plus helper invalidators.

**Org Context Store:**
- Purpose: Active organization/workspace/folder state with persistence and cross-tab sync.
- Location: `src/stores/orgContextStore.ts`.
- Pattern: Zustand store, `localStorage` persistence, storage-event propagation.

## Entry Points

**Frontend:**
- `src/main.tsx` - Browser mount.
- `src/App.tsx` - Provider tree and route table.
- `src/pages/TranscriptsNew.tsx` - Main call library page.
- `src/pages/ImportPage.tsx` - Import and connector setup surface.
- `src/pages/Settings.tsx` - Settings categories including MCP/connectors/billing.

**Backend:**
- `supabase/functions/*/index.ts` - One Edge Function per API, connector operation, webhook, or AI action.
- `supabase/functions/mcp-server/index.ts` - MCP JSON-RPC endpoint.
- `supabase/functions/_shared/*` - Cross-function helpers.

**Database:**
- `supabase/migrations/00000000000000_consolidated_schema.sql` - Consolidated baseline.
- Later dated migrations layer feature-specific schema/RLS/RPC changes.

## Error Handling

**Strategy:** Throw or return explicit errors at boundaries; toast in UI; structured JSON in Edge Functions; log server-side detail without exposing secrets.

**Patterns:**
- Services throw `Error` with Supabase error messages after failed queries.
- Hooks map mutation errors to `sonner` toast messages.
- Edge Functions return JSON responses with status codes and CORS headers, often after shared auth helper checks.
- Webhooks return generic caller errors and log internal details.
- Connector pipeline fail-opens dedup query errors but fails closed when workspace-entry visibility cannot be verified.

## Cross-Cutting Concerns

**Authentication:**
- Supabase Auth for app users.
- Provider OAuth/token flows in Edge Functions.
- MCP bearer token/OAuth handling in `mcp-server`.

**Authorization:**
- RLS for frontend client access.
- Service-role Edge Functions must manually validate user, provider signature, token scope, and org/workspace membership.
- Security definer RPCs are used where RLS would block necessary controlled operations.

**Validation:**
- Zod in AI/MCP surfaces.
- Canonical recording validation before connector insertion.
- UI forms rely on typed adapter metadata and local validation helpers.

**State:**
- TanStack Query for server state.
- Zustand for org context, panels, routing rule UI, and search modal state.
- `localStorage` for Supabase session, theme, org context, and cross-tab signals.

**Observability:**
- Sentry for frontend errors and sourcemaps.
- Console logging in Edge Functions.
- Langfuse helper for LLM tracing.

---
*Architecture analysis: 2026-05-27*
*Update when core data flow, tenant model, connector pipeline, or route structure changes*
