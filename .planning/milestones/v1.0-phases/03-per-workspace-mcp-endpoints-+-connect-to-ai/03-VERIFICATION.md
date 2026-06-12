---
phase: 03
slug: per-workspace-mcp-endpoints-+-connect-to-ai
status: human_needed
verified: 2026-06-11
verifier: Retroactive bookkeeping audit (01-09 archive audit follow-up) — static probes + recorded live-smoke artifacts
---

# Phase 03 — Retroactive Verification

> Phase executed 2026-05-28/29 (6/6 plans, all SUMMARYs present). No formal phase-level verification record existed; this record was created retroactively on 2026-06-11. It combines today's cheap disk probes with the credential-backed production smoke that WAS recorded at execution time in `03-06-TASK3-LIVE-SMOKE.md` and `03-06-SUMMARY.md`. No new deploys or live calls were made for this record.

## Success Criteria (from ROADMAP, 11 criteria)

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Primary OAuth setup from Connectors → AI client sees that workspace's vault only | **human_needed** | Consent-page grant persistence shipped (03-03-SUMMARY; `mcp_oauth_client_grants` written before `approveAuthorization`). But no recorded end-to-end OAuth client (Claude Desktop / claude.ai) connection against a **workspace** endpoint with cross-workspace invisibility proof. 02-VERIFICATION's claude.ai OAuth was org-level. |
| 2 | Config snippets for Claude Desktop / Cursor / mcp-remote; vanity URLs only, no raw Supabase function URL | **passed** | Probe today: `McpSetupSnippets.tsx` builds endpoints from `getMcpUrl()` + `/w/{workspaceId}`; `grep -c "supabase.co\|functions/v1"` → **0**. `McpSetupSnippets.test.tsx` passed in the 03-06 gate (18 tests, 5 files). |
| 3 | `/mcp/w/{workspace_uuid}` returns workspace-scoped tools for valid token; wrong-workspace token → HTTP 403 (not 401) | **passed** (recorded live proof) | 03-06-TASK3-LIVE-SMOKE follow-up (2026-05-29, temp prod token, revoked after): valid `initialize` HTTP 200 (`protocolVersion 2025-03-26`), `tools/list` HTTP 200 (17 tools), wrong-workspace `tools/list` HTTP **403** JSON-RPC `-32001`. Path parsing still on disk today (`mcp-server/protocol.ts` workspace-path matchers). |
| 4 | UUID path scoping (renames don't break URLs); slugs v2-only | **passed** | Probe today: `protocol.ts` routes match UUID workspace paths only; no slug-based MCP routing exists in v1 server code. (Subdomain/slug work arrived later as Phase 06.1, separately gated.) |
| 5 | Per-workspace PRM document advertises correct workspace-scoped `resource` | **passed** (recorded live proof) | 03-06 follow-up smoke after Worker `callvault-api-proxy` deploy `d13eaafb-9b8e-4cd2-bebb-9baf6aa1d412`: both `api.callvaultai.com` and `mcp.callvaultai.com` vanity PRM routes returned the exact workspace-scoped `resource`. Full OAuth-discovery wizard negotiation not separately recorded (folded into item 1). |
| 6 | Connection-management UI lists OAuth grants + manual tokens with name/type/scope/workspace/endpoint/categories/last-used/created-by/revoke/rotate | **passed** (test-level) | `McpConnectionsTab.test.tsx` part of the green 03-06 verification gate; component on disk today. Live visual walkthrough not recorded — included in human-needed list. |
| 7 | First-class grant table keyed by user + `client_id` + org/workspace replaces `mcp_oauth_org_bindings` one-row-per-user | **passed** | Probe today: migration `20260528163000_mcp_oauth_client_grants_and_prefixed_tokens.sql` on disk (incl. legacy binding backfill per 03-01-SUMMARY, applied via live `supabase db push`); later `20260605231500_backfill_oauth_grant_admin_categories.sql` builds on it. |
| 8 | OAuth MCP auth verifies JWT, resolves grant by `client_id`, updates `last_used_at`, enforces `enabled_categories` (no synthetic full access) | **passed** (test-level) | 03-01-SUMMARY: `authenticateMcpRequest` switched to grant-backed auth keyed by JWT `client_id`, immediate 403 on revoked/missing grants; Wave 0 regression tests. `mcp_oauth_client_grants` referenced in `mcp-server/auth.ts` today. (JWT decode path further hardened in Phase 06.1 `sec-jwt-fix`.) |
| 9 | Revoking OAuth client / manual token rejects within one request cycle | **passed** (test-level) | Wave 0 tests cover revocation behavior + 401/403 semantics (03-01-SUMMARY); prod smoke revoked the temp token (`revoked=true`) but did not record a post-revocation 403 call — live half in human-needed list. |
| 10 | Multiple active OAuth grants + manual tokens coexist per org with different scopes | **passed** (test-level) | Grant table schema is multi-row by design; `oauth-client-grants.integration.test.ts` in green 03-06 gate. |
| 11 | New tokens minted `cv_ws_<hex>` / `cv_org_<hex>`; legacy hex still validates | **passed** | Probe today: prefixes present in `mcp-server/auth.ts` (incl. legacy fallback regex per 03-01-SUMMARY) and covered by `oauth-client-grants.integration.test.ts` / `McpSetupSnippets.test.tsx`. |

## Human-needed items

1. End-to-end OAuth client connect (Claude Desktop or claude.ai) against a **workspace** endpoint, proving other workspaces in the org are invisible to that connection (criteria 1, 5-wizard-half).
2. Live visual walkthrough of the Connectors MCP connection-management UI fields and revoke/rotate actions (criterion 6).
3. Live post-revocation request returning 403 for a just-revoked OAuth grant and manual token (criterion 9, live half).

## What this record does NOT prove

- No new live calls were made on 2026-06-11; live evidence is from the recorded 2026-05-28/29 smoke artifacts.
- Current production behavior may have evolved (Phases 06.1/06.2 touched the same auth/worker surface after this phase).

## Sign-off

- [x] All 11 criteria assessed; 9 passed (mix of recorded live proof, test-level, and disk probes).
- [ ] 3 live items remain for human verification (listed above).
