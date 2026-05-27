# STATE — CallVault Self-Serve Public Launch

**Last updated:** 2026-05-27

---

## Project Reference

**Project:** CallVault — Self-Serve Public Launch milestone
**Repo:** `/Users/admin/dev/brain` (single source; `callvault/` is abandoned)
**Production:** https://app.callvaultai.com (Vercel, auto-deploys from `main`)
**MCP endpoint:** https://api.callvaultai.com/mcp (Cloudflare Worker → Supabase Edge Function)

**Core value:** A team can centralize every call from every source into workspace-scoped vaults that an AI agent can both read from AND write into — and the experience is reliable enough that a stranger off the internet can wire it up themselves without help.

**Current focus:** Take the existing production app from "works for Andrew and a handful of dogfood users" to "self-serve public launch" by hardening the four workstreams (Onboarding + Support, Connector Reliability, Paste Pipeline Polish, Multi-MCP) plus pre-launch RLS + sync-tab hygiene. File upload + async transcription deferred to v2 (scope change 2026-05-27).

---

## Current Position

**Milestone:** CallVault — Self-Serve Public Launch
**Phase:** Pre-Phase-1 (roadmap complete + scope-updated; awaiting `/gsd:plan-phase 1`)
**Plan:** —
**Status:** Roadmap committed; scope changed 2026-05-27 (deferred file upload + async transcription, added support popout); first phase not yet planned.

**Progress:**

```
Phases:  [ ][ ][ ][ ][ ][ ]   0/6
Plans:   none yet
```

---

## Performance Metrics

(Will populate as phases run.)

- Cycle time per plan: —
- Plans completed per phase: —
- Verification-pass rate: —

---

## Accumulated Context

### Key Decisions (locked at planning)

- **Launch target = self-serve public** (not private beta). Strangers must succeed without hand-holding. Sets the bar for empty states, billing, support, and connector reliability.
- **Multi-MCP = per-workspace CallVault endpoints**, NOT multi-vendor gateway. Aggregating external MCPs (Linear/Slack/Notion) is a different product story.
- **MCP monolith refactor is included in this milestone** (Phase 2). We're touching the MCP heavily for per-workspace endpoints and new AI-write tools — right time to extract per-tool modules.
- **One Edge Function for `mcp-server`** retained through refactor (Supabase "fat function" guidance — splitting multiplies cold-start tax).
- **Path-based per-workspace MCP URLs** (`/mcp/w/{uuid}`), not subdomain, not query parameter. Notion/Linear/Cloudflare pattern; RFC 8707 compliant.
- **Integration tests for `save-pasted-transcript` MUST hit real Supabase** (not mocked) — CONCERNS Phase 30 / BUG-01 precedent.
- **Scope change 2026-05-27: File upload + async transcription deferred to v2.** CallVault is not becoming a transcription service in the launch milestone. Paste is the v1 manual import. FileUploadDropzone removed from UI; `file-upload-transcribe` Edge Function stays deployed but hidden. Research at `.planning/research/ASYNC-TRANSCRIPTION-PIPELINE.md` retained for v2 reuse.
- **Phase shape derived from work, not template.** 6 phases because the work has 6 natural delivery boundaries given hard sequencing (MCP refactor before per-workspace routing; per-workspace routing before AI write tools; paste polish before unified vault claim).

### Decisions Needed (per-phase, not now)

5 open questions tracked in `ROADMAP.md` → "Decisions Needed" section (was 8; 3 transcription-related questions deferred to v2 alongside MAN-01/MAN-03). Resolve at `/gsd:plan-phase` for the relevant phase, not at roadmap creation.

Active questions: slug-vs-UUID URLs (Phase 3), `ingest_transcript` scope discipline (Phase 4), speaker-resolution shape on `ingest_transcript` (Phase 4), Mintlify docs site + cc Andrew on tickets (Phase 6), submit-ticket context capture policy (Phase 6).

### Todos

(Will accumulate as phases run.)

### Blockers

