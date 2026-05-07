-- Migration: Add sentiment_cache column to recordings table
-- Purpose: Phase 22 Plan 22-03 gap-close. The CONTEXT.md / RESEARCH.md and src/types/supabase.ts
--   all assumed `recordings.sentiment_cache` (JSONB) already existed because an earlier
--   migration added the same name to `fathom_calls`. Verifying production schema during
--   smoke test revealed the column was never added to `recordings`. The `get_sentiment` MCP
--   tool needs this column for its two-tier read-through cache (D-05, D-14).
-- Author: Phase 22 Wave 3 executor
-- Date: 2026-05-07

ALTER TABLE recordings
  ADD COLUMN IF NOT EXISTS sentiment_cache JSONB;

COMMENT ON COLUMN recordings.sentiment_cache IS
  'Cache for get_sentiment MCP tool (Phase 22 Plan 22-03). Shape: { overall: "positive"|"neutral"|"negative"|"mixed", talk_ratio: Array<{speaker_name, percentage}>, key_moments: Array<{timestamp, sentiment, snippet}> }. Null when not yet analyzed. Pre-Phase-22 in-app sentiment code, if any, may write a different shape — Tier 1 cache check in mcp-server validates shape before trusting.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
