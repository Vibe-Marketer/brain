# Roadmap: Callvault (brain)

## Milestones

- ✅ **v1.0 Foundation** - Pre-GSD (shipped before planning init)
- ✅ **v1.1 Sort/Filter Hardening** - Phases 1-10 (absorbed into v2.0)
- ✅ **v2.0 Launch Readiness** - Phases 11-18 (shipped 2026-03-30)
- 🚧 **v2.1 MCP Production Infrastructure** - Phases 19-23 (in progress)

## Phases

<details>
<summary>✅ v1.0 Foundation - SHIPPED (pre-GSD, no phase plans)</summary>

Transcript library, filter bar, sorting, global search, URL persistence, folder/tag management, and Playwright infrastructure all shipped. Known issues carried forward into v1.1.

</details>

<details>
<summary>✅ v1.1 Sort/Filter Hardening - ABSORBED INTO v2.0</summary>

Phases 1-10 defined for filter/sort hardening. Milestone absorbed into v2.0 Launch Readiness — all filter/sort requirements carried forward as FILTER-01 through FILTER-05 in v2.0.

Phases 7-10 were stub phases (Drag-to-Folder, YouTube Workspace UI, Global Search/Notifications, Raw Call Details) — never planned, absorbed into v2.0 scope as needed.

</details>

<details>
<summary>✅ v2.0 Launch Readiness - SHIPPED (2026-03-30)</summary>

8 phases (11-18), 21 plans, 53 requirements. Org segregation, 4-pane layout, import flows, drag-to-folder, global search, onboarding E2E, members & roles, filters & sort, payments & billing, MCPs. See `milestones/v2.0-ROADMAP.md` for full details.

**Known tech debt:** 2 partial requirements (PAY-05 AI gate incomplete, MCP-04 operational config), 13 deferred human verification items.

</details>

---

### 🚧 v2.1 MCP Production Infrastructure (In Progress)

**Milestone Goal:** Production-grade MCP servers that auto-provision per org, expose full CRUD + AI tools, and are gated to PRO plan or higher — ready for customers to connect on day one.

**Architecture constraint:** Zero embedding pipeline. All AI tools pass transcript text directly to LLM context window via Vercel AI SDK + OpenRouter.

- [x] **Phase 19: Provisioning Foundation** - Auto-provisioning, plan gating, and token regeneration (completed 2026-04-10)
- [ ] **Phase 20: Read CRUD Tools** - Search, list, and retrieval tools with org isolation
- [ ] **Phase 21: Write CRUD Tools** - Note, tag, and folder organization tools
- [ ] **Phase 22: AI Tools** - LLM-powered per-call analysis tools with DB caching
- [ ] **Phase 23: Management UI** - Settings UI for connection details, token control, and capability toggles
- [ ] **Phase 24: Fathom Share-Link Save** - Paste-driven save of any Fathom share-link transcript into the user's workspace (zero server-side fetch from fathom.video)

## Phase Details

### Phase 19: Provisioning Foundation
**Goal**: MCP servers auto-provision for PRO+ orgs with plan gating enforced on every call and users can regenerate tokens
**Depends on**: Phase 18 (MCP server + OAuth baseline from v2.0)
**Requirements**: PROV-01, PROV-02, PROV-03
**Success Criteria** (what must be TRUE):
  1. When a new org is created on PRO+ plan, an MCP server record is automatically created with no manual action
  2. Invoking any MCP tool with a free-tier org token returns a clear plan-gating error, not silent failure
  3. A user in settings can click "Regenerate token" and their old MCP token immediately stops working while a new one is issued
  4. MCP tool invocations on a downgraded org (PRO → free) are rejected server-side within one request
**Plans:** 3/3 plans complete

Plans:
- [x] 19-01-PLAN.md — DB migration: auto-provision trigger, regenerate RPC, upgrade-path provisioning in Polar webhook
- [x] 19-02-PLAN.md — Server-side plan gating in mcp-server edge function
- [x] 19-03-PLAN.md — Frontend token regeneration flow (service, hook, MCPTab UI)

### Phase 20: Read CRUD Tools
**Goal**: Users' MCP clients can search transcripts, list and filter calls, and retrieve full call details and transcript text
**Depends on**: Phase 19
**Requirements**: TOOL-01, TOOL-02, TOOL-03, TOOL-04
**Success Criteria** (what must be TRUE):
  1. An MCP client calling search_transcripts returns only calls from the authenticated org, never another org's data
  2. An MCP client calling list_calls with date, folder, tag, contact, source, or duration filters receives correctly filtered paginated results
  3. An MCP client calling get_call receives metadata and cached summary (if one exists) in a single response
  4. An MCP client calling get_transcript receives full transcript text with speaker labels and timestamps
**Plans**: TBD

### Phase 21: Write CRUD Tools
**Goal**: Users' MCP clients can organize calls by adding notes, tags, and moving calls to folders
**Depends on**: Phase 20
**Requirements**: TOOL-05, TOOL-06, TOOL-07
**Success Criteria** (what must be TRUE):
  1. An MCP client calling create_note on a call ID results in a note that appears in the CallVault UI on that call
  2. An MCP client calling add_tag on a call ID applies the tag, visible in the transcript library table
  3. An MCP client calling move_to_folder on a call ID moves the call, visible immediately in the folder hierarchy
  4. Write tools reject requests where the call ID belongs to a different org than the authenticated token
**Plans**: TBD

### Phase 22: AI Tools
**Goal**: Users' MCP clients can invoke LLM-powered analysis on any call, with results cached so repeat calls are instant
**Depends on**: Phase 20
**Requirements**: AITL-01, AITL-02, AITL-03, AITL-04, AITL-05
**Success Criteria** (what must be TRUE):
  1. An MCP client calling summarize_call receives a summary; calling it again for the same call returns the cached result without a new LLM call
  2. An MCP client calling extract_action_items returns structured output with owner, action, and any mentioned due date
  3. An MCP client calling ask_call with a natural language question returns a grounded answer drawn from that call's transcript only
  4. An MCP client calling get_sentiment receives tone analysis, talk ratio, and key moments for the call
  5. An MCP client calling get_coaching_notes receives sales coaching insights specific to that call's content
**Plans**: TBD
**UI hint**: no

### Phase 23: Management UI
**Goal**: Users can see their MCP connection details, regenerate tokens, and control which tools are enabled — all enforced server-side
**Depends on**: Phase 19, Phase 22
**Requirements**: MGMT-01, MGMT-02, MGMT-03
**Success Criteria** (what must be TRUE):
  1. Settings > Integrations shows the MCP server URL and a masked token with a working copy button
  2. Settings UI shows a toggle per MCP tool; toggling a tool off immediately prevents that tool from returning results
  3. A disabled tool returns a clear error message to the MCP client explaining the tool is disabled — not a generic 500
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 19. Provisioning Foundation | v2.1 | 3/3 | Complete    | 2026-04-10 |
| 20. Read CRUD Tools | v2.1 | 0/TBD | Not started | - |
| 21. Write CRUD Tools | v2.1 | 0/TBD | Not started | - |
| 22. AI Tools | v2.1 | 0/TBD | Not started | - |
| 23. Management UI | v2.1 | 0/TBD | Not started | - |

---

*Roadmap created: 2026-03-15 — v1.1 Sort/Filter Hardening*
*Updated: 2026-04-10 — v2.1 MCP Production Infrastructure phases added*
*Updated: 2026-04-10 — Phase 19 planned (3 plans, 2 waves)*
