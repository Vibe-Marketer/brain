-- Migration: Security — SET search_path on SECURITY DEFINER functions + fix grants
-- Purpose: Add SET search_path = public to all SECURITY DEFINER functions that
--          are missing it, and revoke anon grant from get_indexed_recording_count.
--          Prevents search_path injection attacks on privilege-escalated functions.
-- Closes: #81
-- Date: 2026-03-09

-- ============================================================================
-- 1. is_active_team_member — RLS helper (team memberships)
-- ============================================================================
ALTER FUNCTION public.is_active_team_member(UUID, UUID) SET search_path = public;

-- ============================================================================
-- 2. is_team_admin — RLS helper (team admin check)
-- ============================================================================
ALTER FUNCTION public.is_team_admin(UUID, UUID) SET search_path = public;

-- ============================================================================
-- 3. is_manager_of — manager relationship check
-- ============================================================================
ALTER FUNCTION public.is_manager_of(UUID, UUID) SET search_path = public;

-- ============================================================================
-- 4. would_create_circular_hierarchy — hierarchy cycle detection
-- ============================================================================
ALTER FUNCTION public.would_create_circular_hierarchy(UUID, UUID) SET search_path = public;

-- ============================================================================
-- 5. get_indexed_recording_count — transcript chunk stats
--    Also revoke anon access (issue: unauthenticated users could query counts)
-- ============================================================================
ALTER FUNCTION public.get_indexed_recording_count(UUID) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.get_indexed_recording_count(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_indexed_recording_count(UUID) FROM anon;
-- Re-grant only to authenticated (the intended audience)
GRANT EXECUTE ON FUNCTION public.get_indexed_recording_count(UUID) TO authenticated;

-- ============================================================================
-- 6. get_import_counts — import source stats
-- ============================================================================
ALTER FUNCTION public.get_import_counts(UUID) SET search_path = public;

-- ============================================================================
-- 7. update_routing_rule_priorities — reorder routing rules
-- ============================================================================
ALTER FUNCTION public.update_routing_rule_priorities(UUID, UUID[]) SET search_path = public;

-- ============================================================================
-- 8. check_and_increment_rate_limit — rate limiting helper
-- ============================================================================
ALTER FUNCTION public.check_and_increment_rate_limit(UUID, VARCHAR, INTEGER, INTEGER, TIMESTAMPTZ) SET search_path = public;

-- ============================================================================
-- 9. jsonb_merge_source_metadata — metadata merge for routing
-- ============================================================================
ALTER FUNCTION public.jsonb_merge_source_metadata(UUID, JSONB) SET search_path = public;

-- ============================================================================
-- 10. get_admin_cost_summary — admin cost dashboard
-- ============================================================================
ALTER FUNCTION public.get_admin_cost_summary(TEXT) SET search_path = public;

-- ============================================================================
-- 11. get_user_email — email lookup from auth.users
-- ============================================================================
ALTER FUNCTION public.get_user_email(UUID) SET search_path = public;

-- ============================================================================
-- 12. manual_google_poll_sync — manual trigger for Google poll
-- ============================================================================
ALTER FUNCTION public.manual_google_poll_sync() SET search_path = public;

-- ============================================================================
-- 13. delete_recording — cascade delete recording + related data
-- ============================================================================
ALTER FUNCTION public.delete_recording(UUID) SET search_path = public;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
