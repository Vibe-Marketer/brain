-- Migration: Call participants — single source of truth for who was on each call
-- Issue: #111 — Accurate participant/attendee tracking and call counts
-- Purpose: Normalizes participant data from scattered sources (source_metadata calendar_invitees,
--          call_speakers legacy table, transcript parsing) into a canonical call_participants table.
--          Also adds participant_count to recordings for fast display in call list/detail views,
--          and provides RPCs for people summary and per-person call filtering.
-- Date: 2026-03-09

-- ============================================================================
-- 1. TABLE: call_participants
-- ============================================================================
-- Single source of truth for who participated in each call.
-- Populated from:
--   1. source_metadata->'calendar_invitees' (who was invited; has email)
--   2. source_metadata->'recorded_by_email' / 'recorded_by_name' (host)
--   3. Transcript speaker parsing (who actually spoke; may lack email)
--   4. Manual additions
--
-- email is stored lowercase. One row per (recording_id, email) for participants
-- with email (partial unique index enforces dedup). Name-only rows (NULL email)
-- are allowed as separate rows per recording for transcript-only speakers.

CREATE TABLE IF NOT EXISTS call_participants (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id    UUID        NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Person identity
  name            TEXT,
  email           TEXT,         -- stored lowercase; NULL for transcript-only participants

  -- attendee = calendar invitee | speaker = spoke in transcript | host = call recorder
  participant_type TEXT        NOT NULL DEFAULT 'attendee'
                              CHECK (participant_type IN ('attendee', 'speaker', 'host')),

  -- Which source(s) confirmed this participant
  sources         TEXT[]      NOT NULL DEFAULT '{}',

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. INDEXES FOR call_participants
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_call_participants_recording_id
  ON call_participants(recording_id);

CREATE INDEX IF NOT EXISTS idx_call_participants_organization_id
  ON call_participants(organization_id);

CREATE INDEX IF NOT EXISTS idx_call_participants_org_email
  ON call_participants(organization_id, email)
  WHERE email IS NOT NULL;

-- One record per (recording_id, email) for email-identified participants.
-- NULLs are naturally distinct in PostgreSQL so name-only rows per recording are allowed.
CREATE UNIQUE INDEX IF NOT EXISTS call_participants_recording_email_key
  ON call_participants(recording_id, email)
  WHERE email IS NOT NULL;

-- ============================================================================
-- 3. DENORMALIZED participant_count ON recordings
-- ============================================================================
-- Kept in sync by the trigger in section 5. Enables O(1) count display in call lists.

ALTER TABLE recordings
  ADD COLUMN IF NOT EXISTS participant_count INTEGER NOT NULL DEFAULT 0;

-- ============================================================================
-- 4. RLS FOR call_participants
-- ============================================================================

ALTER TABLE call_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_participants FORCE ROW LEVEL SECURITY;

CREATE POLICY "Organization members can view call participants"
  ON call_participants FOR SELECT
  USING (is_organization_member(organization_id, auth.uid()));

CREATE POLICY "Service role full access"
  ON call_participants FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================================
-- 5. TRIGGER: keep participant_count in sync when call_participants changes
-- ============================================================================
-- Fires after INSERT, UPDATE, or DELETE on call_participants and recomputes
-- the exact count from the table. Single-row update per event is acceptable
-- given call_participants writes are infrequent.

CREATE OR REPLACE FUNCTION sync_recording_participant_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recording_id UUID;
BEGIN
  v_recording_id := COALESCE(NEW.recording_id, OLD.recording_id);

  UPDATE recordings
  SET participant_count = (
    SELECT COUNT(*) FROM call_participants WHERE recording_id = v_recording_id
  )
  WHERE id = v_recording_id;

  -- AFTER triggers: return value is ignored by PostgreSQL, but COALESCE(NEW, OLD)
  -- is correct defensive practice — NEW is NULL on DELETE events.
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS sync_participant_count ON call_participants;
CREATE TRIGGER sync_participant_count
  AFTER INSERT OR DELETE OR UPDATE ON call_participants
  FOR EACH ROW
  EXECUTE FUNCTION sync_recording_participant_count();

-- ============================================================================
-- 6. TRIGGER: auto-populate participants on recording INSERT
-- ============================================================================
-- Parses source_metadata->'calendar_invitees' (array of {name?, email?} objects)
-- and source_metadata->>'recorded_by_email' / 'recorded_by_name' (host) and
-- inserts call_participants rows. The sync_recording_participant_count trigger
-- above keeps participant_count up to date as rows are inserted.

CREATE OR REPLACE FUNCTION populate_participants_from_source_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitees    JSONB;
  v_invitee     JSONB;
  v_email       TEXT;
  v_name        TEXT;
  v_host_email  TEXT;
  v_host_name   TEXT;
BEGIN
  -- -------------------------------------------------------------------------
  -- Calendar invitees from source_metadata
  -- -------------------------------------------------------------------------
  v_invitees := NEW.source_metadata -> 'calendar_invitees';

  IF v_invitees IS NOT NULL AND jsonb_typeof(v_invitees) = 'array' THEN
    FOR v_invitee IN SELECT * FROM jsonb_array_elements(v_invitees)
    LOOP
      v_email := NULLIF(trim(lower(v_invitee ->> 'email')), '');
      v_name  := NULLIF(trim(v_invitee ->> 'name'), '');

      CONTINUE WHEN v_email IS NULL AND v_name IS NULL;

      IF v_email IS NOT NULL THEN
        INSERT INTO call_participants (
          recording_id, organization_id, name, email, participant_type, sources
        ) VALUES (
          NEW.id, NEW.organization_id, v_name, v_email, 'attendee', ARRAY['calendar_invitees']
        )
        ON CONFLICT (recording_id, email) WHERE email IS NOT NULL
        DO UPDATE SET
          sources = ARRAY(SELECT DISTINCT unnest(call_participants.sources || ARRAY['calendar_invitees'])),
          name    = COALESCE(EXCLUDED.name, call_participants.name);
      ELSE
        -- Name-only invitee: insert without dedup (NULL email can't conflict)
        INSERT INTO call_participants (
          recording_id, organization_id, name, email, participant_type, sources
        ) VALUES (
          NEW.id, NEW.organization_id, v_name, NULL, 'attendee', ARRAY['calendar_invitees']
        );
      END IF;
    END LOOP;
  END IF;

  -- -------------------------------------------------------------------------
  -- Host (recorded_by) from source_metadata
  -- -------------------------------------------------------------------------
  v_host_email := NULLIF(trim(lower(NEW.source_metadata ->> 'recorded_by_email')), '');
  v_host_name  := NULLIF(trim(NEW.source_metadata ->> 'recorded_by_name'), '');

  IF v_host_email IS NOT NULL THEN
    INSERT INTO call_participants (
      recording_id, organization_id, name, email, participant_type, sources
    ) VALUES (
      NEW.id, NEW.organization_id, v_host_name, v_host_email, 'host', ARRAY['recorded_by']
    )
    ON CONFLICT (recording_id, email) WHERE email IS NOT NULL
    DO UPDATE SET
      participant_type = CASE
        WHEN call_participants.participant_type = 'attendee' THEN 'host'
        ELSE call_participants.participant_type
      END,
      sources = ARRAY(SELECT DISTINCT unnest(call_participants.sources || ARRAY['recorded_by'])),
      name    = COALESCE(EXCLUDED.name, call_participants.name);
  ELSIF v_host_name IS NOT NULL THEN
    INSERT INTO call_participants (
      recording_id, organization_id, name, email, participant_type, sources
    ) VALUES (
      NEW.id, NEW.organization_id, v_host_name, NULL, 'host', ARRAY['recorded_by']
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS populate_participants_on_insert ON recordings;
CREATE TRIGGER populate_participants_on_insert
  AFTER INSERT ON recordings
  FOR EACH ROW
  EXECUTE FUNCTION populate_participants_from_source_metadata();

-- ============================================================================
-- 7. BACKFILL existing recordings
-- ============================================================================
-- Processes all recordings that already have calendar_invitees or recorded_by
-- in source_metadata. The trigger only fires for future INSERTs so this DO
-- block handles the historical data.

-- Disable the sync_participant_count trigger during backfill to avoid N unnecessary
-- UPDATE recordings calls (one per participant insert). A single bulk UPDATE at the
-- end of the DO block recomputes all counts in one pass, which is far more efficient
-- for ~1,500 recordings with multiple participants each.
ALTER TABLE call_participants DISABLE TRIGGER sync_participant_count;

DO $$
DECLARE
  v_rec         RECORD;
  v_invitees    JSONB;
  v_invitee     JSONB;
  v_email       TEXT;
  v_name        TEXT;
  v_host_email  TEXT;
  v_host_name   TEXT;
  v_count       INTEGER := 0;
BEGIN
  FOR v_rec IN
    SELECT id, organization_id, source_metadata
    FROM recordings
    WHERE source_metadata IS NOT NULL
      AND (
        jsonb_typeof(source_metadata -> 'calendar_invitees') = 'array'
        OR source_metadata ? 'recorded_by_email'
      )
    ORDER BY created_at ASC
  LOOP
    -- 1. Calendar invitees
    v_invitees := v_rec.source_metadata -> 'calendar_invitees';

    IF v_invitees IS NOT NULL AND jsonb_typeof(v_invitees) = 'array' THEN
      FOR v_invitee IN SELECT * FROM jsonb_array_elements(v_invitees)
      LOOP
        v_email := NULLIF(trim(lower(v_invitee ->> 'email')), '');
        v_name  := NULLIF(trim(v_invitee ->> 'name'), '');

        CONTINUE WHEN v_email IS NULL AND v_name IS NULL;

        IF v_email IS NOT NULL THEN
          INSERT INTO call_participants (
            recording_id, organization_id, name, email, participant_type, sources
          ) VALUES (
            v_rec.id, v_rec.organization_id, v_name, v_email, 'attendee', ARRAY['calendar_invitees']
          )
          ON CONFLICT (recording_id, email) WHERE email IS NOT NULL
          DO UPDATE SET
            sources = ARRAY(SELECT DISTINCT unnest(call_participants.sources || ARRAY['calendar_invitees'])),
            name    = COALESCE(EXCLUDED.name, call_participants.name);
        ELSE
          INSERT INTO call_participants (
            recording_id, organization_id, name, email, participant_type, sources
          )
          SELECT v_rec.id, v_rec.organization_id, v_name, NULL, 'attendee', ARRAY['calendar_invitees']
          WHERE NOT EXISTS (
            SELECT 1 FROM call_participants
            WHERE recording_id = v_rec.id AND name = v_name AND email IS NULL
          );
        END IF;
      END LOOP;
    END IF;

    -- 2. Host (recorded_by)
    v_host_email := NULLIF(trim(lower(v_rec.source_metadata ->> 'recorded_by_email')), '');
    v_host_name  := NULLIF(trim(v_rec.source_metadata ->> 'recorded_by_name'), '');

    IF v_host_email IS NOT NULL THEN
      INSERT INTO call_participants (
        recording_id, organization_id, name, email, participant_type, sources
      ) VALUES (
        v_rec.id, v_rec.organization_id, v_host_name, v_host_email, 'host', ARRAY['recorded_by']
      )
      ON CONFLICT (recording_id, email) WHERE email IS NOT NULL
      DO UPDATE SET
        participant_type = CASE
          WHEN call_participants.participant_type = 'attendee' THEN 'host'
          ELSE call_participants.participant_type
        END,
        sources = ARRAY(SELECT DISTINCT unnest(call_participants.sources || ARRAY['recorded_by'])),
        name    = COALESCE(EXCLUDED.name, call_participants.name);
    ELSIF v_host_name IS NOT NULL THEN
      INSERT INTO call_participants (
        recording_id, organization_id, name, email, participant_type, sources
      )
      SELECT v_rec.id, v_rec.organization_id, v_host_name, NULL, 'host', ARRAY['recorded_by']
      WHERE NOT EXISTS (
        SELECT 1 FROM call_participants
        WHERE recording_id = v_rec.id AND name = v_host_name AND email IS NULL
      );
    END IF;

    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE 'Backfilled call_participants for % recordings', v_count;
END;
$$;

-- Re-enable the trigger, then bulk-sync participant_count for all recordings
-- that now have participants. Single pass covers every affected recording.
ALTER TABLE call_participants ENABLE TRIGGER sync_participant_count;

UPDATE recordings r
SET participant_count = (
  SELECT COUNT(*) FROM call_participants cp WHERE cp.recording_id = r.id
)
WHERE EXISTS (
  SELECT 1 FROM call_participants cp WHERE cp.recording_id = r.id
);

-- ============================================================================
-- 8. RPC: get_people_summary
-- ============================================================================
-- Returns deduplicated people across all calls in an organization.
-- Email-identified people are grouped by email (canonical).
-- Name-only people (transcript speakers without email) are grouped by name.
-- Ordered by call_count DESC so the most-frequent contacts appear first.

CREATE OR REPLACE FUNCTION get_people_summary(
  p_organization_id UUID
)
RETURNS TABLE (
  display_name    TEXT,
  email           TEXT,
  call_count      BIGINT,
  last_call_at    TIMESTAMPTZ,
  first_call_at   TIMESTAMPTZ,
  recording_ids   UUID[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Email-identified participants — canonical dedup key is email
  SELECT
    COALESCE(MAX(cp.name), cp.email)    AS display_name,
    cp.email,
    COUNT(DISTINCT cp.recording_id)     AS call_count,
    MAX(r.recording_start_time)         AS last_call_at,
    MIN(r.recording_start_time)         AS first_call_at,
    ARRAY_AGG(DISTINCT cp.recording_id) AS recording_ids
  FROM call_participants cp
  JOIN recordings r ON r.id = cp.recording_id
  WHERE cp.organization_id = p_organization_id
    AND is_organization_member(p_organization_id, auth.uid())
    AND cp.email IS NOT NULL
  GROUP BY cp.email

  UNION ALL

  -- Name-only participants — canonical dedup key is name (best effort)
  SELECT
    cp.name                             AS display_name,
    NULL::TEXT                          AS email,
    COUNT(DISTINCT cp.recording_id)     AS call_count,
    MAX(r.recording_start_time)         AS last_call_at,
    MIN(r.recording_start_time)         AS first_call_at,
    ARRAY_AGG(DISTINCT cp.recording_id) AS recording_ids
  FROM call_participants cp
  JOIN recordings r ON r.id = cp.recording_id
  WHERE cp.organization_id = p_organization_id
    AND is_organization_member(p_organization_id, auth.uid())
    AND cp.email IS NULL
    AND cp.name IS NOT NULL
  GROUP BY cp.name

  ORDER BY call_count DESC, last_call_at DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION get_people_summary(UUID) TO authenticated;

COMMENT ON FUNCTION get_people_summary(UUID) IS
  'Returns deduplicated people list across all calls in an organization. '
  'Email-identified people grouped by email; name-only by name. '
  'Powers the People tab and contact aggregation UI (issue #111).';

-- ============================================================================
-- 9. RPC: get_recordings_for_person
-- ============================================================================
-- Returns recordings a specific person participated in.
-- Used when clicking a person in the People list to filter the call list.
-- Matches by email (exact, case-insensitive) when provided, or by name prefix.

CREATE OR REPLACE FUNCTION get_recordings_for_person(
  p_organization_id   UUID,
  p_email             TEXT    DEFAULT NULL,
  p_name              TEXT    DEFAULT NULL
)
RETURNS TABLE (
  recording_id          UUID,
  title                 TEXT,
  recording_start_time  TIMESTAMPTZ,
  duration              INTEGER,
  participant_count     INTEGER,
  participant_name      TEXT,
  participant_email     TEXT,
  participant_type      TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Deduplicate with DISTINCT ON (r.id) to handle the case where a name-prefix
  -- search matches multiple participants in the same recording (e.g., "John" matches
  -- both "John Smith" and "John Doe" in the same call). We pick the highest-priority
  -- participant type (host > speaker > attendee) via the ORDER BY inside the subquery.
  -- Returns empty when both p_email and p_name are NULL.
  SELECT
    recording_id,
    title,
    recording_start_time,
    duration,
    participant_count,
    participant_name,
    participant_email,
    participant_type
  FROM (
    SELECT DISTINCT ON (r.id)
      r.id                   AS recording_id,
      r.title,
      r.recording_start_time,
      r.duration,
      r.participant_count,
      cp.name                AS participant_name,
      cp.email               AS participant_email,
      cp.participant_type,
      -- Order key: host first, then speaker, then attendee (alphabetical of type values)
      CASE cp.participant_type
        WHEN 'host'     THEN 1
        WHEN 'speaker'  THEN 2
        ELSE                 3
      END                    AS _type_priority
    FROM recordings r
    JOIN call_participants cp ON cp.recording_id = r.id
    WHERE r.organization_id = p_organization_id
      AND is_organization_member(p_organization_id, auth.uid())
      AND (
        -- Email match (case-insensitive, exact) — preferred when provided
        (p_email IS NOT NULL AND cp.email = lower(p_email))
        OR
        -- Name prefix match (case-insensitive) — fallback when only name given
        -- Note: this is prefix-based (not exact). Callers should pass the full
        -- display_name from get_people_summary for an exact match.
        (p_email IS NULL AND p_name IS NOT NULL AND lower(cp.name) LIKE lower(p_name) || '%')
      )
    ORDER BY r.id, _type_priority ASC
  ) deduped
  ORDER BY recording_start_time DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION get_recordings_for_person(UUID, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION get_recordings_for_person(UUID, TEXT, TEXT) IS
  'Returns recordings a specific person participated in, filtered by email or name. '
  'Powers the clickable participant filter in the call list UI (issue #111).';

-- ============================================================================
-- 10. Update contact_call_appearances to link to canonical recordings
-- ============================================================================
-- The legacy contact_call_appearances table references fathom_calls by BIGINT
-- recording_id (old schema). Add a UUID FK to the canonical recordings table
-- and backfill via fathom_raw_calls.canonical_recording_id.

ALTER TABLE contact_call_appearances
  ADD COLUMN IF NOT EXISTS canonical_recording_id UUID REFERENCES recordings(id) ON DELETE SET NULL;

UPDATE contact_call_appearances cca
SET canonical_recording_id = frc.canonical_recording_id
FROM fathom_raw_calls frc
WHERE frc.recording_id = cca.recording_id
  AND frc.user_id      = cca.user_id
  AND frc.canonical_recording_id IS NOT NULL
  AND cca.canonical_recording_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_contact_appearances_canonical_recording
  ON contact_call_appearances(canonical_recording_id)
  WHERE canonical_recording_id IS NOT NULL;

-- Add UUID last-call reference to contacts (replacing legacy BIGINT column)
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS last_call_recording_uuid UUID REFERENCES recordings(id) ON DELETE SET NULL;

UPDATE contacts c
SET last_call_recording_uuid = (
  SELECT cca.canonical_recording_id
  FROM contact_call_appearances cca
  JOIN recordings r ON r.id = cca.canonical_recording_id
  WHERE cca.contact_id = c.id
    AND cca.canonical_recording_id IS NOT NULL
  ORDER BY r.recording_start_time DESC NULLS LAST
  LIMIT 1
)
WHERE last_call_recording_uuid IS NULL;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE call_participants IS
  'Single source of truth for who participated in each call. '
  'Populated from source_metadata calendar_invitees (invitees), recorded_by (host), '
  'and transcript speaker parsing. One row per (recording_id, email) for email-identified '
  'participants; multiple name-only rows allowed per recording for transcript speakers. '
  'Issue #111.';

COMMENT ON COLUMN call_participants.email IS
  'Lowercase participant email. NULL for transcript-only participants without email. '
  'Unique per recording via partial unique index call_participants_recording_email_key.';

COMMENT ON COLUMN call_participants.sources IS
  'Array of source identifiers: calendar_invitees | recorded_by | transcript | manual.';

COMMENT ON COLUMN call_participants.participant_type IS
  'attendee = calendar invitee | speaker = spoke in transcript | host = call recorder.';

COMMENT ON COLUMN recordings.participant_count IS
  'Denormalized count of entries in call_participants. '
  'Kept in sync by sync_participant_count trigger on call_participants.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
