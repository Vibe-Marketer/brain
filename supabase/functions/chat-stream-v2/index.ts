// chat-stream-v2: AI SDK native chat backend with all 14 RAG tools
// Replaces the hand-rolled OpenRouter SSE implementation in chat-stream/index.ts
// Uses Vercel AI SDK streamText() + tool() + toUIMessageStreamResponse()
// with shared search pipeline modules for hybrid search, re-ranking, and diversity filtering.
//
// Date: 2026-01-28
// Phase: 02-chat-foundation (plan 05)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { streamText, tool, convertToModelMessages } from 'https://esm.sh/ai@5.0.102';
import { createOpenRouter } from 'https://esm.sh/@openrouter/ai-sdk-provider@1.2.8';
import { z } from 'https://esm.sh/zod@3.23.8';
import { getCorsHeaders } from '../_shared/cors.ts';
import { executeHybridSearch, diversityFilter } from '../_shared/search-pipeline.ts';
import { generateQueryEmbedding } from '../_shared/embeddings.ts';

import type { SearchFilters } from '../_shared/search-pipeline.ts';

// ============================================
// TYPES
// ============================================

type SupabaseClient = ReturnType<typeof createClient>;

interface RequestBody {
  messages: Array<{
    id: string;
    role: 'user' | 'assistant' | 'system';
    content?: string;
    parts?: Array<{ type: string; text?: string; [key: string]: unknown }>;
    [key: string]: unknown;
  }>;
  model?: string;
  filters?: {
    date_start?: string;
    date_end?: string;
    speakers?: string[];
    categories?: string[];
    recording_ids?: number[];
  };
  sessionId?: string;
}

interface SessionFilters {
  date_start?: string;
  date_end?: string;
  speakers?: string[];
  categories?: string[];
  recording_ids?: number[];
}

// ============================================
// OPENROUTER PROVIDER SETUP
// ============================================

function createOpenRouterProvider(apiKey: string) {
  return createOpenRouter({
    apiKey,
    headers: {
      'HTTP-Referer': 'https://app.callvaultai.com',
      'X-Title': 'CallVault',
    },
  });
}

// ============================================
// SYSTEM PROMPT BUILDER
// ============================================

