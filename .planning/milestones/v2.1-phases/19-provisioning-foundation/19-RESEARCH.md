# Phase 19: Provisioning Foundation - Research

**Researched:** 2026-04-10
**Domain:** MCP token auto-provisioning, server-side plan gating, token regeneration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Auto-provisioning trigger:**
- D-01: On org creation with PRO+ plan, auto-create an org-scoped `mcp_tokens` row via a Postgres database trigger (or Supabase function hook). No manual user action required.
- D-02: On plan upgrade (free → PRO+), check for existing token and auto-create one if none exists. This handles orgs that were created on free tier then upgraded.
- D-03: Auto-provisioned tokens use scope `'organization'` with name `'Auto-provisioned MCP Token'`. User can rename or delete later.

**Server-side plan gating:**
- D-04: The `mcp-server` edge function must check the org's plan tier on every tool invocation, not just at token creation time.
- D-05: Plan check queries the org's active subscription status via Polar billing data in `user_profiles` table. The check runs after token validation but before tool execution.
- D-06: Free-tier org tokens receive a JSON-RPC error: `{ code: -32001, message: "MCP access requires a Pro or Team plan. Upgrade at https://app.callvaultai.com/settings" }`.
- D-07: Downgraded orgs are rejected server-side within one request. Tokens remain in DB but become inert.

**Token regeneration:**
- D-08: `regenerate_token` atomically UPDATEs the token hex in-place: `UPDATE mcp_tokens SET token = encode(gen_random_bytes(32), 'hex') WHERE id = $1`. Preserves name, scope, org_id, workspace_id.
- D-09: Frontend MCPTab gets a "Regenerate" button per token row with confirmation dialog. On confirm, calls regenerate service, then shows new token in `TokenRevealDialog` (same as creation flow).

**Downgrade behavior:**
- D-10: On plan downgrade, tokens are NOT deleted. Server-side plan gating rejects all tool invocations at runtime.

### Claude's Discretion
- Exact timing of auto-provision trigger (synchronous in transaction vs async after commit)
- Whether to add a `plan_tier` cache column on `mcp_tokens` for faster gating, or always join to billing tables
- Error message wording refinements
- Loading states and animation details for regenerate button

### Deferred Ideas (OUT OF SCOPE)
None — analysis stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROV-01 | MCP server auto-provisions when a new org is created (PRO+ plan required) | Postgres trigger on `organizations` INSERT; plan check via `user_profiles.subscription_status` and `product_id`; org owner determined from `organization_memberships` |
| PROV-02 | Plan tier checked server-side on every MCP tool invocation (not just at token creation) | Insert plan check after token lookup in `mcp-server/index.ts`; query `user_profiles` via service role; `isPaidTier()` helper function |
| PROV-03 | User can regenerate MCP token (revoke old + issue new) from settings | New `regenerateMcpToken(id)` service function + `useRegenerateMcpToken` hook + Regenerate button in `TokenRow` + reuse `TokenRevealDialog` |
</phase_requirements>

---

## Summary

Phase 19 builds on top of the completed Phase 18 MCP infrastructure. The work is surgical: three isolated changes to existing files rather than new subsystems. The `mcp_tokens` table, `mcp-server` edge function, `mcp-tokens.service.ts`, `useMcpTokens.ts`, and `MCPTab.tsx` are all already in production — this phase extends each one.

**Auto-provisioning (PROV-01)** requires a new Postgres trigger on the `organizations` table (or piggybacking on `handle_new_user`) plus a plan-upgrade hook. The trigger must determine the org owner from `organization_memberships` and only fire when `user_profiles.subscription_status` indicates PRO+ (`trialing` or `active` with `product_id` starting with `pro` or `team`). A one-token-per-org guard is already enforced in `createMcpToken` — the trigger must replicate this guard to avoid double-provision.

