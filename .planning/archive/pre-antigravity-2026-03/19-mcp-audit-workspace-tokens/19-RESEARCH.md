# Phase 19: MCP Audit + Workspace Tokens - Research

**Researched:** 2026-02-28
**Domain:** MCP Worker audit, Cloudflare Worker token infra, Supabase RLS for scoped tokens, React token management UI
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Token creation flow
- Dedicated dialog/modal for token creation — name field, scope selector, and confirmation step
- Show-once moment is clearer in a modal context than inline expansion
- After generation: show full MCP config JSON block (copy-pasteable for claude_desktop_config.json or equivalent) with the token pre-filled — user copies one block and they're done
- "I've copied it" confirmation button dismisses the show-once view

#### Token list display
- Dense table rows (Airtable-style): Name | Scope | Last used | Created | Revoke button
- All info visible at a glance — matches MCP-05 requirement for Airtable-style UI
- Scope column shows human-readable badge with workspace/folder names (e.g., "Sales Team" or "Sales Team > Q1 Calls, Q2 Calls")

#### Token navigation placement
- Workspace Settings > MCP tab — tokens are workspace-scoped, so they live under workspace settings
- Consistent with tokens being per-workspace resources
- MCP sidebar link can route to active workspace's settings MCP tab for discoverability

#### Scope granularity
- Two scope levels: whole workspace OR specific folders within it
- Folder-level scoping available from day 1 (MCP-05 requires "scope selector: whole Workspace or specific Folders")
- No read-only toggle in Phase 19 — read/write is the only mode

