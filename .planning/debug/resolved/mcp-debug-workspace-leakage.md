---
status: fixed
trigger: "MCP debug/test workspace artifacts are visible in production workspaces, including Debug MCP Workspace 1780700203408."
created: 2026-06-09
updated: 2026-06-09
---

# Debug: MCP Debug Workspace Leakage

## Symptoms

- expected_behavior: Production MCP/workspace surfaces should not show workspaces created by live debug smoke tests.
- actual_behavior: A debug workspace was visible in production workspace listings.
- error_messages: None.
- timeline: Reported 2026-06-09; matching production artifact was created 2026-06-05.
- reproduction: List AI Simple production workspaces after the June 5 MCP debug smoke.

## Current Focus

- hypothesis: A live MCP `create_workspace` smoke created a debug-named workspace and cleanup did not remove every artifact.
- test: Query production workspaces, dependencies, and MCP creation path; clean empty artifact; add a guard that rejects obvious debug/test artifact names before insert.
- expecting: Exact debug workspace exists with no real call data, then no matching rows after cleanup and deploy.
- next_action: monitor future live MCP smoke tests for explicit cleanup and artifact-name rejection.

## Evidence

- timestamp: 2026-06-09T09:37:00-04:00
  finding: Production contained workspace `eb24b86c-7971-42e5-bbd4-7b25581f9607` named `MCP Debug Temp 1780700164338` in AI Simple (`04714fb3-d42c-42ad-801a-a8a49df6d06f`), created 2026-06-05T22:57:14Z.
  note: The user-provided timestamp-like value `1780700203408` corresponds to 2026-06-05T22:56:43Z, within the same live debug window.

- timestamp: 2026-06-09T09:39:00-04:00
  finding: The workspace had zero `workspace_entries`, `folders`, `call_notes`, `import_sources`, `mcp_oauth_client_grants`, active `mcp_tokens`, and invitations; it had one owner membership for the live smoke user.
  note: This was not test-call leakage through `list_calls`; it was a test-created workspace leaking through workspace listing.

- timestamp: 2026-06-09T09:44:00-04:00
  finding: Removed the empty production workspace and its membership using a narrowly scoped transaction that temporarily disabled the last-owner guard for this workspace cleanup.
  note: Follow-up query returned zero `MCP Debug Temp`, `Debug MCP Workspace`, or matching timestamp rows.

- timestamp: 2026-06-09T09:49:00-04:00
  finding: Added `create_workspace` guard to reject obvious live test/debug artifact names before insertion, including `MCP Debug Temp <timestamp>`, `Debug MCP Workspace <timestamp>`, `[phase-...]`, `do-not-touch`, and explicit fixture phrases.
  files:
    - supabase/functions/mcp-server/tools/admin/create_workspace.ts
    - supabase/functions/mcp-server/__tests__/write-tools-boundary.test.ts
    - supabase/functions/mcp-server/__tests__/contract-surface.test.ts

- timestamp: 2026-06-09T09:52:00-04:00
  finding: Deployed `mcp-server`; live production smoke with a temporary admin token returned JSON-RPC `-32602` for `MCP Debug Temp 1780700203408`, then the temporary token was revoked.

## Eliminated

- hypothesis: MCP `list_calls` is leaking test calls from another workspace.
  reason: `list_calls` currently filters through `workspace_entries.workspace_id`; production exact searches for `1780700203408` in recordings title/source/metadata returned zero rows, and the leaked workspace had zero entries.

- hypothesis: The old Phase 30/32/39 fixture-call leak recurred.
  reason: The visible artifact was a workspace name created during the June 5 MCP debug smoke, not rows matching the prior fixture signatures.

## Resolution

- root_cause: A live production MCP `create_workspace` smoke created a debug-named AI Simple workspace, and cleanup did not remove that exact artifact. Because `create_workspace` accepted test/debug names in production, future smoke tests could leave similar visible workspaces.
- fix: Removed the empty leaked workspace from production and added a guard in MCP `create_workspace` that rejects obvious debug/test artifact workspace names before insert.
- verification:
  - Production dependency counts were zero except the owner membership before cleanup.
  - Production cleanup follow-up query returned no matching debug workspace rows.
  - `npx vitest run supabase/functions/mcp-server/__tests__/write-tools-boundary.test.ts supabase/functions/mcp-server/__tests__/contract-surface.test.ts` -> 82 passing.
  - `deno check supabase/functions/mcp-server/index.ts` -> passed.
  - `supabase functions deploy mcp-server --use-api` -> deployed to project `vltmrnjsubfzrgrtdqey`.
  - Live MCP smoke returned `-32602` for `MCP Debug Temp 1780700203408`; temporary smoke token was revoked.
- files_changed:
  - supabase/functions/mcp-server/tools/admin/create_workspace.ts
  - supabase/functions/mcp-server/__tests__/write-tools-boundary.test.ts
  - supabase/functions/mcp-server/__tests__/contract-surface.test.ts
  - .planning/debug/mcp-debug-workspace-leakage.md
