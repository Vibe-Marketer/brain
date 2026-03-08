# Phase 19: MCP Audit + Workspace Tokens - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Audit the existing MCP server (callvault-mcp Worker), update all naming from Bank/Vault/Hub to Organization/Workspace/Folder, and build per-workspace MCP token generation with scoped RLS enforcement. Phase 20 adds differentiating tools and multi-client verification — this phase focuses on the foundation: audit, naming, and token infrastructure.

</domain>

<decisions>
## Implementation Decisions

### Token creation flow
- Dedicated dialog/modal for token creation — name field, scope selector, and confirmation step
- Show-once moment is clearer in a modal context than inline expansion
- After generation: show full MCP config JSON block (copy-pasteable for claude_desktop_config.json or equivalent) with the token pre-filled — user copies one block and they're done
- "I've copied it" confirmation button dismisses the show-once view

### Token list display
- Dense table rows (Airtable-style): Name | Scope | Last used | Created | Revoke button
- All info visible at a glance — matches MCP-05 requirement for Airtable-style UI
- Scope column shows human-readable badge with workspace/folder names (e.g., "Sales Team" or "Sales Team > Q1 Calls, Q2 Calls")

### Token navigation placement
- Workspace Settings > MCP tab — tokens are workspace-scoped, so they live under workspace settings
- Consistent with tokens being per-workspace resources
- MCP sidebar link can route to active workspace's settings MCP tab for discoverability

### Scope granularity
- Two scope levels: whole workspace OR specific folders within it
- Folder-level scoping available from day 1 (MCP-05 requires "scope selector: whole Workspace or specific Folders")
- No read-only toggle in Phase 19 — read/write is the only mode

### Scope lifecycle
- When a folder in a token's scope is archived/deleted, token continues working for remaining folders
- If all scoped folders are gone, token has empty scope (returns no data but doesn't error)
- No notification to token owner on scope changes — keep it simple

### Token ownership
- Workspace-level tokens — any workspace admin can view the token list and revoke tokens
- Creator tracked (creator_user_id) but not privileged — any admin manages
- Token secret is never retrievable after creation (show-once pattern)

### Naming transition
- Clean break — all tools use Organization/Workspace/Folder naming
- Old Bank/Vault/Hub tool names stop working
- MCP is currently low-usage; clean break avoids maintenance burden of aliases

### Audit deliverable
- Structured markdown audit document in .planning/ (mcp-audit.md)
- Lists every tool, resource, prompt with current behavior, test result (pass/fail), and gaps identified
- Protocol-level verification + Claude Desktop smoke test (primary client)
- Automated test suite deferred to Phase 20 where multi-client verification (MCP-11) is scoped

### Infrastructure
- Update existing callvault-mcp Worker in place — one deployment target, simpler ops
- Same Worker at callvault-mcp.naegele412.workers.dev

### Revocation behavior
- Immediate revocation — revoke button = token stops working on next request
- No grace period — clear and secure

### Token expiration
- No expiration by default — tokens live until manually revoked
- Matches standard API token patterns (GitHub PATs, Stripe API keys)
- Optional expiration can be added later if needed

### Last-used tracking
- Periodic update (once per hour) — only update last_used_at if more than 1 hour old
- Reduces writes while still useful for identifying stale tokens

### Token limits by tier
- Free tier: 0 MCP tokens (MCP is the Free/paid paywall per STATE.md decision)
- Pro: 5 tokens per workspace
- Team: 25 tokens per workspace

### Claude's Discretion
- Token string format (UUID, random hex, prefixed format like `cv_mcp_...`)
- Exact modal layout and animation
- Error message copy for revoked/expired token responses
- RLS implementation approach (JWT claims vs join queries)
- Database table schema for workspace_mcp_tokens

</decisions>

<specifics>
## Specific Ideas

- MCP config JSON block should be a complete, ready-to-paste snippet — zero manual editing required
- Token list should make it obvious which tokens are active vs stale (last-used > 30 days gets visual indicator)
- The audit should document the current McpServer factory pattern (per-request, stateless, no Durable Objects) from Phase 12 decisions
- RLS must check CURRENT workspace membership at query time (P9 pitfall from ROADMAP.md) — not JWT claims from token issuance time

</specifics>

<deferred>
## Deferred Ideas

- Read-only token scope (separate from read/write) — could be useful for shared dashboards
- Token rotation/regeneration flow (revoke old + create new in one action)
- Email notification when token is revoked or scope changes
- Token usage analytics (request count, tools used, data accessed)
- Automated test suite for MCP capabilities (deferred to Phase 20 MCP-11)

</deferred>

---

*Phase: 19-mcp-audit-workspace-tokens*
*Context gathered: 2026-02-28*
