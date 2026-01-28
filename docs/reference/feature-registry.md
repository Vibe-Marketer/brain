# CallVault Feature Registry

**Version:** 1.0
**Last Updated:** January 26, 2026
**Status:** Authoritative Source of Truth
**Total Features:** 97 (54 Production, 12 Beta/Partial, 7 Scaffolded, 4 Orphaned, 20 Planned)

> This is the single canonical reference for every CallVault feature. For analysis findings (security, tech debt, recommendations), see `feature-audit-report.md`. For future enhancements and business model vision, see `feature-roadmap.md`.

---

## Status Definitions

| Status | Meaning |
|--------|---------|
| **Production** | Fully functional in both backend and frontend. Accessible to users. |
| **Beta** | Fully built but not yet verified end-to-end in production conditions. |
| **Partial** | Backend or data layer exists; no dedicated UI or incomplete integration. |
| **Scaffolded** | UI component exists but renders placeholder content or is not wired to data. |
| **Orphaned** | Fully built page with no route in App.tsx. Users cannot reach it. |
| **Planned** | Not yet built. Documented for roadmap purposes. |

---

## 1. Core Platform

The foundation of the high-density "Pro Tool" workspace experience.

### 1.1 3-Pane AppShell
**Status:** Production
**What it does:** The entire app uses a Loop-inspired three-column layout: a left NavRail for top-level navigation, a middle Category Pane for lists and filters, and a right Detail View for content. All pane transitions use consistent 500ms animations. This layout is used across Settings, Sorting & Tagging, Analytics, Collaboration, and Content Hub.
**Why it matters:** Users get a professional, information-dense workspace that keeps navigation, context, and detail visible simultaneously without page reloads.
**Evidence:** `AppShell.tsx`, `PaneContainer.tsx`, all pane components.

### 1.2 Authentication
**Status:** Production
**What it does:** Email/password sign-up and sign-in, plus Google OAuth as an alternative. Supabase Auth handles JWT tokens, session management, and protected routes. Unauthenticated users are redirected to the login page.
**Why it matters:** Secure, flexible access with the convenience of Google single-click login.
**Evidence:** `Login.tsx`, `AuthContext.tsx`, `ProtectedRoute.tsx`.

### 1.3 Dark/Light Theme
**Status:** Production
**What it does:** System-aware theme switching that detects the user's OS preference and applies the corresponding theme. Users can also manually toggle. Preference is persisted across sessions.
**Why it matters:** Comfortable viewing in any lighting environment without manual configuration.
**Evidence:** `ThemeContext.tsx`, `ThemeSwitcher.tsx`, `tailwind.config.ts` (dark mode class strategy).

### 1.4 Real-Time State Sync
**Status:** Production
**What it does:** Changes to organization, settings, and call data propagate instantly across all open browser tabs via Supabase Realtime subscriptions. If you tag a call in one tab, the other tab reflects it immediately.
**Why it matters:** Users who work with multiple tabs never see stale data.
**Evidence:** `useSyncTabState` hook, `webhook_deliveries` Realtime publication.

### 1.5 Command+K Global Search
**Status:** Production
**What it does:** A keyboard-activated (Cmd+K) modal that performs semantic search across all transcripts. Features 300ms debounce to prevent excessive queries, diversity filtering (max 3 results per recording to avoid one call dominating results), and source platform filtering.
**Why it matters:** Users can find any piece of information from any call instantly, from anywhere in the app.
**Evidence:** `useGlobalSearch.ts`, `searchStore.ts`, `GlobalSearchModal.tsx`.

### 1.6 Debug Panel
**Status:** Production
**What it does:** An in-app developer console that surfaces webhook delivery logs, database state, and environment configuration. Includes a webhook delivery viewer for inspecting payloads and response codes.
**Why it matters:** Developers and admins can diagnose integration issues without leaving the app.
**Evidence:** `DebugPanel.tsx`, `DebugPanelContext.tsx`, `WebhookDeliveryViewerV2.tsx`.

### 1.7 Setup Wizard
**Status:** Production
**What it does:** A guided onboarding flow that walks first-time users through connecting their first integration (Fathom, Zoom, or Google Meet), configuring their profile, and understanding the app layout. Fathom uses a 5-step wizard.
**Why it matters:** New users reach value quickly instead of staring at an empty dashboard.
**Evidence:** `useSetupWizard.ts`, `FathomSetupWizard.tsx`, `ZoomSetupWizard.tsx`, `GoogleMeetSetupWizard.tsx`.

### 1.8 Keyboard Shortcuts
**Status:** Production
**What it does:** Configurable keyboard shortcut system. Cmd+K opens global search, Cmd+/ opens help, Escape closes panels and modals. Arrow key navigation for lists.
**Why it matters:** Power users can navigate the entire app without touching the mouse.
**Evidence:** `useKeyboardShortcut.ts`, `useListKeyboardNavigation.ts`.

### 1.9 Responsive Layout
**Status:** Production
**What it does:** Breakpoint-aware layout adjustments that adapt the 3-pane shell for tablets and smaller screens. Mobile detection adjusts interaction patterns.
**Why it matters:** Usable on devices beyond desktop monitors.
**Evidence:** `useBreakpoint.ts`, `use-mobile.tsx`.

### 1.10 Error Boundary
**Status:** Production
**What it does:** A global React error boundary that catches unhandled component errors and renders a recovery UI instead of crashing the entire application.
**Why it matters:** A bug in one component doesn't take down the whole app.
**Evidence:** `ErrorBoundary.tsx`.

### 1.11 Error Tracking (Sentry)
**Status:** Production
**What it does:** Sentry integration that captures runtime errors, unhandled promise rejections, and performance data in production. Includes source maps for readable stack traces.
**Why it matters:** Production issues are detected and reported automatically.
**Evidence:** `sentry.ts`, Vite Sentry plugin.

### 1.12 Toast Notifications
**Status:** Production
**What it does:** Application-wide notification system for success, error, warning, and info messages. Non-blocking, auto-dismissing, stackable.
**Why it matters:** Users get clear, immediate feedback for every action.
**Evidence:** `sonner.tsx`, `use-toast.ts`.

### 1.13 Security Headers
**Status:** Production
**What it does:** Vercel deployment includes Content-Security-Policy, X-Frame-Options (DENY), Strict-Transport-Security (HSTS), and X-Content-Type-Options headers on all responses.
**Why it matters:** Browser-level protection against XSS, clickjacking, and protocol downgrade attacks.
**Evidence:** `vercel.json`.

