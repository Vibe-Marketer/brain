-- Migration: Create reconciled_transcript_segments table
-- Purpose: Phase 37's derived, non-destructive cross-recording transcript ledger
--          (RECON-04/05/06). Unlike event_match_decisions/speaker_resolution_decisions
--          (service-role-only, no client policy), this is the FIRST client-readable
--          ledger in this milestone -- the new "Reconciled" tab in CallDetailDialog
--          reads it directly under a user's own JWT. Full delete+rebuild per event on
--          every reconcile-transcripts sweep run (RESEARCH.md Pitfall 5) -- no UNIQUE
--          conflict target exists on purpose, since the write path is DELETE FROM ...
--          WHERE event_id = $1 followed by a fresh INSERT batch, never an upsert.
--
-- Task 1 reversibility-gate decisions locked for this plan (37-01, auto-resolved to
-- the RESEARCH-recommended default under this project's yolo/auto_advance config,
-- config.json workflow.auto_advance=true -- gate is blocking-human=false):
--   (a) Column shape: exactly as authored below (id, event_id, segment_text,
--       start_time, end_time, source_recording_ids, agreeing_recording_ids, signals,
--       organization_id, created_at). No UNIQUE constraint (Pitfall 5).
--   (b) Client-facing RLS: a NEW SECURITY DEFINER helper,
--       user_can_view_event_reconciliation(p_event_id UUID), mirrors the
--       events/user_participates_in_event (CR-01 fix) + recordings' own SELECT-policy
--       predicate (owner_user_id, is_organization_admin_or_owner, workspace_entries+
--       workspace_memberships) -- i.e. a user can read a reconciled segment only if
--       they could already see at least one of the underlying event's recordings via
--       one of those three recordings-access paths, OR they are a call_participants
--       participant on the event. This is a subset check against the SAME conditions
--       recordings RLS itself uses (20260308000002_tighten_recordings_select_rls.sql),
--       not a widened or independently-invented predicate -- "no widening through the
--       derived layer" (plan prohibition) is satisfied by construction.
--   (c) Reconciliation-eligibility gating (RESEARCH Open Question 2 / Pitfall 3):
--       option-a -- gate on event_match_decisions.decision = 'merge_applied' alone
--       (metadata-tier-or-higher event resolution). Speaker resolution
--       (speaker_resolution_decisions) is NOT a hard gate on eligibility, since it
--       only records positive resolutions and would permanently exclude the dominant
--       all-already-named event shape (RESEARCH Pitfall 3). This decision governs
--       Plan 02's edge-function query, not this migration's schema -- recorded here
--       for traceability since Task 1 locks it for every downstream plan.
--   (d) Interval-primitive reuse: deriveAbsoluteInterval is already exported from
--       supabase/functions/_shared/speaker-resolver.ts and will be imported verbatim
--       by Plan 02/03's transcript-reconciler.ts. intervalsOverlapWithTolerance and
--       CLOCK_DRIFT_TOLERANCE_MS are currently private to that file -- Plan 02 must
--       export them additively (no logic change) rather than duplicating the DP.
--   (e) fastest-levenshtein alignment path: confirmed via direct read of
--       node_modules/fastest-levenshtein's .d.ts -- it exposes only
--       `distance(a, b): number` and `closest(str, arr): string`, no alignment/edit-
--       script output. A hand-rolled Wagner-Fischer DP is required for RECON-02's
--       token-level "which token disagreed" need (RESEARCH Open Question 1,
--       Assumption A1 -- now independently re-verified, not just assumed).
--
-- Author: Claude (GSD Phase 37 Plan 01 executor)
-- Date: 2026-09-10

