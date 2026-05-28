# Phase 4: MCP AI Write Tools - Context

**Gathered:** 2026-05-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 adds MCP write tools that let AI clients add already-transcribed calls/manual transcript material into an authorized CallVault workspace, then make narrow follow-up corrections. The core tool is `ingest_transcript`; supporting tools are `append_to_transcript`, `update_call_metadata`, and `set_speakers`.

This phase is not raw audio transcription, not bulk transcript ingest, not a CallVault-hosted web crawler/research agent, not a multi-vendor MCP gateway, and not an owner/admin MCP control plane. It builds on Phase 3 workspace-scoped MCP endpoints and must preserve Phase 2 MCP protocol/category-gating contracts.

</domain>

<decisions>
## Implementation Decisions

### Speaker Ambiguity

- **D-01:** `ingest_transcript` should make a best-effort pass to match supplied speaker names against existing records and the submitted metadata. Ambiguous speaker resolution must not block the ingest.
- **D-02:** The markdown response must report speaker outcomes clearly: matched, created, and unresolved/ambiguous.
- **D-03:** When key speaker data is missing, the response should include a short prompt the AI client can show the user asking for first name, last name, email, role/company, notes, or other clarifying details.
- **D-04:** Link-only or title-only imports are allowed, but they should be labeled low-context so the agent/user understands the result is minimal.
- **D-05:** Websearch, Firecrawl, browser crawling, OpenGraph enrichment, or similar research should happen agent-side for v1. Phase 4 accepts enriched fields supplied by the MCP client; it should not make CallVault's MCP server responsible for crawling/research.

### Atomic Ingest Behavior

- **D-06:** The primary success condition is that the recording/transcript lands in the authorized workspace. Non-critical enrichment failures should not roll back the recording.
- **D-07:** Tag creation, folder assignment, note creation, and speaker enrichment should report warnings in the markdown response if they fail.
- **D-08:** Planning must include explicit coverage that tag creation and lowercase/name dedup work during `ingest_transcript`.

### Provenance and Source Identity

- **D-09:** MCP-created imports should use **Manual MCP Import** as the visible source identity.
- **D-10:** Use the MCP logo/icon when available. Planning should source it from official MCP docs/GitHub first, with third-party icon sources only as fallback and license checked.
- **D-11:** Do not fragment the visible source label by client name. Preserve client/provider name, original URL/domain, and OpenGraph-derived metadata in `source_metadata` when available.
- **D-12:** Original URL/domain/OpenGraph data can enrich the import, but should not replace the main Manual MCP Import identity or make the recording look like a native connector sync.

### Follow-Up Tool Strictness

- **D-13:** `append_to_transcript`, `update_call_metadata`, and `set_speakers` should patch/merge by default.
- **D-14:** `append_to_transcript` appends transcript text instead of replacing the existing transcript.
- **D-15:** `update_call_metadata` merges supplied metadata fields instead of wiping existing metadata.
- **D-16:** `set_speakers` upserts speakers idempotently.
- **D-17:** Destructive replace/delete behavior must require an explicit caller request.

### the agent's Discretion

- Exact markdown wording is flexible, but the response must be useful to an AI client and a human reviewing the result.
- Exact schema names can be adjusted by codebase research, as long as the tool accepts partial inputs and reports created/reused/unresolved entities.
- Exact MCP icon import path can be chosen during implementation after license and asset-shape verification.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning Scope

- `.planning/ROADMAP.md` — Phase 4 goal, success criteria, sequencing constraints, and out-of-scope boundaries.
- `.planning/REQUIREMENTS.md` — MCP-04 requirement and v2 deferrals such as `bulk_ingest_transcripts`.
- `.planning/PROJECT.md` — Workstream 4 product context and key decisions.
- `.planning/STATE.md` — current milestone state and accumulated MCP decisions.
- `.planning/phases/03-per-workspace-mcp-endpoints-+-connect-to-ai/03-CONTEXT.md` — Phase 3 endpoint, grant, OAuth/manual token, and category-scope decisions that Phase 4 builds on.
- `.planning/phases/02-mcp-monolith-refactor/02-CONTEXT.md` — MCP protocol, auth, result-shape, category-gating, and behavior-preservation boundaries.

### MCP Server and Existing Write Pattern

- `supabase/functions/mcp-server/tools/_types.ts` — `ToolModule`, `ToolHandlerContext`, `McpToken`, and MCP result types.
- `supabase/functions/mcp-server/tools/registry.ts` — current modular tool registration pattern.
- `supabase/functions/mcp-server/tools/definitions.ts` — current tool schema list that new definitions must extend.
- `supabase/functions/mcp-server/tools/write/_access.ts` — recording access helper used by write tools.
- `supabase/functions/mcp-server/tools/write/rename_call.ts` — simple write-tool mutation pattern.
- `supabase/functions/mcp-server/tools/write/create_note.ts` — workspace-scoped write and explicit workspace validation pattern.
- `supabase/functions/mcp-server/tools/write/tag_call.ts` — tag access and upsert pattern to extend or replace with name-based resolution.
- `docs/operations/mcp-runbook.md` — MCP production runbook and `content[].text` response contract.

