# Phase 19: Provisioning Foundation - Context

**Gathered:** 2026-04-10 (auto mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

MCP servers auto-provision for PRO+ orgs with plan gating enforced on every tool call and users can regenerate tokens. This phase upgrades the existing MCP token infrastructure (from v2.0 Phase 18) with auto-provisioning, server-side plan enforcement, and token regeneration — it does NOT add new MCP tools.

</domain>

<decisions>
## Implementation Decisions

### Auto-provisioning trigger
- **D-01:** On org creation with PRO+ plan, auto-create an org-scoped `mcp_tokens` row via a Postgres database trigger (or Supabase function hook). No manual user action required.
- **D-02:** On plan upgrade (free → PRO+), check for existing token and auto-create one if none exists. This handles orgs that were created on free tier then upgraded.
- **D-03:** Auto-provisioned tokens use scope `'organization'` (not workspace) with name `'Auto-provisioned MCP Token'`. User can rename or delete later.

### Server-side plan gating
- **D-04:** The `mcp-server` edge function must check the org's plan tier on every tool invocation, not just at token creation time. Current behavior (UI-only gate) is insufficient.
- **D-05:** Plan check queries the org's active subscription status (via Polar billing data in `subscriptions` or `organization_billing` tables). The check runs after token validation but before tool execution.
- **D-06:** Free-tier org tokens receive a JSON-RPC error: `{ code: -32001, message: "MCP access requires a Pro or Team plan. Upgrade at https://app.callvaultai.com/settings" }`. Not a silent failure, not a generic 500.
- **D-07:** Downgraded orgs (PRO → free) are rejected server-side within one request. Tokens remain in DB but become inert — plan gating on every call handles this automatically.

### Token regeneration
- **D-08:** Add a `regenerate_token` operation that atomically UPDATEs the token hex value in-place (`UPDATE mcp_tokens SET token = encode(gen_random_bytes(32), 'hex') WHERE id = $1`). Preserves name, scope, org_id, workspace_id. Old token immediately stops working.
- **D-09:** Frontend MCPTab gets a "Regenerate" button per token row. Clicking shows a confirmation dialog explaining the old token will immediately stop working. On confirm, calls regenerate service, then shows the new token value in the reveal dialog (same as token creation flow).

### Downgrade behavior
- **D-10:** On plan downgrade (PRO → free), tokens are NOT deleted or soft-deleted. They remain in the `mcp_tokens` table unchanged. The server-side plan gating (D-04/D-05) rejects all tool invocations for free-tier orgs at runtime. If the org re-upgrades, tokens reactivate automatically.

### Claude's Discretion
- Exact timing of auto-provision trigger (synchronous in transaction vs async after commit)
- Whether to add a `plan_tier` cache column on `mcp_tokens` for faster gating, or always join to billing tables
- Error message wording refinements
- Loading states and animation details for regenerate button

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### MCP infrastructure (existing)
- `supabase/functions/mcp-server/index.ts` — Current MCP edge function with 5 tools, Bearer token auth, org boundary enforcement
- `supabase/migrations/20260310160000_mcp_tokens.sql` — mcp_tokens table schema, RLS policies, indexes
- `src/services/mcp-tokens.service.ts` — Token CRUD service (getMcpTokens, createMcpToken, deleteMcpToken, getMcpUrl)
- `src/hooks/useMcpTokens.ts` — TanStack Query hooks for token management
- `src/components/settings/MCPTab.tsx` — Full MCP settings UI (token list, create dialog, reveal dialog, delete confirmation)

### Billing/subscription (needed for plan gating)
- `src/hooks/useSubscription.ts` — Current client-side subscription check (`useSubscription` hook, `isPaid`, `tier`)
- `src/components/billing/PlanCards.tsx` — Plan tier definitions, Polar product IDs

### Codebase analysis
- `.planning/codebase/MCP_ANALYSIS.md` — Detailed MCP architecture analysis from v2.0
- `.planning/codebase/INTEGRATIONS.md` — External integration patterns (OpenRouter, Polar, etc.)

### Architecture
- `supabase/CLAUDE.md` — Edge function conventions, RLS patterns, migration standards
- `docs/architecture/api-naming-conventions.md` — Function and hook naming standards

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `mcp_tokens` table: Already has org_id, workspace_id, scope, token generation via `encode(gen_random_bytes(32), 'hex')` — regeneration can reuse this Postgres function
- `mcp-server/index.ts`: Already validates Bearer tokens against `mcp_tokens` table, updates `last_used_at` — plan gating inserts between token validation and tool dispatch
- `MCPTab.tsx`: Already has token list, create dialog, reveal dialog, delete confirmation — regenerate adds a button to `TokenRow` and reuses `TokenRevealDialog`
- `mcp-tokens.service.ts`: Already has CRUD pattern — add `regenerateMcpToken(id)` following same pattern
- `useSubscription` hook: Client-side tier check — server-side equivalent needs to query same billing data

### Established Patterns
- Service + Hook separation: `*.service.ts` for pure async, `use*.ts` hooks for React wrapping with TanStack Query
- Edge function auth: Bearer token lookup in `mcp_tokens`, service role key for data queries
- One token per org: Enforced in `createMcpToken` — auto-provisioning respects this limit
- RLS on `mcp_tokens`: `user_id = auth.uid()` — auto-provisioned tokens need a `user_id` (use org owner)
- Zustand v5 double-invocation: `create<T>()(` for any new stores

### Integration Points
- Org creation flow: Where new orgs are created (likely a Supabase function or frontend service) — this is where auto-provisioning hooks in
- Polar billing webhook or subscriptions table: Where plan tier data lives server-side — needed for edge function plan gating
- Settings page routing: MCPTab already mounted in settings — regenerate button is a UI addition, no routing changes

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — analysis stayed within phase scope

</deferred>

---

*Phase: 19-provisioning-foundation*
*Context gathered: 2026-04-10*
