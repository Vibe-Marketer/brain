// chat-stream-v2: AI SDK native chat backend with all 14 RAG tools
// Replaces the hand-rolled OpenRouter SSE implementation in chat-stream/index.ts
// Uses Vercel AI SDK streamText() + tool() + toUIMessageStreamResponse()
// with shared search pipeline modules for hybrid search, re-ranking, and diversity filtering.
//
// Date: 2026-01-28
// Phase: 02-chat-foundation (plan 05)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { streamText, tool, convertToModelMessages } from 'https://esm.sh/ai@6.0.66';
import { createOpenRouter } from 'https://esm.sh/@openrouter/ai-sdk-provider@2.1.1';
import { z } from 'https://esm.sh/zod@3.23.8';
import { getCorsHeaders } from '../_shared/cors.ts';
import { executeHybridSearch, diversityFilter } from '../_shared/search-pipeline.ts';
import { generateQueryEmbedding } from '../_shared/embeddings.ts';
import { logUsage, estimateTokenCount } from '../_shared/usage-tracker.ts';
import { startChatTrace, flushLangfuse, type ChatTraceResult } from '../_shared/langfuse.ts';

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
    folder_ids?: string[];
  };
  sessionFilters?: {
    bank_id?: string | null;
    vault_id?: string | null;
  };
  sessionId?: string;
}

interface BusinessProfileContext {
  company_name: string | null;
  industry: string | null;
  primary_product_service: string | null;
  target_audience: string | null;
  target_audience_pain_points: string | null;
  offer_name: string | null;
  offer_promise: string | null;
  brand_voice: string | null;
  prohibited_terms: string | null;
}

// Bank/Vault context for multi-tenant scoping
interface BankVaultContext {
  bank_id?: string;
  vault_id?: string | null;  // null = all vaults in bank
}

interface SessionFilters {
  date_start?: string;
  date_end?: string;
  speakers?: string[];
  categories?: string[];
  recording_ids?: number[];
  folder_ids?: string[];
  bank_id?: string;
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
// BUSINESS PROFILE FETCHER
// ============================================

/**
 * Fetch the user's default business profile for context injection.
 * Returns null if no profile exists (graceful fallback).
 */
async function fetchBusinessProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<BusinessProfileContext | null> {
  try {
    const { data, error } = await supabase
      .from('business_profiles')
      .select('company_name, industry, primary_product_service, target_audience, target_audience_pain_points, offer_name, offer_promise, brand_voice, prohibited_terms')
      .eq('user_id', userId)
      .eq('is_default', true)
      .maybeSingle();

    if (error) {
      console.warn('[chat-stream-v2] Failed to fetch business profile:', error.message);
      return null;
    }

    return data as BusinessProfileContext | null;
  } catch (err) {
    console.warn('[chat-stream-v2] Error fetching business profile:', err);
    return null;
  }
}

// ============================================
// SYSTEM PROMPT BUILDER
// ============================================

function buildSystemPrompt(
  filters?: SessionFilters,
  businessProfile?: BusinessProfileContext | null,
): string {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const recentDate = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const lastWeekDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const thisMonthDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];

  // Build business context if profile exists
  let businessContext = '';
  if (businessProfile) {
    const profileParts: string[] = [];
    if (businessProfile.company_name) profileParts.push(`Company: ${businessProfile.company_name}`);
    if (businessProfile.industry) profileParts.push(`Industry: ${businessProfile.industry}`);
    if (businessProfile.primary_product_service) profileParts.push(`Product/Service: ${businessProfile.primary_product_service}`);
    if (businessProfile.target_audience) profileParts.push(`Target Audience: ${businessProfile.target_audience}`);
    if (businessProfile.target_audience_pain_points) profileParts.push(`Audience Pain Points: ${businessProfile.target_audience_pain_points}`);
    if (businessProfile.offer_name) profileParts.push(`Main Offer: ${businessProfile.offer_name}`);
    if (businessProfile.offer_promise) profileParts.push(`Value Promise: ${businessProfile.offer_promise}`);
    if (businessProfile.brand_voice) profileParts.push(`Brand Voice: ${businessProfile.brand_voice}`);
    if (businessProfile.prohibited_terms) profileParts.push(`Avoid Using: ${businessProfile.prohibited_terms}`);
    
    if (profileParts.length > 0) {
      businessContext = `\n\nUSER BUSINESS CONTEXT:\nUse this context to provide more relevant, personalized insights:\n${profileParts.join('\n')}`;
    }
  }

  // Build filter context if filters are active
  let filterContext = '';
  if (filters) {
    const parts: string[] = [];
    if (filters.date_start) parts.push(`Date from: ${filters.date_start}`);
    if (filters.date_end) parts.push(`Date to: ${filters.date_end}`);
    if (filters.speakers?.length) parts.push(`Speakers: ${filters.speakers.join(', ')}`);
    if (filters.categories?.length) parts.push(`Categories: ${filters.categories.join(', ')}`);
    if (filters.recording_ids?.length) parts.push(`Specific calls: ${filters.recording_ids.length} selected`);
    if (filters.folder_ids?.length) parts.push(`Folders: ${filters.folder_ids.length} folder(s) selected - searches are scoped to calls within these folders`);
    if (parts.length > 0) {
      filterContext = `\n\nACTIVE FILTERS:\nThe user has active filters applied. Respect these when searching:\n${parts.join('\n')}`;
    }
  }

