---
phase: 05-connector-reliability-per-workspace-binding-unified-sync-tab
plan: 01
subsystem: database, connectors, frontend
tags: [import_sources, workspace-binding, connectors, supabase, tanstack-query]
requires:
  - phase: 05
    provides: Phase 05 context and workspace-binding decisions
provides:
  - import_sources destination workspace schema and default backfill
  - workspace-aware connector status model
  - future landing workspace update service and hook
affects: [phase-05, connector-ui, sync-routing, connections-panel]
tech-stack:
  added: []
  patterns: [service-hook-separation, connector-bundle-status, future-landing-workspace]
key-files:
  created:
    - supabase/migrations/20260531090000_add_import_source_workspace_binding.sql
  modified:
    - src/components/connectors/registry/types.ts
    - src/components/connectors/hooks/useConnector.ts
    - src/services/import-sources.service.ts
    - src/hooks/useImportSources.ts
    - src/components/connectors/__tests__/deriveConnectorStatus.test.ts
    - src/types/supabase.ts
key-decisions:
  - "Connector workspace binding is stored on import_sources.workspace_id as a CallVault destination workspace, separate from provider metadata."
  - "Historical recordings and workspace_entries are not changed by the migration or binding mutation."
  - "Connector lifecycle status distinguishes passive states from action-needed reconnect/error states."
patterns-established:
  - "Connector status rows include workspaceId/workspaceName plus normalized lifecycle labels for Connections UI."
  - "Workspace binding changes use a hook mutation that invalidates connector, import, and call-list caches on settled."
requirements-completed: [CON-02, CON-04]
duration: 28min
completed: 2026-05-31
---

# Phase 05-01: Workspace Binding Schema and Status Contract Summary

**Connector rows now carry a future landing workspace, and frontend connector status exposes that workspace plus action-needed lifecycle state.**

## Performance

- **Duration:** 28 min
- **Started:** 2026-05-31T07:03:00Z
- **Completed:** 2026-05-31T07:31:39Z
- **Tasks:** 3/3
- **Files modified:** 7

## Accomplishments

- Added `import_sources.workspace_id` with default/home workspace backfill for existing connector rows.
- Replaced legacy provider uniqueness that blocked multiple provider accounts with account/workspace-aware indexing.
- Extended `ConnectorRow` and `ConnectorStatus` with workspace display fields, lifecycle status, action-needed state, and passive retry metadata.
- Added `updateImportSourceWorkspace()` and `useUpdateImportSourceWorkspace()` for changing only the future landing workspace.
- Pushed the migration to the remote Supabase database successfully.

## Task Commits

1. **Task 1: Add workspace binding schema and default-workspace backfill** - `9117537b` (`feat(05-01)`)
2. **Task 2: Extend connector status types, service reads, and binding mutation APIs** - `96ecf1c8` (`feat(05-01)`)
3. **Task 3: Run the blocking schema push before plan verification** - command gate, no file commit

## Files Created/Modified

- `supabase/migrations/20260531090000_add_import_source_workspace_binding.sql` - Adds destination workspace binding, indexes, default backfill, and multi-account preservation.
- `src/components/connectors/registry/types.ts` - Adds workspace and lifecycle fields to connector status types.
- `src/components/connectors/hooks/useConnector.ts` - Loads workspace labels and derives normalized lifecycle status.
- `src/services/import-sources.service.ts` - Reads workspace ids, exposes workspace-label listing, and updates connector future landing workspace.
- `src/hooks/useImportSources.ts` - Adds workspace update mutation with settled cache invalidation.
- `src/components/connectors/__tests__/deriveConnectorStatus.test.ts` - Covers bound workspace display, multiple rows, passive rate limit, refreshable expired tokens, and reconnect-required state.
- `src/types/supabase.ts` - Updates generated import_sources typing for workspace and connection metadata fields.

## Decisions Made

- The migration backfills from the user's default workspace via `organization_memberships`, with a defensive oldest-workspace fallback for legacy tenants.
- `connection_metadata.workspace_id` remains provider-specific; CallVault destination routing uses only `import_sources.workspace_id`.
- Refreshable providers with an expired short-lived access token remain `connected`; refresh failure/error text is what promotes the UI to `Reconnect required`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Updated stale generated Supabase types**
- **Found during:** Task 2
- **Issue:** `src/types/supabase.ts` did not include current `import_sources` metadata fields or the new `workspace_id`, which would make typed service updates brittle.
- **Fix:** Added `connection_metadata`, `webhook_path_token`, `workspace_id`, and the workspace relationship to the generated type file.
- **Files modified:** `src/types/supabase.ts`
- **Verification:** `npm run build` exited 0.
- **Committed in:** `96ecf1c8`

---

**Total deviations:** 1 auto-fixed missing-critical type update.
**Impact on plan:** Required for type safety. No product-scope expansion.

## Issues Encountered

- `supabase db push` reported the old table-level `import_sources_user_id_source_app_key` constraint did not exist and skipped dropping it. This was expected because the live schema had already moved away from that table constraint; the migration still applied successfully.
- Supabase CLI reported an available update from `v2.101.0` to `v2.102.0`; not relevant to this plan.

## Verification

- `rg -n "workspace_id|recordings|workspace_entries|UNIQUE|CREATE.*INDEX" supabase/migrations/20260531090000_add_import_source_workspace_binding.sql` confirmed schema fields, indexes, and no data movement outside comments.
- `npm test -- --run src/components/connectors/__tests__/deriveConnectorStatus.test.ts` exited 0: 13 tests passed.
- `npm run build` exited 0.
- `supabase db push` exited 0 and applied `20260531090000_add_import_source_workspace_binding.sql`.

## User Setup Required

None - the database migration was pushed successfully in this session.

## Next Phase Readiness

Plan 05-02 can build the Connections panel and workspace-required setup flow on top of `workspaceId`, `workspaceName`, lifecycle labels, and `useUpdateImportSourceWorkspace()`.

---
*Phase: 05-connector-reliability-per-workspace-binding-unified-sync-tab*
*Completed: 2026-05-31*
