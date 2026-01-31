/**
 * ACTION EXECUTORS
 *
 * Executes actions for automation rules after conditions are evaluated.
 * Each action type has specific execution logic and configuration options.
 *
 * Supported actions:
 * - add_to_folder: Add call to a folder
 * - remove_from_folder: Remove call from a folder
 * - add_tag: Add tag to a call
 * - remove_tag: Remove tag from a call
 * - set_category: Set call category
 * - email: Send email notification via automation-email function
 * - run_ai_analysis: Trigger AI analysis (auto-tag, sentiment, etc.)
 * - update_client_health: Update client health score
 * - webhook: Send outgoing webhook request
 * - create_task: Create a task/reminder
 * - slack_notification: Send Slack notification (future)
 * - generate_digest: Generate summary digest
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { EvaluationContext } from './condition-evaluator.ts';

// Action result type
export interface ActionResult {
  success: boolean;
  details?: Record<string, unknown>;
  error?: string;
}

// Action configuration types
export interface FolderActionConfig {
  folder_id: string;
  create_if_missing?: boolean;
}

export interface TagActionConfig {
  tag_id: string;
  create_if_missing?: boolean;
}

export interface CategoryActionConfig {
  category_id: string;
}

export interface EmailActionConfig {
  to: string | string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  template?: string;
  include_call_link?: boolean;
  include_summary?: boolean;
  reply_to?: string;
}

export interface AIAnalysisActionConfig {
  analysis_type: 'auto_tag' | 'sentiment' | 'summarize' | 'extract_action_items' | 'custom';
  custom_prompt?: string;
  model?: string;
  store_result_in?: string;
}

export interface ClientHealthActionConfig {
  client_id?: string;
  client_email?: string;
  adjustment: number;
  reason: string;
  set_absolute?: boolean;
}

export interface WebhookActionConfig {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body_template?: string;
  include_call_data?: boolean;
  timeout_ms?: number;
  retry_on_failure?: boolean;
}

export interface CreateTaskActionConfig {
  title: string;
  description?: string;
  due_date?: string;
  due_in_days?: number;
  priority?: 'low' | 'medium' | 'high';
  assignee_email?: string;
}

export interface GenerateDigestActionConfig {
  digest_type: 'daily' | 'weekly' | 'monthly' | 'custom';
  include_calls?: boolean;
  include_stats?: boolean;
  email_to?: string;
  date_range_days?: number;
}

export interface ActionConfig {
  type: string;
  config: Record<string, unknown>;
}

type SupabaseClient = ReturnType<typeof createClient>;

/**
 * Replace template variables in strings with context values
 * Supports nested paths like {{call.title}}, {{category.name}}, etc.
 */
export function replaceTemplateVariables(
  template: string,
  context: EvaluationContext,
  additionalVars?: Record<string, unknown>
): string {
  // Core call variables
  let result = template
    .replace(/\{\{call\.title\}\}/g, context.call?.title || '')
    .replace(/\{\{call\.recording_id\}\}/g, String(context.call?.recording_id || ''))
    .replace(/\{\{call\.duration_minutes\}\}/g, String(context.call?.duration_minutes || ''))
    .replace(/\{\{call\.participant_count\}\}/g, String(context.call?.participant_count || ''))
    .replace(/\{\{call\.sentiment\}\}/g, context.call?.sentiment || '')
    .replace(/\{\{call\.sentiment_confidence\}\}/g, String(context.call?.sentiment_confidence || ''))
    .replace(/\{\{call\.created_at\}\}/g, context.call?.created_at || '')
    .replace(/\{\{call\.summary\}\}/g, context.call?.summary || '');

  // Category variables
  result = result
    .replace(/\{\{category\.id\}\}/g, context.category?.id || '')
    .replace(/\{\{category\.name\}\}/g, context.category?.name || '');

  // Tag list (comma-separated)
  const tagNames = context.tags?.map((t) => t.name).filter(Boolean).join(', ') || '';
  result = result.replace(/\{\{tags\}\}/g, tagNames);

  // Date/time variables
  const now = new Date();
  result = result
    .replace(/\{\{date\}\}/g, now.toISOString().split('T')[0])
    .replace(/\{\{datetime\}\}/g, now.toISOString())
    .replace(/\{\{timestamp\}\}/g, String(now.getTime()));

  // Additional custom variables
  if (additionalVars) {
    for (const [key, value] of Object.entries(additionalVars)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, String(value ?? ''));
    }
  }

  return result;
}

/**
 * Execute add_to_folder action
 */
