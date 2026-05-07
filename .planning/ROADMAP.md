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
- [ ] **Phase 21: Write CRUD Tools** - Note, tag, and folder organization tools (16/17 shipped 2026-04-15; `create_note` remaining — context backfilled 2026-05-07)
- [ ] **Phase 22: AI Tools** - LLM-powered per-call analysis tools with DB caching (0.5/4 shipped — `get_action_items` read tool live; 4 LLM tools designed; context backfilled 2026-05-07)
- [ ] **Phase 23: Management UI** - Settings UI for connection details, token control, and capability toggles
- [x] **Phase 24: Fathom Share-Link Save** - Paste-driven save of any Fathom share-link transcript into the user's workspace (zero server-side fetch from fathom.video) — ✅ SHIPPED 2026-05-07, verified end-to-end on prod
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

### Phase 21: Write CRUD Tools
**Status**: 🟡 16/17 shipped · GSD context backfilled 2026-05-07 · 1 plan remaining (`create_note`) — see `.planning/phases/21-write-crud-tools/`
**Goal**: Users' MCP clients can organize calls by adding notes, tags, and moving calls to folders
**Depends on**: Phase 20
**Requirements**: TOOL-05 ⏳, TOOL-06 ✅, TOOL-07 ✅
**Success Criteria** (what must be TRUE):
  1. ⏳ An MCP client calling `create_note` on a call ID stores the note in a new `call_notes` table and `get_call_notes` returns it on the next read (NOT YET BUILT — see 21-CONTEXT.md D-06..D-14)
  2. ✅ An MCP client calling `tag_call` applies the tag, visible in the transcript library table (`mcp-server/index.ts:508`; also `untag_call` at :520)
  3. ✅ An MCP client calling `add_call_to_folder` moves the call, visible immediately in the folder hierarchy (`mcp-server/index.ts:447`; also `remove_call_from_folder` at :459)
  4. ✅ Write tools reject requests where the call ID belongs to a different org than the authenticated token (`mcpToken.scope` branch + `fetchOrgWorkspaceIds` boundary check on every write tool)
**Plans remaining**: 1 plan — `21-01-PLAN.md` for `create_note` MCP write tool + new `call_notes` table migration + `get_call_notes` read-tool update. Estimated ~3-4 hrs. **Storage decision (locked):** new `call_notes` table (not append-on-string) — see 21-CONTEXT.md for full rationale and trade-off analysis.
**Bonus shipped beyond spec (16 tools)**: `rename_call`, `move_calls_to_workspace`, `delete_call`, `copy_calls_to_organization`, `create_folder`, `rename_folder`, `delete_folder`, `create_tag`, `rename_tag`, `delete_tag`, `create_share_link`, `create_organization`, `create_workspace`, plus inverse pairs `untag_call` and `remove_call_from_folder` (all in `supabase/functions/mcp-server/index.ts`). See `21-SHIPPED-INVENTORY.md` for the full inventory.

### Phase 22: AI Tools
**Status**: 🟡 0.5/4 shipped · GSD context backfilled 2026-05-07 · 4 plans pending — see `.planning/phases/22-ai-tools/`
**Goal**: Users' MCP clients can invoke LLM-powered analysis on any call, with results cached so repeat calls are instant
**Depends on**: Phase 20
**Requirements**: ~~AITL-01~~ (DROPPED), AITL-02 🟡, AITL-03 ⏳, AITL-04 ⏳, AITL-05 ⏳

**Scope change (2026-05-07):** AITL-01 (`summarize_call` as MCP tool) **dropped**. Reasoning: `summarize-call` already exists as an in-app button on the recording detail page — that's where AI summary value lives in CallVault's own UI. Exposing it again via MCP duplicates capability that the MCP client (Claude Desktop, ChatGPT, Cursor) already has — they can call `get_transcript` and summarize themselves. The other 4 AITL tools are net-new capabilities worth shipping (action-item LLM extraction works for non-Fathom sources, sentiment/coaching are domain-specific prompts, ask_call has caching value for team usage).

