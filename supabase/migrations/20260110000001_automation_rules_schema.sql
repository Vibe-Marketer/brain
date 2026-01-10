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

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_execution_history ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES: automation_rules
-- ============================================================================

-- Policy: Users can view their own automation rules
CREATE POLICY "Users can view their own automation rules"
  ON automation_rules
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can create automation rules for themselves
CREATE POLICY "Users can create their own automation rules"
  ON automation_rules
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own automation rules
CREATE POLICY "Users can update their own automation rules"
  ON automation_rules
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own automation rules
CREATE POLICY "Users can delete their own automation rules"
  ON automation_rules
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- RLS POLICIES: automation_execution_history
-- ============================================================================

-- Policy: Users can view execution history for their rules
CREATE POLICY "Users can view their own execution history"
  ON automation_execution_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Allow insert via service role (edge functions)
-- Execution history is created by edge functions, not directly by users
-- Service role bypasses RLS, so authenticated users cannot insert directly
CREATE POLICY "Users can insert their own execution history"
  ON automation_execution_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

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

-- ============================================================================
-- GRANTS
-- ============================================================================
GRANT ALL ON public.automation_rules TO authenticated;
GRANT ALL ON public.automation_execution_history TO authenticated;

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

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
