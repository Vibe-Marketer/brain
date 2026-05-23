# Chat Architecture Documentation

This document describes the architecture of the CallVault AI Chat system, which provides RAG-powered conversational search across meeting transcripts.

## Table of Contents

1. [Overview](#overview)
2. [RAG Pipeline](#rag-pipeline)
3. [Tool Architecture](#tool-architecture)
4. [Streaming Protocol](#streaming-protocol)
5. [Database Schema](#database-schema)
6. [Model Switching](#model-switching)
7. [Session Filters](#session-filters)
8. [Edge Cases Handled](#edge-cases-handled)
9. [Frontend Architecture](#frontend-architecture)

---

## Overview

The chat system enables users to query their meeting transcripts using natural language. It combines:

- **Hybrid Search**: Semantic (vector) + keyword (full-text) search with RRF fusion
- **14 Specialized Tools**: Granular search capabilities for different query types
- **Multi-Model Support**: 300+ models via OpenRouter integration
- **Streaming Responses**: Real-time AI SDK v5 Data Stream Protocol
- **Persistent Sessions**: Full conversation history with filters

### Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React/Vite)                     │
│  Chat.tsx ─▶ useChat hook ─▶ DefaultChatTransport          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ SSE Stream
┌─────────────────────────────────────────────────────────────┐
│              Edge Function (Deno/Supabase)                   │
│  chat-stream/index.ts                                        │
│  - Auth validation                                           │
│  - OpenRouter streaming                                      │
│  - Tool execution                                            │
│  - AI SDK v5 Data Stream Protocol                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ SQL/RPC
┌─────────────────────────────────────────────────────────────┐
│              PostgreSQL (Supabase)                          │
│  - pgvector extension                                        │
│  - hybrid_search_transcripts RPC                            │
│  - transcript_chunks, chat_sessions, chat_messages          │
└─────────────────────────────────────────────────────────────┘
```

---

## RAG Pipeline

### Hybrid Search Implementation

The RAG pipeline uses Reciprocal Rank Fusion (RRF) to combine two search strategies:

1. **Semantic Search** (pgvector)
   - Embedding model: `text-embedding-3-small` (1536 dimensions)
   - Index: HNSW with `m=16, ef_construction=64`
   - Distance metric: Cosine (`<=>` operator)

2. **Full-Text Search** (PostgreSQL tsvector)
   - Weighted tsvector: chunk_text (A), speaker (B), title (C)
   - Query method: `websearch_to_tsquery`
   - Ranking: `ts_rank_cd`

### RRF Algorithm

```sql
rrf_score = semantic_weight / (rrf_k + semantic_rank) + full_text_weight / (rrf_k + fts_rank)
```

Default parameters:
- `rrf_k = 60` (controls rank influence falloff)
- `semantic_weight = 1.0`
- `full_text_weight = 1.0`

### Search Flow

```
User Query
    │
    ▼
┌──────────────────┐
│ Generate Embedding │ ◀── OpenAI text-embedding-3-small
└──────────────────┘
    │
    ▼
┌──────────────────┐
│ hybrid_search_   │
│ transcripts RPC  │
│                  │
│ ┌──────────────┐ │
│ │Semantic (HNSW)│ │
│ └──────────────┘ │
│        ∪         │
│ ┌──────────────┐ │
│ │ FTS (tsvector)│ │
│ └──────────────┘ │
│        ▼         │
│ RRF Fusion       │
└──────────────────┘
    │
    ▼
┌──────────────────┐
│ Re-ranking       │ ◀── HuggingFace cross-encoder/ms-marco-MiniLM-L-12-v2
│ (optional)       │     (with 1.5s timeout, batched, cached)
└──────────────────┘
    │
    ▼
┌──────────────────┐
│ Diversity Filter │ ◀── Max 5 chunks per recording
└──────────────────┘
    │
    ▼
Final Results (max 10-20 chunks)
```

### Re-ranking Optimization

Re-ranking uses HuggingFace Inference API with performance optimizations:
- **Batch size**: 10 candidates
- **Max candidates**: 30 (capped to prevent timeouts)
- **Timeout**: 1.5s per request (fail fast)
- **Fallback**: Uses RRF score if re-ranking fails

```typescript
// Re-ranking is gracefully degraded if API key missing or errors occur
if (!hfApiKey || candidates.length === 0) {
  return candidates.slice(0, topK); // Fall back to RRF ordering
}
```

---

## Tool Architecture

The edge function provides **14 specialized tools** organized into categories:

### Core Search Tools (4)

| Tool | Description | Use Case |
|------|-------------|----------|
| `searchTranscriptsByQuery` | General semantic + keyword search | "What did they say about X?" |
| `searchBySpeaker` | Filter by speaker name/email | "What did John say about pricing?" |
| `searchByDateRange` | Filter by date range | "Recent calls", "last week", "this month" |
| `searchByCategory` | Filter by call category | "Sales calls", "demos" |

### Metadata-Specific Tools (5)

| Tool | Description | Metadata Type |
|------|-------------|---------------|
| `searchByIntentSignal` | Find buying signals, objections, questions, concerns | `intent_signals[]` |
| `searchBySentiment` | Find positive, negative, neutral, mixed sentiment | `sentiment` |
| `searchByTopics` | Search auto-extracted topics | `topics[]` |
| `searchByUserTags` | Search user-assigned tags | `user_tags[]` |
| `searchByEntity` | Find mentions of companies, people, products | `entities JSONB` |

### Analytical Tools (3)

| Tool | Description |
|------|-------------|
| `getCallDetails` | Complete call info (title, date, participants, summary, URL) |
| `getCallsList` | List calls with filters and summary previews |
| `getAvailableMetadata` | Discover available speakers, categories, topics, etc. |

### Advanced Tools (2)

| Tool | Description |
|------|-------------|
| `advancedSearch` | Multi-dimensional search combining all filters |
| `compareCalls` | Compare 2-5 calls side-by-side |

### Tool Execution Flow

```typescript
// Edge function routes tool calls to handlers
switch (toolName) {
  case 'searchTranscriptsByQuery':
    return executeSearchTranscriptsByQuery(args, supabase, user, openaiApiKey, filters);
  case 'searchBySpeaker':
    return executeSearchBySpeaker(args, supabase, user, openaiApiKey);
  // ... 12 more tools
}
```

All search tools internally use `executeHybridSearch()` with appropriate metadata filters.

---

## Streaming Protocol

### AI SDK v5 Data Stream Protocol

The edge function implements the Vercel AI SDK v5 Data Stream Protocol for real-time streaming:

```
SSE Event Format:
data: {"type": "...", ...}\n\n
```

### Event Types

| Event | Description |
|-------|-------------|
| `start` | Message start with messageId |
| `start-step` | Begin a processing step |
| `text-start` | Begin text content with ID |
| `text-delta` | Incremental text content |
| `text-end` | End text content |
| `tool-input-start` | Tool call begins |
| `tool-input-delta` | Tool arguments streaming |
| `tool-input-available` | Tool input fully available |
| `tool-output-available` | Tool execution complete with result |
| `finish-step` | Step complete |
| `finish` | Message complete |
| `error` | Error occurred |

### Streaming Flow Example

```
data: {"type":"start","messageId":"abc-123"}

data: {"type":"start-step"}

data: {"type":"tool-input-start","toolCallId":"tc-1","toolName":"searchByDateRange"}

data: {"type":"tool-input-delta","toolCallId":"tc-1","inputTextDelta":"{\"date_"}

data: {"type":"tool-input-available","toolCallId":"tc-1","toolName":"searchByDateRange","input":{...}}

data: {"type":"tool-output-available","toolCallId":"tc-1","output":{...results...}}

data: {"type":"text-start","id":"text-1"}

data: {"type":"text-delta","id":"text-1","delta":"Based on your recent calls..."}

data: {"type":"text-end","id":"text-1"}

data: {"type":"finish-step"}

data: {"type":"finish"}

data: [DONE]
```

### Response Headers

```typescript
{
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
  'x-vercel-ai-ui-message-stream': 'v1', // AI SDK v5 identifier
}
```

---

## Database Schema

### Core Tables

#### `transcript_chunks`
Chunked transcript segments with embeddings for RAG search.

```sql
CREATE TABLE transcript_chunks (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  recording_id BIGINT REFERENCES fathom_calls(recording_id),

  -- Content
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,

  -- Vector embedding (1536 dimensions)
  embedding vector(1536),

  -- Speaker context
  speaker_name TEXT,
  speaker_email TEXT,
  timestamp_start TEXT,
  timestamp_end TEXT,

  -- Call metadata (denormalized)
  call_date TIMESTAMPTZ,
  call_title TEXT,
  call_category TEXT,

  -- Auto-extracted metadata
  topics TEXT[] DEFAULT '{}',
  sentiment TEXT,
  entities JSONB DEFAULT '{}',
  intent_signals TEXT[] DEFAULT '{}',

  -- User tags
  user_tags TEXT[] DEFAULT '{}',

  -- Full-text search vector (weighted)
  fts tsvector GENERATED ALWAYS AS (...) STORED,

  UNIQUE(recording_id, chunk_index)
);
```

#### `chat_sessions`
Conversation sessions with optional filters.

```sql
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),

  title TEXT,
  description TEXT,

  -- Active filters
  filter_date_start TIMESTAMPTZ,
  filter_date_end TIMESTAMPTZ,
  filter_speakers TEXT[] DEFAULT '{}',
  filter_categories TEXT[] DEFAULT '{}',
  filter_recording_ids BIGINT[] DEFAULT '{}',

  -- State
  is_archived BOOLEAN DEFAULT false,
  is_pinned BOOLEAN DEFAULT false,
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

#### `chat_messages`
Messages in Vercel AI SDK UIMessage format.

```sql
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES chat_sessions(id),
  user_id UUID REFERENCES auth.users(id),

  role TEXT CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT,
  parts JSONB,  -- UIMessage parts array

  model TEXT,
  finish_reason TEXT,

  -- Token tracking
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,

  created_at TIMESTAMPTZ
);
```

### Indexes

| Table | Index | Type | Purpose |
|-------|-------|------|---------|
| `transcript_chunks` | `idx_transcript_chunks_embedding` | HNSW | Vector similarity search |
| `transcript_chunks` | `idx_transcript_chunks_fts` | GIN | Full-text search |
| `transcript_chunks` | `idx_transcript_chunks_topics` | GIN | Topic array containment |
| `transcript_chunks` | `idx_transcript_chunks_user_tags` | GIN | Tag array containment |
| `transcript_chunks` | `idx_transcript_chunks_intent_signals` | GIN | Intent signal containment |
| `chat_messages` | `idx_chat_messages_session_order` | B-tree | Message ordering |

### RLS Policies

All tables have Row Level Security enabled with user isolation:

```sql
-- Users can only access their own data
CREATE POLICY "Users can read own chunks"
  ON transcript_chunks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role has full access (for edge functions)
CREATE POLICY "Service role full access"
  ON transcript_chunks FOR ALL
  TO service_role
  USING (true);
```

---

## Model Switching

### OpenRouter Integration

The system uses OpenRouter for multi-model access (300+ models):

```typescript
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

// OpenRouter is OpenAI-compatible
const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
  headers: {
    'Authorization': `Bearer ${openrouterApiKey}`,
    'HTTP-Referer': 'https://app.callvaultai.com',  // Required
    'X-Title': 'CallVault',                          // Required
  },
  body: JSON.stringify({
    model: 'openai/gpt-4o-mini',  // Format: provider/model-name
    messages,
    tools,
    stream: true,
  }),
});
```

### Model Format

Models use the format `provider/model-name`:
- `openai/gpt-4o-mini` (default - fast, cost-effective)
- `openai/gpt-4.1`
- `anthropic/claude-3-5-sonnet`
- `google/gemini-2.0-flash-exp`

### Embeddings (OpenAI Direct)

OpenRouter does not support embeddings, so we use OpenAI directly:

```typescript
// ALWAYS use OpenAI for embeddings
const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
  headers: { 'Authorization': `Bearer ${openaiApiKey}` },
  body: JSON.stringify({
    model: 'text-embedding-3-small',
    input: query,
  }),
});
```

### Frontend Model Selection

The `ModelSelector` component fetches available models from the `get-available-models` edge function and groups them by provider.

---

## Session Filters

### Filter Types

| Filter | Type | Description |
|--------|------|-------------|
| `date_start` | Date | Start of date range |
| `date_end` | Date | End of date range |
| `speakers` | String[] | Speaker names or emails |
| `categories` | String[] | Call categories |
| `recording_ids` | Number[] | Specific call IDs |

### Filter Flow

```
1. Frontend (Chat.tsx)
   - Filters stored in state and session
   - Passed to DefaultChatTransport body

2. Edge Function (chat-stream)
   - Extracts filters from request body
   - Falls back to session filters if none provided
   - Passes to all tool executions

3. Database (hybrid_search_transcripts)
   - Applies filters in WHERE clause
   - Filters applied before RRF fusion
```

### Context Attachments

Users can attach specific calls to their query via the "+ Add context" button:

```typescript
// Context attachments become filter_recording_ids
const inputWithContext = `[Context: @[${attachment.title}](recording:${attachment.id})]

${userInput}`;
```

---

## Edge Cases Handled

### 1. Empty Transcript Database

When user has no transcripts, show onboarding message:

```tsx
// Chat.tsx
{availableCalls.length === 0 ? (
  <ChatWelcome
    greeting="Upload transcripts to start chatting"
    subtitle="Once you have meeting transcripts, you can search, analyze..."
    quickActions={[
      { label: 'Upload Transcripts', onClick: () => navigate('/transcripts') }
    ]}
  />
) : (
  <ChatWelcome onSuggestionClick={handleSuggestionClick} />
)}
```

### 2. No Matching RAG Results

Tools return user-friendly messages when no results found:

```typescript
if (!candidates || candidates.length === 0) {
  return { message: 'I could not find relevant information in your transcripts for this query.' };
}
```

### 3. Rate Limiting (429)

Rate limit detection with countdown toast:

```typescript
function isRateLimitError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('429');
}

function extractRetryAfterSeconds(error: unknown): number {
  // Extract from "retry after 30 seconds", "retry-after: 30", "wait 30s"
  // Default: 30 seconds, Max: 300 seconds (5 minutes)
}
```

UI during cooldown:
- Toast shows countdown: "Rate limit exceeded. Please wait X seconds..."
- Input and send button disabled
- Success toast when cooldown completes

### 4. Streaming Interruption (Network Issues)

Auto-reconnect with exponential backoff:

```typescript
const MAX_RECONNECT_ATTEMPTS = 3;
const BASE_RECONNECT_DELAY = 1000; // 1s, 2s, 4s

if (isStreamingInterruptionError(error) && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
  const delay = BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts);
  toast.loading(`Reconnecting (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);

  setTimeout(() => {
    sendMessage({ text: lastUserMessage });
  }, delay);
}
```

Detection patterns:
- AbortError, network, failed to fetch
- connection, ECONNRESET, ETIMEDOUT
- stream, readable, fetch failed

### 5. Missing Citation Data

Graceful degradation in source citations:

```typescript
// source.tsx - chunk_text is optional
interface SourceChunk {
  id: string;
  recording_id: number;
  chunk_text?: string;  // Optional - may be missing
  call_title: string;
  // ...
}

// Fallback when text missing
{chunk_text || "Content preview unavailable for this source."}
```

### 6. Session Expiration

Auth error detection and session refresh:

```typescript
if (friendlyError.title === 'Session Expired') {
  const { session: refreshedSession } = await supabase.auth.getSession();

  if (!refreshedSession) {
    toast.error('Session expired. Please sign in again.');
    navigate('/login');
  } else {
    toast.info('Session refreshed - please try again');
  }
}
```

---

## Frontend Architecture

### Key Components

| Component | Purpose |
|-----------|---------|
| `Chat.tsx` | Main chat page with 3-pane layout |
| `ChatSidebar.tsx` | Session list with pin/archive/delete |
| `ChatWelcome.tsx` | Empty state with suggestions |
| `ModelSelector.tsx` | Model dropdown with provider grouping |
| `ToolCall.tsx` | Tool execution display with states |
| `Sources.tsx` | Citation cards with hover preview |
| `ThinkingLoader.tsx` | Streaming indicator |

### State Management

```typescript
// useChat from AI SDK - manages message state and streaming
const { messages, sendMessage, status, error, setMessages } = useChat({
  transport: new DefaultChatTransport({
    api: `${SUPABASE_URL}/functions/v1/chat-stream`,
    headers: { Authorization: `Bearer ${token}` },
    body: { filters, model, sessionId },
  }),
});

// useChatSession - manages persistence
const { sessions, fetchMessages, createSession, saveMessages, ... } = useChatSession(userId);
```

### Message Persistence

Messages are saved with 500ms debounce to avoid excessive DB writes:

```typescript
const debouncedSaveMessages = useMemo(() => {
  let timeoutId;
  return (msgs, sessionId, model) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(async () => {
      await saveMessages({ sessionId, messages: msgs, model });
    }, 500);
  };
}, [saveMessages]);
```

### Tool State Mapping

AI SDK v5 states are mapped to UI states:

| AI SDK State | UI State |
|--------------|----------|
| `input-streaming` | `running` |
| `input-available` | `running` |
| `output-available` | `success` |
| `output-error` | `error` |

---

## Environment Variables

### Frontend (.env)

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Edge Functions

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-key
OPENAI_API_KEY=sk-...              # For embeddings
OPENROUTER_API_KEY=sk-or-v1-...    # For chat completions
HUGGINGFACE_API_KEY=hf_...          # Optional - for re-ranking
```

---

## Testing

### Unit Tests
- `src/hooks/__tests__/useChatSession.test.ts` - Session management, message deduplication
- `src/pages/__tests__/Chat.edgecases.test.tsx` - Edge case handlers

### E2E Tests
- `e2e/chat-session-persistence.spec.ts` - Session creation and persistence
- `e2e/chat-rag-search-citations.spec.ts` - RAG search and citations
- `e2e/chat-model-selection.spec.ts` - Model switching
- `e2e/chat-context-attachments.spec.ts` - Context filter attachments
- `e2e/chat-streaming-tool-calls.spec.ts` - Streaming and tool states
- `e2e/chat-interface.spec.ts` - Complete chat flows

### Manual Verification
```bash
# Test chat-stream edge function
./scripts/test-chat-stream.sh

# Run all E2E tests
npx playwright test e2e/chat-*.spec.ts
```

---

## Performance Considerations

1. **HNSW Index**: `m=16, ef_construction=64` balances speed and recall
2. **Re-ranking Timeout**: 1.5s per request with graceful fallback
3. **Diversity Filter**: Max 5 chunks per recording prevents repetition
4. **Debounced Save**: 500ms delay batches rapid message updates
5. **Transport Memoization**: Prevents recreating transport on filter changes

---

## Security

1. **RLS Policies**: All tables enforce `user_id = auth.uid()`
2. **Service Role**: Edge functions use service role for cross-user queries
3. **API Keys**: All keys loaded from `Deno.env.get()`, never hardcoded
4. **Auth Validation**: JWT token validated on every edge function request
5. **CORS**: Proper headers for API responses
