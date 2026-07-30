-- TEMPORARY: disable the Team plan self-serve seat cap.
-- Ticket 81e9ee1b (filed 2026-07-27, confirmed 2026-07-30): "every person
-- that joins is automatically given PRO access ... with ZERO gates ...
-- removed or disabled." Mirrors the FREE_PRO_FOR_ALL_ENABLED flags in
-- src/hooks/useSubscription.ts, supabase/functions/mcp-server/gating.ts,
-- and supabase/functions/track-ai-usage/index.ts.
--
-- Forward-only: redefines the trigger functions as no-ops rather than
-- dropping the triggers, so re-enabling later is a single follow-up
-- migration that restores the original CHECK/RAISE bodies from
-- 20260430120000_enforce_team_member_cap.sql.

CREATE OR REPLACE FUNCTION public.enforce_team_org_invite_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_team_org_member_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_team_org_invite_cap() IS
  'TEMPORARILY DISABLED (2026-07-30, ticket 81e9ee1b) — no-op. Restore body from 20260430120000_enforce_team_member_cap.sql to re-enable the 10-seat Team cap.';
COMMENT ON FUNCTION public.enforce_team_org_member_cap() IS
  'TEMPORARILY DISABLED (2026-07-30, ticket 81e9ee1b) — no-op. Restore body from 20260430120000_enforce_team_member_cap.sql to re-enable the 10-seat Team cap.';
