-- Migration: Add p_tier parameter to apply_event_match_atomic (content-proof auto-attach)
-- Purpose: Phase 33 (MATCH-02 content-proof tier) needs apply_event_match_atomic to legally
--          write tier='content_proof' to the ledger. The prior function
--          (20260901000003_create_event_match_apply_reverse_rpcs.sql) hardcoded the literal
--          'deterministic' at its INSERT INTO event_match_decisions VALUES list -- correct when
--          only tier 1 could auto-attach (Phase 31), but Phase 33 is the first phase where a
--          second tier (content-proof) also needs auto-attach (33-RESEARCH.md Pitfall 2).
--          Adding a 7th parameter WITH A DEFAULT creates a SEPARATE overload rather than
--          replacing the existing 6-arg function's parameter list -- Postgres would resolve
--          any 6-argument call to the OLD overload, which still hardcodes 'deterministic'.
--          The old 6-arg signature is therefore explicitly DROPPED and the new 7-arg one
--          CREATEd, forcing every call through the tier-aware version. Safe: the only caller
--          anywhere is a direct integration test (event-match-apply-reverse.integration.test.ts,
--          zero production callers, verified in 33-RESEARCH.md Pitfall 2); no view/trigger
--          depends on this function.
--
--          Dropping and recreating loses the REVOKE EXECUTE grants applied by the prior
--          migration -- all three (PUBLIC/anon/authenticated) are re-issued below for the new
--          signature, or the function becomes callable by anon/authenticated via PostgREST.
--
--          Per Phase 33 Plan 01 Task 1 (option-a, approved as-is): this migration only proves
--          the SHAPE is legal. The SAFE-02 boundary is unchanged -- content-proof auto-attach
--          is a capability proven by a direct integration test (Plan 02), never called by the
--          automatic shadow sweep (resolve-events / runShadowSweep).
-- Author: Claude (GSD Phase 33 Plan 01 executor)
-- Date: 2026-09-05

-- ============================================================================
-- 1. DROP the old 6-argument signature
-- ============================================================================
-- Mandatory, not optional (see header) -- prevents a stale 6-arg overload from
-- ever silently hardcoding tier='deterministic' again.
DROP FUNCTION IF EXISTS public.apply_event_match_atomic(UUID, UUID, UUID, TEXT, JSONB, UUID);

-- ============================================================================
-- 2. CREATE the new 7-argument signature (p_tier, additive, defaulted)
-- ============================================================================
-- Body is IDENTICAL to 20260901000003's apply_event_match_atomic EXCEPT:
--   - trailing 7th parameter p_tier TEXT DEFAULT 'deterministic'
--   - a guard immediately after BEGIN validating p_tier against the same three
--     values event_match_decisions.tier's CHECK constraint already permits
--   - the INSERT INTO event_match_decisions VALUES list uses p_tier instead of
--     the literal 'deterministic'
-- reverse_event_match_atomic is untouched by this migration.

CREATE FUNCTION public.apply_event_match_atomic(
  p_recording_id_a UUID,
  p_recording_id_b UUID,
  p_event_id       UUID,
  p_decided_by     TEXT,
  p_signals        JSONB,
  p_owner_user_id  UUID,
  p_tier           TEXT DEFAULT 'deterministic'
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
  -- Reject any tier outside the set event_match_decisions.tier's CHECK
  -- constraint already permits (20260901000002 line 49). A function-level
  -- guard gives a clearer error to a future caller than waiting for the
  -- storage-layer CHECK violation.
  IF p_tier NOT IN ('deterministic', 'content_proof', 'metadata') THEN
    RAISE EXCEPTION 'Invalid tier: %', p_tier;
  END IF;

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

  -- 4. Ledger row: this decision is now applied (MATCH-09 + MATCH-10). tier is
  --    now the caller-supplied p_tier (defaults to 'deterministic' for any
  --    existing/legacy 6-argument-shaped call), not a hardcoded literal --
  --    this is the entire point of this migration.
  INSERT INTO event_match_decisions (
    recording_id_a, recording_id_b, event_id, tier, score, signals,
    decision, decided_by, applied
  ) VALUES (
    v_pair_a, v_pair_b, v_event_id, p_tier, NULL, COALESCE(p_signals, '{}'::jsonb),
    'merge_applied', p_decided_by, true
  );

  RETURN v_event_id;
END;
$$;

COMMENT ON FUNCTION public.apply_event_match_atomic IS
  'Atomically applies a merge decision: sets event_id on BOTH recordings to one '
  'event (creating it if p_event_id is NULL) and writes a merge_applied ledger '
  'row carrying tier=p_tier (default ''deterministic''), all in one transaction '
  '(MATCH-10). Service-role only -- REVOKE EXECUTE FROM PUBLIC/anon/authenticated '
  'below. Ownership of BOTH recordings validated BY PARAMETER, never auth.uid(). '
  'p_tier added in 20260905130000 (Phase 33 Plan 01) so a content-proof '
  '(tier 2) auto-attach can legally record its own tier instead of the '
  'previously-hardcoded ''deterministic'' literal; rejects any value outside '
  '(''deterministic'',''content_proof'',''metadata''). The SAFE-02 boundary is '
  'UNCHANGED by this addition: this function is still never called by the '
  'automatic shadow sweep (resolve-events / runShadowSweep) -- per Phase 33 '
  'Plan 01 option-a, content-proof auto-attach is a capability proven by a '
  'direct integration test (Plan 02), not a sweep behavior.';

-- ============================================================================
-- 3. PERMISSIONS -- re-issued (DROP FUNCTION above also dropped these grants)
-- ============================================================================
-- Mirrors 20260901000003 exactly. Without re-issuing these, the new 7-arg
-- function would be callable by anon/authenticated via PostgREST, defeating
-- the ownership-by-parameter check (any authenticated user could pass an
-- arbitrary p_owner_user_id).

REVOKE EXECUTE ON FUNCTION public.apply_event_match_atomic FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_event_match_atomic FROM anon;
REVOKE EXECUTE ON FUNCTION public.apply_event_match_atomic FROM authenticated;
-- (The service role bypasses EXECUTE grants, so a future admin-review edge
-- function's calls -- and any integration test -- still work.)

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
