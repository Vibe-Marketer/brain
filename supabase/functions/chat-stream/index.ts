import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createOpenRouter } from 'https://esm.sh/@openrouter/ai-sdk-provider@1.2.8';
import { streamText, tool, convertToModelMessages } from 'https://esm.sh/ai@5.0.102';
import { z } from 'https://esm.sh/zod@3.23.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// UIMessage format from AI SDK v5 frontend
// The frontend sends full UIMessage[] via DefaultChatTransport
interface UIMessagePart {
  type: string;
  text?: string;
  [key: string]: unknown;
}

interface UIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content?: string;  // Legacy field, may be empty in v5
  parts?: UIMessagePart[];  // AI SDK v5 uses parts
  [key: string]: unknown;
}

interface SessionFilters {
  date_start?: string;
  date_end?: string;
  speakers?: string[];
  categories?: string[];
  recording_ids?: number[];
}

// ============================================
// OPENROUTER CONFIGURATION
// ============================================

/**
 * OpenRouter Configuration
 * All models are routed through OpenRouter for unified access to 300+ models
 * Using the official @openrouter/ai-sdk-provider for AI SDK v5 compatibility
 *
 * Models use format: 'provider/model-name' (e.g., 'openai/gpt-4o', 'anthropic/claude-sonnet-4')
 *
 * Docs: https://openrouter.ai/docs
 * Provider: https://ai-sdk.dev/providers/community-providers/openrouter
 */

// Create OpenRouter provider instance
function createOpenRouterProvider(apiKey: string) {
  return createOpenRouter({
    apiKey,
    // Optional headers for OpenRouter dashboard tracking
    headers: {
      'HTTP-Referer': 'https://conversion.brain',
      'X-Title': 'Conversion Brain',
    },
  });
}

// Generate embedding for search query
// Note: OpenRouter doesn't support embeddings, so we use OpenAI directly
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
// RE-RANKING FUNCTIONS (Phase 2 - Quality Enhancement)
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
    // deno-lint-ignore no-explicit-any
    const sorted = [...results].sort((a: any, b: any) => {
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
    // Process in batches of 5 to avoid rate limits
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

      // Small delay between batches to avoid rate limits
      if (i + batchSize < candidates.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`Re-ranking completed in ${Date.now() - startTime}ms`);

    // Sort by rerank score and return top K
    return scoredCandidates
      .sort((a, b) => (b.rerank_score || 0) - (a.rerank_score || 0))
      .slice(0, topK);

  } catch (error) {
    console.error('Re-ranking failed, using original order:', error);
    return candidates.slice(0, topK);
  }
}

// ============================================
// DIVERSITY FILTER (Phase 2 - Quality Enhancement)
// ============================================

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

  console.log(`Diversity filter: ${chunks.length} input → ${diverse.length} diverse results`);
  return diverse;
}

