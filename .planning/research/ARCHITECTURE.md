# Architecture Research

**Domain:** MCP Production Infrastructure for SaaS (per-org, plan-gated, AI tools)
**Researched:** 2026-04-10
**Confidence:** HIGH — based on direct codebase analysis, no speculation

---

## What Already Exists (Do Not Rebuild)

| Component | File | Status |
|-----------|------|--------|
| MCP JSON-RPC endpoint | `supabase/functions/mcp-server/index.ts` | Deployed, working |
| Token table + RLS | `supabase/migrations/20260310160000_mcp_tokens.sql` | In production |
| Token service (CRUD) | `src/services/mcp-tokens.service.ts` | Working |
| Token hooks | `src/hooks/useMcpTokens.ts` | Working |
| Settings UI | `src/components/settings/MCPTab.tsx` | Working, PRO-gated |
| Plan gate pattern | `useSubscription` hook → `isPaid` flag | Working across app |
| AI call pattern | `supabase/functions/summarize-call/index.ts` | OpenRouter + Vercel AI SDK v5 |

The existing `mcp-server` already handles: `tools/list`, `initialize`, `search_calls`, `list_calls`, `get_transcript`, `get_recording_context`, `list_workspaces`. Token lookup, org-scoping, and `last_used_at` tracking are all implemented.

---

## System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  External AI Clients (Claude Desktop, Cursor, ChatGPT, etc.)         │
│  POST /functions/v1/mcp-server   Authorization: Bearer {token}       │
└───────────────────────────────────┬──────────────────────────────────┘
                                    │  JSON-RPC 2.0
┌───────────────────────────────────▼──────────────────────────────────┐
│  mcp-server (Supabase Edge Function — Deno)                          │
│                                                                      │
│  1. Parse JSON-RPC body                                              │
│  2. Lookup token in mcp_tokens → resolve org_id / workspace_id       │
│  3. Plan gate check (token.org has PRO+ sub)   ← NEW                 │
│  4. Route to tool handler                                            │
│                                                                      │
│  Existing tools:                 New tools (v2.1):                   │
│  · search_calls                  · organize/add_to_folder    ← NEW   │
│  · list_calls                    · organize/tag_call         ← NEW   │
│  · get_transcript                · organize/add_note         ← NEW   │
│  · get_recording_context         · ai/summarize              ← NEW   │
│  · list_workspaces               · ai/extract_action_items   ← NEW   │
│                                  · ai/cross_call_query       ← NEW   │
│                                  · ai/coaching_analysis      ← NEW   │
└──────────┬──────────────────────────────────────┬────────────────────┘
           │ service role queries                  │ OpenRouter calls
┌──────────▼────────────────┐      ┌───────────────▼──────────────────┐
│  Supabase Postgres         │      │  OpenRouter API                  │
│                            │      │  (via Vercel AI SDK v5)          │
│  mcp_tokens                │      │  same pattern as summarize-call  │
│  recordings                │      └──────────────────────────────────┘
│  workspace_entries         │
│  workspaces                │
│  organizations             │
│  folders / folder_entries  │  ← writes for organize tools
│  call_tag_assignments      │  ← writes for tag tool
│  recording_notes           │  ← writes for note tool
│  user_profiles             │  ← reads for plan gate
└────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  Auto-Provisioning (NEW)                                             │
│                                                                      │
│  Trigger: handle_new_user() Postgres function (auth.users INSERT)    │
│  OR: polar-webhook subscription.active event                         │
│                                                                      │
│  Logic: if org has PRO+ subscription → INSERT mcp_tokens row         │
│  Token name: "Auto-provisioned" / scope: "organization"              │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  React Frontend (existing — minimal changes)                         │
│                                                                      │
│  MCPTab.tsx — add capability toggles, show auto-provisioned token    │
│  Settings page — no new routes needed                                │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Component Responsibilities

| Component | Responsibility | Status |
|-----------|---------------|--------|
| `mcp-server` edge function | JSON-RPC routing, auth, org isolation, tool execution | Exists — extend |
| `mcp_tokens` table | Token storage, org/workspace scope, last_used_at | Exists — add `capabilities` column |
| Token service + hook | CRUD from React | Exists — no changes needed |
| `MCPTab.tsx` | Management UI | Exists — add capability toggles |
| Plan gate in mcp-server | PRO+ check per request | NEW — add to mcp-server |
| CRUD tool handlers | Folder/tag/note writes | NEW — add cases to mcp-server |
| AI tool handlers | Summarize, action items, coaching | NEW — add cases to mcp-server |
| Auto-provisioning | Token INSERT on org creation or upgrade | NEW — DB trigger or polar-webhook |

