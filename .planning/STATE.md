---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: Self-Serve Public Launch
status: executing
last_updated: "2026-05-27T22:47:49.199Z"
progress:
  total_phases: 6
  completed_phases: 1
  total_plans: 5
  completed_plans: 5
  percent: 17
---

# STATE — CallVault Self-Serve Public Launch

**Last updated:** 2026-05-27

---

## Project Reference

**Project:** CallVault — Self-Serve Public Launch milestone
**Repo:** `/Users/admin/dev/brain` (single source; `callvault/` is abandoned)
**Production:** https://app.callvaultai.com (Vercel, auto-deploys from `main`)
**MCP endpoint:** https://api.callvaultai.com/mcp (Cloudflare Worker → Supabase Edge Function)

**Core value:** A team can centralize every call from every source into workspace-scoped vaults that an AI agent can both read from AND write into — and the experience is reliable enough that a stranger off the internet can wire it up themselves without help.

**Current focus:** Phase 1 execution is complete. Phase 2 MCP Monolith Refactor is ready for planning with the captured forensics/research context.

---

## Current Position

**Milestone:** CallVault — Self-Serve Public Launch
**Phase:** Phase 1 — Paste Pipeline Polish
**Plan:** 5/5 active plans complete
**Status:** Phase 1 complete

**Progress:**

```text
[██████████] 100%
Phases:  [x][ ][ ][ ][ ][ ]   1/6 complete
Plans:   [x][x][x][x][x]       5/5 complete
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
- **Integration tests for `save-pasted-transcript` MUST hit real Supabase** (not mocked) — CONCERNS Phase 30 / BUG-01 precedent.
- **Scope change 2026-05-27: File upload + async transcription deferred to v2.** CallVault is not becoming a transcription service in the launch milestone. Paste/transcript import is the v1 manual import path. `file-upload-transcribe` stays deployed but user-facing audio/video upload UI is hidden.
- **Phase 1 fresh context adds Loom and Markdown.** Manual transcript import supports Loom, VTT, SRT, Otter TXT, Fathom copy, raw text, and `.md` transcript inputs. The user-facing entry label is **Import Transcript**.

### Decisions Needed

No open product decisions for Phase 1 after `01-CONTEXT.md`; downstream planning must translate those decisions into executable plans.

Active roadmap questions for later phases remain in `.planning/ROADMAP.md` under "Decisions Needed".

### Todos

- Run `$gsd-plan-phase 2` using the fresh Phase 2 context and MCP refactor forensics/research.
- Do not use archived stale Phase 2 refactor artifacts as implementation inputs.
- Before shipping Phase 1 publicly, configure seeded `TEST_USER_*` / org fixtures if real-Supabase integration execution is required instead of the current explicit skip.

### Blockers

- Phase 1 code execution is complete. Remaining verification limitations: real-Supabase integration suite skipped without seeded test user/org credentials, and Interceptor browser control timed out because Chrome/Brave did not respond to `tab_create`.

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

- **Date:** 2026-05-27
- **Activity:** Phase 1 was executed from the fresh plan set. Plans 01-01 through 01-05 now have implementation commits and `*-SUMMARY.md` files.
- **Outcome:** Manual transcript parsing now preserves raw text and `Unknown Speaker`, the modal uses `Import Transcript` with transcript-file support including Markdown, file-upload route/pane/onboarding surfaces are hidden while internal compatibility remains, and Phase 1 verification coverage was expanded.

### Next session

- **Trigger:** `$gsd-plan-phase 2`
- **Action:** Plan the MCP monolith refactor from the restored monolith, using `.planning/phases/02-mcp-monolith-refactor/02-CONTEXT.md`, `02-DISCUSSION-LOG.md`, and the MCP refactor forensics report.

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
- `.planning/codebase/{ARCHITECTURE,STACK,STRUCTURE,CONVENTIONS,INTEGRATIONS,CONCERNS,TESTING}.md` — codebase map
- `src/CLAUDE.md` / `supabase/CLAUDE.md` / `docs/CLAUDE.md` — folder-scoped binding rules

---

*STATE.md reset at Phase 1 restart: 2026-05-27*