**Plan gating (PROV-02)** is a pure edge function change: one async query to `user_profiles` inserted between the existing token lookup and tool dispatch. The service role client is already present. The billing data lives in `user_profiles` columns `subscription_status`, `product_id`, and `current_period_end` — the same columns used by the client-side `useSubscription` hook. The same `deriveTier` logic used client-side must be replicated server-side (Deno TypeScript in the edge function).

**Token regeneration (PROV-03)** is the most user-visible change: a new service function, new hook mutation, and UI addition to `TokenRow` plus a confirmation `AlertDialog`. The regeneration itself is a single `UPDATE` using Postgres's already-available `encode(gen_random_bytes(32), 'hex')` — no new cryptography needed.

**Primary recommendation:** Implement in wave order: (1) DB trigger migration for auto-provisioning, (2) edge function plan gating, (3) frontend regenerate flow. Each wave is independently deployable.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase JS | 2.x | Supabase client in edge function | Already used in `mcp-server/index.ts` |
| `@supabase/supabase-js` via esm.sh | 2 | Edge function import | Established pattern across all edge functions |
| TanStack Query | latest | New hook mutation for regenerate | Already used in `useMcpTokens.ts` |
| Sonner | latest | Toast notifications | Already used in `useMcpTokens.ts` |
| Radix AlertDialog | latest | Regenerate confirmation dialog | Already used in `MCPTab.tsx` |
| Remix Icons | latest | `RiRefreshLine` for regenerate button | Required icon library |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Postgres `gen_random_bytes` | built-in | Token regeneration | Already used as default in `mcp_tokens` table |
| Postgres trigger functions | built-in | Auto-provisioning | Mirrors existing `handle_new_user` and `tr_ensure_home_workspace` patterns |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Postgres trigger for auto-provision | Supabase Database Webhook to edge function | Webhook adds network hop + async complexity; trigger is synchronous in same transaction, simpler, no new infrastructure |
| Always join `user_profiles` for plan check | Cache `plan_tier` column on `mcp_tokens` | Caching adds staleness risk on downgrade — the whole point of D-04 is real-time checks; JOIN is fine at edge function latency |

**Installation:** No new packages required — all dependencies already present.

---

## Architecture Patterns

### Existing Trigger Pattern (authoritative example)

The codebase already has two established trigger patterns to follow:

**Pattern 1:** `handle_new_user` — fires `AFTER INSERT ON auth.users`, creates org + workspace + membership in the same PL/pgSQL function. Used as the template for org-level auto-provisioning.

**Pattern 2:** `tr_ensure_home_workspace` + `ensure_home_workspace()` — fires `AFTER INSERT ON organizations`, creates a home workspace. This is the closest analog to what PROV-01 needs: a trigger on `organizations` INSERT that creates a child record.

**Auto-provisioning trigger approach:** Add a new `AFTER INSERT ON organizations` trigger (similar to `tr_ensure_home_workspace`) that:
1. Looks up the org owner from `organization_memberships WHERE role = 'organization_owner'`
2. Looks up the owner's billing tier from `user_profiles`
3. Inserts an `mcp_tokens` row only if the org is PRO+ and no token exists yet

**Plan upgrade auto-provision:** Because D-02 (free → PRO+ upgrade path) requires detecting a billing change event, the approach is different from the INSERT trigger. The Polar webhook handler (wherever it lives) is the natural place — but if no webhook handler exists in the codebase that can easily be extended, a simpler alternative is a new edge function `provision-mcp-token` called by the frontend immediately after a confirmed upgrade. This needs investigation at implementation time.

### Recommended Project Structure Changes

```
supabase/
  migrations/
    YYYYMMDDHHMMSS_mcp_auto_provision.sql   # New trigger + helper function
  functions/
    mcp-server/
      index.ts                              # Edit: add plan gating after token lookup

src/
  services/
    mcp-tokens.service.ts                   # Edit: add regenerateMcpToken()
  hooks/
    useMcpTokens.ts                         # Edit: add useRegenerateMcpToken hook
  components/
    settings/
      MCPTab.tsx                            # Edit: add Regenerate button + confirmation dialog
```

