---
phase: 22-ai-tools
type: validation
status: complete
date: 2026-05-07
auditor: gsd-nyquist-auditor
---

# Phase 22 — Nyquist Validation

> Adversarial test coverage for Phase 22 (AI Tools — 4 LLM-powered MCP tools).
> All gaps closed; 100 behavioral assertions across 3 vitest files.

## Summary

| | |
|---|---|
| Gaps identified | 6 |
| Gaps filled | 6 |
| Gaps escalated | 0 |
| Test files created | 3 |
| Test assertions | 100 |
| Pass rate | 100/100 (100%) |
| Implementation modifications | 0 |

## Tests Created

| # | File | Type | Tests | Command |
|---|------|------|-------|---------|
| 1 | `supabase/functions/_shared/__tests__/track-ai-usage-inline.test.ts` | unit (behavioral) | 22 | `npx vitest run supabase/functions/_shared/__tests__/track-ai-usage-inline.test.ts` |
| 2 | `supabase/functions/mcp-server/__tests__/ai-tools-invariants.test.ts` | unit (static-behavioral) | 63 | `npx vitest run supabase/functions/mcp-server/__tests__/ai-tools-invariants.test.ts` |
| 3 | `supabase/functions/mcp-server/__tests__/track-ai-usage-registry.test.ts` | unit (static-behavioral) | 15 | `npx vitest run supabase/functions/mcp-server/__tests__/track-ai-usage-registry.test.ts` |

Combined run: `npx vitest run supabase/functions/_shared/__tests__/track-ai-usage-inline.test.ts supabase/functions/mcp-server/__tests__/ai-tools-invariants.test.ts supabase/functions/mcp-server/__tests__/track-ai-usage-registry.test.ts` — `Test Files 3 passed, Tests 100 passed`.

## Verification Map (per-requirement)

| Req | Behavior | Coverage Path | Test File | Status |
|---|---|---|---|---|
| AITL-02 | extract_action_items 3-tier read-through cache (Fathom → cache → LLM); cache hits skip enforceMcpAiUsage; LLM gated before generateObject; Zod schema {items: [{owner, action, due_date}]} | static-behavioral on case-block + helper unit tests | files 2, 1 | green |
| AITL-03 | ask_call no cache (D-03); 500-char question max; -32602 on empty/oversize; Q:/A: prefix; gated before generateText | static-behavioral on case-block | file 2 | green |
| AITL-04 | get_sentiment cached in recordings.sentiment_cache; schema {overall enum, talk_ratio[], key_moments[]}; cache hits return "(cached)"; cache check before gate | static-behavioral on case-block | file 2 | green |
| AITL-05 | get_coaching_notes cached in recordings.coaching_cache; schema {strengths[], improvements[], specific_examples[]}; gpt-5-nano model | static-behavioral on case-block | file 2 | green |
| D-09 | enforceMcpAiUsage validates action_type; checks plan tier; reads/writes ai_usage; -32001 on quota exceeded with upgrade URL | helper unit tests + registry tests | files 1, 3 | green |
| D-16 | Cross-org boundary on every AI tool (workspace_entries ownership before LLM) | parametric per-tool tests | file 2 | green |

## Gap Coverage Detail

### Gap 1 — `enforceMcpAiUsage` quota gate (D-09, D-10, D-11)

**Coverage:** 22 behavioral unit tests directly exercising the helper with a mock Supabase client.

| Behavior | Test |
|---|---|
| Free tier 25-call limit | "denies the call exactly at the 25-call limit" |
| Pro tier 1000-call limit | "denies pro at 1000 calls" |
| Team tier 5000-call limit + org pooling | "denies at team-tier 5000 limit" + "uses get_monthly_org_ai_usage RPC when team tier with orgId" |
| Pro-trial expiration logic | "treats expired pro-trial as free tier" + "treats canceled pro-trial as free tier" + "treats active trialing pro-trial as pro tier" |
| Quota message format | "quota message includes upgrade URL on every plan tier denial" — verifies `https://app.callvaultai.com/settings/billing`, `N/N`, and `<tier> plan` |
| Best-effort insert | "returns allowed=true even when ai_usage insert fails (best-effort write)" |
| Tier-specific RPC routing | "uses get_monthly_ai_usage RPC (per-user, NOT per-org)" + "does NOT pool by org for free tier" |
| Profile fetch error denies | "denies when profile fetch errors" |
| Membership error denies | "denies when team-tier membership check errors" |
| Default-to-free on null profile | "null profile (user with no row) defaults to free tier" |

### Gap 2 — `extract_action_items` AITL-02

**Coverage:** 9 static-behavioral assertions on the live case-block.

