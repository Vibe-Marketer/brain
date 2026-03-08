# Requirements: CallVault v2.0 — The Pivot

**Defined:** 2026-02-22
**Core Value:** Clarity-first organized call workspace. Users can import calls from anywhere, organize them into clear workspaces (Organization → Workspace → Folder), and expose that structured context to whatever AI they already use — with zero confusion about how the system works.

**Milestone:** v2.0 — The Pivot (new repo, AI removal, workspace clarity, import rules, MCP expansion)

---

## v2.0 Requirements

### Strategy Validation (Pre-Build)

*Must be completed before writing a single line of code. Defines who we are, what we're building, and why.*

- [ ] **STRAT-01**: AI strategy is validated — definitive answer on the options: (A) MCP-first only (remove all AI), (B) Knowledge Graph approach, (C) Hybrid RAG with metadata enrichment, (D) Combination of MCP + one of the above. Unbiased deep dive that audits the assumptions held by the model, the builder, and the user — identifying where those assumptions are accurate and where they diverge. Must produce a confident recommendation with clear reasoning, not a "both have tradeoffs" non-answer.
- [ ] **STRAT-02**: Pricing model is defined before first commit — Organization/Workspace value tiers determined. Who we are, what we charge for, and why. Polar billing tiers updated to reflect the new product reality (not "AI-powered call intelligence" but "organized call workspace that works with any AI").
- [ ] **STRAT-03**: Product identity locked — who we are and what we're about written down before writing code. Defines every future product decision.

### Foundation (New Frontend Repo)

*The new frontend is a complete visual and technical refresh that existing users will experience as an upgrade, not a disruption. Nothing is lost. No call, no workspace, no setting, no billing state. Users log in to the new experience without failure, without data loss, without confusion. The transition is invisible until the moment it goes live — and then it just works.*

- [ ] **FOUND-01**: User can log in to the new frontend using their existing Supabase account — all data (calls, workspaces, billing) immediately accessible exactly as they left it
- [ ] **FOUND-02**: Tech stack validated via deep research before repo creation — Vite 7 vs Next.js, React 18 vs 19, TanStack Router vs React Router, TailwindCSS v4 vs v3, shadcn/ui compatibility, Tauri readiness — right stack from day one, no rebuilding later
- [ ] **FOUND-03**: New GitHub repo exists with validated stack (Vite 7 + React 18 + TypeScript + TanStack Router v1), pointing at same Supabase project — zero AI code ever enters this repo
- [ ] **FOUND-04**: AppShell renders the 4-pane layout (nav sidebar / workspace list / detail / context panel) with Motion for React v12 spring animations, brand-compliant design, native-app feel (Arc/Comet Browser aesthetic)
- [ ] **FOUND-05**: All non-AI routes are wired (calls list, workspace list, settings, import hub, sharing) — no orphaned pages
- [ ] **FOUND-06**: Zustand v5 and TanStack Query v5 installed with hard boundary enforced (Zustand = UI state only, TanStack Query = server state — never mixed)
- [ ] **FOUND-07**: Supabase Auth redirect allowlist includes new domain before any user accesses new frontend — no auth broken during transition
- [ ] **FOUND-08**: Fathom and Zoom OAuth apps audited — callback URLs confirmed correct for new deployment
- [ ] **FOUND-09**: Google Meet integration removed entirely — no Google OAuth scopes, no Google Meet sync, no Google Meet import code ever in new repo

### Data Migration

- [ ] **DATA-01**: fathom_calls → recordings batch migration completes — all existing calls queryable via `get_unified_recordings` RPC in new frontend
- [ ] **DATA-02**: RLS policies on `recordings` and `vault_entries` explicitly verified before any user switch — User A cannot query User B's recordings (tested with real JWT, never service_role)
- [ ] **DATA-03**: `source_metadata` normalized across connectors — consistent `external_id` key for deduplication in all 4 existing connectors (Fathom, Zoom, YouTube; Google Meet removed)
- [ ] **DATA-04**: fathom_calls is archived (renamed, NOT dropped) with 30-day hold before removal
- [ ] **DATA-05**: Dry-run migration on production data shape completes before running real batch (NULL rates, row counts, encoding anomalies profiled first)

