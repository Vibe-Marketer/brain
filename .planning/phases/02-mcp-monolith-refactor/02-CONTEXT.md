# Phase 02: MCP Monolith Refactor - Context

**Gathered:** 2026-05-27
**Status:** Ready for planning
**Source:** `$gsd-discuss-phase 2` text-mode discussion plus MCP Phase 2 forensics

<domain>
## Phase Boundary

Phase 2 refactors the existing production MCP server internals while preserving externally observable MCP behavior.

The active baseline is the restored monolith at `supabase/functions/mcp-server/index.ts`, matching `origin/main` and production behavior. The prior generated modular refactor from commit `83693443` was investigated, found unsafe, reverted locally in `b465f351`, and must not be used as the implementation base.

This phase is not allowed to add per-workspace endpoint UX, new MCP write tools, or a split into multiple Edge Functions. Those belong to later phases.
</domain>

<decisions>
## Implementation Decisions

### D-01: Baseline Source of Truth

- Start from the restored production monolith in `supabase/functions/mcp-server/index.ts`.
- Treat `origin/main` and production behavior as the reference implementation for parity.
- Treat `.planning/forensics/stale-prior-run-2026-05-27/phase-02/` and commit `83693443` as forensic evidence only, not active implementation artifacts.

### D-02: Revert Rationale

- The prior Phase 2 modular refactor was reverted because it was not behavior-proven and introduced a likely auth regression.
- The specific failure to avoid: extracting MCP auth in a way that uses an anon Supabase client for `mcp_tokens` lookup. `mcp_tokens` lookup must retain the service-role boundary because MCP hex tokens are not Supabase JWTs and RLS only allows `user_id = auth.uid()`.

### D-03: Auth Boundary

- MCP supports two bearer-token families:
  - 64-character legacy hex MCP tokens from `mcp_tokens`.
  - Supabase OAuth JWTs bound through `mcp_oauth_org_bindings`.
- Hex MCP token lookup must use the service-role Supabase client.
- JWT validation must use an anon/auth client via Supabase Auth.
- Do not replace custom MCP auth with `_shared/auth.ts::authenticateRequest()`. The MCP server remains a custom OAuth/MCP-auth exception.

### D-04: Behavior Parity Gate

- The refactor is not acceptable unless existing tool behavior is proven against the monolith.
- Planning must include a fixture replay or equivalent golden-master gate for the current MCP tool surface.
- The gate must include protocol methods (`initialize`, `tools/list`) and representative `tools/call` paths across read, write, admin, and AI categories.
- Any intentional behavior change must be explicitly called out as out-of-scope unless the roadmap already requires it.

### D-05: MCP Contract Safety

- Preserve `content[].text` markdown for all tool-call results.
- Preserve structured JSON only for protocol-level `initialize` and `tools/list`.
- Preserve `tools/list` filtering by `token.enabled_categories`.
- Preserve wildcard CORS for MCP/OAuth discovery endpoints.
- Preserve HTTP 401 plus `WWW-Authenticate` behavior for unauthenticated or invalid bearer requests.
- Preserve plan gating order: valid token -> protocol methods -> paid-plan gate -> category gate -> tool dispatch.

### D-06: Tool Count and Registry Reality

- The roadmap says 36 tools, but production currently exposes 41 tools.
- Planning must audit the current `TOOLS` / `TOOL_CATEGORIES` / output-schema surface and plan against the actual current tool count, not the stale 36-tool wording.
- If a mismatch is found between roadmap wording and current code, the plan must preserve current code behavior and document the count mismatch.

### D-07: Deno Type Gate

- `deno check supabase/functions/mcp-server/index.ts` fails on the restored monolith with existing type-level issues around Supabase join typing and esm.sh AI SDK/Zod/provider type drift.
- This is not an emergency before Phase 2 because production currently works and targeted MCP tests pass.
- Phase 2 planning must include a task to either make the relevant Deno/Edge type check pass or define a reliable replacement type gate for this Edge Function before accepting the refactor.

### D-08: Dynamic AI Dependency Loading

