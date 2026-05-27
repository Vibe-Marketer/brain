---
last_mapped_commit: 5e223262c0f2cbc3f24c166d5ea56c793cbb6574
last_mapped_at: 2026-05-27
---

# Codebase Structure

**Analysis Date:** 2026-05-27

## Directory Layout

```text
brain/
|-- src/                       # React app source
|   |-- components/            # Shared UI and feature components
|   |-- config/                # Registries and product config
|   |-- contexts/              # React context providers
|   |-- hooks/                 # Query/mutation and UI orchestration hooks
|   |-- integrations/          # Supabase generated client/types
|   |-- lib/                   # Utilities and shared frontend logic
|   |-- pages/                 # Route-level components
|   |-- services/              # Supabase data access functions
|   |-- stores/                # Zustand stores
|   |-- test/                  # Test setup and integration helpers
|   `-- types/                 # Shared frontend types
|-- supabase/
|   |-- functions/             # Deno Edge Functions
|   |-- migrations/            # SQL schema/RLS/RPC migrations
|   `-- config.toml            # Supabase local/project config
|-- e2e/                       # Playwright E2E and API tests
|-- docs/                      # Product, architecture, security, and operations docs
|-- docs-site/                 # Documentation site content/assets
|-- scripts/                   # Local verification and utility scripts
|-- load-tests/                # k6 load tests
|-- browser-extensions/        # Browser connector extensions
|-- cloudflare/                # Cloudflare worker/proxy code
|-- .github/workflows/         # CI, security, deployment, uptime
|-- .planning/                 # GSD planning artifacts
|-- package.json               # npm manifest and scripts
|-- vite.config.ts             # Vite config
|-- vitest.config.ts           # Vitest config
|-- playwright.config.ts       # Playwright config
|-- eslint.config.js           # ESLint flat config
`-- README.md                  # Project overview
```

## Directory Purposes

**`src/pages/`:**
- Purpose: Route-level screens.
- Key files: `TranscriptsNew.tsx`, `ImportPage.tsx`, `Settings.tsx`, `OAuthCallback.tsx`, `CallDetailPage.tsx`, `SetupWizard.tsx`.
- Tests: `src/pages/__tests__/`.

**`src/components/`:**
- Purpose: Shared UI, layout, connector UI, import UI, transcript library, settings panels, analytics tabs.
- Key subdirectories:
  - `src/components/ui/` - local UI primitives.
  - `src/components/connectors/` - unified connector cards, setup, import wizard, registry.
  - `src/components/import/` - import dashboard and routing UI.
  - `src/components/transcripts/` - transcript and sync tab surfaces.
  - `src/components/panes/`, `src/components/layout/` - app shell/pane structure.

**`src/hooks/`:**
- Purpose: React hooks for data fetching, mutations, state orchestration, keyboard shortcuts, and feature-specific logic.
- Pattern: `useX.ts` files, with tests in `src/hooks/__tests__/`.
- Examples: `useImportSources.ts`, `useIntegrationSync.ts`, `useMcpTokens.ts`, `useOrganizations.ts`, `useDataMovement.ts`.

**`src/services/`:**
- Purpose: Flat exported async functions for Supabase tables/RPCs/functions.
- Pattern: `domain.service.ts`.
- Examples: `recordings.service.ts`, `import-sources.service.ts`, `mcp-tokens.service.ts`, `organizations.service.ts`, `data-movement.service.ts`.
- Tests: `src/services/__tests__/`.

**`src/lib/`:**
- Purpose: Pure helpers, query keys, connector source helpers, OAuth routing, export utilities, logging, validation.
- Examples: `query-config.ts`, `connector-sync-functions.ts`, `connector-capabilities.ts`, `integration-platforms.ts`, `oauth-callback-routing.ts`, `source-labels.ts`, `source-display.ts`.

**`src/config/`:**
- Purpose: Product-level typed registries.
- Key file: `src/config/source-registry.ts`.

**`src/stores/`:**
- Purpose: Zustand client/UI state.
- Key files: `orgContextStore.ts`, `preferencesStore.ts`, `panelStore.ts`, `searchStore.ts`, `routingRuleStore.ts`.

**`src/integrations/supabase/`:**
- Purpose: Supabase browser client and generated Database types.
- Key files: `client.ts`, `types.ts`.

**`supabase/functions/`:**
- Purpose: Deno Edge Functions for provider auth/sync/webhooks, AI actions, MCP, billing, routing, sharing, and import.
- Shared code: `supabase/functions/_shared/`.
- Function directories are kebab-case, each with `index.ts`.

**`supabase/migrations/`:**
- Purpose: SQL migrations for schema, RLS, RPCs, triggers, and feature changes.
- Naming: timestamp-prefixed SQL files.

**`e2e/`:**
- Purpose: Playwright tests, page objects, fixtures, screenshots.
- API-only MCP smoke test: `e2e/mcp-server.spec.ts`.

**`docs/`:**
- Purpose: Architecture, ADRs, operations, audits, integration docs, security docs, reference material.
- UI design guidance is in `docs/design/`.

## Key File Locations

**Entry Points:**
- `src/main.tsx` - Browser app mount.
- `src/App.tsx` - Provider tree and route definitions.
- `supabase/functions/*/index.ts` - Edge Function entries.
- `supabase/functions/mcp-server/index.ts` - MCP JSON-RPC server.

**Configuration:**
- `package.json` - Scripts and npm dependencies.
- `vite.config.ts` - Vite, aliases, Sentry, dev server.
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` - TS compiler config.
- `vitest.config.ts` - Unit/integration test config.
- `playwright.config.ts` - E2E/API test config.
- `eslint.config.js` - Lint config and ignored directories.
- `tailwind.config.ts`, `postcss.config.js` - Styling config.
- `supabase/config.toml` - Supabase local/project config.

**Core Logic:**
- `src/components/connectors/registry/connectorRegistry.ts` - Connector adapter registry.
- `src/config/source-registry.ts` - Source metadata and Edge Function names.
- `supabase/functions/_shared/connector-pipeline.ts` - Dedup/routing/insert pipeline.
- `supabase/functions/_shared/canonical-recording.ts` - Canonical provider-recording contract.
- `src/lib/query-config.ts` - Query keys and invalidation helpers.
- `src/stores/orgContextStore.ts` - Active org/workspace/folder state.

**Testing:**
- `src/test/setup.ts` - Vitest setup.
- `src/**/*.test.ts`, `src/**/*.test.tsx` - Unit/component tests.
- `src/services/__tests__/*.integration.test.ts` - Service integration tests.
- `supabase/functions/**/__tests__/*.test.ts` - Edge Function tests.
- `e2e/*.spec.ts` - Playwright E2E/API tests.

**Documentation:**
- `README.md` - Product and stack overview.
- `CLAUDE.md`, `src/CLAUDE.md`, `supabase/CLAUDE.md` - AI/developer guidance.
- `docs/adr/` - ADRs.
- `docs/architecture/`, `docs/operations/`, `docs/security/`, `docs/integrations/` - subsystem docs.

## Naming Conventions

**Files:**
- React page/component files often use PascalCase: `ImportPage.tsx`, `ConnectorPanel.tsx`.
- Services use kebab/lowercase domain plus `.service.ts`: `mcp-tokens.service.ts`.
- Hooks use `useX.ts`: `useImportSources.ts`, `useMcpTokens.ts`.
- Tests use `.test.ts` / `.test.tsx`, with integration tests using `.integration.test.ts`.
- Edge Function directories use kebab-case: `read-ai-sync-meetings/`.

**Directories:**
- Feature/component directories are descriptive and often plural: `components/connectors`, `services`, `hooks`, `pages`.
- Test directories use `__tests__` colocated with the code they cover.

**Special Patterns:**
- `index.ts` is used for Edge Function entries and some component/setup exports.
- `registry/` directories centralize typed adapters and metadata.
- `_shared/` under `supabase/functions/` is shared Deno code for Edge Functions.

## Where to Add New Code

**New Connector:**
- Add source metadata in `src/config/source-registry.ts`.
- Add adapter in `src/components/connectors/registry/adapters/<source>.ts`.
- Register adapter in `src/components/connectors/registry/connectorRegistry.ts`.
- Add sync/search function mapping in `src/lib/connector-sync-functions.ts` if applicable.
- Add Edge Functions under `supabase/functions/<source>-*/`.
- Add shared provider client/connector code under `supabase/functions/_shared/` when reused.
- Add tests near adapters, hooks, and Edge Functions.

**New Frontend Page:**
- Add route component in `src/pages/`.
- Wire route in `src/App.tsx`.
- Use `Layout` unless the flow intentionally needs a full-page shell, as setup/auth do.

**New Supabase Table/RPC:**
- Add SQL migration in `supabase/migrations/`.
- Regenerate `src/integrations/supabase/types.ts`.
- Add service function in `src/services/`.
- Add hook in `src/hooks/` if consumed by React.
- Add RLS/integration tests where tenant isolation matters.

**New Shared UI:**
- Use `src/components/ui/` for primitives.
- Use feature-specific subdirectories for domain UI.
- Follow existing design system in docs and local component variants.

## Special Directories

**`.planning/`:**
- Purpose: GSD project artifacts and codebase maps.
- Committed/tracked depending on `.planning/config.json` and workflow settings.

**`dist/`, `coverage/`, `node_modules/`:**
- Generated outputs; ignored by lint and not source of truth.

**`.env*`:**
- Local/environment secret files. Do not quote values into docs, tests, or commits.

---
*Structure analysis: 2026-05-27*
*Update when physical layout, registries, or source placement conventions change*
