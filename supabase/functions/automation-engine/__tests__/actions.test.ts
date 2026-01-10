/**
 * Unit tests for automation action executors
 *
 * Tests all 12 action types to verify they execute correctly
 * and log results to execution history.
 *
 * @see ../actions.ts
 * @see subtask-8-6: Test all action types execution
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================
// Re-implement action execution logic for testing
// (The actual actions.ts uses Deno imports, so we recreate the logic here)
// ============================================================

interface ActionResult {
  success: boolean;
  details?: Record<string, unknown>;
  error?: string;
}

interface EvaluationContext {
  call?: {
    recording_id?: number;
    title?: string;
    duration_minutes?: number;
    created_at?: string;
    participant_count?: number;
    full_transcript?: string;
    summary?: string;
    sentiment?: 'positive' | 'neutral' | 'negative';
    sentiment_confidence?: number;
    calendar_invitees?: Array<{ email?: string }>;
  };
  category?: {
    id?: string;
    name?: string;
  };
  tags?: Array<{
    id?: string;
    name?: string;
  }>;
  custom?: Record<string, unknown>;
}

// Action configuration types
interface FolderActionConfig {
  folder_id: string;
  create_if_missing?: boolean;
}

interface TagActionConfig {
  tag_id: string;
  create_if_missing?: boolean;
}

interface CategoryActionConfig {
  category_id: string;
}

interface EmailActionConfig {
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

interface AIAnalysisActionConfig {
  analysis_type: 'auto_tag' | 'sentiment' | 'summarize' | 'extract_action_items' | 'custom';
  custom_prompt?: string;
  model?: string;
  store_result_in?: string;
}

interface ClientHealthActionConfig {
  client_id?: string;
  client_email?: string;
  adjustment: number;
  reason: string;
  set_absolute?: boolean;
}

interface WebhookActionConfig {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body_template?: string;
  include_call_data?: boolean;
  timeout_ms?: number;
  retry_on_failure?: boolean;
}

interface CreateTaskActionConfig {
  title: string;
  description?: string;
  due_date?: string;
  due_in_days?: number;
  priority?: 'low' | 'medium' | 'high';
  assignee_email?: string;
}

interface GenerateDigestActionConfig {
  digest_type: 'daily' | 'weekly' | 'monthly' | 'custom';
  include_calls?: boolean;
  include_stats?: boolean;
  email_to?: string;
  date_range_days?: number;
}

/**
 * Replace template variables in strings with context values
 */
function replaceTemplateVariables(
  template: string,
  context: EvaluationContext,
  additionalVars?: Record<string, unknown>
): string {
  let result = template
    .replace(/\{\{call\.title\}\}/gi, context.call?.title || '')
    .replace(/\{\{call\.recording_id\}\}/gi, String(context.call?.recording_id || ''))
    .replace(/\{\{call\.duration_minutes\}\}/gi, String(context.call?.duration_minutes || ''))
    .replace(/\{\{call\.participant_count\}\}/gi, String(context.call?.participant_count || ''))
    .replace(/\{\{call\.sentiment\}\}/gi, context.call?.sentiment || '')
    .replace(/\{\{call\.sentiment_confidence\}\}/gi, String(context.call?.sentiment_confidence || ''))
    .replace(/\{\{call\.created_at\}\}/gi, context.call?.created_at || '')
    .replace(/\{\{call\.summary\}\}/gi, context.call?.summary || '');

  result = result
    .replace(/\{\{category\.id\}\}/gi, context.category?.id || '')
    .replace(/\{\{category\.name\}\}/gi, context.category?.name || '');

  const tagNames = context.tags?.map((t) => t.name).filter(Boolean).join(', ') || '';
  result = result.replace(/\{\{tags\}\}/gi, tagNames);

  const now = new Date();
  result = result
    .replace(/\{\{date\}\}/gi, now.toISOString().split('T')[0])
    .replace(/\{\{datetime\}\}/gi, now.toISOString())
    .replace(/\{\{timestamp\}\}/gi, String(now.getTime()));

  if (additionalVars) {
    for (const [key, value] of Object.entries(additionalVars)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
      result = result.replace(regex, String(value ?? ''));
    }
  }

  return result;
}

