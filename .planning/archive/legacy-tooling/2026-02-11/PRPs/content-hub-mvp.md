# Content Hub MVP - Production Ready PRP

**Version**: 1.0
**Created**: 2026-01-11
**Confidence Score**: 9/10 (comprehensive research, clear patterns, well-documented spec)

---

## Goal

**Feature Goal**: Build a standalone Content Hub section that transforms call transcripts into ready-to-use marketing content through a 4-agent AI pipeline, with reusable libraries for Hooks, Posts, and Emails.

**Deliverable**:
- 4 new database tables with RLS policies
- 4 Supabase Edge Functions (streaming for Agent 4)
- 4 new Zustand stores
- 6 new page components
- 4-step wizard UI with real-time streaming
- Business Profile settings integration (34 fields, max 3 profiles)

**Success Definition**:
1. User can create/edit Business Profiles (auto-save on blur)
2. User can run Call Content Generator wizard end-to-end
3. Agent 4 streams content token-by-token in real-time
4. Generated content saved to Posts and Emails libraries
5. No console errors, existing tests pass

---

## User Persona

**Target User**: Content-focused coaches and consultants who record sales/coaching calls and want to turn them into social media content without manual extraction.

**Use Case**: After a sales call, user wants to quickly generate LinkedIn posts and email drafts based on real quotes, pains, and frameworks from the conversation.

**User Journey**:
1. Navigate to Content Hub from sidebar
2. Click "Call Content Generator"
3. Step 1: Select call transcript(s) + business profile
4. Step 2: Watch AI classify call and extract insights (auto)
5. Step 3: Review generated hooks, select favorites
6. Step 4: Watch content stream in real-time, edit inline
7. Access Posts/Emails libraries for future use

**Pain Points Addressed**:
- Manual transcript mining is time-consuming
- Generic AI content lacks real customer language
- Disconnected tools for different content types

---

## Why

- **Business Value**: Transforms raw call data into actionable marketing content, increasing user engagement and platform stickiness
- **Integration**: Leverages existing fathom_calls transcripts and extends content library patterns
- **Problems Solved**: Eliminates manual quote extraction, ensures content grounded in real customer language

---

## What

### Core Capabilities

1. **Business Profile System**: 34-field form capturing company context for AI personalization
2. **4-Agent Pipeline**:
   - Agent 1 (Classifier): Determines if call is worth mining
   - Agent 2 (Insight Miner): Extracts pains, dreams, objections, frameworks
   - Agent 3 (Hook Generator): Creates 3-10 hooks from top insights
   - Agent 4 (Content Builder): Streams posts + emails per hook
3. **Content Libraries**: Hooks, Posts, Emails with filtering, status tracking, inline editing

### Success Criteria

- [ ] Business Profile form with 34 fields, auto-save on blur
- [ ] Max 3 profiles per user (enforced via DB trigger)
- [ ] Wizard Step 1: Multi-select calls + profile picker
- [ ] Wizard Step 2: Progress indicators for Agents 1-2
- [ ] Wizard Step 3: Hook list with emotion/virality tags, multi-select
- [ ] Wizard Step 4: SSE streaming content display
- [ ] Libraries: Filter by emotion, status, date; copy/edit/delete actions
- [ ] Navigation: Content Hub in sidebar with proper routing

---

## All Needed Context

### Context Completeness Check

✅ All patterns documented from codebase analysis
✅ Agent prompts available in docs/specs/social-agents.md
✅ 34 Business Profile fields documented
✅ Streaming patterns verified from chat-stream edge function
✅ External research on SSE, OpenRouter, Zustand completed

### Documentation & References

