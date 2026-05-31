# Phase 5: Connector Reliability + Per-Workspace Binding + Unified Sync Tab - Context

**Gathered:** 2026-05-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 5 hardens all connector flows and makes workspace binding explicit without changing the core object model: connectors define where future imports land, while calls/transcripts remain the objects users move or copy after import.

The phase delivers connector reliability for Fathom, Zoom, Fireflies, Grain, Read.ai, PLAUD, and YouTube; a unified Connections/status surface; required per-workspace connector binding; and a fix for the current Import Meetings / SyncTab synced-list source so it shows canonical recordings from every source instead of Fathom-only rows.

This phase does not add automatic multi-workspace fanout from one connector, does not move existing calls during migration or reconnect, does not replace the normal Home transcript table, and does not resurrect file upload UI.

</domain>

<decisions>
## Implementation Decisions

### Workspace Binding Model

- **D-01:** New connector/account setup must require choosing a workspace at connect time. Every connector instance must know its future landing workspace before sync or webhook data can land.
- **D-02:** Changing a connector's workspace affects future syncs only. Previously imported calls remain where the user placed them.
- **D-03:** If an unbound webhook or sync event arrives despite the required setup path, route it to the default workspace as a fallback instead of dropping data.
- **D-04:** Connector status rows/cards must always show the bound workspace name.

### Existing Connections Migration

- **D-05:** Existing connector accounts are automatically assigned to the default workspace when workspace binding ships.
- **D-06:** Show a passive, non-blocking notice that existing connections were assigned, with a direct action to change the future landing workspace.
- **D-07:** Preserve multiple connected accounts per provider. Multiple Fathom accounts, for example, must continue to work.
- **D-08:** Each connector instance has one default landing workspace for future imports. The call/transcript remains the object users move or copy across workspaces.
- **D-09:** Do not add automatic multi-workspace fanout from one connector in Phase 5.
- **D-10:** Existing calls are never moved by connector migration, reconnect, or workspace-binding changes unless the user explicitly asks. If a user moved a call somewhere, CallVault must preserve that placement.
- **D-11:** Migration should be minimal: add or set the future landing workspace binding for existing connector rows, show the passive notice, and leave existing calls/history alone. Do not perform cleanup or reconciliation unless required to keep the current connection working.

### Unified Connections Surface

- **D-12:** The Connections surface should prioritize connected accounts by provider: provider, account identity, bound workspace, status, and actions.
- **D-13:** Use the same Connections component in both workspace settings and broader Settings/Connectors. The workspace view is focused on one workspace; the global settings view handles all connectors.
- **D-14:** The per-workspace Connections view shows only connectors bound to that workspace.
- **D-15:** Use compact connected-account rows with a single `Manage` action. Rows show provider, account, status, and workspace; `Manage` opens source-specific details and actions.
- **D-16:** The Manage view contains sync when supported, reconnect or PLAUD bridge management, change future landing workspace, and disconnect.
- **D-17:** PLAUD stays visible in the unified Connections list, but its primary management action may be bridge-specific rather than a normal OAuth reconnect.
- **D-18:** Import provider cards stay setup-first with status/link hints. They remain the place to start setup/import, while connected/error states link into the Connections surface.

### Reliability Failure Behavior

- **D-19:** Do not alert noisily for recoverable or transient connector failures. Retry silently where possible.
- **D-20:** The Connections surface may show passive states such as `Retrying` or `Rate limited`.
- **D-21:** Only show a user-facing action state when user action is needed, such as `Reconnect required`.
- **D-22:** When token refresh fails, mark the connection as `Reconnect required` and make Reconnect the primary action in Manage.
- **D-23:** Rate limits should back off automatically with passive status only. Show `Rate limited` and next retry time in Manage/status, clear automatically after success, and escalate only if the connector stays blocked or repeated retries fail.
- **D-24:** Partial syncs are success with warnings. Imported calls stay imported; failed items are surfaced as needing attention with failed-call details and retry actions where possible.
- **D-25:** Webhooks retry with backoff automatically. If retries are exhausted, mark the connector errored, show last failure/retry info in Manage, and offer reconnect/reconfigure when relevant.
- **D-26:** Do not add a new user-facing webhook replay queue for Phase 5 unless planning finds an existing low-risk mechanism.

