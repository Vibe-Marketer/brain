# Roadmap: CallVault — Self-Serve Public Launch

**Created:** 2026-05-27
**Last updated:** 2026-05-27 — Scope change: deferred file upload + async transcription (MAN-01, MAN-03) to v2; added MAN-06 (remove FileUploadDropzone UI), ONB-05 (support popout); collapsed 8 → 6 phases.
**Granularity:** standard
**Mode:** mvp
**Coverage:** 20/20 v1 requirements mapped (19 original + ONB-05 added, MAN-01/MAN-03 moved to v2, MAN-06 added)
**Workstreams:** 4 (Onboarding, Connector Reliability, Paste Pipeline Polish, Multi-MCP) + Cross-cutting hardening

---

## Phases

- [x] **Phase 1: Paste Pipeline Polish** — SRT/Otter/VTT/raw all parse correctly via `save-pasted-transcript`; real-Supabase integration tests guard the path; failed pastes show friendly errors; FileUploadDropzone removed from import UI (completed 2026-05-27)
- [ ] **Phase 2: MCP Monolith Refactor** — `mcp-server/index.ts` split into per-tool modules + handler-map dispatch with zero behavior change; AI deps dynamic-imported; cold starts drop on read paths
- [ ] **Phase 3: Per-Workspace MCP Endpoints + Connect-to-AI** — `mcp/w/{workspace_uuid}` URLs live; audience-bound per RFC 8707; one-click config snippets for Claude Desktop / Cursor / mcp-remote; token management UI
- [ ] **Phase 4: MCP AI Write Tools** — `ingest_transcript` composite + atomic `append_to_transcript`, `update_call_metadata`, `set_speakers`; agents push transcripts + metadata + speakers + tags into a workspace in one call
- [ ] **Phase 5: Connector Reliability + Per-Workspace Binding + Unified Sync Tab** — All 7 connectors survive unhappy paths; one per-workspace connection-status surface; per-workspace connector assignment; sync tab shows every source not just Fathom
- [ ] **Phase 6: Launch UX + Support + RLS Hygiene** — Stranger off the internet completes signup→connector→vault→upgrade without dead air; support popout (how it works, tour, Mintlify docs, submit ticket); RLS regression test covers all user-facing tables; public-launch ready

---

## Phase Details

### Phase 1: Paste Pipeline Polish

**Goal:** The paste path is the polished v1 manual import — every common transcript format parses correctly, the parser is guarded by real-DB integration tests, failures surface with friendly messages, and the file-upload entry points are hidden from the UI to set the right expectations.
**Mode:** mvp
**Depends on:** Nothing (can run in parallel with Phase 2 — zero file overlap with `mcp-server/`)
**Requirements:** MAN-02, MAN-04, MAN-05, MAN-06
**Success Criteria** (what must be TRUE):

  1. A user pastes a VTT, SRT, or Otter TXT export into `PasteTranscriptModal.tsx` and the resulting recording carries correctly-timestamped segments and inferred speakers (verified against fixture per format). Raw-text fallback unchanged.
  2. `save-pasted-transcript.integration.test.ts` runs against a real Supabase test project (no mocked `supabase` client), exercises auth rejection, dedup enforcement, format detection (VTT / SRT / Otter / raw), workspace membership gate, and gates CI on green.
  3. When a paste fails (bad format, dedup hit, parse error, workspace permission denied), the user sees a friendly inline error with a clear next step — never a stack trace, never silence.
  4. `FileUploadDropzone` is removed from the import flow surfaces (Import sources list, Pane 2 Import surface, any onboarding cue or empty-state CTA). `npm run build` is clean; no dead-import errors. `file-upload-transcribe` Edge Function stays deployed for any in-flight callers but is no longer reachable from the UI.
  5. `docs/architecture/transcript-formats.md` documents the canonical CallVault transcript JSON shape so future format additions follow the same contract.

**Plans:** 5/5 plans complete

- [x] `01-01-PLAN.md` — Backend parser contract, no-data-loss fallback, Loom preservation, and manual-format docs
- [x] `01-02-PLAN.md` — `Import Transcript` modal UX, transcript-file affordances, and friendly error/caching behavior
- [x] `01-03-PLAN.md` — Route-level `file-upload` compatibility audit plus import-flow reachability removal
- [x] `01-04-PLAN.md` — Real-Supabase behavioral tests, Loom regression coverage, and final verification gate
- [x] `01-05-PLAN.md` — Remove upload cues from source panes and onboarding without broadening scope

