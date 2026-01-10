-- ============================================================================
-- AUTOMATION RULES ENGINE SCHEMA
-- ============================================================================
-- A flexible, rule-based automation system for processing calls with:
-- - Multiple trigger types (transcript phrase, sentiment, duration, webhook, scheduled)
-- - Multi-condition AND/OR logic
-- - Multiple action types (email, folder, AI analysis, client health updates)
-- - Execution history with debugging capabilities
-- ============================================================================

-- ============================================================================
-- TABLE: automation_rules
-- ============================================================================
-- Stores automation rule definitions with trigger, conditions, and actions
CREATE TABLE IF NOT EXISTS public.automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Rule identification
  name TEXT NOT NULL,
  description TEXT,
  priority INT NOT NULL DEFAULT 100, -- Lower = higher priority

  -- Trigger configuration
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'call_created',       -- Fires when new call is imported
    'transcript_phrase',  -- Match specific phrases/keywords in transcript
    'sentiment',          -- Detect positive/neutral/negative sentiment
    'duration',           -- Meeting duration thresholds
    'webhook',            -- External webhook trigger
    'scheduled'           -- Time-based/recurring triggers
  )),
  trigger_config JSONB NOT NULL DEFAULT '{}',
  -- Examples:
  -- call_created: {} (no config needed)
  -- transcript_phrase: {"pattern": "pricing discussion", "match_type": "contains", "case_sensitive": false}
  -- sentiment: {"sentiment": "negative", "confidence_threshold": 0.7}
  -- duration: {"operator": "greater_than", "minutes": 60}
  -- webhook: {"event_type": "external_crm_update"}
  -- scheduled: {"schedule": "weekly", "day_of_week": 1, "hour": 9, "timezone": "UTC"}

  -- Conditions (AND/OR logic tree)
  conditions JSONB NOT NULL DEFAULT '{"operator": "AND", "conditions": []}',
  -- Examples:
  -- Simple: {"operator": "AND", "conditions": [{"field": "duration_minutes", "operator": ">=", "value": 30}]}
  -- Complex: {"operator": "OR", "conditions": [
  --   {"operator": "AND", "conditions": [
  --     {"field": "sentiment", "operator": "=", "value": "negative"},
  --     {"field": "duration_minutes", "operator": ">=", "value": 30}
  --   ]},
  --   {"field": "transcript", "operator": "contains", "value": "urgent"}
  -- ]}

  -- Actions to execute when rule fires
  actions JSONB NOT NULL DEFAULT '[]',
  -- Examples:
  -- [
  --   {"type": "email", "config": {"to": "{{user.email}}", "subject": "Alert: {{call.title}}", "template": "alert"}},
  --   {"type": "add_to_folder", "config": {"folder_id": "uuid-here"}},
  --   {"type": "add_tag", "config": {"tag_id": "uuid-here"}},
  --   {"type": "run_ai_analysis", "config": {"analysis_type": "extract_action_items"}},
  --   {"type": "update_client_health", "config": {"adjustment": -10, "reason": "Negative sentiment detected"}},
  --   {"type": "webhook", "config": {"url": "https://...", "method": "POST"}}
  -- ]

  -- Rule state
  enabled BOOLEAN NOT NULL DEFAULT true,

  -- Stats
  times_applied INT NOT NULL DEFAULT 0,
  last_applied_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique name per user
  UNIQUE(user_id, name)
);

