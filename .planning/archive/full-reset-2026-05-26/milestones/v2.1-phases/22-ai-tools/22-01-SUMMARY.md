---
phase: 22-ai-tools
plan: 01
type: summary
wave: 1
shipped: 2026-05-07
status: complete
---

# Phase 22 Plan 01 — Summary

**Title:** Migration + cost-gating registry + in-process MCP gating helper
**Wave:** 1 (foundation for Plans 22-02..22-04)
**Branch:** `gsd/phase-21-write-crud-tools` (Phase 22 work continues on the MCP-infrastructure branch per execute-phase orchestrator instruction)

---

## What shipped

### 1. Migration: two new JSONB cache columns on `recordings`

**File:** `supabase/migrations/20260507120001_add_ai_cache_columns.sql`

> Filename uses `120001` (not `120000` per the original plan template) because `20260507120000_recordings_paste_columns.sql` already existed in the migrations directory — the new file's prefix MUST be strictly greater than the latest existing migration (per plan task 1's note).

```sql
ALTER TABLE recordings
  ADD COLUMN IF NOT EXISTS action_items_cache JSONB,
  ADD COLUMN IF NOT EXISTS coaching_cache JSONB;

COMMENT ON COLUMN recordings.action_items_cache IS '...';
COMMENT ON COLUMN recordings.coaching_cache IS '...';
```

| Column | Purpose | Used by |
|---|---|---|
| `action_items_cache JSONB` | Cache for `extract_action_items` LLM output (read-through fallback when Fathom `source_metadata.action_items` absent) | Plan 22-02 |
| `coaching_cache JSONB` | Cache for `get_coaching_notes` LLM output | Plan 22-04 |

No new constraints, no new indexes, no RLS policy changes (existing `recordings` policies cover the new columns automatically).