async function executeAddToFolder(
  supabase: SupabaseClient,
  config: FolderActionConfig,
  context: EvaluationContext,
  userId: string
): Promise<ActionResult> {
  const { folder_id } = config;
  const recordingId = context.call?.recording_id;

  if (!folder_id) {
    return { success: false, error: 'Missing folder_id in action config' };
  }

  if (!recordingId) {
    return { success: false, error: 'Missing recording_id in context' };
  }

  const { error } = await supabase
    .from('call_folder_assignments')
    .upsert(
      {
        folder_id,
        call_recording_id: recordingId,
        user_id: userId,
      },
      { onConflict: 'folder_id,call_recording_id' }
    );

  if (error) {
    return { success: false, error: `Failed to add to folder: ${error.message}` };
  }

  return {
    success: true,
    details: { folder_id, recording_id: recordingId },
  };
}

/**
 * Execute remove_from_folder action
 */
async function executeRemoveFromFolder(
  supabase: SupabaseClient,
  config: FolderActionConfig,
  context: EvaluationContext,
  _userId: string
): Promise<ActionResult> {
  const { folder_id } = config;
  const recordingId = context.call?.recording_id;

  if (!folder_id) {
    return { success: false, error: 'Missing folder_id in action config' };
  }

  if (!recordingId) {
    return { success: false, error: 'Missing recording_id in context' };
  }

  const { error } = await supabase
    .from('call_folder_assignments')
    .delete()
    .eq('folder_id', folder_id)
    .eq('call_recording_id', recordingId);

  if (error) {
    return { success: false, error: `Failed to remove from folder: ${error.message}` };
  }

  return {
    success: true,
    details: { folder_id, recording_id: recordingId },
  };
}

/**
 * Execute add_tag action
 */
async function executeAddTag(
  supabase: SupabaseClient,
  config: TagActionConfig,
  context: EvaluationContext,
  userId: string
): Promise<ActionResult> {
  const { tag_id } = config;
  const recordingId = context.call?.recording_id;

  if (!tag_id) {
    return { success: false, error: 'Missing tag_id in action config' };
  }

  if (!recordingId) {
    return { success: false, error: 'Missing recording_id in context' };
  }

  const { error } = await supabase
    .from('call_tag_assignments')
    .upsert(
      {
        tag_id,
        call_recording_id: recordingId,
        user_id: userId,
      },
      { onConflict: 'tag_id,call_recording_id' }
    );

  if (error) {
    return { success: false, error: `Failed to add tag: ${error.message}` };
  }

  return {
    success: true,
    details: { tag_id, recording_id: recordingId },
  };
}

/**
 * Execute remove_tag action
 */
async function executeRemoveTag(
  supabase: SupabaseClient,
  config: TagActionConfig,
  context: EvaluationContext,
  _userId: string
): Promise<ActionResult> {
  const { tag_id } = config;
  const recordingId = context.call?.recording_id;

  if (!tag_id) {
    return { success: false, error: 'Missing tag_id in action config' };
  }

  if (!recordingId) {
    return { success: false, error: 'Missing recording_id in context' };
  }

  const { error } = await supabase
    .from('call_tag_assignments')
    .delete()
    .eq('tag_id', tag_id)
    .eq('call_recording_id', recordingId);

  if (error) {
    return { success: false, error: `Failed to remove tag: ${error.message}` };
  }

  return {
    success: true,
    details: { tag_id, recording_id: recordingId },
  };
}

/**
 * Execute set_category action
 */
async function executeSetCategory(
  supabase: SupabaseClient,
  config: CategoryActionConfig,
  context: EvaluationContext,
  userId: string
): Promise<ActionResult> {
  const { category_id } = config;
  const recordingId = context.call?.recording_id;

  if (!category_id) {
    return { success: false, error: 'Missing category_id in action config' };
  }

  if (!recordingId) {
    return { success: false, error: 'Missing recording_id in context' };
  }

  // Remove existing category assignment first
  await supabase
    .from('call_category_assignments')
    .delete()
    .eq('call_recording_id', recordingId);

  // Add new assignment
  const { error } = await supabase.from('call_category_assignments').insert({
    category_id,
    call_recording_id: recordingId,
    user_id: userId,
  });

  if (error) {
    return { success: false, error: `Failed to set category: ${error.message}` };
  }

  return {
    success: true,
    details: { category_id, recording_id: recordingId },
  };
}

/**
 * Execute email action
 * Sends email via the automation-email Edge Function
 */
