-- Migration: Phase 23 reporter lifecycle notifications
-- Purpose: D-00/D-01/D-03 — customer-visible in-app status updates must
--          fail closed to source='in_app_user', reuse user_notifications, and
--          emit only locked reassurance templates without operator internals.

CREATE OR REPLACE FUNCTION public.notify_in_app_reporter_from_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_ticket RECORD;
  v_kind TEXT;
  v_title TEXT;
  v_body TEXT;
BEGIN
  SELECT t.id, t.source, t.reporter_id
  INTO v_ticket
  FROM public.tickets t
  WHERE t.id = NEW.ticket_id;

  IF v_ticket.id IS NULL
    OR v_ticket.source IS DISTINCT FROM 'in_app_user'
    OR v_ticket.reporter_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.event_type = 'created' THEN
    v_kind := 'received';
    v_title := 'We received your report';
    v_body := 'We received your report and are tracking it.';
  ELSIF NEW.event_type = 'status_change' AND NEW.new_value = 'in_progress' THEN
    v_kind := 'in_progress';
    v_title := 'We are working on your report';
    v_body := 'We are working on your report now.';
  ELSIF NEW.event_type = 'status_change' AND NEW.new_value = 'escalated' THEN
    v_kind := 'escalated';
    v_title := 'We are taking a closer look';
    v_body := 'We are taking a closer look and will keep tracking this for you.';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.user_notifications (user_id, type, title, body, metadata)
  SELECT
    v_ticket.reporter_id,
    'info',
    v_title,
    v_body,
    jsonb_build_object(
      'ticket_id', v_ticket.id,
      'kind', v_kind,
      'source', 'in_app_user'
    )
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.user_notifications n
    WHERE n.user_id = v_ticket.reporter_id
      AND n.metadata->>'ticket_id' = v_ticket.id::text
      AND n.metadata->>'kind' = v_kind
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS ticket_event_reporter_lifecycle_notify ON public.ticket_events;
CREATE TRIGGER ticket_event_reporter_lifecycle_notify
  AFTER INSERT ON public.ticket_events
  FOR EACH ROW EXECUTE FUNCTION public.notify_in_app_reporter_from_event();

COMMENT ON FUNCTION public.notify_in_app_reporter_from_event() IS
  'Phase 23 reporter comms: fail-closed in_app_user lifecycle notifications for received, in_progress, and escalated ticket events.';
