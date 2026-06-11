# Roadmap: CallVault — Self-Serve Public Launch

**Created:** 2026-05-27
**Last updated:** 2026-06-10 — Phase 6.1 MCP Subdomain Routing completed; all 14 plans executed and verified.
**Amended:** 2026-06-10 — Workstream 5 (Autonomous Admin Center / Autopilot) appended as Phases 10-15. Launch phases 1-9 / 6.x / 8.1 unchanged.
**Granularity:** standard
**Mode:** mvp
**Coverage:** 38/38 v1 requirements mapped (20 launch + 18 Autopilot added 2026-06-10)
**Workstreams:** 5 (Onboarding, Connector Reliability, Paste Pipeline Polish, Multi-MCP, Autonomous Admin Center) + Cross-cutting hardening

---

## Phases

- [x] **Phase 1: Paste Pipeline Polish** — SRT/Otter/VTT/raw all parse correctly via `save-pasted-transcript`; real-Supabase integration tests guard the path; failed pastes show friendly errors; FileUploadDropzone removed from import UI (completed 2026-05-27)
- [x] **Phase 2: MCP Monolith Refactor** — `mcp-server/index.ts` split into per-tool modules + handler-map dispatch with zero behavior change; AI deps dynamic-imported; cold starts drop on read paths (completed 2026-05-28 — 02-VERIFICATION.md passed; D-09 cold-start ≥30% unprovable, no pre-refactor baseline)
- [x] **Phase 3: Per-Workspace MCP Endpoints + Connectors Setup** — `mcp/w/{workspace_uuid}` URLs live; audience-bound per RFC 8707; OAuth-first setup plus one-click config snippets for Claude Desktop / Cursor / mcp-remote from the Connectors surface; connection management UI covers both OAuth-connected AI clients and manual tokens (completed 2026-05-28)
- [x] **Phase 4: MCP AI Write Tools** — `ingest_transcript` composite + atomic `append_to_transcript`, `update_call_metadata`, `set_speakers`; agents add already-transcribed calls/manual transcripts to the vault with metadata + speakers + tags + folder in one permission-bound workspace call (completed 2026-05-30)
- [x] **Phase 5: Connector Reliability + Per-Workspace Binding + Unified Sync Tab** — All 7 connectors survive unhappy paths; one per-workspace connection-status surface; per-workspace connector assignment; sync tab shows every source not just Fathom (completed 2026-05-31)
- [x] **Phase 6: Launch UX + Support + RLS Hygiene** — Stranger off the internet completes signup→connector→vault→upgrade without dead air; support popout (how it works, tour, Mintlify docs, submit ticket); RLS regression test covers all user-facing tables; public-launch ready (completed 2026-06-01)
- [x] **Phase 6.1: MCP Subdomain Routing** — Per-org subdomain URLs (`orgslug.callvaultai.com/mcp`, `orgslug-wsslug.callvaultai.com/mcp`) so multi-org operators hold simultaneous Claude connections; 7 Critical/High security gates close before wildcard DNS provisioned; Wave 1 (7 parallel fixes) ships first (completed 2026-06-10)
- [x] **Phase 6.2: CallVault REST API** — `api.callvaultai.com/v1/*` with personal `token_source='api'` bearer tokens; contacts, calls, workspaces, and speakers endpoints (completed 2026-06-09)
- [x] **Phase 6.3: Obsidian Sync Improvements** — Bulk zip export + Obsidian-format markdown notes (completed 2026-06-09)
- [ ] **Phase 7: Recording ID and Folder Assignment Correctness** — fix UUID/BIGINT folder assignment failures, modern folder filtering gaps, and regression coverage around canonical recordings
- [x] **Phase 8: Full-Suite Test Recovery** — restore `npm test` to green by fixing stale MCP count expectations, auth-provider test harness gaps, Deno/Vitest drift, and Fathom adapter fixture drift (completed 2026-06-10)
- [x] **Phase 08.1: Connector Transcript Normalization** — preserve provider speaker turns, timestamps, durations, and participant identities from all synced sources into canonical transcript display/export data (completed 2026-06-10)
- [x] **Phase 9: Lint, Brand, and Documentation Hygiene** — reduce lint warning debt and clean forbidden brand/tooling drift in docs without touching product behavior (completed 2026-06-10)

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

  1. Every existing MCP tool (current production surface: 41 total) returns byte-identical responses post-refactor — verified by replaying a captured request fixture set against the new dispatcher and diffing the response JSON.
  2. `mcp-server/index.ts` is ≤300 LOC and contains only HTTP/CORS, auth dispatch, plan-gating, and the handler-map lookup. Each tool lives in `tools/{read,write,admin,ai}/<tool-name>.ts` exporting a `ToolModule` with `{ definition, handler, category }`.
  3. Cold-start latency on a read-only tool (e.g., `list_calls`) on a freshly-deployed function drops by ≥30% vs the pre-refactor baseline (warm-vs-cold p95 of 10 invocations each). AI SDK deps no longer load on non-AI tool calls.
  4. `tools/list` continues to filter by `token.enabled_categories` (SEP-1881 compliance not regressed).
  5. The MCP runbook contract holds: all tool responses still emit `content[].text` markdown (NOT structured JSON); verified by interceptor against `mcp.callvaultai.com` before and after deploy.

**Plans:** 8/8 plans complete

- [x] `02-01-PLAN.md` — Golden replay fixtures, contract-surface audit, and live/cold-start verification commands
- [x] `02-02-PLAN.md` — Protocol, auth, gating, and shared tool type extraction with service-role auth preserved
- [x] `02-03-PLAN.md` — Registry dispatcher plus pilot core read-tool extraction
- [x] `02-04-PLAN.md` — Remaining read-tool extraction with notes/shared-call boundary coverage
- [x] `02-05-PLAN.md` — Current write-tool extraction without adding Phase 4 tools
- [x] `02-06-PLAN.md` — Admin-tool extraction and category-gating preservation
- [x] `02-07-PLAN.md` — AI-tool extraction with dynamic OpenRouter/AI SDK imports
- [x] `02-08-PLAN.md` — Final `index.ts` trim, build/test gates, deployment smoke, and cold-start proof (candidate timing captured; 30% improvement not verified because no pre-refactor baseline exists)

### Phase 3: Per-Workspace MCP Endpoints + Connectors Setup