### 1.14 CI/CD Pipeline
**Status:** Production
**What it does:** GitHub Actions workflows that auto-deploy Edge Functions on push. Security scanning pipeline includes TruffleHog (secret detection), npm audit (dependency vulnerabilities), dependency review, and Claude AI code review.
**Why it matters:** Every deployment is automatically validated for security before reaching production.
**Evidence:** `.github/workflows/` (7 workflows).

### 1.15 Row-Level Security
**Status:** Production
**What it does:** All 38 database tables have Supabase RLS policies enabled. Patterns include user-owned data isolation, admin access, service role bypass, relationship-based access (coaching/team), and workspace-based scoping.
**Why it matters:** Data is isolated at the database level. Even a frontend bug cannot expose another user's data.
**Evidence:** All migration files, `has_role()` DB function.

---

## 2. Multi-Source Ingestion & Sync

The "Universal Inbox" for business conversations. Connect any recording source and bring everything into one place.

### 2.1 Fathom Integration
**Status:** Production
**What it does:** Full OAuth2 connection to Fathom with three sync mechanisms: (1) webhook for real-time new call ingestion with HMAC signature verification, (2) manual sync for on-demand pulls, and (3) historical sync for importing existing recordings. A 5-step setup wizard guides connection. All webhook processing is idempotent -- duplicate deliveries are safely ignored.
**Why it matters:** Every Fathom call automatically appears in CallVault within seconds of completion, plus the entire history can be imported.
**Evidence:** 6 Edge Functions (`fathom-oauth-*`, `save-fathom-key`, `create-fathom-webhook`, `webhook`), `FathomSetupWizard.tsx`.

### 2.2 Zoom Integration
**Status:** Beta
**What it does:** Direct API connection for Zoom Cloud recordings via OAuth. Includes webhook listener for real-time notifications, manual sync for on-demand pulls, and a VTT transcript parser for Zoom's native caption format. Setup wizard guides OAuth connection.
**Why it matters:** Sales teams and coaches using Zoom can bring their recordings into CallVault alongside Fathom calls.
**Evidence:** 5 Edge Functions (`zoom-*`), `ZoomSetupWizard.tsx`, `vtt-parser.ts`.
**Note:** Fully built. Awaiting end-to-end production verification before promoting to Production.

### 2.3 Google Meet Integration
**Status:** Beta
**What it does:** OAuth connection to Google Workspace with automated polling sync (every 15 minutes via pg_cron) and manual sync. Uses Google Calendar API for meeting discovery and Google Drive API for recording retrieval. Setup wizard guides connection.
**Why it matters:** Teams using Google Workspace can automatically import all their Meet recordings.
**Evidence:** 5 Edge Functions (`google-*`), `GoogleMeetSetupWizard.tsx`, pg_cron job.
**Note:** Fully built. Requires Google Workspace tier (not available on free Gmail). Awaiting end-to-end verification.

### 2.4 YouTube Import
**Status:** Beta (API Only)
**What it does:** Edge Function that fetches transcripts from YouTube videos via the YouTube API. Can import podcast episodes, webinar recordings, and other public video content.
**Why it matters:** Expands CallVault beyond meeting recordings to include any video content with transcripts.
**Evidence:** `youtube-api/index.ts`, API client methods in `src/lib/api-client.ts`.
**Note:** API backend exists. No UI import flow or setup wizard yet. See roadmap.

### 2.5 Selective Ingestion
**Status:** Production
**What it does:** Before syncing, users can preview meeting metadata (titles, dates, participants, duration) and choose which specific calls to import. Date range selection is available for initial historical imports.
**Why it matters:** Users control exactly what enters their library instead of getting flooded with every meeting.
**Evidence:** `useIntegrationSync.ts`, `useMeetingsSync.ts`, `SyncTab.tsx`.

### 2.6 Multi-Source Deduplication
**Status:** Production
**What it does:** When the same meeting is recorded on multiple platforms (e.g., Fathom + Zoom), the system detects and handles duplicates using fuzzy matching across three dimensions: title similarity (Levenshtein distance >= 80%), time overlap (>= 50%), and participant overlap (>= 60%). Any 2 of 3 criteria matching triggers dedup. Four priority modes let users control which source "wins."
**Why it matters:** Users connecting multiple recording platforms never see the same call twice. This is a key differentiator -- no other platform handles cross-source dedup.
**Evidence:** `_shared/deduplication.ts` (464 lines), `_shared/dedup-fingerprint.ts` (329 lines), `SourcePriorityModal.tsx`.

### 2.7 Sync Progress Tracking
**Status:** Production
**What it does:** Real-time progress display for sync operations with polling. Shows job status, progress percentage, and results. Active sync jobs appear in a dedicated card.
**Why it matters:** Users know exactly what's happening during sync instead of wondering if it's working.
**Evidence:** `sync_jobs` table, `SyncStatusIndicator.tsx`, `ActiveSyncJobsCard.tsx`.

---

## 3. Organization & Management

Turning a pile of transcripts into a structured, searchable knowledge base.

### 3.1 Folder System
**Status:** Production
**What it does:** Three-level nested folder hierarchy with custom icons, colors, and descriptions. Drag-and-drop assignment of calls to folders. Self-referencing `parent_id` for nesting. Folders serve as the primary organizational structure -- including as the mechanism for delegating access to coaches and team managers.
**Why it matters:** Users organize calls by client, project, topic, or any other scheme. Folders also double as the sharing/delegation mechanism ("share this folder with my coach").
**Evidence:** `useFolders.ts`, `useDragAndDrop.ts`, `FolderSidebar.tsx`, `folders` table.

### 3.2 Hidden Folders
**Status:** Production
**What it does:** Users can mark specific folders as hidden, which excludes their contents from the "All Transcripts" view. Preference is persisted in localStorage.
**Why it matters:** Keeps the main view focused on active work. Archive or low-priority folders don't clutter the primary list.
**Evidence:** `useHiddenFolders.ts`.

### 3.3 Tag System
**Status:** Production
**What it does:** 16 built-in system tags plus unlimited user-created tags. Maximum of 2 tags per call (enforced by database trigger). Tags have a primary/secondary distinction. Tags are used throughout the app for filtering, automation triggers, and delegation rules.
**Why it matters:** Lightweight, flexible classification that works alongside folders. Tags also drive automation rules and sharing delegation.
**Evidence:** `call_tags` table, `check_max_tags()` trigger, `TagsTab.tsx`.

