# Phase 04: mcp-ai-write-tools - Research

**Researched:** 2026-05-29
**Domain:** CallVault MCP write-tool expansion on modular Supabase Edge Function
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

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

### Deferred Ideas (OUT OF SCOPE)

- CallVault-hosted websearch, Firecrawl, OpenGraph crawling, browser enrichment, or similar automated research for MCP ingest belongs in a separate enrichment phase if promoted later.
- `bulk_ingest_transcripts` remains v2.
- Raw audio/file upload transcription remains v2 and outside this phase.
- Admin-scoped MCP control-plane behavior remains a future/admin-specific connection type, not normal Phase 4 write-tool behavior.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MCP-04 | MCP write tools for composite ingest + atomic transcript/metadata/speaker updates with scope/category enforcement | Tool registry/definition extension path, workspace/org scope pattern reuse, pipeline reuse (`runPipeline`), category map updates, and contract/security test gates below [VERIFIED: codebase grep] |
</phase_requirements>

## Summary

Phase 4 should be implemented as four new `write` tools inside the existing modular MCP server (`supabase/functions/mcp-server/tools/write/*.ts`) and wired via existing `registry.ts` + `definitions.ts` patterns, not by adding new edge functions or bypass paths. [VERIFIED: codebase grep] The current server already enforces bearer auth, workspace audience, paid-plan gate, and category gate before tool dispatch; this phase should plug directly into that pipeline. [VERIFIED: codebase grep]

The fastest/lowest-risk ingestion seam is to reuse `runPipeline()` from `_shared/connector-pipeline.ts` for the recording insert + workspace entry creation behavior, then perform non-critical enrichments (tags, note, speakers, metadata merge) as best-effort with warnings reported in markdown response text. [VERIFIED: codebase grep] This directly satisfies D-06/D-07 atomicity and avoids hand-rolling data writes already solved in manual transcript imports. [VERIFIED: codebase grep]

**Primary recommendation:** Implement `ingest_transcript` as a composite orchestrator that calls `runPipeline()` first, then executes idempotent enrichment substeps with warning aggregation; implement the other three tools as strict single-action patch/upsert tools returning `mcpOk` markdown summaries. [VERIFIED: codebase grep]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| MCP auth + workspace audience + category gating | API / Backend | — | Already implemented in `mcp-server` auth/gating path and must remain server-authoritative. [VERIFIED: codebase grep] |
| Composite transcript ingest | API / Backend | Database / Storage | Input validation, scope checks, and pipeline orchestration occur in edge function; persistence is Postgres. [VERIFIED: codebase grep] |
| Tag/name/speaker resolution and upsert | API / Backend | Database / Storage | Resolution logic belongs in tool handlers; uniqueness/dedup constraints enforced by DB indexes/PKs. [VERIFIED: codebase grep] |
| Provenance metadata capture (`Manual MCP Import`) | API / Backend | Database / Storage | Built into `source_metadata` at write time to keep MCP result canonical. [VERIFIED: codebase grep] |
| Markdown result contract (`content[].text`) | API / Backend | — | `mcpOk` helper is the shared response boundary. [VERIFIED: codebase grep] |

## Project Constraints (from AGENTS.md)

- One `mcp-server` edge function only; internal module split only. [VERIFIED: codebase grep]
- MCP tool results must stay `content[].text` markdown. [VERIFIED: codebase grep]
- `tools/list` visibility must remain filtered by `token.enabled_categories`. [VERIFIED: codebase grep]
- Use custom MCP auth flow (`authenticateMcpRequest`) and keep scope/audience checks server-side. [VERIFIED: codebase grep]
- Preserve UUID boundaries and avoid ad-hoc ID coercions (`toRecordingUuid` rule remains project-wide). [VERIFIED: AGENTS.md]
- npm-only workflow, no frontend AI logic, direct-main operational mode. [VERIFIED: AGENTS.md]

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | 2.106.2 | Edge-function DB/auth client for service-role operations | Already used by `mcp-server` and shared pipeline. [VERIFIED: npm registry] |
| `zod` | 4.4.3 | Input validation schemas for tool arguments | Existing codebase pattern for strong request validation in edge functions. [VERIFIED: npm registry] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `ai` | 6.0.193 | Existing AI tooling dependency | Not required for these write tools; keep unchanged. [VERIFIED: npm registry] |
| `@openrouter/ai-sdk-provider` | 2.9.0 | Existing AI provider dependency | Not required for these write tools; keep unchanged. [VERIFIED: npm registry] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reusing `runPipeline()` | New bespoke insert path in `ingest_transcript` | Higher drift/bug risk; duplicates routing, dedup, workspace-entry logic. [VERIFIED: codebase grep] |
| Modular write tools | New edge function(s) for ingestion | Violates one-function MCP architecture constraint. [VERIFIED: AGENTS.md] |

