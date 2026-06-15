-- Migration: Phase 23 reporter lifecycle notification dedup hardening
-- Purpose: Make duplicate reporter lifecycle notifications impossible under
--          concurrent trigger execution. The trigger keeps its NOT EXISTS
--          fast path; this partial unique index is the database authority.

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_notifications_reporter_lifecycle_dedup
  ON public.user_notifications (
    user_id,
    (metadata->>'ticket_id'),
    (metadata->>'kind')
  )
  WHERE type = 'info'
    AND metadata->>'source' = 'in_app_user'
    AND metadata->>'ticket_id' IS NOT NULL
    AND metadata->>'kind' IN ('received', 'in_progress', 'escalated');