```yaml
# MUST READ - Codebase Patterns
- file: src/components/ui/sidebar-nav.tsx
  why: NavItem interface, icon patterns (iconLine/iconFill), matchPaths for nested routes
  pattern: |
    interface NavItem {
      id: string;
      name: string;
      iconLine: RemixiconComponentType;
      iconFill: RemixiconComponentType;
      path: string;
      matchPaths?: string[];
    }
  gotcha: Always use both line and fill icon variants from @remixicon/react

- file: src/stores/contentLibraryStore.ts
  why: Zustand store pattern with CRUD, optimistic updates, rollback
  pattern: |
    export const useStore = create<State & Actions>((set, get) => ({
      ...initialState,
      action: async () => {
        const previous = get().items;
        set({ items: [...get().items, newItem] }); // Optimistic
        try { await api(); }
        catch { set({ items: previous }); } // Rollback
      }
    }));
  gotcha: Always export selector hooks at bottom of file

- file: supabase/functions/chat-stream/index.ts
  why: SSE streaming pattern for LLM responses
  pattern: |
    const send = (data: Record<string, unknown>) => {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    };
    // Terminate with: controller.enqueue(encoder.encode('data: [DONE]\n\n'));
  gotcha: Use OpenRouter API directly (NOT AI SDK due to zod bundling issues in Deno)

- file: supabase/migrations/20260111000001_create_business_profiles.sql
  why: Migration pattern with RLS, triggers, constraints
  pattern: See existing migration for 34 fields, max 3 profiles trigger
  gotcha: Always include GRANT ALL to authenticated and service_role policies

- file: src/components/settings/wizard/CredentialsStep.tsx
  why: Wizard step component pattern
  pattern: Props interface with controlled state, no internal state
  gotcha: Parent wizard owns all state, steps are pure functions

# MUST READ - Spec Documents
- file: docs/specs/social-agents.md
  why: All 4 agent prompts with exact JSON output formats
  critical: Agent 2 filters to score >= 4 only; Agent 4 must stream

- file: docs/reference/customer-data-fields-formatted.md
  why: All 34 Business Profile fields with types (Text, Numeric, Dropdown)
  critical: Match field names exactly in DB schema

# External Documentation
- url: https://openrouter.ai/docs/api/reference/streaming
  why: OpenRouter streaming API format and headers
  critical: |
    - Header: Authorization: Bearer $OPENROUTER_API_KEY
    - Header: HTTP-Referer: https://app.callvaultai.com
    - Header: X-Title: CallVault
    - Model format: provider/model-name (e.g., z-ai/glm-4.6)
    - Response: SSE with data: {...}\n\n format, ends with data: [DONE]\n\n

- url: https://zustand.docs.pmnd.rs/
  why: Zustand store patterns and testing
  critical: Use atomic selectors, useShallow for multi-value, export selector hooks

- url: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events
  why: SSE client-side parsing
  critical: Handle reconnection, parse data: prefix, buffer incomplete lines
```

### Desired Codebase Tree

```bash
# Database Migrations (supabase/migrations/)
20260111000001_create_business_profiles.sql  # EXISTS - 34 fields, max 3 trigger
20260111000002_create_insights_table.sql     # EXISTS - Agent 2 output
20260111000003_create_hooks_table.sql        # CREATE - Agent 3 output
20260111000004_create_content_items_table.sql # CREATE - Posts + Emails

# Edge Functions (supabase/functions/)
content-classifier/index.ts     # CREATE - Agent 1: classify call
content-insight-miner/index.ts  # CREATE - Agent 2: extract insights
content-hook-generator/index.ts # CREATE - Agent 3: generate hooks
content-builder/index.ts        # CREATE - Agent 4: stream content (SSE)

# TypeScript Types (src/types/)
content-hub.ts  # CREATE - BusinessProfile, Insight, Hook, ContentItem, WizardState

# Zustand Stores (src/stores/)
businessProfileStore.ts  # CREATE - CRUD for profiles, max 3 enforcement
hooksLibraryStore.ts     # CREATE - CRUD for hooks, filtering
contentItemsStore.ts     # CREATE - CRUD for posts/emails
contentWizardStore.ts    # CREATE - Multi-step wizard state

# Library Functions (src/lib/)
business-profile.ts  # CREATE - Supabase CRUD for profiles
hooks.ts             # CREATE - Supabase CRUD for hooks
content-items.ts     # CREATE - Supabase CRUD for posts/emails

# Pages (src/pages/)
ContentHub.tsx           # CREATE - Overview with stats and links
ContentGenerators.tsx    # CREATE - Generator cards
CallContentGenerator.tsx # CREATE - Wizard page wrapper
HooksLibrary.tsx         # CREATE - Hooks table with filters
PostsLibrary.tsx         # CREATE - Posts table with inline edit
EmailsLibrary.tsx        # CREATE - Emails table with inline edit

# Components (src/components/)
content-hub/
  CallContentWizard.tsx        # CREATE - Wizard container with navigation
  LibraryFilterBar.tsx         # CREATE - Shared filter component
  wizard/
    SelectSourcesStep.tsx      # CREATE - Call + profile selection
    ExtractAnalyzeStep.tsx     # CREATE - Agent 1-2 progress
    GenerateHooksStep.tsx      # CREATE - Hook list with selection
    CreateContentStep.tsx      # CREATE - Streaming content display

settings/
  BusinessProfileForm.tsx  # CREATE - 34-field form with auto-save
  BusinessProfileTab.tsx   # CREATE - Profile selector + form
```

