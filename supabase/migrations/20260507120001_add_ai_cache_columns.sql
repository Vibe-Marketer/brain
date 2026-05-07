-- Migration: Add per-tool AI cache columns to recordings
-- Purpose: Phase 22 — backing storage for `extract_action_items` and `get_coaching_notes` MCP tools.
--          `sentiment_cache` already exists; `summary` already caches `summarize-call` output.
--          See .planning/phases/22-ai-tools/22-CONTEXT.md (D-02) for the locked schema decision.
-- Author: Phase 22 plan-phase
-- Date: 2026-05-07

-- ============================================================================
-- ALTER: recordings — add two JSONB cache columns
-- ============================================================================
ALTER TABLE recordings
  ADD COLUMN IF NOT EXISTS action_items_cache JSONB,
  ADD COLUMN IF NOT EXISTS coaching_cache JSONB;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON COLUMN recordings.action_items_cache IS
  'Phase 22: cache for `extract_action_items` MCP tool LLM output. Read-through cache: `source_metadata.action_items` (Fathom-pre-extracted) takes precedence per D-04. JSONB shape: { items: Array<{ owner: string|null, action: string, due_date: string|null }> }.';
COMMENT ON COLUMN recordings.coaching_cache IS
  'Phase 22: cache for `get_coaching_notes` MCP tool LLM output. JSONB shape: { strengths: string[], improvements: string[], specific_examples: Array<{ topic: string, observation: string, suggestion: string }> }.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
