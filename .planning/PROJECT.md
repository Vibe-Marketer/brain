# CallVault — Self-Serve Public Launch

## What This Is

CallVault is a B2B SaaS for call recording, transcript storage, and AI-powered call intelligence. It unifies recordings from every meeting-recorder source a team uses (Fathom, Zoom, Fireflies, Grain, Read.ai, PLAUD, YouTube, manual upload) into a single org-and-workspace-scoped vault, with an MCP server that exposes that vault to AI clients (Claude Desktop, Cursor, custom agents).

This milestone takes CallVault from "works for Andrew and a handful of dogfood users" to "self-serve public launch — anyone can sign up, connect a source, and get value in under 5 minutes."

## Core Value

A team can centralize every call from every source into workspace-scoped vaults that an AI agent can both read from AND write into — and the experience is reliable enough that a stranger off the internet can wire it up themselves without help.

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

### Active

<!-- This milestone's scope. Four workstreams. -->

**Workstream 1 — Onboarding & self-serve launch UX**
- [ ] **ONB-01**: First-run wizard polish — no dead ends, first connector sync completes cleanly, clear "you're done" state
- [ ] **ONB-02**: Empty states on every zero-data surface (calls list, workspaces, folders, contacts, settings) with a real CTA
- [ ] **ONB-03**: Polar billing upgrade flow — paywall gates on Pro/Team features, upgrade dialog, post-upgrade success state
- [ ] **ONB-04**: Public-launch landing-to-app flow audit — signup, email verification, first session, first connector all chained without dead air
- [ ] **ONB-05**: Support popout — single top-bar popout with "How it works", "Take the tour", Mintlify docs search, and "Submit a ticket" (form → Resend email to support@callvaultai.com with auto-attached context)

**Workstream 2 — Connector reliability + per-workspace binding**
- [ ] **CON-01**: Unhappy-path hardening across all 7 connectors — token refresh, expired-token recovery, rate-limit handling, webhook retry-with-backoff, partial-sync resume, dedup edge cases
- [ ] **CON-02**: Single per-workspace connection-status UI — connected sources, last sync, error state, reconnect button (today this is scattered across multiple settings panes)
- [ ] **CON-03**: Disconnect-and-reconnect flow polish — clean teardown of tokens/webhooks on disconnect; smooth re-auth; user-friendly OAuth callback error messages
- [ ] **CON-04**: Per-workspace connector binding — each connector instance can be assigned to a specific workspace (today binding is at org or user level depending on source)

**Workstream 3 — Paste transcript polish (descoped 2026-05-27)**
> Scope change: Andrew descoped the async transcription pipeline and file upload from this milestone. CallVault is not becoming a transcription service right now. The paste path becomes the v1 manual import. File upload UI is removed; the existing `file-upload-transcribe` Edge Function stays deployed but is no longer surfaced. Async transcription + audio format expansion deferred to v2 (MAN-01, MAN-03 — research already done at `.planning/research/ASYNC-TRANSCRIPTION-PIPELINE.md`, retained for v2 reuse).

- [x] **MAN-02**: More transcript formats for paste path — beyond VTT/raw: SRT (via `npm:subtitle@4.2.2`), Otter TXT export; canonical CallVault JSON shape documented
- [x] **MAN-04**: Behavioral HTTP integration tests for `save-pasted-transcript` — real-Supabase, NOT mocked (Phase 30 / BUG-01 precedent)
- [x] **MAN-05**: Friendly error UX for failed pastes — bad format, dedup hits, parse errors, workspace permission failures
- [x] **MAN-06**: Remove FileUploadDropzone from the import flow — hide all file-upload entry points until v2 transcription work resumes