### Import Meetings / SyncTab Source of Truth

- **D-27:** Preserve the existing three-pane Transcripts structure: Pane 1 primary nav, Pane 2 workspace/folder sidebar, and Pane 3 active page content.
- **D-28:** Keep the current Import Meetings tab as the Pane 3 source/date/fetch workflow, with useful top summary numbers and source/date selectors.
- **D-29:** Fix the Synced Transcripts section under the Import Meetings workflow so it reads canonical `recordings` and shows already-imported calls from every source, not only Fathom.
- **D-30:** Do not replace the normal Home transcript table. Home remains the primary transcript library view.

### the agent's Discretion

- Exact row labels, badges, and Manage-detail layout are flexible, as long as the user can quickly see provider, account, workspace, status, and next action.
- Exact retry thresholds and escalation timing can be set during planning from provider behavior and existing connector pipeline capabilities.
- Exact implementation shape for storing the workspace binding can be decided by codebase research, but it must preserve multi-account provider behavior and avoid data movement.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning Scope

- `.planning/ROADMAP.md` — Phase 5 goal, requirements, success criteria, and sequencing constraints.
- `.planning/REQUIREMENTS.md` — CON-01, CON-02, CON-03, CON-04, and HRD-01 definitions.
- `.planning/PROJECT.md` — connector reliability workstream context, One-Click Promise, and out-of-scope boundaries.
- `.planning/STATE.md` — current milestone state and accumulated workspace/MCP decisions.
- `.planning/phases/03-per-workspace-mcp-endpoints-+-connect-to-ai/03-CONTEXT.md` — workspace-as-boundary decisions that Phase 5 inherits.

### Current Connector and Import Surfaces

- `src/pages/TranscriptsNew.tsx` — actual Transcripts/Home route, Pane 2 workspace sidebar, `transcripts` vs `sync` tab behavior, and `Import Meetings` title.
- `src/components/transcripts/SyncTab.tsx` — current Import Meetings / SyncTab workflow: choose source, choose date range, fetch/sync calls, workspace selector, active jobs, unsynced meetings, synced transcripts.
- `src/components/transcripts/SyncedTranscriptsSection.tsx` — current synced-list section that Phase 5 must back with canonical all-source recordings.
- `src/components/transcripts/UnsyncedMeetingsSection.tsx` — current external available-to-sync list pattern.
- `src/services/sync-tab.service.ts` — current Fathom-only `fathom_calls` read source and HRD-01 migration target.
- `src/components/connectors/registry/connectorRegistry.ts` — connector adapter registry and source dispatch pattern.
- `src/components/connectors/ConnectorPanel.tsx` — current shared connector panel consumer.
- `src/components/panes/ImportSourcePane.tsx` — existing import-source Pane 2 pattern for import-focused navigation.

### Connector State and Data Model

- `src/services/import-sources.service.ts` — current import source CRUD, disconnect, failed-import retry, and user-scoped import source comments.
- `supabase/migrations/20260228000002_create_import_sources.sql` — original `import_sources` schema, uniqueness, and RLS policies.
- `supabase/migrations/20260523053000_add_import_source_connection_metadata.sql` — `connection_metadata` JSONB added for provider-specific durable state.
- `supabase/functions/_shared/connector-pipeline.ts` — shared connector import pipeline and canonical recording insertion path.
- `src/services/workspace-entries.service.ts` — workspace assignment model for canonical recordings.
- `src/hooks/useWorkspaceAssignment.ts` — existing workspace assignment behavior for calls.
- `src/services/data-movement.service.ts` — existing move/copy semantics that must remain explicit user actions.

### Connector Function Families

- `supabase/functions/fathom-oauth-callback/index.ts` — Fathom import-source creation/update path and multi-account behavior.
- `supabase/functions/zoom-oauth-callback/index.ts` — Zoom callback path.
- `supabase/functions/grain-oauth-callback/index.ts` — Grain callback path.
- `supabase/functions/read-ai-oauth-callback/index.ts` — Read.ai callback path.
- `supabase/functions/fireflies-save-source/index.ts` — Fireflies API-key source setup path.
- `supabase/functions/plaud-connect-token/index.ts` — PLAUD token/bridge connection path.
- `supabase/functions/youtube-import/index.ts` — YouTube import path.

