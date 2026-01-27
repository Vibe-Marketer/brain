# Requirements: CallVault Launch Stabilization

**Defined:** 2026-01-27
**Core Value:** Users can reliably ask questions across their entire call history and get accurate, cited answers every single time.

## v1 Requirements

Requirements for launch stabilization. Organized by tier (Critical → Demo Polish → Differentiators).

### TIER 1: CRITICAL (Blocks Launch)

**Chat Reliability**
- [ ] **CHAT-01**: Chat works reliably with all 14 RAG tools firing consistently
- [ ] **CHAT-02**: Tool calls return results (no silent failures with green checkmarks on empty data)
- [ ] **CHAT-03**: Streaming doesn't error out mid-response
- [ ] **CHAT-04**: Citations work consistently
- [ ] **CHAT-05**: Migrate to Vercel AI SDK + OpenRouter (replace manual streaming implementation)

**Integration OAuth Flows**
- [ ] **INT-01**: Zoom OAuth connection flow works (currently button does nothing)
- [ ] **INT-02**: Google OAuth connection flow works (currently infinite spinner)
- [ ] **INT-03**: Integration connection errors surface to user (no silent failures)

**Collaboration Features**
- [ ] **TEAM-01**: Team creation works (currently fails silently)
- [ ] **TEAM-02**: Team join page accessible via route (`/join/team/:token`)
- [ ] **COACH-01**: Coach invite emails send successfully
- [ ] **COACH-02**: Coach invite links generate correctly
- [ ] **COACH-03**: Coach join page accessible via route (`/join/coach/:token`)

**Security**
- [ ] **SEC-01**: Remove client-side exposed API keys (`src/lib/ai-agent.ts` with `VITE_OPENAI_API_KEY`)
- [ ] **SEC-02**: Delete legacy unauthenticated edge functions (`extract-knowledge`, `generate-content`)
- [ ] **SEC-03**: Add admin auth check to `test-env-vars` and `test-secrets` edge functions
- [ ] **SEC-04**: Remove sensitive logging (console.log with PII in `AuthContext.tsx`, `Chat.tsx`, `useChatSession.ts`)
- [ ] **SEC-05**: Fix type safety bypasses in exports (`BulkActionToolbarEnhanced.tsx` forcing types to `any`)

**Store Reliability**
- [ ] **STORE-01**: Fix silent store failures (return meaningful errors instead of null in `contentLibraryStore.ts`, `contentItemsStore.ts`, `businessProfileStore.ts`)

### TIER 2: DEMO POLISH (Looks Unfinished)

**Wire Orphaned Pages**
- [ ] **WIRE-01**: Route Automation Rules page (`/automation-rules` → `AutomationRules.tsx`)
- [ ] **WIRE-02**: Wire analytics tabs (6 components exist, all show placeholders)

**Fix Broken Features**
- [ ] **FIX-01**: Fix Tags tab error (spec-027)
- [ ] **FIX-02**: Fix Rules tab error (spec-028)
- [ ] **FIX-03**: Fix Analytics tabs crashes (spec-035)
- [ ] **FIX-04**: Fix Users tab non-functional elements (spec-042)
- [ ] **FIX-05**: Fix Billing section if charging (spec-043)

**Code Cleanup**
- [ ] **CLEAN-01**: Consolidate duplicate deduplication code (`deduplication.ts` vs `dedup-fingerprint.ts`)
- [ ] **CLEAN-02**: Delete dead code (legacy `ai-agent.ts`, `Real-Time Coach` stub, orphaned `TeamManagement.tsx` if redundant with `CollaborationPage.tsx`)

**Tech Debt Refactoring**
- [ ] **REFACTOR-01**: Break down Chat.tsx (1900+ lines → smaller sub-components: MessageList, InputArea, ConnectionHandler + custom hooks)
- [ ] **REFACTOR-02**: Break down useTeamHierarchy.ts (1200+ lines → smaller focused hooks: useTeamPermissions, useTeamData)
- [ ] **REFACTOR-03**: Tighten types in stores (replace `any` types in `panelStore.ts` with proper interfaces)

### TIER 3: HIGH-VALUE DIFFERENTIATORS (Ship After Stable)

**Advanced Features**
- [ ] **DIFF-01**: PROFITS Framework v2 (sales psychology extraction from calls)
- [ ] **DIFF-02**: Folder-Level Chat (chat with a specific folder of calls)
- [ ] **DIFF-03**: Client Health Alerts (sentiment + automation + email alerts)
- [ ] **DIFF-04**: Manual Upload (legacy recordings upload for users without integrations)
- [ ] **DIFF-05**: Real Analytics Data (wire existing data hooks to analytics tabs)

