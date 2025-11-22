-- Drop dangerous public policies
DROP POLICY IF EXISTS "Allow public read access to fathom_transcripts" ON fathom_transcripts;
DROP POLICY IF EXISTS "Allow public read access to fathom_calls" ON fathom_calls;
DROP POLICY IF EXISTS "Allow public write access to call_categories" ON call_categories;
DROP POLICY IF EXISTS "Allow public read access to call_categories" ON call_categories;
DROP POLICY IF EXISTS "Allow public write access to call_category_assignments" ON call_category_assignments;
DROP POLICY IF EXISTS "Allow public read access to call_category_assignments" ON call_category_assignments;
DROP POLICY IF EXISTS "Allow public read access to speakers" ON speakers;
DROP POLICY IF EXISTS "Allow public write access to speakers" ON speakers;
DROP POLICY IF EXISTS "Allow public read access to call_speakers" ON call_speakers;
DROP POLICY IF EXISTS "Allow public write access to call_speakers" ON call_speakers;

-- Create secure authenticated policies for fathom_transcripts
CREATE POLICY "Authenticated users can read transcripts"
ON fathom_transcripts FOR SELECT
TO authenticated
USING (true);

-- Create secure authenticated policies for fathom_calls
CREATE POLICY "Authenticated users can read calls"
ON fathom_calls FOR SELECT
TO authenticated
USING (true);

-- Create secure authenticated policies for call_categories
CREATE POLICY "Authenticated users can read categories"
ON call_categories FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create categories"
ON call_categories FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update categories"
ON call_categories FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete categories"
ON call_categories FOR DELETE
TO authenticated
USING (true);

-- Create secure authenticated policies for call_category_assignments
CREATE POLICY "Authenticated users can read assignments"
ON call_category_assignments FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create assignments"
ON call_category_assignments FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete assignments"
ON call_category_assignments FOR DELETE
TO authenticated
USING (true);

-- Create secure authenticated policies for speakers
CREATE POLICY "Authenticated users can read speakers"
ON speakers FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create speakers"
ON speakers FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update speakers"
ON speakers FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete speakers"
ON speakers FOR DELETE
TO authenticated
USING (true);

-- Create secure authenticated policies for call_speakers
CREATE POLICY "Authenticated users can read call_speakers"
ON call_speakers FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create call_speakers"
ON call_speakers FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete call_speakers"
ON call_speakers FOR DELETE
TO authenticated
USING (true);