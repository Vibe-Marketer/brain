---
phase: 22-ai-tools
plan: backfill
subsystem: mcp-ai
tags: [mcp, ai-tools, action-items, fathom, retroactive-backfill]
status: 0.5-of-4-shipped
shipped: ['get_action_items (read-only — reads source_metadata.action_items)']
pending: ['extract_action_items', 'ask_call', 'get_sentiment', 'get_coaching_notes']
dropped: ['summarize_call (AITL-01 dropped 2026-05-07 — in-app feature stays)']
backfilled: 2026-05-07
---

# Phase 22: AI Tools — Shipped Inventory (Backfilled)

> **Hybrid phase document.** Backfill catalog for `get_action_items` (the only AI-related MCP tool live today) plus the dropped `summarize_call` rescope decision. The 4 forward LLM tools are designed in `22-CONTEXT.md` and will be planned via `/gsd-plan-phase 22`.

## Status

🟡 **0.5/4 shipped (rescoped 2026-05-07).** AITL-01 dropped. AITL-02 partially shipped as `get_action_items` (Fathom-only read path). The LLM extraction layer for non-Fathom sources + 3 net-new tools (ask_call, sentiment, coaching) remain.

## What Already Shipped

### Read tool (no LLM call)

| Tool | Location | Behavior |
|---|---|---|
| `get_action_items` | `mcp-server/index.ts:328` | Returns action items from `recordings.source_metadata.action_items` (populated by Fathom webhook). Returns empty for non-Fathom sources. **No LLM call. No cost. No `track-ai-usage` invocation.** Read-only surface that the forward `extract_action_items` tool will read-through before calling LLM. |

### What was DROPPED (2026-05-07 rescope)

- **AITL-01 — `summarize_call` as MCP tool: DROPPED.** Reason: `summarize-call` already exists as an in-app button on the recording detail page. MCP clients (Claude Desktop, ChatGPT, Cursor) can call `get_transcript` and summarize themselves — no value in re-exposing it. Documented in ROADMAP.md and confirmed in 22-CONTEXT.md.

## Existing AI Infrastructure (locked, no decisions)

These are the rails the 4 forward tools will run on:

| Component | Location | Purpose |
|---|---|---|
| `summarize-call` edge function | `supabase/functions/summarize-call/index.ts` | Read-through cache pattern reference. Caches in `recordings.summary`. |
| `auto-tag-calls` edge function | `supabase/functions/auto-tag-calls/index.ts` | `generateObject` structured-extraction reference. Uses `openai/gpt-5-nano`. |
| `track-ai-usage` edge function | `supabase/functions/track-ai-usage/index.ts:29` | Cost-gating registry. `VALID_ACTION_TYPES = ['smart_import', 'auto_name', 'auto_tag', 'chat_message']`. Phase 22 plan will add 4 new entries. |
| `recordings.summary` column | DB | Existing — caches `summarize-call` output. |
| `recordings.sentiment_cache` JSONB | DB | Existing — will be reused by forward `get_sentiment` tool. |
| Vercel AI SDK + OpenRouter | `npm:@openrouter/ai-sdk-provider` + `npm:ai@5.0.102` | Locked stack. Architectural constraint: zero embedding pipeline. |

## Forward Plan Inventory (pending)

Per 22-CONTEXT.md decisions, plan-phase will produce:

- `22-01-PLAN.md` — Migration + `track-ai-usage` action type registration (1 SQL + 1 TS edit)
- `22-02-PLAN.md` — `extract_action_items` MCP tool (LLM extraction with read-through cache)
- `22-03-PLAN.md` — `ask_call` + `get_sentiment` MCP tools (parallelizable, similar pattern)
- `22-04-PLAN.md` — `get_coaching_notes` MCP tool (researcher may upgrade model)

Plans 02-04 can wave after 01 lands. Total estimate: ~2-3 dev-days end-to-end.

## Architectural Decisions (already locked across earlier phases — apply unchanged)

1. **Org/workspace boundary** (Phase 20 D-04, D-05) — every AI tool case branches on `mcpToken.scope`, queries `workspace_entries` for ownership.
2. **Error codes** (Phase 20 D-13) — `-32602` invalid params, `-32603` internal, `-32001` access/quota denied.
3. **Plan gating** (Phase 19) — every MCP tool call is plan-gated server-side. AI tools get this for free.
4. **Tool naming** (Phase 20 D-01) — bare verbs, snake_case, no `callvault_` prefix.
5. **Confirmation strings** (Phase 20 D-07, D-08) — plain-text formatted output for MCP-client display.

## Files Touched (already)

- `supabase/functions/mcp-server/index.ts` — `get_action_items` case handler at line 328 area.

## Commit Trail (for `get_action_items`)

- Commit `03904178` (2026-04-15) — feat: expand MCP server from 5 to 18 tools — added `get_action_items` among others.
- Commit `b6332686` (2026-05-07) — docs(planning): drop AITL-01 from Phase 22 — in-app summarize stays — rescope decision recorded in roadmap.

## Verification Status

**Code-level:** ✅ `get_action_items` case handler present and reads `source_metadata.action_items` correctly.

**Runtime / dev-browser:** ⏳ Not formally verified end-to-end via MCP client. Andrew has used the tool via Claude Desktop during development. Future audit could close this with: send a Fathom call ID through Claude Desktop → confirm action items return. Test non-Fathom source → confirm empty array (not error). Test cross-org access → confirm `-32001`.

## Next Step

Run `/gsd-plan-phase 22` — produces 22-01..22-04-PLAN.md per the inventory above.
