# PRP: AI Chat Interface with Visual Agent Builder & Hybrid RAG Knowledge Base

**Project:** CallVault - AI Chat Agent System
**Status:** Planning
**Created:** 2025-01-23
**Last Updated:** 2025-01-23
**Complexity:** Epic (Multi-Sprint)
**Estimated Effort:** 8-12 weeks

---

## EXECUTIVE SUMMARY

Implement a comprehensive AI chat system for CallVault that enables users to interact with their transcript knowledge base through:

1. **Prompt-Kit Chat Interface** - Modern streaming chat UI with Vercel AI SDK integration
2. **Visual Agent Builder** - React Flow-based canvas for creating and configuring AI agents
3. **Hybrid RAG Knowledge Base** - Temporal & relational semantic search over transcripts using pgvector
4. **Agent Orchestration** - Multi-agent workflows with tool calling and state management

This system transforms CallVault from a passive transcript storage tool into an active conversational intelligence platform.

---

## TABLE OF CONTENTS

1. [Context & Motivation](#context--motivation)
2. [Technical Architecture](#technical-architecture)
3. [Database Schema Design](#database-schema-design)
4. [Component Breakdown](#component-breakdown)
5. [Implementation Phases](#implementation-phases)
6. [Architecture Decision Records](#architecture-decision-records)
7. [Success Criteria](#success-criteria)
8. [Risk Mitigation](#risk-mitigation)
9. [Future Enhancements](#future-enhancements)

---

## CONTEXT & MOTIVATION

### Current State

CallVault currently:

- Stores meeting transcripts from Fathom/Zoom in `fathom_transcripts` table
- Provides manual search and filtering capabilities
- Allows category-based organization
- Offers export functionality

### Problem Statement

Users cannot:

- **Ask natural language questions** about their transcript data
- **Get AI-generated insights** from patterns across multiple meetings
- **Build custom AI workflows** without coding
- **Search semantically** across transcript content with temporal/relational context

### Desired State

Users will be able to:

- Chat with their transcript knowledge base using natural language
- Visually design AI agents that perform specific tasks (e.g., "Find all pain points mentioned in Q4 sales calls")
- Get answers that understand temporal context ("What changed in customer objections over time?")
- Create reusable agent workflows for recurring analysis needs

---

## TECHNICAL ARCHITECTURE

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND LAYER                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐    ┌──────────────────┐   ┌────────────┐ │
│  │  Prompt-Kit Chat │    │  Agent Builder   │   │   Inbox    │ │
│  │   Components     │    │  (ReactFlow)     │   │   View     │ │
│  └──────────────────┘    └──────────────────┘   └────────────┘ │
│           │                       │                     │        │
│           └───────────────────────┴─────────────────────┘        │
│                              │                                   │
│                    ┌─────────▼──────────┐                       │
│                    │  Vercel AI SDK     │                       │
│                    │  (useChat hook)    │                       │
│                    └─────────┬──────────┘                       │
└──────────────────────────────┼───────────────────────────────────┘
                               │ SSE Stream
┌──────────────────────────────▼───────────────────────────────────┐
│                      SUPABASE EDGE FUNCTIONS                      │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐    ┌─────────────────┐  ┌──────────────┐ │
│  │  chat-stream/    │    │  agent-execute/ │  │ embed-chunk/ │ │
│  │  (streaming)     │    │  (workflow)     │  │  (indexing)  │ │
│  └──────────────────┘    └─────────────────┘  └──────────────┘ │
│           │                       │                    │         │
│           └───────────────────────┴────────────────────┘         │
│                              │                                   │
│                    ┌─────────▼──────────┐                       │
│                    │  AI SDK Agent      │                       │
│                    │  ToolLoopAgent     │                       │
│                    └─────────┬──────────┘                       │
└──────────────────────────────┼───────────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────────┐
│                      POSTGRESQL + PGVECTOR                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  KNOWLEDGE BASE (Hybrid RAG)                               │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │  • transcript_chunks (embeddings + metadata)               │ │
│  │  • transcript_chunk_relationships (speaker, temporal)      │ │
│  │  • semantic_search_index (pgvector HNSW)                   │ │
│  │  • keyword_search_index (tsvector GIN)                     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  AGENT CONFIGURATION                                       │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │  • ai_agents (agent definitions)                           │ │
│  │  • agent_nodes (ReactFlow nodes)                           │ │
│  │  • agent_edges (ReactFlow edges)                           │ │
│  │  • agent_executions (run history)                          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  CHAT HISTORY                                              │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │  • chat_sessions (conversations)                           │ │
│  │  • chat_messages (UIMessages)                              │ │
│  │  • chat_tool_calls (tool invocations)                      │ │
│  └────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────┘
```

### Technology Stack

#### Frontend

- **Chat UI:** prompt-kit components (shadcn/ui + Tailwind)
- **Agent Builder:** ReactFlow 12.x (visual workflow canvas)
- **State Management:** @tanstack/react-query (existing)
- **AI Integration:** @ai-sdk/react (`useChat` hook)
- **Styling:** Tailwind CSS (following brand-guidelines-v3.3.md)

#### Backend

- **Runtime:** Deno (Supabase Edge Functions)
- **AI SDK:** Vercel AI SDK v6 beta (ToolLoopAgent)
- **LLM Provider:** OpenAI GPT-4 Turbo (via @ai-sdk/openai)
- **Embeddings:** text-embedding-3-small (1536 dimensions)
- **Vector Search:** pgvector (HNSW index)
- **Hybrid Search:** RRF (Reciprocal Rank Fusion)

#### Database

- **Platform:** Supabase PostgreSQL
- **Extensions:** pgvector, pg_trgm (for keyword search)
- **RLS:** Multi-tenant isolation by user_id

---

## DATABASE SCHEMA DESIGN

### Knowledge Base Tables

```sql
-- =============================================
-- TRANSCRIPT KNOWLEDGE BASE
-- =============================================

-- Chunked transcript segments with embeddings
CREATE TABLE IF NOT EXISTS public.transcript_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  recording_id BIGINT REFERENCES public.fathom_calls(recording_id) ON DELETE CASCADE NOT NULL,

  -- Content
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL, -- Order within recording

  -- Embeddings (1536 dimensions for text-embedding-3-small)
  embedding vector(1536),

  -- Metadata for hybrid search
  speaker_name TEXT,
  speaker_email TEXT,
  timestamp_in_call TEXT,

  -- Temporal context
  call_date TIMESTAMPTZ, -- Date of the meeting
  call_category TEXT, -- e.g., "sales", "coaching"

  -- Full-text search
  fts tsvector GENERATED ALWAYS AS (to_tsvector('english', chunk_text)) STORED,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(recording_id, chunk_index)
);

CREATE INDEX idx_transcript_chunks_user_id ON public.transcript_chunks(user_id);
CREATE INDEX idx_transcript_chunks_recording_id ON public.transcript_chunks(recording_id);
CREATE INDEX idx_transcript_chunks_call_date ON public.transcript_chunks(call_date);
CREATE INDEX idx_transcript_chunks_embedding ON public.transcript_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_transcript_chunks_fts ON public.transcript_chunks USING gin(fts);

COMMENT ON TABLE public.transcript_chunks IS 'Chunked transcript segments with vector embeddings for hybrid RAG search';
COMMENT ON COLUMN public.transcript_chunks.embedding IS 'Vector embedding using text-embedding-3-small (1536 dimensions)';
COMMENT ON COLUMN public.transcript_chunks.fts IS 'Full-text search vector for keyword matching';

-- =============================================
-- Chunk relationships (for graph-based context)
CREATE TABLE IF NOT EXISTS public.transcript_chunk_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Relationship type
  relationship_type TEXT NOT NULL, -- 'speaker_continuation', 'temporal_sequence', 'topic_similarity'

  -- Source and target chunks
  source_chunk_id UUID REFERENCES public.transcript_chunks(id) ON DELETE CASCADE NOT NULL,
  target_chunk_id UUID REFERENCES public.transcript_chunks(id) ON DELETE CASCADE NOT NULL,

  -- Relationship strength (0-1)
  weight DECIMAL(3,2) DEFAULT 1.0,

  -- Metadata
  metadata JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(source_chunk_id, target_chunk_id, relationship_type)
);

CREATE INDEX idx_chunk_rels_source ON public.transcript_chunk_relationships(source_chunk_id);
CREATE INDEX idx_chunk_rels_target ON public.transcript_chunk_relationships(target_chunk_id);
CREATE INDEX idx_chunk_rels_type ON public.transcript_chunk_relationships(relationship_type);

COMMENT ON TABLE public.transcript_chunk_relationships IS 'Graph relationships between transcript chunks for contextual retrieval';
```

### Agent Configuration Tables

```sql
-- =============================================
-- AI AGENT CONFIGURATION
-- =============================================

-- Agent definitions
CREATE TABLE IF NOT EXISTS public.ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Agent metadata
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT, -- Remix icon name

  -- Agent configuration
  model TEXT NOT NULL DEFAULT 'openai/gpt-4o', -- Model identifier
  system_instructions TEXT,
  temperature DECIMAL(2,1) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 4000,
  max_steps INTEGER DEFAULT 20, -- For tool loop

  -- Workflow definition (ReactFlow graph)
  workflow_definition JSONB, -- Stores nodes and edges

  -- Tool configuration
  enabled_tools TEXT[] DEFAULT '{}', -- Array of tool names
  tool_configurations JSONB, -- Tool-specific settings

  -- Publishing
  is_published BOOLEAN DEFAULT false,
  is_favorite BOOLEAN DEFAULT false,

  -- Usage tracking
  execution_count INTEGER DEFAULT 0,
  last_executed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_agents_user_id ON public.ai_agents(user_id);
CREATE INDEX idx_ai_agents_is_published ON public.ai_agents(is_published) WHERE is_published = true;

COMMENT ON TABLE public.ai_agents IS 'User-defined AI agents with visual workflow configurations';
COMMENT ON COLUMN public.ai_agents.workflow_definition IS 'ReactFlow graph: {nodes: [], edges: []}';

-- =============================================
-- Agent execution history
CREATE TABLE IF NOT EXISTS public.agent_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  agent_id UUID REFERENCES public.ai_agents(id) ON DELETE CASCADE NOT NULL,

  -- Execution details
  status TEXT NOT NULL, -- 'running', 'completed', 'failed'
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Input/Output
  input_prompt TEXT NOT NULL,
  output_text TEXT,

  -- Execution metadata
  steps_taken INTEGER,
  tools_used TEXT[],
  tokens_used INTEGER,
  execution_time_ms INTEGER,

  -- Error tracking
  error_message TEXT,
  error_stack TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_execs_user_id ON public.agent_executions(user_id);
CREATE INDEX idx_agent_execs_agent_id ON public.agent_executions(agent_id);
CREATE INDEX idx_agent_execs_status ON public.agent_executions(status);
CREATE INDEX idx_agent_execs_started_at ON public.agent_executions(started_at DESC);

COMMENT ON TABLE public.agent_executions IS 'Execution history and telemetry for agent runs';
```

### Chat Session Tables

```sql
-- =============================================
-- CHAT SESSIONS
-- =============================================

-- Chat conversations
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  agent_id UUID REFERENCES public.ai_agents(id) ON DELETE SET NULL, -- Optional: tied to specific agent

  -- Session metadata
  title TEXT, -- Auto-generated or user-provided
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  message_count INTEGER DEFAULT 0,

  -- Session context
  metadata JSONB, -- Store additional context

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_sessions_user_id ON public.chat_sessions(user_id);
CREATE INDEX idx_chat_sessions_agent_id ON public.chat_sessions(agent_id);
CREATE INDEX idx_chat_sessions_last_message ON public.chat_sessions(last_message_at DESC);

COMMENT ON TABLE public.chat_sessions IS 'Chat conversation sessions';

-- =============================================
-- Chat messages (UIMessage format)
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Message content (Vercel AI SDK UIMessage format)
  role TEXT NOT NULL, -- 'user', 'assistant', 'system'
  parts JSONB NOT NULL, -- Array of parts: text, tool-call, tool-result

  -- Metadata
  model TEXT, -- Model used for assistant messages
  tokens_used INTEGER,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_session_id ON public.chat_messages(session_id);
CREATE INDEX idx_chat_messages_user_id ON public.chat_messages(user_id);
CREATE INDEX idx_chat_messages_created_at ON public.chat_messages(created_at);

COMMENT ON TABLE public.chat_messages IS 'Chat messages in Vercel AI SDK UIMessage format';
COMMENT ON COLUMN public.chat_messages.parts IS 'UIMessage parts: [{type: "text", text: "..."}, {type: "tool-call", toolName: "...", ...}]';

-- =============================================
-- Tool call tracking
CREATE TABLE IF NOT EXISTS public.chat_tool_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES public.chat_messages(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Tool information
  tool_name TEXT NOT NULL,
  tool_input JSONB NOT NULL,
  tool_output JSONB,

  -- Execution tracking
  status TEXT NOT NULL, -- 'pending', 'success', 'error'
  error_message TEXT,
  execution_time_ms INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tool_calls_message_id ON public.chat_tool_calls(message_id);
CREATE INDEX idx_tool_calls_session_id ON public.chat_tool_calls(session_id);
CREATE INDEX idx_tool_calls_tool_name ON public.chat_tool_calls(tool_name);

COMMENT ON TABLE public.chat_tool_calls IS 'Tool invocations from chat sessions for analytics';
```

### Hybrid Search Function

```sql
-- =============================================
-- HYBRID SEARCH FUNCTION (RRF)
-- =============================================

CREATE OR REPLACE FUNCTION public.hybrid_search_transcripts(
  query_text TEXT,
  query_embedding vector(1536),
  match_count INT DEFAULT 10,
  full_text_weight DECIMAL DEFAULT 1.0,
  semantic_weight DECIMAL DEFAULT 1.0,
  filter_user_id UUID DEFAULT NULL,
  filter_date_range TSTZRANGE DEFAULT NULL,
  filter_categories TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  chunk_id UUID,
  recording_id BIGINT,
  chunk_text TEXT,
  speaker_name TEXT,
  call_date TIMESTAMPTZ,
  call_category TEXT,
  similarity_score DECIMAL,
  rank_score DECIMAL
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH semantic_search AS (
    SELECT
      tc.id,
      ROW_NUMBER() OVER (ORDER BY tc.embedding <=> query_embedding) AS rank
    FROM public.transcript_chunks tc
    WHERE
      (filter_user_id IS NULL OR tc.user_id = filter_user_id)
      AND (filter_date_range IS NULL OR tc.call_date <@ filter_date_range)
      AND (filter_categories IS NULL OR tc.call_category = ANY(filter_categories))
    ORDER BY tc.embedding <=> query_embedding
    LIMIT LEAST(match_count, 30) * 2
  ),
  full_text_search AS (
    SELECT
      tc.id,
      ROW_NUMBER() OVER (ORDER BY ts_rank(tc.fts, websearch_to_tsquery('english', query_text)) DESC) AS rank
    FROM public.transcript_chunks tc
    WHERE
      tc.fts @@ websearch_to_tsquery('english', query_text)
      AND (filter_user_id IS NULL OR tc.user_id = filter_user_id)
      AND (filter_date_range IS NULL OR tc.call_date <@ filter_date_range)
      AND (filter_categories IS NULL OR tc.call_category = ANY(filter_categories))
    ORDER BY ts_rank(tc.fts, websearch_to_tsquery('english', query_text)) DESC
    LIMIT LEAST(match_count, 30) * 2
  )
  SELECT
    tc.id AS chunk_id,
    tc.recording_id,
    tc.chunk_text,
    tc.speaker_name,
    tc.call_date,
    tc.call_category,
    (1.0 - (tc.embedding <=> query_embedding))::DECIMAL AS similarity_score,
    (
      COALESCE(semantic_weight / ss.rank, 0.0) +
      COALESCE(full_text_weight / fts.rank, 0.0)
    )::DECIMAL AS rank_score
  FROM public.transcript_chunks tc
  FULL OUTER JOIN semantic_search ss ON tc.id = ss.id
  FULL OUTER JOIN full_text_search fts ON tc.id = fts.id
  WHERE ss.id IS NOT NULL OR fts.id IS NOT NULL
  ORDER BY rank_score DESC
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION public.hybrid_search_transcripts IS 'Hybrid search using RRF (Reciprocal Rank Fusion) combining semantic and keyword search';
```

---

## COMPONENT BREAKDOWN

### Frontend Components

#### 1. Chat Interface (`/chat`)

**Location:** `src/pages/Chat.tsx`

**Components:**

```
src/components/chat/
├── ChatContainer.tsx           # Main chat layout (prompt-kit)
├── ChatMessageList.tsx         # Message display area
├── ChatMessage.tsx             # Individual message component
├── ChatInput.tsx               # Prompt input (prompt-kit)
├── ChatToolCall.tsx            # Tool invocation display
├── ChatSources.tsx             # Source citations
├── ChatSessionSidebar.tsx      # Session list
└── ChatHeader.tsx              # Session info + actions
```

**Key Features:**

- Real-time streaming responses
- Tool call visualization
- Source citation (transcript chunks)
- Session management
- Markdown rendering (react-markdown)
- Code block syntax highlighting

**Hooks:**

```typescript
// src/hooks/useChat.ts
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

export function useChatSession(sessionId?: string) {
  return useChat({
    id: sessionId,
    transport: new DefaultChatTransport({
      api: '/api/chat-stream',
      prepareSendMessagesRequest: ({ id, messages }) => ({
        body: {
          sessionId: id,
          message: messages[messages.length - 1],
        },
      }),
    }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onToolCall: async ({ toolCall }) => {
      // Handle client-side tools if needed
    },
  });
}
```

#### 2. Agent Builder (`/agents/builder`)

**Location:** `src/pages/AgentBuilder.tsx`

**Components:**

```
src/components/agent-builder/
├── AgentCanvas.tsx             # ReactFlow canvas container
├── AgentNodeTypes.tsx          # Custom node components
│   ├── LLMNode.tsx            # Model configuration node
│   ├── ToolNode.tsx           # Tool selection node
│   ├── SearchNode.tsx         # RAG search node
│   ├── ConditionNode.tsx      # Conditional routing node
│   └── OutputNode.tsx         # Final output node
├── AgentEdgeTypes.tsx          # Custom edge components
├── AgentSidebar.tsx            # Tool palette
├── AgentConfigPanel.tsx        # Node configuration
├── AgentToolbar.tsx            # Canvas controls
└── AgentTestPanel.tsx          # Testing interface
```

**Node Types:**

```typescript
// src/components/agent-builder/types.ts
export type AgentNodeType =
  | 'llm'           // LLM generation step
  | 'tool'          // Tool execution
  | 'search'        // RAG search
  | 'condition'     // Conditional routing
  | 'output';       // Final output

export interface AgentNodeData {
  label: string;
  config: Record<string, any>;
  validated: boolean;
}

export interface AgentNode extends Node {
  type: AgentNodeType;
  data: AgentNodeData;
}
```

**ReactFlow Integration:**

```typescript
// src/pages/AgentBuilder.tsx
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
} from 'reactflow';

const nodeTypes = {
  llm: LLMNode,
  tool: ToolNode,
  search: SearchNode,
  condition: ConditionNode,
  output: OutputNode,
};

export function AgentBuilder() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const handleSave = async () => {
    await saveAgent({
      workflow_definition: { nodes, edges },
      // ... other config
    });
  };

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      fitView
    >
      <Background />
      <Controls />
      <MiniMap />
    </ReactFlow>
  );
}
```

#### 3. Agent Inbox (`/agents/inbox`)

**Location:** `src/pages/AgentInbox.tsx`

**Components:**

```
src/components/agent-inbox/
├── AgentList.tsx               # Grid/list of agents
├── AgentCard.tsx               # Agent preview card
├── AgentExecutionHistory.tsx   # Execution timeline
├── AgentExecutionDetail.tsx    # Run details modal
└── AgentQuickActions.tsx       # Run, edit, delete actions
```

**Features:**

- Published agents library
- Execution history
- Quick run interface
- Performance metrics
- Favorite agents

### Backend Edge Functions

#### 1. Chat Streaming Function

**Location:** `supabase/functions/chat-stream/index.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import { openai } from '@ai-sdk/openai';
import { ToolLoopAgent } from 'ai';
import { searchTranscripts } from '../_shared/rag-search.ts';
import { generateEmbedding } from '../_shared/embeddings.ts';

Deno.serve(async (req) => {
  const { sessionId, message } = await req.json();

  // Initialize Supabase client
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Load conversation history
  const { data: messages } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  // Create agent with RAG tool
  const agent = new ToolLoopAgent({
    model: openai('gpt-4-turbo'),
    instructions: `You are a helpful assistant for CallVault.
    You help users analyze their meeting transcripts and extract insights.
    Always cite sources with recording IDs when providing information.`,

    tools: {
      searchTranscripts: {
        description: 'Search meeting transcripts semantically and by keywords',
        inputSchema: z.object({
          query: z.string().describe('The search query'),
          dateRange: z.object({
            start: z.string().optional(),
            end: z.string().optional(),
          }).optional(),
          categories: z.array(z.string()).optional(),
        }),
        execute: async ({ query, dateRange, categories }) => {
          const embedding = await generateEmbedding(query);
          const results = await searchTranscripts(
            query,
            embedding,
            { dateRange, categories }
          );
          return results;
        },
      },
    },
    stopWhen: stepCountIs(10),
  });

  // Stream response
  const { stream } = await agent.stream({
    prompt: message.parts.find(p => p.type === 'text')?.text || '',
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
});
```

#### 2. Agent Execution Function

**Location:** `supabase/functions/agent-execute/index.ts`

```typescript
import { ToolLoopAgent } from 'ai';

Deno.serve(async (req) => {
  const { agentId, prompt, userId } = await req.json();

  // Load agent configuration
  const { data: agentConfig } = await supabase
    .from('ai_agents')
    .select('*')
    .eq('id', agentId)
    .single();

  // Build agent from workflow definition
  const agent = buildAgentFromWorkflow(agentConfig);

  // Execute and track
  const executionId = crypto.randomUUID();
  await trackExecution(executionId, 'running');

  try {
    const result = await agent.generate({ prompt });

    await trackExecution(executionId, 'completed', {
      output: result.text,
      steps: result.steps.length,
      tokensUsed: result.usage.totalTokens,
    });

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    await trackExecution(executionId, 'failed', { error });
    throw error;
  }
});
```

#### 3. Embedding/Indexing Function

**Location:** `supabase/functions/embed-chunk/index.ts`

```typescript
import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';

Deno.serve(async (req) => {
  const { recordingId, userId } = await req.json();

  // Get full transcript
  const { data: segments } = await supabase
    .from('fathom_transcripts')
    .select('*')
    .eq('recording_id', recordingId)
    .order('timestamp');

  // Chunk transcript (500 tokens per chunk)
  const chunks = chunkTranscript(segments, 500);

  // Generate embeddings in batch
  const { embeddings } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    values: chunks.map(c => c.text),
  });

  // Insert chunks with embeddings
  const chunksToInsert = chunks.map((chunk, idx) => ({
    user_id: userId,
    recording_id: recordingId,
    chunk_text: chunk.text,
    chunk_index: idx,
    embedding: embeddings[idx],
    speaker_name: chunk.speaker,
    timestamp_in_call: chunk.timestamp,
    call_date: chunk.callDate,
    call_category: chunk.category,
  }));

  await supabase
    .from('transcript_chunks')
    .upsert(chunksToInsert, {
      onConflict: 'recording_id,chunk_index',
    });

  // Build relationships
  await buildChunkRelationships(recordingId);

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

### Reusable Components Matrix

| Component | Location | Reusability | Dependencies |
|-----------|----------|-------------|--------------|
| `ChatContainer` | `components/chat/` | High | prompt-kit, @ai-sdk/react |
| `ChatMessage` | `components/chat/` | High | react-markdown, remix-icon |
| `AgentCanvas` | `components/agent-builder/` | Medium | reactflow |
| `AgentNode*` | `components/agent-builder/` | Medium | reactflow, radix-ui |
| `RAGSearchTool` | Edge Function shared | High | ai, pgvector |
| `HybridSearch` | Database function | High | pgvector, pg_trgm |

---

## IMPLEMENTATION PHASES

### Phase 1: Foundation (Week 1-2)

**Goal:** Set up database schema and basic indexing

**Tasks:**

1. ✅ **Create database migrations**
   - `transcript_chunks` table
   - `transcript_chunk_relationships` table
   - `hybrid_search_transcripts()` function
   - Indexes (HNSW, GIN, B-tree)

2. ✅ **Implement embedding generation**
   - Edge Function: `embed-chunk/`
   - Chunking logic (500 tokens)
   - Batch embedding with text-embedding-3-small
   - Relationship building (speaker continuity, temporal)

3. ✅ **Index existing transcripts**
   - Backfill script for existing `fathom_transcripts`
   - Progress tracking
   - Error handling

**Deliverables:**

- Database schema deployed
- Embedding function working
- All existing transcripts indexed
- Hybrid search tested

**Acceptance Criteria:**

- [ ] Can search transcripts semantically
- [ ] Keyword search works
- [ ] Hybrid RRF returns relevant results
- [ ] Query performance < 200ms for 10 results

---

### Phase 2: Chat Interface (Week 3-4)

**Goal:** Build basic chat UI with streaming

**Tasks:**

1. ✅ **Set up chat UI components**
   - Install prompt-kit components
   - Create `ChatContainer`, `ChatMessage`, `ChatInput`
   - Implement markdown rendering
   - Add code syntax highlighting

2. ✅ **Implement chat streaming**
   - Edge Function: `chat-stream/`
   - Vercel AI SDK integration
   - `useChat` hook setup
   - SSE streaming

3. ✅ **Create chat session management**
   - `chat_sessions` table
   - `chat_messages` table
   - Session CRUD operations
   - Session sidebar

4. ✅ **Integrate RAG search tool**
   - `searchTranscripts` tool definition
   - Hybrid search integration
   - Source citation formatting

**Deliverables:**

- Functional chat interface at `/chat`
- Real-time streaming working
- RAG search integrated
- Session persistence

**Acceptance Criteria:**

- [ ] User can send messages and receive streaming responses
- [ ] Tool calls are displayed
- [ ] Sources are cited with recording IDs
- [ ] Sessions persist across page reloads

---

### Phase 3: Visual Agent Builder (Week 5-7)

**Goal:** Enable visual agent configuration

**Tasks:**

1. ✅ **Set up ReactFlow canvas**
   - Install reactflow
   - Create `AgentCanvas` component
   - Implement drag-and-drop
   - Add zoom/pan controls

2. ✅ **Create node types**
   - LLMNode (model config)
   - ToolNode (tool selection)
   - SearchNode (RAG config)
   - ConditionNode (routing logic)
   - OutputNode (final result)

3. ✅ **Implement node configuration**
   - Config panel for each node type
   - Validation logic
   - Real-time preview

4. ✅ **Build agent persistence**
   - `ai_agents` table
   - Save/load workflow definitions
   - Version control

5. ✅ **Create agent execution**
   - Edge Function: `agent-execute/`
   - Workflow interpreter
   - `ToolLoopAgent` builder from graph
   - Execution tracking

**Deliverables:**

- Agent builder UI at `/agents/builder`
- 5 node types implemented
- Agent save/load working
- Agent execution functional

**Acceptance Criteria:**

- [ ] User can create agent workflow visually
- [ ] Agent can be saved and loaded
- [ ] Agent executes correctly based on workflow
- [ ] Execution history is tracked

---

### Phase 4: Agent Inbox & Polish (Week 8-9)

**Goal:** Complete agent management experience

**Tasks:**

1. ✅ **Build agent inbox**
   - Agent list/grid view
   - Agent card components
   - Execution history timeline
   - Quick run interface

2. ✅ **Add agent management**
   - Publish/unpublish agents
   - Favorite agents
   - Duplicate agent
   - Delete agent

3. ✅ **Implement execution details**
   - Execution detail modal
   - Step-by-step breakdown
   - Token usage visualization
   - Performance metrics

4. ✅ **UI/UX polish**
   - Brand guidelines compliance
   - Responsive design
   - Loading states
   - Error handling
   - Empty states

**Deliverables:**

- Agent inbox at `/agents/inbox`
- Agent management CRUD
- Execution history viewer
- Polished UI

**Acceptance Criteria:**

- [ ] User can view all published agents
- [ ] Execution history is accessible
- [ ] UI follows brand-guidelines-v3.3.md
- [ ] Responsive on mobile/tablet

---

### Phase 5: Advanced Features (Week 10-12)

**Goal:** Add advanced capabilities

**Tasks:**

1. ✅ **Multi-agent orchestration**
   - Agent routing node
   - Sub-agent invocation
   - Result aggregation

2. ✅ **Temporal queries**
   - Time-series analysis tool
   - Trend detection
   - Comparative analysis

3. ✅ **Export capabilities**
   - Export chat sessions
   - Export agent results
   - PDF/CSV/JSON formats

4. ✅ **Performance optimization**
   - Implement query caching
   - Optimize embedding generation
   - Add request batching

**Deliverables:**

- Multi-agent support
- Temporal analysis tool
- Export functionality
- Performance improvements

**Acceptance Criteria:**

- [ ] Agents can invoke other agents
- [ ] Temporal queries return accurate trends
- [ ] Exports maintain formatting
- [ ] Query performance improved by 50%

---

## ARCHITECTURE DECISION RECORDS

### ADR-001: Vercel AI SDK for Agent Framework

**Context:**
Need a robust, production-ready framework for building AI agents with tool calling, streaming, and multi-step orchestration.

**Decision:**
Use Vercel AI SDK v6 beta with `ToolLoopAgent` class.

**Rationale:**

- Native streaming support (SSE)
- Built-in tool calling with Zod validation
- Agent abstraction reduces boilerplate
- Excellent React integration (`useChat`, `useCompletion`)
- Active development and community
- Supports multiple LLM providers

**Alternatives Considered:**

- LangChain: More complex, heavier dependencies
- Custom implementation: Too much reinvention
- OpenAI Assistants API: Vendor lock-in, less flexibility

**Consequences:**

- Beta software risk (pin versions)
- Learning curve for team
- Dependency on Vercel ecosystem
- Benefit: Rapid development, fewer bugs

---

### ADR-002: ReactFlow for Visual Agent Builder

**Context:**
Need a visual canvas for users to design agent workflows without coding.

**Decision:**
Use ReactFlow 12.x for visual workflow builder.

**Rationale:**

- Mature library (2.79M weekly downloads)
- React-first architecture
- Extensive customization (custom nodes/edges)
- Built-in features (zoom, pan, minimap)
- TypeScript support
- MIT license

**Alternatives Considered:**

- Rete.js: Less React integration
- Custom canvas: Too complex
- GoJS: Commercial license required

**Consequences:**

- Additional bundle size (~150KB)
- Need to learn ReactFlow API
- Benefit: Production-ready UX

---

### ADR-003: pgvector + RRF for Hybrid Search

**Context:**
Need to search transcripts using both semantic meaning and exact keywords, with temporal/relational context.

**Decision:**
Use pgvector with HNSW index + tsvector with GIN index, combined using Reciprocal Rank Fusion (RRF).

**Rationale:**

- pgvector: PostgreSQL extension, native Supabase support
- HNSW index: Fast approximate nearest neighbor search
- tsvector: PostgreSQL built-in full-text search
- RRF: Simple, effective ranking fusion
- All in-database: No external dependencies

**Alternatives Considered:**

- Pinecone/Weaviate: External service, cost
- Elasticsearch: Separate infrastructure
- Simple vector search only: Misses exact matches

**Consequences:**

- Database storage increases (embeddings)
- Need to manage embedding generation
- Benefit: Fast, accurate, cost-effective

---

### ADR-004: Chunking Strategy (500 tokens, speaker-aware)

**Context:**
Transcripts can be very long (10,000+ tokens). Need to chunk for embedding and retrieval.

**Decision:**
Chunk transcripts at 500 tokens with speaker continuity preservation.

**Rationale:**

- 500 tokens: ~1-2 minutes of conversation
- Preserves context without exceeding embedding limits
- Speaker-aware: Don't split mid-sentence
- Overlap: 50 tokens between chunks
- Relationships: Track speaker continuity, temporal sequence

**Alternatives Considered:**

- Fixed 1000 tokens: Too large, loses granularity
- Sentence-level: Too small, too many chunks
- Paragraph-level: Inconsistent sizes

**Consequences:**

- More chunks = more embeddings = higher cost
- More chunks = better retrieval precision
- Need to handle chunk relationships

---

### ADR-005: Prompt-Kit for Chat UI

**Context:**
Need production-ready chat UI components with streaming support.

**Decision:**
Use prompt-kit components built on shadcn/ui and Tailwind.

**Rationale:**

- Built on shadcn/ui (already using in project)
- Tailwind CSS (follows brand guidelines)
- Designed for AI SDKs (Vercel, OpenAI)
- MIT licensed
- Composable, customizable

**Alternatives Considered:**

- Build from scratch: Too time-consuming
- ChatUI libraries: Not Tailwind-based
- Material UI chat: Doesn't match brand

**Consequences:**

- Dependencies on shadcn/ui patterns
- Need to customize for brand guidelines
- Benefit: Fast development, proven patterns

---

## SUCCESS CRITERIA

### Functional Requirements

✅ **Chat Interface**

- [ ] User can send messages and receive streaming responses
- [ ] Tool calls are visualized in the UI
- [ ] Sources are cited with recording IDs and timestamps
- [ ] Sessions persist across page reloads
- [ ] Chat history is searchable

✅ **Knowledge Base**

- [ ] Hybrid search returns relevant results
- [ ] Temporal queries work ("What changed over Q4?")
- [ ] Relational queries work ("What did John say about pricing?")
- [ ] Search performance < 200ms for 10 results
- [ ] Embeddings are generated automatically for new transcripts

✅ **Agent Builder**

- [ ] User can drag-and-drop nodes onto canvas
- [ ] Nodes can be configured via side panel
- [ ] Workflows can be saved and loaded
- [ ] Workflows can be executed
- [ ] Execution results are displayed

✅ **Agent Inbox**

- [ ] User can view all published agents
- [ ] User can run agents with custom prompts
- [ ] Execution history is accessible
- [ ] Performance metrics are displayed

### Non-Functional Requirements

✅ **Performance**

- [ ] Chat response time < 2 seconds (first token)
- [ ] Full chat response < 10 seconds
- [ ] Search query < 200ms
- [ ] Agent builder canvas runs at 60fps
- [ ] Page load time < 1 second

✅ **Scalability**

- [ ] Handles 100,000+ transcript chunks per user
- [ ] Supports 10+ concurrent chat sessions
- [ ] Agent executions don't block other operations

✅ **Security**

- [ ] RLS enforces user isolation
- [ ] API keys are not exposed to client
- [ ] User input is sanitized
- [ ] Tool executions are sandboxed

✅ **Usability**

- [ ] UI follows brand-guidelines-v3.3.md
- [ ] Responsive on mobile/tablet/desktop
- [ ] Loading states are clear
- [ ] Error messages are helpful

---

## RISK MITIGATION

### Technical Risks

**Risk 1: AI SDK v6 Beta Instability**

- **Likelihood:** Medium
- **Impact:** High
- **Mitigation:**
  - Pin to specific versions
  - Test thoroughly before upgrading
  - Have rollback plan
  - Monitor GitHub issues

**Risk 2: Embedding Cost Explosion**

- **Likelihood:** Medium
- **Impact:** Medium
- **Mitigation:**
  - Implement chunk deduplication
  - Only embed changed transcripts
  - Set cost alerts in OpenAI
  - Consider smaller embedding models

**Risk 3: Search Performance Degradation**

- **Likelihood:** Low
- **Impact:** High
- **Mitigation:**
  - Monitor query performance
  - Optimize indexes (HNSW parameters)
  - Implement query caching
  - Add pagination

**Risk 4: Complex Agent Workflows**

- **Likelihood:** High
- **Impact:** Medium
- **Mitigation:**
  - Start with simple node types
  - Validate workflows before execution
  - Provide templates
  - Add workflow testing tools

### User Experience Risks

**Risk 5: Confusing Agent Builder UI**

- **Likelihood:** Medium
- **Impact:** High
- **Mitigation:**
  - User testing with 5-10 users
  - Comprehensive onboarding flow
  - Example agents/templates
  - Tooltips and help text

**Risk 6: Slow Chat Responses**

- **Likelihood:** Low
- **Impact:** High
- **Mitigation:**
  - Show streaming progress
  - Implement thinking indicators
  - Set user expectations (10-15s)
  - Optimize prompt engineering

---

## FUTURE ENHANCEMENTS

### Post-MVP Features

1. **Multi-Modal Support**
   - Audio playback from chat
   - Video clip extraction
   - Image generation from data

2. **Collaboration**
   - Shared agents
   - Team chat sessions
   - Agent marketplace

3. **Advanced Analytics**
   - Agent performance dashboards
   - Token usage tracking
   - Cost optimization suggestions

4. **Integrations**
   - Slack bot
   - Email agent
   - Zapier/Make.com

5. **Advanced RAG**
   - Graph-based retrieval
   - Re-ranking models
   - Multi-hop reasoning

---

## APPENDIX

### Technology Reference Links

**Vercel AI SDK:**

- [Chat UI components for AI apps – prompt-kit](https://www.prompt-kit.com/chat-ui)
- [How to build AI Agents with Vercel and the AI SDK](https://vercel.com/guides/how-to-build-ai-agents-with-vercel-and-the-ai-sdk)
- [AI SDK 5 - Vercel](https://vercel.com/blog/ai-sdk-5)

**ReactFlow:**

- [Node-Based UIs in React - React Flow](https://reactflow.dev)
- [LangGraph GUI ReactFlow - Visual AI Agent Workflow Builder](https://creati.ai/ai-tools/langgraph-gui-reactflow/)

**Hybrid RAG:**

- [Hybrid search | Supabase Docs](https://supabase.com/docs/guides/ai/hybrid-search)
- [pgvector: Embeddings and vector similarity | Supabase Docs](https://supabase.com/docs/guides/database/extensions/pgvector)

**Brand Guidelines:**

- `/docs/design/brand-guidelines-v3.3.md`
- `/docs/architecture/api-naming-conventions.md`

---

**END OF PRP**

*This PRP provides a comprehensive blueprint for implementing the AI Chat Interface with Visual Agent Builder and Hybrid RAG Knowledge Base. All architectural decisions, database schemas, component structures, and implementation phases are designed to integrate seamlessly with the existing CallVault codebase while following established patterns and brand guidelines.*