#### Scope lifecycle
- When a folder in a token's scope is archived/deleted, token continues working for remaining folders
- If all scoped folders are gone, token has empty scope (returns no data but doesn't error)
- No notification to token owner on scope changes — keep it simple

#### Token ownership
- Workspace-level tokens — any workspace admin can view the token list and revoke tokens
- Creator tracked (creator_user_id) but not privileged — any admin manages
- Token secret is never retrievable after creation (show-once pattern)

#### Naming transition
- Clean break — all tools use Organization/Workspace/Folder naming
- Old Bank/Vault/Hub tool names stop working
- MCP is currently low-usage; clean break avoids maintenance burden of aliases

#### Audit deliverable
- Structured markdown audit document in .planning/ (mcp-audit.md)
- Lists every tool, resource, prompt with current behavior, test result (pass/fail), and gaps identified
- Protocol-level verification + Claude Desktop smoke test (primary client)
- Automated test suite deferred to Phase 20 where multi-client verification (MCP-11) is scoped

#### Infrastructure
- Update existing callvault-mcp Worker in place — one deployment target, simpler ops
- Same Worker at callvault-mcp.naegele412.workers.dev

#### Revocation behavior
- Immediate revocation — revoke button = token stops working on next request
- No grace period — clear and secure

#### Token expiration
- No expiration by default — tokens live until manually revoked
- Matches standard API token patterns (GitHub PATs, Stripe API keys)
- Optional expiration can be added later if needed

#### Last-used tracking
- Periodic update (once per hour) — only update last_used_at if more than 1 hour old
- Reduces writes while still useful for identifying stale tokens

#### Token limits by tier
- Free tier: 0 MCP tokens (MCP is the Free/paid paywall per STATE.md decision)
- Pro: 5 tokens per workspace
- Team: 25 tokens per workspace

### Claude's Discretion
- Token string format (UUID, random hex, prefixed format like `cv_mcp_...`)
- Exact modal layout and animation
- Error message copy for revoked/expired token responses
- RLS implementation approach (JWT claims vs join queries)
- Database table schema for workspace_mcp_tokens

### Deferred Ideas (OUT OF SCOPE)
- Read-only token scope (separate from read/write) — could be useful for shared dashboards
- Token rotation/regeneration flow (revoke old + create new in one action)
- Email notification when token is revoked or scope changes
- Token usage analytics (request count, tools used, data accessed)
- Automated test suite for MCP capabilities (deferred to Phase 20 MCP-11)
</user_constraints>

---

## Summary

Phase 19 has three distinct work streams that must proceed in sequence: (1) audit the deployed Worker and produce a structured mcp-audit.md document, (2) rename all Bank/Vault/Hub references in the MCP Worker to Organization/Workspace/Folder and redeploy, and (3) build the `workspace_mcp_tokens` table, a Supabase Edge Function for token generation, a new auth path in the Worker, and the React token management UI.

The deployed MCP Worker (`callvault-mcp.naegele412.workers.dev`) is a stateless, per-request `McpServer` factory built on `@modelcontextprotocol/sdk` with `WebStandardStreamableHTTPServerTransport`. It currently has 4 tools (`callvault_discover`, `callvault_get_schema`, `callvault_execute`, `callvault_continue`), ~18 resources (operations index + per-category + per-operation), and 6 prompts. All tool names use old terminology (`list_banks`, `list_vaults`) in `operations.json` which is the catalog the `discover` and `get_schema` tools serve.

The token architecture uses opaque tokens (not JWTs) stored in a new `workspace_mcp_tokens` table. The Worker validates incoming bearer tokens against this table via a Supabase Edge Function lookup, then constructs a scoped Supabase client constrained to the token's `workspace_id` (and optionally `folder_ids`). RLS enforces isolation at query time by joining against CURRENT `vault_memberships` — not JWT claims from issuance time. This is the P9 pitfall: JWT claims baked at issuance would be stale if workspace membership changes after the token was created.

The React UI lives in Workspace Settings and follows existing patterns: Radix Tabs (matching the existing `WorkspaceMemberPanel`), Dialog from `@/components/ui/dialog`, Table from `@/components/ui/table`. The Settings page at `src/pages/Settings.tsx` uses a category-based pane system (`SETTINGS_CATEGORIES` from `SettingsCategoryPane`) — the MCP tab for a workspace is a new page under the workspaces route, not the global settings route.

**Primary recommendation:** Build in strict order: audit → rename+redeploy → DB migration → Edge Function → Worker auth path → React UI. Each step depends on the previous.

---

## Standard Stack

### Core (No New Libraries Required)

| Component | Current State | Version | What Changes |
|-----------|--------------|---------|--------------|
| `@modelcontextprotocol/sdk` | Deployed in Worker | ^1.12.1 (current) | No version change needed |
| `@supabase/supabase-js` | In Worker and frontend | ^2.49.4 / ^2.84.0 | No change |
| `zod` | In Worker | ^3.24.0 | No change |
| `jose` | In Worker (`auth-middleware.ts`) | Deployed | No change for OAuth path; MCP token path uses DB lookup |
| Radix UI Tabs | In frontend | Installed | Use for MCP tab in workspace detail |
| Radix UI Dialog | In frontend | Installed | Use for token creation dialog |
| `@/components/ui/table` | In frontend | shadcn/ui | Use for token list table |

### New Infrastructure

| Component | Version | Purpose | Notes |
|-----------|---------|---------|-------|
| Supabase Edge Function: `generate-mcp-token` | new | Generate opaque token, enforce tier limits, return show-once token | Deno, follows existing Edge Function pattern |
| DB table: `workspace_mcp_tokens` | new migration | Store token hash, workspace_id, scoped_folder_ids, creator, last_used_at | See schema below |
| Worker: MCP token auth path | new code in worker.ts | Validate opaque tokens against DB, build scoped context | Parallel path alongside OAuth |

**Installation:** No new npm packages needed. All infrastructure is existing libs + new Supabase resources.

---

## Architecture Patterns

### Recommended File Structure

```
callvault-mcp/src/
├── worker.ts                    # MODIFY: add mcp-token auth path
├── auth-middleware.ts           # MODIFY: add validateMcpToken() function
├── operations.json              # MODIFY: rename all bank/vault/hub terms
├── handlers/
│   ├── navigation.ts            # MODIFY: rename listBanks→listOrgs, listVaults→listWorkspaces, queries stay same
│   └── ...                      # Other handlers: unchanged (RLS handles scoping)
└── types.ts                     # MODIFY: add token_workspace_id to RequestContext

src/components/workspace/
├── WorkspaceMcpPanel.tsx        # NEW: MCP tab content (token table + generate button)
├── GenerateMcpTokenDialog.tsx   # NEW: create token dialog (name + scope + show-once)
└── McpTokenRow.tsx              # NEW: dense table row component

supabase/
├── migrations/
│   └── YYYYMMDD_workspace_mcp_tokens.sql  # NEW: table + RLS
└── functions/
    └── generate-mcp-token/
        └── index.ts             # NEW: Edge Function
```

### Pattern 1: Opaque Token Validation in Worker

The Worker currently validates Supabase OAuth JWTs via `jose` JWKS verification. For MCP tokens, the path is different — opaque tokens must be looked up in the database.

**What:** Two-path auth in `worker.ts`:
- Path A (existing): JWT starting with three-part base64 structure → `validateSupabaseToken` via JWKS
- Path B (new): Opaque prefixed token (`cv_mcp_...`) → lookup in `workspace_mcp_tokens` via Supabase service client

**When to use:** Path B when token starts with `cv_mcp_` prefix. Path A for all other Bearer tokens.

```typescript
// Source: established pattern + Supabase docs
// In worker.ts auth section:

const token = authHeader.slice(7);

if (token.startsWith('cv_mcp_')) {
  // MCP opaque token path
  const tokenResult = await validateMcpToken(token, env);
  if (!tokenResult.valid) {
    return unauthorized401(url);
  }
  // tokenResult.userId, tokenResult.workspaceId, tokenResult.scopedFolderIds
  const supabase = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY,
    await getMemberTokenForUser(tokenResult.userId, env)); // get a user-scoped Supabase token
  const context: RequestContext = {
    supabase,
    userId: tokenResult.userId,
    tokenWorkspaceId: tokenResult.workspaceId,       // new field
    tokenScopedFolderIds: tokenResult.scopedFolderIds, // new field (null = whole workspace)
  };
} else {
  // Existing OAuth JWT path
  const tokenResult = await validateSupabaseToken(request, env.SUPABASE_URL);
  // ... existing handling
}
```

**Critical constraint on the Supabase client:** Opaque MCP tokens are NOT Supabase JWTs — they cannot be used directly as the `Authorization: Bearer` header to Supabase. The Worker needs a mechanism to query Supabase on behalf of the token's user. Two options:

- **Option A (recommended):** Use a service-role Supabase client in the Worker and enforce workspace scoping at the handler level (pass `tokenWorkspaceId` through context, filter all queries). Simpler and avoids needing user JWTs stored server-side.
- **Option B:** Store a per-user Supabase refresh token alongside the MCP token at creation time and refresh it per-request. Allows RLS to apply natively but adds complexity and token storage.

**Recommendation: Option A.** Use service-role client scoped by `tokenWorkspaceId` in context. The `workspace_mcp_tokens` table's own RLS (plus the `vault_memberships` join check at query time) provides the security. The `validateMcpToken` function must verify that the token owner is STILL a member of the workspace at validation time — this satisfies the P9 pitfall requirement.

```typescript
// auth-middleware.ts addition
export async function validateMcpToken(
  token: string,
  env: Env
): Promise<McpTokenValidationResult> {
  // Use service role client to look up token
  const adminSupabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Hash the token for DB lookup (store hash, not plaintext)
  const tokenHash = await hashToken(token);

  const { data: tokenRow } = await adminSupabase
    .from('workspace_mcp_tokens')
    .select(`
      id, user_id, workspace_id, scoped_folder_ids, is_revoked,
      vault_membership:vault_memberships!inner (
        vault_id, user_id
      )
    `)
    .eq('token_hash', tokenHash)
    .eq('is_revoked', false)
    .eq('vault_memberships.vault_id', 'workspace_id') // join check
    .maybeSingle();

  // Simpler: do two queries — token lookup + live membership check
  const { data: tokenRow2 } = await adminSupabase
    .from('workspace_mcp_tokens')
    .select('id, user_id, workspace_id, scoped_folder_ids, is_revoked, last_used_at')
    .eq('token_hash', tokenHash)
    .eq('is_revoked', false)
    .maybeSingle();

  if (!tokenRow2) return { valid: false, error: 'Token not found or revoked' };

  // P9 pitfall: check CURRENT membership, not cached
  const { data: membership } = await adminSupabase
    .from('vault_memberships')
    .select('role')
    .eq('vault_id', tokenRow2.workspace_id)
    .eq('user_id', tokenRow2.user_id)
    .maybeSingle();

  if (!membership) return { valid: false, error: 'Token owner no longer has access to this workspace' };

  // Periodic last_used_at update (once per hour)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  if (!tokenRow2.last_used_at || tokenRow2.last_used_at < oneHourAgo) {
    await adminSupabase
      .from('workspace_mcp_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', tokenRow2.id);
  }

  return {
    valid: true,
    userId: tokenRow2.user_id,
    workspaceId: tokenRow2.workspace_id,
    scopedFolderIds: tokenRow2.scoped_folder_ids, // null = whole workspace
  };
}
```

### Pattern 2: Service-Role Client Scope Enforcement in Handlers

Since the Worker uses a service-role client for MCP token auth, handlers must filter by workspace. The `RequestContext` gets two new optional fields: `tokenWorkspaceId` and `tokenScopedFolderIds`.

```typescript
// types.ts addition
export interface RequestContext {
  supabase: SupabaseClient;
  userId: string;
  // Set only for MCP token auth path (not OAuth)
  tokenWorkspaceId?: string;
  tokenScopedFolderIds?: string[] | null; // null = whole workspace, [] = empty (no data)
}
```

Handlers that already accept `vault_id` param (like `recordings.search`, `recordings.list`) pass it through to filter `vault_entries`. For MCP token auth, if `tokenWorkspaceId` is set:
- The token's `workspace_id` must equal the `vault_id` param (or the param must be absent and workspace is auto-applied)
- If `tokenScopedFolderIds` is non-null, only those folder IDs are accessible

This does NOT require changing existing query logic for the OAuth path — only the MCP token path layers in these constraints.

### Pattern 3: operations.json Naming Migration

The `operations.json` file is the catalog served by `callvault_discover` and `callvault_get_schema`. All user-facing terminology in descriptions must change. The handler routing in `handlers/index.ts` uses the operation keys as strings.

**Current → New operation key mapping:**

| Category | Old Key | New Key |
|----------|---------|---------|
| navigation | `list_banks` | `list_organizations` |
| navigation | `list_vaults` | `list_workspaces` |
| navigation | `list_folders` | `list_folders` (unchanged) |
| navigation | `list_tags` | `list_tags` (unchanged) |
| recordings | (all keys) | unchanged |
| transcripts | (all keys) | unchanged |
| search | (all keys) | unchanged |
| contacts | (all keys) | unchanged |
| analysis | (all keys) | unchanged |

**Handler function rename:**
- `listBanks` → `listOrganizations` (same query: `bank_memberships` JOIN `banks`)
- `listVaults` → `listWorkspaces` (same query: `vault_memberships` JOIN `vaults`)
- All other handlers: no rename needed, only description strings change if referenced in prompts

**Prompts that reference old names:** The 6 prompts in `prompts.ts` reference operation names in their instruction text (e.g., "use callvault_execute with operation 'recordings.search'"). These operation names are unchanged. The prompts also mention `vault_id` parameters — these remain `vault_id` in the schema (it's the DB column name, not user-visible terminology). Only user-facing `bank_id` references in prompts need updating to `organization_id`.

### Pattern 4: Token Generation Edge Function

Follows the established Supabase Edge Function pattern from `supabase/CLAUDE.md`.

```typescript
// supabase/functions/generate-mcp-token/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', /* ... */ };

const bodySchema = z.object({
  workspace_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  scoped_folder_ids: z.array(z.string().uuid()).nullable().optional(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Auth
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token!);
  if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

  // Input validation
  const body = bodySchema.safeParse(await req.json());
  if (!body.success) return new Response(JSON.stringify({ error: body.error.errors[0]?.message }), { status: 400, headers: corsHeaders });

  const { workspace_id, name, scoped_folder_ids } = body.data;

  // Check user is workspace admin/owner
  const { data: membership } = await supabase.from('vault_memberships')
    .select('role').eq('vault_id', workspace_id).eq('user_id', user.id).maybeSingle();
  if (!membership || !['vault_owner', 'vault_admin'].includes(membership.role)) {
    return new Response(JSON.stringify({ error: 'Admin role required' }), { status: 403, headers: corsHeaders });
  }

  // Tier check — get user's role
  const { data: userRole } = await supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
  const tierLimits: Record<string, number> = { FREE: 0, PRO: 5, TEAM: 25, ADMIN: 999 };
  const limit = tierLimits[userRole?.role || 'FREE'] ?? 0;
  if (limit === 0) {
    return new Response(JSON.stringify({ error: 'MCP tokens require a Pro or Team plan', upgrade_required: true }), { status: 403, headers: corsHeaders });
  }

  // Count existing active tokens for this workspace
  const { count } = await supabase.from('workspace_mcp_tokens')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspace_id).eq('is_revoked', false);
  if ((count ?? 0) >= limit) {
    return new Response(JSON.stringify({ error: `Token limit reached (${limit} per workspace on your plan)` }), { status: 403, headers: corsHeaders });
  }

  // Generate token: "cv_mcp_" + 32 bytes of random hex = 71 char total
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const tokenSecret = 'cv_mcp_' + Array.from(tokenBytes).map(b => b.toString(16).padStart(2, '0')).join('');

  // Hash for storage (SHA-256)
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(tokenSecret));
  const tokenHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

  // Insert token record
  const { data: tokenRow, error: insertError } = await supabase.from('workspace_mcp_tokens').insert({
    workspace_id,
    creator_user_id: user.id,
    name,
    token_hash: tokenHash,
    scoped_folder_ids: scoped_folder_ids || null,
    is_revoked: false,
  }).select('id, name, workspace_id, scoped_folder_ids, created_at').single();

  if (insertError) return new Response(JSON.stringify({ error: 'Failed to create token' }), { status: 500, headers: corsHeaders });

  return new Response(JSON.stringify({
    token_secret: tokenSecret, // SHOW ONCE — never stored in plaintext
    token_id: tokenRow.id,
    name: tokenRow.name,
    workspace_id: tokenRow.workspace_id,
    scoped_folder_ids: tokenRow.scoped_folder_ids,
    created_at: tokenRow.created_at,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
```

### Pattern 5: workspace_mcp_tokens Database Schema

```sql
-- workspace_mcp_tokens: MCP tokens scoped to a workspace
CREATE TABLE IF NOT EXISTS public.workspace_mcp_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.vaults(id) ON DELETE CASCADE,
  creator_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(name) >= 1 AND length(name) <= 100),

  -- SHA-256 hash of the token secret. Never store plaintext.
  token_hash TEXT NOT NULL UNIQUE,

  -- NULL = whole workspace scope; array = specific folder IDs
  -- Empty array = zero-scope (valid but returns no data)
  scoped_folder_ids UUID[] DEFAULT NULL,

  -- Revocation: immediate, no grace period
  is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id),

  -- Usage tracking: updated at most once per hour
  last_used_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workspace_mcp_tokens_workspace_id
  ON workspace_mcp_tokens(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_mcp_tokens_token_hash
  ON workspace_mcp_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_workspace_mcp_tokens_creator
  ON workspace_mcp_tokens(creator_user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_mcp_tokens_active
  ON workspace_mcp_tokens(workspace_id, is_revoked) WHERE is_revoked = FALSE;

-- RLS
ALTER TABLE workspace_mcp_tokens ENABLE ROW LEVEL SECURITY;

-- Workspace admins/owners can SELECT tokens for their workspace
CREATE POLICY "workspace_admins_select_mcp_tokens"
  ON workspace_mcp_tokens FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM vault_memberships vm
      WHERE vm.vault_id = workspace_mcp_tokens.workspace_id
        AND vm.user_id = auth.uid()
        AND vm.role IN ('vault_owner', 'vault_admin')
    )
  );

-- Workspace admins/owners can UPDATE (revoke) tokens for their workspace
CREATE POLICY "workspace_admins_update_mcp_tokens"
  ON workspace_mcp_tokens FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM vault_memberships vm
      WHERE vm.vault_id = workspace_mcp_tokens.workspace_id
        AND vm.user_id = auth.uid()
        AND vm.role IN ('vault_owner', 'vault_admin')
    )
  );

-- No direct INSERT from client — Edge Function uses service role
-- No DELETE — use is_revoked flag (soft delete for audit trail)
```

### Pattern 6: MCP Config JSON Block (Show-Once Display)

The config JSON block must be complete and ready to paste into `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "callvault": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://callvault-mcp.naegele412.workers.dev/mcp", "--header", "Authorization: Bearer cv_mcp_<TOKEN>"]
    }
  }
}
```

Note: The MCP Worker uses Streamable HTTP transport, so clients that support HTTP transport directly can use:
```json
{
  "mcpServers": {
    "callvault": {
      "transport": "streamable-http",
      "url": "https://callvault-mcp.naegele412.workers.dev/mcp",
      "headers": { "Authorization": "Bearer cv_mcp_<TOKEN>" }
    }
  }
}
```

Both formats should be shown with a copy button for each.

### Pattern 7: React Token Management UI Placement

The Settings page (`src/pages/Settings.tsx`) uses `SETTINGS_CATEGORIES` from `SettingsCategoryPane` — this is the global settings, not workspace-specific. The MCP tab is workspace-scoped.

**Integration point:** The workspace detail page is at `src/routes/_authenticated/workspaces/$workspaceId.tsx` (built in Phase 16). This page already has `WorkspaceMemberPanel` mounted with Radix Tabs. The MCP tab is a new tab added to this Radix Tabs instance.

```typescript
// In workspaces/$workspaceId.tsx (Phase 16 built this)
// Add MCP tab alongside existing Members tab:
<Tabs defaultValue="members">
  <TabsList>
    <TabsTrigger value="members">Members</TabsTrigger>
    <TabsTrigger value="mcp">MCP</TabsTrigger>  {/* NEW */}
  </TabsList>
  <TabsContent value="members">
    <WorkspaceMemberPanel workspaceId={workspaceId} ... />
  </TabsContent>
  <TabsContent value="mcp">
    <WorkspaceMcpPanel workspaceId={workspaceId} />  {/* NEW */}
  </TabsContent>
</Tabs>
```

**Note:** The route file `src/routes/_authenticated/workspaces/$workspaceId.tsx` was created in Phase 16 but the `src/routes/` directory structure does NOT appear in the current git-tracked code (Phase 16 code commits were not found in git history — only planning docs were committed). The planner must account for this: the workspace detail page may need to be found and its actual location verified.

### Anti-Patterns to Avoid

- **Storing token plaintext:** Store only SHA-256 hash. Token secret is returned once from the Edge Function and never stored.
- **Using JWT claims for scoping:** The P9 pitfall. JWT claims at token issuance time are stale if workspace membership changes. Always do a live `vault_memberships` JOIN at validation time.
- **Using user-scoped Supabase client for MCP token path:** Opaque tokens are not Supabase session tokens. Use service role client + explicit workspace scoping in context. Do NOT pass the opaque token to Supabase as Bearer.
- **Blocking on last_used_at update:** Use `waitUntil` (Cloudflare's non-blocking handler extension) for the last_used_at update so it doesn't add latency to the main response. Alternatively, update only if more than 1 hour old AND do it after responding using `ctx.waitUntil`.
- **Naming operations `list_organizations` in the handler map:** The CONTEXT.md says clean break — old names stop working. Do NOT preserve aliases in `handlers/index.ts`. Remove `list_banks` and `list_vaults` handler registrations entirely.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token entropy | Custom PRNG | `crypto.getRandomValues` (Web Crypto API) | Available in both Workers and Deno; cryptographically secure |
| Token hashing | MD5/bcrypt | `crypto.subtle.digest('SHA-256', ...)` | SHA-256 is correct for non-password opaque tokens; bcrypt is for passwords |
| Token uniqueness enforcement | Application-level check | `UNIQUE` constraint on `token_hash` | DB constraint is race-condition-safe; app-level check is not |
| Dialog state management | Custom modal | Radix UI Dialog (`@/components/ui/dialog`) | Already installed, accessible, follows project patterns |
| Table UI | Custom table | `@/components/ui/table` (shadcn/ui) | Already installed, consistent with design system |
| CORS in Edge Function | Custom headers | Standard `corsHeaders` from `supabase/CLAUDE.md` pattern | Consistent with all other Edge Functions in the project |

**Key insight:** The Worker already has `crypto.subtle` available via Web Crypto API. The Edge Function (Deno) also has `crypto.subtle`. No external hashing libraries are needed.

---

## Common Pitfalls

### Pitfall 1: P9 — Stale Token Scope (CRITICAL)
**What goes wrong:** Token is issued when user is a member of workspace A. User is later removed from workspace A. Token continues to work because validation only checks the stored `workspace_id` claim.
**Why it happens:** Checking JWT claims at issuance time is the "obvious" approach, but claims are baked in and don't reflect current membership.
**How to avoid:** `validateMcpToken` MUST do a live `vault_memberships` lookup for `workspace_id + user_id` on every request. This is two DB queries per request (token lookup + membership check) — acceptable cost for security.
**Warning signs:** Token works after user has been removed from workspace.

### Pitfall 2: Opaque Token as Supabase Bearer
**What goes wrong:** Developer passes `cv_mcp_...` token directly as `Authorization: Bearer` to Supabase. Supabase tries to parse it as JWT, fails, returns 401.
**Why it happens:** The existing OAuth path uses the Supabase JWT directly. The MCP token path is architecturally different.
**How to avoid:** Use service-role client for MCP token validation. Build a scoped Supabase client using service role key + explicit user context in queries. Do NOT use the opaque token as a Supabase auth token.
**Warning signs:** Supabase queries fail with "invalid JWT" errors in MCP token auth path.

### Pitfall 3: `SUPABASE_SERVICE_ROLE_KEY` Not in Worker env
**What goes wrong:** The Worker currently only has `SUPABASE_URL` and `SUPABASE_ANON_KEY` as Cloudflare secrets. The service role key is needed for MCP token validation.
**Why it happens:** Phase 12 deployed the Worker without service role key (not needed for OAuth path, which uses user JWTs via RLS).
**How to avoid:** Add `SUPABASE_SERVICE_ROLE_KEY` as a new Wrangler secret before deploying. Update `Env` interface in `types.ts`. Run `wrangler secret put SUPABASE_SERVICE_ROLE_KEY`.
**Warning signs:** `env.SUPABASE_SERVICE_ROLE_KEY` is undefined at runtime; service role queries fail silently.

### Pitfall 4: operations.json Naming — Handler Routing Breaks
**What goes wrong:** Renaming `list_banks` to `list_organizations` in `operations.json` without updating `handlers/index.ts` causes `executeOperation('navigation.list_organizations', ...)` to throw "Unknown operation".
**Why it happens:** `handlers/index.ts` has a `HANDLERS` Record keyed by `"navigation.list_banks"` etc. The catalog and the router must stay in sync.
**How to avoid:** When renaming an operation in `operations.json`, update the corresponding key in `HANDLERS` in `handlers/index.ts`. Do both changes atomically.
**Warning signs:** `callvault_execute` with `operation: "navigation.list_organizations"` returns an error.

### Pitfall 5: Audit Document is Planning Artifact, Not Source
**What goes wrong:** Writing the audit as a hypothetical list of tools without actually testing the deployed Worker, then treating it as a verified audit.
**Why it happens:** Easier to enumerate from code than to actually invoke the live Worker.
**How to avoid:** Use `curl` or MCP Inspector to verify every tool against the live Worker. Record actual response shapes, actual error messages. The audit must include `test_result: pass | fail | not_tested` per tool.
**Warning signs:** Audit document has no curl commands, no actual response excerpts, no pass/fail status.

### Pitfall 6: Token Limits Race Condition
**What goes wrong:** Two concurrent requests to create a token for the same workspace both pass the count check (count = 4, limit = 5), both insert — resulting in 6 tokens when limit is 5.
**Why it happens:** Count check and insert are two separate queries.
**How to avoid:** Use a database-level approach: either a `CHECK` constraint enforcing max tokens per workspace (complex), or an `INSERT ... WHERE NOT EXISTS (SELECT count > limit)` pattern, or a Postgres advisory lock. Simplest: rely on the Edge Function being invoked serially for a single user and accept that extreme concurrent creation is unlikely for initial implementation. Add a soft check + unique token_hash constraint as final safety net.
**Warning signs:** Token count exceeds tier limit.

### Pitfall 7: Routes Directory Location
**What goes wrong:** Phase 19 planner creates new files in `src/routes/_authenticated/` but this directory may not exist in the current working source tree (Phase 16 code was not committed to git — only planning docs were).
**Why it happens:** Phase 16 SUMMARY docs reference route files, but git log shows only planning docs in committed changes. The actual code changes live in the working directory, not git.
**How to avoid:** Before creating new workspace settings UI, verify the workspace detail page exists at the expected path. Read `src/App.tsx` to confirm routes. If the Phase 16 routes/components are not present, the planner must include a task to check/restore them.
**Warning signs:** `src/routes/_authenticated/workspaces/$workspaceId.tsx` doesn't exist when Plan execution begins.

---

## Code Examples

### Verified: Current operations.json Category/Operation Structure

```json
// Source: /Users/Naegele/Developer/mcp/callvault-mcp/src/operations.json (live codebase)
{
  "categories": {
    "navigation": {
      "description": "Navigate workspace organization: banks, vaults, folders, and tags",
      "operations": {
        "list_banks": { "description": "List all banks (workspaces) the user belongs to with their role", "parameters": {}, "required": [] },
        "list_vaults": { "description": "List vaults in a bank with member counts", "parameters": { "bank_id": {...} }, "required": ["bank_id"] },
        "list_folders": { ... },
        "list_tags": { ... }
      }
    }
    // + recordings (3 ops), transcripts (3 ops), search (1 op), contacts (3 ops), analysis (2 ops)
  }
}
```

**Total current operations:** 16 (4 navigation + 3 recordings + 3 transcripts + 1 search + 3 contacts + 2 analysis)

**Operations needing key rename:**
- `navigation.list_banks` → `navigation.list_organizations`
- `navigation.list_vaults` → `navigation.list_workspaces`

**Operations needing description text updates only:**
- `navigation.list_folders`: remove "bank_id" param description mentioning "Bank ID"
- `recordings.search`, `recordings.list`: "vaults" → "workspaces" in descriptions
- `analysis.compare`, `analysis.track_speaker`: description review
- Prompt templates in `prompts.ts` that reference "vault_id" param (keep param name, update description text)

### Verified: Current McpServer Tool Registration Pattern

```typescript
// Source: /Users/Naegele/Developer/mcp/callvault-mcp/src/worker.ts
// McpServer created fresh per request (stateless, no Durable Objects)
const server = new McpServer({ name: "callvault-mcp", version: "1.0.0" });
server.tool("callvault_discover", "...", { category: z.string().optional() }, handler);
server.tool("callvault_get_schema", "...", { operation: z.string() }, handler);
server.tool("callvault_execute", "...", { operation, params, offset, limit }, handler);
server.tool("callvault_continue", "...", { session_id: z.string() }, handler);
// Resources: operations-index + per-category (6) + per-operation (16) = 23 resources
// Prompts: call_analysis, meeting_prep, weekly_digest, action_items, sales_pipeline, person_summary = 6 prompts
```

**Corrected counts:** 4 tools, 23 resources, 6 prompts

### Verified: Existing RLS Pattern (is_vault_member helper)

```sql
-- Source: /Users/Naegele/dev/brain/supabase/migrations/20260131000006_create_vaults_tables.sql
-- Use is_vault_member() helper in new token table policies — same SECURITY DEFINER pattern
CREATE OR REPLACE FUNCTION is_vault_member(p_vault_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM vault_memberships WHERE vault_id = p_vault_id AND user_id = p_user_id
  )
$$;

-- GOOD: Use is_vault_member in RLS policy (prevents recursion, established pattern)
CREATE POLICY "workspace_admins_select_mcp_tokens" ON workspace_mcp_tokens FOR SELECT
  USING (is_vault_admin_or_owner(workspace_mcp_tokens.workspace_id, auth.uid()));
```

### Verified: Wrangler Deployment Pattern

```bash
# Source: Phase 12 Plan 05 SUMMARY.md — established pattern
# CRITICAL: Unset CLOUDFLARE_API_TOKEN if set (lacks write permissions)
# Use ~/.wrangler/config OAuth token instead

unset CLOUDFLARE_API_TOKEN
cd /Users/Naegele/Developer/mcp/callvault-mcp
wrangler deploy  # Uses OAuth token from ~/.wrangler/config/default.toml

# Add new secret before deploy:
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

### Verified: Edge Function Template (from CLAUDE.md)

```typescript
// Source: /Users/Naegele/dev/brain/supabase/CLAUDE.md — mandatory pattern
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
};
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  // ... auth, validation, logic
});
```

### Recommended: Token Format Decision

**Use prefixed opaque token: `cv_mcp_` + 64 hex chars**

Rationale:
- Prefix (`cv_mcp_`) makes tokens identifiable in logs and config files — user knows what they're looking at
- 32 bytes of entropy (64 hex chars) = 2^256 search space — computationally infeasible to brute force
- Total length: 71 chars — fits comfortably in config files
- SHA-256 hash stored in DB — no plaintext exposure even if DB is compromised
- Web Crypto API available in both Workers (validation) and Deno (generation)

Alternatives considered:
- UUID v4: 122 bits of entropy, no prefix (harder to identify), shorter (36 chars). Rejected: no prefix, lower entropy
- Raw hex (no prefix): Same entropy as above but harder to identify in configs. Rejected: UX worse
- JWT: Requires signing infrastructure, contains claims. Rejected: overengineered for an opaque lookup token

### Recommended: RLS Approach for workspace_mcp_tokens Table

Use **join queries** (not JWT claims) for all RLS policies, following the established project pattern:

```sql
-- GOOD: Live join against vault_memberships at query time (P9-safe)
CREATE POLICY "workspace_admins_select_mcp_tokens"
  ON workspace_mcp_tokens FOR SELECT
  USING (is_vault_admin_or_owner(workspace_mcp_tokens.workspace_id, auth.uid()));