### 3.4 Tag Rules (Auto-Sort)
**Status:** Production
**What it does:** Configurable rules that automatically assign tags and/or folders to incoming calls. Rule conditions include: title exact match, title contains, title regex, participant matching, day/time filters, and transcript keyword detection. Rules are priority-ordered and can assign both a tag and a folder simultaneously.
**Why it matters:** New calls are automatically organized the moment they arrive. Users set up rules once and never manually sort again.
**Evidence:** `tag_rules` table, `apply_tag_rules()` DB function, `RulesTab.tsx`.

### 3.5 Auto-Tagging (AI)
**Status:** Production
**What it does:** AI-driven tagging that analyzes transcript content for keyword patterns and assigns appropriate tags automatically. Operates as a backend Edge Function that can be triggered manually or via automation.
**Why it matters:** Goes beyond rule-based matching -- uses AI to understand content and apply tags that a keyword rule might miss.
**Evidence:** `auto-tag-calls` Edge Function.

### 3.6 AI Title Generation
**Status:** Production
**What it does:** Automatically generates descriptive titles for calls that have generic names (like "Meeting with John" or "Zoom Call"). Supports bulk operations across multiple calls.
**Why it matters:** A library full of "Zoom Meeting" titles is useless. AI-generated titles make calls findable at a glance.
**Evidence:** `generate-ai-titles` Edge Function.

### 3.7 Recurring Title Detection
**Status:** Production
**What it does:** Aggregate database view that identifies recurring meeting series by title pattern, showing occurrence counts. Surfaces in a dedicated tab within the Sorting & Tagging interface.
**Why it matters:** Users can quickly identify their regular meetings (weekly team sync, monthly review, etc.) and apply bulk actions to series.
**Evidence:** `recurring_call_titles` DB view, `RecurringTitlesTab.tsx`.

### 3.8 SKIP Auto-Tag
**Status:** Production
**What it does:** A database trigger that automatically applies the "SKIP" tag to calls with no transcript or very short transcripts. Runs automatically on insert.
**Why it matters:** Keeps the library clean by flagging calls that have no useful content (failed recordings, brief check-ins).
**Evidence:** `ensure_skip_tag()` trigger.

### 3.9 Bulk Action Toolbar
**Status:** Production
**What it does:** Context-aware multi-select toolbar that appears when multiple calls are selected. Actions include: assign tags, move to folder, export (multiple formats), and delete. Selection state is managed with keyboard modifiers (shift-click for range, ctrl-click for toggle).
**Why it matters:** Users can reorganize dozens or hundreds of calls in seconds instead of editing one at a time.
**Evidence:** `BulkActionToolbarEnhanced.tsx`.

### 3.10 Call Detail View
**Status:** Production
**What it does:** Four-tab detail panel for any selected call: (1) Overview with editable title/summary and metadata, (2) Transcript with speaker grouping, timestamps, export, and inline editing, (3) Participants list, (4) Invitees list.
**Why it matters:** All information about a call is accessible from one panel without navigating away from the library.
**Evidence:** `CallDetailDialog.tsx`, `call-detail/` components.

### 3.11 Transcript Editing
**Status:** Production
**What it does:** Non-destructive inline editing of transcript text and speaker names. Segments can be soft-deleted (hidden but not destroyed). Full edit history is tracked per-segment via `edited_text`, `edited_speaker_name`, and `is_deleted` fields.
**Why it matters:** Users can fix transcription errors, correct speaker attribution, and remove irrelevant segments without losing the original data.
**Evidence:** `fathom_transcripts` table fields, transcript editing UI in call detail view.

### 3.12 Speaker Management
**Status:** Partial
**What it does:** `speakers` and `call_speakers` database tables exist and are populated during ingestion. Speaker data appears in call detail views and is queryable via chat tools (`searchBySpeaker`). However, there is no dedicated UI for managing speaker identities, merging duplicates, or setting internal/external status.
**Why it matters:** Speaker data exists and powers search, but users cannot currently curate or clean up their speaker directory.
**Evidence:** `speakers` + `call_speakers` tables, chat tool integration.

---

## 4. AI Chat & Discovery (RAG)

Conversational access to every word ever spoken in the business.

### 4.1 Streaming AI Chat
**Status:** Production
**What it does:** Real-time natural language interaction with the entire call library via OpenRouter LLM inference. Uses AI SDK v5 Data Stream Protocol for token-by-token streaming. Multi-model selection is tier-gated (FREE/PRO/TEAM/ADMIN). The chat-stream Edge Function is ~2,000 lines covering tool definitions, search execution, context building, and response streaming.
**Why it matters:** Users can ask questions in plain English and get answers drawn from their entire call history, with sources cited.
**Evidence:** `chat-stream` Edge Function (1997 lines), `Chat.tsx`, `useChatSession.ts`.

### 4.2 14 Agentic Chat Tools
**Status:** Production
**What it does:** The LLM has access to 14 specialized tools it can invoke during conversation, each with its own Zod schema. Supports multi-step reasoning (up to 5 tool call loops per request). All search tools route through `executeHybridSearch()`: embedding generation, `hybrid_search_transcripts` RPC, HuggingFace cross-encoder reranking, and diversity filtering.

**Core Search (4):**
- `searchTranscriptsByQuery` -- General semantic + keyword search
- `searchBySpeaker` -- Filter by speaker name or email
- `searchByDateRange` -- Temporal queries with start/end boundaries
- `searchByCategory` -- Filter by call category/tag

**Metadata-Specific Search (5):**
- `searchByIntentSignal` -- Find buying signals, objections, questions, concerns, feature requests, testimonials, decisions
- `searchBySentiment` -- Filter by emotional tone
- `searchByTopics` -- Search auto-extracted topic labels
- `searchByUserTags` -- Search user-assigned tags
- `searchByEntity` -- Find named entities (companies, people, products, technologies)

**Analytical (3):**
- `getCallDetails` -- Full call metadata, summary, participants, tags, folders
- `getCallsList` -- List calls with filters and summary previews
- `getAvailableMetadata` -- Discover what speakers, categories, topics, tags, intents, sentiments exist in the library

**Advanced (2):**
- `advancedSearch` -- Multi-filter combined query (date + speaker + sentiment + intent + topics in one call)
- `compareCalls` -- Side-by-side comparison of 2-5 calls by recording ID

**Why it matters:** The AI doesn't just search text -- it can reason across metadata dimensions, compare calls, and discover what's in the library. This is enterprise-grade agentic search, not basic keyword matching.
**Evidence:** `chat-stream/index.ts` tool definitions.

### 4.3 Hybrid RAG Search
**Status:** Production
**What it does:** Combines pgvector semantic search (vector similarity) with PostgreSQL tsvector keyword search (exact term matching). Results from both are merged using Reciprocal Rank Fusion (k=60) to produce a unified ranked list that captures both semantic meaning and exact keywords.
**Why it matters:** Pure semantic search misses exact terms; pure keyword search misses meaning. Hybrid gives the best of both.
**Evidence:** `hybrid_search_transcripts` DB function, `semantic-search` Edge Function.

