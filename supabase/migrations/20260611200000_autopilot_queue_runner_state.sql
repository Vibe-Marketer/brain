-- Migration: Autopilot queue-control columns + runner_state visibility table
-- Purpose: AUTO-01 + AUTO-04 — repo-side schema contract for the autopilot
--          dispatcher (Phase 13). Adds queue-control columns to tickets
--          (priority/urgent for admin reordering and the urgent lane;
--          attempts/next_attempt_at for the atomic-claim exponential
--          backoff), the partial claim-queue index, and the single-row
--          runner_state table (status, current ticket, heartbeat,
--          kill_switch) that Phase 14 renders as a live status card.
--          RLS: priority/urgent are admin+service-role writable only
--          (verified — see Part B note); runner_state is admin-readable,
--          service-role writable, with kill_switch as the ONLY column an
--          authenticated admin may change (BEFORE UPDATE trigger guard).
-- Author: Phase 13 Plan 01 (dispatcher-mechanical-safety)
-- Date: 2026-06-11

-- ============================================================================
-- PART A — TICKETS: queue-control + claim-backoff columns
-- ============================================================================
-- priority/urgent implement the locked "Queue, priority, and urgency"
-- decision: claim order is urgent DESC, priority DESC, severity rank,
-- created_at ASC. attempts/next_attempt_at implement the dispatcher's
-- claim backoff (15min x 4^attempts) — rebind from the dead branch, which
-- had them on support_tickets; the live tickets table lacked them.
ALTER TABLE public.tickets
  ADD COLUMN priority integer NOT NULL DEFAULT 0,
  ADD COLUMN urgent boolean NOT NULL DEFAULT false,
  ADD COLUMN attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN next_attempt_at timestamptz;

-- ============================================================================
-- INDEXES
-- ============================================================================
-- Partial index serving the dispatcher claim query (only 'new' tickets are
-- claimable). Severity ranking is applied in the dispatcher via an explicit
-- rank map (enum order is NOT trusted), so it is not part of the index key.
CREATE INDEX idx_tickets_claim_queue
  ON public.tickets (urgent DESC, priority DESC, created_at ASC)
  WHERE status = 'new';

