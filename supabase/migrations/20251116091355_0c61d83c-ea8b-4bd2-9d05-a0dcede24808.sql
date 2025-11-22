-- Add AI-generated title and auto-tagging columns to fathom_calls
ALTER TABLE fathom_calls
ADD COLUMN IF NOT EXISTS ai_generated_title text,
ADD COLUMN IF NOT EXISTS ai_title_generated_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS auto_tags text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS auto_tags_generated_at timestamp with time zone;

-- Add index for auto_tags for better query performance
CREATE INDEX IF NOT EXISTS idx_fathom_calls_auto_tags ON fathom_calls USING gin(auto_tags);