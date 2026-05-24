# CallVault — Product Overview

> A private, organization-segmented transcript vault that turns recordings your team already captures (Fathom, Zoom, Fireflies, Plaud, YouTube, file uploads, or future connectors) into a searchable, MCP-ready corpus — without re-recording, re-transcribing, or moving your data to a competing platform.

**App URL:** https://app.callvaultai.com
**Stack:** React 18 + TypeScript + Vite + Supabase (Postgres + Edge Functions) + TanStack Query + Zustand + Polar billing + OpenRouter (Vercel AI SDK) + Langfuse tracing.

---

## 1. The One-Paragraph Pitch

Most teams already record their calls — they just can't find anything in them later. CallVault connects to recording sources, ingests transcripts and metadata, and stores them inside a strictly multi-tenant, org-isolated vault. Every organization gets its own automatically-provisioned MCP (Model Context Protocol) server so Claude, Cursor, ChatGPT, or any MCP-compatible agent can search, organize, and reason across that org's calls — and only that org's calls. Inside the app, users get a 4-pane Loop-style workspace with full-text search, drag-to-folder organization, deterministic routing rules, contact pages tying calls to who was on them, share links for outsiders, analytics dashboards, and controlled AI actions for titles/tags/summaries.

---

## 2. The Real Differentiator

Three differentiators stack to make CallVault unique in the call-intelligence category.

### 2.1 Multi-Tenant Org Isolation (GoHighLevel-Style Subaccounts)

Most call-intelligence tools (Gong, Fathom, Otter, Fireflies) are single-tenant — one workspace, one team, one bucket of recordings. CallVault is built like GHL: **one user can belong to many fully-isolated organizations**, each with its own data, members, billing, MCP server, and integrations. Only the user identity and connected source accounts are shared across orgs — recordings, folders, tags, contacts, and routing rules never leak across org boundaries.

This makes CallVault uniquely suited to:
- **Agencies** managing call libraries for multiple clients
- **Fractional ops leaders / consultants** with portfolios of customers
- **Holding companies** with sibling brands or business units
- **Coaches** running separate vaults per coaching cohort

### 2.2 Auto-Provisioned MCP Server Per Org

Every organization on PRO+ gets its own MCP server URL with OAuth-secured access and 36 exposed tools (17 read + 19 write). This is not a third-party integration — it's a first-class part of the product. The MCP server is created automatically when the org is created and is scoped exclusively to that org's data. Users connect their own AI assistant (Claude Desktop, Cursor, ChatGPT, custom agents) directly to their vault on day one.

### 2.3 You Bring the Transcripts; We Make Them Searchable

CallVault does not compete with recording tools — it composes on top of them. You keep using your meeting recorder. CallVault pulls the transcripts in, normalizes them, indexes them, and gives you a unified intelligence layer across all sources. (File uploads are the only path that actually transcribes audio, via OpenAI Whisper.)

---

## 3. Data Sources & Sync Mechanics

CallVault has six current ingestion paths. All six feed into a unified `recordings` table normalized through shared connector contracts so downstream features (search, AI, MCP) work consistently regardless of source.

### 3.1 Fathom

- **Auth:** OAuth 2.0 via `fathom-oauth-url` → `fathom-oauth-callback` → token persisted in `import_sources` table
- **Token refresh:** Background `fathom-oauth-refresh` Supabase function
- **Initial sync:** `fetch-meetings` pulls historical Fathom calls; `fetch-single-meeting` for one-offs
- **Live sync:** Fathom webhook → `webhook` edge function (HMAC-SHA256 signature verification per Fathom docs, supports both `x-signature` and `webhook-signature` headers)
- **Multi-account:** A user can connect multiple Fathom accounts to one org (migration `20260403180000_multi_fathom_account_support.sql`)
- **Data captured:** transcript, summary, action items, speakers, attendees, host email, recording URL, duration, meeting metadata

### 3.2 Zoom

- **Auth:** OAuth 2.0 via `zoom-oauth-url` → `zoom-oauth-callback` → `zoom-oauth-refresh`
- **Initial sync:** `zoom-fetch-meetings` + `zoom-sync-meetings`
- **Live sync:** Zoom webhook → `zoom-webhook` (HMAC-SHA256 hex-encoded — Zoom uses hex, not base64; includes URL verification challenge handler)
- **Transcript parsing:** Zoom delivers WebVTT, parsed via shared `vtt-parser` and consolidated by speaker
- **Deduplication:** Cross-source dedup engine (`dedup-fingerprint`) prevents the same meeting from appearing twice if it was captured by both Fathom and Zoom — supports modes: `first_synced`, `most_recent`, `platform_hierarchy`, `longest_transcript`

