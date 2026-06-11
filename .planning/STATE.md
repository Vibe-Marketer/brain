---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
last_updated: "2026-06-11T17:00:21.811Z"
progress:
  total_phases: 25
  completed_phases: 14
  total_plans: 111
  completed_plans: 109
  percent: 56
---

# STATE — CallVault Self-Serve Public Launch

**Last updated:** 2026-06-10

---

## Project Reference

**Project:** CallVault — Self-Serve Public Launch milestone
**Repo:** `/Users/admin/dev/brain` (single source; `callvault/` is abandoned)
**Production:** https://app.callvaultai.com (Vercel, auto-deploys from `main`)
**MCP endpoint:** https://mcp.callvaultai.com (Cloudflare Worker → Supabase Edge Function)

**Core value:** A team can centralize every call from every source into workspace-scoped vaults that an AI agent can both read from AND write into — and the experience is reliable enough that a stranger off the internet can wire it up themselves without help.

**Current focus:** Phase 06.3.2 — fathom provider id rename rename legacy recording id across 

---

## Current Position

Phase: 06.3.2 (fathom-provider-id-rename-rename-legacy-recording-id-across-) — READY TO PLAN
Plan: Not started
**Milestone:** CallVault — Self-Serve Public Launch
**Phase:** 06.3.2
**Plan:** Not started
**Status:** Ready to execute

**Progress:**

[██████████] 99%
Phases:  15/23 complete (01, 02, 03, 04, 05, 06.1, 06.2, 06.3, 06.3.1, 06.3.2, 08, 08.1, 09, 10, 11)
Plans:   In flight: 06 (6/8), 07 (2/3), 16 (Waves 1+2 complete — 16-01/16-02 SUMMARYs; /admin live with Users section, admin-manage-user fn + admin_audit_log deployed & live-verified 2026-06-11); 10 complete (2/2 — GO ratified 2026-06-11, SPIKE-VERDICT.md); 11 complete + verified (4/4 plans, 11-VERIFICATION.md exists, visual check done by orchestrator); planned but not executed: 12 (0/3), 15 (in flight); 13 in planning; 14 not yet planned
(Recounted from disk 2026-06-11 by 01-09 archive-audit reconciliation — prior 96% / "6/6 phases" figures were stale.)

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
- Phase 6.1 inserted: MCP Subdomain Routing — per-org subdomain URLs with 7 security gates before DNS provisioning; ISA at `~/.claude/PAI/MEMORY/WORK/20260608-mcp-subdomain-routing-arch/ISA.md`; execution plan at `.planning/phases/03-per-workspace-mcp-endpoints-+-connect-to-ai/03-07-EXECUTION-PLAN.md`
- Phase 6.2 inserted: CallVault REST API — `api.callvaultai.com/v1/*` with personal token auth
- Phase 6.3 inserted: Obsidian Sync Improvements — bulk zip export + Obsidian-format notes (already shipped 2026-06-09)
- Phase 7 added: Recording ID and Folder Assignment Correctness — fixes UUID/BIGINT folder assignment failures and modern folder filtering gaps found in the 2026-06-09 full-codebase review.
- Phase 8 added: Full-Suite Test Recovery — restores `npm test` after stale MCP count expectations, missing auth-provider harnesses, Deno/Vitest drift, and Fathom adapter fixture drift.
- Phase 9 added: Lint, Brand, and Documentation Hygiene — reduces lint warning debt and removes active-doc drift around Remix icons, motion imports, and AI-ready positioning.
- Phase 06.3.2 inserted after Phase 06.3: fathom_provider_id rename — rename legacy_recording_id across DB, TS, and docs (URGENT)
- Phase 06.3.2 production rollout VERIFIED COMPLETE (2026-06-11): prod DB assertions passed (fathom_provider_id x1, zero legacy remnants); prod smokes passed (call list/search, fathom-refresh, share-link list, MCP shared/contact tools). See 06.3.2-05-SUMMARY.md.
- Phase 08.1 inserted after Phase 8: Connector Transcript Normalization — preserve provider speaker turns, timestamps, durations, and participant identities across all connections (URGENT)
- Workstream 5 appended (2026-06-10): Autonomous Admin Center / Autopilot as Phases 10-15 — Phase 10 Autopilot Spike (SPK-01, go/no-go gate); Phase 11 Ticket Foundation + Flag Removal (FLAG-01, TKT-01..04); Phase 12 Sentry Ingestion (SEN-01..02); Phase 13 Dispatcher + Mechanical Safety (AUTO-01..06, dispatcher at `~/dev/autopilot/`); Phase 14 In-App Approval Loop (APPR-01..03); Phase 15 Support Capture Fix (CAP-01). Current position (Phase 06.3.2) unchanged. ISA: `~/.claude/PAI/MEMORY/WORK/20260610-autonomous-admin-center/ISA.md`.

