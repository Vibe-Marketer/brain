---
phase: 03
slug: per-workspace-mcp-endpoints-connect-to-ai
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-28
---

# Phase 03 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + Supabase Edge Function tests + React/Vite build + browser verification |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- --run supabase/functions/mcp-server/__tests__/category-gating.test.ts supabase/functions/mcp-server/__tests__/contract-surface.test.ts` |
| **Full suite command** | `npm run build && npm test -- --run supabase/functions/mcp-server/__tests__/category-gating.test.ts supabase/functions/mcp-server/__tests__/contract-surface.test.ts supabase/functions/mcp-server/__tests__/golden-replay.test.ts supabase/functions/mcp-server/__tests__/ai-tools-invariants.test.ts` |
| **Estimated runtime** | ~120-240 seconds locally; longer with real Supabase/OAuth/browser smoke |

---

## Sampling Rate

- **After every task commit:** Run the quick MCP auth/protocol slice or the closest new Phase 03 targeted test.
- **After every plan wave:** Run the full suite command plus any new Phase 03 migration/UI tests.
- **Before `$gsd-verify-work`:** Full suite, build, browser walkthrough, and production/staging endpoint smoke must be green or explicitly documented as blocked.
- **Max feedback latency:** 240 seconds for local checks; provider OAuth walkthroughs are manual acceptance gates.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | Grant model | 1 | MCP-02/MCP-03 | T-03-OAUTH-01 | Multiple OAuth clients can coexist and revoked grants fail closed | migration/integration | `npm test -- --run supabase/functions/mcp-server/__tests__/oauth-grants.test.ts` | W0 | pending |
| 03-02-01 | Workspace endpoint auth | 1 | MCP-01 | T-03-AUDIENCE-01 | Workspace A credentials cannot access workspace B endpoint | unit/integration | `npm test -- --run supabase/functions/mcp-server/__tests__/workspace-routing.test.ts` | W0 | pending |
| 03-02-02 | Protected resource metadata | 1 | MCP-01/MCP-02 | T-03-OAUTH-02 | Workspace PRM resource exactly matches `/mcp/w/{workspace_uuid}` | unit/contract | `npm test -- --run supabase/functions/mcp-oauth-metadata/__tests__/workspace-resource.test.ts` | W0 | pending |
| 03-03-01 | OAuth consent workspace scoping | 2 | MCP-02/MCP-03 | T-03-CONSENT-01 | Consent writes org default or selected workspace grant before approval | component/integration | `npm test -- --run src/pages/__tests__/OAuthConsentPage.test.tsx` | W0 | pending |
| 03-04-01 | AI connectors settings UI | 2 | MCP-02/MCP-03 | T-03-UI-01 | OAuth grants and manual tokens are visible, scoped, and revocable | component/build | `npm test -- --run src/components/settings/__tests__/MCPTab.test.tsx && npm run build` | W0 | pending |
| 03-05-01 | Provider setup snippets | 3 | MCP-02 | T-03-PROVIDER-01 | Snippets use `api.callvaultai.com/mcp/w/{workspace_uuid}` and do not expose raw Supabase URLs | component/source | `npm test -- --run src/components/settings/__tests__/McpSetupSnippets.test.tsx` | W0 | pending |
| 03-06-01 | Final smoke/runbook | 3 | MCP-01/MCP-02/MCP-03 | T-03-REGRESSION-01 | Live endpoint initializes, mismatched workspace returns 403, runbook reflects reality | build/live/manual | `npm run build` plus documented curl/browser smoke | yes | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] Add `supabase/functions/mcp-server/__tests__/oauth-grants.test.ts` for OAuth grant resolution, revoked grants, `client_id`, and `last_used_at`.
- [ ] Add `supabase/functions/mcp-server/__tests__/workspace-routing.test.ts` for `/mcp/w/{workspace_uuid}` parsing and 403 workspace mismatch.
- [ ] Add `supabase/functions/mcp-oauth-metadata/__tests__/workspace-resource.test.ts` for workspace protected-resource metadata.
- [ ] Add or extend `src/pages/__tests__/OAuthConsentPage.test.tsx` for org default and workspace checkbox/dropdown.
- [ ] Add or extend Settings tests for grouped OAuth/manual connector display and revoke/rotate actions.
- [ ] Confirm real Supabase test credentials and OAuth-provider capabilities before claiming end-to-end provider verification.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Claude custom connector OAuth | MCP-02/MCP-03 | Requires authenticated Claude account and remote custom connector UI | Add `https://api.callvaultai.com/mcp/w/{workspace_uuid}` as custom connector, complete OAuth, run `initialize`/`tools/list`, then revoke in CallVault and confirm next request fails |
| ChatGPT Developer Mode app | MCP-02/MCP-03 | Account/workspace feature availability varies | Create a ChatGPT app from the remote MCP server if available, confirm OAuth, refresh actions after a grant change, and record whether new tool visibility requires manual refresh |
| Cursor remote MCP setup | MCP-02 | Requires Cursor client behavior | Use generated `.cursor/mcp.json` or Add to Cursor flow if verified, authenticate, list tools, and confirm workspace endpoint works |
| Perplexity/Gemini/Manus setup | MCP-02 | Official support varies by product/account | Use only provider-documented setup paths; otherwise mark as unsupported/conditional and verify generic token instructions where possible |
| Production endpoint smoke | MCP-01 | Requires deployed function and real workspace/token/grant | Hit protected-resource metadata, valid workspace initialize/tools-list, and workspace mismatch 403 against `api.callvaultai.com` |

---

## Validation Sign-Off

- [ ] All tasks have automated or manual verify paths.
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify.
- [ ] Wave 0 creates missing Phase 03 test files before implementation depends on them.
- [ ] No watch-mode flags.
- [ ] Feedback latency target is under 240 seconds for local checks.
- [ ] Provider-specific setup claims are backed by current official docs or marked conditional.
- [ ] `nyquist_compliant: true` set in frontmatter after Wave 0 exists and task mapping is finalized.

**Approval:** pending