### 4.4 Cross-Encoder Reranking
**Status:** Production
**What it does:** After initial hybrid retrieval, results are re-scored using HuggingFace's `cross-encoder/ms-marco-MiniLM-L-12-v2` model. Processes results in batches of 10. Gracefully degrades to RRF scores if the reranking service is unavailable.
**Why it matters:** Cross-encoder reranking dramatically improves search precision. This is a technique typically reserved for enterprise search systems costing millions.
**Evidence:** Inline in `chat-stream`, standalone `rerank-results` Edge Function.

### 4.5 Context Citations
**Status:** Production
**What it does:** AI responses include visual "Source" links to the specific transcript chunks that informed the answer. Hover cards show the call title, speaker, date, and similarity score for each cited source.
**Why it matters:** Users can verify every AI answer against the original transcript. Trust through transparency.
**Evidence:** `source.tsx`, `Sources` component.

### 4.6 Tool Call Visualization
**Status:** Production
**What it does:** During agentic chat, each tool invocation is displayed as a collapsible card showing pending/running/success/error states with full input/output JSON. Users can see exactly what the AI searched for and what it found.
**Why it matters:** Full transparency into the AI's reasoning process. Users understand why they got a particular answer.
**Evidence:** `tool-call.tsx`.

### 4.7 Chat Session Management
**Status:** Production
**What it does:** Chat sessions are persisted with filters (date range, speakers, categories, specific calls), message history, pin/archive functionality, and message count tracking. Users can resume any previous conversation.
**Why it matters:** Important research conversations are saved and organized, not lost when the tab closes.
**Evidence:** `chat_sessions` + `chat_messages` tables, `useChatSession.ts`.

### 4.8 AI Model Selection
**Status:** Production
**What it does:** Admin-managed model catalog synced from OpenRouter. Models are organized by tiers (FREE/PRO/TEAM/ADMIN). Users select from models available at their tier. Admins can enable/disable models, set tier requirements, and mark defaults.
**Why it matters:** Users choose the right model for the task -- fast/cheap for simple queries, powerful for complex analysis.
**Evidence:** `ai_models` table, `sync-openrouter-models` Edge Function, `AdminModelManager.tsx`, `ModelSelector` component.

### 4.9 Chat Context Attachments
**Status:** Production
**What it does:** An @mention system that lets users attach specific calls to the chat context. When a call is @mentioned, its full transcript and metadata are included in the AI's context window, scoping the conversation to those specific calls.
**Why it matters:** Users can focus the AI on specific conversations instead of searching the entire library.
**Evidence:** `useMentions.ts`, `prompt-input.tsx`.

---

## 5. Embedding Pipeline

The infrastructure that makes semantic search and AI features possible.

### 5.1 Adaptive Transcript Chunking
**Status:** Production
**What it does:** Speaker-aware chunking that splits transcripts into search-optimized segments. Target size: 500 tokens. Maximum: 1,200 tokens. Overlap: 100 tokens between chunks. Oversized segments are split at sentence boundaries to preserve meaning. Speaker attribution is maintained per-chunk.
**Why it matters:** Chunk quality directly determines search quality. Speaker-aware, sentence-boundary chunking produces dramatically better search results than naive splitting.
**Evidence:** `process-embeddings/index.ts`.

### 5.2 Vector Embedding Generation
**Status:** Production
**What it does:** Generates 1536-dimensional vector embeddings for each transcript chunk using OpenAI's `text-embedding-3-small` model. Batch processing handles 100 texts per API call for efficiency.
**Why it matters:** Vector embeddings enable semantic search -- finding content by meaning, not just keywords.
**Evidence:** `process-embeddings` + `embed-chunks` Edge Functions.

### 5.3 Chunk Metadata Enrichment
**Status:** Production
**What it does:** After embedding, each chunk is enriched using GPT-4o-mini structured outputs. Enrichment extracts: topics (1-5 per chunk), sentiment classification, intent signals (7 types: buying signal, objection, question, concern, feature request, testimonial, decision), and named entities (companies, people, products, technologies).
**Why it matters:** This metadata powers the 5 metadata-specific chat tools (intent, sentiment, topic, tag, entity search). Without enrichment, the AI can only do text search. With it, the AI can reason about what's happening in conversations.
**Evidence:** `enrich-chunk-metadata` Edge Function.

### 5.4 Embedding Job Queue
**Status:** Production
**What it does:** A resilient worker pipeline with 4 redundancy layers: (1) self-chaining -- each worker invokes the next batch on completion, (2) pg_cron polling every 1 minute to catch stalled chains, (3) GitHub Actions polling every 5 minutes as a safety net, (4) dead letter retry after 6 hours for permanently failed items. Uses atomic task claiming and exponential backoff.
**Why it matters:** Every transcript gets embedded, period. Even if one layer fails, three others catch it. No calls silently fall through the cracks.
**Evidence:** `embedding_queue` table, `process-embeddings`, `retry-failed-embeddings`.

### 5.5 Embedding Cost Tracking
**Status:** Production
**What it does:** Per-operation cost tracking for embedding generation, metadata enrichment, search queries, and chat sessions. Provides monthly summaries and per-recording cost breakdowns.
**Why it matters:** Users and admins can monitor AI costs and understand where budget is being spent.
**Evidence:** `embedding_usage_logs` table, `useEmbeddingCosts.ts`.
**Note:** Currently tracks 2 model prices (text-embedding-3-small, gpt-4o-mini). Other OpenRouter models are not yet covered. See roadmap.

### 5.6 AI Processing Progress UI
**Status:** Production
**What it does:** Visual progress indicators that show the status of embedding and AI processing operations. Users see what's being processed, what's queued, and what's complete.
**Why it matters:** Long-running AI operations (embedding hundreds of calls) need user-facing progress. Without it, users don't know if the system is working.
**Evidence:** `AIProcessingProgress.tsx`.

---

## 6. Intelligence & Analysis

Extraction of actionable intelligence from conversations.

### 6.1 Sentiment Analysis
**Status:** Production
**What it does:** Per-transcript sentiment scoring using Claude 3 Haiku via OpenRouter. Returns structured output: classification (positive/neutral/negative), confidence score, and reasoning. Multi-layer caching: database storage plus in-memory SHA-256 hash cache to avoid re-analyzing unchanged content.
**Why it matters:** Automated emotional tone assessment for every call. Powers automation rules ("if sentiment < 50, tag At Risk") and chat search filters.
**Evidence:** `automation-sentiment` Edge Function.

