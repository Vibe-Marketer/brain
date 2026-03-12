-- Migration: Org-scope contacts to fix cross-org data bleed
-- Problem: contacts and contact_call_appearances were scoped only to user_id,
--          so a user in Org A and Org B could see contacts from both orgs everywhere.
-- Solution: Add org_id column, backfill from user's personal org, update UNIQUE
--           constraint, update RLS policies to require org membership.
-- Date: 2026-03-10

-- ============================================================================
-- STEP 1: Add org_id to contacts (nullable first, for safe backfill)
-- ============================================================================
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- ============================================================================
-- STEP 2: Backfill org_id using the user's personal organization
-- For each contact row, find the personal org (type = 'personal') that the
-- contact's user_id belongs to, and set org_id to that org.
-- ============================================================================
UPDATE contacts c
SET org_id = (
  SELECT o.id
  FROM organizations o
  JOIN organization_memberships om ON om.organization_id = o.id
  WHERE om.user_id = c.user_id
    AND o.type = 'personal'
  LIMIT 1
)
WHERE c.org_id IS NULL;

-- ============================================================================
-- STEP 3: Make org_id NOT NULL now that the backfill is complete
-- Any rows that couldn't be backfilled (user has no personal org) are dropped
-- as a safety net — this should not happen in practice given the signup trigger.
-- ============================================================================
DELETE FROM contacts WHERE org_id IS NULL;

ALTER TABLE contacts
  ALTER COLUMN org_id SET NOT NULL;

-- ============================================================================
-- STEP 4: Add org_id to contact_call_appearances (nullable first)
-- ============================================================================
ALTER TABLE contact_call_appearances
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Backfill org_id on appearances by joining to the parent contact's org_id
UPDATE contact_call_appearances cca
SET org_id = (
  SELECT c.org_id
  FROM contacts c
  WHERE c.id = cca.contact_id
)
WHERE cca.org_id IS NULL;

-- Drop orphaned appearances whose contact no longer exists (shouldn't happen normally)
DELETE FROM contact_call_appearances WHERE org_id IS NULL;

ALTER TABLE contact_call_appearances
  ALTER COLUMN org_id SET NOT NULL;

-- ============================================================================
-- STEP 5: Update UNIQUE constraint on contacts
-- Old: (user_id, email)
-- New: (user_id, org_id, email) — same email can exist in different orgs
-- ============================================================================
ALTER TABLE contacts
  DROP CONSTRAINT IF EXISTS contacts_user_id_email_key;

ALTER TABLE contacts
  ADD CONSTRAINT contacts_user_id_org_id_email_key UNIQUE (user_id, org_id, email);

-- ============================================================================
-- STEP 6: Add index on contacts(org_id) for efficient org-scoped queries
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_contacts_org_id ON contacts(org_id);
CREATE INDEX IF NOT EXISTS idx_contacts_user_org ON contacts(user_id, org_id);
CREATE INDEX IF NOT EXISTS idx_contact_appearances_org_id ON contact_call_appearances(org_id);

-- ============================================================================
-- STEP 7: Drop and recreate RLS policies on contacts
-- New policy: user must own the row (user_id = auth.uid()) AND must be a member
-- of the org (is_organization_member). This prevents cross-org data bleed.
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can insert their own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can update their own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can delete their own contacts" ON contacts;

-- SELECT: user owns the row AND belongs to the org
CREATE POLICY "Users can view their own contacts"
  ON contacts FOR SELECT
  USING (
    auth.uid() = user_id
    AND is_organization_member(org_id, auth.uid())
  );

-- INSERT: user is setting themselves as owner AND belongs to the org
CREATE POLICY "Users can insert their own contacts"
  ON contacts FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND is_organization_member(org_id, auth.uid())
  );

-- UPDATE: user owns the row AND belongs to the org
CREATE POLICY "Users can update their own contacts"
  ON contacts FOR UPDATE
  USING (
    auth.uid() = user_id
    AND is_organization_member(org_id, auth.uid())
  );

-- DELETE: user owns the row AND belongs to the org
CREATE POLICY "Users can delete their own contacts"
  ON contacts FOR DELETE
  USING (
    auth.uid() = user_id
    AND is_organization_member(org_id, auth.uid())
  );

-- ============================================================================
-- STEP 8: Drop and recreate RLS policies on contact_call_appearances
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their contact appearances" ON contact_call_appearances;
DROP POLICY IF EXISTS "Users can insert their contact appearances" ON contact_call_appearances;
DROP POLICY IF EXISTS "Users can delete their contact appearances" ON contact_call_appearances;

-- SELECT: user owns the row AND belongs to the org
CREATE POLICY "Users can view their contact appearances"
  ON contact_call_appearances FOR SELECT
  USING (
    auth.uid() = user_id
    AND is_organization_member(org_id, auth.uid())
  );

-- INSERT: user is setting themselves as owner AND belongs to the org
CREATE POLICY "Users can insert their contact appearances"
  ON contact_call_appearances FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND is_organization_member(org_id, auth.uid())
  );

-- DELETE: user owns the row AND belongs to the org
CREATE POLICY "Users can delete their contact appearances"
  ON contact_call_appearances FOR DELETE
  USING (
    auth.uid() = user_id
    AND is_organization_member(org_id, auth.uid())
  );

-- ============================================================================
-- STEP 9: Update onConflict targets — the upsert in useContacts uses
-- "contact_id,recording_id,user_id" which matches the existing PK and is
-- unchanged, so no additional migration needed for that.
-- ============================================================================

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
