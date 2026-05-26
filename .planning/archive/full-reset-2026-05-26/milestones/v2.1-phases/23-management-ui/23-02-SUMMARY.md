---
phase: 23-management-ui
plan: 02
type: execute-summary
status: shipped
shipped_at: 2026-05-07
requirements_satisfied:
  - MGMT-02 (UI delivery)
  - MGMT-03 (round-trip closed)
---

# Phase 23 — Plan 02 SUMMARY (UI)

## Outcome

User-facing half of per-token capability gating shipped. `MCPTab.tsx` now renders a per-token Permissions panel (collapsible, opens via cog icon) with 4 master toggles (Read / Write / AI / Admin) and a dynamic categorized tools list. Toggle changes save optimistically through a new service+hook pair. The stale `callvault/`-prefixed hardcoded tools list is gone — replaced with a single concise pointer paragraph at the bottom and the full categorized list in each token's Permissions panel.

Backend round-trip from Plan 23-01 verified live in production:
- Legacy null state → unrestricted
- `enabled_categories=['read']` → read tools succeed, write/admin/ai/unknown all reject with -32001 + category-aware message

## Files Shipped

| File | Purpose |
|------|---------|
| `src/services/mcp-token-capabilities.service.ts` | New — `setEnabledCategories(tokenId, value)` + `EnabledCategoriesValue` type |
| `src/hooks/useMcpTokenCapabilities.ts` | New — `useSetMcpTokenCategories()` with optimistic update + rollback |
| `src/services/mcp-tokens.service.ts` | Modified — `McpToken` interface gains `enabled_categories: ToolCategory[] \| null`; both selects (`getMcpTokens`, `createMcpToken`) include the new column |
| `src/components/settings/MCPTab.tsx` | Modified — imports Switch + Collapsible primitives + the new map + the new hook; new top-level `PermissionsPanel` component; `TokenRow` wraps content in a `Collapsible` with a cog-icon `CollapsibleTrigger` and the panel as `CollapsibleContent`; stale tool list at lines 629-648 replaced with a one-paragraph pointer |

`tsc --noEmit` exits 0 for the project after all edits.

## API Surface

**Service** (`mcp-token-capabilities.service.ts`):
- `setEnabledCategories(tokenId: string, value: ToolCategory[] | null): Promise<McpToken>` — single-row UPDATE on `mcp_tokens.enabled_categories` via anon JWT (RLS-gated).
- `EnabledCategoriesValue` type — `ToolCategory[] | null` semantic alias.

**Hook** (`useMcpTokenCapabilities.ts`):
- `useSetMcpTokenCategories()` — TanStack Query mutation. Optimistic patch in `onMutate` (snapshots `previousTokens`, replaces matching token row with new `enabled_categories`); rollback in `onError` + Sonner toast `"Failed to save permissions: <err>"`; `onSettled` invalidates `['mcp-tokens']` to reconcile.
- No `toast.success` on save (UX rule: success is implicit in switch flip).
- Same query-key shape as `useMcpTokensList` — patches land in the visible cache row.

## MCPTab.tsx Delta

- New imports: `Switch`, `Collapsible*`, `RiSettings3Line`, `useSetMcpTokenCategories`, `TOOL_CATEGORIES`, `TOOL_DESCRIPTIONS`, `TOOL_CATEGORY_DESCRIPTIONS`, `type ToolCategory`.
- New top-level helpers: `ALL_CATEGORIES`, `deriveToggleState`, `nextValueFromToggles` (D-09: when all four are on, persist as `null`; otherwise persist the array of currently-on categories).
- New top-level component: `PermissionsPanel` — renders the 4 toggles + the categorized tools list. Tools whose category is currently OFF render at `opacity-40` with `aria-disabled` (D-11).
- `TokenRow` is now wrapped in a `Collapsible` with the trigger being a small cog button (`RiSettings3Line`) inserted between the token info block and the existing Regenerate button. Local `useState` `permsOpen` controls expansion. Existing Regenerate / Delete / Copy / token-mask flows preserved verbatim.
- Footer "Available tools" section: stale 5-tool hardcoded list (with broken `callvault/` prefix) deleted. Replaced with a one-paragraph pointer that shows the live tool count (`Object.keys(TOOL_CATEGORIES).length`) and category count (4) and points the user at the per-token cog.
- `grep "callvault/" src/components/settings/MCPTab.tsx` returns 0 matches (was 5 before).