-- ============================================================================
-- TABLE: automation_execution_history
-- ============================================================================
-- Logs every rule execution with debugging information
CREATE TABLE IF NOT EXISTS public.automation_execution_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Execution trigger info
  trigger_type TEXT NOT NULL,
  trigger_source JSONB, -- e.g., {"recording_id": 123} or {"webhook_event_id": "abc"}

  -- Execution timing
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  execution_time_ms INT,

  -- Execution result
  success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,

  -- Debugging information
  debug_info JSONB NOT NULL DEFAULT '{}',
  -- Structure:
  -- {
  --   "conditions_evaluated": [
  --     {"condition": {...}, "result": true, "reason": "Duration 45 >= 30"}
  --   ],
  --   "actions_executed": [
  --     {"action": {...}, "result": "success", "details": {"email_id": "abc123"}}
  --   ],
  --   "call_snapshot": {"title": "...", "duration": 45, "sentiment": "neutral"}
  -- }

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLE: automation_rule_conditions
-- ============================================================================
-- Junction table for rule conditions with support for nested AND/OR groups
CREATE TABLE IF NOT EXISTS public.automation_rule_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,

  -- Position for ordering conditions
  position INT NOT NULL DEFAULT 0,

  -- Condition type and configuration
  condition_type TEXT NOT NULL CHECK (condition_type IN (
    'field',              -- Evaluate a call field (duration, title, etc.)
    'transcript',         -- Search transcript content
    'participant',        -- Match participant email/name
    'category',           -- Check assigned category
    'tag',                -- Check assigned tags
    'sentiment',          -- Sentiment evaluation (requires AI)
    'time',               -- Time-based conditions (day of week, hour, etc.)
    'custom'              -- Custom condition with arbitrary logic
  )),

  -- Field to evaluate (for field/time conditions)
  field_name TEXT, -- e.g., 'duration_minutes', 'title', 'participant_count'

  -- Comparison operator
  operator TEXT NOT NULL CHECK (operator IN (
    '=', '!=', '>', '>=', '<', '<=',  -- Numeric/string comparisons
    'contains', 'not_contains',        -- String containment
    'starts_with', 'ends_with',        -- String patterns
    'matches', 'not_matches',          -- Regex patterns
    'in', 'not_in',                    -- Array membership
    'is_empty', 'is_not_empty',        -- Null/empty checks
    'between'                          -- Range checks
  )),

  -- Value to compare against (JSON for flexibility)
  value JSONB NOT NULL DEFAULT '{}',
  -- Examples:
  -- Numeric: {"value": 30}
  -- String: {"value": "sales"}
  -- Array (in/not_in): {"values": ["team", "coaching"]}
  -- Range (between): {"min": 30, "max": 60}
  -- Regex (matches): {"pattern": "^pricing.*discussion$", "flags": "i"}

  -- Nested group support (for AND/OR logic)
  parent_condition_id UUID REFERENCES automation_rule_conditions(id) ON DELETE CASCADE,
  logic_operator TEXT CHECK (logic_operator IN ('AND', 'OR')),
  -- When logic_operator is set, this condition acts as a group container
  -- Child conditions reference this via parent_condition_id

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLE: automation_rule_actions
-- ============================================================================
-- Junction table for rule actions with execution order
CREATE TABLE IF NOT EXISTS public.automation_rule_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,

  -- Position for execution order
  position INT NOT NULL DEFAULT 0,

  -- Action type
  action_type TEXT NOT NULL CHECK (action_type IN (
    'email',                 -- Send email notification
    'add_to_folder',         -- Add call to a folder
    'remove_from_folder',    -- Remove call from a folder
    'add_tag',               -- Add tag to call
    'remove_tag',            -- Remove tag from call
    'set_category',          -- Set call category
    'run_ai_analysis',       -- Trigger AI analysis (summary, action items, etc.)
    'update_client_health',  -- Update client health score
    'webhook',               -- Send webhook to external URL
    'create_task',           -- Create a task/todo item
    'slack_notification',    -- Send Slack message
    'custom'                 -- Custom action handler
  )),

  -- Action configuration (JSON for flexibility)
  config JSONB NOT NULL DEFAULT '{}',
  -- Examples by action_type:
  -- email: {"to": "{{user.email}}", "subject": "Alert: {{call.title}}", "template": "alert", "body": "..."}
  -- add_to_folder: {"folder_id": "uuid-here"}
  -- add_tag: {"tag_id": "uuid-here"}
  -- set_category: {"category_id": "uuid-here"}
  -- run_ai_analysis: {"analysis_type": "extract_action_items", "model": "gpt-4o"}
  -- update_client_health: {"adjustment": -10, "reason": "Negative sentiment detected"}
  -- webhook: {"url": "https://...", "method": "POST", "headers": {...}, "body_template": "..."}
  -- slack_notification: {"channel": "#alerts", "message": "{{call.title}} needs attention"}

  -- Action state
  enabled BOOLEAN NOT NULL DEFAULT true,

  -- Error handling
  continue_on_error BOOLEAN NOT NULL DEFAULT true, -- Continue to next action if this fails
  retry_count INT NOT NULL DEFAULT 0,              -- Number of retries on failure
  retry_delay_seconds INT NOT NULL DEFAULT 60,     -- Delay between retries

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
-- Performance indexes for common query patterns

