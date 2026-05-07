-- Migration: Relax ai_usage.action_type CHECK constraint
-- Purpose: Plan 22-01 added 4 new MCP action types to the in-process VALID_ACTION_TYPES
--          whitelist in track-ai-usage/index.ts AND created _shared/track-ai-usage-inline.ts
--          for the MCP server, but did NOT update the database-level CHECK constraint on
--          ai_usage.action_type. As a result, the inline gating helper's INSERTs were
--          silently rejected by the constraint check and no ai_usage rows were written
--          for any MCP AI tool calls. Discovered during Plan 22-02 smoke testing.
--
--          The application layer (VALID_ACTION_TYPES + McpAiActionType TypeScript union)
--          already enforces a strict whitelist before any insert reaches the database, so
--          the DB-level CHECK constraint is now redundant. We drop the stale constraint
--          rather than re-add it with the expanded list — the application is the source
--          of truth and any future action-type additions only need to update one place.
-- Author: Phase 22 Plan 02 gap-close
-- Date: 2026-05-07

ALTER TABLE ai_usage DROP CONSTRAINT IF EXISTS ai_usage_action_type_check;

COMMENT ON COLUMN ai_usage.action_type IS
  'Action type identifier. Whitelist enforced at the application layer in '
  'supabase/functions/track-ai-usage/index.ts (VALID_ACTION_TYPES) and '
  'supabase/functions/_shared/track-ai-usage-inline.ts (McpAiActionType). '
  'Known values: smart_import, auto_name, auto_tag, chat_message, '
  'mcp_action_items, mcp_ask_call, mcp_sentiment, mcp_coaching.';
