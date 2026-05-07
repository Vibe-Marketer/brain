---
phase: 22-ai-tools
type: research
gathered: 2026-05-07
status: complete
---

# Phase 22: AI Tools — Technical Research

> Locked decisions live in [22-CONTEXT.md](./22-CONTEXT.md) (D-01..D-18). This file documents the implementation rails, library deltas, and risk pre-mitigation needed to plan four LLM-powered MCP tools on top of the existing `mcp-server` edge function.

## RESEARCH COMPLETE

## Phase Goal Restated

Users' MCP clients can invoke LLM-powered analysis on any call recording via four new MCP tools:

1. `extract_action_items` — read-through cache + LLM extraction (Zod-structured)
2. `ask_call` — free-form Q&A grounded in transcript (no cache)
3. `get_sentiment` — sentiment + talk-ratio + key moments (cached)
4. `get_coaching_notes` — sales coaching report (cached)

All tools land as new `case` blocks inside `supabase/functions/mcp-server/index.ts`.

## Standard Stack (locked, no decision needed)

| Concern | Library / Pattern | Source |
|---|---|---|
| Edge runtime | Deno (Supabase Functions) | `supabase/functions/*/index.ts` |
| LLM gateway | OpenRouter via Vercel AI SDK | `@openrouter/ai-sdk-provider@1.2.8` + `ai@5.0.102` |
| Default model | `openai/gpt-5-nano` | `summarize-call`, `auto-tag-calls` precedent |
| Structured output | `generateObject` + Zod schema | `auto-tag-calls/index.ts:541` analog |
| Free-form output | `generateText` | `summarize-call/index.ts:64` analog |
| DB cache columns | JSONB on `recordings` | existing `summary` (TEXT), `sentiment_cache` (JSONB) |
| Cost gating | `track-ai-usage` POST → 429 on limit | `track-ai-usage/index.ts:29` `VALID_ACTION_TYPES` |
| Org/workspace boundary | `mcpToken.scope` branch + `fetchOrgWorkspaceIds()` + `workspace_entries` ownership check | `mcp-server/index.ts:1729-1748` (`get_action_items` case) |
| Response envelope | `mcpOk(id, text)` / `mcpError(id, code, msg, corsHeaders)` | `mcp-server/index.ts:93,109` |
| Tracing | `startTrace` / `flushLangfuse` from `_shared/langfuse.ts` | optional but consistent with `summarize-call`, `auto-tag-calls` |

**No new external libraries are introduced.** Every dependency is already pinned in `summarize-call/index.ts` and `auto-tag-calls/index.ts`.

## Architectural Responsibility Map

| Tier | Responsibility | Files |
|---|---|---|
| Edge function (mcp-server) | JSON-RPC dispatch, auth, org boundary, cache lookup, LLM orchestration, response shaping | `supabase/functions/mcp-server/index.ts` |
| Edge function (track-ai-usage) | Plan-tier check, monthly quota enforcement, action-type whitelist | `supabase/functions/track-ai-usage/index.ts` |
| Database (Postgres) | Per-tool JSONB cache columns on `recordings`; existing RLS policies cover new columns | `supabase/migrations/*_add_ai_cache_columns.sql` (Plan 01) |
| LLM provider (OpenRouter) | Model serving + token-cost billing | `OPENROUTER_API_KEY` env var (already wired) |

No new tier introduced. No frontend impact in Phase 22 (per-tool toggles are deferred to Phase 23).

## Reference Code Excerpts (for the planner & executors)

### Read-through cache pattern (analog: `summarize-call/index.ts:271-298`)

```typescript
// Check if we already have a summary
if (!force_refresh && currentSummary) {
  return new Response(
    JSON.stringify({ success: true, recording_id, summary: currentSummary, cached: true }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
// ... LLM call ...
// Store the summary back
await supabase.from('recordings').update({ summary }).eq('id', recording_id);
```

For Phase 22 tools the cache lookup happens BEFORE `track-ai-usage` (D-11: cached returns do not consume quota).

### Structured-extraction pattern (analog: `auto-tag-calls/index.ts:541-548`)

