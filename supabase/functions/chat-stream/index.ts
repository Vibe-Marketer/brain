import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// DIRECT OpenAI API Implementation
// The AI SDK has zod bundling issues with esm.sh that cause "safeParseAsync is not a function" errors
// when tool calls are returned. We bypass the AI SDK entirely and use native fetch with OpenAI API.

// CORS headers for API responses
// Note: sentry-trace and baggage are needed for Sentry distributed tracing
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
};

// UIMessage format from AI SDK v5 frontend
interface UIMessagePart {
  type: string;
  text?: string;
  [key: string]: unknown;
}

interface UIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content?: string;
  parts?: UIMessagePart[];
  [key: string]: unknown;
}

interface SessionFilters {
  date_start?: string;
  date_end?: string;
  speakers?: string[];
  categories?: string[];
  recording_ids?: number[];
}

// OpenAI API types
interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

// ============================================
// EMBEDDING GENERATION
// ============================================

async function generateQueryEmbedding(text: string, openaiApiKey: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Embedding error: ${response.status}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

// ============================================
// RE-RANKING FUNCTIONS
// ============================================

interface RerankCandidate {
  chunk_id: string;
  chunk_text: string;
  recording_id: number;
  speaker_name: string | null;
  call_title: string;
  call_date: string;
  call_category: string | null;
  rrf_score: number;
  similarity_score: number;
  rerank_score?: number;
}

function extractScore(data: unknown): number {
  if (Array.isArray(data) && data.length > 0) {
    const results = Array.isArray(data[0]) ? data[0] : data;
    const sorted = [...results].sort((a: {label?: string; score?: number}, b: {label?: string; score?: number}) => {
      const labelA = parseInt(a?.label?.match(/\d+/)?.[0] || '0', 10);
      const labelB = parseInt(b?.label?.match(/\d+/)?.[0] || '0', 10);
      return labelB - labelA;
    });
    return sorted[0]?.score ?? 0.5;
  }
  return typeof data === 'number' ? data : 0.5;
}

async function rerankResults(
  query: string,
  candidates: RerankCandidate[],
  topK: number = 10
): Promise<RerankCandidate[]> {
  const hfApiKey = Deno.env.get('HUGGINGFACE_API_KEY');

  if (!hfApiKey || candidates.length === 0) {
    console.log('Re-ranking skipped (no API key or no candidates)');
    return candidates.slice(0, topK);
  }

  const RERANK_MODEL = 'cross-encoder/ms-marco-MiniLM-L-12-v2';
  const startTime = Date.now();

  try {
    const batchSize = 5;
    const scoredCandidates: RerankCandidate[] = [];

    for (let i = 0; i < candidates.length; i += batchSize) {
      const batch = candidates.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map(async (candidate) => {
          try {
            const response = await fetch(
              `https://api-inference.huggingface.co/models/${RERANK_MODEL}`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${hfApiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  inputs: `${query} [SEP] ${candidate.chunk_text.substring(0, 500)}`,
                  options: { wait_for_model: true },
                }),
              }
            );

            if (!response.ok) {
              return { ...candidate, rerank_score: candidate.rrf_score };
            }

            const data = await response.json();
            const score = extractScore(data);
            return { ...candidate, rerank_score: score };
          } catch {
            return { ...candidate, rerank_score: candidate.rrf_score };
          }
        })
      );

      scoredCandidates.push(...batchResults);

      if (i + batchSize < candidates.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`Re-ranking completed in ${Date.now() - startTime}ms`);

    return scoredCandidates
      .sort((a, b) => (b.rerank_score || 0) - (a.rerank_score || 0))
      .slice(0, topK);

  } catch (error) {
    console.error('Re-ranking failed, using original order:', error);
    return candidates.slice(0, topK);
  }
}

function diversityFilter<T extends { recording_id: number }>(
  chunks: T[],
  maxPerRecording: number = 2,
  targetCount: number = 5
): T[] {
  const diverse: T[] = [];
  const recordingCounts = new Map<number, number>();

  for (const chunk of chunks) {
    if (diverse.length >= targetCount) break;

    const count = recordingCounts.get(chunk.recording_id) || 0;
    if (count >= maxPerRecording) continue;

    diverse.push(chunk);
    recordingCounts.set(chunk.recording_id, count + 1);
  }

  return diverse;
}

