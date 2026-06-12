# Phase 03: Per-Workspace MCP Endpoints + Connectors Setup - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-28
**Phase:** 03-Per-Workspace MCP Endpoints + Connectors Setup
**Areas discussed:** OAuth consent and default permissions, Workspace selection and connection flow, Connected AI clients list, Manual token fallback behavior

---

## OAuth Consent and Default Permissions

| Option | Description | Selected |
|--------|-------------|----------|
| Read-only | Safest launch default; AI can search/list/read calls but cannot mutate anything until the user explicitly enables more. | |
| Read + AI | Lets the AI read calls and use AI tools, but still blocks writes/admin. | |
| Read + Write + AI | Most capable for power users, but riskier because agents can change vault data immediately. | |
| Full access except admin | Broad normal workspace/org access while keeping admin tools separate. | ✓ |
| Other | Freeform default. | |

**User's choice:** Full non-admin OAuth access scoped to selected org/workspace.
**Notes:** User asked whether this overlaps with Claude's own "allow once / always allow / always ask" approval layer. The answer captured: client approval and CallVault authorization are separate layers. Server-side enforcement must be immediate; visible client tool lists may require reconnect/reload. Granular scoped access should use manual tokens in v1. Admin-scoped MCP is future work.

---

## Workspace Selection and Connection Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Workspace-first from Connectors | User starts on a workspace surface and OAuth binds to that workspace. | |
| Consent-page picker | OAuth consent always asks user to choose org/workspace. | |
| Org by default, workspace optional | OAuth connects at org scope unless the user opts into workspace scope. | |
| Other | Freeform flow. | ✓ |

**User's choice:** Keep existing org-scoped default and add a checkbox on the acceptance page to scope the MCP connection to a specific workspace. Checking the box reveals a workspace dropdown.
**Notes:** User also wants the ability to connect to a workspace directly from CallVault and ideally open/auth/add the MCP inside top AI providers. This is captured as a research target because provider support must be verified.

---

## Connected AI Clients List

| Option | Description | Selected |
|--------|-------------|----------|
| Unified connection list | One "MCP Connections" list with OAuth clients and manual tokens together. | |
| Grouped sections | OAuth-connected clients first, manual tokens below. | ✓ |
| Workspace-first view | Choose a workspace, then see scoped connections and applicable org connections. | |
| Other | Freeform layout. | |

**User's choice:** Grouped sections.
**Notes:** This should live directly inside the AI connectors tab in Settings. OAuth-connected clients appear at the top with copy that this is the simplest/easiest way to connect. Token-based connectors are below for more control/scoping or providers that do not support OAuth.

---

## Manual Token Fallback Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Secondary but visible | OAuth section is primary/top. Token section is below with clear control/fallback copy. | ✓ |
| Advanced/collapsed | Token setup hidden behind advanced setup. | |
| Equal weight | OAuth and tokens presented as equal methods. | |
| Admin-only | Only org admins can create token connections. | |
| Other | Freeform preference. | |

**User's choice:** Secondary but visible.
**Notes:** Token setup should not be hidden behind advanced settings in v1.

---

## the agent's Discretion

- Exact UI wording, badges, and card/row layout.
- Exact top provider list after research, as long as Claude, ChatGPT, Perplexity, Gemini, and Manus are investigated.
- Exact error text for server-side permission rejection.

## Deferred Ideas

- Admin-scoped MCP as a future/admin-specific connection type.
- Provider-specific auto-add/deep-link implementation until Phase 03 research validates support per provider.
