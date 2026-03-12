-- Migration: Security — SET search_path on SECURITY DEFINER functions + fix grants
-- Purpose: Add SET search_path = public to all SECURITY DEFINER functions that
--          are missing it, and revoke anon grant from get_indexed_recording_count.
--          Prevents search_path injection attacks on privilege-escalated functions.
-- Closes: #81
-- Date: 2026-03-09
-- Note: All ALTER FUNCTION calls wrapped in DO blocks to skip safely if function
--       was removed by a later migration.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'is_active_team_member') THEN
    ALTER FUNCTION public.is_active_team_member(UUID, UUID) SET search_path = public;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'is_team_admin') THEN
    ALTER FUNCTION public.is_team_admin(UUID, UUID) SET search_path = public;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'is_manager_of') THEN
    ALTER FUNCTION public.is_manager_of(UUID, UUID) SET search_path = public;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'would_create_circular_hierarchy') THEN
    ALTER FUNCTION public.would_create_circular_hierarchy(UUID, UUID) SET search_path = public;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'get_indexed_recording_count') THEN
    ALTER FUNCTION public.get_indexed_recording_count(UUID) SET search_path = public;
    REVOKE EXECUTE ON FUNCTION public.get_indexed_recording_count(UUID) FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.get_indexed_recording_count(UUID) FROM anon;
    GRANT EXECUTE ON FUNCTION public.get_indexed_recording_count(UUID) TO authenticated;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'get_import_counts') THEN
    ALTER FUNCTION public.get_import_counts(UUID) SET search_path = public;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'update_routing_rule_priorities') THEN
    ALTER FUNCTION public.update_routing_rule_priorities(UUID, UUID[]) SET search_path = public;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'check_and_increment_rate_limit') THEN
    ALTER FUNCTION public.check_and_increment_rate_limit(UUID, VARCHAR, INTEGER, INTEGER, TIMESTAMPTZ) SET search_path = public;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'jsonb_merge_source_metadata') THEN
    ALTER FUNCTION public.jsonb_merge_source_metadata(UUID, JSONB) SET search_path = public;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'get_admin_cost_summary') THEN
    ALTER FUNCTION public.get_admin_cost_summary(TEXT) SET search_path = public;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'get_user_email') THEN
    ALTER FUNCTION public.get_user_email(UUID) SET search_path = public;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'manual_google_poll_sync') THEN
    ALTER FUNCTION public.manual_google_poll_sync() SET search_path = public;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'delete_recording') THEN
    ALTER FUNCTION public.delete_recording(UUID) SET search_path = public;
  END IF;
END $$;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