function buildSystemPrompt(filters?: SessionFilters): string {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const recentDate = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const lastWeekDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const thisMonthDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];

  // Build filter context if filters are active
  let filterContext = '';
  if (filters) {
    const parts: string[] = [];
    if (filters.date_start) parts.push(`Date from: ${filters.date_start}`);
    if (filters.date_end) parts.push(`Date to: ${filters.date_end}`);
    if (filters.speakers?.length) parts.push(`Speakers: ${filters.speakers.join(', ')}`);
    if (filters.categories?.length) parts.push(`Categories: ${filters.categories.join(', ')}`);
    if (filters.recording_ids?.length) parts.push(`Specific calls: ${filters.recording_ids.length} selected`);
    if (parts.length > 0) {
      filterContext = `\n\nACTIVE FILTERS:\nThe user has active filters applied. Respect these when searching:\n${parts.join('\n')}`;
    }
  }

  return `You are CallVault AI, an expert meeting intelligence assistant that helps users analyze their call recordings and transcripts. You have access to 14 specialized RAG tools to search, filter, and analyze meeting data.

AVAILABLE TOOLS:

**Core Search Tools (semantic + keyword hybrid search):**
1. searchTranscriptsByQuery — General semantic and keyword search. Use for broad queries about topics, content, or keywords. Best for: "What did they say about X?" or "Find mentions of Y".
2. searchBySpeaker — Find what specific people said. Use when the user asks about a particular speaker. Accepts speaker name or email.
3. searchByDateRange — Search within a specific date range. MUST use for temporal queries like "recent calls", "last week", "this month", "yesterday".
4. searchByCategory — Search within specific call categories (sales, coaching, demo, support). Use when user specifies a call type.

**Metadata-Specific Search Tools:**
5. searchByIntentSignal — Find transcript chunks with specific customer intent signals: buying_signal, objection, question, concern. Use for analyzing customer behavior patterns.
6. searchBySentiment — Find transcripts by emotional tone: positive, negative, neutral, mixed. Use to analyze customer satisfaction or mood.
7. searchByTopics — Find transcripts tagged with specific auto-extracted topics (pricing, features, onboarding, etc.).
8. searchByUserTags — Find transcripts with specific user-assigned tags (important, follow-up, urgent, etc.).
9. searchByEntity — Find mentions of specific companies, people, or products. Uses JSONB entity post-filtering.

**Analytical Tools (direct database queries, no search pipeline):**
10. getCallDetails — Get complete details about a specific call by recording_id. Returns title, date, duration, speakers, summary, URL.
11. getCallsList — Get a paginated list of calls with optional filters. Good for overview queries like "show me all sales calls from last month".
12. getAvailableMetadata — Discover what metadata values are available (speakers, categories, topics, tags). Use when user asks "what categories do I have?" or wants to explore filters.

**Advanced Tools:**
13. advancedSearch — Multi-dimensional search combining multiple filters simultaneously. Use for complex queries like "find objections from sales calls in January where Sarah spoke".
14. compareCalls — Compare 2-5 specific calls side-by-side. Use for "compare these calls" or "how do these meetings differ?"

QUERY EXPANSION GUIDANCE:
When answering a question, use MULTIPLE search tools with semantically diverse queries to ensure comprehensive results. Prefer over-searching to under-searching — more tools = more comprehensive answers.

Examples of query expansion:
- "What objections came up?" → Use searchTranscriptsByQuery('customer objections and pushback'), searchByIntentSignal(intent='objection'), AND searchBySentiment(sentiment='negative')
- "What did we discuss about pricing?" → Use searchTranscriptsByQuery('pricing discussions and cost'), searchByTopics(topics=['pricing']), AND searchTranscriptsByQuery('budget and payment terms')
- "How did the demo go last week?" → Use searchByDateRange(date_start, date_end, query='demo feedback'), searchBySentiment(sentiment='positive'), AND searchByCategory(category='demo')
- "What's the status with Acme Corp?" → Use searchByEntity(entity_type='companies', entity_name='Acme Corp'), searchTranscriptsByQuery('Acme Corp updates and progress'), AND getCallsList with relevant date filters

Fire 3-5 parallel searches with different query formulations for broad questions. For narrow, specific questions, 1-2 targeted searches may suffice.

TEMPORAL REFERENCE:
Today's date: ${todayStr}
- "Recent" = last 14 days (from ${recentDate})
- "Last week" = last 7 days (from ${lastWeekDate})
- "This month" = since ${thisMonthDate}

CITATION INSTRUCTIONS:
- Always cite your sources using numbered markers like [1], [2], [3] in your response text
- Each unique source call gets one number. Assign numbers sequentially by order of first mention
- Place the citation marker immediately after the claim it supports, e.g. "Revenue grew 30% last quarter [1]"
- If multiple results come from the same call (same recording_id), use the same citation number
- At the END of your response, include a sources list in this exact format:
  [1] Call Title (Speaker, Date)
  [2] Another Call Title (Speaker, Date)
- The recording_id, call_title, call_date, and speaker are available in every tool result — use them for the sources list
- Always include the sources list even if there is only one source

ERROR DISCLOSURE:
If a tool fails or returns no results, acknowledge the gap honestly: "I couldn't find results for [X], but based on [Y]..." — never fabricate information or pretend you have data you don't.

RESPONSE GUIDELINES:
- Be concise but thorough
- Synthesize insights from multiple tool results into a coherent answer
- Never fabricate information — only use data from tool results
- If no data found across all searches, say so clearly
- Only access transcripts belonging to the current user
${filterContext}`;
}

// ============================================
// SEARCH TOOL HELPERS
// ============================================

/**
 * Merge session filters with tool-specific search filters.
 * Session filters (from request body) provide the base context;
 * tool-specific filters override or extend them.
 */
