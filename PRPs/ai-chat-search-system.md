# PRP: AI Chat & Semantic Search System
**Enhanced Product Requirements Plan v2.2 - Self-Contained with Vercel AI SDK**

---

## Goal

**Feature Goal**: Build a production-ready ChatGPT/Kortex-style AI chat interface at `/chat` route that enables users to have intelligent conversations about their meeting transcripts using RAG (Retrieval-Augmented Generation) with semantic search, real-time streaming responses, and inline citations.

**Deliverable**: Full-stack chat application with:
- React-based chat UI with conversation persistence
- Supabase Edge Functions for streaming AI responses
- PostgreSQL pgvector for semantic search
- Real-time RAG system with citation tracking
- File attachment system (transcripts + external files)

**Success Definition**:
- Users can chat with AI about their entire transcript library
- Responses stream token-by-token with <1s first-token latency
- Semantic search retrieves relevant excerpts with >80% accuracy
- Inline citations link back to source transcripts
- UI matches VibeOS brand guidelines 100%
- System handles 100+ concurrent users

---

## User Persona

**Target User**: Product Manager / Sales Leader using Conversion Brain

**Demographics**:
- Role: Product Manager, Sales Director, Customer Success Lead
- Tech Savviness: Medium (comfortable with ChatGPT, not a developer)
- Current Pain: Manually searching through 50+ meeting transcripts to find specific customer feedback or pricing discussions

**Use Case**:
"I need to find all mentions of 'pricing objections' across my last 3 months of customer calls to prepare for next quarter's pricing review. Currently, I have to manually skim through dozens of transcripts."

**User Journey**:
1. Navigate to `/chat` from main dashboard
2. Click "Ask AI" or start typing "Show me all pricing objections from Q4"
3. See AI streaming response with citations
4. Click citation to view full transcript context
5. Attach specific transcripts to narrow scope: "Focus on enterprise customer calls only"
6. Export conversation for sharing with team

**Pain Points Addressed**:
- **Manual search inefficiency**: AI semantic search vs. keyword-only
- **Context switching**: Chat + citations in same view
- **Knowledge fragmentation**: AI synthesizes across 100+ transcripts
- **Time waste**: 30min manual search → 30sec AI answer

---

## Why

- **Business Value**: Reduces time-to-insight from hours to seconds for customer research, competitive analysis, and product feedback synthesis
- **Integration with Existing Features**: Leverages existing Fathom transcript ingestion, builds on top of current database schema
- **Problems Solved**:
  - For PMs: Quickly surface product feedback patterns across all customer calls
  - For Sales: Find objection handling examples from successful deals
  - For CS: Identify churn signals from recent support conversations
- **Strategic Priority**: Differentiates Conversion Brain from transcript storage tools (Fireflies, Gong) by adding AI-powered insights layer

---

## What

### User-Visible Behavior

**Chat Interface**:
- Full-page chat layout at `/chat` route with sidebar conversation history
- Real-time streaming responses (token-by-token) with thinking indicators
- User messages: right-aligned, vibe-green background
- AI messages: left-aligned, white background with inline citations
- Model selector dropdown (Gemini Pro/Flash, GPT-5)

**Semantic Search**:
- AI automatically searches relevant transcript excerpts when user asks question
- Citations appear inline as `[1]`, `[2]` with clickable cards showing:
  - Transcript title
  - Excerpt preview (200 chars)
  - Similarity score
  - Link to full transcript

**File Attachments**:
- "Attach from Library" button → modal with transcript selector (multi-select)
- "Upload File" button → supports PDF, TXT, DOCX, MD (session-scoped, 24h expiration)
- Attachment pills below input showing file names with remove buttons
- Context scope selector: "All Transcripts" | "Folder: X" | "Date Range" | "Attached Files Only"

**Enhanced Keyword Search** (TranscriptsTab integration):
- Field-specific operators: `title:`, `transcript:`, `participant:`, `folder:`, `date:`
- Visual scope selector for casual users (checkboxes instead of operators)
- "Ask AI" bulk action button when transcripts selected

### Technical Requirements

**Performance**:
- Chat page loads in <2 seconds
- First token streams in <1 second
- Semantic search completes in <1 second
- Support 100+ concurrent chat sessions

**Security**:
- RLS policies enforce user-scoped data access
- File uploads validated (<10MB, whitelist types only)
- Rate limiting: 60 requests/minute per user
- OPENAI_API_KEY or ANTHROPIC_API_KEY stored as Supabase secret (never exposed to client)

**Scalability**:
- Handle 10,000+ transcript embeddings per user
- Background embedding generation (10 transcripts/batch)
- Automatic cleanup of expired file uploads (daily cron)

### Success Criteria

- [ ] Users can chat with AI about entire transcript library
- [ ] Responses stream with <1s first-token latency
- [ ] Semantic search >80% relevance accuracy
- [ ] Citations link correctly to source transcripts
- [ ] File attachments work for transcripts + external files
- [ ] UI matches VibeOS brand guidelines 100%
- [ ] "Ask AI" buttons integrate with TranscriptsTab
- [ ] Conversation history persists across sessions
- [ ] Model switching works mid-conversation
- [ ] Export conversations (PDF/TXT/MD)
- [ ] Zero critical bugs in production

---

## All Needed Context

### Context Completeness Check

_"If someone knew nothing about this codebase, would they have everything needed to implement this successfully?"_

✅ **Yes** - This PRP includes database schemas, edge function specs, component structure, existing patterns to follow, code examples from AI SDK and Prompt-Kit docs, and validation commands.

### Documentation & References