```typescript
const TagSchema = z.object({
  tag: z.enum(APPROVED_TAGS),
  confidence: z.number().min(0).max(100),
  reasoning: z.string(),
});

const result = await generateObject({
  model: openrouter('openai/gpt-5-nano'),
  schema: TagSchema,
  prompt: tagPrompt,
});
const { tag, confidence, reasoning } = result.object;
```

Used for `extract_action_items`, `get_sentiment`, `get_coaching_notes`.

### Free-form pattern (analog: `summarize-call/index.ts:64`)

```typescript
const result = await generateText({
  model: openrouter('openai/gpt-5-nano'),
  prompt: longPrompt,
  maxTokens: 1000,
});
return result.text;
```

Used for `ask_call`. We add a `system` parameter for grounding instructions.

### Org/workspace boundary (copy verbatim from `get_action_items` case)

```typescript
// Verify access
if (mcpToken.scope === 'workspace') {
  const { data: access } = await supabase
    .from('workspace_entries')
    .select('recording_id')
    .eq('recording_id', recordingId)
    .eq('workspace_id', mcpToken.workspace_id!)
    .maybeSingle();
  if (!access) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
} else {
  const { ids: orgWsIds, error: wsErr } = await fetchOrgWorkspaceIds(supabase, mcpToken.org_id!);
  if (wsErr || !orgWsIds || orgWsIds.length === 0) return mcpError(id, -32001, '...', corsHeaders);
  const { data: access } = await supabase
    .from('workspace_entries')
    .select('recording_id')
    .eq('recording_id', recordingId)
    .in('workspace_id', orgWsIds)
    .maybeSingle();
  if (!access) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
}
```

This block is identical for all four tools — D-16.

### Cost-gating wrapper (new pattern, Phase 22 introduces it for MCP)

```typescript
// Before LLM call:
const usageResp = await fetch(
  `${supabaseUrl}/functions/v1/track-ai-usage`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${userJwt}`,  // service-token JWT scoped to mcpToken.user_id
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      actionType: 'mcp_action_items',
      recordingId,
      orgId: mcpToken.org_id,
    }),
  },
);

if (usageResp.status === 429) {
  const errBody = await usageResp.json();
  return mcpError(
    id,
    -32001,
    `Monthly AI action limit reached (${errBody.usage}/${errBody.limit}, ${errBody.tier} plan). Upgrade at https://app.callvaultai.com/settings/billing.`,
    corsHeaders,
  );
}
```

**Key research finding — JWT minting for `track-ai-usage`:** `track-ai-usage` requires a Supabase JWT (`auth.getUser(token)` at line 84). MCP tokens are NOT Supabase JWTs. The MCP server already uses the service-role client (line 12, `createClient(supabaseUrl, supabaseServiceKey)`) and resolves the user via `mcpToken.user_id`. To call `track-ai-usage` we have two viable approaches — both already used elsewhere in the codebase:

**Option A (recommended): inline tier check + insert** — replicate `track-ai-usage`'s 6-step logic directly inside the mcp-server case handler using the service-role client. Avoids cross-function HTTP, avoids JWT minting, and keeps the dispatch synchronous. Requires copying ~50 LOC of tier-derivation + RPC-call + insert logic. Pattern already lives at `track-ai-usage/index.ts:114-218`.

**Option B: mint a short-lived JWT for the user via `supabase.auth.admin.generateLink` or service-role JWT impersonation** — more code, more failure surface, no benefit.

Plan 01 will introduce a small `_shared/track-ai-usage-inline.ts` helper that both encapsulates Option A and is called from each new MCP tool case (D-10). This keeps the registry update in `track-ai-usage/index.ts` (since that file is also called by frontend services) AND gives mcp-server a synchronous gating function. Plans 02/03/04 import the helper.

### Per-tool JSONB cache update (analog: `summarize-call/index.ts:330-344`)

```typescript
const { error: updateError } = await supabase
  .from('recordings')
  .update({ action_items_cache: result.object })
  .eq('id', recordingId);
