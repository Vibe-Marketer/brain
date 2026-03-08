# CallVault Project State

**Last Updated:** 2026-03-08
**Source of truth:** Codebase audit (issue #51, PR #52)

---

## Architecture

- **Two repos:** brain (Supabase backend + planning) + callvault (Vite 7 + React 19 frontend)
- **Backend:** Supabase with 107+ migrations, edge functions
- **Data model:** Organizations > Workspaces > Recordings (via workspace_entries)
- `is_default` (not `is_home`) marks the undeletable personal workspace per org
- `workspace_entries` (not `call_workspace_links`) — richer join table with folder_id, local_tags, scores, notes
- Folders scoped to workspaces via `workspace_id` FK on existing `folders` table
- Tags: `local_tags` on workspace_entries (per-workspace) + `global_tags` on recordings (org-wide)

## What's Working

### Database Layer
- Organizations, workspaces, workspace_entries, workspace_memberships — all with RLS
- Hard tenant boundary: recordings belong to exactly ONE organization
- `prevent_default_workspace_delete()` trigger protects personal workspace
- Role hierarchy: workspace_owner > workspace_admin > manager > member > guest
- `hybrid_search_transcripts_scoped` RPC respects workspace/org scope

### Backend
- Workspace invite flow: `get_workspace_invite_details` + `accept_workspace_invite` RPCs
- New user onboarding: `handle_new_user()` trigger creates personal org + default workspace
- Legacy user backfill: `ensure_personal_organization()` RPC
- Import pipeline creates workspace_entries at import time

### Frontend (v2)
- Org switching UI (OrgSwitcherBar) — one-click switching
- Workspace sidebar with nested folders, drag-and-drop
- Workspace member management panel (members + pending invites)
- Invitation acceptance page (`/join/workspace/:token`)
- Import routing rules (Phase 18 — verified 10/10)

### Access Control
- Org owner/admin sees all workspaces and entries
- Regular members see only their workspace entries
- Removing user from workspace revokes access instantly (RLS-based)
- Folders/tags have no impact on permissions

## What's In Progress

- Issue #62: Critical bugs in agent/antigravity branch
- Issue #63: Bulk apply routing rules to existing recordings
- Issue #64: Search/filter functionality fixes
- Issue #65: Archive stale planning docs (this cleanup)

## Known Gaps (from audit)

| # | Gap | Issue |
|---|-----|-------|
| 1 | Recordings RLS too permissive — any org member can SELECT any recording, not scoped to workspace | #53 |
| 2 | No Copy/Move dialogs for cross-workspace operations | #54 |
| 3 | No org-level member management panel (only workspace-level) | #55 |
| 4 | Stale generated types — frontend queries use old table names (banks/vaults) | #56 |
| 5 | Recording deletion blocked while workspace_entries exist (inverted logic) | #57 |
| 6 | No general-purpose cross-org copy RPC | #58 |
| 7 | CORS allowed origins not configured | #59 |
| 8 | Embeddings cron job failing | #10 |

## Phase Status

- **Phases 1-17:** Completed (pre-antigravity architecture)
- **Phase 18 (Import Routing Rules):** Verified 10/10, still accurate
- **Phase 19 (MCP Audit):** Archived — needs re-evaluation post-antigravity
- **Antigravity (agent/antigravity branch):** In progress — org member management, copy/move, personal folders/tags, Hub rename. Blocked on issue #62 (critical bugs)
- Planning docs for phases 1-17, 19 archived to `.planning/archive/pre-antigravity-2026-03/`

## Key Files

| File | Purpose |
|------|---------|
| `.planning/PROJECT.md` | Project identity and milestone definition |
| `.planning/config.json` | GSD workflow configuration |
| `.planning/phases/18-import-routing-rules/` | Active verified phase |
| `.planning/codebase/` | Architecture documentation |
| `docs/audits/issue-51-org-workspace-sharing-audit.md` | Comprehensive system audit |
