-- Migration: Create folders tables and related objects
-- Purpose: Enable user-created organizational containers for call recordings
-- Author: Claude Code
-- Date: 2025-12-01

-- ============================================================================
-- TABLE: folders
-- ============================================================================
-- User-created organizational containers for call recordings
CREATE TABLE folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6B7280', -- Gray default
  icon TEXT DEFAULT 'folder', -- Remix icon name
  parent_id UUID REFERENCES folders(id) ON DELETE CASCADE, -- For nested folders
  position INTEGER DEFAULT 0, -- For ordering
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure unique folder names within the same parent for each user
  UNIQUE(user_id, name, parent_id)
);

-- ============================================================================
-- TABLE: folder_assignments
-- ============================================================================
-- Many-to-many relationship between folders and call recordings
-- Uses composite FK to support multi-user team sync (same call can exist for multiple users)
CREATE TABLE folder_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id UUID NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  call_recording_id BIGINT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID REFERENCES auth.users(id),

  -- Composite FK to fathom_calls (recording_id, user_id)
  FOREIGN KEY (call_recording_id, user_id)
    REFERENCES fathom_calls(recording_id, user_id) ON DELETE CASCADE,

  -- Prevent duplicate assignments (same call can only be in same folder once per user)
  UNIQUE(folder_id, call_recording_id, user_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================
-- Performance indexes for common query patterns

-- Index for looking up all assignments for a specific call
CREATE INDEX idx_folder_assignments_call_recording_id
  ON folder_assignments(call_recording_id);

-- Index for looking up all calls in a specific folder
CREATE INDEX idx_folder_assignments_folder_id
  ON folder_assignments(folder_id);

-- Index for looking up assignments by user
CREATE INDEX idx_folder_assignments_user_id
  ON folder_assignments(user_id);

-- Composite index for efficient lookups by recording + user
CREATE INDEX idx_folder_assignments_recording_user
  ON folder_assignments(call_recording_id, user_id);

-- Index for looking up all folders for a specific user
CREATE INDEX idx_folders_user_id
  ON folders(user_id);

-- Index for looking up child folders of a parent folder
CREATE INDEX idx_folders_parent_id
  ON folders(parent_id);

-- Composite index for efficient folder hierarchy queries
CREATE INDEX idx_folders_user_parent
  ON folders(user_id, parent_id);

-- Index for ordering folders by position
CREATE INDEX idx_folders_position
  ON folders(user_id, position);

-- ============================================================================
-- TRIGGERS
-- ============================================================================
-- Automatically update the updated_at timestamp

-- Create trigger function for updating updated_at
CREATE OR REPLACE FUNCTION update_folders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to folders table
CREATE TRIGGER set_folders_updated_at
  BEFORE UPDATE ON folders
  FOR EACH ROW
  EXECUTE FUNCTION update_folders_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- Enable RLS on both tables
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE folder_assignments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES: folders
-- ============================================================================

-- Policy: Users can view their own folders
CREATE POLICY "Users can view their own folders"
  ON folders
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can create their own folders
CREATE POLICY "Users can create their own folders"
  ON folders
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own folders
CREATE POLICY "Users can update their own folders"
  ON folders
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own folders
CREATE POLICY "Users can delete their own folders"
  ON folders
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- RLS POLICIES: folder_assignments
-- ============================================================================

-- Policy: Users can view assignments for their own folders
CREATE POLICY "Users can view assignments for their folders"
  ON folder_assignments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM folders
      WHERE folders.id = folder_assignments.folder_id
        AND folders.user_id = auth.uid()
    )
  );

-- Policy: Users can create assignments for their own folders
CREATE POLICY "Users can create assignments for their folders"
  ON folder_assignments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM folders
      WHERE folders.id = folder_assignments.folder_id
        AND folders.user_id = auth.uid()
    )
  );

-- Policy: Users can update assignments for their own folders
CREATE POLICY "Users can update assignments for their folders"
  ON folder_assignments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM folders
      WHERE folders.id = folder_assignments.folder_id
        AND folders.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM folders
      WHERE folders.id = folder_assignments.folder_id
        AND folders.user_id = auth.uid()
    )
  );

-- Policy: Users can delete assignments for their own folders
CREATE POLICY "Users can delete assignments for their folders"
  ON folder_assignments
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM folders
      WHERE folders.id = folder_assignments.folder_id
        AND folders.user_id = auth.uid()
    )
  );

-- ============================================================================
-- COMMENTS
-- ============================================================================
-- Add helpful comments to tables and columns

COMMENT ON TABLE folders IS
  'User-created organizational containers for call recordings. Supports nested folder hierarchies.';

COMMENT ON COLUMN folders.user_id IS
  'Owner of the folder';

COMMENT ON COLUMN folders.parent_id IS
  'Reference to parent folder for nested hierarchies. NULL for root-level folders.';

COMMENT ON COLUMN folders.position IS
  'Used for custom ordering of folders within the same parent.';

COMMENT ON COLUMN folders.color IS
  'Hex color code for folder UI display';

COMMENT ON COLUMN folders.icon IS
  'Remix icon name for folder UI display';

COMMENT ON TABLE folder_assignments IS
  'Many-to-many relationship mapping call recordings to folders. A call can belong to multiple folders.';

COMMENT ON COLUMN folder_assignments.assigned_by IS
  'User who assigned the call to the folder (for audit trail)';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