**Goal:** Each workspace exposes its own stable UUID-based MCP URL that AI clients see as a distinct connection; users can wire any workspace into Claude Desktop / Cursor / a generic MCP client from the Connectors surface in one click; OAuth is the primary setup path; token/manual config is available as a fallback; OAuth-connected AI clients and manual tokens are visible, permission-scoped, revocable, and auditable per org/workspace.
**Mode:** mvp
**Depends on:** Phase 2 (path routing is added to the refactored modular server — not the monolith)
**Requirements:** MCP-01, MCP-02, MCP-03
**Success Criteria** (what must be TRUE):

  1. A user can complete the primary OAuth setup flow from a workspace's Connectors surface and the AI client connects to that workspace's vault only (other workspaces in the same org are invisible to that connection).
  2. Manual/token fallback is clear and simple: users can copy a config snippet for `claude_desktop_config.json`, `.cursor/mcp.json`, or generic `mcp-remote`; org-scoped snippets use `https://mcp.callvaultai.com`, workspace-scoped snippets use `https://mcp.callvaultai.com/w/{workspace_uuid}`, and no UI or snippet exposes the raw Supabase function URL.
  3. `https://mcp.callvaultai.com/w/{workspace_uuid}` returns workspace-scoped tools for a valid workspace token; presenting a token for workspace A to workspace B's URL returns HTTP 403 (audience binding per RFC 8707, NOT 401).
  4. UUID path scoping is deliberate: workspace renames do not change the MCP URL. Human-friendly slugs remain v2-only unless explicitly promoted.
  5. The per-workspace PRM document at `/.well-known/oauth-protected-resource/mcp/w/{workspace_uuid}` advertises the correct workspace-scoped `resource` value; OAuth-discovery clients (Claude Desktop wizard) negotiate successfully.
  6. The Connectors connection-management UI lists every active MCP OAuth AI-client grant and manual token per org/workspace with client/token name, client type (OAuth or manual token), scope (`organization` or `workspace`), workspace name, endpoint URL/resource, enabled categories, last-used, created-by/name, and revoke/rotate actions where applicable.
  7. OAuth-connected AI clients are persisted in a first-class CallVault grant table keyed by authenticated user + OAuth `client_id` + org/workspace. The old `mcp_oauth_org_bindings` one-row-per-user behavior is replaced or migrated so multiple AI clients can coexist and be shown separately.
  8. OAuth MCP authentication decodes/verifies the Supabase JWT, resolves the `client_id` to the persisted CallVault grant, updates `last_used_at`, and enforces that grant's `enabled_categories`; OAuth clients must not continue to receive synthetic full-access `enabled_categories: null` unless explicitly granted full access.
  9. Revoking an OAuth-connected AI client from Connectors revokes the Supabase OAuth grant when available and marks the CallVault grant revoked; revoked OAuth clients and revoked manual tokens reject within one request cycle.
  10. Multiple active MCP OAuth grants and manual tokens can coexist in the same organization with different workspace scopes and enabled category scopes.
  11. New manual tokens are minted with self-describing `cv_ws_<hex>` / `cv_org_<hex>` prefixes; legacy hex tokens still validate via fallback regex.

**Research Notes:**

  - Supabase OAuth Server docs: "Access tokens are standard Supabase JWTs that include `user_id`, `role`, and `client_id` claims." Source: https://supabase.com/docs/guides/auth/oauth-server
  - Supabase Token Security docs: "Scopes control OIDC data, not database access"; CallVault must store/enforce MCP categories (`read`, `write`, `ai`, `admin`) itself rather than treating OAuth scopes as tool permissions. Source: https://supabase.com/docs/guides/auth/oauth-server/token-security
  - Supabase OAuth Flows docs: "Custom scopes are not currently supported." Source: https://supabase.com/docs/guides/auth/oauth-server/oauth-flows
  - Supabase MCP Auth docs: OAuth MCP clients use discovery, optional dynamic client registration, authorization, token exchange, and authenticated access; security guidance includes displaying client details and allowing users to revoke access later. Source: https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication

**Plans:** 6/6 plans complete
**UI hint:** yes

### Phase 4: MCP AI Write Tools

**Goal:** As a AI agent connected to an authorized CallVault workspace, I want to add an already-transcribed call/manual transcript with metadata, speakers, tags, notes, and folder context in one MCP call, so that the recording lands in the correct vault with clear provenance and can be corrected through targeted follow-up write tools.
**Mode:** mvp
**Depends on:** Phase 3 (write tools land on the workspace-scoped MCP endpoints). NO LONGER depends on async pipeline (file upload + MAN-01 were descoped) — `ingest_transcript` accepts already-transcribed text from the agent in-hand and writes the recording row synchronously via the existing `runPipeline()`.
**Requirements:** MCP-04
**Success Criteria** (what must be TRUE):

  1. An AI agent connected to `/mcp/w/{workspace_uuid}` can call `ingest_transcript` with `{ transcript, title, speakers, tags, notes, source_date, folder_id }` and the resulting recording, tags (deduped by lowercase name), contacts, and folder assignment all land atomically in that workspace — partial failures (e.g., speaker resolution failed) surface in the markdown response, not swallowed.
  2. An org-scoped MCP token can call `ingest_transcript` only when it supplies an authorized `workspace_id`; a workspace-scoped endpoint/token ignores or rejects mismatched workspace/org parameters and cannot write outside its bound workspace.
  3. Manual/vault-added MCP ingests preserve provenance as MCP/manual import metadata so they read as user-added transcripts, not connector-synced recordings.
  4. `append_to_transcript`, `update_call_metadata`, and `set_speakers` each perform exactly one logical action with no hidden side effects; `set_speakers` is idempotent.
  5. Tag and speaker fields accept names (not UUIDs); the server resolves them to IDs so agents that have only names from a transcript context can succeed without a prior lookup.
  6. `create_organization` and `create_workspace` remain available as admin MCP tools only when the token's enabled categories include `admin`; read/write-only tokens cannot see or invoke admin creation tools.
  7. `tools/list` filters the new tools by `token.enabled_categories`; a read-only token cannot see `ingest_transcript` exists.
  8. All new/updated write tools return `content[].text` markdown (runbook contract preserved); markdown summary includes the new recording's id, share URL, target org/workspace, and a created-vs-reused entity breakdown.

**Plans:** 5/5 plans complete

- [x] `04-01-PLAN.md` — Wave 0 tool-surface schemas, category gates, and behavioral contract tests
- [x] `04-02-PLAN.md` — `ingest_transcript` composite pipeline-first implementation with Manual MCP Import provenance
- [x] `04-03-PLAN.md` — Atomic `append_to_transcript`, `update_call_metadata`, and `set_speakers` follow-up tools
- [x] `04-04-PLAN.md` — Backend contract verification, runbook smoke commands, build/Deno gates, and live-smoke proof path
- [x] `04-05-PLAN.md` — Visible Manual MCP Import source identity, official MCP icon path, source-registry tests, and final build gate

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

**Plans:** 5/5 plans complete
**UI hint:** yes