### TIER 4: GROWTH (Post-Launch)

**Growth Features**
- [ ] **GROW-01**: Coach Partner/Affiliate Program (coaches-as-distribution channel)
- [ ] **GROW-02**: 3-tier Billing (Solo/Team/Business pricing)
- [ ] **GROW-03**: YouTube Import UI
- [ ] **GROW-04**: Slack Notification Action (automation engine)
- [ ] **GROW-05**: Complete Cost Tracking (track all OpenRouter models, not just 2)

## v2 Requirements

Deferred to post-launch. Tracked but not in current roadmap.

### UI Polish (12 specs)
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

### UX Enhancements (7 specs)
- **SPEC-012**: Connect button active state
- **SPEC-013**: Connection wizard extra steps
- **SPEC-014**: Missing requirements info display
- **SPEC-016**: Google Meet as Fathom alternative messaging
- **SPEC-017**: Google Meet extra confirmation step
- **SPEC-019**: Multiple Google accounts handling
- **SPEC-032**: Team status display improvements

### Feature Additions
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

## Out of Scope

Explicitly excluded from v1 stabilization.

| Feature | Reason |
|---------|--------|
| New Feature Development | v1 is stabilization only - finish/fix existing, no new features until 100% stable |
| UI Polish Specs (12) | Button positioning doesn't block demos or functionality |
| UX Enhancement Specs (7) | Nice-to-haves that improve flow but aren't critical for launch |
| Feature Addition Specs | New capabilities beyond stabilization scope |

## Traceability

Which phases cover which requirements.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 | Phase 1: Security Lockdown | Pending |
| SEC-02 | Phase 1: Security Lockdown | Pending |
| SEC-03 | Phase 1: Security Lockdown | Pending |
| CHAT-05 | Phase 2: Chat Foundation | Pending |
| CHAT-03 | Phase 2: Chat Foundation | Pending |
| CHAT-01 | Phase 2: Chat Foundation | Pending |
| CHAT-02 | Phase 2: Chat Foundation | Pending |
| CHAT-04 | Phase 2: Chat Foundation | Pending |
| INT-01 | Phase 3: Integration OAuth | Pending |
| INT-02 | Phase 3: Integration OAuth | Pending |
| INT-03 | Phase 3: Integration OAuth | Pending |
| TEAM-01 | Phase 4: Team Collaboration | Pending |
| TEAM-02 | Phase 4: Team Collaboration | Pending |
| COACH-01 | Phase 5: Coach Collaboration | Pending |
| COACH-02 | Phase 5: Coach Collaboration | Pending |
| COACH-03 | Phase 5: Coach Collaboration | Pending |
| WIRE-01 | Phase 6: Demo Polish | Pending |
| WIRE-02 | Phase 6: Demo Polish | Pending |
| FIX-01 | Phase 6: Demo Polish | Pending |
| FIX-02 | Phase 6: Demo Polish | Pending |
| FIX-03 | Phase 6: Demo Polish | Pending |
| FIX-04 | Phase 6: Demo Polish | Pending |
| FIX-05 | Phase 6: Demo Polish | Pending |
| CLEAN-01 | Phase 7: Code Health | Pending |
| CLEAN-02 | Phase 7: Code Health | Pending |
| DIFF-01 | Phase 8: Differentiators | Pending |
| DIFF-02 | Phase 8: Differentiators | Pending |
| DIFF-03 | Phase 8: Differentiators | Pending |
| DIFF-04 | Phase 8: Differentiators | Pending |
| DIFF-05 | Phase 8: Differentiators | Pending |
| GROW-01 | Phase 9: Growth Infrastructure | Pending |
| GROW-02 | Phase 9: Growth Infrastructure | Pending |
| GROW-03 | Phase 9: Growth Infrastructure | Pending |
| GROW-04 | Phase 9: Growth Infrastructure | Pending |
| GROW-05 | Phase 9: Growth Infrastructure | Pending |

**Coverage:**
- v1 requirements: 46 total (6 critical additions from CONCERNS.md audit)
- Mapped to phases: 40 (original roadmap)
- Unmapped: 6 ⚠️ **NEEDS ROADMAP UPDATE**
  - SEC-04, SEC-05, STORE-01, REFACTOR-01, REFACTOR-02, REFACTOR-03

---
*Requirements defined: 2026-01-27*
*Last updated: 2026-01-27 (added 6 critical requirements from CONCERNS.md - roadmap needs updating)*
