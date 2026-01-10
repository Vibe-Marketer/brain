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
  topics?: string[];
  sentiment?: string;
  intent_signals?: string[];
  user_tags?: string[];
  entities?: { [key: string]: string[] };
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
    // Optimization: Increase batch size and cap total candidates to prevent timeouts
    // Hugging Face inference API handles larger batches reasonably well
    const batchSize = 10; 
    const maxCandidates = 30; // Hard cap on re-ranking to ensure responsiveness
    
    // Only re-rank the top N candidates from RRF/hybrid search
    const candidatesToRerank = candidates.slice(0, maxCandidates);
    const scoredCandidates: RerankCandidate[] = [];

    // Process in parallel chunks to speed up
    // We'll limit concurrency to 3 batches at a time
    for (let i = 0; i < candidatesToRerank.length; i += batchSize) {
      const batch = candidatesToRerank.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map(async (candidate) => {
          try {
            // Add timeout for individual rerank requests (1s) to fail fast
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1500);

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
                  options: { wait_for_model: true, use_cache: true },
                }),
                signal: controller.signal,
              }
            );
            clearTimeout(timeoutId);

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
      // Removed artificial delay to improve speed
    }

    console.log(`Re-ranking completed in ${Date.now() - startTime}ms`);
    
    // Merge re-ranked results with any remaining candidates that weren't re-ranked (keeping their original order/score)
    const remainingCandidates = candidates.slice(maxCandidates).map(c => ({
       ...c, 
       rerank_score: c.rrf_score // Use RRF score as fallback for tail
    }));
    
    const allScored = [...scoredCandidates, ...remainingCandidates];

    return allScored
      .sort((a, b) => (b.rerank_score || 0) - (a.rerank_score || 0))
      .slice(0, topK);

  } catch (error) {
    console.error('Re-ranking failed, using original order:', error);
    return candidates.slice(0, topK);
  }
}

