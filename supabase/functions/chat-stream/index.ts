import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createOpenAI } from 'https://esm.sh/@ai-sdk/openai@2.0.72';
import { streamText, tool } from 'https://esm.sh/ai@6.0.0-beta.114';
import { z } from 'https://esm.sh/zod@3.25.76';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface SessionFilters {
  date_start?: string;
  date_end?: string;
  speakers?: string[];
  categories?: string[];
  recording_ids?: number[];
}

// Generate embedding for search query
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
    throw new Error(`OpenAI embedding error: ${response.status}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const openai = createOpenAI({ apiKey: openaiApiKey });

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
      session_id,
      messages,
      filters,
    }: {
      session_id?: string;
      messages: ChatMessage[];
      filters?: SessionFilters;
    } = await req.json();

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'messages array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Chat request for user ${user.id}, session ${session_id || 'new'}`);

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
      description: 'Search through meeting transcripts using semantic and keyword search. Use this to find relevant information from past calls.',
      parameters: z.object({
        query: z.string().describe('The search query to find relevant transcript chunks'),
        limit: z.number().optional().default(10).describe('Maximum number of results to return'),
      }),
      execute: async ({ query, limit }) => {
        console.log(`Searching transcripts: "${query}" (limit: ${limit})`);

        // Generate query embedding
        const queryEmbedding = await generateQueryEmbedding(query, openaiApiKey);

        // Call hybrid search function
        const { data: results, error } = await supabase.rpc('hybrid_search_transcripts', {
          query_text: query,
          query_embedding: queryEmbedding,
          match_count: limit,
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

        if (!results || results.length === 0) {
          return { message: 'No relevant transcripts found for this query.' };
        }

        // Format results for the LLM
        return {
          results: results.map((r: any, i: number) => ({
            index: i + 1,
            recording_id: r.recording_id,
            call_title: r.call_title,
            call_date: r.call_date,
            speaker: r.speaker_name,
            category: r.call_category,
            text: r.chunk_text,
            relevance: Math.round(r.rrf_score * 100) + '%',
          })),
          total_found: results.length,
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

        // Get speakers for this call
        const { data: speakers } = await supabase
          .from('fathom_transcripts')
          .select('speaker_name, speaker_email')
          .eq('recording_id', recording_id)
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
      description: 'Get a summary overview of calls matching certain criteria. Use this for high-level analysis across multiple calls.',
      parameters: z.object({
        query: z.string().optional().describe('Optional search query to filter calls'),
        date_start: z.string().optional().describe('Start date in ISO format'),
        date_end: z.string().optional().describe('End date in ISO format'),
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

${filterContext}

Important: Only access transcripts belonging to the current user. Never fabricate information - if you can't find relevant data, say so.`;

    // Create streaming response
    const result = streamText({
      model: openai('gpt-4o'),
      system: systemPrompt,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      tools: {
        searchTranscripts: searchTranscriptsTool,
        getCallDetails: getCallDetailsTool,
        summarizeCalls: summarizeCallsTool,
      },
      maxSteps: 5, // Allow up to 5 tool calls
    });

    // Return streaming response with proper headers
    const stream = result.toDataStream();

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
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