- The phase still needs to remove AI SDK / OpenRouter imports from the non-AI hot path.
- The desired final shape is one Edge Function with internal tool modules and dynamic import of AI handlers/dependencies only when AI tools are called.
- Do not split `mcp-server` into separate Edge Functions.

### D-09: Cold-Start Evidence

- The >=30% cold-start improvement must be measured, not asserted.
- Planning must include baseline capture from the current monolith and post-refactor measurement on the deployed candidate, with enough detail to reproduce the measurement.
- If real deployed cold-start measurement cannot be completed in the execution environment, the phase cannot be marked fully verified.

### D-10: Test Expectations

- Existing targeted MCP tests are mandatory gates:
  - `supabase/functions/mcp-server/__tests__/category-gating.test.ts`
  - `supabase/functions/mcp-server/__tests__/ai-tools-invariants.test.ts`
  - `supabase/functions/mcp-server/__tests__/write-tools-boundary.test.ts`
- A valid real token must be able to call production/deployed-candidate `initialize`, `tools/list`, and at least one read tool before the phase is considered safe.
- `npm run build` remains required before push because this phase touches `supabase/functions/mcp-server/index.ts`.

### D-11: Revert Is Already Applied

- Local commit `b465f351` reverted the unsafe Phase 2 modular refactor and restored the monolith.
- Current planning must not re-revert or recover generated modules from `83693443`.
- If the planner wants to inspect the old refactor, it may do so only to identify pitfalls and tests to avoid repeating.
</decisions>

<canonical_refs>
## Canonical References

Downstream agents MUST read these before planning or implementing.

### Project Scope and Requirements

- `.planning/PROJECT.md` — milestone decisions and MCP workstream context.
- `.planning/REQUIREMENTS.md` — MCP-05 requirement and out-of-scope boundaries.
- `.planning/ROADMAP.md` — Phase 2 goal, sequencing constraints, and success criteria.
- `.planning/STATE.md` — current phase position and workflow state.

### Forensics and Recovery

- `.planning/forensics/report-20260527T221622Z-mcp-phase2-refactor.md` — why prior Phase 2 refactor was unsafe and reverted.
- `.planning/forensics/stale-prior-run-2026-05-27/phase-02/02-VERIFICATION.md` — archived partial prior verification; evidence only.

### MCP Source and Contracts

- `supabase/functions/mcp-server/index.ts` — restored production monolith and parity baseline.
- `supabase/functions/_shared/mcp-tool-categories.ts` — canonical category map for `tools/list` and dispatch gating.
- `docs/operations/mcp-runbook.md` — production MCP URLs, discovery behavior, and response-shape contract.
- `supabase/CLAUDE.md` — Edge Function rules and backend constraints.
- `CLAUDE.md` — repository-wide hard constraints.

### MCP Tests

- `supabase/functions/mcp-server/__tests__/category-gating.test.ts` — category gating and auth-order invariants.
- `supabase/functions/mcp-server/__tests__/ai-tools-invariants.test.ts` — AI tool usage/cost/cache invariants.
- `supabase/functions/mcp-server/__tests__/write-tools-boundary.test.ts` — write-tool boundary invariants.
</canonical_refs>

<specifics>
## Specific Ideas

- Prefer an incremental module extraction that keeps auth and top-level protocol handling intact until parity fixtures are in place.
- Prefer moving one tool family at a time with replay coverage, rather than a single generated all-tools extraction.
- Keep `mcp-server/index.ts` under 300 LOC only after behavior parity is proven; LOC reduction is not a substitute for behavior proof.
- Any helper extraction must preserve service-role data access where the MCP token itself is the access-control boundary.
</specifics>

<deferred>
## Deferred Ideas

- Per-workspace MCP endpoint paths and Connect-to-AI UX belong to Phase 3.
- New AI write tools such as `ingest_transcript`, `append_to_transcript`, `update_call_metadata`, and `set_speakers` belong to Phase 4.
- Replacing CallVault MCP with a multi-vendor MCP gateway remains out of scope.
</deferred>

---

*Phase: 02-mcp-monolith-refactor*
*Context gathered: 2026-05-27 via text-mode discussion and forensics*
