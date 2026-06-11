# Requirements: CallVault — Self-Serve Public Launch

**Defined:** 2026-05-27
**Core Value:** A team can centralize every call from every source into workspace-scoped vaults that an AI agent can both read from AND write into — and the experience is reliable enough that a stranger off the internet can wire it up themselves without help.

---

## v1 Requirements

### Onboarding (Workstream 1)

- [x] **ONB-01**: First-run wizard polish — no dead ends, first connector sync completes cleanly, clear "you're done" state
- [x] **ONB-02**: Empty states on every zero-data surface (calls list, workspaces, folders, contacts, settings) with a real CTA
- [x] **ONB-03**: Polar billing upgrade flow — paywall gates on Pro/Team features, upgrade dialog, post-upgrade success state
- [x] **ONB-04**: Public-launch landing-to-app flow audit — signup, email verification, first session, first connector all chained without dead air
- [x] **ONB-05**: Support popout — single top-bar popout exposes four actions: "How it works" (existing content surfaced inline), "Take the tour" (existing `tour.ts` trigger), Mintlify-powered docs search (embed or link to `docs.callvaultai.com`), and "Submit a ticket" form. Submit-ticket sends a Resend email to `support@callvaultai.com` (cc Andrew per ops decision) with user message + auto-attached context (current URL, user agent, console errors, active recording ID if on detail page)

### Connector Reliability (Workstream 2)

