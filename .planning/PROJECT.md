# CallVault — Self-Serve Public Launch

## What This Is

CallVault is a B2B SaaS for call recording, transcript storage, and AI-powered call intelligence. It unifies recordings from every meeting-recorder source a team uses (Fathom, Zoom, Fireflies, Grain, Read.ai, PLAUD, YouTube, manual upload) into a single org-and-workspace-scoped vault, with an MCP server that exposes that vault to AI clients (Claude Desktop, Cursor, custom agents).

This milestone takes CallVault from "works for Andrew and a handful of dogfood users" to "self-serve public launch — anyone can sign up, connect a source, and get value in under 5 minutes."

## Core Value

A team can centralize every call from every source into workspace-scoped vaults that an AI agent can both read from AND write into — and the experience is reliable enough that a stranger off the internet can wire it up themselves without help.

## Current Milestone: v2.0 Autonomous Operations — Self-Healing CallVault

**Goal:** Take the armed-but-idle Autopilot foundation from "proven on fixtures" to a live, trusted self-healing operation that drives ticket rate *down* and customer experience *up* — Sentry errors auto-triaged and fixed ASAP, nightly QA generating and resolving its own tickets, ticket responses actually handled with the reporter, source attribution accurate per origin, and feature work itself accelerated by autonomous coding.

**Why now:** v1.0 built the machinery — the `~/dev/autopilot` daemon is wired, the spike proved unattended headless-`claude` fixing (5/5 fixtures), tickets are DB-backed, Sentry ingestion + capture landed, and the in-app approve→merge bridge is live. But the kill switch is deliberately ON; no real ticket has been auto-fixed yet. v2.0 is the trust-and-scale chapter: turn the loop on, prove it on real traffic, and broaden it from bug-fixing into Sentry triage, nightly QA, reporter comms, and feature work.

**Target features (workstreams):**
- **Loop activation & trust** — kill switch off, real tickets flowing through fix→gate→approve→merge with rollback, blast-radius limits, and per-run observability; **raise daily fix throughput to ~25–30/day** (up from the conservative idle posture) and hold it high until findings taper off
- **Sentry autonomous debug→fix** — errors found, fingerprinted, debugged (gsd-debug + Honcho), fixed, and marked resolved ASAP
- **Nightly QA → tickets → resolution** — scheduled QA run files tickets for regressions; autopilot addresses them
- **Ticket response handling** — close the loop with the reporter (status + resolution comms), not just the code
- **Accurate source attribution** — independently track in-app-user / Sentry / nightly-QA / internal origins instead of blanket "submitted by user"
- **Autonomous feature dev** — extend the loop beyond bug-fix into add/test/optimize feature tasks

## Requirements

### Validated

<!-- Shipped and confirmed working in production. Inferred from .planning/codebase/ map (2026-05-27). -->

- ✓ Supabase + React 18 + Vite 5 SPA at app.callvaultai.com — existing
- ✓ 4-pane AppShell with Pane 4 drill-down — existing
- ✓ Multi-org + workspace data model with RLS isolation — existing
- ✓ 7 recording-source connectors (Fathom, Zoom, Fireflies, Grain, Read.ai, PLAUD, YouTube) — existing
- ✓ Manual paste transcript (10MB) — existing
- ✓ Manual file upload via Whisper (25MB synchronous) — existing
- ✓ OAuth 2.1 MCP server (1 endpoint, 36 tools, 17 read + 19 write) with org-scoped OR workspace-scoped tokens — existing
- ✓ Polar billing wiring (Free / Pro / Team plans, webhook receiver) — existing
- ✓ AI generation via OpenRouter (titles, summaries, auto-tagging, search) — existing
- ✓ Resend transactional email (org invitations) — existing
- ✓ Sentry frontend error tracking + Langfuse LLM tracing — existing
- ✓ Setup wizard + onboarding components (first-run flow exists, needs polish) — existing
- ✓ Auto-deploy to Vercel from main; Edge Functions via `--use-api` — existing