-- AVOID: JWT claims approach (P9 pitfall — stale at query time)
-- USING ((auth.jwt()->>'workspace_id') = workspace_mcp_tokens.workspace_id::text); -- DON'T DO THIS
```

The `is_vault_admin_or_owner` SECURITY DEFINER function is already defined in the codebase and provides recursion-safe membership checking.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| stdio MCP transport | Streamable HTTP via `WebStandardStreamableHTTPServerTransport` | Worker is HTTP-native, deployed to Cloudflare |
| Filesystem session storage | Per-request stateless context threading | No session state, fully scalable |
| Module-level Supabase singleton | Per-request `createSupabaseClient(url, key, token)` factory | Correct for Workers V8 isolates |
| `sessions_cache` Map for pagination | `chunkResponse` with in-memory map (current) | Still in-memory — but cursor-based, not session-based |
| `McpAgent` with Durable Objects | `McpServer` factory per request | No DO billing, simpler ops |
| Bank/Vault/Hub naming | Organization/Workspace/Folder (Phase 16 complete in frontend) | MCP Worker is the last holdout |

**Deprecated in Phase 19:**
- `navigation.list_banks` operation key → replaced by `navigation.list_organizations`
- `navigation.list_vaults` operation key → replaced by `navigation.list_workspaces`
- `bank_id` parameter names in navigation operations → replaced by `organization_id`

---

## Open Questions

1. **Route file locations from Phase 16**
   - What we know: Phase 16 built workspace detail page at `src/routes/_authenticated/workspaces/$workspaceId.tsx`. Only planning docs appear in git commits.
   - What's unclear: Whether these files exist in the working directory but were never committed, or whether Phase 16 work was partially applied.
   - Recommendation: First task in the plan should verify this. Read `src/App.tsx` and check for `src/routes/` directory before building MCP UI. If missing, find where workspace detail is actually implemented.

2. **`callvault_continue` with in-memory `sessionsCache`**
   - What we know: `utils.ts` has a `sessionsCache` Map that lives per-isolate. In Workers, this means pagination sessions are lost between requests (different isolates).
   - What's unclear: Whether this is actually broken in production (small response sets may not trigger pagination) or silently degraded.
   - Recommendation: Document in audit as a known gap. The audit task should test `callvault_continue` with a large data set to confirm behavior. Not a blocker for Phase 19 — fix deferred to Phase 20.

3. **`SUPABASE_SERVICE_ROLE_KEY` exposure risk in Worker**
   - What we know: Service role key bypasses all RLS. Adding it to the Worker creates a higher-value secret than the anon key.
   - What's unclear: Whether there's an alternative approach (e.g., a Supabase Edge Function that validates tokens and returns a user-scoped JWT, avoiding service role in Worker entirely).
   - Recommendation: Service role in Worker is acceptable given Cloudflare Secrets management. Alternative (Edge Function proxy for token validation) adds a round-trip per MCP request. Accept service role in Worker for Phase 19; document as a security consideration.

4. **`scoped_folder_ids` as `UUID[]` in Postgres**
   - What we know: Postgres supports `UUID[]` arrays. Supabase client supports `.contains()` and `.overlaps()` for array columns.
   - What's unclear: Performance implications of `scoped_folder_ids` filtering in handlers (need to filter `vault_entries.folder_id IN (scoped_folder_ids)` at query time).
   - Recommendation: Use `UUID[]` column. In handlers, when `context.tokenScopedFolderIds` is non-null, add `.in('folder_id', tokenScopedFolderIds)` to vault_entries queries. Empty array = no data (don't add a where clause that matches nothing — return empty results explicitly).

---

## Sources

### Primary (HIGH confidence)
- `/Users/Naegele/Developer/mcp/callvault-mcp/src/worker.ts` — live Worker source (4 tools, 23 resources, 6 prompts)
- `/Users/Naegele/Developer/mcp/callvault-mcp/src/operations.json` — operation catalog (16 operations, all naming)
- `/Users/Naegele/Developer/mcp/callvault-mcp/src/handlers/navigation.ts` — handler implementation (queries `bank_memberships`, `vault_memberships`)
- `/Users/Naegele/dev/brain/supabase/migrations/20260131000007_create_recordings_tables.sql` — vault_entries schema and RLS
- `/Users/Naegele/dev/brain/supabase/migrations/20260131000006_create_vaults_tables.sql` — `is_vault_member` helper pattern
- `/Users/Naegele/dev/brain/.planning/phases/12-deploy-callvault-mcp-as-remote-cloudflare-worker-with-supabase-oauth-2-1/12-05-SUMMARY.md` — deployment pattern (unset CLOUDFLARE_API_TOKEN)
- `/Users/Naegele/dev/brain/supabase/CLAUDE.md` — Edge Function conventions
- `/Users/Naegele/dev/brain/src/CLAUDE.md` — React component conventions
- [Supabase Token Security + RLS docs](https://supabase.com/docs/guides/auth/oauth-server/token-security)
- [Supabase Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook)

### Secondary (MEDIUM confidence)
- [MCP Server API Key Management Best Practices - Stainless](https://www.stainless.com/mcp/mcp-server-api-key-management-best-practices) — prefixed token format `cv_mcp_` pattern confirmed industry standard
- [Supabase JWT Claims Reference](https://supabase.com/docs/guides/auth/jwt-fields) — `auth.jwt()` usage in RLS policies

### Tertiary (LOW confidence)
- None — all critical decisions verified with official docs or live codebase.

---

## Metadata

**Confidence breakdown:**
- MCP Worker audit scope: HIGH — read actual source files
- Naming changes: HIGH — enumerated from actual operations.json and handler files
- DB schema for workspace_mcp_tokens: HIGH — follows verified project migration patterns
- Token format recommendation: HIGH — Web Crypto API confirmed in Workers and Deno
- RLS approach: HIGH — is_vault_member pattern verified in existing migrations
- React UI integration point: MEDIUM — Phase 16 routes directory location unverified (routing structure unclear)
- Worker service-role auth path: MEDIUM — pattern is sound, but service role in Worker is new territory for this project

**Research date:** 2026-02-28
**Valid until:** 2026-03-28 (stable domain — MCP SDK, Supabase, Cloudflare Workers all stable)