### Pattern 1: Plan Gating in Edge Function

**What:** After existing token lookup, before tool dispatch, query `user_profiles` for the org owner and check billing tier.

**When to use:** Every non-`initialize`, non-`tools/list` call.

**Example (Deno TypeScript):**

```typescript
// [VERIFIED: codebase] — mirrors deriveTier() from useSubscription.ts
function isPaidTier(
  productId: string | null,
  status: string | null,
  periodEnd: string | null,
): boolean {
  if (!productId || !status) return false;
  const lower = productId.toLowerCase();

  // Pro trial: only active if not expired
  if (lower === 'pro-trial') {
    if (status !== 'trialing') return false;
    if (periodEnd && new Date(periodEnd) < new Date()) return false;
    return true;
  }

  return (lower.startsWith('pro') || lower.startsWith('team'))
    && (status === 'active' || status === 'trialing');
}

// After token validation, before tool dispatch:
const { data: ownerProfile } = await supabase
  .from('user_profiles')
  .select('subscription_status, product_id, current_period_end')
  .eq('user_id', mcpToken.user_id)
  .maybeSingle();

if (!isPaidTier(ownerProfile?.product_id, ownerProfile?.subscription_status, ownerProfile?.current_period_end)) {
  return mcpError(id, -32001,
    'MCP access requires a Pro or Team plan. Upgrade at https://app.callvaultai.com/settings',
    corsHeaders,
  );
}
```

**Note:** `initialize` and `tools/list` should be gated OR exempted — the MCP protocol requires `initialize` to succeed for handshake. `tools/list` can be exempted to allow clients to discover tools before showing an upgrade prompt. Plan gating only needs to apply to actual tool invocations (`callvault/*` methods).

### Pattern 2: Token Regeneration Service

**What:** Atomic UPDATE of the token hex value; returns updated row with new token value.

**Example:**

```typescript
// [VERIFIED: codebase] — matches existing CRUD pattern in mcp-tokens.service.ts
export async function regenerateMcpToken(id: string): Promise<McpToken> {
  const { data, error } = await supabase
    .from('mcp_tokens')
    .update({ token: undefined }) // token is generated by Postgres expression
    .eq('id', id)
    .select('id, user_id, org_id, workspace_id, name, token, scope, last_used_at, created_at')
    .single()
  // ...
}
```

**Critical note:** Supabase JS client `.update()` cannot call a Postgres function as the new value — it can only set scalar values. The `encode(gen_random_bytes(32), 'hex')` regeneration MUST be done via a Postgres function (RPC) or a `SECURITY DEFINER` SQL function. The correct approach is an RPC:

```sql
-- In migration:
CREATE OR REPLACE FUNCTION regenerate_mcp_token(token_id UUID)
RETURNS mcp_tokens
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE mcp_tokens
  SET token = encode(gen_random_bytes(32), 'hex')
  WHERE id = token_id
    AND user_id = auth.uid()
  RETURNING *;
$$;
```

Then the service calls `supabase.rpc('regenerate_mcp_token', { token_id: id })`.

This is the only way to invoke `gen_random_bytes` server-side while maintaining RLS (the `user_id = auth.uid()` check in the WHERE clause ensures users can only regenerate their own tokens).

### Pattern 3: Auto-Provision DB Trigger

**What:** Postgres trigger function fires `AFTER INSERT ON organizations`, looks up org owner + plan, creates `mcp_tokens` row if PRO+.

**Gotcha — RLS:** `mcp_tokens` has RLS with `user_id = auth.uid()`. Trigger functions run as the invoking user unless `SECURITY DEFINER` is set. Since org creation runs as the user, `auth.uid()` will be set correctly during signup — but not during admin-created orgs. Use `SECURITY DEFINER` and pass the owner's `user_id` explicitly to avoid RLS issues.

**Gotcha — one token per org:** The trigger must include a guard:
```sql
IF NOT EXISTS (SELECT 1 FROM mcp_tokens WHERE org_id = NEW.id) THEN
  INSERT INTO mcp_tokens ...
END IF;
```

