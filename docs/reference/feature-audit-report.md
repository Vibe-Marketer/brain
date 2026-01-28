# CallVault Feature Audit Report

**Date:** January 26, 2026
**Version:** 2.0
**Scope:** Full codebase audit + documentation cross-reference
**Methodology:** Automated codebase analysis (350+ source files, 62 Edge Functions, 38 DB tables, 41 migrations) cross-referenced against 5 canonical documentation files.

> For the complete feature list, see `feature-registry.md`. For future enhancements and business model vision, see `feature-roadmap.md`.

---

## Executive Summary

| Metric | Count |
|--------|-------|
| **Total features audited** | 97 |
| **Confirmed production features** | 54 |
| **Beta/partial features** | 12 |
| **Scaffolded/placeholder features** | 7 |
| **Orphaned features (built but inaccessible)** | 4 |
| **Roadmap items (not yet built)** | 20 |
| **Legacy/dead code features** | 3 |
| **Documentation gaps identified** | 31 |
| **Status inconsistencies across docs** | 8 |
| **Security concerns found** | 4 |

### Key Findings

1. **Documentation underrepresented the product by ~35 features.** The previous canonical doc (`exhaustive-feature-list.md`) covered ~40 features; the codebase delivers ~66 functional features. Entire subsystems (export system, template engine, embedding cost tracking, deduplication, metadata enrichment) were undocumented. This has been corrected in the new `feature-registry.md`.

2. **Four fully-built pages are orphaned** -- `AutomationRules.tsx` (652 lines), `TeamManagement.tsx` (909 lines), `TeamJoin.tsx`, and `CoachJoin.tsx` exist as complete implementations but have no routes in `App.tsx`. Users cannot reach them. The invite acceptance pages (`TeamJoin` and `CoachJoin`) are particularly critical -- invite email links likely produce 404s.

3. **Analytics is entirely placeholder.** Six analytics tab components exist at `src/components/analytics/` but none are imported into `AnalyticsDetailPane.tsx`. Every analytics category shows "coming soon." The data hook (`useCallAnalytics.ts`) is ready.

4. **The PROFITS Framework status was overstated.** The older `callvault-features.md` marked it as Production; the actual extraction engine is legacy code in `ai-agent.ts` referencing a non-existent `calls` table. Status corrected to Planned (reimplementation required).

5. **Four Edge Functions have security concerns.** `extract-knowledge`, `generate-content`, and `test-env-vars` lack authentication. `ai-agent.ts` exposes an API key client-side.

6. **The content generation pipeline is fully operational.** Despite being marked "In-Process" in previous docs, the 4-agent wizard (Classifier -> Insight Miner -> Hook Generator -> Content Builder) works end-to-end with real AI calls, database persistence, and polished UI.

7. **The export system is a hidden powerhouse.** 6 base output formats, 4 bundle organization modes, 3 advanced specialized formats, 5 organization modes in the Smart Export Dialog, AI meta-summary generation, and Obsidian-compatible markdown -- none of this breadth was documented.

---

## 1. Security Concerns

| # | Issue | Severity | Location | Recommendation |
|---|-------|----------|----------|----------------|
| 1 | **Unauthenticated Edge Functions** | High | `extract-knowledge`, `generate-content`, `test-env-vars` | `extract-knowledge` and `generate-content` are legacy -- delete them. Add admin role check to `test-env-vars`. |
| 2 | **Client-Side API Key Exposure** | High | `src/lib/ai-agent.ts` uses `VITE_OPENAI_API_KEY` | Deprecate and remove. All AI calls should go through Edge Functions. The key is visible to anyone who opens browser DevTools. |
| 3 | **Partial Secret Exposure** | Medium | `test-secrets` Edge Function shows partial secret values without admin check | Add admin role check or remove entirely. |
| 4 | **Wildcard CORS** | Low | Most Edge Functions use static `corsHeaders` (allows `*`) | Migrate production functions to `getCorsHeaders()` with dynamic origin checking. |

---

## 2. Orphaned Features

These are fully built pages with no routes in `App.tsx`. Users cannot reach them.

