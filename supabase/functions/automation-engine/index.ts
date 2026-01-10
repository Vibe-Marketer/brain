import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  evaluateConditions,
  type ConditionGroup,
  type EvaluationContext,
  type EvaluationResult,
} from './condition-evaluator.ts';
import { evaluateTrigger, type TriggerResult } from './triggers.ts';
import { executeAction, type ActionConfig } from './actions.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
};

/**
 * AUTOMATION ENGINE - Core Rule Processor
 *
 * This Edge Function evaluates automation rules against events (calls, webhooks, schedules).
 *
 * Flow:
 * 1. Receive trigger event (call_created, webhook, scheduled, etc.)
 * 2. Fetch matching enabled rules for the user
 * 3. For each rule:
 *    a. Evaluate trigger conditions
 *    b. Evaluate rule conditions (AND/OR logic)
 *    c. Execute actions if conditions pass
 *    d. Log execution to history
 *
 * Designed to handle:
 * - Multiple trigger types (call_created, transcript_phrase, sentiment, duration, webhook, scheduled)
 * - Complex AND/OR condition logic
 * - Multiple action types (email, folder, AI, client health)
 * - Execution history with debug info
 */

// Request body types
interface AutomationRequest {
  // Test mode flag
  test?: boolean;

  // Trigger information
  trigger_type: 'call_created' | 'transcript_phrase' | 'sentiment' | 'duration' | 'webhook' | 'scheduled';
  trigger_source?: {
    recording_id?: number;
    webhook_event_id?: string;
    schedule_name?: string;
  };

  // Optional: Specific rule ID to evaluate (for testing)
  rule_id?: string;

  // Optional: User ID (for scheduled/webhook triggers that bypass JWT auth)
  user_id?: string;

  // Execution depth tracking (prevent infinite loops)
  execution_depth?: number;
}

// Database types
interface AutomationRule {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  priority: number;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  conditions: ConditionGroup;
  actions: ActionConfig[];
  enabled: boolean;
  times_applied: number;
  last_applied_at: string | null;
}

// ActionConfig is imported from ./actions.ts

interface ExecutionResult {
  rule_id: string;
  rule_name: string;
  triggered: boolean;
  conditions_passed: boolean;
  actions_executed: number;
  actions_failed: number;
  error?: string;
  debug_info: {
    trigger_result: TriggerResult;
    condition_result?: EvaluationResult;
    actions_executed: Array<{
      action: ActionConfig;
      result: 'success' | 'failed' | 'skipped';
      details?: Record<string, unknown>;
      error?: string;
    }>;
  };
}

// Maximum execution depth to prevent circular rule dependencies
const MAX_EXECUTION_DEPTH = 3;

/**
 * Build evaluation context from call data
 */
async function buildContext(
  supabase: ReturnType<typeof createClient>,
  recordingId: number,
  userId: string
): Promise<EvaluationContext | null> {
  // Fetch call data
  const { data: call, error: callError } = await supabase
    .from('fathom_calls')
    .select('*')
    .eq('recording_id', recordingId)
    .eq('user_id', userId)
    .single();

  if (callError || !call) {
    return null;
  }

  // Fetch category assignment
  const { data: categoryAssignment } = await supabase
    .from('call_category_assignments')
    .select('category_id, call_categories(id, name)')
    .eq('call_recording_id', recordingId)
    .maybeSingle();

  // Fetch tag assignments
  const { data: tagAssignments } = await supabase
    .from('call_tag_assignments')
    .select('tag_id, call_tags(id, name)')
    .eq('call_recording_id', recordingId);

  // Build context
  const context: EvaluationContext = {
    call: {
      recording_id: call.recording_id,
      title: call.title,
      duration_minutes: call.duration_seconds ? Math.floor(call.duration_seconds / 60) : 0,
      created_at: call.created_at,
      participant_count: call.calendar_invitees?.length || 0,
      calendar_invitees: call.calendar_invitees,
      full_transcript: call.full_transcript,
      summary: call.summary,
      sentiment: call.sentiment_cache?.sentiment,
      sentiment_confidence: call.sentiment_cache?.confidence,
    },
    category: categoryAssignment
      ? {
          id: (categoryAssignment.call_categories as { id: string; name: string })?.id,
          name: (categoryAssignment.call_categories as { id: string; name: string })?.name,
        }
      : undefined,
    tags: tagAssignments?.map((ta) => ({
      id: (ta.call_tags as { id: string; name: string })?.id,
      name: (ta.call_tags as { id: string; name: string })?.name,
    })) || [],
  };

  return context;
}

// Action execution is handled by ./actions.ts - see executeAction import

/**
 * Process a single rule against the context
 */
