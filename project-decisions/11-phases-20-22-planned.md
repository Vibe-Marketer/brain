# Phases 20-22: Planned

These phases have requirements defined but no research, context, or plans written yet.

---

## Phase 20: MCP Differentiators

### Build 6 Differentiating Tools

- [ ] `browse_workspace_hierarchy` — navigate the org/workspace/folder tree structure, letting AI understand how content is organized
- [ ] `get_speaker_history` — retrieve all recordings featuring a specific speaker, enabling cross-call speaker analysis
- [ ] `compare_recordings` — side-by-side comparison of two calls, surfacing differences in topics, sentiment, outcomes
- [ ] `get_topic_timeline` — track how a topic evolves across recordings over time (e.g., "what has the customer said about pricing across all calls?")
- [ ] `batch_get_transcripts` — bulk transcript retrieval for efficient multi-call analysis
- [ ] `get_recording_context` — rich context for a single recording including metadata, participants, folder location, tags

### Build 3 Shareable Prompts

- [ ] Design prompt templates that are useful across multiple MCP clients
- [ ] Prompts should leverage the differentiating tools above

### Implement `callvault://` URI Scheme

- [ ] Define URI format for referencing CallVault resources (recordings, workspaces, folders)
- [ ] Enable MCP clients to deep-link into CallVault content

### Verify in 3 MCP Clients

- [ ] Claude Desktop — verify all tools, resources, and prompts work correctly
- [ ] ChatGPT — verify tool calling works through the MCP integration
- [ ] Cursor — verify tools work in the coding assistant context

---

## Phase 21: AI Bridge + Export + Sharing

### AI Removal + Simplification

- [ ] Research and decide chat architecture: bridge chat (minimal ~100 lines, no RAG) vs. remove chat entirely from v2
- [ ] If bridge chat: build minimal chat that can answer simple questions about recordings without embeddings, RAG, or vector search
- [ ] Preserve Smart Import enrichment (auto-title, action items, tags, sentiment) — this runs once at import and stays
- [ ] Stop OpenAI embedding generation — no new embeddings created
- [ ] Replace semantic search with keyword search via `pg_trgm` PostgreSQL extension
- [ ] Queue AI tables and functions for Phase 22 cleanup (don't drop yet)

### Build Export System

- [ ] DOCX export — professional document format with recording metadata, transcript, and participant info
- [ ] PDF export — printable format
- [ ] Plain text export — simple, universal format
- [ ] AI-optimized export format — structured specifically for LLM consumption (clear sections, metadata headers, transcript with speaker labels)
- [ ] ZIP for multiple calls — batch export with sensible file naming
- [ ] "Open in Claude" one-click flow — exports recording in Claude-optimized format and opens Claude with the content
- [ ] "Open in ChatGPT" one-click flow — same for ChatGPT

### Build Sharing System

- [ ] Public share link — generate a shareable URL for any recording; recipient sees read-only view without needing a CallVault account
- [ ] Workspace sharing — workspace-level access grants (different from per-recording share links)
- [ ] Embeddable iframe player — allow recordings to be embedded in external pages
- [ ] Invite scope clarity — the UI must clearly communicate WHAT is being shared (a single recording? a folder? a workspace?) and with WHAT permissions

---

## Phase 22: Backend Cleanup

**Ordering constraint:** This phase runs ONLY after 30 days of confirmed v2 production stability. It is the final phase of the v2.0 milestone.

### Database Cleanup

- [ ] DROP `fathom_calls_archive` table (the original fathom_calls renamed in Phase 15)
- [ ] DROP compatibility VIEW `fathom_calls` (created in Phase 15 for v1 backward compatibility)
- [ ] Clean up AI-related tables queued from Phase 21 (embeddings, vector data, etc.)
- [ ] Remove deprecated edge functions that are no longer called by v2

### Consider

- [ ] File upload enhancement: Supabase Storage staging for files larger than 25MB (deferred from Phase 17)
- [ ] Any remaining orphaned database objects from v1
