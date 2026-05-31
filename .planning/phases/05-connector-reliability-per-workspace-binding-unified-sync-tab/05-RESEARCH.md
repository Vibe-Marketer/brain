# Phase 05 — Connector Reliability + Per-Workspace Binding + Unified Sync Tab Research

**Researched:** 2026-05-31
**Status:** Complete
**Question:** What do we need to know to plan Phase 05 well?

## RESEARCH COMPLETE

Phase 05 should be planned as four connected slices:

1. Add first-class workspace binding to `import_sources`, with a minimal backfill to the default workspace.
2. Route every connector sync/webhook through the bound workspace, falling back to the default workspace only for legacy/unbound events.
3. Build one compact Connections status/management surface on the existing connector registry and `import_sources` state.
4. Move SyncTab's synced list from `fathom_calls` to canonical `recordings`/`workspace_entries` so every source appears.

The safest implementation path is schema first, then shared service/query model, then per-provider sync/webhook adoption, then UI, then verification.

## Phase Scope

### Requirements Covered

- **CON-01:** Unhappy-path hardening across Fathom, Zoom, Fireflies, Grain, Read.ai, PLAUD, YouTube.
- **CON-02:** Single per-workspace connection-status UI.
- **CON-03:** Disconnect/reconnect cleanup and friendly callback/error behavior.
- **CON-04:** Per-workspace connector binding for future imports.
- **HRD-01:** SyncTab reads canonical `recordings`, not `fathom_calls`.

### Locked Product Decisions

- Connector workspace binding is the future landing workspace for imports, not automatic multi-workspace fanout.
- Existing calls must not move during migration, reconnect, or binding changes.
- Existing connector rows should be assigned to the default workspace with a passive notice.
- Import provider cards remain setup/import oriented; Connections is the management/status surface.
- PLAUD remains in Connections but may use bridge-oriented management copy/actions.
- Recoverable failures retry silently; user-facing action appears only when action is needed.

## Current Architecture Findings

### Connector Registry and Status UI

The frontend already has a registry-centered connector abstraction:

- `src/components/connectors/registry/connectorRegistry.ts`
- `src/components/connectors/registry/types.ts`
- `src/components/connectors/hooks/useConnector.ts`
- `src/components/connectors/ConnectorPanel.tsx`

`useConnector()` is the current canonical status hook. It fetches `import_sources` and `user_settings`, groups rows by `source_app`, and derives `ConnectorStatus`. Today its select list does not include workspace fields and the status shape has no workspace binding, retry, rate-limit, or partial-sync status. The Phase 05 plan should extend this shape rather than create a second connector status model.

`ConnectorPanel` is intentionally setup/import oriented and has no lifecycle actions. This matches the Phase 05 decision: keep provider cards as setup-first and link connected/error states into Connections management.

### `import_sources` Data Model

The original `import_sources` migration creates one row per `(user_id, source_app)` and comments that uniqueness in the table comment. That conflicts with the current product requirement to preserve multiple connected accounts per provider. The code has evolved around this:

- OAuth flows use pending import source IDs for multi-account paths.
- `ConnectorStatus.allRows` already exposes raw rows for multi-account/advanced consumers.
- Several provider functions update a concrete `sourceId`.

Phase 05 must audit and, if needed, change constraints so the database actually permits the intended multi-account model while adding `workspace_id`.

Recommended schema work:

- Add `workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL` to `public.import_sources`.
- Add indexes for `workspace_id`, `(user_id, workspace_id)`, and `(user_id, source_app, workspace_id)`.
- Backfill existing rows to each user's default workspace.
- Preserve or replace uniqueness in a way that does not collapse multiple accounts. A likely target is a partial/indexed uniqueness model based on provider account identity where available, not `(user_id, source_app)`.
- Add a passive notice marker, likely in `connection_metadata` or a small timestamp column, so existing assigned rows can show the migration notice once.

### Workspace Binding in Pipeline

`supabase/functions/_shared/connector-pipeline.ts` already supports `ConnectorRecord.workspace_id`. When present, `runPipeline()` skips routing rules, `insertRecording()` creates a `workspace_entries` row in that explicit workspace, and removes the auto-created HOME entry to avoid duplicate placement.

That means Phase 05 does not need to invent workspace placement mechanics. It needs to ensure every connector creates records with the bound workspace:

- Sync endpoints should resolve `import_sources.workspace_id`.
- Webhook handlers should resolve the source row by webhook token or source/account identity and pass its `workspace_id`.
- Legacy/unbound rows should route to default workspace before falling back to current personal/home workspace behavior.