### 6.2 Content Insight Mining
**Status:** Production
**What it does:** AI extraction of pain points, objections, success stories, and other marketing-relevant intelligence from call transcripts. Part of the Content Hub's 4-agent wizard pipeline. Results are persisted in `insights` and `quotes` database tables.
**Why it matters:** Surfaces the marketing gold buried in conversations -- the exact language clients use to describe their problems, the stories that sell, the objections that block.
**Evidence:** `content-insight-miner` Edge Function, `insights` + `quotes` tables.

### 6.3 Insight Library
**Status:** Partial
**What it does:** Database tables (`insights` and `quotes`) store extracted intelligence from the content insight miner. Data is populated and used by the content wizard. However, there is no dedicated standalone UI for browsing, filtering, or managing insights outside of the content generation flow.
**Why it matters:** The intelligence exists but is only accessible during content creation. A standalone browser would let users review and curate extracted insights independently.
**Evidence:** `insights` + `quotes` tables, populated by `content-insight-miner`.

### 6.4 PROFITS Framework
**Status:** Planned (Reimplementation Required)
**What it does:** A 7-part sales psychology extraction framework: Pain, Results, Obstacles, Fears, Identity, Triggers, Success. Designed to systematically extract and categorize the key psychological elements from sales conversations.
**Why it matters:** No other tool maps transcript data to a structured sales psychology framework. This is a core competitive differentiator.
**Note:** Legacy code exists in `ai-agent.ts` but references a non-existent `calls` table. Requires reimplementation against the current `fathom_calls` schema using the `content-insight-miner` pattern. See roadmap.

### 6.5 Real-Time Coaching
**Status:** Planned
**What it does:** Post-call analysis that compares a new call against patterns from past successful calls, providing improvement suggestions.
**Note:** Legacy stub exists (`applyInsightsToCall` in `ai-agent.ts`) but is not connected to any UI or current data pipeline. Requires full reimplementation. See roadmap.

---

## 7. Content Hub

Transforming conversations into marketing and sales assets.

### 7.1 Content Hub Dashboard
**Status:** Production
**What it does:** Landing page showing content statistics (hooks, posts, emails counts), quick links to all generators and libraries, and setup guidance for users who haven't created a business profile yet.
**Why it matters:** Central command center for all content creation activities.
**Evidence:** `ContentHub.tsx`.

### 7.2 4-Agent Content Wizard
**Status:** Production
**What it does:** A four-step AI pipeline that turns call transcripts into marketing content: Step 1 -- Select calls and brand profile. Step 2 -- AI classifies content type and mines insights (pain points, stories, objections). Step 3 -- AI generates hooks with emotion categorization and virality scoring; user selects favorites. Step 4 -- AI builds full content pieces (social posts, emails) with real-time streaming. Full persistence at every step.
**Why it matters:** One-click path from raw call recordings to publishable social media posts and follow-up emails, grounded in the user's actual brand voice.
**Evidence:** `CallContentWizard.tsx`, `contentWizardStore.ts`, 3 Edge Functions (`content-insight-miner`, `content-hook-generator`, `content-builder`).

### 7.3 Hooks Library
**Status:** Production
**What it does:** Repository of AI-extracted hooks from calls. Each hook is categorized by emotion (7 categories), scored for virality (1-5 scale), and supports star/archive, copy, and "create content from this hook" actions. Filterable and searchable.
**Why it matters:** A growing library of proven, high-converting hooks extracted directly from real client conversations.
**Evidence:** `HooksLibrary.tsx`, `useHooksLibrary.ts`, `hooks` table.

### 7.4 Posts Library
**Status:** Production
**What it does:** Collection of AI-generated social media posts with search, filter by status (draft/used), inline editing, copy to clipboard, and status toggle.
**Why it matters:** Users manage their content pipeline without leaving CallVault.
**Evidence:** `PostsLibrary.tsx`, `content_items` table.

### 7.5 Emails Library
**Status:** Production
**What it does:** Collection of AI-generated follow-up emails with subject line + body, search, filter, inline editing, copy, and status toggle.
**Why it matters:** Follow-up emails based on actual call content, not generic templates.
**Evidence:** `EmailsLibrary.tsx`, `content_items` table.

### 7.6 Content Library (Generic)
**Status:** Production
**What it does:** Reusable content browser supporting multiple content types (email, social, testimonial, insight). Includes tags, search, and team sharing capabilities.
**Why it matters:** Central repository for all generated content, shareable across the team.
**Evidence:** `ContentLibraryPage.tsx`, `content_library` table.

### 7.7 Template System
**Status:** Production
**What it does:** Full template CRUD with `{{variable}}` interpolation. Includes XSS prevention (variable values are sanitized), variable validation (warns on undefined variables), usage tracking, and team sharing.
**Why it matters:** Users create reusable content templates that maintain consistency while personalizing with call-specific variables.
**Evidence:** `TemplatesPage.tsx`, `template-engine.ts`, `templates` table.

### 7.8 Business Profiles
**Status:** Production
**What it does:** 34-field brand voice engine that grounds all AI content generation. Fields cover: company info, ICP segments (up to 3), pain points, common objections, brand voice characteristics, and prohibited terms. Maximum 3 profiles per user for different brands or audiences.
**Why it matters:** AI-generated content sounds like the user's brand, not a generic chatbot. This is the difference between usable output and output that needs complete rewriting.
**Evidence:** `BusinessProfileTab.tsx`, `business_profiles` table, `business-profile.ts`.

### 7.9 Save Chat to Library
**Status:** Production
**What it does:** One-click save of any AI chat response directly to the content library. Appears as a button on assistant messages.
**Why it matters:** When the AI produces something valuable in conversation, users capture it instantly instead of copy-pasting.
**Evidence:** `SaveContentButton` in `message.tsx`.

---

## 8. Export System

Getting data out of CallVault in any format needed.

### 8.1 Smart Export Dialog
**Status:** Production
**What it does:** Unified export UI that brings together all export capabilities. Features: 5 organization modes (single bundle, individual files, by-week, by-folder, by-tag), format selection from all available formats, include toggles (summaries, transcripts, participants, timestamps/URLs), and stats preview (date range, unique participants, estimated token count). Optionally generates an AI meta-summary for the export bundle.
**Why it matters:** One dialog handles every export scenario. Users don't need to learn different export workflows for different needs.
**Evidence:** `SmartExportDialog.tsx`.

### 8.2 Base Output Formats (6)