- [x] `05-01-PLAN.md` — Workspace-binding schema, default backfill, connector status model, and blocking schema-push gate
- [x] `05-02-PLAN.md` — Unified Connections rows, Manage detail, setup workspace selection, and Import card status links
- [x] `05-03-PLAN.md` — Bound-workspace sync/webhook routing and refresh/rate-limit/partial-sync failure semantics
- [x] `05-04-PLAN.md` — SyncTab canonical `recordings` migration with all-source synced transcript visibility
- [x] `05-05-PLAN.md` — Provider verification matrix, automated gates, and browser verification closeout

### Phase 6: Launch UX + Support + RLS Hygiene

**Goal:** A stranger off the internet can sign up, verify email, connect their first source, get to a working vault, find help when stuck, and upgrade to Pro/Team — all without dead air or dead ends. Data-layer hygiene complete across every user-facing table before public launch.
**Mode:** mvp
**Depends on:** Phases 1–5 (this phase wraps and polishes everything users see; empty states and onboarding cues reference features built in prior phases)
**Requirements:** ONB-01, ONB-02, ONB-03, ONB-04, ONB-05, HRD-02
**Success Criteria** (what must be TRUE):

  1. A first-time user landing on `app.callvaultai.com` from a fresh browser session can complete the chain — signup → email verification → first session → first connector wired → first recording visible → support reachable if stuck — without a dead-end screen, blank state without a CTA, or unhandled error.
  2. Every zero-data surface (calls list, workspaces list, folders, contacts, settings tabs) shows an empty state with a real CTA that the user can follow to populate that surface, not a blank pane.
  3. A Free-tier user attempting a Pro/Team-gated feature sees a paywall with the Polar upgrade dialog inline; on successful checkout, the user lands on a post-upgrade success state with the gated feature usable in the same session (no logout/reload required).
  4. **Support popout (ONB-05):** A single popout accessible from the sidebar bottom above Settings exposes "Watch the Onboarding Video", "How It Works" (existing content), "Take the Tour" (existing `tour.ts` trigger), Support Docs at `https://docs.callvaultai.com`, and "Submit a Ticket". Submit-ticket sends a Resend email to `support@callvaultai.com` without default Andrew cc, with user message + basic auto-attached context (current URL, user agent, user ID, org ID, workspace ID, and app version/commit if easy).
  5. `src/test/rls-regression.test.ts` `CROSS_ORG_TABLES` covers all 9 currently-missing tables: `mcp_tokens`, `personal_folders`, `personal_tags`, `personal_folder_recordings`, `personal_tag_recordings`, `call_notes`, `contact_folders`, `import_sources`, `import_routing_rules`. Cross-org leak attempts on each fail.
  6. `interceptor` walkthrough of the full landing → signup → connect → vault → support popout → upgrade flow completes with no console errors, no 404s, no broken images, and no flickering pane transitions.

**Plans:** 7/8 plans executed
**UI hint:** yes

- [x] `06-01-PLAN.md` — First-run import landing, founder onboarding video, and explicit historical `Sync all`
- [x] `06-02-PLAN.md` — Sidebar Support popout, onboarding video/tour/docs actions, and authenticated support ticket email
- [x] `06-03-PLAN.md` — Action-first empty states and file-upload copy drift guards
- [x] `06-04-PLAN.md` — Inline paywall gates with Polar success-path preservation
- [x] `06-05-PLAN.md` — Real-Supabase RLS regression coverage for the 9 missing user-facing tables
- [x] `06-06-PLAN.md` — Fathom-first `Updated remotely` resync state for provider title changes

### Phase 6.1: MCP Subdomain Routing

**Goal:** Every CallVault org has a stable, unique MCP URL (`orgslug.callvaultai.com/mcp`) that Claude treats as a distinct connection origin; workspace-level scoping available at `orgslug-wsslug.callvaultai.com/mcp`; all Critical and High security vulnerabilities closed before wildcard DNS is provisioned; legacy `mcp.callvaultai.com` remains fully functional throughout.
**Mode:** mvp
**Depends on:** Phase 6 (complete). All Critical/High security gates (Wave 1 — 7 parallel fixes) must close before wildcard DNS is provisioned. First fix to ship: `sec-jwt-fix` in `supabase/functions/mcp-server/auth.ts`.
**ISA:** `~/.claude/PAI/MEMORY/WORK/20260608-mcp-subdomain-routing-arch/ISA.md` (181 ISCs; planning complete)
**Execution Plan:** `.planning/phases/03-per-workspace-mcp-endpoints-+-connect-to-ai/03-07-EXECUTION-PLAN.md`
**Requirements:** (TBD — assign formal REQ-IDs at phase plan)
**Success Criteria** (what must be TRUE):

  1. All 7 Critical/High security gates are verified green before wildcard DNS is provisioned: `sec-worker-bypass`, `sec-jwt-fix`, `sec-dcr-phishing`, `sec-slug-tombstone`, `sec-revocation-complete`, `sec-workspace-param`, `sec-worker-headers`.
  2. `readClientIdFromJwt()` is removed from `auth.ts`; `client_id` is extracted exclusively from the verified user object returned by `authClient.auth.getUser(rawToken)` — no raw base64 JWT decoding feeds any auth decision.
  3. Revocation DB triggers cover both `mcp_tokens` AND `mcp_oauth_client_grants` for workspace/org member removal; a revoked grant rejects on the next MCP call with 403 regardless of token type.
  4. `orgslug.callvaultai.com/mcp` routes a valid org-scoped token to the correct org's vault; presenting a token for Org A against Org B's subdomain returns 403 `token_org_mismatch`.
  5. `orgslug-wsslug.callvaultai.com/mcp` routes a valid workspace-scoped token to the correct workspace; wrong-workspace token returns 403.
  6. A multi-org operator can hold simultaneous MCP connections to two different orgs from a single Claude instance via two distinct subdomain URLs.
  7. `mcp.callvaultai.com` remains fully functional for all existing tokens throughout the migration; backward-compat URLs return 200 and include a `Deprecation: true` header.
  8. OAuth consent page shows `client_id` (UUID), a "First-time connection" warning badge for new clients, the redirect domain, and an advisory text — never `client_name` as the only client identifier.

**Plans:** 14/14 plans executed

### Phase 6.2: CallVault REST API

