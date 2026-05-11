---
phase: 19
slug: provisioning-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-10
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual smoke tests (no automated test framework detected) |
| **Config file** | none |
| **Quick run command** | `curl -X POST {MCP_URL} -H "Authorization: Bearer {TOKEN}" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'` |
| **Full suite command** | Manual verification of all 4 success criteria via dev-browser + curl |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick curl test against MCP endpoint
- **After every plan wave:** Verify all success criteria for that wave
- **Before `/gsd-verify-work`:** All 4 success criteria must pass
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 19-01-01 | 01 | 1 | PROV-01 | T-19-01 | Token auto-created for PRO+ org on INSERT | smoke | Manual: verify mcp_tokens row in Supabase | N/A | ⬜ pending |
| 19-01-02 | 01 | 1 | PROV-01 | T-19-02 | Free org creation does NOT create token | smoke | Manual: verify no row for free org | N/A | ⬜ pending |
| 19-01-03 | 01 | 1 | PROV-02 | T-19-03 | Free-tier token returns -32001 error | smoke | `curl POST with free-org token` | N/A | ⬜ pending |
| 19-01-04 | 01 | 1 | PROV-02 | T-19-04 | PRO+ token succeeds (not gated) | smoke | `curl POST with PRO token` | N/A | ⬜ pending |
| 19-02-01 | 02 | 2 | PROV-03 | T-19-05 | Regenerate button visible in MCPTab | visual | dev-browser screenshot | N/A | ⬜ pending |
| 19-02-02 | 02 | 2 | PROV-03 | T-19-06 | Old token rejected after regenerate | smoke | `curl with old token → -32001` | N/A | ⬜ pending |
| 19-02-03 | 02 | 2 | PROV-03 | T-19-07 | New token works after regenerate | smoke | `curl with new token → success` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements.
- No new test framework needed — manual smoke tests via curl and dev-browser.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Auto-provisioned token appears in MCPTab | PROV-01 | Requires sign-up flow + billing state | Create test org on PRO plan, navigate to Settings > MCP, verify token visible |
| Downgraded org token rejected | PROV-02 | Requires billing state change | Use test token from PRO org, change billing to free, retry tool call |
| TokenRevealDialog shows after regenerate | PROV-03 | Visual confirmation needed | Click Regenerate, confirm dialog, verify reveal dialog shows new token |
