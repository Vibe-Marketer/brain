---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: ready_to_plan
last_updated: 2026-05-30T02:30:32.134Z
progress:
  total_phases: 9
  completed_phases: 3
  total_plans: 24
  completed_plans: 24
  percent: 33
stopped_at: Phase 04 complete (5/5) — ready to discuss Phase 5
---

# STATE — CallVault Self-Serve Public Launch

**Last updated:** 2026-05-29

---

## Project Reference

**Project:** CallVault — Self-Serve Public Launch milestone
**Repo:** `/Users/admin/dev/brain` (single source; `callvault/` is abandoned)
**Production:** https://app.callvaultai.com (Vercel, auto-deploys from `main`)
**MCP endpoint:** https://api.callvaultai.com/mcp (Cloudflare Worker → Supabase Edge Function)

**Core value:** A team can centralize every call from every source into workspace-scoped vaults that an AI agent can both read from AND write into — and the experience is reliable enough that a stranger off the internet can wire it up themselves without help.

**Current focus:** Phase 5 — connector reliability + per workspace binding + unified sync tab

---

## Current Position

Phase: 5 (connector-reliability-+-per-workspace-binding-+-unified-sync-tab) — READY TO PLAN
Plan: Not started
**Milestone:** CallVault — Self-Serve Public Launch
**Phase:** 5
**Plan:** Not started
**Status:** Ready to plan

**Progress:**

[██████████] 100%
Phases:  [x][x][x][x][ ][ ]   4/6 complete
Plans:   24/24 executed; Phase 04 complete, Phase 5 ready to plan

---

## Performance Metrics

(Will populate as phases run.)

- Cycle time per plan: —
- Plans completed per phase: —
- Verification-pass rate: —

---

## Accumulated Context

### Roadmap Evolution

- Phase 3 edited: expanded Phase 3 for OAuth AI-client grant visibility, per-client MCP permissions, and revocation

### Key Decisions

- **Launch target = self-serve public** (not private beta). Strangers must succeed without hand-holding. Sets the bar for empty states, billing, support, and connector reliability.
- **Multi-MCP = per-workspace CallVault endpoints**, NOT multi-vendor gateway. Aggregating external MCPs (Linear/Slack/Notion) is a different product story.
- **MCP monolith refactor is included in this milestone** (Phase 2). The refactor remains one Edge Function with internal tool modules.
- **One Edge Function for `mcp-server`** retained through refactor (Supabase "fat function" guidance — splitting multiplies cold-start tax).
- **Path-based per-workspace MCP URLs** (`/mcp/w/{uuid}`), not subdomain, not query parameter. Notion/Linear/Cloudflare pattern; RFC 8707 compliant.
- **Phase 3 MCP setup lives in Connectors, not an "AI connectors" silo.** OAuth is the primary setup path; token/manual config is the fallback; snippets use `https://api.callvaultai.com/mcp/w/{workspace_uuid}` and never the raw Supabase function URL.
- **Phase 3 MCP connection management covers OAuth AI clients and manual tokens.** Supabase OAuth access tokens include `client_id`, but Supabase OAuth scopes are OIDC identity scopes rather than CallVault tool permissions; Phase 3 must persist per-client CallVault grants and enforce `read` / `write` / `ai` / `admin` categories from those grants.
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

- Begin Phase 04 planning for MCP AI Write Tools from the Phase 04 roadmap criteria.
- Do not use archived stale Phase 2 refactor artifacts as implementation inputs.
- Before shipping Phase 1 publicly, configure seeded `TEST_USER_*` / org fixtures if real-Supabase integration execution is required instead of the current explicit skip.

### Blockers

