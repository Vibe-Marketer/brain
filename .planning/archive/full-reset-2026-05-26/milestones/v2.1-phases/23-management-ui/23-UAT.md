---
status: complete
phase: 23-management-ui
source:
  - 23-01-SUMMARY.md
  - 23-02-SUMMARY.md
started: 2026-05-07T14:30:00Z
updated: 2026-05-07T14:35:00Z
---

## Current Test

[testing complete — fast-track via Phase 22 UAT cross-test + Andrew's live MCPTab use]

## Tests

### 1. MCPTab capability toggles render correctly
**Status:** PASS (manual — Andrew's screenshots 2026-05-07 show the per-token Permissions panel with 4 toggles: Read / Write / Ai / Admin, all rendering correctly. Toggle state visibly persists ("Saved" indicator).)
**Expected:** Settings > Integrations shows token row with expandable Permissions panel containing 4 Switch toggles for Read/Write/Ai/Admin. Toggle state saves on change.

### 2. Capability gate enforced server-side (round-trip)
**Status:** PASS (verified via Phase 22 UAT Test 7 — Andrew's MCP client received `-32001` with category-aware error from `extract_action_items` when AI was disabled; gracefully fell back to read-tool. Phase 23 agent also verified live via curl across all 4 categories + unknown-tool fail-closed.)
**Expected:** Toggling category off → MCP tool calls in that category return -32001 with category-aware error. Toggling back on → tool calls succeed.

### 3. Dynamic categorized tool list replaces hardcoded list
**Status:** PASS (manual — Andrew's screenshots show all 41 tools rendered grouped by category: Read (17), Write (12), Ai (4), Admin (8). No `callvault/` prefix anywhere — old stale list is gone.)
**Expected:** "Tools available with this token" section renders dynamically from `src/lib/mcp-tool-categories.ts` mirror module. Tools grouped by category. Tool names use canonical bare-verb form (no `callvault/` prefix).

### 4. Server-side enforcement order
**Status:** PASS (verified by Phase 22 + 23 agents — token validation → plan gating → category gating → dispatch. Each layer short-circuits independently.)
**Expected:** Per-token JSONB column `enabled_categories` (null = full access) gates tool dispatch in `mcp-server/index.ts` after plan gating, before the case-block dispatcher.

## Issues Found (deferred to Phase 26)

These surfaced during Andrew's live UAT and are captured as Phase 26 deliverables:

1. **Gray dividers** — thin line above "TOOLS AVAILABLE WITH THIS TOKEN" header in the per-token panel; horizontal divider between "Create Token" button area and "How it works" section.
2. **MCP URL is raw Supabase address** — footer shows `https://vltmrnjsubfzrgrtdqey.supabase.co/functions/v1/mcp-server`. Should be a vanity domain like `api.callvaultai.com/mcp`.
3. **"Ai" capitalization** — should be "AI" (uppercase) in toggle labels and section headers.
4. **Footer URL duplication** — bottom-of-page "MCP Server URL" duplicates the per-token "Copy URL" button.

See ROADMAP.md Phase 26 for full deliverables and acceptance criteria.

## Summary

Phase 23 ships per-token capability toggles + dynamic categorized tool list + replacement of stale hardcoded tools list. All 4 acceptance tests PASS. 4 polish issues surfaced during UAT and deferred to Phase 26 — none are bugs in the shipped code, all are UX improvements.

MGMT-01 ✅ (token CRUD, Phase 19)
MGMT-02 ✅ (capability toggles, this phase)
MGMT-03 ✅ (server-side enforcement, this phase)
