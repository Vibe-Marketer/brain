---
phase: 23-management-ui
plan: backfill
subsystem: settings-ui
tags: [mcp, settings, mcp-tab, token-crud, retroactive-backfill]
status: 1-of-3-shipped
shipped: ['MGMT-01: MCPTab.tsx CRUD (create/list/regenerate/delete)']
pending: ['MGMT-02: per-tool capability toggles', 'MGMT-03: server-side capability enforcement']
tech_debt_found: ['stale callvault/-prefixed tool names in MCPTab.tsx:629-648', 'tool list shows 5 of 36+ shipped tools']
backfilled: 2026-05-07
---

# Phase 23: Management UI — Shipped Inventory (Backfilled)

> **Hybrid phase document.** Backfill catalog for the MCPTab.tsx CRUD that shipped via Phase 19, plus a tech-debt callout discovered during this phase's discuss step. The forward MGMT-02/03 work (capability toggles + enforcement + UI cleanup) is designed in `23-CONTEXT.md` and will produce 2 plans via plan-phase.

## Status

🟡 **1/3 shipped + tech debt discovered.** MGMT-01 (settings UI for tokens) live. MGMT-02 (per-tool toggles) and MGMT-03 (server-side enforcement) pending.

## What Already Shipped

### MCPTab.tsx — Token CRUD UI (shipped via Phase 19)

| Capability | Location |
|---|---|
| Create token | `src/components/settings/MCPTab.tsx` + `NewTokenDialog` component |
| List tokens (masked) | `MCPTab.tsx` token list rendering |
| Copy token | `<CopyButton>` per row |
| Regenerate token | `RegenerateButton` + `useMcpTokens.ts` mutation |
| Delete token | `AlertDialog` confirmation + service mutation |
| MCP server URL display | `MCPTab.tsx:620-627` |

### Backing data layer

- **Service:** `src/services/mcpTokens.service.ts`
- **Hook:** `src/hooks/useMcpTokens.ts` (TanStack Query wrapper with optimistic updates)
- **DB table:** `mcp_tokens` (created in Phase 19; columns: id, org_id, workspace_id, scope, user_id, name, token_hash, created_at, last_used_at)

## Tech Debt Discovered

### Stale "Available tools" section in MCPTab.tsx (lines 629-648)

The existing UI hardcodes a list of 5 tools using the `callvault/` prefix that was removed in Phase 20 commit `b98c8b94`:

```tsx
{[
  ["callvault/search_calls", "Search calls by keyword across titles, transcripts, and tags"],
  ["callvault/list_calls", "List recent calls with pagination"],
  ["callvault/get_transcript", "Retrieve the full transcript for a specific call"],
  ["callvault/get_recording_context", "Get metadata, AI summary, speakers, and tags"],
  ["callvault/list_workspaces", "Enumerate workspaces accessible to the token"],
].map(...)}
```

**Issues:**
1. Tool names are wrong (`callvault/` prefix doesn't exist server-side anymore)
2. Only 5 tools shown — 36+ tools are shipped (after Phase 21 also: 17 read + 17 write)
3. Hardcoded array means every new tool requires a frontend code change

**Fix scope (folded into this phase):** Replace with a dynamic list rendered from the new `src/lib/mcp-tool-categories.ts` shared module. Group by category, show within the per-token Permissions panel. Decision locked in `23-CONTEXT.md` D-11.

## Forward Plan Inventory (pending)

Per `23-CONTEXT.md` decisions, plan-phase will produce:

- **23-01-PLAN.md:** Backend complete — migration adds `enabled_categories JSONB` column to `mcp_tokens`. Add `TOOL_CATEGORIES` + `TOOL_DESCRIPTIONS` shared module at `supabase/functions/_shared/mcp-tool-categories.ts` (canonical) + mirror at `src/lib/mcp-tool-categories.ts`. Add enforcement block in `mcp-server/index.ts` after plan gating. Deploy edge function.
- **23-02-PLAN.md:** UI work in `MCPTab.tsx`. Per-token Permissions expand panel with 4 toggles (Read / Write / AI / Admin). Replace stale Available Tools list with dynamic categorized list. Add `useMcpTokenCapabilities.ts` + `mcpTokenCapabilities.service.ts`. Optimistic update on toggle.

(One plan = one wave; 23-02 depends on 23-01.)

Total estimate: ~half-day end-to-end (matches roadmap original estimate).

## Architectural Decisions (already locked across earlier phases)

1. **Service + Hook separation** — every data-access pair follows the convention: pure async service + TanStack Query hook.
2. **Token model** — Phase 19 owns the `mcp_tokens` schema. Phase 23 extends it with one column, no breaking changes.
3. **Plan gating** — Phase 19 enforcement runs BEFORE category gating in this phase (D-07). Both layers can short-circuit a tool call.
4. **Error codes** — `-32001` reused for category-disabled (same as cross-org rejection in Phase 20 and plan-gate denial in Phase 19). Consistent customer-facing error semantics.
5. **Tool naming** — bare verbs, no `callvault/` prefix (Phase 20 D-01). Cleanup in this phase aligns the UI with the server.

## Files Touched (already)

- `src/components/settings/MCPTab.tsx` — full CRUD UI (Phase 19)
- `src/services/mcpTokens.service.ts` — service layer (Phase 19)
- `src/hooks/useMcpTokens.ts` — hook (Phase 19)
- `supabase/migrations/<phase-19-mcp-tokens-migration>` — schema (Phase 19)

## Verification Status

**MGMT-01 (token CRUD):** ✅ Code-level present and exercised by Phase 19 verification. Phase 19 ran dev-browser test of create/regenerate flow. Delete flow not formally dev-browser tested; recommend folding into Phase 23 verification when 23-02 ships.

**MGMT-02 + MGMT-03:** ⏳ Not started.

## Next Step

Run `/gsd-plan-phase 23` — produces 23-01-PLAN.md + 23-02-PLAN.md.