### Workspace Model (Organization → Workspace → Folder)

*Naming model: Account → Organization → Workspace → Folder → Call*
*"Organizations are silos. Workspaces are shareable hubs inside them. Folders just organize calls."*

- [ ] **WKSP-01**: Bank renamed to Organization in UI, database schema (additive migration), email templates, error messages, tooltips, documentation — zero "Bank" visible to users
- [ ] **WKSP-02**: Vault renamed to Workspace in UI and all surfaces — zero "Vault" visible to users
- [ ] **WKSP-03**: Hub renamed to Folder in UI and all surfaces — zero "Hub" visible to users
- [ ] **WKSP-04**: URL redirect rules (301s) for all old paths (/bank/, /vault/, /hub/) active before rename ships — 90-day redirect lifespan
- [ ] **WKSP-05**: User can create an Organization and see "Personal" Organization auto-created on signup
- [ ] **WKSP-06**: User can switch between Organizations with an org switcher in the sidebar — always knows which org they're in
- [ ] **WKSP-07**: User can create a Workspace inside an Organization and see "My Calls" Workspace auto-created
- [ ] **WKSP-08**: User can switch between Workspaces within an Organization — always knows which Workspace they're in
- [ ] **WKSP-09**: Onboarding screen shows the 4-level model (Account → Organization → Workspace → Folder → Call) with a diagram — users understand the model in 30 seconds
- [ ] **WKSP-10**: Invite dialog shows both Org + Workspace name ("You are inviting [email] to the workspace Acme – Sales US inside Acme Corp. They will not see other organizations or workspaces.")
- [ ] **WKSP-11**: User can invite members to a Workspace with roles that make sense (Viewer, Member, Admin) — roles understood by sales teams, coaches, and programs without explanation
- [ ] **WKSP-12**: User can create, rename, archive Folders inside a Workspace
- [ ] **WKSP-13**: User can manage Workspace membership (add, remove, change roles) from Workspace settings

### Import System

- [ ] **IMP-01**: Connector pipeline shared utility exists (`_shared/connector-pipeline.ts`) with 5-stage architecture (credentials → fetch → dedup → transform → insert) — existing connectors normalized to use it
- [ ] **IMP-02**: Adding a new import source requires ≤ 230 lines of code and 1-2 days of work (validated by building at least one new source using the pipeline)
- [ ] **IMP-03**: Import source management UI shows all connected sources with active/inactive toggle and connected account display
- [ ] **IMP-04**: User can create an import routing rule that auto-assigns calls to a Workspace/Folder at import based on conditions
- [ ] **IMP-05**: Condition builder supports at least 5 condition types: title contains, participant is, source is, duration greater than, tag is
- [ ] **IMP-06**: Rules use first-match-wins priority — user can drag to reorder rule priority
- [ ] **IMP-07**: Default destination is required when creating rules — unmatched calls route to a specified Workspace/Folder
- [ ] **IMP-08**: Rule preview shows "This rule would match X of your last 20 calls" before saving — required, not optional
- [ ] **IMP-09**: Rules apply to future imports only — UI explicitly states "Rules apply to new imports only"
- [ ] **IMP-10**: Rule priority stored in schema from the first migration (`rules.priority` integer column with drag-to-reorder UI)

### MCP Expansion

*The MCP expansion must first audit and validate everything the current MCP server does, then improve on it, then expand. Build it once and build it right.*

