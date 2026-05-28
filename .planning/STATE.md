---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: Self-Serve Public Launch
status: executing
last_updated: "2026-05-28T08:33:12.563Z"
progress:
  total_phases: 6
  completed_phases: 1
  total_plans: 13
  completed_plans: 8
  percent: 62
---

# STATE — CallVault Self-Serve Public Launch

**Last updated:** 2026-05-28

---

## Project Reference

**Project:** CallVault — Self-Serve Public Launch milestone
**Repo:** `/Users/admin/dev/brain` (single source; `callvault/` is abandoned)
**Production:** https://app.callvaultai.com (Vercel, auto-deploys from `main`)
**MCP endpoint:** https://api.callvaultai.com/mcp (Cloudflare Worker → Supabase Edge Function)

**Core value:** A team can centralize every call from every source into workspace-scoped vaults that an AI agent can both read from AND write into — and the experience is reliable enough that a stranger off the internet can wire it up themselves without help.

**Current focus:** Phase 2 MCP Monolith Refactor is executing. Plans 02-01 through 02-03 are complete; next action is 02-04 remaining read-tool extraction.

---

## Current Position

Phase: 02 (mcp-monolith-refactor) — EXECUTING
Plan: 4 of 8
**Milestone:** CallVault — Self-Serve Public Launch
**Phase:** Phase 2 — MCP Monolith Refactor
**Plan:** 3/8 active plans complete
**Status:** Executing Phase 02

**Progress:**

```text
[██████----] 62%
Phases:  [x][ ][ ][ ][ ][ ]   1/6 complete
Plans:   [x][x][x][ ][ ][ ][ ][ ] 3/8 active phase plans complete
```

---

## Performance Metrics

(Will populate as phases run.)

- Cycle time per plan: —
- Plans completed per phase: —
- Verification-pass rate: —

---

## Accumulated Context

### Key Decisions

- **Launch target = self-serve public** (not private beta). Strangers must succeed without hand-holding. Sets the bar for empty states, billing, support, and connector reliability.
- **Multi-MCP = per-workspace CallVault endpoints**, NOT multi-vendor gateway. Aggregating external MCPs (Linear/Slack/Notion) is a different product story.
- **MCP monolith refactor is included in this milestone** (Phase 2). The refactor remains one Edge Function with internal tool modules.
- **One Edge Function for `mcp-server`** retained through refactor (Supabase "fat function" guidance — splitting multiplies cold-start tax).
- **Path-based per-workspace MCP URLs** (`/mcp/w/{uuid}`), not subdomain, not query parameter. Notion/Linear/Cloudflare pattern; RFC 8707 compliant.
- **Phase 3 MCP setup lives in Connectors, not an "AI connectors" silo.** OAuth is the primary setup path; token/manual config is the fallback; snippets use `https://api.callvaultai.com/mcp/w/{workspace_uuid}` and never the raw Supabase function URL.
- **Per-workspace MCP URLs use workspace UUIDs for v1.** This preserves configured clients when a workspace is renamed; friendly slugs remain v2-only unless explicitly promoted.
- **Multiple MCP connections per org are required.** Token management must support active org-scoped and workspace-scoped tokens with different enabled category scopes.
- **MCP write tools must support manual vault addition.** Phase 4 `ingest_transcript` adds an already-transcribed/manual call into an authorized workspace; org-scoped tokens choose an authorized workspace, workspace-scoped tokens cannot write outside their bound workspace.
- **MCP organization/workspace creation is admin-gated.** Existing `create_organization` and `create_workspace` tools remain available only to tokens/connections with the `admin` category enabled.
- **Owner/admin MCP account control plane is deferred.** The idea of an owner-scoped MCP that can create clients/workspaces, invite users, mint scoped MCP connections, and configure token/API-key settings is captured in the roadmap backlog as a Maybe Someday item after the launch sequence.
- **Integration tests for `save-pasted-transcript` MUST hit real Supabase** (not mocked) — CONCERNS Phase 30 / BUG-01 precedent.
- **Scope change 2026-05-27: File upload + async transcription deferred to v2.** CallVault is not becoming a transcription service in the launch milestone. Paste/transcript import is the v1 manual import path. `file-upload-transcribe` stays deployed but user-facing audio/video upload UI is hidden.
- **Phase 1 fresh context adds Loom and Markdown.** Manual transcript import supports Loom, VTT, SRT, Otter TXT, Fathom copy, raw text, and `.md` transcript inputs. The user-facing entry label is **Import Transcript**.

### Decisions Needed

No open product decisions for Phase 1 after `01-CONTEXT.md`; downstream planning must translate those decisions into executable plans.

Active roadmap questions for later phases remain in `.planning/ROADMAP.md` under "Decisions Needed".

### Todos

- Continue `$gsd-execute-phase 2` from `.planning/phases/02-mcp-monolith-refactor/02-04-PLAN.md`.
- Do not use archived stale Phase 2 refactor artifacts as implementation inputs.
- Before shipping Phase 1 publicly, configure seeded `TEST_USER_*` / org fixtures if real-Supabase integration execution is required instead of the current explicit skip.

### Blockers

