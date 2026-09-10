-- Migration: Create reconcile_transcript_segments_atomic RPC
-- Purpose: WR-02 code-review fix (37-REVIEW.md) -- reconcile-transcripts'
--          per-event write path was two independent REST calls
--          (supabase.from(...).delete() then, if freshRows.length > 0,
--          .insert()), not wrapped in a database transaction and not
--          guarded by any lock keyed on event_id. Two overlapping sweep
--          invocations for the same event (e.g. a cron-triggered run and a
--          manually-triggered run) could interleave their delete/insert
--          calls, producing duplicate segment rows (no UNIQUE constraint
--          exists to reject a duplicate insert -- Pitfall 5's documented
--          intentional trade-off) or, in a worse interleaving, one run's
--          delete firing after the other's insert, leaving the event with
--          zero or partial rows.
--
--          This RPC wraps the delete+insert in a single transaction AND
--          serializes concurrent invocations for the SAME event via
--          pg_advisory_xact_lock(hashtext(event_id::text)) -- the lock is
--          automatically released when the transaction (and therefore the
--          function call) completes, so a second overlapping invocation for
--          the same event simply blocks until the first one's delete+insert
--          has fully committed, then proceeds against the now-consistent
--          state. Different events use different lock keys (hashtext of a
--          different UUID) so concurrent sweeps across DIFFERENT events are
--          never serialized against each other -- only same-event overlap is
--          guarded.
--
--          SECURITY DEFINER, service-role-only (mirrors the table's own
--          "Service role full access" ALL policy -- this RPC does not widen
--          write access beyond what direct table access already permits for
--          service_role; it only makes that access atomic+serialized).
--
-- Deploy note: reconcile-transcripts (the edge function) is already live in
--          production and calls the old two-REST-call delete+insert path.
--          This migration and the corresponding index.ts change to call this
--          RPC instead require the SAME guarded-apply discipline as every
--          other prod change in this milestone -- NOT applied to production
--          by this fix. See 37-REVIEW-FIX.md.
--
-- Author: Claude (GSD Phase 37 code-review fixer)
-- Date: 2026-09-10

CREATE OR REPLACE FUNCTION public.reconcile_transcript_segments_atomic(
  p_event_id UUID,
  p_organization_id UUID,
  p_rows JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Serialize concurrent invocations for the SAME event only. The lock is a
  -- transaction-scoped advisory lock (auto-released at COMMIT/ROLLBACK of
  -- this function's implicit transaction), never held past this call.
  PERFORM pg_advisory_xact_lock(hashtext(p_event_id::text));

  DELETE FROM reconciled_transcript_segments WHERE event_id = p_event_id;

  IF jsonb_array_length(p_rows) > 0 THEN
    INSERT INTO reconciled_transcript_segments (
      event_id, segment_text, start_time, end_time,
      source_recording_ids, agreeing_recording_ids, signals, organization_id
    )
    SELECT
      p_event_id,
      r->>'segment_text',
      NULLIF(r->>'start_time', '')::TIMESTAMPTZ,
      NULLIF(r->>'end_time', '')::TIMESTAMPTZ,
      ARRAY(SELECT jsonb_array_elements_text(r->'source_recording_ids'))::UUID[],
      ARRAY(SELECT jsonb_array_elements_text(r->'agreeing_recording_ids'))::UUID[],
      COALESCE(r->'signals', '{}'::JSONB),
      p_organization_id
    FROM jsonb_array_elements(p_rows) AS r;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.reconcile_transcript_segments_atomic(UUID, UUID, JSONB) IS
  'WR-02 fix: atomic, per-event-serialized delete+rebuild for '
  'reconciled_transcript_segments. Wraps the full delete-then-insert in one '
  'transaction and holds a pg_advisory_xact_lock keyed on event_id so '
  'overlapping sweep invocations for the same event cannot interleave their '
  'writes. service_role only -- mirrors the table''s own RLS write policy, '
  'does not widen access.';

-- service_role only -- same write surface the table's own RLS policy already
-- grants; this RPC makes that surface atomic, it does not widen it.
-- Supabase's project-level default privileges grant EXECUTE on new functions
-- directly to anon/authenticated (not merely via the PUBLIC pseudo-role), so
-- REVOKE ... FROM PUBLIC alone is insufficient -- each role must be revoked
-- explicitly, mirroring the merge_organizations_atomic/unclaim_organization_domain_atomic
-- precedent (20260908140001_create_org_merge_unclaim_admin_rpcs.sql).
REVOKE EXECUTE ON FUNCTION public.reconcile_transcript_segments_atomic(UUID, UUID, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reconcile_transcript_segments_atomic(UUID, UUID, JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reconcile_transcript_segments_atomic(UUID, UUID, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_transcript_segments_atomic(UUID, UUID, JSONB) TO service_role;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