### Known Gotchas

```typescript
// CRITICAL: Edge functions cannot use AI SDK due to zod bundling issues
// Use OpenRouter API directly with fetch()
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${Deno.env.get('OPENROUTER_API_KEY')}`,
    'HTTP-Referer': 'https://app.callvaultai.com',
    'X-Title': 'CallVault',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ model: 'z-ai/glm-4.6', messages, stream: true }),
});

// CRITICAL: SSE format must be exactly: data: {...}\n\n
// End stream with: data: [DONE]\n\n
controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));

// CRITICAL: Wizard state uses Zustand NOT React Query
// Enables resume capability and multi-step state persistence

// CRITICAL: Business Profile auto-saves on blur, NOT on submit
// Use debounced save with optimistic UI update

// CRITICAL: Agent 4 MUST stream - non-negotiable for UX
// Use ReadableStream with SSE format

// CRITICAL: fathom_calls has composite FK (recording_id, user_id)
// Reference: FOREIGN KEY (recording_id, user_id) REFERENCES fathom_calls
```

---

## Implementation Blueprint

### Data Models

```typescript
// src/types/content-hub.ts

// Business Profile (34 fields from customer-data-fields-formatted.md)
export interface BusinessProfile {
  id: string;
  user_id: string;
  is_default: boolean;

  // Company & Product
  company_name: string | null;
  website: string | null;
  primary_product_service: string | null;
  industry: string | null;
  product_service_delivery: 'software' | 'info_services' | 'physical_products' | null;

  // Business Model & Operations
  employees_count: number | null;
  primary_delivery_method: 'diy' | 'done_with_you' | 'done_for_you' | null;
  business_model: 'low_volume_high_ticket' | 'high_volume_low_ticket' | 'one_time' | null;
  primary_selling_mechanism: 'in_person_self_checkout' | 'in_person_salesperson' | 'online_self_checkout' | 'online_salesperson' | null;
  current_tech_status: string | null;

  // Marketing & Sales
  primary_advertising_mode: 'warm_outreach' | 'cold_outreach' | 'free_content' | 'paid_ads' | null;
  primary_lead_getter: 'themselves_or_employees' | 'referrals' | 'agencies' | 'affiliates' | null;
  primary_marketing_channel: string | null;
  marketing_channels: string | null;
  messaging_angles: string | null;
  sales_cycle_length: number | null;
  primary_social_platforms: string | null;

  // Customer Acquisition & Onboarding
  customer_acquisition_process: string | null;
  customer_onboarding_process: string | null;

  // Customer Insights
  icp_customer_segments: string | null;
  primary_pain_points: string | null;
  top_objections: string | null;
  top_decision_drivers: string | null;

  // Value Proposition
  value_prop_differentiators: string | null;
  proof_assets_social_proof: string | null;

  // Offers & Products
  average_order_value: number | null;
  customer_average_order_value: number | null;
  customer_lifetime_value: number | null;
  guarantees: string | null;
  promotions_offers_packages: string | null;
  other_products: string | null;

  // Brand & Voice
  brand_voice: string | null;
  prohibited_terms: string | null;
  common_sayings_trust_signals: string | null;

  // Growth
  biggest_growth_constraint: string | null;

  created_at: string;
  updated_at: string;
}

// Insight (Agent 2 output - internal, not directly exposed)
export interface Insight {
  id: string;
  user_id: string;
  recording_id: number;
  category: 'pain' | 'dream_outcome' | 'objection_or_fear' | 'story_or_analogy' | 'expert_framework';
  exact_quote: string;
  speaker: string | null;
  timestamp_str: string | null;
  why_it_matters: string | null;
  score: number; // 1-5
  emotion_category: 'anger_outrage' | 'awe_surprise' | 'social_currency' | 'relatable' | 'practical_value' | 'humor_sharp' | 'neutral';
  virality_score: number; // 1-5
  topic_hint: string | null;
  created_at: string;
}