**Goal:** A developer authenticates with a personal `token_source='api'` bearer token and queries `api.callvaultai.com/v1/*` REST endpoints for contacts, calls, workspaces, and speakers — a stable, JSON-returning API surface independent of the MCP protocol.
**Mode:** mvp
**Depends on:** Nothing (independent — can run in parallel with Phase 6.1)
**Requirements:** (TBD)
**Success Criteria** (what must be TRUE):

  1. `GET api.callvaultai.com/v1/calls` returns a paginated JSON list of calls for the authenticated user's workspace.
  2. `GET api.callvaultai.com/v1/contacts` returns paginated contacts for the authenticated workspace.
  3. `GET api.callvaultai.com/v1/workspaces` returns all workspaces the authenticated user belongs to.
  4. `GET api.callvaultai.com/v1/speakers` returns speakers in the authenticated workspace.
  5. Personal API tokens with `token_source='api'` authenticate via `Authorization: Bearer` header; tokens with other `token_source` values are rejected with 403.
  6. A missing or invalid token returns HTTP 401 with a JSON error body — never 500 or a blank response.
  7. All responses use a consistent JSON envelope (e.g., `{ data, pagination }`) — not MCP `content[].text` markdown.

**Plans:** 4/4 plans complete

### Phase 6.3: Obsidian Sync Improvements

**Goal:** Users can export their entire vault as a single downloadable zip of Obsidian-compatible markdown files — one file per call — with YAML front matter and clean transcript body ready for drop-in use in an Obsidian vault.
**Mode:** mvp
**Depends on:** Phase 1 (transcript shapes established)
**Requirements:** (shipped — no formal REQ-IDs assigned)
**Success Criteria** (what must be TRUE):

  1. "Export as Obsidian zip" action produces a zip containing one `.md` file per call in the vault.
  2. Each markdown file includes YAML front matter: title, date, source, duration, speakers, tags, and folder.
  3. Markdown body uses Obsidian-compatible formatting with speaker attribution and timestamps.
  4. Zip export completes successfully for a user's full vault, with a planning acceptance target of at least 5,000 realistic transcript-bearing recordings. There must be no product-level 500-record export ceiling.

**Plans:** N/A (shipped without formal GSD plan tracking)

- [x] Shipped: bulk zip export + Obsidian-format markdown notes (completed 2026-06-09)

### Phase 06.3.2: fathom_provider_id rename — rename legacy_recording_id across DB, TS, and docs (INSERTED)

**Goal:** [Urgent work - to be planned]
**Requirements**: TBD
**Depends on:** Phase 6.3
**Plans:** 5/5 plans executed — production rollout gate NOT run (per 06.3.2-05-SUMMARY: prod DB migration, deploy, prod assertions, and smoke checks still required before claiming live)

Plans:

- [x] 06.3.2-01-PLAN.md
- [x] 06.3.2-02-PLAN.md
- [x] 06.3.2-03-PLAN.md
- [x] 06.3.2-04-PLAN.md
- [x] 06.3.2-05-PLAN.md (production rollout gate pending)

### Phase 7: Recording ID and Folder Assignment Correctness

**Goal:** Folder assignment and folder filtering work for every recording source by respecting the UUID/BIGINT boundary everywhere: Fathom legacy rows continue to support `folder_assignments`, while Zoom/manual/MCP/other canonical recordings update and filter through `workspace_entries.folder_id` or the appropriate UUID-keyed table.
**Mode:** mvp
**Depends on:** Phase 6 (launch surface complete); can run before Phase 6.1 if needed because this fixes existing product behavior.
**Requirements:** Review follow-up from full-codebase audit 2026-06-09
**Success Criteria** (what must be TRUE):

  1. `AssignFolderDialog` no longer parses mixed recording IDs with `parseInt()` / `Number()`; all mixed inputs route through `toRecordingUuid()` / `toRecordingUuidBatch()` or a service-layer API that owns the UUID/BIGINT split.
  2. Assigning a folder from `TranscriptsTab` succeeds for Fathom, Zoom, manual paste, MCP/manual import, and any row whose `recording_id` is already a canonical UUID; no success toast appears when no assignment was written.
  3. Folder assignment writes keep `workspace_entries.folder_id` and legacy `folder_assignments` consistent where both are applicable; non-Fathom rows are not forced into BIGINT-only tables.
  4. Named folder filtering reads both modern `workspace_entries.folder_id` and legacy `folder_assignments`, matching the behavior of `getWorkspaceFolderRecordingIds()`.
  5. Regression coverage proves canonical UUID recordings can be assigned, unassigned, and found through named folder filters without UUID/BIGINT type errors.
  6. Verification includes `npm run type-check`, relevant folder/transcript tests, and a browser walkthrough of assigning a non-Fathom/canonical recording to a folder.

**Plans:** 2/3 plans executed

Plans:

- [x] 07-01-PLAN.md — Service layer: assignWorkspaceEntryToFolder + getRecordingIdsForFolderFilter dual-source fix
- [x] 07-02-PLAN.md — UI layer: AssignFolderDialog toRecordingUuidBatch, folderingCallId widening, useFolderAssignment hooks (07-02-SUMMARY.md, 2026-06-09)
- [ ] 07-03-PLAN.md — DnD UUID fix, UUID round-trip regression tests, browser verification checkpoint

### Phase 8: Full-Suite Test Recovery

**Goal:** The default local quality gate is green again: `npm test` passes under Vitest, stale expectations are updated to current product contracts, and test harnesses provide the same providers/hooks that mounted components require in production.
**Mode:** mvp
**Depends on:** Phase 7 only if folder correctness changes tests in the same area; otherwise can run independently.
**Requirements:** Review follow-up from full-codebase audit 2026-06-09
**Success Criteria** (what must be TRUE):

  1. `supabase/functions/_shared/__tests__/connector-function-utils.test.ts` runs under Vitest instead of calling `Deno.test` directly, matching the rest of the Edge Function unit tests.
  2. `MCPTab.permissions.test.tsx` mocks or provides `useMcpOAuthGrantsList` / auth context so the panel mounts without `useAuth must be used within AuthProvider`.
  3. `IntegrationsTab.test.tsx` covers the Obsidian connector section with the required auth/org providers or focused mocks.
  4. MCP tool-category tests expect the current 45-tool surface and 16 write tools, while still byte-matching frontend and canonical maps.
  5. Fathom adapter tests include the current normalized fields (`syncState`, `recordingUuid`, `localTitle`, `remoteTitle`) and still assert the real import-wizard contract.
  6. `npm test`, `npm run type-check`, and `npm run build` all pass in the same session before completion.

**Plans:** 6/6 plans complete

**Wave 1** *(all parallel — no shared files)*

- [x] 08-01-PLAN.md — Deno/Vitest conversion for connector-function-utils.test.ts
- [x] 08-02-PLAN.md — Stale tool-count expectations (41→45, 12→16) in mcp-tool-categories.test.ts
- [x] 08-03-PLAN.md — useMcpOAuthGrants mock + write-count fix in MCPTab.permissions.test.tsx
- [x] 08-04-PLAN.md — useApiTokens mock in IntegrationsTab.test.tsx
- [x] 08-05-PLAN.md — Fathom adapter fixture drift: add 4 normalized fields

