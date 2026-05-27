# Requirements: CallVault — Self-Serve Public Launch

**Defined:** 2026-05-27
**Core Value:** A team can centralize every call from every source into workspace-scoped vaults that an AI agent can both read from AND write into — and the experience is reliable enough that a stranger off the internet can wire it up themselves without help.

---

## v1 Requirements

### Onboarding (Workstream 1)

- [ ] **ONB-01**: First-run wizard polish — no dead ends, first connector sync completes cleanly, clear "you're done" state
- [ ] **ONB-02**: Empty states on every zero-data surface (calls list, workspaces, folders, contacts, settings) with a real CTA
- [ ] **ONB-03**: Polar billing upgrade flow — paywall gates on Pro/Team features, upgrade dialog, post-upgrade success state
- [ ] **ONB-04**: Public-launch landing-to-app flow audit — signup, email verification, first session, first connector all chained without dead air

### Connector Reliability (Workstream 2)

- [ ] **CON-01**: Unhappy-path hardening across all 7 connectors — token refresh, expired-token recovery, rate-limit handling, webhook retry-with-backoff, partial-sync resume, dedup edge cases
- [ ] **CON-02**: Single per-workspace connection-status UI — connected sources, last sync, error state, reconnect button (consolidates today's scattered surface)
- [ ] **CON-03**: Disconnect-and-reconnect flow polish — clean teardown of tokens/webhooks on disconnect; smooth re-auth; user-friendly OAuth callback error messages
- [ ] **CON-04**: Per-workspace connector binding — each connector instance can be assigned to a specific workspace (today binding is at org or user level depending on source)

### Manual Upload Pipeline (Workstream 3)

- [ ] **MAN-01**: Async transcription pipeline — Supabase pgmq + pg_cron + TUS direct-to-Storage upload; worker routes to Whisper (≤25MB) or Deepgram callback mode (>25MB); lifts the 25MB ceiling to 2GB
- [ ] **MAN-02**: More transcript formats — beyond VTT/raw: SRT (via `npm:subtitle@4.2.2`), Otter TXT export; canonical CallVault JSON shape documented
- [ ] **MAN-03**: More audio formats — beyond MP3/MP4: m4a/wav/ogg/opus/flac/aac via Deepgram routing (no ffmpeg)
- [ ] **MAN-04**: Behavioral HTTP integration tests for `save-pasted-transcript` and the async pipeline end-to-end — real-Supabase tests, NOT mocked (CONCERNS Phase 30 / BUG-01 precedent)
- [ ] **MAN-05**: Friendly error UX for failed uploads — `transcription_jobs.status='failed'` surfaces with retry button; Realtime broadcast invalidates client cache; "Transcribing…" placeholder for in-flight jobs

### Multi-MCP Architecture (Workstream 4)

- [ ] **MCP-01**: Per-workspace MCP endpoints — path-based URLs `https://api.callvaultai.com/mcp/w/{workspace_uuid}` (Notion/Linear pattern); audience validation cross-checks token's workspace_id or org-owns-workspace
- [ ] **MCP-02**: "Connect to AI" UX per workspace — one click → MCP config snippet (URL + workspace-scoped token) ready to paste into Claude Desktop, Cursor, or any MCP client
- [ ] **MCP-03**: Token management UI — mint, list, revoke MCP tokens per workspace; show last-used; rotate flow; prefixed hex tokens (`cv_ws_<hex>` / `cv_org_<hex>`)
- [ ] **MCP-04**: MCP write tools optimized for AI-driven upload — new `ingest_transcript` composite (transcript + metadata + speakers + tags + notes + folder in one call); plus atomic `append_to_transcript`, `update_call_metadata`, `set_speakers`. Tools/list filtered by `token.enabled_categories`
- [ ] **MCP-05**: Refactor `mcp-server/index.ts` monolith (3,921 LOC) — internal split into `tools/{read,write,ai}/<tool>.ts` modules + `tools/registry.ts` handler map; ONE Edge Function retained ("fat function" guidance); dynamic-import AI SDK deps in AI handlers only

### Cross-Cutting Hardening (Pre-Launch Hygiene)

- [ ] **HRD-01**: `sync-tab` reads from canonical `recordings` table (UUID-keyed) instead of `fathom_calls` (BIGINT-keyed) — non-Fathom recordings (Zoom, Grain, Read.ai, manual) become visible in the sync tab
- [ ] **HRD-02**: Fill `CROSS_ORG_TABLES` gaps in RLS regression test — add `mcp_tokens`, `personal_folders`, `personal_tags`, `personal_folder_recordings`, `personal_tag_recordings`, `call_notes`, `contact_folders`, `import_sources`, `import_routing_rules`

---

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Onboarding Instrumentation

- **TEL-01**: Onboarding drop-off telemetry — events for each onboarding step, funnel view, drop-off alerts. (Ship launch first, instrument based on real drop-off data.)

### MCP Expansion

- **MCP-V2-01**: Human-friendly workspace slugs in URLs (`/mcp/w/sales-q2-2026`) — currently UUID-only
- **MCP-V2-02**: `bulk_ingest_transcripts` composite tool — array variant of `ingest_transcript` for batch operations
- **MCP-V2-03**: External MCP gateway — register external MCPs (Linear/Slack/Notion) per workspace; CallVault becomes meta-gateway

### Manual Upload

- **MAN-V2-01**: Bulk upload — drag a folder, paste a CSV of URLs, upload a Fathom export zip
- **MAN-V2-02**: Metadata association at upload time — assign workspace/folder/tags/participants in the upload dialog

### Personal Folders Feature

- **PF-V2-01**: Wire up `personal_folders` service stubs — implement real queries, add to `CROSS_ORG_TABLES`. (Migration + RLS exist; feature dead in prod today; separate feature decision.)

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
| ffmpeg.wasm in Edge Functions for audio conversion | Anti-pattern per research — 25-40MB bundle bloat, OOM risk in isolates. Provider routing (Deepgram for non-Whisper formats) is the recommended path. |
| Chunking audio to fit Whisper's 25MB cap | Anti-pattern per research — would eat the wall-clock budget the async pipeline just freed. Deepgram callback mode is the recommended path. |
| Subdomain-based per-workspace MCP URLs | Anti-pattern per research — wildcard cert + DNS per workspace with zero offsetting benefit. Path-based URLs are the production pattern. |
| Splitting `mcp-server` into 36 separate Edge Functions | Anti-pattern per research — multiplies cold-start tax. Internal module split is the recommended path. |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ONB-01 | TBD (roadmapper) | Pending |
| ONB-02 | TBD | Pending |
| ONB-03 | TBD | Pending |
| ONB-04 | TBD | Pending |
| CON-01 | TBD | Pending |
| CON-02 | TBD | Pending |
| CON-03 | TBD | Pending |
| CON-04 | TBD | Pending |
| MAN-01 | TBD | Pending |
| MAN-02 | TBD | Pending |
| MAN-03 | TBD | Pending |
| MAN-04 | TBD | Pending |
| MAN-05 | TBD | Pending |
| MCP-01 | TBD | Pending |
| MCP-02 | TBD | Pending |
| MCP-03 | TBD | Pending |
| MCP-04 | TBD | Pending |
| MCP-05 | TBD | Pending |
| HRD-01 | TBD | Pending |
| HRD-02 | TBD | Pending |

**Coverage:**
- v1 requirements: 20 total
- Mapped to phases: 0 (pending roadmap creation)
- Unmapped: 20 ⚠️ (will be resolved by gsd-roadmapper)

---
*Requirements defined: 2026-05-27*
*Last updated: 2026-05-27 after initial definition*