-- ============================================================================
-- PART B — RLS NOTE: priority/urgent are already admin+service-role only
-- ============================================================================
-- VERIFIED (2026-06-11, against the live policy set): public.tickets has
-- exactly three policies —
--   1. "Reporters and admins can view tickets"  (SELECT)
--   2. "Users can create their own tickets"     (INSERT, reporter_id = auth.uid())
--   3. "Admins can update tickets"              (UPDATE, USING + WITH CHECK
--                                                public.has_role(auth.uid(),'ADMIN'))
-- Reporters have NO UPDATE policy on tickets at all, and the only UPDATE
-- path is already gated to ADMIN. Column-level admin-only on priority and
-- urgent is therefore already satisfied; adding a redundant restrictive
-- policy would only complicate the policy surface. The INSERT policy does
-- not constrain priority/urgent, but a reporter self-assigning priority at
-- creation cannot escalate: the dispatcher orders by urgent/priority only
-- within admin-triaged flow, and an admin can reset both columns — accepted
-- per plan 13-01 Part B (T-13-01 mitigation is the absent non-admin UPDATE
-- path, proven by scripts/qa/verify-autopilot-rls.ts probe #3).

-- ============================================================================
-- PART C — TABLE: runner_state
-- ============================================================================
-- Single-row dispatcher visibility table (locked "Runner status visibility"
-- decision). The daemon (service-role) updates it every poll cycle and at
-- run transitions; Phase 14 renders it as a live status card. kill_switch
-- halts claiming within one poll cycle and is re-checked by the push-gate
-- immediately pre-push.
CREATE TABLE public.runner_state (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  status text NOT NULL DEFAULT 'idle'
    CHECK (status IN ('idle', 'claiming', 'running', 'awaiting_gate')),
  current_ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  run_started_at timestamptz,
  last_heartbeat timestamptz,
  last_result text,
  kill_switch boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed the single row. CHECK (id = 1) + this seed guarantee exactly one row.
INSERT INTO public.runner_state (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE public.runner_state ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
-- SELECT: admins only (Phase 14 status card reads via the admin session).
-- Reporters must not see runner internals (T-13-04).
CREATE POLICY "Admins can view runner state" ON public.runner_state
  FOR SELECT
  USING (public.has_role(auth.uid(), 'ADMIN'));

-- UPDATE: admins only at the row level; the kill_switch-only column
-- restriction is enforced by the runner_state_kill_switch_guard trigger
-- below (T-13-02). Service-role bypasses RLS (daemon heartbeat path).
-- Deliberately NO INSERT/DELETE policies: the row is seeded above and the
-- table is single-row, service-role managed.
CREATE POLICY "Admins can update runner state" ON public.runner_state
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

-- ============================================================================
-- TRIGGERS
-- ============================================================================
-- kill_switch-only guard (T-13-02). Mirrors the SECURITY DEFINER trigger
-- idiom from 20260611000002. auth.uid() is NULL under service-role, so the
-- daemon's status/heartbeat writes pass untouched; any authenticated caller
-- (admin via anon-key client) may flip kill_switch and NOTHING else.
-- updated_at is exempt — the touch trigger below owns it.
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
      RAISE EXCEPTION 'runner_state: authenticated callers may only change kill_switch';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS runner_state_kill_switch_guard ON public.runner_state;
CREATE TRIGGER runner_state_kill_switch_guard
  BEFORE UPDATE ON public.runner_state
  FOR EACH ROW EXECUTE FUNCTION public.enforce_runner_state_kill_switch_only();

-- updated_at touch trigger (copies the update_tickets_updated_at idiom).
CREATE OR REPLACE FUNCTION public.update_runner_state_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS runner_state_updated_at ON public.runner_state;
CREATE TRIGGER runner_state_updated_at
  BEFORE UPDATE ON public.runner_state
  FOR EACH ROW EXECUTE FUNCTION public.update_runner_state_updated_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON COLUMN public.tickets.priority IS
  'Queue-control: admin-set ordering weight (higher = sooner). Claim order: urgent DESC, priority DESC, severity rank, created_at ASC. Admin+service-role writable only (no non-admin UPDATE policy exists on tickets).';
COMMENT ON COLUMN public.tickets.urgent IS
  'Queue-control: urgent lane. An urgent ticket is claimed next regardless of priority/severity; in-flight runs are never killed, but queue cooldown is skipped. Admin+service-role writable only.';
COMMENT ON COLUMN public.tickets.attempts IS
  'Dispatcher claim counter: incremented on every atomic claim. Tickets at or past max attempts are skipped by the claim query.';
COMMENT ON COLUMN public.tickets.next_attempt_at IS
  'Dispatcher claim backoff: earliest next claim time (15min x 4^attempts). NULL = claimable immediately.';
COMMENT ON INDEX public.idx_tickets_claim_queue IS
  'Partial index serving the dispatcher claim query over status=''new'' tickets in locked claim order.';

COMMENT ON TABLE public.runner_state IS
  'Single-row autopilot dispatcher visibility (AUTO-04). Daemon (service-role) updates every poll cycle and at run transitions; Phase 14 renders the live status card. kill_switch halts claiming within one poll cycle. CHECK (id = 1) + seed row = exactly one row.';
COMMENT ON COLUMN public.runner_state.status IS
  'Dispatcher state machine: idle | claiming | running | awaiting_gate.';
COMMENT ON COLUMN public.runner_state.current_ticket_id IS
  'Ticket currently being worked, NULL when idle. ON DELETE SET NULL so ticket cascades (e.g. reporter account deletion) are never blocked.';
COMMENT ON COLUMN public.runner_state.run_started_at IS
  'Start of the in-flight run; watchdog compares against the 2400s budget.';
COMMENT ON COLUMN public.runner_state.last_heartbeat IS
  'Daemon liveness: written every poll cycle. Staleness => "runner offline" in Phase 14 and a watchdog page.';
COMMENT ON COLUMN public.runner_state.last_result IS
  'Outcome of the most recent run (verdict/summary string written by the dispatcher).';
COMMENT ON COLUMN public.runner_state.kill_switch IS
  'Admin kill switch: the ONLY column an authenticated caller may change (runner_state_kill_switch_guard). true halts claiming within one poll cycle; push-gate re-checks immediately pre-push.';
COMMENT ON COLUMN public.runner_state.updated_at IS
  'Touch-trigger maintained (runner_state_updated_at).';

COMMENT ON POLICY "Admins can view runner state" ON public.runner_state IS
  'Runner internals are admin-only (T-13-04); reporters get zero rows. Service-role bypasses RLS for daemon reads.';
COMMENT ON POLICY "Admins can update runner state" ON public.runner_state IS
  'Row-level admin gate; column-level kill_switch-only restriction enforced by the runner_state_kill_switch_guard trigger (T-13-02).';
COMMENT ON FUNCTION public.enforce_runner_state_kill_switch_only() IS
  'BEFORE UPDATE guard: authenticated callers (auth.uid() NOT NULL) may only change kill_switch; service-role (auth.uid() NULL) writes pass. T-13-02 mitigation.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