### Key Decisions

- **Launch target = self-serve public** (not private beta). Strangers must succeed without hand-holding. Sets the bar for empty states, billing, support, and connector reliability.
- **Multi-MCP = per-workspace CallVault endpoints**, NOT multi-vendor gateway. Aggregating external MCPs (Linear/Slack/Notion) is a different product story.
- **MCP monolith refactor is included in this milestone** (Phase 2). The refactor remains one Edge Function with internal tool modules.
- **One Edge Function for `mcp-server`** retained through refactor (Supabase "fat function" guidance — splitting multiplies cold-start tax).
- **Path-based per-workspace MCP URLs** (`/mcp/w/{uuid}`), not subdomain, not query parameter. Notion/Linear/Cloudflare pattern; RFC 8707 compliant.
- **Phase 3 MCP setup lives in Connectors, not an "AI connectors" silo.** OAuth is the primary setup path; token/manual config is the fallback; snippets use `https://mcp.callvaultai.com/w/{workspace_uuid}` and never the raw Supabase function URL.
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

- Ensure Fathom re-sync updates existing CallVault recordings when upstream call metadata changes, without duplicating calls or overwriting CallVault-owned fields.
- Begin Phase 04 planning for MCP AI Write Tools from the Phase 04 roadmap criteria.
- Do not use archived stale Phase 2 refactor artifacts as implementation inputs.
- Before shipping Phase 1 publicly, configure seeded `TEST_USER_*` / org fixtures if real-Supabase integration execution is required instead of the current explicit skip.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260608-opd | Add Obsidian sync API + personal token UI for CallVault → Obsidian integration | 2026-06-08 | 046b691 | [260608-opd](./quick/260608-opd-i-need-to-consider-how-best-to-add-expos/) |
| Phase 09 P01 | 5min | 2 tasks | 10 files |
| Phase 09 P02 | 105 | 2 tasks | 3 files |
| Phase 06.1 Psec-worker-bypass | 10min | 2 tasks | 4 files |
| Phase 06.1 Psec-slug-tombstone | 8min | 1 tasks | 1 files |
| Phase 11 P01 | 8min | 2 tasks | 7 files |
| Phase 10 P01 | 19min | 3 tasks | 12 files |
| Phase 11 P03 | ~25min | 3 tasks | 8 files |
| Phase 06 P07 | 18min | 2 tasks | 3 files |
| Phase 11 P04 | 20min | 2 tasks | 7 files |
| Phase 16 P01 | ~75min | 5 tasks | 20 files |
| Phase 13 P02 | 9min | 3 tasks | 11 files |
| Phase 15 P01 | 45min | 3 tasks | 7 files |
| Phase 15 P02 | 25min | 2 tasks | 6 files |
| Phase 12 P01 | 10m | 2 tasks | 2 files |
| Phase 15 P03 | 25min | 2 tasks | 5 files |

### Blockers