**v1.0 Self-Serve Public Launch — shipped 2026-06-12 (24 phases, see MILESTONES.md):**
- ✓ Onboarding & self-serve launch UX (ONB-01..05) — wizard polish, empty states, billing gates, launch flow audit, Support popout
- ✓ Connector reliability + per-workspace binding (CON-01..04)
- ✓ Paste transcript polish (MAN-02, MAN-04, MAN-05, MAN-06) — file upload + async transcription deferred to a later milestone
- ✓ Multi-MCP: per-workspace endpoints + AI write tools + monolith refactor (MCP-01..05) — `mcp-server` trimmed to a 237-line dispatcher
- ✓ Cross-cutting hardening (HRD-01 sync-tab UUID migration, HRD-02 RLS regression gaps)
- ✓ **Autopilot foundation (Workstream 5)** — SPK-01 spike GO (5/5 fixtures), TKT-01..04 ticket persistence + AdminTab, SEN-01..02 Sentry ingestion, AUTO-01..06 dispatcher daemon at `~/dev/autopilot` (built, armed-but-idle, kill switch ON), APPR-01..03 in-app approve→merge bridge, FLAG-01 feature-flag system removed, CAP-01 capture-the-problem-view

### Active

<!-- v2.0 Autonomous Operations scope. 25 requirements across 7 categories. Full detail + scoping in REQUIREMENTS.md. Build order: activate+observe → attribute → scale → QA → Sentry → comms. -->

**Loop activation & trust (ACT)**
- [ ] **ACT-01**: Go live — kill switch off; dispatcher claims and fixes real production tickets
- [ ] **ACT-02**: Raise daily fix throughput to ~25–30/day via run-cap + cadence (concurrency stays 1); hold high until findings taper; quiet-hours reserve headroom for Andrew's interactive Claude
- [ ] **ACT-03**: Rollback + blast-radius safety proven on live tickets — revert path, commit-advance authority, denylist under real load
- [ ] **ACT-04**: Per-run observability in AdminTab (status, diff, tests, gate verdict, duration, cost)
- [ ] **ACT-05**: Test-integrity push-gate — block test-deletion / assertion-weakening / `.skip`/`.only` *(go-live blocker)*
- [ ] **ACT-06**: Rebase-before-push + serialized push + repro-replay on rebased state *(go-live blocker)*
- [ ] **ACT-07**: Worktree reaper + disk guard + wake/caffeinate handling

**Source attribution (SRC)**
- [ ] **SRC-01**: True origin on every ticket — extend `ticket_source` enum (+nightly_qa, +internal); fix QA `source:'manual'` bug; legacy rows → `unknown`
- [ ] **SRC-02**: AdminTab filters/groups tickets by source
- [ ] **SRC-03**: Per-source metrics — volume, fix rate, cycle time

**Throughput trust, survival & autonomy (TRU)**
- [ ] **TRU-01**: 30-day fix-survival metric (per fix/category) — primary success metric, gates the ladder
- [ ] **TRU-02**: Per-category autonomy ladder — auto-approve proven categories, manual on risky; makes 25–30/day livable without hand-approving every fix
- [ ] **TRU-03**: Canary re-test + regression attribution — reopen the originating ticket on regression

**Recurrence → structural fix (REC)**
- [ ] **REC-01**: Detect recurring ticket classes (fingerprint/category clustering)
- [ ] **REC-02**: Escalate a recurring class to a structural-fix task — kill the class, not the instance (primary lever to drive ticket rate down)

**Nightly QA → tickets → resolution (QA)**
- [ ] **QA-01**: Nightly automated QA run on schedule (infra exists; wire to fixable tickets)
- [ ] **QA-02**: QA failures auto-create tickets via new `ingest_qa_ticket` RPC (`source='nightly_qa'`, DB-deduped) with repro/replay evidence
- [ ] **QA-03**: Flake suppression co-ships — rerun-quarantine + actionability gate (non-deterministic → human-triage lane)
- [ ] **QA-04**: Autopilot addresses QA-sourced tickets in the same loop, severity-gated, per-source budget

**Sentry debug→fix→resolve (SEN)**
- [ ] **SEN-03**: Sentry errors auto-debugged via gsd-debug + Honcho brief, routed into the fix loop
- [ ] **SEN-04**: Error→ticket→fix→resolve cycle-time tracked; severity-boosted priority; dedup + debounce against transient-spike storms
- [ ] **SEN-05**: Resolution write-back via new `sentry-resolve` EF (one new secret) — resolve only on SHA-matched verified-stable deploy; per-fingerprint cap freezes category

