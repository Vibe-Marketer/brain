# Roadmap: CallVault Launch Stabilization

**Created:** 2026-01-27
**Depth:** Comprehensive (9 phases)
**Coverage:** 55/55 requirements mapped ✓
**Last Updated:** 2026-01-28 (Phase 2 complete with gap closures)

## Overview

Stabilize CallVault for public launch by fixing core chat reliability, enabling collaboration features, and wiring orphaned functionality. This roadmap prioritizes the core value (reliable conversation intelligence) before polishing demos and shipping differentiators.

## Phases

### Phase 1: Security Lockdown
**Goal:** All security vulnerabilities eliminated before touching core features

**Dependencies:** None (prerequisite for everything)

**Plans:** 6 plans in 3 waves

Plans:
- [x] 01-01-PLAN.md — Delete dangerous code & secure test endpoints (SEC-01, SEC-02, SEC-03)
- [x] 01-02-PLAN.md — Replace PII logging & fix type safety bypasses (SEC-04, SEC-05)
- [x] 01-03-PLAN.md — CORS migration: Group B functions (14 functions, SEC-06 part 1)
- [x] 01-04-PLAN.md — CORS migration: Group C batch 1 (24 functions, SEC-06 part 2)
- [x] 01-05-PLAN.md — CORS migration: Group C batch 2 (23 functions, SEC-06 part 3)
- [x] 01-06-PLAN.md — Security audit & human verification

**Requirements:**
- SEC-01: Remove client-side exposed API keys
- SEC-02: Delete legacy unauthenticated edge functions
- SEC-03: Add admin auth check to test functions
- SEC-04: Remove sensitive logging (PII exposure in console.log)
- SEC-05: Fix type safety bypasses in exports
- SEC-06: Migrate Edge Functions from wildcard CORS to dynamic origin checking

**Success Criteria:**
1. No API keys visible in browser DevTools or source code
2. All edge functions require authentication (no unauthenticated endpoints exposed)
3. Test/debug endpoints only accessible to admin users
4. No console.log statements exposing PII (session data, auth tokens, message content)
5. Export functions use properly typed interfaces (no `any` casting)
6. All production Edge Functions use `getCorsHeaders()` with dynamic origin checking (no wildcard `*`)
7. Security audit passes with zero critical findings

---

### Phase 2: Chat Foundation
**Goal:** Chat works reliably every single time with proper streaming and tool orchestration

**Dependencies:** Phase 1 (security must be locked down first)

**Plans:** 12 plans (9 original + 3 gap closures)

Plans:
- [x] 02-01-PLAN.md — Proof-of-concept: streamText + tool on Deno Edge Function
- [x] 02-02-PLAN.md — Fix silent store failures (STORE-01: toast.error on 16 methods)
- [x] 02-03-PLAN.md — Extract search pipeline to shared modules
- [x] 02-04-PLAN.md — Tool call three-state transparency UI (success/empty/error)
- [x] 02-05-PLAN.md — Define all 14 RAG tools with zod schemas + system prompt
- [x] 02-06-PLAN.md — Frontend /chat2 test path for parallel development
- [x] 02-07-PLAN.md — Inline citations with hover preview + bottom source list
- [x] 02-08-PLAN.md — Streaming error handling, retry UX, connection stability
- [x] 02-09-PLAN.md — Switchover: /chat → v2, legacy rename, final verification
- [x] 02-10-PLAN.md — **[GAP FIX]** Call detail panel instead of popup dialog
- [x] 02-11-PLAN.md — **[GAP FIX]** Fix model hallucinating recording IDs
- [x] 02-12-PLAN.md — **[GAP FIX]** Error toast notifications + throttled logging

**Requirements:**
- CHAT-05: Migrate to Vercel AI SDK + OpenRouter
- CHAT-03: Streaming doesn't error out mid-response
- CHAT-01: Chat works reliably with all 14 RAG tools firing consistently
- CHAT-02: Tool calls return results (no silent failures)
- CHAT-04: Citations work consistently
- STORE-01: Fix silent store failures (errors swallowed)