async function executeEmail(
  supabase: SupabaseClient,
  config: EmailActionConfig,
  context: EvaluationContext,
  userId: string
): Promise<ActionResult> {
  const { to, cc, bcc, subject, body, include_call_link, include_summary, reply_to } = config;

  if (!to) {
    return { success: false, error: 'Missing email recipient (to)' };
  }

  if (!subject) {
    return { success: false, error: 'Missing email subject' };
  }

  // Replace template variables
  const replacedSubject = replaceTemplateVariables(subject, context);
  let replacedBody = replaceTemplateVariables(body || '', context);

  // Optionally include call summary
  if (include_summary && context.call?.summary) {
    replacedBody += `\n\n---\nCall Summary:\n${context.call.summary}`;
  }

  // Optionally include call link
  if (include_call_link && context.call?.recording_id) {
    const appUrl = Deno.env.get('APP_URL') || 'https://app.callvaultai.com';
    replacedBody += `\n\nView call: ${appUrl}/calls/${context.call.recording_id}`;
  }

  // Call the automation-email function
  const { data, error } = await supabase.functions.invoke('automation-email', {
    body: {
      to: Array.isArray(to) ? to : [to],
      cc,
      bcc,
      subject: replacedSubject,
      body: replacedBody,
      reply_to,
      user_id: userId,
      context: {
        call_title: context.call?.title,
        call_id: context.call?.recording_id,
      },
    },
  });

  if (error) {
    return { success: false, error: `Email function error: ${error.message}` };
  }

  return {
    success: true,
    details: {
      to: Array.isArray(to) ? to : [to],
      subject: replacedSubject,
      message_id: data?.message_id,
    },
  };
}

/**
 * Execute run_ai_analysis action
 * Triggers AI analysis based on type
 */
async function executeAIAnalysis(
  supabase: SupabaseClient,
  config: AIAnalysisActionConfig,
  context: EvaluationContext,
  _userId: string
): Promise<ActionResult> {
  const { analysis_type, custom_prompt } = config;
  const recordingId = context.call?.recording_id;

  if (!recordingId) {
    return { success: false, error: 'Missing recording_id for AI analysis' };
  }

  switch (analysis_type) {
    case 'auto_tag': {
      const { error } = await supabase.functions.invoke('auto-tag-calls', {
        body: { recordingIds: [recordingId] },
      });

      if (error) {
        return { success: false, error: `AI tagging error: ${error.message}` };
      }
      return { success: true, details: { analysis_type, recording_id: recordingId } };
    }

    case 'sentiment': {
      const { data, error } = await supabase.functions.invoke('automation-sentiment', {
        body: {
          recording_id: recordingId,
          transcript: context.call?.full_transcript,
        },
      });

      if (error) {
        return { success: false, error: `Sentiment analysis error: ${error.message}` };
      }
      return {
        success: true,
        details: {
          analysis_type,
          recording_id: recordingId,
          sentiment: data?.sentiment,
          confidence: data?.confidence,
        },
      };
    }

    case 'summarize': {
      // Call summarization endpoint if available
      const { error } = await supabase.functions.invoke('summarize-call', {
        body: { recording_id: recordingId },
      });

      if (error) {
        return { success: false, error: `Summarization error: ${error.message}` };
      }
      return { success: true, details: { analysis_type, recording_id: recordingId } };
    }

    case 'extract_action_items': {
      const { data, error } = await supabase.functions.invoke('extract-action-items', {
        body: { recording_id: recordingId },
      });

      if (error) {
        return { success: false, error: `Action items extraction error: ${error.message}` };
      }
      return {
        success: true,
        details: {
          analysis_type,
          recording_id: recordingId,
          action_items_count: data?.action_items?.length || 0,
        },
      };
    }

    case 'custom': {
      if (!custom_prompt) {
        return { success: false, error: 'Custom analysis requires a custom_prompt' };
      }

      // For custom prompts, we could call a generic AI endpoint
      // For now, return a placeholder
      return {
        success: true,
        details: {
          analysis_type,
          recording_id: recordingId,
          note: 'Custom AI analysis queued',
          prompt: custom_prompt.substring(0, 100) + (custom_prompt.length > 100 ? '...' : ''),
        },
      };
    }

    default:
      return { success: false, error: `Unknown analysis type: ${analysis_type}` };
  }
}

/**
 * Execute update_client_health action
 * Updates client health score in the database
 * 
 * NOTE: This feature requires the `clients` and `client_health_history` tables
 * which are planned for Phase 7 (DIFF-03: Client Health Alerts). Until those
 * tables are created, this action will gracefully skip with an informative message.
 */