function diversityFilter<T extends { recording_id: number }>(
  chunks: T[],
  maxPerRecording: number = 5,
  targetCount: number = 20
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
// Fixed: All properties must be in required array per OpenAI validation

// ============================================
// GRANULAR TOOL DEFINITIONS
// ============================================
// Enhanced tool architecture with 14 specialized tools for metadata-driven search
// Aligns with Vercel AI SDK best practices: many focused tools > few multipurpose tools

const tools: OpenAITool[] = [
  // CORE SEARCH TOOLS (4)
  {
    type: 'function',
    function: {
      name: 'searchTranscriptsByQuery',
      description: 'General semantic and keyword search through meeting transcripts. Use for broad queries about topics, content, or keywords. Best for: "What did they say about X?" or "Find mentions of Y".',
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
        required: ['query', 'limit'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'searchBySpeaker',
      description: 'Find what specific people said in meetings. Use when the user asks about a particular speaker or wants to filter by who spoke. Accepts speaker name or email.',
      parameters: {
        type: 'object',
        properties: {
          speaker: {
            type: 'string',
            description: 'Speaker name or email to filter by (e.g., "John Smith" or "john@company.com")',
          },
          query: {
            type: 'string',
            description: 'Optional refinement query to search within this speaker\'s statements',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default: 10)',
          },
        },
        required: ['speaker', 'query', 'limit'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'searchByDateRange',
      description: 'Find transcripts within a specific date range. MUST be used for temporal queries like "recent calls", "last week", "this month", "yesterday". Handles all date-based filtering.',
      parameters: {
        type: 'object',
        properties: {
          date_start: {
            type: 'string',
            description: 'Start date in ISO format (YYYY-MM-DD). For "recent": 14 days ago, "last week": 7 days ago, "this month": 1st of current month, "yesterday": single day.',
          },
          date_end: {
            type: 'string',
            description: 'End date in ISO format (YYYY-MM-DD). Typically today\'s date unless user specifies otherwise.',
          },
          query: {
            type: 'string',
            description: 'Optional search query to find specific content within the date range',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default: 10)',
          },
        },
        required: ['date_start', 'date_end', 'query', 'limit'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'searchByCategory',
      description: 'Search within specific call categories (sales, coaching, demo, support, etc.). Use when user specifies a call type or wants to focus on a category.',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description: 'Call category to filter by (e.g., "sales", "coaching", "demo")',
          },
          query: {
            type: 'string',
            description: 'Optional search query within this category',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default: 10)',
          },
        },
        required: ['category', 'query', 'limit'],
      },
    },
  },

  // METADATA-SPECIFIC TOOLS (5)
  {
    type: 'function',
    function: {
      name: 'searchByIntentSignal',
      description: 'Find transcript chunks with specific customer intent signals. Use for analyzing customer behavior patterns. Detects: buying_signal (interest in purchasing), objection (concerns or pushback), question (customer inquiries), concern (worries or hesitations).',
      parameters: {
        type: 'object',
        properties: {
          intent: {
            type: 'string',
            enum: ['buying_signal', 'objection', 'question', 'concern'],
            description: 'The type of intent signal to search for',
          },
          query: {
            type: 'string',
            description: 'Optional refinement query to narrow results within the intent category',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default: 10)',
          },
        },
        required: ['intent', 'query', 'limit'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'searchBySentiment',
      description: 'Find transcripts by emotional tone or sentiment. Use to analyze customer satisfaction, mood, or emotional patterns. Values: positive (happy, satisfied), negative (frustrated, angry), neutral (factual, informational), mixed (combination of sentiments).',
      parameters: {
        type: 'object',
        properties: {
          sentiment: {
            type: 'string',
            enum: ['positive', 'negative', 'neutral', 'mixed'],
            description: 'The sentiment to filter by',
          },
          query: {
            type: 'string',
            description: 'Optional search query within this sentiment category',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default: 10)',
          },
        },
        required: ['sentiment', 'query', 'limit'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'searchByTopics',
      description: 'Find transcripts tagged with specific auto-extracted topics. Use when user asks about themes, subjects, or discussion areas (e.g., "pricing", "features", "onboarding", "integration").',
      parameters: {
        type: 'object',
        properties: {
          topics: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of topics to search for (e.g., ["pricing", "product-fit"])',
          },
          query: {
            type: 'string',
            description: 'Optional search query within these topics',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default: 10)',
          },
        },
        required: ['topics', 'query', 'limit'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'searchByUserTags',
      description: 'Find transcripts with specific user-assigned tags. Use when user references their own organizational tags (e.g., "important", "follow-up", "urgent", "needs-review").',
      parameters: {
        type: 'object',
        properties: {
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of user tags to filter by (e.g., ["important", "followup"])',
          },
          query: {
            type: 'string',
            description: 'Optional search query within tagged content',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default: 10)',
          },
        },
        required: ['tags', 'query', 'limit'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'searchByEntity',
      description: 'Find mentions of specific companies, people, or products in transcripts. Use when user asks about named entities (e.g., "mentions of Acme Corp", "discussions about John Doe", "Product X references").',
      parameters: {
        type: 'object',
        properties: {
          entity_type: {
            type: 'string',
            enum: ['companies', 'people', 'products'],
            description: 'Type of entity to search for',
          },
          entity_name: {
            type: 'string',
            description: 'Name of the entity (e.g., "Acme Corp", "John Doe", "Product X")',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default: 10)',
          },
        },
        required: ['entity_type', 'entity_name', 'limit'],
      },
    },
  },

  // ANALYTICAL TOOLS (3)
  {
    type: 'function',
    function: {
      name: 'getCallDetails',
      description: 'Get complete details about a specific call including title, date, participants, duration, summary, and URL. Use when user references a specific call by recording_id.',
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
      name: 'getCallsList',
      description: 'Get a list of calls matching filter criteria with summary previews. Use for overview queries like "show me all sales calls from last month" or "list calls with Jane".',
      parameters: {
        type: 'object',
        properties: {
          date_start: {
            type: 'string',
            description: 'Start date filter (YYYY-MM-DD)',
          },
          date_end: {
            type: 'string',
            description: 'End date filter (YYYY-MM-DD)',
          },
          category: {
            type: 'string',
            description: 'Category filter',
          },
          speaker: {
            type: 'string',
            description: 'Speaker name or email filter',
          },
          limit: {
            type: 'number',
            description: 'Maximum calls to return (default: 20)',
          },
        },
        required: ['date_start', 'date_end', 'category', 'speaker', 'limit'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getAvailableMetadata',
      description: 'Discover what metadata values are available for filtering (speakers, categories, topics, tags, intent signals, sentiments). Use when user asks "what categories do I have?" or "who are the speakers?" or wants to explore available filters.',
      parameters: {
        type: 'object',
        properties: {
          metadata_type: {
            type: 'string',
            enum: ['speakers', 'categories', 'topics', 'tags', 'intents', 'sentiments'],
            description: 'Type of metadata to retrieve',
          },
        },
        required: ['metadata_type'],
      },
    },
  },

  // ADVANCED TOOLS (2)
  {
    type: 'function',
    function: {
      name: 'advancedSearch',
      description: 'Multi-dimensional search combining multiple filters simultaneously. Use for complex queries like "find objections from sales calls in January where Sarah spoke". Supports all filter types at once.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query text',
          },
          filters: {
            type: 'object',
            properties: {
              speakers: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by speaker names/emails',
              },
              date_start: {
                type: 'string',
                description: 'Start date (YYYY-MM-DD)',
              },
              date_end: {
                type: 'string',
                description: 'End date (YYYY-MM-DD)',
              },
              categories: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by categories',
              },
              topics: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by topics',
              },
              sentiment: {
                type: 'string',
                enum: ['positive', 'negative', 'neutral', 'mixed'],
                description: 'Filter by sentiment',
              },
              intent_signals: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['buying_signal', 'objection', 'question', 'concern'],
                },
                description: 'Filter by intent signals',
              },
              user_tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by user tags',
              },
            },
            required: ['speakers', 'date_start', 'date_end', 'categories', 'topics', 'sentiment', 'intent_signals', 'user_tags'],
          },
          limit: {
            type: 'number',
            description: 'Maximum results (default: 10)',
          },
        },
        required: ['query', 'filters', 'limit'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'compareCalls',
      description: 'Compare 2-5 specific calls side-by-side to identify similarities, differences, or patterns. Use for questions like "compare these calls" or "how do these meetings differ?"',
      parameters: {
        type: 'object',
        properties: {
          recording_ids: {
            type: 'array',
            items: { type: 'number' },
            description: 'Array of 2-5 recording IDs to compare',
            minItems: 2,
            maxItems: 5,
          },
          focus: {
            type: 'string',
            description: 'Optional focus area for comparison (e.g., "objections", "pricing discussion", "customer concerns")',
          },
        },
        required: ['recording_ids', 'focus'],
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
  const { query, limit = 20 } = args;
  console.log(`Searching transcripts: "${query}" (limit: ${limit})`);
  const searchStartTime = Date.now();

  const queryEmbedding = await generateQueryEmbedding(query, openaiApiKey);
  // Fetch more candidates to ensure we have enough after diversity filtering
  // For context attachment flows (where filters are set), fetch even more
  const hasSpecificRecordingFilters = filters?.recording_ids && filters.recording_ids.length > 0;
  const baseCount = hasSpecificRecordingFilters ? 60 : 40;
  const candidateCount = Math.min(limit * 3, baseCount);

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
    // Fallback: Search summaries in fathom_calls when transcript search returns nothing
    // This handles cases where keywords exist in AI-generated summaries but not raw speech
    console.log('No transcript matches, falling back to summary search...');

    const keywords = query.split(/\s+/).filter(word => word.length > 3).slice(0, 5);
    if (keywords.length > 0) {
      let summaryQuery = supabase
        .from('fathom_calls')
        .select('recording_id, title, created_at, summary, recorded_by_name')
        .eq('user_id', user.id)
        .not('summary', 'is', null);

      // Apply session filters if present
      if (filters?.date_start) {
        summaryQuery = summaryQuery.gte('created_at', filters.date_start);
      }
      if (filters?.date_end) {
        summaryQuery = summaryQuery.lte('created_at', filters.date_end);
      }
      if (filters?.recording_ids && filters.recording_ids.length > 0) {
        summaryQuery = summaryQuery.in('recording_id', filters.recording_ids);
      }

      // Use ilike for case-insensitive search on any keyword
      const { data: summaryMatches, error: summaryError } = await summaryQuery
        .or(keywords.map(k => `summary.ilike.%${k}%`).join(','))
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!summaryError && summaryMatches && summaryMatches.length > 0) {
        console.log(`Found ${summaryMatches.length} matches in call summaries`);
        return {
          source: 'summaries',
          message: 'Found matches in call summaries (not raw transcripts)',
          results: summaryMatches.map((call: { recording_id: number; title: string; created_at: string; summary: string; recorded_by_name: string }, i: number) => ({
            index: i + 1,
            recording_id: call.recording_id,
            call_title: call.title,
            call_date: call.created_at,
            recorded_by: call.recorded_by_name,
            summary_excerpt: call.summary.substring(0, 800) + (call.summary.length > 800 ? '...' : ''),
          })),
          total_found: summaryMatches.length,
        };
      }
    }

    return { message: 'I could not find relevant information in your transcripts for this query.' };
  }

  console.log(`Hybrid search returned ${candidates.length} candidates in ${Date.now() - searchStartTime}ms`);

  const reranked = await rerankResults(query, candidates, limit * 2);
  
  // Relaxed diversity filter: allow more chunks per recording (5) to capture full context
  // This is especially important when user "chats with X calls" explicitly
  const diverse = diversityFilter(reranked, 5, limit);

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
    return { message: 'I could not find any calls matching those criteria in your transcripts.' };
  }

  return {
    total_calls: calls.length,
    calls: calls.map((c: {recording_id: number; title: string; created_at: string; recorded_by_name: string; summary: string | null}) => ({
      recording_id: c.recording_id,
      title: c.title,
      date: c.created_at,
      recorded_by: c.recorded_by_name,
      // Provide much more context for broader analysis (1200 chars vs 200)
      summary_preview: c.summary ? c.summary.substring(0, 1200) + (c.summary.length > 1200 ? '...' : '') : 'No summary',
    })),
  };
}