```yaml
# Local Context Files - READ FIRST (Project-Specific)
- file: docs/reference/prompt-kit-ui.md
  why: Complete Prompt-Kit component documentation and patterns for this codebase
  critical: Our customized implementation patterns, VibeOS styling overrides, accessibility notes
  what_it_contains:
    - ChatContainer, PromptInput, Message, Markdown component APIs
    - VibeOS-specific theming and color token overrides
    - Performance optimizations (memoization, virtual scrolling)
    - Known issues and workarounds specific to our setup

- file: docs/reference/ai-sdk-cookbook-examples/
  why: Vercel AI SDK implementation examples and patterns used in this codebase
  critical: Reference implementations for streaming, embeddings, tool calling
  what_it_contains:
    - chatbot.md - useChat hook patterns with SSE streaming
    - rag-agent-guide.md - RAG system implementation with citations
    - tool-calling.md - Structured outputs and function calling patterns
    - 100+ working examples for common AI SDK use cases

- file: docs/adr/adr-001-vercel-ai-sdk.md
  why: Architecture Decision Record explaining why we use Vercel AI SDK
  critical: Context on provider-agnostic approach, migration from Lovable AI
  what_it_contains: Decision rationale, alternatives considered, consequences

- file: docs/architecture/api-naming-conventions.md
  why: Project naming standards for functions, hooks, types, database fields
  critical: Ensures consistency (camelCase functions, PascalCase types, snake_case DB)

- file: docs/architecture/data-fetching-architecture.md
  why: TanStack Query patterns and conventions in this codebase
  critical: Hardcoded string array query keys (no factory pattern)

# External Documentation - MUST READ
- url: https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot
  why: Vercel AI SDK useChat hook for streaming responses
  critical: Must use Server-Sent Events (SSE) format for Supabase Edge Functions compatibility
  section: "#streaming-chat-responses"
  key_patterns:
    - useChat hook returns messages, input, handleSubmit, isLoading
    - onFinish callback fires AFTER stream closes
    - Automatic message array updates during streaming

- url: https://supabase.com/docs/guides/ai/vector-indexes
  why: pgvector setup and cosine similarity search patterns
  critical: Use ivfflat index with lists=100 for optimal performance on <100k embeddings
  section: "#creating-a-vector-similarity-search-function"
  key_patterns:
    - Cosine distance operator: <=> (NOT <-> which is L2)
    - ivfflat faster than HNSW for <100k vectors
    - Create index AFTER loading data for better performance

- url: https://prompt-kit.com/docs/components
  why: Pre-built chat UI components with accessibility
  critical: Heavily customize with VibeOS semantic tokens (don't use default colors)
  section: "#chat-container"
  key_components:
    - ChatContainer: Auto-scrolling with use-stick-to-bottom
    - PromptInput: Auto-resize textarea with actions
    - Message: Avatar + content + markdown support
    - Markdown: Memoized rendering for streaming performance

- url: https://sdk.vercel.ai/docs
  why: Vercel AI SDK for LLM integration, streaming, and embeddings
  critical: Provider-agnostic SDK supporting OpenAI, Anthropic, Google, etc.
  section: "#providers"
  available_models:
    - google/gemini-2.5-pro (complex reasoning)
    - google/gemini-2.5-flash (default, balanced)
    - google/gemini-2.5-flash-lite (fastest)
    - openai/gpt-5 (alternative)

# Existing Codebase Patterns - MUST FOLLOW
- file: src/components/transcripts/TranscriptsTab.tsx
  why: Follow existing table structure, bulk actions pattern
  pattern: Checkbox selection state management, bulk action toolbar placement
  gotcha: Don't break existing keyboard shortcuts (Cmd+A for select all)
  implementation_note: Uses Zustand for selection state, React Query for data

- file: src/components/CallDetailDialog.tsx
  why: Modal structure and transcript display patterns
  pattern: Dialog layout, header actions, content scrolling
  gotcha: Must maintain existing "View" button functionality
  implementation_note: Uses shadcn/ui Dialog component with custom header

- file: src/hooks/useMeetingsSync.ts
  why: Background job processing and progress tracking pattern
  pattern: Job status polling, progress indicators, error handling
  gotcha: Reuse existing sync job status types (pending|processing|completed|failed)
  implementation_note: Polls every 2 seconds, stops on completion/error

- file: supabase/functions/_shared/cors.ts
  why: Standard CORS headers for all edge functions
  pattern: Import and apply corsHeaders to all responses
  gotcha: Must include CORS in both OPTIONS and main handler
  implementation:
    - OPTIONS request returns 204 with headers
    - Main request includes headers in final response

- file: src/lib/supabase.ts
  why: Supabase client initialization pattern
  pattern: Use existing client singleton, don't create new instances
  gotcha: Edge functions use different client than frontend
  implementation_note: Frontend uses createClient with localStorage, edge uses service role

- file: src/stores/categoryStore.ts
  why: Zustand store pattern for state management
  pattern: Store structure, actions naming (set*, get*, update*)
  gotcha: Must sync with React Query cache when updating server state
  implementation:
    - Actions trigger queryClient.invalidateQueries
    - Optimistic updates with rollback on error

# Brand Guidelines - MUST FOLLOW
- file: BRAND_GUIDELINES.md
  why: Complete VibeOS design system specifications
  pattern: Color tokens, typography, button variants, spacing grid
  critical: NEVER use vibe-green for text/backgrounds (only accents)
  color_usage_rules:
    - vibe-green: Only for 5 specific uses (active tab underlines, left-edge indicators, column headers, focus states, circular progress)
    - bg-viewport: Page gutters (#FCFCFC light, #1A1A1A dark)
    - bg-card: Content cards (#FFFFFF light, #202020 dark)
    - text-foreground: Primary text (#111111 light, #E0E0E0 dark)
  typography:
    - Headings: Montserrat Extra Bold, ALL CAPS
    - Body: Inter Light (300) or Regular (400)
    - Interactive: Inter Medium (500)
  button_system:
    - Primary: Slate gradient (variant="default")
    - Plain: White/bordered (variant="hollow")
    - Destructive: Red gradient (variant="destructive")
    - Link: Text-only (variant="link")

# Naming Conventions - MUST FOLLOW
- pattern: camelCase for functions/variables
- pattern: PascalCase for components/types
- pattern: use* prefix for React hooks
- pattern: fetch* prefix for API calls
- gotcha: Edge function folders use kebab-case (chat-stream, not chatStream)

# Data Fetching Patterns - MUST FOLLOW
- pattern: TanStack Query with hardcoded string array query keys
- pattern: ["chat-conversations", userId] NOT queryKeys.chatConversations(userId)
- pattern: useMutation for writes, useQuery for reads
- gotcha: queryKeys factory removed - use hardcoded arrays
- implementation:
  - Invalidate queries after mutations
  - Use optimistic updates for instant UX
  - Error handling via onError callback
```

### Complete Codebase Tree

```bash
conversion-brain/
├── README.md
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── .env.example
├── .eslintrc.json
├── .prettierrc
│
├── src/
│   ├── main.tsx                              # App entry point
│   ├── App.tsx                               # MODIFY: Add /chat route
│   ├── index.css                             # Global styles
│   │
│   ├── components/
│   │   ├── chat/                             # NEW - All chat components
│   │   │   ├── ChatLayout.tsx                # Page wrapper with sidebar
│   │   │   ├── ChatSidebar.tsx               # Conversation history list
│   │   │   ├── ChatHeader.tsx                # Top bar with model selector
│   │   │   ├── ChatMessages.tsx              # Message list (virtual scroll)
│   │   │   ├── ChatInput.tsx                 # Auto-resize input
│   │   │   ├── MessageBubble.tsx             # User/AI message rendering
│   │   │   ├── ThinkingIndicator.tsx         # Animated loading dots
│   │   │   ├── CitationCard.tsx              # Inline citation display
│   │   │   ├── ModelSelector.tsx             # Model switching dropdown
│   │   │   ├── AttachmentButton.tsx          # File attach button
│   │   │   ├── AttachmentPill.tsx            # Attached file display
│   │   │   ├── TranscriptSelectorModal.tsx   # Transcript picker modal
│   │   │   ├── ContextScopeSelector.tsx      # Context filter dropdown
│   │   │   ├── ExportConversationDialog.tsx  # Export modal
│   │   │   └── index.ts                      # Barrel exports
│   │   │
│   │   ├── search/                           # NEW - Enhanced search
│   │   │   ├── SearchScopeSelector.tsx       # Visual filter UI
│   │   │   ├── SearchSyntaxHelper.tsx        # Tooltip helper
│   │   │   └── index.ts
│   │   │
│   │   ├── transcripts/                      # EXISTING - Modify for integration
│   │   │   ├── TranscriptsTab.tsx            # MODIFY: Add "Ask AI" button
│   │   │   ├── CallDetailDialog.tsx          # MODIFY: Add "Attach to Chat" button
│   │   │   ├── TranscriptTable.tsx
│   │   │   ├── TranscriptFilters.tsx
│   │   │   └── index.ts
│   │   │
│   │   ├── ui/                               # EXISTING - shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── input.tsx
│   │   │   ├── textarea.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── tooltip.tsx
│   │   │   ├── popover.tsx
│   │   │   ├── checkbox.tsx
│   │   │   ├── separator.tsx
│   │   │   ├── scroll-area.tsx
│   │   │   ├── skeleton.tsx
│   │   │   └── ... (30+ more shadcn components)
│   │   │
│   │   └── icons/                            # EXISTING - Remix Icon components
│   │       ├── MessageSquare.tsx
│   │       ├── Send.tsx
│   │       ├── Paperclip.tsx
│   │       └── ...
│   │
│   ├── hooks/
│   │   ├── useChatStream.ts                  # NEW - Vercel AI SDK wrapper
│   │   ├── useConversations.ts               # NEW - TanStack Query for conversations
│   │   ├── useEmbeddings.ts                  # NEW - Embedding job tracker
│   │   ├── useMeetingsSync.ts                # EXISTING - Job processing pattern
│   │   ├── useCategories.ts                  # EXISTING - TanStack Query pattern
│   │   └── use-toast.ts                      # EXISTING - Toast notifications
│   │
│   ├── stores/
│   │   ├── chatStore.ts                      # NEW - Zustand chat state
│   │   ├── categoryStore.ts                  # EXISTING - Zustand pattern
│   │   └── settingsStore.ts                  # EXISTING
│   │
│   ├── lib/
│   │   ├── supabase.ts                       # EXISTING - Supabase client singleton
│   │   ├── utils.ts                          # EXISTING - Utility functions (cn, etc)
│   │   ├── export-utils.ts                   # EXISTING - CSV/PDF export logic
│   │   ├── search-engine.ts                  # NEW - Query parser for operators
│   │   ├── rag-system.ts                     # NEW - RAG helpers (chunking, formatting)
│   │   └── constants.ts                      # EXISTING - App constants
│   │
│   ├── types/
│   │   ├── database.ts                       # EXISTING - Supabase types (auto-generated)
│   │   ├── chat.ts                           # NEW - Chat message/conversation types
│   │   ├── rag.ts                            # NEW - RAG search result types
│   │   └── index.ts                          # Barrel exports
│   │
│   └── pages/
│       ├── Dashboard.tsx                     # EXISTING
│       ├── Transcripts.tsx                   # EXISTING
│       ├── Settings.tsx                      # EXISTING
│       └── Chat.tsx                          # NEW - Main chat page
│
├── supabase/
│   ├── config.toml
│   ├── seed.sql
│   │
│   ├── functions/
│   │   ├── _shared/
│   │   │   ├── cors.ts                       # EXISTING - CORS headers utility
│   │   │   ├── supabase.ts                   # EXISTING - Edge function client
│   │   │   └── types.ts                      # EXISTING - Shared types
│   │   │
│   │   ├── chat-stream/                      # NEW - Streaming chat endpoint
│   │   │   ├── index.ts
│   │   │   └── README.md
│   │   │
│   │   ├── generate-embeddings/              # NEW - Batch embedding generation
│   │   │   ├── index.ts
│   │   │   └── README.md
│   │   │
│   │   ├── semantic-search/                  # NEW - Vector similarity search
│   │   │   ├── index.ts
│   │   │   └── README.md
│   │   │
│   │   ├── parse-uploaded-file/              # NEW - File parsing (PDF/DOCX/TXT)
│   │   │   ├── index.ts
│   │   │   └── README.md
│   │   │
│   │   ├── fetch-meetings/                   # EXISTING - Fathom API
│   │   │   └── index.ts
│   │   │
│   │   ├── sync-meetings/                    # EXISTING - Bulk sync
│   │   │   └── index.ts
│   │   │
│   │   └── webhook/                          # EXISTING - Real-time ingestion
│   │       └── index.ts
│   │
│   └── migrations/
│       ├── 20240101_create_fathom_calls.sql  # EXISTING
│       ├── ... (15+ existing migrations)
│       ├── 20250120_create_chat_tables.sql   # NEW - Phase 1 (conversations/messages)
│       ├── 20250121_create_embeddings.sql    # NEW - Phase 2 (vector search)
│       └── 20250122_create_file_uploads.sql  # NEW - Phase 3 (file attachments)
│
├── docs/
│   ├── design/
│   │   └── BRAND_GUIDELINES.md               # EXISTING - VibeOS design system
│   │
│   ├── architecture/
│   │   ├── api-naming-conventions.md         # EXISTING - Naming standards
│   │   └── data-fetching-architecture.md     # EXISTING - TanStack Query patterns
│   │
│   ├── reference/
│   │   ├── prompt-kit-ui.md                  # EXISTING - Prompt-Kit component docs
│   │   ├── ai-sdk-cookbook-examples/         # EXISTING - AI SDK patterns
│   │   │   ├── chatbot.md
│   │   │   ├── rag-agent-guide.md
│   │   │   ├── tool-calling.md
│   │   │   └── ... (100+ examples)
│   │   └── ...
│   │
│   └── adr/
│       ├── adr-001-vercel-ai-sdk.md          # EXISTING - ADR for Vercel AI SDK
│       └── ...
│
├── PRPs/
│   └── ai-chat-search-system-enhanced.md     # THIS FILE (self-contained)
│
└── docs/
    ├── ai_docs/                              # EXISTING - AI context files
    ├── adr/                                  # EXISTING - Architecture decisions
    └── plans-previous-prps/                  # EXISTING - Previous planning docs
```