function mergeFilters(
  sessionFilters: SessionFilters | undefined,
  toolFilters: Partial<SearchFilters>,
): SearchFilters {
  return {
    date_start: toolFilters.date_start || sessionFilters?.date_start,
    date_end: toolFilters.date_end || sessionFilters?.date_end,
    speakers: toolFilters.speakers || sessionFilters?.speakers,
    categories: toolFilters.categories || sessionFilters?.categories,
    recording_ids: toolFilters.recording_ids || sessionFilters?.recording_ids,
    topics: toolFilters.topics,
    sentiment: toolFilters.sentiment,
    intent_signals: toolFilters.intent_signals,
    user_tags: toolFilters.user_tags,
  };
}

// ============================================
// TOOL DEFINITIONS FACTORY
// ============================================

/**
 * Create all 14 RAG tools with closure access to request context.
 * Tools are defined inside the handler so execute functions can access
 * supabase client, user, API keys, and session filters.
 */
function createTools(
  supabase: SupabaseClient,
  userId: string,
  openaiApiKey: string,
  hfApiKey: string,
  sessionFilters?: SessionFilters,
) {
  // Shared helper for search tools (1-9): call executeHybridSearch with merged filters
  async function search(query: string, limit: number, toolFilters: Partial<SearchFilters> = {}) {
    const filters = mergeFilters(sessionFilters, toolFilters);
    try {
      return await executeHybridSearch({
        query,
        limit,
        supabase,
        userId,
        openaiApiKey,
        hfApiKey,
        filters,
      });
    } catch (error) {
      console.error(`[chat-stream-v2] Search error:`, error);
      return { error: true, message: error instanceof Error ? error.message : 'Search failed' };
    }
  }

  return {
    // ================================================================
    // CATEGORY A — Search Pipeline Tools (1-9)
    // All share the pattern: accept parameters → call search() → return results
    // ================================================================

    // Tool 1: searchTranscriptsByQuery
    searchTranscriptsByQuery: tool({
      description: 'General semantic and keyword search through meeting transcripts. Use for broad queries about topics, content, or keywords.',
      parameters: z.object({
        query: z.string().describe('The search query to find relevant transcript chunks'),
        limit: z.number().optional().describe('Maximum number of results to return (default: 10)'),
      }),
      execute: async ({ query, limit = 10 }) => {
        console.log(`[chat-stream-v2] searchTranscriptsByQuery: "${query}" (limit: ${limit})`);
        return search(query, limit);
      },
    }),

    // Tool 2: searchBySpeaker
    searchBySpeaker: tool({
      description: 'Find what specific people said in meetings. Use when the user asks about a particular speaker or wants to filter by who spoke.',
      parameters: z.object({
        query: z.string().describe('Search query to find within this speaker\'s statements'),
        speaker: z.string().describe('Speaker name or email to filter by'),
        limit: z.number().optional().describe('Maximum number of results to return (default: 10)'),
      }),
      execute: async ({ query, speaker, limit = 10 }) => {
        console.log(`[chat-stream-v2] searchBySpeaker: "${query}" speaker="${speaker}" (limit: ${limit})`);
        return search(query, limit, { speakers: [speaker] });
      },
    }),

    // Tool 3: searchByDateRange
    searchByDateRange: tool({
      description: 'Find transcripts within a specific date range. MUST be used for temporal queries like "recent calls", "last week", "this month", "yesterday".',
      parameters: z.object({
        query: z.string().optional().describe('Optional search query within the date range'),
        date_from: z.string().optional().describe('Start date in ISO format (YYYY-MM-DD)'),
        date_to: z.string().optional().describe('End date in ISO format (YYYY-MM-DD)'),
        limit: z.number().optional().describe('Maximum number of results to return (default: 10)'),
      }),
      execute: async ({ query, date_from, date_to, limit = 10 }) => {
        const searchQuery = query || 'recent discussions';
        console.log(`[chat-stream-v2] searchByDateRange: "${searchQuery}" from=${date_from} to=${date_to}`);
        return search(searchQuery, limit, {
          date_start: date_from,
          date_end: date_to,
        });
      },
    }),

    // Tool 4: searchByCategory
    searchByCategory: tool({
      description: 'Search within specific call categories (sales, coaching, demo, support, etc.). Use when user specifies a call type.',
      parameters: z.object({
        query: z.string().describe('Search query within this category'),
        category: z.string().describe('Call category to filter by (e.g., "sales", "coaching", "demo")'),
        limit: z.number().optional().describe('Maximum number of results to return (default: 10)'),
      }),
      execute: async ({ query, category, limit = 10 }) => {
        console.log(`[chat-stream-v2] searchByCategory: "${query}" category="${category}"`);
        return search(query, limit, { categories: [category] });
      },
    }),

    // Tool 5: searchByIntentSignal
    searchByIntentSignal: tool({
      description: 'Find transcript chunks with specific customer intent signals. Detects: buying_signal (interest in purchasing), objection (concerns or pushback), question (customer inquiries), concern (worries or hesitations).',
      parameters: z.object({
        query: z.string().optional().describe('Optional refinement query to narrow results'),
        intent_type: z.enum(['buying_signal', 'objection', 'question', 'concern']).describe('The type of intent signal to search for'),
        limit: z.number().optional().describe('Maximum number of results to return (default: 10)'),
      }),
      execute: async ({ query, intent_type, limit = 10 }) => {
        const searchQuery = query || intent_type.replace('_', ' ');
        console.log(`[chat-stream-v2] searchByIntentSignal: "${searchQuery}" intent="${intent_type}"`);
        return search(searchQuery, limit, { intent_signals: [intent_type] });
      },
    }),

    // Tool 6: searchBySentiment
    searchBySentiment: tool({
      description: 'Find transcripts by emotional tone or sentiment. Values: positive (happy, satisfied), negative (frustrated, angry), neutral (factual), mixed (combination).',
      parameters: z.object({
        query: z.string().optional().describe('Optional search query within this sentiment category'),
        sentiment: z.enum(['positive', 'negative', 'neutral', 'mixed']).describe('The sentiment to filter by'),
        limit: z.number().optional().describe('Maximum number of results to return (default: 10)'),
      }),
      execute: async ({ query, sentiment, limit = 10 }) => {
        const searchQuery = query || sentiment;
        console.log(`[chat-stream-v2] searchBySentiment: "${searchQuery}" sentiment="${sentiment}"`);
        return search(searchQuery, limit, { sentiment });
      },
    }),

    // Tool 7: searchByTopics
    searchByTopics: tool({
      description: 'Find transcripts tagged with specific auto-extracted topics. Use when user asks about themes or subjects (e.g., "pricing", "features", "onboarding").',
      parameters: z.object({
        query: z.string().optional().describe('Optional search query within these topics'),
        topics: z.array(z.string()).describe('List of topics to search for (e.g., ["pricing", "product-fit"])'),
        limit: z.number().optional().describe('Maximum number of results to return (default: 10)'),
      }),
      execute: async ({ query, topics, limit = 10 }) => {
        const searchQuery = query || topics.join(' ');
        console.log(`[chat-stream-v2] searchByTopics: "${searchQuery}" topics=${JSON.stringify(topics)}`);
        return search(searchQuery, limit, { topics });
      },
    }),

    // Tool 8: searchByUserTags
    searchByUserTags: tool({
      description: 'Find transcripts with specific user-assigned tags. Use when user references their own organizational tags (e.g., "important", "follow-up", "urgent").',
      parameters: z.object({
        query: z.string().optional().describe('Optional search query within tagged content'),
        tags: z.array(z.string()).describe('List of user tags to filter by (e.g., ["important", "followup"])'),
        limit: z.number().optional().describe('Maximum number of results to return (default: 10)'),
      }),
      execute: async ({ query, tags, limit = 10 }) => {
        const searchQuery = query || tags.join(' ');
        console.log(`[chat-stream-v2] searchByUserTags: "${searchQuery}" tags=${JSON.stringify(tags)}`);
        return search(searchQuery, limit, { user_tags: tags });
      },
    }),

    // Tool 9: searchByEntity
    searchByEntity: tool({
      description: 'Find mentions of specific companies, people, or products in transcripts. Uses JSONB entity post-filtering after semantic search.',
      parameters: z.object({
        query: z.string().optional().describe('Optional search query (defaults to entity name)'),
        entity_type: z.enum(['companies', 'people', 'products']).optional().describe('Type of entity to search for'),
        entity_name: z.string().describe('Name of the entity (e.g., "Acme Corp", "John Doe", "Product X")'),
        limit: z.number().optional().describe('Maximum number of results to return (default: 10)'),
      }),
      execute: async ({ query, entity_type, entity_name, limit = 10 }) => {
        console.log(`[chat-stream-v2] searchByEntity: type="${entity_type}" name="${entity_name}"`);

        try {
          // Search using entity name as query, then filter results by entities JSONB field
          const queryEmbedding = await generateQueryEmbedding(query || entity_name, openaiApiKey);
          const { data: candidates, error } = await supabase.rpc('hybrid_search_transcripts', {
            query_text: query || entity_name,
            query_embedding: queryEmbedding,
            match_count: limit * 3,
            full_text_weight: 1.0,
            semantic_weight: 1.0,
            rrf_k: 60,
            filter_user_id: userId,
            filter_date_start: sessionFilters?.date_start || null,
            filter_date_end: sessionFilters?.date_end || null,
            filter_speakers: sessionFilters?.speakers || null,
            filter_categories: sessionFilters?.categories || null,
            filter_recording_ids: sessionFilters?.recording_ids || null,
          });

          if (error) {
            return { error: true, message: `Entity search failed: ${error.message}` };
          }

          if (!candidates || candidates.length === 0) {
            return { message: `No mentions of ${entity_type ? entity_type + ' ' : ''}"${entity_name}" found in your transcripts.` };
          }

          // Post-filter by entity in JSONB field
          let filtered = candidates;
          if (entity_type) {
            filtered = candidates.filter((c: { entities?: { [key: string]: string[] } }) => {
              if (!c.entities || !c.entities[entity_type]) return false;
              return c.entities[entity_type].some((e: string) =>
                e.toLowerCase().includes(entity_name.toLowerCase())
              );
            });
          } else {
            // If no entity_type specified, search all entity categories
            filtered = candidates.filter((c: { entities?: { [key: string]: string[] } }) => {
              if (!c.entities) return false;
              return Object.values(c.entities).some((arr: string[]) =>
                arr.some((e: string) => e.toLowerCase().includes(entity_name.toLowerCase()))
              );
            });
          }

          if (filtered.length === 0) {
            return { message: `No mentions of ${entity_type ? entity_type + ' ' : ''}"${entity_name}" found in your transcripts.` };
          }

          // Apply diversity filter
          // deno-lint-ignore no-explicit-any
          const diverse = diversityFilter(filtered as any[], 2, limit);

          return {
            // deno-lint-ignore no-explicit-any
            results: diverse.map((r: any, i: number) => ({
              index: i + 1,
              recording_id: r.recording_id,
              call_title: r.call_title,
              call_date: r.call_date,
              speaker: r.speaker_name,
              entity_type: entity_type || 'any',
              entity_name,
              text: r.chunk_text,
              relevance: Math.round((r.rrf_score || 0) * 100) + '%',
            })),
            total_found: filtered.length,
            returned: diverse.length,
          };
        } catch (error) {
          console.error('[chat-stream-v2] Entity search error:', error);
          return { error: true, message: error instanceof Error ? error.message : 'Entity search failed' };
        }
      },
    }),

    // ================================================================
    // CATEGORY B — Analytical Tools (10-14)
    // Direct Supabase queries, no search pipeline
    // ================================================================

    // Tool 10: getCallDetails
    getCallDetails: tool({
      description: 'Get complete details about a specific call including title, date, participants, duration, summary, and URL. Use when user references a specific call by recording_id.',
      parameters: z.object({
        recording_id: z.string().describe('The recording ID of the call to get details for'),
      }),
      execute: async ({ recording_id }) => {
        console.log(`[chat-stream-v2] getCallDetails: ${recording_id}`);

        const numericId = parseInt(recording_id, 10);
        if (isNaN(numericId)) {
          return { error: true, message: 'Invalid recording_id — must be a number' };
        }

        try {
          const { data: call, error: callError } = await supabase
            .from('fathom_calls')
            .select('recording_id, title, created_at, recording_start_time, recording_end_time, recorded_by_name, summary, url')
            .eq('recording_id', numericId)
            .eq('user_id', userId)
            .single();

          if (callError || !call) {
            return { error: true, message: 'Call not found or not accessible' };
          }

          // Get speakers from transcripts
          const { data: speakers } = await supabase
            .from('fathom_transcripts')
            .select('speaker_name, speaker_email')
            .eq('recording_id', numericId)
            .eq('user_id', userId)
            .eq('is_deleted', false);

          const uniqueSpeakers = [
            ...new Set(
              speakers?.map((s: { speaker_name: string | null }) => s.speaker_name).filter(Boolean)
            ),
          ];

          let duration = 'Unknown';
          if (call.recording_start_time && call.recording_end_time) {
            const mins = Math.round(
              (new Date(call.recording_end_time).getTime() -
                new Date(call.recording_start_time).getTime()) /
                60000
            );
            duration = `${mins} minutes`;
          }

          return {
            recording_id: call.recording_id,
            title: call.title,
            date: call.created_at,
            duration,
            recorded_by: call.recorded_by_name,
            participants: uniqueSpeakers,
            summary: call.summary || 'No summary available',
            url: call.url,
          };
        } catch (error) {
          console.error('[chat-stream-v2] getCallDetails error:', error);
          return { error: true, message: error instanceof Error ? error.message : 'Failed to get call details' };
        }
      },
    }),

    // Tool 11: getCallsList
    getCallsList: tool({
      description: 'Get a list of calls matching filter criteria with summary previews. Use for overview queries like "show me all sales calls from last month" or "list calls with Jane".',
      parameters: z.object({
        limit: z.number().optional().describe('Maximum calls to return (default: 20)'),
        offset: z.number().optional().describe('Number of calls to skip for pagination'),
        category: z.string().optional().describe('Category filter'),
        date_from: z.string().optional().describe('Start date filter (YYYY-MM-DD)'),
        date_to: z.string().optional().describe('End date filter (YYYY-MM-DD)'),
      }),
      execute: async ({ limit = 20, offset = 0, category, date_from, date_to }) => {
        console.log(`[chat-stream-v2] getCallsList: limit=${limit} offset=${offset} category=${category}`);

        try {
          let callsQuery = supabase
            .from('fathom_calls')
            .select('recording_id, title, created_at, summary, recorded_by_name')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

          // Apply filters (tool args override session filters)
          const dateStart = date_from || sessionFilters?.date_start;
          const dateEnd = date_to || sessionFilters?.date_end;
          if (dateStart) callsQuery = callsQuery.gte('created_at', dateStart);
          if (dateEnd) callsQuery = callsQuery.lte('created_at', dateEnd);

          // Apply pagination
          callsQuery = callsQuery.range(offset, offset + limit - 1);

          const { data: calls, error } = await callsQuery;

          if (error) {
            return { error: true, message: `Failed to fetch calls: ${error.message}` };
          }

          if (!calls || calls.length === 0) {
            return { message: 'No calls found matching those criteria.' };
          }

          return {
            total_calls: calls.length,
            calls: calls.map((c: {
              recording_id: number;
              title: string;
              created_at: string;
              recorded_by_name: string;
              summary: string | null;
            }) => ({
              recording_id: c.recording_id,
              title: c.title,
              date: c.created_at,
              recorded_by: c.recorded_by_name,
              summary_preview: c.summary
                ? c.summary.substring(0, 400) + (c.summary.length > 400 ? '...' : '')
                : 'No summary',
            })),
          };
        } catch (error) {
          console.error('[chat-stream-v2] getCallsList error:', error);
          return { error: true, message: error instanceof Error ? error.message : 'Failed to list calls' };
        }
      },
    }),

    // Tool 12: getAvailableMetadata
    getAvailableMetadata: tool({
      description: 'Discover what metadata values are available for filtering (speakers, categories, topics, tags). Use when user asks "what categories do I have?" or wants to explore available filters.',
      parameters: z.object({
        metadata_type: z.enum(['speakers', 'categories', 'topics', 'tags']).describe('Type of metadata to retrieve'),
      }),
      execute: async ({ metadata_type }) => {
        console.log(`[chat-stream-v2] getAvailableMetadata: ${metadata_type}`);

        try {
          const { data, error } = await supabase.rpc('get_available_metadata', {
            p_user_id: userId,
            p_metadata_type: metadata_type,
          });

          if (error) {
            return { error: true, message: `Failed to retrieve metadata: ${error.message}` };
          }

          return {
            metadata_type,
            values: data || [],
          };
        } catch (error) {
          console.error('[chat-stream-v2] getAvailableMetadata error:', error);
          return { error: true, message: error instanceof Error ? error.message : 'Failed to get metadata' };
        }
      },
    }),

    // Tool 13: advancedSearch
    advancedSearch: tool({
      description: 'Multi-dimensional search combining multiple filters simultaneously. Use for complex queries like "find objections from sales calls in January where Sarah spoke".',
      parameters: z.object({
        query: z.string().optional().describe('Search query text'),
        speaker: z.string().optional().describe('Filter by speaker name/email'),
        category: z.string().optional().describe('Filter by category'),
        date_from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
        date_to: z.string().optional().describe('End date (YYYY-MM-DD)'),
        sentiment: z.string().optional().describe('Filter by sentiment (positive, negative, neutral, mixed)'),
        intent: z.string().optional().describe('Filter by intent signal (buying_signal, objection, question, concern)'),
        tags: z.array(z.string()).optional().describe('Filter by user tags'),
        limit: z.number().optional().describe('Maximum results (default: 10)'),
      }),
      execute: async ({ query, speaker, category, date_from, date_to, sentiment, intent, tags, limit = 10 }) => {
        const searchQuery = query || 'relevant content';
        console.log(`[chat-stream-v2] advancedSearch: "${searchQuery}" with multiple filters`);

        const toolFilters: Partial<SearchFilters> = {};
        if (speaker) toolFilters.speakers = [speaker];
        if (category) toolFilters.categories = [category];
        if (date_from) toolFilters.date_start = date_from;
        if (date_to) toolFilters.date_end = date_to;
        if (sentiment) toolFilters.sentiment = sentiment;
        if (intent) toolFilters.intent_signals = [intent];
        if (tags) toolFilters.user_tags = tags;

        return search(searchQuery, limit, toolFilters);
      },
    }),

    // Tool 14: compareCalls
    compareCalls: tool({
      description: 'Compare 2-5 specific calls side-by-side to identify similarities, differences, or patterns. Use for questions like "compare these calls" or "how do these meetings differ?"',
      parameters: z.object({
        recording_ids: z.array(z.string()).min(2).max(5).describe('Array of 2-5 recording IDs to compare'),
        focus: z.string().optional().describe('Optional focus area for comparison (e.g., "objections", "pricing discussion")'),
      }),
      execute: async ({ recording_ids, focus }) => {
        console.log(`[chat-stream-v2] compareCalls: ${recording_ids.length} calls${focus ? ` (focus: ${focus})` : ''}`);

        try {
          // Parse recording_ids to numbers
          const numericIds = recording_ids.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
          if (numericIds.length < 2) {
            return { error: true, message: 'Must provide at least 2 valid recording IDs to compare' };
          }

          // Fetch call details for all recordings
          const { data: calls, error: callsError } = await supabase
            .from('fathom_calls')
            .select('recording_id, title, created_at, summary, recorded_by_name')
            .in('recording_id', numericIds)
            .eq('user_id', userId);

          if (callsError || !calls) {
            return { error: true, message: `Failed to fetch call details: ${callsError?.message}` };
          }

          if (calls.length < 2) {
            return { error: true, message: 'Some recordings not found or not accessible. Need at least 2 valid calls.' };
          }

          // If focus is specified, search for relevant chunks in each call
          let focusedContent: Array<{ recording_id: number; focus_area: string; relevant_chunks: string[] }> | null = null;
          if (focus) {
            try {
              const queryEmbedding = await generateQueryEmbedding(focus, openaiApiKey);
              const { data: chunks, error: chunksError } = await supabase.rpc('hybrid_search_transcripts', {
                query_text: focus,
                query_embedding: queryEmbedding,
                match_count: 30,
                full_text_weight: 1.0,
                semantic_weight: 1.0,
                rrf_k: 60,
                filter_user_id: userId,
                filter_recording_ids: numericIds,
              });

              if (!chunksError && chunks && chunks.length > 0) {
                // Group chunks by recording_id
                const chunksByCall: { [key: number]: Array<{ chunk_text: string; recording_id: number }> } = {};
                chunks.forEach((c: { chunk_text: string; recording_id: number }) => {
                  if (!chunksByCall[c.recording_id]) {
                    chunksByCall[c.recording_id] = [];
                  }
                  chunksByCall[c.recording_id].push(c);
                });

                focusedContent = Object.entries(chunksByCall).map(([recId, callChunks]) => ({
                  recording_id: Number(recId),
                  focus_area: focus,
                  relevant_chunks: callChunks.slice(0, 5).map((c: { chunk_text: string }) => c.chunk_text),
                }));
              }
            } catch (focusError) {
              console.error('[chat-stream-v2] compareCalls focus search error:', focusError);
              // Continue without focused content — non-fatal
            }
          }

          return {
            comparison_type: focus ? 'focused' : 'general',
            focus_area: focus || null,
            calls: calls.map((c: {
              recording_id: number;
              title: string;
              created_at: string;
              recorded_by_name: string;
              summary: string | null;
            }) => ({
              recording_id: c.recording_id,
              title: c.title,
              date: c.created_at,
              recorded_by: c.recorded_by_name,
              summary: c.summary
                ? c.summary.substring(0, 800) + (c.summary.length > 800 ? '...' : '')
                : 'No summary',
            })),
            focused_content: focusedContent,
          };
        } catch (error) {
          console.error('[chat-stream-v2] compareCalls error:', error);
          return { error: true, message: error instanceof Error ? error.message : 'Failed to compare calls' };
        }
      },
    }),
  };
}

