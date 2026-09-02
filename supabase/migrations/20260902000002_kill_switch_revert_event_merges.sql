-- Migration: Kill-switch bulk-reversal RPC for applied event merges
-- Purpose: SAFE-03 -- an admin can revert every applied event merge inside a
--          time range in a single atomic operation, each reversal recorded in
--          the ledger. Extends reverse_event_match_atomic's per-decision
--          reversal logic to a bulk admin action: this RPC deliberately does
--          NOT check ownership per decision (32-RESEARCH.md Pitfall 3 -- a
--          bulk admin action spans potentially many different owners, so a
--          single-owner-by-parameter check does not fit); authorization is
--          service-role-only via REVOKE EXECUTE below, mirroring
--          apply_event_match_atomic / reverse_event_match_atomic exactly.
--
--          The kill switch has TWO halves (32-RESEARCH.md Pitfall 3):
--            1. HALT (stop the sweep proposing/applying further) -- already
--               achieved by the existing organization_feature_flags
--               'event_resolution' row: set enabled=false for an org and the
--               sweep (resolve-events/index.ts) skips it on its next tick.
--               No new flag/table is needed for this half.
--            2. REVERT (undo already-applied merges in a time range, in one
--               operation) -- this migration's sole deliverable.
--          This migration does NOT create any new table.
-- Author: Claude (GSD Phase 32 Plan 03 executor)
-- Date: 2026-09-02

-- ============================================================================
-- FUNCTION: kill_switch_revert_event_merges
-- ============================================================================
-- Reverts every decision='merge_applied' row whose created_at falls inside
-- [p_start_time, p_end_time] (optionally scoped to one organization via the
-- pair's recording_id_a -> recordings.organization_id), all inside one
-- PL/pgSQL function body -- one implicit transaction, satisfying SAFE-03's
-- "in one operation" wording (mirrors apply_event_match_atomic /
-- reverse_event_match_atomic's atomicity). For each matching decision: nulls
-- out event_id on both recordings in the pair, and inserts a 'reversed'
-- ledger row referencing the decision it undoes (reverses_decision_id) --
-- same shape reverse_event_match_atomic writes, decided_by='admin' (this is
-- always an admin bulk action, never automated -- MATCH-10/31-02 precedent).
-- Returns the count of decisions reverted.

CREATE OR REPLACE FUNCTION public.kill_switch_revert_event_merges(
  p_start_time      TIMESTAMPTZ,
  p_end_time        TIMESTAMPTZ,
  p_organization_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec   RECORD;
  v_count INTEGER := 0;
BEGIN
  IF p_start_time > p_end_time THEN
    RAISE EXCEPTION 'p_start_time (%) must be <= p_end_time (%)', p_start_time, p_end_time;
  END IF;

  FOR v_rec IN
    SELECT emd.id, emd.recording_id_a, emd.recording_id_b, emd.tier
    FROM event_match_decisions emd
    JOIN recordings r ON r.id = emd.recording_id_a
    WHERE emd.decision = 'merge_applied'
      AND emd.created_at >= p_start_time
      AND emd.created_at <= p_end_time
      AND (p_organization_id IS NULL OR r.organization_id = p_organization_id)
  LOOP
    UPDATE recordings
    SET event_id = NULL, updated_at = NOW()
    WHERE id IN (v_rec.recording_id_a, v_rec.recording_id_b);

    INSERT INTO event_match_decisions (
      recording_id_a, recording_id_b, event_id, tier, score, signals,
      decision, decided_by, applied, reverses_decision_id
    ) VALUES (
      v_rec.recording_id_a, v_rec.recording_id_b, NULL, v_rec.tier, NULL, '{}'::jsonb,
      'reversed', 'admin', false, v_rec.id
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.kill_switch_revert_event_merges IS
  'SAFE-03: bulk-reverts every merge_applied event_match_decisions row whose '
  'created_at falls in [p_start_time, p_end_time] (optionally scoped to one '
  'organization via p_organization_id), all inside one PL/pgSQL invocation -- '
  'one implicit transaction. Nulls event_id on both recordings per decision '
  'and writes a reversed ledger row (decided_by=''admin'', '
  'reverses_decision_id set) per reversal. Returns the count reverted. '
  'Deliberately has NO per-caller ownership check (unlike '
  'reverse_event_match_atomic) -- a bulk admin action spans potentially many '
  'different owners; authorization is service-role-only via REVOKE EXECUTE '
  'below. The HALT half of the kill switch (stop the sweep proposing/applying '
  'further) is the existing organization_feature_flags ''event_resolution'' '
  'row set enabled=false -- no new flag/table added by this migration.';

-- ============================================================================
-- PERMISSIONS
-- ============================================================================
-- Service-role-only, mirroring apply_event_match_atomic /
-- reverse_event_match_atomic (20260901000003) exactly. Without this, any
-- authenticated user could call a bulk reversal via PostgREST directly.

REVOKE EXECUTE ON FUNCTION public.kill_switch_revert_event_merges FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.kill_switch_revert_event_merges FROM anon;
REVOKE EXECUTE ON FUNCTION public.kill_switch_revert_event_merges FROM authenticated;
-- (The service role bypasses EXECUTE grants, so this plan's direct
-- integration test -- and any future admin-review edge function -- still
-- works.)

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