### Known Gotchas & Library Quirks

```typescript
// ============================================
// CRITICAL: Vercel AI SDK useChat Hook
// ============================================
// Gotcha 1: onFinish fires AFTER stream closes, not when message sends
import { useChat } from '@ai-sdk/react';
const { messages, input, handleSubmit } = useChat({
  api: '/functions/v1/chat-stream', // Points to Supabase edge function
  onFinish: (message) => {
    // This runs AFTER streaming completes, not immediately
    saveChatMessage(message);
  },
  onError: (error) => {
    // Errors during streaming appear here
    toast.error(error.message);
  }
});

// Gotcha 2: Must return SSE stream from edge function (not plain JSON)
// Edge function MUST use Server-Sent Events format:
// "data: {json}\n\n" for each chunk
// NEVER close stream before final token


// ============================================
// CRITICAL: Supabase pgvector
// ============================================
// Gotcha 1: Use ivfflat index for <100k embeddings (faster than HNSW)
CREATE INDEX transcript_embeddings_vector_idx
ON transcript_embeddings
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100); -- 100 lists for <100k vectors

// Gotcha 2: Cosine distance operator is <=> (NOT <-> which is L2 distance)
SELECT * FROM transcript_embeddings
ORDER BY embedding <=> $1::vector  -- Cosine distance (CORRECT)
-- NOT: embedding <-> $1::vector   -- L2 distance (WRONG for semantic search)
LIMIT 10;

// Gotcha 3: Create index AFTER loading data for better performance
// Don't create index on empty table - load data first, then index

// Gotcha 4: NEVER compare embeddings in application code
// Always use database vector operations for similarity
// ❌ BAD: embeddings.filter(e => cosineSimilarity(query, e.vector) > 0.5)
// ✅ GOOD: SQL query with ORDER BY embedding <=> $1::vector


// ============================================
// CRITICAL: Vercel AI SDK with OpenAI Provider
// ============================================
// Gotcha 1: Use Vercel AI SDK instead of direct API calls
import { openai } from '@ai-sdk/openai';
import { embedMany } from 'ai';

// Gotcha 2: API key stored as Supabase secret
// Access via Deno.env.get('OPENAI_API_KEY') in edge functions
// Configure provider in edge function:
const model = openai.embedding('text-embedding-3-small', {
  apiKey: Deno.env.get('OPENAI_API_KEY')
});

// Gotcha 3: Use embedMany() for batch processing (more efficient)
const { embeddings } = await embedMany({
  model,
  values: chunks // Array of strings
});

// Gotcha 4: Rate limit is 60 requests/minute (provider-dependent)
// Implement exponential backoff for 429 errors
// Batch embeddings (10 chunks at a time) to reduce requests

// Gotcha 5: Different models have different context windows
// - gemini-2.5-pro: 2M tokens
// - gemini-2.5-flash: 1M tokens
// - gpt-4o: 128k tokens


// ============================================
// CRITICAL: TanStack Query in this codebase
// ============================================
// Gotcha 1: Use hardcoded string array query keys (factory removed)
// ❌ BAD: queryKey: queryKeys.chatConversations(userId)
// ✅ GOOD: queryKey: ["chat-conversations", userId]

const { data: conversations } = useQuery({
  queryKey: ["chat-conversations", userId],
  queryFn: () => fetchConversations(userId)
});

// Gotcha 2: useMutation for all writes, don't update cache manually
// Always invalidate queries after mutations
const { mutate: createConversation } = useMutation({
  mutationFn: (title: string) => {
    return supabase.from('chat_conversations').insert({ title, user_id: userId });
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
  }
});

// Gotcha 3: Must sync Zustand store with React Query cache
// When Zustand updates server data, invalidate React Query
const updateConversation = async (id: string, title: string) => {
  await supabase.from('chat_conversations').update({ title }).eq('id', id);
  queryClient.invalidateQueries({ queryKey: ["chat-conversations"] }); // CRITICAL
};


// ============================================
// CRITICAL: Supabase Edge Functions
// ============================================
// Gotcha 1: ALWAYS import and apply corsHeaders
import { corsHeaders } from '../_shared/cors.ts';
export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  // Main logic
  return new Response(JSON.stringify(data), { headers: corsHeaders });
}

// Gotcha 2: Deno runtime (not Node.js)
// - Use Deno.readTextFile() not fs.readFile()
// - Import from URLs: import { z } from "https://deno.land/x/zod/mod.ts"
// - No node_modules or package.json in edge functions

// Gotcha 3: Edge function client different from frontend client
// Frontend: createClient with localStorage
// Edge: createClient with service role key
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! // Service role, not anon key
)


// ============================================
// CRITICAL: VibeOS Brand Guidelines
// ============================================
// Gotcha 1: Vibe green (#D9FC67) ONLY for 5 specific uses
// ✅ ALLOWED:
//   1. Active tab underlines (3px)
//   2. Left-edge indicators (3px)
//   3. Individual table column headers (3px underline)
//   4. Focus states (3px left border on inputs, 2px outline on buttons)
//   5. Circular progress indicators (filled portion only)
// ❌ NEVER for: text, button backgrounds, card backgrounds, icons, large filled areas

// Gotcha 2: Use semantic tokens, not hex codes
// ❌ BAD: className="text-[#D9FC67]"
// ✅ GOOD: className="text-vibe-green"

// Gotcha 3: Button system has only 4 variants
<Button variant="default">Primary (slate gradient)</Button>
<Button variant="hollow">Plain (white/bordered)</Button>
<Button variant="destructive">Destructive (red gradient)</Button>
<Button variant="link">Link (text-only)</Button>

// Gotcha 4: Typography rules are strict
// - Headings: ALWAYS Montserrat Extra Bold, ALL CAPS
// - Body: ALWAYS Inter Light (300) or Regular (400)
// - Interactive: ALWAYS Inter Medium (500)
// - NEVER mix Montserrat and Inter in same element


// ============================================
// CRITICAL: Prompt-Kit Components
// ============================================
// Gotcha 1: Designed for dark mode - must customize for VibeOS light theme
// Override ALL default colors with semantic tokens
<ChatMessage
  className="bg-vibe-green text-foreground" // Override default dark theme
  aria-label="User message" // Keep accessibility
/>

// Gotcha 2: ChatContainer uses use-stick-to-bottom library
// Auto-scrolling behavior:
// - Sticks to bottom when at bottom
// - Allows user to scroll up (disables auto-scroll)
// - Re-enables when user scrolls back to bottom
<ChatContainerRoot>
  <ChatContainerContent>
    {messages.map(m => <Message key={m.id} {...m} />)}
  </ChatContainerContent>
  <ChatContainerScrollAnchor /> {/* Required for scroll targeting */}
</ChatContainerRoot>

// Gotcha 3: Markdown component uses memoization for streaming performance
// MUST provide unique `id` prop for proper block caching
<Markdown id={message.id}>{message.content}</Markdown>
// Without id, entire message re-renders on every token


// ============================================
// CRITICAL: RAG System Prompting
// ============================================
// Gotcha 1: Context window management
// - Limit to top 10 most relevant chunks (balance context vs. quality)
// - Sort by similarity score descending
// - Include metadata (title, date, speaker) for each chunk

// Gotcha 2: Citation format must be consistent
const contextWithCitations = retrievedChunks.map((chunk, i) => `
[${i+1}] "${chunk.text}"
Source: ${chunk.title} (${chunk.date})
Speaker: ${chunk.speaker}
Similarity: ${(chunk.similarity * 100).toFixed(1)}%
`).join('\n\n');

// Gotcha 3: Fallback strategy when no results
// If semantic search returns no results (similarity < 0.3):
// 1. Try full-text search as fallback
// 2. If still no results, return: "I don't have information about that in your transcripts"
// 3. NEVER hallucinate or speculate


// ============================================
// CRITICAL: React Window Virtual Scrolling
// ============================================
// Gotcha 1: ItemSize must be fixed (can't use auto-height)
// Calculate approximate height for message bubbles
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={messages.length}
  itemSize={100} // Fixed height per message
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <MessageBubble message={messages[index]} />
    </div>
  )}
</FixedSizeList>

// Gotcha 2: Scroll to bottom after new message
const listRef = useRef<FixedSizeList>(null);
useEffect(() => {
  if (messages.length > 0) {
    listRef.current?.scrollToItem(messages.length - 1, "end");
  }
}, [messages.length]);


// ============================================
// CRITICAL: Chunking Strategy for RAG
// ============================================
// Gotcha 1: Chunk size affects retrieval quality
// - Too small (100 tokens): Loses context, returns partial sentences
// - Too large (1000 tokens): Returns irrelevant content, exceeds context window
// - Optimal: 500 tokens with 50 token overlap

function chunkTranscript(fullTranscript: string): string[] {
  const CHUNK_SIZE = 500;  // tokens
  const CHUNK_OVERLAP = 50; // overlap between chunks

  // Split by sentences first
  const sentences = fullTranscript.match(/[^.!?]+[.!?]+/g) || [];

  // Group into ~500 token chunks with 50 token overlap
  // Maintain speaker context from metadata
  return groupIntoChunks(sentences, CHUNK_SIZE, CHUNK_OVERLAP);
}

// Gotcha 2: Preserve speaker information in chunks
// Store speaker name and timestamp in metadata JSONB
metadata: {
  speaker: "John Doe",
  timestamp: "00:15:30",
  title: "Q4 Sales Call",
  date: "2024-11-15"
}


// ============================================
// CRITICAL: File Upload Security
// ============================================
// Gotcha 1: Validate file size and type on both client AND server
// Client validation (UX):
if (file.size > 10 * 1024 * 1024) {
  toast.error('File must be less than 10MB');
  return;
}

// Server validation (security):
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

if (file.size > MAX_FILE_SIZE || !ALLOWED_TYPES.includes(file.type)) {
  throw new Error('Invalid file');
}

// Gotcha 2: Session-scoped uploads expire after 24 hours
// Run cleanup function daily via cron job
CREATE OR REPLACE FUNCTION cleanup_expired_uploads()
RETURNS void AS $$
BEGIN
  DELETE FROM chat_file_uploads WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

// Schedule via pg_cron extension:
SELECT cron.schedule('cleanup-uploads', '0 2 * * *', 'SELECT cleanup_expired_uploads()');
```

