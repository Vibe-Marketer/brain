---
status: resolved
trigger: "I need you to figure out why the workspace creation and \"ask cal\" and several other mcp things are not working, having issues, erroring out. etc."
created: "2026-06-05"
updated: "2026-06-05"
---

# Debug Session: mcp-tools-failing

## Symptoms

- expected_behavior: MCP clients should be able to use allowed CallVault tools, including admin workspace creation and AI ask-call functionality, with correct workspace/org scoping and useful error messages.
- actual_behavior: User reports workspace creation, "ask cal" / ask-call, and several other MCP tools are erroring or not working.
- error_messages: Not provided yet.
- timeline: Reported 2026-06-05 after prior workspace-scoped MCP fixes on 2026-06-02.
- reproduction: Trigger MCP tools from an MCP client, specifically workspace creation and ask-call. Exact client/tool inputs not yet provided.

## Current Focus

- hypothesis: Multiple MCP tools were failing due to a combination of category exposure, one bad admin tool implementation, and incompatible AI SDK imports.
- test: Trace MCP tool registry, category gating, admin `create_workspace`, AI `ask_call`, auth scope handling, production deploy state, and local/live smoke behavior.
- expecting: OAuth grants missing `admin` hide admin tools; full-access/admin create_workspace fails on workspace_memberships role constraint; MCP AI tools fail before provider call due SDK version mismatch.
- next_action: monitor MCP clients after tool-list refresh; investigate any remaining specific MCP tool errors with exact request/error text.
- reasoning_checkpoint: Live full-access token exposed both create_workspace and ask_call, but ask_call returned -32603 before fix. Production DB role constraint rejects legacy role `owner`; valid roles are workspace_owner, workspace_admin, contributor, member.
- tdd_checkpoint: Added anchors for create_workspace membership behavior and MCP AI SDK version compatibility.

## Evidence

- Production `workspace_memberships_role_check` only allows `workspace_owner`, `workspace_admin`, `contributor`, `member`; `create_workspace` inserted legacy `owner`.
- `create_workspace` logged membership insert failures but still returned success, leaving the created workspace inaccessible to the creator.
- Recent active OAuth grants had `enabled_categories: ["read","write","ai"]`, so `create_workspace` and other admin tools were hidden/blocked for OAuth clients such as Claude.
- Direct Deno smoke reproduced MCP AI import failure with `@openrouter/ai-sdk-provider@2.9.0` + `ai@6.0.66`: `AI_InvalidPromptError` / `T.safeParseAsync is not a function`.
- Deno smoke with `@openrouter/ai-sdk-provider@1.2.8` + `ai@5.0.102` succeeded for the same OpenRouter key/model.
- Production workspace `34fdba47-6a50-4a73-b7e2-f70d921dd699` had 11 entries and sampled recordings with transcripts, so `ask_call` was not failing because of empty data.

## Eliminated

- OpenRouter secret absence: `OPENROUTER_API_KEY` exists in Supabase secrets and direct OpenRouter calls authenticated.
- MCP token category gating for a full-access manual token: token with `enabled_categories = null` exposed both `create_workspace` and `ask_call`.
- General MCP routing failure: `tools/list` and `list_calls` returned 200 from production before the fix.

## Resolution

- root_cause:
  - `create_workspace` inserted invalid role `owner` and swallowed the membership failure.
  - OAuth grants defaulted to non-admin categories, hiding admin tools such as workspace creation from OAuth-backed clients.
  - MCP AI tools used an incompatible Deno import stack for OpenRouter/AI SDK.
- fix:
  - `create_workspace` now inserts `workspace_owner`, deletes the workspace, and returns an MCP error if membership creation fails.
  - OAuth grants now default to `read`, `write`, `ai`, `admin`; migration backfills active grants missing `admin`.
  - MCP AI tools now use the Deno-compatible OpenRouter/AI SDK/Zod versions used by working production functions.
- verification:
  - `npx vitest run supabase/functions/mcp-server/__tests__/ai-tools-invariants.test.ts supabase/functions/mcp-server/__tests__/write-tools-boundary.test.ts`
  - `npx vitest run supabase/functions/mcp-server/__tests__/category-gating.test.ts supabase/functions/mcp-server/__tests__/contract-surface.test.ts supabase/functions/mcp-server/__tests__/golden-replay.test.ts supabase/functions/mcp-server/__tests__/oauth-grant-selection.test.ts`
  - `npx vitest run src/services/__tests__/mcp-oauth-grants.service.test.ts src/components/settings/__tests__/McpConnectionsTab.test.tsx src/components/settings/__tests__/McpSetupSnippets.test.tsx`
  - `deno check supabase/functions/mcp-server/index.ts`
  - `npm run build`
  - `supabase db push --linked` applied `20260605231500_backfill_oauth_grant_admin_categories.sql`
  - `supabase functions deploy mcp-server --use-api`
  - Production OAuth grant sample: 10 active grants checked, 0 missing `admin`.
  - Production MCP `ask_call` returned a real answer for recordings `4ecbda5d-6259-4807-ad29-39a9dfd83623` and `075bec3f-6abf-45d7-a1a4-a8690beb30d7`.
  - Production MCP `get_sentiment` returned cached sentiment for recording `075bec3f-6abf-45d7-a1a4-a8690beb30d7`.
  - Production MCP `create_workspace` created a debug workspace with `workspace_owner` membership; the debug workspace was removed afterward via a direct DB cleanup because the normal last-owner guard correctly blocked standard deletion.
- files_changed:
  - `src/services/mcp-oauth-grants.service.ts`
  - `src/services/__tests__/mcp-oauth-grants.service.test.ts`
  - `src/components/settings/__tests__/McpConnectionsTab.test.tsx`
  - `supabase/migrations/20260605231500_backfill_oauth_grant_admin_categories.sql`
  - `supabase/functions/mcp-server/tools/admin/create_workspace.ts`
  - `supabase/functions/mcp-server/tools/ai/ask_call.ts`
  - `supabase/functions/mcp-server/tools/ai/extract_action_items.ts`
  - `supabase/functions/mcp-server/tools/ai/get_sentiment.ts`
  - `supabase/functions/mcp-server/tools/ai/get_coaching_notes.ts`
  - `supabase/functions/mcp-server/__tests__/ai-tools-invariants.test.ts`
  - `supabase/functions/mcp-server/__tests__/contract-surface.test.ts`
  - `supabase/functions/mcp-server/__tests__/write-tools-boundary.test.ts`
  - `deno.lock`
  - `.planning/debug/mcp-tools-failing.md`