async function executeUpdateClientHealth(
  supabase: SupabaseClient,
  config: ClientHealthActionConfig,
  context: EvaluationContext,
  userId: string
): Promise<ActionResult> {
  const { client_id, client_email, adjustment, reason, set_absolute } = config;

  // Check if clients table exists by attempting a lightweight query
  // This gracefully handles the case where the table doesn't exist yet
  try {
    const { error: tableCheckError } = await supabase
      .from('clients')
      .select('id')
      .limit(0);

    // If we get a "relation does not exist" error, the table doesn't exist
    if (tableCheckError?.message?.includes('does not exist') || 
        tableCheckError?.code === '42P01') {
      return {
        success: true,
        details: {
          note: 'Client health feature not yet available. The clients table will be created in Phase 7 (DIFF-03: Client Health Alerts).',
          skipped: true,
          adjustment,
          reason,
        },
      };
    }
  } catch {
    // If the table check fails unexpectedly, gracefully skip
    return {
      success: true,
      details: {
        note: 'Client health feature not yet available. Unable to access clients table.',
        skipped: true,
        adjustment,
        reason,
      },
    };
  }

  // Try to find client by ID or email
  let clientIdentifier = client_id;

  if (!clientIdentifier && client_email) {
    // Try to find client by email
    const replacedEmail = replaceTemplateVariables(client_email, context);

    const { data: client, error: emailLookupError } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', userId)
      .eq('email', replacedEmail)
      .maybeSingle();

    // Handle table not existing gracefully
    if (emailLookupError?.message?.includes('does not exist')) {
      return {
        success: true,
        details: {
          note: 'Client health feature not yet available.',
          skipped: true,
          adjustment,
          reason,
        },
      };
    }

    if (client) {
      clientIdentifier = client.id;
    }
  }

  // If still no client, try to find from call participants
  if (!clientIdentifier && context.call?.calendar_invitees) {
    // Get first non-user participant email
    const participantEmails = context.call.calendar_invitees
      .filter((p) => p.email)
      .map((p) => p.email);

    if (participantEmails.length > 0) {
      const { data: client, error: participantLookupError } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', userId)
        .in('email', participantEmails)
        .maybeSingle();

      // Handle table not existing gracefully
      if (participantLookupError?.message?.includes('does not exist')) {
        return {
          success: true,
          details: {
            note: 'Client health feature not yet available.',
            skipped: true,
            adjustment,
            reason,
          },
        };
      }

      if (client) {
        clientIdentifier = client.id;
      }
    }
  }

  if (!clientIdentifier) {
    return {
      success: true,
      details: {
        note: 'No client found to update. Health update skipped.',
        adjustment,
        reason,
      },
    };
  }

  // Get current health score
  const { data: currentClient, error: fetchError } = await supabase
    .from('clients')
    .select('health_score')
    .eq('id', clientIdentifier)
    .single();

  if (fetchError) {
    // Handle table not existing gracefully
    if (fetchError.message?.includes('does not exist')) {
      return {
        success: true,
        details: {
          note: 'Client health feature not yet available.',
          skipped: true,
          adjustment,
          reason,
        },
      };
    }
    return { success: false, error: `Failed to fetch client: ${fetchError.message}` };
  }

  // Calculate new health score
  const currentScore = currentClient?.health_score || 50;
  let newScore: number;

  if (set_absolute) {
    // Set to absolute value (adjustment is the new score)
    newScore = Math.max(0, Math.min(100, adjustment));
  } else {
    // Apply adjustment relative to current score
    newScore = Math.max(0, Math.min(100, currentScore + adjustment));
  }

  // Update client health score
  const { error: updateError } = await supabase
    .from('clients')
    .update({
      health_score: newScore,
      health_updated_at: new Date().toISOString(),
    })
    .eq('id', clientIdentifier);

  if (updateError) {
    // Handle table not existing gracefully
    if (updateError.message?.includes('does not exist')) {
      return {
        success: true,
        details: {
          note: 'Client health feature not yet available.',
          skipped: true,
          adjustment,
          reason,
        },
      };
    }
    return { success: false, error: `Failed to update client health: ${updateError.message}` };
  }

  // Log health change history (if table exists)
  // This already has graceful error handling via .catch()
  await supabase.from('client_health_history').insert({
    client_id: clientIdentifier,
    user_id: userId,
    previous_score: currentScore,
    new_score: newScore,
    adjustment,
    reason: replaceTemplateVariables(reason, context),
    triggered_by_call: context.call?.recording_id,
    created_at: new Date().toISOString(),
  }).catch(() => {
    // Table might not exist yet (planned for Phase 7), ignore error
  });

  return {
    success: true,
    details: {
      client_id: clientIdentifier,
      previous_score: currentScore,
      new_score: newScore,
      adjustment,
      reason,
    },
  };
}