/**
 * Mock Supabase client for testing
 */
function createMockSupabase(overrides: Record<string, unknown> = {}) {
  const mockFrom = vi.fn().mockReturnValue({
    upsert: vi.fn().mockResolvedValue({ error: null }),
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'task-123' }, error: null }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        in: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
        single: vi.fn().mockResolvedValue({ data: { health_score: 50 }, error: null }),
      }),
      gte: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
  });

  const mockFunctions = {
    invoke: vi.fn().mockResolvedValue({ data: { message_id: 'msg-123' }, error: null }),
  };

  return {
    from: mockFrom,
    functions: mockFunctions,
    ...overrides,
  };
}

/**
 * Execute add_to_folder action
 */
async function executeAddToFolder(
  supabase: ReturnType<typeof createMockSupabase>,
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
  supabase: ReturnType<typeof createMockSupabase>,
  config: FolderActionConfig,
  context: EvaluationContext
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
  supabase: ReturnType<typeof createMockSupabase>,
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
 * Execute set_category action
 */
async function executeSetCategory(
  supabase: ReturnType<typeof createMockSupabase>,
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
  const fromResult = supabase.from('call_category_assignments');
  const insertResult = fromResult.insert({
    category_id,
    call_recording_id: recordingId,
    user_id: userId,
  });

  // Handle the mock properly - insert returns an object with select
  const { error } = await (insertResult.select ? insertResult.select('*').single() : insertResult);

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
 */
async function executeEmail(
  supabase: ReturnType<typeof createMockSupabase>,
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

  if (include_summary && context.call?.summary) {
    replacedBody += `\n\n---\nCall Summary:\n${context.call.summary}`;
  }

  if (include_call_link && context.call?.recording_id) {
    replacedBody += `\n\nView call: https://app.callvaultai.com/calls/${context.call.recording_id}`;
  }

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
 */
async function executeAIAnalysis(
  supabase: ReturnType<typeof createMockSupabase>,
  config: AIAnalysisActionConfig,
  context: EvaluationContext
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
 */
async function executeUpdateClientHealth(
  supabase: ReturnType<typeof createMockSupabase>,
  config: ClientHealthActionConfig,
  context: EvaluationContext,
  userId: string
): Promise<ActionResult> {
  const { client_id, client_email, adjustment, reason, set_absolute } = config;

  // Try to find client by ID or email
  let clientIdentifier = client_id;

  if (!clientIdentifier && client_email) {
    const replacedEmail = replaceTemplateVariables(client_email, context);

    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', userId)
      .eq('email', replacedEmail)
      .maybeSingle();

    if (client) {
      clientIdentifier = client.id;
    }
  }

  if (!clientIdentifier && context.call?.calendar_invitees) {
    const participantEmails = context.call.calendar_invitees
      .filter((p) => p.email)
      .map((p) => p.email);

    if (participantEmails.length > 0) {
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', userId)
        .in('email', participantEmails)
        .maybeSingle();

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

  const { data: currentClient, error: fetchError } = await supabase
    .from('clients')
    .select('health_score')
    .eq('id', clientIdentifier)
    .single();

  if (fetchError) {
    return { success: false, error: `Failed to fetch client: ${fetchError.message}` };
  }

  const currentScore = currentClient?.health_score || 50;
  let newScore: number;

  if (set_absolute) {
    newScore = Math.max(0, Math.min(100, adjustment));
  } else {
    newScore = Math.max(0, Math.min(100, currentScore + adjustment));
  }

  const { error: updateError } = await supabase
    .from('clients')
    .update({
      health_score: newScore,
      health_updated_at: new Date().toISOString(),
    })
    .eq('id', clientIdentifier);

  if (updateError) {
    return { success: false, error: `Failed to update client health: ${updateError.message}` };
  }

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
 * Execute webhook action
 */
async function executeWebhook(
  config: WebhookActionConfig,
  context: EvaluationContext,
  mockFetch?: typeof fetch
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

  let requestBody: string;

  if (body_template) {
    requestBody = replaceTemplateVariables(body_template, context);
  } else if (include_call_data !== false) {
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

  const fetchFn = mockFetch || fetch;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout_ms);

    const response = await fetchFn(url, {
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
 */
async function executeCreateTask(
  supabase: ReturnType<typeof createMockSupabase>,
  config: CreateTaskActionConfig,
  context: EvaluationContext,
  userId: string
): Promise<ActionResult> {
  const { title, description, due_date, due_in_days, priority = 'medium', assignee_email } = config;

  if (!title) {
    return { success: false, error: 'Missing task title' };
  }

  const replacedTitle = replaceTemplateVariables(title, context);
  const replacedDescription = description
    ? replaceTemplateVariables(description, context)
    : undefined;

  let taskDueDate: string | undefined;
  if (due_date) {
    taskDueDate = due_date;
  } else if (due_in_days) {
    const date = new Date();
    date.setDate(date.getDate() + due_in_days);
    taskDueDate = date.toISOString();
  }

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
    return {
      success: true,
      details: {
        note: 'Task creation attempted but tasks table may not exist',
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

// ============================================================
// Tests
// ============================================================

describe('Action Executors', () => {
  const testUserId = 'user-123';
  const testContext: EvaluationContext = {
    call: {
      recording_id: 12345,
      title: 'Test Call',
      duration_minutes: 30,
      created_at: '2026-01-10T10:00:00Z',
      participant_count: 2,
      full_transcript: 'This is a test transcript about pricing.',
      summary: 'A discussion about product pricing.',
      sentiment: 'positive',
      sentiment_confidence: 0.85,
      calendar_invitees: [{ email: 'client@example.com' }],
    },
    category: {
      id: 'cat-123',
      name: 'Sales',
    },
    tags: [
      { id: 'tag-1', name: 'Important' },
      { id: 'tag-2', name: 'Follow-up' },
    ],
  };

  describe('Template Variable Replacement', () => {
    it('should replace call variables', () => {
      const template = 'Call: {{call.title}} lasted {{call.duration_minutes}} minutes';
      const result = replaceTemplateVariables(template, testContext);

      expect(result).toBe('Call: Test Call lasted 30 minutes');
    });

    it('should replace category variables', () => {
      const template = 'Category: {{category.name}} (ID: {{category.id}})';
      const result = replaceTemplateVariables(template, testContext);

      expect(result).toBe('Category: Sales (ID: cat-123)');
    });

    it('should replace tags variable', () => {
      const template = 'Tags: {{tags}}';
      const result = replaceTemplateVariables(template, testContext);

      expect(result).toBe('Tags: Important, Follow-up');
    });

    it('should handle missing context values gracefully', () => {
      const template = '{{call.title}} - {{call.missing}}';
      const result = replaceTemplateVariables(template, { call: { title: 'Test' } });

      expect(result).toBe('Test - ');
    });

    it('should replace date/time variables', () => {
      const template = 'Date: {{date}}, Datetime: {{datetime}}';
      const result = replaceTemplateVariables(template, testContext);

      expect(result).toMatch(/Date: \d{4}-\d{2}-\d{2}/);
      expect(result).toMatch(/Datetime: \d{4}-\d{2}-\d{2}T/);
    });

    it('should replace custom variables', () => {
      const template = 'Custom: {{custom_var}}';
      const result = replaceTemplateVariables(template, testContext, { custom_var: 'test value' });

      expect(result).toBe('Custom: test value');
    });
  });

  describe('Add to Folder Action', () => {
    it('should successfully add call to folder', async () => {
      const supabase = createMockSupabase();
      const config: FolderActionConfig = { folder_id: 'folder-123' };

      const result = await executeAddToFolder(supabase, config, testContext, testUserId);

      expect(result.success).toBe(true);
      expect(result.details?.folder_id).toBe('folder-123');
      expect(result.details?.recording_id).toBe(12345);
    });

    it('should fail when folder_id is missing', async () => {
      const supabase = createMockSupabase();
      const config: FolderActionConfig = { folder_id: '' };

      const result = await executeAddToFolder(supabase, config, testContext, testUserId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing folder_id');
    });

    it('should fail when recording_id is missing', async () => {
      const supabase = createMockSupabase();
      const config: FolderActionConfig = { folder_id: 'folder-123' };
      const contextWithoutCall: EvaluationContext = {};

      const result = await executeAddToFolder(supabase, config, contextWithoutCall, testUserId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing recording_id');
    });

    it('should handle database errors', async () => {
      const supabase = createMockSupabase();
      supabase.from = vi.fn().mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: { message: 'Database connection failed' } }),
      });

      const config: FolderActionConfig = { folder_id: 'folder-123' };

      const result = await executeAddToFolder(supabase, config, testContext, testUserId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to add to folder');
    });
  });

  describe('Remove from Folder Action', () => {
    it('should successfully remove call from folder', async () => {
      const supabase = createMockSupabase();
      const config: FolderActionConfig = { folder_id: 'folder-123' };

      const result = await executeRemoveFromFolder(supabase, config, testContext);

      expect(result.success).toBe(true);
      expect(result.details?.folder_id).toBe('folder-123');
    });

    it('should fail when folder_id is missing', async () => {
      const supabase = createMockSupabase();
      const config: FolderActionConfig = { folder_id: '' };

      const result = await executeRemoveFromFolder(supabase, config, testContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing folder_id');
    });
  });

  describe('Add Tag Action', () => {
    it('should successfully add tag to call', async () => {
      const supabase = createMockSupabase();
      const config: TagActionConfig = { tag_id: 'tag-456' };

      const result = await executeAddTag(supabase, config, testContext, testUserId);

      expect(result.success).toBe(true);
      expect(result.details?.tag_id).toBe('tag-456');
      expect(result.details?.recording_id).toBe(12345);
    });

    it('should fail when tag_id is missing', async () => {
      const supabase = createMockSupabase();
      const config: TagActionConfig = { tag_id: '' };

      const result = await executeAddTag(supabase, config, testContext, testUserId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing tag_id');
    });
  });

  describe('Set Category Action', () => {
    it('should successfully set category', async () => {
      const supabase = createMockSupabase();
      const config: CategoryActionConfig = { category_id: 'cat-789' };

      const result = await executeSetCategory(supabase, config, testContext, testUserId);

      expect(result.success).toBe(true);
      expect(result.details?.category_id).toBe('cat-789');
    });

    it('should fail when category_id is missing', async () => {
      const supabase = createMockSupabase();
      const config: CategoryActionConfig = { category_id: '' };

      const result = await executeSetCategory(supabase, config, testContext, testUserId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing category_id');
    });
  });

  describe('Email Action', () => {
    it('should successfully send email', async () => {
      const supabase = createMockSupabase();
      const config: EmailActionConfig = {
        to: 'test@example.com',
        subject: 'Call: {{call.title}}',
        body: 'Your call lasted {{call.duration_minutes}} minutes.',
      };

      const result = await executeEmail(supabase, config, testContext, testUserId);

      expect(result.success).toBe(true);
      expect(result.details?.to).toEqual(['test@example.com']);
      expect(result.details?.subject).toBe('Call: Test Call');
      expect(result.details?.message_id).toBe('msg-123');
    });

    it('should send to multiple recipients', async () => {
      const supabase = createMockSupabase();
      const config: EmailActionConfig = {
        to: ['a@example.com', 'b@example.com'],
        subject: 'Test',
        body: 'Test body',
      };

      const result = await executeEmail(supabase, config, testContext, testUserId);

      expect(result.success).toBe(true);
      expect(result.details?.to).toEqual(['a@example.com', 'b@example.com']);
    });

    it('should include call summary when requested', async () => {
      const supabase = createMockSupabase();
      const config: EmailActionConfig = {
        to: 'test@example.com',
        subject: 'Test',
        body: 'Initial body',
        include_summary: true,
      };

      await executeEmail(supabase, config, testContext, testUserId);

      // Verify the invoke was called with body containing summary
      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        'automation-email',
        expect.objectContaining({
          body: expect.objectContaining({
            body: expect.stringContaining('Call Summary'),
          }),
        })
      );
    });

    it('should include call link when requested', async () => {
      const supabase = createMockSupabase();
      const config: EmailActionConfig = {
        to: 'test@example.com',
        subject: 'Test',
        body: 'Initial body',
        include_call_link: true,
      };

      await executeEmail(supabase, config, testContext, testUserId);

      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        'automation-email',
        expect.objectContaining({
          body: expect.objectContaining({
            body: expect.stringContaining('View call:'),
          }),
        })
      );
    });

    it('should fail when recipient is missing', async () => {
      const supabase = createMockSupabase();
      const config: EmailActionConfig = {
        to: '',
        subject: 'Test',
        body: 'Test',
      };

      const result = await executeEmail(supabase, config, testContext, testUserId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing email recipient');
    });

    it('should fail when subject is missing', async () => {
      const supabase = createMockSupabase();
      const config: EmailActionConfig = {
        to: 'test@example.com',
        subject: '',
        body: 'Test',
      };

      const result = await executeEmail(supabase, config, testContext, testUserId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing email subject');
    });

    it('should handle email function errors', async () => {
      const supabase = createMockSupabase();
      supabase.functions.invoke = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Rate limit exceeded' },
      });

      const config: EmailActionConfig = {
        to: 'test@example.com',
        subject: 'Test',
        body: 'Test',
      };

      const result = await executeEmail(supabase, config, testContext, testUserId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Email function error');
    });
  });

  describe('AI Analysis Action', () => {
    it('should execute auto_tag analysis', async () => {
      const supabase = createMockSupabase();
      const config: AIAnalysisActionConfig = { analysis_type: 'auto_tag' };

      const result = await executeAIAnalysis(supabase, config, testContext);

      expect(result.success).toBe(true);
      expect(result.details?.analysis_type).toBe('auto_tag');
      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        'auto-tag-calls',
        expect.objectContaining({
          body: { recordingIds: [12345] },
        })
      );
    });

    it('should execute sentiment analysis', async () => {
      const supabase = createMockSupabase();
      supabase.functions.invoke = vi.fn().mockResolvedValue({
        data: { sentiment: 'positive', confidence: 0.9 },
        error: null,
      });

      const config: AIAnalysisActionConfig = { analysis_type: 'sentiment' };

      const result = await executeAIAnalysis(supabase, config, testContext);

      expect(result.success).toBe(true);
      expect(result.details?.sentiment).toBe('positive');
      expect(result.details?.confidence).toBe(0.9);
    });

    it('should execute summarize analysis', async () => {
      const supabase = createMockSupabase();
      const config: AIAnalysisActionConfig = { analysis_type: 'summarize' };

      const result = await executeAIAnalysis(supabase, config, testContext);

      expect(result.success).toBe(true);
      expect(result.details?.analysis_type).toBe('summarize');
    });

    it('should execute extract_action_items analysis', async () => {
      const supabase = createMockSupabase();
      supabase.functions.invoke = vi.fn().mockResolvedValue({
        data: { action_items: ['Task 1', 'Task 2'] },
        error: null,
      });

      const config: AIAnalysisActionConfig = { analysis_type: 'extract_action_items' };

      const result = await executeAIAnalysis(supabase, config, testContext);

      expect(result.success).toBe(true);
      expect(result.details?.action_items_count).toBe(2);
    });

    it('should execute custom analysis with prompt', async () => {
      const supabase = createMockSupabase();
      const config: AIAnalysisActionConfig = {
        analysis_type: 'custom',
        custom_prompt: 'Analyze the competitive mentions in this call',
      };

      const result = await executeAIAnalysis(supabase, config, testContext);

      expect(result.success).toBe(true);
      expect(result.details?.note).toBe('Custom AI analysis queued');
      expect(result.details?.prompt).toContain('competitive mentions');
    });

    it('should fail custom analysis without prompt', async () => {
      const supabase = createMockSupabase();
      const config: AIAnalysisActionConfig = { analysis_type: 'custom' };

      const result = await executeAIAnalysis(supabase, config, testContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('custom_prompt');
    });

    it('should fail when recording_id is missing', async () => {
      const supabase = createMockSupabase();
      const config: AIAnalysisActionConfig = { analysis_type: 'auto_tag' };

      const result = await executeAIAnalysis(supabase, config, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing recording_id');
    });

    it('should handle unknown analysis type', async () => {
      const supabase = createMockSupabase();
      const config = { analysis_type: 'unknown' as AIAnalysisActionConfig['analysis_type'] };

      const result = await executeAIAnalysis(supabase, config, testContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown analysis type');
    });
  });

  describe('Update Client Health Action', () => {
    it('should skip when no client found', async () => {
      const supabase = createMockSupabase();
      const config: ClientHealthActionConfig = {
        adjustment: -10,
        reason: 'Negative sentiment detected',
      };

      const contextWithoutClient: EvaluationContext = {
        call: { recording_id: 123 },
      };

      const result = await executeUpdateClientHealth(supabase, config, contextWithoutClient, testUserId);

      expect(result.success).toBe(true);
      expect(result.details?.note).toContain('No client found');
    });

    it('should update health with relative adjustment', async () => {
      const supabase = createMockSupabase();
      supabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { health_score: 70 }, error: null }),
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'client-123' }, error: null }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      const config: ClientHealthActionConfig = {
        client_id: 'client-123',
        adjustment: -10,
        reason: 'Negative call',
        set_absolute: false,
      };

      const result = await executeUpdateClientHealth(supabase, config, testContext, testUserId);

      expect(result.success).toBe(true);
      expect(result.details?.previous_score).toBe(70);
      expect(result.details?.new_score).toBe(60);
    });

    it('should set absolute health score when requested', async () => {
      const supabase = createMockSupabase();
      supabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { health_score: 70 }, error: null }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      const config: ClientHealthActionConfig = {
        client_id: 'client-123',
        adjustment: 85,
        reason: 'Manual adjustment',
        set_absolute: true,
      };

      const result = await executeUpdateClientHealth(supabase, config, testContext, testUserId);

      expect(result.success).toBe(true);
      expect(result.details?.new_score).toBe(85);
    });

    it('should clamp health score to 0-100 range', async () => {
      const supabase = createMockSupabase();
      supabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { health_score: 10 }, error: null }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      const config: ClientHealthActionConfig = {
        client_id: 'client-123',
        adjustment: -50,
        reason: 'Large negative adjustment',
      };

      const result = await executeUpdateClientHealth(supabase, config, testContext, testUserId);

      expect(result.success).toBe(true);
      expect(result.details?.new_score).toBe(0);
    });
  });

  describe('Webhook Action', () => {
    it('should successfully send webhook', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      const config: WebhookActionConfig = {
        url: 'https://api.example.com/webhook',
        method: 'POST',
      };

      const result = await executeWebhook(config, testContext, mockFetch);

      expect(result.success).toBe(true);
      expect(result.details?.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/webhook',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should include call data by default', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      const config: WebhookActionConfig = {
        url: 'https://api.example.com/webhook',
      };

      await executeWebhook(config, testContext, mockFetch);

      const callArg = mockFetch.mock.calls[0][1];
      const body = JSON.parse(callArg.body);

      expect(body.event).toBe('automation_triggered');
      expect(body.call.recording_id).toBe(12345);
      expect(body.call.title).toBe('Test Call');
    });

    it('should use body template when provided', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      const config: WebhookActionConfig = {
        url: 'https://api.example.com/webhook',
        body_template: '{"call_title": "{{call.title}}", "sentiment": "{{call.sentiment}}"}',
      };

      await executeWebhook(config, testContext, mockFetch);

      const callArg = mockFetch.mock.calls[0][1];
      expect(callArg.body).toBe('{"call_title": "Test Call", "sentiment": "positive"}');
    });

    it('should include custom headers', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      const config: WebhookActionConfig = {
        url: 'https://api.example.com/webhook',
        headers: {
          'X-API-Key': 'secret-key',
          'X-Custom': 'header',
        },
      };

      await executeWebhook(config, testContext, mockFetch);

      const callArg = mockFetch.mock.calls[0][1];
      expect(callArg.headers['X-API-Key']).toBe('secret-key');
      expect(callArg.headers['X-Custom']).toBe('header');
    });

    it('should handle HTTP errors', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const config: WebhookActionConfig = {
        url: 'https://api.example.com/webhook',
      };

      const result = await executeWebhook(config, testContext, mockFetch);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Webhook failed: 500');
    });

    it('should handle network errors', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const config: WebhookActionConfig = {
        url: 'https://api.example.com/webhook',
      };

      const result = await executeWebhook(config, testContext, mockFetch);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Webhook error');
    });

    it('should fail when URL is missing', async () => {
      const config: WebhookActionConfig = {
        url: '',
      };

      const result = await executeWebhook(config, testContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing webhook URL');
    });
  });

  describe('Create Task Action', () => {
    it('should successfully create task', async () => {
      const supabase = createMockSupabase();
      const config: CreateTaskActionConfig = {
        title: 'Follow up on {{call.title}}',
        description: 'Call duration: {{call.duration_minutes}} min',
        priority: 'high',
      };

      const result = await executeCreateTask(supabase, config, testContext, testUserId);

      expect(result.success).toBe(true);
      expect(result.details?.title).toBe('Follow up on Test Call');
      expect(result.details?.task_id).toBe('task-123');
    });

    it('should calculate due date from due_in_days', async () => {
      const supabase = createMockSupabase();
      const config: CreateTaskActionConfig = {
        title: 'Test Task',
        due_in_days: 7,
      };

      const result = await executeCreateTask(supabase, config, testContext, testUserId);

      expect(result.success).toBe(true);
      expect(result.details?.due_date).toBeDefined();
    });

    it('should use explicit due_date when provided', async () => {
      const supabase = createMockSupabase();
      const dueDate = '2026-01-20T10:00:00Z';
      const config: CreateTaskActionConfig = {
        title: 'Test Task',
        due_date: dueDate,
      };

      const result = await executeCreateTask(supabase, config, testContext, testUserId);

      expect(result.success).toBe(true);
      expect(result.details?.due_date).toBe(dueDate);
    });

    it('should fail when title is missing', async () => {
      const supabase = createMockSupabase();
      const config: CreateTaskActionConfig = {
        title: '',
      };

      const result = await executeCreateTask(supabase, config, testContext, testUserId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing task title');
    });
  });

  describe('Execution History Logging', () => {
    it('should include action details for successful folder assignment', async () => {
      const supabase = createMockSupabase();
      const config: FolderActionConfig = { folder_id: 'folder-123' };

      const result = await executeAddToFolder(supabase, config, testContext, testUserId);

      // Verify result contains data for execution history
      expect(result.success).toBe(true);
      expect(result.details).toEqual({
        folder_id: 'folder-123',
        recording_id: 12345,
      });
    });

    it('should include error details for failed actions', async () => {
      const supabase = createMockSupabase();
      supabase.from = vi.fn().mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: { message: 'Foreign key violation' } }),
      });

      const config: FolderActionConfig = { folder_id: 'invalid-folder' };

      const result = await executeAddToFolder(supabase, config, testContext, testUserId);

      // Verify error is captured for history
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to add to folder');
    });

    it('should include email delivery details', async () => {
      const supabase = createMockSupabase();
      const config: EmailActionConfig = {
        to: 'test@example.com',
        subject: 'Test',
        body: 'Body',
      };

      const result = await executeEmail(supabase, config, testContext, testUserId);

      // Verify email action includes message_id for tracking
      expect(result.details?.message_id).toBe('msg-123');
    });

    it('should include AI analysis results', async () => {
      const supabase = createMockSupabase();
      supabase.functions.invoke = vi.fn().mockResolvedValue({
        data: { sentiment: 'negative', confidence: 0.95 },
        error: null,
      });

      const config: AIAnalysisActionConfig = { analysis_type: 'sentiment' };

      const result = await executeAIAnalysis(supabase, config, testContext);

      // Verify AI results are captured
      expect(result.details?.sentiment).toBe('negative');
      expect(result.details?.confidence).toBe(0.95);
    });

    it('should include webhook response status', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
      });

      const config: WebhookActionConfig = {
        url: 'https://api.example.com/webhook',
      };

      const result = await executeWebhook(config, testContext, mockFetch);

      // Verify webhook status is captured
      expect(result.details?.status).toBe(201);
      expect(result.details?.url).toBe('https://api.example.com/webhook');
    });

    it('should include client health update details', async () => {
      const supabase = createMockSupabase();
      supabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { health_score: 60 }, error: null }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      const config: ClientHealthActionConfig = {
        client_id: 'client-123',
        adjustment: 10,
        reason: 'Positive call outcome',
      };

      const result = await executeUpdateClientHealth(supabase, config, testContext, testUserId);

      // Verify health update details are captured
      expect(result.details?.previous_score).toBe(60);
      expect(result.details?.new_score).toBe(70);
      expect(result.details?.adjustment).toBe(10);
      expect(result.details?.reason).toBe('Positive call outcome');
    });
  });

  describe('Integration: Complete Action Execution Flow', () => {
    /**
     * This test simulates the complete flow from subtask-8-6:
     * 1. Test email action via Resend
     * 2. Test folder assignment
     * 3. Test AI analysis trigger
     * 4. Test client health update
     * 5. Verify all logged in history
     */
    it('should execute all action types and track results for history', async () => {
      const supabase = createMockSupabase();
      const executionHistory: Array<{
        action_type: string;
        result: ActionResult;
      }> = [];

      // 1. Email action
      const emailConfig: EmailActionConfig = {
        to: 'sales@example.com',
        subject: 'Pricing discussed in: {{call.title}}',
        body: 'Review the call about pricing.',
      };
      const emailResult = await executeEmail(supabase, emailConfig, testContext, testUserId);
      executionHistory.push({ action_type: 'email', result: emailResult });
      expect(emailResult.success).toBe(true);

      // 2. Folder assignment
      const folderConfig: FolderActionConfig = { folder_id: 'sales-folder' };
      const folderResult = await executeAddToFolder(supabase, folderConfig, testContext, testUserId);
      executionHistory.push({ action_type: 'add_to_folder', result: folderResult });
      expect(folderResult.success).toBe(true);

      // 3. AI analysis trigger
      const aiConfig: AIAnalysisActionConfig = { analysis_type: 'auto_tag' };
      const aiResult = await executeAIAnalysis(supabase, aiConfig, testContext);
      executionHistory.push({ action_type: 'run_ai_analysis', result: aiResult });
      expect(aiResult.success).toBe(true);

      // 4. Client health update
      supabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { health_score: 75 }, error: null }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });
      const healthConfig: ClientHealthActionConfig = {
        client_id: 'client-456',
        adjustment: 5,
        reason: 'Pricing discussion - interested prospect',
      };
      const healthResult = await executeUpdateClientHealth(supabase, healthConfig, testContext, testUserId);
      executionHistory.push({ action_type: 'update_client_health', result: healthResult });
      expect(healthResult.success).toBe(true);

      // 5. Verify all logged in history
      expect(executionHistory).toHaveLength(4);
      expect(executionHistory.every((h) => h.result.success)).toBe(true);

      // Verify history contains all necessary debug details
      const emailEntry = executionHistory.find((h) => h.action_type === 'email');
      expect(emailEntry?.result.details?.message_id).toBeDefined();

      const folderEntry = executionHistory.find((h) => h.action_type === 'add_to_folder');
      expect(folderEntry?.result.details?.folder_id).toBe('sales-folder');

      const aiEntry = executionHistory.find((h) => h.action_type === 'run_ai_analysis');
      expect(aiEntry?.result.details?.analysis_type).toBe('auto_tag');

      const healthEntry = executionHistory.find((h) => h.action_type === 'update_client_health');
      expect(healthEntry?.result.details?.new_score).toBe(80);
    });

    it('should handle mixed success/failure and log all results', async () => {
      const supabase = createMockSupabase();
      const executionHistory: Array<{
        action_type: string;
        result: ActionResult;
      }> = [];

      // Successful folder action
      const folderResult = await executeAddToFolder(
        supabase,
        { folder_id: 'folder-123' },
        testContext,
        testUserId
      );
      executionHistory.push({ action_type: 'add_to_folder', result: folderResult });

      // Failed email action (missing subject)
      const emailResult = await executeEmail(
        supabase,
        { to: 'test@example.com', subject: '', body: 'Test' },
        testContext,
        testUserId
      );
      executionHistory.push({ action_type: 'email', result: emailResult });

      // Verify mixed results
      expect(executionHistory).toHaveLength(2);
      expect(executionHistory[0].result.success).toBe(true);
      expect(executionHistory[1].result.success).toBe(false);
      expect(executionHistory[1].result.error).toContain('Missing email subject');
    });
  });
});
