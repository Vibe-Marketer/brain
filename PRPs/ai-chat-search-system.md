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

**Target User**: Product Manager / Sales Leader using CallVault

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
- **Strategic Priority**: Differentiates CallVault from transcript storage tools (Fireflies, Gong) by adding AI-powered insights layer

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
```