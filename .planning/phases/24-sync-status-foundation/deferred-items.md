# Phase 24 — Deferred Items (out-of-scope discoveries)

Logged during execution of 24-01. These are PRE-EXISTING failures in files NOT
touched by this plan. They were present on `main` before 24-01 and are not
caused by the IMP-01 changes. Recorded per the executor SCOPE BOUNDARY rule.

## Pre-existing `tsc -p tsconfig.app.json` errors (unrelated files)

- `src/stores/__tests__/panelStore.test.ts` — multiple `PanelData` shape errors (test drift vs. PanelData union).
- `src/stores/preferencesStore.ts:101` — `Json` → `AutoProcessingPreferences` cast mismatch.
- `src/types/folders.ts:8` — `FolderAssignment` no longer exported from `./workspace`.
- `src/types/index.ts:4` — duplicate `Category` re-export ambiguity.
- `src/components/transcripts/SyncTab.tsx:91,93,120` — `ConnectorSourceApp` typing (pre-existing; unrelated to checkSyncStatus wiring at line 138, which type-checks clean).
- `src/components/transcripts/SyncTabDialogs.tsx:61,102` — `Meeting` / `number[]` arg mismatches.
- `src/hooks/useSyncTabState.ts:240,252,256,257` — `SyncJob` type mismatch in the realtime/polling loop (pre-existing; unrelated to the checkSyncStatus prop+invocation changed by 24-01).
- `src/services/sync-tab.service.ts:95` — TS2589 "type instantiation excessively deep" in `fetchSyncedCalls` workspace query (pre-existing; untouched by 24-01).

NOTE: 24-01's own files type-check cleanly:
- `src/services/sync-status.service.ts` — 0 errors
- `src/hooks/useSyncTabStateBridge.ts` — 0 errors
- the changed `checkSyncStatus` prop (useSyncTabState.ts:32) + invocation (line 202) — 0 errors

## Pre-existing unit-test failures (unrelated files)

5 test files fail, none referencing sync-status / sync-tab / SyncTab modules:
- `src/test/rpc-type-smoke.test.ts` — requires a live/typed DB RPC signature; env-dependent.
- `src/components/settings/__tests__/MCPTab.permissions.test.tsx`
- `src/components/settings/__tests__/McpConnectionsTab.test.tsx`
- `src/components/settings/__tests__/McpSetupSnippets.test.tsx`
- `src/components/transcripts/__tests__/TranscriptsTab.batching.test.ts` — tag-assignment chunk batching (does not touch the synced-signal reader).

These predate 24-01 and belong to MCP-settings / transcripts-batching surfaces.
