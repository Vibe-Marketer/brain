---
phase: 04
slug: mcp-ai-write-tools
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-29
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for MCP AI write-tool execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.16 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- supabase/functions/mcp-server/__tests__/contract-surface.test.ts supabase/functions/mcp-server/__tests__/category-gating.test.ts supabase/functions/mcp-server/__tests__/write-tools-boundary.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~60-180 seconds |

---

## Sampling Rate

- **After every task commit:** Run the quick MCP write-tool command above.
- **After every plan wave:** Run `npm test`.
- **Before `$gsd-verify-work`:** `npm test` and `npm run build` must both exit 0.
- **Max feedback latency:** 180 seconds for quick feedback; full-suite latency accepted at phase gates.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 0 | MCP-04 | T-04-01 / T-04-02 | New write tools cannot appear without category and contract coverage | contract | `npm test -- supabase/functions/mcp-server/__tests__/contract-surface.test.ts supabase/functions/mcp-server/__tests__/category-gating.test.ts` | ✅ | ⬜ pending |
| 04-01-02 | 01 | 0 | MCP-04 | T-04-01 / T-04-03 | Workspace/org scope and low-context ingest behavior have executable tests before implementation | unit/integration | `npm test -- supabase/functions/mcp-server/__tests__/write-tools-boundary.test.ts supabase/functions/mcp-server/__tests__/workspace-scope.integration.test.ts` | ✅ | ⬜ pending |
| 04-02-01 | 02 | 1 | MCP-04 | T-04-01 / T-04-04 | `ingest_transcript` persists only into authorized workspace, preserves `source_date`, and reports non-critical enrichment warnings | unit/integration | `npm test -- supabase/functions/mcp-server/__tests__/ingest-transcript.integration.test.ts supabase/functions/mcp-server/__tests__/write-tools-boundary.test.ts` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 1 | MCP-04 | T-04-01 / T-04-05 | Follow-up tools patch/append/upsert without destructive defaults or cross-workspace writes | unit/integration | `npm test -- supabase/functions/mcp-server/__tests__/set-speakers.idempotency.test.ts supabase/functions/mcp-server/__tests__/write-tools-boundary.test.ts` | ❌ W0 | ⬜ pending |
| 04-04-01 | 04 | 2 | MCP-04 | T-04-02 / T-04-06 | Tool discovery, markdown response shape, and production build remain compatible with remote MCP clients | contract/build | `npm test -- supabase/functions/mcp-server/__tests__/contract-surface.test.ts supabase/functions/mcp-server/__tests__/category-gating.test.ts && npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `supabase/functions/mcp-server/__tests__/ingest-transcript.integration.test.ts` — covers successful `ingest_transcript`, `source_date` persistence, low-context link/title import, warning-mode enrichment failures, Manual MCP Import provenance, and workspace target enforcement.
- [ ] `supabase/functions/mcp-server/__tests__/set-speakers.idempotency.test.ts` — covers repeated `set_speakers` payloads producing stable speaker/participant state.
- [ ] Extend `supabase/functions/mcp-server/__tests__/write-tools-boundary.test.ts` — covers tag creation, lowercase tag-name dedupe, ambiguous speaker reporting, `append_to_transcript` append behavior, and `update_call_metadata` merge behavior.
- [ ] Extend `supabase/functions/mcp-server/__tests__/contract-surface.test.ts` and `category-gating.test.ts` — covers all four new tool definitions, category mapping, and read-only invisibility/rejection.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live MCP smoke with a real workspace-scoped token | MCP-04 | Requires valid production token and workspace fixture | POST `tools/list`, `ingest_transcript`, and one follow-up tool against `https://api.callvaultai.com/mcp/w/{workspace_uuid}`; verify HTTP 200, markdown `content[0].text`, and recording visible in app. |

---

## Threat Model

| ID | Threat | Severity | Mitigation Required |
|----|--------|----------|---------------------|
| T-04-01 | Cross-workspace write escalation through `workspace_id` or path mismatch | high | Resolve target workspace from token/path before mutation; workspace tokens reject mismatched workspace IDs; org tokens require authorized explicit workspace ID. |
| T-04-02 | Read-only or AI-only token discovering or invoking write tools | high | Keep all four tools in `TOOL_CATEGORIES` as `write`; verify `tools/list` filtering and category gate rejection. |
| T-04-03 | Oversized or malformed transcript/metadata payload causes DoS or corrupt records | medium | Validate input shape and enforce bounded string/list sizes before persistence. |
| T-04-04 | Partial enrichment failure hides data loss from user/agent | medium | Preserve recording ingest, aggregate warnings, and include created/reused/unresolved breakdown in markdown response. |
| T-04-05 | Follow-up tools wipe existing transcript, metadata, or speakers by default | medium | Default to append/merge/upsert; require explicit destructive mode for replace/delete behavior. |
| T-04-06 | MCP provenance spoofing makes MCP/manual imports look like native connector syncs | medium | Use visible `Manual MCP Import` source identity and preserve client/original URL metadata only in `source_metadata`. |

---

## Validation Sign-Off

- [x] All tasks have automated verify commands or Wave 0 dependencies.
- [x] Sampling continuity: no 3 consecutive tasks without automated verify.
- [x] Wave 0 covers all missing references.
- [x] No watch-mode flags.
- [x] Feedback latency target documented.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** pending