**Success Criteria:**
1. User can send chat message and receive complete streamed response without errors
2. All 14 RAG tools fire when relevant to query (verifiable in tool call logs)
3. Tool calls that find data return that data to the UI (no green checkmarks with empty results)
4. Citations appear inline in chat responses linking back to source transcripts
5. Chat connection stays stable for 10+ consecutive messages without reconnection
6. Store errors surface to user with actionable error messages (no silent null returns)

**UAT Gap Closures (02-10 through 02-12):**
- Gap 1: Call links open in popup instead of panel — fixed by 02-10
- Gap 2: No error toast on network failures — fixed by 02-12
- Gap 3: Console spam on network errors — fixed by 02-12
- Bug: Model uses fabricated recording_ids — fixed by 02-11

---

### Phase 3: Integration OAuth Flows
**Goal:** Users can successfully connect their Zoom and Google accounts to import calls

**Dependencies:** Phase 1 (secure auth flows), Phase 2 (chat must work to make imports valuable)

**Plans:** 2 plans in 2 waves

Plans:
- [x] 03-01-PLAN.md — Fix Zoom OAuth redirect URI mismatch (INT-01)
- [x] 03-02-PLAN.md — Verify both OAuth flows end-to-end (INT-01, INT-02, INT-03)

**Requirements:**
- INT-01: Zoom OAuth connection flow works
- INT-02: Google OAuth connection flow works
- INT-03: Integration connection errors surface to user

**Success Criteria:**
1. User clicks "Connect Zoom" and completes OAuth flow successfully
2. User clicks "Connect Google" and completes OAuth flow without infinite spinner
3. Connected integrations show "Connected" status with account details
4. Failed connection attempts show error message to user (no silent failures)

---

### Phase 3.1: Compact Integration UI (INSERTED)
**Goal:** Redesign integration cards to compact button/icon format with reusable connection modal

**Dependencies:** Phase 3 (OAuth flows must work first)

**Plans:** 3 plans in 3 waves

Plans:
- [ ] 03.1-01-PLAN.md — Core primitives (modal store + compact button component)
- [ ] 03.1-02-PLAN.md — Composite components (connect modal + button group)
- [ ] 03.1-03-PLAN.md — Wire up Sync page + visual verification

**Requirements:**
- UI-INT-01: Compact integration buttons replace large cards on Sync page
- UI-INT-02: Reusable IntegrationConnectModal component
- UI-INT-03: Same modal works in Sync, Settings > Integrations, and onboarding

**Success Criteria:**
1. Integrations on Sync page display as compact buttons/icons (not large cards)
2. Connected/disconnected state clearly visible at a glance
3. Clicking integration opens modal for connection flow
4. Same IntegrationConnectModal component used across Sync, Settings, and onboarding
5. Room for 6+ integrations in a single row at top of Sync page

**Details:**
- Replace current large integration cards with compact button/icon representation
- Clear visual indicator for connected vs not connected state
- Modal-based connection flow (not inline at top of page)
- Single reusable component importable anywhere integrations are shown
- Supports future expansion to many more integrations

---

### Phase 3.2: Integration Import Controls (INSERTED)
**Goal:** Add Sources filter control to Sync page for toggling which integrations' meetings are shown

**Dependencies:** Phase 3.1 (compact integration UI must be in place)

**Plans:** 2 plans in 2 waves

Plans:
- [ ] 03.2-01-PLAN.md — Database migration + useSyncSourceFilter hook
- [ ] 03.2-02-PLAN.md — SourcesFilterPopover component + SyncTab integration

**Requirements:**
- UI-INT-04: Redesigned "Import meetings from" section higher on Sync page
- UI-INT-05: Per-integration on/off toggle for search inclusion
- UI-INT-06: Clear visual state for which integrations are included in search

**Success Criteria:**
1. "Import meetings from" section prominently placed, better laid out
2. Each connected integration has airplane-mode style on/off switch
3. Toggle controls whether integration's calls appear in search results
4. Toggle state persists across sessions
5. Clear visual feedback when integration is excluded from search

**Details:**
- Leverage compact integration layout from Phase 3.1
- On/off toggle per integration controls search inclusion
- Users can connect an integration but exclude it from search
- Clean, intuitive layout that scales with more integrations

---

