# Phase 22: AI Tools - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning (4 LLM tools to ship as 3-4 plans) + retroactive backfill of `get_action_items` read-tool already shipped
**Source:** `/gsd-discuss-phase 22` — combined backfill + forward-decision discussion

> **Hybrid phase.** `get_action_items` shipped as a read-tool surfacing Fathom's pre-extracted action items from `source_metadata.action_items`. The 4 LLM-extraction tools (`extract_action_items`, `ask_call`, `get_sentiment`, `get_coaching_notes`) are net-new. AITL-01 (`summarize_call` as MCP) was DROPPED 2026-05-07 — in-app feature stays.

<domain>
## Phase Boundary

Users' MCP clients can invoke LLM-powered analysis on any call via four tools: extract structured action items, ask a free-form natural-language question grounded in the transcript, get sentiment analysis, and get sales coaching notes. Outputs that aren't single-shot are cached on the recording so repeat calls are instant.

**Boundary:**
- IN SCOPE: 4 LLM-powered MCP tools (extract_action_items, ask_call, get_sentiment, get_coaching_notes), per-tool DB caching where appropriate, cost-gating via `track-ai-usage` action-type registry, leveraging the existing Vercel AI SDK + OpenRouter pipeline established in `summarize-call` and `auto-tag-calls`.
- OUT OF SCOPE: Embedding pipeline / vector search (architectural constraint). `summarize_call` as an MCP tool (DROPPED — in-app feature stays). Per-tool capability toggles in management UI (Phase 23). Streaming responses (deferred to a future enhancement; v1 ships non-streaming for MCP client compat).

</domain>

<decisions>
## Implementation Decisions

### Backfilled — `get_action_items` (already shipped)

- **D-01:** `get_action_items` (mcp-server/index.ts:328) reads from `recordings.source_metadata.action_items` (JSONB array of strings populated by Fathom webhook). It's a thin read-only tool — no LLM call. This is the "read-through" half of action-item handling. The forward `extract_action_items` tool is the LLM half (covered below).

### Forward — Cache schema (Decision: Per-tool JSONB columns on recordings)

- **D-02: Add per-tool JSONB cache columns on `recordings` table** — mirroring the existing `recordings.sentiment_cache` JSONB pattern. Migration adds:
  ```sql
  ALTER TABLE recordings
    ADD COLUMN action_items_cache JSONB,
    ADD COLUMN coaching_cache JSONB;
  ```
  `recordings.summary` (existing) caches `summarize-call` output. `recordings.sentiment_cache` (existing) caches sentiment. The two new columns cap the AI cache surface for v1.

- **D-03:** `ask_call` does NOT cache. Every question is unique by construction. Caching would require hashing (transcript + question) and would rarely hit. Confirmed against rescoped 2026-05-07 spec note.

- **D-04:** Read-through cache pattern for `extract_action_items`:
  1. If `recordings.source_metadata.action_items` exists (Fathom-source recording) → return that (no LLM call, no cost, no token usage).
  2. Else if `recordings.action_items_cache` exists → return that.
  3. Else call LLM, store result in `action_items_cache`, return.
  This means non-Fathom (paste-source, Zoom, manual upload) recordings get LLM extraction on first request and cache thereafter.

- **D-05:** `get_sentiment` follows the same pattern using `sentiment_cache`. `get_coaching_notes` uses `coaching_cache`. Both are simple read-through (no Fathom analog).

### Forward — Model choice (Decision: Cheap by default, per-tool override)

- **D-06: Default model: `openai/gpt-5-nano`** via OpenRouter — same model `auto-tag-calls` uses today. Cheap, fast, sufficient for structured extraction tasks.
- **D-07:** Model is hardcoded per-tool in the edge function for v1, NOT user-configurable. Reasoning: avoids Phase 23 dependency. If a customer asks for higher quality on a specific tool, escalate the model in code in a follow-up commit.
- **D-08:** Per-tool model overrides allowed when quality demands it. Plan-phase researcher should evaluate during planning whether `get_coaching_notes` needs a stronger model (e.g., `anthropic/claude-haiku-4-5` or `openai/gpt-4o-mini`) — coaching is qualitative and may suffer from gpt-5-nano. Default is gpt-5-nano; researcher recommends override only with concrete quality evidence.

### Forward — Cost gating (Decision: Per-tool action types)

- **D-09: Add 4 new entries to `VALID_ACTION_TYPES`** in `supabase/functions/track-ai-usage/index.ts:29`:
  ```typescript
  const VALID_ACTION_TYPES = [
    'smart_import', 'auto_name', 'auto_tag', 'chat_message',  // existing
    'mcp_action_items', 'mcp_ask_call', 'mcp_sentiment', 'mcp_coaching',  // new
  ] as const;
  ```
  Per-tool granularity matches existing convention (`auto_name` vs `auto_tag`) and lets analytics distinguish which MCP tools are popular and which are runaway-cost risks.

