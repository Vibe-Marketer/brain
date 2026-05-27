---
phase: 03-per-workspace-mcp-endpoints-connect-to-ai
plan: 02
type: execute
wave: 2
depends_on: [01]
files_modified:
  - src/components/AIConnectors.tsx
  - src/components/TokenTable.tsx
  - src/pages/WorkspaceSettings.tsx
autonomous: true
requirements: [MCP-03]

must_haves:
  truths:
    - "The token management UI (GitHub-PAT-style) lists every active token per workspace"
    - "Users can mint, list, revoke, and rotate tokens"
    - "A user can copy an MCP config snippet from a 'Connect to AI' button"
  artifacts:
    - path: "src/components/AIConnectors.tsx"
      provides: "AI Connectors tab wrapper and Connect to AI button"
    - path: "src/components/TokenTable.tsx"
      provides: "GitHub-PAT-style token management"
---

<objective>
Build the AI Connectors tab in Workspace Settings, featuring a GitHub-PAT-style token management table and a one-click Connect to AI configuration generator.
Purpose: Empower users to securely manage AI client access on a per-workspace level.
Output: Integrated TokenTable component and renamed AI Connectors tab.
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
  <name>Task 1: Rename Tab and Scaffold AI Connectors</name>
  <read_first>src/pages/WorkspaceSettings.tsx</read_first>
  <action>Rename the existing 'AI Integrations' tab to 'AI Connectors' in the WorkspaceSettings navigation. Create the `AIConnectors` component to act as the host for the token management interface and the 'Connect to AI' configuration snippets.</action>
  <verify>
    <automated>npm run lint</automated>
  </verify>
  <done>Tab is renamed and wrapper component is scaffolded.</done>
</task>

<task type="auto">
  <name>Task 2: Build GitHub-PAT-style Token Management UI</name>
  <read_first>src/components/TokenTable.tsx, src/components/AIConnectors.tsx</read_first>
  <action>Implement `TokenTable.tsx` using Shadcn/UI components. It must list every active token per workspace with columns for Name, Last Used, and Enabled Categories, plus actions to Revoke and Rotate. Ensure mutations invalidate CallVault query caches (`invalidateCallListCaches`) correctly upon settlement. Mint new tokens with the `cv_ws_<hex>` prefix natively via the API.</action>
  <verify>
    <automated>npm run lint</automated>
  </verify>
  <done>Tokens can be fully managed via the UI, adhering to GitHub PAT-style UX patterns.</done>
</task>

<task type="auto">
  <name>Task 3: Implement 'Connect to AI' Flow</name>
  <read_first>src/components/AIConnectors.tsx</read_first>
  <action>Add a 'Connect to AI' button in the AI Connectors tab. Clicking it should reveal pre-filled JSON configuration snippets for Claude Desktop (`claude_desktop_config.json`) and Cursor (`.cursor/mcp.json`). The snippet must include the newly minted or selected workspace token and the precise `/mcp/w/{workspace_uuid}` URL.</action>
  <verify>
    <automated>npm run build</automated>
  </verify>
  <done>Snippets are easily copiable and perfectly formatted for Claude/Cursor.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries
| Boundary | Description |
|----------|-------------|
| User → UI | Token management and exposure |

## STRIDE Threat Register
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-03-02 | Information Disclosure | TokenTable | mitigate | Mask tokens in the UI after initial creation; ensure revoked tokens apply instantly |
</threat_model>

<verification>
UI successfully displays the AI Connectors tab, manages tokens properly, and provides valid JSON snippets.
</verification>

<success_criteria>
Users can easily mint tokens and copy AI config snippets for their workspace.
</success_criteria>

<output>
Create `.planning/phases/03-per-workspace-mcp-endpoints-+-connect-to-ai/03-02-SUMMARY.md` when done
</output>
