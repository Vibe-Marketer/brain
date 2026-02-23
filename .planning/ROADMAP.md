# Roadmap: CallVault v2.0 — The Pivot

**Defined:** 2026-02-23
**Depth:** Comprehensive (balanced profile, 10 phases)
**Coverage:** 70/70 v2.0 requirements mapped ✓
**Phase numbering:** Continues from v1 (last phase: 12) → v2.0 starts at Phase 13

> **v1 archive:** `.planning/milestones/v1-ROADMAP.md` (Phases 1–12, 93 plans, 80 requirements)
> **v2 phase folders:** `.planning/phases/13/` through `.planning/phases/22/` — created by `/gsd-plan-phase N` when each phase is planned
> **App repo:** v2 code lives at `/dev/callvault/` (new repo, created in Phase 14). This planning file stays in `brain/.planning/`.

---

## Overview

v2.0 is a deliberate, scoped frontend rebuild on top of the proven Supabase backend — not a full rewrite. The pivot strips ~89K lines of AI/chat/RAG complexity, starts a clean Vite+React repo pointing at the same Supabase project, and ships four strategic upgrades: a clarity-first workspace model (Organization → Workspace → Folder), a non-technical-user-friendly import routing rules engine, per-workspace MCP tokens via Supabase OAuth 2.1, and a lightweight bridge chat replacing the full RAG pipeline. Phases are ordered to surface working demos at every boundary — the primary defense against scope creep.

**Ordering principle:** Strategy before code → Auth before data → Data before rename → Connector pipeline before routing rules → MCP audit before new MCP features → Chat architecture before bridge chat → Backend cleanup last (after v2 confirmed stable in production).

---

## Phase Table

| Phase | Name | Goal | Requirements | Success Criteria |
|-------|------|------|--------------|-----------------|
| 13 | Strategy + Pricing | Lock product identity, pricing, and AI strategy before writing code | STRAT-01–03, BILL-01–04 | 4 criteria |
| 14 | Foundation | New repo with auth working, AppShell rendered, routes wired | FOUND-01–09, AI-02 | 5 criteria |
| 15 | Data Migration | All existing calls queryable in new frontend; RLS verified | DATA-01–05 | 4 criteria |
| 16 | Workspace Redesign | Organization → Workspace → Folder model live with correct naming, routing, and UX | WKSP-01–13 | 5 criteria |
| 17 | Import Connector Pipeline | Shared connector utility; source management UI; first new connector validated | IMP-01–03 | 3 criteria |
| 18 | Import Routing Rules | Condition builder, priority, preview, default destination | IMP-04–10 | 5 criteria |
| 19 | MCP Audit + Workspace Tokens | Audit current MCP; per-workspace token generation, scoping, revocation | MCP-01–07 | 5 criteria |
| 20 | MCP Differentiators | Differentiating tools, prompts, resources; multi-client verification | MCP-08–11 | 4 criteria |
| 21 | AI Bridge + Export + Sharing | Bridge chat, AI removal, smart enrichment, export, public sharing | AI-01–08, EXPRT-01–04, SHARE-01–04 | 5 criteria |
| 22 | Backend Cleanup | Drop AI tables/functions after v2 confirmed stable in production | (AI-07 execution) | 2 criteria |

---

## Phase Details

---

### Phase 13 — Strategy + Pricing

**Goal:** Product identity, AI strategy, and pricing model are locked before a single line of code is written.

**Rationale:** Every subsequent phase decision (what to build, what to charge for, how to frame features) depends on these three answers. STRAT-01 answers "what kind of AI product are we?"; STRAT-02/BILL-01 answer "what do we charge for?"; STRAT-03 locks "who are we?" — unresolved, they cause mid-build pivots.

**Dependencies:** None (this is the start)

**Requirements:**
- STRAT-01: AI strategy validated (MCP-first vs hybrid vs combination)
- STRAT-02: Pricing model defined before first commit
- STRAT-03: Product identity locked in writing
- BILL-01: Pricing tiers defined and documented
- BILL-02: Polar billing tiers updated to reflect new value prop
- BILL-03: Free tier defined (import limits, workspace limits, MCP access gating)
- BILL-04: Upgrade prompts designed for in-context limit hits

**Plans:** 3 plans

Plans:
- [ ] 13-01-PLAN.md — AI strategy document + product identity (STRAT-01, STRAT-03)
- [ ] 13-02-PLAN.md — Pricing tiers, free tier spec, upgrade prompt designs (STRAT-02, BILL-01, BILL-03, BILL-04)
- [ ] 13-03-PLAN.md — Update Polar billing dashboard to reflect v2 identity (BILL-02)

