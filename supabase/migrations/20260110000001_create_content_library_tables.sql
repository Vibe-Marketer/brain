-- Migration: Create content_library table for storing AI-generated content
-- Purpose: Enable users to save, organize, and reuse AI-generated marketing and sales content
-- Author: Claude Code
-- Date: 2026-01-10

-- ============================================================================
-- TABLE: content_library
-- ============================================================================
-- Stores AI-generated content with tagging, metadata, and usage tracking
-- Supports both personal content and team-shared content
CREATE TABLE IF NOT EXISTS public.content_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('email', 'social', 'testimonial', 'insight', 'other')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints for reasonable content limits
  CONSTRAINT content_library_title_length CHECK (char_length(title) <= 255),
  CONSTRAINT content_library_content_length CHECK (char_length(content) <= 50000)
);

-- ============================================================================
-- INDEXES
-- ============================================================================
-- Performance indexes for common query patterns

-- Index for looking up content by user
CREATE INDEX IF NOT EXISTS idx_content_library_user_id
  ON public.content_library(user_id);

-- Index for looking up content by team
CREATE INDEX IF NOT EXISTS idx_content_library_team_id
  ON public.content_library(team_id) WHERE team_id IS NOT NULL;

-- Index for filtering by content type
CREATE INDEX IF NOT EXISTS idx_content_library_content_type
  ON public.content_library(content_type);

-- GIN index for efficient tag filtering
CREATE INDEX IF NOT EXISTS idx_content_library_tags
  ON public.content_library USING GIN(tags);

-- Index for sorting by creation date (most recent first)
CREATE INDEX IF NOT EXISTS idx_content_library_created_at
  ON public.content_library(created_at DESC);

-- Composite index for efficient user + content_type lookups
CREATE INDEX IF NOT EXISTS idx_content_library_user_type
  ON public.content_library(user_id, content_type);

-- ============================================================================
-- TRIGGERS
-- ============================================================================
-- Automatically update the updated_at timestamp

-- Reuse existing update_updated_at_column function if it exists, otherwise create it
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to content_library table
DROP TRIGGER IF EXISTS update_content_library_updated_at ON public.content_library;
CREATE TRIGGER update_content_library_updated_at
  BEFORE UPDATE ON public.content_library
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- Enable RLS on content_library table
ALTER TABLE public.content_library ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES: content_library
-- ============================================================================

-- Policy: Users can view their own content and team content they belong to
CREATE POLICY "Users can view their own content and team content"
  ON public.content_library
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR (
      team_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM team_memberships
        WHERE team_memberships.team_id = content_library.team_id
          AND team_memberships.user_id = auth.uid()
          AND team_memberships.status = 'active'
      )
    )
  );

-- Policy: Users can insert their own content
CREATE POLICY "Users can insert their own content"
  ON public.content_library
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own content
CREATE POLICY "Users can update their own content"
  ON public.content_library
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own content
CREATE POLICY "Users can delete their own content"
  ON public.content_library
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- PERMISSIONS
-- ============================================================================
-- Grant permissions to authenticated users
GRANT ALL ON public.content_library TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================
-- Add helpful comments to table and columns

COMMENT ON TABLE public.content_library IS
  'Stores AI-generated content for reuse in marketing and sales workflows. Supports personal and team content.';

COMMENT ON COLUMN public.content_library.user_id IS
  'User who owns/created this content item';

COMMENT ON COLUMN public.content_library.team_id IS
  'Optional team association for shared content. NULL means personal content only.';

COMMENT ON COLUMN public.content_library.content_type IS
  'Type of content: email, social, testimonial, insight, or other';

COMMENT ON COLUMN public.content_library.title IS
  'User-friendly title for the content item (max 255 chars)';

COMMENT ON COLUMN public.content_library.content IS
  'The actual content text (max 50,000 chars)';

COMMENT ON COLUMN public.content_library.tags IS
  'Array of tags for categorization and filtering';

COMMENT ON COLUMN public.content_library.metadata IS
  'Flexible JSONB storage for additional attributes like source, meeting_id, etc.';

COMMENT ON COLUMN public.content_library.usage_count IS
  'Number of times this content has been used/copied';