**Wave 2** *(blocked on all Wave 1 plans)*

- [x] 08-06-PLAN.md — Full quality gate: npm test + type-check + build green; commit

### Phase 08.1: Connector Transcript Normalization — preserve provider speaker turns, timestamps, durations, and participant identities across all connections (INSERTED)

**Goal:** All synced connector recordings preserve the transcript structure the provider already exposes: speaker labels, speaker emails/identities when available, start/end offsets, recording duration, and participant rows. Call detail bubbles, blue host alignment, transcript exports, API/MCP reads, and Obsidian notes must render from the same canonical segment contract instead of best-effort reparsing of flattened `full_transcript` strings.
**Mode:** mvp
**Requirements**: CON-01, CON-02, HRD-01 follow-up
**Depends on:** Phase 8
**Success Criteria** (what must be TRUE):

  1. The canonical connector contract carries structured transcript turns through `runCanonicalConnectorPipeline()` into `recordings.transcript_segments` (or an explicitly chosen canonical table) without losing `speakerName`, `speakerEmail`, `startSeconds`, `endSeconds`, and text; `full_transcript` remains a searchable/export fallback, not the only source of display truth.
  2. Read.ai, Grain, Fireflies, PLAUD, Zoom, Fathom, YouTube, paste/manual, and MCP manual import each have a documented normalization path for speaker turns and duration. Provider-specific quirks (minutes vs seconds, milliseconds vs seconds, speaker IDs without names, speakerless YouTube captions) are normalized in source adapters or shared helpers, not in UI components.
  3. Call detail transcript rendering uses canonical structured segments before regex-parsing `full_transcript`, so speaker bubble grouping and blue host alignment work for non-Fathom connectors whenever provider identity data exists. Unknown/speakerless transcripts degrade intentionally without pretending to identify a speaker.
  4. `call_participants` is populated/updated from transcript speakers and provider participants with deterministic dedupe by normalized email/name, preserving host/recorded-by identity where known and avoiding duplicate "Unknown" participants.
  5. Existing recordings can be backfilled or lazily normalized without duplicate recordings, duplicate workspace entries, or overwriting CallVault-owned edits to transcript text/speaker names.
  6. Provider fixture tests cover at least one multi-speaker transcript with timestamps and duration for Read.ai, Grain, Fireflies, PLAUD, Zoom, Fathom, and YouTube/paste fallback. A call-detail parsing/rendering test proves structured segments drive bubble grouping before flattened regex fallback.

**Plans:** 5/5 plans complete

Plans:

**Wave 1**

- [x] 08.1-01-PLAN.md — Canonical transcript segment contract, pipeline persistence, and identity-aware participant upsert

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 08.1-02-PLAN.md — Provider adapter normalization and fixture coverage for Read.ai, Grain, Fireflies, PLAUD, Zoom, YouTube, paste/manual, and MCP import

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 08.1-03-PLAN.md — Call detail structured-segment-first transcript rendering and grouping

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 08.1-04-PLAN.md — Export, Obsidian, REST, and MCP structured transcript reads

**Wave 5** *(blocked on Waves 1-4 completion)*

- [x] 08.1-05-PLAN.md — Safe existing-recording normalization/backfill and final quality gate

### Phase 9: Lint, Brand, and Documentation Hygiene

**Goal:** Reduce avoidable maintenance drag without changing runtime behavior: clean high-signal lint warnings, remove forbidden brand/tooling examples from active docs, and document guardrails that prevent Lucide/framer-motion/positive "AI-powered" drift from returning.
**Mode:** mvp
**Depends on:** Phase 8 (do not optimize lint/docs while the main suite is red)
**Requirements:** Review follow-up from full-codebase audit 2026-06-09
**Success Criteria** (what must be TRUE):

  1. Active docs no longer recommend `lucide-react`, `framer-motion`, or positive "AI-powered" CallVault positioning; archived/reference material can remain clearly archived unless linked as current guidance.
  2. Lint warning count drops materially from the audited baseline of 234 warnings, prioritizing unused imports, stale `eslint-disable` comments, and hook dependency warnings with plausible runtime impact.
  3. No broad refactor is pulled into this phase; large debt such as the `TranscriptsTab` structural refactor remains deferred unless a warning fix requires a narrow extraction.
  4. `npm run lint`, `npm run type-check`, and `npm run build` pass after cleanup.
  5. A lightweight grep gate or documented check covers the banned active-doc examples: `lucide-react`, `framer-motion`, and positive `AI-powered` copy.

**Plans:** 5/5 plans complete
Plans:
**Wave 1**

- [x] 09-01-PLAN.md — Auto-fix stale eslint-disable directives
- [x] 09-02-PLAN.md — Active-doc fixes and lint:docs npm script

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 09-03-PLAN.md — Unused-var rename pass (~65 warnings)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 09-04-PLAN.md — Hook dep warnings: safe fixes + suppression

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 09-05-PLAN.md — CLAUDE.md guardrail doc and final verification

---

## Workstream 5 — Autonomous Admin Center (Autopilot)

*Added 2026-06-10. Amends the v1.0 launch roadmap with the autonomous admin-center workstream. Tickets become DB-backed, Sentry errors auto-create tickets, a local dispatcher on Andrew's Mac autonomously fixes them via headless subscription-billed `claude` runs in sandboxed worktrees, and Andrew reviews + approves fixes in-app. The dispatcher daemon code lives OUTSIDE this repo at `~/dev/autopilot/`; phases below are still tracked here, but plan/verify steps for the daemon note the external path. Spike-gated: nothing real ships until SPK-01 proves unattended fixing works. Reference articulation: E5 ISA at `~/.claude/PAI/MEMORY/WORK/20260610-autonomous-admin-center/ISA.md` (security model ISC-104..120).*

### Phases (Workstream 5)

- [x] **Phase 10: Autopilot Spike (go/no-go gate)** — Throwaway 2-day spike proves headless `claude` can fix planted bugs unattended from a launchd context within subscription rate limits; gates ALL downstream AUTO work (completed 2026-06-11 — GO ratified, 5/5 fixtures; see SPIKE-VERDICT.md)
- [x] **Phase 11: Ticket Foundation + Flag Removal** — DB-backed tickets (3 tables + RLS), AdminTab tickets view, in-app submission, full event audit trail; feature-flag system removed first to clear the AdminTab surface (completed 2026-06-11)
- [ ] **Phase 12: Sentry Ingestion** — Sentry issue alerts auto-create tickets via an Edge Function webhook with fingerprint dedup
- [ ] **Phase 13: Dispatcher + Mechanical Safety** — `~/dev/autopilot/` launchd dispatcher claims tickets and runs headless fixes in sandboxed per-run git worktrees behind a deterministic non-LLM push-gate, kill switch, and independent watchdog
- [ ] **Phase 14: In-App Approval Loop** — Admin reviews fix summary + evidence on the ticket and approves/rejects in-app; approval triggers the local merge; no agent change reaches main without gate-pass or approval
- [ ] **Phase 15: Support Capture Fix** — Support-form screenshot/console capture captures the problem view, not the open dialog