### 3.3 Fireflies

- **Auth:** API key via `fireflies-save-source`; optional webhook signing secret
- **Initial sync:** `fireflies-fetch-meetings` + `fireflies-sync-meetings`
- **Live sync:** Fireflies webhook → `fireflies-webhook`
- **Data captured:** transcript, title, participants, meeting timestamps, source URLs, and source metadata

### 3.4 Plaud

- **Auth:** Plaud Web/OpenPlaud-style browser token via `plaud-connect-token`; token persisted encrypted in `import_sources`
- **Initial sync:** `plaud-sync-recordings`
- **Use case:** Importing Plaud recorder transcripts into the same normalized call library

### 3.5 YouTube

- **Path:** `youtube-import` edge function pulls a video by URL, retrieves the transcript via `youtube-api`, and creates a recording
- **Use case:** Importing public talks, podcast appearances, webinars, or competitor analysis
- **MCP exposed:** `import_youtube_video` tool — agents can ingest a YouTube video on the user's behalf

### 3.6 File Upload (the only path that transcribes)

- **Endpoint:** `file-upload-transcribe`
- **Engine:** OpenAI Whisper API
- **Limits:** 25 MB per file (Whisper API ceiling)
- **Accepted formats:** `audio/mpeg`, `audio/wav`, `audio/x-wav`, `audio/mp4`, `audio/x-m4a`, `video/mp4`, `video/quicktime`, `video/webm`
- **Use case:** Backfilling old recordings, in-person meetings captured on a phone, recordings from tools without an integration

### 3.7 Connector Pipeline (Shared Infrastructure)

All sources flow through shared connector normalization and ingestion paths. The pipeline:
1. Normalizes the recording into a common schema
2. Persists raw source data in source-specific tables (per the "Integration Provider Pattern")
3. Inserts into the unified `recordings` table
4. Triggers downstream automation: routing rules, auto-titling, and (where the source provides them) summary/action-item passthrough

---

## 4. Organization & Workspace Model

### 4.1 Organizations

- An **org** is a fully isolated tenant — its own recordings, members, MCP server, billing, integrations, contacts, folders, tags, and routing rules
- A user can belong to **many orgs** simultaneously
- Org switching is instant; UI fades opacity during context swap (utility CSS transition, not a full UI animation)
- Owners can invite other users by email or via permanent shareable invite links
- Pin state, filters, and selected items are reset on org switch (force-unpin enforced on context change)

### 4.2 Workspaces (Inside an Org)

- A workspace is a sub-container inside an org for grouping related calls (e.g., "Sales", "Onboarding", "Coaching Cohort A")
- Workspaces have entries (`workspace_entries`) — recordings can live in multiple workspaces simultaneously (additive, not exclusive)
- Each workspace has its own folder hierarchy and notes

### 4.3 Four Workspace Roles

| Role | Capabilities |
|------|--------------|
| **Owner** | Full control. Created the org, owns billing, can transfer or delete |
| **Admin** | Owner-equivalent. Added by Owner. Manage members, integrations, settings |
| **Contributor** | Add and route calls. Calls they contribute are permanently copied to the Owner's vault |
| **Member** | Read + organize (folders, tags, notes). Removable; on removal, retention decision is required for any calls they brought in |

### 4.4 Cross-Org Operations

- **Copy calls to another org:** `copy_calls_to_organization` — original stays in place; copy lands in the target org
- **Cross-org routing rules:** A rule in Org A can route a matching call into Org B (with optional `delete_after_copy`)

---

## 5. Core In-App Features

### 5.1 Navigation (Sidebar)

| Section | Purpose |
|---------|---------|
| **Calls** | The main library. 4-pane layout: list → workspace → detail |
| **People** | Contacts who appeared on calls. Drill into call history per person |
| **Organization** | Org-level view: members, settings, plan |
| **Import** | Connect/disconnect Fathom, Zoom, YouTube; upload files |
| **Rules** | Routing rules engine — automatically place incoming calls into folders/workspaces |
| **Settings** | Account, Admin, Billing, Contacts, Integrations, MCP, Organizations, Users, Workspaces |

### 5.2 Library / Calls Page (TranscriptsNew.tsx)

- 4-pane Microsoft-Loop-style layout
- Pane 1: sidebar nav (220px / 72px collapsed)
- Pane 2: secondary list with filters and search (280px)
- Pane 3: main workspace area (flex)
- Pane 4: detail/preview pane (360 / 320px) — slides in and shrinks Pane 3 (no overlay drawer)
- All panes operate on the same plane/z-index — never covers other content