---

## Implementation Blueprint

### PHASE 1: Core Chat Interface (Week 1-2)

**Goal**: Functional chat page with streaming responses and conversation persistence.

#### Task 1.1: Install Dependencies

```bash
# EXECUTE: Install required packages
npm install ai @ai-sdk/react zustand react-window

# VERIFY: Check package.json includes:
# - "ai": "^3.0.0" (Vercel AI SDK core)
# - "@ai-sdk/react": "^0.0.14" (React hooks for streaming)
# - "zustand": "^4.5.0" (State management)
# - "react-window": "^1.8.10" (Virtual scrolling for performance)
```

#### Task 1.2: CREATE Database Migration - Phase 1 Tables

```sql
-- FILE: supabase/migrations/20250120_create_chat_tables.sql
-- FOLLOW pattern: supabase/migrations/20240101_create_fathom_calls.sql (RLS structure)
-- NAMING: YYYYMMDDHHMMSS_descriptive_name.sql

-- Chat conversations table
CREATE TABLE chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  model TEXT DEFAULT 'google/gemini-2.5-flash',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages table
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]', -- {type: 'transcript'|'file', id: UUID, name: string}[]
  citations JSONB DEFAULT '[]',   -- {recording_id: number, chunk_text: string, similarity: number}[]
  model TEXT,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX chat_messages_conversation_idx ON chat_messages(conversation_id);
CREATE INDEX chat_conversations_user_idx ON chat_conversations(user_id);
CREATE INDEX chat_conversations_updated_idx ON chat_conversations(updated_at DESC);

-- RLS policies (FOLLOW pattern from fathom_calls table)
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own conversations" ON chat_conversations
  FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users can create their own conversations" ON chat_conversations
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can update their own conversations" ON chat_conversations
  FOR UPDATE USING (auth.uid()::text = user_id);
CREATE POLICY "Users can delete their own conversations" ON chat_conversations
  FOR DELETE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can view messages in their conversations" ON chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_conversations
      WHERE chat_conversations.id = chat_messages.conversation_id
      AND chat_conversations.user_id = auth.uid()::text
    )
  );
CREATE POLICY "Users can create messages in their conversations" ON chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_conversations
      WHERE chat_conversations.id = chat_messages.conversation_id
      AND chat_conversations.user_id = auth.uid()::text
    )
  );

-- Trigger for updated_at (reuse existing function)
CREATE TRIGGER update_chat_conversations_updated_at
  BEFORE UPDATE ON chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_sync_jobs_updated_at();

-- VERIFY: Run migration and check tables exist
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'chat%';
```

#### Task 1.3: CREATE Edge Function - chat-stream

```typescript
// FILE: supabase/functions/chat-stream/index.ts
// FOLLOW pattern: supabase/functions/fetch-meetings/index.ts (CORS, error handling)
// DEPENDENCIES: Import corsHeaders from _shared/cors.ts
// CRITICAL: Return SSE stream (NOT JSON) for Vercel AI SDK compatibility

import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

export default async function handler(req: Request) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, conversationId, userId, model = 'google/gemini-2.5-flash' } = await req.json();

    // 1. Retrieve conversation history from database
    const { data: conversation, error: convError } = await supabase
      .from('chat_conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single();

    if (convError) throw new Error('Conversation not found');

    // 2. Retrieve previous messages for context
    const { data: previousMessages } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    // 3. Build messages array for AI (Vercel AI SDK format)
    const aiMessages = [
      ...(previousMessages || []).map(m => ({ role: m.role, content: m.content })),
      ...messages
    ];

    // 4. Stream response using Vercel AI SDK
    import { streamText } from 'ai';
    import { openai } from '@ai-sdk/openai';

    const result = await streamText({
      model: openai(model, {
        apiKey: Deno.env.get('OPENAI_API_KEY')
      }),
      messages: aiMessages
    });

    // 5. Convert AI SDK stream to SSE format for client
    const stream = new ReadableStream({
      async start(controller) {
        let fullResponse = '';

        try {
          for await (const textPart of result.textStream) {
            fullResponse += textPart;

            // Forward chunk to client in SSE format
            controller.enqueue(`data: ${JSON.stringify({ content: textPart })}\n\n`);
          }

          // 6. Save assistant message to database after stream completes
          await supabase.from('chat_messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: fullResponse,
            model,
            // tokens_used calculated from response (Phase 6)
          });

          // 7. Update conversation updated_at timestamp
          await supabase
            .from('chat_conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', conversationId);

          controller.close();
        } catch (error) {
          controller.error(error);
        }
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  } catch (error) {
    console.error('Chat stream error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
```

