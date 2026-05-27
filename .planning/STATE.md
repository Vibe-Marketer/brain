---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: Self-Serve Public Launch
status: planning
last_updated: "2026-05-27T00:00:00-04:00"
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
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

**Current focus:** Phase 1 reset and planning. Prior execution artifacts were archived as stale because the workflow is restarting from Phase 1 with fresh context, research, and validation.

---

## Current Position

**Milestone:** CallVault — Self-Serve Public Launch
**Phase:** Phase 1 — Paste Pipeline Polish
**Plan:** UI design contract, then fresh phase plans
**Status:** Ready for `$gsd-ui-phase 1`

**Progress:**

```text
Phases:  [ ][ ][ ][ ][ ][ ]   0/6 complete
Plans:   none accepted as active
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

- Run `$gsd-ui-phase 1` to create the Phase 1 UI design contract.
- Re-run `$gsd-plan-phase 1` after UI-SPEC exists; existing stale plans were archived and must not be used.

### Blockers

None for UI-SPEC. Real-Supabase credentials may be required later for MAN-04 verification.

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
- **Activity:** Phase 1 discussion was restarted from a fresh state. `01-CONTEXT.md`, `01-DISCUSSION-LOG.md`, `01-RESEARCH.md`, and `01-VALIDATION.md` were created.
- **Outcome:** Stale prior-run execution artifacts were archived to `.planning/forensics/stale-prior-run-2026-05-27/` so GSD no longer treats Phase 1/2/3 as executed from previous agents.

### Next session

- **Trigger:** `$gsd-ui-phase 1`
- **Action:** Create `01-UI-SPEC.md` for Phase 1. Then run `$gsd-plan-phase 1` to create fresh executable plans.

### Files of Record

- `.planning/PROJECT.md` — project context, 4 workstreams, Key Decisions, Out of Scope
- `.planning/REQUIREMENTS.md` — v1 requirements traced to phases 1–6
- `.planning/ROADMAP.md` — 6-phase plan + sequencing + active Decisions Needed
- `.planning/phases/01-paste-pipeline-polish/01-CONTEXT.md` — fresh Phase 1 decisions
- `.planning/phases/01-paste-pipeline-polish/01-RESEARCH.md` — fresh Phase 1 research
- `.planning/phases/01-paste-pipeline-polish/01-VALIDATION.md` — Phase 1 validation strategy
- `.planning/codebase/{ARCHITECTURE,STACK,STRUCTURE,CONVENTIONS,INTEGRATIONS,CONCERNS,TESTING}.md` — codebase map
- `src/CLAUDE.md` / `supabase/CLAUDE.md` / `docs/CLAUDE.md` — folder-scoped binding rules

---

*STATE.md reset at Phase 1 restart: 2026-05-27*