- Three-tier ordering verified: `source_metadata` line < `action_items_cache as` line < `enforceMcpAiUsage` line < `generateObject(` line
- Fathom fast-path returns `mcpOk` without writing cache or calling gate
- Cache-tier-2 returns `mcpOk` without writing cache or calling gate
- LLM tier writes `action_items_cache` (best-effort)
- Zod schema fields validated: `items`, `owner`, `action`, `due_date`
- Action type used exactly once: `mcp_action_items`
- Cross-org rejected with -32001 + correct error message

### Gap 3 — `ask_call` AITL-03

**Coverage:** 11 static-behavioral assertions on the live case-block.

- No cache columns touched (D-03)
- Empty question rejected with -32602
- Question >500 chars rejected with -32602
- Response prefixed with `Q: ${question}\nA: ${answer}`
- Uses `generateText` not `generateObject`
- Gate runs before LLM call
- Workspace ownership checked before LLM
- System prompt grounds in transcript ("cannot be answered from the transcript", "Do not speculate")
- Missing transcript fails fast with -32602

### Gap 4 — `get_sentiment` AITL-04

**Coverage:** 10 static-behavioral assertions on the live case-block.

- `sentiment_cache` read BEFORE `enforceMcpAiUsage` (D-11)
- Gate before `generateObject`
- Cache write after successful LLM
- Zod enum: `['positive', 'neutral', 'negative', 'mixed']`
- Schema includes `talk_ratio` with `speaker_name` + `percentage` (0-100)
- Schema includes `key_moments` with `timestamp` + `sentiment` + `snippet`
- Cache hit returns `(cached)` header
- LLM path returns `(analyzed)` header
- Cache shape validation rejects malformed cache (Array.isArray on talk_ratio AND key_moments)

### Gap 5 — `get_coaching_notes` AITL-05

**Coverage:** 10 static-behavioral assertions on the live case-block.

- `coaching_cache` read BEFORE gate
- Gate before LLM
- Cache write after success
- Zod schema: `strengths: z.array(z.string())`, `improvements: z.array(z.string())`, `specific_examples` with `topic`/`observation`/`suggestion`
- Cache shape validation: Array.isArray on all 3 top-level fields
- `(cached)` and `(analyzed)` header markers
- Default model `openai/gpt-5-nano` (D-08 — researcher decision)

### Gap 6 — Cross-org boundary (D-16)

**Coverage:** 12 parametric assertions across all 4 AI tools.

- `from('workspace_entries')` line precedes the LLM call line in every tool
- Every tool emits `-32001` with `Recording not found or not accessible` on ownership failure
- Every tool handles both `mcpToken.scope === 'workspace'` and `organization` branches via `fetchOrgWorkspaceIds`

## Coverage Caveats

**WARNING — static-behavioral coverage:** The four AI-tool case-blocks live inside the `Deno.serve` handler in `mcp-server/index.ts` and use `https://esm.sh/...` Deno-style imports. They cannot be imported into a Node/vitest runtime as standalone callables. File 2 (`ai-tools-invariants.test.ts`) therefore parses the source text and asserts that each contractual invariant — cache-before-gate, gate-before-LLM, ownership-before-LLM, schema shape, action_type, model, error codes — appears at the correct relative source position. This is stronger than a regex grep (it parses the case-block via brace-balanced extraction) but weaker than a true dynamic test. The helper itself (`enforceMcpAiUsage`) IS dynamically tested (file 1, 22 unit tests).

**Live runtime coverage** is provided by 22-UAT.md (8/8 manual + smoke-test passes including production curl + SQL evidence for cache writes, ai_usage inserts, cross-org rejection, and quota exhaustion).

## Test Infrastructure Notes

- Framework: vitest@4.0.16
- Test files placed under `supabase/functions/<area>/__tests__/` per existing convention (matches `youtube-api/__tests__/youtube-api-regression.test.ts`, `fetch-meetings/__tests__/rate-limit.test.ts`)
- Helper (`track-ai-usage-inline.ts`) imports zero external modules and accepts `supabase` as a parameter — directly importable from vitest
- Mock Supabase client: chainable builder mirroring `.from(table).select(cols).eq(col,val).maybeSingle()` and `.rpc(name,params)` and `.from(ai_usage).insert(row)`
- No real network/LLM calls in any test
- No Supabase project required to run

## Files for Commit

```
supabase/functions/_shared/__tests__/track-ai-usage-inline.test.ts
supabase/functions/mcp-server/__tests__/ai-tools-invariants.test.ts
supabase/functions/mcp-server/__tests__/track-ai-usage-registry.test.ts
.planning/phases/22-ai-tools/22-VALIDATION.md
```

## Escalations

None. All 6 gaps closed via tests that pass cleanly. No implementation defects discovered during audit.