**Installation:**
```bash
# No new package install required for Phase 4 implementation.
```

## Package Legitimacy Audit

No new external package is required by this phase. Existing packages relevant to MCP server validation:

| Package | Registry | slopcheck | Disposition |
|---------|----------|-----------|-------------|
| `@supabase/supabase-js` | npm | OK | Existing dependency; unchanged |
| `zod` | npm | OK | Existing dependency; unchanged |
| `ai` | npm | OK | Existing dependency; unchanged |
| `@openrouter/ai-sdk-provider` | npm | OK | Existing dependency; unchanged |

**Packages removed due to slopcheck [SLOP] verdict:** none  
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```text
MCP Client (tools/call)
  -> mcp-server/index.ts
    -> authenticateMcpRequest (manual token or OAuth grant + audience check)
    -> enforcePlanGate
    -> enforceCategoryGate (write)
    -> registry dispatch (write tool handler)
      -> validate args + scope target workspace
      -> ingest_transcript: runPipeline() first
        -> recordings insert + workspace_entries + participant trigger effects
      -> best-effort enrichments (tags/note/speakers/metadata merge)
      -> mcpOk markdown result (created/reused/warnings)
    -> JSON-RPC response
```

### Recommended Project Structure
```text
supabase/functions/mcp-server/
├── tools/
│   ├── definitions.ts          # add 4 tool schemas
│   ├── registry.ts             # register 4 new write tool modules
│   └── write/
│       ├── ingest_transcript.ts
│       ├── append_to_transcript.ts
│       ├── update_call_metadata.ts
│       ├── set_speakers.ts
│       └── _ingest_helpers.ts  # optional shared normalization/resolution helpers
└── __tests__/
    ├── contract-surface.test.ts
    ├── category-gating.test.ts
    ├── write-tools-boundary.test.ts
    └── workspace-scope.integration.test.ts
```

### Pattern 1: Tool Module Contract
**What:** Each tool exports `{ definition, category, handler }` and returns `mcpOk`/`mcpError`. [VERIFIED: codebase grep]  
**When to use:** All new MCP tools.

### Pattern 2: Workspace Target Resolution
**What:** For workspace token: fixed workspace, reject mismatched `workspace_id`; for org token: require explicit `workspace_id` and verify org ownership. [VERIFIED: codebase grep]  
**When to use:** `ingest_transcript` and any tool mutating workspace-scoped data.

### Pattern 3: Pipeline-First Ingest
**What:** Create recording via `runPipeline()` first, then run non-critical enrichments with warning aggregation. [VERIFIED: codebase grep]  
**When to use:** `ingest_transcript`.

### Anti-Patterns to Avoid
- **Hand-rolled recording insert path:** bypasses dedup/routing/entry behavior already in pipeline. [VERIFIED: codebase grep]
- **Returning structured JSON in tool result:** breaks runbook contract; tool output must remain markdown text block. [VERIFIED: codebase grep]
- **Adding public/introspectable write tools without category map updates:** causes category gate mismatch or exposure drift. [VERIFIED: codebase grep]

## Don’t Hand-Roll

| Problem | Don’t Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Recording + workspace placement | New insert orchestration from scratch | `_shared/connector-pipeline.ts::runPipeline()` | Handles dedup/re-import/workspace-entry/routing conventions already. [VERIFIED: codebase grep] |
| Tool response envelope | Custom JSON-RPC writer per tool | `mcpOk`/`mcpError` helpers | Preserves `content[].text` protocol contract and test anchors. [VERIFIED: codebase grep] |
| Scope enforcement | Per-tool ad-hoc org/workspace SQL everywhere | Existing workspace/org target pattern used in `create_note` / `import_youtube_video` | Reduces auth bugs and mismatch handling drift. [VERIFIED: codebase grep] |

**Key insight:** The phase is mostly orchestration/composition of existing primitives; reliability depends on reusing existing guardrails rather than introducing new pathways. [VERIFIED: codebase grep]

## Common Pitfalls