- [x] **CON-01**: Unhappy-path hardening across all 7 connectors — token refresh, expired-token recovery, rate-limit handling, webhook retry-with-backoff, partial-sync resume, dedup edge cases
- [x] **CON-02**: Single per-workspace connection-status UI — connected sources, last sync, error state, reconnect button (consolidates today's scattered surface)
- [ ] **CON-03**: Disconnect-and-reconnect flow polish — clean teardown of tokens/webhooks on disconnect; smooth re-auth; user-friendly OAuth callback error messages
- [ ] **CON-04**: Per-workspace connector binding — each connector instance can be assigned to a specific workspace (today binding is at org or user level depending on source)

### Paste Transcript Pipeline (Workstream 3 — descoped from "manual upload" to paste-only)

> **Scope change (2026-05-27):** Andrew descoped the async transcription pipeline and file upload from this milestone. CallVault is not becoming a transcription service right now. The launch milestone polishes the paste path and removes file upload from the UI entry points. Async transcription + audio format expansion are deferred to v2.

- [x] **MAN-02**: More transcript formats for paste path — beyond VTT/raw: SRT (via `npm:subtitle@4.2.2`), Otter TXT export; canonical CallVault JSON shape documented
- [x] **MAN-04**: Behavioral HTTP integration tests for `save-pasted-transcript` — real-Supabase tests, NOT mocked (CONCERNS Phase 30 / BUG-01 precedent). Exercise auth rejection, dedup enforcement, format detection (VTT / SRT / Otter / raw), workspace membership gate
- [x] **MAN-05**: Friendly error UX for failed pastes — clear messaging on bad format, dedup hits, parse errors, workspace permission failures. User is never left wondering whether their paste worked
- [x] **MAN-06**: Remove FileUploadDropzone from the import flow — hide all file-upload entry points; remove from Import sources list, Pane 2 Import surface, and any onboarding cue. Existing `file-upload-transcribe` Edge Function stays deployed (no behavior change for any callers in transit), but the UI no longer surfaces it

### Multi-MCP Architecture (Workstream 4)

- [x] **MCP-01**: Per-workspace MCP endpoints — path-based URLs `https://mcp.callvaultai.com/w/{workspace_uuid}` (UUID, not workspace slug, so workspace renames do not break clients); audience validation cross-checks token's `workspace_id` or org-owns-workspace; one organization can have multiple simultaneous MCP connections with different workspace/category scopes
- [x] **MCP-02**: Connectors UX per workspace — the existing/renamed Connectors surface exposes "MCP connection" setup with OAuth as the primary flow and token/manual config as the fallback. One click shows the friendly `mcp.callvaultai.com/w/{workspace_uuid}` URL and client snippets for Claude Desktop, Cursor, and generic MCP clients; users should never need to see or copy the raw Supabase function URL. OAuth setup must persist a per-AI-client grant keyed by Supabase OAuth `client_id` so Claude Desktop, Cursor, ChatGPT, Perplexity, and other dynamically-registered clients can be listed and revoked separately.
- [x] **MCP-03**: MCP connection management UI in Connectors — mint, list, revoke, and rotate org-scoped and workspace-scoped manual MCP tokens; list and revoke OAuth-connected AI clients; show connection type (OAuth client or manual token), client/token name, scope (org or workspace), workspace, enabled categories, endpoint/resource URL, last-used, created-by/name, revoke/rotate actions, and prefixed manual tokens (`cv_ws_<hex>` / `cv_org_<hex>`); support multiple active OAuth grants and manual tokens per org/workspace with different scopes. OAuth grants must enforce CallVault MCP categories (`read`, `write`, `ai`, `admin`) from a CallVault grant table because Supabase OAuth scopes only cover OIDC identity data and custom scopes are not currently supported.
- [x] **MCP-04**: MCP write tools optimized for AI-driven upload/manual vault addition — new `ingest_transcript` composite lets an MCP client add an already-transcribed call/manual transcript directly into the vault with transcript + metadata + speakers + tags + notes + folder in one call; plus atomic `append_to_transcript`, `update_call_metadata`, `set_speakers`. Org/workspace targeting follows token scope: workspace-scoped endpoint/token writes only to that workspace; org-scoped token may choose an authorized workspace explicitly. Existing/admin tools for `create_organization` and `create_workspace` remain available only behind admin category permissions. Tools/list filtered by `token.enabled_categories`
- [x] **MCP-05**: Refactor `mcp-server/index.ts` monolith (3,921 LOC) — internal split into `tools/{read,write,ai}/<tool>.ts` modules + `tools/registry.ts` handler map; ONE Edge Function retained ("fat function" guidance); dynamic-import AI SDK deps in AI handlers only

### Cross-Cutting Hardening (Pre-Launch Hygiene)

- [x] **HRD-01**: `sync-tab` reads from canonical `recordings` table (UUID-keyed) instead of `fathom_calls` (BIGINT-keyed) — non-Fathom recordings (Zoom, Grain, Read.ai, manual) become visible in the sync tab
- [x] **HRD-02**: Fill `CROSS_ORG_TABLES` gaps in RLS regression test — add `mcp_tokens`, `personal_folders`, `personal_tags`, `personal_folder_recordings`, `personal_tag_recordings`, `call_notes`, `contact_folders`, `import_sources`, `import_routing_rules`

### Autonomous Admin Center (Workstream 5 — added 2026-06-10)

Reference articulation: E5 ISA at `~/.claude/PAI/MEMORY/WORK/20260610-autonomous-admin-center/ISA.md` (security model ISC-104..120 binds AUTO requirements).

**Spike (gate for everything below)**
- [x] **SPK-01**: Throwaway 2-day spike proves headless `claude` can fix planted bugs unattended (≥3/5 fixtures incl. 1 unreproducible escalated, 1 out-of-policy diverted) from a launchd (non-interactive) context within subscription rate limits

**Tickets**
- [x] **TKT-01**: Tickets persist in DB — `tickets`, `ticket_messages`, `ticket_events` tables with RLS (reporter sees own, ADMIN sees all); existing support form writes here (email to support@ becomes a side-effect, not the store)
- [x] **TKT-02**: Admin can view tickets in AdminTab — list with status/severity/source filters + detail view with full event timeline
- [x] **TKT-03**: Admin can submit a ticket in-app (bug or task) with context auto-attached
- [x] **TKT-04**: Every ticket status transition is recorded in `ticket_events` (audit trail reconstructs the full lifecycle)

**Sentry ingestion**
- [ ] **SEN-01**: Sentry issue alerts create tickets automatically via a Supabase Edge Function webhook (org `ai-simple`, project `call-vault`)
- [ ] **SEN-02**: Sentry-created tickets dedupe by error fingerprint (same error twice → one ticket, occurrence count incremented)

**Autopilot dispatcher (lives at `~/dev/autopilot/`, outside this repo)**
- [x] **AUTO-01**: Dispatcher daemon (launchd) claims new tickets atomically and spawns one headless subscription-billed `claude` fix run per ticket (concurrency 1, time-budget kill, heartbeat)
- [ ] **AUTO-02**: Every fix run executes in an ephemeral per-run `git worktree` under a sandboxed context — never in the live checkout, no access to `~/.ssh`/other repos/primary `gh` token
- [ ] **AUTO-03**: A deterministic non-LLM push-gate script diffs candidate changes against a blast-radius denylist (migrations, RLS, auth, billing) — in-policy fixes push to main; out-of-policy fixes go to a branch/PR; gate re-checks kill switch immediately pre-push
- [ ] **AUTO-04**: Kill switch (single flag) pauses all autonomous processing within one poll cycle, including in-flight runs pre-push
- [ ] **AUTO-05**: Independent watchdog (separate process) pages admin when the dispatcher heartbeat goes stale
- [ ] **AUTO-06**: Each fix run writes an evidence bundle back to the ticket — diff summary, test output, verification proof, deploy SHA check

**In-app approval**
- [ ] **APPR-01**: Admin sees fix summary + evidence on the ticket detail and can approve or reject right in the app
- [ ] **APPR-02**: Approval event triggers the local dispatcher to merge/push the held change; rejection posts the reason to the ticket and closes the branch
- [ ] **APPR-03**: No agent-authored change reaches main without either an in-policy push-gate pass or an explicit admin approval event (CI excludes agent PRs from auto-merge)

**Cleanup**
- [x] **FLAG-01**: Feature-flag system removed entirely — `feature_flags` table, `useFeatureFlags` hook, gates in `Layout.tsx`/`sidebar-nav.tsx`/AdminTab toggles; currently-gated surfaces hard-enabled
- [x] **CAP-01**: Support-form screen capture captures the problem view, not the open dialog (pre-dialog capture or `excludeElements`); console-log buffer auto-attached to the ticket

---

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Onboarding Instrumentation

- **TEL-01**: Onboarding drop-off telemetry — events for each onboarding step, funnel view, drop-off alerts. (Ship launch first, instrument based on real drop-off data.)

### MCP Expansion

- **MCP-V2-01**: Human-friendly workspace slugs in URLs (`/mcp/w/sales-q2-2026`) — currently UUID-only
- **MCP-V2-02**: `bulk_ingest_transcripts` composite tool — array variant of `ingest_transcript` for batch operations
- **MCP-V2-03**: External MCP gateway — register external MCPs (Linear/Slack/Notion) per workspace; CallVault becomes meta-gateway

### File Upload + Async Transcription (deferred from v1 — 2026-05-27 scope change)

- **MAN-01**: Async transcription pipeline — Supabase pgmq + pg_cron + TUS direct-to-Storage upload; worker routes to Whisper (≤25MB) or Deepgram callback mode (>25MB); lifts the 25MB ceiling to 2GB. Research already done — see `.planning/research/ASYNC-TRANSCRIPTION-PIPELINE.md`. Deferred because CallVault is not becoming a transcription service in the launch milestone.
- **MAN-03**: More audio formats — beyond MP3/MP4: m4a/wav/ogg/opus/flac/aac via Deepgram routing (no ffmpeg). Depends on MAN-01.
- **MAN-V2-01**: Bulk upload — drag a folder, paste a CSV of URLs, upload a Fathom export zip
- **MAN-V2-02**: Metadata association at upload time — assign workspace/folder/tags/participants in the upload dialog

### Personal Folders Feature

- **PF-V2-01**: Wire up `personal_folders` service stubs — implement real queries, add to `CROSS_ORG_TABLES`. (Migration + RLS exist; feature dead in prod today; separate feature decision.)

### Autopilot v2 (deferred from Workstream 5 — 2026-06-10)

- **AP-V2-01**: Telegram bridge — long-polling bot relaying ticket threads to admin Telegram with approve/reject/takeover command grammar (white-labeled; users never see Telegram)
- **AP-V2-02**: User-facing support chat threads — in-app conversation UI on tickets (Supabase Realtime), agent + admin replies render under product branding
- **AP-V2-03**: Per-category autonomy ladder with admin-gated promotion + 30-day fix-survival metric + canary re-tests (trust expansion beyond the v1 in-policy/approval split)
- **AP-V2-04**: User-submitted tickets from non-admin platform users routed through the autonomous pipeline (v1 scope limits autonomous processing to admin-submitted + Sentry tickets)

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-vendor MCP gateway (CallVault proxying external MCPs like Linear/Slack/Notion) | Considered and explicitly ruled out. Different product story; scope here is per-workspace CallVault MCPs only. |
| Onboarding drop-off telemetry & funnel analysis | Ship first, instrument second. Add after real drop-off data exists. |
| YouTube AI Chat (`YouTubeChatSection` re-wire) | Deleted with "restore later" comment; not a launch blocker. |
| CSP hardening (remove `unsafe-inline` / `unsafe-eval`) | Security hardening; RLS + JWT auth already gate the data layer. Not a launch blocker. |
| Sentry release tagging in `Sentry.init` | Quality-of-life observability fix; not blocking. |
| `TranscriptsTab.tsx` 1,397-line refactor | Internal tech-debt cleanup, not user-visible. Defer to post-launch hardening. |
| Stripe wiring removal | Legacy keys in `.env.example` are inert; cleanup not blocking. |
| `tag_preferences.organization_id` migration (issue #173) | Low blast radius today; defer to multi-org-usage hardening. |
| `_shared/deduplication.ts` dead-code deletion | Confusing but inert; defer. |
| ffmpeg.wasm in Edge Functions for audio conversion | Anti-pattern per research — 25-40MB bundle bloat, OOM risk in isolates. Provider routing (Deepgram for non-Whisper formats) is the recommended path when transcription pipeline lands in v2. |
| Chunking audio to fit Whisper's 25MB cap | Anti-pattern per research — Deepgram callback mode is the recommended path when transcription pipeline lands in v2. |
| File upload in import flow (FileUploadDropzone UI) | Deferred 2026-05-27 — CallVault is not becoming a transcription service in this milestone. Paste is the manual import path. Existing `file-upload-transcribe` Edge Function stays deployed but is no longer surfaced in the UI. |
| Subdomain-based per-workspace MCP URLs | Anti-pattern per research — wildcard cert + DNS per workspace with zero offsetting benefit. Path-based URLs are the production pattern. |
| Splitting `mcp-server` into 36 separate Edge Functions | Anti-pattern per research — multiplies cold-start tax. Internal module split is the recommended path. |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| MAN-02 | Phase 1 — Paste Pipeline Polish | Complete |
| MAN-04 | Phase 1 — Paste Pipeline Polish | Complete |
| MAN-05 | Phase 1 — Paste Pipeline Polish | Complete |
| MAN-06 | Phase 1 — Paste Pipeline Polish | Complete |
| MCP-05 | Phase 2 — MCP Monolith Refactor | Complete |
| MCP-01 | Phase 3 — Per-Workspace MCP Endpoints | Complete |
| MCP-02 | Phase 3 — Per-Workspace MCP Endpoints | Complete |
| MCP-03 | Phase 3 — Per-Workspace MCP Endpoints | Complete |
| MCP-04 | Phase 4 — MCP AI Write Tools | Complete |
| CON-01 | Phase 5 — Connectors + Unified Sync Tab | Complete |
| CON-02 | Phase 5 — Connectors + Unified Sync Tab | Complete |
| CON-03 | Phase 5 — Connectors + Unified Sync Tab | Pending |
| CON-04 | Phase 5 — Connectors + Unified Sync Tab | Pending |
| HRD-01 | Phase 5 — Connectors + Unified Sync Tab | Complete |
| ONB-01 | Phase 6 — Launch UX + Support + RLS Hygiene | Complete |
| ONB-02 | Phase 6 — Launch UX + Support + RLS Hygiene | Complete |
| ONB-03 | Phase 6 — Launch UX + Support + RLS Hygiene | Complete |
| ONB-04 | Phase 6 — Launch UX + Support + RLS Hygiene | Complete |
| ONB-05 | Phase 6 — Launch UX + Support + RLS Hygiene | Complete |
| HRD-02 | Phase 6 — Launch UX + Support + RLS Hygiene | Complete |
| SPK-01 | Phase 10 — Autopilot Spike | Complete |
| FLAG-01 | Phase 11 — Ticket Foundation + Flag Removal | Complete |
| TKT-01 | Phase 11 — Ticket Foundation + Flag Removal | Complete |
| TKT-02 | Phase 11 — Ticket Foundation + Flag Removal | Complete |
| TKT-03 | Phase 11 — Ticket Foundation + Flag Removal | Complete |
| TKT-04 | Phase 11 — Ticket Foundation + Flag Removal | Complete |
| SEN-01 | Phase 12 — Sentry Ingestion | Pending |
| SEN-02 | Phase 12 — Sentry Ingestion | Pending |
| AUTO-01 | Phase 13 — Dispatcher + Mechanical Safety | Complete |
| AUTO-02 | Phase 13 — Dispatcher + Mechanical Safety | Pending |
| AUTO-03 | Phase 13 — Dispatcher + Mechanical Safety | Pending |
| AUTO-04 | Phase 13 — Dispatcher + Mechanical Safety | Pending |
| AUTO-05 | Phase 13 — Dispatcher + Mechanical Safety | Pending |
| AUTO-06 | Phase 13 — Dispatcher + Mechanical Safety | Pending |
| APPR-01 | Phase 14 — In-App Approval Loop | Pending |
| APPR-02 | Phase 14 — In-App Approval Loop | Pending |
| APPR-03 | Phase 14 — In-App Approval Loop | Pending |
| CAP-01 | Phase 15 — Support Capture Fix | Complete |

**Coverage:**
- v1 requirements: 38 total (20 launch + 18 Autopilot/Workstream 5 added 2026-06-10)
- Mapped to phases: 38
- Unmapped: 0

Each requirement maps to exactly one phase. MAN-01 and MAN-03 moved to v2 deferred — see v2 section. Workstream 5 (Autonomous Admin Center) requirements SPK-01, FLAG-01, TKT-01..04, SEN-01..02, AUTO-01..06, APPR-01..03, CAP-01 map to Phases 10-15; Telegram/user-chat/autonomy-ladder deferred to v2 (AP-V2-01..04).

---
*Requirements defined: 2026-05-27*
*Last updated: 2026-05-27 — Scope change: deferred file upload + async transcription to v2; new req MAN-06 (remove FileUploadDropzone UI); traceability remapped from 8 phases to 6.*
*Amended: 2026-06-10 — Appended Workstream 5 (Autonomous Admin Center) traceability rows for Phases 10-15; existing rows unchanged.*
