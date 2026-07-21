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

---

## CR-02 / WR-01 / WR-02 — Multi-provider sync-status wiring (defer to Phase 26)

Logged during the Phase 24 code-review fix pass (`24-REVIEW.md` → `24-REVIEW-FIX`).
These three findings are a single coupled change set and are intentionally NOT
fixed in Phase 24 because the SyncTab is Fathom-only today — so they are latent,
not a live bug. Tracked as a Phase 26 requirement (TBL): when Phase 26 makes the
import surface multi-provider, this MUST be addressed or non-Fathom providers
will show `synced: false` forever.

1. **CR-02 — hardcoded `"fathom"` sourceApp** (`src/hooks/useSyncTabState.ts:202`).
   The only runtime caller passes the literal `"fathom"` to
   `checkSyncStatus(sourceApp, ids)` regardless of each meeting's real provider.
   `getSyncStatusForExternalIds` filters `recordings` by
   `.eq("source_app", sourceApp)`, so any non-Fathom meeting's row is excluded,
   `statusMap` never contains its external id, and `synced` stays `false`
   forever — re-importing already-synced Zoom/Fireflies/Grain/Read.ai calls.
   Fix: group meetings by their real provider (`source_platform`) and call the
   reader per source (or thread each meeting's source through).

2. **WR-01 — bridge `checkSyncStatus` clobbers prior status**
   (`src/hooks/useSyncTabStateBridge.ts:50-52`). It force-sets `synced` for
   EVERY meeting to `statusMap.has(...)`, not just the ids checked. A per-provider
   multi-call (required by the CR-02 fix) would have each batch reset meetings
   outside it back to `false`. The bridge MUST be reworked to merge — only flip
   to `true` on a hit, leave non-batch meetings untouched — BEFORE the multi-call
   approach is safe. Ordering: WR-01 must land before/with CR-02.

3. **WR-02 — `organizationId` not threaded at runtime**
   (`src/hooks/useSyncTabStateBridge.ts:44-55`,
   `src/services/sync-status.service.ts:52-54`). The reader accepts
   `opts.organizationId` and applies `.eq("organization_id", ...)`, but the
   bridge never passes it, so it falls back to `owner_user_id` scoping only. For
   a user in multiple orgs, a call synced under Org A is reported "synced" while
   operating in Org B. `SyncTab.tsx:55` already has `activeOrganizationId`; thread
   it through `useSyncTabState` → bridge → reader.

WR-04, WR-05, IN-01, IN-02, IN-03 from `24-REVIEW.md` remain open as lower-priority
hardening/typing items (not fixed in this pass; not blockers).