**Gotcha — `handle_new_user` race:** The existing `handle_new_user` trigger creates the org and immediately creates memberships within the same function. A separate `AFTER INSERT ON organizations` trigger fires AFTER `handle_new_user` completes, so `organization_memberships` will already be populated — the auto-provision trigger can safely query it.

### Anti-Patterns to Avoid

- **Checking plan in the trigger synchronously by querying `user_profiles`:** This creates a dependency from the `organizations` trigger to `user_profiles`. If billing hasn't been set yet (new user, trial starts simultaneously), the trigger may not find a record. Safer: the trigger inserts the token unconditionally for any PRO+ org and defers to plan gating for enforcement; OR it checks `user_profiles` but treats NULL as free (skip provision, rely on D-02 upgrade path).
- **Storing plan tier in `mcp_tokens`:** Creates cache drift — a downgraded token would still show the old tier. The edge function must always re-check `user_profiles` live (D-04/D-05).
- **Using Supabase JS `.update({ token: ... })` with a raw SQL expression:** Supabase JS does not interpolate SQL expressions in update values. Always use RPC for server-side crypto operations.
- **Gating `initialize` method:** MCP handshake must succeed. Only gate `callvault/*` tool calls.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Crypto-secure token generation | Custom token logic | `encode(gen_random_bytes(32), 'hex')` via Postgres | Already used in `mcp_tokens` default; Postgres pg_crypto is audited |
| Plan tier derivation | Re-implement tier logic | Port `deriveTier()` from `useSubscription.ts` into edge function | Single source of truth; prevents drift |
| Atomic token swap | DELETE + INSERT flow | Single `UPDATE ... RETURNING` via RPC | Prevents window where old token is deleted but new one not yet issued |
| Confirmation dialog from scratch | Custom modal | Reuse existing Radix `AlertDialog` pattern from `MCPTab.tsx` delete flow | Pattern already tested and styled |

**Key insight:** Every primitive this phase needs already exists in the codebase. The work is wiring them together, not building new infrastructure.

---

## Common Pitfalls

### Pitfall 1: `handle_new_user` trial logic vs. auto-provision timing