-- ============================================================================
-- 1. FUNCTION: user_can_view_event_reconciliation
-- ============================================================================
-- SECURITY DEFINER so this check is reachable regardless of recordings'/
-- call_participants' own RLS (mirrors the events/user_participates_in_event CR-01
-- fix and the identities/user_can_view_identity precedent -- SECURITY DEFINER from
-- the start, not bolted on after a leak). Reads recordings under definer privileges
-- to check the SAME three access paths recordings' own SELECT policy grants
-- (ownership, org admin/owner, workspace membership), plus event participation via
-- call_participants (mirrors events' own participation grant). A reconciled segment
-- is visible to a user IFF they could already see at least one recording of the
-- event it derives from -- never wider than that.
CREATE OR REPLACE FUNCTION public.user_can_view_event_reconciliation(p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM recordings r
    WHERE r.event_id = p_event_id
      AND (
        r.owner_user_id = auth.uid()
        OR public.is_organization_admin_or_owner(r.organization_id, auth.uid())
        OR EXISTS (
          SELECT 1 FROM workspace_entries we
          JOIN workspace_memberships wm ON wm.workspace_id = we.workspace_id
          WHERE we.recording_id = r.id AND wm.user_id = auth.uid()
        )
      )
  ) OR public.user_participates_in_event(p_event_id, LOWER(auth.email()));
$$;

COMMENT ON FUNCTION public.user_can_view_event_reconciliation(UUID) IS
  'SECURITY DEFINER check for reconciled_transcript_segments RLS: true only if the '
  'current user could already see at least one of this event''s recordings via '
  'ownership, org admin/owner, or workspace membership (the exact predicate '
  'recordings'' own SELECT policy uses), OR is a call_participants participant on '
  'the event (mirrors events'' own participation grant). First client-readable '
  'ledger in the v2.2 milestone (T-37-01) -- this function is the sole gate.';

-- ============================================================================
-- 2. TABLE: reconciled_transcript_segments
-- ============================================================================
-- event_id: the event this segment was reconciled for. ON DELETE CASCADE (unlike
--   event_match_decisions'/speaker_resolution_decisions' ON DELETE SET NULL) --
--   this table is a pure derived cache of an event's transcript; if the event goes
--   away there is nothing left to reconcile, so cascading delete is correct here
--   (not an audit trail like the two decision ledgers).
-- segment_text: the reconciled prose for this interval, after RECON-02's
--   token-level weighted-vote resolution.
-- start_time / end_time: the segment's derived absolute interval (same anchor
--   convention as speaker-resolver.ts's AbsoluteInterval -- recording_start_time +
--   parsed timestamp offset), nullable for the same fail-closed reasons.
-- source_recording_ids: every recording that contributed a chunk to this interval,
--   sorted ascending by recording UUID (text order) for reproducible regeneration
--   output -- see the ordering-contract comment on the column itself.
-- agreeing_recording_ids: the subset of source_recording_ids whose contributed text
--   agreed with the final resolved segment_text (weighted-vote winner), also sorted
--   ascending. Length 1 vs 2+ is RECON-06's single-source-vs-consensus signal: a
--   length-1 array means single-source (no badge), 2+ means multi-source consensus
--   (badge). An interval with zero contributing recordings is never persisted at all
--   (no zero-length-array row is ever written -- absence of data is absence of a row,
--   not a row claiming zero agreement).
-- signals: free-form per-segment provenance/vote metadata (e.g. per-token
--   disagreement counts, entity-lexicon tie-breaks applied, provider-priority
--   fallbacks used) -- not schema-constrained so scoring can evolve without a
--   migration, mirrors event_match_decisions'/speaker_resolution_decisions' signals.
-- organization_id: bucketing/RLS-adjacent scope column (defense in depth alongside
--   the SECURITY DEFINER helper; also lets the write path's full delete+rebuild
--   query scope cheaply without a join through recordings).
-- No UNIQUE(...) constraint anywhere on this table (Pitfall 5) -- the write path is
--   DELETE FROM reconciled_transcript_segments WHERE event_id = $1 followed by a
--   fresh INSERT batch every sweep run, never an upsert with a conflict target.

