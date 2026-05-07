# Roadmap: Callvault (brain)

## Milestones

- ✅ **v1.0 Foundation** - Pre-GSD (shipped before planning init)
- ✅ **v1.1 Sort/Filter Hardening** - Phases 1-10 (absorbed into v2.0)
- ✅ **v2.0 Launch Readiness** - Phases 11-18 (shipped 2026-03-30)
- 🚧 **v2.1 MCP Production Infrastructure** - Phases 19-25 (in progress)

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
- [x] **Phase 20: Read CRUD Tools** - Search, list, and retrieval tools with org isolation (shipped 2026-04-15; reconciled + GSD-backfilled 2026-05-07)
- [ ] **Phase 21: Write CRUD Tools** - Note, tag, and folder organization tools
- [ ] **Phase 22: AI Tools** - LLM-powered per-call analysis tools with DB caching
- [ ] **Phase 23: Management UI** - Settings UI for connection details, token control, and capability toggles
- [x] **Phase 24: Fathom Share-Link Save** - Paste-driven save of any Fathom share-link transcript into the user's workspace (zero server-side fetch from fathom.video) — code complete 2026-05-07; deploy + dev-browser test pending
- [ ] **Phase 25: Workspace Type Retirement** - Eliminate the personal/team workspace_type distinction, replace with is_default + member_count derivations, add per-user sort_order with drag-and-drop reorder, drop type selector and auto-folder creation

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
**Status**: ✅ Shipped 2026-04-15 · GSD-backfilled 2026-05-07 (`.planning/phases/20-read-crud-tools/`)
**Goal**: Users' MCP clients can search transcripts, list and filter calls, and retrieve full call details and transcript text
**Depends on**: Phase 19
**Requirements**: TOOL-01 ✅, TOOL-02 ✅, TOOL-03 ✅, TOOL-04 ✅
**Success Criteria** (what must be TRUE):
  1. ✅ An MCP client calling `search_calls` returns only calls from the authenticated org (`mcp-server/index.ts:173`)
  2. ✅ An MCP client calling `list_calls` with date, folder, tag, contact, source, or duration filters receives correctly filtered paginated results (`mcp-server/index.ts:185`)
  3. ✅ An MCP client calling `get_recording_context` receives metadata and cached summary in a single response (`mcp-server/index.ts:208`)
  4. ✅ An MCP client calling `get_transcript` receives full transcript text with speaker labels and timestamps (`mcp-server/index.ts:197`)