---

## Phase Details (Workstream 5)

### Phase 10: Autopilot Spike (go/no-go gate)

**Goal:** Before any real Autopilot infrastructure is built, a throwaway 2-day spike proves the two load-bearing unknowns: a headless `claude` can fix planted bugs unattended, and it can do so executing from a launchd (non-interactive) context within subscription rate limits. The spike produces a documented go/no-go decision that gates every downstream Autopilot phase.
**Mode:** mvp
**Depends on:** Nothing (first Autopilot phase). GATES Phases 12, 13, 14 (all AUTO/SEN/APPR work). Phase 11 (ticket foundation) and Phase 15 (capture fix) do not depend on the spike outcome.
**Requirements:** SPK-01
**Success Criteria** (what must be TRUE):

  1. A headless `claude` run, launched from a launchd (non-interactive) context, fixes at least 3 of 5 planted-bug fixtures end-to-end without human intervention — including 1 unreproducible fixture correctly escalated and 1 out-of-policy fixture correctly diverted rather than force-fixed.
  2. Repeated unattended runs complete within subscription rate limits across a multi-hour window (spike log shows timestamps + completion statuses; no rate-limit hard-fail), validating the execution entitlement, not just fix-capability (ISA ISC-115).
  3. A written go/no-go decision plus an execution-isolation design (the chosen sandbox primitive — e.g. dedicated macOS user with its own `claude` login + scoped repo clone) is recorded before any Spine work begins (ISA ISC-116).
  4. The spike code and artifacts are explicitly disposable — none of it is promoted directly into the production dispatcher; it exists only to retire risk.

**Plans:** 2/2 plans executed — GO ratified by Andrew 2026-06-11 (5/5 fixtures correct incl. ESCALATE + DIVERT, zero rate-limit flags; soak compressed per principal waiver, recorded in SPIKE-VERDICT.md)

### Phase 11: Ticket Foundation + Flag Removal

**Goal:** Tickets become first-class DB-backed records (replacing the email-only support flow) with a full audit trail, surfaced and submittable from the AdminTab. The nonfunctional feature-flag system is removed first to clear the AdminTab/Layout surface before the tickets view lands there.
**Mode:** mvp
**Depends on:** Phase 6 (support popout + `send-support-ticket` shipped — tickets extend that surface). FLAG-01 lands BEFORE the AdminTab tickets view (TKT-02) to clear the surface. Does NOT depend on the spike — ticket persistence is useful regardless of the autonomous-fix outcome.
**Requirements:** FLAG-01, TKT-01, TKT-02, TKT-03, TKT-04
**Success Criteria** (what must be TRUE):

  1. The `feature_flags` table, `useFeatureFlags` hook, and all gates in `Layout.tsx` / `sidebar-nav.tsx` / AdminTab toggles are removed; currently-gated surfaces are hard-enabled; `npm run build` and `npm test` stay green with no dead-flag references.
  2. Tickets persist in `tickets`, `ticket_messages`, and `ticket_events` tables with RLS such that a reporter sees only their own tickets and an ADMIN sees all; the existing support form writes to these tables, and the email to `support@callvaultai.com` becomes a side-effect rather than the system of record.
  3. An admin opens the AdminTab tickets view and sees a ticket list filterable by status, severity, and source, plus a detail view that renders the full event timeline for any ticket.
  4. An admin submits a ticket in-app (bug or task) and the ticket is created with context auto-attached, immediately visible in the list.
  5. Every ticket status transition writes a row to `ticket_events`, so the full ticket lifecycle can be reconstructed from the audit trail alone.

**Plans:** 4/4 plans complete
Plans:
**Wave 1**

- [x] 11-01-PLAN.md — Remove feature-flag system, hard-enable gated surfaces, drop feature_flags table (FLAG-01)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 11-02-PLAN.md — Ticket tables + RLS + audit trigger, db push, types, send-support-ticket DB-first pivot (TKT-01, TKT-04)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 11-03-PLAN.md — AdminTab Tickets section: service/hooks, filterable table, detail dialog with event timeline (TKT-02)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 11-04-PLAN.md — Admin in-app ticket submission with auto-attached context (TKT-03)

**UI hint:** yes

### Phase 12: Sentry Ingestion

**Goal:** Production Sentry errors flow into the ticket queue automatically and deduplicated, so the autonomous pipeline and the admin both work from a single deduped error backlog instead of email noise.
**Mode:** mvp
**Depends on:** Phase 11 (the `tickets` / `ticket_events` tables and RLS must exist before Sentry can write into them). Gated by Phase 10 go decision for the autonomous-processing intent, though the ingestion + dedup surface itself is useful independently.
**Requirements:** SEN-01, SEN-02
**Success Criteria** (what must be TRUE):

  1. A Sentry issue alert (org `ai-simple`, project `call-vault`) hits a Supabase Edge Function webhook and a ticket is created automatically with source = Sentry and the error context attached.
  2. The same error firing twice produces exactly one ticket — the second occurrence dedupes by error fingerprint and increments an occurrence count rather than creating a duplicate.
  3. A Sentry-created ticket carries enough context (fingerprint, stack/summary, occurrence count) for downstream triage without opening the Sentry UI.

**Plans:** 3 plans
Plans:

**Wave 1**

- [ ] 12-01-PLAN.md — Migration: nullable reporter_id, occurrence columns, atomic `ingest_sentry_ticket` RPC + blocking db push/types regen

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 12-02-PLAN.md — `sentry-webhook` Edge Function with signature verification, severity mapping, issue_id fingerprint + Deno unit tests

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 12-03-PLAN.md — Real-Supabase dedup/notification integration tests, deploy, and Sentry manual-setup runbook (the one human prerequisite)

### Phase 13: Dispatcher + Mechanical Safety

