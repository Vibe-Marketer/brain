-- Migration: Add feature_request + improvement to ticket_type enum
-- Purpose: Extend the human-facing ticket taxonomy so operators/customers can
--          file feature requests and improvements (a human backlog), distinct
--          from bug/task. Routing away from the autopilot auto-fix loop is
--          handled in the autopilot repo's claim query (not here).
-- Date: 2026-07-21

-- ADD VALUE is safe/non-breaking (append-only on an existing enum); IF NOT
-- EXISTS makes it idempotent so a re-run against an already-migrated DB no-ops.
ALTER TYPE public.ticket_type ADD VALUE IF NOT EXISTS 'feature_request';
ALTER TYPE public.ticket_type ADD VALUE IF NOT EXISTS 'improvement';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