### Phase 4: Team Collaboration
**Goal:** Teams can be created, users can join teams, and team features work end-to-end

**Dependencies:** Phase 1 (secure team data), Phase 2 (teams need chat to be valuable)

**Requirements:**
- TEAM-01: Team creation works
- TEAM-02: Team join page accessible via route

**Success Criteria:**
1. User can create team and see it in their team list
2. Team creator receives shareable join link
3. Team join link opens accessible join page at `/join/team/:token`
4. New user can accept team invite and appear in team members list

---

### Phase 5: Coach Collaboration
**Goal:** Coaches can be invited, accept invites, and access coachee data

**Dependencies:** Phase 4 (coach system builds on team infrastructure)

**Requirements:**
- COACH-01: Coach invite emails send successfully
- COACH-02: Coach invite links generate correctly
- COACH-03: Coach join page accessible via route

**Success Criteria:**
1. User can invite coach via email address
2. Coach receives email with invite link
3. Coach invite link opens accessible join page at `/join/coach/:token`
4. Coach can accept invite and see coachee's calls in their view

---

### Phase 6: Demo Polish — Wiring, Fixes & UI Consistency
**Goal:** All built features are accessible, functional, and visually consistent (no broken pages, crashes, or inconsistent UI patterns)

**Dependencies:** Phase 1-5 (core features must work first)

**Requirements:**
- WIRE-01: Route Automation Rules page
- WIRE-02: Wire analytics tabs
- FIX-01: Fix Tags tab error (spec-027)
- FIX-02: Fix Rules tab error (spec-028)
- FIX-03: Fix Analytics tabs crashes (spec-035)
- FIX-04: Fix Users tab non-functional elements (spec-042)
- FIX-05: Fix Billing section if charging (spec-043)
- FIX-06: Move bulk action toolbar from bottom Mac-style bar to right-side 4th pane
- REFACTOR-04: Fix type mismatches in AutomationRules.tsx with Supabase schema
- IMPL-03: Fix CallDetailPage to query `fathom_calls` instead of legacy `calls` table
- DOC-01: Document export system for marketing/onboarding/help
- DOC-02: Document multi-source deduplication for user-facing help

**Success Criteria:**
1. Automation Rules page accessible at `/automation-rules` route
2. All 6 analytics tab components render without crashes
3. Tags tab loads without error in settings
4. Rules tab loads without error in settings
5. Users tab shows functional elements (no placeholder buttons)
6. Billing section functional if payments are active
7. Bulk action toolbar appears as right-side slide-in pane (not bottom Mac-style bar)
8. AutomationRules.tsx compiles cleanly with current Supabase types
9. CallDetailPage queries `fathom_calls` table (not legacy `calls`)
10. Export system documentation live in help/onboarding materials
11. Deduplication documentation live in user-facing help

---

### Phase 7: Code Health & Infrastructure
**Goal:** Technical debt cleaned up, monolithic components refactored, types tightened, infrastructure hardened

**Dependencies:** Phase 6 (ensure features work before refactoring)

**Requirements:**
- REFACTOR-01: Break down Chat.tsx (1900+ lines monolith)
- REFACTOR-02: Break down useTeamHierarchy.ts (1200+ lines god hook)
- REFACTOR-03: Tighten types in stores (remove any types)
- REFACTOR-05: Fix AI SDK outdated property (maxTokens in ai-agent.ts)
- REFACTOR-06: Tighten types in SyncTab.tsx (Meetings/Jobs loose types)
- REFACTOR-07: Consolidate inline diversity filter (chat-stream/index.ts duplication)
- CLEAN-01: Consolidate duplicate deduplication code
- CLEAN-02: Delete dead code (legacy ai-agent.ts, Real-Time Coach stub, orphaned TeamManagement.tsx)
- IMPL-01: Create or delete missing automation functions (summarize-call, extract-action-items)
- IMPL-02: Handle non-existent table references (tasks, clients, client_health_history)
- INFRA-01: Complete cost tracking for all OpenRouter models
- INFRA-02: Fix cron expression parsing (placeholder defaulting to 1-hour)
- INFRA-03: Move rate limiting to database (in-memory limits reset on cold starts)