// Hook (Agent 3 output - user-facing library)
export interface Hook {
  id: string;
  user_id: string;
  recording_id: number | null;
  hook_text: string;
  insight_ids: string[];
  emotion_category: string | null;
  virality_score: number | null;
  topic_hint: string | null;
  is_starred: boolean;
  status: 'generated' | 'selected' | 'archived';
  created_at: string;
  updated_at: string;
}

// ContentItem (Agent 4 output - posts and emails)
export interface ContentItem {
  id: string;
  user_id: string;
  hook_id: string | null;
  content_type: 'post' | 'email';
  content_text: string;
  email_subject: string | null; // Only for emails
  status: 'draft' | 'used';
  used_at: string | null;
  created_at: string;
  updated_at: string;
}

// Wizard State
export type WizardStep = 'select-sources' | 'extract-analyze' | 'generate-hooks' | 'create-content';
export type AgentStatus = 'idle' | 'running' | 'completed' | 'error';

export interface ContentWizardState {
  current_step: WizardStep;
  selected_calls: number[];
  selected_profile_id: string | null;

  // Agent statuses
  classification_status: AgentStatus;
  insights_status: AgentStatus;
  hooks_status: AgentStatus;
  content_status: AgentStatus;

  // Results
  classification_result: ClassificationResult | null;
  generated_insights: Insight[];
  generated_hooks: Hook[];
  selected_hook_ids: string[];
  generated_content: Map<string, StreamingContent>;

  error: string | null;
}

export interface ClassificationResult {
  call_type: 'sales' | 'onboarding' | 'coaching' | 'support' | 'other';
  stage: 'top' | 'middle' | 'bottom' | 'n/a';
  outcome: 'closed' | 'no' | 'maybe' | 'existing_client' | 'n/a';
  emotional_intensity: number;
  content_potential: number;
  mine_for_content: boolean;
  notes: string;
}

export interface StreamingContent {
  hook_id: string;
  social_post_text: string;
  email_subject: string;
  email_body_opening: string;
  is_streaming: boolean;
  is_saved: boolean;
}
```

### Implementation Tasks (Ordered by Dependencies)

```yaml
# PHASE 1: DATABASE SCHEMA (4 tasks)

Task 1.1: CREATE supabase/migrations/20260111000003_create_hooks_table.sql
  - IMPLEMENT: hooks table with hook_text, insight_ids[], emotion_category, virality_score, status
  - FOLLOW pattern: supabase/migrations/20260111000002_create_insights_table.sql
  - INCLUDE: RLS policies (SELECT/INSERT/UPDATE/DELETE for auth.uid() = user_id)
  - INCLUDE: Service role policy for edge functions
  - INCLUDE: Indexes on user_id, recording_id, emotion_category, virality_score, status, is_starred
  - INCLUDE: updated_at trigger

Task 1.2: CREATE supabase/migrations/20260111000004_create_content_items_table.sql
  - IMPLEMENT: content_items table with hook_id FK, content_type, content_text, email_subject, status
  - CONSTRAINT: email_subject must be null when content_type = 'post'
  - INCLUDE: RLS policies (SELECT/INSERT/UPDATE/DELETE for auth.uid() = user_id)
  - INCLUDE: Indexes on user_id, hook_id, content_type, status
  - INCLUDE: updated_at trigger

# PHASE 2: TYPESCRIPT TYPES (2 tasks)

Task 2.1: CREATE src/types/content-hub.ts
  - IMPLEMENT: BusinessProfile, Insight, Hook, ContentItem, WizardState interfaces
  - IMPLEMENT: Type aliases for enums (InsightCategory, EmotionCategory, etc.)
  - FOLLOW pattern: src/types/content-library.ts
  - EXPORT: All types and interfaces

Task 2.2: MODIFY src/types/index.ts
  - ADD: export * from './content-hub';

# PHASE 3: ZUSTAND STORES (4 tasks)

Task 3.1: CREATE src/lib/business-profile.ts
  - IMPLEMENT: CRUD functions (fetchProfiles, createProfile, updateProfile, deleteProfile)
  - IMPLEMENT: getDefaultProfile, setDefaultProfile, calculateCompletionPercentage
  - ENFORCE: Max 3 profiles per user (check before create)
  - FOLLOW pattern: src/lib/content-library.ts (Result<T> type, error handling)