| Format | Function | Details | Status |
|--------|----------|---------|--------|
| **PDF** | `exportToPDF` | Multi-page with title, metadata, summary, transcript. Uses jsPDF. | Production |
| **DOCX** | `exportToDOCX` | Proper Word formatting with heading levels. Uses docx.js. | Production |
| **TXT** | `exportToTXT` | Plain text with separator bars between sections. | Production |
| **JSON** | `exportToJSON` | Structured JSON with all metadata fields. | Production |
| **Markdown** | `exportToMarkdown` | YAML frontmatter (Obsidian-compatible), emoji metadata, formatted transcript. | Production |
| **CSV** | `exportToCSV` | Flat table: ID, title, date, day, time, duration, host, participants, lengths. | Production |

**Evidence:** `export-utils.ts` (841 lines).

### 8.3 Bundle Organization Modes (4)

| Mode | Function | Details | Status |
|------|----------|---------|--------|
| **ZIP** | `exportToZIP` | Individual files per call + `manifest.json` with metadata. | Production |
| **By-Week** | `exportByWeek` | Weekly subfolders + week summary files. | Production |
| **By-Folder** | `exportByFolder` | Organized by folder assignments + `_Unassigned` folder. | Production |
| **By-Tag** | `exportByTag` | Organized by tag assignments + `_Untagged` folder. | Production |

**Evidence:** `export-utils.ts`.

### 8.4 Advanced Specialized Formats (3)

| Format | Function | Details | Status |
|--------|----------|---------|--------|
| **LLM Context** | `exportAsLLMContext` | Fathom-style formatting, chronological ordering, stripped emails, configurable includes. Optimized for feeding into other AI tools. | Production |
| **Narrative** | `exportAsNarrative` | Human-readable with consolidated speaker turns. Easy reading format. | Production |
| **Analysis Package** | `exportAsAnalysisPackage` | JSON with metadata, metrics (token estimates, character lengths), date range. For technical analysis. | Production |

**Evidence:** `export-utils-advanced.ts` (335 lines).

### 8.5 AI Meta-Summary Export
**Status:** Production
**What it does:** AI-generated executive summary for export bundles. Includes key themes, decisions, action items, insights, participant highlights, and timeline.
**Why it matters:** When exporting 50 calls, users get a synthesized overview without reading every transcript.
**Evidence:** `generate-meta-summary` Edge Function, integrated into `SmartExportDialog.tsx`.

### 8.6 Single Transcript Export
**Status:** Production
**What it does:** Per-call export as TXT, Markdown, PDF, or DOCX with speaker grouping and smart timestamps. Also supports copy-to-clipboard.
**Why it matters:** Quick sharing of individual calls without going through the full export dialog.
**Evidence:** `useTranscriptExport.ts`.

---

## 9. Search & Discovery

Finding anything across the entire call library.

### 9.1 Hybrid Semantic Search
**Status:** Production
**What it does:** Combines pgvector semantic search with PostgreSQL tsvector keyword search. Results are merged via Reciprocal Rank Fusion (k=60).
**Evidence:** `hybrid_search_transcripts` DB function, `semantic-search` Edge Function.

### 9.2 Cross-Encoder Reranking
**Status:** Production
**What it does:** HuggingFace `cross-encoder/ms-marco-MiniLM-L-12-v2` precision scoring. Batch processing (10/batch). Graceful degradation.
**Evidence:** `rerank-results` Edge Function, inline in `chat-stream`.

### 9.3 Diversity Filtering
**Status:** Production
**What it does:** Limits results to max N per recording to ensure broad coverage across calls. Prevents one long, highly-relevant call from dominating all results.
**Evidence:** `_shared/diversity-filter.ts`, inline in `chat-stream`.

### 9.4 Speaker Search
**Status:** Production
**What it does:** Filter search results by speaker name or email address. Available as both a chat tool and a library filter.
**Evidence:** `searchBySpeaker` chat tool, library filter components.

### 9.5 Date Range Search
**Status:** Production
**What it does:** Temporal filtering with start and end date boundaries. Available as a chat tool and library filter.
**Evidence:** `searchByDateRange` chat tool, `FilterBar.tsx`.

### 9.6 Category Search
**Status:** Production
**What it does:** Filter results by call category or tag.
**Evidence:** `searchByCategory` chat tool.

### 9.7 Intent Signal Search
**Status:** Production
**What it does:** Find transcript segments classified as specific interaction types: buying signals, objections, questions, concerns, feature requests, testimonials, or decisions. Powered by chunk metadata enrichment.
**Evidence:** `searchByIntentSignal` chat tool.

### 9.8 Sentiment Search
**Status:** Production
**What it does:** Filter results by emotional tone: positive, negative, neutral, or mixed.
**Evidence:** `searchBySentiment` chat tool.

### 9.9 Topic Search
**Status:** Production
**What it does:** Search auto-extracted topic labels from chunk enrichment. Topics are generated per-chunk during the embedding pipeline.
**Evidence:** `searchByTopics` chat tool.

### 9.10 Entity Search
**Status:** Production
**What it does:** Find named entities: companies, people, products, and technologies mentioned across transcripts.
**Evidence:** `searchByEntity` chat tool.

### 9.11 Advanced Multi-Filter Search
**Status:** Production
**What it does:** Combined query supporting date + speaker + sentiment + intent + topics in a single search call. All filters are AND-combined.
**Evidence:** `advancedSearch` chat tool.

### 9.12 Call Comparison
**Status:** Production
**What it does:** Side-by-side analysis of 2-5 calls by recording ID. The AI compares content, sentiment, topics, and outcomes across the selected calls.
**Evidence:** `compareCalls` chat tool.

### 9.13 Metadata Discovery
**Status:** Production
**What it does:** Browse what speakers, categories, topics, tags, intents, and sentiments exist in the library. Powers the AI's awareness of available data so it can make informed search decisions.
**Evidence:** `getAvailableMetadata` chat tool.

### 9.14 Global Search UI
**Status:** Production
**What it does:** Cmd+K modal with 300ms debounce, diversity filtering, and source platform filtering. Quick access from anywhere in the app.
**Evidence:** `useGlobalSearch.ts`, `GlobalSearchModal.tsx`.

### 9.15 Summary Fallback Search
**Status:** Production
**What it does:** When RAG search returns no results, the system falls back to ILIKE search across call summaries to ensure something relevant is always returned.
**Evidence:** Fallback logic in search functions.

---

## 10. Collaboration & Teams

Organizational structures for coaching programs, remote sales teams, and agencies.

