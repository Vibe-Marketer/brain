# Phase 20: Read CRUD Tools - Context (Backfilled)

**Backfilled:** 2026-05-07
**Status:** ✅ Shipped — artifacts created retroactively to reconcile GSD state with codebase reality
**Source:** Reverse-engineered from `supabase/functions/mcp-server/index.ts` and reconciliation notes in ROADMAP.md (2026-05-07)

> **Note:** This phase was implemented and shipped without going through the standard `/gsd-discuss-phase` → `/gsd-plan-phase` → `/gsd-execute-phase` pipeline. The 5 initial read tools shipped alongside Phase 18 (v2.0 MCP baseline). The remaining 13 tools were added in commit `03904178` on 2026-04-15. This CONTEXT.md is written retroactively to document the decisions actually taken so future phases (21, 22, 23) and audits have a structured reference.

<domain>
## Phase Boundary

Users' MCP clients (Claude Desktop, ChatGPT, Cursor, etc.) can search transcripts, list and filter calls, and retrieve full call details and transcript text — all scoped to the authenticated organization or workspace.

**Boundary:**
- IN SCOPE: Read-only MCP tools that surface existing CallVault data (calls, transcripts, contacts, folders, tags, speakers, notes, action items, shared links). Org/workspace isolation enforced server-side on every tool invocation.
- OUT OF SCOPE: Write tools (Phase 21), AI/LLM-powered analysis tools (Phase 22), Management UI for tool toggling (Phase 23), embedding pipeline / vector search (explicit architecture constraint — no pgvector in v2.x).

</domain>

<decisions>
## Implementation Decisions (Inferred from Shipped Code)

