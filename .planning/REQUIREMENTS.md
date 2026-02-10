# Requirements: CallVault Launch Stabilization

**Defined:** 2026-01-27
**Core Value:** Users can reliably ask questions across their entire call history and get accurate, cited answers every single time.

## v1 Requirements

Requirements for launch stabilization. Organized by tier (Critical → Demo Polish → Differentiators).

### TIER 1: CRITICAL (Blocks Launch)

**Chat Reliability**
- [x] **CHAT-01**: Chat works reliably with all 14 RAG tools firing consistently
- [x] **CHAT-02**: Tool calls return results (no silent failures with green checkmarks on empty data)
- [x] **CHAT-03**: Streaming doesn't error out mid-response
- [x] **CHAT-04**: Citations work consistently
- [x] **CHAT-05**: Migrate to Vercel AI SDK + OpenRouter (replace manual streaming implementation)

**Integration OAuth Flows**
- [ ] **INT-01**: Zoom OAuth connection flow works (currently button does nothing)
- [ ] **INT-02**: Google OAuth connection flow works (currently infinite spinner)
- [ ] **INT-03**: Integration connection errors surface to user (no silent failures)

**Collaboration Features**
- [x] **TEAM-01**: Team creation works (currently fails silently)
- [x] **TEAM-02**: Team join page accessible via route (`/join/team/:token`)
- [ ] **COACH-01**: Coach invite emails send successfully
- [ ] **COACH-02**: Coach invite links generate correctly
- [ ] **COACH-03**: Coach join page accessible via route (`/join/coach/:token`)

**Security**
- [x] **SEC-01**: Remove client-side exposed API keys (`src/lib/ai-agent.ts` with `VITE_OPENAI_API_KEY`)
- [x] **SEC-02**: Delete legacy unauthenticated edge functions (`extract-knowledge`, `generate-content`)
- [x] **SEC-03**: Add admin auth check to `test-env-vars` and `test-secrets` edge functions
- [x] **SEC-04**: Remove sensitive logging (console.log with PII in `AuthContext.tsx`, `Chat.tsx`, `useChatSession.ts`)
- [x] **SEC-05**: Fix type safety bypasses in exports (`BulkActionToolbarEnhanced.tsx` forcing types to `any`)
- [x] **SEC-06**: Migrate Edge Functions from wildcard CORS (`*`) to `getCorsHeaders()` with dynamic origin checking

**Store Reliability**
- [x] **STORE-01**: Fix silent store failures (return meaningful errors instead of null in `contentLibraryStore.ts`, `contentItemsStore.ts`, `businessProfileStore.ts`)

### TIER 2: DEMO POLISH (Looks Unfinished)

**Wire Orphaned Pages**
- [x] **WIRE-01**: Route Automation Rules page (`/automation-rules` → `AutomationRules.tsx`)
- [x] **WIRE-02**: Wire analytics tabs (6 components exist, all show placeholders)

**Fix Broken Features**
- [x] **FIX-01**: Fix Tags tab error (spec-027)
- [x] **FIX-02**: Fix Rules tab error (spec-028)
- [x] **FIX-03**: Fix Analytics tabs crashes (spec-035)
- [x] **FIX-04**: Fix Users tab non-functional elements (spec-042)
- [x] **FIX-05**: Fix Billing section if charging (spec-043)
- [x] **FIX-06**: Move bulk action toolbar from bottom Mac-style bar to right-side 4th pane (consistency with app-wide slide-in pane pattern)

**Documentation**
- [x] **DOC-01**: Document export system (13+ formats, 4 bundle modes, 3 advanced formats) for marketing/onboarding/help
- [x] **DOC-02**: Document multi-source deduplication for user-facing help (fuzzy matching, priority modes)

**Code Cleanup**
- [x] **CLEAN-01**: Consolidate duplicate deduplication code (`deduplication.ts` vs `dedup-fingerprint.ts`)
- [x] **CLEAN-02**: Delete dead code (legacy `ai-agent.ts`, `Real-Time Coach` stub, orphaned `TeamManagement.tsx` if redundant with `CollaborationPage.tsx`)