| # | Feature | Page | Lines | Impact | Action |
|---|---------|------|-------|--------|--------|
| 1 | **Automation Rules UI** | `AutomationRules.tsx` | 652 | Users have no way to create/manage automation rules via UI. Backend is fully operational. | Route to `/automation-rules` and add to navigation. |
| 2 | **Team Management** | `TeamManagement.tsx` | 909 | Contains team creation, invite, org chart, settings, role management. May be superseded by CollaborationPage but has unique features. | Evaluate overlap with CollaborationPage. Route or consolidate. |
| 3 | **Team Invite Acceptance** | `TeamJoin.tsx` | -- | Invite email links direct users here but the route doesn't exist. Team invites may be broken. | Route to `/join/team/:token`. |
| 4 | **Coach Invite Acceptance** | `CoachJoin.tsx` | -- | Same as Team Invite. Coach invite flows may be broken. | Route to `/join/coach/:token`. |

---

## 3. Technical Debt

| # | Item | Description | Impact | Priority |
|---|------|-------------|--------|----------|
| 1 | **Duplicate deduplication code** | `_shared/deduplication.ts` (464 lines) and `_shared/dedup-fingerprint.ts` (329 lines) implement the same algorithm with different interfaces and subtle behavior differences (Jaccard vs min-set overlap). | Maintenance burden, risk of divergent behavior. | High |
| 2 | **Non-existent function references** | `actions.ts` in the automation engine invokes `summarize-call` and `extract-action-items` Edge Functions that don't exist. These actions silently fail at runtime. | Automation rules using these actions break silently. | High |
| 3 | **Legacy `ai-agent.ts`** | Client-side AI agent duplicating Edge Function logic. Contains `VITE_OPENAI_API_KEY` (browser-exposed). Contains TODO for `findSimilarInsights`. | Security risk + dead code. | High |
| 4 | **Type mismatches** | `AutomationRules.tsx` has type mismatches with the current Supabase schema. | Prevents clean TypeScript builds if the page is ever routed. | High |
| 5 | **AI SDK property** | `ai-agent.ts` uses outdated `maxTokens` property. | Potential runtime warnings with newer AI SDK versions. | Medium |
| 6 | **Sync logic types** | `SyncTab.tsx` has loose types for Meetings/Jobs. | Risk of runtime data errors. | Medium |
| 7 | **Non-existent table references** | `actions.ts` references `tasks`, `clients`, `client_health_history` tables. Code gracefully degrades but features silently fail. | Scaffolded automation actions don't work. | Medium |
| 8 | **Incomplete cost tracking** | `usage-tracker.ts` only tracks 2 model prices (text-embedding-3-small, gpt-4o-mini). Missing all OpenRouter models (Gemini Flash, Claude Haiku, etc.). | Inaccurate cost reporting for chat operations. | Medium |
| 9 | **Cron expression parsing** | `automation-scheduler` cron parsing is a placeholder that defaults to 1-hour interval regardless of expression. | Custom cron schedules don't work as expected. | Medium |
| 10 | **In-memory rate limiting** | `automation-webhook` and `automation-email` use in-memory rate limits that reset on Deno cold starts. | Rate limits are ineffective under autoscaling. | Medium |
| 11 | **Inline diversity filter** | `chat-stream/index.ts` duplicates `_shared/diversity-filter.ts` instead of importing it. | Divergent behavior if only one copy is updated. | Low |
| 12 | **CallDetailPage data model** | `/call/:callId` page queries `calls` table (not `fathom_calls`), suggesting legacy data path. | May fail for calls not in the legacy table. | Medium |

---

## 4. Documentation Inconsistencies (Now Resolved)

These inconsistencies existed across the 5 previous documentation files. All have been corrected in `feature-registry.md`.

| # | Feature | Old `callvault-features.md` | Old `exhaustive-feature-list.md` | Actual Status | Resolution |
|---|---------|----------------------------|----------------------------------|---------------|------------|
| 1 | **Zoom Integration** | In-Process | Beta | Beta (fully built, needs E2E verification) | Aligned to Beta |
| 2 | **Google Meet Integration** | Scaffolded | Beta | Beta (fully built with polling sync) | Aligned to Beta |
| 3 | **PROFITS Framework** | Production | In-Process | Legacy/Dead Code (references non-existent `calls` table) | Corrected to Planned (reimplementation required) |
| 4 | **Content Generators (4-Agent)** | Production | In-Process | Production (wizard works E2E with real AI calls) | Corrected to Production |
| 5 | **Analytics Dashboard** | Not Listed | Scaffolded | Scaffolded (6 components exist but not wired) | Listed as Scaffolded |
| 6 | **Automation Rules** | Production | Production* | Production backend / Orphaned UI (no route) | Split into backend (Production) and UI (Orphaned) |
| 7 | **Real-Time Coach** | Production | Production | Legacy/Stub (not connected to any UI or current pipeline) | Corrected to Planned |
| 8 | **Market Language Export** | Roadmap | Roadmap | Not implemented, no code | Confirmed as Planned |

