import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

/**
 * AUTOMATION-SCHEDULER - Scheduled Rule Processor
 *
 * This Edge Function batch processes scheduled automation rules:
 * 1. Fetches all enabled scheduled rules where next_run_at <= NOW()
 * 2. Executes each rule via the automation-engine
 * 3. Updates next_run_at based on the schedule configuration
 * 4. Logs execution results to history
 *
 * Triggered by pg_cron every minute to check for due rules.
 * Designed to complete within 90 seconds to avoid Edge Function timeouts.
 */

const BATCH_SIZE = 50; // Maximum rules per invocation
const MAX_PROCESSING_TIME_MS = 90000; // 90s safe limit (150s timeout - 60s buffer)

// Schedule types and their configurations
type ScheduleType = 'cron' | 'interval' | 'daily' | 'weekly' | 'monthly';

interface ScheduleConfig {
  schedule_type: ScheduleType;
  // For cron type
  cron_expression?: string;
  // For interval type
  interval_minutes?: number;
  // For daily/weekly/monthly types
  hour?: number;
  minute?: number;
  day_of_week?: number; // 0-6, 0 = Sunday
  day_of_month?: number; // 1-31
  timezone?: string;
}

interface ScheduledRule {
  id: string;
  user_id: string;
  name: string;
  trigger_config: ScheduleConfig;
  next_run_at: string | null;
  last_applied_at: string | null;
  enabled: boolean;
}

interface RuleExecutionResult {
  rule_id: string;
  rule_name: string;
  user_id: string;
  success: boolean;
  next_run_at: string;
  error?: string;
  engine_response?: Record<string, unknown>;
}

/**
 * Calculate the next run time based on schedule configuration.
 *
 * Supports multiple schedule types:
 * - interval: Run every N minutes
 * - daily: Run at a specific time every day
 * - weekly: Run at a specific time on a specific day of the week
 * - monthly: Run at a specific time on a specific day of the month
 * - cron: Use cron expression (parsed separately)
 */
function calculateNextRunAt(config: ScheduleConfig, fromTime: Date = new Date()): Date {
  const scheduleType = config.schedule_type || 'interval';

  switch (scheduleType) {
    case 'interval': {
      const intervalMinutes = config.interval_minutes || 60;
      return new Date(fromTime.getTime() + intervalMinutes * 60 * 1000);
    }

    case 'daily': {
      const hour = config.hour ?? 9;
      const minute = config.minute ?? 0;
      const next = new Date(fromTime);
      next.setUTCHours(hour, minute, 0, 0);

      // If the time has already passed today, schedule for tomorrow
      if (next <= fromTime) {
        next.setUTCDate(next.getUTCDate() + 1);
      }
      return next;
    }

    case 'weekly': {
      const hour = config.hour ?? 9;
      const minute = config.minute ?? 0;
      const targetDay = config.day_of_week ?? 1; // Default to Monday

      const next = new Date(fromTime);
      next.setUTCHours(hour, minute, 0, 0);

      // Calculate days until target day
      const currentDay = next.getUTCDay();
      let daysUntil = targetDay - currentDay;

      if (daysUntil < 0 || (daysUntil === 0 && next <= fromTime)) {
        daysUntil += 7;
      }

      next.setUTCDate(next.getUTCDate() + daysUntil);
      return next;
    }

    case 'monthly': {
      const hour = config.hour ?? 9;
      const minute = config.minute ?? 0;
      const targetDay = config.day_of_month ?? 1;

      const next = new Date(fromTime);
      next.setUTCHours(hour, minute, 0, 0);
      next.setUTCDate(targetDay);

      // If the date has already passed this month, schedule for next month
      if (next <= fromTime) {
        next.setUTCMonth(next.getUTCMonth() + 1);
      }

      // Handle months with fewer days (e.g., Feb 30 -> Feb 28)
      const targetMonth = next.getUTCMonth();
      if (next.getUTCDate() !== targetDay) {
        // Day overflowed to next month, set to last day of target month
        next.setUTCDate(0); // Last day of previous month
      }
      // Ensure we're still in the target month
      if (next.getUTCMonth() !== targetMonth) {
        next.setUTCMonth(targetMonth + 1, 0);
      }

      return next;
    }

    case 'cron': {
      // For cron expressions, we need a more complex parser
      // For now, default to running again in 1 hour if cron is used
      // A full cron parser could be added as a future enhancement
      return new Date(fromTime.getTime() + 60 * 60 * 1000);
    }

    default:
      // Default: run again in 1 hour
      return new Date(fromTime.getTime() + 60 * 60 * 1000);
  }
}

/**
 * Execute a single scheduled rule by invoking the automation-engine.
 */