Task 3.2: CREATE src/stores/businessProfileStore.ts
  - IMPLEMENT: Zustand store with profiles[], loading, error states
  - IMPLEMENT: CRUD actions with optimistic updates
  - IMPLEMENT: Selector hooks (useProfiles, useDefaultProfile, useProfilesLoading)
  - FOLLOW pattern: src/stores/contentLibraryStore.ts

Task 3.3: CREATE src/lib/hooks.ts + src/stores/hooksLibraryStore.ts
  - IMPLEMENT: CRUD functions and Zustand store for hooks
  - IMPLEMENT: Filtering by emotion_category, virality_score, topic_hint, is_starred
  - IMPLEMENT: batchCreateHooks for Agent 3 output
  - IMPLEMENT: toggleStar, updateStatus actions

Task 3.4: CREATE src/lib/content-items.ts + src/stores/contentItemsStore.ts
  - IMPLEMENT: CRUD functions and Zustand store for posts/emails
  - IMPLEMENT: Filtering by content_type, status
  - IMPLEMENT: markAsUsed action with used_at timestamp
  - IMPLEMENT: fetchPostsOnly, fetchEmailsOnly helpers

Task 3.5: CREATE src/stores/contentWizardStore.ts
  - IMPLEMENT: Multi-step wizard state (WizardState interface)
  - IMPLEMENT: Step navigation (nextStep, prevStep, goToStep)
  - IMPLEMENT: canProceedToStep validation per step requirements
  - IMPLEMENT: Agent status tracking (setClassificationStatus, etc.)
  - IMPLEMENT: Streaming content accumulation (appendStreamingContent)
  - IMPLEMENT: resetToStep for partial wizard reset
  - IMPLEMENT: Selector hooks (useCurrentStep, useCanProceed, useIsProcessing)
  - FOLLOW pattern: See wizard research - use step-specific validation

# PHASE 4: NAVIGATION & ROUTES (3 tasks)

Task 4.1: MODIFY src/components/ui/sidebar-nav.tsx
  - ADD: Content Hub nav item after AI Chat
  - USE: RiArticleLine/RiArticleFill icons
  - SET: path: '/content', matchPaths: ['/content', '/content/*']

Task 4.2: MODIFY src/App.tsx
  - ADD: Routes for /content, /content/generators, /content/generators/call-content
  - ADD: Routes for /content/library/hooks, /content/library/posts, /content/library/emails
  - WRAP: All routes in <ProtectedRoute><Layout>...</Layout></ProtectedRoute>

Task 4.3: MODIFY src/App.tsx
  - ADD: Route for /settings/business-profile
  - FOLLOW pattern: existing /settings/:category route

# PHASE 5: BUSINESS PROFILE UI (3 tasks)

Task 5.1: CREATE src/components/settings/BusinessProfileForm.tsx
  - IMPLEMENT: 34-field form organized by sections (Company, Business Model, Marketing, etc.)
  - IMPLEMENT: Auto-save on blur for all field types (text, number, select)
  - IMPLEMENT: Completion progress indicator using Progress component
  - IMPLEMENT: Visual feedback (checkmark) when field is saved
  - FOLLOW pattern: src/components/settings/AccountTab.tsx (layout, styling)

Task 5.2: CREATE src/components/settings/BusinessProfileTab.tsx
  - IMPLEMENT: Profile selector dropdown (shows default badge)
  - IMPLEMENT: Create new profile button (disabled at limit)
  - IMPLEMENT: Set as default toggle
  - IMPLEMENT: Delete profile with AlertDialog confirmation
  - IMPLEMENT: Profile count indicator ("X of 3 profiles used")
  - INTEGRATE: BusinessProfileForm for editing

Task 5.3: MODIFY src/pages/Settings.tsx (via SettingsCategoryPane.tsx and SettingsDetailPane.tsx)
  - ADD: 'business-profile' to SettingsCategory type
  - ADD: Category config with RiBriefcaseLine/RiBriefcaseFill icons
  - ADD: Lazy import and render of BusinessProfileTab

# PHASE 6: AGENT PIPELINE BACKEND (4 tasks)

