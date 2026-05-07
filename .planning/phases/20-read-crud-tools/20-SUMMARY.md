---
phase: 20-read-crud-tools
plan: backfill
subsystem: mcp
tags: [mcp, read-tools, edge-function, supabase, org-isolation, retroactive-backfill]
status: shipped
shipped_dates:
  initial_5_tools: 2026-04-10  # Alongside Phase 18 v2.0 baseline
  expanded_to_18_tools: 2026-04-15  # Commit 03904178
  reconciled: 2026-05-07
backfilled: 2026-05-07
---

# Phase 20: Read CRUD Tools — Summary (Backfilled)

> **This phase shipped without GSD plan tracking.** This SUMMARY.md is a retroactive reconciliation document, written 2026-05-07 to align GSD state with codebase reality. No new code was written — this is documentation only.

## Goal

Users' MCP clients can search transcripts, list and filter calls, and retrieve full call details and transcript text — with strict org/workspace boundary enforcement on every tool invocation.

## Status

✅ **Functionally complete.** All four originally-spec'd success criteria satisfied by the shipped tools. 13 additional read tools shipped beyond spec to give MCP clients enough context for real workflows.

## What Shipped

### Core Read Tools (4 originally spec'd, all satisfied)

| Spec ID | Spec Name | Shipped Name | Location | Notes |
|---|---|---|---|---|
| TOOL-01 | `search_transcripts` | `search_calls` | `supabase/functions/mcp-server/index.ts:173` | Searches titles, transcripts, summaries, tags, AND participants — broader scope than spec name implies. Two-step query for org-scoped tokens to prevent cross-org leakage. ILIKE special chars escaped. |
| TOOL-02 | List & filter calls | `list_calls` | `mcp-server/index.ts:185` | Pagination via limit/offset (default 20, max 100). `workspace_id` filter present. Per-dimension filtering (folder/tag/contact/speaker) provided via separate tools below rather than as parameters. |
| TOOL-03 | Get full call details | `get_recording_context` | `mcp-server/index.ts:208` | Returns metadata + AI summary + speakers + tags in one response. |
| TOOL-04 | Get full transcript | `get_transcript` | `mcp-server/index.ts:197` | Full transcript text with speaker labels and timestamps. |

### Bonus Read Tools (shipped beyond spec)

13 additional tools to give MCP clients useful context without round-tripping:

| Tool | Location | Purpose |
|---|---|---|
| `list_workspaces` | `mcp-server/index.ts:219` | Workspaces visible to this token |
| `list_contacts` | `mcp-server/index.ts:227` | Contacts with optional name/email search |
| `get_contact` | `mcp-server/index.ts:238` | Single contact details |
| `get_contact_calls` | `mcp-server/index.ts:249` | Calls associated with a contact |
| `list_folders` | `mcp-server/index.ts:261` | Folder hierarchy |
| `get_folder_calls` | `mcp-server/index.ts:271` | Calls in a folder |
| `list_tags` | `mcp-server/index.ts:283` | All tags |
| `get_tagged_calls` | `mcp-server/index.ts:293` | Calls with a given tag (by id OR name) |
| `list_speakers` | `mcp-server/index.ts:305` | Speakers detected across calls |
| `get_speaker_calls` | `mcp-server/index.ts:316` | Calls featuring a given speaker |
| `get_action_items` | `mcp-server/index.ts:328` | Cached Fathom action items per call (read-only — Phase 22 will add LLM extraction for non-Fathom sources) |
| `get_call_notes` | `mcp-server/index.ts:339` | User notes on a call |
| `list_shared_calls` | `mcp-server/index.ts:350` | Calls shared via share-link |

**Total: 17 read tools shipped** (4 core + 13 bonus).

## Architectural Decisions Locked

See `20-CONTEXT.md` for the full decision log. Key items future phases must follow:

1. **Two-step org boundary query** for any tool that fans across all org workspaces — never trust the global_search RPC for org-scoped paths.
2. **`mcpToken.scope` branch** in every tool case — `'organization'` vs `'workspace'`. Skipping this is a security regression.
3. **Plain-text formatted output** for human-readable MCP responses; reserve JSON for tools where the client needs structured data.
4. **ILIKE escaping** for any user-supplied search string.
5. **`mcpOk` / `mcpError` helpers** for all responses — never raw `Response` objects.

## Spec Deviations (Acknowledged)

- **Tool names diverge from REQUIREMENTS.md spec** — shipped names are canonical (e.g., `search_calls` ≠ spec `search_transcripts`). Spec text is stale; do not "fix" code to match spec.
- **`callvault_*` prefix removed** — MCP clients namespace by server, prefix was redundant. Removed in commit `b98c8b94`.
- **`semantic_search` removed** — v2.x architecture constraint says zero embedding pipeline. Removed in commit `559a5626`.

## Verification Status

**Code-level:** ✅ All four success criteria satisfied per the shipped code. File:line evidence in `ROADMAP.md` Phase 20 detail section.

**Runtime / dev-browser:** ⏳ Not formally verified end-to-end via MCP client. Phase 19 covered the connection / token / plan-gate flow; Phase 20 read tools have been used in practice by Andrew during MCP server development but have not been put through a structured user-acceptance test against Claude Desktop / ChatGPT / Cursor. **If a future audit (e.g., `/gsd-audit-uat`) wants to formally close this**, the test plan is: connect via Claude Desktop, run each of the 17 tools at least once, confirm org boundary by attempting cross-org access with a different token.

## Files Touched (across the phase's commit history)

- `supabase/functions/mcp-server/index.ts` (the entire phase lives in this single edge function file)
- `supabase/functions/_shared/` helpers (CORS, supabase client init, pattern-shared with other edge fns)

## Commit Trail

- Initial 5 tools shipped alongside Phase 18 v2.0 baseline (~2026-04-10)
- Commit `ad73e50e` — feat: MCP OAuth 2.1 + branded URL + dual-auth
- Commit `03904178` — feat: expand MCP server from 5 to 18 tools (2026-04-15) — adds the 13 bonus read tools
- Commit `559a5626` — fix: remove semantic_search tool (no embedding pipeline)
- Commit `b98c8b94` — fix: remove callvault_ prefix from tool names
- Commit `0ec333b6` — fix: MCP protocol compliance + OAuth consent redirect
- Commit `5a6b4814` — fix: MCP spec compliance — WWW-Authenticate header + serverInfo title
- Commit `0189364e` — fix: handle tools/call method (MCP protocol execution format)
- Commit `8f0b9a17` — fix: MCP auth failure caused by plan gate rejecting all users
- Commit `3a274ed4` — docs(planning): reconcile v2.1 + add Phase 24 Fathom Share-Link Save (formal reconciliation, 2026-05-07)

## Next Phase

**Phase 21: Write CRUD Tools** — 2/3 already shipped (`tag_call`, `add_call_to_folder`). Remaining: TOOL-05 `create_note` write tool (~1 hr — analogous to `tag_call` pattern, just writes to call_notes table).