### 10.1 Collaboration Hub
**Status:** Production
**What it does:** Central 3-pane dashboard with two main sections: Team tab (gated to TEAM/ADMIN roles) and Coaches tab (available to all users). Serves as the entry point for all team and coaching features.
**Why it matters:** One place for all collaboration activity.
**Evidence:** `CollaborationPage.tsx`.

### 10.2 Delegated Call Sharing
**Status:** Production
**What it does:** Share specific calls with anyone via token-based links. Each share link tracks: recipient email, active/revoked status, and access audit log (user, timestamp, IP address). Links can be revoked at any time.
**Why it matters:** Users share individual calls without exposing their entire library. Full audit trail for compliance.
**Evidence:** `ShareCallDialog.tsx`, `call_share_links` + `call_share_access_log` tables.

### 10.3 Public Share Views
**Status:** Production
**What it does:** Read-only, tokenized call views for external recipients who don't have a CallVault account. Handles expired and revoked links gracefully with appropriate messaging.
**Why it matters:** External stakeholders (clients, partners) can view specific calls without needing an account.
**Evidence:** `SharedCallView.tsx`.

### 10.4 Shared With Me
**Status:** Production
**What it does:** Aggregated view showing all calls shared with the current user across 4 sources: direct share links, coaching shares, team shares, and direct report shares. Searchable and filterable.
**Why it matters:** One place to find everything others have shared with you, regardless of how it was shared.
**Evidence:** `SharedWithMe.tsx`.

### 10.5 Coaching Portal
**Status:** Production
**What it does:** Full coaching workflow system. Coach dashboard with coachee sidebar, call review, and private coach notes (full CRUD). Sharing rules configuration (all calls / specific folder / specific tag). Relationship lifecycle management: invite, accept, pause, resume, end.
**Why it matters:** Coaches can receive "pushed" calls from students/teams without full vault access. Students control what they share. The relationship has a full lifecycle.
**Evidence:** `CoachDashboard.tsx`, `useCoachRelationships.ts`, `coach_relationships` + `coach_shares` + `coach_notes` tables.

### 10.6 Team Hierarchy
**Status:** Production
**What it does:** Multi-level RBAC with three roles: Admin, Manager, Member. Self-referencing manager hierarchy with circular reference detection. Managers automatically get access to their direct reports' delegated calls. Role checked via `has_role()` DB function and enforced in both backend (RLS) and frontend (`useUserRole` + `useAccessControl`).
**Why it matters:** Organizations can model their actual reporting structure. Managers see what they need to see. Members control what they share.
**Evidence:** `team_memberships` table, `useTeamHierarchy.ts`, `is_manager_of()` DB function, `user_roles` table, `app_role` enum.

### 10.7 Org Chart View
**Status:** Production
**What it does:** Visual display of the team hierarchy showing reporting relationships.
**Evidence:** `OrgChartView.tsx`.

### 10.8 Manager Notes
**Status:** Production
**What it does:** Private notes that managers can leave on their direct reports' calls. Full CRUD. Notes are only visible to the manager, not to the call owner.
**Evidence:** Manager notes integration in collaboration views.

### 10.9 Coach Notes
**Status:** Production
**What it does:** Private notes that coaches can leave on coachee calls. Full CRUD. Notes are only visible to the coach, not to the coachee.
**Evidence:** `coach_notes` table, coaching dashboard integration.

### 10.10 Invite System
**Status:** Production (Backend) / Orphaned (UI)
**What it does:** Token-based invitation system for both team membership and coaching relationships. Backend generates invite tokens, validates them, and processes acceptance. Frontend acceptance pages exist (`TeamJoin.tsx`, `CoachJoin.tsx`) but have no routes in `App.tsx`.
**Why it matters:** The invite flow works end-to-end in the backend, but users clicking an invite link will hit a 404 because the routes aren't wired. This needs immediate attention.
**Evidence:** `TeamJoin.tsx`, `CoachJoin.tsx` (both orphaned -- no route), team and coach invitation Edge Functions.

### 10.11 Workspaces
**Status:** Partial (DB Only)
**What it does:** Database schema for collaborative call collections with `workspaces`, `workspace_members`, and `workspace_calls` tables. No frontend UI exists.
**Evidence:** Database tables only.

---

## 11. Automation Engine

Rule-based processing that runs automatically on call events.

### 11.1 Automation Rules Engine
**Status:** Production (Backend) / Orphaned (UI)
**What it does:** A comprehensive trigger/action system with 6 trigger types, 14 condition operators, and 12 action types. Rules are priority-ordered with circular dependency prevention (depth=3 limit). Full execution history logging. Triggers include: call_created, transcript_phrase, sentiment_threshold, duration_threshold, schedule, and webhook.
**Why it matters:** Users can automate any repeatable call processing workflow. "If sentiment drops below 50, tag At Risk and send email to manager" -- all automatic.
**Evidence:** `automation-engine` Edge Function (triggers.ts, condition-evaluator.ts, actions.ts).
**Note:** The backend is fully operational but the `AutomationRules.tsx` page (652 lines, full CRUD with trigger badges, stats, enable/disable, history view) has no route in `App.tsx`. Users cannot create or manage rules via UI.

### 11.2 Automation Scheduler
**Status:** Production
**What it does:** pg_cron-driven scheduler (every 1 minute) that evaluates scheduled automation rules. Supports interval, daily, weekly, monthly, and cron expression schedules. Self-invocation for batch processing.
**Why it matters:** Time-based automation ("generate weekly digest every Monday at 9am") without manual triggers.
**Evidence:** `automation-scheduler` Edge Function, pg_cron job.

### 11.3 Automation Webhook Endpoint
**Status:** Production
**What it does:** External trigger endpoint for automation rules. Supports HMAC-SHA256 verification (standard + Svix format), timestamp validation (5-minute replay window), rate limiting (100 requests/min/user), and idempotency.
**Why it matters:** External systems (Zapier, Make, custom integrations) can trigger CallVault automation rules.
**Evidence:** `automation-webhook` Edge Function.

### 11.4 Automation Email
**Status:** Production
**What it does:** Email delivery via Resend API as an automation action. Template variable replacement for dynamic content. Rate limiting (95/day/user). Unsubscribe headers. Idempotency to prevent duplicate sends.
**Why it matters:** Automation rules can send real emails -- notifications, digests, alerts.
**Evidence:** `automation-email` Edge Function.

### 11.5 Digest Generation
**Status:** Partial
**What it does:** The automation engine includes a `generate_digest` action that builds daily, weekly, or monthly call digests. Working backend logic. No dedicated UI for configuring digest preferences or viewing generated digests.
**Evidence:** `actions.ts` in automation-engine.

---

## 12. Settings & Admin

Configuration, AI model governance, and administrative controls.