Task 6.1: CREATE supabase/functions/content-classifier/index.ts
  - IMPLEMENT: Agent 1 - Call Classifier
  - INPUT: { recording_id, transcript, metadata }
  - OUTPUT: { call_type, stage, outcome, emotional_intensity, content_potential, mine_for_content }
  - USE: OpenRouter API directly with generateObject pattern
  - USE: Prompt from docs/specs/social-agents.md - Call Classifier
  - MODEL: z-ai/glm-4.6 (or gemini-2.0-flash)
  - NON-STREAMING

Task 6.2: CREATE supabase/functions/content-insight-miner/index.ts
  - IMPLEMENT: Agent 2 - Insight Miner
  - INPUT: { recording_id, user_id, transcript_chunks, metadata }
  - OUTPUT: { insights: Insight[] }
  - CHUNK: Process transcript in 8k char chunks
  - FILTER: Only keep score >= 4
  - STORE: Insert into insights table (delete existing for same recording first)
  - USE: Prompt from docs/specs/social-agents.md - Insight Miner
  - NON-STREAMING

Task 6.3: CREATE supabase/functions/content-hook-generator/index.ts
  - IMPLEMENT: Agent 3 - Hook Generator
  - INPUT: { recording_id, insight_ids?, business_profile }
  - OUTPUT: { hooks: Hook[] }
  - FETCH: Insights from DB where score >= 4
  - GENERATE: 3-10 hooks with emotion_category, virality_score, topic_hint
  - STORE: Insert into hooks table with status='generated'
  - USE: Prompt from docs/specs/social-agents.md - Hook Generator
  - NON-STREAMING

Task 6.4: CREATE supabase/functions/content-builder/index.ts
  - IMPLEMENT: Agent 4 - Content Builder (MUST STREAM)
  - INPUT: { hook_id, business_profile }
  - OUTPUT: SSE stream with { social_post_text, email: { subject, body_opening } }
  - FETCH: Hook and related insights from DB
  - STREAM: Token-by-token via SSE (data: {...}\n\n format)
  - STORE: Insert into content_items table on completion
  - UPDATE: Set hook status to 'selected'
  - SEND: content-saved event with final parsed content
  - USE: Prompt from docs/specs/social-agents.md - Content Generator
  - CRITICAL: Must follow chat-stream SSE pattern exactly

# PHASE 7: CONTENT HUB PAGES (2 tasks)

Task 7.1: CREATE src/pages/ContentHub.tsx
  - IMPLEMENT: Overview page with stats cards (hooks count, posts count, emails count)
  - IMPLEMENT: Quick links to Generators and Libraries
  - IMPLEMENT: Business Profile setup banner (if no profiles exist)
  - FOLLOW pattern: src/components/content-library/ContentLibraryPage.tsx

Task 7.2: CREATE src/pages/ContentGenerators.tsx
  - IMPLEMENT: Generator cards (Call Content Generator with description)
  - IMPLEMENT: Coming Soon placeholder for future generators
  - LINK: To /content/generators/call-content

# PHASE 8: WIZARD COMPONENTS (6 tasks)

Task 8.1: CREATE src/components/content-hub/CallContentWizard.tsx
  - IMPLEMENT: 4-step wizard container with step indicator
  - IMPLEMENT: Progress bar (vibe orange, animated)
  - IMPLEMENT: Step navigation (Back/Next/Cancel/Done buttons)
  - IMPLEMENT: Step completion status tracking
  - IMPLEMENT: Processing state awareness (disable nav during agent runs)
  - INTEGRATE: All step components

Task 8.2: CREATE src/components/content-hub/wizard/SelectSourcesStep.tsx
  - IMPLEMENT: Multi-select call list from fathom_calls with search
  - IMPLEMENT: Business profile dropdown with default selection
  - IMPLEMENT: Validation message when calls or profile not selected
  - FOLLOW pattern: src/components/settings/wizard/CredentialsStep.tsx

Task 8.3: CREATE src/components/content-hub/wizard/ExtractAnalyzeStep.tsx
  - IMPLEMENT: Auto-start analysis when step loaded
  - IMPLEMENT: Progress indicators for Agent 1 (Classifier) and Agent 2 (Miner)
  - IMPLEMENT: Status icons (idle, running, completed, error)
  - IMPLEMENT: Error handling with retry button
  - IMPLEMENT: Success summary showing insight count
  - ONLY: Run Agent 2 if Agent 1 returns mine_for_content=true