if (updateError) console.error('Failed to store action_items_cache:', updateError);
```

The error is logged but does NOT fail the tool response — the LLM result is still returned. Cache write is best-effort.

## Standard Stack — Library Versions

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createOpenRouter } from 'https://esm.sh/@openrouter/ai-sdk-provider@1.2.8';
import { generateObject, generateText } from 'https://esm.sh/ai@5.0.102';
import { z } from 'https://esm.sh/zod@3.23.8';
```

These imports are present in `summarize-call` and `auto-tag-calls` already; new tool case-blocks reuse them.

## Architectural Patterns (locked, do not deviate)

1. **Per-tool JSONB cache columns on `recordings`** (D-02). Migration adds `action_items_cache` and `coaching_cache`. `sentiment_cache` already exists.
2. **Read-through three-tier cache for `extract_action_items`** (D-04): `source_metadata.action_items` → `action_items_cache` → LLM. Other tools have two-tier (cache → LLM).
3. **`ask_call` does not cache** (D-03). Every question is unique by construction.
4. **Action-type registry expansion** (D-09): `track-ai-usage` `VALID_ACTION_TYPES` gets four new entries: `mcp_action_items`, `mcp_ask_call`, `mcp_sentiment`, `mcp_coaching`.
5. **Cost gating ALWAYS precedes LLM call, NEVER cache hit** (D-11). Cache hits return immediately, no quota consumed.
6. **Org/workspace boundary** (D-16): every new case-block runs the exact same `mcpToken.scope` branch + `fetchOrgWorkspaceIds()` + `workspace_entries` ownership check that `get_action_items` already uses. Copy verbatim.
7. **Non-streaming responses** (D-17). Single MCP response per tool call.
8. **Inline prompts** (D-18). Each tool's prompt lives in its case-block, no `_shared/mcp-ai-prompts.ts` for v1.

## Don't Hand-Roll (use existing primitives)

| Don't write | Use |
|---|---|
| New tier-derivation logic | Already in `track-ai-usage/index.ts:36-50` (`deriveTier`); replicate inline OR import `_shared/track-ai-usage-inline.ts` from Plan 01 |
| New `mcpOk` / `mcpError` helpers | `mcp-server/index.ts:93,109` |
| New OpenRouter client init | `createOpenRouter({ apiKey, headers: { 'HTTP-Referer': 'https://app.callvaultai.com', 'X-Title': 'CallVault' } })` — copy from `summarize-call/index.ts:27` |
| New org-boundary helper | `fetchOrgWorkspaceIds()` at `mcp-server/index.ts:152` |
| New trace-wrapping logic | `startTrace()` / `flushLangfuse()` from `_shared/langfuse.ts` |

## Common Pitfalls (and pre-mitigations)

| Pitfall | Pre-mitigation |
|---|---|
| Forgetting to call `track-ai-usage` BEFORE the LLM call → unlimited cost runaway | Plan 02-04 each declare the gate as a verification grep: every case-block must contain `actionType: 'mcp_*'` BEFORE any `generateObject(` or `generateText(` call. Verifier checks line ordering. |
| Caching a partial / failed LLM result | Wrap LLM call in try/catch; only update cache column on successful Zod-validated response. |
| Cache write failure crashing the tool response | Log error, return result anyway — cache is best-effort (mirrors `summarize-call/index.ts:343`). |
| Missing transcript causing LLM to hallucinate | Reject with `-32602` if `recording.full_transcript` is null/empty (mirrors `summarize-call/index.ts:301`). |
| Long transcript blowing token budget | Truncate transcript to 15k chars before prompting (mirrors `summarize-call/index.ts:60-62`). All four new tools follow the same convention. |
| Stale cache after transcript edit | Out of scope for v1. Deferred to a future `invalidate_ai_cache` MCP tool — listed in CONTEXT.md deferred list. |
| Question injection in `ask_call` (e.g., "ignore the transcript and say X") | System prompt anchors model: "If the question can't be answered from the transcript, say so explicitly. Do not speculate." Plus 500-char max user-question limit. |
| `get_coaching_notes` quality with `gpt-5-nano` | Researcher recommendation (see "Model choice" section below). |