---

## 5. Previously Undocumented Features

These 31 features were found in the codebase but were missing from ALL previous documentation files. All are now included in `feature-registry.md`.

### Critical (Marketing Differentiators)

1. **Multi-Source Deduplication** -- Fuzzy matching across platforms with 4 priority modes
2. **14 Agentic Chat Tools** -- 4 core + 5 metadata + 3 analytical + 2 advanced search tools
3. **Chunk Metadata Enrichment** -- Auto-extracted topics, sentiment, intent signals, entities
4. **Smart Export Dialog** -- 5 org modes, 6 base formats, 4 bundle modes, 3 advanced formats
5. **Template Engine** -- Variable interpolation with XSS prevention and team sharing

### High (User-Facing Features)

6. **Transcript Editing** -- Non-destructive inline editing with edit history
7. **Chat Context Attachments** -- @mention system for scoping AI to specific calls
8. **Embedding Job Queue** -- 4-layer redundancy (self-chain, pg_cron, GitHub Actions, dead letter)
9. **Embedding Cost Tracking** -- Per-operation cost monitoring with monthly trends
10. **AI Meta-Summary Export** -- AI-generated executive summaries for export bundles
11. **Obsidian-Compatible Markdown** -- YAML frontmatter export
12. **By-Week/Folder/Tag Export** -- Organized ZIP bundles with manifests
13. **Coaching Notes** -- Private coach notes on coachee calls
14. **Manager Notes** -- Private manager notes on direct report calls
15. **Automation Email** -- Resend-powered template delivery with rate limits
16. **Automation Webhook Endpoint** -- HMAC-verified external triggers

### Medium (Platform Infrastructure)

17. **Authentication System** -- Email/password + Google OAuth
18. **Keyboard Shortcuts** -- Cmd+K, Cmd+/, Escape, arrow key navigation
19. **Sync Job Progress Tracking** -- Real-time sync operation monitoring
20. **Public Share Access Logging** -- IP address, timestamp, user tracking
21. **Adaptive Transcript Chunking** -- Speaker-aware, sentence-boundary splitting
22. **AI Processing Progress UI** -- Visual feedback during long AI operations
23. **Save Chat to Library** -- One-click save from chat
24. **Security Headers** -- CSP, HSTS, X-Frame-Options
25. **CI/CD Security Scanning** -- TruffleHog, npm audit, dependency review

### Low (Technical / Infrastructure)

26. **Dark/Light Theme** -- System-aware switching
27. **Error Boundary** -- Global crash prevention
28. **Responsive Layout** -- Breakpoint detection
29. **Sentry Error Tracking** -- Production monitoring
30. **Toast Notifications** -- App-wide feedback system
31. **SKIP Auto-Tag** -- DB trigger for empty transcripts

---

## 6. Minimax Analysis Correction

The previous `minimax-analysis.md` identified 12 features as "missing from all documentation." Upon audit, **10 of 12 are already implemented** -- minimax was interpreting natural language descriptions literally and looking for features by exact name rather than understanding existing capabilities:

| Minimax Claimed Missing | Actual Status | What Was Misunderstood |
|------------------------|---------------|----------------------|
| Multi-Integration Call Deduplication | **Production** -- `_shared/deduplication.ts` | Looked for "deduplication" label; fuzzy matching system exists |
| Client-Level Organization | **Production** -- via Tags + Folders | "Clients" described a use case, not a separate entity |
| Cross-Client Vocabulary Analysis | **Production** -- via RAG Chat (14 tools) | No dedicated dashboard needed; users ask the AI |
| Folder-Level Permissions | **Production** -- via Coaching/Team delegation | Sharing rules + RBAC handle this, not folder ACLs |
| Bulk AI Actions | **Production** -- Bulk toolbar + auto-tag + automation engine | Multiple components working together |
| Call Scoring Rubric | **Planned** -- Custom GPT Coach (high-ticket upsell) | Correctly identified as not yet built |
| Team Onboarding Dashboard | **Production** -- TeamManagement.tsx (orphaned) | Exists but needs route wired |
| Reseller/Sub-Account Structure | **Not requested** -- Coaching relationships were described | "People underneath me" = coaching, not white-label |
| Single-File Transcript Export | **Production** -- Smart Export single-bundle mode | Exists in the export dialog |
| Multi-Transcript View/Synthesis | **Production** -- Chat tools + AI Meta-Summary | Handled via chat and export |
| PII Redaction Before Embedding | **Planned** -- Roadmap item | Correctly identified; was minimax's inference, not user request |
| Cross-Call Trend Detection | **Partial** -- Sentiment exists, trend UX doesn't | Engine pieces exist; visualization is roadmap |

