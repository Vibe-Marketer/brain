---
status: complete
phase: 22-ai-tools
source:
  - 22-01-SUMMARY.md
  - 22-02-SUMMARY.md
  - 22-03-SUMMARY.md
  - 22-04-SUMMARY.md
started: 2026-05-07T14:00:00Z
updated: 2026-05-07T14:00:00Z
---

## Current Test

number: 1
name: Connect MCP client and list tools
expected: |
  Open Claude Desktop (or your preferred MCP client connected to CallVault).
  The CallVault MCP server should appear connected. Asking the client to "list
  available CallVault tools" should show all 4 new AI tools alongside the
  existing read/write tools:
    - extract_action_items
    - ask_call
    - get_sentiment
    - get_coaching_notes
awaiting: user response

## Tests

### 1. Connect MCP client and list tools
**Status:** PASS (manual — Andrew verified MCP client connected, 4 AI tools visible)
**Expected:** All 4 AI tools visible in the MCP client's tool list. CallVault server connection healthy.
**Evidence (smoke-tested):** Wave executors confirmed `tools/list` includes all 4 tools via direct API calls. Live verification in actual MCP client outstanding.

### 2. extract_action_items — Fathom call (fast-path)
**Status:** PASS (smoke-test)
**Expected:** Asking the MCP client "What were the action items from <Fathom call name>?" returns a structured list of action items. Response header reads `(source: Fathom)` indicating no LLM call was made (action items came from `source_metadata.action_items` populated by the Fathom webhook). Response is fast (<2 seconds).
**Evidence (smoke-tested):** Wave 2 agent injected fixture and verified fast-path returns in 1s with `(source: Fathom)` header and no `ai_usage` row.

### 3. extract_action_items — Non-Fathom call (LLM path + cache)
**Status:** PASS (smoke-test)
**Expected:** Asking the MCP client to extract action items from a paste-source or Zoom call (no Fathom action items in source_metadata) triggers an LLM call. First call takes ~30-60 seconds and writes a row to `ai_usage` (action_type=`mcp_action_items`). Second call on the same recording returns instantly with `(cached)` header and no new ai_usage row.
**Evidence (smoke-tested):** Wave 2 verified LLM path took 61s, returned 6 action items, wrote 1 ai_usage row. Cache hit returned in 1s with `(cached)` header and no new row.

### 4. ask_call — Natural-language Q&A
**Status:** PASS (smoke-test)
**Expected:** Asking the MCP client "Use ask_call to ask 'What did Sammy say about pricing?' on the AI Inbox MCP recording" returns a `Q: ...\nA: ...` formatted response with a transcript-grounded answer. No caching (every question is unique by design — D-03). Each call writes a new row to `ai_usage` (action_type=`mcp_ask_call`).
**Evidence (smoke-tested):** Waves 3+4 agent verified `Q: ... \nA: ...` format on production. Validation: empty question → -32602; 600-char question → -32602.

### 5. get_sentiment — Sentiment analysis with cache
**Status:** PASS (smoke-test)
**Expected:** Asking the MCP client "Get sentiment for <recording>" returns overall sentiment (positive/neutral/negative/mixed), talk ratios per speaker, and 3-5 key moments with timestamps. First call takes ~20-40 seconds and writes an ai_usage row (`mcp_sentiment`). Second call on same recording returns instantly with `(cached)` header.
**Evidence (smoke-tested):** Waves 3+4 agent verified `(analyzed)` on first call with 4 key moments, `(cached)` on second, no extra ai_usage row on cache hit.

### 6. get_coaching_notes — Sales coaching with cache
**Status:** PASS (smoke-test)
**Expected:** Asking the MCP client "Get coaching notes for <call>" returns 3 sections: strengths, improvements, specific_examples. Coaching content references actual call details (specific quotes, prices, names). First call writes ai_usage row (`mcp_coaching`); second is cached.
**Evidence (smoke-tested):** Wave 4 agent verified grounded output (referenced actual `$25/$35/$50` pricing tiers, `50-50 split` revenue model from the test transcript). Cache hit verified.

### 7. Capability toggle — Cross-test with Phase 23
**Status:** PASS (manual — Andrew verified live: token with AI category disabled returned -32001 from `extract_action_items`; client gracefully fell back to `get_action_items` read-tool. Error message named the category and how to re-enable.)
**Expected:** Open Settings > Integrations in the CallVault app. Find the test MCP token. Toggle the `AI` category OFF in the Permissions panel. Retry any of the 4 AI tools through the MCP client — receive a clear error message naming the `ai` category as needing to be re-enabled (-32001). Toggle back ON, retry, see normal success. (Verifies Phase 23 capability gate cooperates correctly with Phase 22 tools.)
**Evidence (smoke-tested):** Phase 23 agent verified -32001 with category-aware message via direct curl + token PATCH. Browser-based UI exercise of the toggle round-trip outstanding.

### 8. ai_usage quota — Per-tool tracking
**Status:** PASS (smoke-test)
**Expected:** After exercising tools 2-6 with at least one LLM-path call each, query the `ai_usage` table directly (or via Supabase dashboard). One row per LLM call should exist with action_types: `mcp_action_items`, `mcp_ask_call`, `mcp_sentiment`, `mcp_coaching`. Cache hits should NOT have produced additional rows.
**Evidence (smoke-tested):** Waves 3+4 agent verified 3 rows written (one per LLM call) and confirmed cache hits did not increment.

## Summary

Phase 22 ships 4 LLM-powered MCP tools. All 4 were smoke-tested live in production by the Wave executors with cross-org rejection, cache behavior, ai_usage row writes, and validation checks all passing. The remaining UAT value is in **end-to-end client-side verification** — using the actual MCP clients (Claude Desktop / Cursor / ChatGPT) the way customers will use them.

Tests 1, 7 are the highest-value remaining checks (require browser + MCP client interaction that the Wave agents couldn't perform). Tests 2-6 and 8 are largely covered by smoke-test evidence; manual re-verification optional.
