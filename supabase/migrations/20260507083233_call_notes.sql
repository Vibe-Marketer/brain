-- Migration: Create call_notes table
-- Purpose: Per-note storage for the create_note MCP write tool (Phase 21, TOOL-05).
--          Each row is a single note authored by a user against a recording within a workspace.
--          Replaces append-to-workspace_entries.notes pattern. Enables future delete_note /
--          edit_note / list_notes MCP tools without an API break.
-- Author: GSD Phase 21
-- Date: 2026-05-07

-- ============================================================================
-- TABLE: call_notes
-- ============================================================================
-- One row per note. Notes belong to a (recording, workspace) pair so that the
-- same recording shared into multiple workspaces can carry distinct notes per
-- workspace context. user_id is the author (per D-14 — token owner = author).
CREATE TABLE call_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
-- Covers the common read pattern: list all notes for a recording, newest first.
CREATE INDEX idx_call_notes_recording ON call_notes(recording_id, created_at DESC);

-- Covers workspace-scoped fan-out queries (e.g., MCP server filtering by org workspace ids).
CREATE INDEX idx_call_notes_workspace ON call_notes(workspace_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE call_notes ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES (mirror workspace_entries pattern)
-- ============================================================================
-- SELECT: workspace members can see notes in their workspaces.
CREATE POLICY "Users can view call notes in their workspaces"
  ON call_notes FOR SELECT
  USING (is_workspace_member(workspace_id, auth.uid()));

-- SELECT: organization admins/owners can see all call notes in their org.
CREATE POLICY "Organization admins can view all call notes"
  ON call_notes FOR SELECT
  USING (
    is_organization_admin_or_owner(get_workspace_organization_id(workspace_id), auth.uid())
  );

-- INSERT: authenticated workspace members can create notes only when authoring
-- as themselves. The user_id check prevents impersonation; the workspace check
-- prevents cross-workspace writes.
CREATE POLICY "Workspace members can insert their own call notes"
  ON call_notes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM workspace_memberships
      WHERE workspace_memberships.workspace_id = call_notes.workspace_id
        AND workspace_memberships.user_id = auth.uid()
        AND workspace_memberships.role IN (
          'workspace_owner', 'workspace_admin', 'manager', 'member'
        )
    )
  );

-- UPDATE: authors can edit their own notes (defense-in-depth for future edit_note tool).
CREATE POLICY "Authors can update their own call notes"
  ON call_notes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: authors can delete their own notes (defense-in-depth for future delete_note tool).
CREATE POLICY "Authors can delete their own call notes"
  ON call_notes FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE call_notes IS
  'User-authored notes attached to a recording within a workspace. Backs the create_note MCP write tool. Replaces the legacy workspace_entries.notes column (which is left untouched per D-08).';
COMMENT ON COLUMN call_notes.recording_id IS 'Recording the note is attached to. Cascade-deletes if the recording is removed.';
COMMENT ON COLUMN call_notes.workspace_id IS 'Workspace context the note belongs to. Same recording shared to multiple workspaces can have distinct notes per workspace.';
COMMENT ON COLUMN call_notes.user_id IS 'Author of the note (per D-14: token owner = author).';
COMMENT ON COLUMN call_notes.content IS 'Plain TEXT note body. Length-capped at the application layer (10,000 chars) — no DB CHECK constraint.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