// ============================================
// TOOL DEFINITIONS (OpenAI Function Format)
// ============================================

const tools: OpenAITool[] = [
  {
    type: 'function',
    function: {
      name: 'searchTranscripts',
      description: 'Search through meeting transcripts using semantic and keyword search. Use this to find relevant information from past calls. For temporal queries (recent, last week, etc.), use summarizeCalls FIRST to filter by date, then use this tool to find specific content.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query to find relevant transcript chunks (e.g., "objections", "pricing concerns", "next steps")',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default: 10)',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getCallDetails',
      description: 'Get full details about a specific call including title, date, participants, and summary.',
      parameters: {
        type: 'object',
        properties: {
          recording_id: {
            type: 'number',
            description: 'The recording ID of the call to get details for',
          },
        },
        required: ['recording_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'summarizeCalls',
      description: 'Get a summary overview of calls matching certain criteria. MUST be used for temporal queries (recent, last week, yesterday, etc.) to filter by date range. Use this for high-level analysis across multiple calls.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Optional search query to filter calls',
          },
          date_start: {
            type: 'string',
            description: 'Start date in ISO format (YYYY-MM-DD). Use this for temporal queries like "recent calls" (14 days ago), "last week" (7 days ago), etc.',
          },
          date_end: {
            type: 'string',
            description: 'End date in ISO format (YYYY-MM-DD). Optional - if omitted, includes calls up to today.',
          },
          category: {
            type: 'string',
            description: 'Category to filter by',
          },
        },
        required: [],
      },
    },
  },
];

// ============================================
// TOOL EXECUTION
// ============================================

type SupabaseClient = ReturnType<typeof createClient>;
interface User {
  id: string;
  [key: string]: unknown;
}

async function executeSearchTranscripts(
  args: { query: string; limit?: number },
  supabase: SupabaseClient,
  user: User,
  openaiApiKey: string,
  filters?: SessionFilters
): Promise<unknown> {
  const { query, limit = 10 } = args;
  console.log(`Searching transcripts: "${query}" (limit: ${limit})`);
  const searchStartTime = Date.now();

  const queryEmbedding = await generateQueryEmbedding(query, openaiApiKey);
  const candidateCount = Math.min(limit * 3, 30);

  const { data: candidates, error } = await supabase.rpc('hybrid_search_transcripts', {
    query_text: query,
    query_embedding: queryEmbedding,
    match_count: candidateCount,
    full_text_weight: 1.0,
    semantic_weight: 1.0,
    rrf_k: 60,
    filter_user_id: user.id,
    filter_date_start: filters?.date_start || null,
    filter_date_end: filters?.date_end || null,
    filter_speakers: filters?.speakers || null,
    filter_categories: filters?.categories || null,
    filter_recording_ids: filters?.recording_ids || null,
  });

  if (error) {
    console.error('Search error:', error);
    return { error: 'Search failed', details: error.message };
  }

  if (!candidates || candidates.length === 0) {
    return { message: 'No relevant transcripts found for this query.' };
  }

  console.log(`Hybrid search returned ${candidates.length} candidates in ${Date.now() - searchStartTime}ms`);

  const reranked = await rerankResults(query, candidates, limit * 2);
  const diverse = diversityFilter(reranked, 2, limit);

  console.log(`Search pipeline complete: ${candidates.length} → ${reranked.length} → ${diverse.length} results`);

  return {
    results: diverse.map((r: RerankCandidate, i: number) => ({
      index: i + 1,
      recording_id: r.recording_id,
      call_title: r.call_title,
      call_date: r.call_date,
      speaker: r.speaker_name,
      category: r.call_category,
      text: r.chunk_text,
      relevance: r.rerank_score
        ? Math.round(r.rerank_score * 100) + '%'
        : Math.round(r.rrf_score * 100) + '%',
    })),
    total_found: candidates.length,
    reranked: reranked.length,
    returned: diverse.length,
  };
}

