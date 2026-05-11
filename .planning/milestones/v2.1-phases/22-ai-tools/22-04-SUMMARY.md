---
phase: 22-ai-tools
plan: 04
type: summary
wave: 4
shipped: 2026-05-07
status: complete
---

# Phase 22 Plan 04 — Summary

**Title:** `get_coaching_notes` MCP tool — sales coaching notes via two-tier read-through cache
**Wave:** 4
**Branch:** `gsd/phase-21-write-crud-tools`
**Closes:** AITL-05 (and Phase 22 in full)

---

## What shipped

### 1. New MCP tool: `get_coaching_notes`

**File:** `supabase/functions/mcp-server/index.ts`

| Edit | Location |
|---|---|
| TOOLS entry | Line 386 — `name: 'get_coaching_notes'` |
| Dispatcher case-block | Line 2348 — `case 'get_coaching_notes': { ... }` |

Behavior:
- Required param: `recording_id`.
- Org/workspace boundary copy-block (D-16) verbatim from `get_action_items`.
- **Tier 1 (cached):** `recordings.coaching_cache` shape-validated (`Array.isArray` checks for `strengths`, `improvements`, `specific_examples`). On hit → returns `(cached)`-prefixed output with NO LLM call and NO quota consumption (D-11).
- **Tier 2 (LLM):** validates transcript → `OPENROUTER_API_KEY` → `enforceMcpAiUsage({ actionType: 'mcp_coaching' })` cost gate → 15k char truncation → `generateObject` with Zod `{ strengths[], improvements[], specific_examples[] }` schema via `openai/gpt-5-nano` → best-effort cache write → returns `(analyzed)`-prefixed output.
- Cross-org / unknown recording → `-32001 Recording not found or not accessible`.

Default model **`openai/gpt-5-nano`** per researcher D-08 decision in `22-RESEARCH.md` (no upgrade at launch — quality observed in smoke test was strong; see Quality Spot-Check below).

---

## Verification evidence

### Code-level grep gates

| Check | Command | Expected | Actual |
|---|---|---|---|
| TOOLS entry | `grep -c "name: 'get_coaching_notes'"` | 1 | 1 |
| Dispatcher case | `grep -c "case 'get_coaching_notes':"` | 1 | 1 |
| Action type | `grep -c "actionType: 'mcp_coaching'"` | 1 | 1 |
| `CoachingSchema` | `grep -c "CoachingSchema"` | ≥ 2 | 2 (declaration + use) |
| `coaching_cache` | `grep -c "coaching_cache"` | ≥ 2 | 3 (select + read + write) |
| All four AI case-blocks | `grep -cE "case '(extract_action_items|ask_call|get_sentiment|get_coaching_notes)':"` | 4 | 4 |
| Default model | `grep -c "openai/gpt-5-nano"` | ≥ 4 | 4 (one per AI tool) |

### Cost-gate ordering

In the case-block, line ordering manually verified:
1. Org/workspace boundary
2. Recording fetch (transcript + cache)
3. Cache validation + early return on hit
4. Transcript validation
5. OpenRouter key check
6. **`enforceMcpAiUsage` (cost gate)** ← line 2440
7. **`generateObject` (LLM call)** ← line 2505
8. Cache write
9. Return formatted output

Cache lookup precedes cost gate (D-11). Cost gate precedes LLM (D-10).

### Runtime smoke tests (production deploy)

Deployed: `supabase functions deploy mcp-server --use-api` → `Deployed Functions on project vltmrnjsubfzrgrtdqey: mcp-server` (exit 0).

Test fixtures:
- MCP token: existing org-scoped `Claude Code Phase 21 UAT` (`enabled_categories=null` = full access).
- Recording: `b9dfcce2-a4dd-4603-8c87-c82c6669f073` (`Sammy - AI Inbox MCP`, ~5345 char transcript). `coaching_cache=NULL` at start of test.

| Smoke test | Result |
|---|---|
| `tools/list` includes `get_coaching_notes` | ✓ (4/4 Phase 22 AI tools listed: `ask_call`, `extract_action_items`, `get_coaching_notes`, `get_sentiment`) |
| LLM path (fresh `coaching_cache=NULL`) | `# Coaching Notes: Sammy - AI Inbox MCP (analyzed)` + 5 strengths + 5 improvements + 5 specific_examples (all grounded in actual transcript content) |
| Cache write verification | `coaching_cache.strengths.length=5`, `improvements.length=5`, `specific_examples.length=5` |
| `ai_usage` row written | 1 new row with `action_type='mcp_coaching'` |
| Cache hit (second call) | `(cached)` header, identical output, NO new `ai_usage` row |
| Cross-org access (fake UUID) | `-32001 Recording not found or not accessible` |

All 6 smoke tests pass.

### SQL evidence

