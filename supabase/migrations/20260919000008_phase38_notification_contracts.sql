-- Phase 38: normalize future recording-access notification payloads.
-- Existing notifications remain readable through the frontend legacy guard.

BEGIN;

CREATE OR REPLACE FUNCTION public.phase38_normalize_access_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request public.recording_access_requests%ROWTYPE;
  v_recording public.recordings%ROWTYPE;
  v_kind TEXT;
  v_route TEXT;
BEGIN
  IF NEW.type NOT IN (
    'recording_access_requested',
    'recording_access_approved',
    'recording_access_denied'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_request
  FROM public.recording_access_requests
  WHERE id = NULLIF(NEW.metadata ->> 'request_id', '')::UUID;

  IF v_request.id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_recording
  FROM public.recordings
  WHERE id = v_request.recording_id;

  IF v_recording.id IS NULL THEN
    RETURN NEW;
  END IF;

  v_kind := CASE NEW.type
    WHEN 'recording_access_requested' THEN 'requested'
    WHEN 'recording_access_approved' THEN 'approved'
    ELSE 'denied'
  END;
  v_route := '/call/' || v_recording.id::TEXT ||
    CASE WHEN v_kind = 'requested'
      THEN '?accessRequest=' || v_request.id::TEXT
      ELSE ''
    END;

  NEW.metadata := jsonb_strip_nulls(jsonb_build_object(
    'source', 'recording_access',
    'kind', v_kind,
    'recording_id', v_recording.id,
    'request_id', v_request.id,
    'cooldown_until', CASE WHEN v_kind = 'denied' THEN v_request.cooldown_until ELSE NULL END,
    'route', v_route
  ));

  IF v_kind = 'requested' THEN
    NEW.title := 'Access requested';
    NEW.body := COALESCE(v_request.requester_name, 'A confirmed participant') ||
      ' requested access to “' || COALESCE(v_recording.title, 'Untitled recording') || '”.';
  ELSIF v_kind = 'approved' THEN
    NEW.title := 'Access approved';
    NEW.body := 'You can now view “' || COALESCE(v_recording.title, 'Untitled recording') || '”.';
  ELSE
    NEW.title := 'Access request denied';
    NEW.body := 'Your request for “' || COALESCE(v_recording.title, 'Untitled recording') ||
      '” wasn''t approved. You can request again after ' ||
      to_char(v_request.cooldown_until AT TIME ZONE 'UTC', 'FMMonth FMDD, YYYY') || '.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.phase38_normalize_access_notification() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phase38_normalize_access_notification() TO service_role;

DROP TRIGGER IF EXISTS phase38_normalize_access_notification ON public.user_notifications;
CREATE TRIGGER phase38_normalize_access_notification
  BEFORE INSERT ON public.user_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.phase38_normalize_access_notification();

COMMENT ON FUNCTION public.phase38_normalize_access_notification() IS
  'Normalizes future Phase 38 access notifications to stable typed metadata and canonical /call UUID routes.';

COMMIT;