async function executeGetCallDetails(
  args: { recording_id: number },
  supabase: SupabaseClient,
  user: User
): Promise<unknown> {
  const { recording_id } = args;
  console.log(`Getting call details for: ${recording_id}`);

  const { data: call, error } = await supabase
    .from('fathom_calls')
    .select('*')
    .eq('recording_id', recording_id)
    .eq('user_id', user.id)
    .single();

  if (error || !call) {
    return { error: 'Call not found' };
  }

  const { data: speakers } = await supabase
    .from('fathom_transcripts')
    .select('speaker_name, speaker_email')
    .eq('recording_id', recording_id)
    .eq('user_id', user.id)
    .eq('is_deleted', false);

  const uniqueSpeakers = [...new Set(speakers?.map((s: {speaker_name: string | null}) => s.speaker_name).filter(Boolean))];

  return {
    recording_id: call.recording_id,
    title: call.title,
    date: call.created_at,
    duration: call.recording_start_time && call.recording_end_time
      ? `${Math.round((new Date(call.recording_end_time).getTime() - new Date(call.recording_start_time).getTime()) / 60000)} minutes`
      : 'Unknown',
    recorded_by: call.recorded_by_name,
    participants: uniqueSpeakers,
    summary: call.summary || 'No summary available',
    url: call.url,
  };
}

async function executeSummarizeCalls(
  args: { query?: string; date_start?: string; date_end?: string; category?: string },
  supabase: SupabaseClient,
  user: User,
  filters?: SessionFilters
): Promise<unknown> {
  console.log(`Summarizing calls with filters`);

  let callsQuery = supabase
    .from('fathom_calls')
    .select('recording_id, title, created_at, summary, recorded_by_name')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (args.date_start || filters?.date_start) {
    callsQuery = callsQuery.gte('created_at', args.date_start || filters?.date_start);
  }
  if (args.date_end || filters?.date_end) {
    callsQuery = callsQuery.lte('created_at', args.date_end || filters?.date_end);
  }

  const { data: calls, error } = await callsQuery.limit(20);

  if (error) {
    return { error: 'Failed to fetch calls' };
  }

  if (!calls || calls.length === 0) {
    return { message: 'No calls found matching the criteria.' };
  }

  return {
    total_calls: calls.length,
    calls: calls.map((c: {recording_id: number; title: string; created_at: string; recorded_by_name: string; summary: string | null}) => ({
      recording_id: c.recording_id,
      title: c.title,
      date: c.created_at,
      recorded_by: c.recorded_by_name,
      summary_preview: c.summary ? c.summary.substring(0, 200) + '...' : 'No summary',
    })),
  };
}

async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  supabase: SupabaseClient,
  user: User,
  openaiApiKey: string,
  filters?: SessionFilters
): Promise<unknown> {
  switch (toolName) {
    case 'searchTranscripts':
      return executeSearchTranscripts(
        args as { query: string; limit?: number },
        supabase,
        user,
        openaiApiKey,
        filters
      );
    case 'getCallDetails':
      return executeGetCallDetails(
        args as { recording_id: number },
        supabase,
        user
      );
    case 'summarizeCalls':
      return executeSummarizeCalls(
        args as { query?: string; date_start?: string; date_end?: string; category?: string },
        supabase,
        user,
        filters
      );
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// ============================================
// OPENROUTER STREAMING CHAT
// ============================================
// OpenRouter provides access to 300+ models (OpenAI, Anthropic, Google, etc.)
// It's OpenAI-compatible, so we use the same format with different URL/headers

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

async function* streamOpenRouterChat(
  apiKey: string,
  model: string,
  messages: OpenAIMessage[],
  systemPrompt: string
): AsyncGenerator<{ type: string; data: unknown }> {
  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://conversionbrain.ai',
      'X-Title': 'CallVault',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      tools,
      tool_choice: 'auto',
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  // Accumulated state for tool calls
  const toolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (!trimmed.startsWith('data: ')) continue;

      try {
        const json = JSON.parse(trimmed.slice(6));
        const choice = json.choices?.[0];
        if (!choice) continue;

        const delta = choice.delta;

        // Handle text content
        if (delta?.content) {
          yield { type: 'text', data: delta.content };
        }

        // Handle tool calls
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const index = tc.index;
            if (!toolCalls.has(index)) {
              toolCalls.set(index, { id: tc.id || '', name: '', arguments: '' });
              if (tc.id) {
                yield { type: 'tool-call-start', data: { index, id: tc.id } };
              }
            }
            const current = toolCalls.get(index)!;
            if (tc.id) current.id = tc.id;
            if (tc.function?.name) {
              current.name = tc.function.name;
              yield { type: 'tool-call-name', data: { index, name: tc.function.name } };
            }
            if (tc.function?.arguments) {
              current.arguments += tc.function.arguments;
              yield { type: 'tool-call-args-delta', data: { index, delta: tc.function.arguments } };
            }
          }
        }

        // Handle finish reason
        if (choice.finish_reason === 'tool_calls') {
          // Emit completed tool calls
          for (const [index, tc] of toolCalls) {
            yield {
              type: 'tool-call-complete',
              data: {
                index,
                id: tc.id,
                name: tc.name,
                arguments: tc.arguments,
              },
            };
          }
          yield { type: 'finish', data: { reason: 'tool_calls' } };
        } else if (choice.finish_reason === 'stop') {
          yield { type: 'finish', data: { reason: 'stop' } };
        }
      } catch {
        // Ignore parse errors for incomplete chunks
      }
    }
  }
}