**Success Criteria:**
1. A written AI strategy document exists with a confident recommendation (not "both have tradeoffs") — the question "do we have AI in our product?" has a clear, documented answer
2. Polar billing tiers have been updated with new tier names and descriptions that mention zero AI features — old "AI-powered" messaging is gone
3. A product identity document exists (≤ 1 page) that any team member can read in under 2 minutes and know what CallVault is, who it's for, and what it is not
4. Free/paid tier limits are defined for at least: number of imports per month, number of workspaces, MCP token access — these limits exist in writing and are reflected in Polar before Phase 14 begins

**Notes:** No code. No commits. No repo. This phase is research, writing, and decision-making only. Phase 14 cannot begin until STRAT-01, STRAT-02, and BILL-01 are all resolved.

---

### Phase 14 — Foundation

**Goal:** Users can log in to the new frontend, see the AppShell layout, navigate all wired routes, and experience zero auth or data loss from the transition.

**Rationale:** Everything in v2 is built on top of this. Auth must work before data can be displayed. The tech stack must be validated before repo creation (FOUND-02) — wrong stack choices compound into months of rebuild debt. Supabase redirect allowlist (FOUND-07) and OAuth audit (FOUND-08) must complete before any user accesses the new frontend.

**Dependencies:** Phase 13 complete (pricing defined before repo created per STRAT-02 / FOUND-02 ordering constraint)

**Requirements:**
- FOUND-01: Users can log in with existing Supabase account — all data immediately accessible
- FOUND-02: Tech stack validated via deep research before repo creation
- FOUND-03: New GitHub repo with validated stack pointing at same Supabase project — zero AI code
- FOUND-04: AppShell renders 4-pane layout with Motion for React v12 spring animations
- FOUND-05: All non-AI routes are wired (calls list, workspace list, settings, import hub, sharing)
- FOUND-06: Zustand v5 + TanStack Query v5 installed with hard boundary enforced
- FOUND-07: Supabase Auth redirect allowlist includes new domain before any user access
- FOUND-08: Fathom and Zoom OAuth apps audited — callback URLs confirmed correct
- FOUND-09: Google Meet integration removed entirely — no Google OAuth scopes in new repo
- AI-02: New repo never contains any AI/RAG/embedding/Content Hub code

**Success Criteria:**
1. An existing user can navigate to the new frontend URL, click "Sign In," authenticate with their Google account, and land on the app shell — no broken redirect, no 404, no auth error
2. The AppShell renders 4 panes (nav sidebar, workspace list, detail pane, context panel) with spring animations that feel native — not "slide transitions" but spring physics (stiffness 200–300, damping 25–30)
3. Every route in the sitemap (calls list, workspace, settings, import hub, sharing) is reachable without 404 — orphaned pages do not exist
4. Navigating to `/bank/`, `/vault/`, `/hub/` returns a 404 or redirect (those paths should never exist in the new repo — they are v1 concepts)
5. A new user can be added to the Supabase redirect allowlist for the new domain and successfully complete auth without touching the old SITE_URL — old frontend continues to work for current users

**Notes:** Deep tech stack research (FOUND-02) is a deliverable of this phase, not a prerequisite — the research happens as Phase 14 plan 01, the repo creation happens as plan 02.

