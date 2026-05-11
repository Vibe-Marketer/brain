# Phase 23: Management UI - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning (1-2 plans for capability toggles + UI cleanup) + retroactive backfill of MCPTab.tsx CRUD shipped in Phase 19
**Source:** `/gsd-discuss-phase 23` — combined backfill + forward-decision discussion

> **Hybrid phase.** MGMT-01 shipped via `MCPTab.tsx` (full create/list/regenerate/delete CRUD for MCP tokens). MGMT-02 + MGMT-03 (per-tool capability toggles + server-side enforcement) are net-new. Discovered tech-debt during discuss: the existing "Available tools" list at `MCPTab.tsx:629-648` is hardcoded with stale `callvault/`-prefixed names (the prefix was removed in Phase 20 commit `b98c8b94`) and lists only 5 of the 36+ shipped tools. Cleanup is folded into this phase.

<domain>
## Phase Boundary

Users can see their MCP connection details, regenerate tokens, AND control which tools are enabled per-token — all enforced server-side. The existing token CRUD UI gets a per-category permission toggle (Read / Write / AI / Admin) and the stale hardcoded tool list is replaced with a dynamic, accurate enumeration grouped by category.

**Boundary:**
- IN SCOPE: New `enabled_categories JSONB` column on `mcp_tokens`. Per-category toggle UI in `MCPTab.tsx` (4 master toggles per token). Server-side enforcement in `mcp-server/index.ts` (reject disabled-category tool calls). Replace the stale hardcoded "Available tools" section with a dynamic list grouped by category.
- OUT OF SCOPE: Per-tool individual toggles (deferred — power-user feature). User-configurable AI model per tool (Phase 22 left this hardcoded; revisit if requested). Hot-toggling tool gating from MCP client side. Changing existing token CRUD flow (it works; don't touch).

</domain>

<decisions>
## Implementation Decisions

### Backfilled — MGMT-01 (already shipped)

- **D-01:** `MCPTab.tsx` ships full CRUD: `NewTokenDialog` (create), token list with masked tokens + copy button (read), `RegenerateButton` per row (regenerate), `AlertDialog` confirmation flow (delete). Ships at `src/components/settings/MCPTab.tsx`. Backed by `mcp_tokens` table + `useMcpTokens.ts` hook + `mcpTokens.service.ts` service. All from Phase 19.

### Forward — Storage shape (Decision: JSONB array of category names)

- **D-02: Add `enabled_categories JSONB` column to `mcp_tokens`** — array of category names. Migration:
  ```sql
  ALTER TABLE mcp_tokens
    ADD COLUMN enabled_categories JSONB;
  -- Default null means all categories enabled (backwards compatible).
  ```
  Reason for storing categories (not individual tool names): the tool list grows over time (Phase 22 will add 4 AI tools). Per-tool storage means existing tokens have stale arrays after every new tool ships. Per-category is stable across tool additions — a new AI tool is automatically gated by the 'ai' category toggle.

- **D-03: Default state for new tokens: `null` (all categories enabled).** Backwards compatible — existing tokens with `null` continue to work. Customer opts OUT of dangerous categories per token. No migration needed for existing tokens.

- **D-04: Categories: `read`, `write`, `admin`, `ai`** — 4 fixed values. Validated server-side (reject any category not in this set when toggling).

### Forward — Server-side enforcement

- **D-05: Tool-to-category map** — single source of truth in `supabase/functions/_shared/mcp-tool-categories.ts`. Exports `TOOL_CATEGORIES: Record<string, 'read' | 'write' | 'admin' | 'ai'>` mapping every shipped tool name to its category. Imported by `mcp-server/index.ts` for enforcement. Mirror copy at `src/lib/mcp-tool-categories.ts` for frontend display (manual sync; one-line comment in each file pointing at the canonical location).

- **D-06: Category map (locked):**
  - **read**: `search_calls`, `list_calls`, `get_transcript`, `get_recording_context`, `list_workspaces`, `list_contacts`, `get_contact`, `get_contact_calls`, `list_folders`, `get_folder_calls`, `list_tags`, `get_tagged_calls`, `list_speakers`, `get_speaker_calls`, `get_action_items`, `get_call_notes`, `list_shared_calls`
  - **write**: `rename_call`, `delete_call`, `move_calls_to_workspace`, `copy_calls_to_organization`, `add_call_to_folder`, `remove_call_from_folder`, `tag_call`, `untag_call`, `create_note`, `create_share_link`, `revoke_share_link`, `import_youtube_video`
  - **admin**: `create_folder`, `rename_folder`, `delete_folder`, `create_tag`, `rename_tag`, `delete_tag`, `create_organization`, `create_workspace`
  - **ai**: `extract_action_items`, `ask_call`, `get_sentiment`, `get_coaching_notes` (Phase 22 — gated as soon as the tools ship)

- **D-07: Enforcement at top of dispatcher** — before the `case` block in `mcp-server/index.ts`, after token validation and plan gating:
  ```typescript
  if (mcpToken.enabled_categories !== null) {
    const category = TOOL_CATEGORIES[toolName];
    if (!category || !mcpToken.enabled_categories.includes(category)) {
      return mcpError(id, -32001, `Tool '${toolName}' is disabled for this token. Enable the '${category}' category in Settings > Integrations.`, corsHeaders);
    }
  }
  ```
  When `enabled_categories` is null, no enforcement runs (legacy behavior).

- **D-08: Unknown tool name → reject as if disabled.** If a tool name isn't in `TOOL_CATEGORIES` map, treat it as disabled. Forces map updates whenever a new tool is added.

### Forward — UI shape

- **D-09: 4 toggle switches per token row** in `MCPTab.tsx` — Read / Write / AI / Admin. Switches sit in a collapsible "Permissions" expand panel per token (default collapsed to keep the list compact). Toggling ON adds the category to the array; toggling OFF removes it. If all 4 are on, persist as `null` (matches default state).

- **D-10: Save behavior** — toggle changes save immediately on blur or per-toggle (optimistic update via TanStack Query mutation). Show inline "Saving…" / "Saved" indicator. No "Save" button.

- **D-11: Replace stale "Available tools" section** at `MCPTab.tsx:629-648` with a dynamic list rendered from `src/lib/mcp-tool-categories.ts`, grouped by category. Each tool shows its NAME (no `callvault/` prefix — that's the bug being fixed) and a one-line description (descriptions live alongside the category map in the same file as a `TOOL_DESCRIPTIONS` constant). Section sits inside the per-token Permissions panel — toggling Read off visually greys out the read-tools listing.

- **D-12: Category descriptions for the toggle UI:**
  - Read — "Search calls, view transcripts, list contacts/folders/tags. Safe — only retrieves existing data."
  - Write — "Add notes, apply tags, organize calls into folders, share calls. Modifies your data but preserves originals."
  - AI — "LLM-powered analysis (action items, sentiment, coaching, Q&A). Counts toward your AI usage quota."
  - Admin — "Create/rename/delete folders, tags, workspaces, organizations. Destructive — only enable for trusted clients."

### Forward — Backwards compatibility

- **D-13: No migration for existing tokens** — `enabled_categories` defaults to null, server enforces only when set. All existing tokens continue full-access behavior (matching D-03 + D-07).

- **D-14: No breaking change for existing MCP clients** — clients that connect to legacy tokens see no behavior change. Only tokens explicitly toggled get gating.

### Forward — Phase 23 plan inventory

Plan-phase will produce these plans:

- **23-01-PLAN.md:** Migration adds `enabled_categories JSONB` to `mcp_tokens`. Add `TOOL_CATEGORIES` and `TOOL_DESCRIPTIONS` shared module at `supabase/functions/_shared/mcp-tool-categories.ts` + mirror at `src/lib/mcp-tool-categories.ts`. Add enforcement block in `mcp-server/index.ts` per D-07. Deploy edge function with `--use-api`. (Backend-complete after this plan.)
- **23-02-PLAN.md:** UI work in `MCPTab.tsx`. Add Permissions expand panel per token row with 4 toggles. Replace stale Available Tools list with dynamic categorized list. Add `useMcpTokenCapabilities` hook + `mcpTokenCapabilities.service.ts` for the toggle mutations.

(One plan = one wave; 23-02 depends on 23-01 since the column must exist before the UI can write to it.)

</decisions>

<canonical_refs>
## Canonical References

- `src/components/settings/MCPTab.tsx` — existing UI (CRUD shipped at lines 1-680). Stale hardcoded tool list at lines 629-648 to replace.
- `src/services/mcpTokens.service.ts` — service layer for token CRUD. New `mcpTokenCapabilities.service.ts` will be added per the service+hook pattern.
- `src/hooks/useMcpTokens.ts` — TanStack Query hook for token list/mutations. New `useMcpTokenCapabilities.ts` will mirror this shape.
- `supabase/functions/mcp-server/index.ts` — single edge function. Enforcement block goes at the top of the dispatcher, after token validation and plan gating (Phase 19), before the case block.
- `supabase/functions/_shared/` — folder for shared modules. `mcp-tool-categories.ts` will live here per supabase/CLAUDE.md conventions.
- `.planning/phases/19-provisioning-foundation/19-CONTEXT.md` — token model decisions (scope = `organization` vs `workspace`, plan gating chain). The new enforcement block runs AFTER plan gating per D-07.
- `.planning/phases/20-read-crud-tools/20-CONTEXT.md` — locked tool naming (`tag_call` not `callvault/tag_call`), error codes (`-32001` for access denied — reused by D-07). Sources of canonical tool names for the category map.
- `.planning/phases/22-ai-tools/22-CONTEXT.md` — the 4 AI tools that need to land in `TOOL_CATEGORIES` (`extract_action_items`, `ask_call`, `get_sentiment`, `get_coaching_notes`). Phase 23 ships the category map; Phase 22 ships the tools that use it. Order doesn't matter — each can land independently as long as the category map stays accurate.
- `.planning/REQUIREMENTS.md` — MGMT-01 ✅, MGMT-02 ⏳, MGMT-03 ⏳.
- `.planning/ROADMAP.md` — Phase 23 entry.

</canonical_refs>

<code_context>
## Reusable Patterns

1. **Service + Hook separation** (project convention) — `mcpTokenCapabilities.service.ts` for the Supabase mutation, `useMcpTokenCapabilities.ts` wrapping it with TanStack Query optimistic updates. Same shape as the existing `mcpTokens.service.ts` + `useMcpTokens.ts` pair.
2. **Migration template** — see `supabase/CLAUDE.md` migration section. RLS policies aren't needed for the new column (it's an attribute on an existing table that already has policies — column inherits them).
3. **MCPTab UI patterns** — existing per-token rows use a horizontal row layout with action buttons on the right. The Permissions expand panel should follow the existing collapsible pattern (use `framer-motion` height animation if not present, or shadcn `Collapsible` primitive).
4. **Toggle component** — use shadcn `Switch` from `@/components/ui/switch` (already used elsewhere in settings).
5. **Optimistic update** — pattern from `useMcpTokens.ts` regenerate flow. Mutate, on error roll back. Show inline status with `Sonner` toast or per-token `Saving…` indicator.
6. **Boxed card chrome** — see `baseline-design-system` skill for the rounded 16px / `bg-card` / `border-border` / `shadow-sm` chrome on per-token rows.
7. **Server-side enforcement order** — token validation (Phase 18) → plan gating (Phase 19) → category gating (this phase) → tool dispatch. Each step short-circuits on failure.

</code_context>

<deferred>
## Deferred Ideas (Not in This Phase)

- **Per-tool individual toggles** — power-user feature. Customer evidence required before scoping.
- **Hot-reload tool gating from MCP client side** — would require streaming a config change down the open MCP connection. Big lift, low signal. Defer until customer asks.
- **Role-based default capabilities** — e.g., "Sales tokens default to Read+Write, no Admin"; "Engineering tokens default to Read only". Adds policy complexity. Defer.
- **Audit log of capability toggles** — who turned off Admin and when. Useful for compliance. Defer until a customer in a regulated industry asks.
- **Capability templates** — preset combinations like "Read-only" / "Sales" / "Full Access". Easier UX once we have customer feedback on what combos people actually use. Defer.
- **Per-organization default capabilities** — org admin sets defaults for all new tokens in the org. Phase 19 plan-gating already provides org-level on/off. Defer until a Team plan customer asks.
- **AI cost cap per token** — limit AI tool calls per token per month. Currently AI is gated by user-tier quota in `track-ai-usage`. Token-level cap is a finer-grained controll. Defer.

</deferred>

<spec_lock>
## Locked Requirements (from REQUIREMENTS.md)

- **MGMT-01 ✅ (already shipped)** — Settings > Integrations shows MCP server URL + masked token + copy button → satisfied by `MCPTab.tsx`.
- **MGMT-02 ⏳ → covered by D-09, D-10, D-11** — Settings UI shows a toggle per MCP tool (in this phase: per-category, with per-tool listings under each). Toggling immediately persists via optimistic update.
- **MGMT-03 ⏳ → covered by D-07, D-08** — A disabled tool returns a clear error message to the MCP client (`-32001` with category-aware error text).

</spec_lock>
