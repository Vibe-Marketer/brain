-- Migration: Create event_match_decisions table
-- Purpose: Append-only ledger recording every proposed (and, in a later phase, applied
--          or reversed) event-resolution merge decision (MATCH-09). Written exclusively
--          by the Phase 31+ matching engine via service-role. In THIS phase (31), every
--          automatic row this table receives has decision='merge_proposed' and
--          applied=false, ALWAYS -- shadow mode computes and records proposed merges but
--          never applies them (SAFE-02). recordings.event_id is never written by this
--          phase's code paths; the `event_id` column on this ledger stays NULL for every
--          row this phase writes and exists only so a later phase's apply step (Plan 02's
--          apply_event_match_atomic, built and tested there, never called by this phase's
--          shadow sweep) has somewhere to record which event a decision resolved into.
--          Styled directly on the admin_audit_log append-only precedent
--          (20260612120000_create_admin_audit_log.sql): no client-reachable
--          INSERT/UPDATE/DELETE policy at all, service-role writes only.
--          Reversibility-gate decision: option-a, approved as-is, no knob changes
--          (Phase 31 Plan 01, Task 1).
-- Author: Claude (GSD Phase 31 Plan 01 executor)
-- Date: 2026-09-01

-- ============================================================================
-- 1. TABLE: event_match_decisions
-- ============================================================================
-- recording_id_a / recording_id_b: the two captures a decision proposes (or later,
--   applies/reverses) merging. Canonically ordered (a < b) by the CHECK constraint
--   below so the UNIQUE(a, b, tier) index catches a duplicate proposal regardless of
--   which recording a caller names first.
-- event_id: NULL until a decision is applied (Plan 02+); ON DELETE SET NULL so
--   deleting an event never breaks the audit trail of how it was assembled.
-- tier: which resolution tier produced this decision. Only 'deterministic' is
--   produced by this phase's matcher; 'content_proof' (Phase 33) and 'metadata'
--   (Phase 32) are reserved values, not yet writable by any code path.
-- score: NULL for tier-1 (MATCH-01 -- deterministic is exact-match, never scored).
--   Later tiers populate a 0..1 confidence.
-- signals: what actually matched, e.g. {"matched_field": "zoom_meeting_id"}. Free-form
--   JSONB so later tiers (weighted multi-signal scoring) are not schema-constrained.
-- decision / decided_by / applied: decision is always 'merge_proposed' and
--   decided_by is always 'auto' for every row this phase's automatic sweep writes;
--   applied is always false (SAFE-02, literal, not a metaphor -- the ledger exists,
--   the merge does not, this phase). The other decision/decided_by values exist for
--   Plan 02's apply/reverse RPC pair and future user/admin review flows.
-- reverses_decision_id: set on a reversal row, points back at the decision it undoes.
--   Not used by anything this phase writes.

CREATE TABLE IF NOT EXISTS event_match_decisions (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id_a         UUID        NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  recording_id_b         UUID        NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  event_id               UUID        REFERENCES events(id) ON DELETE SET NULL,
  tier                   TEXT        NOT NULL CHECK (tier IN ('deterministic', 'content_proof', 'metadata')),
  score                  NUMERIC     CHECK (score IS NULL OR (score >= 0 AND score <= 1)),
  signals                JSONB       NOT NULL DEFAULT '{}'::jsonb,
  decision               TEXT        NOT NULL CHECK (decision IN ('merge_proposed', 'merge_applied', 'reversed', 'rejected')),
  decided_by             TEXT        NOT NULL CHECK (decided_by IN ('auto', 'user', 'admin')),
  applied                BOOLEAN     NOT NULL DEFAULT false,
  reverses_decision_id   UUID        REFERENCES event_match_decisions(id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT event_match_decisions_pair_ordered CHECK (recording_id_a < recording_id_b),
  UNIQUE (recording_id_a, recording_id_b, tier)
);

-- ============================================================================
-- 2. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_event_match_decisions_recording_id_a
  ON event_match_decisions(recording_id_a);

CREATE INDEX IF NOT EXISTS idx_event_match_decisions_recording_id_b
  ON event_match_decisions(recording_id_b);

CREATE INDEX IF NOT EXISTS idx_event_match_decisions_event_id
  ON event_match_decisions(event_id);

-- ============================================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- FORCE RLS matters here exactly as it does on events/call_participants -- without
-- it, the table owner role would bypass RLS entirely. No authenticated/anon policy
-- at all this phase (31-CONTEXT.md code_context: "default to service-role-only
-- writes/reads if no user-facing surface needs it yet (this phase has none)").
-- Client-reachable read access (e.g. an eventual merge-review UI) is a later
-- phase's additive migration, not this one.

ALTER TABLE event_match_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_match_decisions FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. RLS POLICIES
-- ============================================================================
-- Append-only from every client-reachable path, mirroring admin_audit_log exactly:
-- no INSERT/UPDATE/DELETE policy on purpose. Service role bypasses RLS by design
-- (Postgres grants full access to the role owning/superseding RLS via FOR ALL below).

DROP POLICY IF EXISTS "Service role full access" ON event_match_decisions;
CREATE POLICY "Service role full access"
  ON event_match_decisions FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================================
-- 5. COMMENTS
-- ============================================================================

COMMENT ON TABLE event_match_decisions IS
  'Append-only ledger of every proposed/applied/reversed event-resolution merge '
  'decision (MATCH-09). Service-role writes only; no client-reachable INSERT/UPDATE/'
  'DELETE policy exists (mirrors admin_audit_log). In Phase 31, every automatic row is '
  'decision=''merge_proposed'', applied=false, decided_by=''auto'' -- shadow mode never '
  'applies a merge (SAFE-02, literal). The apply/reverse mechanism that would ever set '
  'applied=true is built and proven separately (Plan 02) and is never called by this '
  'phase''s automatic sweep.';

COMMENT ON COLUMN event_match_decisions.recording_id_a IS
  'The lexicographically-smaller of the two recording IDs in this pair (enforced by '
  'the event_match_decisions_pair_ordered CHECK). Canonical ordering makes the '
  'UNIQUE(recording_id_a, recording_id_b, tier) index catch a duplicate proposal '
  'regardless of which recording a caller names first.';

COMMENT ON COLUMN event_match_decisions.tier IS
  'Which resolution tier produced this decision. Only ''deterministic'' is written by '
  'any code path as of Phase 31 (MATCH-01 -- exact shared identifier, no scoring). '
  '''content_proof'' (Phase 33) and ''metadata'' (Phase 32) are reserved values.';

COMMENT ON COLUMN event_match_decisions.score IS
  'NULL for the deterministic tier (MATCH-01: a tier-1 hit is exact-match, never '
  'scored). Later tiers populate a 0..1 confidence value.';

COMMENT ON COLUMN event_match_decisions.signals IS
  'Free-form breakdown of what matched, e.g. {"matched_field": "zoom_meeting_id"}. '
  'Not schema-constrained so later, multi-signal scoring tiers are not blocked by '
  'this phase''s shape.';

COMMENT ON COLUMN event_match_decisions.applied IS
  'Always false for every row Phase 31''s automatic shadow sweep writes (SAFE-02 -- '
  'the ledger exists, the merge does not). Only Plan 02''s apply_event_match_atomic '
  '(built and tested there, never called by this phase) can ever set this true, and '
  'only outside shadow mode.';

COMMENT ON COLUMN event_match_decisions.reverses_decision_id IS
  'Set on a reversal row; points back at the merge decision it undoes. Not used by '
  'any code path this phase writes.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