- **D-10:** Every MCP AI tool MUST call `track-ai-usage` with its specific action type BEFORE invoking OpenRouter. If `track-ai-usage` returns `429 Limit Exceeded`, the MCP tool returns a clear plan-gating-style error to the MCP client (`-32001` with upgrade guidance). No silent skip, no fallback.

- **D-11:** Cached returns (D-04 hits, D-05 hits) do NOT call `track-ai-usage` — quota is for LLM calls, not for cache reads.

### Forward — Tool inventory (4 LLM tools)

For each tool: name, params, model, cache target, action_type.

- **D-12: `extract_action_items`**
  - Params: `recording_id` (required UUID)
  - Cache: `recordings.action_items_cache` (with read-through to `source_metadata.action_items` first, per D-04)
  - Model: `openai/gpt-5-nano`
  - Action type: `mcp_action_items`
  - Output schema (Zod via generateObject): `{ items: Array<{ owner: string|null, action: string, due_date: string|null }> }`
  - Returns: human-readable formatted string of items, one per line.

- **D-13: `ask_call`**
  - Params: `recording_id` (required UUID), `question` (required string, max 500 chars)
  - Cache: NONE (D-03)
  - Model: `openai/gpt-5-nano`
  - Action type: `mcp_ask_call`
  - generateText (free-form), system prompt: `You are answering a question about a call recording. Quote the transcript directly when possible. If the question can't be answered from the transcript, say so explicitly. Do not speculate.`
  - Returns: the model's plain-text answer, prefixed with `Q: {question}\nA: ` for clarity.

- **D-14: `get_sentiment`**
  - Params: `recording_id` (required UUID)
  - Cache: `recordings.sentiment_cache`
  - Model: `openai/gpt-5-nano`
  - Action type: `mcp_sentiment`
  - generateObject schema: `{ overall: 'positive'|'neutral'|'negative'|'mixed', talk_ratio: { speaker_name: string, percentage: number }[], key_moments: { timestamp: string, sentiment: string, snippet: string }[] }`
  - Returns: human-readable summary string.

- **D-15: `get_coaching_notes`**
  - Params: `recording_id` (required UUID)
  - Cache: `recordings.coaching_cache`
  - Model: `openai/gpt-5-nano` (default — researcher may upgrade per D-08)
  - Action type: `mcp_coaching`
  - generateObject schema: `{ strengths: string[], improvements: string[], specific_examples: { topic: string, observation: string, suggestion: string }[] }`
  - Returns: human-readable coaching report.

### Forward — Org/workspace boundary (inherited from Phase 20)

- **D-16:** Every AI tool case handler runs the same `mcpToken.scope` branch + `fetchOrgWorkspaceIds()` ownership check on `recording_id` BEFORE calling LLM or reading cache. No new boundary code — copy the existing `get_action_items` block.

### Forward — Streaming (Decision: non-streaming for v1)

- **D-17:** AI tools return final results in a single MCP response (non-streaming). Reasoning: MCP client streaming support is uneven (Claude Desktop yes, ChatGPT/Cursor inconsistent); non-streaming is the safe lowest-common-denominator. Streaming is a future enhancement if customer demand surfaces.

### Forward — Prompt locality (Decision: inline)

- **D-18:** Prompts live inline in each tool's case handler in `mcp-server/index.ts`, matching `auto-tag-calls` and `summarize-call` conventions. Reasoning: no shared prompt module exists today; introducing one for v1 is premature. If we ship 5+ AI tools and prompts diverge, refactor to `_shared/mcp-ai-prompts.ts` later.

### Forward — Phase 22 plan inventory

Plan-phase will produce these plans:

- **22-01-PLAN.md:** Migration — add `action_items_cache` and `coaching_cache` JSONB columns on `recordings`. Add 4 new entries to `track-ai-usage` `VALID_ACTION_TYPES`.
- **22-02-PLAN.md:** Implement `extract_action_items` MCP tool (read-through cache + LLM extraction for non-Fathom sources).
- **22-03-PLAN.md:** Implement `ask_call` and `get_sentiment` MCP tools (parallel — independent, both follow the standard pattern).
- **22-04-PLAN.md:** Implement `get_coaching_notes` MCP tool (separate plan because researcher may recommend a stronger model).

Plans 02/03/04 can run in parallel after 01 lands. Researcher decides waving in plan-phase.

</decisions>

<canonical_refs>
## Canonical References