**What goes wrong:** New users sign up with a 14-day pro-trial (`subscription_status = 'trialing'`, `product_id = 'pro-trial'`). The `handle_new_user` trigger creates the org, then a separate `AFTER INSERT ON organizations` trigger runs. At this point, `user_profiles` has already been inserted (it's the FIRST thing `handle_new_user` does), so the plan check CAN find the trial status. But if the order of operations in `handle_new_user` is ever changed, the plan check could find no profile and skip provisioning.
**Why it happens:** Trigger execution order within a transaction depends on creation order, not column order.
**How to avoid:** In the auto-provision trigger, treat a missing `user_profiles` row the same as free tier — skip provisioning. The D-02 upgrade path handles the edge case if provisioning was skipped.
**Warning signs:** New users see the MCP tab but get "No MCP tokens yet" even on trial accounts.

### Pitfall 2: RLS blocks the trigger's INSERT into `mcp_tokens`

**What goes wrong:** A trigger function tries to INSERT into `mcp_tokens` but `mcp_tokens` has `user_id = auth.uid()` RLS. If `SECURITY DEFINER` is not set and `auth.uid()` doesn't match the owner being provisioned, the INSERT silently fails (no error, zero rows inserted).
**Why it happens:** Postgres RLS applies to all queries, including those inside trigger functions, unless the function is `SECURITY DEFINER`.
**How to avoid:** Mark the auto-provision trigger function `SECURITY DEFINER`. Include `SET search_path = public` to prevent search_path injection.
**Warning signs:** Trigger completes without error but no `mcp_tokens` row appears.

### Pitfall 3: `regenerate_mcp_token` RPC returns empty if RLS rejects

**What goes wrong:** The RPC function has `WHERE user_id = auth.uid()` but the caller's `auth.uid()` is different from the token owner (e.g., org admin regenerating on behalf of owner). The UPDATE matches zero rows and `RETURNING *` returns nothing. The service function calls `.single()` which throws an error.
**Why it happens:** `SECURITY DEFINER` functions bypass RLS at the SQL level, but the explicit `WHERE user_id = auth.uid()` check in the query replaces it.
**How to avoid:** Use `.maybeSingle()` in the service, throw a user-friendly error on null result. In the initial implementation, only the token owner can regenerate (matching existing delete pattern).
**Warning signs:** Regenerate returns "0 rows" error instead of the new token.

### Pitfall 4: Plan gating on `initialize` breaks MCP handshake

**What goes wrong:** If plan gating is placed before method routing (before the `switch (method)` block), the MCP `initialize` handshake returns a plan error. MCP clients fail to connect at all, even to show a "you need to upgrade" message.
**Why it happens:** MCP protocol requires `initialize` to return server capabilities before any tools can be called.
**How to avoid:** Place the plan gating check inside the `switch`, skipping it for `initialize` and `tools/list`. Gate only `callvault/*` methods.
**Warning signs:** MCP client reports "connection failed" rather than showing a plan-upgrade error after attempting a tool call.

### Pitfall 5: D-02 upgrade auto-provision has no trigger

**What goes wrong:** An org created on free tier (correctly skipped by D-01 trigger) upgrades to PRO+. The decision says "auto-create one if none exists" but there is no Postgres trigger on `user_profiles` UPDATE to detect this.
**Why it happens:** There is no billing upgrade event visible to a Postgres trigger without a webhook or manual call.
**How to avoid:** Implement D-02 as a frontend-triggered call: after a confirmed upgrade (Polar webhook or client-side subscription refresh), call a `provision-mcp-token` edge function or have `useSubscription` re-check and call a provisioning RPC. The simplest approach: create a `maybe_provision_mcp_token(org_id)` SQL RPC with idempotency guard (does nothing if token already exists), called from the frontend after subscription state changes to PRO+. Document this clearly in the plan.
**Warning signs:** Upgraded users don't see an MCP token unless they manually create one.

---

## Code Examples

Verified patterns from existing codebase:

### Existing trigger pattern to mirror (auto-provision)
```sql
-- [VERIFIED: codebase] supabase/migrations/20260306000000_personal_organization_and_home.sql
CREATE OR REPLACE FUNCTION ensure_home_workspace()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO workspaces (organization_id, name, workspace_type, is_home)
  VALUES (NEW.id, 'Home Workspace', 'team', true)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_ensure_home_workspace
AFTER INSERT ON organizations
FOR EACH ROW
EXECUTE FUNCTION ensure_home_workspace();
```

### Billing fields available server-side
```sql
-- [VERIFIED: codebase] supabase/migrations/20260131161417_add_polar_billing_fields.sql
-- Columns on user_profiles:
-- subscription_status TEXT  — 'active' | 'trialing' | 'canceled' | etc.
-- product_id TEXT           — 'pro-monthly' | 'pro-annual' | 'pro-trial' | 'team-monthly' etc.
-- current_period_end TIMESTAMPTZ
```

### Tier derivation to port to edge function
```typescript
// [VERIFIED: codebase] src/hooks/useSubscription.ts — deriveTier()
function deriveTier(productId, status, periodEnd) {
  if (!productId) return 'free';
  const lower = productId.toLowerCase();
  if (lower === 'pro-trial') {
    if (status !== 'trialing') return 'free';
    if (periodEnd && periodEnd < new Date()) return 'free';
    return 'pro';
  }
  if (lower.startsWith('pro')) return 'pro';
  if (lower.startsWith('team')) return 'team';
  return 'free';
}
// isPaid = tier !== 'free' && (status === 'active' || status === 'trialing')
```

### Existing hook mutation pattern to follow (regenerate hook)
```typescript
// [VERIFIED: codebase] src/hooks/useMcpTokens.ts — useDeleteMcpToken
export function useDeleteMcpToken() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteMcpToken(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MCP_TOKEN_KEYS.all })
      toast.success('MCP token deleted')
    },
    onError: (err: Error) => {
      toast.error(`Failed to delete token: ${err.message}`)
    },
  })
}
// useRegenerateMcpToken follows identical shape, onSuccess opens TokenRevealDialog
```

### TokenRevealDialog reuse pattern
```typescript
// [VERIFIED: codebase] src/components/settings/MCPTab.tsx
// TokenRevealDialog is already used for post-creation token display.
// Regenerate flow reuses it: setNewlyCreatedToken(regeneratedToken) after confirm.
// The dialog accepts McpToken | null and shows the full token value once.
```

---

## Runtime State Inventory

> This phase adds new DB rows but does NOT rename or migrate existing data.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Existing `mcp_tokens` rows (manually created by users) | None — regenerate is user-initiated, auto-provision only affects new tokens |
| Live service config | `mcp-server` edge function deployed to Supabase | Redeploy with `--use-api` after plan gating changes |
| OS-registered state | None | None |
| Secrets/env vars | `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` — already set in edge function env | None — no new env vars needed |
| Build artifacts | None | None |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI | Migration deploy | Verify at execution time | — | — |
| `--use-api` flag | Edge function deploy (Docker not available) | Documented in supabase/CLAUDE.md | — | None — required |
| `gen_random_bytes` (pgcrypto) | Token regeneration | Already used in `mcp_tokens` table default | Built-in | None needed |
| `auth.uid()` in SECURITY DEFINER fn | RPC plan check | Standard Supabase pattern | Built-in | None needed |

**Missing dependencies with no fallback:** None identified.

---

## Validation Architecture

> nyquist_validation key absent from config.json — treated as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected in codebase (no pytest.ini, jest.config, vitest.config) |
| Config file | None — see Wave 0 |
| Quick run command | Manual verification via dev-browser + Supabase logs |
| Full suite command | Manual verification of all 4 success criteria |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROV-01 | New PRO+ org has MCP token row | smoke | Manual — create test org, verify `mcp_tokens` row in Supabase dashboard | N/A |
| PROV-01 | Free-tier org creation does NOT create token | smoke | Manual — create free org, verify no row | N/A |
| PROV-02 | Free-tier token call returns -32001 error | smoke | `curl` POST to MCP endpoint with free-org token | N/A |
| PROV-02 | PRO+ token call succeeds (not gated out) | smoke | `curl` POST to MCP endpoint with PRO token | N/A |
| PROV-03 | Regenerate button shows in TokenRow | visual | dev-browser screenshot of MCPTab | N/A |
| PROV-03 | Old token rejected after regenerate | smoke | Call MCP with old token → expect -32001 | N/A |
| PROV-03 | New token works after regenerate | smoke | Call MCP with new token → expect success | N/A |

### Wave 0 Gaps
- No automated test framework detected. All verification is manual smoke tests using dev-browser and Supabase SQL editor.
- Consider adding `supabase/tests/` for edge function integration tests in a future phase.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Bearer token lookup in `mcp_tokens`, no change from Phase 18 |
| V3 Session Management | no | MCP tokens are API keys, not sessions |
| V4 Access Control | yes | Plan gating enforced server-side; token regeneration requires `user_id = auth.uid()` match |
| V5 Input Validation | no | No new user inputs; token is Postgres-generated |
| V6 Cryptography | yes | `gen_random_bytes(32)` — never hand-roll; Postgres pgcrypto already in use |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Token theft (old token reuse after regenerate) | Spoofing | Atomic UPDATE ensures old token is replaced in one SQL statement; no window between revoke and issue |
| Plan bypass (crafting token for free org) | Elevation of Privilege | Server-side plan check on EVERY call; client-side gate is UI only |
| IDOR on regenerate (regenerating another user's token) | Tampering | `WHERE user_id = auth.uid()` in RPC function; returns 0 rows if mismatch |
| Search path injection in SECURITY DEFINER functions | Tampering | `SET search_path = public` on all new trigger/RPC functions |
| Race condition: delete token + provision duplicate | Tampering | `ON CONFLICT DO NOTHING` or `IF NOT EXISTS` guard in trigger |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | D-02 (upgrade path) can be triggered from frontend after subscription state change — no Polar webhook handler exists that can be easily extended | Architecture Patterns / Pitfall 5 | Low: if a webhook handler exists, it's a better trigger point. Investigate `supabase/functions/` for a polar-webhook function at plan time. |
| A2 | `initialize` and `tools/list` MCP methods should be exempt from plan gating | Architecture Patterns / Pitfall 4 | Medium: if the MCP spec allows returning errors on `initialize`, exemption is unnecessary. The safer choice (exempt `initialize`) matches common API gateway patterns. |
| A3 | `handle_new_user` inserts into `user_profiles` BEFORE the org is created, so the auto-provision trigger can read billing data | Architecture Patterns / Pitfall 1 | Low: verified by reading `handle_new_user` — profile insert IS first. But order could change in future migrations. |

**If this table is empty:** N/A — see above.

---

## Open Questions

1. **Does a Polar webhook handler exist in `supabase/functions/`?**
   - What we know: Billing upgrade auto-provision (D-02) needs a trigger point
   - What's unclear: Whether a Polar webhook function already exists that can call a provisioning RPC
   - Recommendation: Check `supabase/functions/` at plan time. If a `polar-webhook` or `billing-webhook` function exists, add provisioning call there. If not, implement as a frontend-triggered `maybe_provision_mcp_token` RPC.

2. **Should `tools/list` and `initialize` be exempt from plan gating?**
   - What we know: D-06 says free-tier calls return -32001; D-07 says downgraded orgs rejected
   - What's unclear: Whether exempting `initialize` is required by MCP protocol or discretionary
   - Recommendation: Exempt `initialize` (MCP handshake) and `tools/list` (discovery). Gate all `callvault/*` methods.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| UI-only plan gate (check on token create) | Server-side gate on every tool call | Phase 19 | Downgraded orgs blocked within one request; no client-side trust |
| Manual token creation for all orgs | Auto-provisioning for PRO+ orgs | Phase 19 | Zero-action onboarding for PRO users |
| No token rotation | Atomic regenerate via RPC | Phase 19 | Token compromise recovery without losing token metadata |

---

## Sources

### Primary (HIGH confidence)
- `supabase/functions/mcp-server/index.ts` — full read; auth flow, tool dispatch, error format
- `supabase/migrations/20260310160000_mcp_tokens.sql` — full read; table schema, RLS, indexes
- `src/services/mcp-tokens.service.ts` — full read; CRUD patterns, one-token-per-org guard
- `src/hooks/useMcpTokens.ts` — full read; mutation patterns, query key structure
- `src/components/settings/MCPTab.tsx` — full read; TokenRow, TokenRevealDialog, AlertDialog delete flow
- `src/hooks/useSubscription.ts` — full read; deriveTier(), billing column names, isPaid logic
- `supabase/migrations/20260131161417_add_polar_billing_fields.sql` — billing columns on user_profiles
- `supabase/migrations/20260403190000_fix_signup_trigger.sql` — handle_new_user execution order
- `supabase/migrations/20260306000000_personal_organization_and_home.sql` — tr_ensure_home_workspace trigger pattern

### Secondary (MEDIUM confidence)
- `supabase/CLAUDE.md` — edge function conventions, SECURITY DEFINER pattern, `--use-api` deploy
- `src/CLAUDE.md` — frontend stack, Radix imports, icon library constraint

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use, no new dependencies
- Architecture: HIGH — all patterns verified directly from codebase files
- Pitfalls: HIGH — derived from actual code inspection (RLS policy, trigger order, Supabase JS limitations)
- D-02 upgrade path: MEDIUM — no webhook handler confirmed; approach is [ASSUMED] until `supabase/functions/` is checked

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable codebase, 30-day window)
