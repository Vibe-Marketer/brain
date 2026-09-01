-- Migration: Fix events RLS participation grant + add missing updated_at trigger
-- Purpose: Gap-closure for Phase 30 code review findings CR-01 and WR-03.
--
-- CR-01 (Critical, empirically proven against TEST project swjzxiddcrtaqixsfaac):
-- The "participants_and_owners_can_view_events" SELECT policy on `events`
-- (20260831000001_create_events_and_extend_participants.sql) queries
-- call_participants directly from an EXISTS subquery. call_participants has
-- its own FORCE ROW LEVEL SECURITY policy ("Organization members can view
-- call participants", 20260309120000_call_participants.sql) that restricts
-- SELECT to organization members only — not to the participant themselves.
-- Postgres applies that policy to the subquery under the querying role, so a
-- real participant who is NOT a member of the recording's organization can
-- never see the event via the participation grant, even though EVT-04's
-- entire design intent is that `events` visibility should never be
-- org-scoped. The ownership grant (via recordings.owner_user_id) is
-- unaffected — only participation is broken.
--
-- Fix: a SECURITY DEFINER helper function, mirroring the codebase's own
-- existing precedent for exactly this cross-table-RLS problem
-- (is_organization_member, 20260301000001_rename_vaults_to_workspaces.sql).
-- The helper reads call_participants under definer privileges, bypassing
-- call_participants' own RLS for this narrow, single-purpose check, so the
-- events policy's participation branch is actually reachable.
--
-- WR-03 (Warning): events.updated_at had no refresh trigger, unlike every
-- other timestamped table in this schema's convention (a prior miss on
-- ai_models needed its own dedicated remediation migration,
-- 20260528070500_restore_ai_models_updated_at_trigger.sql). Zero rows exist
-- in `events` today (Phase 31 is the first writer), so this is the cheapest
-- possible time to add it.
--
-- Author: Claude (GSD Phase 30 gap closure, code review CR-01/WR-03)
-- Date: 2026-08-31

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- SECURITY DEFINER helper so the events RLS policy can check participation
-- without being gated by call_participants' own org-membership-only SELECT policy.
CREATE OR REPLACE FUNCTION public.user_participates_in_event(p_event_id uuid, p_email text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM call_participants cp
    WHERE cp.event_id = p_event_id AND cp.email = p_email
  )
$function$;

COMMENT ON FUNCTION public.user_participates_in_event(uuid, text) IS
  'SECURITY DEFINER check for events RLS: is this email a participant on this event, independent of call_participants'' own org-membership SELECT policy. Fixes Phase 30 code review CR-01.';

CREATE OR REPLACE FUNCTION public.update_events_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Replace the broken participation branch. Ownership branch (recordings.owner_user_id)
-- is untouched — it was never affected by CR-01.
DROP POLICY IF EXISTS "participants_and_owners_can_view_events" ON events;
CREATE POLICY "participants_and_owners_can_view_events"
  ON events FOR SELECT
  USING (
    public.user_participates_in_event(events.id, LOWER(auth.email()))
    OR EXISTS (
      SELECT 1 FROM recordings r
      WHERE r.event_id = events.id
        AND r.owner_user_id = auth.uid()
    )
  );

-- ============================================================================
-- TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS events_updated_at ON public.events;
CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_events_updated_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TRIGGER events_updated_at ON public.events IS
  'Refreshes updated_at on every row update. Added in Phase 30 gap closure (code review WR-03) before Phase 31 introduces the first writer.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