`sentiment_cache` already exists (used by Plan 22-03's `get_sentiment` tool).

**Applied:** `supabase db push` exit 0 — `Applying migration 20260507120001_add_ai_cache_columns.sql... Finished supabase db push.`

---

### 2. `track-ai-usage` `VALID_ACTION_TYPES` registry expansion

**File:** `supabase/functions/track-ai-usage/index.ts:29-39`

**Before (1 line):**
```typescript
const VALID_ACTION_TYPES = ['smart_import', 'auto_name', 'auto_tag', 'chat_message'] as const;
```

**After (multi-line, 8 entries — 4 legacy + 4 new):**
```typescript
const VALID_ACTION_TYPES = [
  // Existing in-app actions
  'smart_import',
  'auto_name',
  'auto_tag',
  'chat_message',
  // Phase 22: MCP AI tools (D-09)
  'mcp_action_items',
  'mcp_ask_call',
  'mcp_sentiment',
  'mcp_coaching',
] as const;
```

`type AiActionType = typeof VALID_ACTION_TYPES[number];` declaration unchanged textually — TypeScript widens the union automatically.

No other code paths modified. The whitelist check at line 102 (`includes(actionType)`) keeps working for legacy callers and now also accepts the four MCP action types.

**Backwards compat verified:** frontend code in `src/hooks/useAiGate.ts:92` invokes `actionType: type` against the same HTTP endpoint with the legacy strings — unchanged.

**Deployed:** `supabase functions deploy track-ai-usage --use-api` →

```
Uploading asset (track-ai-usage): supabase/functions/track-ai-usage/index.ts
Uploading asset (track-ai-usage): supabase/functions/_shared/cors.ts
Deployed Functions on project vltmrnjsubfzrgrtdqey: track-ai-usage
```

`supabase functions list` confirms `track-ai-usage | ACTIVE | VERSION 47 | UPDATED_AT 2026-05-07 09:06:22 UTC`.

---

### 3. `_shared/track-ai-usage-inline.ts` helper

**File:** `supabase/functions/_shared/track-ai-usage-inline.ts` (new — 152 lines)

In-process tier check + quota enforcement for the MCP server. Mirrors the HTTP `track-ai-usage` handler's gating logic but skips JWT auth — the MCP server already runs as service role and resolves `user_id` / `org_id` from the `mcp_tokens` row directly.

**Why this exists (research finding from 22-RESEARCH.md):** `track-ai-usage` HTTP handler calls `auth.getUser(token)` at line 84 which requires a Supabase JWT. MCP tokens are NOT Supabase JWTs. Calling `track-ai-usage` over HTTP from `mcp-server` would require minting a user JWT — extra failure surface for zero benefit. Inline path is synchronous and uses the same service-role client mcp-server already has.

**Public API surface (intentionally minimal):**

```typescript
export type McpAiActionType =
  | 'mcp_action_items'
  | 'mcp_ask_call'
  | 'mcp_sentiment'
  | 'mcp_coaching';

export interface EnforceParams {
  supabase: any;             // service-role client
  userId: string;
  orgId: string | null;
  actionType: McpAiActionType;
  recordingId: string | null;
}

export type EnforceResult =
  | { allowed: true; tier: string; usage: number; limit: number }
  | { allowed: false; reason: string };

export async function enforceMcpAiUsage(params: EnforceParams): Promise<EnforceResult>;
```

**Internal logic** (matches HTTP handler, port-equivalent):
1. Tier derivation (free / pro / team / pro-trial → pro|free) via Polar product-id table
2. Effective org-scope (team tier pools usage org-wide; verifies `organization_memberships`)
3. Monthly usage via `get_monthly_ai_usage` (free/pro) or `get_monthly_org_ai_usage` (team) RPC
4. Limit enforcement → `{ allowed: false, reason: 'Monthly AI action limit reached (X/Y, Z plan). Upgrade at https://app.callvaultai.com/settings/billing.' }`
5. Best-effort `ai_usage` insert (logs error but does NOT deny — mirrors HTTP semantics)

**No external deps:** zero `https://esm.sh/...` imports, zero `fetch(` calls. Accepts `supabase` client from caller.

**No exports beyond the public surface:** `deriveTier`, `AI_ACTION_LIMITS`, `POLAR_PRODUCT_TIERS` are intentionally NOT exported (per plan constraint — keep surface minimal).

---

### 4. `mcp-server/index.ts` — NOT touched in this plan

Confirmed: `git status` shows zero modifications to `supabase/functions/mcp-server/index.ts`. Plans 22-02 / 22-03 / 22-04 own those edits (each adds a tool case-block).

---

## Verification evidence

| Check | Command | Result |
|---|---|---|
| Migration file present + correct DDL | `grep ADD\|COMMENT supabase/migrations/20260507120001_add_ai_cache_columns.sql` | 2 ADDs, 2 COMMENTs, 0 INDEXes |
| Registry expanded | `grep -E "'mcp_action_items'\|'mcp_ask_call'\|'mcp_sentiment'\|'mcp_coaching'" track-ai-usage/index.ts` | 4 matches |
| Legacy registry intact | `grep -E "'smart_import'\|'auto_name'\|'auto_tag'\|'chat_message'" track-ai-usage/index.ts` | 4 matches |
| Helper module present | `test -f _shared/track-ai-usage-inline.ts` | exists |
| Helper exports | `grep "^export" _shared/track-ai-usage-inline.ts` | `enforceMcpAiUsage` async function + `McpAiActionType` type + `EnforceParams` + `EnforceResult` |
| No external deps in helper | `grep -E "https://esm\.sh\|fetch\(" _shared/track-ai-usage-inline.ts` | 0 matches |
| `supabase db push` | exit code | 0 — `Applying migration 20260507120001... Finished supabase db push.` |
| `supabase functions deploy track-ai-usage --use-api` | exit code | 0 — `Deployed Functions on project vltmrnjsubfzrgrtdqey: track-ai-usage` |
| `supabase functions list` | filter | `track-ai-usage | ACTIVE | v47 | 2026-05-07 09:06:22 UTC` |
| Frontend regression | `grep -rE "(smart_import\|auto_name\|auto_tag\|chat_message)" src/` | 7 files still reference legacy types — backwards compatible |

---

## Files changed

| Path | Change |
|---|---|
| `supabase/migrations/20260507120001_add_ai_cache_columns.sql` | NEW (25 lines) |
| `supabase/functions/track-ai-usage/index.ts` | EDIT lines 29-39 (registry expanded; 1 line → 11 lines) |
| `supabase/functions/_shared/track-ai-usage-inline.ts` | NEW (152 lines) |

---

## Requirements progress

- AITL-02 (`extract_action_items`) — infra prerequisite landed; tool ships in Plan 22-02
- AITL-03 (`ask_call`) — infra prerequisite landed; tool ships in Plan 22-03
- AITL-04 (`get_sentiment`) — infra prerequisite landed; tool ships in Plan 22-03
- AITL-05 (`get_coaching_notes`) — infra prerequisite landed; tool ships in Plan 22-04

All four `mcp_*` action types are now registered with `track-ai-usage` and limits will enforce immediately when Plans 22-02..22-04 start invoking the helper.

---

## Next up — Wave 2

Plan **22-02**: implement `extract_action_items` MCP tool case-block in `mcp-server/index.ts`. Three-tier read-through cache: `source_metadata.action_items` (Fathom fast-path) → `recordings.action_items_cache` (cache hit) → LLM call via OpenRouter `gpt-5-nano` with `generateObject` + Zod schema. Pre-LLM gating via `enforceMcpAiUsage({ actionType: 'mcp_action_items', ... })`. Caches LLM result on success.

Plans 22-03 (`ask_call` + `get_sentiment`) and 22-04 (`get_coaching_notes`) follow sequentially per Plan 22-RESEARCH.md "Option X — sequential waves" recommendation (all four AI tools share `mcp-server/index.ts` as a write target — sequential waves avoid worktree merge conflicts).

---

## Blockers

None. Foundation is in place; Plans 22-02..22-04 can proceed.
