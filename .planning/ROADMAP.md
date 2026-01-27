# Roadmap: CallVault Launch Stabilization

**Created:** 2026-01-27
**Depth:** Comprehensive (9 phases)
**Coverage:** 41/41 requirements mapped ✓
**Last Updated:** 2026-01-27 (added 6 critical requirements from CONCERNS.md)

## Overview

Stabilize CallVault for public launch by fixing core chat reliability, enabling collaboration features, and wiring orphaned functionality. This roadmap prioritizes the core value (reliable conversation intelligence) before polishing demos and shipping differentiators.

## Phases

### Phase 1: Security Lockdown
**Goal:** All security vulnerabilities eliminated before touching core features

**Dependencies:** None (prerequisite for everything)

**Requirements:**
- SEC-01: Remove client-side exposed API keys
- SEC-02: Delete legacy unauthenticated edge functions
- SEC-03: Add admin auth check to test functions
- SEC-04: Remove sensitive logging (PII exposure in console.log)
- SEC-05: Fix type safety bypasses in exports

**Success Criteria:**
1. No API keys visible in browser DevTools or source code
2. All edge functions require authentication (no unauthenticated endpoints exposed)
3. Test/debug endpoints only accessible to admin users
4. No console.log statements exposing PII (session data, auth tokens, message content)
5. Export functions use properly typed interfaces (no `any` casting)
6. Security audit passes with zero critical findings

---

### Phase 2: Chat Foundation
**Goal:** Chat works reliably every single time with proper streaming and tool orchestration

**Dependencies:** Phase 1 (security must be locked down first)

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

---

### Phase 3: Integration OAuth Flows
**Goal:** Users can successfully connect their Zoom and Google accounts to import calls

**Dependencies:** Phase 1 (secure auth flows), Phase 2 (chat must work to make imports valuable)

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

### Phase 6: Demo Polish - Wiring & Fixes
**Goal:** All built features are accessible and functional (no broken pages or crashes)

**Dependencies:** Phase 1-5 (core features must work first)

**Requirements:**
- WIRE-01: Route Automation Rules page
- WIRE-02: Wire analytics tabs
- FIX-01: Fix Tags tab error (spec-027)
- FIX-02: Fix Rules tab error (spec-028)
- FIX-03: Fix Analytics tabs crashes (spec-035)
- FIX-04: Fix Users tab non-functional elements (spec-042)
- FIX-05: Fix Billing section if charging (spec-043)

**Success Criteria:**
1. Automation Rules page accessible at `/automation-rules` route
2. All 6 analytics tab components render without crashes
3. Tags tab loads without error in settings
4. Rules tab loads without error in settings
5. Users tab shows functional elements (no placeholder buttons)

---

### Phase 7: Code Health
**Goal:** Technical debt cleaned up, monolithic components refactored, types tightened

**Dependencies:** Phase 6 (ensure features work before refactoring)

**Requirements:**
- REFACTOR-01: Break down Chat.tsx (1900+ lines monolith)
- REFACTOR-02: Break down useTeamHierarchy.ts (1200+ lines god hook)
- REFACTOR-03: Tighten types in stores (remove any types)
- CLEAN-01: Consolidate duplicate deduplication code
- CLEAN-02: Delete dead code

**Success Criteria:**
1. Chat.tsx under 500 lines with extracted sub-components (MessageList, InputArea, ConnectionHandler)
2. Chat streaming logic extracted to custom hooks (testable in isolation)
3. useTeamHierarchy broken into focused hooks (useTeamPermissions, useTeamData)
4. All store interfaces properly typed (zero `any` types in store definitions)
5. Single deduplication implementation used across codebase
6. Legacy `ai-agent.ts` removed (replaced by Vercel AI SDK)
7. Real-Time Coach stub removed if unused
8. Orphaned `TeamManagement.tsx` removed if redundant
9. Codebase passes dead code analysis with zero warnings

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
| 1 - Security Lockdown | Pending | 5 | 0% |
| 2 - Chat Foundation | Pending | 6 | 0% |
| 3 - Integration OAuth | Pending | 3 | 0% |
| 4 - Team Collaboration | Pending | 2 | 0% |
| 5 - Coach Collaboration | Pending | 3 | 0% |
| 6 - Demo Polish | Pending | 7 | 0% |
| 7 - Code Health | Pending | 5 | 0% |
| 8 - Differentiators | Pending | 5 | 0% |
| 9 - Growth Infrastructure | Pending | 5 | 0% |

**Overall Progress:** 0/41 requirements complete (0%)

---

## Phase Dependencies

```
Phase 1: Security Lockdown (blocks all)
    ↓
Phase 2: Chat Foundation
    ↓
Phase 3: Integration OAuth
    ↓
Phase 4: Team Collaboration
    ↓
Phase 5: Coach Collaboration
    ↓
Phase 6: Demo Polish
    ↓
Phase 7: Code Health
    ↓
Phase 8: Differentiators
    ↓
Phase 9: Growth Infrastructure
```

---

## Next Steps

1. Review and approve this roadmap structure
2. Run `/gsd-plan-phase 1` to create detailed execution plan for Security Lockdown
3. Execute Phase 1 plans
4. Verify Phase 1 success criteria
5. Continue to Phase 2

---

*Last updated: 2026-01-27 (added 6 critical requirements from CONCERNS.md audit)*
