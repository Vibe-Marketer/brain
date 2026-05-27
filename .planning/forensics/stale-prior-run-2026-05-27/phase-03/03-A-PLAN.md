---
phase: 03-per-workspace-mcp-endpoints-connect-to-ai
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/functions/mcp-server/routing.ts
  - supabase/functions/mcp-server/auth.ts
  - supabase/functions/mcp-server/index.ts
autonomous: true
requirements: [MCP-01, MCP-02]

must_haves:
  truths:
    - "/mcp/w/{workspace_uuid} returns workspace-scoped tools for a valid workspace token"
    - "Presenting a token for workspace A to workspace B's URL returns HTTP 403"
    - "New tokens are minted with self-describing cv_ws_<hex> / cv_org_<hex> prefixes"
    - "Legacy hex tokens still validate via fallback regex"
  artifacts:
    - path: "supabase/functions/mcp-server/routing.ts"
      provides: "Workspace UUID extraction from path"
    - path: "supabase/functions/mcp-server/auth.ts"
      provides: "Workspace-scoped JWT audience validation and token prefix regex"
---

<objective>
Implement workspace-scoped MCP endpoints and token prefix logic in the edge function.
Purpose: Allow AI clients to connect to a specific workspace seamlessly with proper access boundaries.
Output: Edge function routing and auth handle `/mcp/w/{workspace_uuid}` and `cv_ws_<hex>` tokens securely.
</objective>

<execution_context>
@.agent/get-shit-done/workflows/execute-plan.md
@.agent/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/03-per-workspace-mcp-endpoints-+-connect-to-ai/03-CONTEXT.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update Auth & Token Validation Logic</name>
  <read_first>supabase/functions/mcp-server/auth.ts</read_first>
  <action>Update token validation in auth.ts to accept the new self-describing token prefixes (`cv_ws_<hex>` and `cv_org_<hex>`), while maintaining a fallback regex for legacy hex tokens. Implement audience binding per RFC 8707: if the request path specifies a workspace UUID (`/mcp/w/{workspace_uuid}`), ensure the token strictly authorizes access to that exact workspace. Return 403 (not 401) if the token is valid but the audience does not match.</action>
  <verify>
    <automated>npm run test -- supabase/functions/mcp-server/auth.test.ts</automated>
  </verify>
  <done>Token regex handles new prefixes; auth rejects cross-workspace access with 403.</done>
</task>

<task type="auto">
  <name>Task 2: Path-Based Routing for Workspaces</name>
  <read_first>supabase/functions/mcp-server/routing.ts, supabase/functions/mcp-server/index.ts</read_first>
  <action>Update routing logic to intercept `/mcp/w/{workspace_uuid}`. Extract the workspace UUID and pass it into the request context. Adjust the OAuth-protected-resource discovery document at `/.well-known/oauth-protected-resource/mcp/w/{workspace_uuid}` to advertise the correct workspace-scoped `resource` value.</action>
  <verify>
    <automated>npm run test -- supabase/functions/mcp-server/routing.test.ts</automated>
  </verify>
  <done>Path variables are correctly extracted; discovery endpoint returns accurate workspace resource metadata.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries
| Boundary | Description |
|----------|-------------|
| Client → API | MCP requests to workspace-scoped URLs |

## STRIDE Threat Register
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-03-01 | Elevation of Privilege | auth.ts | mitigate | Validate that token workspace_id matches URL workspace UUID (return 403 on mismatch) |
</threat_model>

<verification>
Automated tests pass for token prefixing, audience binding, and path routing.
</verification>

<success_criteria>
`https://api.callvaultai.com/mcp/w/{workspace_uuid}` enforces strict boundary checks and discovery works perfectly.
</success_criteria>

<output>
Create `.planning/phases/03-per-workspace-mcp-endpoints-+-connect-to-ai/03-01-SUMMARY.md` when done
</output>
