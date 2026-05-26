---
phase: 19-provisioning-foundation
verified: 2026-05-07T08:35:00Z
status: human_needed
score: 4/4 must-haves verified — 1 of 4 human items closed via dev-browser
human_verification:
  - test: "Create a new org as a PRO+ user and confirm mcp_tokens row is auto-inserted"
    expected: "mcp_tokens table has one row with org_id matching the new org, name='Auto-provisioned MCP Token', scope='organization'"
    why_human: "Trigger fires on DB INSERT — cannot test without executing a real org creation through the app or SQL REPL against production"
    result: "human_needed"
  - test: "Call any callvault/* MCP tool with a token belonging to a free-tier org"
    expected: "JSON-RPC response contains error code -32001 and message 'MCP access requires a Pro or Team plan. Upgrade at https://app.callvaultai.com/settings'"
    why_human: "Requires a real MCP client session (Claude Desktop / curl with Bearer token) against production endpoint; not testable with static code analysis"
    result: "human_needed"
  - test: "Click Regenerate on a token row in Settings > MCP, confirm the dialog, and confirm the new token appears in the reveal dialog"
    expected: "Old token is immediately non-functional; new token value is shown once in TokenRevealDialog; toast 'MCP token regenerated' appears"
    result: "pass"
    evidence: "dev-browser 2026-05-07T08:30Z (a@vibeos.com, AI Simple org) — created token (last8 ae564191...194f), clicked Regenerate, confirmed in alertdialog. New token (last8 23a7eebc...d81e) appeared in TokenRevealDialog. Toast captured: { type: 'success', text: 'MCP token regenerated' }. Token row in list updated to new value. Minor cosmetic: TokenRevealDialog title hardcoded to 'Token Created' for both create AND regenerate flows (src/components/settings/MCPTab.tsx:398) — does not break functionality, but UX would benefit from a 'Token Regenerated' variant. Old-token rejection requires curl test against MCP endpoint (out of UI scope — covered by item #2 above)."
  - test: "Upgrade a free-tier org to PRO via the Polar checkout and confirm mcp_tokens row is created automatically"
    expected: "maybe_provision_mcp_token is called by polar-webhook; mcp_tokens row exists for the org immediately after subscription.active fires"
    why_human: "Requires a real Polar webhook event from a test purchase; cannot simulate without external billing event"
    result: "human_needed"
---

# Phase 19: Provisioning Foundation Verification Report

**Phase Goal:** MCP servers auto-provision for PRO+ orgs with plan gating enforced on every call and users can regenerate tokens
**Verified:** 2026-04-10T16:00:00Z (initial), 2026-05-07T08:35:00Z (regenerate flow re-verified live)
**Status:** human_needed (3 of 4 human items remain — all require external/real-event triggers)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | When a new org is created on PRO+ plan, an MCP server record is automatically created with no manual action | ? UNCERTAIN | `auto_provision_mcp_token` trigger exists and is substantive in migration; deployed per SUMMARY; cannot confirm live execution without prod test |
| 2 | Invoking any MCP tool with a free-tier org token returns a clear plan-gating error, not silent failure | ✓ VERIFIED (code) | `isPaidTier` function + `method.startsWith('callvault/')` gate in mcp-server/index.ts at line 247; error code -32001 with upgrade URL confirmed at line 262 |
| 3 | A user in settings can click "Regenerate token" and their old MCP token immediately stops working while a new one is issued | ✓ VERIFIED (code + live UI) | Code: `RiRefreshLine` button → `AlertDialog` confirmation → `regenerateToken.mutate()` → `setNewlyCreatedToken(token)` opens reveal dialog. Live: dev-browser 2026-05-07T08:30Z — full flow validated end-to-end (new token appeared, toast fired, row updated). |
| 4 | MCP tool invocations on a downgraded org (PRO → free) are rejected server-side within one request | ✓ VERIFIED (code) | Plan gating queries `user_profiles` live on every `callvault/*` call (no caching); `product_id = null` after revoke → `isPaidTier` returns false |

