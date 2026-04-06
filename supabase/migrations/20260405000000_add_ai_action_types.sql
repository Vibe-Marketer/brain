-- Migration: Add new AI action types
-- Purpose: Support summarize_call and generate_content in AI usage tracking
-- Date: 2026-04-05

ALTER TABLE public.ai_usage
  DROP CONSTRAINT IF EXISTS ai_usage_action_type_check;

ALTER TABLE public.ai_usage
  ADD CONSTRAINT ai_usage_action_type_check CHECK (
    action_type IN ('smart_import', 'auto_name', 'auto_tag', 'chat_message', 'summarize_call', 'generate_content')
  );

COMMENT ON COLUMN ai_usage.action_type IS 'Type: smart_import | auto_name | auto_tag | chat_message | summarize_call | generate_content';