### Phase 2: MCP Monolith Refactor

**Goal:** The 3,921-line `mcp-server/index.ts` is split into one-tool-per-file modules with a handler-map dispatcher and dynamic-imported AI deps, with zero externally observable behavior change.
**Mode:** mvp
**Depends on:** Nothing externally (can run in parallel with Phase 1 — touches zero shared files). MUST complete BEFORE Phase 3 (per-workspace routing) and Phase 4 (new write tools).
**Requirements:** MCP-05
**Success Criteria** (what must be TRUE):

  1. Every existing MCP tool (36 total: 17 read + 19 write) returns byte-identical responses post-refactor — verified by replaying a captured request fixture set against the new dispatcher and diffing the response JSON.
  2. `mcp-server/index.ts` is ≤300 LOC and contains only HTTP/CORS, auth dispatch, plan-gating, and the handler-map lookup. Each tool lives in `tools/{read,write,ai}/<tool-name>.ts` exporting a `ToolModule` with `{ definition, handler, category }`.
  3. Cold-start latency on a read-only tool (e.g., `list_calls`) on a freshly-deployed function drops by ≥30% vs the pre-refactor baseline (warm-vs-cold p95 of 10 invocations each). AI SDK deps no longer load on non-AI tool calls.
  4. `tools/list` continues to filter by `token.enabled_categories` (SEP-1881 compliance not regressed).
  5. The MCP runbook contract holds: all tool responses still emit `content[].text` markdown (NOT structured JSON); verified by interceptor against `api.callvaultai.com/mcp` before and after deploy.

**Plans:** 0/8 plans complete

- [ ] `02-01-PLAN.md` — Golden replay fixtures, contract-surface audit, and live/cold-start verification commands
- [ ] `02-02-PLAN.md` — Protocol, auth, gating, and shared tool type extraction with service-role auth preserved
- [ ] `02-03-PLAN.md` — Registry dispatcher plus pilot core read-tool extraction
- [ ] `02-04-PLAN.md` — Remaining read-tool extraction with notes/shared-call boundary coverage
- [ ] `02-05-PLAN.md` — Current write-tool extraction without adding Phase 4 tools
- [ ] `02-06-PLAN.md` — Admin-tool extraction and category-gating preservation
- [ ] `02-07-PLAN.md` — AI-tool extraction with dynamic OpenRouter/AI SDK imports
- [ ] `02-08-PLAN.md` — Final `index.ts` trim, build/test gates, deployment smoke, and cold-start proof

### Phase 3: Per-Workspace MCP Endpoints + Connect-to-AI

**Goal:** Each workspace exposes its own MCP URL that AI clients see as a distinct connection; users can wire any workspace into Claude Desktop / Cursor / a generic MCP client in one click; tokens are mintable, listable, and revocable per workspace.
**Mode:** mvp
**Depends on:** Phase 2 (path routing is added to the refactored modular server — not the monolith)
**Requirements:** MCP-01, MCP-02, MCP-03
**Success Criteria** (what must be TRUE):

  1. A user can copy an MCP config snippet from any workspace's "Connect to AI" button, paste it into `claude_desktop_config.json` or `.cursor/mcp.json`, and the AI client connects to that workspace's vault only (other workspaces in the same org are invisible to that connection).
  2. `https://api.callvaultai.com/mcp/w/{workspace_uuid}` returns workspace-scoped tools for a valid workspace token; presenting a token for workspace A to workspace B's URL returns HTTP 403 (audience binding per RFC 8707, NOT 401).
  3. The per-workspace PRM document at `/.well-known/oauth-protected-resource/mcp/w/{workspace_uuid}` advertises the correct workspace-scoped `resource` value; OAuth-discovery clients (Claude Desktop wizard) negotiate successfully.
  4. The token management UI (GitHub-PAT-style) lists every active token per workspace with name, last-used, enabled categories, revoke and rotate actions; revoked tokens reject within one request cycle.
  5. New tokens are minted with self-describing `cv_ws_<hex>` / `cv_org_<hex>` prefixes; legacy hex tokens still validate via fallback regex.

**Plans:** TBD
**UI hint:** yes

### Phase 4: MCP AI Write Tools

