-- Add auto-processing preferences to user_profiles table
-- This stores user preferences for AI title generation and auto-tagging features
-- Persisted to enable cross-device and cross-session preference synchronization

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS auto_processing_preferences JSONB DEFAULT '{
  "autoProcessingTitleGeneration": false,
  "autoProcessingTagging": false
}'::jsonb;

COMMENT ON COLUMN public.user_profiles.auto_processing_preferences IS 'User preferences for auto-processing features: autoProcessingTitleGeneration (AI-generated call titles), autoProcessingTagging (automatic call tagging)';