- [ ] **MCP-01**: Full audit of current MCP server (Phase 12) documented — every tool, resource, and prompt catalogued, tested, and gaps identified before writing new MCP code
- [ ] **MCP-02**: Current MCP capabilities are preserved or improved in v2 — nothing regresses from the v1 MCP
- [ ] **MCP-03**: MCP tools updated to use new Organization/Workspace/Folder naming (was Bank/Vault/Hub)
- [ ] **MCP-04**: Workspace owner can generate a per-Workspace MCP token scoped to that Workspace only
- [ ] **MCP-05**: Token management UI follows Airtable-style: name required, scope selector (whole Workspace or specific Folders), show-once with "I've copied it" confirmation, copy-paste MCP config block included
- [ ] **MCP-06**: Token list shows: name, scope, last-used timestamp, revoke button
- [ ] **MCP-07**: RLS enforces Workspace isolation from current DB membership (not from JWT claims at token-issuance time) — verified with test: scoped token cannot read calls from other Workspaces
- [ ] **MCP-08**: Differentiating MCP tools implemented: `browse_workspace_hierarchy`, `get_speaker_history`, `compare_recordings`, `get_topic_timeline`, `batch_get_transcripts`, `get_recording_context`
- [ ] **MCP-09**: MCP Prompts implemented (shareable analysis workflows): `prepare_for_meeting`, `weekly_digest`, `compare_prospects` — coaches can share prompts alongside their Workspace MCP URL
- [ ] **MCP-10**: MCP Resources (`callvault://` URI scheme) implemented — AI can navigate call library as addressable resources
- [ ] **MCP-11**: MCP server tested end-to-end against Claude Desktop, ChatGPT (via Apps SDK), and at least one other MCP client before shipping

### AI Removal + Simplification

*The in-app chat architecture is researched and decided before building it. The goal is the simplest, cleanest approach that serves users who don't have an external AI client — without recreating the complexity we're removing. This includes evaluating: Vercel AI SDK vs. OpenAI SDK vs. Anthropic SDK, what "attachments" should mean (transcript context only vs. file upload), and whether the bridge chat is a permanent feature or a time-limited compatibility layer.*

- [ ] **AI-01**: In-app chat architecture researched and decided — best SDK/infrastructure for a simple bridge chat (transcript-in-context, no RAG), scope of "attachments" (in-app content only vs. file upload), and whether this is permanent or transitional
- [ ] **AI-02**: New repo never contains any AI/RAG/embedding/Content Hub code — old repo features are left behind (Strangler Fig model, never copied)
- [ ] **AI-03**: Smart import enrichment continues running — auto-title, action items, tags, sentiment at import time (one-time, not interactive, runs on import only)
- [ ] **AI-04**: In-app bridge chat exists — user selects 1-3 calls/transcripts as context, asks a question, gets a streamed response. No RAG, no sessions, no embedding. Architecture determined by AI-01 research.
- [ ] **AI-05**: OpenAI embedding API calls stop — no new embedding jobs on imported calls, per-call embedding cost = $0
- [ ] **AI-06**: Keyword search (pg_trgm) replaces semantic vector search for call discovery in the new frontend
- [ ] **AI-07**: After v2 frontend confirmed stable in production: drop ~15 AI tables and ~23 AI edge functions from old Supabase project (sequenced, 30-day archive hold first)
- [ ] **AI-08**: OpenRouter dependency is contained — only used for bridge chat if that approach is chosen; user-controlled, not a hidden ongoing cost

### Export

- [ ] **EXPRT-01**: User can export any call as DOCX, PDF, or plain text (transcript + metadata)
- [ ] **EXPRT-02**: Export works optimally for external AI use — exported format is designed to be pasted into Claude/ChatGPT/Gemini and be immediately useful (includes transcript, speakers, timestamps, tags, action items)
- [ ] **EXPRT-03**: User can export multiple calls as a ZIP archive
- [ ] **EXPRT-04**: "Open in Claude" / "Open in ChatGPT" one-click flow — exports call transcript and opens the AI tool with context pre-loaded (replaces the "use our AI" CTA)

### Sharing + Public Access