async function processRule(
  supabase: ReturnType<typeof createClient>,
  rule: AutomationRule,
  context: EvaluationContext,
  triggerType: string
): Promise<ExecutionResult> {
  const result: ExecutionResult = {
    rule_id: rule.id,
    rule_name: rule.name,
    triggered: false,
    conditions_passed: false,
    actions_executed: 0,
    actions_failed: 0,
    debug_info: {
      trigger_result: { fires: false, reason: '' },
      actions_executed: [],
    },
  };

  // Step 1: Evaluate trigger
  const triggerResult = evaluateTrigger(rule.trigger_type, rule.trigger_config, context);
  result.debug_info.trigger_result = triggerResult;

  if (!triggerResult.fires) {
    return result;
  }

  result.triggered = true;

  // Step 2: Evaluate conditions
  const conditionResult = evaluateConditions(rule.conditions, context);
  result.debug_info.condition_result = conditionResult;

  if (!conditionResult.passed) {
    return result;
  }

  result.conditions_passed = true;

  // Step 3: Execute actions
  for (const action of rule.actions) {
    const actionResult = await executeAction(supabase, action, context, rule.user_id);

    result.debug_info.actions_executed.push({
      action,
      result: actionResult.success ? 'success' : 'failed',
      details: actionResult.details,
      error: actionResult.error,
    });

    if (actionResult.success) {
      result.actions_executed++;
    } else {
      result.actions_failed++;
    }
  }

  // Step 4: Update rule stats
  await supabase
    .from('automation_rules')
    .update({
      times_applied: rule.times_applied + 1,
      last_applied_at: new Date().toISOString(),
    })
    .eq('id', rule.id);

  return result;
}

/**
 * Log execution to history
 */
async function logExecution(
  supabase: ReturnType<typeof createClient>,
  ruleId: string,
  userId: string,
  triggerType: string,
  triggerSource: Record<string, unknown> | undefined,
  result: ExecutionResult,
  startTime: number
): Promise<void> {
  const endTime = Date.now();
  const success = result.triggered && result.conditions_passed && result.actions_failed === 0;

  await supabase
    .from('automation_execution_history')
    .insert({
      rule_id: ruleId,
      user_id: userId,
      trigger_type: triggerType,
      trigger_source: triggerSource || {},
      triggered_at: new Date(startTime).toISOString(),
      completed_at: new Date(endTime).toISOString(),
      execution_time_ms: endTime - startTime,
      success,
      error_message: result.error || (result.actions_failed > 0 ? 'Some actions failed' : null),
      debug_info: {
        trigger_result: result.debug_info.trigger_result,
        conditions_evaluated: result.debug_info.condition_result?.details || [],
        actions_executed: result.debug_info.actions_executed,
        call_snapshot: {
          title: result.debug_info.condition_result ? 'See conditions' : null,
        },
      },
    });
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body: AutomationRequest = await req.json();

    // Handle test mode
    if (body.test) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Automation engine is running',
          timestamp: new Date().toISOString(),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate required fields
    if (!body.trigger_type) {
      return new Response(
        JSON.stringify({ error: 'Missing trigger_type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check execution depth to prevent infinite loops
    const executionDepth = body.execution_depth || 0;
    if (executionDepth >= MAX_EXECUTION_DEPTH) {
      return new Response(
        JSON.stringify({
          error: 'Maximum execution depth exceeded',
          message: 'Circular rule dependency detected',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine user ID
    let userId = body.user_id;

    // If no user_id provided, try to get from auth header
    if (!userId) {
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);
        if (!userError && user) {
          userId = user.id;
        }
      }
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Unable to determine user' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build context from trigger source
    let context: EvaluationContext | null = null;
    const recordingId = body.trigger_source?.recording_id;

    if (recordingId) {
      context = await buildContext(supabase, recordingId, userId);
      if (!context) {
        return new Response(
          JSON.stringify({ error: `Call not found: ${recordingId}` }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Empty context for non-call triggers
      context = { call: {}, custom: {} };
    }

    // Fetch matching rules
    let rulesQuery = supabase
      .from('automation_rules')
      .select('*')
      .eq('user_id', userId)
      .eq('enabled', true)
      .order('priority', { ascending: true });

    // Filter by specific rule if provided
    if (body.rule_id) {
      rulesQuery = rulesQuery.eq('id', body.rule_id);
    } else {
      // Filter by trigger type
      rulesQuery = rulesQuery.eq('trigger_type', body.trigger_type);
    }

    const { data: rules, error: rulesError } = await rulesQuery;

    if (rulesError) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch rules: ${rulesError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!rules || rules.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No matching rules found',
          rules_processed: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process each rule
    const results: ExecutionResult[] = [];

    for (const rule of rules as AutomationRule[]) {
      const result = await processRule(supabase, rule, context, body.trigger_type);
      results.push(result);

      // Log execution to history
      await logExecution(
        supabase,
        rule.id,
        userId,
        body.trigger_type,
        body.trigger_source,
        result,
        startTime
      );
    }

    // Summary
    const triggered = results.filter((r) => r.triggered).length;
    const passed = results.filter((r) => r.conditions_passed).length;
    const actionsExecuted = results.reduce((sum, r) => sum + r.actions_executed, 0);
    const actionsFailed = results.reduce((sum, r) => sum + r.actions_failed, 0);

    const durationMs = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        rules_processed: rules.length,
        rules_triggered: triggered,
        rules_conditions_passed: passed,
        actions_executed: actionsExecuted,
        actions_failed: actionsFailed,
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