### Codebase Rules and Risks

- `.planning/codebase/ARCHITECTURE.md` — AppShell, service/hook separation, query invalidation, connector registry, and Edge Function patterns.
- `.planning/codebase/INTEGRATIONS.md` — all seven connector inventories and provider-specific auth models.
- `.planning/codebase/CONCERNS.md` — sync-tab Fathom-only issue, UUID/BIGINT recording ID boundary, source-registry build fragility, and RLS gaps.
- `src/CLAUDE.md` — frontend constraints, Remix icons only, service/hook separation, and recording ID boundary.
- `supabase/CLAUDE.md` — Edge Function auth, integration test safety, and real-Supabase test constraints.
- `src/lib/recording-ids.ts` — required UUID/BIGINT boundary helper.
- `src/lib/query-config.ts` — `invalidateCallListCaches(queryClient)` and cache-key patterns.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `src/components/transcripts/SyncTab.tsx`: current Pane 3 Import Meetings workflow should be preserved rather than replaced.
- `src/components/transcripts/SyncedTranscriptsSection.tsx`: reusable section boundary for the all-source canonical recordings fix.
- `src/components/transcript-library/TranscriptTable`: existing table presentation used by both synced and unsynced sections.
- `src/components/connectors/registry/connectorRegistry.ts`: registry is the right source for provider metadata and connector-specific behavior.
- `src/services/import-sources.service.ts`: existing import-source list, disconnect, failed-import retry, and active state service.
- `supabase/functions/_shared/connector-pipeline.ts`: shared backend path for inserting canonical recordings and workspace entries.

### Established Patterns

- Frontend data access must remain service + hook separated. Components should not call Supabase services directly.
- Mutation hooks that affect visible call lists must invalidate via `invalidateCallListCaches(queryClient)` on settled.
- Recording ID conversion must use `toRecordingUuid()` / `toRecordingUuidBatch()` when crossing UUID/BIGINT boundaries.
- Existing user call placement is meaningful. Connector migrations and reconnects must not move calls as a side effect.
- The current Transcripts page uses AppShell Pane 2 for workspace/folder navigation and Pane 3 for Home or Import Meetings content.

### Integration Points

- Add or backfill connector workspace binding on `import_sources` or a closely related table without collapsing multi-account provider behavior.
- Update OAuth/API-key/token connector setup flows to require a workspace at connect time.
- Update webhook/sync handlers to resolve the connector's future landing workspace, with default workspace fallback for legacy/unbound rows.
- Add a unified Connections component reusable in workspace settings and global Settings/Connectors.
- Update Import provider cards to stay setup-first while linking connected/error states into the Connections surface.
- Update `sync-tab.service.ts` so the Synced Transcripts section reads canonical `recordings` for all sources instead of `fathom_calls`.

</code_context>

<specifics>
## Specific Ideas

- A connected-account row should read like `Fathom · andrew@example.com · Sales · Connected · Manage`.
- The same external account should not automatically fan out the same call into multiple workspaces. Users can move/copy the call after import.
- PLAUD may need a `Manage bridge` path inside the same unified Connections surface instead of pretending it behaves like a normal OAuth source.
- Import provider cards can show light status/link hints such as `Connected` or `Needs reconnect`, but they should stay setup/import focused.
- The user strongly prefers preserving the current three-pane Transcripts architecture and was explicitly confused by mocks that did not match it.

</specifics>

<deferred>
## Deferred Ideas

- Automatic multi-workspace fanout from one connector account is deferred. Keep Phase 5 to one future landing workspace per connector instance.
- User-facing webhook replay queues are deferred unless planning finds they already exist and can be exposed safely.
- Bulk/provider-wide routing rules that decide workspace per call are not part of the locked Phase 5 decisions.
- File upload and async transcription UI remain out of scope for this milestone.

</deferred>

---

*Phase: 05-Connector Reliability + Per-Workspace Binding + Unified Sync Tab*
*Context gathered: 2026-05-31*