**Reporter comms — in-app (RSP)**
- [ ] **RSP-01**: In-app status when a ticket moves (received / in-progress / resolved) — only when `source=in-app-user`
- [ ] **RSP-02**: Auto-generated resolution summary in-app on verified-stable deploy; default-deny content filter (redact paths/SHAs/stack traces/"agent")
- [ ] **RSP-03**: Escalation comms — reporter gets a human-readable in-app status when autopilot can't fix, not silence

**Deferred to v2.1 (out of this milestone's scope):**
- **Autonomous feature dev (FEAT-01..03)** — add/test/optimize features through autonomous coding. Deferred because it's the only workstream with no deterministic oracle; revisit once the bug-fix/Sentry/QA loop is trusted at volume, and ship it on suggestion-lane (PR + admin approval) rails only.
- **Multi-channel reporter comms (email/Telegram/SMS)** — in-app only for v2.0.

### Out of Scope

<!-- Explicit boundaries with reasoning. -->

- **Onboarding drop-off telemetry & funnel analysis** — ship first, instrument second. Add after we have actual users dropping off.
- **`personal_folders` feature implementation** — service is stubbed and migration exists, but turning it on is a separate feature decision, not launch-readiness.
- **Multi-vendor MCP gateway (CallVault proxying external MCPs like Linear/Slack/Notion)** — considered and explicitly ruled out. Scope here is per-workspace CallVault MCPs only, not a meta-gateway.
- **YouTube AI Chat (`YouTubeChatSection` re-wire)** — deleted with a "restore later" comment; not a launch blocker.
- **CSP hardening (remove `unsafe-inline` / `unsafe-eval`)** — security hardening, but not a launch blocker given RLS + JWT auth gate the data layer.
- **Sentry release tagging in `Sentry.init`** — quality-of-life observability fix; useful but not blocking.
- **`TranscriptsTab.tsx` 1,397-line refactor** — internal tech-debt cleanup, not user-visible. Defer to a post-launch hardening milestone.
- **Stripe wiring removal** — legacy keys in `.env.example` are inert; cleanup not blocking.
- **`tag_preferences.organization_id` migration (issue #173)** — low blast radius today; defer to multi-org-usage hardening.
- **`_shared/deduplication.ts` dead-code deletion** — confusing but inert; defer.
- **File upload + async transcription pipeline (MAN-01, MAN-03)** — deferred 2026-05-27. CallVault is not becoming a transcription service in the launch milestone. Paste is the v1 manual import path. The existing `file-upload-transcribe` Edge Function stays deployed but the UI no longer surfaces it. Async transcription research is retained at `.planning/research/ASYNC-TRANSCRIPTION-PIPELINE.md` for v2 reuse.

## Context

**Codebase state (2026-05-27):**
The repo is single-source at `/Users/admin/dev/brain` (the `callvault/` repo is abandoned and dead). Architecture is React 18 + Vite 5 + react-router-dom v6 frontend, Zustand v5 for client state, TanStack Query for server state, Supabase (Postgres + Auth + Storage + Edge Functions) backend, 211 SQL migrations, ~70 Edge Functions (Deno). Service+Hook separation is the locked pattern. Full codebase map at `.planning/codebase/` (ARCHITECTURE, STACK, STRUCTURE, CONVENTIONS, INTEGRATIONS, CONCERNS, TESTING).

**Existing connector pipeline (Workstream 2 starting state):**
All 7 connectors share `supabase/functions/_shared/connector-pipeline.ts`. Each has its own OAuth URL / callback / refresh / sync / webhook Edge Functions and a client in `_shared/`. Frontend dispatches via `src/components/connectors/registry/connectorRegistry.ts` with per-source adapters. The plumbing is consistent — the work is hardening edges and pulling the connection-status surface into one place.

**Existing MCP architecture (Workstream 4 starting state):**
One MCP server at `supabase/functions/mcp-server/index.ts` (3,921 lines), public endpoint `mcp.callvaultai.com` via Cloudflare Worker proxy. OAuth 2.1 with PKCE. `mcp_tokens` table already has `org_id`, `workspace_id` (nullable), and `scope` columns — workspace-scoped tokens already exist as a concept. Code path in `mcp-server/index.ts:1118+` handles both org-scoped and workspace-scoped tokens (org-scoped accepts `workspace_id` as a tool param; workspace-scoped auto-resolves and ignores the param). The remaining work is: making each workspace appear as a distinct MCP endpoint (URL-level scoping), the Connectors setup UX, the token management UI, write-tool optimization for AI-driven upload, and the monolith extraction.

**Why now:**
The codebase has the surface area of a full product but the unhappy paths, status UX, and onboarding aren't tight enough for a stranger to succeed without hand-holding. The multi-MCP per-workspace work is also the unlock for the next-tier product story — AI agents that can both pull from AND push to a specific workspace's vault.

**Known fragile surfaces (must respect during this milestone):**
- Dual recording-ID system (UUID `recordings.id` vs legacy BIGINT `recordings.legacy_recording_id`) — never use `parseInt()` / `Number()` / string coercion on recording IDs. Use `toRecordingUuid()` / `toRecordingUuidBatch()` from `src/lib/recording-ids.ts`.
- `source-registry.ts` `oauthCallbackFunctionName` entries are critical boot-time artifacts — missing entries crash React mount. Run `npm run build` against the committed tree (not the working tree) before every push during refactors.
- `recordings.share_url` is not a top-level column — always use `resolveShareUrl()` from `src/lib/recording-source-url.ts`.

## Constraints

- **Tech stack — Frontend:** React 18 + Vite 5 + TanStack Query + Zustand v5 + Tailwind + shadcn/ui + Remix Icons + `motion/react` — Locked. No Lucide, no FontAwesome, no `framer-motion`, no pnpm/bun/yarn (npm only).
- **Tech stack — Backend:** Supabase (Postgres + Auth + Storage + Deno Edge Functions) — Locked. All AI/LLM/embedding code lives in Edge Functions; frontend AI usage is constraint AI-02 banned.
- **AI routing:** OpenRouter for all LLM calls (default `openai/gpt-5-nano`); OpenAI Whisper for transcription; Vercel AI SDK at the Edge — Locked.
- **Auth model:** Supabase Auth + multi-org with RLS on every table — Locked. CI gate: `src/test/rls-regression.test.ts`.
- **Deploy:** Vercel (frontend, auto from main), `supabase functions deploy --use-api` (Edge Functions, Docker-free required).
- **Git workflow:** Direct main, single-operator. No feature branches or PRs unless Andrew explicitly asks.
- **Production URL:** `app.callvaultai.com` (Vercel); `api.callvaultai.com` (Cloudflare Worker → Supabase Edge Functions).
- **Brand:** "AI-ready, not AI-powered" — never use "AI-powered" positively in UI copy. Vibe orange is a structural accent only.
- **One-Click Promise:** Every feature completes the user's job in the fewest possible actions, ideally one click.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Launch target = self-serve public (not private beta) | Strangers must succeed without hand-holding. Sets the bar for empty states, billing, and connector reliability. | — Pending |
| Multi-MCP = per-workspace CallVault endpoints (NOT multi-vendor gateway) | Aggregating external MCPs is a different product story; this milestone is about CallVault's own surface area. | — Pending |
| Include `mcp-server` monolith refactor in Workstream 4 | We're touching the MCP heavily for per-workspace endpoints and new AI-write tools — right time to extract per-tool modules, wrong time to do it later. | — Pending |
| Phase 3 must manage OAuth AI-client grants, not only manual tokens | Supabase OAuth access tokens include `client_id`, but Supabase OAuth scopes are OIDC identity scopes and custom scopes are not currently supported; CallVault must persist per-client MCP grants and enforce `read` / `write` / `ai` / `admin` categories itself. | — Pending |
| `sync-tab` Phase 9 migration in scope | Non-Fathom recordings invisible in sync tab is a user-visible bug that contradicts the "unified vault" promise. | — Pending |
| RLS regression gaps in scope (cross-org table audit) | Pre-launch security hygiene. 9 user-facing tables added since the original `CROSS_ORG_TABLES` array were never added — a single misconfigured policy leaks data. | — Pending |
| `personal_folders` NOT in scope | The feature is dead-stub today; turning it on is a separate feature decision, not launch-readiness. | — Pending |
| Onboarding drop-off telemetry deferred | Ship to real users first, then instrument based on actual drop-off, not guessed. | — Pending |
| Multi-vendor MCP gateway (aggregating external MCPs) explicitly out | Scope discipline — that's a different product. | ✓ Good |
| Stay in `.planning/` with GSD; commit planning docs to git | Single-operator direct-main workflow; planning docs are part of the project. | ✓ Good |
| **File upload + async transcription deferred to v2 (2026-05-27)** | CallVault is not becoming a transcription service in the launch milestone. Paste is sufficient for v1 manual import. Removing the upload UI also removes a maintenance and support surface that would distract from the connector + MCP launch story. Research is retained for v2. | ✓ Good |
| **FileUploadDropzone UI removed (MAN-06)** | If we're not improving the synchronous 25MB Whisper path, surfacing it would set wrong expectations. Hide it; revisit when MAN-01 async pipeline lands in v2. | ✓ Good |
| **Support popout (ONB-05) consolidates "how it works" + tour + docs + ticket submission** | Strangers at self-serve launch will hit confusion and bugs. A single discoverable entry point with four well-defined options beats scattered help links. Mintlify-powered docs + Resend-backed ticket form is the lowest-overhead launch-ready support surface. | — Pending |
| **Autopilot (Workstream 5) added mid-milestone as new phases, not a new milestone (2026-06-10)** | v1.0 launch milestone is 44% in-flight; a milestone switch would reset STATE and archive live phase dirs. New phases keep launch tracking intact while Autopilot proceeds. | — Pending |
| **Autopilot approval surface is IN-APP, not Telegram (v1)** | Andrew reviews fix summaries and approves in the AdminTab. Telegram bridge + user chat deferred to v2 — comms infrastructure must not block the core autonomous fix loop. | — Pending |
| **Spike-first gate for Autopilot (SPK-01)** | The load-bearing unknowns (unattended headless-claude debugging; subscription execution from launchd) are asserted, not proven. 2 throwaway days bound the downside before any real infrastructure is built. | — Pending |
| **Autopilot safety is mechanical, not prompt-based** | Ticket text is attacker-controlled input to an agent with push access. Sandboxed per-run worktrees, a non-LLM push-gate, kill switch, and independent watchdog enforce the boundary regardless of agent behavior (ISA ISC-104..120). | — Pending |
| **Feature-flag system removed (FLAG-01)** | Confirmed nonfunctional dead weight gating Layout/sidebar surfaces; removal simplifies AdminTab ahead of the tickets view landing there. | ✓ Good |
| **v2.0 = go live on the Autopilot loop (2026-06-12)** | v1.0 built and armed the machinery but never claimed a real ticket. The remaining unknowns (does it hold up on real traffic, do the safety boundaries survive load) can only be answered by turning it on. v2.0 is the trust-and-scale milestone. | — Pending |
| **Raise daily fix throughput to ~25–30/day, hold high until findings taper (ACT-02)** | The conservative idle posture proved safety; it doesn't prove value. To actually drive ticket rate down we need volume — push the daily limit up to 25–30 and keep it there until the finding rate falls off, rather than throttling prematurely. Safety boundaries (gate, denylist, kill switch, watchdog) are mechanical and unchanged by raising volume. | — Pending |
| **v2.0 broadens the loop beyond bug-fix (Sentry triage, nightly QA, reporter comms, feature dev)** | The fix engine is the hard part and it's proven. The leverage now is pointing it at more sources (Sentry, nightly QA) and more task types (features), and closing the human loop (reporter comms + accurate source attribution) so ticket rate drops and CX improves. | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-12 — Started milestone v2.0 Autonomous Operations: go live on the Autopilot loop, raise throughput to ~25–30 fixes/day, and broaden into Sentry triage, nightly QA, reporter comms, source attribution, and autonomous feature dev. v1.0 workstreams moved to Validated.*