**Plans**: Shipped without plan tracking — backfilled retroactively. 17 read tools live in `supabase/functions/mcp-server/index.ts` (4 spec'd + 13 bonus: contacts/folders/tags/speakers/notes/action-items/shared-calls). Tool names differ from spec (e.g. `search_calls` vs spec `search_transcripts`); shipped names are canonical, spec text is stale.
**Reconciliation status**: Functionally complete. See `20-CONTEXT.md` and `20-SUMMARY.md` for the full decision log and shipped-tool inventory.

### Phase 21: Write CRUD Tools — 🟡 2/3 SHIPPED (reconciled 2026-05-07)
**Goal**: Users' MCP clients can organize calls by adding notes, tags, and moving calls to folders
**Depends on**: Phase 20
**Requirements**: TOOL-05 ⏳, TOOL-06 ✅, TOOL-07 ✅
**Success Criteria** (what must be TRUE):
  1. ⏳ An MCP client calling `create_note` on a call ID results in a note that appears in the CallVault UI on that call (NOT YET BUILT — only `get_call_notes` read-tool exists)
  2. ✅ An MCP client calling `tag_call` applies the tag, visible in the transcript library table (`mcp-server/index.ts:508`; also `untag_call` at :520)
  3. ✅ An MCP client calling `add_call_to_folder` moves the call, visible immediately in the folder hierarchy (`mcp-server/index.ts:447`; also `remove_call_from_folder` at :459)
  4. Write tools reject requests where the call ID belongs to a different org than the authenticated token (presumed via existing org-scoping in mcp-server)
**Plans remaining**: 1 plan — TOOL-05 `create_note` write tool. Estimated ~1 hr (analogous to `tag_call` pattern, just writes to call_notes table).
**Bonus shipped beyond spec**: `rename_call`, `move_calls_to_workspace`, `delete_call`, `copy_calls_to_organization`, `create_folder`, `rename_folder`, `delete_folder`, `create_tag`, `rename_tag`, `delete_tag`, `create_share_link`, `create_organization`, `create_workspace` (all in mcp-server/index.ts)

### Phase 22: AI Tools — 🟡 0.5/4 PARTIAL (rescoped 2026-05-07)
**Goal**: Users' MCP clients can invoke LLM-powered analysis on any call, with results cached so repeat calls are instant
**Depends on**: Phase 20
**Requirements**: ~~AITL-01~~ (DROPPED), AITL-02 🟡, AITL-03 ⏳, AITL-04 ⏳, AITL-05 ⏳

**Scope change (2026-05-07):** AITL-01 (`summarize_call` as MCP tool) **dropped**. Reasoning: `summarize-call` already exists as an in-app button on the recording detail page — that's where AI summary value lives in CallVault's own UI. Exposing it again via MCP duplicates capability that the MCP client (Claude Desktop, ChatGPT, Cursor) already has — they can call `get_transcript` and summarize themselves. The other 4 AITL tools are net-new capabilities worth shipping (action-item LLM extraction works for non-Fathom sources, sentiment/coaching are domain-specific prompts, ask_call has caching value for team usage).

**Success Criteria** (what must be TRUE):
  1. 🟡 An MCP client calling `extract_action_items` returns structured output (owner, action, due date). **Read tool exists** as `get_action_items` (`mcp-server/index.ts:328`) reading cached items from Fathom webhook. **Missing: LLM extraction edge function + MCP tool** so it works for paste-source / Zoom / non-Fathom recordings (~half-day; `auto-tag-calls` pattern is the closest analog).
  2. ⏳ An MCP client calling `ask_call` with a natural language question returns a grounded answer (~half-day, single-call RAG-less LLM call, NO cache because every question is unique)
  3. ⏳ An MCP client calling `get_sentiment` receives tone analysis, talk ratio, and key moments (~half-day)
  4. ⏳ An MCP client calling `get_coaching_notes` receives sales coaching insights (~half-day)
**Plans remaining**: ~3-4 plans — one migration adds 3 cache columns + 4 action types in track-ai-usage, then build extract_action_items LLM, ask_call, sentiment, coaching (each follows the proven Vercel AI SDK + OpenRouter + DB-cache pattern from summarize-call).
**UI hint**: no
**Cost gating required**: every AI tool added MUST call `track-ai-usage` with a new VALID_ACTION_TYPE before invoking OpenRouter — else MCP clients can run up the platform's OpenRouter bill ad infinitum.

### Phase 23: Management UI — 🟡 1/3 SHIPPED (reconciled 2026-05-07)
**Goal**: Users can see their MCP connection details, regenerate tokens, and control which tools are enabled — all enforced server-side
**Depends on**: Phase 19, Phase 22
**Requirements**: MGMT-01 ✅, MGMT-02 ⏳, MGMT-03 ⏳
**Success Criteria** (what must be TRUE):
  1. ✅ Settings > Integrations shows the MCP server URL and a masked token with a working copy button (`src/components/settings/MCPTab.tsx`; full create/list/regenerate/delete CRUD)
  2. ⏳ Settings UI shows a toggle per MCP tool; toggling a tool off immediately prevents that tool from returning results (NOT YET BUILT — no capability/toggle wiring in MCPTab.tsx)
  3. ⏳ A disabled tool returns a clear error message to the MCP client (NOT YET BUILT — no capability check in mcp-server/index.ts)
**Plans remaining**: 1-2 plans — schema for per-token tool toggles (`mcp_token_capabilities` join table or JSONB column) + UI toggle list in MCPTab + server-side capability check in mcp-server. Estimated ~half-day.
**UI hint**: yes

### Phase 24: Fathom Share-Link Save
**Goal**: A user can paste any Fathom share URL plus the transcript they copied via Fathom's "Copy transcript" button into a CallVault modal and have it saved as a permanent, searchable recording in their workspace — with zero outbound HTTP requests from CallVault servers to fathom.video (legal posture: user-as-actor / UGC).
**Depends on**: None (independent of MCP work — can be slotted parallel to Phase 21-23)
**Requirements**: PASTE-01, PASTE-02, PASTE-03, PASTE-04
**Success Criteria** (what must be TRUE):
  1. A user opens a "Save Transcript" modal, pastes a Fathom share URL and transcript, clicks save, and the recording appears in their library within 2 seconds
  2. The pasted transcript is searchable via existing global search within 5 seconds of save (FTS index covers it)
  3. Re-pasting the same share URL updates the existing record (no duplicate row in the workspace)
  4. The recording detail page renders a paste-source recording cleanly without a broken-video-player affordance — transcript, metadata, and source-link pill all present
  5. Code review confirms zero outbound HTTP calls to fathom.video from any edge function or server-side code path in this phase's diff
**Plans:** 1 plan

Plans:
- [x] 24-01-PLAN.md — Migration + parser util + save-pasted-transcript edge fn + PasteTranscriptModal + recording detail rendering (completed 2026-05-07)
**UI hint**: yes
**Estimate**: ~1 dev-day end-to-end

### Phase 25: Workspace Type Retirement
**Goal**: Workspaces are just workspaces. The personal/team distinction is gone — protection comes from `is_default`, the icon comes from member count, sidebar order is user-controlled, and creation is one click with no type choice and no auto-generated folders.
**Depends on**: None (independent of MCP work)
**Requirements**: WS-01, WS-02, WS-03, WS-04, WS-05
**Success Criteria** (what must be TRUE):
  1. The "+ New Workspace" dialog has no Workspace Type selector — every workspace is created as a plain workspace
  2. No "Hall of Fame" or "Manager Reviews" folders are auto-created when a workspace is created
  3. The 2nd-pane "Your Workspaces" list is reorderable per-user via drag-and-drop, and the order persists across page reloads and devices
  4. Each org has exactly one workspace flagged `is_default=true`; that workspace cannot be deleted via UI or API
  5. Existing `workspace_type='personal'` data is migrated: the original Home becomes `is_default=true`; any duplicate personals become regular deletable workspaces
  6. No frontend code branches on `workspace_type` for behavior — the column may persist as legacy data only
  7. Lock vs team icon is derived from `member_count` (1 = lock, >1 = team), not from a type flag
**Plans:** TBD

**UI hint**: yes
**Estimate**: ~3-4 dev-hours end-to-end (1 PR)

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 19. Provisioning Foundation | v2.1 | 3/3 | ✅ Complete    | 2026-04-10 |
| 20. Read CRUD Tools | v2.1 | n/a (backfilled) | ✅ Shipped + GSD-backfilled | 2026-04-15 / 2026-05-07 |
| 21. Write CRUD Tools | v2.1 | 2/3 reqs done | 🟡 1 plan remaining (TOOL-05) | - |
| 22. AI Tools | v2.1 | 0/5 fully | 🟡 Infra partial, 4-5 plans remaining | - |
| 23. Management UI | v2.1 | 1/3 reqs done | 🟡 1-2 plans remaining (capabilities) | - |
| 24. Fathom Share-Link Save | v2.1 | 1/1 | ✅ Code complete (deploy + dev-browser test pending) | 2026-05-07 |
| 25. Workspace Type Retirement | v2.1 | 0/TBD | Planned | - |

**v2.1 milestone status (post-reconciliation):**
- 10/22 reqs fully shipped (~45%)
- 2/22 partial
- 10/22 pending
- Estimated remaining work: ~3-4 dev-days (TOOL-05 1hr + AITL ~2.5d + MGMT-02/03 0.5d + Phase 24 1d)

---

*Roadmap created: 2026-03-15 — v1.1 Sort/Filter Hardening*
*Updated: 2026-04-10 — v2.1 MCP Production Infrastructure phases added*
*Updated: 2026-04-10 — Phase 19 planned (3 plans, 2 waves)*
*Updated: 2026-05-07 — v2.1 reconciled against codebase reality; Phase 24 added*
*Updated: 2026-05-07 — Phase 25 (Workspace Type Retirement) added*
