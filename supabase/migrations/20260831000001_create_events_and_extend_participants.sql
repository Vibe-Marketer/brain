-- Migration: Create events table and extend recordings/call_participants for the event-model foundation
-- Purpose: Establishes `events` as the canonical record that a meeting happened once, assembled
--          from every recording (capture) of it. This is the first non-org-scoped table in the
--          schema (EVT-04) -- visibility is granted via participation (call_participants.email)
--          or ownership (recordings.owner_user_id), never an org-scoping column, and never an
--          org-admin bypass. Adds nullable recordings.event_id and extends call_participants with event_id,
--          role, and has_confirmed_speech. Every change is additive and NULL-safe: with event_id
--          NULL across the board (its state immediately after this migration), zero current
--          behavior changes (EVT-03). The matching/resolution engine that populates these columns
--          is Phase 31+ -- out of scope here. Reversibility-gate decision: option-a, approved
--          as-is (Phase 30 Plan 02, Task 1).
-- Author: Claude (GSD Phase 30 Plan 02 executor)
-- Date: 2026-08-31

-- ============================================================================
-- 1. TABLE: events
-- ============================================================================
-- No org-scoping column (EVT-04 -- intentional, this is the first non-org-scoped table).
-- No content columns (EVT-01 -- title/summary/transcript stay on recordings, per-capture).
-- All resolution columns nullable: NULL means "not yet resolved", set by the Phase 31+
-- matching engine, never by client writes (see RLS POLICIES below -- service-role only).

CREATE TABLE IF NOT EXISTS events (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_start_time  TIMESTAMPTZ,
  canonical_end_time    TIMESTAMPTZ,
  resolution_confidence NUMERIC     CHECK (resolution_confidence IS NULL OR (resolution_confidence >= 0 AND resolution_confidence <= 1)),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. EXTEND recordings: event_id (EVT-02)
-- ============================================================================
-- Nullable FK, ON DELETE SET NULL so an event's deletion never breaks a capture.
-- NULL means unresolved -- a recording with event_id IS NULL is never "broken", just
-- not yet linked to a canonical event. No workspace column is added here (EVT-07 --
-- event-level reads join through workspace_entries, which already has recording_id).

ALTER TABLE recordings
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE SET NULL;

-- ============================================================================
-- 3. EXTEND call_participants: event_id, role, has_confirmed_speech (EVT-05)
-- ============================================================================
-- New, separate columns -- participant_type (attendee|speaker|host, per-recording) and its
-- populate_participants_from_source_metadata trigger are NOT touched. `role` is a distinct
-- event-level vocabulary (organizer|invitee|attendee|speaker) that partially overlaps
-- participant_type's values but is not interchangeable with it (30-RESEARCH.md Pitfall 5).

ALTER TABLE call_participants
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE SET NULL;

ALTER TABLE call_participants
  ADD COLUMN IF NOT EXISTS role TEXT CHECK (role IS NULL OR role IN ('organizer', 'invitee', 'attendee', 'speaker'));

ALTER TABLE call_participants
  ADD COLUMN IF NOT EXISTS has_confirmed_speech BOOLEAN;

-- ============================================================================
-- 4. INDEXES
-- ============================================================================
-- Back the RLS EXISTS predicates below (events participation/ownership lookups).

CREATE INDEX IF NOT EXISTS idx_recordings_event_owner
  ON recordings(event_id, owner_user_id);

CREATE INDEX IF NOT EXISTS idx_call_participants_event_email
  ON call_participants(event_id, email);

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- FORCE RLS matters here: without it, the table owner role would bypass RLS entirely.
-- Mirrors the already-audited call_participants pattern (20260309120000).

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE events FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. RLS POLICIES
-- ============================================================================
-- Participation (via call_participants.email) OR ownership (via recordings.owner_user_id)
-- grants SELECT. Uses auth.email() / auth.uid() -- never a raw auth.users join, which the
-- authenticated role has no SELECT on (see 20260309100000_fix_invitation_rls_auth_email.sql,
-- the exact 403 this repo already hit and fixed once for workspace_invitations).
-- LOWER(auth.email()) matches call_participants.email's lowercase-stored convention, since
-- auth.email() itself is not guaranteed lowercase for every signup path.
--
-- Deliberately NO org-admin bypass: EVT-04/ORG-04 require that organization association
-- confers no access to any capture of an event. Deliberately NO authenticated INSERT/UPDATE/
-- DELETE policy: there is no event steward in v1 -- canonical event metadata is system-derived
-- (Phase 31+ matching engine, writing via service-role) and not user-editable yet.

DROP POLICY IF EXISTS "participants_and_owners_can_view_events" ON events;
CREATE POLICY "participants_and_owners_can_view_events"
  ON events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM call_participants cp
      WHERE cp.event_id = events.id
        AND cp.email = LOWER(auth.email())
    )
    OR EXISTS (
      SELECT 1 FROM recordings r
      WHERE r.event_id = events.id
        AND r.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service role full access" ON events;
CREATE POLICY "Service role full access"
  ON events FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================================
-- 7. COMMENTS
-- ============================================================================

COMMENT ON TABLE events IS
  'Canonical record that a meeting happened once, assembled from every recording (capture) of '
  'it. Deliberately not scoped by organization -- the first such table in this schema (EVT-04). '
  'Visibility is granted via participation or an owned capture only; there is no org-admin '
  'bypass. Resolved and written by the Phase 31+ matching engine via service-role; no client '
  'write policy exists in v1.';

COMMENT ON COLUMN events.canonical_start_time IS
  'Resolved canonical start time across every capture of this event. NULL until the Phase 31+ '
  'matching engine resolves it.';

COMMENT ON COLUMN events.canonical_end_time IS
  'Resolved canonical end time across every capture of this event. NULL until the Phase 31+ '
  'matching engine resolves it.';

COMMENT ON COLUMN events.resolution_confidence IS
  'Confidence (0..1) that the linked captures are the same real-world meeting. NULL until '
  'resolved. Populated by the Phase 31+ matching engine (deterministic/content-proof/metadata '
  'tiers).';

COMMENT ON COLUMN recordings.event_id IS
  'The event (meeting) this recording is a capture of. NULL means unresolved -- never means '
  'broken. A recording with event_id IS NULL remains fully functional (EVT-02/EVT-03).';

COMMENT ON COLUMN call_participants.event_id IS
  'The event (meeting) this participant record belongs to. NULL means unresolved, matching '
  'recordings.event_id semantics.';

COMMENT ON COLUMN call_participants.role IS
  'Event-level role: organizer | invitee | attendee | speaker. NULL means unassigned. Distinct '
  'from participant_type (attendee|speaker|host, per-recording, populated by the existing '
  'source-metadata trigger) -- the two vocabularies partially overlap but are not '
  'interchangeable.';

COMMENT ON COLUMN call_participants.has_confirmed_speech IS
  'Whether this participant is confirmed to have spoken, per transcript/speaker analysis. NULL '
  'means unknown (not yet analyzed) -- distinct from false (analyzed, did not speak).';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