### Existing Routing Rules

`runPipeline()` already supports `import_routing_rules` and `import_routing_defaults` when `record.workspace_id` is missing. Phase 05 decisions make connector binding authoritative for a connector's future landing workspace. Therefore:

- If `import_sources.workspace_id` is set, pass it explicitly and skip routing defaults.
- If not set, use default workspace fallback for legacy/unbound rows.
- Do not use this phase to add advanced routing rules or fanout.

### Sync Jobs and Failure State

`supabase/functions/_shared/connector-function-utils.ts` provides useful shared primitives:

- `resolveOAuthAccessToken()` refreshes expired OAuth access tokens and writes refreshed tokens back through `persistOAuthTokens()`.
- `validateWorkspaceMembership()` verifies a user can target a workspace.
- `runConnectorSyncJob()` tracks `sync_jobs`, item-level synced/skipped/failed counts, final status, and updates `import_sources.last_sync_at` / `error_message`.

Several connectors already use `runConnectorSyncJob` or equivalent patterns. Phase 05 should consolidate status semantics around the fields already present and add only the minimum extra metadata needed for retry/rate-limit details.

Recommended status vocabulary:

- `connected`: active source, no action-needed error.
- `syncing`: active job in `sync_jobs`.
- `retrying`: transient provider or webhook failure with retry scheduled.
- `rate_limited`: provider rate limit with next retry time.
- `reconnect_required`: refresh failed, missing refresh token, revoked credential, or provider auth failure.
- `error`: non-auth failure that exhausted retries.
- `disconnected`: inactive or removed source.

### SyncTab Source of Truth

`src/services/sync-tab.service.ts` currently has a direct TODO and still queries `fathom_calls` in `fetchSyncedCalls()`. It maps rows into the legacy `Meeting` shape and then loads tag assignments through `toRecordingUuidBatch()`.

HRD-01 should update `fetchSyncedCalls()` to query canonical `recordings` scoped by organization and date, plus workspace visibility through `workspace_entries` when a workspace filter is selected. The output can remain `Meeting[]` to avoid a broad UI rewrite.

Important constraints:

- Preserve `SyncedTranscriptsSection` and `TranscriptTable` consumers.
- Use `resolveShareUrl()` rather than reading a nonexistent top-level `recordings.share_url`.
- Keep UUID/BIGINT conversion through `toRecordingUuid()` / `toRecordingUuidBatch()` only.
- Date filtering should use `recording_start_time` or `created_at` consistently; the plan should choose one and test it.
- The hook query key should include workspace when workspace filtering is added.

## Provider-Specific Findings

### Fathom

Relevant files:

- `supabase/functions/fathom-oauth-callback/index.ts`
- `supabase/functions/sync-meetings/index.ts`
- `supabase/functions/fetch-meetings/index.ts`
- `supabase/functions/fathom-refresh/index.ts`
- `supabase/functions/webhook/index.ts`
- `supabase/functions/fathom-reconcile/index.ts`

Fathom is the oldest and most legacy-heavy path. It uses `fathom_calls`, legacy BIGINT IDs, and several fallback paths. Planning should isolate Fathom compatibility from the canonical all-source path:

- Keep existing fetch/sync behavior working.
- Ensure `sourceId` is propagated whenever possible.
- Resolve workspace binding from `import_sources` for source-specific syncs and webhook/reconcile imports.
- Avoid raw `Number()`/`parseInt()` on recording IDs except where Fathom external IDs are explicitly provider IDs, not CallVault recording IDs.

### Zoom

Relevant files:

- `supabase/functions/zoom-oauth-callback/index.ts`
- `supabase/functions/zoom-sync-meetings/index.ts`
- `supabase/functions/zoom-webhook/index.ts`
- `supabase/functions/_shared/zoom-token-refresh.ts`

Zoom already accepts `workspace_id` in sync requests and validates membership. It should be adapted to prefer the bound `import_sources.workspace_id` for future imports and use request `workspace_id` only as an explicit import override where the UI supports it.

### Fireflies

Relevant files:

- `supabase/functions/fireflies-save-source/index.ts`
- `supabase/functions/fireflies-sync-meetings/index.ts`
- `supabase/functions/fireflies-webhook/index.ts`
- `supabase/functions/_shared/fireflies-credentials.ts`

Fireflies is API-key/webhook oriented and stores durable credentials on `import_sources`. It already accepts `workspace_id` in sync requests and updates `import_sources` on sync success/failure. The plan should add workspace binding at credential save time and make webhook imports read it from the row.

### Grain

Relevant files:

- `supabase/functions/grain-connect-token/index.ts`
- `supabase/functions/grain-sync-recordings/index.ts`
- `supabase/functions/grain-webhook/index.ts`
- `supabase/functions/grain-create-webhooks/index.ts`
- `supabase/functions/grain-disconnect/index.ts`

Grain has shared sync-job utilities and webhook path-token routing. It should be relatively low risk if `import_sources.workspace_id` is added and loaded in shared source helpers.

### Read.ai

Relevant files:

- `supabase/functions/read-ai-connect-token/index.ts`
- `supabase/functions/read-ai-sync-meetings/index.ts`
- `supabase/functions/read-ai-webhook/index.ts`
- `supabase/functions/read-ai-webhook-settings/index.ts`
- `supabase/functions/_shared/read-ai-source.ts`

Read.ai has token/webhook management similar to Grain. The main planning point is making webhook imports resolve the source row and binding before calling the pipeline.

### PLAUD

Relevant files:

- `supabase/functions/plaud-connect-token/index.ts`
- `supabase/functions/plaud-oauth-callback/index.ts`
- `supabase/functions/plaud-sync-recordings/index.ts`
- `supabase/functions/_shared/plaud-client.ts`
- `supabase/functions/_shared/plaud-connector.ts`

PLAUD already stores a provider workspace concept in `connection_metadata.workspace_id`. That is PLAUD's remote workspace, not necessarily CallVault's destination workspace. Phase 05 must avoid naming confusion:

- `import_sources.workspace_id`: CallVault destination workspace.
- `connection_metadata.workspace_id`: provider/PLAUD workspace if already used.

The UI should label PLAUD actions as bridge/connection management when reconnect semantics differ from OAuth providers.

### YouTube

Relevant files:

- `supabase/functions/youtube-import/index.ts`
- `src/components/connectors/registry/adapters/youtube.ts`

YouTube import already accepts `workspace_id` and writes through `runPipeline()`. It is not a persistent OAuth connector in the same way as the others, so the plan should decide whether YouTube gets an `import_sources` binding row or remains an import action that defaults to the active workspace. If it appears in Connections, status semantics should not imply token refresh or webhook health.

## Recommended Implementation Plan Shape

### Plan 05-01 — Schema, Backfill, and Shared Connector Status Model

Purpose:

- Add `import_sources.workspace_id`.
- Preserve multi-account connector rows.
- Backfill existing rows to default workspace.
- Extend frontend/backend types and `useConnector()` to expose workspace binding.
- Add passive assignment notice state.

Verification:

- Migration applies locally.
- RLS still restricts rows to owner.
- `useConnector()` query selects `workspace_id`.
- Existing rows without workspace are assigned to default workspace.
- No historical `recordings` or `workspace_entries` are moved.

### Plan 05-02 — Setup and Binding Management UI

Purpose:

- Require workspace at connector setup time.
- Build compact Connections rows and Manage detail.
- Keep Import provider cards setup-first with links into Connections.
- Support change future landing workspace, reconnect, and disconnect.

Verification:

- Workspace settings view filters to one workspace.
- Global settings view can show all connector accounts.
- Manage action exposes provider/account/workspace/status/actions.
- Changing workspace updates future binding only.

### Plan 05-03 — Sync/Webhook Workspace Routing and Failure Semantics

Purpose:

- Update provider sync/webhook paths to resolve bound workspace.
- Consolidate failure status metadata and refresh failure behavior.
- Add retry/rate-limit/partial-sync representation without noisy alerts.

Verification:

- Each connector can import into its bound workspace.
- Unbound source falls back to default workspace.
- Refresh failure marks source action-needed/reconnect.
- Partial sync records successes and visible failed IDs.
- Webhook exhausted retries produce visible error state.

### Plan 05-04 — SyncTab Canonical Recordings Migration

Purpose:

- Replace `fathom_calls` read source in `fetchSyncedCalls()` with `recordings`.
- Preserve `Meeting[]` output and existing `SyncedTranscriptsSection`.
- Include all sources and workspace/date filters.

Verification:

- Fathom, Zoom, Fireflies, Grain, Read.ai, PLAUD, YouTube, paste/manual rows appear.
- Tag assignments still load by UUID.
- `resolveShareUrl()` is used for share URLs.
- No `recordings.share_url` direct read.

### Plan 05-05 — End-to-End Verification and Provider Matrix

Purpose:

- Build a provider-by-provider proof matrix.
- Add targeted tests for refresh, reconnect, binding, SyncTab, and disconnect.
- Run UI/browser checks on Connections and Import Meetings.

Verification:

- `npm run build` is clean.
- Relevant frontend tests are green.
- Edge function tests or source-level contract tests cover connector routing.
- Browser screenshots prove Connections and SyncTab layouts render without overlap.

## Validation Architecture

### Automated Test Targets

- **Frontend unit/component tests:** `useConnector`, Connections rows, Manage details, SyncTab canonical mapping.
- **Service tests:** `fetchSyncedCalls()` mapping from `recordings` to `Meeting[]`, date/workspace filtering, tag assignment loading.
- **Migration checks:** `import_sources.workspace_id` exists, default workspace backfill, indexes exist, no update touches historical `recordings`/`workspace_entries`.
- **Edge function contract tests:** provider sync functions pass bound workspace to `runPipeline()` or shared helpers.
- **Source-level guard tests:** no direct `recordings.share_url` use in SyncTab service; no raw recording ID numeric coercion outside provider external-ID parsing.

### Manual / Browser Verification

- Connections page in workspace scope shows only that workspace's connectors.
- Global Settings/Connectors view shows all connected accounts.
- Manage view supports reconnect/change workspace/disconnect.
- Import provider cards remain setup-first and link to Connections for status management.
- Import Meetings / SyncTab shows already imported calls from all sources.

### Provider Matrix

For each provider: Fathom, Zoom, Fireflies, Grain, Read.ai, PLAUD, YouTube.

- Setup requires or infers a CallVault workspace.
- Connection row shows provider, account, workspace, status, Manage.
- Sync/webhook import lands in bound workspace.
- Expired token or invalid credential produces reconnect-required when refresh fails.
- Rate-limit or transient failure uses passive retry status.
- Disconnect removes/clears connector credentials and source row without moving imported calls.

## Risks and Landmines

- The original `import_sources` uniqueness constraint may block multiple accounts per provider. Fix schema before building UI around multiple rows.
- PLAUD metadata already has a `workspace_id` meaning provider workspace. Do not reuse that JSON field for CallVault destination.
- SyncTab currently outputs `Meeting` objects expected by `TranscriptTable`. A broad table refactor would create unnecessary blast radius.
- Direct query filtering through `workspace_entries` can create duplicate rows if a recording appears in multiple workspaces. The service should dedupe by recording UUID or scope explicitly to selected workspace.
- Fathom has legacy BIGINT provider IDs. Do not generalize Fathom ID parsing to canonical recording IDs.
- Existing import routing rules should not override an explicit connector binding in Phase 05.
- Webhook retry implementation may already exist for some provider-specific delivery tables; expose or reuse it only if low risk.

## Open Planning Questions

The planner should resolve these by reading current code, not by asking product:

- Should `import_sources.workspace_id` be nullable after migration, or should the fallback/backfill make it effectively required with a NOT NULL follow-up?
- Which exact status metadata belongs in first-class columns versus `connection_metadata`?
- How should YouTube be represented in Connections given it is more import action than persistent external account?
- Which existing settings route should host the global Connections surface while workspace settings hosts the filtered view?
- Which provider tests can be behavior tests versus source-level contract tests without needing live provider credentials?

## Files the Planner Must Read

- `.planning/phases/05-connector-reliability-per-workspace-binding-unified-sync-tab/05-CONTEXT.md`
- `supabase/migrations/20260228000002_create_import_sources.sql`
- `supabase/migrations/20260523053000_add_import_source_connection_metadata.sql`
- `src/components/connectors/hooks/useConnector.ts`
- `src/components/connectors/registry/types.ts`
- `src/components/connectors/registry/connectorRegistry.ts`
- `src/services/import-sources.service.ts`
- `supabase/functions/_shared/connector-pipeline.ts`
- `supabase/functions/_shared/connector-function-utils.ts`
- `src/services/sync-tab.service.ts`
- `src/hooks/useExistingTranscripts.ts`
- `src/components/transcripts/SyncTab.tsx`
- `src/components/transcripts/SyncedTranscriptsSection.tsx`
- Provider sync/webhook/callback files listed above.

## Recommended Verification Commands

- `npm run build`
- `npm run test -- src/components/connectors`
- `npm run test -- src/services`
- `npm run test -- src/hooks/useExistingTranscripts`
- `deno test --allow-env --allow-read --allow-net supabase/functions/_shared/__tests__`
- Provider-specific Deno tests where present, especially Grain, Read.ai, PLAUD, and connector utility tests.

The execution phase should use real Supabase integration tests where database behavior, RLS, migrations, or UUID/BIGINT behavior is being validated. Source-level tests are acceptable only for provider-credential behavior that cannot be exercised without live external accounts.
