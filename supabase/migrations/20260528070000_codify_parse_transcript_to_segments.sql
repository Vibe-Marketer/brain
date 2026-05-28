-- Codify orphan function: parse_transcript_to_segments(bigint, text).
--
-- This function exists in prod but had no defining migration in the repo. It is
-- LOAD-BEARING: `parse_transcript_chunks_for_recording()` (created by migration
-- 20260310000002) calls it. If the DB were ever rebuilt from migrations alone,
-- transcript parsing would silently break.
--
-- Definition captured from prod (`pg_get_functiondef`) on 2026-05-28 and recreated
-- here verbatim. Idempotent via CREATE OR REPLACE.
--
-- Refs:
--   - .planning/forensics/schema-drift-audit-2026-05-28.md (MEDIUM finding #4)
--   - .planning/forensics/schema-drift-fix-2026-05-28.md

CREATE OR REPLACE FUNCTION public.parse_transcript_to_segments(
  p_recording_id bigint,
  p_full_transcript text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  segment_count INTEGER := 0;
  line TEXT;
  lines TEXT[];
  timestamp_str TEXT;
  speaker_name TEXT;
  segment_text TEXT;
  match_result TEXT[];
BEGIN
  IF p_full_transcript IS NULL OR LENGTH(p_full_transcript) < 10 THEN
    RETURN 0;
  END IF;

  -- Split by double newlines (paragraph breaks between speakers)
  lines := string_to_array(p_full_transcript, E'\n\n');

  FOR i IN 1..array_length(lines, 1) LOOP
    line := TRIM(lines[i]);

    -- Skip empty lines
    IF LENGTH(line) < 5 THEN
      CONTINUE;
    END IF;

    -- Parse format: [HH:MM:SS] Speaker Name: Text
    -- Use regex to extract timestamp, speaker, and text
    IF line ~ '^\[(\d{2}:\d{2}:\d{2})\]\s+([^:]+):\s*(.*)$' THEN
      -- Extract components using substring
      timestamp_str := substring(line from '^\[(\d{2}:\d{2}:\d{2})\]');
      speaker_name := TRIM(substring(line from '^\[\d{2}:\d{2}:\d{2}\]\s+([^:]+):'));
      segment_text := TRIM(substring(line from '^\[\d{2}:\d{2}:\d{2}\]\s+[^:]+:\s*(.*)$'));

      -- Skip if we couldn't parse properly
      IF speaker_name IS NULL OR segment_text IS NULL OR LENGTH(segment_text) < 1 THEN
        CONTINUE;
      END IF;

      -- Insert the segment
      INSERT INTO fathom_transcripts (
        recording_id,
        speaker_name,
        speaker_email,
        text,
        timestamp,
        is_deleted
      ) VALUES (
        p_recording_id,
        speaker_name,
        NULL, -- We don't have email from parsed text
        segment_text,
        timestamp_str,
        false
      );

      segment_count := segment_count + 1;
    END IF;
  END LOOP;

  RETURN segment_count;
END;
$function$;

COMMENT ON FUNCTION public.parse_transcript_to_segments(bigint, text) IS
  'Parses a Fathom-style [HH:MM:SS] Speaker: Text transcript blob into individual rows in fathom_transcripts. Called by parse_transcript_chunks_for_recording(). Codified from prod 2026-05-28 (orphan-codification audit).';
