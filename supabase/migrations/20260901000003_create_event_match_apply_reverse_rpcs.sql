-- Migration: Atomic apply/reverse RPC pair for event-resolution merge decisions
-- Purpose: Proves MATCH-10 (every merge is reversible in one atomic operation, with
--          the reversal recorded in the same ledger), mirroring split_recording_atomic's
--          transactional shape exactly. Built and proven by a DIRECT integration test
--          (Plan 02, Task 2) -- these functions are NEVER called by the automatic shadow
--          sweep (resolve-events / runShadowSweep). That boundary is SAFE-02's entire
--          guarantee; see the function comments below for the explicit warning.
-- Author: Claude (GSD Phase 31 Plan 02 executor)
-- Date: 2026-09-01

-- ============================================================================
-- 0. SCHEMA COMPATIBILITY FIX: scope event_match_decisions' UNIQUE constraint
--    to proposals only (Rule 1 bug fix, found while building this migration)
-- ============================================================================
-- 20260901000002 (Plan 01) declared UNIQUE (recording_id_a, recording_id_b, tier)
-- table-wide. That was correct for its own purpose -- Pattern 3 idempotency for the
-- shadow sweep's merge_proposed inserts -- but it also makes it structurally
-- impossible for a SECOND row (e.g. this migration's merge_applied row, or a later
-- reversed row) to ever exist for the same pair+tier once a first row is there,
-- which contradicts this exact migration's job: proving a merge can be applied AND
-- reversed, each producing its own ledger row for the same pair (31-RESEARCH.md:
-- "reversal recorded in the same ledger"; 20260901000002's own column comment:
-- "...has somewhere to record which event a decision resolved into"). Verified live
-- on TEST before authoring this fix: the table-wide UNIQUE constraint is named
-- event_match_decisions_recording_id_a_recording_id_b_tier_key
-- (pg_get_constraintdef: UNIQUE (recording_id_a, recording_id_b, tier)).
--
-- Fix: replace the table-wide UNIQUE constraint with a partial unique index scoped
-- to decision = 'merge_proposed'. This preserves EXACTLY the same protection the
-- sweep relies on (at most one merge_proposed row per pair+tier, still idempotent
-- under concurrent/overlapping sweep ticks -- 31-RESEARCH.md Pattern 3), while
-- allowing a merge_applied row and a reversed row to coexist for that same
-- pair+tier, which apply_event_match_atomic / reverse_event_match_atomic below
-- require.

ALTER TABLE event_match_decisions
  DROP CONSTRAINT IF EXISTS event_match_decisions_recording_id_a_recording_id_b_tier_key;

CREATE UNIQUE INDEX IF NOT EXISTS event_match_decisions_proposed_pair_tier_key
  ON event_match_decisions (recording_id_a, recording_id_b, tier)
  WHERE decision = 'merge_proposed';

COMMENT ON INDEX event_match_decisions_proposed_pair_tier_key IS
  'Scoped replacement for the original table-wide UNIQUE(recording_id_a, '
  'recording_id_b, tier) from 20260901000002. Preserves the shadow sweep''s '
  'merge_proposed idempotency (31-RESEARCH.md Pattern 3) while allowing a '
  'merge_applied row (apply_event_match_atomic) and a reversed row '
  '(reverse_event_match_atomic) to coexist for the same pair+tier.';

-- ============================================================================
-- 1. FUNCTION: apply_event_match_atomic
-- ============================================================================
-- Atomically applies a merge decision: resolves (or creates) the target event,
-- sets event_id on BOTH recordings, and writes a merge_applied ledger row -- all
-- in one transaction. Ownership of BOTH recordings validated BY PARAMETER
-- (mirrors split_recording_atomic's NOT EXISTS idiom exactly -- correctly denies
-- when owner_user_id IS NULL too, unlike a raw <> comparison), never auth.uid(),
-- since this RPC is called with the service role key (auth.uid() is NULL there).

