# Requirements: CallVault v2.1 — MCP Production Infrastructure

**Defined:** 2026-04-10
**Core Value:** A new user can sign up, connect their call sources, and be productively using CallVault within minutes — with every piece of data strictly scoped to their organization.

**Architecture constraint: ZERO embedding pipeline.** No RAG, no pgvector, no vector search, no embeddings anywhere. All AI tools work by passing transcript text directly to the LLM context window. Search uses existing full-text SQL queries on transcript/call columns. This is explicit and non-negotiable for v2.1.

## v2.1 Requirements

Requirements for MCP Production Infrastructure. Each maps to roadmap phases.

### Provisioning

- [ ] **PROV-01**: MCP server auto-provisions when a new org is created (PRO+ plan required)
- [ ] **PROV-02**: Plan tier checked server-side on every MCP tool invocation (not just at token creation)
- [ ] **PROV-03**: User can regenerate MCP token (revoke old + issue new) from settings

### CRUD Tools

- [x] **TOOL-01**: MCP exposes search_transcripts tool with full-text search scoped to org *(shipped as `search_calls` in `supabase/functions/mcp-server/index.ts:173`)*
- [x] **TOOL-02**: MCP exposes list_calls tool with filters (date, folder, tag, contact, source, duration) and pagination *(shipped at `mcp-server/index.ts:185`)*
- [x] **TOOL-03**: MCP exposes get_call tool returning metadata + cached summary if available *(shipped as `get_recording_context` at `mcp-server/index.ts:208`)*
- [x] **TOOL-04**: MCP exposes get_transcript tool returning full text with speaker labels and timestamps *(shipped at `mcp-server/index.ts:197`)*
- [x] **TOOL-05**: MCP exposes create_note tool to add a note to a call *(shipped 2026-05-07; new `call_notes` table + `case 'create_note'` in `mcp-server/index.ts`; `get_call_notes` rewired to read from new table)*
- [x] **TOOL-06**: MCP exposes add_tag tool to tag a call *(shipped as `tag_call` at `mcp-server/index.ts:508`; also `untag_call`)*
- [x] **TOOL-07**: MCP exposes move_to_folder tool to organize calls into folders *(shipped as `add_call_to_folder` at `mcp-server/index.ts:447`; also `remove_call_from_folder`)*

### AI Tools

All AI tools pass transcript text directly to the LLM via Vercel AI SDK + OpenRouter. No embeddings, no RAG, no vector search. Results cached in DB after first invocation. **Every tool MUST gate via `track-ai-usage` before invoking OpenRouter** — MCP clients can spam tools and run up the platform's bill otherwise.

- ⛔ ~~**AITL-01**: MCP exposes summarize_call tool~~ — **DROPPED 2026-05-07**. `summarize-call` already exists as in-app button on recording detail page; exposing it via MCP duplicates capability the MCP client (Claude Desktop / ChatGPT / Cursor) already has — they call `get_transcript` and summarize themselves. In-app summarize-call edge function STAYS as a CallVault feature; only the MCP-tool exposure was scoped out.
- [~] **AITL-02**: MCP exposes extract_action_items tool — structured output (owner, action, due date mentioned), cached *(PARTIAL: `get_action_items` MCP read-tool exists at `mcp-server/index.ts:328`; LLM extraction edge function still needed so it works for paste-source / Zoom / non-Fathom recordings)*
- [ ] **AITL-03**: MCP exposes ask_call tool — natural language Q&A against a single call's full transcript via LLM (no cache — every question is unique)
- [ ] **AITL-04**: MCP exposes get_sentiment tool — tone analysis, talk ratio, key moments per call
- [ ] **AITL-05**: MCP exposes get_coaching_notes tool — sales coaching insights per call

### Management UI

- [x] **MGMT-01**: Settings > Integrations shows MCP connection URL and masked token with copy button *(shipped at `src/components/settings/MCPTab.tsx`; supports create/list/regenerate/delete)*
- [ ] **MGMT-02**: Settings UI shows per-tool capability toggles (enable/disable individual MCP tools)
- [ ] **MGMT-03**: Capability toggles enforced server-side — disabled tools return clear error to MCP client

### Bonus MCP Tools (shipped beyond v2.1 spec — 36 tools total)

The mcp-server ships ~30 tools beyond the TOOL-01..07 spec. These are operational reality and should be tracked:

**Safe reads (12):** `list_workspaces`, `list_contacts`, `get_contact`, `get_contact_calls`, `list_folders`, `get_folder_calls`, `list_tags`, `get_tagged_calls`, `list_speakers`, `get_speaker_calls`, `get_call_notes`, `list_shared_calls`

**Safe writes (11):** `rename_call`, `create_folder`, `rename_folder`, `delete_folder`, `remove_call_from_folder`, `create_tag`, `rename_tag`, `delete_tag`, `untag_call`, `create_share_link`, `revoke_share_link`, `import_youtube_video`

**⚠️ Scope-creep / destructive (5 — REVIEW before promoting in docs):** `delete_call`, `move_calls_to_workspace`, `copy_calls_to_organization`, `create_organization`, `create_workspace` — an MCP client can delete recordings and create orgs. Probably should ship behind MGMT-02 capability toggles before being advertised.

These are not formal v2.1 requirements but represent shipped functionality. v2.2 should formalize the surface (which to keep, which to gate, which to deprecate).

### Adjacent AI Infrastructure (shipped, not MCP-exposed)

These edge functions exist and are running, but are internal automation — NOT part of the MCP tool surface:

- `summarize-call` — OpenRouter LLM summary with DB caching (partially satisfies AITL-01; needs MCP exposure)
- `generate-ai-titles` — OpenRouter `generateText` for auto-titling calls
- `auto-tag-calls` — OpenRouter `generateObject` for auto-tagging calls (adjacent to TOOL-06 `tag_call`)

### Known Bugs Surfaced During Reconciliation

- **MCPTab tool-list staleness**: `src/components/settings/MCPTab.tsx` L633-638 hard-codes a static list of 5 tools but the server exposes 36. UX bug. Logical fix: pull tool catalog from mcp-server at runtime, OR generate a static list from a single source. Track as quick task.
- **`generate-meta-summary` is an empty directory** — `supabase/functions/generate-meta-summary/` exists but has no `index.ts`. Either build it or remove the directory.

### Share-Link Save (Phase 24) — ✅ SHIPPED (verified 2026-05-07)

User-paste flow to save Fathom share-link content into the workspace as a permanent recording. Zero server-side fetch from fathom.video — user-as-actor / UGC model preserves ToS posture.

- [x] **PASTE-01**: User can paste a Fathom share URL + transcript via a modal and save it as a recording in their workspace *(shipped: `src/components/import/PasteTranscriptModal.tsx` + `supabase/functions/save-pasted-transcript/index.ts`; verified end-to-end on prod)*
- [x] **PASTE-02**: Pasted transcripts auto-parse into structured segments (speaker, timestamp, text) when in Fathom's standard copy-format; raw fallback if unrecognized *(shipped: `supabase/functions/_shared/fathom-transcript-parser.ts`; live preview shows "N turns · M speakers detected")*
- [x] **PASTE-03**: Re-pasting same share URL updates the existing record (no duplicates, dedup via `(organization_id, share_token)` unique index) *(shipped: migration `20260507120000_recordings_paste_columns.sql` adds `idx_recordings_org_share_token`; verified — re-paste returns `action=updated` with same recording_id)*
- [x] **PASTE-04**: Recording detail page renders paste-source recordings cleanly without a broken video player affordance *(shipped: source pill "From Fathom share link" + no video player block when `source_app === 'fathom-paste'`; transcript tab renders structured segments via bracketed-format conversion in edge function)*

## v2.2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Cross-Call Intelligence

- **XCALL-01**: query_calls tool — natural language queries across multiple transcripts in an org
- **XCALL-02**: Usage metering dashboard — per-org AI tool usage tracking and rate limits

### Global MCP

- **GMCP-01**: Optional global MCP that spans all of a user's orgs (separate auth path)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Embedding pipeline / RAG / pgvector | Explicitly excluded — all AI works via direct LLM context, no vector search |
| Real-time transcript streaming via MCP | MCP is request/response, not pub/sub — wrong tool for the job |
| Raw SQL passthrough via MCP | Security risk — typed tool inputs only |
| MCP marketplace / third-party tools | Future milestone |
| Unlimited AI tools on free tier | Cost risk — PRO+ gating is non-negotiable |
| Cross-org admin MCP view | Security audit surface too large for v2.1 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PROV-01 | Phase 19 | ✅ Shipped |
| PROV-02 | Phase 19 | ✅ Shipped |
| PROV-03 | Phase 19 | ✅ Shipped |
| TOOL-01 | Phase 20 | ✅ Shipped |
| TOOL-02 | Phase 20 | ✅ Shipped |
| TOOL-03 | Phase 20 | ✅ Shipped |
| TOOL-04 | Phase 20 | ✅ Shipped |
| TOOL-05 | Phase 21 | ✅ Shipped |
| TOOL-06 | Phase 21 | ✅ Shipped |
| TOOL-07 | Phase 21 | ✅ Shipped |
| ~~AITL-01~~ | ~~Phase 22~~ | ⛔ DROPPED 2026-05-07 (in-app feature stays) |
| AITL-02 | Phase 22 | 🟡 Partial (read-tool exists, LLM extraction needed) |
| AITL-03 | Phase 22 | Pending |
| AITL-04 | Phase 22 | Pending |
| AITL-05 | Phase 22 | Pending |
| MGMT-01 | Phase 23 | ✅ Shipped |
| MGMT-02 | Phase 23 | Pending |
| MGMT-03 | Phase 23 | Pending |
| PASTE-01 | Phase 24 | ✅ Shipped (verified prod 2026-05-07) |
| PASTE-02 | Phase 24 | ✅ Shipped (verified prod 2026-05-07) |
| PASTE-03 | Phase 24 | ✅ Shipped (verified prod 2026-05-07) |
| PASTE-04 | Phase 24 | ✅ Shipped (verified prod 2026-05-07) |

**Coverage:**
- v2.1 requirements: 21 active (22 total - 1 dropped AITL-01)
- Mapped to phases: 21
- Unmapped: 0 ✓

**Ship status (post-rescope, 2026-05-07):**
- ✅ Shipped + verified: 15 (PROV-01..03, TOOL-01..07, MGMT-01, PASTE-01..04)
- 🟡 Partial: 1 (AITL-02 needs LLM extraction)
- ⏳ Pending: 5 (AITL-03..05, MGMT-02..03)
- ⛔ Dropped: 1 (AITL-01 — in-app feature stays, MCP duplication scoped out)
- **Real progress: 15/21 active reqs fully shipped = ~71%**

---
*Requirements defined: 2026-04-10*
*Last updated: 2026-04-10 — Traceability populated after roadmap creation*
*Reconciled: 2026-05-07 — Audit found 7 reqs shipped without phase tracking; AITL-01/02 partial; Phase 24 added*