- `supabase/functions/mcp-server/index.ts` — single edge function. `get_action_items` read tool at line 328. New AI tools will be added as new case blocks.
- `supabase/functions/summarize-call/index.ts` — analog for read-through cache + Vercel AI SDK + OpenRouter call. Mirror this pattern for the new tools.
- `supabase/functions/auto-tag-calls/index.ts` — analog for `generateObject` structured-output extraction with Zod schema validation.
- `supabase/functions/track-ai-usage/index.ts:29` — `VALID_ACTION_TYPES` registry. MUST add new entries before tools call OpenRouter.
- `supabase/CLAUDE.md` — migration conventions, function-folder kebab-case, Zod input validation, RLS-on-by-default.
- `.planning/phases/20-read-crud-tools/20-CONTEXT.md` — locked org/workspace isolation pattern, mcpOk/mcpError helpers, error codes. Apply unchanged.
- `.planning/phases/19-provisioning-foundation/19-CONTEXT.md` — plan-gating chain. AI tools inherit gating automatically (every tool call passes through plan check).
- `.planning/REQUIREMENTS.md` — AITL-02 🟡, AITL-03 ⏳, AITL-04 ⏳, AITL-05 ⏳. ~~AITL-01~~ DROPPED.
- `.planning/ROADMAP.md` — Phase 22 detail with rescope note (2026-05-07).
- `src/types/supabase.ts` — confirms existing `summary`, `sentiment_cache` columns on `recordings`. New columns to add: `action_items_cache`, `coaching_cache`.

</canonical_refs>

<code_context>
## Reusable Patterns

The 4 new AI tools should mirror these existing patterns:

1. **Read-through cache** — copy from `summarize-call/index.ts:288` (the cached-summary return path). Check cache → return if hit. Else LLM call → store → return.
2. **OpenRouter init** — `const openrouter = createOpenRouter({ apiKey: Deno.env.get('OPENROUTER_API_KEY')! });` (in tool case-block scope, NOT module-level — the apiKey check is per-call).
3. **Structured extraction** — `generateObject({ model: openrouter('openai/gpt-5-nano'), schema: zodSchema, prompt: '...' })` from `auto-tag-calls/index.ts:541`.
4. **Free-form Q&A** — `generateText({ model: openrouter('openai/gpt-5-nano'), system: '...', prompt: '...' })` (new pattern; no exact analog yet but standard AI SDK shape).
5. **Cost gating wrapper** — POST to `track-ai-usage` BEFORE the OpenRouter call. On `429`, return MCP `-32001` error with upgrade guidance. On `200`, proceed.
6. **Org/workspace boundary** — copy lines from existing `get_action_items` case (mcp-server/index.ts:328-360 region).
7. **Standard error codes** — `-32602` invalid params, `-32603` internal/Supabase, `-32001` access denied / quota exceeded.

## Migration template

The migration should follow `supabase/CLAUDE.md` conventions:
- Filename: `YYYYMMDDHHMMSS_add_ai_cache_columns.sql`
- Header comment with purpose, author, date
- Plain ALTER TABLE adds (no constraints needed; cache is opaque JSONB)
- Migration includes the `VALID_ACTION_TYPES` change for `track-ai-usage` if it's done in the same migration; otherwise plan separately.

</code_context>

<deferred>
## Deferred Ideas (Not in This Phase)

- **Streaming AI responses** — MCP client compat uneven. v1 ships non-streaming. Revisit when client landscape stabilizes.
- **User-configurable models per tool** — depends on Phase 23 management UI. Hardcoded for v1.
- **Prompt versioning / hot-reload** — prompts inline in code for v1. Move to `_shared/` if 5+ AI tools accumulate divergent prompts.
- **`summarize_call` as MCP tool** — DROPPED 2026-05-07 (in-app feature stays; MCP clients can call `get_transcript` and summarize themselves).
- **Cache invalidation tools** — `invalidate_ai_cache(recording_id, tool_name)` MCP tool. Useful when transcript is re-edited. Defer until customer asks.
- **Per-org cost cap / hard limit** — currently quotas are per-user-tier via `track-ai-usage`. A hard org-level dollar cap (e.g., "Team plan max $50/mo MCP AI") could prevent abuse but adds billing complexity. Defer unless cost runs hot in practice.
- **Action-item write-back to `source_metadata`** — `extract_action_items` could merge LLM results back into `source_metadata.action_items` so `get_action_items` (read tool) returns them too. Adds coupling. v1 keeps caches separate; consider unifying in a future phase.
- **MCP tool toggles per-token (Phase 23)** — toggling AI tools off per-customer-token is a Phase 23 capability. v1 of Phase 22 ships all 4 tools enabled.

</deferred>

<spec_lock>
## Locked Requirements (from REQUIREMENTS.md)

- **~~AITL-01~~ DROPPED** (`summarize_call` as MCP tool) — in-app feature stays. Documented in ROADMAP.md scope-change note 2026-05-07.
- **AITL-02 🟡 → covered by D-04 + D-12** (`extract_action_items` LLM extraction for non-Fathom sources; existing read-tool `get_action_items` continues to surface Fathom-pre-extracted items).
- **AITL-03 ⏳ → covered by D-13** (`ask_call`).
- **AITL-04 ⏳ → covered by D-14** (`get_sentiment`).
- **AITL-05 ⏳ → covered by D-15** (`get_coaching_notes`).

</spec_lock>