**Repo setup (explicit):**
- New repo created at `/Users/Naegele/dev/callvault/` — a sibling of `brain/`, NOT inside it
- GitHub repo: `Vibe-Marketer/callvault` (new, separate from `Vibe-Marketer/brain`)
- New Vercel project pointing at `callvault/` repo — separate deployment from v1
- `brain/` stays untouched — v1 app stays live in production until v2 is confirmed stable
- `.planning/` stays in `brain/.planning/` — it is the single source of truth for all v2 planning
- `callvault/` gets its own `CLAUDE.md` that references `brain/.planning/` for project context
- Same Supabase project env vars: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` copied from `brain/.env.local`
- Phase numbering, STATE.md, ROADMAP.md all remain in `brain/.planning/` — GSD commands run from `brain/`

**Other scaffold notes:** TailwindCSS v4 CSS-first config (`@theme {}` in globals.css, no `tailwind.config.js`). Abstract browser APIs behind hooks (`useFileOpen`, `useClipboard`) for future Tauri compatibility. `src-tauri/.gitkeep` created from day 1.

---

### Phase 15 — Data Migration

**Goal:** All existing calls are queryable in the new frontend via the `recordings` table; RLS isolation is verified with real JWTs before any user is switched.

**Rationale:** The migration infrastructure (recordings table, migrate_fathom_call_to_recording(), get_unified_recordings RPC) is already deployed and waiting — Phase 15 runs it to completion and verifies the result. This must complete before Phase 16 (workspace rename) because the rename operates on data that must first exist in the new schema. Dry-running on production data shape (DATA-05) is non-negotiable: 18 months of real Fathom data has NULLs, encoding edge cases, and orphaned rows that will break a naive migration.

**Dependencies:** Phase 14 complete (new frontend exists to verify queries against)

**Requirements:**
- DATA-01: fathom_calls → recordings batch migration completes — all existing calls queryable via get_unified_recordings RPC
- DATA-02: RLS policies on recordings and vault_entries verified before any user switch — User A cannot query User B's recordings
- DATA-03: source_metadata normalized across connectors — consistent external_id key for deduplication (Fathom, Zoom, YouTube; Google Meet removed)
- DATA-04: fathom_calls is archived (renamed, NOT dropped) with 30-day hold before removal
- DATA-05: Dry-run migration on production data shape completes before running real batch

**Success Criteria:**
1. An authenticated user can open the new frontend and see their complete call history — every call that existed in the old frontend appears in the new one, with the same title, date, duration, and transcript
2. A test using a real user JWT (never service_role) confirms User A's recordings are invisible to User B — zero cross-tenant data leakage
3. The source_metadata column for all Fathom, Zoom, and YouTube records contains a consistent `external_id` key — deduplication will work for any new imports
4. `SELECT count(*) FROM fathom_calls` and `SELECT count(*) FROM recordings` show matching counts (modulo rows that were already in recordings) — migration is provably complete

**Notes:** MUST NOT drop fathom_calls during v2.0 — archive it (rename to fathom_calls_archive or similar). Run profiling queries before migration: NULL rates on key fields, row count by user, anomaly detection. Disable triggers during batch migration to avoid overhead. Google Meet removed entirely — DATA-03 covers only Fathom, Zoom, YouTube.

---

### Phase 16 — Workspace Redesign

**Goal:** Users experience the new Organization → Workspace → Folder model with correct naming everywhere, working URL redirects, clear switching UX, and functional invite flows.

**Rationale:** This is the core UX clarity investment of v2.0. The rename must happen atomically — partial renames create "Vault not found" errors in an app that now says "Workspace." URL redirect rules (WKSP-04) must be active before the rename ships, not after. The 4-level model diagram (WKSP-09) is non-negotiable: if users don't understand the model in 30 seconds, adoption fails. Additive DB migrations only — never rename columns in-place.

**Dependencies:** Phase 15 complete (DATA-01 — all data in recordings table before restructuring workspace access to it)

**Requirements:**
- WKSP-01: Bank renamed to Organization in UI, DB schema (additive migration), email templates, error messages, tooltips, docs
- WKSP-02: Vault renamed to Workspace in all UI surfaces
- WKSP-03: Hub renamed to Folder in all UI surfaces
- WKSP-04: URL redirect rules (301s) for /bank/, /vault/, /hub/ active before rename ships — 90-day lifespan
- WKSP-05: User can create an Organization; "Personal" Organization auto-created on signup
- WKSP-06: User can switch between Organizations via org switcher in sidebar — always knows which org they're in
- WKSP-07: User can create a Workspace inside an Organization; "My Calls" Workspace auto-created
- WKSP-08: User can switch between Workspaces within an Organization
- WKSP-09: Onboarding screen shows the 4-level model with a diagram — users understand in 30 seconds
- WKSP-10: Invite dialog shows both Org + Workspace name — invitees know what they're accepting
- WKSP-11: User can invite members to a Workspace with Viewer/Member/Admin roles
- WKSP-12: User can create, rename, archive Folders inside a Workspace
- WKSP-13: User can manage Workspace membership from Workspace settings

**Success Criteria:**
1. A user who bookmarked `/bank/abc123/vault/xyz` gets 301-redirected to the equivalent new URL — their link is not broken, and the redirect is active before the first user sees the rename
2. A new user completes signup, sees "Personal" Organization and "My Calls" Workspace auto-created, and can navigate the 4-level model (Account → Organization → Workspace → Folder → Call) via the onboarding diagram without asking "what's a Workspace?"
3. Zero instances of "Bank," "Vault," or "Hub" are visible anywhere in the UI, API error messages, email templates, or tooltips — audit passes with a full-text search
4. A workspace owner can invite a collaborator, the invite dialog shows "You are inviting [email] to the workspace Acme – Sales US inside Acme Corp. They will not see other organizations or workspaces," and the invitee can accept and access only that workspace
5. A workspace owner can add a member with "Viewer" role, change them to "Member," and remove them from Workspace settings — role changes take effect immediately (no page refresh required)

**Notes:** P6 pitfall (URL redirect strategy) must be resolved BEFORE this phase starts building rename features. All DB migrations are additive (add new columns, don't rename existing). SITE_URL timing: do NOT update SITE_URL until hard cutover date — use allowlist during dual-operation.

---

### Phase 17 — Import Connector Pipeline

**Goal:** A shared connector pipeline utility exists; existing connectors are normalized to use it; import source management UI shows connected sources; adding a new connector takes ≤ 230 lines.

**Rationale:** This phase builds the infrastructure layer that makes all current and future connectors maintainable. IMP-01 (connector pipeline) must complete before IMP-04 (routing rules can reference it). Existing connectors (Fathom, Zoom, YouTube) need one-time normalization to add `external_id` to source_metadata. The new connector requirement (IMP-02 — validated by building at least one new source) is the proof that the pipeline actually reduces work to the promised ~230 lines.

**Dependencies:** Phase 15 complete (DATA-03 — source_metadata normalized before connector pipeline is built on top of it)

**Requirements:**
- IMP-01: Connector pipeline shared utility exists (`_shared/connector-pipeline.ts`) with 5-stage architecture — existing connectors normalized to use it
- IMP-02: Adding a new import source requires ≤ 230 lines and 1–2 days — validated by building at least one new source using the pipeline
- IMP-03: Import source management UI shows all connected sources with active/inactive toggle and connected account display

**Success Criteria:**
1. A user can navigate to the Import Hub and see all connected sources (Fathom, Zoom, YouTube) with their connection status, last sync time, and an active/inactive toggle — no dead links, no placeholder UI
2. A developer can add a new import source connector by writing ≤ 230 lines of code (1 adapter file + 1 edge function + 1 connector component + 1 registry line) — verified by actually building one new source this phase
3. An import triggered from any connector (Fathom, Zoom, YouTube) writes directly to the `recordings` table via the shared pipeline — deduplication by `external_id` prevents duplicate imports

**Notes:** This phase is engineering infrastructure, not user-facing features. The "build one new connector" requirement (IMP-02) is the acceptance test for the pipeline. Connector candidates: direct file upload (MP3/video + Whisper) or Grain. The `_shared/connector-pipeline.ts` has 5 stages: (1) Get credentials, (2) Fetch raw meetings, (3) Dedup check by source_metadata->>'external_id', (4) Transform to recordings schema, (5) Insert recording + vault_entry.

---

### Phase 18 — Import Routing Rules

**Goal:** Users can create import routing rules with a condition builder, set priority order, preview match counts, and have a required default destination for unmatched calls.

**Rationale:** Routing rules are a key differentiating feature of v2.0. They must be built on top of the connector pipeline (Phase 17) — rules trigger at import time, routed through the same pipeline. IMP-10 (priority schema from first migration) and IMP-06 (first-match-wins drag-to-reorder) are non-negotiable: retrofitting priority later is a significant schema and UX change. IMP-08 (rule preview) is required — users who can't preview a rule before saving it will misconfigure and lose calls.

**Dependencies:** Phase 17 complete (IMP-01 — connector pipeline must exist before routing rules can use it)

**Requirements:**
- IMP-04: User can create an import routing rule that auto-assigns calls to a Workspace/Folder at import based on conditions
- IMP-05: Condition builder supports at least 5 condition types: title contains, participant is, source is, duration greater than, tag is
- IMP-06: Rules use first-match-wins priority — user can drag to reorder rule priority
- IMP-07: Default destination is required when creating rules — unmatched calls route to a specified Workspace/Folder
- IMP-08: Rule preview shows "This rule would match X of your last 20 calls" before saving — required, not optional
- IMP-09: Rules apply to future imports only — UI explicitly states "Rules apply to new imports only"
- IMP-10: Rule priority stored in schema from the first migration (`rules.priority` integer column with drag-to-reorder UI)

**Success Criteria:**
1. A user can create a routing rule in under 2 minutes using the condition builder: select a field (e.g., "title"), select an operator (e.g., "contains"), enter a value, set a destination Workspace and Folder, and save — no documentation required
2. Before saving any rule, the user sees "This rule would match X of your last 20 calls" — they can verify their conditions are correct before the rule becomes active
3. A user with 3 rules can drag to reorder them — the priority numbers update immediately, and the new priority is persisted (the order survives a page refresh)
4. After a new call is imported, it appears in the Workspace/Folder specified by the matching rule — the routing happened automatically without user action
5. A user who creates rules sees an explicit "Rules apply to new imports only" message — there is no ambiguity about retroactive application

**Notes:** P7 pitfall (no priority system from day 1) — `rules.priority` integer column must be in the very first migration for this feature. P8 pitfall (no rule preview) — live count against last 20 calls is required before shipping. Condition builder UX: sentence-like, field-first, max 3–4 operators in v2 (`contains`, `equals`, `starts with`, `doesn't contain`). Default destination is required to create any rule — users cannot save a rule without a fallback.