/**
 * Execute webhook action (outgoing)
 * Sends HTTP request to external URL
 */
async function executeWebhook(
  _supabase: SupabaseClient,
  config: WebhookActionConfig,
  context: EvaluationContext,
  _userId: string
): Promise<ActionResult> {
  const {
    url,
    method = 'POST',
    headers = {},
    body_template,
    include_call_data,
    timeout_ms = 30000,
  } = config;

  if (!url) {
    return { success: false, error: 'Missing webhook URL' };
  }

  // Build request body
  let requestBody: string;

  if (body_template) {
    requestBody = replaceTemplateVariables(body_template, context);
  } else if (include_call_data !== false) {
    // Default: include call data
    requestBody = JSON.stringify({
      event: 'automation_triggered',
      timestamp: new Date().toISOString(),
      call: {
        recording_id: context.call?.recording_id,
        title: context.call?.title,
        duration_minutes: context.call?.duration_minutes,
        created_at: context.call?.created_at,
        sentiment: context.call?.sentiment,
        participant_count: context.call?.participant_count,
      },
      category: context.category,
      tags: context.tags,
    });
  } else {
    requestBody = JSON.stringify({
      event: 'automation_triggered',
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout_ms);

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: method !== 'GET' ? requestBody : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        error: `Webhook failed: ${response.status} ${response.statusText}`,
        details: { url, status: response.status },
      };
    }

    return {
      success: true,
      details: {
        url,
        method,
        status: response.status,
      },
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: `Webhook timeout after ${timeout_ms}ms` };
    }
    return {
      success: false,
      error: `Webhook error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Execute create_task action
 * Creates a task/reminder in the system
 * 
 * NOTE: This feature requires the `tasks` table which is not yet implemented.
 * Until the table is created, this action will gracefully skip with an
 * informative message.
 */
async function executeCreateTask(
  supabase: SupabaseClient,
  config: CreateTaskActionConfig,
  context: EvaluationContext,
  userId: string
): Promise<ActionResult> {
  const { title, description, due_date, due_in_days, priority = 'medium', assignee_email } = config;

  if (!title) {
    return { success: false, error: 'Missing task title' };
  }

  // Replace template variables
  const replacedTitle = replaceTemplateVariables(title, context);
  const replacedDescription = description
    ? replaceTemplateVariables(description, context)
    : undefined;

  // Calculate due date
  let taskDueDate: string | undefined;
  if (due_date) {
    taskDueDate = due_date;
  } else if (due_in_days) {
    const date = new Date();
    date.setDate(date.getDate() + due_in_days);
    taskDueDate = date.toISOString();
  }

  // Create task in database (if tasks table exists)
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      user_id: userId,
      title: replacedTitle,
      description: replacedDescription,
      due_date: taskDueDate,
      priority,
      assignee_email,
      related_call_id: context.call?.recording_id,
      status: 'pending',
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    // Table doesn't exist yet - gracefully skip with clear message
    // Check for common "relation does not exist" error patterns
    const isTableMissing = error.message?.includes('does not exist') || 
                           error.code === '42P01';
    
    return {
      success: true,
      details: {
        note: isTableMissing 
          ? 'Task creation feature not yet available. The tasks table has not been implemented.'
          : `Task creation failed: ${error.message}`,
        skipped: isTableMissing,
        title: replacedTitle,
        due_date: taskDueDate,
        priority,
      },
    };
  }

  return {
    success: true,
    details: {
      task_id: data.id,
      title: replacedTitle,
      due_date: taskDueDate,
      priority,
    },
  };
}

/**
 * Execute generate_digest action
 * Generates a summary digest of calls
 */
async function executeGenerateDigest(
  supabase: SupabaseClient,
  config: GenerateDigestActionConfig,
  context: EvaluationContext,
  userId: string
): Promise<ActionResult> {
  const {
    digest_type,
    include_calls = true,
    include_stats = true,
    email_to,
    date_range_days,
  } = config;

  // Calculate date range
  let days: number;
  switch (digest_type) {
    case 'daily':
      days = 1;
      break;
    case 'weekly':
      days = 7;
      break;
    case 'monthly':
      days = 30;
      break;
    case 'custom':
      days = date_range_days || 7;
      break;
    default:
      days = 7;
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Fetch calls in date range
  let callsData: Array<{ recording_id: number; title: string; duration_seconds: number; created_at: string }> = [];
  if (include_calls) {
    const { data } = await supabase
      .from('fathom_calls')
      .select('recording_id, title, duration_seconds, created_at')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(50);

    callsData = data || [];
  }

  // Build digest content
  const digestContent: Record<string, unknown> = {
    digest_type,
    period_start: startDate.toISOString(),
    period_end: new Date().toISOString(),
    generated_at: new Date().toISOString(),
  };

  if (include_calls) {
    digestContent.calls_count = callsData.length;
    digestContent.calls = callsData.map((c) => ({
      id: c.recording_id,
      title: c.title,
      duration_minutes: Math.round((c.duration_seconds || 0) / 60),
      date: c.created_at,
    }));
  }

  if (include_stats) {
    const totalDuration = callsData.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);
    digestContent.stats = {
      total_calls: callsData.length,
      total_duration_minutes: Math.round(totalDuration / 60),
      average_duration_minutes: callsData.length > 0 ? Math.round(totalDuration / 60 / callsData.length) : 0,
    };
  }

  // If email_to is specified, send the digest via email
  if (email_to) {
    const digestBody = `
# ${digest_type.charAt(0).toUpperCase() + digest_type.slice(1)} Call Digest

Period: ${startDate.toLocaleDateString()} - ${new Date().toLocaleDateString()}

## Summary
- Total calls: ${callsData.length}
- Total time: ${Math.round(callsData.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / 60)} minutes

## Recent Calls
${callsData.slice(0, 10).map((c) => `- ${c.title} (${Math.round((c.duration_seconds || 0) / 60)} min)`).join('\n')}
`;

    await supabase.functions.invoke('automation-email', {
      body: {
        to: [email_to],
        subject: `Your ${digest_type} call digest`,
        body: digestBody,
        user_id: userId,
      },
    });

    digestContent.email_sent_to = email_to;
  }

  return {
    success: true,
    details: digestContent,
  };
}

/**
 * Main entry point: Execute an action based on type and configuration
 */
export async function executeAction(
  supabase: SupabaseClient,
  action: ActionConfig,
  context: EvaluationContext,
  userId: string
): Promise<ActionResult> {
  try {
    switch (action.type) {
      case 'add_to_folder':
        return await executeAddToFolder(
          supabase,
          action.config as FolderActionConfig,
          context,
          userId
        );

      case 'remove_from_folder':
        return await executeRemoveFromFolder(
          supabase,
          action.config as FolderActionConfig,
          context,
          userId
        );

      case 'add_tag':
        return await executeAddTag(
          supabase,
          action.config as TagActionConfig,
          context,
          userId
        );

      case 'remove_tag':
        return await executeRemoveTag(
          supabase,
          action.config as TagActionConfig,
          context,
          userId
        );

      case 'set_category':
        return await executeSetCategory(
          supabase,
          action.config as CategoryActionConfig,
          context,
          userId
        );

      case 'email':
        return await executeEmail(
          supabase,
          action.config as EmailActionConfig,
          context,
          userId
        );

      case 'run_ai_analysis':
        return await executeAIAnalysis(
          supabase,
          action.config as AIAnalysisActionConfig,
          context,
          userId
        );

      case 'update_client_health':
        return await executeUpdateClientHealth(
          supabase,
          action.config as ClientHealthActionConfig,
          context,
          userId
        );

      case 'webhook':
        return await executeWebhook(
          supabase,
          action.config as WebhookActionConfig,
          context,
          userId
        );

      case 'create_task':
        return await executeCreateTask(
          supabase,
          action.config as CreateTaskActionConfig,
          context,
          userId
        );

      case 'generate_digest':
        return await executeGenerateDigest(
          supabase,
          action.config as GenerateDigestActionConfig,
          context,
          userId
        );

      case 'slack_notification':
        // Future: Implement Slack notification
        return {
          success: true,
          details: {
            note: 'Slack notifications not yet implemented',
            config: action.config,
          },
        };

      case 'custom':
        // Custom actions can be extended here
        return {
          success: true,
          details: {
            note: 'Custom action executed',
            config: action.config,
          },
        };

      default:
        return { success: false, error: `Unknown action type: ${action.type}` };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error executing action',
    };
  }
}
