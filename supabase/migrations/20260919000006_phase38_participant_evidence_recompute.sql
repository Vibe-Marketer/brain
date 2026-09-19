-- Recompute participant evidence deterministically on every write so removing
-- transcript/host/calendar sources cannot leave stale affirmative evidence.
CREATE OR REPLACE FUNCTION public.normalize_recording_participant_evidence()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.participant_type = 'speaker'
     AND NEW.sources && ARRAY['transcript', 'transcript_speaker']::TEXT[] THEN
    NEW.role := 'speaker';
    NEW.has_confirmed_speech := TRUE;
  ELSIF NEW.participant_type = 'host'
        OR NEW.sources @> ARRAY['recorded_by']::TEXT[] THEN
    NEW.role := 'organizer';
    NEW.has_confirmed_speech := FALSE;
  ELSIF NEW.sources @> ARRAY['calendar_invitees']::TEXT[] THEN
    NEW.role := 'invitee';
    NEW.has_confirmed_speech := FALSE;
  ELSE
    NEW.role := 'attendee';
    NEW.has_confirmed_speech := FALSE;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.normalize_recording_participant_evidence()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_recording_participant_evidence()
  TO service_role;