Task 8.4: CREATE src/components/content-hub/wizard/GenerateHooksStep.tsx
  - IMPLEMENT: Generate Hooks button calling content-hook-generator
  - IMPLEMENT: Hook list with multi-select checkboxes
  - IMPLEMENT: Emotion category badges (color-coded)
  - IMPLEMENT: Virality score indicators (1-5)
  - IMPLEMENT: Star/favorite toggle with DB persistence
  - IMPLEMENT: Copy hook text button
  - IMPLEMENT: Regenerate button for more hooks
  - VALIDATION: Require at least 1 hook selected to proceed

Task 8.5: CREATE src/components/content-hub/wizard/CreateContentStep.tsx
  - IMPLEMENT: Per-hook content generation loop
  - IMPLEMENT: SSE stream consumption from content-builder
  - IMPLEMENT: Real-time streaming display with cursor animation
  - IMPLEMENT: Inline editing for posts and emails
  - IMPLEMENT: Copy to clipboard functionality
  - IMPLEMENT: Mark as used button
  - IMPLEMENT: Progress indicator (hook X of Y)
  - FOLLOW pattern: src/pages/Chat.tsx for streaming consumption

Task 8.6: CREATE src/pages/CallContentGenerator.tsx
  - IMPLEMENT: Page wrapper with header and back navigation
  - IMPLEMENT: Wizard container rendering CallContentWizard
  - IMPLEMENT: onComplete → navigate to /content
  - IMPLEMENT: onCancel → navigate to /content/generators
  - RESET: Wizard state on mount

# PHASE 9: CONTENT LIBRARIES (4 tasks)

Task 9.1: CREATE src/pages/HooksLibrary.tsx
  - IMPLEMENT: Hooks table with columns: hook_text, emotion, virality, topic, starred, actions
  - IMPLEMENT: Filter bar (emotion, virality range, topic, starred only)
  - IMPLEMENT: Actions: Copy, Star, Create Content from Hook, Delete
  - IMPLEMENT: "Create Content from Hook" → navigate to wizard Step 4 with hook preloaded
  - FOLLOW pattern: src/components/content-library/ContentLibraryPage.tsx

Task 9.2: CREATE src/pages/PostsLibrary.tsx
  - IMPLEMENT: Posts table with columns: content preview, created_at, status, actions
  - IMPLEMENT: Filter bar (search, status)
  - IMPLEMENT: Inline editing with save/cancel
  - IMPLEMENT: Actions: Copy, Edit, Mark as Used, Delete
  - IMPLEMENT: Status badges (draft, used)

Task 9.3: CREATE src/pages/EmailsLibrary.tsx
  - IMPLEMENT: Emails table with columns: subject, body preview, created_at, status, actions
  - IMPLEMENT: Filter bar (search, status)
  - IMPLEMENT: Inline editing for subject and body
  - IMPLEMENT: Actions: Copy, Edit, Mark as Used, Delete

Task 9.4: CREATE src/components/content-hub/LibraryFilterBar.tsx
  - IMPLEMENT: Shared filter component for libraries
  - SUPPORT: Hooks filters (emotion, virality, topic, starred)
  - SUPPORT: Content items filters (type, status)
  - FOLLOW pattern: src/components/content-library/ContentFilterBar.tsx

# PHASE 10: INTEGRATION & WIRING (4 tasks)

Task 10.1: Wire wizard steps to edge functions
  - VERIFY: ExtractAnalyzeStep calls content-classifier then content-insight-miner
  - VERIFY: GenerateHooksStep calls content-hook-generator
  - VERIFY: CreateContentStep consumes SSE from content-builder
  - FIX: Any API contract mismatches

Task 10.2: Implement "Create Content from Hook" action
  - MODIFY: HooksLibrary.tsx to add action button
  - IMPLEMENT: Reset wizard, preload hook, navigate to Step 4
  - UPDATE: contentWizardStore to support direct hook loading

Task 10.3: Verify Business Profile integration
  - VERIFY: Profile context passed to Agents 3 and 4
  - VERIFY: Field mapping matches expected agent input format
  - MAP: icp_customer_segments → avatar, target_audience
  - MAP: primary_product_service → offer_name
  - MAP: value_prop_differentiators → offer_promise
  - MAP: average_order_value → price_point
  - MAP: brand_voice → brand_voice

