# Phase 23 Discussion Log

**Date:** 2026-05-07
**Mode:** Default discuss (interactive, hybrid backfill + forward decisions, scope expansion to fold UI cleanup)

## Summary

Phase 23 has MCPTab.tsx CRUD shipped (MGMT-01) plus tech-debt found mid-discuss: the existing "Available tools" list is hardcoded with stale `callvault/`-prefixed tool names (the prefix was removed in Phase 20 commit `b98c8b94`) and lists only 5 of 36+ shipped tools. Discussion covered capability storage shape, toggle granularity, default state for new tokens, and whether to fold the UI cleanup into this phase.

## Areas Discussed

### Area 1: Capability storage

**Question:** How should per-tool capabilities be stored?

**Options:**
1. JSONB column on `mcp_tokens` (recommended) — single column, default null = all enabled
2. Separate `mcp_token_capabilities` join table — normalized
3. Per-category booleans on `mcp_tokens` — coarse, simple

**User answer:** Option 1 — JSONB column on `mcp_tokens`.

**Refinement during write:** Since toggles are per-category (D-04) not per-tool, the JSONB stores category names (array of `'read'|'write'|'admin'|'ai'`), not individual tool names. This decision auto-adapts as new tools ship — a new AI tool added in Phase 22 is automatically gated by the 'ai' category toggle without a schema change. Decision logged: D-02.

### Area 2: Toggle granularity

**Question:** Per-category, per-tool, or hybrid toggles?

**Options:**
1. Per-category (Read / Write / AI / Admin) (recommended)
2. Per-tool individual toggles (36+ checkboxes)
3. Hybrid

**User answer:** Option 1 — Per-category.

**Decision logged:** D-04, D-09. 4 fixed categories. Per-tool toggles deferred as power-user feature.

### Area 3: Default state for new tokens

**Question:** All-enabled, all-disabled, or smart-default?

**Options:**
1. All-enabled (recommended)
2. All-disabled, customer opts in
3. Smart default (Read on, Write/AI off)

**User answer:** Option 1 — All-enabled (null in storage, no enforcement).

**Decision logged:** D-03, D-13, D-14. Backwards compatible, no migration for existing tokens.

### Area 4: Fold UI cleanup into this phase?

**Question:** Fix the stale `Available tools` list at MCPTab.tsx:629-648 in this phase, or punt to a separate UI phase?

**Options:**
1. Yes — fold cleanup into Phase 23 (recommended)
2. No — keep Phase 23 narrowly scoped

**User answer:** Option 1 — Fold cleanup in.

**Decision logged:** D-11. The toggle UI naturally replaces the stale list; the tool→category map (D-05, D-06) becomes the single source of truth for both server enforcement and UI rendering.

## Deferred Ideas

- Per-tool individual toggles (power-user feature — customer evidence required)
- Hot-reload tool gating from MCP client side (big lift, low signal)
- Role-based default capabilities (policy complexity — defer)
- Audit log of capability toggles (compliance feature — defer until customer asks)
- Capability templates (Read-only / Sales / Full Access presets — defer for customer evidence)
- Per-organization default capabilities (org admin sets defaults — defer)
- AI cost cap per token (token-level quota — defer)

## Claude's Discretion (not asked, decided per established patterns)

- 4 category names: `read`, `write`, `admin`, `ai` (D-04). `admin` distinguishes destructive org/workspace/folder/tag CRUD from regular write operations.
- Tool→category map placement: shared module at `supabase/functions/_shared/mcp-tool-categories.ts` with mirror at `src/lib/mcp-tool-categories.ts` (D-05). Manual sync with cross-pointers — codegen is overkill for v1.
- Enforcement order: token validation → plan gating (Phase 19) → category gating (this phase) → dispatch. Each step short-circuits.
- Save UX: optimistic update via TanStack Query mutation, no Save button (D-10). Matches existing token regenerate flow.
- Error code reuse: `-32001` for category-disabled responses (same as plan-gate denial in Phase 19; same as cross-org rejection in Phase 20).
- Plan inventory: 23-01 (backend complete: migration + shared module + enforcement) + 23-02 (UI). Two plans, one wave each. 23-02 depends on 23-01.
- `revoke_share_link` placed in `write` category (D-06) — not currently in mcp-server/index.ts shipped tool list per the inventory, but anticipating Phase 23 may include it; researcher should confirm during plan-phase.