- Phase 1 code execution is complete. Remaining verification limitations: real-Supabase integration suite skipped without seeded test user/org credentials, and Interceptor browser control timed out because Chrome/Brave did not respond to `tab_create`.
- Phase 2 Plans 02-01 through 02-03 are complete. Execution verification still requires remaining extraction tests, `npm run build` after touching `mcp-server/index.ts`, valid-token live smoke, and deployed cold-start measurement.

### Phase-Spanning Knowledge

Binding fragile surfaces (must respect in every phase):

- **Recording ID dual system.** UUID `recordings.id` vs legacy BIGINT `recordings.legacy_recording_id`. Always route through `toRecordingUuid()` / `toRecordingUuidBatch()` in `src/lib/recording-ids.ts`. Never `parseInt()`, `Number()`, or string coercion.
- **`recordings.share_url` is not a top-level column.** Always use `resolveShareUrl()` from `src/lib/recording-source-url.ts`.
- **`source-registry.ts` `oauthCallbackFunctionName` entries are critical boot-time artifacts.** Missing entries crash React mount. Run `npm run build` against the committed tree before every push during refactors.
- **MCP tool result shape: `content[].text` markdown.** NOT structured JSON.
- **`tools/list` filtered by `token.enabled_categories`.** Information disclosure otherwise.
- **`mcp_tokens` schema already supports workspace scope.**
- **`authenticateRequest(req, supabase, corsHeaders)`** from `_shared/auth.ts` for all Edge Function auth. Never inline.
- **`invalidateCallListCaches(queryClient)` in every mutation `onSettled`.**

---

## Session Continuity

### Last session

- **Date:** 2026-05-28
- **Activity:** `$gsd-plan-phase 2` produced a fresh Phase 2 MCP monolith refactor plan set from `02-CONTEXT.md`, `02-RESEARCH.md`, and the MCP refactor forensics report.
- **Outcome:** Phase 2 now has 8 execution plans covering parity harnesses, auth/protocol/gating extraction, registry dispatch, read/write/admin/AI tool modules, dynamic AI imports, final `index.ts` trim, live smoke, and cold-start proof. Plan 02-01 added the baseline guardrails and passed 37 focused tests. Plan 02-02 extracted protocol/auth/gating helpers and passed 143 targeted MCP tests plus `npm run build`. Plan 02-03 added registry dispatch and extracted five read tools with 32 targeted tests plus `npm run build`.

### Next session

- **Trigger:** Continue `$gsd-execute-phase 2`
- **Action:** Execute Phase 2 from `.planning/phases/02-mcp-monolith-refactor/02-04-PLAN.md` through `02-08-PLAN.md`, preserving the restored monolith as the baseline and proving behavior through targeted MCP tests plus live/cold-start checks.

### Files of Record

- `.planning/PROJECT.md` — project context, 4 workstreams, Key Decisions, Out of Scope
- `.planning/REQUIREMENTS.md` — v1 requirements traced to phases 1–6
- `.planning/ROADMAP.md` — 6-phase plan + sequencing + active Decisions Needed
- `.planning/phases/01-paste-pipeline-polish/01-CONTEXT.md` — fresh Phase 1 decisions
- `.planning/phases/01-paste-pipeline-polish/01-RESEARCH.md` — fresh Phase 1 research
- `.planning/phases/01-paste-pipeline-polish/01-VALIDATION.md` — Phase 1 validation strategy
- `.planning/phases/01-paste-pipeline-polish/01-UI-SPEC.md` — approved Phase 1 UI design contract
- `.planning/phases/01-paste-pipeline-polish/01-PATTERNS.md` — Phase 1 pattern map
- `.planning/phases/01-paste-pipeline-polish/01-01-PLAN.md` — parser contract, fallback, Loom preservation, docs
- `.planning/phases/01-paste-pipeline-polish/01-02-PLAN.md` — Import Transcript modal UX and friendly errors
- `.planning/phases/01-paste-pipeline-polish/01-03-PLAN.md` — file-upload route compatibility and reachability removal
- `.planning/phases/01-paste-pipeline-polish/01-04-PLAN.md` — real-Supabase behavioral tests and final verification
- `.planning/phases/01-paste-pipeline-polish/01-05-PLAN.md` — source pane and onboarding upload cue cleanup
- `.planning/phases/02-mcp-monolith-refactor/02-CONTEXT.md` — fresh Phase 2 decisions
- `.planning/phases/02-mcp-monolith-refactor/02-RESEARCH.md` — fresh Phase 2 research
- `.planning/phases/02-mcp-monolith-refactor/02-PATTERNS.md` — Phase 2 pattern map
- `.planning/phases/02-mcp-monolith-refactor/02-01-PLAN.md` through `02-08-PLAN.md` — fresh Phase 2 execution plan set
- `.planning/codebase/{ARCHITECTURE,STACK,STRUCTURE,CONVENTIONS,INTEGRATIONS,CONCERNS,TESTING}.md` — codebase map
- `src/CLAUDE.md` / `supabase/CLAUDE.md` / `docs/CLAUDE.md` — folder-scoped binding rules

---

*STATE.md reset at Phase 1 restart: 2026-05-27*