---

### Phase 19 — MCP Audit + Workspace Tokens

**Goal:** Current MCP server is fully audited and documented; per-workspace MCP tokens can be generated, scoped, named, and revoked; RLS enforces workspace isolation from current membership.

**Rationale:** MCP-01 (audit) must complete before MCP-04 (new tokens built on top of existing infrastructure). Building new MCP features on top of undocumented or untested foundations creates technical debt that is painful to unwind. The per-workspace token architecture (client_id in JWT → RLS policy on vault_entries) is the security-critical path — P5 pitfall (OAuth scopes don't enforce DB access, RLS does) must be understood and implemented correctly before any token is issued.

**Dependencies:** Phase 16 complete (WKSP-01–03 — MCP tools must be updated to new naming; can't audit MCP tools that reference old Bank/Vault/Hub naming)

**Requirements:**
- MCP-01: Full audit of current MCP server documented — every tool, resource, prompt catalogued, tested, gaps identified
- MCP-02: Current MCP capabilities preserved or improved in v2 — nothing regresses from v1 MCP
- MCP-03: MCP tools updated to use new Organization/Workspace/Folder naming (was Bank/Vault/Hub)
- MCP-04: Workspace owner can generate a per-Workspace MCP token scoped to that Workspace only
- MCP-05: Token management UI: Airtable-style — name required, scope selector (whole Workspace or specific Folders), show-once with "I've copied it" confirmation, MCP config block included
- MCP-06: Token list shows: name, scope, last-used timestamp, revoke button
- MCP-07: RLS enforces Workspace isolation from current DB membership (not from JWT claims at token-issuance time) — verified: scoped token cannot read calls from other Workspaces

**Success Criteria:**
1. A documented audit exists as a file (e.g., `.planning/mcp-audit.md`) listing every MCP tool, resource, and prompt — including: current behavior, test result (pass/fail), and any gaps identified — nothing is shipped without being audited
2. An existing MCP user can connect to the new MCP server (with updated naming) and their previously-working queries continue to work — zero regression on v1 MCP capabilities
3. A workspace owner can navigate to Workspace Settings → MCP, click "Generate token," name it, choose a scope (whole workspace or specific folders), see the token exactly once with a copy button, confirm "I've copied it," and receive a copy-pasteable MCP config block alongside the token
4. The token list page shows each token's name, scope, last-used timestamp, and a Revoke button — revoking a token immediately prevents new requests using that token
5. A test using a scoped token (scoped to Workspace A) confirms it cannot SELECT recordings from Workspace B — RLS enforcement is verified with a real JWT, never service_role

**Notes:** P5 pitfall (RLS must check client_id from auth.jwt(), not workspace_id from request body) is critical. P9 pitfall (stale MCP tokens after workspace membership change) — RLS must join against CURRENT workspace membership at query time, not trust JWT claims from issuance time. Verify Supabase Custom Access Token Hook availability on current plan tier before building (open question from research). New table: `workspace_mcp_tokens` (client_id, workspace_id, owner_user_id, label, last_used_at, revoked_at).

---

### Phase 20 — MCP Differentiators

**Goal:** Differentiating MCP tools, shareable prompts, and the callvault:// resource URI scheme are implemented and verified working across multiple MCP clients.

**Rationale:** Phase 19 audited and stabilized the foundation. Phase 20 builds on top of it. MCP-08–11 are the features that make CallVault MCP meaningfully better than connecting any other tool — they are the moat. MCP-11 (multi-client verification) is the acceptance gate: if it doesn't work in Claude Desktop, ChatGPT (Apps SDK), and at least one other client, it hasn't shipped.

**Dependencies:** Phase 19 complete (MCP-01–07 — audit and workspace tokens must exist before differentiating tools are added on top)

**Requirements:**
- MCP-08: Differentiating tools: `browse_workspace_hierarchy`, `get_speaker_history`, `compare_recordings`, `get_topic_timeline`, `batch_get_transcripts`, `get_recording_context`
- MCP-09: MCP Prompts: `prepare_for_meeting`, `weekly_digest`, `compare_prospects` — coaches can share prompts alongside workspace MCP URL
- MCP-10: MCP Resources (`callvault://` URI scheme) — AI can navigate call library as addressable resources
- MCP-11: MCP server tested end-to-end against Claude Desktop, ChatGPT (via Apps SDK), and at least one other MCP client before shipping

**Success Criteria:**
1. A Claude Desktop user can type "Use the browse_workspace_hierarchy tool to show me all my workspaces and folders" and receive a structured, navigable response — the tool exists and works
2. A coach can share a Workspace MCP URL alongside a prompt name (e.g., "Use the prepare_for_meeting prompt with [call ID]") — the recipient can paste the URL, connect, and run the prompt without further instruction
3. An AI client can request `callvault://workspace/{id}/calls` and receive a paginated list of calls — the URI scheme is functional and consistently formatted
4. The MCP server is verified working (successful tool calls returning real data) in: (a) Claude Desktop, (b) ChatGPT via Apps SDK, (c) at least one additional MCP client — screenshots or logs confirm each

**Notes:** P5 pitfall still applies — all new tools must derive workspace_id from JWT claims, never from request body. The `get_speaker_history` and `compare_recordings` tools likely require cross-recording queries — design these carefully against RLS policies. MCP-11 verification is a hard gate: don't mark phase complete until all three clients are tested.

---

### Phase 21 — AI Bridge + Export + Sharing

**Goal:** In-app bridge chat works (transcript-in-context, streamed, no RAG); smart enrichment continues at import; AI infrastructure removed from new repo; export and public sharing are functional.

**Rationale:** AI-01 (chat architecture research) must complete before AI-04 (bridge chat built) — the architecture decision determines the implementation. AI-02 is a constraint that applies to the entire repo, not just this phase. AI-05 (stop embeddings), AI-06 (keyword search), and AI-08 (contain OpenRouter) are cost and simplicity wins. EXPRT and SHARE requirements complete the "use CallVault with any AI" loop — export is how users get their calls into Claude/ChatGPT when they don't want MCP.

**Dependencies:** Phase 16 complete (workspace model — bridge chat must be scoped to correct workspace/folder); Phase 20 complete (MCP shipped — AI strategy can be finalized now that MCP is working)

**Requirements:**
- AI-01: In-app chat architecture researched and decided (SDK, scope, permanent vs transitional)
- AI-02: New repo never contains AI/RAG/embedding/Content Hub code (constraint, enforced throughout)
- AI-03: Smart import enrichment continues — auto-title, action items, tags, sentiment at import time (one-time, not interactive)
- AI-04: In-app bridge chat — user selects 1–3 calls as context, asks question, gets streamed response. No RAG, no sessions, no embeddings.
- AI-05: OpenAI embedding API calls stop — no new embedding jobs, per-call embedding cost = $0
- AI-06: Keyword search (pg_trgm) replaces semantic vector search for call discovery in new frontend
- AI-07: After v2 confirmed stable: ~15 AI tables and ~23 AI edge functions queued for Phase 22 cleanup (sequenced, 30-day archive hold defined)
- AI-08: OpenRouter dependency contained — only for bridge chat if chosen; user-controlled, not hidden ongoing cost
- EXPRT-01: User can export any call as DOCX, PDF, or plain text (transcript + metadata)
- EXPRT-02: Export format optimized for external AI use — transcript, speakers, timestamps, tags, action items formatted for pasting into Claude/ChatGPT/Gemini
- EXPRT-03: User can export multiple calls as a ZIP archive
- EXPRT-04: "Open in Claude" / "Open in ChatGPT" one-click flow — exports transcript and opens AI tool with context pre-loaded
- SHARE-01: User can generate a public share link for any call — works without login
- SHARE-02: User can share a Workspace with external collaborators
- SHARE-03: Coach/admin can share an embeddable call player (iframe embed with access control)
- SHARE-04: Shared Workspace invites show what invitee will have access to before they accept

**Success Criteria:**
1. A user can select 2 calls in the call list, open the bridge chat, type "What were the main action items from these two calls?", and receive a streamed response that references both transcripts — no RAG, no embeddings, no sessions, no vector search
2. A user can export a call as PDF and the exported file includes: title, date, participants, full transcript with timestamps, tags, and action items — formatted so it can be pasted directly into Claude with immediate useful context
3. A user can click "Open in Claude" on any call and be taken to Claude.ai with the transcript pre-loaded in the context window — zero copy-paste required
4. A coach can generate a public share link for a call and send it to a client — the client can open the link in a browser without logging in and read the call transcript
5. Keyword search (pg_trgm) returns relevant calls when a user types a participant name, topic, or phrase — no vector search, no embeddings, results appear in under 500ms for a library of 500 calls

**Notes:** AI-01 research is plan 01 of this phase — architecture decision happens first, bridge chat implementation happens after. The "bridge chat" is ~100 lines: select calls → concatenate transcripts as context → single LLM call → stream response. No RAG pipeline, no tool calls, no session state. OpenRouter is the candidate but AI-01 decides. Smart enrichment (AI-03) is one-time at import and is NOT being removed — it's the auto-title, action items, tags, and sentiment that make imported calls immediately useful.

---

### Phase 22 — Backend Cleanup

**Goal:** ~15 AI tables and ~23 AI edge functions are dropped from the Supabase project after v2 is confirmed stable in production for 30 days.

**Rationale:** This is the final act of the pivot. It happens last because it is irreversible — data that is dropped is gone. The 30-day archive hold is non-negotiable. The cleanup sequence matters: functions first (stop reads), then tables (stop writes), then drop. Edge function removal happens before table removal to prevent orphaned reads after tables are gone.

**Dependencies:** Phase 21 complete AND v2 confirmed stable in production for 30 days (real user data confirms no calls, transcripts, or settings were lost)

**Requirements:**
- AI-07 (execution): Drop ~15 AI tables and ~23 AI edge functions after v2 confirmed stable — sequenced with 30-day archive hold

**Success Criteria:**
1. The Supabase project has no AI-specific tables (embedding tables, RAG tables, Content Hub tables, PROFITS tables, Langfuse tables) — verified by reviewing the schema
2. The Edge Functions list has no AI-specific functions (chat-stream, chat-stream-v2, embed-*, rag-*, content-*, profits-*, langfuse-*) — the function count drops by ~23

**Notes:** This phase has no user-facing features. It is infrastructure hygiene. Before dropping anything: (1) confirm 30 days of v2 production stability with no user-reported data issues, (2) snapshot the schema as a SQL dump for historical reference, (3) disable edge functions before dropping tables (not the other way around), (4) archive fathom_calls_archive (from Phase 15) in this phase if 30-day hold has elapsed.

---

## Requirement → Phase Traceability

| Requirement | Phase | Description |
|-------------|-------|-------------|
| STRAT-01 | 13 | AI strategy validated |
| STRAT-02 | 13 | Pricing model defined before first commit |
| STRAT-03 | 13 | Product identity locked |
| BILL-01 | 13 | Pricing tiers defined and documented |
| BILL-02 | 13 | Polar billing tiers updated |
| BILL-03 | 13 | Free tier defined |
| BILL-04 | 13 | Upgrade prompts designed |
| FOUND-01 | 14 | Login with existing Supabase account |
| FOUND-02 | 14 | Tech stack validated via deep research |
| FOUND-03 | 14 | New GitHub repo with validated stack |
| FOUND-04 | 14 | AppShell renders 4-pane layout |
| FOUND-05 | 14 | All non-AI routes wired |
| FOUND-06 | 14 | Zustand v5 + TanStack Query v5 with hard boundary |
| FOUND-07 | 14 | Supabase Auth redirect allowlist updated |
| FOUND-08 | 14 | Fathom and Zoom OAuth apps audited |
| FOUND-09 | 14 | Google Meet removed entirely |
| AI-02 | 14 | New repo never contains AI/RAG code (constraint) |
| DATA-01 | 15 | fathom_calls → recordings migration completes |
| DATA-02 | 15 | RLS policies verified before any user switch |
| DATA-03 | 15 | source_metadata normalized across connectors |
| DATA-04 | 15 | fathom_calls archived (not dropped) |
| DATA-05 | 15 | Dry-run migration on production data shape |
| WKSP-01 | 16 | Bank renamed to Organization everywhere |
| WKSP-02 | 16 | Vault renamed to Workspace everywhere |
| WKSP-03 | 16 | Hub renamed to Folder everywhere |
| WKSP-04 | 16 | URL redirect rules (301s) for old paths |
| WKSP-05 | 16 | Organization creation + Personal auto-created |
| WKSP-06 | 16 | Organization switcher in sidebar |
| WKSP-07 | 16 | Workspace creation + My Calls auto-created |
| WKSP-08 | 16 | Workspace switching within an Organization |
| WKSP-09 | 16 | Onboarding screen with 4-level model diagram |
| WKSP-10 | 16 | Invite dialog shows both Org + Workspace name |
| WKSP-11 | 16 | Invite members with Viewer/Member/Admin roles |
| WKSP-12 | 16 | Create, rename, archive Folders |
| WKSP-13 | 16 | Manage Workspace membership from settings |
| IMP-01 | 17 | Connector pipeline shared utility |
| IMP-02 | 17 | New source ≤ 230 lines — validated by building one |
| IMP-03 | 17 | Import source management UI |
| IMP-04 | 18 | Create import routing rule with conditions |
| IMP-05 | 18 | Condition builder with 5 condition types |
| IMP-06 | 18 | First-match-wins priority with drag-to-reorder |
| IMP-07 | 18 | Default destination required for rules |
| IMP-08 | 18 | Rule preview ("X of last 20 calls match") |
| IMP-09 | 18 | Rules apply to future imports only — stated in UI |
| IMP-10 | 18 | Rule priority in schema from first migration |
| MCP-01 | 19 | Full audit of current MCP server |
| MCP-02 | 19 | Current MCP capabilities preserved/improved |
| MCP-03 | 19 | MCP tools updated to new naming |
| MCP-04 | 19 | Per-Workspace MCP token generation |
| MCP-05 | 19 | Airtable-style token management UI |
| MCP-06 | 19 | Token list with name, scope, last-used, revoke |
| MCP-07 | 19 | RLS enforces Workspace isolation by current membership |
| MCP-08 | 20 | Differentiating MCP tools (6 tools) |
| MCP-09 | 20 | MCP Prompts (3 shareable prompts) |
| MCP-10 | 20 | MCP Resources (callvault:// URI scheme) |
| MCP-11 | 20 | End-to-end verified across 3 MCP clients |
| AI-01 | 21 | In-app chat architecture researched and decided |
| AI-03 | 21 | Smart import enrichment continues |
| AI-04 | 21 | In-app bridge chat |
| AI-05 | 21 | OpenAI embedding API calls stop |
| AI-06 | 21 | Keyword search replaces semantic search |
| AI-07 | 21/22 | AI tables/functions queued (21) then dropped (22) |
| AI-08 | 21 | OpenRouter dependency contained |
| EXPRT-01 | 21 | Export any call as DOCX, PDF, plain text |
| EXPRT-02 | 21 | Export format optimized for external AI use |
| EXPRT-03 | 21 | Export multiple calls as ZIP |
| EXPRT-04 | 21 | "Open in Claude" / "Open in ChatGPT" one-click flow |
| SHARE-01 | 21 | Public share link for any call |
| SHARE-02 | 21 | Share Workspace with external collaborators |
| SHARE-03 | 21 | Embeddable call player (iframe) |
| SHARE-04 | 21 | Shared Workspace invites show access scope |

**Coverage: 70/70 v2.0 requirements mapped ✓**

---

## Critical Ordering Constraints

| Constraint | Why |
|------------|-----|
| STRAT-01 + BILL-01 before FOUND-02/03 | Pricing and product identity defined before repo created |
| DATA-01 before WKSP-01 | Migration complete before workspace rename operates on data |
| IMP-01 before IMP-04 | Connector pipeline exists before routing rules are built on top |
| MCP-01 before MCP-04 | Audit complete before new token infrastructure is built |
| AI-01 before AI-04 | Chat architecture researched before bridge chat built |
| Phase 22 last | Backend cleanup only after 30 days of confirmed production stability |

---

## Progress

| Phase | Name | Status | Plans | Complete |
|-------|------|--------|-------|---------|
| 13 | Strategy + Pricing | Planned | 3 plans | — |
| 14 | Foundation | Not started | — | — |
| 15 | Data Migration | Not started | — | — |
| 16 | Workspace Redesign | Not started | — | — |
| 17 | Import Connector Pipeline | Not started | — | — |
| 18 | Import Routing Rules | Not started | — | — |
| 19 | MCP Audit + Workspace Tokens | Not started | — | — |
| 20 | MCP Differentiators | Not started | — | — |
| 21 | AI Bridge + Export + Sharing | Not started | — | — |
| 22 | Backend Cleanup | Not started | — | — |

---

*Roadmap created: 2026-02-23*
*Milestone: v2.0 — The Pivot*
*Phase numbering: 13–22 (continues from v1 Phase 12)*
