-- Migration: Restore security_invoker on recurring_call_titles
-- Purpose: Phase 32 Plan 01 (MATCH-05 substrate integrity, T-32-05). Live
--   introspection against production (`select relname, reloptions from
--   pg_class where relname = 'recurring_call_titles';`) on 2026-09-02
--   returned reloptions = NULL -- security_invoker is ABSENT. The view's
--   last redefinition (20260310125000_migrate_call_recording_id_to_uuid.sql,
--   "9. Update recurring_call_titles view to join via UUID") used
--   `DROP VIEW ... ; CREATE OR REPLACE VIEW ...` WITHOUT restating
--   `WITH (security_invoker = true)`, silently regressing the view back to
--   running as its owner -- the exact RLS-bypass class that
--   20260305000001_fix_view_rls_bypass.sql already had to fix once for this
--   same view. Without security_invoker, every authenticated user reading
--   this view sees every OTHER user's title/occurrence aggregation
--   (cross-user disclosure), and it is unsafe as MATCH-05's suppression
--   substrate until repaired.
-- Author: Phase 32 Plan 01 executor
-- Date: 2026-09-02
--
-- Scope note: this migration is applied to TEST only as part of this plan.
-- The identical statement is queued for Plan 04's guarded production apply
-- (this milestone's phases apply schema changes to prod only via the
-- explicit, checkpointed Plan-04-style guarded-apply step, never inline
-- during a "ships inert" plan).

-- ============================================================================
-- Restore security_invoker (idempotent -- no view body change)
-- ============================================================================
-- ALTER VIEW ... SET (security_invoker = true) only changes the view's
-- storage option; it does not redefine the query body, so this is safe to
-- re-run and carries zero risk of drifting the view's SELECT logic.
ALTER VIEW recurring_call_titles SET (security_invoker = true);

COMMENT ON VIEW recurring_call_titles IS
  'Per-(owner_user_id, title) occurrence aggregation across recordings, used by MATCH-05 to suppress recurring-title false-match signals. security_invoker=true restored 2026-09-02 (Phase 32 Plan 01) after the 20260310125000 UUID-join redefinition silently dropped it -- see 20260305000001_fix_view_rls_bypass.sql for the original 2026-03 incident this exact regression re-introduced.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
