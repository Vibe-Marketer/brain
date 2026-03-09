-- Drop legacy coach/team helper functions
-- The underlying tables (coach_relationships, coach_shares, coach_notes,
-- teams, team_memberships, team_shares, manager_notes) do NOT exist in the database.
-- These orphaned functions reference the non-existent team_memberships table.

DROP FUNCTION IF EXISTS public.is_active_team_member(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_team_admin(uuid, uuid);
