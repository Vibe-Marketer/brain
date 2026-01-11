-- Migration: Create insights table for storing Agent 2 (Insight Miner) output
-- Purpose: Store extracted insights from call transcripts for content generation pipeline
-- Author: Claude Code
-- Date: 2026-01-11

-- ============================================================================
-- TABLE: insights
-- ============================================================================
-- Stores insights extracted from call transcripts by Agent 2 (Insight Miner)
-- This is an internal table used by the content generation pipeline
-- Not directly exposed in the UI - used to feed Agent 3 (Hook Generator)
CREATE TABLE IF NOT EXISTS public.insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recording_id BIGINT NOT NULL,

  -- Insight classification
  category TEXT NOT NULL CHECK (category IN (
    'pain',
    'dream_outcome',
    'objection_or_fear',
    'story_or_analogy',
    'expert_framework'
  )),

  -- Content fields
  exact_quote TEXT NOT NULL,
  speaker TEXT,
  timestamp TEXT,
  why_it_matters TEXT,

  -- Scoring fields
  score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
  emotion_category TEXT,
  virality_score INTEGER CHECK (virality_score IS NULL OR (virality_score >= 1 AND virality_score <= 5)),
  topic_hint TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints for reasonable content limits
  CONSTRAINT insights_exact_quote_length CHECK (char_length(exact_quote) <= 5000),
  CONSTRAINT insights_why_it_matters_length CHECK (why_it_matters IS NULL OR char_length(why_it_matters) <= 2000),
  CONSTRAINT insights_speaker_length CHECK (speaker IS NULL OR char_length(speaker) <= 255),
  CONSTRAINT insights_topic_hint_length CHECK (topic_hint IS NULL OR char_length(topic_hint) <= 500),
  CONSTRAINT insights_emotion_category_length CHECK (emotion_category IS NULL OR char_length(emotion_category) <= 100),

  -- Composite foreign key to fathom_calls
  CONSTRAINT insights_fathom_call_fkey
    FOREIGN KEY (recording_id, user_id)
    REFERENCES public.fathom_calls(recording_id, user_id)
    ON DELETE CASCADE
);

-- ============================================================================
-- INDEXES
-- ============================================================================
-- Performance indexes for common query patterns

-- Index for looking up insights by user
CREATE INDEX IF NOT EXISTS idx_insights_user_id
  ON public.insights(user_id);

-- Index for looking up insights by recording
CREATE INDEX IF NOT EXISTS idx_insights_recording_id
  ON public.insights(recording_id);

-- Index for filtering by category
CREATE INDEX IF NOT EXISTS idx_insights_category
  ON public.insights(category);

-- Index for filtering by score (to get high-scoring insights)
CREATE INDEX IF NOT EXISTS idx_insights_score
  ON public.insights(score DESC);

-- Index for filtering by virality score
CREATE INDEX IF NOT EXISTS idx_insights_virality_score
  ON public.insights(virality_score DESC) WHERE virality_score IS NOT NULL;

-- Composite index for efficient user + recording lookups
CREATE INDEX IF NOT EXISTS idx_insights_user_recording
  ON public.insights(user_id, recording_id);

-- Index for sorting by creation date (most recent first)
CREATE INDEX IF NOT EXISTS idx_insights_created_at
  ON public.insights(created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- Enable RLS on insights table
ALTER TABLE public.insights ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES: insights
-- ============================================================================

-- Policy: Users can view their own insights
CREATE POLICY "Users can view their own insights"
  ON public.insights
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own insights
CREATE POLICY "Users can insert their own insights"
  ON public.insights
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own insights
CREATE POLICY "Users can update their own insights"
  ON public.insights
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own insights
CREATE POLICY "Users can delete their own insights"
  ON public.insights
  FOR DELETE
  USING (auth.uid() = user_id);

-- Policy: Service role can manage all insights (for edge functions)
CREATE POLICY "Service role can manage insights"
  ON public.insights
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- PERMISSIONS
-- ============================================================================
-- Grant permissions to authenticated users
GRANT ALL ON public.insights TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================
-- Add helpful comments to table and columns

COMMENT ON TABLE public.insights IS
  'Stores insights extracted from call transcripts by Agent 2 (Insight Miner). Internal table for content generation pipeline.';

COMMENT ON COLUMN public.insights.user_id IS
  'User who owns this insight (the call owner)';

COMMENT ON COLUMN public.insights.recording_id IS
  'Reference to the fathom_calls recording this insight was extracted from';

COMMENT ON COLUMN public.insights.category IS
  'Type of insight: pain, dream_outcome, objection_or_fear, story_or_analogy, or expert_framework';

COMMENT ON COLUMN public.insights.exact_quote IS
  'The exact quote from the transcript that represents this insight (max 5,000 chars)';

COMMENT ON COLUMN public.insights.speaker IS
  'Name or identifier of the person who said the quote';

COMMENT ON COLUMN public.insights.timestamp IS
  'Timestamp within the call when this insight occurred (format: HH:MM:SS or similar)';

COMMENT ON COLUMN public.insights.why_it_matters IS
  'Explanation of why this insight is valuable for content generation (max 2,000 chars)';

COMMENT ON COLUMN public.insights.score IS
  'Quality/relevance score from 1-5, where 5 is most valuable. Used to filter top insights for hooks.';

COMMENT ON COLUMN public.insights.emotion_category IS
  'Emotional category of the insight (e.g., frustration, excitement, fear, hope)';

COMMENT ON COLUMN public.insights.virality_score IS
  'Predicted virality potential from 1-5, where 5 is most likely to go viral';

COMMENT ON COLUMN public.insights.topic_hint IS
  'Topic or theme hint for organizing and filtering insights (max 500 chars)';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