**Success Criteria** (what must be TRUE):
  1. 🟡 An MCP client calling `extract_action_items` returns structured output (owner, action, due date). **Read tool exists** as `get_action_items` (`mcp-server/index.ts:328`) reading cached items from Fathom webhook. **Missing: LLM extraction edge function + MCP tool** so it works for paste-source / Zoom / non-Fathom recordings (~half-day; `auto-tag-calls` pattern is the closest analog).
  2. ⏳ An MCP client calling `ask_call` with a natural language question returns a grounded answer (~half-day, single-call RAG-less LLM call, NO cache because every question is unique)
  3. ⏳ An MCP client calling `get_sentiment` receives tone analysis, talk ratio, and key moments (~half-day)
  4. ⏳ An MCP client calling `get_coaching_notes` receives sales coaching insights (~half-day)
**Plans remaining**: 4 plans — see `22-CONTEXT.md` D-12..D-15 for the locked tool inventory. Plan 22-01 = migration (`action_items_cache`, `coaching_cache` columns + 4 new entries in `track-ai-usage` `VALID_ACTION_TYPES`). Plans 22-02..22-04 implement each LLM tool, parallelizable after 22-01 lands. Total estimate: ~2-3 dev-days. Stack locked: Vercel AI SDK + OpenRouter, default model `openai/gpt-5-nano`, per-tool override allowed if researcher recommends (e.g., coaching may need stronger model).
**UI hint**: no
**Cost gating required**: every AI tool MUST call `track-ai-usage` with its specific action type (`mcp_action_items`, `mcp_ask_call`, `mcp_sentiment`, `mcp_coaching`) BEFORE invoking OpenRouter. Cached returns skip the gate (quota is for LLM calls, not cache reads). On `429` from `track-ai-usage`, return MCP `-32001` with upgrade guidance. Locked in `22-CONTEXT.md` D-09..D-11.

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

### Phase 24: Fathom Share-Link Save — ✅ SHIPPED (verified 2026-05-07)
**Status**: Live in production, verified end-to-end via dev-browser. See `.planning/phases/24-fathom-share-link-save/24-01-SUMMARY.md`.
**Goal**: A user can paste any Fathom share URL plus the transcript they copied via Fathom's "Copy transcript" button into a CallVault modal and have it saved as a permanent, searchable recording in their workspace — with zero outbound HTTP requests from CallVault servers to fathom.video (legal posture: user-as-actor / UGC).
**Depends on**: None (independent of MCP work — slotted parallel to Phase 21-23)
**Requirements**: PASTE-01 ✅, PASTE-02 ✅, PASTE-03 ✅, PASTE-04 ✅
**Success Criteria** (all TRUE):
  1. ✅ User opens "Save Transcript" modal, pastes Fathom share URL + transcript, recording appears in library within 2 seconds — verified
  2. ✅ Pasted transcript searchable via global search within 5 seconds — verified via FTS query for unique marker
  3. ✅ Re-pasting same share URL updates existing record (no duplicates) — verified, edge function returned `action=updated`
  4. ✅ Recording detail page renders cleanly — "From Fathom share link" source pill present, no broken video player; transcript renders in tabs with all 7 segments + 2 speakers + correct timestamps
  5. ✅ Zero outbound HTTP to fathom.video from any server-side code path — `git diff | grep` confirmed only placeholder/comment occurrences
**Plans**: 1/1 complete
- [x] 24-01-PLAN.md — Migration + parser util + save-pasted-transcript edge fn + PasteTranscriptModal + recording detail rendering (shipped 2026-05-07)

**Production deploy:**
- Migration `20260507120000_recordings_paste_columns.sql` applied to `vltmrnjsubfzrgrtdqey`
- Edge function `save-pasted-transcript` deployed via `supabase functions deploy --use-api`
- Frontend deployed via Vercel auto-deploy on main push

**Bugs caught + fixed during verification (none deferred):**
- `33b3b9da fix(24-01): surface paste-source share_url through meeting adapter` — meeting adapter wasn't passing share_url to detail dialog
- `ce3b9c9e fix(24-01): render full_transcript in bracketed format renderer expects` — renderer regex expected `[HH:MM:SS] Speaker: text`, paste was writing Fathom native format; edge function now formats parsed segments into the bracketed shape

**UI hint**: yes
**Actual effort**: ~1 dev-day from plan to shipped (matches estimate)

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
| 21. Write CRUD Tools | v2.1 | 2/3 reqs done | 🟡 1 plan remaining (TOOL-05 `create_note`) | 16 tools shipped 2026-04-15 / context backfilled 2026-05-07 |
| 22. AI Tools | v2.1 | 0.5/4 fully | 🟡 4 plans pending (designed, ready to plan-phase) | Context backfilled 2026-05-07 |
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
