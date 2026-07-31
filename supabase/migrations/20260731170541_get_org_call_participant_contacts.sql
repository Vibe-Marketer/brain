-- Migration: distinct-participant RPC to fix N+1 on the transcripts filter bar
-- Purpose: FilterBar's contact-suggestion autocomplete (fetchContactSuggestionsForOrg)
--   paginated through EVERY raw call_participants row (1000/page) just to dedupe
--   down to unique email/name pairs client-side. call_participants has one row per
--   participant PER CALL, so a repeat participant (recurring meeting attendee) adds
--   a row every time — any org with regular usage blows past 1000 rows and fires
--   4+ near-identical /rest/v1/call_participants requests in a couple seconds
--   (ticket 43eabbbe). This function does the dedup in Postgres so the client makes
--   exactly one request regardless of how many calls a participant has appeared in.
-- Author: GSD ticket 43eabbbe
-- Date: 2026-07-31

-- ============================================================================
-- FUNCTION: get_org_call_participant_contacts
-- ============================================================================
CREATE OR REPLACE FUNCTION get_org_call_participant_contacts(p_organization_id UUID)
RETURNS TABLE(email TEXT, name TEXT)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT ON (call_participants.email)
    call_participants.email,
    call_participants.name
  FROM call_participants
  WHERE call_participants.organization_id = p_organization_id
    AND call_participants.email IS NOT NULL
  ORDER BY call_participants.email, call_participants.name NULLS LAST;
$$;

-- SECURITY INVOKER (not DEFINER) so the existing call_participants RLS policy
-- ("Organization members can view call participants") still gates access —
-- this is a read convenience wrapper, not a privilege escalation.
GRANT EXECUTE ON FUNCTION get_org_call_participant_contacts(UUID) TO authenticated;

COMMENT ON FUNCTION get_org_call_participant_contacts IS
  'Returns one row per distinct non-null email in call_participants for an org (ticket 43eabbbe N+1 fix). SECURITY INVOKER — relies on the existing call_participants RLS policy for org scoping. Used by the transcripts FilterBar contact-suggestion autocomplete instead of paginating raw participant rows client-side.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