**Workstream 4 — Multi-MCP: per-workspace endpoints + AI write tools + monolith refactor**
- [ ] **MCP-01**: Per-workspace MCP endpoints — each workspace exposes a distinct UUID-based MCP URL (`https://api.callvaultai.com/mcp/w/{workspace_uuid}`) so AI clients see workspaces as separate MCP connections and workspace renames do not break clients. One org can have multiple active MCP connections with different workspace/category scopes.
- [ ] **MCP-02**: Connectors UX per workspace — one click from the Connectors surface shows OAuth-first setup plus friendly client snippets (Claude Desktop, Cursor, generic MCP) using the `api.callvaultai.com` endpoint, never the raw Supabase URL; token/manual config remains available as fallback.
- [ ] **MCP-03**: Token management UI in Connectors — mint, list, revoke, and rotate MCP tokens per workspace/org; show scope, endpoint URL, enabled categories, last-used, and revoke/rotate flow
- [ ] **MCP-04**: MCP write tools optimized for AI-driven upload/manual vault addition — agents can push already-transcribed calls/manual transcripts into an authorized workspace and populate metadata, notes, tags, speakers, source date, and folder in the same call; org/workspace choice is permission-bound; organization/workspace creation remains admin-gated
- [ ] **MCP-05**: Refactor `mcp-server/index.ts` monolith (3,921 LOC) — extract per-tool handlers into `supabase/functions/mcp-server/tools/` modules; reduce cold-start risk and unblock parallel tool work

**Cross-cutting hardening (in scope for this milestone)**
- [ ] **HRD-01**: `sync-tab` reads from canonical `recordings` table (UUID-keyed) instead of `fathom_calls` (BIGINT-keyed) — today non-Fathom recordings (Zoom, Grain, Read.ai, manual) are invisible in the sync tab
- [ ] **HRD-02**: Fill `CROSS_ORG_TABLES` gaps in RLS regression test — add `mcp_tokens`, `personal_folders`, `personal_tags`, `personal_folder_recordings`, `personal_tag_recordings`, `call_notes`, `contact_folders`, `import_sources`, `import_routing_rules`

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
One MCP server at `supabase/functions/mcp-server/index.ts` (3,921 lines), public endpoint `api.callvaultai.com/mcp` via Cloudflare Worker proxy. OAuth 2.1 with PKCE. `mcp_tokens` table already has `org_id`, `workspace_id` (nullable), and `scope` columns — workspace-scoped tokens already exist as a concept. Code path in `mcp-server/index.ts:1118+` handles both org-scoped and workspace-scoped tokens (org-scoped accepts `workspace_id` as a tool param; workspace-scoped auto-resolves and ignores the param). The remaining work is: making each workspace appear as a distinct MCP endpoint (URL-level scoping), the Connectors setup UX, the token management UI, write-tool optimization for AI-driven upload, and the monolith extraction.

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
| `sync-tab` Phase 9 migration in scope | Non-Fathom recordings invisible in sync tab is a user-visible bug that contradicts the "unified vault" promise. | — Pending |
| RLS regression gaps in scope (cross-org table audit) | Pre-launch security hygiene. 9 user-facing tables added since the original `CROSS_ORG_TABLES` array were never added — a single misconfigured policy leaks data. | — Pending |
| `personal_folders` NOT in scope | The feature is dead-stub today; turning it on is a separate feature decision, not launch-readiness. | — Pending |
| Onboarding drop-off telemetry deferred | Ship to real users first, then instrument based on actual drop-off, not guessed. | — Pending |
| Multi-vendor MCP gateway (aggregating external MCPs) explicitly out | Scope discipline — that's a different product. | ✓ Good |
| Stay in `.planning/` with GSD; commit planning docs to git | Single-operator direct-main workflow; planning docs are part of the project. | ✓ Good |
| **File upload + async transcription deferred to v2 (2026-05-27)** | CallVault is not becoming a transcription service in the launch milestone. Paste is sufficient for v1 manual import. Removing the upload UI also removes a maintenance and support surface that would distract from the connector + MCP launch story. Research is retained for v2. | ✓ Good |
| **FileUploadDropzone UI removed (MAN-06)** | If we're not improving the synchronous 25MB Whisper path, surfacing it would set wrong expectations. Hide it; revisit when MAN-01 async pipeline lands in v2. | ✓ Good |
| **Support popout (ONB-05) consolidates "how it works" + tour + docs + ticket submission** | Strangers at self-serve launch will hit confusion and bugs. A single discoverable entry point with four well-defined options beats scattered help links. Mintlify-powered docs + Resend-backed ticket form is the lowest-overhead launch-ready support surface. | — Pending |

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
*Last updated: 2026-05-27 — Scope change: deferred file upload + async transcription to v2; added MAN-06 (remove FileUploadDropzone UI); roadmap collapsed 8 → 6 phases.*
