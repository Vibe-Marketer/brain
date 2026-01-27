# CallVault Launch Stabilization

## What This Is

CallVault is a conversation intelligence platform that ingests call recordings from multiple sources (Fathom, Zoom, Google Meet), enriches them with AI-powered metadata (topics, sentiment, intent signals), and turns them into actionable intelligence through RAG-powered chat, content generation, and automation. Currently in brownfield state with active users - needs stabilization for public launch without breaking existing workflows.

## Core Value

**Users can reliably ask questions across their entire call history and get accurate, cited answers every single time.**

If Chat breaks, nothing else matters. Everything else (content generation, exports, automation) builds on top of reliable conversation intelligence retrieval.

## Requirements

### Validated

*(Existing capabilities already shipped and used by current users)*

- ✓ Multi-source call ingestion (Fathom, Zoom, Google Meet) — existing
- ✓ Transcript storage and display — existing
- ✓ Content generation pipeline (4-agent wizard: Classifier → Insight Miner → Hook Generator → Content Builder) — existing
- ✓ Export system (13+ formats including Obsidian, LLM Context, Analysis Package) — existing
- ✓ Chunk metadata enrichment (topics, sentiment, intent signals, entities) — existing
- ✓ Transcript editing (non-destructive) — existing
- ✓ Multi-source deduplication (fuzzy matching across platforms) — existing
- ✓ Folder and tag organization — existing
- ✓ Public sharing with access logging — existing

### Active

*(Current scope - fixing broken, finishing half-done, wiring orphaned)*

**TIER 1: CRITICAL (Blocks Launch)**
- [ ] **CHAT-01**: Chat works reliably with all 14 RAG tools firing consistently
- [ ] **CHAT-02**: Tool calls return results (no silent failures with green checkmarks on empty data)
- [ ] **CHAT-03**: Streaming doesn't error out mid-response
- [ ] **CHAT-04**: Citations work consistently
- [ ] **CHAT-05**: Migrate to Vercel AI SDK + OpenRouter (replace manual streaming implementation)
- [ ] **INT-01**: Zoom OAuth connection flow works (currently button does nothing)
- [ ] **INT-02**: Google OAuth connection flow works (currently infinite spinner)
- [ ] **INT-03**: Integration connection errors surface to user (no silent failures)
- [ ] **TEAM-01**: Team creation works (currently fails silently)
- [ ] **TEAM-02**: Team join page accessible via route (`/join/team/:token`)
- [ ] **COACH-01**: Coach invite emails send successfully
- [ ] **COACH-02**: Coach invite links generate correctly
- [ ] **COACH-03**: Coach join page accessible via route (`/join/coach/:token`)
- [ ] **SEC-01**: Remove client-side exposed API keys (`src/lib/ai-agent.ts` with `VITE_OPENAI_API_KEY`)
- [ ] **SEC-02**: Delete legacy unauthenticated edge functions (`extract-knowledge`, `generate-content`)
- [ ] **SEC-03**: Add admin auth check to `test-env-vars` and `test-secrets` edge functions

**TIER 2: DEMO POLISH (Looks Unfinished)**
- [ ] **WIRE-01**: Route Automation Rules page (`/automation-rules` → `AutomationRules.tsx`)
- [ ] **WIRE-02**: Wire analytics tabs (6 components exist, all show placeholders)
- [ ] **FIX-01**: Fix Tags tab error (spec-027)
- [ ] **FIX-02**: Fix Rules tab error (spec-028)
- [ ] **FIX-03**: Fix Analytics tabs crashes (spec-035)
- [ ] **FIX-04**: Fix Users tab non-functional elements (spec-042)
- [ ] **FIX-05**: Fix Billing section if charging (spec-043)
- [ ] **CLEAN-01**: Consolidate duplicate deduplication code (`deduplication.ts` vs `dedup-fingerprint.ts`)
- [ ] **CLEAN-02**: Delete dead code (legacy `ai-agent.ts`, `Real-Time Coach` stub, orphaned `TeamManagement.tsx` if redundant with `CollaborationPage.tsx`)

**TIER 3: HIGH-VALUE DIFFERENTIATORS (Ship After Stable)**
- [ ] **DIFF-01**: PROFITS Framework v2 (sales psychology extraction from calls)
- [ ] **DIFF-02**: Folder-Level Chat (chat with a specific folder of calls)
- [ ] **DIFF-03**: Client Health Alerts (sentiment + automation + email alerts)
- [ ] **DIFF-04**: Manual Upload (legacy recordings upload for users without integrations)
- [ ] **DIFF-05**: Real Analytics Data (wire existing data hooks to analytics tabs)

**TIER 4: GROWTH (Post-Launch)**
- [ ] **GROW-01**: Coach Partner/Affiliate Program (coaches-as-distribution channel)
- [ ] **GROW-02**: 3-tier Billing (Solo/Team/Business pricing)
- [ ] **GROW-03**: YouTube Import UI
- [ ] **GROW-04**: Slack Notification Action (automation engine)
- [ ] **GROW-05**: Complete Cost Tracking (track all OpenRouter models, not just 2)

### Out of Scope

*(Deferred to v2+ - documented in specs but not blocking launch)*

