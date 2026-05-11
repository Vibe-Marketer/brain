# Phase 22 Discussion Log

**Date:** 2026-05-07
**Mode:** Default discuss (interactive, hybrid backfill + forward decisions)

## Summary

Phase 22 is partially shipped — `get_action_items` (read tool, surfaces Fathom-pre-extracted items from `source_metadata.action_items`) lives. The 4 LLM-extraction tools are net-new: `extract_action_items`, `ask_call`, `get_sentiment`, `get_coaching_notes`. AITL-01 (`summarize_call` as MCP tool) was DROPPED 2026-05-07. Discussion covered cache schema, model strategy, cost gating, and backfill scope.

## Areas Discussed

### Area 1: Cache schema for new AI outputs

**Question:** How should cached AI outputs be stored?

**Options:**
1. Per-tool JSONB columns on `recordings` (recommended) — mirrors existing `sentiment_cache` column
2. Single `recording_ai_outputs` normalized table — better audit/analytics
3. Single `recordings.ai_outputs` JSONB blob with action_type key — simplest schema

**User answer:** Option 1 — Per-tool JSONB columns on `recordings`.

**Decision logged:** D-02. Migration adds `action_items_cache JSONB` and `coaching_cache JSONB`. Existing `summary` and `sentiment_cache` columns reused as-is.

### Area 2: Model choice strategy

**Question:** Which OpenRouter model should the AI tools use?

**Options:**
1. Cheap default (gpt-5-nano), per-tool override (recommended)
2. User-tunable via `mcp_token_capabilities` (Phase 23 dep)
3. Quality default (gpt-4o / claude-sonnet-4), accept cost

**User answer:** Option 1 — Cheap by default, upgradable per tool.

**Decision logged:** D-06, D-07, D-08. Default `openai/gpt-5-nano`. Researcher may upgrade `get_coaching_notes` if quality demands it during plan-phase.

### Area 3: Cost-gating action types

**Question:** What action types should `track-ai-usage` register for the new MCP AI tools?

**Options:**
1. Generic `mcp_ai` action type — one quota for all 4
2. Per-tool action types (recommended) — `mcp_action_items`, `mcp_ask_call`, `mcp_sentiment`, `mcp_coaching`
3. Reuse existing types (e.g., map to `auto_tag`)

**User answer:** Option 2 — Per-tool action types.

**Decision logged:** D-09. Adds 4 new entries to `VALID_ACTION_TYPES` in `track-ai-usage/index.ts:29`.

### Area 4: Backfill scope

**Question:** Backfill the existing `get_action_items` read-tool decisions in CONTEXT.md alongside the 4 forward tools?

**Options:**
1. Yes — same hybrid pattern as Phase 20 and 21 (recommended)
2. No — forward decisions only

**User answer:** Option 1 — Full backfill.

**Decision logged:** D-01 documents `get_action_items` retroactively. The 4 forward tools are D-12 through D-15.

## Deferred Ideas

- Streaming AI responses (MCP client compat uneven)
- User-configurable models per tool (Phase 23 dep)
- Prompt versioning / hot-reload
- `summarize_call` as MCP tool (DROPPED — in-app feature stays)
- Cache invalidation tools
- Per-org cost cap / hard limit
- Action-item write-back to `source_metadata` (consolidation)
- MCP tool toggles per-token (Phase 23)

## Claude's Discretion (not asked, decided per established patterns)

- Tool names match spec verbatim: `extract_action_items`, `ask_call`, `get_sentiment`, `get_coaching_notes`.
- Streaming: non-streaming for v1 (D-17). MCP client compat is the binding constraint.
- Prompt locality: inline in case handlers (D-18). No shared prompt module yet.
- `ask_call` no caching (D-03) — confirmed in spec rescope note 2026-05-07.
- Read-through cache pattern for `extract_action_items` (D-04) — Fathom source_metadata first, then LLM cache, then LLM call.
- `track-ai-usage` is called BEFORE OpenRouter (D-10). Cached returns skip the gate (D-11).
- Org/workspace boundary checks inherited verbatim from Phase 20 (D-16). Copy from `get_action_items` case.
- Plan inventory: 4 plans (1 migration + 3 tool implementations, parallelizable after migration). Researcher decides waving.