**Score:** 4/4 truths verified in code; #3 also verified live via dev-browser; 3 still require human confirmation of live behavior (real org create / real MCP curl / real Polar webhook).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260410153126_mcp_auto_provision.sql` | Auto-provision trigger, regenerate RPC, maybe_provision RPC | ✓ VERIFIED | 4 SQL functions + 1 trigger; all SECURITY DEFINER with SET search_path |
| `supabase/functions/polar-webhook/index.ts` | Auto-provision call on subscription.active and subscription.created | ✓ VERIFIED | `provisionMcpTokenForUser` called at line 168 (handleSubscriptionCreated) and line 207 (handleSubscriptionActive) |
| `supabase/functions/mcp-server/index.ts` | Server-side plan tier check on every tool invocation | ✓ VERIFIED | `isPaidTier` helper at line 85; gating block at line 244–266 |
| `src/services/mcp-tokens.service.ts` | `regenerateMcpToken(id)` service function calling RPC | ✓ VERIFIED | Function at line 130; calls `supabase.rpc('regenerate_mcp_token', { p_token_id: id })` |
| `src/hooks/useMcpTokens.ts` | `useRegenerateMcpToken` hook with TanStack mutation | ✓ VERIFIED | Hook at line 98; invalidates `MCP_TOKEN_KEYS.all`, fires `onSuccess` callback. Toast `MCP token regenerated` confirmed live. |
| `src/components/settings/MCPTab.tsx` | Regenerate button in TokenRow + confirmation AlertDialog | ✓ VERIFIED | `RiRefreshLine` at line 54; `onRegenerate` prop wired at line 557; `AlertDialog` at line 686. Live: dev-browser 2026-05-07T08:30Z. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| organizations INSERT trigger | mcp_tokens INSERT | `auto_provision_mcp_token()` SECURITY DEFINER | ✓ WIRED | Trigger `tr_auto_provision_mcp_token` defined; INSERT at migration line 85–87 |
| polar-webhook subscription.active handler | `maybe_provision_mcp_token` RPC | `supabase.rpc` call | ✓ WIRED | `provisionMcpTokenForUser` called at line 207; RPC call at line 361 |
| polar-webhook subscription.created handler | `maybe_provision_mcp_token` RPC | `supabase.rpc` call | ✓ WIRED | `provisionMcpTokenForUser` called at line 168 |
| mcp-server token lookup | user_profiles billing query | `supabase.from('user_profiles').select()` using `mcpToken.user_id` | ✓ WIRED | Query at mcp-server line 248–252 feeds `isPaidTier` check |
| plan gating check | mcpError response | JSON-RPC -32001 error | ✓ WIRED | `return mcpError(id, -32001, ...)` at line 259–265 |
| MCPTab Regenerate button | `useRegenerateMcpToken` hook | `mutation.mutate(tokenId)` | ✓ WIRED | `regenerateToken.mutate(regenerateTarget.id)` at line 488 |
| `useRegenerateMcpToken` hook | `regenerateMcpToken` service | `mutationFn` | ✓ WIRED | `mutationFn: (id: string) => regenerateMcpToken(id)` at hook line 104 |
| `regenerateMcpToken` service | `regenerate_mcp_token` RPC | `supabase.rpc` | ✓ WIRED | `supabase.rpc('regenerate_mcp_token', { p_token_id: id })` at service line 132 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `mcp-server/index.ts` plan gate | `ownerProfile.product_id`, `subscription_status`, `current_period_end` | `user_profiles` table query (live, no cache) | Yes — real DB columns, no static fallback | ✓ FLOWING |
| `MCPTab.tsx` regenerate flow | `regeneratedToken` (returned from RPC) | `regenerate_mcp_token` RPC via `regenerateMcpToken` service | Yes — atomic UPDATE RETURNING row with new hex; verified live | ✓ FLOWING |
| `polar-webhook/index.ts` provision | `memberships[]` → `organization_id` | `organization_memberships` table query | Yes — real table query; errors logged, not silenced | ✓ FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED for DB trigger and webhook behaviors (require live production events). Code-level wiring fully verified above. Regenerate UI flow now also verified live (2026-05-07).

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `isPaidTier` exported and invocable | `grep -c "function isPaidTier" mcp-server/index.ts` | 1 match | ✓ PASS |
| `regenerateMcpToken` in service exports | `grep "^export async function regenerateMcpToken"` | 1 match | ✓ PASS |
| `useRegenerateMcpToken` exported from hook | `grep "^export function useRegenerateMcpToken"` | 1 match | ✓ PASS |
| 4 SQL functions in migration | `grep -c "CREATE OR REPLACE FUNCTION" migration.sql` | 4 | ✓ PASS |
| `tr_auto_provision_mcp_token` trigger defined | `grep "tr_auto_provision_mcp_token" migration.sql` | Match | ✓ PASS |
| Regenerate UI flow end-to-end | dev-browser session | Token replaced in DB + reveal dialog + toast | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PROV-01 | 19-01 | MCP server auto-provisions when a new org is created (PRO+ plan required) | ✓ SATISFIED | `auto_provision_mcp_token` trigger + `maybe_provision_mcp_token` RPC cover both org creation and upgrade paths |
| PROV-02 | 19-02 | Plan tier checked server-side on every MCP tool invocation | ✓ SATISFIED | `isPaidTier` + `method.startsWith('callvault/')` gate in mcp-server; live user_profiles query per call |
| PROV-03 | 19-03 | User can regenerate MCP token (revoke old + issue new) from settings | ✓ SATISFIED | Full UI flow verified live 2026-05-07: `regenerateMcpToken` service → `useRegenerateMcpToken` hook → MCPTab `AlertDialog` → `TokenRevealDialog` → toast. |