Task 10.4: End-to-end verification
  - TEST: Full wizard flow from call selection to content generation
  - VERIFY: Streaming works without UI jank
  - VERIFY: All libraries show correct data
  - VERIFY: No console errors
```

---

## Validation Loop

### Level 1: Syntax & Style

```bash
# Run after each file creation
npm run lint -- --fix
npx tsc --noEmit

# Expected: Zero errors before proceeding
```

### Level 2: Unit Tests

```bash
# Store tests
npm run test -- src/stores/__tests__/businessProfileStore.test.ts
npm run test -- src/stores/__tests__/hooksLibraryStore.test.ts
npm run test -- src/stores/__tests__/contentItemsStore.test.ts
npm run test -- src/stores/__tests__/contentWizardStore.test.ts

# Expected: All tests pass
```

### Level 3: Integration Testing

```bash
# Start dev server
npm run dev

# Verify routes accessible
curl -s http://localhost:3000/content | head -20
curl -s http://localhost:3000/content/generators | head -20
curl -s http://localhost:3000/settings/business-profile | head -20

# Test edge functions locally
npx supabase functions serve --no-verify-jwt

# Test classifier
curl -X POST http://localhost:54321/functions/v1/content-classifier \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d '{"recording_id": 123, "transcript": "test", "metadata": {}}'

# Test streaming
curl -N http://localhost:54321/functions/v1/content-builder \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d '{"hook_id": "test-uuid"}'
```

### Level 4: Browser Verification

```yaml
Pages to verify:
  - url: http://localhost:3000/content
    checks: [renders, shows stats, navigation works]

  - url: http://localhost:3000/content/generators
    checks: [renders, shows generator card]

  - url: http://localhost:3000/content/generators/call-content
    checks: [wizard renders, steps navigable]

  - url: http://localhost:3000/content/library/hooks
    checks: [table renders, filters work]

  - url: http://localhost:3000/content/library/posts
    checks: [table renders, inline edit works]

  - url: http://localhost:3000/content/library/emails
    checks: [table renders, copy works]

  - url: http://localhost:3000/settings/business-profile
    checks: [form renders, auto-save works]
```

---

## Final Validation Checklist

### Technical Validation

- [ ] All TypeScript types compile: `npx tsc --noEmit`
- [ ] No linting errors: `npm run lint`
- [ ] Build succeeds: `npm run build`
- [ ] All tests pass: `npm run test`

### Database Validation

- [ ] All 4 migrations applied successfully
- [ ] RLS policies verified (test as authenticated user)
- [ ] Indexes exist for all filtered columns
- [ ] Max 3 profiles trigger works

### Feature Validation

- [ ] Business Profile: 34 fields render, auto-save works
- [ ] Wizard Step 1: Can select calls and profile
- [ ] Wizard Step 2: Agents 1-2 run with progress indicators
- [ ] Wizard Step 3: Hooks display with selection
- [ ] Wizard Step 4: Content streams token-by-token
- [ ] Libraries: All show data with working filters
- [ ] Navigation: Content Hub accessible from sidebar

### Edge Function Validation

- [ ] content-classifier returns valid classification JSON
- [ ] content-insight-miner extracts and stores insights
- [ ] content-hook-generator creates 3-10 hooks
- [ ] content-builder streams SSE with correct format

---

## Anti-Patterns to Avoid

- ❌ Don't use AI SDK in edge functions (zod bundling issues)
- ❌ Don't use React Query for wizard state (use Zustand)
- ❌ Don't make Agent 4 non-streaming (critical for UX)
- ❌ Don't skip RLS policies on new tables
- ❌ Don't hardcode business profile fields (use 34-field spec)
- ❌ Don't create new navigation patterns (follow sidebar-nav.tsx)
- ❌ Don't skip the [DONE] terminator in SSE streams
- ❌ Don't forget composite FK for fathom_calls (recording_id, user_id)

---

**PRP Confidence Score: 9/10**

High confidence due to:
- Comprehensive codebase pattern research completed
- All agent prompts documented in social-agents.md
- Existing streaming pattern verified in chat-stream
- 34 business profile fields fully specified
- External documentation researched (SSE, OpenRouter, Zustand)
- Existing migrations provide clear patterns
- Clear dependency ordering for implementation