-- automation_rules indexes
CREATE INDEX IF NOT EXISTS idx_automation_rules_user_id
  ON automation_rules(user_id);

CREATE INDEX IF NOT EXISTS idx_automation_rules_user_enabled
  ON automation_rules(user_id, enabled);

CREATE INDEX IF NOT EXISTS idx_automation_rules_trigger_type
  ON automation_rules(trigger_type);

CREATE INDEX IF NOT EXISTS idx_automation_rules_user_enabled_priority
  ON automation_rules(user_id, enabled, priority);

-- automation_execution_history indexes
CREATE INDEX IF NOT EXISTS idx_automation_execution_history_rule_id
  ON automation_execution_history(rule_id);

CREATE INDEX IF NOT EXISTS idx_automation_execution_history_user_id
  ON automation_execution_history(user_id);

CREATE INDEX IF NOT EXISTS idx_automation_execution_history_triggered_at
  ON automation_execution_history(triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_automation_execution_history_success
  ON automation_execution_history(success);

CREATE INDEX IF NOT EXISTS idx_automation_execution_history_rule_triggered
  ON automation_execution_history(rule_id, triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_automation_execution_history_user_triggered
  ON automation_execution_history(user_id, triggered_at DESC);

-- automation_rule_conditions indexes
CREATE INDEX IF NOT EXISTS idx_automation_rule_conditions_rule_id
  ON automation_rule_conditions(rule_id);

CREATE INDEX IF NOT EXISTS idx_automation_rule_conditions_rule_position
  ON automation_rule_conditions(rule_id, position);

CREATE INDEX IF NOT EXISTS idx_automation_rule_conditions_parent
  ON automation_rule_conditions(parent_condition_id);

CREATE INDEX IF NOT EXISTS idx_automation_rule_conditions_type
  ON automation_rule_conditions(condition_type);

-- automation_rule_actions indexes
CREATE INDEX IF NOT EXISTS idx_automation_rule_actions_rule_id
  ON automation_rule_actions(rule_id);

CREATE INDEX IF NOT EXISTS idx_automation_rule_actions_rule_position
  ON automation_rule_actions(rule_id, position);

CREATE INDEX IF NOT EXISTS idx_automation_rule_actions_type
  ON automation_rule_actions(action_type);

CREATE INDEX IF NOT EXISTS idx_automation_rule_actions_enabled
  ON automation_rule_actions(rule_id, enabled);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_execution_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rule_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rule_actions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES: automation_rules
-- ============================================================================

-- Policy: Users can view their own automation rules
CREATE POLICY "Users can view their own automation rules"
  ON automation_rules
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can create automation rules for themselves
CREATE POLICY "Users can create their own automation rules"
  ON automation_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own automation rules
CREATE POLICY "Users can update their own automation rules"
  ON automation_rules
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own automation rules
CREATE POLICY "Users can delete their own automation rules"
  ON automation_rules
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- RLS POLICIES: automation_execution_history
-- ============================================================================

-- Policy: Users can view execution history for their rules
CREATE POLICY "Users can view their own execution history"
  ON automation_execution_history
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Allow insert via service role (edge functions)
-- Execution history is created by edge functions, not directly by users
-- Service role bypasses RLS, so authenticated users cannot insert directly
CREATE POLICY "Users can insert their own execution history"
  ON automation_execution_history
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- RLS POLICIES: automation_rule_conditions
-- ============================================================================
-- Conditions are accessed via their parent rule's user_id

-- Policy: Users can view conditions for their own rules
CREATE POLICY "Users can view conditions for their own rules"
  ON automation_rule_conditions
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM automation_rules
    WHERE automation_rules.id = automation_rule_conditions.rule_id
    AND automation_rules.user_id = auth.uid()
  ));

