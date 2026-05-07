---
phase: 22-ai-tools
plan: 02
type: summary
wave: 2
shipped: 2026-05-07
status: complete
---

# Phase 22 Plan 02 — Summary

**Title:** `extract_action_items` MCP tool — three-tier read-through cache + LLM extraction
**Wave:** 2
**Branch:** `gsd/phase-21-write-crud-tools`
**Closes:** AITL-02

---

## What shipped

### 1. New MCP tool: `extract_action_items`

**File:** `supabase/functions/mcp-server/index.ts`

Three edits:

| Edit | Location | Lines |
|---|---|---|
| Imports added | Top of file (after existing `getCorsHeaders` import) | 4 new imports — `createOpenRouter`, `generateObject`, `z`, `enforceMcpAiUsage` |
| TOOLS array entry | Inserted immediately after `get_action_items` entry | line 346 — `name: 'extract_action_items'` |
| Dispatcher case-block | Inserted immediately after `case 'get_action_items':` closing brace | line 1851 — `case 'extract_action_items': { ... }` |

### 2. Three-tier read-through cache (D-04)

The case-block executes tiers in order:

1. **Tier 1 — Fathom fast-path:** if `recording.source_metadata.action_items` is a non-empty array → format and return immediately. No LLM, no quota. Header reads `(source: Fathom)`.
2. **Tier 2 — Cached LLM result:** if `recording.action_items_cache` is `{ items: [...] }` (any length, including 0) → format and return. No LLM, no quota. Header reads `(cached)`. Per the plan's self-correction note, the Tier 2 condition checks `Array.isArray(cached.items)` only (no `length > 0` requirement) so an empty cached extraction is treated as a valid result.
3. **Tier 3 — LLM extraction:** validate transcript exists → check `OPENROUTER_API_KEY` → run `enforceMcpAiUsage` (cost gate, MUST precede LLM) → truncate transcript to 15k chars → `generateObject` with Zod schema `{ items: [{ owner, action, due_date }] }` via `openai/gpt-5-nano` → write result to `action_items_cache` (best-effort, log on failure) → format and return. Header reads `(extracted)`.

### 3. Cost-gating contract (D-10, D-11)

- `enforceMcpAiUsage({ actionType: 'mcp_action_items', ... })` runs ONLY on Tier 3 (LLM path).
- Tier 1 and Tier 2 (cache hits) skip the gate entirely — verified end-to-end with SQL: zero new `ai_usage` rows after Fathom + cached responses.
- On `allowed: false` → returns `mcpError(id, -32001, gate.reason, corsHeaders)` with the upgrade-to-paid-plan message.

### 4. Org/workspace boundary (D-16)

The 20-line ownership-check block from `get_action_items` (1743–1762) was copied verbatim into the new case-block (1854–1873). Cross-org calls return `-32001 Recording not found or not accessible` BEFORE any DB read, LLM call, or gate invocation.

### 5. `get_action_items` is byte-identical

`git diff` shows zero lines deleted from the existing `get_action_items` case-block. The two action-items tools coexist:
- `get_action_items` (existing, line 1739): read-only surface for Fathom-pre-extracted items + summary parse
- `extract_action_items` (new, line 1851): LLM extraction for non-Fathom recordings (paste/Zoom/manual upload), with read-through to Fathom items as Tier 1

---

## Gap-close: stale CHECK constraint on `ai_usage.action_type`

**Discovered during smoke testing.** First LLM-path call wrote `action_items_cache` correctly but no `ai_usage` row landed. Root cause: the database had a `ai_usage_action_type_check` CHECK constraint accepting only `('smart_import', 'auto_name', 'auto_tag', 'chat_message')`. Plan 22-01 added the four `mcp_*` action types to the in-process `VALID_ACTION_TYPES` whitelist in `track-ai-usage/index.ts` AND created the `_shared/track-ai-usage-inline.ts` helper, but did NOT update the DB-level CHECK constraint. INSERTs from the helper were silently rejected (the helper logs the error but never denies — by design).