### 5.3 Filters (FilterBar)

- Tags (org + personal)
- Folders (workspace + personal)
- Contacts (search by name/email)
- Duration (min/max)
- Source (Fathom / Zoom / YouTube / Upload)
- All filters URL-persisted via `filtersToURLParams()` / `urlParamsToFilters()`
- Inline search syntax (FILTER-05)

### 5.4 Folders

- Two namespaces: workspace folders (shared) and personal folders (user-only)
- Drag-to-folder from the call list
- `folder_assignments` with unique constraint (a recording can only be in one position per folder)

### 5.5 Tags

- Two namespaces: org-level tags and personal tags
- Manual tagging via dialog
- Auto-tagging UI exists in the bulk action toolbar but is **not verified working** (see §6.2)
- Tag-based filtering, MCP-queryable

### 5.6 Contacts / People

- Auto-extracted from call attendees and speakers
- Per-contact view with full call history
- Dedicated `PeoplePage.tsx`
- Folder structure for contacts (`contact-folders.service.ts`)

### 5.7 Routing Rules (RoutingRulesPage)

- Engine in `_shared/routing-engine.ts`
- Triggers on every new ingested call AND can be bulk-applied to existing recordings via `apply-routing-rules`
- Rules are independent — one call can match many rules and land in many destinations
- Match criteria: title keywords/patterns, attendee emails/domains/names, attendee count thresholds
- Actions: place in workspace, place in folder, copy to another org

### 5.8 Sharing

- **Share links** — `create_share_link` (optional email restriction); `revoke_share_link` to kill access
- **Access logs** — every view of a shared link is logged
- **Public viewer** — `SharedCallView.tsx` page (unauthenticated, token-gated)
- **Shared with me inbox** — `list_shared_calls`

### 5.9 Notes

- Per-recording, per-workspace notes
- MCP-queryable via `get_call_notes`

### 5.10 Splitting Recordings

- `split-recording` edge function splits a transcript at a chosen segment boundary into two separate recordings
- Atomic via `split_recording_atomic` Postgres RPC
- Use case: a single Zoom call covered two distinct topics; split it so each is searchable independently

### 5.11 Smart Export

- `SmartExportDialog.tsx` — bulk export of selected calls

### 5.12 Onboarding

- `SetupWizard.tsx` — full-page wizard for first-time users
- `OnboardingModal.tsx` and `HowItWorksModal.tsx` — in-app tour and explanation
- E2E onboarding tested via Playwright

---

## 6. AI Capabilities — Intentionally Minimal

CallVault is **AI-light by design**. The product strategy is "AI-ready, not AI-powered" — rather than bolt a chatbot onto recordings, CallVault exposes a clean, scoped, MCP-accessible vault and lets the user's own AI assistant (Claude, ChatGPT, Cursor) do the reasoning.

The customer-facing AI launch scope inside the app is intentionally narrow: **smart titling, auto-tagging, summaries, content generation, and usage metering**.

### 6.1 Auto-Titling

- `generate-ai-titles` edge function (OpenRouter via Vercel AI SDK)
- Solves the "useless default title" problem that every Fathom and Zoom user knows: meetings come in named "Impromptu Zoom Meeting", "Zoom Meeting #4321", "Fathom Meeting", or whoever-the-host-was-meeting-with-someone — completely unsearchable, completely uninformative
- Reads the transcript and replaces the vendor-default title with a descriptive, content-derived title so the call is actually findable later
- Triggered manually from the bulk action toolbar — select a batch of calls with garbage titles, click auto-title, done
- This is the primary AI feature actively positioned in the product today

### 6.2 Auto-Tagging

- `auto-tag-calls` is wired to the bulk action toolbar — assigns one tag from a curated 16-tag list (TEAM, COACH 1:1, COACH 2+, WEBINAR 2+, SALES 1:1, EXTERNAL, DISCOVERY, ONBOARDING, REFUND, FREE, EDUCATION, PRODUCT, SUPPORT, REVIEW, STRATEGY) with confidence + reasoning, customizable via `TagPreference` rules
- Status: verified with a 5-call production dry run; no customer tag rows were mutated during verification.

### 6.3 AI Usage Tracking

- `track-ai-usage` + `useAiGate` gates `auto_name` / `auto_tag` / `smart_import` actions; `BillingTab.tsx` displays remaining-quota UI
- Status: verified with a temporary Free-tier test account: the 25th monthly action was metered and the next action returned a 429 block.

---

## 7. The MCP Server Layer