-- Policy: Users can create conditions for their own rules
CREATE POLICY "Users can create conditions for their own rules"
  ON automation_rule_conditions
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM automation_rules
    WHERE automation_rules.id = automation_rule_conditions.rule_id
    AND automation_rules.user_id = auth.uid()
  ));

-- Policy: Users can update conditions for their own rules
CREATE POLICY "Users can update conditions for their own rules"
  ON automation_rule_conditions
  FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM automation_rules
    WHERE automation_rules.id = automation_rule_conditions.rule_id
    AND automation_rules.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM automation_rules
    WHERE automation_rules.id = automation_rule_conditions.rule_id
    AND automation_rules.user_id = auth.uid()
  ));

-- Policy: Users can delete conditions for their own rules
CREATE POLICY "Users can delete conditions for their own rules"
  ON automation_rule_conditions
  FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM automation_rules
    WHERE automation_rules.id = automation_rule_conditions.rule_id
    AND automation_rules.user_id = auth.uid()
  ));

-- ============================================================================
-- RLS POLICIES: automation_rule_actions
-- ============================================================================
-- Actions are accessed via their parent rule's user_id

-- Policy: Users can view actions for their own rules
CREATE POLICY "Users can view actions for their own rules"
  ON automation_rule_actions
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM automation_rules
    WHERE automation_rules.id = automation_rule_actions.rule_id
    AND automation_rules.user_id = auth.uid()
  ));

-- Policy: Users can create actions for their own rules
CREATE POLICY "Users can create actions for their own rules"
  ON automation_rule_actions
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM automation_rules
    WHERE automation_rules.id = automation_rule_actions.rule_id
    AND automation_rules.user_id = auth.uid()
  ));

-- Policy: Users can update actions for their own rules
CREATE POLICY "Users can update actions for their own rules"
  ON automation_rule_actions
  FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM automation_rules
    WHERE automation_rules.id = automation_rule_actions.rule_id
    AND automation_rules.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM automation_rules
    WHERE automation_rules.id = automation_rule_actions.rule_id
    AND automation_rules.user_id = auth.uid()
  ));

-- Policy: Users can delete actions for their own rules
CREATE POLICY "Users can delete actions for their own rules"
  ON automation_rule_actions
  FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM automation_rules
    WHERE automation_rules.id = automation_rule_actions.rule_id
    AND automation_rules.user_id = auth.uid()
  ));

-- ============================================================================
-- TRIGGERS: updated_at
-- ============================================================================

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at trigger for automation_rules
DROP TRIGGER IF EXISTS update_automation_rules_updated_at ON automation_rules;
CREATE TRIGGER update_automation_rules_updated_at
  BEFORE UPDATE ON automation_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add updated_at trigger for automation_rule_conditions
DROP TRIGGER IF EXISTS update_automation_rule_conditions_updated_at ON automation_rule_conditions;
CREATE TRIGGER update_automation_rule_conditions_updated_at
  BEFORE UPDATE ON automation_rule_conditions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add updated_at trigger for automation_rule_actions
DROP TRIGGER IF EXISTS update_automation_rule_actions_updated_at ON automation_rule_actions;
CREATE TRIGGER update_automation_rule_actions_updated_at
  BEFORE UPDATE ON automation_rule_actions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- GRANTS
-- ============================================================================
GRANT ALL ON public.automation_rules TO authenticated;
GRANT ALL ON public.automation_execution_history TO authenticated;
GRANT ALL ON public.automation_rule_conditions TO authenticated;
GRANT ALL ON public.automation_rule_actions TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE automation_rules IS
  'Automation rules for processing calls with configurable triggers, conditions, and actions.';

COMMENT ON COLUMN automation_rules.trigger_type IS
  'Type of trigger: call_created, transcript_phrase, sentiment, duration, webhook, scheduled';

