-- Migration: Create speaker_resolution_decisions table
-- Purpose: Append-only provenance ledger recording every proposed cross-recording
--          speaker-resolution decision (IDENT-04 timeline-alignment propagation,
--          IDENT-05 over-segmentation consensus collapse). Written exclusively by
--          the Phase 35 resolve-speakers edge function via service-role. This ledger
--          is the LOCKED write-target (Decision B2, 35-01-SUMMARY.md) -- resolved
--          speaker identities are recorded here, NEVER by an in-place UPDATE to
--          transcript_chunks.speaker_name/speaker_email (that overwrite is reserved
--          for a future Phase 37 apply step, out of scope here). Styled directly on
--          event_match_decisions (20260901000002_create_event_match_decisions.sql):
--          no client-reachable INSERT/UPDATE/DELETE policy at all, service-role
--          writes only, FORCE RLS.
-- Author: Claude (GSD Phase 35 Plan 03 executor)
-- Date: 2026-09-08

-- ============================================================================
-- 1. TABLE: speaker_resolution_decisions
-- ============================================================================
-- donor_recording_id / donor_chunk_index: the already-resolved chunk (verified
--   identity_id) whose identity was propagated onto the target.
-- target_recording_id / target_chunk_index: the previously-anonymous chunk this
--   decision resolves (propagation) or collapses (consensus).
-- event_id: the event both recordings were aligned under. Nullable only for
--   defensive symmetry with event_match_decisions' pattern; every row this
--   function writes sets it, since propagation/collapse only ever runs within
--   a single resolved event's recordings.
-- identity_id: the identity attributed to the target by this decision.
-- tier: which Plan 02 mechanism produced this decision -- 'propagation'
--   (propagateNamedLabel, IDENT-04) or 'consensus_collapse' (collapsePhantomSpeaker,
--   IDENT-05). Only these two values are writable by any code path this phase.
-- score: the 0..1 confidence Plan 02's confidenceForGap produces.
-- signals: free-form breakdown (e.g. gap_ms, donor chunk indices) so this ledger
--   is not schema-constrained as scoring evolves.
-- decision / decided_by / applied: decision is always 'resolution_proposed' and
--   decided_by is always 'auto' for every row this phase's forward-only sweep
--   writes; applied is always false -- the ledger exists, the transcript_chunks
--   overwrite does not, this phase (mirrors event_match_decisions' SAFE-02
--   precedent literally: propose now, apply later, elsewhere).

CREATE TABLE IF NOT EXISTS speaker_resolution_decisions (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              UUID        REFERENCES events(id) ON DELETE SET NULL,
  donor_recording_id    UUID        NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  donor_chunk_index     INTEGER     NOT NULL,
  target_recording_id   UUID        NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  target_chunk_index    INTEGER     NOT NULL,
  identity_id           UUID        NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
  tier                  TEXT        NOT NULL CHECK (tier IN ('propagation', 'consensus_collapse')),
  score                 NUMERIC     CHECK (score IS NULL OR (score >= 0 AND score <= 1)),
  signals               JSONB       NOT NULL DEFAULT '{}'::jsonb,
  decision              TEXT        NOT NULL CHECK (decision IN ('resolution_proposed', 'resolution_applied', 'reversed', 'rejected')),
  decided_by            TEXT        NOT NULL CHECK (decided_by IN ('auto', 'user', 'admin')),
  applied               BOOLEAN     NOT NULL DEFAULT false,
  reverses_decision_id  UUID        REFERENCES speaker_resolution_decisions(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (target_recording_id, target_chunk_index, tier)
);

-- ============================================================================
-- 2. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_speaker_resolution_decisions_donor_recording_id
  ON speaker_resolution_decisions(donor_recording_id);

CREATE INDEX IF NOT EXISTS idx_speaker_resolution_decisions_target_recording_id
  ON speaker_resolution_decisions(target_recording_id);

CREATE INDEX IF NOT EXISTS idx_speaker_resolution_decisions_event_id
  ON speaker_resolution_decisions(event_id);

CREATE INDEX IF NOT EXISTS idx_speaker_resolution_decisions_identity_id
  ON speaker_resolution_decisions(identity_id);

-- ============================================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- FORCE RLS matters here exactly as it does on event_match_decisions -- without
-- it, the table owner role would bypass RLS entirely. No authenticated/anon
-- policy at all this phase -- client-reachable read access (e.g. an eventual
-- resolution-review UI) is a later phase's additive migration, not this one.

ALTER TABLE speaker_resolution_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE speaker_resolution_decisions FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. RLS POLICIES
-- ============================================================================
-- Append-only from every client-reachable path, mirroring event_match_decisions
-- and admin_audit_log exactly: no INSERT/UPDATE/DELETE policy on purpose.
-- Service role bypasses RLS by design (Postgres grants full access to the role
-- owning/superseding RLS via FOR ALL below).

DROP POLICY IF EXISTS "Service role full access" ON speaker_resolution_decisions;
CREATE POLICY "Service role full access"
  ON speaker_resolution_decisions FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================================
-- 5. COMMENTS
-- ============================================================================

COMMENT ON TABLE speaker_resolution_decisions IS
  'Append-only provenance ledger of every proposed cross-recording speaker '
  'resolution decision (IDENT-04 propagation, IDENT-05 consensus collapse). '
  'Service-role writes only; no client-reachable INSERT/UPDATE/DELETE policy '
  'exists (mirrors event_match_decisions). Every row resolve-speakers writes has '
  'decision=''resolution_proposed'', applied=false, decided_by=''auto'' -- this '
  'ledger records the decision; it never overwrites transcript_chunks.speaker_name/'
  'speaker_email in place (that apply step is a future phase, out of scope here).';

COMMENT ON COLUMN speaker_resolution_decisions.tier IS
  'Which Plan 02 pure-function mechanism produced this decision: ''propagation'' '
  '(propagateNamedLabel, IDENT-04) or ''consensus_collapse'' (collapsePhantomSpeaker, '
  'IDENT-05). Only these two values are written by any code path as of Phase 35.';

COMMENT ON COLUMN speaker_resolution_decisions.score IS
  'The 0..1 confidence value Plan 02''s confidenceForGap produces for this decision.';

COMMENT ON COLUMN speaker_resolution_decisions.signals IS
  'Free-form breakdown of what matched (e.g. gap_ms, donor chunk indices). Not '
  'schema-constrained so future scoring refinements are not blocked by this shape.';

COMMENT ON COLUMN speaker_resolution_decisions.applied IS
  'Always false for every row this phase''s forward-only sweep writes -- the '
  'ledger exists, the transcript_chunks overwrite does not, this phase (mirrors '
  'event_match_decisions'' SAFE-02 precedent). A future phase''s apply step would '
  'be the only code path ever setting this true.';

COMMENT ON COLUMN speaker_resolution_decisions.reverses_decision_id IS
  'Set on a reversal row; points back at the resolution decision it undoes. Not '
  'used by any code path this phase writes.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
