-- ============================================================================
-- SCHEDULED RULES FIELDS MIGRATION
-- ============================================================================
-- Adds columns required for scheduled rule execution:
--   - next_run_at: When the rule should next be executed (used by automation-scheduler)
--   - schedule_config: Explicit schedule configuration for scheduled trigger rules
-- ============================================================================

-- ============================================================================
-- COLUMN: next_run_at
-- ============================================================================
-- Timestamp for when the scheduled rule should next be executed.
-- The automation-scheduler queries: WHERE trigger_type = 'scheduled' AND enabled = true AND next_run_at <= NOW()
-- After execution, next_run_at is updated based on the schedule configuration.

ALTER TABLE public.automation_rules
  ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.automation_rules.next_run_at IS
  'Timestamp for next scheduled execution. Used by automation-scheduler to find due rules. NULL for non-scheduled rules.';

-- ============================================================================
-- COLUMN: schedule_config
-- ============================================================================
-- Explicit schedule configuration for scheduled trigger rules.
-- This is a more structured alternative to storing schedule data in trigger_config.
-- Structure:
-- {
--   "schedule_type": "interval" | "daily" | "weekly" | "monthly" | "cron",
--   "interval_minutes": 60,           -- For interval type
--   "hour": 9,                         -- For daily/weekly/monthly types (0-23, UTC)
--   "minute": 0,                       -- For daily/weekly/monthly types (0-59)
--   "day_of_week": 1,                  -- For weekly type (0-6, 0 = Sunday)
--   "day_of_month": 1,                 -- For monthly type (1-31)
--   "timezone": "UTC",                 -- User's timezone for display/conversion
--   "cron_expression": "0 9 * * 1"     -- For cron type
-- }

ALTER TABLE public.automation_rules
  ADD COLUMN IF NOT EXISTS schedule_config JSONB DEFAULT NULL;

COMMENT ON COLUMN public.automation_rules.schedule_config IS
  'Explicit schedule configuration for scheduled trigger rules. Supports interval, daily, weekly, monthly, and cron schedule types.';

-- ============================================================================
-- INDEXES FOR SCHEDULED RULES
-- ============================================================================

-- Index for efficiently finding due scheduled rules
-- Used by automation-scheduler: WHERE trigger_type = 'scheduled' AND enabled = true AND next_run_at <= NOW()
CREATE INDEX IF NOT EXISTS idx_automation_rules_scheduled_due
  ON public.automation_rules(next_run_at)
  WHERE trigger_type = 'scheduled' AND enabled = true AND next_run_at IS NOT NULL;

-- Index for finding scheduled rules by schedule type
CREATE INDEX IF NOT EXISTS idx_automation_rules_schedule_type
  ON public.automation_rules((schedule_config->>'schedule_type'))
  WHERE schedule_config IS NOT NULL;

-- Composite index for scheduler batch processing (user_id + next_run_at for priority ordering)
CREATE INDEX IF NOT EXISTS idx_automation_rules_user_scheduled
  ON public.automation_rules(user_id, next_run_at)
  WHERE trigger_type = 'scheduled' AND enabled = true;

-- ============================================================================
-- FUNCTION: initialize_scheduled_rule
-- ============================================================================
-- Helper function to initialize next_run_at when a scheduled rule is created or enabled.
-- Called by trigger or explicitly when creating scheduled rules.

CREATE OR REPLACE FUNCTION public.initialize_scheduled_rule_next_run()
RETURNS TRIGGER AS $$
DECLARE
  schedule_type TEXT;
  interval_mins INT;
  schedule_hour INT;
  schedule_minute INT;
  target_day INT;
  next_run TIMESTAMPTZ;