**Tech Debt Refactoring**
- [x] **REFACTOR-01**: Break down Chat.tsx (1900+ lines → smaller sub-components: MessageList, InputArea, ConnectionHandler + custom hooks) — 689 lines, gap accepted
- [ ] **REFACTOR-02**: Break down useTeamHierarchy.ts (1200+ lines → smaller focused hooks: useTeamPermissions, useTeamData) — SKIPPED per CONTEXT.md
- [x] **REFACTOR-03**: Tighten types in stores (replace `any` types in `panelStore.ts` with proper interfaces)
- [x] **REFACTOR-04**: Fix type mismatches in AutomationRules.tsx with current Supabase schema
- [ ] **REFACTOR-05**: Fix AI SDK outdated property (replace `maxTokens` in ai-agent.ts with current API) — SKIPPED (ai-agent.ts removed)
- [x] **REFACTOR-06**: Tighten types in SyncTab.tsx (Meetings/Jobs loose types)
- [x] **REFACTOR-07**: Consolidate inline diversity filter (remove duplication in chat-stream/index.ts)

**Missing Implementations**
- [x] **IMPL-01**: Create or delete missing automation functions (`summarize-call`, `extract-action-items` referenced in actions.ts but don't exist)
- [x] **IMPL-02**: Handle non-existent table references gracefully (`tasks`, `clients`, `client_health_history` in automation actions)
- [x] **IMPL-03**: Fix CallDetailPage to query `fathom_calls` instead of legacy `calls` table

**Infrastructure Fixes**
- [x] **INFRA-01**: Complete cost tracking for all OpenRouter models (currently only tracks 2: text-embedding-3-small, gpt-4o-mini)
- [x] **INFRA-02**: Fix cron expression parsing (currently placeholder defaulting to 1-hour regardless of expression)
- [x] **INFRA-03**: Move rate limiting to database (in-memory limits in automation-webhook/email reset on cold starts)

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
| SEC-01 | Phase 1: Security Lockdown | Complete |
| SEC-02 | Phase 1: Security Lockdown | Complete |
| SEC-03 | Phase 1: Security Lockdown | Complete |
| SEC-04 | Phase 1: Security Lockdown | Complete |
| SEC-05 | Phase 1: Security Lockdown | Complete |
| SEC-06 | Phase 1: Security Lockdown | Complete |
| CHAT-01 | Phase 2: Chat Foundation | Complete |
| CHAT-02 | Phase 2: Chat Foundation | Complete |
| CHAT-03 | Phase 2: Chat Foundation | Complete |
| CHAT-04 | Phase 2: Chat Foundation | Complete |
| CHAT-05 | Phase 2: Chat Foundation | Complete |
| STORE-01 | Phase 2: Chat Foundation | Complete |
| INT-01 | Phase 3: Integration OAuth | Complete |
| INT-02 | Phase 3: Integration OAuth | Complete (Beta) |
| INT-03 | Phase 3: Integration OAuth | Complete |
| TEAM-01 | Phase 4: Team Collaboration | Complete |
| TEAM-02 | Phase 4: Team Collaboration | Complete |
| COACH-01 | ~~Coach Collaboration~~ | Removed (Coach removed from roadmap) |
| COACH-02 | ~~Coach Collaboration~~ | Removed (Coach removed from roadmap) |
| COACH-03 | ~~Coach Collaboration~~ | Removed (Coach removed from roadmap) |
| WIRE-01 | Phase 5: Demo Polish | Complete |
| WIRE-02 | Phase 5: Demo Polish | Complete |
| FIX-01 | Phase 5: Demo Polish | Complete |
| FIX-02 | Phase 5: Demo Polish | Complete |
| FIX-03 | Phase 5: Demo Polish | Complete |
| FIX-04 | Phase 5: Demo Polish | Complete |
| FIX-05 | Phase 5: Demo Polish | Complete |
| FIX-06 | Phase 5: Demo Polish | Complete |
| REFACTOR-04 | Phase 5: Demo Polish | Complete |
| IMPL-03 | Phase 5: Demo Polish | Complete |
| DOC-01 | Phase 5: Demo Polish | Complete |
| DOC-02 | Phase 5: Demo Polish | Complete |
| REFACTOR-01 | Phase 6: Code Health | Complete |
| REFACTOR-02 | Phase 6: Code Health | Skipped (per CONTEXT.md) |
| REFACTOR-03 | Phase 6: Code Health | Complete |
| REFACTOR-05 | Phase 6: Code Health | Skipped (ai-agent.ts removed) |
| REFACTOR-06 | Phase 6: Code Health | Complete |
| REFACTOR-07 | Phase 6: Code Health | Complete |
| CLEAN-01 | Phase 6: Code Health | Complete |
| CLEAN-02 | Phase 6: Code Health | Complete |
| IMPL-01 | Phase 6: Code Health | Complete |
| IMPL-02 | Phase 6: Code Health | Complete |
| INFRA-01 | Phase 6: Code Health | Complete |
| INFRA-02 | Phase 6: Code Health | Complete |
| INFRA-03 | Phase 6: Code Health | Complete |
| DIFF-01 | Phase 7: Differentiators | Complete |
| DIFF-02 | Phase 7: Differentiators | Complete |
| DIFF-03 | Phase 7: Differentiators | Complete |
| DIFF-04 | Phase 7: Differentiators | Complete |
| DIFF-05 | Phase 7: Differentiators | Complete |
| GROW-02 | Phase 8: Growth | Complete |
| GROW-03 | Phase 8: Growth | Complete |
| GROW-04 | Phase 8: Growth | Deferred (per CONTEXT.md) |
| GROW-05 | Phase 8: Growth | Complete |
| UI-INT-01 | Phase 3.1: Compact Integration UI | Complete |
| UI-INT-02 | Phase 3.1: Compact Integration UI | Complete |
| UI-INT-03 | Phase 3.1: Compact Integration UI | Complete |
| UI-INT-04 | Phase 3.2: Integration Import Controls | Complete |
| UI-INT-05 | Phase 3.2: Integration Import Controls | Complete |
| UI-INT-06 | Phase 3.2: Integration Import Controls | Complete |
| BANK-01 | Phase 9: Bank/Vault Architecture | Complete |
| BANK-02 | Phase 9: Bank/Vault Architecture | Complete |
| BANK-03 | Phase 9: Bank/Vault Architecture | Complete |
| BANK-04 | Phase 9: Bank/Vault Architecture | Complete |
| BANK-05 | Phase 9: Bank/Vault Architecture | Complete |
| GAP-INT-01 | Phase 10: Chat Bank/Vault Scoping | Complete |
| VAULT-UI-01 | Phase 10.2: Vaults Page | Complete |
| VAULT-UI-02 | Phase 10.2: Vaults Page | Complete |
| VAULT-UI-03 | Phase 10.2: Vaults Page | Complete |
| VAULT-UI-04 | Phase 10.2: Vaults Page | Complete |
| VAULT-UI-05 | Phase 10.2: Vaults Page | Complete |
| VAULT-UI-06 | Phase 10.2: Vaults Page | Complete |
| VAULT-UI-07 | Phase 10.2: Vaults Page | Complete |

**Coverage:**
- v1 requirements: 55 original + 19 added (phases 3.1, 3.2, 9, 10, 10.2) = 74 total
- Mapped to phases: 74/74 ✓
- Unmapped: 0
- Complete: 64 | Skipped/Removed: 5 | Deferred: 1 | Pending: 4

---
*Requirements defined: 2026-01-27*
*Last updated: 2026-02-10 (Phase 10.2 complete — all requirements through Phase 10.2 updated)*
