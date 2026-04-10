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

- [ ] **TOOL-01**: MCP exposes search_transcripts tool with full-text search scoped to org
- [ ] **TOOL-02**: MCP exposes list_calls tool with filters (date, folder, tag, contact, source, duration) and pagination
- [ ] **TOOL-03**: MCP exposes get_call tool returning metadata + cached summary if available
- [ ] **TOOL-04**: MCP exposes get_transcript tool returning full text with speaker labels and timestamps
- [ ] **TOOL-05**: MCP exposes create_note tool to add a note to a call
- [ ] **TOOL-06**: MCP exposes add_tag tool to tag a call
- [ ] **TOOL-07**: MCP exposes move_to_folder tool to organize calls into folders

### AI Tools

All AI tools pass transcript text directly to the LLM via Vercel AI SDK + OpenRouter. No embeddings, no RAG, no vector search. Results cached in DB after first invocation.

- [ ] **AITL-01**: MCP exposes summarize_call tool — LLM-powered summary, cached after first invocation
- [ ] **AITL-02**: MCP exposes extract_action_items tool — structured output (owner, action, due date mentioned), cached
- [ ] **AITL-03**: MCP exposes ask_call tool — natural language Q&A against a single call's full transcript via LLM
- [ ] **AITL-04**: MCP exposes get_sentiment tool — tone analysis, talk ratio, key moments per call
- [ ] **AITL-05**: MCP exposes get_coaching_notes tool — sales coaching insights per call

### Management UI

- [ ] **MGMT-01**: Settings > Integrations shows MCP connection URL and masked token with copy button
- [ ] **MGMT-02**: Settings UI shows per-tool capability toggles (enable/disable individual MCP tools)
- [ ] **MGMT-03**: Capability toggles enforced server-side — disabled tools return clear error to MCP client

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
| PROV-01 | Phase 19 | Pending |
| PROV-02 | Phase 19 | Pending |
| PROV-03 | Phase 19 | Pending |
| TOOL-01 | Phase 20 | Pending |
| TOOL-02 | Phase 20 | Pending |
| TOOL-03 | Phase 20 | Pending |
| TOOL-04 | Phase 20 | Pending |
| TOOL-05 | Phase 21 | Pending |
| TOOL-06 | Phase 21 | Pending |
| TOOL-07 | Phase 21 | Pending |
| AITL-01 | Phase 22 | Pending |
| AITL-02 | Phase 22 | Pending |
| AITL-03 | Phase 22 | Pending |
| AITL-04 | Phase 22 | Pending |
| AITL-05 | Phase 22 | Pending |
| MGMT-01 | Phase 23 | Pending |
| MGMT-02 | Phase 23 | Pending |
| MGMT-03 | Phase 23 | Pending |

**Coverage:**
- v2.1 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-10*
*Last updated: 2026-04-10 — Traceability populated after roadmap creation*