### Pitfall 1: Category Map Drift
**What goes wrong:** Tool exists in `definitions.ts` but missing from `TOOL_CATEGORIES`, causing gate failures or hidden-tool confusion.  
**How to avoid:** Update `TOOL_CATEGORIES` and description map with each new tool; extend contract tests.

### Pitfall 2: Workspace Scope Violations
**What goes wrong:** Org token writes without explicit/authorized workspace, or workspace token writes across workspace boundary.  
**How to avoid:** Reuse explicit scope checks before any DB mutation.

### Pitfall 3: Name-Based Dedup Ambiguity
**What goes wrong:** Tags/speakers duplicated due to case/partial identity issues.  
**How to avoid:** Normalize lowercase keys for tag lookup; implement speaker resolution tiers (email exact > full-name exact > unresolved list).

### Pitfall 4: Over-failing Composite Ingest
**What goes wrong:** One enrichment failure aborts entire ingestion despite D-06.  
**How to avoid:** Make enrichment substeps non-fatal; aggregate warnings into markdown response.

## Code Examples

### Existing Workspace Scope Gate Pattern (`create_note`)
```typescript
if (mcpToken.scope === 'workspace') {
  targetWorkspaceId = mcpToken.workspace_id!;
  if (explicitWorkspaceId && explicitWorkspaceId !== targetWorkspaceId) {
    return mcpError(id, -32602, 'workspace_id does not match the workspace this token is scoped to', corsHeaders);
  }
} else {
  if (!explicitWorkspaceId) {
    return mcpError(id, -32602, 'workspace_id is required for organization-scoped tokens', corsHeaders);
  }
}
```
Source: `supabase/functions/mcp-server/tools/write/create_note.ts` [VERIFIED: codebase grep]

### Existing Markdown Result Contract
```typescript
return Response.json({
  jsonrpc: '2.0',
  id,
  result: { content: [{ type: 'text', text }] },
});
```
Source: `supabase/functions/mcp-server/protocol.ts` [VERIFIED: codebase grep]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Monolithic switch-heavy MCP handler | Registry + per-tool modules | Phase 2 completion | New write tools should be added as modules, not in a monolith. [VERIFIED: codebase grep] |
| Org-only MCP assumptions | Workspace-path audience-bound MCP + OAuth client grants | Phase 3 completion | Phase 4 must enforce workspace audience and category scopes as baseline. [VERIFIED: codebase grep] |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `ingest_transcript` should use `runPipeline()` without schema changes | Architecture Patterns | Medium: may need minor schema helper migration if unobserved constraints appear |

## Open Questions (RESOLVED)

1. **Speaker storage target for `set_speakers`: resolved to `call_participants` as canonical.**
   - Evidence: `supabase/migrations/20260309120000_call_participants.sql` names `call_participants` the "single source of truth for who participated in each call" and explicitly lists transcript speaker parsing plus manual additions as inputs. [VERIFIED: codebase grep]
   - Evidence: MCP read tools (`list_speakers`, `get_speaker_calls`, `get_recording_context`) and primary UI/detail/contact/filter paths read `call_participants`. [VERIFIED: codebase grep]
   - Evidence: `call_speakers` still has UUID FK/RLS and is read by `useCallAnalytics`, so it remains a legacy/analytics compatibility surface, not the canonical identity target. [VERIFIED: codebase grep]
   - Decision: Phase 04 `set_speakers` and `ingest_transcript` should upsert `call_participants` rows as the canonical speaker/participant state. During implementation, if the touched analytics path still requires `call_speakers`, add a bounded compatibility mirror for those rows or explicitly document why analytics remains unaffected; do not leave the canonical target undecided.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `node` | local tests/build scripts | ✓ | v26.0.0 | — |
| `npm` | package/test scripts | ✓ | 11.12.1 | — |
| `deno` | edge-function checks | ✓ | 2.6.10 | — |
| `supabase` CLI | local function workflows/types | ✓ | 2.101.0 | — |

