---
last_mapped_commit: 5e223262c0f2cbc3f24c166d5ea56c793cbb6574
last_mapped_at: 2026-05-27
---

# Codebase Concerns

**Analysis Date:** 2026-05-27

## Tech Debt

**Legacy source and workspace naming remains mixed:**
- Issue: The product has moved through bank/vault/workspace/source architecture changes, and compatibility paths remain.
- Files: `src/services/sync-tab.service.ts`, `src/config/source-registry.ts`, `supabase/migrations/20260301000001_rename_vaults_to_workspaces.sql`, older migrations.
- Impact: New work can accidentally use legacy Fathom/raw/vault assumptions instead of canonical `recordings`, `workspaces`, and connector registries.
- Fix approach: Prefer canonical tables/registries for new work; isolate legacy compatibility paths and add tests around any changed fallback.

**Connector behavior spans many files:**
- Issue: Adding or changing a connector often touches registry metadata, adapter methods, source registry, sync-function mapping, Edge Functions, shared pipeline code, and tests.
- Files: `src/components/connectors/registry/`, `src/config/source-registry.ts`, `src/lib/connector-sync-functions.ts`, `supabase/functions/`.
- Impact: Partial integration can appear in UI while fetch/sync/webhook/import is incomplete.
- Fix approach: Treat connector acceptance as registry + UI + Edge Function + canonical pipeline + tests + live/runtime verification.

**Type strictness is relaxed:**
- Issue: `tsconfig.json` sets `noImplicitAny: false` and `strictNullChecks: false`.
- Impact: Null/undefined and implicit any mistakes can survive typecheck.
- Fix approach: Be explicit at API boundaries, prefer generated Supabase types, and add focused tests around new data-shape assumptions.

**Generated Supabase types can drift:**
- Issue: Many migrations exist, and frontend code depends on `src/integrations/supabase/types.ts`.
- Impact: Types may lag schema changes unless `npm run gen:types` is run after migrations.
- Fix approach: Regenerate types after schema work and verify affected services/hooks compile.

## Known Bugs / Historical Risk Areas

**Cache invalidation has caused stale UI regressions:**
- Symptoms: Call list, workspace, folder, or tag UI can remain stale after mutations.
- Evidence: `src/lib/query-config.ts` contains a detailed cache invalidation audit and unified helper.
- Safe modification: Use `invalidateCallListCaches` and existing query key factories rather than inventing new keys.
- Test coverage: Many hooks have focused tests, but new mutation paths still need explicit invalidation tests.

**RLS and cross-org isolation are high-risk:**
- Symptoms: Cross-org data bleed or permission errors when org/workspace context changes.
- Evidence: `src/contexts/AuthContext.tsx`, `src/test/rls-regression.test.ts`, and many RLS migrations.
- Safe modification: Include `organization_id` filters in frontend reads, clear/invalidate caches on org changes, and run RLS regression for access-control work.

**OAuth and webhook flows are hard to prove by unit tests alone:**
- Symptoms: Code can compile but fail on provider redirects, token refresh, webhook signature validation, or background sync.
- Files: Provider-specific functions under `supabase/functions/*oauth*`, `*webhook*`, `*sync*`.
- Safe modification: Add invariant/unit tests, then perform live browser/provider or function-level verification for release-critical connector work.

## Security Considerations

**Local secret files exist in the working tree:**
- Risk: `.env` and `.auto-claude/.env` contain sensitive-looking local credentials/tokens in this checkout.
- Current mitigation: Docs and generated files should reference only variable names. `.env.example` is safe reference material.
- Recommendations: Confirm these files are gitignored and rotate any exposed real credentials if they were ever committed, shared, or logged outside the local machine.

**Service-role Edge Functions bypass RLS:**
- Risk: Any missing auth/scope/provider validation can become a cross-tenant vulnerability.
- Files: Many `supabase/functions/*/index.ts`, especially `mcp-server`, webhooks, billing, connector sync.
- Current mitigation: Shared `authenticateRequest`, signature checks, token scope checks, and RLS regression tests.
- Recommendations: For new service-role code, document why service role is required and add tests for unauthorized/cross-org cases.

**MCP access control is application-enforced:**
- Risk: `supabase/functions/mcp-server/index.ts` uses service-role queries and relies on token scope/category checks.
- Current mitigation: Token metadata validation, workspace/org scope, tool category gating, paid-tier checks.
- Recommendations: Keep MCP tests current when adding tools; avoid adding direct table queries without scope filters.