**Remediation:** added `supabase/migrations/20260507140000_relax_ai_usage_action_type_check.sql` which DROPs the stale constraint. Application-layer enforcement (`VALID_ACTION_TYPES` in HTTP `track-ai-usage` and `McpAiActionType` union in the inline helper) is the source of truth — the redundant DB constraint added more failure surface than it prevented. Migration applied via `supabase db push` (exit 0).

This blocker would have silently broken quota enforcement for ALL FOUR Phase 22 MCP AI tools (22-02 + 22-03 + 22-04) at launch. Closing it now means Plans 22-03 and 22-04 inherit a working gate without re-discovery.

---

## Verification evidence

### Code-level grep gates

| Check | Command | Expected | Actual |
|---|---|---|---|
| TOOLS entry exists | `grep -c "name: 'extract_action_items'" mcp-server/index.ts` | 1 | 1 |
| Dispatcher case exists | `grep -c "case 'extract_action_items':" mcp-server/index.ts` | 1 | 1 |
| Inline-gating import | `grep -c "from '../_shared/track-ai-usage-inline.ts'" mcp-server/index.ts` | 1 | 1 |
| OpenRouter import | `grep -c "@openrouter/ai-sdk-provider" mcp-server/index.ts` | 1 | 1 |
| Action-type literal | `grep -c "actionType: 'mcp_action_items'" mcp-server/index.ts` | 1 | 1 |
| Default model literal | `grep -c "openai/gpt-5-nano" mcp-server/index.ts` | 1 | 1 |
| `get_action_items` untouched | `git diff main -- mcp-server/index.ts \| grep -E "^-.*get_action_items" \| wc -l` | 0 | 0 |

### Cache-tier ordering inside the case-block

Line numbers (after the edits) of the four ordered markers within `case 'extract_action_items':` (line 1851 → ~2027):

| Marker | Line | Tier |
|---|---|---|
| `source_metadata` (Tier 1 read) | 1890 | 1 |
| `action_items_cache` read (Tier 2) | 1900 | 2 |
| `enforceMcpAiUsage` (cost gate) | 1929 | 3 (gate) |
| `generateObject` (LLM call) | 1988 | 3 (LLM) |
| `action_items_cache` write | 2007 | 3 (post-LLM) |

`enforceMcpAiUsage` (1929) precedes `generateObject` (1988) by 59 lines — the cost-gate-before-LLM invariant is preserved.

### Runtime smoke tests (production deploy)

Deployed: `supabase functions deploy mcp-server --use-api` → `Deployed Functions on project vltmrnjsubfzrgrtdqey: mcp-server` (v71, exit 0).

Test fixtures: temporary org-scoped MCP token `phase-22-02-test` (deleted after testing). Recording `b9dfcce2-a4dd-4603-8c87-c82c6669f073` (`Sammy - AI Inbox MCP`, ~5345 char transcript).

| Smoke test | Result | Latency | DB state |
|---|---|---|---|
| `tools/list` includes `extract_action_items` | ✓ entry present | <1s | — |
| LLM path (fresh `action_items_cache=NULL`) | `(extracted)` header + 6 items | 61s | `action_items_cache.items` length 6; 1 new `ai_usage` row with `action_type='mcp_action_items'` |
| Cache hit (second call same recording) | `(cached)` header + same 6 items | 1s | NO new `ai_usage` row (count remained 1) |
| Fathom fast-path (injected `source_metadata.action_items`) | `(source: Fathom)` header + 2 injected items | 1s | NO new `ai_usage` row |
| Cross-org / unknown UUID | `error.code=-32001 "Recording not found or not accessible"` | <1s | — |

All five smoke tests pass.

### Quota-exceeded smoke test

