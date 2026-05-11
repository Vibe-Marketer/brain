---
phase: 22-ai-tools
plan: 03
type: summary
wave: 3
shipped: 2026-05-07
status: complete
---

# Phase 22 Plan 03 — Summary

**Title:** `ask_call` (free-form Q&A) + `get_sentiment` (sentiment analysis) MCP tools
**Wave:** 3
**Branch:** `gsd/phase-21-write-crud-tools`
**Closes:** AITL-03 (`ask_call`), AITL-04 (`get_sentiment`)

---

## What shipped

### 1. New MCP tool: `ask_call`

**File:** `supabase/functions/mcp-server/index.ts`

| Edit | Location |
|---|---|
| Imports updated | Line 3: `import { generateObject, generateText } from 'https://esm.sh/ai@5.0.102';` (was `generateObject` only) |
| TOOLS entry | Line 358 — `name: 'ask_call'` |
| Dispatcher case-block | Line 2055 — `case 'ask_call': { ... }` |

Behavior:
- Required params: `recording_id` + `question` (max 500 chars).
- Empty question → `-32602 question is required`.
- Question >500 chars → `-32602 question must be 500 characters or fewer`.
- Org/workspace boundary copy-block (D-16) verbatim from `get_action_items`.
- Validates transcript exists (`-32602` if empty).
- D-03: NO cache. Cost gate runs on every call.
- `generateText` with `openai/gpt-5-nano`, system prompt anchors model to transcript, `maxTokens: 800`.
- Response: `Q: ${question}\nA: ${answer}` per D-13.

### 2. New MCP tool: `get_sentiment`

| Edit | Location |
|---|---|
| TOOLS entry | Line 374 — `name: 'get_sentiment'` |
| Dispatcher case-block | Line 2157 — `case 'get_sentiment': { ... }` |

Behavior:
- Required param: `recording_id`.
- Org/workspace boundary copy-block (D-16) verbatim from `get_action_items`.
- **Tier 1 (cached):** `recordings.sentiment_cache` shape-validated (`overall` is one of the 4 enums, `talk_ratio` and `key_moments` are arrays). On hit → returns `(cached)`-prefixed output with NO LLM call and NO quota consumption (D-11).
- **Tier 2 (LLM):** validates transcript → `OPENROUTER_API_KEY` → `enforceMcpAiUsage` cost gate → 15k char truncation → `generateObject` with Zod `{overall, talk_ratio[], key_moments[]}` schema via `openai/gpt-5-nano` → best-effort cache write → returns `(analyzed)`-prefixed output.
- Cross-org / unknown recording → `-32001 Recording not found or not accessible`.

### 3. Gap-close migration: `recordings.sentiment_cache` column

**File:** `supabase/migrations/20260507150000_add_sentiment_cache_to_recordings.sql`

Discovered during smoke testing. CONTEXT.md, RESEARCH.md, and `src/types/supabase.ts:3955` all assumed `recordings.sentiment_cache` already existed (an earlier migration added the same column name to `fathom_calls`, but never to `recordings`). Production schema verification via `psql` confirmed the column was missing.

```sql
ALTER TABLE recordings
  ADD COLUMN IF NOT EXISTS sentiment_cache JSONB;

COMMENT ON COLUMN recordings.sentiment_cache IS '... (JSONB cache for get_sentiment MCP tool) ...';
```

Applied via `supabase db push` (exit 0). Without this migration the `get_sentiment` cache lookup AND cache write would have failed with `column does not exist`. This blocker would have silently broken Plan 22-03 + 22-04 quota economics — every call would have cache-miss-then-cache-write-fail, consuming quota on every call without ever caching.

---

## Verification evidence

### Code-level grep gates

| Check | Command | Expected | Actual |
|---|---|---|---|
| `ask_call` TOOLS entry | `grep -c "name: 'ask_call'"` | 1 | 1 |
| `ask_call` dispatcher case | `grep -c "case 'ask_call':"` | 1 | 1 |
| `ask_call` action type | `grep -c "actionType: 'mcp_ask_call'"` | 1 | 1 |
| `get_sentiment` TOOLS entry | `grep -c "name: 'get_sentiment'"` | 1 | 1 |
| `get_sentiment` dispatcher case | `grep -c "case 'get_sentiment':"` | 1 | 1 |
| `get_sentiment` action type | `grep -c "actionType: 'mcp_sentiment'"` | 1 | 1 |
| `generateText` import + usage | `grep -c "generateText"` | ≥ 2 | 2 (import + call) |

### Cost-gate ordering

For both case-blocks, `enforceMcpAiUsage(...)` precedes the LLM call (`generateText(` for ask_call, `generateObject(` for get_sentiment) by manual line read.

