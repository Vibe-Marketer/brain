# Phase 05 — Pattern Map

**Phase:** 05 — connector-reliability-per-workspace-binding-unified-sync-tab
**Created:** 2026-05-31

## PATTERN MAPPING COMPLETE

## Files by Role

### Schema and Data Model

- `supabase/migrations/20260228000002_create_import_sources.sql` — original `import_sources` table, user-scoped RLS, legacy `(user_id, source_app)` uniqueness.
- `supabase/migrations/20260523053000_add_import_source_connection_metadata.sql` — provider-specific `connection_metadata` JSONB.
- New migration target: `supabase/migrations/*_add_import_source_workspace_binding.sql` — add CallVault destination workspace binding and backfill.

Pattern:

- Keep migration additive.
- Backfill existing rows to each user's default workspace.
- Do not mutate `recordings` or `workspace_entries` during connector binding migration.
- Preserve user-owned RLS policies.

### Connector Status and Setup

- `src/components/connectors/hooks/useConnector.ts` — canonical status hook; extend this rather than create a second source of truth.
- `src/components/connectors/registry/types.ts` — `ConnectorStatus`, `ConnectorRow`, setup/action contracts.
- `src/components/connectors/registry/connectorRegistry.ts` — provider metadata and adapter list.
- `src/components/connectors/ConnectorPanel.tsx` — setup/import card; should remain setup-first.
- `src/components/connectors/setup/ConnectorSetupCluster.tsx` and `ConnectorSetupClusterView.tsx` — setup flow; add workspace selection here or in its caller.

Pattern:

- Services and hooks own data access.
- Components consume hook/service state.
- Use compact rows for management; provider cards are not management pages.

### Import Source Services

- `src/services/import-sources.service.ts` — CRUD, disconnect, retry failed import, counts.
- `src/components/connectors/hooks/useConnector.ts` — currently fetches all `import_sources` once and derives per-source status.
- `src/lib/query-config.ts` — query key/invalidation patterns.

Pattern:

- Add pure service functions for list/update binding/disconnect.
- Add hook wrappers for TanStack Query mutations.
- Invalidate connector/import/call-list caches after mutations that affect visible state.

### Connector Pipeline and Provider Functions

- `supabase/functions/_shared/connector-pipeline.ts` — `ConnectorRecord.workspace_id` already controls explicit workspace placement.
- `supabase/functions/_shared/connector-function-utils.ts` — shared OAuth refresh, workspace membership validation, sync job execution, source status updates.
- `supabase/functions/_shared/oauth-url-handler.ts` and `oauth-callback-handler.ts` — shared OAuth source provisioning/activation path.
- Provider functions under `supabase/functions/{sync-meetings,zoom-sync-meetings,fireflies-sync-meetings,grain-sync-recordings,read-ai-sync-meetings,plaud-sync-recordings,youtube-import,webhook,zoom-webhook,fireflies-webhook,grain-webhook,read-ai-webhook}`.

Pattern:

- Resolve destination workspace once per source/sync request.
- Pass explicit `workspace_id` into `runPipeline()` when a connector binding exists.
- Use default workspace fallback only for legacy/unbound rows.
- Keep partial failures in `sync_jobs.failed_ids` and source `error_message`.

### SyncTab

- `src/services/sync-tab.service.ts` — migrate `fetchSyncedCalls()` from `fathom_calls` to canonical `recordings`.
- `src/hooks/useExistingTranscripts.ts` — add workspace-aware query key/args if SyncTab filters by workspace.
- `src/components/transcripts/SyncTab.tsx` — preserve Pane 3 workflow and existing selectors.
- `src/components/transcripts/SyncedTranscriptsSection.tsx` — keep table boundary and `Meeting[]` props.
- `src/components/transcript-library/TranscriptTable` — existing table presentation.

Pattern:

- Keep service output as `Meeting[]` to avoid a broad UI rewrite.
- Use `workspace_entries` to scope by workspace.
- Use `resolveShareUrl()` and UUID-safe tag assignment loading.

## Existing Tests to Extend

- `src/components/connectors/__tests__/deriveConnectorStatus.test.ts`
- `src/components/connectors/hooks/__tests__/useConnector.disconnect.test.ts`
- `src/components/connectors/setup/__tests__/ConnectorSetupCluster.test.tsx`
- `src/components/connectors/__tests__/ConnectorPanel.registry.test.ts`
- `src/services` tests where present for service mapping.
- Edge-function tests under provider directories and `_shared/__tests__`.

## Landmines

- `connection_metadata.workspace_id` is already provider-specific for PLAUD; do not use it as the CallVault destination binding.
- `import_sources` originally claimed one row per `(user_id, source_app)`; Phase 05 must preserve multiple accounts per provider.
- `recordings.share_url` is not a column.
- Fathom provider external IDs can be numeric; CallVault recording IDs must stay UUID-safe.
- `runPipeline()` only skips routing defaults when `record.workspace_id` is set.