**Success Criteria:**
1. Chat.tsx under 500 lines with extracted sub-components (MessageList, InputArea, ConnectionHandler)
2. Chat streaming logic extracted to custom hooks (testable in isolation)
3. useTeamHierarchy broken into focused hooks (useTeamPermissions, useTeamData)
4. All store interfaces properly typed (zero `any` types in store definitions)
5. SyncTab.tsx Meetings/Jobs types defined with proper interfaces
6. Single diversity filter implementation imported by chat-stream (no inline duplication)
7. Single deduplication implementation used across codebase
8. Legacy `ai-agent.ts` removed (replaced by Vercel AI SDK in Phase 2)
9. Real-Time Coach stub removed if unused
10. Orphaned `TeamManagement.tsx` removed if redundant
11. Automation functions either implemented or references removed (no silent failures)
12. Non-existent table references handled gracefully or tables created
13. Cost tracking covers all OpenRouter models used in production
14. Cron expression parsing produces correct intervals (not hardcoded 1-hour)
15. Rate limiting persists across cold starts (database-backed)
16. Codebase passes dead code analysis with zero warnings

---

### Phase 8: High-Value Differentiators
**Goal:** Unique features shipped that differentiate CallVault from generic transcription tools

**Dependencies:** Phase 7 (ship on clean, stable foundation)

**Requirements:**
- DIFF-01: PROFITS Framework v2
- DIFF-02: Folder-Level Chat
- DIFF-03: Client Health Alerts
- DIFF-04: Manual Upload
- DIFF-05: Real Analytics Data

**Success Criteria:**
1. User can run PROFITS analysis on sales call and see psychology extraction
2. User can open folder and chat with only that folder's calls
3. User receives email alert when client sentiment drops below threshold
4. User can manually upload audio/video file without integration
5. Analytics tabs show real data from existing hooks (not placeholders)

---

### Phase 9: Growth Infrastructure
**Goal:** Post-launch features enabled to support user acquisition and monetization

**Dependencies:** Phase 8 (ship core product first)

**Requirements:**
- GROW-01: Coach Partner/Affiliate Program
- GROW-02: 3-tier Billing
- GROW-03: YouTube Import UI
- GROW-04: Slack Notification Action
- GROW-05: Complete Cost Tracking

**Success Criteria:**
1. Coach can generate affiliate link and see referral commissions
2. Users can select Solo/Team/Business plan and upgrade/downgrade
3. User can paste YouTube URL and import video as call transcript
4. User can configure automation rule to post to Slack channel
5. Admin dashboard shows AI costs for all OpenRouter models used

---

## Progress Tracking

| Phase | Status | Requirements | Progress |
|-------|--------|--------------|----------|
| 1 - Security Lockdown | Complete ✅ | 6 | 100% |
| 2 - Chat Foundation | Complete ✅ | 6 | 100% (12/12 plans) |
| 3 - Integration OAuth | Complete ✅ | 3 | 100% (2/2 plans) |
| 3.1 - Compact Integration UI | Planned | 3 | 0% (0/3 plans) |
| 3.2 - Integration Import Controls | Pending | 3 | 0% |
| 4 - Team Collaboration | Pending | 2 | 0% |
| 5 - Coach Collaboration | Pending | 3 | 0% |
| 6 - Demo Polish | Pending | 12 | 0% |
| 7 - Code Health & Infrastructure | Pending | 13 | 0% |
| 8 - Differentiators | Pending | 5 | 0% |
| 9 - Growth Infrastructure | Pending | 5 | 0% |

**Overall Progress:** 15/61 requirements complete (25%)

---

## Phase Dependencies

```
Phase 1: Security Lockdown (blocks all)
    ↓
Phase 2: Chat Foundation
    ↓
Phase 3: Integration OAuth ──┐
    ↓                         │
Phase 4: Team Collaboration   │ (Phases 3-5 can partially overlap)
    ↓                         │
Phase 5: Coach Collaboration ─┘
    ↓
Phase 6: Demo Polish
    ↓
Phase 7: Code Health & Infrastructure
    ↓
Phase 8: Differentiators
    ↓
Phase 9: Growth Infrastructure
```