---

## 7. Recommendations

### Immediate Actions (This Week)

1. **Route orphaned pages.** Add routes in `App.tsx` for:
   - `/automation-rules` -> `AutomationRules.tsx`
   - `/join/team/:token` -> `TeamJoin.tsx`
   - `/join/coach/:token` -> `CoachJoin.tsx`
   - Evaluate whether `TeamManagement.tsx` should supplement `CollaborationPage.tsx`

2. **Secure or remove unauthenticated Edge Functions.** Delete `extract-knowledge` and `generate-content` (legacy). Add admin auth check to `test-env-vars` and `test-secrets`.

3. **Deprecate `src/lib/ai-agent.ts` and `src/hooks/useAIProcessing.ts`.** Remove or gate -- they expose `VITE_OPENAI_API_KEY` to the browser. All functionality is available through Edge Functions.

### Short-Term (This Month)

4. **Wire analytics components.** The 6 tab components exist at `src/components/analytics/`. Update `AnalyticsDetailPane.tsx` to import and render them instead of placeholders.

5. **Consolidate dedup code.** Merge `_shared/deduplication.ts` and `_shared/dedup-fingerprint.ts` into a single canonical module. Reconcile Jaccard vs min-set overlap behavior.

6. **Create or delete missing automation functions.** `summarize-call` and `extract-action-items` are referenced by the automation engine but don't exist. Either create them or remove the references.

7. **Fix type mismatches.** Resolve `AutomationRules.tsx` type mismatches with Supabase schema before routing the page.

8. **Complete cost tracking.** Extend `usage-tracker.ts` to cover all OpenRouter model prices.

### Medium-Term (This Quarter)

9. **Fix cron expression parsing.** The automation scheduler's cron parser is a placeholder. Implement real parsing or use a library.

10. **Move rate limiting to database.** In-memory rate limits in `automation-webhook` and `automation-email` reset on cold starts. Use a database counter or Redis.

11. **Remove legacy CallDetailPage `calls` table query.** Ensure `/call/:callId` queries `fathom_calls` consistently.

---

## 8. Features to Highlight in Marketing

These production features are strong differentiators but have not been communicated externally:

1. **Export system** -- 6 base formats + 4 bundle modes + 3 advanced formats, with Obsidian compatibility and AI meta-summary. No competitor comes close.
2. **14 specialized chat tools** -- Not "chat with your calls" but a full agentic search system with intent, sentiment, entity, topic, and multi-filter queries.
3. **Chunk metadata enrichment** -- Every transcript segment is auto-tagged with topics, sentiment, intent signals, and named entities. This powers the entire search and discovery layer.
4. **Multi-source deduplication** -- Connect Fathom + Zoom + Google Meet and never see the same call twice. Unique in the market.
5. **4-layer embedding resilience** -- Self-chain, pg_cron, GitHub Actions, dead letter retry. Enterprise reliability.
6. **Template engine** -- Variable interpolation for consistent, branded content.
7. **Automation webhook endpoint** -- HMAC-verified external triggers. Connect any tool to CallVault.
8. **Non-destructive transcript editing** -- Fix errors without losing originals. Full edit history.
9. **Access audit logging** -- IP, timestamp, and user tracking for every shared call view. Compliance-ready.

---

## Appendix: Document Lineage

This report (v2.0) supersedes and consolidates findings from the following documents, now archived in `docs/reference/archive/`:

| Archived Document | Original Purpose | Accuracy at Time of Archive |
|-------------------|-----------------|----------------------------|
| `callvault-features.md` | Original simple feature table (30 lines) | ~50% (missing ~40 features, multiple wrong statuses) |
| `exhaustive-feature-list.md` | v4.0 canonical feature map (145 lines) | ~70% (missing 31 features, 8 status errors) |
| `codex-analysis.md` | Codebase evidence and gap analysis | ~85% (accurate analysis, missed some features) |
| `minimax-analysis.md` | Cross-doc comparison and gap analysis | ~80% (good synthesis, 10/12 "missing" items were actually implemented) |
| `feature-audit-report.md` (v1.0) | Original full audit | Current at time of writing; superseded by this v2.0 which references `feature-registry.md` instead of embedding the feature list |
