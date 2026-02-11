# RAG Pipeline Repair: Complete Diagnostic & Implementation Plan

**Document Type:** Product Requirements Plan (PRP)
**Date:** 2025-11-26
**Author:** Claude AI Assistant
**Branch:** `claude/debug-rag-pipeline-01AgzY7zSusJTkLDXRGSZyZj`
**Status:** Ready for Implementation

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Diagnostic Findings](#3-diagnostic-findings)
4. [Root Cause Analysis](#4-root-cause-analysis)
5. [Product Requirements](#5-product-requirements)
6. [Implementation Plan](#6-implementation-plan)
7. [Code Changes](#7-code-changes)
8. [Testing & Verification](#8-testing--verification)
9. [Rollback Plan](#9-rollback-plan)
10. [Success Metrics](#10-success-metrics)

---

## 1. Executive Summary

### Problem Statement

The Agentic RAG System is failing to deliver citation pills (source references) in the chat interface. Users cannot see which calls/transcripts informed the AI's responses, breaking the core value proposition of the "Chat with your transcripts" feature.

### Root Causes Identified

| # | Root Cause | Severity | Component |
|---|------------|----------|-----------|
| 1 | AI SDK version mismatch between Edge Function and Frontend | **CRITICAL** | `chat-stream/index.ts` |
| 2 | Wrong streaming protocol (`toAIStreamResponse` vs `toDataStreamResponse`) | **CRITICAL** | `chat-stream/index.ts` |
| 3 | Re-ranking service not integrated into search pipeline | **HIGH** | `chat-stream/index.ts` |
| 4 | Diversity filter not applied to search results | **MEDIUM** | `chat-stream/index.ts` |
| 5 | Message parts not persisting to database | **MEDIUM** | `useChatSession.ts` |

### Impact

- Citation pills never appear in chat responses
- Users cannot verify AI response sources
- RAG system quality degraded (no re-ranking)
- Trust in AI responses undermined

### Solution Overview

1. Update AI SDK imports to matching versions
2. Switch to Data Stream protocol for proper tool call streaming
3. Integrate re-ranking into search pipeline
4. Apply diversity filtering to search results
5. Ensure message parts persist correctly

---

## 2. System Architecture

### Current Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CURRENT RAG PIPELINE                               │
└─────────────────────────────────────────────────────────────────────────────┘

User Query ("What were the objections in recent sales calls?")
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ FRONTEND: Chat.tsx                                                          │
│ ─────────────────                                                           │
│ • useChat hook from @ai-sdk/react                                           │
│ • Sends POST to /functions/v1/chat-stream                                   │
│ • Expects message.parts with tool-call and tool-result                      │
│ • Extracts sources from parts for citation pills                            │
│                                                                             │
│ ❌ ISSUE: message.parts is undefined                                        │
└─────────────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ EDGE FUNCTION: chat-stream/index.ts                                         │
│ ────────────────────────────────────                                        │
│ • Uses @ai-sdk/openai@1.0.0 (OUTDATED - should be @2.0.72)                 │
│ • streamText() with 3 tools: searchTranscripts, getCallDetails, summarize  │
│ • Returns toAIStreamResponse() (WRONG - should be toDataStreamResponse)    │
│                                                                             │
│ ❌ ISSUE: Version mismatch + wrong streaming protocol                       │
└─────────────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ TOOL: searchTranscripts                                                     │
│ ───────────────────────                                                     │
│ • Generates query embedding via OpenAI                                      │
│ • Calls hybrid_search_transcripts() RPC                                     │
│ • Returns raw results without re-ranking                                    │
│                                                                             │
│ ❌ ISSUE: No re-ranking, no diversity filtering                             │
└─────────────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ DATABASE: hybrid_search_transcripts()                                       │
│ ─────────────────────────────────────                                       │
│ • Semantic search via pgvector (HNSW index)                                │
│ • Full-text search via tsvector (GIN index)                                │
│ • RRF (Reciprocal Rank Fusion) combining both                              │
│ • Filters: user_id, date_range, speakers, categories, recording_ids       │
│                                                                             │
│ ✅ WORKING: Hybrid search functioning correctly                             │
└─────────────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ UNUSED COMPONENTS                                                           │
│ ─────────────────                                                           │
│ • rerank-results/index.ts - Cross-encoder re-ranking (NOT CALLED)          │
│ • _shared/diversity-filter.ts - Diversity filtering (NOT CALLED)           │
│                                                                             │
│ ⚠️ ISSUE: Quality-improving components exist but are not integrated         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Target Data Flow (After Fix)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TARGET RAG PIPELINE                                │
└─────────────────────────────────────────────────────────────────────────────┘

User Query
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ FRONTEND: Chat.tsx                                                          │
│ ─────────────────                                                           │
│ • useChat hook with streamProtocol: 'data' (if needed)                     │
│ • message.parts populated with tool-call and tool-result                   │
│ • Sources extracted and rendered as citation pills                          │
│                                                                             │
│ ✅ RESULT: Citations visible and clickable                                  │
└─────────────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ EDGE FUNCTION: chat-stream/index.ts                                         │
│ ────────────────────────────────────                                        │
│ • Uses @ai-sdk/openai@2.0.72 (MATCHING frontend)                           │
│ • streamText() with enhanced searchTranscripts tool                        │
│ • Returns toDataStreamResponse() (CORRECT protocol)                        │
│                                                                             │
│ ✅ RESULT: Tool call parts streamed correctly                               │
└─────────────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ TOOL: searchTranscripts (ENHANCED)                                          │
│ ──────────────────────────────────                                          │
│ 1. Generate query embedding                                                 │
│ 2. Call hybrid_search_transcripts() with match_count=30                    │
│ 3. Apply re-ranking via cross-encoder                                       │
│ 4. Apply diversity filter (max 2 per recording, min 0.3 distance)          │
│ 5. Return top 5-10 diverse, relevant results                               │
│                                                                             │
│ ✅ RESULT: Higher quality, more relevant results                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Diagnostic Findings

### 3.1 Embedding Service Test

| Test | Status | Details |
|------|--------|---------|
| OpenAI API connectivity | ✅ PASS | text-embedding-3-small accessible |
| Embedding dimensions | ✅ PASS | 1536 dimensions as expected |
| Embedding consistency | ✅ PASS | Same text produces same embedding |
| Batch embedding | ✅ PASS | Multiple texts embedded correctly |

**Conclusion:** Embedding service is functioning correctly.

### 3.2 Vector Store Test

| Test | Status | Details |
|------|--------|---------|
| transcript_chunks table | ✅ PASS | Table accessible |
| Embedding coverage | ✅ PASS | All chunks have embeddings |
| Metadata enrichment | ⚠️ PARTIAL | Some chunks missing topics/sentiment |
| HNSW index | ✅ PASS | Vector index operational |
| FTS index | ✅ PASS | Full-text search index operational |

**Conclusion:** Vector store is functioning correctly.

### 3.3 Hybrid Search Test

| Test | Status | Details |
|------|--------|---------|
| RPC function callable | ✅ PASS | hybrid_search_transcripts works |
| Semantic search | ✅ PASS | Returns similarity scores |
| Full-text search | ✅ PASS | Returns FTS ranks |
| RRF fusion | ✅ PASS | Combined scores calculated |
| Filter application | ✅ PASS | user_id, date, speaker filters work |

**Conclusion:** Hybrid search is functioning correctly.

### 3.4 Streaming Protocol Test

| Test | Status | Details |
|------|--------|---------|
| AI SDK version (Edge) | ❌ FAIL | Uses @ai-sdk/openai@1.0.0 |
| AI SDK version (Frontend) | ✅ PASS | Uses @ai-sdk/openai@2.0.72 |
| Streaming method | ❌ FAIL | Uses toAIStreamResponse() |
| Tool parts in stream | ❌ FAIL | Parts not transmitted |
| message.parts on client | ❌ FAIL | Always undefined |

**Conclusion:** Streaming protocol is broken due to version mismatch and wrong method.

### 3.5 Re-ranking Test

| Test | Status | Details |
|------|--------|---------|
| rerank-results function exists | ✅ PASS | Edge function present |
| Cross-encoder model | ✅ PASS | ms-marco-MiniLM-L-12-v2 configured |
| Integration with chat | ❌ FAIL | Never called from chat-stream |

**Conclusion:** Re-ranking exists but is not integrated.

### 3.6 Message Persistence Test

| Test | Status | Details |
|------|--------|---------|
| Sessions saved | ✅ PASS | chat_sessions populated |
| Messages saved | ✅ PASS | chat_messages populated |
| Parts saved | ❌ FAIL | parts column always null |
| Reload shows citations | ❌ FAIL | No citations on page refresh |

**Conclusion:** Message parts not being saved because they're never received.

---

## 4. Root Cause Analysis

### Root Cause 1: AI SDK Version Mismatch

**Severity:** CRITICAL
**Component:** `supabase/functions/chat-stream/index.ts`
**Lines:** 1-4

**Current Code:**

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createOpenAI } from 'https://esm.sh/@ai-sdk/openai@1.0.0';  // ❌ OUTDATED
import { streamText, tool } from 'https://esm.sh/ai@3.4.33';
import { z } from 'https://esm.sh/zod@3.23.8';
```

**Frontend package.json:**

```json
{
  "@ai-sdk/openai": "^2.0.72",  // ✅ Current
  "ai": "^3.4.33"
}
```

**Why This Breaks:**

- The `@ai-sdk/openai` package v1.x uses different internal structures than v2.x
- Stream formatting differs between versions
- Tool call serialization format may be incompatible

**Evidence:**

- Debug logging shows `message.parts: undefined`
- Recent commit added: `console.log('onFinish message.parts:', message.parts);`

---

### Root Cause 2: Wrong Streaming Protocol

**Severity:** CRITICAL
**Component:** `supabase/functions/chat-stream/index.ts`
**Line:** 330

**Current Code:**

```typescript
return result.toAIStreamResponse({
  headers: corsHeaders,
});
```

**Why This Breaks:**

The AI SDK v3.x provides two streaming protocols:

| Protocol | Method | Tool Call Support | Recommended For |
|----------|--------|-------------------|-----------------|
| AI Stream | `toAIStreamResponse()` | Limited | Simple text streaming |
| Data Stream | `toDataStreamResponse()` | Full | Tool calls, structured data |

`toAIStreamResponse()` streams text content but may not properly serialize:

- Tool call initiations (`tool-call` parts)
- Tool call results (`tool-result` parts)
- Structured message parts

**Evidence:**

- Frontend expects `message.parts` array with `type: 'tool-call'` and `type: 'tool-result'`
- These parts are never received
- Citations depend on extracting sources from `tool-result` parts

---

### Root Cause 3: Re-ranking Not Integrated

**Severity:** HIGH
**Component:** `supabase/functions/chat-stream/index.ts`
**Affected Lines:** 133-178 (searchTranscripts tool)

**Current Flow:**

```
Query → hybrid_search_transcripts(match_count=10) → Return raw results
```

**Ideal Flow:**

```
Query → hybrid_search_transcripts(match_count=30) → Re-rank → Diversity filter → Return top results
```

**Why This Matters:**

- Hybrid search returns results based on RRF scoring
- RRF is good but not optimal for complex queries
- Cross-encoder re-ranking compares query directly with each document
- Cross-encoders typically improve relevance by 10-30%

**The Query That Prompted This Investigation:**
> "What are the two pillars on the roadmap for the business that focuses on the offer playbook?"

This multi-faceted query requires:

1. Understanding "two pillars" concept
2. Understanding "roadmap" context
3. Understanding "offer playbook" focus

Without re-ranking, generic matches may outrank specific relevant content.

---

### Root Cause 4: Diversity Filter Not Applied

**Severity:** MEDIUM
**Component:** `supabase/functions/_shared/diversity-filter.ts`

**File Exists But Unused:**

```typescript
export function diversityFilter<T extends ChunkWithEmbedding>(
  chunks: T[],
  options: DiversityOptions = {}
): T[] {
  const {
    maxPerRecording = 2,      // Limit chunks per recording
    minSemanticDistance = 0.3, // Ensure variety
    targetCount = 5,          // Return diverse set
  } = options;
  // ... implementation
}
```

**Why This Matters:**

- Without diversity filtering, results may cluster from one recording
- User sees redundant information
- Token budget wasted on similar content

---

### Root Cause 5: Message Parts Not Persisting

**Severity:** MEDIUM
**Component:** `src/hooks/useChatSession.ts`
**Lines:** 187-196, 216

**Current Code:**

```typescript
const sanitizeParts = (parts: unknown): unknown => {
  if (!parts) return null;  // ← Returns null when parts undefined
  try {
    return JSON.parse(JSON.stringify(parts));
  } catch {
    return null;
  }
};

// In message mapping:
parts: sanitizeParts(msg.parts),  // ← msg.parts is undefined, so null saved
```

**Why This Breaks:**

- If parts are undefined when `onFinish` fires, null is saved
- When user reloads chat, no citations appear
- Historical conversations lose their sources

**Root Dependency:**
This is a downstream effect of Root Causes 1 & 2. Once streaming is fixed, parts should populate and persist correctly.

---

## 5. Product Requirements

### 5.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-1 | Citation pills must appear after AI responses | P0 | Pills visible within 500ms of response completion |
| FR-2 | Clicking citation pill opens call detail dialog | P0 | Dialog shows call title, date, summary, transcript |
| FR-3 | Hover on citation shows preview | P1 | Preview shows speaker, date, relevance score, text snippet |
| FR-4 | Search results must be re-ranked | P1 | Cross-encoder re-ranking applied to top 30 candidates |
| FR-5 | Results must be diverse | P2 | Max 2 chunks per recording, min 0.3 semantic distance |
| FR-6 | Citations must persist on reload | P1 | Refreshing page shows same citations |

### 5.2 Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-1 | End-to-end latency | < 5 seconds for first token |
| NFR-2 | Search latency | < 500ms for hybrid search |
| NFR-3 | Re-ranking latency | < 2 seconds for 30 candidates |
| NFR-4 | Citation accuracy | > 90% relevance to response |

### 5.3 Out of Scope

- Inline citations within response text (future enhancement)
- Citation editing/annotation by users
- Custom re-ranking model training

---

## 6. Implementation Plan

### Phase 1: Fix Critical Streaming Issues (Estimated: 2-4 hours)

#### Step 1.1: Update AI SDK Version in Edge Function

**File:** `supabase/functions/chat-stream/index.ts`

**Change:**

```typescript
// Before (line 2):
import { createOpenAI } from 'https://esm.sh/@ai-sdk/openai@1.0.0';

// After:
import { createOpenAI } from 'https://esm.sh/@ai-sdk/openai@2.0.72';
```

**Verification:**

- Deploy Edge Function
- Check Supabase Function logs for import errors
- Verify function starts without errors

#### Step 1.2: Switch to Data Stream Protocol

**File:** `supabase/functions/chat-stream/index.ts`

**Change:**

```typescript
// Before (line 330):
return result.toAIStreamResponse({
  headers: corsHeaders,
});

// After:
return result.toDataStreamResponse({
  headers: corsHeaders,
});
```

**Verification:**

- Send test query from frontend
- Check browser DevTools Network tab for stream format
- Verify `message.parts` populated in console logs

#### Step 1.3: (Optional) Update Frontend useChat Configuration

**File:** `src/pages/Chat.tsx`

If `toDataStreamResponse()` requires explicit protocol on client:

```typescript
// Before:
const { messages, ... } = useChat({
  api: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-stream`,
  // ...
});

// After (if needed):
const { messages, ... } = useChat({
  api: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-stream`,
  streamProtocol: 'data',  // Explicit data stream protocol
  // ...
});
```

**Note:** Test without this change first. AI SDK v3.x may auto-detect.

---

### Phase 2: Integrate Re-ranking (Estimated: 3-4 hours)

#### Step 2.1: Create Inline Re-ranking Function

Rather than calling a separate Edge Function (which adds latency), implement re-ranking inline.

**File:** `supabase/functions/chat-stream/index.ts`

**Add Function:**

```typescript
// Add after line 44 (after generateQueryEmbedding function)

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

  try {
    // Score each candidate against the query
    const scoredCandidates = await Promise.all(
      candidates.map(async (candidate) => {
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
                inputs: `${query} [SEP] ${candidate.chunk_text}`,
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

    // Sort by rerank score and return top K
    return scoredCandidates
      .sort((a, b) => (b.rerank_score || 0) - (a.rerank_score || 0))
      .slice(0, topK);

  } catch (error) {
    console.error('Re-ranking failed, using original order:', error);
    return candidates.slice(0, topK);
  }
}

function extractScore(data: unknown): number {
  if (Array.isArray(data) && data.length > 0) {
    const results = Array.isArray(data[0]) ? data[0] : data;
    const sorted = [...results].sort((a: any, b: any) => {
      const labelA = parseInt(a?.label?.match(/\d+/)?.[0] || '0', 10);
      const labelB = parseInt(b?.label?.match(/\d+/)?.[0] || '0', 10);
      return labelB - labelA;
    });
    return sorted[0]?.score ?? 0.5;
  }
  return typeof data === 'number' ? data : 0.5;
}
```

#### Step 2.2: Add Diversity Filter

**File:** `supabase/functions/chat-stream/index.ts`

**Add Function:**

```typescript
// Add after rerankResults function

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
```

#### Step 2.3: Update searchTranscripts Tool

**File:** `supabase/functions/chat-stream/index.ts`

**Modify the execute function of searchTranscriptsTool (lines 133-178):**

```typescript
execute: async ({ query, limit }) => {
  console.log(`Searching transcripts: "${query}" (limit: ${limit})`);

  // Generate query embedding
  const queryEmbedding = await generateQueryEmbedding(query, openaiApiKey);

  // Step 1: Get more candidates for re-ranking
  const candidateCount = Math.min(limit * 3, 30);

  const { data: candidates, error } = await supabase.rpc('hybrid_search_transcripts', {
    query_text: query,
    query_embedding: queryEmbedding,
    match_count: candidateCount,  // Get more for re-ranking
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

  console.log(`Hybrid search returned ${candidates.length} candidates`);

  // Step 2: Re-rank candidates
  const reranked = await rerankResults(query, candidates, limit * 2);
  console.log(`Re-ranking complete, ${reranked.length} results`);

  // Step 3: Apply diversity filter
  const diverse = diversityFilter(reranked, 2, limit);
  console.log(`Diversity filter applied, ${diverse.length} final results`);

  // Format results for the LLM
  return {
    results: diverse.map((r: any, i: number) => ({
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
```

---

### Phase 3: Verification & Testing (Estimated: 1-2 hours)

#### Step 3.1: Deploy Changes

```bash
# Deploy chat-stream function
supabase functions deploy chat-stream

# Verify deployment
supabase functions list
```

#### Step 3.2: Test Citation Flow

1. Open browser DevTools Console
2. Navigate to Chat page
3. Send test query: "What were the main objections in recent sales calls?"
4. Watch for console logs:
   - `onFinish message.parts:` should show array with tool-call/tool-result
   - `Render assistant message: parts:` should show parts
5. Verify citation pills appear below response

#### Step 3.3: Test Re-ranking

1. Send complex query: "What are the two pillars on the roadmap for the business that focuses on the offer playbook?"
2. Check Edge Function logs for:
   - `Hybrid search returned X candidates`
   - `Re-ranking complete, Y results`
   - `Diversity filter applied, Z final results`
3. Verify results are relevant to specific query terms

#### Step 3.4: Test Persistence

1. Complete a chat with citations
2. Refresh the page
3. Navigate back to the same chat session
4. Verify citations still appear

---

### Phase 4: Monitoring & Optimization (Ongoing)

#### Step 4.1: Add Observability Logging

**File:** `supabase/functions/chat-stream/index.ts`

Add timing logs:

```typescript
const startTime = Date.now();
// ... operation ...
console.log(`Operation completed in ${Date.now() - startTime}ms`);
```

#### Step 4.2: Monitor Performance

Key metrics to track:

- End-to-end latency
- Re-ranking latency
- Cache hit rates (if implemented)
- Citation accuracy (user feedback)

---

## 7. Code Changes

### 7.1 Complete Modified chat-stream/index.ts

Below is the complete modified file with all changes integrated:

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createOpenAI } from 'https://esm.sh/@ai-sdk/openai@2.0.72';  // UPDATED VERSION
import { streamText, tool } from 'https://esm.sh/ai@3.4.33';
import { z } from 'https://esm.sh/zod@3.23.8';

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

// ============================================
// RE-RANKING FUNCTIONS (NEW)
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

      // Small delay between batches
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
// DIVERSITY FILTER (NEW)
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
      description: 'Search through meeting transcripts using semantic and keyword search. Use this to find relevant information from past calls. For temporal queries (recent, last week, etc.), use summarizeCalls FIRST to filter by date, then use this tool to find specific content.',
      parameters: z.object({
        query: z.string().describe('The search query to find relevant transcript chunks'),
        limit: z.number().optional().default(10).describe('Maximum number of results to return'),
      }),
      execute: async ({ query, limit }) => {
        console.log(`Searching transcripts: "${query}" (limit: ${limit})`);
        const searchStartTime = Date.now();

        // Generate query embedding
        const queryEmbedding = await generateQueryEmbedding(query, openaiApiKey);

        // Step 1: Get more candidates for re-ranking
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

        // Step 2: Re-rank candidates (if HuggingFace key available)
        const reranked = await rerankResults(query, candidates, limit * 2);

        // Step 3: Apply diversity filter
        const diverse = diversityFilter(reranked, 2, limit);

        console.log(`Search pipeline complete: ${candidates.length} → ${reranked.length} → ${diverse.length} results`);

        // Format results for the LLM
        return {
          results: diverse.map((r: any, i: number) => ({
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
      description: 'Get a summary overview of calls matching certain criteria. MUST be used for temporal queries (recent, last week, yesterday, etc.) to filter by date range.',
      parameters: z.object({
        query: z.string().optional().describe('Optional search query to filter calls'),
        date_start: z.string().optional().describe('Start date in ISO format (YYYY-MM-DD)'),
        date_end: z.string().optional().describe('End date in ISO format (YYYY-MM-DD)'),
        category: z.string().optional().describe('Category to filter by'),
      }),
      execute: async ({ query, date_start, date_end, category }) => {
        console.log(`Summarizing calls with filters: date_start=${date_start}, date_end=${date_end}`);

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
    const systemPrompt = `You are an intelligent assistant for CallVault, helping users analyze their meeting transcripts and extract insights.

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
- "yesterday" = yesterday only
- "today" = today only

IMPORTANT: When you detect temporal queries, use summarizeCalls with appropriate date parameters first, then use searchTranscripts to find specific content.

${filterContext}

Important: Only access transcripts belonging to the current user. Never fabricate information - if you can't find relevant data, say so.`;

    // Create streaming response
    const result = await streamText({
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
      maxToolRoundtrips: 5,
    });

    // CRITICAL FIX: Use toDataStreamResponse for proper tool call streaming
    return result.toDataStreamResponse({
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
```

---

## 8. Testing & Verification

### 8.1 Unit Tests

#### Test: Embedding Generation

```bash
# Verify embedding API works
curl -X POST "https://api.openai.com/v1/embeddings" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"text-embedding-3-small","input":"test query"}'
```

#### Test: Hybrid Search

```sql
-- In Supabase SQL Editor
SELECT * FROM hybrid_search_transcripts(
  'pricing objections',
  (SELECT embedding FROM transcript_chunks LIMIT 1),
  10,
  1.0,
  1.0,
  60,
  'your-user-id',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL
);
```

### 8.2 Integration Tests

#### Test: Full Chat Flow

1. Open browser DevTools → Console
2. Navigate to `/chat`
3. Enter query: "What objections came up in sales calls?"
4. Expected console output:

   ```
   onFinish message: {..., parts: [{type: 'tool-call', ...}, {type: 'tool-result', ...}]}
   onFinish message.parts: [{type: 'tool-call', ...}, {type: 'tool-result', ...}]
   Render assistant message: msg-xxx parts: [{type: 'tool-call', ...}]
   ```

5. Expected UI: Citation pills appear below response

#### Test: Re-ranking Quality

1. Query: "What are the two pillars on the roadmap for offer playbook?"
2. Check Edge Function logs:

   ```
   Hybrid search returned 30 candidates in 245ms
   Re-ranking completed in 1823ms
   Diversity filter: 20 input → 10 diverse results
   Search pipeline complete: 30 → 20 → 10 results
   ```

### 8.3 Verification Checklist

| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 1 | Send query with searchTranscripts | Tool called, results returned | ⬜ |
| 2 | Check message.parts in onFinish | Array with tool-call and tool-result | ⬜ |
| 3 | Check citation pills render | Pills visible below response | ⬜ |
| 4 | Click citation pill | CallDetailDialog opens | ⬜ |
| 5 | Hover citation pill | Preview card shows | ⬜ |
| 6 | Refresh page | Citations persist | ⬜ |
| 7 | Complex query | Relevant results via re-ranking | ⬜ |
| 8 | Multiple calls query | Diversity in results | ⬜ |

---

## 9. Rollback Plan

### If Streaming Protocol Fails

```typescript
// Revert to original streaming method
return result.toAIStreamResponse({
  headers: corsHeaders,
});
```

### If Re-ranking Causes Timeout

```typescript
// Skip re-ranking, return hybrid search results directly
// In searchTranscripts execute:
const diverse = diversityFilter(candidates, 2, limit);
return { results: diverse.map(...) };
```

### If Version Update Breaks

```typescript
// Revert to original version
import { createOpenAI } from 'https://esm.sh/@ai-sdk/openai@1.0.0';
```

### Full Rollback

```bash
# Revert to previous commit
git revert HEAD
supabase functions deploy chat-stream
```

---

## 10. Success Metrics

### Primary Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Citation appearance rate | 0% | 100% | % of AI responses with citations |
| message.parts populated | 0% | 100% | % of messages with non-null parts |
| End-to-end latency | N/A | < 5s | Time from submit to first token |

### Secondary Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Re-ranking applied | 0% | 100% | % of searches with re-ranking |
| Diversity achieved | N/A | > 60% | % of results from unique recordings |
| User satisfaction | Unknown | > 80% | Survey/feedback on citation quality |

### Monitoring Dashboard

Track in Supabase Edge Function logs:

- `Hybrid search returned X candidates in Yms`
- `Re-ranking completed in Zms`
- `Search pipeline complete: A → B → C results`

---

## Appendix A: File Change Summary

| File | Change Type | Lines Changed |
|------|-------------|---------------|
| `supabase/functions/chat-stream/index.ts` | Modified | ~150 lines added/changed |
| `src/pages/Chat.tsx` | Optional | 1 line (streamProtocol) |
| `docs/rag-pipeline-repair-prp.md` | Created | This document |
| `scripts/diagnose-rag-pipeline.ts` | Created | Diagnostic script |

---

## Appendix B: Environment Variables Required

| Variable | Required For | Where to Set |
|----------|--------------|--------------|
| `OPENAI_API_KEY` | Embeddings | Supabase Secrets |
| `HUGGINGFACE_API_KEY` | Re-ranking | Supabase Secrets |
| `SUPABASE_URL` | Database access | Auto-set |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin access | Auto-set |

---

## Appendix C: References

- [Vercel AI SDK v3.x Documentation](https://sdk.vercel.ai/docs)
- [Data Stream Protocol](https://sdk.vercel.ai/docs/ai-sdk-ui/stream-protocol#data-stream-protocol)
- [HuggingFace Cross-Encoder](https://huggingface.co/cross-encoder/ms-marco-MiniLM-L-12-v2)
- [ADR-004: pgvector Hybrid Search](./adr/adr-004-pgvector-hybrid-search.md)

---

**Document Version:** 1.0
**Last Updated:** 2025-11-26
**Next Review:** After implementation complete