**Goal:** AI agents can ingest a transcript with full metadata (title, speakers, source date, tags, notes, folder) into a workspace in a single MCP call, plus targeted atomic updates for metadata correction and live transcription append.
**Mode:** mvp
**Depends on:** Phase 3 (write tools land on the workspace-scoped MCP endpoints). NO LONGER depends on async pipeline (file upload + MAN-01 were descoped) — `ingest_transcript` accepts already-transcribed text from the agent in-hand and writes the recording row synchronously via the existing `runPipeline()`.
**Requirements:** MCP-04
**Success Criteria** (what must be TRUE):

  1. An AI agent connected to `/mcp/w/{workspace_uuid}` can call `ingest_transcript` with `{ transcript, title, speakers, tags, notes, source_date, folder_id }` and the resulting recording, tags (deduped by lowercase name), contacts, and folder assignment all land atomically — partial failures (e.g., speaker resolution failed) surface in the markdown response, not swallowed.
  2. `append_to_transcript`, `update_call_metadata`, and `set_speakers` each perform exactly one logical action with no hidden side effects; `set_speakers` is idempotent.
  3. Tag and speaker fields accept names (not UUIDs); the server resolves them to IDs so agents that have only names from a transcript context can succeed without a prior lookup.
  4. `tools/list` filters the new tools by `token.enabled_categories`; a read-only token cannot see `ingest_transcript` exists.
  5. All four new tools return `content[].text` markdown (runbook contract preserved); markdown summary includes the new recording's id, share URL, and a created-vs-reused entity breakdown.

**Plans:** TBD

### Phase 5: Connector Reliability + Per-Workspace Binding + Unified Sync Tab

**Goal:** All 7 connectors survive the unhappy paths (token refresh, expired tokens, rate limits, partial syncs, dedup edges, webhook failures); the connection-status surface is one unified per-workspace view; each connector instance is bound to a specific workspace; and the sync tab shows recordings from every source — fulfilling the "unified vault" promise.
**Mode:** mvp
**Depends on:** Phase 1 (paste polish complete so the "unified vault" message is honest). Soft-depends on Phase 3 (per-workspace MCP endpoints establish the workspace-as-boundary mental model that per-workspace connector binding inherits).
**Requirements:** CON-01, CON-02, CON-03, CON-04, HRD-01
**Success Criteria** (what must be TRUE):

  1. For each of the 7 connectors (Fathom, Zoom, Fireflies, Grain, Read.ai, PLAUD, YouTube): a deliberately expired OAuth token triggers automatic refresh on the next sync; if refresh fails, the connection is marked errored with a user-friendly reconnect prompt — no silent stale syncs.
  2. A single per-workspace "Connections" page (workspace settings) shows every connected source for that workspace with last-sync time, status (connected / syncing / error / disconnected), and a one-click reconnect button — replaces the scattered today-state across multiple settings panes.
  3. Disconnecting a connector cleanly tears down the OAuth token, registered webhooks, and the `import_sources` row; reconnecting from the same workspace returns a working synced state without dangling DB artifacts.
  4. Each connector instance carries a `workspace_id` foreign key on `import_sources`; UI assigns a connector to a workspace at connect time (or via routing rules); incoming syncs/webhooks land recordings into the assigned workspace's scope.
  5. The sync tab (`SyncTab.tsx` via `sync-tab.service.ts`) lists Zoom, Grain, Read.ai, PLAUD, Fireflies, and paste-import recordings alongside Fathom — verified by manual walkthrough with at least one recording from each source. Reads from canonical `recordings` table (UUID-keyed), not `fathom_calls`.
  6. Webhook receivers retry with exponential backoff (verified by synthetic 5xx injected at the connector-pipeline layer); ultimate failures surface in the connection-status UI as error state, not a silent drop.

**Plans:** TBD
**UI hint:** yes

### Phase 6: Launch UX + Support + RLS Hygiene