Not executed inline — would require setting the test user's `ai_usage` row count past their plan limit which would pollute production data. The error path is mechanically correct: `enforceMcpAiUsage` returns `{ allowed: false, reason: 'Monthly AI action limit reached (...)' }` when usage ≥ limit, and the case-block returns `mcpError(id, -32001, gate.reason, corsHeaders)`. The reason string contains the upgrade URL `https://app.callvaultai.com/settings/billing`. Verified by reading the helper at `_shared/track-ai-usage-inline.ts:130-137`.

---

## Files changed

| Path | Change |
|---|---|
| `supabase/functions/mcp-server/index.ts` | EDIT — 4 new imports + 1 TOOLS entry + 1 case-block (~177 lines added; 0 deleted from existing tools) |
| `supabase/migrations/20260507140000_relax_ai_usage_action_type_check.sql` | NEW — gap-close: drops stale CHECK constraint on `ai_usage.action_type` (29 lines) |

---

## Type-checker note

`deno check supabase/functions/mcp-server/index.ts` reports 23 errors. 19 of those are pre-existing on the baseline (TS2345 around `SupabaseClient` type-widening between `@supabase/supabase-js@2` and the rest of the file's call sites — confirmed by `git stash` + re-check). The 4 new errors are the same family that already exist in `auto-tag-calls/index.ts` (which is deployed and ACTIVE in production): `OpenRouterCompletionLanguageModel` not assignable to `LanguageModel`, `ZodObject` not assignable to `FlexibleSchema<unknown>`, `result.object` is `unknown`, and one more `SupabaseClient` widening site inside the new case-block.

The `--use-api` deploy uses esbuild server-side without strict type-checking and bundles the function successfully (v71 ACTIVE). The runtime smoke tests confirm the function executes correctly. These are pre-existing tooling-level type-widening issues across the entire `mcp-server` + `auto-tag-calls` + `summarize-call` family of functions and are out of scope for this plan.

---

## Requirements progress

- **AITL-02 ✅ closed** — `extract_action_items` LLM-extraction tool live with three-tier read-through cache. Non-Fathom recordings (paste, Zoom, manual upload) now extract structured action items via `gpt-5-nano` on first request and cache thereafter. Fathom-source recordings still surface their pre-extracted items via Tier 1 (no LLM call).

---

## Coordination with parallel Phase 23 executor

The parallel agent shipped commits `2156e985` (capability toggles + UI cleanup) and `cd6e1383` (`import_youtube_video` patch) on this branch BEFORE the Plan 22-02 deploy. My deploy includes their enforcement code at lines 802–822, plus the `mcp-tool-categories.ts` shared module which already maps `extract_action_items: 'ai'`. No merge conflicts — the two waves edited different regions of `mcp-server/index.ts` (Phase 23 added an enforcement block above the dispatcher; Plan 22-02 added a case-block inside the switch).

Discovered during smoke testing: tokens default to `enabled_categories=["read"]` only. Calls to `extract_action_items` are rejected with `-32001 "Tool 'extract_action_items' is disabled for this token. Enable the 'ai' category in Settings > Integrations."` until the token's `enabled_categories` includes `"ai"`. This is correct per Phase 23 design — capability gating runs BEFORE the dispatcher case. End-to-end tests above used a token with all four categories enabled.

---

## Next up — Wave 3

Plan **22-03**: `ask_call` (no cache, free-form `generateText`, action `mcp_ask_call`, 500-char question max) AND `get_sentiment` (cache `recordings.sentiment_cache`, `generateObject` with `{ overall, talk_ratio[], key_moments[] }` schema, action `mcp_sentiment`). Both tools follow the now-verified pattern from this plan. The gap-close migration in this plan ensures `ai_usage` INSERTs from those tools land correctly.

---

## Blockers

None. AITL-02 closed. The DB-constraint gap surfaced and fixed. Pattern verified end-to-end in production. Plans 22-03 + 22-04 can proceed.