CREATE OR REPLACE FUNCTION public.apply_event_match_atomic(
  p_recording_id_a UUID,
  p_recording_id_b UUID,
  p_event_id       UUID,
  p_decided_by     TEXT,
  p_signals        JSONB,
  p_owner_user_id  UUID
)
RETURNS UUID  -- UUID of the event both recordings now belong to
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
  v_pair_a   UUID;
  v_pair_b   UUID;
  v_start_a  TIMESTAMPTZ;
  v_end_a    TIMESTAMPTZ;
  v_start_b  TIMESTAMPTZ;
  v_end_b    TIMESTAMPTZ;
BEGIN
  -- Ownership validated BY PARAMETER against BOTH recordings.
  IF NOT EXISTS (
    SELECT 1 FROM recordings WHERE id = p_recording_id_a AND owner_user_id = p_owner_user_id
  ) THEN
    RAISE EXCEPTION 'Access denied: not the owner of recording %', p_recording_id_a;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM recordings WHERE id = p_recording_id_b AND owner_user_id = p_owner_user_id
  ) THEN
    RAISE EXCEPTION 'Access denied: not the owner of recording %', p_recording_id_b;
  END IF;

  -- 1. Resolve (or create) the target event. canonical_start_time/end_time are
  --    derived from the two recordings being merged -- earliest start, latest
  --    end across the pair. LEAST/GREATEST ignore NULL arguments unless both
  --    are NULL, in which case the column stays NULL (honest, not fabricated).
  SELECT recording_start_time, recording_end_time INTO v_start_a, v_end_a
    FROM recordings WHERE id = p_recording_id_a;
  SELECT recording_start_time, recording_end_time INTO v_start_b, v_end_b
    FROM recordings WHERE id = p_recording_id_b;

  IF p_event_id IS NULL THEN
    INSERT INTO events (canonical_start_time, canonical_end_time, resolution_confidence)
    VALUES (
      LEAST(v_start_a, v_start_b),
      GREATEST(v_end_a, v_end_b),
      NULL
    )
    RETURNING id INTO v_event_id;
  ELSE
    v_event_id := p_event_id;
  END IF;

  -- 2. Set BOTH recordings' event_id in one statement -- one transaction,
  --    all-or-nothing (MATCH-10's atomicity guarantee).
  UPDATE recordings
  SET event_id = v_event_id, updated_at = NOW()
  WHERE id IN (p_recording_id_a, p_recording_id_b);

  -- 3. Canonically order the pair (a < b), matching
  --    event_match_decisions_pair_ordered and the shadow sweep's own ordering.
  IF p_recording_id_a < p_recording_id_b THEN
    v_pair_a := p_recording_id_a;
    v_pair_b := p_recording_id_b;
  ELSE
    v_pair_a := p_recording_id_b;
    v_pair_b := p_recording_id_a;
  END IF;

  -- 4. Ledger row: this decision is now applied (MATCH-09 + MATCH-10).
  INSERT INTO event_match_decisions (
    recording_id_a, recording_id_b, event_id, tier, score, signals,
    decision, decided_by, applied
  ) VALUES (
    v_pair_a, v_pair_b, v_event_id, 'deterministic', NULL, COALESCE(p_signals, '{}'::jsonb),
    'merge_applied', p_decided_by, true
  );

  RETURN v_event_id;
END;
$$;

COMMENT ON FUNCTION public.apply_event_match_atomic IS
  'Atomically applies a merge decision: sets event_id on BOTH recordings to one '
  'event (creating it if p_event_id is NULL) and writes a merge_applied ledger '
  'row, all in one transaction (MATCH-10). Service-role only -- REVOKE EXECUTE '
  'FROM PUBLIC/anon/authenticated below. Ownership of BOTH recordings validated '
  'BY PARAMETER, never auth.uid(). Built and proven by a direct integration test '
  '(Plan 02); this function MUST NEVER be called by the automatic shadow sweep '
  '(resolve-events / runShadowSweep) -- that boundary is SAFE-02''s entire '
  'guarantee. The sweep only ever proposes (event_match_decisions inserts with '
  'decision=''merge_proposed'', applied=false); it does not import or reference '
  'this function.';

-- ============================================================================
-- 2. FUNCTION: reverse_event_match_atomic
-- ============================================================================
-- Atomically reverses a previously applied merge decision: nulls out event_id on
-- BOTH recordings and writes a reversed ledger row referencing the decision it
-- undoes -- all in one transaction. Same ownership-by-parameter guard as apply.

CREATE OR REPLACE FUNCTION public.reverse_event_match_atomic(
  p_decision_id   UUID,
  p_owner_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recording_id_a UUID;
  v_recording_id_b UUID;
  v_tier           TEXT;
  v_decision       TEXT;
BEGIN
  -- Load the referenced decision. Reversal only makes sense against a decision
  -- that is actually an applied merge.
  SELECT recording_id_a, recording_id_b, tier, decision
    INTO v_recording_id_a, v_recording_id_b, v_tier, v_decision
    FROM event_match_decisions
    WHERE id = p_decision_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No such decision: %', p_decision_id;
  END IF;

  IF v_decision <> 'merge_applied' THEN
    RAISE EXCEPTION 'Decision % is not an applied merge (decision=%), nothing to reverse',
      p_decision_id, v_decision;
  END IF;

  -- Ownership validated BY PARAMETER against BOTH recordings in the pair, never
  -- auth.uid() -- same NOT EXISTS idiom as apply_event_match_atomic.
  IF NOT EXISTS (
    SELECT 1 FROM recordings WHERE id = v_recording_id_a AND owner_user_id = p_owner_user_id
  ) THEN
    RAISE EXCEPTION 'Access denied: not the owner of recording %', v_recording_id_a;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM recordings WHERE id = v_recording_id_b AND owner_user_id = p_owner_user_id
  ) THEN
    RAISE EXCEPTION 'Access denied: not the owner of recording %', v_recording_id_b;
  END IF;

  -- 1. Null out BOTH recordings' event_id in one statement -- one transaction,
  --    all-or-nothing.
  UPDATE recordings
  SET event_id = NULL, updated_at = NOW()
  WHERE id IN (v_recording_id_a, v_recording_id_b);

  -- 2. Ledger row: a reversal, referencing the decision it undoes.
  --    decided_by is fixed to 'admin' -- this RPC is never reachable from any
  --    automatic path (never called by the sweep, SAFE-02) and its locked
  --    signature (31-01 Task 1 gate) carries no actor-role parameter; every
  --    caller of a service-role-only reversal capability is an admin action by
  --    construction.
  INSERT INTO event_match_decisions (
    recording_id_a, recording_id_b, event_id, tier, score, signals,
    decision, decided_by, applied, reverses_decision_id
  ) VALUES (
    v_recording_id_a, v_recording_id_b, NULL, v_tier, NULL, '{}'::jsonb,
    'reversed', 'admin', false, p_decision_id
  );
END;
$$;

COMMENT ON FUNCTION public.reverse_event_match_atomic IS
  'Atomically reverses a previously applied merge decision: sets event_id back '
  'to NULL on BOTH recordings and writes a reversed ledger row whose '
  'reverses_decision_id points at the applied decision, all in one transaction '
  '(MATCH-10). Service-role only -- REVOKE EXECUTE FROM PUBLIC/anon/authenticated '
  'below. Ownership of BOTH recordings validated BY PARAMETER, never auth.uid(). '
  'Built and proven by a direct integration test (Plan 02); this function MUST '
  'NEVER be called by the automatic shadow sweep -- SAFE-02.';

-- ============================================================================
-- 3. PERMISSIONS
-- ============================================================================
-- Revoke direct execution from all non-service roles, mirroring
-- split_recording_atomic (20260309220000) exactly. Both functions are SECURITY
-- DEFINER and must only be reachable via a service-role caller -- without this,
-- any authenticated user could call them directly via PostgREST and pass an
-- arbitrary p_owner_user_id, defeating the ownership-by-parameter check.

REVOKE EXECUTE ON FUNCTION public.apply_event_match_atomic FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_event_match_atomic FROM anon;
REVOKE EXECUTE ON FUNCTION public.apply_event_match_atomic FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.reverse_event_match_atomic FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reverse_event_match_atomic FROM anon;
REVOKE EXECUTE ON FUNCTION public.reverse_event_match_atomic FROM authenticated;
-- (The service role bypasses EXECUTE grants, so a future admin-review edge
-- function's calls -- and this plan's direct integration test -- still work.)

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
