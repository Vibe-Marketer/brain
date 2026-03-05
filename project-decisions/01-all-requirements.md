# All v2 Requirements

70 total requirements mapped to phases.

---

## Strategy Validation (Phase 13)

- [ ] **STRAT-01**: AI strategy validated — MCP-first is the answer
- [ ] **STRAT-02**: Pricing model defined before first commit
- [ ] **STRAT-03**: Product identity locked in writing

## Billing (Phase 13)

- [ ] **BILL-01**: Pricing tiers defined before code
- [ ] **BILL-02**: Polar updated with new products
- [ ] **BILL-03**: Free tier defined
- [ ] **BILL-04**: Upgrade prompts in context

## Foundation (Phase 14)

- [ ] **FOUND-01**: Login with existing Supabase account
- [ ] **FOUND-02**: Tech stack validated (Vite 7, React 19, TanStack Router, etc.)
- [ ] **FOUND-03**: New GitHub repo created
- [ ] **FOUND-04**: AppShell 4-pane layout with spring animations
- [ ] **FOUND-05**: All routes wired to placeholder content
- [ ] **FOUND-06**: Zustand v5 + TanStack Query v5 (hard boundary: Zustand = UI only, TanStack Query = server state)
- [ ] **FOUND-07**: Auth redirect allowlist configured
- [ ] **FOUND-08**: Fathom/Zoom OAuth audit complete
- [ ] **FOUND-09**: Google Meet removed entirely — no code ever in new repo (HARD CONSTRAINT)

## AI Constraint

- [ ] **AI-02**: New repo never contains any AI/RAG/embedding/Content Hub code

## Data Migration (Phase 15)

- [ ] **DATA-01**: fathom_calls migrated to recordings table
- [ ] **DATA-02**: RLS verified with real JWTs (not service_role)
- [ ] **DATA-03**: source_metadata normalized with external_id
- [ ] **DATA-04**: fathom_calls archived (renamed, NOT dropped)
- [ ] **DATA-05**: Dry-run before real migration

## Workspace Model (Phase 16)

- [ ] **WKSP-01**: Bank renamed to Organization everywhere in UI
- [ ] **WKSP-02**: Vault renamed to Workspace everywhere in UI
- [ ] **WKSP-03**: Hub renamed to Folder everywhere in UI
- [ ] **WKSP-04**: URL 301 redirects for old paths (/vaults -> /workspaces, etc.)
- [ ] **WKSP-05**: Organization creation and switching
- [ ] **WKSP-06**: Onboarding diagram/explorer
- [ ] **WKSP-07**: Workspace creation
- [ ] **WKSP-08**: Workspace switching
- [ ] **WKSP-09**: Invite flows
- [ ] **WKSP-10**: Folder management (create, rename, archive, drag-and-drop)
- [ ] **WKSP-11**: Membership management
- [ ] **WKSP-12**: Folder assignment (calls into folders)
- [ ] **WKSP-13**: Workspace detail view

## Import System (Phase 17)

- [ ] **IMP-01**: Connector pipeline `_shared/connector-pipeline.ts` with 5-stage architecture
- [ ] **IMP-02**: New source in <=230 lines (accepted exception: file upload = 389 lines due to drag-drop UI)
- [ ] **IMP-03**: Import source management UI (card grid with status, toggle, sync)

## Import Routing Rules (Phase 18)

- [ ] **IMP-04**: User can create import routing rule that auto-assigns calls to Workspace/Folder based on conditions
- [ ] **IMP-05**: Condition builder supports 5+ condition types: title contains, participant is, source is, duration greater than, tag is
- [ ] **IMP-06**: Rules use first-match-wins priority — user can drag to reorder
- [ ] **IMP-07**: Default destination required before creating rules — unmatched calls route to specified Workspace/Folder
- [ ] **IMP-08**: Rule preview shows "This rule would match X of your last 20 calls" before saving
- [ ] **IMP-09**: Rules apply to future imports only — UI explicitly states "Rules apply to new imports only"
- [ ] **IMP-10**: Rule priority stored in schema from first migration (priority integer column + drag-to-reorder UI)

## MCP Expansion (Phase 19)

- [ ] **MCP-01**: Full audit of current MCP Worker
- [ ] **MCP-02**: Preserved capabilities (all existing operations still work)
- [ ] **MCP-03**: Naming updated (Bank->Organization, Vault->Workspace)
- [ ] **MCP-04**: Per-workspace token generation (Airtable-style UI)
- [ ] **MCP-05**: Token list with revoke
- [ ] **MCP-06**: RLS enforces isolation from current membership
- [ ] **MCP-07**: Token shown once, never retrievable

## MCP Differentiators (Phase 20)

- [ ] **MCP-08**: 6 differentiating tools (browse_workspace_hierarchy, get_speaker_history, compare_recordings, get_topic_timeline, batch_get_transcripts, get_recording_context)
- [ ] **MCP-09**: 3 shareable prompts
- [ ] **MCP-10**: `callvault://` URI scheme
- [ ] **MCP-11**: Verified in 3 MCP clients

## AI Removal + Simplification (Phase 21)

- [ ] **AI-01**: Chat architecture decided
- [ ] **AI-02**: (duplicate — referenced above)
- [ ] **AI-03**: Bridge chat (~100 lines, no RAG)
- [ ] **AI-04**: Smart import enrichment preserved
- [ ] **AI-05**: OpenAI embeddings stopped
- [ ] **AI-06**: Keyword search via pg_trgm replaces semantic search
- [ ] **AI-07**: AI tables/functions queued for cleanup
- [ ] **AI-08**: Bridge chat built (after architecture decision)

## Export + Sharing (Phase 21)

- [ ] **EXPRT-01**: DOCX/PDF/plain text export
- [ ] **EXPRT-02**: AI-optimized export format
- [ ] **EXPRT-03**: ZIP for multiple calls
- [ ] **EXPRT-04**: "Open in Claude" / "Open in ChatGPT" one-click flow

## Sharing (Phase 21)

- [ ] **SHARE-01**: Public share link
- [ ] **SHARE-02**: Workspace sharing
- [ ] **SHARE-03**: Embeddable iframe player
- [ ] **SHARE-04**: Invite scope clarity