- Phase 06 code execution is complete through `06-06`. Remaining verification limitations: live Fathom provider title-change verification was not run due credentialed provider dependency in this session.
- Phase 2 Plans 02-01 through 02-08 are complete. Local targeted MCP tests, final `npm run build`, deploy, and live smoke passed. Candidate read-path timing was captured (median 0.459s, p95 0.747s across 10 HTTP 200 calls), but improvement versus baseline is not verified because no pre-refactor baseline timing exists.
- Phase 3 implementation and credential-backed production smoke are complete for `/mcp/w/{workspace_uuid}` valid access and wrong-workspace 403 rejection. Cloudflare Worker `callvault-api-proxy` version `d13eaafb-9b8e-4cd2-bebb-9baf6aa1d412` is deployed to `api.callvaultai.com` and `mcp.callvaultai.com`; both workspace protected-resource metadata vanity routes advertise the exact workspace-scoped `resource`. The repo `.env` Cloudflare API token still lacks Worker deploy permission, but Wrangler OAuth login is available on this machine.
- Supabase storage service UNHEALTHY (project-specific, canary upstream) — 15-01 storage data-plane RLS probe + dev-browser visual pass deferred until recovery

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

- **Date:** 2026-06-11
- **Activity:** Completed Phase 16 Plan 02 (Wave 2) — Users port into the Admin Center.
- **Outcome:** /admin/users live: ported UsersSection + pane-native UserProfileDetails; admin-manage-user edge function deployed (has_role rebind, dual-client JWT auth) with append-only admin_audit_log (migration pushed, posture verified via psql). Live-probed end-to-end as test admin against a disposable user: role change / password reset / revoke (banned) / restore all succeeded with 4 audit rows; non-admin 403 + RLS read denial confirmed; probe user fully cleaned up. Settings AdminTab reduced to pointer card (UserTable deleted). vitest 1781 green, eslint 0 errors, build exit 0, pushed. Next: 16 later waves (QA + Audit sections).

### Next session

- **Trigger:** Continue Workstream 5 (Autonomous Admin Center, Phases 10-15) — the live workstream. (Previous "Execute Phase 06" trigger was stale; Phase 06 completed 2026-06-01, and 06-07 is in flight under a separate executor.)
- **Action:** Phase 10 COMPLETE (2026-06-11) — GO ratified by Andrew ("Lets rock nn roll"), 5/5 fixtures incl. ESCALATE + DIVERT, zero rate-limit flags; soak compressed per principal waiver (SPIKE-VERDICT.md is canonical). Phase 11 complete + verified (11-VERIFICATION.md; visual check done by orchestrator). Gate OPEN for Phases 12/13/14. Phase 13 (dispatcher) in planning — consumes SPIKE-VERDICT.md ISC-116 design. Phase 12 (Sentry ingestion) and Phase 15 (support capture fix) plans exist on disk and are unexecuted.

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
| Phase 06 P01 | 18min | 3 tasks | 7 files |
| Phase 06 P02 | 4min | 3 tasks | 6 files |
| Phase 06 P03 | 15min | 3 tasks | 5 files |
| Phase 06 P04 | 8min | 3 tasks | 6 files |
| Phase 06 P05 | 4min | 3 tasks | 1 file |
| Phase 06.1 Psec-revocation-complete | 20min | 2 tasks | 4 files |
| Phase 06.1 sec-workspace-param | 15min | 1 task (TDD) | 2 files |
| Phase 11 P02 | ~35min | 3 tasks | 6 files |

## Decisions

