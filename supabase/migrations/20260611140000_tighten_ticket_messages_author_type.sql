-- Migration: Tighten ticket_messages INSERT policy — author_type by role
-- Purpose: 11-05 hardening (codex cross-vendor audit, HIGH finding). The
--          original policy (20260611000002) checked author_id = auth.uid()
--          and parent-ticket visibility but NOT author_type, so any
--          authenticated reporter could spoof author_type = 'admin' or
--          'agent' on their own ticket. This recreate forces:
--            - non-admins        -> author_type = 'user' only
--            - admins (has_role) -> 'user' or 'admin'
--            - 'agent'           -> reserved for service-role (bypasses RLS;
--                                   no authenticated path can insert it)
-- Author: Plan 11-05 (hardening fix-pass)
-- Date: 2026-06-11

-- ============================================================================
-- RLS POLICY: recreate INSERT policy with author_type gating
-- ============================================================================
DROP POLICY IF EXISTS "Authors can add messages to visible tickets"
  ON public.ticket_messages;

CREATE POLICY "Authors can add messages to visible tickets"
  ON public.ticket_messages
  FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND (
      author_type = 'user'
      OR (author_type = 'admin' AND public.has_role(auth.uid(), 'ADMIN'))
    )
    AND EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_id
        AND (t.reporter_id = auth.uid() OR public.has_role(auth.uid(), 'ADMIN'))
    )
  );

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON POLICY "Authors can add messages to visible tickets"
  ON public.ticket_messages IS
  'INSERT gated by role: non-admins forced to author_type=''user''; admins may also use ''admin''; ''agent'' is reserved for service-role writes (11-05 hardening).';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