// ============================================
// NEW TOOL EXECUTION HANDLERS
// ============================================

// Helper function for creating hybrid search with metadata filters
async function executeHybridSearch(
  query: string,
  limit: number,
  supabase: SupabaseClient,
  user: User,
  openaiApiKey: string,
  metadataFilters: {
    speakers?: string[];
    date_start?: string;
    date_end?: string;
    categories?: string[];
    topics?: string[];
    sentiment?: string;
    intent_signals?: string[];
    user_tags?: string[];
    recording_ids?: number[];
  } = {}
): Promise<unknown> {
  console.log(`Hybrid search: "${query}" with filters:`, metadataFilters);
  const searchStartTime = Date.now();

  const queryEmbedding = await generateQueryEmbedding(query, openaiApiKey);
  const hasSpecificRecordingFilters = metadataFilters.recording_ids && metadataFilters.recording_ids.length > 0;
  const baseCount = hasSpecificRecordingFilters ? 60 : 40;
  const candidateCount = Math.min(limit * 3, baseCount);

  const { data: candidates, error } = await supabase.rpc('hybrid_search_transcripts', {
    query_text: query,
    query_embedding: queryEmbedding,
    match_count: candidateCount,
    full_text_weight: 1.0,
    semantic_weight: 1.0,
    rrf_k: 60,
    filter_user_id: user.id,
    filter_date_start: metadataFilters.date_start || null,
    filter_date_end: metadataFilters.date_end || null,
    filter_speakers: metadataFilters.speakers || null,
    filter_categories: metadataFilters.categories || null,
    filter_recording_ids: metadataFilters.recording_ids || null,
    filter_topics: metadataFilters.topics || null,
    filter_sentiment: metadataFilters.sentiment || null,
    filter_intent_signals: metadataFilters.intent_signals || null,
    filter_user_tags: metadataFilters.user_tags || null,
  });

  if (error) {
    console.error('Search error:', error);
    return { error: 'Search failed', details: error.message };
  }

  if (!candidates || candidates.length === 0) {
    return { message: 'I could not find relevant information in your transcripts for this query.' };
  }

  console.log(`Hybrid search returned ${candidates.length} candidates in ${Date.now() - searchStartTime}ms`);

  const reranked = await rerankResults(query, candidates, limit * 2);
  const diverse = diversityFilter(reranked, 5, limit);

  console.log(`Search pipeline complete: ${candidates.length} → ${reranked.length} → ${diverse.length} results`);

  return {
    results: diverse.map((r: RerankCandidate, i: number) => ({
      index: i + 1,
      recording_id: r.recording_id,
      call_title: r.call_title,
      call_date: r.call_date,
      speaker: r.speaker_name,
      category: r.call_category,
      topics: r.topics,
      sentiment: r.sentiment,
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

// Renamed from executeSearchTranscripts to match new tool name
async function executeSearchTranscriptsByQuery(
  args: { query: string; limit?: number },
  supabase: SupabaseClient,
  user: User,
  openaiApiKey: string,
  filters?: SessionFilters
): Promise<unknown> {
  const { query, limit = 10 } = args;
  return executeHybridSearch(query, limit, supabase, user, openaiApiKey, {
    date_start: filters?.date_start,
    date_end: filters?.date_end,
    speakers: filters?.speakers,
    categories: filters?.categories,
    recording_ids: filters?.recording_ids,
  });
}

async function executeSearchBySpeaker(
  args: { speaker: string; query?: string; limit?: number },
  supabase: SupabaseClient,
  user: User,
  openaiApiKey: string
): Promise<unknown> {
  const { speaker, query = speaker, limit = 10 } = args;
  return executeHybridSearch(query, limit, supabase, user, openaiApiKey, {
    speakers: [speaker],
  });
}

async function executeSearchByDateRange(
  args: { date_start: string; date_end: string; query?: string; limit?: number },
  supabase: SupabaseClient,
  user: User,
  openaiApiKey: string
): Promise<unknown> {
  const { date_start, date_end, query = '', limit = 10 } = args;
  const searchQuery = query || 'recent discussions';
  return executeHybridSearch(searchQuery, limit, supabase, user, openaiApiKey, {
    date_start,
    date_end,
  });
}

async function executeSearchByCategory(
  args: { category: string; query?: string; limit?: number },
  supabase: SupabaseClient,
  user: User,
  openaiApiKey: string
): Promise<unknown> {
  const { category, query = category, limit = 10 } = args;
  return executeHybridSearch(query, limit, supabase, user, openaiApiKey, {
    categories: [category],
  });
}

async function executeSearchByIntentSignal(
  args: { intent: string; query?: string; limit?: number },
  supabase: SupabaseClient,
  user: User,
  openaiApiKey: string
): Promise<unknown> {
  const { intent, query, limit = 10 } = args;
  const searchQuery = query || intent.replace('_', ' ');
  return executeHybridSearch(searchQuery, limit, supabase, user, openaiApiKey, {
    intent_signals: [intent],
  });
}

async function executeSearchBySentiment(
  args: { sentiment: string; query?: string; limit?: number },
  supabase: SupabaseClient,
  user: User,
  openaiApiKey: string
): Promise<unknown> {
  const { sentiment, query = sentiment, limit = 10 } = args;
  return executeHybridSearch(query, limit, supabase, user, openaiApiKey, {
    sentiment,
  });
}

async function executeSearchByTopics(
  args: { topics: string[]; query?: string; limit?: number },
  supabase: SupabaseClient,
  user: User,
  openaiApiKey: string
): Promise<unknown> {
  const { topics, query, limit = 10 } = args;
  const searchQuery = query || topics.join(' ');
  return executeHybridSearch(searchQuery, limit, supabase, user, openaiApiKey, {
    topics,
  });
}

async function executeSearchByUserTags(
  args: { tags: string[]; query?: string; limit?: number },
  supabase: SupabaseClient,
  user: User,
  openaiApiKey: string
): Promise<unknown> {
  const { tags, query, limit = 10 } = args;
  const searchQuery = query || tags.join(' ');
  return executeHybridSearch(searchQuery, limit, supabase, user, openaiApiKey, {
    user_tags: tags,
  });
}

async function executeSearchByEntity(
  args: { entity_type: string; entity_name: string; limit?: number },
  supabase: SupabaseClient,
  user: User,
  openaiApiKey: string
): Promise<unknown> {
  const { entity_type, entity_name, limit = 10 } = args;
  console.log(`Searching for entity: ${entity_type} - "${entity_name}"`);

  // Search using entity name as query, then filter results by entities JSONB field
  const queryEmbedding = await generateQueryEmbedding(entity_name, openaiApiKey);
  const { data: candidates, error } = await supabase.rpc('hybrid_search_transcripts', {
    query_text: entity_name,
    query_embedding: queryEmbedding,
    match_count: limit * 3,
    full_text_weight: 1.0,
    semantic_weight: 1.0,
    rrf_k: 60,
    filter_user_id: user.id,
  });

  if (error) {
    return { error: 'Entity search failed', details: error.message };
  }

  if (!candidates || candidates.length === 0) {
    return { message: `I could not find any mentions of ${entity_type} "${entity_name}" in your transcripts.` };
  }

  // Filter candidates by entity in JSONB field (post-search filtering)
  const filtered = candidates.filter((c: { entities?: { [key: string]: string[] } }) => {
    if (!c.entities || !c.entities[entity_type]) return false;
    return c.entities[entity_type].some((e: string) =>
      e.toLowerCase().includes(entity_name.toLowerCase())
    );
  });

  if (filtered.length === 0) {
    return { message: `I could not find any mentions of ${entity_type} "${entity_name}" in your transcripts.` };
  }

  const reranked = await rerankResults(entity_name, filtered, limit * 2);
  const diverse = diversityFilter(reranked, 5, limit);

  return {
    results: diverse.map((r: RerankCandidate, i: number) => ({
      index: i + 1,
      recording_id: r.recording_id,
      call_title: r.call_title,
      call_date: r.call_date,
      speaker: r.speaker_name,
      entity_type,
      entity_name,
      text: r.chunk_text,
      relevance: r.rerank_score
        ? Math.round(r.rerank_score * 100) + '%'
        : Math.round(r.rrf_score * 100) + '%',
    })),
    total_found: filtered.length,
    returned: diverse.length,
  };
}

async function executeGetCallsList(
  args: { date_start?: string; date_end?: string; category?: string; speaker?: string; limit?: number },
  supabase: SupabaseClient,
  user: User,
  filters?: SessionFilters
): Promise<unknown> {
  const { date_start, date_end, category, speaker, limit = 20 } = args;
  console.log('Getting calls list with filters:', { date_start, date_end, category, speaker, limit });

  let callsQuery = supabase
    .from('fathom_calls')
    .select('recording_id, title, created_at, summary, recorded_by_name')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  // Apply filters
  if (date_start || filters?.date_start) {
    callsQuery = callsQuery.gte('created_at', date_start || filters?.date_start);
  }
  if (date_end || filters?.date_end) {
    callsQuery = callsQuery.lte('created_at', date_end || filters?.date_end);
  }
  // Category filter removed - column doesn't exist on fathom_calls table

  const { data: calls, error } = await callsQuery.limit(limit);

  if (error) {
    return { error: 'Failed to fetch calls', details: error.message };
  }

  if (!calls || calls.length === 0) {
    return { message: 'I could not find any calls matching those criteria in your transcripts.' };
  }

  // If speaker filter is provided, filter by speaker in transcript_chunks
  let filteredCalls = calls;
  if (speaker) {
    const { data: speakerChunks } = await supabase
      .from('transcript_chunks')
      .select('recording_id')
      .eq('user_id', user.id)
      .or(`speaker_name.ilike.%${speaker}%,speaker_email.ilike.%${speaker}%`);

    if (speakerChunks) {
      const speakerRecordingIds = new Set(speakerChunks.map((c: { recording_id: number }) => c.recording_id));
      filteredCalls = calls.filter((c: { recording_id: number }) => speakerRecordingIds.has(c.recording_id));
    }
  }

  return {
    total_calls: filteredCalls.length,
    calls: filteredCalls.map((c: { recording_id: number; title: string; created_at: string; recorded_by_name: string; summary: string | null }) => ({
      recording_id: c.recording_id,
      title: c.title,
      date: c.created_at,
      recorded_by: c.recorded_by_name,
      summary_preview: c.summary ? c.summary.substring(0, 400) + (c.summary.length > 400 ? '...' : '') : 'No summary',
    })),
  };
}

async function executeGetAvailableMetadata(
  args: { metadata_type: string },
  supabase: SupabaseClient,
  user: User
): Promise<unknown> {
  const { metadata_type } = args;
  console.log(`Getting available metadata: ${metadata_type}`);

  const { data, error } = await supabase.rpc('get_available_metadata', {
    p_user_id: user.id,
    p_metadata_type: metadata_type,
  });

  if (error) {
    return { error: 'Failed to retrieve metadata', details: error.message };
  }

  return {
    metadata_type,
    values: data || [],
  };
}

async function executeAdvancedSearch(
  args: {
    query?: string;
    filters?: {
      speakers?: string[];
      date_start?: string;
      date_end?: string;
      categories?: string[];
      topics?: string[];
      sentiment?: string;
      intent_signals?: string[];
      user_tags?: string[];
    };
    limit?: number;
  },
  supabase: SupabaseClient,
  user: User,
  openaiApiKey: string
): Promise<unknown> {
  const { query = '', filters = {}, limit = 10 } = args;
  const searchQuery = query || 'relevant content';

  console.log('Advanced search with combined filters:', filters);

  return executeHybridSearch(searchQuery, limit, supabase, user, openaiApiKey, {
    speakers: filters.speakers,
    date_start: filters.date_start,
    date_end: filters.date_end,
    categories: filters.categories,
    topics: filters.topics,
    sentiment: filters.sentiment,
    intent_signals: filters.intent_signals,
    user_tags: filters.user_tags,
  });
}

async function executeCompareCalls(
  args: { recording_ids: number[]; focus?: string },
  supabase: SupabaseClient,
  user: User,
  openaiApiKey: string
): Promise<unknown> {
  const { recording_ids, focus } = args;

  if (recording_ids.length < 2 || recording_ids.length > 5) {
    return { error: 'Must provide between 2 and 5 recording IDs to compare' };
  }

  console.log(`Comparing ${recording_ids.length} calls${focus ? ` (focus: ${focus})` : ''}`);

  // Fetch call details for all recordings
  const { data: calls, error: callsError } = await supabase
    .from('fathom_calls')
    .select('recording_id, title, created_at, summary, recorded_by_name')
    .in('recording_id', recording_ids)
    .eq('user_id', user.id);

  if (callsError || !calls) {
    return { error: 'Failed to fetch call details', details: callsError?.message };
  }

  if (calls.length !== recording_ids.length) {
    return { error: 'Some recordings not found or not accessible' };
  }

  // If focus is specified, search for relevant chunks in each call
  let focusedContent = null;
  if (focus) {
    const queryEmbedding = await generateQueryEmbedding(focus, openaiApiKey);
    const { data: chunks, error: chunksError } = await supabase.rpc('hybrid_search_transcripts', {
      query_text: focus,
      query_embedding: queryEmbedding,
      match_count: 30,
      full_text_weight: 1.0,
      semantic_weight: 1.0,
      rrf_k: 60,
      filter_user_id: user.id,
      filter_recording_ids: recording_ids,
    });

    if (!chunksError && chunks && chunks.length > 0) {
      // Group chunks by recording_id
      const chunksByCall: { [key: number]: RerankCandidate[] } = {};
      chunks.forEach((c: RerankCandidate) => {
        if (!chunksByCall[c.recording_id]) {
          chunksByCall[c.recording_id] = [];
        }
        chunksByCall[c.recording_id].push(c);
      });

      focusedContent = Object.entries(chunksByCall).map(([recId, callChunks]) => ({
        recording_id: Number(recId),
        focus_area: focus,
        relevant_chunks: callChunks.slice(0, 5).map((c: RerankCandidate) => c.chunk_text),
      }));
    }
  }

  return {
    comparison_type: focus ? 'focused' : 'general',
    focus_area: focus,
    calls: calls.map((c: { recording_id: number; title: string; created_at: string; recorded_by_name: string; summary: string | null }) => ({
      recording_id: c.recording_id,
      title: c.title,
      date: c.created_at,
      recorded_by: c.recorded_by_name,
      summary: c.summary ? c.summary.substring(0, 800) : 'No summary',
    })),
    focused_content: focusedContent,
  };
}

// ============================================
// TOOL EXECUTION ROUTER
// ============================================

async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  supabase: SupabaseClient,
  user: User,
  openaiApiKey: string,
  filters?: SessionFilters
): Promise<unknown> {
  switch (toolName) {
    // Core Search Tools
    case 'searchTranscriptsByQuery':
      return executeSearchTranscriptsByQuery(
        args as { query: string; limit?: number },
        supabase,
        user,
        openaiApiKey,
        filters
      );
    case 'searchBySpeaker':
      return executeSearchBySpeaker(
        args as { speaker: string; query?: string; limit?: number },
        supabase,
        user,
        openaiApiKey
      );
    case 'searchByDateRange':
      return executeSearchByDateRange(
        args as { date_start: string; date_end: string; query?: string; limit?: number },
        supabase,
        user,
        openaiApiKey
      );
    case 'searchByCategory':
      return executeSearchByCategory(
        args as { category: string; query?: string; limit?: number },
        supabase,
        user,
        openaiApiKey
      );

    // Metadata-Specific Tools
    case 'searchByIntentSignal':
      return executeSearchByIntentSignal(
        args as { intent: string; query?: string; limit?: number },
        supabase,
        user,
        openaiApiKey
      );
    case 'searchBySentiment':
      return executeSearchBySentiment(
        args as { sentiment: string; query?: string; limit?: number },
        supabase,
        user,
        openaiApiKey
      );
    case 'searchByTopics':
      return executeSearchByTopics(
        args as { topics: string[]; query?: string; limit?: number },
        supabase,
        user,
        openaiApiKey
      );
    case 'searchByUserTags':
      return executeSearchByUserTags(
        args as { tags: string[]; query?: string; limit?: number },
        supabase,
        user,
        openaiApiKey
      );
    case 'searchByEntity':
      return executeSearchByEntity(
        args as { entity_type: string; entity_name: string; limit?: number },
        supabase,
        user,
        openaiApiKey
      );

    // Analytical Tools
    case 'getCallDetails':
      return executeGetCallDetails(
        args as { recording_id: number },
        supabase,
        user
      );
    case 'getCallsList':
      return executeGetCallsList(
        args as { date_start?: string; date_end?: string; category?: string; speaker?: string; limit?: number },
        supabase,
        user,
        filters
      );
    case 'getAvailableMetadata':
      return executeGetAvailableMetadata(
        args as { metadata_type: string },
        supabase,
        user
      );

    // Advanced Tools
    case 'advancedSearch':
      return executeAdvancedSearch(
        args as {
          query?: string;
          filters?: {
            speakers?: string[];
            date_start?: string;
            date_end?: string;
            categories?: string[];
            topics?: string[];
            sentiment?: string;
            intent_signals?: string[];
            user_tags?: string[];
          };
          limit?: number;
        },
        supabase,
        user,
        openaiApiKey
      );
    case 'compareCalls':
      return executeCompareCalls(
        args as { recording_ids: number[]; focus?: string },
        supabase,
        user,
        openaiApiKey
      );

    // Legacy tool names (for backwards compatibility during transition)
    case 'searchTranscripts':
      return executeSearchTranscriptsByQuery(
        args as { query: string; limit?: number },
        supabase,
        user,
        openaiApiKey,
        filters
      );
    case 'summarizeCalls':
      return executeGetCallsList(
        args as { date_start?: string; date_end?: string; category?: string; limit?: number },
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
      'HTTP-Referer': 'https://app.callvaultai.com',
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
    const { messages, sessionId, model: requestedModel, filters: requestFilters } = body;

    // Debug: Log incoming request structure
    console.log('=== CHAT-STREAM REQUEST ===');
    console.log('SessionId:', sessionId);
    console.log('Model:', requestedModel);
    console.log('Filters from request:', JSON.stringify(requestFilters));
    console.log('Messages count:', messages?.length);
    console.log('Messages:', JSON.stringify(messages, null, 2));

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Messages array required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get filters - prefer request filters, fall back to session filters
    let filters: SessionFilters | undefined;

    // First, try to use filters from the request body (sent by DefaultChatTransport)
    if (requestFilters) {
      filters = {
        date_start: requestFilters.date_start,
        date_end: requestFilters.date_end,
        speakers: requestFilters.speakers,
        categories: requestFilters.categories,
        recording_ids: requestFilters.recording_ids,
      };
      console.log('Using filters from request body');
    }
    // Fall back to session filters if sessionId provided and no request filters
    else if (sessionId) {
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
        console.log('Using filters from session');
      }
    }

    console.log('Final filters:', JSON.stringify(filters));

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

AVAILABLE TOOLS (14 specialized tools for metadata-driven search):

**Core Search Tools:**
- searchTranscriptsByQuery: General semantic search for broad queries
- searchBySpeaker: Find what specific people said
- searchByDateRange: Search within date ranges (use for temporal queries)
- searchByCategory: Filter by call type (sales, coaching, demo, etc.)

**Metadata-Specific Tools:**
- searchByIntentSignal: Find buying signals, objections, questions, or concerns
- searchBySentiment: Find positive, negative, neutral, or mixed sentiment
- searchByTopics: Search auto-extracted topics (pricing, features, etc.)
- searchByUserTags: Search user-assigned tags (important, followup, etc.)
- searchByEntity: Find mentions of companies, people, or products

**Analytical Tools:**
- getCallDetails: Get complete info about a specific call
- getCallsList: List calls with filters and summaries
- getAvailableMetadata: Discover available speakers, categories, topics, tags, intents, sentiments

**Advanced Tools:**
- advancedSearch: Combine multiple filters simultaneously
- compareCalls: Compare 2-5 calls side-by-side

TOOL SELECTION GUIDE:

1. **Temporal Queries** ("recent", "last week", "this month"):
   - Use searchByDateRange with date_start/date_end
   - Today: ${todayStr}
   - Recent (14 days): ${new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
   - Last week (7 days): ${new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
   - This month: ${new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]}

2. **Speaker Queries** ("what did John say", "Sarah's comments"):
   - Use searchBySpeaker with speaker name/email

3. **Intent/Behavior Queries** ("objections", "buying signals", "concerns"):
   - Use searchByIntentSignal with: buying_signal, objection, question, or concern

4. **Sentiment Queries** ("happy customers", "frustrated", "negative feedback"):
   - Use searchBySentiment with: positive, negative, neutral, or mixed

5. **Topic Queries** ("pricing discussions", "feature requests"):
   - Use searchByTopics with topic array

6. **Category Queries** ("sales calls", "demos"):
   - Use searchByCategory

7. **Complex Multi-Filter Queries** ("objections in sales calls last month"):
   - Use advancedSearch with combined filters

8. **Discovery Queries** ("what speakers do I have", "what categories"):
   - Use getAvailableMetadata

9. **Comparison Queries** ("compare these 3 calls"):
   - Use compareCalls with recording_ids array

10. **General Search** (simple keyword queries):
    - Use searchTranscriptsByQuery

RESPONSE GUIDELINES:
- Always cite sources (call title + date)
- Be concise but thorough
- Never fabricate information
- If no data found, say so clearly
${filterContext}

Important: Only access transcripts belonging to the current user.`;

    // Convert UI messages to OpenAI format
    const openaiMessages = convertUIMessagesToOpenAI(messages);

    // Setup streaming response following AI SDK v5 Data Stream Protocol
    // See: https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol
    const encoder = new TextEncoder();
    const messageId = crypto.randomUUID();

    const stream = new ReadableStream({
      async start(controller) {
        // Send SSE-formatted data following AI SDK v5 protocol exactly
        const send = (data: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          // AI SDK v5: Message Start Part
          send({ type: 'start', messageId });

          let continueLoop = true;
          let step = 0;
          const maxSteps = 5;

          while (continueLoop && step < maxSteps) {
            step++;
            // AI SDK v5: Start Step Part
            send({ type: 'start-step' });

            let textId = '';
            let textStarted = false;
            let accumulatedText = ''; // Track accumulated text for the assistant message
            const pendingToolCalls: Array<{ id: string; name: string; arguments: string }> = [];

            // Track active tool calls by index for streaming
            const activeToolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map();

            // Stream from OpenRouter (supports 300+ models)
            for await (const event of streamOpenRouterChat(openrouterApiKey, selectedModel, openaiMessages, systemPrompt)) {
              if (event.type === 'text') {
                const textDelta = event.data as string;
                if (!textStarted) {
                  textId = crypto.randomUUID();
                  // AI SDK v5: Text Start Part
                  send({ type: 'text-start', id: textId });
                  textStarted = true;
                }
                // AI SDK v5: Text Delta Part
                send({ type: 'text-delta', id: textId, delta: textDelta });
                accumulatedText += textDelta;
              } else if (event.type === 'tool-call-start') {
                const { index, id } = event.data as { index: number; id: string };
                activeToolCalls.set(index, { id, name: '', arguments: '' });
                // Don't send tool-input-start yet, wait for tool name
              } else if (event.type === 'tool-call-name') {
                const { index, name } = event.data as { index: number; name: string };
                const tc = activeToolCalls.get(index);
                if (tc) {
                  tc.name = name;
                  // AI SDK v5: Tool Input Start Part
                  send({ type: 'tool-input-start', toolCallId: tc.id, toolName: name });
                }
              } else if (event.type === 'tool-call-args-delta') {
                const { index, delta } = event.data as { index: number; delta: string };
                const tc = activeToolCalls.get(index);
                if (tc) {
                  tc.arguments += delta;
                  // AI SDK v5: Tool Input Delta Part
                  send({ type: 'tool-input-delta', toolCallId: tc.id, inputTextDelta: delta });
                }
              } else if (event.type === 'tool-call-complete') {
                // End text block before tool calls
                if (textStarted) {
                  // AI SDK v5: Text End Part
                  send({ type: 'text-end', id: textId });
                  textStarted = false;
                }
                const tc = event.data as { id: string; name: string; arguments: string };
                pendingToolCalls.push(tc);

                // Parse input safely
                let parsedInput = {};
                try {
                  parsedInput = JSON.parse(tc.arguments);
                } catch {
                  console.warn('Failed to parse tool arguments:', tc.arguments);
                }

                // AI SDK v5: Tool Input Available Part
                send({
                  type: 'tool-input-available',
                  toolCallId: tc.id,
                  toolName: tc.name,
                  input: parsedInput,
                });
              } else if (event.type === 'finish') {
                if (textStarted) {
                  // AI SDK v5: Text End Part
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
              // Add assistant message with tool calls to conversation history
              openaiMessages.push({
                role: 'assistant',
                content: accumulatedText || null,
                tool_calls: pendingToolCalls.map(tc => ({
                  id: tc.id,
                  type: 'function' as const,
                  function: { name: tc.name, arguments: tc.arguments },
                })),
              });

              // Execute each tool and add results
              for (const tc of pendingToolCalls) {
                console.log(`Executing tool: ${tc.name}`);
                let args = {};
                try {
                  args = JSON.parse(tc.arguments);
                } catch {
                  console.warn('Failed to parse tool arguments for execution:', tc.arguments);
                }
                const result = await executeTool(tc.name, args, supabase, user, openaiApiKey, filters);

                // AI SDK v5: Tool Output Available Part
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
              // No tool calls means we're done (either finished with text or errored)
              continueLoop = false;
            }

            // AI SDK v5: Finish Step Part
            send({ type: 'finish-step' });
          }

          // AI SDK v5: Finish Message Part
          send({ type: 'finish' });
          // AI SDK v5: Stream Termination
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
          // AI SDK v5: Error Part
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