async function executeScheduledRule(
  supabase: ReturnType<typeof createClient>,
  rule: ScheduledRule
): Promise<RuleExecutionResult> {
  const result: RuleExecutionResult = {
    rule_id: rule.id,
    rule_name: rule.name,
    user_id: rule.user_id,
    success: false,
    next_run_at: '',
  };

  try {
    // Calculate next run time
    const nextRunAt = calculateNextRunAt(rule.trigger_config);
    result.next_run_at = nextRunAt.toISOString();

    // Call the automation-engine function
    const { data, error } = await supabase.functions.invoke('automation-engine', {
      body: {
        trigger_type: 'scheduled',
        user_id: rule.user_id,
        rule_id: rule.id,
        trigger_source: {
          schedule_name: rule.name,
          scheduled_at: new Date().toISOString(),
        },
      },
    });

    if (error) {
      result.error = `Engine invocation error: ${error.message}`;
      return result;
    }

    result.success = true;
    result.engine_response = data as Record<string, unknown>;

    // Update next_run_at in the database
    const { error: updateError } = await supabase
      .from('automation_rules')
      .update({
        next_run_at: nextRunAt.toISOString(),
        last_applied_at: new Date().toISOString(),
      })
      .eq('id', rule.id);

    if (updateError) {
      // Log but don't fail - the rule already executed
      result.error = `Rule executed but failed to update next_run_at: ${updateError.message}`;
    }

    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error';
    return result;
  }
}

/**
 * Mark a rule as missed and schedule the next run.
 * Used when a rule was due but couldn't be executed.
 */
async function handleMissedExecution(
  supabase: ReturnType<typeof createClient>,
  rule: ScheduledRule,
  reason: string
): Promise<void> {
  const nextRunAt = calculateNextRunAt(rule.trigger_config);

  // Update next_run_at and log the missed execution
  await supabase.from('automation_rules').update({
    next_run_at: nextRunAt.toISOString(),
  }).eq('id', rule.id);

  // Log to execution history
  await supabase.from('automation_execution_history').insert({
    rule_id: rule.id,
    user_id: rule.user_id,
    trigger_type: 'scheduled',
    trigger_source: {
      schedule_name: rule.name,
      scheduled_at: rule.next_run_at,
      status: 'missed',
    },
    triggered_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    execution_time_ms: 0,
    success: false,
    error_message: reason,
    debug_info: {
      reason,
      next_scheduled_at: nextRunAt.toISOString(),
    },
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const workerId = crypto.randomUUID();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse optional request body
    const body = await req.json().catch(() => ({}));
    const { batch_size = BATCH_SIZE, triggered_by = 'api', dry_run = false } = body as {
      batch_size?: number;
      triggered_by?: string;
      dry_run?: boolean;
    };

    // Handle test mode
    if (body.test) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Automation scheduler is running',
          timestamp: new Date().toISOString(),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch due scheduled rules
    // Query: trigger_type = 'scheduled' AND enabled = true AND next_run_at <= NOW()
    const { data: rules, error: rulesError } = await supabase
      .from('automation_rules')
      .select('id, user_id, name, trigger_config, next_run_at, last_applied_at, enabled')
      .eq('trigger_type', 'scheduled')
      .eq('enabled', true)
      .lte('next_run_at', new Date().toISOString())
      .order('next_run_at', { ascending: true })
      .limit(batch_size);

    if (rulesError) {
      return new Response(
        JSON.stringify({
          error: `Failed to fetch scheduled rules: ${rulesError.message}`,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!rules || rules.length === 0) {
      const durationMs = Date.now() - startTime;
      return new Response(
        JSON.stringify({
          success: true,
          worker_id: workerId,
          triggered_by,
          rules_processed: 0,
          message: 'No scheduled rules due for execution',
          duration_ms: durationMs,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Dry run mode - just return what would be executed
    if (dry_run) {
      return new Response(
        JSON.stringify({
          success: true,
          worker_id: workerId,
          dry_run: true,
          rules_due: rules.map((r) => ({
            id: r.id,
            name: r.name,
            user_id: r.user_id,
            next_run_at: r.next_run_at,
            next_run_calculated: calculateNextRunAt(r.trigger_config as ScheduleConfig).toISOString(),
          })),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process each due rule
    const results: RuleExecutionResult[] = [];
    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    for (const rule of rules as ScheduledRule[]) {
      // Check if we're approaching timeout
      const elapsedMs = Date.now() - startTime;
      if (elapsedMs > MAX_PROCESSING_TIME_MS) {
        // Mark remaining rules as missed due to timeout
        const remainingRules = (rules as ScheduledRule[]).slice(processed);
        for (const remainingRule of remainingRules) {
          await handleMissedExecution(supabase, remainingRule, 'Scheduler timeout - will retry on next run');
        }
        break;
      }

      const result = await executeScheduledRule(supabase, rule);
      results.push(result);
      processed++;

      if (result.success) {
        succeeded++;
      } else {
        failed++;
      }
    }

    // Check if there are more rules to process
    const { count: remainingCount } = await supabase
      .from('automation_rules')
      .select('*', { count: 'exact', head: true })
      .eq('trigger_type', 'scheduled')
      .eq('enabled', true)
      .lte('next_run_at', new Date().toISOString());

    const hasPendingWork = (remainingCount ?? 0) > 0;

    // If there's more work, trigger another invocation
    if (hasPendingWork) {
      EdgeRuntime.waitUntil(
        supabase.functions.invoke('automation-scheduler', {
          body: { batch_size, triggered_by: 'self' },
        }).catch((err) => {
          // Failed to self-invoke, pg_cron will pick up remaining work
          const _error = err; // Acknowledge error
        })
      );
    }

    const durationMs = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        worker_id: workerId,
        triggered_by,
        rules_processed: processed,
        rules_succeeded: succeeded,
        rules_failed: failed,
        pending_remaining: remainingCount || 0,
        duration_ms: durationMs,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