**Missing dependencies with no fallback:** none  
**Missing dependencies with fallback:** none

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.16 [VERIFIED: package.json] |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test -- supabase/functions/mcp-server/__tests__/contract-surface.test.ts supabase/functions/mcp-server/__tests__/category-gating.test.ts supabase/functions/mcp-server/__tests__/write-tools-boundary.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MCP-04 | New tools appear in contract surface and category map | unit/contract | `npm test -- supabase/functions/mcp-server/__tests__/contract-surface.test.ts` | ✅ |
| MCP-04 | Read-only tokens cannot call or list write tools | unit/contract | `npm test -- supabase/functions/mcp-server/__tests__/category-gating.test.ts` | ✅ |
| MCP-04 | Workspace/org scope enforcement on writes | integration/contract | `npm test -- supabase/functions/mcp-server/__tests__/workspace-scope.integration.test.ts` | ✅ |
| MCP-04 | Ingest partial failures return warnings but persist recording | unit/integration | `npm test -- supabase/functions/mcp-server/__tests__/write-tools-boundary.test.ts` | ✅ (extend required) |

### Sampling Rate
- **Per task commit:** targeted `mcp-server` tests above
- **Per wave merge:** `npm test`
- **Phase gate:** `npm test` + `npm run build`

### Wave 0 Gaps
- [ ] `supabase/functions/mcp-server/__tests__/ingest-transcript.integration.test.ts` — end-to-end ingest success + warning-mode behavior
- [ ] `supabase/functions/mcp-server/__tests__/set-speakers.idempotency.test.ts` — repeated same payload has stable result
- [ ] `supabase/functions/mcp-server/__tests__/write-tools-boundary.test.ts` extension — tag dedupe by lowercase name + ambiguous speaker reporting assertions

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `authenticateMcpRequest` bearer validation + revoked checks [VERIFIED: codebase grep] |
| V3 Session Management | yes | Token/grant revocation + `last_used_at` audit updates [VERIFIED: codebase grep] |
| V4 Access Control | yes | Workspace audience enforcement + category gate + plan gate before dispatch [VERIFIED: codebase grep] |
| V5 Input Validation | yes | Zod/tool argument validation and strict required fields [VERIFIED: codebase grep] |
| V6 Cryptography | yes | Token format and secure random prefixed token generation in DB migration [VERIFIED: codebase grep] |

### Known Threat Patterns for Supabase Edge MCP Write Tools

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-workspace write escalation | Elevation of Privilege | Enforce workspace audience + org membership checks before mutation |
| Category bypass (read token performing write) | Elevation of Privilege | Keep `TOOL_CATEGORIES` complete and gate on `enabled_categories` |
| Metadata injection / oversized payload abuse | Tampering / DoS | Strict schema limits and bounded text sizes |
| Inference leakage via tools/list | Information Disclosure | Continue filtering tool visibility by category before returning tools |

## Sources

### Primary (HIGH confidence)
- Internal codebase files (authoritative implementation):
  - `supabase/functions/mcp-server/index.ts`
  - `supabase/functions/mcp-server/auth.ts`
  - `supabase/functions/mcp-server/gating.ts`
  - `supabase/functions/mcp-server/protocol.ts`
  - `supabase/functions/mcp-server/tools/{definitions,registry,_types}.ts`
  - `supabase/functions/mcp-server/tools/write/{_access,create_note,rename_call,tag_call,untag_call,import_youtube_video}.ts`
  - `supabase/functions/_shared/connector-pipeline.ts`
  - `supabase/functions/save-pasted-transcript/index.ts`
  - `supabase/functions/_shared/canonical-recording.ts`
  - `supabase/functions/mcp-server/__tests__/*`
  - `supabase/migrations/{20260306000000_personal_organization_and_home.sql,20260309120000_call_participants.sql,20260310125000_migrate_call_recording_id_to_uuid.sql,20260528163000_mcp_oauth_client_grants_and_prefixed_tokens.sql}`
- AGENTS constraints:
  - `/Users/admin/dev/brain/AGENTS.md`

### Secondary (MEDIUM confidence)
- MCP official repository (logo/license reference): https://github.com/modelcontextprotocol/modelcontextprotocol [CITED: github.com/modelcontextprotocol/modelcontextprotocol]
- MCP docs favicon candidate: https://raw.githubusercontent.com/modelcontextprotocol/modelcontextprotocol/main/docs/favicon.svg [CITED: raw.githubusercontent.com/modelcontextprotocol/modelcontextprotocol/main/docs/favicon.svg]

### Tertiary (LOW confidence)
- none

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - existing repo stack and npm registry versions verified.
- Architecture: HIGH - direct code-path inspection of current modular MCP/write and pipeline seams.
- Pitfalls: HIGH - derived from existing gate/tests/schema constraints and prior phase contracts.

**Research date:** 2026-05-29  
**Valid until:** 2026-06-28
