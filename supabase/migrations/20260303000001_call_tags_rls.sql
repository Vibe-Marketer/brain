-- Drop the stale policy
DROP POLICY IF EXISTS "Users can view system and own tags" ON call_tags;
DROP POLICY IF EXISTS "Users can view tags in their organizations" ON call_tags;
DROP POLICY IF EXISTS "Users can insert tags in their organizations" ON call_tags;
DROP POLICY IF EXISTS "Users can update tags in their organizations" ON call_tags;
DROP POLICY IF EXISTS "Users can delete tags in their organizations" ON call_tags;

-- Policy to view tags: must be in the organization
CREATE POLICY "Users can view tags in their organizations"
  ON call_tags FOR SELECT
  USING (
    is_organization_member(organization_id, auth.uid()) 
    OR 
    (organization_id IS NULL AND user_id = auth.uid())
  );

-- Policy to insert tags: must be in the organization
CREATE POLICY "Users can insert tags in their organizations"
  ON call_tags FOR INSERT
  WITH CHECK (
    is_organization_member(organization_id, auth.uid())
    OR
    (organization_id IS NULL AND user_id = auth.uid())
  );

-- Policy to update tags: must be in the organization
CREATE POLICY "Users can update tags in their organizations"
  ON call_tags FOR UPDATE
  USING (
    is_organization_member(organization_id, auth.uid())
    OR
    (organization_id IS NULL AND user_id = auth.uid())
  );

-- Policy to delete tags: must be in the organization
CREATE POLICY "Users can delete tags in their organizations"
  ON call_tags FOR DELETE
  USING (
    is_organization_member(organization_id, auth.uid())
    OR
    (organization_id IS NULL AND user_id = auth.uid())
  );
