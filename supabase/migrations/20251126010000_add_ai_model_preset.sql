-- Add AI model preset setting to user_settings table
-- This allows users to select their preferred AI model for metadata extraction

ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS ai_model_preset TEXT DEFAULT 'openai';

COMMENT ON COLUMN public.user_settings.ai_model_preset IS 'User preferred AI model preset: openai (gpt-5.1), anthropic (claude-3-haiku), google (gemini-1.5-flash), fast (gpt-4o-mini), quality (gpt-4o), best (claude-3-5-sonnet)';
