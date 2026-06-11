-- Migration: Create ticket tables (tickets, ticket_messages, ticket_events)
-- Purpose: TKT-01 + TKT-04 — DB-backed ticket persistence with reporter/admin
--          RLS and an engine-enforced status-transition audit trail. The
--          support form's Edge Function pivots to insert here first; the
--          Resend email becomes a side-effect. Enums lock the status
--          lifecycle (ISC-7); the SECURITY DEFINER trigger guarantees every
--          status transition writes a ticket_events row (ISC-8), even under
--          service-role.
-- Author: Phase 11 Plan 02 (ticket-foundation-flag-removal)
-- Date: 2026-06-11

-- ============================================================================
-- ENUMS
-- ============================================================================
-- Locked status lifecycle: new -> triaged -> in_progress ->
-- awaiting_approval | awaiting_user -> resolved | rejected | escalated.
-- All eight values created now to avoid ALTER TYPE churn in Phases 12-15.
CREATE TYPE public.ticket_status AS ENUM (
  'new',
  'triaged',
  'in_progress',
  'awaiting_approval',
  'awaiting_user',
  'resolved',
  'rejected',
  'escalated'
);

CREATE TYPE public.ticket_type AS ENUM ('bug', 'suggestion', 'question', 'task');

CREATE TYPE public.ticket_severity AS ENUM ('critical', 'high', 'medium', 'low');

-- 'sentry' ships now for Phase 12 ingestion forward-compat.
CREATE TYPE public.ticket_source AS ENUM ('manual', 'sentry');

-- ============================================================================
-- TABLE: tickets
-- ============================================================================
-- One row per support/bug/task ticket. DB is the system of record (the
-- support email is a side-effect). reporter_id is always set server-side
-- from the authenticated JWT — never from a request body.
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.ticket_type NOT NULL,
  severity public.ticket_severity NOT NULL DEFAULT 'medium',
  status public.ticket_status NOT NULL DEFAULT 'new',
  source public.ticket_source NOT NULL DEFAULT 'manual',
  fingerprint TEXT,            -- Phase 12 Sentry dedup; unique when not null
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- TABLE: ticket_messages
-- ============================================================================
-- Conversation thread per ticket. attachments JSONB is Phase 15
-- forward-compat (screenshots / console buffers).
CREATE TABLE public.ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  author_type TEXT NOT NULL CHECK (author_type IN ('user', 'agent', 'admin')),
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- TABLE: ticket_events
-- ============================================================================
-- Append-only lifecycle audit trail. Status transitions are written by the
-- DB trigger below; other lifecycle events (e.g. 'created') are written by
-- service-role code. No UPDATE/DELETE policies — audit integrity.
CREATE TABLE public.ticket_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- NULL = system/service-role
  event_type TEXT NOT NULL,            -- 'created' | 'status_change' | future lifecycle events
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX idx_tickets_reporter_id ON public.tickets(reporter_id);
CREATE INDEX idx_tickets_status ON public.tickets(status);
CREATE INDEX idx_ticket_messages_ticket_id ON public.ticket_messages(ticket_id);
CREATE INDEX idx_ticket_events_ticket_id ON public.ticket_events(ticket_id);
-- Phase 12 dedup forward-compat: fingerprint unique when present.
CREATE UNIQUE INDEX idx_tickets_fingerprint_unique
  ON public.tickets(fingerprint)
  WHERE fingerprint IS NOT NULL;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_events ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
-- tickets: reporter sees own; ADMIN sees all (has_role is SECURITY DEFINER —
-- prevents RLS recursion). No DELETE policy: tickets are never deleted.
CREATE POLICY "Reporters and admins can view tickets" ON public.tickets
  FOR SELECT
  USING (reporter_id = auth.uid() OR public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Users can create their own tickets" ON public.tickets
  FOR INSERT
  WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "Admins can update tickets" ON public.tickets
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

-- ticket_messages: visibility mirrors the parent ticket (ISC-5).
CREATE POLICY "Ticket participants can view messages" ON public.ticket_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_id
        AND (t.reporter_id = auth.uid() OR public.has_role(auth.uid(), 'ADMIN'))
    )
  );

CREATE POLICY "Authors can add messages to visible tickets" ON public.ticket_messages
  FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_id
        AND (t.reporter_id = auth.uid() OR public.has_role(auth.uid(), 'ADMIN'))
    )
  );

-- ticket_events: visibility mirrors the parent ticket. Deliberately NO
-- INSERT policy for authenticated — events are written only by the
-- SECURITY DEFINER trigger and service-role code (append-only audit).
CREATE POLICY "Ticket participants can view events" ON public.ticket_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_id
        AND (t.reporter_id = auth.uid() OR public.has_role(auth.uid(), 'ADMIN'))
    )
  );

-- ============================================================================
-- TRIGGERS
-- ============================================================================
-- updated_at touch trigger (codify idiom).
CREATE OR REPLACE FUNCTION public.update_tickets_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tickets_updated_at ON public.tickets;
CREATE TRIGGER tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_tickets_updated_at();

-- Status-transition audit trigger (TKT-04 / ISC-8). SECURITY DEFINER is
-- required: ticket_events has no INSERT policy for authenticated, so a
-- caller-privilege trigger would be blocked by RLS when an admin updates
-- status via the anon-key client (Pitfall 1). auth.uid() is NULL under
-- service-role — actor_id is nullable by design (system transitions).
CREATE OR REPLACE FUNCTION public.log_ticket_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.ticket_events (ticket_id, actor_id, event_type, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'status_change', OLD.status::text, NEW.status::text);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS ticket_status_audit ON public.tickets;
CREATE TRIGGER ticket_status_audit
  AFTER UPDATE OF status ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.log_ticket_status_change();

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE public.tickets IS
  'Support/bug/task tickets. DB is the system of record (TKT-01); the support email is a side-effect. reporter_id always set server-side from the authenticated JWT.';
COMMENT ON COLUMN public.tickets.fingerprint IS
  'Phase 12 Sentry dedup key; unique when not null (partial unique index).';
COMMENT ON COLUMN public.tickets.context IS
  'Capture context: url, userAgent, organizationId, workspaceId, appVersion, commit, replyEmail.';
COMMENT ON TABLE public.ticket_messages IS
  'Conversation thread per ticket. attachments JSONB reserved for Phase 15 (screenshots/console buffers).';
COMMENT ON TABLE public.ticket_events IS
  'Append-only ticket lifecycle audit trail (TKT-04). Status transitions written by the ticket_status_audit trigger; other lifecycle events by service-role code. actor_id NULL = system/service-role.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
