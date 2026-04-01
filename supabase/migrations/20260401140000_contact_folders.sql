-- Migration: Contact folders
-- Purpose: Contact folders for organizing contacts in the People page
-- Date: 2026-04-01

-- ============================================================================
-- TABLE: contact_folders
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.contact_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX idx_contact_folders_org ON contact_folders(organization_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE contact_folders ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Users can see contact folders in their org
CREATE POLICY "Users can view contact folders in their org"
  ON contact_folders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships om
      WHERE om.organization_id = contact_folders.organization_id
        AND om.user_id = auth.uid()
    )
  );

-- Users can create contact folders in their org
CREATE POLICY "Users can create contact folders"
  ON contact_folders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own contact folders
CREATE POLICY "Users can update their own contact folders"
  ON contact_folders FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own contact folders
CREATE POLICY "Users can delete their own contact folders"
  ON contact_folders FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- TABLE: contact_folder_assignments
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.contact_folder_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_folder_id UUID NOT NULL REFERENCES public.contact_folders(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(contact_folder_id, contact_id)
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE contact_folder_assignments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

CREATE POLICY "Users can view contact folder assignments"
  ON contact_folder_assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contact_folders cf
      JOIN organization_memberships om ON om.organization_id = cf.organization_id
      WHERE cf.id = contact_folder_assignments.contact_folder_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage contact folder assignments"
  ON contact_folder_assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM contact_folders cf
      WHERE cf.id = contact_folder_assignments.contact_folder_id
        AND cf.user_id = auth.uid()
    )
  );

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE contact_folders IS 'Folders for organizing contacts in the People page';
COMMENT ON TABLE contact_folder_assignments IS 'Junction table linking contacts to contact folders';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