### Tool naming
- **D-01:** Tool names use bare verbs (`search_calls`, `list_calls`, `get_transcript`) — not the `callvault_*` prefix originally proposed. Prefix removed in commit `b98c8b94` because MCP clients already namespace by server. Tool names ARE canonical; spec text in REQUIREMENTS.md is stale.
- **D-02:** Tool names use snake_case to match MCP convention and existing tool ecosystems (e.g., Anthropic's filesystem MCP server).
- **D-03:** `search_calls` is the canonical name (not the spec's `search_transcripts`). Reasoning: it searches across titles, transcripts, summaries, tags, AND participants — "calls" reflects the broader scope.

### Org/workspace isolation
- **D-04:** Every read tool enforces token scope BEFORE executing the query. `mcpToken.scope === 'workspace'` paths are restricted to a single `workspace_id`; `'organization'` paths fan out across all org workspaces via `fetchOrgWorkspaceIds()` helper.
- **D-05:** Org-scoped `search_calls` does NOT use the `global_search` RPC — it runs a two-step query (workspace lookup → ILIKE on `recordings`) to enforce the org boundary explicitly. Reason: `global_search` is built for single-user queries and would leak rows across orgs if mis-parameterized.
- **D-06:** ILIKE special characters (`\`, `%`, `_`) are escaped before pattern construction to prevent unintended wildcard matches and SQL pattern injection. Backslash escape is applied first.

### Data shape & response format
- **D-07:** Tools return formatted plain-text strings (newline-separated key/value pairs), not JSON. Reasoning: MCP clients (Claude Desktop especially) display text content directly to the user; structured JSON would require client-side rendering and lose readability.
- **D-08:** Each call result includes: ID, Title, Date, Relevance (search only), and Summary (when available). Token-efficient — designed for LLM consumption inside MCP client context.
- **D-09:** Empty result sets return a human-readable "No calls found for query: …" message rather than an empty array. Reason: matches conversational UX of MCP clients.
- **D-10:** `get_recording_context` returns metadata + AI summary + speakers + tags in a single response — saves round-trips when the MCP client wants full context for downstream reasoning.

### Pagination & limits
- **D-11:** `list_calls` defaults to limit=20, max=100, offset=0. `search_calls` defaults to limit=10, max=50. Lower search default because relevance ranking surfaces best results early.
- **D-12:** No cursor-based pagination. Offset/limit is sufficient for MCP client UX (clients rarely paginate deep).

### Error handling
- **D-13:** Errors return JSON-RPC error envelope (`mcpError(id, code, message, corsHeaders)`) — protocol-compliant. Specific codes: `-32602` for invalid params, `-32603` for internal errors.
- **D-14:** Plan-gating errors (PRO+ required) return code `-32001` with upgrade URL — handled in Phase 19's plan-gate check, not re-implemented per tool.

### Tool inventory (final shipped set, 13 read tools)
- **D-15:** Final read-tool set after expansion (commit `03904178`):
  1. `search_calls` — keyword search with org/workspace scoping
  2. `list_calls` — paginated call list with workspace filter
  3. `get_transcript` — full transcript text by recording_id
  4. `get_recording_context` — metadata + AI summary + speakers + tags
  5. `list_workspaces` — workspaces visible to this token
  6. `list_contacts` — contacts with optional name/email search
  7. `get_contact` — single contact details
  8. `get_contact_calls` — calls associated with a contact
  9. `list_folders` — folder hierarchy
  10. `get_folder_calls` — calls in a folder
  11. `list_tags` — all tags
  12. `get_tagged_calls` — calls with a given tag (by id OR name)
  13. `list_speakers` — speakers detected across calls
  14. `get_speaker_calls` — calls featuring a given speaker
  15. `get_action_items` — cached Fathom action items per call
  16. `get_call_notes` — user notes on a call
  17. `list_shared_calls` — calls shared via share-link
- **D-16:** `semantic_search` was removed in commit `559a5626` — explicit architecture constraint that v2.x has zero embedding pipeline. AI tools in Phase 22 pass transcript text directly to LLM context.

### Spec deviations (acknowledged, not bugs)
- **D-17:** Spec called for `search_transcripts`, `get_call_details`, etc. Shipped names diverge — spec text is stale, shipped names are canonical. REQUIREMENTS.md TOOL-01..TOOL-04 should be considered satisfied by the shipped names.
- **D-18:** More tools shipped than the 4 originally specified. Bonus reads (contacts, folders, tags, speakers, notes, action items, shared calls) were added to give MCP clients enough context to be useful in real workflows. No removal needed.

</decisions>

<canonical_refs>
## Canonical References

- `supabase/functions/mcp-server/index.ts` — single-file edge function, lines 173-360 hold the read-tool definitions and case handlers. **The shipped code is the source of truth, not the spec.**
- `.planning/phases/19-provisioning-foundation/19-CONTEXT.md` — auto-provisioning, plan gating, token scoping (`organization` vs `workspace`) decisions that all Phase 20 tools rely on.
- `.planning/REQUIREMENTS.md` — TOOL-01 through TOOL-04 (note: spec names are stale; shipped names are canonical per D-01/D-17).
- `.planning/ROADMAP.md` — reconciliation note (2026-05-07) that triggered this backfill.
- `supabase/CLAUDE.md` — edge-function conventions (CORS, JWT auth, Zod validation, RLS) followed by the mcp-server function.

</canonical_refs>

<code_context>
## Reusable Patterns Established

These patterns from Phase 20 are now the default for any future MCP tool work (Phase 21 write tools, Phase 22 AI tools):

1. **Two-step org boundary query** — Resolve `org_workspace_ids` first, then filter the data query by that array. Never trust client-supplied IDs without ownership check (Phase 22 AI tools must follow this).
2. **`mcpToken.scope` branch** — Every tool case must branch on `'organization'` vs `'workspace'` and apply the appropriate filter. Skipping this branch is a security regression.
3. **`mcpOk` / `mcpError` helpers** — Use these for all responses; never construct raw `Response` objects in tool case blocks.
4. **Plain-text formatted output** — Token-efficient newline-separated key/value pairs. Reserve JSON for tools where MCP clients explicitly need structured data (e.g., `extract_action_items` in Phase 22 returning structured items array).
5. **ILIKE escaping** — Always escape `\`, `%`, `_` in user-supplied search strings before building pattern.

</code_context>

<deferred>
## Deferred Ideas (Not in This Phase)

- **Vector / semantic search** — explicit architecture constraint. v2.x has no embedding pipeline. Was implemented and removed (commit `559a5626`). If re-introduced later, requires its own milestone and a pgvector migration.
- **Cursor-based pagination** — offset/limit is sufficient for v2.x MCP UX. Revisit if a customer reports pagination depth issues.
- **Date-range / source filters on `list_calls`** — REQUIREMENTS.md TOOL-02 mentions these. Not currently parameter-exposed on the shipped `list_calls` (which only accepts `workspace_id`, `limit`, `offset`). Roadmap says this success criterion is satisfied — verify against MCP client UX before marking definitively closed; if a customer needs date filters, add as a Phase 21+ extension.

</deferred>

<spec_lock>
## Locked Requirements (Pre-Existing from REQUIREMENTS.md)

These were locked when Phase 20 originally shipped — listed here for traceability:

- **TOOL-01:** Search transcripts → satisfied by `search_calls` (D-01, D-17)
- **TOOL-02:** List & filter calls → satisfied by `list_calls` (workspace + pagination filters; date/source/tag/contact/duration filters partially exposed via dedicated tools — `get_folder_calls`, `get_tagged_calls`, `get_contact_calls`, `get_speaker_calls`)
- **TOOL-03:** Get full call details → satisfied by `get_recording_context`
- **TOOL-04:** Get full transcript → satisfied by `get_transcript`

</spec_lock>