// ============================================
// MAIN HANDLER
// ============================================

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ---- Environment ----
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openrouterApiKey = Deno.env.get('OPENROUTER_API_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const hfApiKey = Deno.env.get('HUGGINGFACE_API_KEY') || '';

    if (!openrouterApiKey) {
      return new Response(
        JSON.stringify({ error: 'OPENROUTER_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY not configured (needed for embeddings)' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ---- Auth: Verify Supabase JWT ----
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ---- Parse Request Body ----
    const body: RequestBody = await req.json();
    const { messages, model: requestedModel, filters: requestFilters, sessionId } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Messages array required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ---- Determine session filters ----
    let sessionFilters: SessionFilters | undefined;

    if (requestFilters) {
      sessionFilters = {
        date_start: requestFilters.date_start,
        date_end: requestFilters.date_end,
        speakers: requestFilters.speakers,
        categories: requestFilters.categories,
        recording_ids: requestFilters.recording_ids,
      };
    } else if (sessionId) {
      // Fall back to session-stored filters
      const { data: session } = await supabase
        .from('chat_sessions')
        .select('filter_date_start, filter_date_end, filter_speakers, filter_categories, filter_recording_ids')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single();

      if (session) {
        sessionFilters = {
          date_start: session.filter_date_start,
          date_end: session.filter_date_end,
          speakers: session.filter_speakers,
          categories: session.filter_categories,
          recording_ids: session.filter_recording_ids,
        };
      }
    }

    const selectedModel = requestedModel || 'openai/gpt-4o-mini';
    console.log(`[chat-stream-v2] User: ${user.id}, Model: ${selectedModel}, Messages: ${messages.length}, Filters: ${JSON.stringify(sessionFilters)}`);

    // ---- Build system prompt and tools ----
    const openrouter = createOpenRouterProvider(openrouterApiKey);
    const systemPrompt = buildSystemPrompt(sessionFilters);
    const allTools = createTools(supabase, user.id, openaiApiKey, hfApiKey, sessionFilters);

    // ---- Convert messages ----
    const convertedMessages = convertToModelMessages(messages);

    // ---- Stream response ----
    const result = streamText({
      model: openrouter(selectedModel),
      system: systemPrompt,
      messages: convertedMessages,
      tools: allTools,
      toolChoice: 'auto',
      maxSteps: 5,
      onError: ({ error }) => {
        console.error('[chat-stream-v2] Stream error:', error);
      },
    });

    return result.toUIMessageStreamResponse({
      headers: corsHeaders,
    });

  } catch (error) {
    console.error('[chat-stream-v2] Handler error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