### 12.1 Settings Hub
**Status:** Production
**What it does:** 7-category settings interface using the 3-pane layout: Account, Business Profile, Users (TEAM/ADMIN gated), Billing, Integrations, AI, and Admin (ADMIN only).
**Evidence:** `Settings.tsx`, all `*Tab.tsx` components.

### 12.2 AI Model Management
**Status:** Production
**What it does:** Admin interface for managing the AI model catalog. Sync models from OpenRouter, enable/disable individual models, set tier requirements (which plan level can access each model), and mark default models.
**Evidence:** `AdminModelManager.tsx`, `sync-openrouter-models` Edge Function.

### 12.3 User Management
**Status:** Production
**What it does:** Role and access management for organization members. Assign roles (Admin, Manager, Member), manage team membership.
**Evidence:** `UsersTab.tsx`, `user_roles` table.

### 12.4 Role-Based Access Control
**Status:** Production
**What it does:** 4-tier access system: FREE, PRO, TEAM, ADMIN. Enforced at the database level via `has_role()` function and at the UI level via `useUserRole` + `useAccessControl` hooks. Different tiers unlock different features, AI models, and collaboration capabilities.
**Evidence:** `user_roles` table, `app_role` enum.

### 12.5 Integrations Tab
**Status:** Production
**What it does:** Manage connected integrations (Fathom, Zoom, Google Meet). Connection status, sync controls, and setup wizards accessible from settings.
**Evidence:** `IntegrationsTab.tsx`.

### 12.6 Billing Settings
**Status:** Scaffolded
**What it does:** Category exists in Settings navigation. Actual billing/payment implementation details not confirmed in this audit.
**Evidence:** `BillingTab.tsx`.

---

## 13. Analytics

Cross-library metrics and insights.

### 13.1 Analytics Navigation
**Status:** Production
**What it does:** 6-category 3-pane structure matching the rest of the app. Navigation between analytics categories works correctly.
**Evidence:** `Analytics.tsx`.

### 13.2 Analytics Tab Components
**Status:** Scaffolded (6 components exist, none wired)
**What it does:** Six dedicated tab components exist at `src/components/analytics/`: OverviewTab, DurationTab, ParticipationTab, TalkTimeTab, TagsTab, ContentTab. All render "coming soon" placeholder content because they are NOT imported into `AnalyticsDetailPane.tsx`.
**Evidence:** `src/components/analytics/` directory, `AnalyticsDetailPane.tsx` line 229 comment.

### 13.3 Analytics Data Hook
**Status:** Production
**What it does:** `useCallAnalytics` hook provides KPI summaries and distribution data. The data fetching infrastructure is ready for UI connection.
**Evidence:** `useCallAnalytics.ts`.

---

## 14. Orphaned Features

Fully built pages with no routes in `App.tsx`. Users cannot reach them.

### 14.1 Automation Rules UI
**Status:** Orphaned
**Lines:** 652
**What it does:** Full CRUD page for automation rules with trigger type badges, execution stats, enable/disable toggle, and history view.
**Impact:** The entire automation engine is backend-only. Users have no way to create or manage rules through the UI.
**Evidence:** `AutomationRules.tsx`.

### 14.2 Team Management (Standalone)
**Status:** Orphaned
**Lines:** 909
**What it does:** Create team, invite members, org chart, settings, role management. Contains more features than `CollaborationPage.tsx`.
**Impact:** May be superseded by the Collaboration Hub, but contains unique functionality.
**Evidence:** `TeamManagement.tsx`.

### 14.3 Team Invite Acceptance
**Status:** Orphaned
**What it does:** Token-based team invite acceptance page. Email invite links direct users here but the route doesn't exist.
**Impact:** Team invite links may be broken -- users receive emails but clicking the link leads to a 404.
**Evidence:** `TeamJoin.tsx`.

### 14.4 Coach Invite Acceptance
**Status:** Orphaned
**What it does:** Token-based coach invite acceptance page. Same concern as Team Invite Acceptance.
**Impact:** Coach invite flows may be broken.
**Evidence:** `CoachJoin.tsx`.

---

## 15. Legacy / Dead Code

Code that should be removed or replaced.

### 15.1 Client-Side AI Agent
**Status:** Legacy -- Remove
**What it does:** `src/lib/ai-agent.ts` uses `VITE_OPENAI_API_KEY` which is exposed to the browser. Duplicates functionality now handled by Edge Functions. Functions: `extractKnowledgeFromTranscript`, `generateContent`, `applyInsightsToCall`, `batchProcessTranscripts`, `findSimilarInsights` (TODO), `generateCallsSummary`.
**Risk:** Client-side API key exposure.

### 15.2 Client-Side AI Processing Hook
**Status:** Legacy -- Remove
**What it does:** `src/hooks/useAIProcessing.ts` wraps the legacy `ai-agent.ts`. Same security concern.

### 15.3 Legacy Knowledge Extraction
**Status:** Legacy -- Remove
**What it does:** `supabase/functions/extract-knowledge/index.ts` uses `gpt-4-turbo` directly, old `serve()` import pattern, references non-existent `calls` table. Superseded by `content-insight-miner` and `automation-sentiment`. No authentication.

---

## Appendix A: Codebase Statistics

| Category | Count |
|----------|-------|
| TypeScript/TSX source files | ~350+ |
| Pages | 22 (18 routed, 4 orphaned) |
| Components | ~115 across 15 subdirectories |
| Custom hooks | 30 |
| Zustand stores | 8 |
| Utility modules | 23 |
| Context providers | 2 |
| Supabase Edge Functions | 62 |
| Database tables | 38 |
| Database migrations | 41 |
| Database functions | 30+ |
| Database triggers | 12+ |
| pg_cron jobs | 3 |
| E2E test suites | 20 |
| GitHub Actions workflows | 7 |

## Appendix B: External Service Dependencies

| Service | Purpose | Auth |
|---------|---------|------|
| OpenRouter | LLM inference (chat, content generation) | `OPENROUTER_API_KEY` |
| OpenAI | Embeddings + metadata enrichment | `OPENAI_API_KEY` |
| HuggingFace | Cross-encoder reranking | `HUGGINGFACE_API_KEY` |
| Resend | Transactional email delivery | `RESEND_API_KEY` |
| Sentry | Error tracking and monitoring | Sentry DSN |
| Fathom | Call recording source | OAuth + API key |
| Google (Calendar/Drive) | Meeting + recording source | OAuth |
| Zoom | Meeting + recording source | OAuth |
| Supabase | Database, auth, realtime, edge functions | Project credentials |
| Vercel | Hosting, edge deployment | Project credentials |