CREATE TABLE IF NOT EXISTS reconciled_transcript_segments (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id               UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  segment_text           TEXT        NOT NULL,
  start_time             TIMESTAMPTZ,
  end_time               TIMESTAMPTZ,
  source_recording_ids   UUID[]      NOT NULL,
  agreeing_recording_ids UUID[]      NOT NULL,
  signals                JSONB       NOT NULL DEFAULT '{}'::jsonb,
  organization_id        UUID        NOT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_reconciled_transcript_segments_event_id
  ON reconciled_transcript_segments(event_id);

CREATE INDEX IF NOT EXISTS idx_reconciled_transcript_segments_organization_id
  ON reconciled_transcript_segments(organization_id);

CREATE INDEX IF NOT EXISTS idx_reconciled_transcript_segments_start_time
  ON reconciled_transcript_segments(start_time);

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- FORCE RLS matters here exactly as it does on every other ledger in this
-- milestone -- without it, the table owner role would bypass RLS entirely.

ALTER TABLE reconciled_transcript_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciled_transcript_segments FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. RLS POLICIES
-- ============================================================================

-- Write path: service-role only (the reconcile-transcripts edge function, Plan 03).
DROP POLICY IF EXISTS "Service role full access" ON reconciled_transcript_segments;
CREATE POLICY "Service role full access"
  ON reconciled_transcript_segments FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- Read path: THE new client-facing surface this phase introduces. Gated entirely
-- through user_can_view_event_reconciliation -- see Task 1 decision (b) above.
DROP POLICY IF EXISTS "Users can view reconciled segments for accessible events" ON reconciled_transcript_segments;
CREATE POLICY "Users can view reconciled segments for accessible events"
  ON reconciled_transcript_segments FOR SELECT
  TO authenticated
  USING (public.user_can_view_event_reconciliation(event_id));

-- ============================================================================
-- 6. COMMENTS
-- ============================================================================

COMMENT ON TABLE reconciled_transcript_segments IS
  'Derived, non-destructive cross-recording transcript ledger (RECON-04). Full '
  'delete+rebuild per event on every reconcile-transcripts sweep run -- never an '
  'incremental upsert, no UNIQUE conflict target exists on this table on purpose. '
  'transcript_chunks is never written to by this phase; this table is the ONLY '
  'write target for reconciled text. FIRST client-readable ledger in the v2.2 '
  'milestone (T-37-01) -- gated by user_can_view_event_reconciliation, proven by '
  'rls-regression.test.ts''s bespoke cross-org isolation block.';

COMMENT ON COLUMN reconciled_transcript_segments.source_recording_ids IS
  'Every recording that contributed a chunk to this interval, sorted ascending by '
  'recording UUID (text order) -- a stable ordering contract so regeneration output '
  'is reproducible (RECON-05).';

COMMENT ON COLUMN reconciled_transcript_segments.agreeing_recording_ids IS
  'Subset of source_recording_ids whose contributed text agreed with the final '
  'resolved segment_text, also sorted ascending by recording UUID. Length 1 means '
  'single-source (RECON-06: no consensus badge, not rendered as agreement); length '
  '2+ means multi-source consensus (badge). An interval with zero contributing '
  'recordings produces NO row at all -- absence of a row, never a zero-length-array '
  'row claiming coverage that does not exist.';

COMMENT ON COLUMN reconciled_transcript_segments.signals IS
  'Free-form per-segment provenance/vote metadata (e.g. per-token disagreement '
  'counts, entity-lexicon tie-breaks applied, provider-priority fallbacks used). '
  'Not schema-constrained so RECON-02''s scoring can evolve without a migration.';

COMMENT ON COLUMN reconciled_transcript_segments.organization_id IS
  'Bucketing scope column (defense in depth alongside user_can_view_event_reconciliation) '
  '-- also lets the write path''s full delete+rebuild query scope cheaply without a '
  'join through recordings.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