Every PRO+ org gets its own auto-provisioned MCP server. Exposed via JSON-RPC 2.0 over HTTP at the `mcp-server` edge function. Authentication is a Bearer token from the `mcp_tokens` table, scoped to either a single workspace or an entire org. OAuth flows for connecting external clients are handled by `mcp-oauth-metadata` and `mcp-oauth-register`.

### 7.1 Read Tools (17)

| Tool | Purpose |
|------|---------|
| `tools/list` | Enumerate available tools |
| `search_calls` | Keyword search across titles, transcripts, summaries, tags, participants |
| `get_transcript` | Full transcript text for a recording |
| `list_calls` | Paginated call list with filters |
| `get_recording_context` | Metadata + AI summary + speakers + tags |
| `list_workspaces` | Workspaces visible to this token |
| `list_contacts` | Contacts with optional search by name/email |
| `get_contact` | Contact details + call history |
| `get_contact_calls` | All calls a specific contact appeared on |
| `list_folders` | Folders in the org/workspace |
| `get_folder_calls` | Calls in a specific folder |
| `list_tags` | All tags (personal + org-level) |
| `get_tagged_calls` | Calls with a specific tag |
| `list_speakers` | Known speakers across calls |
| `get_speaker_calls` | All calls a speaker appeared on |
| `get_action_items` | AI-extracted action items |
| `get_call_notes` | Notes on a recording |
| `list_shared_calls` | Calls shared with the user |

### 7.2 Write Tools (19)

| Tool | Purpose |
|------|---------|
| `rename_call` | Update a recording's title |
| `move_calls_to_workspace` | Move recordings between workspaces in same org |
| `delete_call` | Permanently delete |
| `copy_calls_to_organization` | Copy recordings to another org |
| `create_folder` | Create personal folder |
| `rename_folder` | Rename folder |
| `delete_folder` | Delete folder (recordings preserved) |
| `add_call_to_folder` | Add recording to folder |
| `remove_call_from_folder` | Remove from folder (recording preserved) |
| `create_tag` | Create personal tag |
| `rename_tag` | Rename tag |
| `delete_tag` | Delete tag (removes from all recordings) |
| `tag_call` | Apply tag |
| `untag_call` | Remove tag |
| `create_share_link` | Create share link, optional email restriction |
| `revoke_share_link` | Revoke share link |
| `import_youtube_video` | Import YouTube video |
| `create_organization` | Create new org (token holder becomes owner) |
| `create_workspace` | Create workspace in current org |

### 7.3 MCP Token Scoping

- Token has either `org_id` (org-scoped, sees all workspaces) or `workspace_id` (workspace-scoped only)
- Service-role queries enforce ownership through token metadata — the token itself is the access boundary
- Migration `20260415120000_mcp_oauth_org_bindings.sql` binds OAuth registrations to specific orgs

---

## 8. Analytics

`Analytics.tsx` page with six tabs:

| Tab | What it shows |
|-----|---------------|
| **Overview** | High-level metrics, time range selector |
| **Content** | Topic and theme distribution |
| **Duration** | Call length distributions |
| **Participation** | Attendee patterns, frequency |
| **Tags** | Tag usage and distribution |
| **TalkTime** | Speaker talk-time ratios |

---

## 9. Pricing & Plans

| Plan | Price | Limits | MCP / AI |
|------|-------|--------|----------|
| **Free** | $0 | 1 user, 1 workspace, 10 imports/mo | No MCP. 25 AI actions/mo. Smart titling. |
| **Pro** | $29/mo or $278/yr (save $70) | 1 user, unlimited imports, multiple workspaces | Full MCP. 1,000 AI actions/mo. Smart titling + auto-tagging. |
| **Team** | $79/mo or $758/yr (save $190) | 3–10 users, shared workspaces, roles, admin dashboard | Everything in Pro + 5,000 pooled AI actions/mo. |

Billing handled by **Polar** — `polar-checkout`, `polar-customer-state`, `polar-webhook`, `polar-cancel`, `polar-create-customer`. Plan-tier enforcement on imports, AI actions, and MCP access.

---

## 10. Use Cases

### 10.1 The Solo Sales Operator
Connects Fathom and Zoom. Uses CallVault to search across every demo, discovery, and follow-up call. Connects Claude Desktop via MCP and asks "what objections did I get on pricing this month?" — gets cited answers with timestamps.

### 10.2 The Sales Team Lead
Creates a Team plan with one org and multiple workspaces (one per AE). Sets up routing rules so calls auto-place by host email or attendee domain. Uses Analytics to spot talk-time issues. Shares specific calls with managers via share link.