// ============================================
// MAIN HANDLER
// ============================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // OpenRouter API Key - primary authentication for all LLM calls
    const openrouterApiKey = Deno.env.get('OPENROUTER_API_KEY');
    // OpenAI API Key - for embeddings only (OpenRouter doesn't support embeddings)
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openrouterApiKey) {
      throw new Error('OPENROUTER_API_KEY must be configured');
    }

    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY must be configured for embeddings');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user ID from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      id: chatId,
      session_id,
      messages,
      filters,
      model: requestedModel,
    }: {
      id?: string;
      session_id?: string;
      messages: UIMessage[];
      filters?: SessionFilters;
      model?: string;
    } = await req.json();

    // Model format: 'provider/model-name' (e.g., 'z-ai/glm-4.6', 'openai/gpt-4o')
    // OpenRouter uses this format directly - no translation needed
    let selectedModel = requestedModel || 'z-ai/glm-4.6';
    if (!selectedModel.includes('/')) {
      // Legacy format - add openai prefix for backwards compatibility
      selectedModel = `openai/${selectedModel}`;
    }

    console.log(`Using model: ${selectedModel} via OpenRouter`);

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'messages array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Chat request for user ${user.id}, chat ${chatId || session_id || 'new'}`);

    // Build filter context for the system prompt
    let filterContext = '';
    if (filters) {
      const parts: string[] = [];
      if (filters.date_start || filters.date_end) {
        const dateRange = [
          filters.date_start ? `from ${filters.date_start}` : '',
          filters.date_end ? `to ${filters.date_end}` : '',
        ].filter(Boolean).join(' ');
        parts.push(`Date range: ${dateRange}`);
      }
      if (filters.speakers && filters.speakers.length > 0) {
        parts.push(`Speakers: ${filters.speakers.join(', ')}`);
      }
      if (filters.categories && filters.categories.length > 0) {
        parts.push(`Categories: ${filters.categories.join(', ')}`);
      }
      if (filters.recording_ids && filters.recording_ids.length > 0) {
        parts.push(`Specific calls: ${filters.recording_ids.length} selected`);
      }
      if (parts.length > 0) {
        filterContext = `\n\nActive filters:\n${parts.join('\n')}`;
      }
    }

    // Define tools for the agent
    const searchTranscriptsTool = tool({
      description: 'Search through meeting transcripts using semantic and keyword search. Use this to find relevant information from past calls. For temporal queries (recent, last week, etc.), use summarizeCalls FIRST to filter by date, then use this tool to find specific content.',
      parameters: z.object({
        query: z.string().describe('The search query to find relevant transcript chunks (e.g., "objections", "pricing concerns", "next steps")'),
        limit: z.number().optional().default(10).describe('Maximum number of results to return'),
      }),
      execute: async ({ query, limit }) => {
        console.log(`Searching transcripts: "${query}" (limit: ${limit})`);
        const searchStartTime = Date.now();

        // Generate query embedding (uses OpenAI directly - OpenRouter doesn't support embeddings)
        const queryEmbedding = await generateQueryEmbedding(query, openaiApiKey);

        // Step 1: Get more candidates for re-ranking (3x the requested limit, max 30)
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

        // Step 2: Re-rank candidates using cross-encoder (if HuggingFace key available)
        const reranked = await rerankResults(query, candidates, limit * 2);

        // Step 3: Apply diversity filter (max 2 chunks per recording)
        const diverse = diversityFilter(reranked, 2, limit);

        console.log(`Search pipeline complete: ${candidates.length} → ${reranked.length} → ${diverse.length} results`);

        // Format results for the LLM
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
      },
    });

    const getCallDetailsTool = tool({
      description: 'Get full details about a specific call including title, date, participants, and summary.',
      parameters: z.object({
        recording_id: z.number().describe('The recording ID of the call to get details for'),
      }),
      execute: async ({ recording_id }) => {
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

        // Get speakers for this call (use composite key for user isolation)
        const { data: speakers } = await supabase
          .from('fathom_transcripts')
          .select('speaker_name, speaker_email')
          .eq('recording_id', recording_id)
          .eq('user_id', user.id)
          .eq('is_deleted', false);

        const uniqueSpeakers = [...new Set(speakers?.map(s => s.speaker_name).filter(Boolean))];

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
      },
    });

    const summarizeCallsTool = tool({
      description: 'Get a summary overview of calls matching certain criteria. MUST be used for temporal queries (recent, last week, yesterday, etc.) to filter by date range. Use this for high-level analysis across multiple calls.',
      parameters: z.object({
        query: z.string().optional().describe('Optional search query to filter calls'),
        date_start: z.string().optional().describe('Start date in ISO format (YYYY-MM-DD). Use this for temporal queries like "recent calls" (14 days ago), "last week" (7 days ago), etc.'),
        date_end: z.string().optional().describe('End date in ISO format (YYYY-MM-DD). Optional - if omitted, includes calls up to today.'),
        category: z.string().optional().describe('Category to filter by'),
      }),
      execute: async ({ query, date_start, date_end, category }) => {
        console.log(`Summarizing calls with filters`);

        let callsQuery = supabase
          .from('fathom_calls')
          .select('recording_id, title, created_at, summary, recorded_by_name')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        // Apply date filters
        if (date_start || filters?.date_start) {
          callsQuery = callsQuery.gte('created_at', date_start || filters?.date_start);
        }
        if (date_end || filters?.date_end) {
          callsQuery = callsQuery.lte('created_at', date_end || filters?.date_end);
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
          calls: calls.map(c => ({
            recording_id: c.recording_id,
            title: c.title,
            date: c.created_at,
            recorded_by: c.recorded_by_name,
            summary_preview: c.summary ? c.summary.substring(0, 200) + '...' : 'No summary',
          })),
        };
      },
    });

    // Get today's date for temporal query handling
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // System prompt
    const systemPrompt = `You are an intelligent assistant for Conversion Brain, helping users analyze their meeting transcripts and extract insights.

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

IMPORTANT: When you detect temporal queries (like "recent", "last week", "yesterday", etc.), you MUST use the summarizeCalls tool with the appropriate date_start and/or date_end parameters. Then use searchTranscripts to find specific details within those calls.

Example workflow for "What were the main objections in my recent sales calls?":
1. Use summarizeCalls with date_start set to 14 days ago to get recent calls
2. Use searchTranscripts with query="objections" to find objection-related content in those calls

${filterContext}

Important: Only access transcripts belonging to the current user. Never fabricate information - if you can't find relevant data, say so.`;

    // Create streaming response with selected model using OpenRouter
    // OpenRouter uses the full model string directly (e.g., 'openai/gpt-4o', 'anthropic/claude-sonnet-4')
    console.log(`Streaming with OpenRouter - Model: ${selectedModel}`);

    // Create the OpenRouter provider instance using official AI SDK provider
    const openrouter = createOpenRouterProvider(openrouterApiKey);

    // Convert UI messages to model messages for AI SDK v5
    // The frontend sends UIMessage[] format, but streamText expects ModelMessage[]
    const modelMessages = convertToModelMessages(messages);

    const result = await streamText({
      model: openrouter.chat(selectedModel),
      system: systemPrompt,
      messages: modelMessages,
      tools: {
        searchTranscripts: searchTranscriptsTool,
        getCallDetails: getCallDetailsTool,
        summarizeCalls: summarizeCallsTool,
      },
      maxSteps: 5, // AI SDK v5 uses maxSteps for tool roundtrips
    });

    // Use toUIMessageStreamResponse for AI SDK v5
    // This ensures tool calls and tool results are properly streamed to the client
    return result.toUIMessageStreamResponse({
      headers: corsHeaders,
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
