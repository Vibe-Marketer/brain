---
phase: 21-write-crud-tools
plan: backfill
subsystem: mcp
tags: [mcp, write-tools, edge-function, supabase, org-isolation, retroactive-backfill]
status: 16-shipped-1-pending
shipped_dates:
  initial: 2026-04-15  # Commit 03904178 added the bonus write tools
  reconciled: 2026-05-07
backfilled: 2026-05-07
pending: ['create_note (TOOL-05) — see 21-01-PLAN.md after plan-phase']
---

# Phase 21: Write CRUD Tools — Shipped Inventory (Backfilled)

> **Hybrid phase document.** This SUMMARY catalogs the 16 write tools that already shipped without GSD plan tracking. The remaining `create_note` work is captured in `21-CONTEXT.md` and will produce `21-01-PLAN.md` via plan-phase. No new code in this commit — backfill only.

## Status

🟡 **2/3 spec'd write tools shipped.** 16 total write tools live (3 spec-aligned + 13 bonus). 1 remaining: `create_note` (TOOL-05) — covered by next plan.

## What Already Shipped

### Spec-aligned write tools

| Spec ID | Spec Name | Shipped Name(s) | Location |
|---|---|---|---|
| TOOL-05 | `create_note` | ⏳ NOT YET BUILT | — |
| TOOL-06 | `add_tag` | `tag_call` + `untag_call` | `mcp-server/index.ts:508`, `:520` |
| TOOL-07 | `move_to_folder` | `add_call_to_folder` + `remove_call_from_folder` | `mcp-server/index.ts:447`, `:459` |

### Bonus write tools (shipped beyond spec)

| Tool | Approx Location | Purpose |
|---|---|---|
| `rename_call` | `mcp-server/index.ts:364` | Update recording title |
| `move_calls_to_workspace` | `:376` | Bulk move calls between workspaces |
| `delete_call` | `:388` | Delete a recording |
| `copy_calls_to_organization` | `:399` | Copy calls into another org's workspace |
| `create_folder` | `:413` | Create a new folder |
| `rename_folder` | `:424` | Rename existing folder |
| `delete_folder` | `:436` | Delete folder |
| `add_call_to_folder` | `:447` | Move call into folder |
| `remove_call_from_folder` | `:459` | Remove call from folder |
| `create_tag` | (after :459) | Create personal tag |
| `rename_tag` | (after) | Rename personal tag |
| `delete_tag` | (after) | Delete personal tag |
| `tag_call` | `:508` | Apply tag to recording |
| `untag_call` | `:520` | Remove tag from recording |
| `create_share_link` | (later) | Create share link, optionally email-restricted |
| `create_organization` | (later) | Create new org |
| `create_workspace` | (later) | Create new workspace |

**Total shipped write tools: 16.** (Plus `create_note` pending = 17 when complete.)

## Architectural Decisions Locked (in shipped code)

See `21-CONTEXT.md` D-01 through D-05 for the full pattern. Key items:

1. **Standard case-block shape** — param parse → boundary check → mutation → `mcpOk` confirmation string.
2. **`mcpToken.scope` branch** in every write tool. Workspace tokens query a single workspace_id; org tokens fan out via `fetchOrgWorkspaceIds()`.
3. **User-owned resource verification** — `personal_tags` requires `.eq('user_id', mcpToken.user_id)`. Same for any future user-owned write target.
4. **Error codes** — `-32602` invalid params, `-32603` internal/Supabase, `-32001` access denied. Same as Phase 20.
5. **Confirmation strings** include the recording title and the action taken.

## Spec Deviations (Acknowledged)

- **Tool names diverge from spec** — shipped names are canonical:
  - Spec `add_tag` → shipped `tag_call` (verb-first, matches the recording-centric verb pattern)
  - Spec `move_to_folder` → shipped `add_call_to_folder` (parallels `remove_call_from_folder`)
  - Inverse pair tools (`untag_call`, `remove_call_from_folder`) shipped without spec — needed for full CRUD.

- **Bonus scope shipped** — 13 write tools beyond spec. Reasoning: MCP clients need full org/workspace/folder/tag CRUD to be useful end-to-end. No removal needed.

## Verification Status

**Code-level:** ✅ Per-tool case handlers present. Org/workspace boundary checks present in every shipped write tool.

**Runtime / dev-browser:** ⏳ Not formally verified end-to-end via MCP client. Andrew has used these tools during MCP server development. A future audit could close this with: connect via Claude Desktop, exercise each of the 16 shipped tools at least once, confirm cross-org rejection by attempting a write with a different org's recording_id.

## Files Touched (across the phase's commit history)

- `supabase/functions/mcp-server/index.ts` (single edge function file)
- `supabase/functions/_shared/` (shared CORS/auth helpers)

## Commit Trail

- Commit `03904178` (2026-04-15) — feat: expand MCP server from 5 to 18 tools (note: this commit listed read tools; write tools landed in subsequent commits in the same workstream)
- Commit `6f4b2047` — feat: add 19 write tools to MCP server (36 total)
- Commit `8b55a65b` — fix: create_organization needs type field, workspace defaults to team
- Commit `3a274ed4` (2026-05-07) — docs(planning): reconcile v2.1 + add Phase 24 Fathom Share-Link Save (formal reconciliation)

## Next Step

Run `/gsd-plan-phase 21` — produces `21-01-PLAN.md` for the `create_note` MCP write tool + `call_notes` migration + `get_call_notes` read-tool update. ~3-4 dev-hours.