-- ============================================================================
-- TABLE: templates
-- ============================================================================
-- Stores reusable content templates with variable placeholder support
-- Templates can be personal or shared with team members
CREATE TABLE IF NOT EXISTS public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  template_content TEXT NOT NULL,
  variables JSONB DEFAULT '[]', -- Array of variable definitions: [{name: "firstName", required: true}]
  content_type TEXT NOT NULL CHECK (content_type IN ('email', 'social', 'testimonial', 'insight', 'other')),
  is_shared BOOLEAN DEFAULT FALSE,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints for reasonable content limits
  CONSTRAINT templates_name_length CHECK (char_length(name) <= 255),
  CONSTRAINT templates_content_length CHECK (char_length(template_content) <= 50000)
);

-- ============================================================================
-- INDEXES: templates
-- ============================================================================
-- Performance indexes for common query patterns

-- Index for looking up templates by user
CREATE INDEX IF NOT EXISTS idx_templates_user_id
  ON public.templates(user_id);

-- Index for looking up templates by team
CREATE INDEX IF NOT EXISTS idx_templates_team_id
  ON public.templates(team_id) WHERE team_id IS NOT NULL;

-- Index for filtering by content type
CREATE INDEX IF NOT EXISTS idx_templates_content_type
  ON public.templates(content_type);

-- Index for finding shared templates efficiently
CREATE INDEX IF NOT EXISTS idx_templates_is_shared
  ON public.templates(is_shared) WHERE is_shared = TRUE;

-- Index for sorting by creation date (most recent first)
CREATE INDEX IF NOT EXISTS idx_templates_created_at
  ON public.templates(created_at DESC);

-- Composite index for efficient user + shared lookups
CREATE INDEX IF NOT EXISTS idx_templates_user_shared
  ON public.templates(user_id, is_shared);

-- ============================================================================
-- TRIGGERS: templates
-- ============================================================================
-- Apply updated_at trigger to templates table (reuses existing function)
DROP TRIGGER IF EXISTS update_templates_updated_at ON public.templates;
CREATE TRIGGER update_templates_updated_at
  BEFORE UPDATE ON public.templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS): templates
-- ============================================================================
-- Enable RLS on templates table
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES: templates
-- ============================================================================

-- Policy: Users can view their own templates and shared team templates
CREATE POLICY "Users can view their own templates and shared team templates"
  ON public.templates
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR (
      is_shared = TRUE
      AND team_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM team_memberships
        WHERE team_memberships.team_id = templates.team_id
          AND team_memberships.user_id = auth.uid()
          AND team_memberships.status = 'active'
      )
    )
  );

-- Policy: Users can insert their own templates
CREATE POLICY "Users can insert their own templates"
  ON public.templates
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own templates
CREATE POLICY "Users can update their own templates"
  ON public.templates
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own templates
CREATE POLICY "Users can delete their own templates"
  ON public.templates
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- PERMISSIONS: templates
-- ============================================================================
-- Grant permissions to authenticated users
GRANT ALL ON public.templates TO authenticated;

-- ============================================================================
-- COMMENTS: templates
-- ============================================================================
-- Add helpful comments to table and columns

COMMENT ON TABLE public.templates IS
  'Stores reusable content templates with variable placeholder support. Supports personal and team-shared templates.';

COMMENT ON COLUMN public.templates.user_id IS
  'User who owns/created this template';

COMMENT ON COLUMN public.templates.team_id IS
  'Optional team association for shared templates. NULL means personal template only.';

COMMENT ON COLUMN public.templates.name IS
  'User-friendly name for the template (max 255 chars)';

COMMENT ON COLUMN public.templates.description IS
  'Optional description of what the template is for';

COMMENT ON COLUMN public.templates.template_content IS
  'The template text with {{variable}} placeholders (max 50,000 chars)';

COMMENT ON COLUMN public.templates.variables IS
  'JSONB array of variable definitions: [{name: "firstName", required: true, defaultValue: ""}]';

COMMENT ON COLUMN public.templates.content_type IS
  'Type of content this template generates: email, social, testimonial, insight, or other';

COMMENT ON COLUMN public.templates.is_shared IS
  'Whether this template is shared with team members (requires team_id)';

COMMENT ON COLUMN public.templates.usage_count IS
  'Number of times this template has been used';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