---

## Recommended Project Structure (New Files Only)

No new files needed for the edge function layer — all additions go into the existing `mcp-server/index.ts`. The Postgres migration is the only required new file for auto-provisioning.

```
supabase/
  functions/
    mcp-server/
      index.ts              ← extend with new tool cases + plan gate
  migrations/
    20260410XXXXXX_mcp_capabilities_and_autoprovision.sql  ← NEW
      · ALTER mcp_tokens ADD COLUMN capabilities JSONB DEFAULT '{}'
      · SQL function: provision_mcp_token_for_org(org_id, user_id)
      · Modify handle_new_user() to call provision_mcp_token_for_org (trialing counts)

src/
  components/
    settings/
      MCPTab.tsx             ← extend with capability toggle UI
```

---

## Data Flow: MCP Tool Request

```
AI Client sends:
  POST /functions/v1/mcp-server
  Authorization: Bearer cv_abc123...
  { "jsonrpc": "2.0", "id": 1, "method": "callvault/ai_summarize",
    "params": { "recording_id": "uuid-here" } }

mcp-server handler:
  1. Parse body → extract method, params, id
  2. SELECT from mcp_tokens WHERE token = 'cv_abc123' → get org_id, scope, capabilities
  3. CHECK plan gate: SELECT subscription_status, product_id FROM user_profiles
        WHERE user_id = (SELECT user_id FROM organization_memberships
                         WHERE organization_id = org_id AND role = 'organization_owner')
     → if not PRO+: return mcpError(-32001, "PRO subscription required")
  4. CHECK capability: if capabilities.ai_tools = false → return mcpError
  5. Verify recording access (existing org boundary check)
  6. Fetch transcript from recordings table
  7. POST to OpenRouter (same pattern as summarize-call edge function)
  8. Return mcpOk(id, { summary: "..." })
```

**Critical:** Step 3 plan gate query must resolve the owner's subscription, not just org_id. Pattern: join `organization_memberships` (role = organization_owner) → `user_profiles`.

---

## Data Flow: Auto-Provisioning

Two triggers needed, both leading to the same `provision_mcp_token_for_org()` function:

**Path A — Signup with trial (immediate access)**
```
User signs up
  → handle_new_user() Postgres trigger fires
  → creates org + workspace (already exists)
  → calls provision_mcp_token_for_org(v_organization_id, NEW.id)
  → INSERT INTO mcp_tokens (org_id, user_id, scope='organization', name='Default')
  → token auto-generated by Postgres default
```

**Path B — Free user upgrades to PRO**
```
Polar webhook fires: subscription.active event
  → polar-webhook edge function
  → resolves user from external_id (user_id stored in Polar)
  → looks up user's org_id from organization_memberships
  → calls provision_mcp_token_for_org(org_id, user_id) via Supabase RPC
  → INSERT INTO mcp_tokens if not already exists (idempotent)
```

The `provision_mcp_token_for_org` function must be idempotent: check for existing org token before inserting. Current `createMcpToken` in the service already enforces one-per-org; replicate this in SQL.

---

## New Tools: CRUD + AI

All new tools are new `case` blocks in the existing `mcp-server/index.ts` switch statement.

### CRUD Tools (writes to DB)

| Tool name | What it does | Tables touched | Access check |
|-----------|-------------|----------------|--------------|
| `callvault/add_to_folder` | Move recording into a folder | `folder_entries` | Verify folder.org_id matches token.org_id |
| `callvault/tag_call` | Assign a tag to a recording | `call_tag_assignments` | Verify tag.org_id matches token.org_id |
| `callvault/add_note` | Append a note to a recording | `recording_notes` | Verify recording accessible via org boundary check |

All writes use the service role key but manually enforce org isolation (same pattern as existing read tools).

### AI Tools (OpenRouter calls)

| Tool name | Input | AI action | Uses existing function? |
|-----------|-------|-----------|------------------------|
| `callvault/ai_summarize` | recording_id | Summarize transcript | Delegate to `summarize-call` via internal Supabase function call, OR inline OpenRouter call |
| `callvault/ai_action_items` | recording_id | Extract action items + owners | Inline OpenRouter (same pattern as generate-content) |
| `callvault/ai_cross_query` | query string | Semantic search across transcripts + synthesize | Inline OpenRouter with multi-recording context |
| `callvault/ai_coaching` | recording_id | Sentiment + coaching analysis | Inline OpenRouter |