**Goal:** A stranger off the internet can sign up, verify email, connect their first source, get to a working vault, find help when stuck, and upgrade to Pro/Team — all without dead air or dead ends. Data-layer hygiene complete across every user-facing table before public launch.
**Mode:** mvp
**Depends on:** Phases 1–5 (this phase wraps and polishes everything users see; empty states and onboarding cues reference features built in prior phases)
**Requirements:** ONB-01, ONB-02, ONB-03, ONB-04, ONB-05, HRD-02
**Success Criteria** (what must be TRUE):

  1. A first-time user landing on `app.callvaultai.com` from a fresh browser session can complete the chain — signup → email verification → first session → first connector wired → first recording visible → support reachable if stuck — without a dead-end screen, blank state without a CTA, or unhandled error.
  2. Every zero-data surface (calls list, workspaces list, folders, contacts, settings tabs) shows an empty state with a real CTA that the user can follow to populate that surface, not a blank pane.
  3. A Free-tier user attempting a Pro/Team-gated feature sees a paywall with the Polar upgrade dialog inline; on successful checkout, the user lands on a post-upgrade success state with the gated feature usable in the same session (no logout/reload required).
  4. **Support popout (ONB-05):** A single popout accessible from the top bar exposes four actions — "How it works" (existing content), "Take the tour" (existing tour trigger via `tour.ts`), Mintlify-powered docs search (embed or link to `docs.callvaultai.com`), and "Submit a ticket" form. Submit-ticket sends a Resend email to `support@callvaultai.com` (and cc Andrew per ops decision) with user message + auto-attached context (current URL, user agent, console errors if present, active recording ID if on a detail page).
  5. `src/test/rls-regression.test.ts` `CROSS_ORG_TABLES` covers all 9 currently-missing tables: `mcp_tokens`, `personal_folders`, `personal_tags`, `personal_folder_recordings`, `personal_tag_recordings`, `call_notes`, `contact_folders`, `import_sources`, `import_routing_rules`. Cross-org leak attempts on each fail.
  6. `interceptor` walkthrough of the full landing → signup → connect → vault → support popout → upgrade flow completes with no console errors, no 404s, no broken images, and no flickering pane transitions.

**Plans:** TBD
**UI hint:** yes

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Paste Pipeline Polish | 5/5 | Complete   | 2026-05-27 |
| 2. MCP Monolith Refactor | 0/8 | Planned | - |
| 3. Per-Workspace MCP Endpoints + Connect-to-AI | 0/TBD | Not started | - |
| 4. MCP AI Write Tools | 0/TBD | Not started | - |
| 5. Connector Reliability + Per-Workspace Binding + Unified Sync Tab | 0/TBD | Not started | - |
| 6. Launch UX + Support + RLS Hygiene | 0/TBD | Not started | - |

---

## Sequencing Constraints (binding)

**Hard ordering:**

1. **Phase 2 BEFORE Phase 3.** Per-workspace path routing lands on the refactored modular dispatcher, not the monolith. Refactor first, feature second.
2. **Phase 3 BEFORE Phase 4.** New write tools land on the workspace-scoped endpoints; tools/list filtering and audience binding need the per-workspace routing layer in place first.
3. **Phase 1 BEFORE Phase 5.** Paste polish + FileUploadDropzone removal is complete before the "unified vault" connector-status work — otherwise the unified status surface shipped in Phase 5 references entry points that no longer exist.

**Soft ordering (preferred):**

- **Phase 3 BEFORE Phase 5 (CON-04 portion).** Having the workspace-as-MCP-endpoint mental model established makes per-workspace connector binding more intuitive.
- **Phase 1 and Phase 2 can run in parallel.** Zero file overlap; different agents could own each.

**Hardening late but not last:**

- **HRD-02** (RLS `CROSS_ORG_TABLES` gap fill) is in Phase 6 because it gates public launch but is schedule-independent of earlier work. Done early would be fine; done late is acceptable as long as it's done.

**Scope-change notes (2026-05-27):**

- Original hard constraint "Phase 1 BEFORE Phase 6 (`runPipeline()` async wiring before `ingest_transcript`)" — **DISSOLVED**. MAN-01 deferred to v2; `ingest_transcript` now takes transcript text in-hand from the agent, no async dependency.
- Original Phase 3 (Test Hardening + Unified Sync Tab) — MAN-04 folded into Phase 1 (paste polish); HRD-01 folded into Phase 5 (connector work).

---

## Constraints This Roadmap Must Respect

Binding rules from PROJECT.md, codebase map, and research SUMMARY. Every phase plan must respect these:

- **Direct-main workflow.** No feature branches, no PRs unless Andrew explicitly asks. Commit and push to `origin/main`.
- **`npm run build` against the committed tree** (not the working tree) before push when touching `src/config/source-registry.ts` or `supabase/functions/mcp-server/index.ts` — the `9b6e3338` regression precedent applies to both.
- **Integration tests for MAN-04 MUST NOT mock Supabase.** Real-Supabase tests only. CONCERNS Phase 30 / BUG-01 precedent.
- **MCP tool result shape: `content[].text` markdown.** NEVER structured JSON. Refactor and new tools both preserve this; runbook records the contract.
- **One Edge Function for `mcp-server`.** Refactor is INTERNAL (`tools/{read,write,ai}/*.ts` modules) — NOT a split into multiple Edge Functions. Supabase "fat function" guidance.
- **`tools/list` filtered by `token.enabled_categories`.** Information disclosure otherwise. Refactor preserves this.
- **Recording IDs cross the UUID/BIGINT boundary via `toRecordingUuid()` / `toRecordingUuidBatch()` only.** Never `parseInt()`, `Number()`, or string coercion. `src/lib/recording-ids.ts` is the boundary.
- **`recordings.share_url` is not a top-level column.** Always use `resolveShareUrl()` from `src/lib/recording-source-url.ts`.
- **Tech stack locked.** React 18 + Vite 5 + TanStack Query + Zustand v5 + Tailwind + shadcn/ui + Remix Icons + `motion/react`. npm only.
- **All AI/LLM in Edge Functions** (constraint AI-02). Frontend AI usage banned.
- **`authenticateRequest(req, supabase, corsHeaders)` from `_shared/auth.ts`** for all Edge Function auth. Never inline boilerplate.
- **`invalidateCallListCaches(queryClient)` in every mutation `onSettled`.** Partial invalidation = stale UI.
- **MCP server CORS is intentionally wildcard.** RFC 9728/7591 require world-readable discovery. Auth at bearer-token layer. Don't add session-cookie data to wildcard-CORS endpoints.
- **Brand: "AI-ready, not AI-powered".** Never positive "AI-powered" in UI copy.
- **One-Click Promise.** Every user-visible feature completes the user's job in the fewest possible actions, ideally one click.
- **File upload UI removed (MAN-06).** Existing `file-upload-transcribe` Edge Function stays deployed for any callers in transit; UI no longer surfaces it. Hidden, not deleted.

---

## Decisions Needed (resolve at phase planning, not at roadmap creation)

| # | Question | Affects Phase | Owner |
|---|----------|---------------|-------|
| 1 | Slug vs UUID URLs in "Connect to AI" snippets. UUIDs work; slugs are nicer (`/mcp/w/sales-q2-2026`). Deferred per research; re-litigate at Phase 3 design. | Phase 3 | Andrew (UX) |
| 2 | `ingest_transcript` composite scope discipline. Research recommends excluding `bulk_ingest_transcripts` (v2 only). Hold the line if pressure surfaces. | Phase 4 | Engineering call during Plan |
| 3 | Speaker-resolution shape on `ingest_transcript`. Agent passes names; how does the server handle ambiguity (multiple contacts with same first name)? Best-effort + report in response, or hard-fail? | Phase 4 | Engineering call during Plan |
| 4 | Support popout (ONB-05): cc Andrew on every ticket, or only on Pro/Team tier ones? Does the Mintlify docs site exist yet, or does Phase 6 also include standing it up at `docs.callvaultai.com`? | Phase 6 | Andrew (product) |
| 5 | Submit-ticket form auto-attached context — how much do we capture? Console errors only on bug reports vs every ticket? PII concerns on recording ID inclusion? | Phase 6 | Engineering call during Plan |

**Scope-change notes (2026-05-27):** Questions 1–8 from the original 2026-05-27 roadmap that pertained to file-upload + async transcription (Deepgram API key, storage retention, `uploads` bucket cap, cron secret rotation, Realtime channel keying, speaker diarization consistency) are now **deferred to v2** along with MAN-01 / MAN-03. They will resurface when those v2 items return.

---

## What's Out of Scope for This Roadmap

Already deferred in REQUIREMENTS.md (v2 or out-of-scope). Repeated here so phase planners don't accidentally pull them in:

- **MAN-01** — Async transcription pipeline. Deferred 2026-05-27 — CallVault is not becoming a transcription service in this milestone. Research retained at `.planning/research/ASYNC-TRANSCRIPTION-PIPELINE.md`.
- **MAN-03** — Audio format expansion (m4a/wav/ogg/opus/flac/aac). Depends on MAN-01.
- **TEL-01** — Onboarding drop-off telemetry. Ship launch first, instrument based on real drop-off.
- **MCP-V2-01** — Human-friendly workspace slugs in MCP URLs. UUIDs work for v1.
- **MCP-V2-02** — `bulk_ingest_transcripts` array variant. Composite is already the high-cost write tool.
- **MCP-V2-03** — External MCP gateway (CallVault proxying Linear/Slack/Notion). Different product story.
- **MAN-V2-01** — Bulk upload (folder drag, CSV of URLs, Fathom export zip).
- **MAN-V2-02** — Metadata association at upload time (workspace/folder/tags/participants in the upload dialog).
- **PF-V2-01** — `personal_folders` feature wiring. Migration exists; service is stubbed; separate feature decision.
- **File upload UI** — FileUploadDropzone removed by MAN-06. Existing `file-upload-transcribe` Edge Function stays deployed for any in-flight callers but is no longer surfaced.
- **CSP hardening** (remove `unsafe-inline` / `unsafe-eval`). Hardening item, not launch blocker.
- **Sentry release tagging in `Sentry.init`.** Quality-of-life observability, not blocking.
- **`TranscriptsTab.tsx` 1,397-line refactor.** Internal tech debt; defer to post-launch hardening.
- **Stripe legacy keys cleanup.** Inert; not blocking.
- **`tag_preferences.organization_id` migration (issue #173).** Low blast radius today.
- **`_shared/deduplication.ts` dead-code deletion.** Confusing but inert; defer.
- **Multi-vendor MCP gateway (Linear/Slack/Notion proxy).** Anti-pattern for v1 scope discipline.
- **Subdomain-based per-workspace MCP URLs.** Anti-pattern — path-based wins.
- **Splitting `mcp-server` into 36 separate Edge Functions.** Anti-pattern — multiplies cold-start tax.

---

*Roadmap created: 2026-05-27*
*Last updated: 2026-05-27 — Scope change: deferred MAN-01/MAN-03 to v2; added MAN-06 (remove FileUploadDropzone UI), ONB-05 (support popout); collapsed 8 → 6 phases.*

---

## Backlog

Unsequenced ideas captured outside the active phase sequence. Promote with `/gsd-review-backlog` when ready.

### Phase 999.1: AI-ready export menu and transcript metadata enrichment (BACKLOG)

**Goal:** Match (and beat) Grain's "AI export" feature — per-call dropdown with Open in Claude / Open in ChatGPT / Copy Transcript for AI / Download Transcript for AI (Markdown), with sticky default action. Enrich CallVault transcripts with richer Markdown metadata for AI consumption, including cross-references to previous calls with the same participants (so an AI client opening a transcript has full historical context auto-attached).

**Why now / why this matters:** Captured 2026-05-27 from a Grain product launch (Loom: https://www.loom.com/share/c7e53b7384d745f68c45e0e200e3a47c). Surfaces (1) a UX pattern Grain is shipping that we don't have, and (2) confirmation that CallVault is *ahead* on some adjacent surfaces — Grain's "bulk download" is still a request, we already have it — so this is also a "polish what we already do, in alignment with how the market is now framing it" exercise. The participant-history cross-reference is the genuinely net-new feature worth building.

**Requirements:** TBD (promote with `/gsd-review-backlog` to define formal REQ-IDs)

**Likely surface area:**

- Per-call dropdown action menu in `src/components/call-detail/` — Open in Claude (deep link with prefilled prompt + transcript fetch URL), Open in ChatGPT, Copy for AI (Markdown to clipboard), Download for AI (Markdown file)
- Sticky-action preference stored in `preferencesStore.ts` (default behavior on next click)
- Markdown export formatter — richer metadata header (participants, source, date, duration, share URL), Markdown-formatted transcript body
- Short-lived signed URL for transcript-fetch (Grain's "expires in a couple minutes" pattern)
- Participant cross-reference query: given a recording's participants, surface links to prior recordings with overlapping participants in the same workspace; inject these into the AI-ready export header
- Could surface via MCP write tools (MCP-04) once Phase 4 lands — AI agents pulling a transcript could get the same enriched payload

**Cross-references:**

- Reference content saved at `.planning/phases/999.1-ai-ready-export-menu-and-transcript-metadata-enrichment/REFERENCE.md` (Loom transcript verbatim + URL)
- Adjacent to MCP-04 (ingest_transcript composite) — both touch "what does a transcript look like when an AI consumes it" — keep the schemas aligned
- Adjacent to ONB-05 (support popout) — both are top-bar dropdown UX patterns; share component primitives if possible

**Plans:** 0 plans

- [ ] TBD (promote with /gsd-review-backlog when ready)