### Ingest and Manual Import Pipeline

- `supabase/functions/_shared/connector-pipeline.ts` — shared `runPipeline()` / `insertRecording()` path, workspace entry creation, routing, and transcript speaker participant handling.
- `supabase/functions/save-pasted-transcript/index.ts` — existing manual import path that should inform `ingest_transcript` behavior.
- `supabase/functions/_shared/canonical-recording.ts` — canonical connector record shape and metadata conventions.

### Data Model and Tests

- `supabase/migrations/20260310125000_migrate_call_recording_id_to_uuid.sql` — UUID migration and `call_speakers` uniqueness/RLS behavior.
- `src/test/rls-regression.test.ts` — RLS regression gate patterns.
- `supabase/functions/mcp-server/__tests__/category-gating.test.ts` — category visibility/enforcement invariants.
- `supabase/functions/mcp-server/__tests__/write-tools-boundary.test.ts` — current write-tool boundary coverage; add Phase 4 cases here or adjacent.
- `supabase/functions/mcp-server/__tests__/contract-surface.test.ts` — MCP tool surface contract coverage.

### External Asset Reference

- `https://raw.githubusercontent.com/modelcontextprotocol/modelcontextprotocol/main/docs/favicon.svg` — official MCP docs favicon SVG candidate for the Manual MCP Import source icon.
- `https://github.com/modelcontextprotocol/modelcontextprotocol` — official MCP specification/docs repository; MIT licensed.
- `https://commons.wikimedia.org/wiki/File:Model_Context_Protocol_logo.svg` — fallback/reference source only; verify license and origin before using.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `supabase/functions/mcp-server/tools/_types.ts`: new tools should export `ToolModule` and return `mcpOk` / `mcpError` markdown envelopes.
- `supabase/functions/mcp-server/tools/registry.ts`: add new write tools to the extracted registry rather than editing a monolithic switch.
- `supabase/functions/mcp-server/tools/write/_access.ts`: reuse or extend for workspace/org-scoped recording access checks.
- `supabase/functions/_shared/connector-pipeline.ts`: `runPipeline()` already inserts canonical `recordings` rows and workspace entries, and should be the baseline path for `ingest_transcript`.
- `supabase/functions/save-pasted-transcript/index.ts`: existing manual transcript path already normalizes partial manual input and calls `runPipeline()`.

### Established Patterns

- MCP remains one Edge Function with internal tool modules.
- `tools/list` must filter by `token.enabled_categories`; read-only tokens must not see Phase 4 write tools.
- Tool-call results must return `content[].text` markdown, not structured JSON.
- Workspace-scoped tokens write only to their workspace; organization-scoped tokens must supply an authorized `workspace_id`.
- New data access must preserve UUID recording IDs and avoid legacy BIGINT coercion.

### Integration Points

- Add `ingest_transcript`, `append_to_transcript`, `update_call_metadata`, and `set_speakers` in `supabase/functions/mcp-server/tools/write/`.
- Extend `supabase/functions/mcp-server/tools/definitions.ts` with input schemas that accept partial metadata and name-based tag/speaker inputs.
- Use `source_metadata` for Manual MCP Import provenance, client/provider identity, original URL/domain, OpenGraph metadata, low-context markers, and created/reused/unresolved entity summaries.
- Add focused tests for tag-name creation/dedup, speaker ambiguity reporting, workspace-scope enforcement, category filtering, and markdown result shape.

</code_context>

<specifics>
## Specific Ideas

- The response should tell the client what CallVault captured from metadata and what the user could provide next.
- The AI client can ask the user for richer details after a first pass; CallVault should provide the prompt text rather than silently accepting poor data.
- A minimal link/title-only ingest is acceptable, but should be presented as low-context.
- Use the MCP logo for Manual MCP Import when the asset can be sourced cleanly.

</specifics>

<deferred>
## Deferred Ideas

- CallVault-hosted websearch, Firecrawl, OpenGraph crawling, browser enrichment, or similar automated research for MCP ingest belongs in a separate enrichment phase if promoted later.
- `bulk_ingest_transcripts` remains v2.
- Raw audio/file upload transcription remains v2 and outside this phase.
- Admin-scoped MCP control-plane behavior remains a future/admin-specific connection type, not normal Phase 4 write-tool behavior.

</deferred>

---

*Phase: 04-MCP AI Write Tools*
*Context gathered: 2026-05-28*