**Recommendation:** Inline the OpenRouter calls directly in `mcp-server` rather than delegating to other edge functions. Reason: avoids cold-start chain latency and avoids re-authentication round-trips. Reuse the exact OpenRouter call pattern from `summarize-call/index.ts` (Vercel AI SDK v5 + `@openrouter/ai-sdk-provider@1.2.8`).

---

## Plan Gating Architecture

### Where to enforce
Enforce at the `mcp-server` edge function level, not at the DB level. Reason: MCP tokens use service role (bypasses RLS), so RLS cannot gate plan access. The existing `MCPTab.tsx` UI already gates token creation to `isPaid` users, but tokens created during a trial would survive plan downgrade without server-side enforcement.

### How to resolve org owner's plan
The `mcp_tokens` table has `user_id` (the token creator). Simplest plan gate:

```typescript
// After resolving mcpToken from mcp_tokens:
const { data: profile } = await supabase
  .from('user_profiles')
  .select('subscription_status, product_id')
  .eq('user_id', mcpToken.user_id)
  .maybeSingle();

const isProPlus = profile && (
  (profile.subscription_status === 'active' || profile.subscription_status === 'trialing') &&
  profile.product_id !== null
);
if (!isProPlus) return mcpError(id, -32001, 'PRO subscription required for MCP access', corsHeaders);
```

This uses `mcpToken.user_id` directly — no org owner join needed. The token creator is always the org owner or admin who set up MCP.

### Capability toggles
Add a `capabilities JSONB` column to `mcp_tokens` (default `{}`). Absence of a key = feature enabled (opt-out model). The UI in `MCPTab.tsx` shows toggles; the server reads `mcpToken.capabilities.ai_tools !== false` before executing AI tool cases.

---

## Architectural Patterns

### Pattern 1: Add-to-existing-switch

All new MCP tools are new `case` entries in the existing `switch (method)` block. No new edge functions for individual tools — the single `mcp-server` function serves all tools. This keeps cold-start overhead minimal (one function, one token lookup, one plan check per request).

### Pattern 2: Idempotent provisioning function

The SQL provisioning function uses `INSERT ... WHERE NOT EXISTS`:

```sql
CREATE OR REPLACE FUNCTION public.provision_mcp_token_for_org(
  p_org_id UUID,
  p_user_id UUID
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER AS $$
BEGIN
  INSERT INTO mcp_tokens (user_id, org_id, scope, name)
  SELECT p_user_id, p_org_id, 'organization', 'Default'
  WHERE NOT EXISTS (
    SELECT 1 FROM mcp_tokens WHERE org_id = p_org_id
  );
END;
$$;
```

Called from both `handle_new_user()` trigger and `polar-webhook` upgrade path.

### Pattern 3: Capability opt-out

```typescript
// In mcp-server, before executing an AI tool:
const capabilities = (mcpToken as McpToken & { capabilities?: Record<string, boolean> }).capabilities ?? {};
if (capabilities.ai_tools === false) {
  return mcpError(id, -32001, 'AI tools are disabled for this token', corsHeaders);
}
```

---

## Integration Points

### mcp-server ↔ OpenRouter
Same pattern already proven in `summarize-call` and `generate-content`. Import `createOpenRouter` from `https://esm.sh/@openrouter/ai-sdk-provider@1.2.8` and `generateText` from `https://esm.sh/ai@5.0.102`. Use `OPENROUTER_API_KEY` env var already configured on the project.

### polar-webhook ↔ mcp-server provisioning
The `polar-webhook` function does not call `mcp-server` directly. Instead, on `subscription.active` event, it calls `supabase.rpc('provision_mcp_token_for_org', { p_org_id, p_user_id })`. This keeps provisioning in the DB layer, not in inter-function HTTP calls.

### MCPTab.tsx ↔ mcp_tokens
No service/hook changes needed. Add capability toggle state to the existing `McpToken` type (`capabilities?: Record<string, boolean>`) and add an update mutation in the service. The `MCPTab.tsx` displays toggles per token using the `capabilities` JSONB column.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Per-tool edge functions
What people do: Create `mcp-summarize`, `mcp-tag-call`, `mcp-add-note` as separate edge functions.
Why it's wrong: Each has its own cold start, each needs its own token lookup + plan check, latency compounds for the AI client, deployment complexity multiplies.
Do this instead: Single `mcp-server` switch statement, all tools in one function.

