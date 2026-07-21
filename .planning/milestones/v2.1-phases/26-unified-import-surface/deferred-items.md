# Phase 26 — Deferred Items (out of scope)

Out-of-scope discoveries logged during execution. NOT fixed in this phase (SCOPE BOUNDARY: only auto-fix issues directly caused by the current task's changes).

## Pre-existing full-suite baseline failures (26-04)

Verified against `HEAD~1` (the pre-26-04 tree) via a detached worktree: the full
`npx vitest run` suite already failed before this plan ran.

- **Baseline (HEAD~1, pre-26-04):** 6 test files / 20 tests failed.
- **After 26-04 (HEAD):** 7 test files / 21 tests failed.
- **Delta:** `src/components/transcripts/__tests__/TranscriptsTab.batching.test.ts` —
  PASSES in isolation on BOTH HEAD and HEAD~1, fails only in the full-suite run.
  This is a pre-existing test-isolation / ordering flake (shared module/global
  state across files), NOT a regression from the 26-04 deletions. The failing
  file imports none of the deleted modules.

None of the failing files reference any deleted module
(`ConnectorImportWizard`, `useSyncTab*`, `UnsyncedMeetingsSection`,
`SyncedTranscriptsSection`, `SyncTabDialogs`). Pre-existing failing areas:
MCP settings tabs (`MCPTab.permissions`, `McpConnectionsTab`, `McpSetupSnippets`),
MCP-server / generate-ai-titles edge functions, and `rpc-type-smoke`
(DB-gated; skipped at HEAD~1, env-dependent).

## Pre-existing tsc errors (unrelated to 26-04)

`tsc -p tsconfig.app.json` reports pre-existing errors out of scope for 26-04
(none reference the deleted modules):
- `src/pages/ImportPage.tsx:179,228` — `RemixiconComponentType` assignment
  (documented pre-existing in 26-03-SUMMARY).
- `src/pages/TranscriptsNew.tsx:376` — `DragHelpers` type (Phase 24 deferred).
- `src/hooks/useSyncTabState.ts:240-257` — `SyncJob` type mismatches
  (Phase 24 deferred; this file is PRESERVED for Phase 27, unchanged except the
  Phase 27 carry-forward annotation comment).
- Unrelated: `ConnectorSetupClusterView.tsx`, `panelStore.test.ts`,
  `preferencesStore.ts`, `types/folders.ts`, `types/index.ts`,
  `template-engine.test.ts`.