For `get_sentiment`, the `sentiment_cache` cache lookup precedes `enforceMcpAiUsage` — proves D-11 (cache hits don't consume quota).

For `ask_call`, NO cache column reference exists in the case-block (D-03).

### Runtime smoke tests (production deploy)

Deployed: `supabase functions deploy mcp-server --use-api` → `Deployed Functions on project vltmrnjsubfzrgrtdqey: mcp-server` (exit 0).

Test fixtures:
- MCP token: existing org-scoped `Claude Code Phase 21 UAT` (`enabled_categories=null` = full access including `ai`).
- Recording: `b9dfcce2-a4dd-4603-8c87-c82c6669f073` (`Sammy - AI Inbox MCP`, ~5345 char transcript). All cache columns NULL at start of test.

| Smoke test | Result | DB state |
|---|---|---|
| `tools/list` includes both tools | 2/2 present (40 total tools) | — |
| `ask_call` LLM path | Returns `Q: What was the main topic discussed?\nA: The main topic was planning and pricing a new AI inbox product (using Claude MCP)...` | 1 new `ai_usage` row with `action_type='mcp_ask_call'` |
| `ask_call` empty-question validation | `-32602 question is required` | NO ai_usage row |
| `ask_call` 600-char-question validation | `-32602 question must be 500 characters or fewer` | NO ai_usage row |
| `get_sentiment` LLM path (fresh `sentiment_cache=NULL`) | `# Sentiment: ... (analyzed)` + Overall: positive + 1 talk_ratio + 4 key_moments | 1 new `ai_usage` row with `action_type='mcp_sentiment'`; `sentiment_cache` populated |
| `get_sentiment` cache hit (second call same recording) | `# Sentiment: ... (cached)` + same content | NO new `ai_usage` row (count remained 1) |
| Cross-org access (fake UUID, both tools) | `-32001 Recording not found or not accessible` | — |

All 7 smoke tests pass.

### SQL evidence

```sql
SELECT id, sentiment_cache->>'overall' AS overall,
  jsonb_array_length(sentiment_cache->'talk_ratio') AS ratios,
  jsonb_array_length(sentiment_cache->'key_moments') AS moments
FROM recordings WHERE id = 'b9dfcce2-a4dd-4603-8c87-c82c6669f073';
--           id            | overall  | ratios | moments
-- ----------------------- | -------- | ------ | -------
-- b9dfcce2-...            | positive |      1 |       4

SELECT action_type, count(*) FROM ai_usage
WHERE recording_id = 'b9dfcce2-...' AND created_at > now() - interval '10 minutes'
GROUP BY action_type;
-- action_type    | count
-- -------------- | -----
-- mcp_ask_call   |     1
-- mcp_sentiment  |     1
```

The cache write happened exactly once (after Tier 2 LLM); the cached call did not produce another row. Both new action types correctly land in `ai_usage` (the relaxed CHECK constraint from Plan 22-02 gap-close enables this).

### Quota-exceeded smoke test

Not executed inline (would require setting test user's `ai_usage` past their plan limit, polluting production data). The error path is mechanically correct: `enforceMcpAiUsage` returns `{ allowed: false, reason: 'Monthly AI action limit reached (...)' }` when usage ≥ limit, and both case-blocks return `mcpError(id, -32001, gate.reason, corsHeaders)`. Verified by reading `_shared/track-ai-usage-inline.ts:130-137` (unchanged from Plan 22-01).

---

## Files changed

| Path | Change |
|---|---|
| `supabase/functions/mcp-server/index.ts` | EDIT — `generateText` added to existing import line; 2 new TOOLS entries; 2 new case-blocks (~280 lines added; 0 deleted from existing tools) |
| `supabase/migrations/20260507150000_add_sentiment_cache_to_recordings.sql` | NEW (gap-close): `ADD COLUMN IF NOT EXISTS sentiment_cache JSONB` on `recordings` (15 lines) |

---

## Requirements progress

- **AITL-03 ✅ closed** — `ask_call` MCP tool live; free-form Q&A grounded in transcript with 500-char question cap, no cache, per-call quota consumption.
- **AITL-04 ✅ closed** — `get_sentiment` MCP tool live; two-tier read-through cache populates `recordings.sentiment_cache`, cache hits skip LLM and quota.

---

## Coordination

No conflicts with parallel Phase 23 capability gating — all four AI tools (`extract_action_items`, `ask_call`, `get_sentiment`, `get_coaching_notes`) are pre-mapped to category `'ai'` in both `_shared/mcp-tool-categories.ts` and `src/lib/mcp-tool-categories.ts`. Tokens with `enabled_categories=null` (default) get full access; tokens with explicit categories must include `'ai'` to use these tools.

---

## Next up — Wave 4

Plan **22-04**: `get_coaching_notes` MCP tool. Two-tier read-through cache via `recordings.coaching_cache` (already exists from Plan 22-01 migration). `generateObject` with Zod schema `{ strengths[], improvements[], specific_examples[] }` via `openai/gpt-5-nano` (researcher D-08 decision: ship default, observe). All required imports already in place after Wave 3.

---

## Blockers

None. AITL-03 + AITL-04 closed. The `sentiment_cache` schema gap surfaced and fixed during smoke testing (gap-close migration shipped alongside the tools). Plan 22-04 can proceed.