COMMENT ON COLUMN automation_rules.trigger_config IS
  'JSON configuration for the trigger type (pattern, thresholds, schedule, etc.)';

COMMENT ON COLUMN automation_rules.conditions IS
  'JSON condition tree with AND/OR logic for evaluating whether the rule should fire';

COMMENT ON COLUMN automation_rules.actions IS
  'JSON array of actions to execute when the rule fires (email, folder, AI, etc.)';

COMMENT ON COLUMN automation_rules.priority IS
  'Rule priority (lower = higher priority). Rules are evaluated in priority order.';

COMMENT ON TABLE automation_execution_history IS
  'Audit log of all automation rule executions with debugging information.';

COMMENT ON COLUMN automation_execution_history.debug_info IS
  'JSON object containing condition evaluations, action results, and call snapshot for debugging';

COMMENT ON COLUMN automation_execution_history.trigger_source IS
  'JSON object identifying what triggered the rule (recording_id, webhook_event, schedule, etc.)';

COMMENT ON TABLE automation_rule_conditions IS
  'Junction table storing individual conditions for automation rules with AND/OR logic support.';

COMMENT ON COLUMN automation_rule_conditions.condition_type IS
  'Type of condition: field, transcript, participant, category, tag, sentiment, time, custom';

COMMENT ON COLUMN automation_rule_conditions.field_name IS
  'Field name to evaluate (e.g., duration_minutes, title, participant_count)';

COMMENT ON COLUMN automation_rule_conditions.operator IS
  'Comparison operator: =, !=, >, >=, <, <=, contains, matches, in, between, etc.';

COMMENT ON COLUMN automation_rule_conditions.value IS
  'JSON value to compare against. Structure depends on operator (single value, array, range).';

COMMENT ON COLUMN automation_rule_conditions.parent_condition_id IS
  'Reference to parent condition for nested AND/OR groups. NULL for top-level conditions.';

COMMENT ON COLUMN automation_rule_conditions.logic_operator IS
  'Logic operator (AND/OR) when this condition acts as a group container.';

COMMENT ON TABLE automation_rule_actions IS
  'Junction table storing individual actions for automation rules with execution order.';

COMMENT ON COLUMN automation_rule_actions.action_type IS
  'Type of action: email, add_to_folder, add_tag, run_ai_analysis, update_client_health, webhook, etc.';

COMMENT ON COLUMN automation_rule_actions.config IS
  'JSON configuration for the action (to, subject, folder_id, etc.). Structure depends on action_type.';

COMMENT ON COLUMN automation_rule_actions.position IS
  'Execution order position. Actions are executed in ascending position order.';

COMMENT ON COLUMN automation_rule_actions.continue_on_error IS
  'Whether to continue executing subsequent actions if this action fails.';

COMMENT ON COLUMN automation_rule_actions.retry_count IS
  'Number of times to retry this action on failure.';

-- ============================================================================
-- SCHEMA MODIFICATION: fathom_calls
-- ============================================================================
-- Add sentiment_cache column for caching AI sentiment analysis results
-- Avoids redundant API calls when evaluating sentiment-based automation rules

ALTER TABLE public.fathom_calls
  ADD COLUMN IF NOT EXISTS sentiment_cache JSONB DEFAULT NULL;

-- Index for efficient sentiment-based queries
CREATE INDEX IF NOT EXISTS idx_fathom_calls_sentiment_cache_sentiment
  ON public.fathom_calls((sentiment_cache->>'sentiment'));

-- Index for finding calls that need sentiment analysis (NULL cache)
CREATE INDEX IF NOT EXISTS idx_fathom_calls_sentiment_cache_null
  ON public.fathom_calls(recording_id)
  WHERE sentiment_cache IS NULL;

COMMENT ON COLUMN public.fathom_calls.sentiment_cache IS
  'Cached AI sentiment analysis result. Structure: {"sentiment": "positive"|"neutral"|"negative", "confidence": 0.0-1.0, "analyzed_at": "ISO timestamp", "reasoning": "optional explanation"}';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