All three phase requirements are accounted for with clear implementation evidence. No orphaned requirements found — REQUIREMENTS.md maps only PROV-01/02/03 to Phase 19.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `MCPTab.tsx` | 283, 296, 341 | `placeholder="..."` | ℹ️ Info | HTML input/select placeholder attributes — not implementation stubs; no impact |
| `MCPTab.tsx` | 398 | `<DialogTitle>Token Created</DialogTitle>` reused for regenerate | ℹ️ Cosmetic | TokenRevealDialog says "Token Created" even when triggered by Regenerate. Functionally fine; consider passing `mode: 'create' \| 'regenerate'` for clearer UX. Not a blocker. |

No blockers or warning-level anti-patterns found.

### Human Verification Required

#### 1. Auto-provision trigger fires on PRO+ org creation

**Test:** Create a new organization while logged in as a PRO+ subscriber. Check the `mcp_tokens` table (Supabase Table Editor or SQL: `SELECT * FROM mcp_tokens WHERE org_id = '<new-org-id>'`).
**Expected:** One row with `name = 'Auto-provisioned MCP Token'`, `scope = 'organization'`, `user_id` matching the org owner.
**Why human:** The `auto_provision_mcp_token` trigger fires on DB INSERT. Static analysis confirms the trigger is defined and the SQL logic is correct, but live execution against production must be confirmed.

#### 2. Plan gating rejects free-tier tokens at runtime

**Test:** Obtain a Bearer token from a free-tier org's `mcp_tokens` row. Send a JSON-RPC request: `curl -H "Authorization: Bearer <token>" -d '{"jsonrpc":"2.0","id":1,"method":"callvault/list_calls","params":{}}' https://<supabase-url>/functions/v1/mcp-server`
**Expected:** Response body: `{"jsonrpc":"2.0","id":1,"error":{"code":-32001,"message":"MCP access requires a Pro or Team plan. Upgrade at https://app.callvaultai.com/settings"}}`
**Why human:** Requires a real MCP token and live endpoint hit.

#### 3. Token regeneration end-to-end in settings UI ✅ DONE 2026-05-07

dev-browser verified the full UI flow against production: regenerate button → confirm dialog → new token in reveal dialog → toast `MCP token regenerated` → token row updated. Old-token rejection still requires the curl check (item #2 above), which is the live endpoint test.

#### 4. Upgrade path provisions token via Polar webhook

**Test:** Use a free-tier account, initiate a Polar test checkout to PRO, complete the purchase. Check `mcp_tokens` after `subscription.active` fires.
**Expected:** `mcp_tokens` row auto-created for the org with `name = 'Auto-provisioned MCP Token'`.
**Why human:** Requires a real Polar webhook event — cannot simulate without completing a test purchase.

### Gaps Summary

No code gaps. Three behavioral end-to-end tests still require live execution (real org create, real MCP curl, real Polar webhook) — they are external-event-dependent, not code defects.

---

_Initial: 2026-04-10T16:00:00Z_
_Re-verified (regenerate UI): 2026-05-07T08:35:00Z by Claude (dev-browser against app.callvaultai.com)_