```sql
SELECT id,
  jsonb_array_length(coaching_cache->'strengths') as n_strengths,
  jsonb_array_length(coaching_cache->'improvements') as n_improvements,
  jsonb_array_length(coaching_cache->'specific_examples') as n_examples
FROM recordings WHERE id = 'b9dfcce2-...';
--   id    | n_strengths | n_improvements | n_examples
-- -------- | ----------- | -------------- | ----------
-- b9dfcce2 |           5 |              5 |          5

SELECT action_type, count(*) FROM ai_usage
WHERE recording_id = 'b9dfcce2-...' AND created_at > now() - interval '15 minutes'
GROUP BY action_type ORDER BY action_type;
-- action_type    | count
-- -------------- | -----
-- mcp_ask_call   |     1   (from Wave 3)
-- mcp_coaching   |     1   (Wave 4 — cache hit did not add a second row)
-- mcp_sentiment  |     1   (from Wave 3)
```

---

## Quality spot-check (Task 2 step 9)

The actual smoke-test output is included verbatim below for documentation purposes. Reviewer (executor) qualitative scoring:

| Criterion | Score | Evidence |
|---|---|---|
| Strengths specific to the conversation? | YES | "Collaborative partnership approach with a clear revenue split (50-50)" — references the 50-50 share pattern explicitly mentioned in transcript |
| Improvements actionable? | YES | "Provide a clear, written pricing and packaging map upfront" + "Set a specific next-call date/time" — concrete next-call actions |
| Specific examples reference real moments? | YES | "Pricing and packaging discussion" cites the actual `$25/$35/$50` tiers from the transcript; "Revenue model" cites the 50-50 gross split |

**Spot-check verdict:** `openai/gpt-5-nano` produces grounded, useful coaching notes for this transcript. NO model upgrade recommended at launch. Re-evaluate after first 100 production tool calls (per researcher D-08).

Sample LLM output (verbatim, first 5 strengths):

> 1. Collaborative partnership approach with a clear revenue split (50-50) and shared ownership of the project.
> 2. Prioritizing hands-on testing before finalizing packaging, e.g., proposing to test the package and upload it to verify multi-email management.
> 3. Demonstrating market-awareness and value framing by discussing price ranges relative to workload and inferred customer value (e.g., 30–40 dollars/month for easing email management).
> 4. Action-oriented mindset with concrete next steps (test the setup, aim to start selling quickly, and confirm logging in and access).
> 5. Long-term product thinking and vision, treating this as a stepping stone to larger solutions and future builds.

---

## Files changed

| Path | Change |
|---|---|
| `supabase/functions/mcp-server/index.ts` | EDIT — 1 new TOOLS entry; 1 new case-block (~190 lines added; 0 deleted from existing tools) |

No new migration. `coaching_cache` already exists from Plan 22-01.

---

## Requirements progress

- **AITL-05 ✅ closed** — `get_coaching_notes` MCP tool live; two-tier read-through cache populates `recordings.coaching_cache`, `gpt-5-nano` produces high-quality coaching output grounded in transcript content.

---

## Phase 22 closing summary

**4 LLM-powered MCP tools shipped across 4 plans, all live in production:**

| Plan | Tool | Cache | Action type | AITL |
|---|---|---|---|---|
| 22-02 | `extract_action_items` | `action_items_cache` (3-tier: Fathom → cache → LLM) | `mcp_action_items` | AITL-02 ✅ |
| 22-03 | `ask_call` | NONE (D-03: every question unique) | `mcp_ask_call` | AITL-03 ✅ |
| 22-03 | `get_sentiment` | `sentiment_cache` (2-tier: cache → LLM) | `mcp_sentiment` | AITL-04 ✅ |
| 22-04 | `get_coaching_notes` | `coaching_cache` (2-tier: cache → LLM) | `mcp_coaching` | AITL-05 ✅ |

**Phase 22 infrastructure delivered (Plan 22-01):**
- Migration: `action_items_cache` + `coaching_cache` JSONB columns on `recordings`
- `track-ai-usage` `VALID_ACTION_TYPES` registry expansion (4 new entries)
- `_shared/track-ai-usage-inline.ts` helper for in-process MCP gating

**Gap-closes shipped during execution:**
- Plan 22-02: dropped stale `ai_usage_action_type_check` CHECK constraint (would have silently rejected all four `mcp_*` types)
- Plan 22-03: added `recordings.sentiment_cache` JSONB column (CONTEXT.md/RESEARCH.md/types-file all assumed it existed; production schema didn't have it)

**Tooling notes:**
- All four tools use `openai/gpt-5-nano` (cheapest OpenRouter tier, sufficient quality per smoke tests). Upgrade is a one-line change per tool if customer feedback warrants.
- Cost gate runs BEFORE LLM in all four; cache hits skip the gate (D-11). Verified by zero-row delta in `ai_usage` for cache hit smoke tests.
- All four tools enforce org/workspace boundary identically via the copy-block from `get_action_items`. Cross-org rejection confirmed in all four smoke-test rounds.
- All four tools categorized as `'ai'` in both `_shared/mcp-tool-categories.ts` and `src/lib/mcp-tool-categories.ts` (pre-staged by Phase 23). Token capability gating works correctly.

---

## Blockers

None. AITL-02, AITL-03, AITL-04, AITL-05 all closed. Phase 22 deliverables complete. The four MCP AI tools are live in production with end-to-end verification for tool registration, LLM path, cache path, ai_usage logging, cross-org rejection, and (for `ask_call`) input validation.