**Goal:** A local launchd dispatcher at `~/dev/autopilot/` (OUTSIDE this repo) claims new tickets atomically and runs one headless subscription-billed `claude` fix per ticket — with security enforced mechanically, not by prompt: each run executes in a sandboxed ephemeral per-run git worktree, a deterministic non-LLM push-gate blocks out-of-policy changes against a blast-radius denylist and re-checks the kill switch immediately pre-push, and an independent watchdog pages admin if the dispatcher heartbeat goes stale.
**Mode:** mvp
**Depends on:** Phase 10 (go decision — no dispatcher is built unless the spike proves unattended fixing) AND Phase 11 (ticket tables/RLS are the dispatch source and evidence sink). Dispatcher code lives at `~/dev/autopilot/`; plan/verify steps target that external path, not this repo.
**Requirements:** AUTO-01, AUTO-02, AUTO-03, AUTO-04, AUTO-05, AUTO-06
**Success Criteria** (what must be TRUE):

  1. The launchd dispatcher claims a new ticket atomically (no double-claim under concurrent polls), spawns exactly one headless `claude` fix run per ticket at concurrency 1, enforces a time-budget kill, and emits a heartbeat.
  2. Every fix run executes in an ephemeral per-run `git worktree` created and destroyed per run — never in Andrew's live `~/dev/brain` checkout — under an OS-level sandbox whose filesystem access is scoped to that worktree only; in-sandbox reads of `~/.ssh`, other repos, the primary `gh` token, `~/.aws`, and browser-session stores all fail (ISA ISC-104..106).
  3. A deterministic non-LLM push-gate script — not the agent — diffs candidate changes against a blast-radius denylist (migrations, RLS, auth, billing): in-policy fixes push to main, out-of-policy fixes go to a branch/PR, and the gate mechanically blocks out-of-policy pushes by script exit code independent of agent output (ISA ISC-107).
  4. The push-gate re-checks the kill-switch flag immediately before any push/merge, so flipping the single kill-switch flag halts all autonomous processing — including in-flight runs pre-push — within one poll cycle (ISA ISC-108, AUTO-04).
  5. An independent watchdog (separate launchd job / process — the dispatcher never monitors itself) pages admin within threshold when the dispatcher heartbeat goes stale (ISA ISC-109).
  6. Each fix run writes an evidence bundle back to the ticket — diff summary, test output, verification proof (original captured reproduction replayed fail→pass), and a deploy-SHA check asserting the live bundle carries this run's commit (ISA ISC-110, ISC-112, AUTO-06).

**Plans:** 7 plansPlans:
**Wave 1**

