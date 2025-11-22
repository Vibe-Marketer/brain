-- =============================================
-- MULTI-USER DATA ISOLATION
-- =============================================

-- Add user_id columns to tables
ALTER TABLE call_categories ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE speakers ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX idx_call_categories_user_id ON call_categories(user_id);
CREATE INDEX idx_speakers_user_id ON speakers(user_id);

-- Drop existing permissive RLS policies
DROP POLICY IF EXISTS "Authenticated users can read categories" ON call_categories;
DROP POLICY IF EXISTS "Authenticated users can create categories" ON call_categories;
DROP POLICY IF EXISTS "Authenticated users can update categories" ON call_categories;
DROP POLICY IF EXISTS "Authenticated users can delete categories" ON call_categories;

DROP POLICY IF EXISTS "Authenticated users can read speakers" ON speakers;
DROP POLICY IF EXISTS "Authenticated users can create speakers" ON speakers;
DROP POLICY IF EXISTS "Authenticated users can update speakers" ON speakers;
DROP POLICY IF EXISTS "Authenticated users can delete speakers" ON speakers;

-- Create user-scoped RLS policies for call_categories
CREATE POLICY "Users can read own categories"
ON call_categories FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own categories"
ON call_categories FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories"
ON call_categories FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories"
ON call_categories FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create user-scoped RLS policies for speakers
CREATE POLICY "Users can read own speakers"
ON speakers FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own speakers"
ON speakers FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own speakers"
ON speakers FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own speakers"
ON speakers FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Update call_category_assignments to be user-scoped through categories
DROP POLICY IF EXISTS "Authenticated users can read assignments" ON call_category_assignments;
DROP POLICY IF EXISTS "Authenticated users can create assignments" ON call_category_assignments;
DROP POLICY IF EXISTS "Authenticated users can delete assignments" ON call_category_assignments;

CREATE POLICY "Users can read own assignments"
ON call_category_assignments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM call_categories
    WHERE call_categories.id = call_category_assignments.category_id
    AND call_categories.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert own assignments"
ON call_category_assignments FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM call_categories
    WHERE call_categories.id = call_category_assignments.category_id
    AND call_categories.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete own assignments"
ON call_category_assignments FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM call_categories
    WHERE call_categories.id = call_category_assignments.category_id
    AND call_categories.user_id = auth.uid()
  )
);

-- Update call_speakers to be user-scoped through speakers
DROP POLICY IF EXISTS "Authenticated users can read call_speakers" ON call_speakers;
DROP POLICY IF EXISTS "Authenticated users can create call_speakers" ON call_speakers;
DROP POLICY IF EXISTS "Authenticated users can delete call_speakers" ON call_speakers;

CREATE POLICY "Users can read own call_speakers"
ON call_speakers FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM speakers
    WHERE speakers.id = call_speakers.speaker_id
    AND speakers.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert own call_speakers"
ON call_speakers FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM speakers
    WHERE speakers.id = call_speakers.speaker_id
    AND speakers.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete own call_speakers"
ON call_speakers FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM speakers
    WHERE speakers.id = call_speakers.speaker_id
    AND speakers.user_id = auth.uid()
  )
);

-- =============================================
-- INPUT VALIDATION (DATABASE CONSTRAINTS)
-- =============================================

-- Add length constraints to call_categories
ALTER TABLE call_categories 
  ADD CONSTRAINT name_length CHECK (length(name) <= 100 AND length(name) >= 1),
  ADD CONSTRAINT description_length CHECK (description IS NULL OR length(description) <= 500);

-- Add length constraints to speakers
ALTER TABLE speakers
  ADD CONSTRAINT speaker_name_length CHECK (length(name) <= 100 AND length(name) >= 1),
  ADD CONSTRAINT speaker_email_length CHECK (email IS NULL OR length(email) <= 255),
  ADD CONSTRAINT speaker_title_length CHECK (title IS NULL OR length(title) <= 100),
  ADD CONSTRAINT speaker_company_length CHECK (company IS NULL OR length(company) <= 100),
  ADD CONSTRAINT speaker_notes_length CHECK (notes IS NULL OR length(notes) <= 1000);

-- Add length constraints to app_config
ALTER TABLE app_config
  ADD CONSTRAINT config_key_length CHECK (length(key) <= 100),
  ADD CONSTRAINT config_value_length CHECK (length(value) <= 1000);