- [ ] **SHARE-01**: User can generate a public share link for any call — link works without login
- [ ] **SHARE-02**: User can share a Workspace with external collaborators (coaches sharing a Workspace with program participants)
- [ ] **SHARE-03**: Coach/admin can share an embeddable call player for use on external sites (iframe embed with access control)
- [ ] **SHARE-04**: Shared Workspace invites show what the invitee will have access to before they accept

### Pricing + Billing

- [ ] **BILL-01**: Pricing tiers defined and documented before any code is written — what we charge for, why, and how it's framed (Organization value, Workspace value, collaboration, MCP access — NOT AI features)
- [ ] **BILL-02**: Polar billing tiers updated to reflect new pricing model (not "AI-powered" — the new value prop)
- [ ] **BILL-03**: Free tier defined — what you get free vs. what requires paid plan (import limits, Workspace limits, MCP access gating)
- [ ] **BILL-04**: Upgrade prompts appear in context (when user hits a limit, they see the upgrade path immediately and clearly)

---

## Future Requirements (v3+)

These were discussed but deliberately excluded from v2.0:

### Connector Expansion

- **CONN-F-01**: Grain import connector (via connector pipeline)
- **CONN-F-02**: Fireflies import connector (via connector pipeline)
- **CONN-F-03**: tl;dv import connector
- **CONN-F-04**: Direct MP3/video upload with auto-transcription (Whisper)
- **CONN-F-05**: Generic webhook receiver for custom sources

### Advanced Import Rules

- **IMP-F-01**: AI-suggested routing rules (suggest rules based on call history patterns)
- **IMP-F-02**: Rule conflict detection (warn when two rules would match the same call)
- **IMP-F-03**: Retroactive rule application (apply a rule to existing calls on demand)

### ClawSimply Integration

- **CLAW-F-01**: ClawSimply fork — OpenClaw with simplified OAuth UI and MCP re-enabled
- **CLAW-F-02**: CallVault as first-party plugin inside ClawSimply
- **CLAW-F-03**: ClawSimply one-click install for non-technical users

### Advanced MCP + API

- **MCP-F-01**: Public REST API with OpenAPI spec for developers
- **MCP-F-02**: Workflow automation engine (trigger-based: new call → send email, create task, etc.)
- **MCP-F-03**: Zapier/Make.com integration

### Advanced Analytics

- **ANLYT-F-01**: Workspace-level analytics (call volume, speaker participation, tag frequency)
- **ANLYT-F-02**: Speaker analytics across all calls (all recordings featuring a person)
- **ANLYT-F-03**: Topic trend tracking (how a topic evolves across conversations over time)

---

## Out of Scope (Explicitly Excluded)

| Feature | Reason |
|---------|--------|
| Google Meet integration | Requires Google Workspace, Beta quality, too complex for the value. Removed entirely in v2. |
| Custom AI models / fine-tuning | Users bring their own AI. We are not in the AI model business. |
| ChatGPT Actions / GPTs | MCP is the universal standard. ChatGPT's Apps SDK is MCP natively. One server, all platforms. |
| In-house RAG pipeline | Removed. Users get better AI from Claude/GPT-5/Gemini than we can build. |
| Content Hub / generators | Removed. LLMs do this better. Export for external AI is the replacement. |
| Langfuse observability | Removed with the AI layer. No LLM calls to observe in the app (only bridge chat). |
| Automation rules (AI-powered) | Sentiment triggers and AI action types removed. Simple field-based rules remain. |
| Semantic / vector search | Replaced with keyword search (pg_trgm). Semantic search = user's AI via MCP. |
| ClawSimply | v3+ product. Not in v2.0 scope. |
| Mobile app (iOS/Android) | Web-first. Tauri desktop considered but deferred to v3. |

---

## Traceability

*Updated: 2026-02-23 — roadmap created.*