- [ ] 13-01-PLAN.md — Queue-control migration (priority/urgent/attempts/backoff + runner_state + RLS) pushed live
- [ ] 13-02-PLAN.md — Daemon scaffold at ~/dev/autopilot/ + core libs (atomic claim, urgent lane, backoff, stale sweep, argv-allowlist agent spawn)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 13-03-PLAN.md — Worktree runner: claude fix run, verdict/NOTES mapping, in-worktree verification, codex review, evidence bundle → awaiting_approval
- [ ] 13-04-PLAN.md — Deterministic push-gate (denylist, kill-switch recheck, commit-advance) + offline fixture harness
- [ ] 13-05-PLAN.md — Independent watchdog (heartbeat staleness paging + tools-health tickets) + its launchd job

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 13-06-PLAN.md — Claimer poll cycle, approval-merge + deploy-SHA verify, dispatcher launchd job

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 13-07-PLAN.md — E2E proof on real ticket 1deaa9b7 (single human checkpoint: Andrew's approval click)

### Phase 14: In-App Approval Loop

**Goal:** Andrew reviews each autonomous fix's summary and evidence on the ticket detail in-app and approves or rejects it; approval drives the local dispatcher to merge/push the held change, and no agent-authored change reaches main without either an in-policy push-gate pass or an explicit admin approval event.
**Mode:** mvp
**Depends on:** Phase 13 (the dispatcher produces the held branch + evidence bundle the approval loop acts on) AND Phase 11 (ticket detail surface). In-app approval only — Telegram bridge + user-facing chat are deferred to v2 (AP-V2-01, AP-V2-02).
**Requirements:** APPR-01, APPR-02, APPR-03
**Success Criteria** (what must be TRUE):

  1. An admin sees the fix summary plus evidence bundle on the ticket detail and can approve or reject the fix directly in the app.
  2. An approval event triggers the local dispatcher to merge/push the held change; a rejection posts the reason to the ticket and closes the held branch without merging.
  3. No agent-authored change reaches main without either an in-policy push-gate pass (Phase 13) or an explicit admin approval event; CI excludes agent-authored PRs from auto-merge.

**Plans:** TBD
**UI hint:** yes

### Phase 15: Support Capture Fix

**Goal:** When a user submits a support ticket, the attached screenshot captures the actual problem view rather than the open submission dialog, and the console-log buffer is auto-attached — so tickets carry an accurate picture of what the user saw.
**Mode:** mvp
**Depends on:** Phase 11 (tickets table is the attachment sink). Independent of the spike and dispatcher — can run anytime after Phase 11. Parallelizable with Phases 12–14.
**Requirements:** CAP-01
**Success Criteria** (what must be TRUE):

  1. The support-form screen capture reflects the problem view, not the open dialog — via pre-dialog capture or `excludeElements` so the submission UI does not occlude the screenshot.
  2. The console-log buffer is auto-attached to the submitted ticket alongside the screenshot.
  3. A submitted ticket's attachments are retrievable from the ticket detail (works with the Phase 11 ticket persistence).

**Plans:** 3 plans

**Execution gate:** Phase 15 plans must not execute until 11-03 AND 11-04 are complete (shared files: SupportTicketDialog.tsx, tickets.service.ts/useTickets.ts, TicketDetailDialog.tsx in AdminTab).
Plans:
**Wave 1**

- [ ] 15-01-PLAN.md — Screenshot slice: pre-dialog capture + thumbnail/retake/remove + ticket-attachments bucket + upload + Edge Fn attachments persistence (Wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 15-02-PLAN.md — Console slice: error-prioritized ~100-entry ring buffer from debug-panel, uploaded as console_log attachment (Wave 2)
- [ ] 15-03-PLAN.md — Admin visibility slice: signed-URL service/hook + Attachments group in 11-03's TicketDetailDialog (Wave 2)

**UI hint:** yes

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Paste Pipeline Polish | 5/5 | Complete   | 2026-05-27 |
| 2. MCP Monolith Refactor | 8/8 | Complete (02-VERIFICATION.md passed; cold-start baseline limitation acknowledged) | 2026-05-28 |
| 3. Per-Workspace MCP Endpoints + Connectors Setup | 6/6 | Complete   | 2026-05-28 |
| 4. MCP AI Write Tools | 5/5 | Complete    | 2026-05-30 |
| 5. Connector Reliability + Per-Workspace Binding + Unified Sync Tab | 5/5 | Complete   | 2026-05-31 |
| 6. Launch UX + Support + RLS Hygiene | 7/8 | In Progress|  |
| 6.1. MCP Subdomain Routing | 14/14 | Complete   | 2026-06-10 |
| 6.2. CallVault REST API | 4/4 | Complete    | 2026-06-10 |
| 6.3. Obsidian Sync Improvements | N/A | Complete | 2026-06-09 |
| 6.3.2. fathom_provider_id rename | 5/5 | Plans executed — prod rollout gate pending | - |
| 7. Recording ID and Folder Assignment Correctness | 2/3 | In Progress|  |
| 8. Full-Suite Test Recovery | 6/6 | Complete    | 2026-06-10 |
| 8.1. Connector Transcript Normalization | 5/5 | Complete    | 2026-06-10 |
| 9. Lint, Brand, and Documentation Hygiene | 5/5 | Complete    | 2026-06-10 |
| 10. Autopilot Spike (go/no-go gate) | 2/2 | Complete (GO ratified) | 2026-06-11 |
| 11. Ticket Foundation + Flag Removal | 4/4 | Complete   | 2026-06-11 |
| 12. Sentry Ingestion | 0/0 | Not started | - |
| 13. Dispatcher + Mechanical Safety | 0/0 | Not started | - |
| 14. In-App Approval Loop | 0/0 | Not started | - |
| 15. Support Capture Fix | 0/0 | Not started | - |

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
| 1 | UUID vs slug URLs is now settled for v1: use UUID paths (`/mcp/w/{workspace_uuid}`) so workspace renames do not break configured clients. Human-friendly slugs remain v2-only unless explicitly promoted later. | Phase 3 | Decided |
| 2 | `ingest_transcript` composite scope discipline. It must support one manual/already-transcribed call per invocation with explicit permission-bound org/workspace targeting; `bulk_ingest_transcripts` stays v2 only. | Phase 4 | Decided |
| 3 | Speaker-resolution shape on `ingest_transcript`. Agent passes names; how does the server handle ambiguity (multiple contacts with same first name)? Best-effort + report in response, or hard-fail? | Phase 4 | Engineering call during Plan |
| 4 | Support popout (ONB-05): docs URL is `https://docs.callvaultai.com`; tickets send to `support@callvaultai.com` without default Andrew cc. | Phase 6 | Decided |
| 5 | Submit-ticket form auto-attached context is intentionally basic: current URL, user agent, user ID, org ID, workspace ID, and app version/commit if easy. Console errors and active recording ID are optional only if already easy. | Phase 6 | Decided |

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
- **Subdomain-based MCP URLs.** ~~Anti-pattern~~ — promoted to Phase 6.1 (2026-06-08). Path-based routing was rejected because Claude deduplicates connections at origin level; subdomain architecture (`orgslug.callvaultai.com/mcp`) is the correct approach.
- **Splitting `mcp-server` into 36 separate Edge Functions.** Anti-pattern — multiplies cold-start tax.

---

*Roadmap created: 2026-05-27*
*Last updated: 2026-06-09 — Added Phases 6.1 (MCP Subdomain Routing), 6.2 (CallVault REST API), 6.3 (Obsidian Sync Improvements), and review follow-up Phases 7-9 for recording-ID/folder correctness, test-suite recovery, and lint/brand/docs hygiene.*

## Backlog

Unsequenced ideas captured outside the active phase sequence. Promote with `/gsd-review-backlog` when ready.

### Phase 06.3.1: Per-call Obsidian export (INSERTED)

**Goal:** [Urgent work - to be planned]
**Requirements**: TBD
**Depends on:** Phase 6.3
**Plans:** 3/3 plans complete
Plans:

**Wave 0**

- [x] `06.3.1-01-PLAN.md` — Shared Obsidian markdown helpers and single-file download utility

**Wave 1** *(blocked on Wave 0 completion)*

- [x] `06.3.1-02-PLAN.md` — Call transcript export hook and compact per-call Obsidian action

**Wave 2** *(blocked on Wave 1 completion)*

- [x] `06.3.1-03-PLAN.md` — Help docs, local gates, and browser verification closeout

### Phase 999.1: AI-ready export menu and transcript metadata enrichment (BACKLOG)

**Goal:** Match (and beat) Grain's "AI export" feature — per-call dropdown with Open in Claude / Open in ChatGPT / Copy Transcript for AI / Download Transcript for AI (Markdown), with sticky default action. Enrich CallVault transcripts with richer Markdown metadata for AI consumption, including cross-references to previous calls with the same participants (so an AI client opening a transcript has full historical context auto-attached).

### Phase 999.3: Drop `workspaces.workspace_type` column (BACKLOG)

**Goal:** Remove the dead `workspace_type` column from the `workspaces` table after migrating ~7 active call sites (`connector-pipeline.ts`, `youtube-import/index.ts`, `mcp-server` create/list tools, `useWorkspaces`, `useWorkspaceMutations`, `WorkspaceManagement`) to route imports via a new `import_sources.workspace_id` foreign key.

**Why deferred:** ~3hr engineering block, multi-file migration, requires adding+backfilling `import_sources.workspace_id` first. Phase 25 (2026-05-07) declared the column retired but the audit on 2026-05-28 found ~30 reference sites still in active code, including filters in connector-pipeline (`workspace_type='personal'`) and youtube-import (`workspace_type='youtube'`). Blind drop breaks YouTube + personal-account connector flows.

**Full audit + 13-step migration plan:** `.planning/phases/999.3-drop-workspace-type-column/REFERENCE.md`

**Promote via:** `/gsd-review-backlog` when there's a clean engineering block.

### Phase 999.2: Owner/Admin MCP account control plane (MAYBE SOMEDAY)

**Goal:** Explore an owner-scoped/admin-scoped MCP connection that can manage the whole CallVault account from an approved AI client: create organizations and workspaces, invite users, mint/revoke/rotate scoped MCP connections, configure enabled categories/API keys, and generate setup links or snippets for clients.

**Why deferred:** This is valuable, but it is an account-control-plane product surface with higher security and confirmation requirements than the current launch path. The active sequence should first ship the refactored MCP server, per-workspace endpoints, token management, and scoped write tools.

**Future scope notes:**

1. Admin MCP tools must be least-privilege and explicit: owner/admin category only, no visibility to read/write-only tokens.
2. Dangerous actions need confirmation gates, audit logs, and clear actor attribution before execution.
3. The control-plane flow should support the "create client Bob" story: create workspace/org, invite Bob, create a workspace-scoped MCP connection, and produce a safe setup handoff.
4. This must build on Phase 3 token management and Phase 4 admin/write tool boundaries, not bypass them.

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