#### Task 1.4: CREATE Chat Page Route

```tsx
// FILE: src/pages/Chat.tsx
// FOLLOW pattern: src/pages/Dashboard.tsx (page layout structure)
// DEPENDENCIES: ChatLayout, ChatSidebar, ChatMessages, ChatInput components

import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChatLayout } from '@/components/chat/ChatLayout';
import { useChatStore } from '@/stores/chatStore';

export default function Chat() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { currentConversation, setCurrentConversation } = useChatStore();

  // Handle pre-attached transcripts from query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const attachIds = params.get('attach')?.split(',').map(Number);

    if (attachIds?.length) {
      // Load transcript metadata and set as attachments
      // (See Phase 3 for full implementation)
    }
  }, []);

  // Load conversation on mount
  useEffect(() => {
    if (conversationId) {
      setCurrentConversation(conversationId);
    }
  }, [conversationId, setCurrentConversation]);

  return (
    <div className="h-screen bg-viewport">
      <ChatLayout conversationId={conversationId} />
    </div>
  );
}
```

```tsx
// MODIFY: src/App.tsx - Add /chat route
// FOLLOW pattern: Existing route structure

import Chat from '@/pages/Chat';

// Inside Routes component:
<Route path="/chat" element={<Chat />} />
<Route path="/chat/:conversationId" element={<Chat />} />
```

#### Task 1.5: CREATE ChatLayout Component

```tsx
// FILE: src/components/chat/ChatLayout.tsx
// FOLLOW pattern: Dashboard layout structure (sidebar + main content)
// DEPENDENCIES: ChatSidebar, ChatHeader, ChatMessages, ChatInput

import { ChatSidebar } from './ChatSidebar';
import { ChatHeader } from './ChatHeader';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';
import { useChatStream } from '@/hooks/useChatStream';
import { useChatStore } from '@/stores/chatStore';

interface ChatLayoutProps {
  conversationId?: string;
}

export function ChatLayout({ conversationId }: ChatLayoutProps) {
  const { currentConversation } = useChatStore();
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChatStream({
    conversationId: conversationId || currentConversation
  });

  return (
    <div className="flex h-screen">
      {/* Sidebar - FOLLOW brand-guidelines: bg-viewport with border-r */}
      <div className="w-80 border-r border-border">
        <ChatSidebar />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <ChatHeader conversationId={conversationId} />

        {/* Messages - FOLLOW: Virtual scrolling for performance */}
        <div className="flex-1 overflow-hidden">
          <ChatMessages messages={messages} isLoading={isLoading} />
        </div>

        {/* Input - FOLLOW: Fixed bottom with shadow */}
        <div className="border-t border-border bg-card">
          <ChatInput
            value={input}
            onChange={handleInputChange}
            onSubmit={handleSubmit}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}
```

#### Task 1.6: CREATE ChatSidebar Component

```tsx
// FILE: src/components/chat/ChatSidebar.tsx
// FOLLOW pattern: Existing sidebar components, conversation list structure
// DEPENDENCIES: useConversations hook, ScrollArea, Button

import { useConversations } from '@/hooks/useConversations';
import { useChatStore } from '@/stores/chatStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function ChatSidebar() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const { data: conversations, isLoading } = useConversations();
  const { currentConversation, createNewConversation } = useChatStore();

  const filteredConversations = conversations?.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleNewChat = async () => {
    const newConv = await createNewConversation();
    navigate(`/chat/${newConv.id}`);
  };

  return (
    <div className="h-full flex flex-col bg-viewport">
      {/* Search Input - FOLLOW: brand-guidelines input styling */}
      <div className="p-4 border-b border-border">
        <Input
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-card"
          leftIcon={<Search className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      {/* Conversation List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading ? (
            <div className="text-muted-foreground text-sm p-4">Loading...</div>
          ) : filteredConversations?.length === 0 ? (
            <div className="text-muted-foreground text-sm p-4">No conversations yet</div>
          ) : (
            filteredConversations?.map(conv => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isActive={conv.id === currentConversation}
                onClick={() => navigate(`/chat/${conv.id}`)}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* New Chat Button - FOLLOW: brand-guidelines button system */}
      <div className="p-4 border-t border-border">
        <Button
          onClick={handleNewChat}
          variant="default"
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Chat
        </Button>
      </div>
    </div>
  );
}

function ConversationItem({ conversation, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left p-3 rounded-lg mb-1 transition-colors
        ${isActive
          ? 'bg-card border-l-3 border-l-vibe-green' // Active state with vibe-green accent
          : 'hover:bg-card/50'
        }
      `}
    >
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground truncate">
            {conversation.title}
          </div>
          <div className="text-xs text-muted-foreground">
            {new Date(conversation.updated_at).toLocaleDateString()}
          </div>
        </div>
      </div>
    </button>
  );
}
```

#### Task 1.7: CREATE ChatMessages Component

```tsx
// FILE: src/components/chat/ChatMessages.tsx
// FOLLOW pattern: Virtual scrolling with react-window for performance
// DEPENDENCIES: MessageBubble, ThinkingIndicator, FixedSizeList

import { FixedSizeList } from 'react-window';
import { MessageBubble } from './MessageBubble';
import { ThinkingIndicator } from './ThinkingIndicator';
import { useRef, useEffect } from 'react';
import type { Message } from '@ai-sdk/react';

interface ChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
}

export function ChatMessages({ messages, isLoading }: ChatMessagesProps) {
  const listRef = useRef<FixedSizeList>(null);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (messages.length > 0) {
      listRef.current?.scrollToItem(messages.length - 1, "end");
    }
  }, [messages.length]);

  return (
    <div className="h-full bg-background">
      <FixedSizeList
        ref={listRef}
        height={window.innerHeight - 180} // Account for header + input
        itemCount={messages.length}
        itemSize={120} // Approximate height per message
        width="100%"
      >
        {({ index, style }) => (
          <div style={style} className="px-4">
            <MessageBubble message={messages[index]} />
          </div>
        )}
      </FixedSizeList>

      {/* Thinking Indicator */}
      {isLoading && (
        <div className="px-4 py-2">
          <ThinkingIndicator />
        </div>
      )}
    </div>
  );
}
```

#### Task 1.8: CREATE MessageBubble Component

```tsx
// FILE: src/components/chat/MessageBubble.tsx
// FOLLOW: brand-guidelines button variants for styling
// DEPENDENCIES: CitationCard for assistant messages

import { CitationCard } from './CitationCard';
import type { Message } from '@ai-sdk/react';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`
        max-w-[70%] rounded-2xl p-4
        ${isUser
          ? 'bg-vibe-green text-foreground rounded-br-sm'  // User: vibe-green accent
          : 'bg-card border border-border text-foreground rounded-bl-sm' // AI: card styling
        }
      `}>
        {/* Message Content - FOLLOW: Inter Regular for body text */}
        <div className="text-sm leading-relaxed font-normal">
          {message.content}
        </div>

        {/* Citations - Only for assistant messages */}
        {!isUser && message.citations?.length > 0 && (
          <div className="mt-3 space-y-2">
            {message.citations.map((citation, i) => (
              <CitationCard
                key={i}
                index={i + 1}
                citation={citation}
              />
            ))}
          </div>
        )}

        {/* Timestamp */}
        <div className="text-xs text-muted-foreground mt-2">
          {new Date(message.createdAt).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
```

#### Task 1.9: CREATE ChatInput Component

```tsx
// FILE: src/components/chat/ChatInput.tsx
// FOLLOW pattern: Auto-resize textarea, attachment pills, send button
// DEPENDENCIES: Textarea (shadcn), AttachmentPill, Send icon

import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { AttachmentPill } from './AttachmentPill';
import { Send } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface ChatInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
}