| Requirement | Phase | Status |
|-------------|-------|--------|
| STRAT-01 | Phase 13 | Pending |
| STRAT-02 | Phase 13 | Pending |
| STRAT-03 | Phase 13 | Pending |
| BILL-01 | Phase 13 | Pending |
| BILL-02 | Phase 13 | Pending |
| BILL-03 | Phase 13 | Pending |
| BILL-04 | Phase 13 | Pending |
| FOUND-01 | Phase 14 | Pending |
| FOUND-02 | Phase 14 | Pending |
| FOUND-03 | Phase 14 | Pending |
| FOUND-04 | Phase 14 | Pending |
| FOUND-05 | Phase 14 | Pending |
| FOUND-06 | Phase 14 | Pending |
| FOUND-07 | Phase 14 | Pending |
| FOUND-08 | Phase 14 | Pending |
| FOUND-09 | Phase 14 | Pending |
| AI-02 | Phase 14 | Pending |
| DATA-01 | Phase 15 | Pending |
| DATA-02 | Phase 15 | Pending |
| DATA-03 | Phase 15 | Pending |
| DATA-04 | Phase 15 | Pending |
| DATA-05 | Phase 15 | Pending |
| WKSP-01 | Phase 16 | Pending |
| WKSP-02 | Phase 16 | Pending |
| WKSP-03 | Phase 16 | Pending |
| WKSP-04 | Phase 16 | Pending |
| WKSP-05 | Phase 16 | Pending |
| WKSP-06 | Phase 16 | Pending |
| WKSP-07 | Phase 16 | Pending |
| WKSP-08 | Phase 16 | Pending |
| WKSP-09 | Phase 16 | Pending |
| WKSP-10 | Phase 16 | Pending |
| WKSP-11 | Phase 16 | Pending |
| WKSP-12 | Phase 16 | Pending |
| WKSP-13 | Phase 16 | Pending |
| IMP-01 | Phase 17 | Pending |
| IMP-02 | Phase 17 | Pending |
| IMP-03 | Phase 17 | Pending |
| IMP-04 | Phase 18 | Pending |
| IMP-05 | Phase 18 | Pending |
| IMP-06 | Phase 18 | Pending |
| IMP-07 | Phase 18 | Pending |
| IMP-08 | Phase 18 | Pending |
| IMP-09 | Phase 18 | Pending |
| IMP-10 | Phase 18 | Pending |
| MCP-01 | Phase 19 | Pending |
| MCP-02 | Phase 19 | Pending |
| MCP-03 | Phase 19 | Pending |
| MCP-04 | Phase 19 | Pending |
| MCP-05 | Phase 19 | Pending |
| MCP-06 | Phase 19 | Pending |
| MCP-07 | Phase 19 | Pending |
| MCP-08 | Phase 20 | Pending |
| MCP-09 | Phase 20 | Pending |
| MCP-10 | Phase 20 | Pending |
| MCP-11 | Phase 20 | Pending |
| AI-01 | Phase 21 | Pending |
| AI-03 | Phase 21 | Pending |
| AI-04 | Phase 21 | Pending |
| AI-05 | Phase 21 | Pending |
| AI-06 | Phase 21 | Pending |
| AI-07 | Phase 21/22 | Pending |
| AI-08 | Phase 21 | Pending |
| EXPRT-01 | Phase 21 | Pending |
| EXPRT-02 | Phase 21 | Pending |
| EXPRT-03 | Phase 21 | Pending |
| EXPRT-04 | Phase 21 | Pending |
| SHARE-01 | Phase 21 | Pending |
| SHARE-02 | Phase 21 | Pending |
| SHARE-03 | Phase 21 | Pending |
| SHARE-04 | Phase 21 | Pending |

**Coverage:**
- v2.0 requirements: 70 total
- Mapped to phases: 70 ✓
- Unmapped: 0 ✓

*Note: Phase numbering continues from v1 (last phase was 12). v2.0 starts at Phase 13.*

---
*Requirements defined: 2026-02-22*
*Last updated: 2026-02-22 — initial v2.0 milestone definition*