// ============================================
// UI MESSAGE STREAM HELPERS
// ============================================

function convertUIMessagesToOpenAI(messages: UIMessage[]): OpenAIMessage[] {
  return messages.map((msg) => {
    // Extract text content from parts
    let content = '';
    if (msg.parts && Array.isArray(msg.parts)) {
      content = msg.parts
        .filter((p: UIMessagePart) => p.type === 'text')
        .map((p: UIMessagePart) => p.text || '')
        .join('');
    } else if (msg.content) {
      content = msg.content;
    }

    return {
      role: msg.role as 'user' | 'assistant' | 'system',
      content,
    };
  });
}

// ============================================
// MAIN HANDLER
// ============================================

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // OpenRouter for chat (300+ models including OpenAI, Anthropic, Google, etc.)
    const openrouterApiKey = Deno.env.get('OPENROUTER_API_KEY');
    // OpenAI direct for embeddings only (OpenRouter doesn't support embeddings)
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openrouterApiKey) {
      throw new Error('OPENROUTER_API_KEY not configured');
    }
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured (needed for embeddings)');
    }

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await req.json();
    const { messages, sessionId, model: requestedModel } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Messages array required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get session filters if sessionId provided
    let filters: SessionFilters | undefined;
    if (sessionId) {
      const { data: session } = await supabase
        .from('chat_sessions')
        .select('filter_date_start, filter_date_end, filter_speakers, filter_categories, filter_recording_ids')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single();

      if (session) {
        filters = {
          date_start: session.filter_date_start,
          date_end: session.filter_date_end,
          speakers: session.filter_speakers,
          categories: session.filter_categories,
          recording_ids: session.filter_recording_ids,
        };
      }
    }

    // Determine model - default to openai/gpt-4o-mini for cost efficiency
    // Frontend sends OpenRouter format like "openai/gpt-4o-mini" - use as-is
    const selectedModel = requestedModel || 'openai/gpt-4o-mini';
    console.log(`Using model: ${selectedModel}`);

    // Build system prompt
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    let filterContext = '';
    if (filters) {
      const parts: string[] = [];
      if (filters.date_start) parts.push(`Date from: ${filters.date_start}`);
      if (filters.date_end) parts.push(`Date to: ${filters.date_end}`);
      if (filters.speakers?.length) parts.push(`Speakers: ${filters.speakers.join(', ')}`);
      if (filters.categories?.length) parts.push(`Categories: ${filters.categories.join(', ')}`);
      if (filters.recording_ids?.length) parts.push(`Specific calls: ${filters.recording_ids.length} selected`);
      if (parts.length > 0) filterContext = `\n\nActive filters:\n${parts.join('\n')}`;
    }

    const systemPrompt = `You are an intelligent assistant for CallVault™, helping users analyze their meeting transcripts and extract insights.

Your capabilities:
- Search through meeting transcripts to find relevant information
- Provide details about specific calls
- Summarize patterns across multiple calls
- Answer questions about what was discussed in meetings

When responding:
- Always cite your sources by mentioning the call title and date
- Be concise but thorough
- If you need to search for information, use the searchTranscripts tool
- For specific call details, use getCallDetails
- For high-level overviews, use summarizeCalls

TEMPORAL QUERY HANDLING:
Today's date is ${todayStr}. When users mention temporal terms, interpret them as date filters:

- "recent calls" = last 14 days (date_start: ${new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]})
- "last week" = past 7 days (date_start: ${new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]})
- "this week" = since Monday of current week
- "this month" = since the 1st of current month (date_start: ${new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]})
- "last month" = entire previous month
- "yesterday" = yesterday only (both date_start and date_end set to yesterday)
- "today" = today only (both date_start and date_end set to today)

IMPORTANT: When you detect temporal queries, you MUST use the summarizeCalls tool with the appropriate date_start and/or date_end parameters.
${filterContext}

Important: Only access transcripts belonging to the current user. Never fabricate information - if you can't find relevant data, say so.`;

    // Convert UI messages to OpenAI format
    const openaiMessages = convertUIMessagesToOpenAI(messages);

    // Setup streaming response
    const encoder = new TextEncoder();
    const messageId = crypto.randomUUID();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          send({ type: 'start', messageId });

          let continueLoop = true;
          let step = 0;
          const maxSteps = 5;

          while (continueLoop && step < maxSteps) {
            step++;
            send({ type: 'start-step' });

            let textId = '';
            let textStarted = false;
            const pendingToolCalls: Array<{ id: string; name: string; arguments: string }> = [];

            // Track active tool calls by index for streaming
            const activeToolCalls: Map<number, { id: string; name: string }> = new Map();

            // Stream from OpenRouter (supports 300+ models)
            for await (const event of streamOpenRouterChat(openrouterApiKey, selectedModel, openaiMessages, systemPrompt)) {
              if (event.type === 'text') {
                if (!textStarted) {
                  textId = crypto.randomUUID();
                  send({ type: 'text-start', id: textId });
                  textStarted = true;
                }
                send({ type: 'text-delta', id: textId, delta: event.data });
              } else if (event.type === 'tool-call-start') {
                const { index, id } = event.data as { index: number; id: string };
                activeToolCalls.set(index, { id, name: '' });
                // Don't send tool-input-start yet, wait for tool name
              } else if (event.type === 'tool-call-name') {
                const { index, name } = event.data as { index: number; name: string };
                const tc = activeToolCalls.get(index);
                if (tc) {
                  tc.name = name;
                  // Now we have both id and name, send tool-input-start
                  send({ type: 'tool-input-start', toolCallId: tc.id, toolName: name });
                }
              } else if (event.type === 'tool-call-args-delta') {
                const { index, delta } = event.data as { index: number; delta: string };
                const tc = activeToolCalls.get(index);
                if (tc) {
                  send({ type: 'tool-input-delta', toolCallId: tc.id, inputTextDelta: delta });
                }
              } else if (event.type === 'tool-call-complete') {
                if (textStarted) {
                  send({ type: 'text-end', id: textId });
                  textStarted = false;
                }
                const tc = event.data as { id: string; name: string; arguments: string };
                pendingToolCalls.push(tc);
                send({
                  type: 'tool-input-available',
                  toolCallId: tc.id,
                  toolName: tc.name,
                  input: JSON.parse(tc.arguments),
                });
              } else if (event.type === 'finish') {
                if (textStarted) {
                  send({ type: 'text-end', id: textId });
                  textStarted = false;
                }
                const { reason } = event.data as { reason: string };
                if (reason === 'stop') {
                  continueLoop = false;
                }
              }
            }

            // End current text block if still open
            if (textStarted) {
              send({ type: 'text-end', id: textId });
            }

            // Execute pending tool calls
            if (pendingToolCalls.length > 0) {
              // Add assistant message with tool calls
              openaiMessages.push({
                role: 'assistant',
                content: null,
                tool_calls: pendingToolCalls.map(tc => ({
                  id: tc.id,
                  type: 'function' as const,
                  function: { name: tc.name, arguments: tc.arguments },
                })),
              });

              // Execute each tool and add results
              for (const tc of pendingToolCalls) {
                console.log(`Executing tool: ${tc.name}`);
                const args = JSON.parse(tc.arguments);
                const result = await executeTool(tc.name, args, supabase, user, openaiApiKey, filters);

                send({
                  type: 'tool-output-available',
                  toolCallId: tc.id,
                  output: result,
                });

                openaiMessages.push({
                  role: 'tool',
                  tool_call_id: tc.id,
                  content: JSON.stringify(result),
                });
              }
            } else {
              continueLoop = false;
            }

            send({ type: 'finish-step' });
          }

          send({ type: 'finish' });
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
          send({
            type: 'error',
            errorText: error instanceof Error ? error.message : 'Unknown error',
          });
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'x-vercel-ai-ui-message-stream': 'v1',
      },
    });

  } catch (error) {
    console.error('Error in chat-stream:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