- **UI Polish (12 specs)** — Button positioning, spacing, visual tweaks — Doesn't block demos or functionality
- **SPEC-001**: Import button position (top vs bottom of sidebar)
- **SPEC-002**: Selected indicator when sidebar collapsed
- **SPEC-003**: Analytics position in nav
- **SPEC-004**: Settings position in nav
- **SPEC-005**: Search box spacing
- **SPEC-006**: Search box hidden by default
- **SPEC-007**: Import extra line spacing
- **SPEC-008**: Integrations box design polish
- **SPEC-009**: Date range labeling clarity
- **SPEC-010**: Fetch meetings visibility
- **SPEC-011**: Integration icons consistency
- **SPEC-036**: Excessive divider lines
- **SPEC-037**: Edit pencil placement
- **SPEC-038**: Confirmation icons visibility
- **SPEC-041**: Users tab extra lines

- **UX Enhancements (7 specs)** — Nice-to-haves that improve flow but aren't critical
- **SPEC-012**: Connect button active state
- **SPEC-013**: Connection wizard extra steps
- **SPEC-014**: Missing requirements info display
- **SPEC-016**: Google Meet as Fathom alternative messaging
- **SPEC-017**: Google Meet extra confirmation step
- **SPEC-019**: Multiple Google accounts handling
- **SPEC-032**: Team status display improvements

- **Feature Additions** — New capabilities beyond stabilization scope
- **SPEC-021**: Integration component consistency refactor
- **SPEC-022**: Content loading state improvements
- **SPEC-023**: Content cards design system
- **SPEC-024**: Generator naming conventions
- **SPEC-025**: Business profile edit flow
- **SPEC-026**: Call cards size optimization
- **SPEC-029**: Missing debug tool
- **SPEC-030**: Sorting & Tagging page complete rework (EPIC)
- **SPEC-039**: Email edit functionality
- **SPEC-040**: New profile creation flow redesign
- **SPEC-046**: Knowledge base indexing count display
- **SPEC-047**: Loop-style import button

## Context

### Current State

**What's Working:**
- Content generation pipeline fully operational (4-agent wizard with real AI calls)
- Export system comprehensive (6 base formats, 4 bundle modes, 3 advanced formats)
- Multi-source ingestion with deduplication
- Chunk-level metadata enrichment (topics, sentiment, intent, entities)
- Transcript editing with history

**What's Broken:**
- Chat works ~50% of the time (tool calls fail silently or error out completely)
- Integration OAuth flows non-functional (Zoom button does nothing, Google infinite spinner)
- Team/coach collaboration features broken (creation fails, invites don't send/work)
- 4 fully-built pages orphaned (no routes)
- Analytics tabs all show placeholders despite components existing

**Technical Debt:**
- Chat backend bypasses Vercel AI SDK due to November zod/esm.sh bundling issues
- Manual SSE streaming implementation is fragile
- Duplicate deduplication code (2 implementations with different algorithms)
- Client-side API key exposure (`VITE_OPENAI_API_KEY` visible in DevTools)
- Legacy edge functions without auth
- Type mismatches in orphaned components

### Architecture

**Current Stack:**
- **Frontend**: React 18 + Vite, Zustand state, React Query, Vercel AI SDK types (`@ai-sdk/react`)
- **Backend**: Supabase (PostgreSQL + Edge Functions on Deno)
- **AI**: OpenRouter (300+ models for chat), OpenAI (embeddings only - OpenRouter doesn't support)
- **Chat Implementation**: Manual fetch to OpenRouter with SSE parsing (bypassing Vercel AI SDK)

**Target Architecture (Post-Fix):**
- Keep frontend Vercel AI SDK (`useChat` hook)
- Replace backend manual streaming with Vercel AI SDK `streamText`
- Configure Vercel AI SDK to use OpenRouter as provider (OpenAI-compatible)
- Keep OpenAI for embeddings
- Result: Reliable tool orchestration, proper streaming, less custom code

### User Base

Active users currently using CallVault for:
- Importing calls from Fathom (primary), some Zoom/Google
- Searching call history via Chat (when it works)
- Generating content from calls
- Exporting transcripts

**Critical constraint**: Cannot break existing user workflows during stabilization.

### Prior Cleanup Attempts

- **ralph-archived/**: Previous attempt at fixing 47 specs using different process
- Result: Generated PRDs but didn't execute systematically
- Specs are valid and well-documented, just need proper execution framework

## Constraints

- **Tech Stack**: Must use Supabase Edge Functions (Deno runtime) — Can't switch to Node.js/Vercel functions
- **AI Provider**: Must keep OpenRouter (300+ model access requirement) + OpenAI for embeddings
- **User Impact**: Cannot break existing validated features during fixes
- **Speed**: Need to move fast - launch pressure
- **Quality**: Fix properly, not patch fragile implementations
- **Backward Compatibility**: Current users' data, sessions, and workflows must continue working

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Vercel AI SDK + OpenRouter for Chat | Manual streaming is fragile, Vercel SDK handles tool orchestration reliably, OpenRouter is OpenAI-compatible | — Pending |
| Prioritize Chat → Teams → Integrations | Chat is core value, Teams/Coach needed for launch, Integrations block onboarding | — Pending |
| Defer UI polish to v2 | Button positioning doesn't block demos or functionality | — Pending |
| Keep all deferred specs documented | 47 specs represent real issues, need tracking even if not v1 | — Pending |
| Wire orphaned pages before building new | 652-909 lines of working code just needs routing | — Pending |

---
*Last updated: 2026-01-27 after initialization*
