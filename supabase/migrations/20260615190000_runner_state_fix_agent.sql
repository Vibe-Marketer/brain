-- Add an operator-controlled primary fix-agent switch for the autopilot runner.
-- Service-role daemon writes still bypass auth.uid() and can update heartbeat
-- fields; authenticated admins may update only kill_switch and fix_agent.

ALTER TABLE public.runner_state
  ADD COLUMN IF NOT EXISTS fix_agent text NOT NULL DEFAULT 'codex'
  CONSTRAINT runner_state_fix_agent_check CHECK (fix_agent IN ('claude', 'codex'));

UPDATE public.runner_state
SET fix_agent = 'codex'
WHERE id = 1
  AND fix_agent IS NULL;

CREATE OR REPLACE FUNCTION public.enforce_runner_state_kill_switch_only()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.current_ticket_id IS DISTINCT FROM OLD.current_ticket_id
       OR NEW.run_started_at IS DISTINCT FROM OLD.run_started_at
       OR NEW.last_heartbeat IS DISTINCT FROM OLD.last_heartbeat
       OR NEW.last_result IS DISTINCT FROM OLD.last_result THEN
      RAISE EXCEPTION 'runner_state: authenticated callers may only change kill_switch or fix_agent';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

COMMENT ON COLUMN public.runner_state.fix_agent IS
  'Admin-selected primary fix agent. claude makes Claude primary and Codex the rate-limit fallback; codex keeps Codex primary and Claude fallback.';
COMMENT ON FUNCTION public.enforce_runner_state_kill_switch_only() IS
  'BEFORE UPDATE guard: authenticated callers (auth.uid() NOT NULL) may only change kill_switch or fix_agent; service-role (auth.uid() NULL) writes pass.';
