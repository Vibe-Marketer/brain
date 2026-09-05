-- Migration: kill_switch_revert_event_merges idempotency fix (CR-03)
-- Purpose: 32-REVIEW.md CR-03 -- kill_switch_revert_event_merges was not
--          idempotent under retry. The original migration
--          (20260902000002) selected on emd.decision = 'merge_applied' and
--          inserted a new 'reversed' ledger row per match, but never
--          excluded decisions that had ALREADY been reverted. Because the
--          original decision row's `decision` column is (correctly, per
--          this ledger's append-only design -- see
--          apply_event_match_atomic/reverse_event_match_atomic,
--          20260901000003, which never mutate a decision row after writing
--          it either) left as 'merge_applied' forever, a second call over
--          the same (or any overlapping) time window + org re-selected the
--          same already-reverted decisions and wrote a SECOND 'reversed'
--          ledger row per pair, with revertedCount over-reporting reversals
--          that did not actually happen. This is a "break glass" bulk-admin
--          tool -- exactly the kind of action retried under incident
--          pressure (timeout with unclear success, accidental double-submit,
--          a script retrying on a 5xx) -- so non-idempotency here is a real
--          risk for the one tool whose entire purpose is being a trustworthy
--          undo button.
--
--          Fix (matches this ledger's established append-only convention --
--          NEVER mutate a decision row after writing it, ONLY ever insert a
--          new row referencing it): add a NOT EXISTS guard to the cursor
--          SELECT excluding any decision that already has a 'reversed' row
--          pointing at it via reverses_decision_id. Also adds a FOR UPDATE OF
--          row lock on the cursor SELECT, which the same review finding
--          named as a secondary gap (no lock meant two concurrent kill-switch
--          invocations over overlapping windows could race). The row lock
--          serializes concurrent invocations against the same candidate
--          decisions -- a second, overlapping call now blocks until the
--          first's transaction commits before evaluating the NOT EXISTS
--          guard, rather than running fully unserialized against a stale
--          snapshot.
--
--          This is a NEW additive migration -- 20260902000002 is NOT
--          edited, per this repo's migration convention (never rewrite an
--          already-applied migration file).
-- Author: Claude (GSD executor, CR-02/CR-03 remediation)
-- Date: 2026-09-05

-- ============================================================================
-- FUNCTION: kill_switch_revert_event_merges (CREATE OR REPLACE -- idempotency fix)
-- ============================================================================
-- Same signature, same RETURNS INTEGER, same SECURITY DEFINER / search_path
-- pinning as the original (20260902000002). CREATE OR REPLACE preserves the
-- function's existing REVOKE EXECUTE grants (Postgres does not reset ACLs on
-- a same-signature replace), but this migration re-asserts them explicitly
-- below anyway, matching this repo's existing belt-and-suspenders convention
-- for every SECURITY DEFINER function in this ledger (apply/reverse RPCs and
-- the original kill-switch migration both do this).
--
-- Behavior change from the original: the cursor SELECT now (a) excludes any
-- decision that already has a 'reversed' row referencing it
-- (reverses_decision_id) -- restores idempotency under retry -- and (b) locks
-- the candidate rows via FOR UPDATE OF emd -- narrows the adjacent concurrent-
-- invocation race window. Everything else (time-range guard, org filter via
-- recording_id_a, the UPDATE...SET event_id = NULL, the reversed-row INSERT
-- shape, the returned count) is UNCHANGED from the original.

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
      -- CR-03 idempotency guard: skip any decision that has ALREADY been
      -- reverted (a 'reversed' row somewhere in the ledger references it via
      -- reverses_decision_id). Append-only-preserving -- the original
      -- merge_applied row is never mutated; this is a pure anti-join.
      AND NOT EXISTS (
        SELECT 1 FROM event_match_decisions rev
        WHERE rev.reverses_decision_id = emd.id
      )
    -- CR-03 concurrency hardening: lock each candidate ledger row so a
    -- second, concurrent kill-switch invocation over an overlapping window
    -- blocks on this row until this transaction commits (or rolls back)
    -- before it can proceed, rather than racing unserialized.
    FOR UPDATE OF emd
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
  'IDEMPOTENT under retry (32-REVIEW.md CR-03 fix, 20260905120000): the '
  'cursor SELECT excludes any decision that already has a reversed row '
  'referencing it, and locks candidate rows via FOR UPDATE OF emd so a '
  'concurrent overlapping invocation serializes against this one. '
  'Deliberately has NO per-caller ownership check (unlike '
  'reverse_event_match_atomic) -- a bulk admin action spans potentially many '
  'different owners; authorization is service-role-only via REVOKE EXECUTE '
  'below. The HALT half of the kill switch (stop the sweep proposing/applying '
  'further) is the existing organization_feature_flags ''event_resolution'' '
  'row -- no new flag/table added by this migration.';

-- ============================================================================
-- PERMISSIONS
-- ============================================================================
-- Re-asserted defensively. CREATE OR REPLACE already preserves the original
-- migration's REVOKE grants (same name+signature+OID), but every SECURITY
-- DEFINER function in this ledger re-declares its REVOKEs in its own
-- migration file so each file is self-contained and provably correct by
-- reading it alone, mirroring 20260902000002 and 20260901000003.

REVOKE EXECUTE ON FUNCTION public.kill_switch_revert_event_merges FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.kill_switch_revert_event_merges FROM anon;
REVOKE EXECUTE ON FUNCTION public.kill_switch_revert_event_merges FROM authenticated;
-- (The service role bypasses EXECUTE grants, so this repo's direct
-- integration test -- and any future admin-review edge function -- still
-- works.)

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