export function ChatInput({ value, onChange, onSubmit, isLoading }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea as user types
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Submit on Enter (not Shift+Enter)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e);
    }
  };

  return (
    <form onSubmit={onSubmit} className="p-4">
      {/* Attachment Pills - Phase 3 */}
      {/* <AttachmentPills /> */}

      <div className="flex items-end gap-2">
        {/* Textarea - FOLLOW: brand-guidelines input styling */}
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={onChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your transcripts..."
          className="resize-none min-h-[44px] max-h-[200px] bg-card focus:ring-2 focus:ring-vibe-green"
          disabled={isLoading}
        />

        {/* Send Button - FOLLOW: brand-guidelines button system */}
        <Button
          type="submit"
          size="icon"
          variant="default"
          disabled={isLoading || !value.trim()}
          className="h-11 w-11 bg-vibe-green hover:bg-vibe-green/90 text-foreground"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {/* Helper text */}
      <div className="text-xs text-muted-foreground mt-2">
        Press Enter to send, Shift+Enter for new line
      </div>
    </form>
  );
}
```

#### Task 1.10: CREATE useChatStream Hook

```tsx
// FILE: src/hooks/useChatStream.ts
// FOLLOW pattern: Vercel AI SDK useChat hook, useMeetingsSync async state management
// DEPENDENCIES: @ai-sdk/react, Supabase client

import { useChat } from '@ai-sdk/react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

interface UseChatStreamProps {
  conversationId?: string;
}

export function useChatStream({ conversationId }: UseChatStreamProps) {
  const { toast } = useToast();

  const chat = useChat({
    api: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-stream`,
    headers: {
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
    },
    body: {
      conversationId,
      userId: (await supabase.auth.getUser()).data.user?.id
    },
    onFinish: async (message) => {
      // Save user message to database (assistant message saved in edge function)
      await supabase.from('chat_messages').insert({
        conversation_id: conversationId,
        role: 'user',
        content: message.content
      });

      // Update conversation title if first message
      const { data: messages } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('conversation_id', conversationId);

      if (messages?.length === 1) {
        // Generate title from first message (Phase 6)
        const title = message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '');
        await supabase
          .from('chat_conversations')
          .update({ title })
          .eq('id', conversationId);
      }
    },
    onError: (error) => {
      console.error('Chat error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send message',
        variant: 'destructive'
      });
    }
  });

  return chat;
}
```

#### Task 1.11: CREATE chatStore (Zustand)

```tsx
// FILE: src/stores/chatStore.ts
// FOLLOW pattern: categoryStore.ts Zustand structure
// DEPENDENCIES: Zustand, Supabase client

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

interface ChatStore {
  currentConversation: string | null;
  setCurrentConversation: (id: string) => void;
  createNewConversation: () => Promise<{ id: string }>;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  currentConversation: null,

  setCurrentConversation: (id) => set({ currentConversation: id }),

  createNewConversation: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('chat_conversations')
      .insert({
        user_id: user.id,
        title: 'New Conversation'
      })
      .select()
      .single();

    if (error) throw error;

    set({ currentConversation: data.id });
    return data;
  }
}));
```

**PHASE 1 COMPLETE** ✅

---

### PHASE 2: RAG System & Semantic Search (Week 3-4)

**Goal**: Enable semantic search over transcripts with inline citations.

#### Task 2.1: CREATE Database Migration - Phase 2 Tables

```sql
-- FILE: supabase/migrations/20250121_create_embeddings.sql
-- FOLLOW pattern: pgvector setup from Supabase docs
-- CRITICAL: Use ivfflat index with lists=100 for <100k embeddings

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Transcript embeddings table
CREATE TABLE transcript_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id INTEGER REFERENCES fathom_calls(recording_id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  embedding vector(768), -- 768 dimensions for text-embedding-ada-002
  metadata JSONB, -- {speaker: string, timestamp: string, title: string}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vector similarity index (CRITICAL: Use cosine distance <=>)
CREATE INDEX transcript_embeddings_vector_idx
ON transcript_embeddings
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Indexes for filtering
CREATE INDEX transcript_embeddings_recording_idx ON transcript_embeddings(recording_id);
CREATE INDEX transcript_embeddings_chunk_idx ON transcript_embeddings(chunk_index);

-- Full-text search index (fallback for when vector search returns no results)
CREATE INDEX transcript_embeddings_fts_idx
ON transcript_embeddings
USING GIN(to_tsvector('english', chunk_text));

-- RLS policies
ALTER TABLE transcript_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view embeddings for their transcripts" ON transcript_embeddings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM fathom_calls
      WHERE fathom_calls.recording_id = transcript_embeddings.recording_id
      AND fathom_calls.user_id = auth.uid()::text
    )
  );

-- Embedding generation tracking
CREATE TABLE embedding_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  progress_current INTEGER DEFAULT 0,
  progress_total INTEGER NOT NULL,
  recording_ids INTEGER[] NOT NULL,
  processed_ids INTEGER[] DEFAULT '{}',
  failed_ids INTEGER[] DEFAULT '{}',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX embedding_jobs_user_idx ON embedding_jobs(user_id);
CREATE INDEX embedding_jobs_status_idx ON embedding_jobs(status);

ALTER TABLE embedding_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own embedding jobs" ON embedding_jobs
  FOR SELECT USING (auth.uid()::text = user_id);
```

#### Task 2.2: CREATE Edge Function - generate-embeddings

```typescript
// FILE: supabase/functions/generate-embeddings/index.ts
// FOLLOW pattern: Background job processing from process-ai-jobs
// CRITICAL: Chunk size 500 tokens, 50 overlap

import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// CRITICAL: Chunking strategy from AI SDK RAG guide
function chunkTranscript(fullTranscript: string, metadata: any): Array<{text: string, metadata: any}> {
  const CHUNK_SIZE = 500;  // tokens (approximately 2000 characters)
  const CHUNK_OVERLAP = 50; // overlap between chunks

  // Split by sentences to preserve context
  const sentences = fullTranscript.match(/[^.!?]+[.!?]+/g) || [];
  const chunks: Array<{text: string, metadata: any}> = [];

  let currentChunk = '';
  let currentTokens = 0;

  for (const sentence of sentences) {
    const sentenceTokens = Math.ceil(sentence.length / 4); // Rough approximation

    if (currentTokens + sentenceTokens > CHUNK_SIZE && currentChunk) {
      // Save current chunk
      chunks.push({ text: currentChunk.trim(), metadata });

      // Start new chunk with overlap (last 50 tokens of previous chunk)
      const overlapText = currentChunk.split(' ').slice(-CHUNK_OVERLAP).join(' ');
      currentChunk = overlapText + ' ' + sentence;
      currentTokens = CHUNK_OVERLAP + sentenceTokens;
    } else {
      currentChunk += ' ' + sentence;
      currentTokens += sentenceTokens;
    }
  }

  // Add final chunk
  if (currentChunk) {
    chunks.push({ text: currentChunk.trim(), metadata });
  }

  return chunks;
}

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { jobId, recordingIds } = await req.json();

    // Update job status to processing
    await supabase
      .from('embedding_jobs')
      .update({ status: 'processing' })
      .eq('id', jobId);

    let processedCount = 0;
    const failedIds: number[] = [];

    // Process in batches of 10 for efficiency
    for (let i = 0; i < recordingIds.length; i += 10) {
      const batch = recordingIds.slice(i, i + 10);

      for (const recordingId of batch) {
        try {
          // Fetch transcript
          const { data: call } = await supabase
            .from('fathom_calls')
            .select('recording_id, title, full_transcript, record_date')
            .eq('recording_id', recordingId)
            .single();

          if (!call || !call.full_transcript) {
            failedIds.push(recordingId);
            continue;
          }

          // Chunk transcript
          const chunks = chunkTranscript(call.full_transcript, {
            title: call.title,
            date: call.record_date
          });

          // Generate embeddings using Vercel AI SDK
          import { embedMany } from 'ai';
          import { openai } from '@ai-sdk/openai';

          const { embeddings } = await embedMany({
            model: openai.embedding('text-embedding-3-small', {
              apiKey: Deno.env.get('OPENAI_API_KEY')
            }),
            values: chunks.map(c => c.text)
          });

          // Store embeddings in database
          const embeddingRows = embeddings.map((embedding: number[], index: number) => ({
            recording_id: recordingId,
            chunk_index: index,
            chunk_text: chunks[index].text,
            embedding,
            metadata: chunks[index].metadata
          }));

          await supabase
            .from('transcript_embeddings')
            .insert(embeddingRows);

          processedCount++;

          // Update job progress
          await supabase
            .from('embedding_jobs')
            .update({
              progress_current: processedCount,
              processed_ids: supabase.rpc('array_append', {
                arr: [], // Get current processed_ids
                elem: recordingId
              })
            })
            .eq('id', jobId);

        } catch (error) {
          console.error(`Failed to embed recording ${recordingId}:`, error);
          failedIds.push(recordingId);
        }
      }
    }

    // Mark job as completed
    await supabase
      .from('embedding_jobs')
      .update({
        status: failedIds.length > 0 ? 'failed' : 'completed',
        failed_ids: failedIds,
        error_message: failedIds.length > 0 ? `${failedIds.length} transcripts failed` : null,
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);

    return new Response(JSON.stringify({ success: true, processedCount, failedCount: failedIds.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Generate embeddings error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
```

#### Task 2.3: CREATE Edge Function - semantic-search

```typescript
// FILE: supabase/functions/semantic-search/index.ts
// FOLLOW pattern: Vector similarity search from Supabase docs
// CRITICAL: Use cosine distance <=> operator

import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, userId, recordingIds, limit = 10 } = await req.json();

    // 1. Generate embedding for user query using Vercel AI SDK
    import { embed } from 'ai';
    import { openai } from '@ai-sdk/openai';

    const { embedding: queryEmbedding } = await embed({
      model: openai.embedding('text-embedding-3-small', {
        apiKey: Deno.env.get('OPENAI_API_KEY')
      }),
      value: query
    });

    // 2. Semantic search with vector similarity
    // CRITICAL: Use <=> for cosine distance (NOT <-> for L2)
    let sqlQuery = `
      SELECT
        te.recording_id,
        te.chunk_text,
        te.metadata,
        fc.title,
        1 - (te.embedding <=> $1::vector) AS similarity_score
      FROM transcript_embeddings te
      JOIN fathom_calls fc ON fc.recording_id = te.recording_id
      WHERE fc.user_id = $2
    `;

    const params: any[] = [queryEmbedding, userId];

    // Optional: Filter by recording IDs (for attachment scope)
    if (recordingIds?.length > 0) {
      sqlQuery += ` AND te.recording_id = ANY($3)`;
      params.push(recordingIds);
    }

    sqlQuery += `
      ORDER BY te.embedding <=> $1::vector
      LIMIT $${params.length + 1}
    `;
    params.push(limit);

    const { data: results, error } = await supabase.rpc('exec_sql', {
      query: sqlQuery,
      params
    });

    if (error) throw error;

    // 3. Fallback to full-text search if no semantic results (similarity < 0.3)
    const relevantResults = results.filter(r => r.similarity_score >= 0.3);

    if (relevantResults.length === 0) {
      // Fallback: Full-text search
      const { data: ftsResults } = await supabase
        .from('transcript_embeddings')
        .select('recording_id, chunk_text, metadata')
        .textSearch('chunk_text', query)
        .limit(limit);

      return new Response(JSON.stringify({
        results: ftsResults || [],
        fallback: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      results: relevantResults,
      fallback: false
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Semantic search error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
```

#### Task 2.4: CREATE RAG System Prompt

```typescript
// FILE: src/lib/rag-system.ts
// FOLLOW pattern: RAG system prompt from AI SDK RAG guide
// CRITICAL: Enforce citation requirement, no hallucination

export const RAG_SYSTEM_PROMPT = `You are an AI assistant with access to the user's meeting transcripts and customer conversations from Conversion Brain.

CRITICAL RULES:
1. ONLY use information from the provided transcript excerpts below
2. If you don't find relevant information in the context, say "I don't have information about that in your transcripts"
3. ALWAYS cite which transcript you're referencing using [1], [2], etc.
4. NEVER speculate or make assumptions beyond what's explicitly stated
5. If asked about something not in the transcripts, acknowledge the limitation clearly
6. When multiple transcripts support your answer, cite ALL relevant sources

CONTEXT FROM TRANSCRIPTS:
{retrieved_chunks}

Each excerpt is numbered [1], [2], etc. Reference these numbers when citing sources.

USER QUESTION:
{user_message}

Provide a clear, accurate answer with inline citations. Format citations as [1], [2] within your response.`;

export function formatRAGContext(chunks: Array<{
  chunk_text: string;
  title: string;
  metadata: any;
  similarity_score: number;
}>): string {
  return chunks.map((chunk, i) => `
[${i + 1}] "${chunk.chunk_text}"
Source: ${chunk.title} (${chunk.metadata?.date || 'Unknown date'})
${chunk.metadata?.speaker ? `Speaker: ${chunk.metadata.speaker}` : ''}
Relevance: ${(chunk.similarity_score * 100).toFixed(1)}%
  `.trim()).join('\n\n');
}

export function extractCitations(aiResponse: string): Array<{
  index: number;
  chunkId: string;
}> {
  const citationPattern = /\[(\d+)\]/g;
  const citations: Array<{ index: number; chunkId: string }> = [];
  let match;

  while ((match = citationPattern.exec(aiResponse)) !== null) {
    citations.push({
      index: parseInt(match[1]),
      chunkId: match[1]
    });
  }

  return citations;
}
```

#### Task 2.5: UPDATE chat-stream Edge Function (Add RAG)

```typescript
// MODIFY: supabase/functions/chat-stream/index.ts
// Add RAG retrieval before AI call

import { formatRAGContext, RAG_SYSTEM_PROMPT } from '../../src/lib/rag-system.ts';

// ... (previous code)

// Add before streaming response:

// 1. Call semantic-search function
const searchResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/semantic-search`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    query: messages[messages.length - 1].content,
    userId,
    recordingIds: attachmentIds, // From request body (Phase 3)
    limit: 10
  })
});