**OAuth token encryption has fallback behavior:**
- Risk: `_shared/oauth-encrypt.ts` falls back to plaintext reads when encryption key/RPC fails.
- Current mitigation: Backward compatibility for pre-encryption rows.
- Recommendations: Avoid adding new plaintext token paths; monitor/fix decryption failures rather than accepting fallback silently.

## Performance Bottlenecks

**Large call lists and metadata joins:**
- Problem: Transcript library touches recordings, workspace entries, folders, tags, participants, and source metadata.
- Evidence: `src/lib/query-config.ts` has cache-staleness history; services include URL-size and join comments.
- Improvement path: Keep server-side joins/RPCs for large relation lookups and use paginated queries.

**Global search and MCP tools can be expensive:**
- Problem: MCP exposes search/list/detail/AI tools over potentially large transcript data.
- Files: `supabase/functions/global-search/`, `supabase/functions/mcp-server/index.ts`.
- Improvement path: Keep pagination, scope filters, category gating, and AI usage enforcement intact.

**Connector sync jobs can be long-running:**
- Problem: Provider sync functions perform remote fetches, transforms, inserts, and optional AI actions.
- Files: `supabase/functions/zoom-sync-meetings/index.ts`, `supabase/functions/read-ai-sync-meetings/index.ts`, `supabase/functions/fathom-reconcile/index.ts`.
- Improvement path: Maintain `sync_jobs` progress tracking, retryable failure handling, and background work patterns.

## Fragile Areas

**Connector registry parity:**
- Why fragile: User-facing connector behavior derives from multiple registries and adapter capabilities.
- Common failures: Connector appears in one surface but not another, sync function missing, setup kind mismatch, import wizard capability mismatch.
- Safe modification: Update registry, source config, adapter tests, connector capability tests, onboarding/import tests together.

**Org/workspace context persistence:**
- Why fragile: `src/stores/orgContextStore.ts` persists org/workspace state and syncs across tabs.
- Common failures: Stale workspace/folder after org switch, cache data from previous org.
- Safe modification: Preserve org-switch reset semantics and cache clearing in `AuthContext`.

**Drag/drop in transcript library:**
- Why fragile: `src/pages/TranscriptsNew.tsx` shares one DnD context for workspace reordering and recording moves/folder assignment.
- Common failures: Workspace drags falling through into recording mutation branches.
- Safe modification: Preserve active data type guards and add regression tests for drag isolation.

**Provider webhooks:**
- Why fragile: Incoming payloads and signatures vary by provider; idempotency and user/source lookup differ.
- Safe modification: Do not copy webhook code blindly. Use provider-specific validation and shared canonical pipeline only after payload normalization.

## Dependencies at Risk

**Supabase API surface:**
- Risk: Generated types, RLS semantics, Edge Function runtime, and CLI behavior can drift.
- Impact: DB migrations and Edge Functions may compile locally but fail in deployed runtime.
- Mitigation: Run type generation, targeted Edge Function tests, and live Supabase verification for schema/auth changes.

**Provider APIs:**
- Risk: Fathom, Zoom, Fireflies, Read.ai, Grain, Plaud, YouTube endpoints/scopes/payloads can change.
- Impact: Sync/import/webhooks fail despite frontend code passing.
- Mitigation: Keep provider clients isolated in `_shared/*client.ts` files and run `npm run verify:connectors:live` where relevant.

**AI SDK/OpenRouter:**
- Risk: Model/provider API changes can affect summaries, MCP AI tools, and generated content.
- Impact: AI features fail or produce unexpected schema.
- Mitigation: Keep Zod validation and usage enforcement around AI outputs.

## Test Coverage Gaps

**Runtime connector proof:**
- What's not fully covered: Real provider OAuth/webhook/sync paths for every connector in live runtime.
- Risk: Code/test presence can overstate readiness.
- Priority: High for connector-facing work.

**Security boundaries for new service-role paths:**
- What's not fully covered: Every future service-role function needs explicit unauthorized and cross-org tests.
- Risk: Tenant isolation regression.
- Priority: High.

**Visual/UI regressions:**
- What's not fully covered: Every compact pane/card/table state across desktop/mobile.
- Risk: Layout overlap or hidden controls after UI changes.
- Priority: Medium to high for frontend changes; use Playwright screenshots for significant UI work.

---
*Concerns audit: 2026-05-27*
*Update as risks are resolved or new fragile areas are found*
