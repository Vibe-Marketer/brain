---
slug: claude-mcp-connector-workspace
status: fixed
created: 2026-06-02
updated: 2026-06-02
trigger: |
  User reports Claude connector / MCP failure. In Claude, the LGJ workspace token appeared connected but tool use said the LGJ workspace token had no available calls. Claude also noticed a second CallVault connector named "AI Simple" using a workspace-scoped URL, tried list_workspaces / workspace-scoped access, and that did not work either.
---

# Debug: claude-mcp-connector-workspace

## Symptoms

### Expected behavior
Claude should connect through CallVault MCP using either an org-scoped or workspace-scoped connector. A workspace-scoped LGJ or AI Simple endpoint/token should expose the allowed MCP tools and return calls available to that workspace, or return a precise authorization/scope error if the connector URL and token binding do not match.

### Actual behavior
Claude reported that the LGJ workspace token did not have available calls. A second CallVault connector named "AI Simple" using a workspace-scoped URL also did not work.

### Error messages
Claude-side summary:

```
I'm noticing the LGJ workspace token doesn't have any available calls, but there's a second CallVault connector called AI Simple that uses a workspace-scoped URL. I need to either list the workspaces to find the correct UUID or try using the AI Simple connector's tools directly, though the tool search only pulled up LGJ tools so far. Let me check what list_workspaces returns to see if I can access the right workspace.
```

### Timeline
Reported 2026-06-02. Phase 03 previously implemented and smoke-tested workspace-scoped MCP URLs, including `/mcp/w/{workspace_uuid}`.

### Reproduction
1. Use Claude with a CallVault connector configured for LGJ.
2. Search/list calls through the connector.
3. Observe no available calls or connector/tool mismatch.
4. Try a second workspace-scoped connector named AI Simple.
5. Observe that it also does not work.

## Current Focus

- hypothesis: Workspace-scoped URL and token binding are mismatched, tool discovery is filtering to a different connector/token, or read tools are applying workspace filtering against the wrong workspace/org.
- test: Trace MCP request routing, token validation, workspace URL parsing, tool listing, list_workspaces behavior, and read tool workspace filters. Then probe production with a controlled token if credentials/config allow.
- expecting: Either a code/config bug where workspace path audience and token workspace_id disagree silently, or a data issue where the target workspace genuinely has no recordings visible to the token.
- next_action: gather initial evidence from MCP Edge Function and token/workspace service code
- reasoning_checkpoint:
- tdd_checkpoint:

## Evidence

- timestamp: 2026-06-02T19:03:00-04:00
  finding: Production data explains the LGJ "no available calls" symptom. Lead Gen Jay has one workspace, IMPORT (`4cf3bf4f-215c-4db8-ad35-ad3e9a978f19`), with zero `recordings` rows in the org and zero `workspace_entries`.
  note: LGJ returning "No calls found" is expected until calls are imported or moved into that org/workspace.

- timestamp: 2026-06-02T19:04:00-04:00
  finding: AI Simple has calls available. Production counts show 1,580 org recordings, including 1,412 workspace entries in INBOX (`2e57f0aa-e0bb-4e54-a602-33c9e606f2bf`) and 77 in AI Simple Founders (`a8a541a6-51be-4b11-8b13-69fe55f6b2d5`).
  note: AI Simple failing through Claude is not an empty-data issue.

- timestamp: 2026-06-02T19:05:00-04:00
  finding: Live public MCP probe with an AI Simple organization token returned calls on the base endpoint and on workspace URLs, but workspace URLs still returned organization-wide results. `list_workspaces` on an AI Simple workspace URL returned multiple AI Simple workspaces.
  files:
    - supabase/functions/mcp-server/auth.ts
    - supabase/functions/mcp-server/tools/read/list_calls.ts
    - supabase/functions/mcp-server/tools/read/list_workspaces.ts
  note: Auth validated that the requested workspace belonged to the org token, but did not propagate the requested workspace into the effective token scope used by tool handlers.

- timestamp: 2026-06-02T19:06:00-04:00
  finding: Production has multiple active Claude OAuth grants across AI Simple and Lead Gen Jay using the same `client_id` path. The old OAuth auth query selected only the most recently updated grant for a user/client, independent of the requested workspace URL.
  files:
    - supabase/functions/mcp-server/auth.ts
  note: This can make Claude appear connected while resolving calls/tools against the wrong org grant when several CallVault Claude connectors exist.

## Eliminated

- hypothesis: LGJ workspace-scoped MCP read path is broken despite available calls.
  reason: Production LGJ has zero org recordings and zero workspace entries.

- hypothesis: AI Simple has no calls available to MCP.
  reason: Production AI Simple has 1,580 org recordings and live MCP base endpoint returned a recent call.

## Resolution

- root_cause: Two overlapping issues. First, Lead Gen Jay genuinely has no calls in production, so a workspace-scoped LGJ connector correctly returns no calls. Second, workspace-scoped MCP URLs were only used for audience validation; after validation, organization credentials still reached handlers as organization-scoped tokens, so tools such as `list_calls` and `list_workspaces` ignored `/w/{workspace_uuid}`. OAuth grant lookup also selected the latest grant for a user/client without matching the requested workspace/org audience, which is fragile when Claude has multiple CallVault connectors.
- fix: Apply requested workspace scope after successful audience validation, and select OAuth grants by requested workspace first, falling back to an organization grant only when that grant owns the requested workspace.
- verification:
  - `npm test -- supabase/functions/mcp-server/__tests__/oauth-grant-selection.test.ts` -> 5/5 passing.
  - `npm run test:integration -- supabase/functions/mcp-server/__tests__/oauth-client-grants.integration.test.ts supabase/functions/mcp-server/__tests__/workspace-scope.integration.test.ts` -> 12 passing, 21 skipped by integration guards.
  - `npm run type-check -- --pretty false` -> passed.
- files_changed:
  - supabase/functions/mcp-server/auth.ts
  - supabase/functions/mcp-server/grant-selection.ts
  - supabase/functions/mcp-server/__tests__/oauth-grant-selection.test.ts
  - supabase/functions/mcp-server/__tests__/oauth-client-grants.integration.test.ts
  - supabase/functions/mcp-server/__tests__/workspace-scope.integration.test.ts
  - .planning/debug/claude-mcp-connector-workspace.md