BEGIN
  -- Only apply to scheduled trigger rules
  IF NEW.trigger_type != 'scheduled' THEN
    RETURN NEW;
  END IF;

  -- Only initialize if next_run_at is not already set and rule is being enabled
  IF NEW.next_run_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- If rule is disabled, don't calculate next_run_at
  IF NOT NEW.enabled THEN
    RETURN NEW;
  END IF;

  -- Get schedule configuration from schedule_config or trigger_config
  schedule_type := COALESCE(
    NEW.schedule_config->>'schedule_type',
    NEW.trigger_config->>'schedule_type',
    'interval'
  );

  -- Calculate next_run_at based on schedule type
  CASE schedule_type
    WHEN 'interval' THEN
      interval_mins := COALESCE(
        (NEW.schedule_config->>'interval_minutes')::INT,
        (NEW.trigger_config->>'interval_minutes')::INT,
        60
      );
      next_run := NOW() + (interval_mins || ' minutes')::INTERVAL;

    WHEN 'daily' THEN
      schedule_hour := COALESCE(
        (NEW.schedule_config->>'hour')::INT,
        (NEW.trigger_config->>'hour')::INT,
        9
      );
      schedule_minute := COALESCE(
        (NEW.schedule_config->>'minute')::INT,
        (NEW.trigger_config->>'minute')::INT,
        0
      );
      next_run := DATE_TRUNC('day', NOW()) +
                  (schedule_hour || ' hours')::INTERVAL +
                  (schedule_minute || ' minutes')::INTERVAL;
      -- If time has passed today, schedule for tomorrow
      IF next_run <= NOW() THEN
        next_run := next_run + INTERVAL '1 day';
      END IF;

    WHEN 'weekly' THEN
      schedule_hour := COALESCE(
        (NEW.schedule_config->>'hour')::INT,
        (NEW.trigger_config->>'hour')::INT,
        9
      );
      schedule_minute := COALESCE(
        (NEW.schedule_config->>'minute')::INT,
        (NEW.trigger_config->>'minute')::INT,
        0
      );
      target_day := COALESCE(
        (NEW.schedule_config->>'day_of_week')::INT,
        (NEW.trigger_config->>'day_of_week')::INT,
        1  -- Default to Monday
      );
      -- Calculate next occurrence of target day
      next_run := DATE_TRUNC('day', NOW()) +
                  (schedule_hour || ' hours')::INTERVAL +
                  (schedule_minute || ' minutes')::INTERVAL +
                  ((7 + target_day - EXTRACT(DOW FROM NOW())::INT) % 7 || ' days')::INTERVAL;
      -- If it's the target day but time has passed, add a week
      IF next_run <= NOW() THEN
        next_run := next_run + INTERVAL '7 days';
      END IF;

    WHEN 'monthly' THEN
      schedule_hour := COALESCE(
        (NEW.schedule_config->>'hour')::INT,
        (NEW.trigger_config->>'hour')::INT,
        9
      );
      schedule_minute := COALESCE(
        (NEW.schedule_config->>'minute')::INT,
        (NEW.trigger_config->>'minute')::INT,
        0
      );
      target_day := COALESCE(
        (NEW.schedule_config->>'day_of_month')::INT,
        (NEW.trigger_config->>'day_of_month')::INT,
        1  -- Default to 1st of month
      );
      -- Calculate next occurrence
      next_run := DATE_TRUNC('month', NOW()) +
                  ((target_day - 1) || ' days')::INTERVAL +
                  (schedule_hour || ' hours')::INTERVAL +
                  (schedule_minute || ' minutes')::INTERVAL;
      -- If date has passed this month, move to next month
      IF next_run <= NOW() THEN
        next_run := DATE_TRUNC('month', NOW() + INTERVAL '1 month') +
                    ((target_day - 1) || ' days')::INTERVAL +
                    (schedule_hour || ' hours')::INTERVAL +
                    (schedule_minute || ' minutes')::INTERVAL;
      END IF;

    ELSE
      -- Default: run in 1 hour (for cron or unknown types)
      next_run := NOW() + INTERVAL '1 hour';
  END CASE;

  NEW.next_run_at := next_run;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.initialize_scheduled_rule_next_run IS
  'Trigger function that initializes next_run_at when a scheduled rule is created or enabled.';

-- ============================================================================
-- TRIGGER: auto_initialize_scheduled_rule
-- ============================================================================
-- Automatically set next_run_at when a scheduled rule is created or when
-- an existing rule is changed to scheduled type or enabled.

DROP TRIGGER IF EXISTS auto_initialize_scheduled_rule ON public.automation_rules;
CREATE TRIGGER auto_initialize_scheduled_rule
  BEFORE INSERT OR UPDATE OF trigger_type, enabled, schedule_config, trigger_config
  ON public.automation_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_scheduled_rule_next_run();

-- ============================================================================
-- FUNCTION: clear_next_run_at_on_disable
-- ============================================================================
-- Clear next_run_at when a scheduled rule is disabled to prevent it from
-- showing up in scheduler queries.

CREATE OR REPLACE FUNCTION public.clear_next_run_at_on_disable()
RETURNS TRIGGER AS $$
BEGIN
  -- If rule is being disabled, clear next_run_at
  IF NEW.enabled = false AND OLD.enabled = true THEN
    NEW.next_run_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.clear_next_run_at_on_disable IS
  'Trigger function that clears next_run_at when a rule is disabled.';

DROP TRIGGER IF EXISTS clear_next_run_on_disable ON public.automation_rules;
CREATE TRIGGER clear_next_run_on_disable
  BEFORE UPDATE OF enabled
  ON public.automation_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_next_run_at_on_disable();

-- ============================================================================
-- GRANTS
-- ============================================================================
-- Functions are already accessible via the automation_rules table grants

GRANT EXECUTE ON FUNCTION public.initialize_scheduled_rule_next_run() TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_next_run_at_on_disable() TO authenticated;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