**Note:** Phases 3, 4, and 5 are sequentially dependent (coach builds on team) but Phase 3 (OAuth) can run in parallel with Phase 4 (Teams) since they touch different code.

---

## Requirement-to-Phase Mapping (Full Traceability)

| Requirement | Phase |
|-------------|-------|
| SEC-01 | 1 - Security Lockdown |
| SEC-02 | 1 - Security Lockdown |
| SEC-03 | 1 - Security Lockdown |
| SEC-04 | 1 - Security Lockdown |
| SEC-05 | 1 - Security Lockdown |
| SEC-06 | 1 - Security Lockdown |
| CHAT-01 | 2 - Chat Foundation |
| CHAT-02 | 2 - Chat Foundation |
| CHAT-03 | 2 - Chat Foundation |
| CHAT-04 | 2 - Chat Foundation |
| CHAT-05 | 2 - Chat Foundation |
| STORE-01 | 2 - Chat Foundation |
| INT-01 | 3 - Integration OAuth |
| INT-02 | 3 - Integration OAuth |
| INT-03 | 3 - Integration OAuth |
| TEAM-01 | 4 - Team Collaboration |
| TEAM-02 | 4 - Team Collaboration |
| COACH-01 | 5 - Coach Collaboration |
| COACH-02 | 5 - Coach Collaboration |
| COACH-03 | 5 - Coach Collaboration |
| WIRE-01 | 6 - Demo Polish |
| WIRE-02 | 6 - Demo Polish |
| FIX-01 | 6 - Demo Polish |
| FIX-02 | 6 - Demo Polish |
| FIX-03 | 6 - Demo Polish |
| FIX-04 | 6 - Demo Polish |
| FIX-05 | 6 - Demo Polish |
| FIX-06 | 6 - Demo Polish |
| REFACTOR-04 | 6 - Demo Polish |
| IMPL-03 | 6 - Demo Polish |
| DOC-01 | 6 - Demo Polish |
| DOC-02 | 6 - Demo Polish |
| REFACTOR-01 | 7 - Code Health |
| REFACTOR-02 | 7 - Code Health |
| REFACTOR-03 | 7 - Code Health |
| REFACTOR-05 | 7 - Code Health |
| REFACTOR-06 | 7 - Code Health |
| REFACTOR-07 | 7 - Code Health |
| CLEAN-01 | 7 - Code Health |
| CLEAN-02 | 7 - Code Health |
| IMPL-01 | 7 - Code Health |
| IMPL-02 | 7 - Code Health |
| INFRA-01 | 7 - Code Health |
| INFRA-02 | 7 - Code Health |
| INFRA-03 | 7 - Code Health |
| DIFF-01 | 8 - Differentiators |
| DIFF-02 | 8 - Differentiators |
| DIFF-03 | 8 - Differentiators |
| DIFF-04 | 8 - Differentiators |
| DIFF-05 | 8 - Differentiators |
| GROW-01 | 9 - Growth |
| GROW-02 | 9 - Growth |
| GROW-03 | 9 - Growth |
| GROW-04 | 9 - Growth |
| GROW-05 | 9 - Growth |
| UI-INT-01 | 3.1 - Compact Integration UI |
| UI-INT-02 | 3.1 - Compact Integration UI |
| UI-INT-03 | 3.1 - Compact Integration UI |
| UI-INT-04 | 3.2 - Integration Import Controls |
| UI-INT-05 | 3.2 - Integration Import Controls |
| UI-INT-06 | 3.2 - Integration Import Controls |

**Coverage:** 61/61 requirements mapped ✓

---

## Next Steps

1. ~~Phase 1: Security Lockdown~~ ✅ Complete
2. ~~Phase 2: Chat Foundation~~ ✅ Complete (12/12 plans, all gap closures verified)
3. ~~Phase 3: Integration OAuth~~ ✅ Complete (Zoom verified, Google marked Beta)
4. Run `/gsd-plan-phase 3.1` to plan Compact Integration UI
5. Run `/gsd-discuss-phase 4` to gather context for Team Collaboration
6. Run `/gsd-plan-phase 4` to create phase plans
7. Continue to Phase 4

---

*Last updated: 2026-01-29 (Phase 3.2 inserted - Integration Import Controls)*