- [Phase 16]: admin-manage-user verifies the caller JWT in code (authenticateRequest) and gates on has_role(verified userId,'ADMIN') via the service-role client — is_admin() from the branch is never resurrected.
- [Phase 16]: admin_audit_log is append-only: admin-only SELECT via has_role, zero client write policies; rows written exclusively by edge functions via service-role.
- [Phase 16]: Pane-native admin user detail renders inside AdminCenter's own lazy chunk (adminDetailStore-driven right pane) instead of the shared panelStore DetailPaneOutlet — keeps admin code out of the main bundle.
- [Phase 16]: Settings AdminTab reduced to a pointer card; the direct-table role editor and its UserTable component were deleted — the unaudited client-side role write path no longer exists.
- [Phase ?]: Workspace audience is derived from /mcp/w/{workspace_uuid} and enforced server-side before tool dispatch.
- [Phase ?]: Workspace protected-resource metadata now advertises exact workspace resource URLs via worker passthrough.
- [Phase 03]: Settings AI connector management is OAuth-first, with manual scoped tokens kept visible as fallback controls.
- [Phase 03]: Provider setup actions are capability-gated from evidence-backed registry labels; unsupported providers use guided setup actions rather than implied one-click install.
- [Phase 03]: MCP setup snippets are pinned to vanity endpoints only (`/mcp` org and `/mcp/w/{workspace_uuid}` workspace), with no raw Supabase function URL exposure.
- [Phase 03]: Excluded speculative notifications/initialized edits from 03-06 commits; only verification-backed changes were kept. — No failing 03-06 verification gate required those edits.
- [Phase 03]: Credential-backed production smoke is complete. — Temporary workspace token proved valid workspace access, wrong-workspace 403, token revocation, and final vanity protected-resource metadata after Cloudflare Worker deploy.
- [Phase 06]: Trial completion now preserves onboarding connector context and first-run video marker into /import. — Maintains first-run continuity without dashboard diversion.
- [Phase 06]: Historical connector imports require explicit Sync all/Sync selected action; OAuth return no longer auto-syncs history. — Mitigates accidental bulk import and enforces user intent.
- [Phase 06]: Launch empty states now use concrete source-connection CTAs and regression tests block upload-copy drift. — Keeps first-run users on the real connector/import path.
- [Phase 06]: Paid MCP actions for free users now render locked inline affordances that open an upgrade paywall in context. — Replaces redirect-only detours and keeps upgrade flow anchored to user intent.
- [Phase 06]: Billing and paywall gates pass route-preserving successPath values (including stable action markers) into Polar checkout. — Returns users to the same surface after upgrade and supports immediate gated action retry.
- [Phase 06]: Personal-folder read stubs remain deferred during 06-05 because HRD-02 coverage required only RLS table+fixture expansion. — Avoided scope creep into PF-V2-01.
- [Phase 06]: Support is now a single sidebar popout above Settings with five required actions (video, tour, how-it-works, docs, ticket). — Consolidates help into one anchored entry point.
- [Phase 06]: Support tickets now send through authenticated `send-support-ticket` to support@callvaultai.com with bounded basic context and no default Andrew cc. — Matches launch support-policy requirements.
- [Phase 06]: Fathom imported calls now expose `updated_remotely` state with explicit title-confirmed apply-updates flow and UUID-only refresh invocation. — Prevents duplicate imports and preserves local placement metadata during provider refresh.
- [Phase ?]: [Phase 09-01]: eslint --fix with no scope restriction covers .agent/ and .gemini/ CJS files — not in the eslint ignore list
- [Phase ?]: framer-motion exclusion pattern in lint:docs broadened to match lowercase 'never' keyword to avoid false-positives from brand-guidelines prohibition mentions
- [Phase 06.1]: Cloudflare rate limit ISC-17 (sec-dcr-phishing Task 2 / max 10 DCR registrations/IP/hr) deferred — not a launch blocker. DCR abuse is low-severity pre-launch; CDN-tier enforcement requires Cloudflare paid plan. Tracked for post-launch hardening backlog.
- [Phase 06.1]: ISC-31: membership removal routes through Edge Function (remove-org-member) with auth.admin.signOut(userId, 'global') to kill Auth sessions; DB triggers (20260609000001_revocation_triggers) are the primary revocation path covering both mcp_tokens and mcp_oauth_client_grants.
- [Phase 06.1]: ISC-37: authDetails.workspace_id (server-validated) takes priority over raw ?workspace_id query param in OAuthConsentPage — attacker-controlled URL params must not win over server-verified values.
- [Phase ?]: Phase 06.1 sec-slug-tombstone: CREATE TRIGGER for tombstone functions deferred to slug-schema migration (Wave 3) — organizations.slug column does not exist yet at tombstone migration time
- [Phase 11]: Feature-flag system removed entirely; DebugPanel/Import/Rules hard-enabled for all users (locked CONTEXT decision)
- [Phase 11]: feature_flags drop applied via Management API + migration repair: supabase db push blocked by phase-10 remote migrations not yet merged to main — 11-02 push needs same workaround or merge-order coordination
- [Phase 10]: 10-01: F2/F3 fixture bugs planted as equivalents at current code locations (original files deleted in connector refactor b210a403) instead of literal reverts
- [Phase 10]: 10-01: admin keychain-backed claude auth sufficed for headless claude -p smoke run — no setup-token fallback needed
- [Phase 10]: 10-02: GO ratified by Andrew 2026-06-11 — 5/5 fixtures correct (incl. F4 ESCALATE, F5 DIVERT), zero rate-limit flags; soak ≥17700s criterion principal-waived (runs 1-2 launchd at 75-min cadence, runs 3-5 back-to-back manual); SPIKE-VERDICT.md canonical; ISC-116 isolation design (machine boundary + per-run worktrees + push-gate) hands to Phase 13
- [Phase 11]: 11-02: Full displacement of the 2026-06-10 morning session's parallel ticket stack (support_tickets/legacy ticket_events, 5 remote-only functions, stale-claim-sweep cron) — Andrew-approved at checkpoint; salvage committed at `.planning/phases/11-ticket-foundation-flag-removal/legacy-salvage/`
- [Phase 11]: 11-02: ticket tables migration applied via Management API + `migration repair --status applied` — `supabase db push` still blocked by 5 remote-only morning-session history rows (20260610131220, 20260610150000, 20260610150100, +2); future pushes need the same workaround or a deliberate history cleanup
- [Phase 11]: 11-02: reporter_id in send-support-ticket sourced exclusively from JWT (T-11-04); body userId only stored as legacyBodyUserId in context JSONB
- [Phase 11]: 11-03: ticket badge mappings reuse existing StatusBadge variants via label prop; display maps centralized in src/lib/ticket-display.ts
- [Phase 06]: Refreshed connector OAuth tokens must persist via persistOAuthTokens/persistUserSettingsOAuthTokens encrypted helpers, never direct plaintext .update() writes (06-07)
- [Phase 06]: Real-DB test suites read only *_TEST_* env vars with no prod fallback; rls-regression now matches the integration-setup contract (06-07)
- [Phase 11]: 11-04: getAppVersion/getCommit shared from support-ticket.service.ts (single copy) for createTicket payload parity; AdminTicketType=Extract<TicketType,'bug'|'task'> encodes the TKT-03 two-type constraint
- [Phase ?]: 13-02: Hand-rolled ambient runtime.d.ts instead of @types/bun — T-13-SC locks deps to @supabase/supabase-js + dotenv
- [Phase ?]: 13-02: agent spawn env strips CLAUDECODE + all ANTHROPIC* keys by prefix; ISC-31 grep gate returns zero matches in autopilot src
- [Phase ?]: 13-02: DbLike structural client contract — daemon libs accept supabase-js or mocks; live integration proof deferred to 13-06/07 (13-01 migration not yet applied)
- [Phase 15]: 15-01: attachment refs persisted as {type,path,mime,size_bytes}; zod strips client bucket/captured_at — single ticket-attachments bucket implied
- [Phase 15]: 15-01: Retake keeps the existing screenshot when a fresh capture fails — never trades a good capture for nothing
- [Phase ?]: 15-02: console buffer entries use a strict allowlist (timestamp/type/source/message/stack/httpStatus/url) — responseBody and appStateSnapshot stripped (T-15-06)
- [Phase ?]: 15-02: empty console buffer is still uploaded — zero console history is itself signal
- [Phase ?]: 12-01: migration timestamp bumped to 20260612130000; explicit service_role GRANT added after REVOKE
- [Phase ?]: 15-03: attachment access via signed URLs only (3600s) through service+hook layers; tolerant jsonb descriptor parse skips invalid entries