  return `You are CallVault AI, an expert meeting intelligence assistant that helps users analyze their call recordings and transcripts. You have access to 14 specialized RAG tools to search, filter, and analyze meeting data.
${businessContext}

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
10. getCallDetails — Get complete details about a specific call. IMPORTANT: You must use an actual recording_id from your search results, never a made-up number. Returns title, date, duration, speakers, summary, URL. Set include_transcript=true for YouTube imports or when the user asks about a specific call's content. YouTube imports always include the full transcript automatically since search tools cannot find YouTube content.
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

RECORDING ID RULES (CRITICAL):
- Every search result includes a recording_id field — this is the unique identifier for that call
- When you need call details, you MUST use the recording_id from your search results
- NEVER invent, guess, or use placeholder recording_ids like 1, 2, 3
- If you want details about a call mentioned in search results, extract its recording_id from those results
- Example flow:
  1. User asks "Tell me about my call with John"
  2. You call searchBySpeaker(query='meeting discussion', speaker='John')
  3. Results include: { recording_id: 847291, call_title: "Sales Call with John" }
  4. To get full details, call getCallDetails(recording_id='847291') — NOT getCallDetails(recording_id='1')
- If no search results exist yet, search first before trying to get call details

TEMPORAL REFERENCE:
Today's date: ${todayStr}
- "Recent" = last 14 days (from ${recentDate})
- "Last week" = last 7 days (from ${lastWeekDate})
- "This month" = since ${thisMonthDate}

VAULT ATTRIBUTION:
- Each search result may include a vault_name field indicating which vault the content comes from
- When displaying results from multiple vaults, mention which vault the content comes from
- Use format: "From [Vault Name]: ..." when attributing sources across vaults
- This helps users understand which knowledge container each result comes from
- In single-vault mode, vault attribution is still present for consistency

CITATION INSTRUCTIONS:
- Always cite your sources using numbered markers like [1], [2], [3] in your response text
- Each unique source call gets one number. Assign numbers sequentially by order of first mention
- Place the citation marker immediately after the claim it supports, e.g. "Revenue grew 30% last quarter [1]"
- If multiple results come from the same call (same recording_id), use the same citation number
- At the END of your response, include a sources list in this exact format:
  [1] Call Title (Speaker, Date) [Vault Name]
  [2] Another Call Title (Speaker, Date) [Vault Name]
- The recording_id, call_title, call_date, speaker, and vault_name are available in every tool result — use them for the sources list
- If vault_name is null (pre-migration data), omit the vault badge from that source
- Always include the sources list even if there is only one source

VIEW MEETING LINKS:
- When you want to add a "View" link for a specific call, use markdown format: [View](share_url)
- ALWAYS use the share_url field from the tool results — this is the PUBLIC shareable link
- The share_url is included in search results, getCallDetails, and getCallsList responses
- NEVER construct or guess URLs — always use the exact share_url from the data
- If no share_url is available for a call, do not include a View link for that call
- The frontend will render these as styled pill buttons that open in a new tab

YOUTUBE IMPORTS:
- YouTube videos imported by users have source_platform='youtube' in the database
- YouTube content does NOT have chunked transcripts in fathom_transcripts, so search tools (1-9) will NOT find YouTube content
- To access YouTube video content, use getCallDetails with the recording_id — the full transcript is automatically included for YouTube calls
- When a user's message contains context like [Context: @[Video Title](recording:12345)], extract the recording_id and immediately call getCallDetails to get the video's transcript
- For YouTube content, you can answer questions directly from the transcript returned by getCallDetails — no need to use search tools

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
 * Resolve folder IDs to recording IDs by querying folder_assignments.
 * Returns the intersection of folder recordings with any existing recording filter.
 */
async function resolveFolderFilter(
  supabase: SupabaseClient,
  userId: string,
  folderIds: string[],
  existingRecordingIds?: number[],
): Promise<number[] | undefined> {
  if (!folderIds || folderIds.length === 0) {
    return existingRecordingIds;
  }

  // Get all recording IDs assigned to any of the specified folders
  const { data: assignments, error } = await supabase
    .from('folder_assignments')
    .select('call_recording_id')
    .in('folder_id', folderIds)
    .eq('user_id', userId);

  if (error) {
    console.error('[chat-stream-v2] Error resolving folder filter:', error);
    return existingRecordingIds;
  }

  const rawIds: number[] = (assignments || []).map(
    (a: { call_recording_id: number }) => a.call_recording_id
  );
  const folderRecordingIds: number[] = Array.from(new Set(rawIds));

  if (folderRecordingIds.length === 0) {
    // Folders exist but have no calls - return empty array to match nothing
    return [];
  }

  // Intersect with existing recording filter if present
  if (existingRecordingIds && existingRecordingIds.length > 0) {
    const intersection = folderRecordingIds.filter(id => existingRecordingIds.includes(id));
    return intersection.length > 0 ? intersection : [];
  }

  return folderRecordingIds;
}

/**
 * Merge session filters with tool-specific search filters.
 * Session filters (from request body) provide the base context;
 * tool-specific filters override or extend them.
 * Note: folder_ids are resolved to recording_ids before this function is called.
 * Bank/vault context is always applied from the request-level context.
 */
function mergeFilters(
  sessionFilters: SessionFilters | undefined,
  toolFilters: Partial<SearchFilters>,
  bankId?: string,
  vaultId?: string | null,
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
    // Always apply bank/vault context from request
    bank_id: bankId,
    vault_id: vaultId,
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
  bankId?: string,
  vaultId?: string | null,
) {
  // Log bank/vault context for debugging (plan 02 will add actual filtering)
  console.log(`[chat-stream-v2] Tools context - Bank: ${bankId || 'none'}, Vault: ${vaultId === null ? 'all' : vaultId || 'none'}`);
  // ================================================================
  // TOOL EXECUTION LOGGING WRAPPER
  // Logs what tools return to catch "silent failures" where tools
  // appear to work but return empty/useless results
  // ================================================================
  function logToolResult(toolName: string, input: unknown, result: unknown): void {
    const resultSummary = summarizeResult(result);
    console.log(`[TOOL RESULT] ${toolName}:`, JSON.stringify({
      input: truncateForLog(input),
      ...resultSummary,
    }));
  }

  function summarizeResult(result: unknown): { status: string; resultCount?: number; hasError?: boolean; message?: string } {
    if (!result || typeof result !== 'object') {
      return { status: 'empty_or_invalid', hasError: true };
    }

    const r = result as Record<string, unknown>;

    // Check for explicit errors
    if (r.error === true || r.error) {
      return { status: 'error', hasError: true, message: String(r.message || r.error) };
    }

    // Check for "no results" messages
    if (r.message && !r.results) {
      return { status: 'no_results', message: String(r.message) };
    }

    // Check for actual results
    if (Array.isArray(r.results)) {
      return { 
        status: r.results.length > 0 ? 'success' : 'empty_results',
        resultCount: r.results.length,
      };
    }

    // For single-item returns (like getCallDetails)
    if (r.recording_id || r.title || r.calls) {
      const callCount = Array.isArray(r.calls) ? r.calls.length : 1;
      return { status: 'success', resultCount: callCount };
    }

    // For metadata returns
    if (r.values || r.metadata_type) {
      const count = Array.isArray(r.values) ? r.values.length : 0;
      return { status: 'success', resultCount: count };
    }

    return { status: 'unknown_format' };
  }

  function truncateForLog(obj: unknown): unknown {
    if (typeof obj === 'string') return obj.length > 100 ? obj.slice(0, 100) + '...' : obj;
    if (typeof obj !== 'object' || obj === null) return obj;
    const truncated: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof v === 'string' && v.length > 100) {
        truncated[k] = v.slice(0, 100) + '...';
      } else {
        truncated[k] = v;
      }
    }
    return truncated;
  }

  // Shared helper for search tools (1-9): call executeHybridSearch with merged filters
  async function search(toolName: string, query: string, limit: number, toolFilters: Partial<SearchFilters> = {}) {
    const filters = mergeFilters(sessionFilters, toolFilters, bankId, vaultId);
    const startTime = Date.now();
    try {
      const result = await executeHybridSearch({
        query,
        limit,
        supabase,
        userId,
        openaiApiKey,
        hfApiKey,
        filters,
      });
      const elapsed = Date.now() - startTime;
      console.log(`[chat-stream-v2] ${toolName} completed in ${elapsed}ms`);
      logToolResult(toolName, { query, limit, filters }, result);
      return result;
    } catch (error) {
      console.error(`[chat-stream-v2] ${toolName} FAILED:`, error);
      const errorResult = { error: true, message: error instanceof Error ? error.message : 'Search failed' };
      logToolResult(toolName, { query, limit, filters }, errorResult);
      return errorResult;
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
      inputSchema: z.object({
        query: z.string().describe('The search query to find relevant transcript chunks'),
        limit: z.number().optional().describe('Maximum number of results to return (default: 10)'),
      }),
      execute: async ({ query, limit = 10 }) => {
        return search('searchTranscriptsByQuery', query, limit);
      },
    }),

    // Tool 2: searchBySpeaker
    searchBySpeaker: tool({
      description: 'Find what specific people said in meetings. Use when the user asks about a particular speaker or wants to filter by who spoke.',
      inputSchema: z.object({
        query: z.string().describe('Search query to find within this speaker\'s statements'),
        speaker: z.string().describe('Speaker name or email to filter by'),
        limit: z.number().optional().describe('Maximum number of results to return (default: 10)'),
      }),
      execute: async ({ query, speaker, limit = 10 }) => {
        return search('searchBySpeaker', query, limit, { speakers: [speaker] });
      },
    }),

    // Tool 3: searchByDateRange
    searchByDateRange: tool({
      description: 'Find transcripts within a specific date range. MUST be used for temporal queries like "recent calls", "last week", "this month", "yesterday".',
      inputSchema: z.object({
        query: z.string().optional().describe('Optional search query within the date range'),
        date_from: z.string().optional().describe('Start date in ISO format (YYYY-MM-DD)'),
        date_to: z.string().optional().describe('End date in ISO format (YYYY-MM-DD)'),
        limit: z.number().optional().describe('Maximum number of results to return (default: 10)'),
      }),
      execute: async ({ query, date_from, date_to, limit = 10 }) => {
        const searchQuery = query || 'recent discussions';
        return search('searchByDateRange', searchQuery, limit, {
          date_start: date_from,
          date_end: date_to,
        });
      },
    }),

    // Tool 4: searchByCategory
    searchByCategory: tool({
      description: 'Search within specific call categories (sales, coaching, demo, support, etc.). Use when user specifies a call type.',
      inputSchema: z.object({
        query: z.string().describe('Search query within this category'),
        category: z.string().describe('Call category to filter by (e.g., "sales", "coaching", "demo")'),
        limit: z.number().optional().describe('Maximum number of results to return (default: 10)'),
      }),
      execute: async ({ query, category, limit = 10 }) => {
        return search('searchByCategory', query, limit, { categories: [category] });
      },
    }),

    // Tool 5: searchByIntentSignal
    searchByIntentSignal: tool({
      description: 'Find transcript chunks with specific customer intent signals. Detects: buying_signal (interest in purchasing), objection (concerns or pushback), question (customer inquiries), concern (worries or hesitations).',
      inputSchema: z.object({
        query: z.string().optional().describe('Optional refinement query to narrow results'),
        intent_type: z.enum(['buying_signal', 'objection', 'question', 'concern']).describe('The type of intent signal to search for'),
        limit: z.number().optional().describe('Maximum number of results to return (default: 10)'),
      }),
      execute: async ({ query, intent_type, limit = 10 }) => {
        const searchQuery = query || intent_type.replace('_', ' ');
        return search('searchByIntentSignal', searchQuery, limit, { intent_signals: [intent_type] });
      },
    }),

    // Tool 6: searchBySentiment
    searchBySentiment: tool({
      description: 'Find transcripts by emotional tone or sentiment. Values: positive (happy, satisfied), negative (frustrated, angry), neutral (factual), mixed (combination).',
      inputSchema: z.object({
        query: z.string().optional().describe('Optional search query within this sentiment category'),
        sentiment: z.enum(['positive', 'negative', 'neutral', 'mixed']).describe('The sentiment to filter by'),
        limit: z.number().optional().describe('Maximum number of results to return (default: 10)'),
      }),
      execute: async ({ query, sentiment, limit = 10 }) => {
        const searchQuery = query || sentiment;
        return search('searchBySentiment', searchQuery, limit, { sentiment });
      },
    }),

    // Tool 7: searchByTopics
    searchByTopics: tool({
      description: 'Find transcripts tagged with specific auto-extracted topics. Use when user asks about themes or subjects (e.g., "pricing", "features", "onboarding").',
      inputSchema: z.object({
        query: z.string().optional().describe('Optional search query within these topics'),
        topics: z.array(z.string()).describe('List of topics to search for (e.g., ["pricing", "product-fit"])'),
        limit: z.number().optional().describe('Maximum number of results to return (default: 10)'),
      }),
      execute: async ({ query, topics, limit = 10 }) => {
        const searchQuery = query || topics.join(' ');
        return search('searchByTopics', searchQuery, limit, { topics });
      },
    }),

    // Tool 8: searchByUserTags
    searchByUserTags: tool({
      description: 'Find transcripts with specific user-assigned tags. Use when user references their own organizational tags (e.g., "important", "follow-up", "urgent").',
      inputSchema: z.object({
        query: z.string().optional().describe('Optional search query within tagged content'),
        tags: z.array(z.string()).describe('List of user tags to filter by (e.g., ["important", "followup"])'),
        limit: z.number().optional().describe('Maximum number of results to return (default: 10)'),
      }),
      execute: async ({ query, tags, limit = 10 }) => {
        const searchQuery = query || tags.join(' ');
        return search('searchByUserTags', searchQuery, limit, { user_tags: tags });
      },
    }),

    // Tool 9: searchByEntity
    searchByEntity: tool({
      description: 'Find mentions of specific companies, people, or products in transcripts. Uses JSONB entity post-filtering after semantic search.',
      inputSchema: z.object({
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
          
          // Use scoped search when bank/vault context is present
          const useScopedSearch = !!(bankId || vaultId);
          const rpcFunction = useScopedSearch ? 'hybrid_search_transcripts_scoped' : 'hybrid_search_transcripts';
          const rpcParams: Record<string, unknown> = {
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
          };
          
          if (useScopedSearch) {
            rpcParams.filter_bank_id = bankId || null;
            rpcParams.filter_vault_id = vaultId || null;
          } else {
            rpcParams.filter_bank_id = sessionFilters?.bank_id || null;
          }
          
          const { data: candidates, error } = await supabase.rpc(rpcFunction, rpcParams);

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
              vault_id: r.vault_id || null,
              vault_name: r.vault_name || null,
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
      description: 'Get complete details about a specific call including title, date, participants, duration, summary, URL, and transcript. Use when user references a specific call by recording_id. For YouTube imports, also returns the full transcript since there are no chunked transcripts to search.',
      inputSchema: z.object({
        recording_id: z.string().describe('The recording ID of the call to get details for'),
        include_transcript: z.boolean().optional().describe('Whether to include full transcript in response (default: false, set true for YouTube imports or when user asks about specific call content)'),
      }),
      execute: async ({ recording_id, include_transcript = false }) => {
        console.log(`[chat-stream-v2] getCallDetails: ${recording_id} (include_transcript: ${include_transcript})`);

        const numericId = parseInt(recording_id, 10);
        if (isNaN(numericId)) {
          return { error: true, message: 'Invalid recording_id — must be a number' };
        }

        try {
          // If vault context is present, verify the recording is in an accessible vault
          if (bankId || vaultId) {
            const accessibleVaultIds: string[] = [];
            
            if (vaultId) {
              // Specific vault - verify membership
              const { data: membership } = await supabase
                .from('vault_memberships')
                .select('id')
                .eq('vault_id', vaultId)
                .eq('user_id', userId)
                .maybeSingle();
              if (membership) accessibleVaultIds.push(vaultId);
            } else if (bankId) {
              // Bank-level - get all vault memberships in this bank
              const { data: memberships } = await supabase
                .from('vault_memberships')
                .select('vault_id, vaults!inner(bank_id)')
                .eq('user_id', userId)
                .eq('vaults.bank_id', bankId);
              if (memberships) {
                memberships.forEach((m: { vault_id: string }) => accessibleVaultIds.push(m.vault_id));
              }
            }
            
            if (accessibleVaultIds.length > 0) {
              // Check if recording is in any accessible vault via legacy_recording_id
              const { data: entry } = await supabase
                .from('vault_entries')
                .select('id, recordings!inner(legacy_recording_id)')
                .in('vault_id', accessibleVaultIds)
                .eq('recordings.legacy_recording_id', numericId)
                .maybeSingle();
              
              if (!entry) {
                return { error: true, message: 'Call not found or not accessible in current vault context' };
              }
            } else {
              return { error: true, message: 'No vault access in current context' };
            }
          }

          // Select additional fields for YouTube imports
          const selectFields = 'recording_id, title, created_at, recording_start_time, recording_end_time, recorded_by_name, summary, url, share_url, source_platform, full_transcript, metadata';
          const { data: call, error: callError } = await supabase
            .from('fathom_calls')
            .select(selectFields)
            .eq('recording_id', numericId)
            .eq('user_id', userId)
            .single();

          if (callError || !call) {
            return { error: true, message: 'Call not found or not accessible' };
          }

          const isYouTubeCall = call.source_platform === 'youtube';

          // Get speakers from transcripts (only for non-YouTube calls)
          let uniqueSpeakers: string[] = [];
          if (!isYouTubeCall) {
            const { data: speakers } = await supabase
              .from('fathom_transcripts')
              .select('speaker_name, speaker_email')
              .eq('recording_id', numericId)
              .eq('user_id', userId)
              .eq('is_deleted', false);

            uniqueSpeakers = [
              ...new Set(
                speakers?.map((s: { speaker_name: string | null }) => s.speaker_name).filter(Boolean)
              ),
            ] as string[];
          }

          let duration = 'Unknown';
          if (call.recording_start_time && call.recording_end_time) {
            const mins = Math.round(
              (new Date(call.recording_end_time).getTime() -
                new Date(call.recording_start_time).getTime()) /
                60000
            );
            duration = `${mins} minutes`;
          }

          // For YouTube imports, extract duration from metadata
          if (isYouTubeCall && duration === 'Unknown') {
            const meta = call.metadata as Record<string, unknown> | null;
            const ytDuration = meta?.youtube_duration as string | undefined;
            if (ytDuration) {
              const match = ytDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
              if (match) {
                const h = parseInt(match[1] || '0', 10);
                const m = parseInt(match[2] || '0', 10);
                const s = parseInt(match[3] || '0', 10);
                const totalMins = Math.round(h * 60 + m + s / 60);
                duration = `${totalMins} minutes`;
              }
            }
          }

          // Build response
          const result: Record<string, unknown> = {
            recording_id: call.recording_id,
            title: call.title,
            date: call.created_at,
            duration,
            recorded_by: call.recorded_by_name,
            participants: uniqueSpeakers,
            summary: call.summary || 'No summary available',
            url: call.url,
            share_url: call.share_url,
            source_platform: call.source_platform || 'fathom',
          };

          // For YouTube imports, always include transcript since search tools
          // cannot find YouTube content (no chunked fathom_transcripts).
          // For regular calls, include transcript only when explicitly requested.
          if (isYouTubeCall || include_transcript) {
            const transcript = call.full_transcript;
            if (transcript) {
              // Truncate to ~32K chars to stay within token limits
              result.full_transcript = transcript.length > 32000
                ? transcript.substring(0, 32000) + '\n\n[Transcript truncated — first 32000 characters shown]'
                : transcript;
            }
          }

          // For YouTube, include useful metadata
          if (isYouTubeCall) {
            const meta = call.metadata as Record<string, unknown> | null;
            if (meta) {
              result.youtube_channel = meta.youtube_channel_title || undefined;
              result.youtube_video_id = meta.youtube_video_id || undefined;
            }
          }

          return result;
        } catch (error) {
          console.error('[chat-stream-v2] getCallDetails error:', error);
          return { error: true, message: error instanceof Error ? error.message : 'Failed to get call details' };
        }
      },
    }),

    // Tool 11: getCallsList
    getCallsList: tool({
      description: 'Get a list of calls matching filter criteria with summary previews. Use for overview queries like "show me all sales calls from last month" or "list calls with Jane".',
      inputSchema: z.object({
        limit: z.number().optional().describe('Maximum calls to return (default: 20)'),
        offset: z.number().optional().describe('Number of calls to skip for pagination'),
        category: z.string().optional().describe('Category filter'),
        date_from: z.string().optional().describe('Start date filter (YYYY-MM-DD)'),
        date_to: z.string().optional().describe('End date filter (YYYY-MM-DD)'),
      }),
      execute: async ({ limit = 20, offset = 0, category, date_from, date_to }) => {
        console.log(`[chat-stream-v2] getCallsList: limit=${limit} offset=${offset} category=${category} bank=${bankId} vault=${vaultId}`);

        try {
          // If vault context is present, get accessible recording_ids first
          let vaultScopedRecordingIds: number[] | null = null;
          
          if (bankId || vaultId) {
            const accessibleVaultIds: string[] = [];
            
            if (vaultId) {
              const { data: membership } = await supabase
                .from('vault_memberships')
                .select('id')
                .eq('vault_id', vaultId)
                .eq('user_id', userId)
                .maybeSingle();
              if (membership) accessibleVaultIds.push(vaultId);
            } else if (bankId) {
              const { data: memberships } = await supabase
                .from('vault_memberships')
                .select('vault_id, vaults!inner(bank_id)')
                .eq('user_id', userId)
                .eq('vaults.bank_id', bankId);
              if (memberships) {
                memberships.forEach((m: { vault_id: string }) => accessibleVaultIds.push(m.vault_id));
              }
            }
            
            if (accessibleVaultIds.length > 0) {
              // Get legacy recording IDs from accessible vault entries
              const { data: entries } = await supabase
                .from('vault_entries')
                .select('recordings!inner(legacy_recording_id)')
                .in('vault_id', accessibleVaultIds);
              
              if (entries && entries.length > 0) {
                vaultScopedRecordingIds = entries
                  .map((e: { recordings: { legacy_recording_id: number | null } }) => e.recordings.legacy_recording_id)
                  .filter((id: number | null): id is number => id !== null);
              }
            }
            
            // No accessible recordings - return empty
            if (!vaultScopedRecordingIds || vaultScopedRecordingIds.length === 0) {
              return { message: 'No calls found in accessible vaults.' };
            }
          }

          let callsQuery = supabase
            .from('fathom_calls')
            .select('recording_id, title, created_at, summary, recorded_by_name, share_url')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

          // Apply vault scoping if present
          if (vaultScopedRecordingIds) {
            callsQuery = callsQuery.in('recording_id', vaultScopedRecordingIds);
          } else if (sessionFilters?.bank_id) {
            // Fall back to bank filter on fathom_calls
            callsQuery = callsQuery.eq('bank_id', sessionFilters.bank_id);
          }

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
              share_url: string | null;
            }) => ({
              recording_id: c.recording_id,
              title: c.title,
              date: c.created_at,
              recorded_by: c.recorded_by_name,
              share_url: c.share_url,
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
      inputSchema: z.object({
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
      inputSchema: z.object({
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

        const toolFilters: Partial<SearchFilters> = {};
        if (speaker) toolFilters.speakers = [speaker];
        if (category) toolFilters.categories = [category];
        if (date_from) toolFilters.date_start = date_from;
        if (date_to) toolFilters.date_end = date_to;
        if (sentiment) toolFilters.sentiment = sentiment;
        if (intent) toolFilters.intent_signals = [intent];
        if (tags) toolFilters.user_tags = tags;

        return search('advancedSearch', searchQuery, limit, toolFilters);
      },
    }),

    // Tool 14: compareCalls
    compareCalls: tool({
      description: 'Compare 2-5 specific calls side-by-side to identify similarities, differences, or patterns. Use for questions like "compare these calls" or "how do these meetings differ?"',
      inputSchema: z.object({
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

          // If vault context is present, filter recording_ids to accessible vaults
          let scopedNumericIds = numericIds;
          if (bankId || vaultId) {
            const accessibleVaultIds: string[] = [];
            
            if (vaultId) {
              const { data: membership } = await supabase
                .from('vault_memberships')
                .select('id')
                .eq('vault_id', vaultId)
                .eq('user_id', userId)
                .maybeSingle();
              if (membership) accessibleVaultIds.push(vaultId);
            } else if (bankId) {
              const { data: memberships } = await supabase
                .from('vault_memberships')
                .select('vault_id, vaults!inner(bank_id)')
                .eq('user_id', userId)
                .eq('vaults.bank_id', bankId);
              if (memberships) {
                memberships.forEach((m: { vault_id: string }) => accessibleVaultIds.push(m.vault_id));
              }
            }
            
            if (accessibleVaultIds.length > 0) {
              // Get accessible legacy recording IDs
              const { data: entries } = await supabase
                .from('vault_entries')
                .select('recordings!inner(legacy_recording_id)')
                .in('vault_id', accessibleVaultIds);
              
              const accessibleRecIds = new Set(
                (entries || [])
                  .map((e: { recordings: { legacy_recording_id: number | null } }) => e.recordings.legacy_recording_id)
                  .filter((id: number | null): id is number => id !== null)
              );
              
              scopedNumericIds = numericIds.filter(id => accessibleRecIds.has(id));
            } else {
              scopedNumericIds = [];
            }
            
            if (scopedNumericIds.length < 2) {
              return { error: true, message: 'Some recordings not accessible in current vault context. Need at least 2 valid calls.' };
            }
          }

          // Fetch call details for all recordings
          let callsQuery = supabase
            .from('fathom_calls')
            .select('recording_id, title, created_at, summary, recorded_by_name')
            .in('recording_id', scopedNumericIds)
            .eq('user_id', userId);
          
          if (sessionFilters?.bank_id && !vaultId) {
            callsQuery = callsQuery.eq('bank_id', sessionFilters.bank_id);
          }
          
          const { data: calls, error: callsError } = await callsQuery;

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
              
              // Use scoped search when vault context is present
              const useScopedSearch = !!(bankId || vaultId);
              const focusRpcFunction = useScopedSearch ? 'hybrid_search_transcripts_scoped' : 'hybrid_search_transcripts';
              const focusRpcParams: Record<string, unknown> = {
                query_text: focus,
                query_embedding: queryEmbedding,
                match_count: 30,
                full_text_weight: 1.0,
                semantic_weight: 1.0,
                rrf_k: 60,
                filter_user_id: userId,
                filter_recording_ids: scopedNumericIds,
              };
              
              if (useScopedSearch) {
                focusRpcParams.filter_bank_id = bankId || null;
                focusRpcParams.filter_vault_id = vaultId || null;
              } else {
                focusRpcParams.filter_bank_id = sessionFilters?.bank_id || null;
              }
              
              const { data: chunks, error: chunksError } = await supabase.rpc(focusRpcFunction, focusRpcParams);

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
    const { messages, model: requestedModel, filters: requestFilters, sessionId, sessionFilters: bankVaultContext } = body;

    // Extract bank/vault context for multi-tenant scoping
    const bankId = bankVaultContext?.bank_id || undefined;
    const vaultId = bankVaultContext?.vault_id; // null means "all vaults in bank"

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
        folder_ids: requestFilters.folder_ids,
      };
    } else if (sessionId) {
      // Fall back to session-stored filters
      const { data: session } = await supabase
        .from('chat_sessions')
        .select('filter_date_start, filter_date_end, filter_speakers, filter_categories, filter_recording_ids, filter_folder_ids')
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
          folder_ids: session.filter_folder_ids,
        };
      }
    }

    // ---- Resolve folder filters to recording IDs ----
    // Folder IDs are converted to recording_ids for the search pipeline
    if (sessionFilters?.folder_ids?.length) {
      const resolvedRecordingIds = await resolveFolderFilter(
        supabase,
        user.id,
        sessionFilters.folder_ids,
        sessionFilters.recording_ids,
      );
      sessionFilters.recording_ids = resolvedRecordingIds;
      console.log(`[chat-stream-v2] Resolved ${sessionFilters.folder_ids.length} folder(s) to ${resolvedRecordingIds?.length ?? 0} recording(s)`);
    }

    // ---- Set bank_id on session filters for tool access ----
    if (bankId && sessionFilters) {
      sessionFilters.bank_id = bankId;
    } else if (bankId && !sessionFilters) {
      sessionFilters = { bank_id: bankId };
    }

    const selectedModel = requestedModel || 'openai/gpt-4o-mini';
    const requestStartTime = Date.now();
    console.log(`[chat-stream-v2] User: ${user.id}, Bank: ${bankId || 'none'}, Vault: ${vaultId === null ? 'all' : vaultId || 'none'}, Model: ${selectedModel}, Messages: ${messages.length}, Filters: ${JSON.stringify(sessionFilters)}`);

    // ---- Fetch business profile for context ----
    const businessProfile = await fetchBusinessProfile(supabase, user.id);
    if (businessProfile) {
      console.log(`[chat-stream-v2] Business profile loaded: ${businessProfile.company_name || 'unnamed'}`);
    }

    // ---- Build system prompt and tools ----
    const openrouter = createOpenRouterProvider(openrouterApiKey);
    const systemPrompt = buildSystemPrompt(sessionFilters, businessProfile);
    const allTools = createTools(supabase, user.id, openaiApiKey, hfApiKey, sessionFilters, bankId, vaultId);

    // ---- Convert messages ----
    const convertedMessages = convertToModelMessages(messages);

    // ---- Stream response ----
    try {
      console.log('[chat-stream-v2] Starting streamText with model:', selectedModel);
      console.log('[chat-stream-v2] Message count:', convertedMessages.length);
      console.log('[chat-stream-v2] Tools count:', Object.keys(allTools).length);

      // Estimate input tokens from messages for usage logging
      const fullPromptText = systemPrompt + '\n' + convertedMessages.map(m => {
        if (typeof m.content === 'string') return m.content;
        return JSON.stringify(m.content);
      }).join('\n');
      const estimatedInputTokens = estimateTokenCount(fullPromptText);

      // ---- Start Langfuse trace (if configured) ----
      // Serialize messages for Langfuse input
      const messagesForTrace = convertedMessages.map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      }));

      const langfuseTrace: ChatTraceResult | null = startChatTrace({
        userId: user.id,
        sessionId: sessionId || undefined,
        model: selectedModel,
        systemPrompt,
        messages: messagesForTrace,
        metadata: {
          hasBusinessProfile: !!businessProfile,
          hasFilters: !!sessionFilters,
          bankId: bankId || null,
          vaultId: vaultId !== undefined ? vaultId : null,
          filterSummary: sessionFilters ? {
            hasDateRange: !!(sessionFilters.date_start || sessionFilters.date_end),
            hasSpeakers: !!(sessionFilters.speakers?.length),
            hasCategories: !!(sessionFilters.categories?.length),
            hasRecordingIds: !!(sessionFilters.recording_ids?.length),
            hasBankId: !!sessionFilters.bank_id,
          } : null,
        },
      });

      if (langfuseTrace) {
        console.log(`[chat-stream-v2] Langfuse trace started: ${langfuseTrace.traceId}`);
      }

      const result = streamText({
        model: openrouter(selectedModel),
        system: systemPrompt,
        messages: convertedMessages,
        tools: allTools,
        toolChoice: 'auto',
        maxSteps: 5,
        onError: ({ error }) => {
          console.error('[chat-stream-v2] Stream onError callback:', error);
          console.error('[chat-stream-v2] Error details:', JSON.stringify(error, null, 2));
        },
        onFinish: async ({ text, usage }) => {
          // Fire-and-forget usage logging - don't block response
          const latencyMs = Date.now() - requestStartTime;
          const outputTokens = usage?.completionTokens || estimateTokenCount(text);
          const inputTokens = usage?.promptTokens || estimatedInputTokens;

          console.log(`[chat-stream-v2] Usage logged: model=${selectedModel}, input=${inputTokens}, output=${outputTokens}, latency=${latencyMs}ms`);

          // End Langfuse generation and flush trace
          if (langfuseTrace) {
            langfuseTrace.endGeneration(text, {
              promptTokens: inputTokens,
              completionTokens: outputTokens,
            });
            // Flush asynchronously - don't block response
            langfuseTrace.endTrace().catch(err => {
              console.error('[chat-stream-v2] Failed to flush Langfuse:', err);
            });
          }

          // Log to usage tracking table (fire-and-forget)
          logUsage(supabase, {
            userId: user.id,
            operationType: 'chat',
            model: selectedModel,
            inputTokens,
            outputTokens,
            sessionId: sessionId || undefined,
            latencyMs,
          }).catch(err => {
            console.error('[chat-stream-v2] Failed to log usage:', err);
          });
        },
      });

      console.log('[chat-stream-v2] streamText result created, returning stream response');
      return result.toUIMessageStreamResponse({
        headers: corsHeaders,
      });
    } catch (streamError) {
      console.error('[chat-stream-v2] streamText threw error:', streamError);
      console.error('[chat-stream-v2] Error type:', streamError?.constructor?.name);
      console.error('[chat-stream-v2] Error message:', streamError instanceof Error ? streamError.message : String(streamError));
      console.error('[chat-stream-v2] Error stack:', streamError instanceof Error ? streamError.stack : 'no stack');

      // Ensure Langfuse is flushed even on error
      await flushLangfuse();

      // Return detailed error for debugging
      return new Response(
        JSON.stringify({
          error: streamError instanceof Error ? streamError.message : 'Stream creation failed',
          type: streamError?.constructor?.name,
          details: String(streamError)
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

  } catch (error) {
    console.error('[chat-stream-v2] Handler error:', error);
    console.error('[chat-stream-v2] Handler error type:', error?.constructor?.name);

    // Ensure Langfuse is flushed even on error
    await flushLangfuse();

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
        type: error?.constructor?.name
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