- Phase 1 code execution is complete. Remaining verification limitations: real-Supabase integration suite skipped without seeded test user/org credentials, and Interceptor browser control timed out because Chrome/Brave did not respond to `tab_create`.
- Phase 2 Plans 02-01 through 02-08 are complete. Local targeted MCP tests, final `npm run build`, deploy, and live smoke passed. Candidate read-path timing was captured (median 0.459s, p95 0.747s across 10 HTTP 200 calls), but improvement versus baseline is not verified because no pre-refactor baseline timing exists.
- Phase 3 implementation and credential-backed production smoke are complete for `/mcp/w/{workspace_uuid}` valid access and wrong-workspace 403 rejection. Cloudflare Worker `callvault-api-proxy` version `d13eaafb-9b8e-4cd2-bebb-9baf6aa1d412` is deployed to `api.callvaultai.com` and `mcp.callvaultai.com`; both workspace protected-resource metadata vanity routes advertise the exact workspace-scoped `resource`. The repo `.env` Cloudflare API token still lacks Worker deploy permission, but Wrangler OAuth login is available on this machine.

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

- **Date:** 2026-05-29
- **Activity:** Phase 03 follow-up credential-backed MCP smoke plus Cloudflare Worker deployment.
- **Outcome:** Temporary workspace-scoped production token proved valid `/mcp/w/{workspace_uuid}` initialize/tools-list behavior and wrong-workspace 403 rejection, then was revoked. Wrangler OAuth login deployed `callvault-api-proxy` version `d13eaafb-9b8e-4cd2-bebb-9baf6aa1d412`; live workspace protected-resource metadata now advertises exact workspace resource URLs on both `api.callvaultai.com` and `mcp.callvaultai.com`.

### Next session

- **Trigger:** Plan Phase 04.
- **Action:** Create Phase 04 plans for MCP AI Write Tools, starting from `ingest_transcript`, workspace/org-scope write enforcement, category-gated tools/list visibility, and markdown-only MCP result contracts.

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
- `.planning/phases/03-per-workspace-mcp-endpoints-+-connect-to-ai/03-RESEARCH.md` — fresh Phase 3 research
- `.planning/phases/03-per-workspace-mcp-endpoints-+-connect-to-ai/03-PATTERNS.md` — Phase 3 pattern map
- `.planning/phases/03-per-workspace-mcp-endpoints-+-connect-to-ai/03-01-PLAN.md` through `03-06-PLAN.md` — fresh Phase 3 execution plan set
- `.planning/codebase/{ARCHITECTURE,STACK,STRUCTURE,CONVENTIONS,INTEGRATIONS,CONCERNS,TESTING}.md` — codebase map
- `src/CLAUDE.md` / `supabase/CLAUDE.md` / `docs/CLAUDE.md` — folder-scoped binding rules

---

*STATE.md reset at Phase 1 restart: 2026-05-27*

## Performance Metrics

| Phase | Plan | Duration | Notes |
|-------|------|----------|-------|
| Phase 03 P02 | 50 | 2 tasks | 8 files |
| Phase 03 P04 | 5min | 3 tasks | OAuth-first AI connectors surface + manual token fallback controls |
| Phase 03 P05 | 7min | 2 tasks | Capability-gated provider setup snippets + vanity MCP endpoint contract tests |
| Phase 03 P06 | 27min | 3 tasks | 4 files |

## Decisions

- [Phase ?]: Workspace audience is derived from /mcp/w/{workspace_uuid} and enforced server-side before tool dispatch.
- [Phase ?]: Workspace protected-resource metadata now advertises exact workspace resource URLs via worker passthrough.
- [Phase 03]: Settings AI connector management is OAuth-first, with manual scoped tokens kept visible as fallback controls.
- [Phase 03]: Provider setup actions are capability-gated from evidence-backed registry labels; unsupported providers use guided setup actions rather than implied one-click install.
- [Phase 03]: MCP setup snippets are pinned to vanity endpoints only (`/mcp` org and `/mcp/w/{workspace_uuid}` workspace), with no raw Supabase function URL exposure.
- [Phase 03]: Excluded speculative notifications/initialized edits from 03-06 commits; only verification-backed changes were kept. — No failing 03-06 verification gate required those edits.
- [Phase 03]: Credential-backed production smoke is complete. — Temporary workspace token proved valid workspace access, wrong-workspace 403, token revocation, and final vanity protected-resource metadata after Cloudflare Worker deploy.