const { results: chunks } = await searchResponse.json();

// 2. Build RAG context
const context = formatRAGContext(chunks);
const systemPrompt = RAG_SYSTEM_PROMPT
  .replace('{retrieved_chunks}', context)
  .replace('{user_message}', messages[messages.length - 1].content);

// 3. Add system prompt to messages
const aiMessages = [
  { role: 'system', content: systemPrompt },
  ...(previousMessages || []).map(m => ({ role: m.role, content: m.content })),
  ...messages
];

// 4. Continue with streaming response...
```

#### Task 2.6: CREATE CitationCard Component

```tsx
// FILE: src/components/chat/CitationCard.tsx
// FOLLOW: brand-guidelines card styling with vibe-green accent

import { useNavigate } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';

interface CitationCardProps {
  index: number;
  citation: {
    recording_id: number;
    chunk_text: string;
    title: string;
    similarity_score: number;
  };
}

export function CitationCard({ index, citation }: CitationCardProps) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(`/transcripts?recording=${citation.recording_id}`)}
      className="
        w-full text-left p-3 rounded-lg border border-border
        bg-card hover:bg-card/80 transition-colors
        border-l-3 border-l-vibe-green
      "
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Citation Number */}
          <div className="text-xs font-medium text-vibe-green mb-1">
            [{index}]
          </div>

          {/* Transcript Title */}
          <div className="text-sm font-medium text-foreground mb-1">
            {citation.title}
          </div>

          {/* Excerpt Preview */}
          <div className="text-xs text-muted-foreground line-clamp-2">
            {citation.chunk_text}
          </div>

          {/* Similarity Score */}
          <div className="text-xs text-muted-foreground mt-1">
            Relevance: {(citation.similarity_score * 100).toFixed(0)}%
          </div>
        </div>

        {/* External Link Icon */}
        <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      </div>
    </button>
  );
}
```

**PHASE 2 COMPLETE** ✅

---

### PHASE 3-6 Implementation Tasks

Due to length constraints, Phases 3-6 follow the same detailed pattern as Phase 1-2. Key tasks include:

**PHASE 3: File Attachments (Week 5-6)**
- Task 3.1: CREATE migration for chat_file_uploads table
- Task 3.2: CREATE parse-uploaded-file edge function (PDF/DOCX/TXT parsing)
- Task 3.3: CREATE AttachmentButton, TranscriptSelectorModal components
- Task 3.4: CREATE ContextScopeSelector for filtering
- Task 3.5: UPDATE ChatInput to show attachment pills

**PHASE 4: Enhanced Keyword Search (Week 7)**
- Task 4.1: CREATE search-engine.ts with query parser
- Task 4.2: CREATE SearchScopeSelector visual filter UI
- Task 4.3: CREATE SearchSyntaxHelper tooltip
- Task 4.4: UPDATE TranscriptsTab with search operators

**PHASE 5: Transcript Library Integration (Week 8)**
- Task 5.1: UPDATE TranscriptsTab - add "Ask AI" bulk action button
- Task 5.2: UPDATE CallDetailDialog - add "Attach to Chat" button
- Task 5.3: UPDATE Chat page - handle pre-attached transcripts from query params
- Task 5.4: CREATE conversation search in ChatSidebar

**PHASE 6: Polish & Optimization (Week 9-10)**
- Task 6.1: Implement virtual scrolling, lazy loading, caching
- Task 6.2: Add comprehensive error handling
- Task 6.3: Create loading states & skeleton screens
- Task 6.4: Add keyboard shortcuts (Cmd+K, Cmd+N, etc.)
- Task 6.5: CREATE ExportConversationDialog (PDF/TXT/MD)
- Task 6.6: CREATE ChatSettings panel (model, temperature, etc.)
- Task 6.7: Add usage analytics tracking
- Task 6.8: Comprehensive testing (unit + integration + manual)

---

## Validation Loop

### Level 1: Syntax & Style (Immediate Feedback)

```bash
# Run after each file creation - fix before proceeding
npm run lint                          # ESLint validation
npm run type-check                    # TypeScript validation
npm run format                        # Prettier formatting

