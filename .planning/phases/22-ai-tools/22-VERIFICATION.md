---
phase: 22-ai-tools
status: human_needed
verified_at: 2026-05-07T19:55:00Z
score: "All 4 AITL-XX have smoke-PASS evidence (6/8 PASS in 22-UAT). 2 manual UAT items pending live triggers — items 1 (live MCP client connect) and 7 (capability toggle round-trip)."
source_evidence:
  - "22-01-SUMMARY.md"
  - "22-02-SUMMARY.md"
  - "22-03-SUMMARY.md"
  - "22-04-SUMMARY.md"
  - "22-UAT.md"
requirements_covered:
  - AITL-02
  - AITL-03
  - AITL-04
  - AITL-05
human_verification:
  - test: "Connect MCP client (Claude Desktop / Cursor / ChatGPT) and list tools — verify all 4 AI tools appear alongside read/write tools"
    expected: "extract_action_items, ask_call, get_sentiment, get_coaching_notes all visible in client tool list; CallVault server connection healthy"
    why_human: "Requires live MCP client session against production endpoint — not testable from server-side smoke alone"
    result: "human_needed"
    evidence: "22-UAT.md test 1 — Wave executors confirmed tools/list via direct API; live client verification outstanding"
  - test: "Capability toggle round-trip (cross-test with Phase 23 MGMT-02)"
    expected: "In Settings > Integrations, toggle AI category OFF on a test token. Retry an AI tool through real MCP client — receive -32001 with category-aware message. Toggle ON, retry, normal success."
    why_human: "Requires browser session + active MCP client to exercise the UI toggle round-trip end-to-end"
    result: "human_needed"
    evidence: "22-UAT.md test 7 — Phase 23 agent verified -32001 via direct curl + token PATCH; browser-based UI exercise outstanding"
---

# Phase 22 Verification (Backfilled 2026-05-07)

> Promoted from embedded evidence in 22-01..04-SUMMARY.md + 22-UAT.md per Phase 27 D-06.
> 22-UAT shows 6/8 PASS smoke-tests; items 1 and 7 retain `human_needed` status pending live MCP client + browser-driven capability-toggle round-trip. This backfill preserves that mixed status — `human_needed` overall, but every AITL-XX has substantive smoke-PASS evidence.

## Goal

Users' MCP clients can invoke LLM-powered analysis on any call, with results cached so repeat calls are instant.

## Success Criteria Status

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | AITL-02 extract_action_items returns structured output | ✅ smoke-PASS | 22-UAT tests 2-3: Fathom fast-path returned in 1s with `(source: Fathom)` header + no ai_usage; LLM path 61s + 6 items + 1 ai_usage row + cache hit verified |
| 2 | AITL-03 ask_call returns grounded Q&A answer | ✅ smoke-PASS | 22-UAT test 4: `Q: ...\nA: ...` format on production; 500-char validation; empty question -> -32602 |
| 3 | AITL-04 get_sentiment returns tone + talk-ratio + key moments | ✅ smoke-PASS | 22-UAT test 5: `(analyzed)` first call with 4 key_moments; `(cached)` second; sentiment_cache populated |
| 4 | AITL-05 get_coaching_notes returns sales coaching insights | ✅ smoke-PASS | 22-UAT test 6: 5 strengths + 5 improvements + 5 examples grounded in transcript content (referenced actual `$25/$35/$50` pricing tiers, `50-50 split` revenue model); cache hit verified |
| 5 | ai_usage quota tracking — per-tool rows written, cache hits skip | ✅ smoke-PASS | 22-UAT test 8: 3 rows written (one per LLM call) — `mcp_action_items`, `mcp_ask_call`, `mcp_sentiment`, `mcp_coaching`; cache hits did not increment |

## Requirements Coverage

| Req | Status | Evidence |
|-----|--------|----------|
| AITL-02 | ✅ smoke-PASS (manual MCP client test pending) | 22-02-SUMMARY + 22-UAT tests 2-3 |
| AITL-03 | ✅ smoke-PASS (manual MCP client test pending) | 22-03-SUMMARY + 22-UAT test 4 |
| AITL-04 | ✅ smoke-PASS (manual MCP client test pending) | 22-03-SUMMARY + 22-UAT test 5 |
| AITL-05 | ✅ smoke-PASS (manual MCP client test pending) | 22-04-SUMMARY + 22-UAT test 6 |

## Backfill Notes

- All 4 AITL-XX requirements have substantive smoke-test evidence in production via wave-executor curl + direct API tests.
- Two manual UAT items intentionally retain `human_needed` status: item 1 (live MCP client tool listing) and item 7 (capability toggle UI round-trip via Phase 23). These require browser session + Claude Desktop/Cursor/ChatGPT — out of agent scope.
- Default model: `openai/gpt-5-nano` (per researcher recommendation in `22-RESEARCH.md`). Tech debt: observe quality after first 100 production calls (D-08).
- Phase 22 ships 4 LLM-powered MCP tools. The remaining UAT value is in end-to-end client-side verification using actual MCP clients the way customers will use them. Server-side smoke evidence is comprehensive.
- 27 pre-existing test failures + many TS errors documented in 22 tech_debt — not caused by Phase 22, deferred.

---

_Backfilled 2026-05-07T19:55:00Z by Claude (Phase 27 Plan 02 — D-06 closure)_
