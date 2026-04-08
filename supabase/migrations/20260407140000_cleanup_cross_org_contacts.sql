-- Migration: Clean up contacts imported from wrong org (cross-org import bug)
-- Bug: importAllContacts() had a legacy fallback that queried fathom_raw_calls
--      by user_id only (no org_id filter). When an org had no call_participants,
--      the fallback imported ALL contacts from the user's entire Fathom history
--      into the wrong org. This produced ~226 contacts in AI Simple org with
--      zero call_participants, causing all stats to show 0.
--
-- SAFETY: This migration ONLY deletes contacts that:
--   1. Live in a non-personal org
--   2. Have NO matching call_participants row in that org (proven cross-org import)
--   3. Have no manual customizations: no contact_type, no track_health, no notes, no tags
--
-- Manually created/customized contacts are preserved even if they have no
-- call_participants. Only the obviously-automated cross-org imports are removed.
--
-- Date: 2026-04-07

BEGIN;

-- ============================================================================
-- PREVIEW: Show what will be deleted (inspect before committing)
-- ============================================================================
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM contacts c
  WHERE
    -- Not in a personal org
    c.org_id NOT IN (
      SELECT o.id FROM organizations o WHERE o.type = 'personal'
    )
    -- No call_participants for this email in this org
    AND NOT EXISTS (
      SELECT 1
      FROM call_participants cp
      WHERE cp.email = c.email
        AND cp.organization_id = c.org_id
    )
    -- No manual customizations
    AND c.contact_type IS NULL
    AND (c.track_health IS NULL OR c.track_health = FALSE)
    AND c.notes IS NULL
    AND (c.tags IS NULL OR c.tags = '{}');

  RAISE NOTICE 'Will delete % cross-org imported contacts', v_count;
END;
$$;

-- ============================================================================
-- STEP 1: Delete contact_call_appearances for affected contacts
-- ============================================================================
DELETE FROM contact_call_appearances cca
WHERE cca.contact_id IN (
  SELECT c.id
  FROM contacts c
  WHERE
    c.org_id NOT IN (
      SELECT o.id FROM organizations o WHERE o.type = 'personal'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM call_participants cp
      WHERE cp.email = c.email
        AND cp.organization_id = c.org_id
    )
    AND c.contact_type IS NULL
    AND (c.track_health IS NULL OR c.track_health = FALSE)
    AND c.notes IS NULL
    AND (c.tags IS NULL OR c.tags = '{}')
);

-- ============================================================================
-- STEP 2: Delete the cross-org contacts themselves
-- ============================================================================
DELETE FROM contacts c
WHERE
  c.org_id NOT IN (
    SELECT o.id FROM organizations o WHERE o.type = 'personal'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM call_participants cp
    WHERE cp.email = c.email
      AND cp.organization_id = c.org_id
  )
  AND c.contact_type IS NULL
  AND (c.track_health IS NULL OR c.track_health = FALSE)
  AND c.notes IS NULL
  AND (c.tags IS NULL OR c.tags = '{}');

COMMIT;