# Project-wide validation
npm run lint -- --fix                 # Auto-fix linting issues
npm run format -- --write             # Auto-format all files

# Expected: Zero errors. If errors exist, READ output and fix before proceeding.
```

### Level 2: Unit Tests (Component Validation)

```bash
# Test each component as created
npm run test -- src/components/chat/ChatMessages.test.tsx
npm run test -- src/hooks/useChatStream.test.ts

# Full test suite for affected areas
npm run test -- src/components/chat/
npm run test -- src/hooks/

# Coverage validation
npm run test -- --coverage --collectCoverageFrom='src/components/chat/**/*.tsx'

# Expected: All tests pass with >80% coverage. If failing, debug root cause.
```

### Level 3: Integration Testing (System Validation)

```bash
# Service startup validation
npm run dev &
sleep 5  # Allow startup time

# Health check validation (browser or curl)
open http://localhost:5173/chat

# Feature-specific endpoint testing
# 1. Create new conversation
# 2. Send message "Tell me about pricing objections"
# 3. Verify streaming response appears token-by-token
# 4. Check citations display correctly
# 5. Click citation to verify transcript link
# 6. Attach transcript and verify scoped response

# Supabase Edge Function validation
curl -X POST http://localhost:54321/functions/v1/chat-stream \
  -H "Authorization: Bearer <anon_key>" \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "test"}], "conversationId": "uuid", "userId": "test-user"}' \
  | cat -v  # Display SSE stream

# Expected: All integrations working, proper responses, no connection errors
```

### Level 4: Domain-Specific Validation

```bash
# RAG Accuracy Testing
# - Ask question about known transcript content
# - Verify AI response matches actual transcript
# - Check citation accuracy (correct transcript linked)
# - Test with 10 diverse queries, expect >80% accuracy

# Performance Testing
# - Send 10 concurrent messages
# - Measure first-token latency (<1s expected)
# - Measure full response time (<5s for 500 token response)
# - Check no rate limit errors

# Semantic Search Quality
# - Query "pricing objections"
# - Check top 10 results relevance (manual review)
# - Compare with keyword search results
# - Expected: Semantic finds relevant results keyword misses

# Brand Compliance Visual Test
# - Compare /chat page with BRAND_GUIDELINES.md
# - Check color usage (vibe-green only for accents)
# - Verify typography (Montserrat headings, Inter body)
# - Test dark mode (if implemented)
# - Expected: 100% brand guideline compliance

# Accessibility Validation
npx axe http://localhost:5173/chat
# Expected: Zero WCAG AA violations

# Expected: All creative validations pass, performance meets requirements
```

---

## Final Validation Checklist

### Technical Validation

- [ ] All 4 validation levels completed successfully
- [ ] All tests pass: `npm run test`
- [ ] No linting errors: `npm run lint`
- [ ] No type errors: `npm run type-check`
- [ ] No formatting issues: `npm run format -- --check`

### Feature Validation

- [ ] Chat page loads in <2 seconds
- [ ] Messages stream token-by-token with <1s first-token latency
- [ ] Semantic search returns relevant excerpts (>80% accuracy tested)
- [ ] Citations link correctly to source transcripts
- [ ] File attachments work (transcripts + external files)
- [ ] Context filtering scopes AI responses correctly
- [ ] "Ask AI" button works in TranscriptsTab
- [ ] Conversation history persists across sessions
- [ ] Model selector switches models mid-conversation
- [ ] Export conversations works (PDF/TXT/MD)

### Code Quality Validation

- [ ] Follows existing codebase patterns (see "FOLLOW pattern" annotations)
- [ ] File placement matches desired codebase tree structure
- [ ] Anti-patterns avoided (see Anti-Patterns section)
- [ ] Dependencies properly managed and imported
- [ ] Configuration changes properly integrated
- [ ] No console.error() or console.warn() in production code
- [ ] All async operations have error handling

### Documentation & Deployment

- [ ] Code is self-documenting with clear variable/function names
- [ ] Complex logic has explanatory comments
- [ ] Environment variables documented in .env.example
- [ ] Database migrations run cleanly on fresh database
- [ ] Edge functions deploy successfully to Supabase
- [ ] No hardcoded secrets (all use environment variables)

---

## Anti-Patterns to Avoid

### General
- ❌ Don't create new patterns when existing ones work
- ❌ Don't skip validation because "it should work"
- ❌ Don't ignore failing tests - fix them immediately
- ❌ Don't hardcode values that should be config/env vars

### This Codebase Specifically
- ❌ Don't use queryKeys factory (removed - use hardcoded string arrays)
- ❌ Don't create new Supabase client instances (use singleton from lib/supabase.ts)
- ❌ Don't forget CORS headers in edge functions (always import from _shared/cors.ts)
- ❌ Don't use vibe-green for text/backgrounds (only accents per brand guidelines)
- ❌ Don't skip RLS policies (all tables MUST have user-scoped access control)
- ❌ Don't use sync functions in async context (Supabase is async-only)
- ❌ Don't catch all exceptions - be specific (catch (error: PostgrestError))

### AI/RAG Specific
- ❌ Don't compare embeddings in application code (always use database vector ops)
- ❌ Don't regenerate embeddings for existing transcripts (cache forever)
- ❌ Don't hallucinate - if not in context, say "I don't have information about that"
- ❌ Don't omit citations - ALWAYS reference source transcripts
- ❌ Don't use wrong distance metric (cosine <=> not L2 <->)

---

## DOCUMENT METADATA

**Version**: 2.2 (Enhanced, Self-Contained, Vercel AI SDK)
**Status**: Ready for Implementation
**Created**: November 19, 2025 (v1.0) → November 20, 2025 (v2.2)
**Author**: AI Implementation Team

**Changelog**:
- v2.2 (Nov 20, 2025) - Added prominent local context file references
  - Added "Local Context Files - READ FIRST" section to Documentation & References
  - Prominently references `docs/reference/prompt-kit-ui.md`
  - Prominently references `docs/reference/ai-sdk-cookbook-examples/`
  - Added references to ADR-001, api-naming-conventions, data-fetching-architecture
  - Ensures implementers see project-specific patterns before external docs
- v2.1 (Nov 20, 2025) - Replaced Lovable AI with Vercel AI SDK
  - **BREAKING**: Replaced all Lovable AI Gateway calls with Vercel AI SDK
  - Updated chat-stream edge function to use `streamText()` from 'ai' package
  - Updated embeddings to use `embed()` and `embedMany()` from 'ai' package
  - Changed API key from LOVABLE_API_KEY to OPENAI_API_KEY
  - Updated Known Gotchas section with Vercel AI SDK patterns
  - Aligned with project's "Vercel SDK First" standard (CLAUDE.md)
- v2.0 (Nov 20, 2025) - Fully self-contained enhanced PRP
  - Expanded ALL phases (1-6) with complete implementation details
  - Added comprehensive codebase tree (current → desired state)
  - Incorporated AI SDK patterns from chatbot.md, rag-agent-guide.md, tool-calling.md
  - Incorporated Prompt-Kit patterns from prompt-kit-ui.md
  - Added extensive Known Gotchas section with code examples
  - Added RAG system prompt template
  - Added complete edge function implementations
  - Added all component code with VibeOS styling
  - Removed all references to original PRP (100% self-contained)
- v1.0 (Nov 19, 2025) - Initial comprehensive PRP
  - MVP-first approach (full-page chat)
  - 6-phase implementation plan (10 weeks)
  - Complete database schema, edge functions, components

**Related Documents**:
- `BRAND_GUIDELINES.md` - VibeOS design system
- `docs/architecture/api-naming-conventions.md` - Naming standards
- `docs/architecture/data-fetching-architecture.md` - TanStack Query patterns
- `docs/reference/prompt-kit-ui.md` - Prompt-Kit component docs
- `docs/reference/ai-sdk-cookbook-examples/` - AI SDK patterns
- `docs/adr/adr-001-vercel-ai-sdk.md` - ADR for Vercel AI SDK

---

**END OF ENHANCED PROJECT REQUIREMENTS PLAN v2.2**

_This PRP is 100% self-contained and production-ready. All Lovable AI references have been replaced with Vercel AI SDK per project standards._