### Anti-Pattern 2: RLS-based plan gating for MCP
What people do: Add a Postgres policy that checks `user_profiles.subscription_status` for MCP-related tables.
Why it's wrong: MCP tokens authenticate via the service role key, which bypasses RLS entirely. RLS policies on the MCP path are dead code.
Do this instead: Application-level plan gate inside the `mcp-server` handler (see plan gating section above).

### Anti-Pattern 3: Delegating AI tool calls to other edge functions
What people do: Have `mcp-server` POST to `/functions/v1/summarize-call` internally.
Why it's wrong: Supabase Edge Functions cannot call each other via HTTP without going through the public network, adding ~200ms+ latency and a second auth hop.
Do this instead: Inline the OpenRouter call pattern in `mcp-server`. Copy the relevant prompt + schema from `summarize-call/index.ts`.

### Anti-Pattern 4: Provisioning via API call from frontend
What people do: After Polar checkout, frontend calls a provision-mcp endpoint.
Why it's wrong: Client can be closed before the call completes; provisioning tied to browser session.
Do this instead: Trigger provisioning from `polar-webhook` (server-to-server, reliable) and from the `handle_new_user()` DB trigger (infallible, runs in transaction with org creation).

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k orgs | Single mcp-server function, no changes needed. Token lookup is O(1) via index. |
| 1k-10k orgs | Add `enabled` boolean to `mcp_tokens` to quickly disable at DB level without deleting. Consider caching plan status per token (Redis/Upstash) to avoid user_profiles join on every request. |
| 10k+ orgs | Token lookup + plan check = 2 DB reads per request. With high MCP request volume, consider materializing plan status into `mcp_tokens.plan_tier` column, updated by polar-webhook. |

First bottleneck at scale: the plan gate DB read (`user_profiles` join) on every MCP request. Short-term fix: add `plan_valid_until TIMESTAMPTZ` column to `mcp_tokens`, populated at subscription events, checked in-memory.

---

## Build Order (Phase Sequence)

Dependencies drive this order:

1. **DB migration** — `capabilities` column on `mcp_tokens` + `provision_mcp_token_for_org()` SQL function. Everything else depends on this schema being in place.

2. **Plan gate in mcp-server** — Add PRO+ check before any tool execution. Ships with existing tools still working; just adds the gate. Safe to ship to production immediately.

3. **Auto-provisioning** — Modify `handle_new_user()` trigger to call `provision_mcp_token_for_org`. Add RPC call in `polar-webhook` on `subscription.active`. Validate with a test signup and a test upgrade.

4. **CRUD tools** — Add `add_to_folder`, `tag_call`, `add_note` cases to mcp-server. These are pure DB writes with org boundary checks — no external dependencies. Verify write isolation carefully.

5. **AI tools** — Add `ai_summarize`, `ai_action_items`, `ai_cross_query`, `ai_coaching` cases. Requires `OPENROUTER_API_KEY` (already set), `LANGFUSE_*` optional for tracing. Build one tool end-to-end first, validate latency, then add remaining.

6. **Capability toggles UI** — Add `capabilities` JSONB rendering in `MCPTab.tsx`. Update `McpToken` type, add update mutation to service. Ships last because it's purely UI enhancement on top of working infrastructure.

---

## Sources

- Direct analysis of `/Users/Naegele/dev/brain/supabase/functions/mcp-server/index.ts` (HIGH confidence)
- Direct analysis of `/Users/Naegele/dev/brain/supabase/migrations/20260310160000_mcp_tokens.sql` (HIGH confidence)
- Direct analysis of `/Users/Naegele/dev/brain/supabase/migrations/20260403190000_fix_signup_trigger.sql` (HIGH confidence)
- Direct analysis of `/Users/Naegele/dev/brain/supabase/functions/polar-webhook/index.ts` (HIGH confidence)
- Direct analysis of `/Users/Naegele/dev/brain/supabase/functions/summarize-call/index.ts` (HIGH confidence)
- Direct analysis of `/Users/Naegele/dev/brain/src/hooks/useSubscription.ts` (HIGH confidence)
- Direct analysis of `/Users/Naegele/dev/brain/src/components/settings/MCPTab.tsx` (HIGH confidence)

---
*Architecture research for: MCP Production Infrastructure (v2.1)*
*Researched: 2026-04-10*