### 10.3 The Agency Serving Multiple Clients (CallVault's killer wedge)
Creates one org per client. Each client's call data is fully isolated. Each client gets their own MCP server URL — they can connect their own Claude or ChatGPT. The agency operator switches orgs from a single login. Onboarding new clients = "create org, send invite link, done."

### 10.4 The Sales Coach
Imports cohort recordings (Zoom + uploaded files). Manually tags by `COACH (1:1)` vs `COACH (2+)`. Connects Claude or ChatGPT via MCP — the AI surfaces coaching themes across the cohort, drafts per-student feedback, and finds coaching moments by topic. CallVault provides the corpus; the user's AI provides the reasoning.

### 10.5 The Founder / Operator
Imports executive meetings, podcast appearances (via YouTube), and partner calls. Splits multi-topic calls into focused recordings. Builds a personal call corpus the AI can reason over via MCP: "what did I commit to in the last 30 days?" — the connected AI assistant does the extraction, CallVault provides scoped, searchable access.

### 10.6 The Real-Estate / Vertical Operator
Routes high-intent buyer calls to a specific workspace. Auto-tags by `DISCOVERY` vs `SALES (1:1)`. Connects to a domain-specific AI agent via MCP for vertical-specific reasoning (this is what "AI-Ready Broker" — a sibling product — leverages).

---

## 11. Positioning

### 11.1 What CallVault Is NOT

- **Not a call recorder.** Bring your own (Fathom, Zoom).
- **Not a transcription service.** The transcripts come from your existing tools. (File upload is the only exception, via Whisper.)
- **Not single-tenant like Gong.** Multi-org by design.
- **Not "AI-powered" marketing.** Per brand guideline, the framing is **"AI-ready, not AI-powered"** — the value is the prepared, scoped, MCP-accessible data layer that *enables* AI, not a chatbot bolted onto recordings.

### 11.2 What CallVault Replaces

- Custom Notion + Drive folders of meeting transcripts
- Single-team call-intelligence tools that don't fit an agency model
- Manual copy-paste of transcripts into Claude/ChatGPT
- Internal "we'll build it ourselves" RAG over recordings

---

## 12. Out of Scope (Not Built, Not Promised)

From `.planning/PROJECT.md`:

- Real-time collaboration features
- Native mobile app
- Cross-org admin view
- Importing from other users as a source
- Ownership transfer between users
- MCP marketplace / third-party tool catalog
- MCP rate limiting / usage analytics dashboard (basic gating is in scope)

---

## 13. Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, react-router-dom v6 |
| State | Zustand v5, TanStack Query v5 |
| UI | Radix UI (flat imports), Tailwind, motion/react springs (NOT CSS transitions), Remix Icons |
| Backend | Supabase (Postgres + Edge Functions in Deno) |
| Auth | Supabase Auth + custom OAuth flows for Fathom, Zoom, and MCP; Plaud uses browser-token connection |
| AI calls | OpenRouter via Vercel AI SDK, Langfuse for tracing |
| Search | Postgres full-text / keyword search (no semantic / RRF in product surface) |
| Billing | Polar (Stripe-equivalent for SaaS) |
| Transcription (uploads only) | OpenAI Whisper API |
| Tests | Playwright E2E (port 3001) |
| Hosting | Vercel (frontend), Supabase (backend) |

---

## 14. Current Active Tracking

- **Product truth:** this document, `README.md`, root `CLAUDE.md`, and `.github/copilot-instructions.md`.
- **Connector truth:** `docs/source-connector-spec.md`, `docs/source-connector-gap-analysis.md`, `docs/vendor-matrix.md`, `docs/integrations/`, and `.planning/isa/connector-unification.md`.
- **Code truth:** `src/components/connectors/registry/connectorRegistry.ts` lists the current app-visible connectors.
- **Historical plans:** old feature registries, chat/RAG docs, pricing drafts, and completed implementation plans live under `docs/archive/` and should not drive new work.

---

## 15. The "AI-Ready" Framing

The brand position is intentional: **AI-ready, not AI-powered.**

CallVault's job is to be the well-organized, well-scoped, permission-aware data layer that makes any AI assistant useful for call intelligence. The MCP server is the explicit acknowledgment that the user's AI of choice — Claude, ChatGPT, Cursor, custom agents — is the cockpit, and CallVault is the curated dataset they fly with.

This positioning matters for category placement:
- Gong, Fathom, Otter sell **AI features inside a closed UI**.
- CallVault sells **a clean, isolated, queryable corpus** that any AI can plug into.

The user owns their data, their search, their reasoning, and their tools — CallVault just makes sure all the calls are in the right vault, scoped to the right org, ready when the AI needs them.