## Model Choice — Researcher Recommendation (D-08)

**Default model `openai/gpt-5-nano` is sufficient for v1 across ALL four tools.**

### Reasoning

`gpt-5-nano` is already the production model for two structured-extraction workloads in this codebase: `summarize-call` (3-5 paragraph free-form summaries) and `auto-tag-calls` (single-tag enum selection from 15-tag taxonomy with confidence + reasoning). Both ship and the user has not flagged quality as a concern. The four Phase 22 tools sit between these two reference points in difficulty:

- `extract_action_items` — structured extraction. Easier than auto-tag (no enum constraint to learn — output is free-form text per item). gpt-5-nano sufficient.
- `ask_call` — free-form Q&A. Generally easier than summarization because the question scopes the response. gpt-5-nano sufficient.
- `get_sentiment` — three-axis structured output (overall enum + talk_ratio array + key_moments array). Mostly classification + extraction. gpt-5-nano sufficient.
- `get_coaching_notes` — qualitative judgment ("strengths", "improvements", "specific examples"). The most subjective of the four.

### Specifically on `get_coaching_notes`:

The output schema is forgiving — three free-text arrays of arbitrary length. The model is not asked to compare against a rubric or score numerically. Coaching notes from `gpt-5-nano` should be readable and useful even if not state-of-the-art. **No concrete quality evidence at this point that `gpt-5-nano` produces unusable coaching output.** Plan 04 ships with `openai/gpt-5-nano` as the default.

### When to upgrade (post-launch monitoring)

Reserve `anthropic/claude-haiku-4-5` or `openai/gpt-4o-mini` as escalation paths IF customer feedback indicates:
- Coaching notes feel generic or wrong
- Coaching notes hallucinate transcript content
- Sentiment misclassifies obvious-tone calls

Per D-07 the model is hardcoded in the case handler, so an upgrade is a one-line code change. Phase 23 management UI may eventually expose a per-org override.

### Decision

Plan 04 (`get_coaching_notes`) ships with `openai/gpt-5-nano`. Reasoning above. Re-evaluate after first 100 production tool calls if customer feedback warrants.

## Validation Architecture

> Triggers `5.5 Validation Strategy` step in plan-phase orchestrator.

The four AI tools are validated end-to-end through three loops:

1. **Code-level grep gates** (per plan, in `<verify>` blocks):
   - Every new case-block contains the specific action-type string (`mcp_action_items`, etc.)
   - Every case-block contains a `track-ai-usage` invocation BEFORE any `generateObject(` / `generateText(`
   - Every case-block contains the org-boundary copy from `get_action_items`
   - Cache lookup happens BEFORE `track-ai-usage` (cache hits don't consume quota)

2. **Runtime smoke test** (per plan): deploy with `supabase functions deploy mcp-server --use-api`, then `curl` the JSON-RPC endpoint for `tools/list` and confirm the four new tool entries appear. Then `curl` each tool with a real recording_id and confirm structured response.

3. **End-to-end MCP client test** (Phase-level): from Claude Desktop, invoke each new tool against a known recording and confirm:
   - First call: cache miss → LLM call → response → cache populated (verify via SQL `select action_items_cache from recordings where id=...`)
   - Second call: cache hit → response in <500ms (no LLM latency)
   - Cross-org access: rejected with `-32001`
   - Quota exceeded (free-tier user past 25/month): rejected with `-32001` + upgrade message

## Phase Dependencies

| Depends on | Why |
|---|---|
| Phase 19 (provisioning foundation) | All tool calls inherit plan-gating chain. AI tools get gating "for free" — every MCP request already passes through the plan check before reaching the tool dispatcher. |
| Phase 20 (read CRUD tools) | Reuses `mcpOk`, `mcpError`, `fetchOrgWorkspaceIds`, error-code conventions, tool-definition shape. No new infrastructure. |
| Existing `summarize-call` | Cache-pattern reference. NOT extended — `summarize_call` MCP tool was DROPPED 2026-05-07 (in-app feature stays). |
| Existing `auto-tag-calls` | `generateObject` + Zod analog. |

## Out of Scope (cross-references CONTEXT.md `<deferred>`)

- Streaming AI responses
- User-configurable models per tool (Phase 23)
- Prompt versioning / hot-reload
- `summarize_call` as MCP tool (DROPPED)
- Cache invalidation tools (`invalidate_ai_cache`)
- Per-org dollar caps (separate from per-user-tier monthly counts)
- Action-item write-back to `source_metadata`
- Per-token MCP tool toggles (Phase 23)

## Phase 22 Plan Inventory (per CONTEXT.md `<decisions>`)

| Plan | Wave | Depends on | Scope |
|---|---|---|---|
| 22-01 | 1 | — | Migration: add `action_items_cache` + `coaching_cache` JSONB columns on `recordings`. Update `track-ai-usage` `VALID_ACTION_TYPES` (4 new entries). Add `_shared/track-ai-usage-inline.ts` helper for in-process tier check + quota enforcement. Deploy `track-ai-usage`. |
| 22-02 | 2 | 22-01 | Implement `extract_action_items` MCP tool. Read-through cache: `source_metadata.action_items` → `action_items_cache` → LLM. `generateObject` with Zod `{items: Array<{owner, action, due_date}>}`. Action type `mcp_action_items`. |
| 22-03 | 2 | 22-01 | Implement `ask_call` (no cache, free-form `generateText`, action `mcp_ask_call`, 500-char question max) AND `get_sentiment` (cache `sentiment_cache`, `generateObject` schema `{overall, talk_ratio[], key_moments[]}`, action `mcp_sentiment`). Two tools in one plan because they share infrastructure and are independent of each other. |
| 22-04 | 2 | 22-01 | Implement `get_coaching_notes` MCP tool. `generateObject` Zod schema `{strengths[], improvements[], specific_examples[]}`. Cache `coaching_cache`. Action `mcp_coaching`. Default model `openai/gpt-5-nano` (researcher recommendation — no upgrade needed at launch). |

Plans 22-02..22-04 share `mcp-server/index.ts` as a write target. Per the wave ordering rules in `gsd-planner.md` (`files_modified` overlap → sequential waves), the planner has two valid options:

- **Option X — split 22-02..04 across waves 2/3/4 sequentially.** Cleanest dependency graph, no merge conflicts.
- **Option Y — declare 22-02..04 in wave 2 and serialize via "no two plans touching mcp-server/index.ts may run in the same execution slot" runtime rule.** Saves one wave but relies on execute-phase semaphore.

**Recommendation: Option X (sequential waves).** Each tool case-block lands at a different line in `mcp-server/index.ts` but they all touch the `case` switch and the `tools/list` array. Sequential application avoids any risk of merge conflict from parallel executors. Adds ~5 minutes total. Worth it.

> Final wave assignment is the planner's prerogative. CONTEXT.md says "parallelizable after 22-01 lands"; this research recommends sequential for safety. Planner can defer to runtime semaphore if desired.

## Acceptance — what "done" looks like for Phase 22

- 4 new tool entries in `tools/list` JSON-RPC response
- 4 new `case` blocks in mcp-server dispatcher
- All 4 enforce org/workspace boundary identically
- All 4 invoke `track-ai-usage` (or inline equivalent) BEFORE LLM call
- 3 of 4 (`extract_action_items`, `get_sentiment`, `get_coaching_notes`) cache results in `recordings` JSONB columns
- 1 of 4 (`extract_action_items`) reads `source_metadata.action_items` first as a Fathom fast-path
- All 4 return formatted plain-text via `mcpOk()`
- Migration adds 2 new columns (no constraints — opaque JSONB)
- `track-ai-usage` registry expanded by 4 entries
- All 4 tools tested via Claude Desktop with a real Fathom recording
- All 4 tools reject cross-org access with `-32001`
- All 4 tools reject quota-exceeded with `-32001` + upgrade message

---

*Research complete. Planner may proceed.*
