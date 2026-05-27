---
last_mapped_commit: 5e223262c0f2cbc3f24c166d5ea56c793cbb6574
last_mapped_at: 2026-05-27
---

# Coding Conventions

**Analysis Date:** 2026-05-27

## Naming Patterns

**Files:**
- React components and pages use PascalCase `.tsx`: `ConnectorPanel.tsx`, `TranscriptsNew.tsx`.
- Hooks use `useX.ts`: `useImportSources.ts`, `useOrgContext.ts`.
- Services use lower/kebab domain names plus `.service.ts`: `recordings.service.ts`, `mcp-tokens.service.ts`.
- Tests are colocated in `__tests__` directories and named `.test.ts`, `.test.tsx`, or `.integration.test.ts`.
- Supabase Edge Function directories are kebab-case and contain `index.ts`.

**Functions:**
- camelCase for functions and handlers.
- React event handlers use `handleX` names: `handleTabChange`, `handleDragEnd`.
- Service functions are verb-first and exported directly: `getImportSources`, `toggleSourceActive`, `disconnectImportSource`.
- Edge Function helpers are flat exported functions rather than classes.

**Variables and Constants:**
- camelCase for local variables and state.
- UPPER_SNAKE_CASE for module constants such as `RECORDING_DETAIL_COLUMNS`, `POLAR_PRODUCT_IDS`, `TEAM_MEMBER_LIMIT`.
- Database fields and payload keys stay snake_case when matching Supabase rows.

**Types:**
- PascalCase interfaces and type aliases: `ImportSource`, `ConnectorAdapter`, `CanonicalRecording`.
- Generated Supabase types are accessed via `Database['public']['Tables'][...]`.
- Registry-derived union types are preferred for stable source IDs.

## Code Style

**Formatting:**
- No Prettier config was identified; formatting follows existing mixed style.
- Semicolons are common in React/config files, but some service files omit them. Match the surrounding file.
- Quotes are mixed between single and double; match the file being edited.
- Prefer concise guard clauses and typed object parameters where existing code does.

**Linting:**
- ESLint flat config in `eslint.config.js`.
- `@typescript-eslint/no-explicit-any`, unused vars, and TS comment bans are warnings.
- `supabase/functions/**`, `e2e/**`, `scripts/**`, `.planning/**`, and generated/scratch dirs are lint-ignored.
- Run: `npm run lint`.

**TypeScript Strictness:**
- `strictNullChecks` is false and `noImplicitAny` is false in `tsconfig.json`.
- Do not use that as permission to add loose code; local patterns still prefer explicit types at boundaries.
- Supabase generated types can be stale after migrations; regenerate with `npm run gen:types`.

## Import Organization

**Typical Order:**
1. React and external packages.
2. Internal aliases such as `@/components`, `@/hooks`, `@/services`, `@/lib`.
3. Relative imports.
4. Type imports via `import type`.

**Path Aliases:**
- `@/` maps to `src/`.
- `@shared/` maps to `supabase/functions/_shared/`, but only zero-dependency shared utilities are safe for Vite-bundled client imports.

**Connector Imports:**
- Adapter files import shared helper functions from `adapter-helpers.ts` when possible.
- Registry imports all adapters explicitly and builds maps from `ALL_ADAPTERS`.

## Error Handling

**Frontend Services:**
- Throw `Error` with domain-specific messages when Supabase returns an error.
- Return empty arrays/objects for unauthenticated read paths when that is established behavior.
- Keep Supabase calls in services/hooks instead of scattering DB queries through UI where possible.

**Hooks/UI:**
- Mutations surface errors with `sonner` toasts.
- Use query invalidation helpers from `src/lib/query-config.ts` or connector invalidation helpers rather than ad hoc cache updates.

**Edge Functions:**
- Authenticate early with `_shared/auth.ts` unless explicitly exempt, such as server-to-server webhooks or MCP token handling.
- Return JSON with explicit status and content type.
- Log detailed errors server-side; return generic errors for security-sensitive failures.
- Provider webhooks should verify signatures and dedupe with `processed_webhooks` where applicable.

## Logging

**Frontend:**
- Use `src/lib/logger.ts` rather than direct noisy console logging in app code.
- Existing code logs auth and cache state transitions in `src/contexts/AuthContext.tsx`.

**Edge Functions:**
- `console.log`, `console.warn`, and `console.error` are common.
- Never log secret values, access tokens, refresh tokens, webhook secrets, or raw auth headers.

## Comments

**When to Comment:**
- Comments often capture locked decisions, migration phase context, security invariants, or known gotchas.
- Good examples: org-switch cache clearing in `src/contexts/AuthContext.tsx`, connector registry guidance in `src/components/connectors/registry/connectorRegistry.ts`, and MCP host/OAuth notes in `supabase/functions/mcp-server/index.ts`.
- Avoid explaining obvious mechanics.

**TODOs and Phase Notes:**
- Historical phase/bug comments are common and useful, but new TODOs should name the missing follow-up and preferably point to a plan/issue.

## Function and Module Design

**Services:**
- Use flat exported async functions, not classes.
- Keep domain logic close to its service/hook and use shared `src/lib/` helpers when logic crosses multiple domains.

**Hooks:**
- Use TanStack Query `useQuery` / `useMutation`.
- Query keys should come from `queryKeys` in `src/lib/query-config.ts`.
- Mutations should invalidate all affected caches on success or settled state.

**React Components:**
- Prefer existing UI primitives and feature components.
- Pages coordinate layout/state; components render focused UI.
- Avoid introducing one-off styling systems; read `docs/design/brand-guidelines-v4.4.md` before UI work.

**Edge Functions:**
- Keep shared code in `supabase/functions/_shared/` when multiple functions need the same behavior.
- Use canonical recording and connector pipeline helpers for recording imports.
- Edge Function code runs in Deno; avoid Node-only APIs.

## Security Conventions

- Treat service-role access as privileged and manually validate user/provider/scope before database reads or writes.
- Keep RLS in mind when adding frontend queries; if a frontend query requires bypassing RLS, move it behind a tightly validated Edge Function or RPC.
- Mention environment variable names only. Do not document local values.
- Token encryption helpers are the preferred token read path for OAuth-enabled connectors.

---
*Convention analysis: 2026-05-27*
*Update when style, test, auth, or connector patterns change*