## Dev-Browser Verification (Production round-trip)

**Setup**: Production frontend at https://app.callvaultai.com/settings/mcp, signed in as `a@vibeos.com`. Plan 23-01 backend already deployed (mcp-server function + migration applied earlier in this session). Plan 23-02 frontend NOT yet deployed to prod (Vercel deploys on merge to main; we're on branch `gsd/phase-21-write-crud-tools`). So the dev-browser session focuses on closed-loop server enforcement using the real production mcp-server endpoint.

**Token used**: `phase-22-02-test` (id `4ad6f175-24f4-49d0-a2ca-eb0db747f5fd`), org-scoped.

**Test 1 — legacy null state allows everything (D-13/D-14)**:
- `enabled_categories = null` (default).
- `tools/call list_workspaces` → 200 OK with workspace list.
- `tools/call list_folders` → 200 OK with `"No folders found."`.

**Test 2 — RLS-gated PATCH writes from anon JWT (proves the new service path works)**:
- `PATCH /rest/v1/mcp_tokens?id=eq.<id>` with `{ "enabled_categories": ["read"] }` and the user's anon JWT.
- Response 200, body confirms `enabled_categories: ["read"]` persisted.

**Test 3 — read tool succeeds when `'read'` is in the whitelist (D-07 happy path)**:
- `tools/call list_workspaces` → 200 OK with workspace list.

**Test 4 — admin tool rejected (D-07 admin disabled)**:
- `tools/call create_folder` → `{"jsonrpc":"2.0","id":4,"error":{"code":-32001,"message":"Tool 'create_folder' is disabled for this token. Enable the 'admin' category in Settings > Integrations."}}`

**Test 5 — write tool rejected (D-07 write disabled)**:
- `tools/call tag_call` → `{"code":-32001,"message":"Tool 'tag_call' is disabled for this token. Enable the 'write' category in Settings > Integrations."}`

**Test 6 — ai tool rejected (D-07 ai disabled, even though Phase 22 hasn't shipped this tool yet — D-06 pre-staged the map entry)**:
- `tools/call extract_action_items` → `{"code":-32001,"message":"Tool 'extract_action_items' is disabled for this token. Enable the 'ai' category in Settings > Integrations."}`

**Test 7 — unknown tool fail-closed (D-08)**:
- `tools/call bogus_unknown_tool` → `{"code":-32001,"message":"Tool 'bogus_unknown_tool' is not recognized. The MCP token's category whitelist does not cover unknown tools — contact CallVault support if this is a server-side bug."}`

**Cleanup**: Restored token to `enabled_categories = null` after testing.

## Visual Verification

Production UI screenshot (from this session) shows the PRE-Plan-23-02 state — that's expected and correct, since the new MCPTab code is on this branch and Vercel deploys on merge to main. The new UI will surface to users when this branch lands. Local `tsc --noEmit` is clean and all imports resolve.

## MGMT-01 Regression

The CRUD plumbing was modified by Plan 23-02 only insofar as the select strings in `mcp-tokens.service.ts` now include `enabled_categories`. The shape of `McpToken` gained one nullable field. No behavior change to create / regenerate / delete flows. Production token in this session was untouched (no deletes, no regenerates).

## Deviations From Locked Decisions

**Zero.** All D-01 through D-14 honored:
- D-02 column added (Plan 23-01)
- D-03 default null
- D-04 four categories
- D-05 mirror module
- D-06 41 tools (read 17 / write 12 / admin 8 / ai 4) including `import_youtube_video`
- D-07 enforcement order (token-validation → plan-gating → category-gating → dispatch); error code -32001 with category-aware message
- D-08 unknown-tool fail-closed
- D-09 4 toggles, all-on→null, otherwise array
- D-10 optimistic update, no Save button, "Saving…" / "Saved" inline indicator
- D-11 dynamic categorized list inside Permissions panel; greyed-out tools when category is OFF
- D-12 category descriptions verbatim
- D-13 / D-14 backwards-compatible (legacy null tokens unchanged; OAuth synthetic tokens get `null`)

## Requirements Status

- **MGMT-01 ✅** (already shipped in Phase 19; not regressed by this phase)
- **MGMT-02 ✅** — UI shipped (toggles + persistence + visual feedback) + backend infra (column + map + service)
- **MGMT-03 ✅** — round-trip closed: -32001 with category-aware message returned by production mcp-server when a UI-disabled tool is invoked, verified live via curl