None at roadmap-creation time.

### Phase-Spanning Knowledge

Binding fragile surfaces (must respect in every phase):

- **Recording ID dual system.** UUID `recordings.id` vs legacy BIGINT `recordings.legacy_recording_id`. Always route through `toRecordingUuid()` / `toRecordingUuidBatch()` in `src/lib/recording-ids.ts`. Never `parseInt()`, `Number()`, or string coercion.
- **`recordings.share_url` is not a top-level column.** Always use `resolveShareUrl()` from `src/lib/recording-source-url.ts` — paste-import recordings have it in `source_metadata` instead.
- **`source-registry.ts` `oauthCallbackFunctionName` entries are critical boot-time artifacts.** Missing entries crash React mount. Run `npm run build` against the committed tree (not working tree) before every push during refactors. Production has crashed on this once (`9b6e3338`).
- **MCP tool result shape: `content[].text` markdown.** NOT structured JSON. Spec-strict clients (Claude Code, Perplexity in late 2025) reject otherwise. Runbook records this; never regress.
- **`tools/list` filtered by `token.enabled_categories`.** Information disclosure otherwise.
- **`mcp_tokens` schema already supports workspace scope.** `scope IN ('workspace', 'organization')` and `workspace_id UUID` exist; no migration needed for the baseline of per-workspace endpoints.
- **`authenticateRequest(req, supabase, corsHeaders)`** from `_shared/auth.ts` for all Edge Function auth. Never inline.
- **`invalidateCallListCaches(queryClient)` in every mutation `onSettled`.**

---

## Session Continuity

### Last session

- **Date:** 2026-05-27
- **Activity:** Roadmap created (8 phases, 20 reqs) → scope-changed same day: deferred MAN-01 (async transcription) + MAN-03 (audio formats) to v2; added MAN-06 (remove FileUploadDropzone UI) and ONB-05 (support popout); collapsed to 6 phases.
- **Outcome:** 6 phases, 20 v1 reqs, 100% coverage, REQUIREMENTS.md traceability remapped.

### Next session

- **Trigger:** `/gsd:plan-phase 1`
- **Action:** Decompose Phase 1 (Paste Pipeline Polish) into executable plans. Must-haves derived from Phase 1 success criteria — MAN-02 (SRT/Otter parsers), MAN-04 (real-DB integration tests for `save-pasted-transcript`), MAN-05 (friendly paste-failure UX), MAN-06 (remove FileUploadDropzone from UI). No active Decisions Needed for Phase 1.

### Files of Record

- `.planning/PROJECT.md` — project context, 4 workstreams, Key Decisions, Out of Scope (scope-updated 2026-05-27)
- `.planning/REQUIREMENTS.md` — 20 v1 requirements traced to phases 1–6 (MAN-01/MAN-03 → v2; MAN-06, ONB-05 added)
- `.planning/ROADMAP.md` — 6-phase plan + sequencing + 5 active Decisions Needed
- `.planning/research/SUMMARY.md` — cross-workstream sequencing, key constraints, open questions (some now v2-scoped)
- `.planning/research/MCP-MULTI-WORKSPACE.md` — Workstream 4 architecture detail (active for phases 2–4)
- `.planning/research/ASYNC-TRANSCRIPTION-PIPELINE.md` — RETAINED FOR v2 REUSE — applies to MAN-01/MAN-03 when they return in v2
- `.planning/codebase/{ARCHITECTURE,STACK,STRUCTURE,CONVENTIONS,INTEGRATIONS,CONCERNS,TESTING}.md` — codebase map for Workstreams 1 (Onboarding+Support), 2 (Connectors), 3 (Paste polish)
- `docs/operations/mcp-runbook.md` — canonical MCP URLs + `content[].text` outputSchema contract (don't regress)
- `src/CLAUDE.md` / `supabase/CLAUDE.md` / `docs/CLAUDE.md` — folder-scoped binding rules

---

*STATE.md initialized at roadmap creation: 2026-05-27*
