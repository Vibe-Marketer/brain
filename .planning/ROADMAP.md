# Roadmap: CallVault Launch Stabilization

**Created:** 2026-01-27
**Depth:** Comprehensive (9 phases)
**Coverage:** 58/58 requirements mapped ✓
**Last Updated:** 2026-01-31 (Roadmap restructure: removed Coach, deferred Team Content Segregation)

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
- [x] 03.2-01-PLAN.md — Database migration + useSyncSourceFilter hook
- [x] 03.2-02-PLAN.md — SourcesFilterPopover component + SyncTab integration

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

### Phase 4: Team Collaboration ✓ COMPLETE
**Goal:** Teams can be created, users can join teams, team switcher shows current context, and team features work end-to-end

**Dependencies:** Phase 1 (secure team data), Phase 2 (teams need chat to be valuable)

**Plans:** 6 plans in 4 waves

Plans:
- [x] 04-01-PLAN.md — Route registration + URL/expiry fixes (TEAM-02)
- [x] 04-02-PLAN.md — Multi-team support + UX simplification (TEAM-01)
- [x] 04-03-PLAN.md — Team context store + DB migration
- [x] 04-04-PLAN.md — Team switcher in header
- [x] 04-05-PLAN.md — Pending setup tracking for members
- [x] 04-06-PLAN.md — Automated E2E verification of full flow

**Requirements:**
- TEAM-01: Team creation works
- TEAM-02: Team join page accessible via route

**CONTEXT.md Decisions (locked):**
- Collect only team name (minimal friction)
- Users can belong to multiple teams
- Invite links expire after 7 days
- Teams appear in top-right dropdown (team switcher)
- Personal workspace exists alongside team workspaces
- Clear team badge in header shows current context
- Admins can see "pending setup" status badge

**Success Criteria:**
1. User can create team and see it in their team list
2. Team creator receives shareable join link
3. Team join link opens accessible join page at `/join/team/:token`
4. New user can accept team invite and appear in team members list
5. Team switcher visible in header with current context
6. Can switch between Personal workspace and teams

---

### Phase 5: Demo Polish — Wiring, Fixes & UI Consistency
**Goal:** All built features are accessible, functional, and visually consistent (no broken pages, crashes, or inconsistent UI patterns)

**Dependencies:** Phase 1-4 (core features must work first)

**Plans:** 7 plans in 3 waves

Plans:
- [x] 05-01-PLAN.md — Route Automation Rules + fix CallDetailPage query (WIRE-01, IMPL-03)
- [x] 05-02-PLAN.md — Fix AutomationRules.tsx type mismatches (REFACTOR-04)
- [x] 05-03-PLAN.md — Runtime test & fix Tags/Rules/Analytics tabs (FIX-01, FIX-02, FIX-03)
- [x] 05-04-PLAN.md — Fix Users & Billing tabs (FIX-04, FIX-05)
- [x] 05-05-PLAN.md — Refactor bulk action toolbar to 4th pane (FIX-06)
- [x] 05-06-PLAN.md — Documentation for export & deduplication (DOC-01, DOC-02)
- [x] 05-07-PLAN.md — Automated verification via Playwright (all 12 requirements verified)

**Requirements:**
- WIRE-01: Route Automation Rules page
- WIRE-02: Wire analytics tabs (research shows already working - verify only)
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

### Phase 6: Code Health & Infrastructure
**Goal:** Technical debt cleaned up, monolithic components refactored, types tightened, infrastructure hardened

**Dependencies:** Phase 5 (ensure features work before refactoring)

**Plans:** 10 plans in 3 waves

Plans:
- [ ] 06-01-PLAN.md — Refactor Chat.tsx into sub-components and hooks (REFACTOR-01)
- [ ] 06-02-PLAN.md — Write tests for extracted Chat components (TDD)
- [ ] 06-03-PLAN.md — Tighten types in panelStore and SyncTab (REFACTOR-03, REFACTOR-06)
- [ ] 06-04-PLAN.md — Consolidate deduplication and diversity filter (CLEAN-01, REFACTOR-07)
- [ ] 06-05-PLAN.md — Delete dead code: Coach functions, TeamManagement (CLEAN-02)
- [ ] 06-06-PLAN.md — Implement summarize-call and extract-action-items (IMPL-01)
- [ ] 06-07-PLAN.md — Handle missing table references gracefully (IMPL-02)
- [ ] 06-08-PLAN.md — Complete cost tracking with dashboard (INFRA-01)
- [ ] 06-09-PLAN.md — Fix cron parsing with validation UI (INFRA-02)
- [ ] 06-10-PLAN.md — Database-backed rate limiting (INFRA-03)

**Requirements:**
- REFACTOR-01: Break down Chat.tsx (2008 lines monolith)
- ~~REFACTOR-02: Break down useTeamHierarchy.ts~~ — SKIPPED per CONTEXT.md (getting overhaul elsewhere)
- REFACTOR-03: Tighten types in stores (remove any types)
- ~~REFACTOR-05: Fix AI SDK outdated property~~ — SKIPPED (ai-agent.ts no longer exists)
- REFACTOR-06: Tighten types in SyncTab.tsx (Meetings/Jobs loose types)
- REFACTOR-07: Consolidate inline diversity filter (chat-stream/index.ts duplication)
- CLEAN-01: Consolidate duplicate deduplication code
- CLEAN-02: Delete dead code (Coach Edge Functions, orphaned TeamManagement.tsx)
- IMPL-01: Create missing automation functions (summarize-call, extract-action-items)
- IMPL-02: Handle non-existent table references (tasks, clients, client_health_history)
- INFRA-01: Complete cost tracking for all OpenRouter models
- INFRA-02: Fix cron expression parsing (placeholder defaulting to 1-hour)
- INFRA-03: Move rate limiting to database (in-memory limits reset on cold starts)

**Success Criteria:**
1. Chat.tsx under 500 lines with extracted sub-components (MessageList, InputArea, ConnectionHandler)
2. Chat streaming logic extracted to custom hooks (testable in isolation)
3. ~~useTeamHierarchy broken into focused hooks~~ — SKIPPED per CONTEXT.md
4. All store interfaces properly typed (zero `any` types in store definitions)
5. SyncTab.tsx Meetings/Jobs types defined with proper interfaces
6. Single diversity filter implementation imported by chat-stream (no inline duplication)
7. Single deduplication implementation used across codebase
8. ~~Legacy `ai-agent.ts` removed~~ — Already removed (no longer exists)
9. Real-Time Coach stub removed if unused
10. Orphaned `TeamManagement.tsx` removed if redundant
11. Automation functions either implemented or references removed (no silent failures)
12. Non-existent table references handled gracefully or tables created
13. Cost tracking covers all OpenRouter models used in production
14. Cron expression parsing produces correct intervals (not hardcoded 1-hour)
15. Rate limiting persists across cold starts (database-backed)
16. Codebase passes dead code analysis with zero warnings

---

### Phase 7: High-Value Differentiators
**Goal:** Unique features shipped that differentiate CallVault from generic transcription tools

**Dependencies:** Phase 6 (ship on clean, stable foundation)

**Plans:** 6 plans in 3 waves

Plans:
- [x] 07-01-PLAN.md — PROFITS Framework extraction and report UI (DIFF-01)
- [x] 07-02-PLAN.md — Folder-Level Chat filtering (DIFF-02)
- [x] 07-03-PLAN.md — Real Analytics Data verification (DIFF-05) ✓
- [x] 07-04-PLAN.md — Contacts Database schema and UI (DIFF-04)
- [x] 07-05-PLAN.md — Client Health Alerts with notifications (DIFF-03)
- [x] 07-06-PLAN.md — **[GAP FIX]** Wire email alerts + NotificationBell (DIFF-03 gaps)

**Requirements:**
- DIFF-01: PROFITS Framework v2 (psychology extraction from sales calls)
- DIFF-02: Folder-Level Chat (scope chat to specific folders)
- DIFF-03: Client Health Alerts (engagement tracking with notifications)
- DIFF-04: Contacts Database (track attendees from calls)
- DIFF-05: Real Analytics Data (verify analytics shows real data)

**Success Criteria:**
1. User can run PROFITS analysis on sales call and see psychology extraction
2. User can open folder and chat with only that folder's calls
3. User receives email alert when client engagement drops below threshold
4. User can view and manage contacts from call attendees
5. Analytics tabs show real data from existing hooks (not placeholders)

---

### Phase 8: Growth Infrastructure ✓ COMPLETE
**Goal:** Post-launch features enabled to support user acquisition and monetization

**Dependencies:** Phase 7 (ship core product first)

**Plans:** 6 plans in 3 waves

Plans:
- [x] 08-01-PLAN.md — Polar billing schema and SDK client (GROW-02)
- [x] 08-02-PLAN.md — Polar Edge Functions for subscription lifecycle (GROW-02)
- [x] 08-03-PLAN.md — Polar billing UI and BillingTab integration (GROW-02)
- [x] 08-04-PLAN.md — YouTube import Edge Function (GROW-03)
- [x] 08-05-PLAN.md — YouTube import UI and ManualImport page (GROW-03)
- [x] 08-06-PLAN.md — Admin cost dashboard extension (GROW-05)

**Requirements:**
- GROW-02: 3-tier Billing (Polar integration)
- GROW-03: YouTube Import UI
- ~~GROW-04: Slack Notification Action~~ — DEFERRED per CONTEXT.md
- GROW-05: Complete Cost Tracking

**Success Criteria:**
1. Users can select Solo/Team/Business plan and upgrade/downgrade via Polar
2. User can paste YouTube URL and import video as call transcript
3. ~~User can configure automation rule to post to Slack channel~~ — DEFERRED
4. Admin dashboard shows AI costs for all OpenRouter models used

---

### Phase 9: Bank/Vault Architecture ✓ COMPLETE
**Goal:** Implement Bank/Vault architecture replacing teams - personal/team vault types with migration from fathom_calls

**Dependencies:** Phase 4 (team infrastructure to be replaced)

**Plans:** 10 plans in 3 waves

Plans:
- [x] 09-01-PLAN.md — Eliminate all coach code (Edge Function, frontend, types)
- [x] 09-02-PLAN.md — Create banks and bank_memberships tables with RLS
- [x] 09-03-PLAN.md — Create vaults and vault_memberships tables with RLS
- [x] 09-04-PLAN.md — Create recordings and vault_entries tables with RLS
- [x] 09-05-PLAN.md — Update signup trigger + drop old team tables + update folders
- [x] 09-06-PLAN.md — Migration function for fathom_calls to recordings/vault_entries
- [x] 09-07-PLAN.md — Bank context store and useBankContext hook
- [x] 09-08-PLAN.md — Bank switcher UI in header
- [x] 09-09-PLAN.md — Banks & Vaults settings tab with vault management
- [x] 09-10-PLAN.md — Wire existing pages to use bank/vault context

**Requirements:**
- BANK-01: Banks provide hard tenant isolation (personal vs business)
- BANK-02: Vaults enable collaboration within banks (team, coach, client types)
- BANK-03: Recordings live in one bank, VaultEntries enable multi-vault sharing
- BANK-04: Existing fathom_calls migrate to recordings + vault_entries
- BANK-05: Personal bank/vault auto-created on signup

**Success Criteria:**
1. Coach code completely removed from codebase
2. Bank/Vault schema created with proper RLS policies
3. New users get personal bank + vault on signup
4. Existing calls migrated to recordings/vault_entries
5. Bank switcher shows in header, allows context switching
6. Team vaults can be created with default folders (Hall of Fame, Manager Reviews)
7. All pages use new bank/vault context for data filtering

---

### Phase 10: Chat Bank/Vault Scoping (Gap Closure) ✓ COMPLETE
**Goal:** Chat searches respect active bank/vault context for proper multi-tenant isolation

**Dependencies:** Phase 9 (bank/vault architecture must exist)

**Gap Closure:** Closes integration gap from v1-MILESTONE-AUDIT.md

Plans:
- [x] 10-01-PLAN.md — Pass bank_id/vault_id from frontend to chat-stream-v2
- [x] 10-02-PLAN.md — Filter chat searches by active bank/vault context
- [x] 10-03-PLAN.md — Verify multi-tenant isolation end-to-end

**Requirements:**
- GAP-INT-01: Chat backend respects bank/vault context (not searching all user recordings)

**Success Criteria:**
1. Frontend sends bank_id/vault_id in chat request body
2. chat-stream-v2 filters searches to active bank/vault only
3. User in Bank A cannot see recordings from Bank B via chat
4. Vault-scoped chat only searches recordings in that vault

---

### Phase 10.2: Vaults Page (INSERTED)
**Goal:** Make vaults a first-class sidebar page replacing "Collaboration" with full vault management

**Dependencies:** Phase 10 (bank/vault scoping must work first)

**Gap Closure:** Makes vault architecture actually usable by users

**Plans:** 9 plans in 4 waves

Plans:
- [x] 10.2-01-PLAN.md — W1: Foundation — Route, sidebar, vault list pane, useVaults hook, query keys
- [x] 10.2-02-PLAN.md — W2: Vault detail — Recordings (no tabs), member slide-in panel, Recording→Meeting adapter
- [x] 10.2-03-PLAN.md — W2: Vault CRUD — Create/edit/delete dialogs + useVaultMutations
- [x] 10.2-07-PLAN.md — W2: Vault badges — VaultBadge/VaultBadgeList on CallDetailPage + TranscriptTable
- [x] 10.2-04-PLAN.md — W3: Member management — Shareable invite links (no email), roles, remove/leave
- [x] 10.2-05-PLAN.md — W3: Business bank creation — Both CTA and BankSwitcher entry points
- [x] 10.2-08-PLAN.md — W3: Search/filter — Search recordings within vaults by title, sort, date filter
- [x] 10.2-06-PLAN.md — W4: Polish — Empty states, error boundaries, settings migration, mobile verify
- [x] 10.2-09-PLAN.md — W4: Import vault selection — VaultSelector in YouTube import + SyncTab sync flow

**Requirements:**
- VAULT-UI-01: "Vaults" replaces "Collaboration" in sidebar
- VAULT-UI-02: Vault list pane shows all vaults grouped by bank
- VAULT-UI-03: Vault detail shows recordings with vault-specific metadata
- VAULT-UI-04: Can create/edit/delete vaults from the page
- VAULT-UI-05: Can invite/remove vault members and change roles
- VAULT-UI-06: Can create business banks (no billing gate for now)
- VAULT-UI-07: Can move/assign recordings between vaults

**Success Criteria:**
1. Sidebar shows "Vaults" instead of "Collaboration"
2. Vault list pane displays all user's vaults grouped by bank
3. Vault detail view shows recordings table with source attribution
4. Members panel shows current members with roles
5. Create vault dialog works for all vault types
6. Edit vault allows renaming and changing settings
7. Delete vault with confirmation for non-personal vaults
8. Invite members via shareable link with default member role
9. Remove members or change their roles
10. Create business bank with initial vault
11. Move recordings between vaults via UI
12. All functionality works without billing gates

**Details:**
This is a major UX insertion. The bank/vault architecture exists but is hidden in Settings.
Moving it to a first-class sidebar page makes the collaboration model discoverable and usable.

---

### Phase 10.3: YouTube-Specific Vaults & Video Intelligence (INSERTED)
**Goal:** Create dedicated YouTube vault type with thumbnail-first video UX, media-row list layout, video detail modal, and YouTube-scoped import + chat

**Depends on:** Phase 10.2 (COMPLETE)

**Plans:** 6 plans in 3 waves

Plans:
- [x] 10.3-01-PLAN.md — W1: Foundation — DB migration, YouTube types, utilities, vault type configs
- [x] 10.3-02-PLAN.md — W2: YouTube Video List — Media-row components, sort hook, VaultDetailPane conditional rendering
- [x] 10.3-03-PLAN.md — W2: Import Flow — VaultSelector YouTube-only filtering, auto-create YouTube vault on first import
- [x] 10.3-04-PLAN.md — W3: Video Detail Modal — Dialog overlay with summary, collapsible description, transcript, click-to-start chat
- [ ] 10.3-05-PLAN.md — [GAP FIX] Add YouTube vault type option in all create surfaces + regression tests
- [ ] 10.3-06-PLAN.md — [GAP FIX] Unblock youtube-import 400 chain (status propagation, auth forwarding, deploy + re-UAT gate)

**Requirements:**
- YT-01: 'youtube' vault type exists in DB and TypeScript
- YT-02: YouTube vault displays media-row list (not TranscriptTable)
- YT-03: Video detail opens in modal overlay with summary, description, transcript
- YT-04: Chat works within YouTube vault context (reuses existing infrastructure)
- YT-05: First import auto-creates YouTube vault if none exists
- YT-06: VaultSelector filters to YouTube-only vaults during import

**Success Criteria:**
1. YouTube vault type can be created and appears in vault list with YouTube icon
2. YouTube vault shows media-row list with thumbnails, metadata columns, and outlier rank placeholder
3. Clicking video opens modal with above-the-fold summary, collapsible description, transcript
4. "Start Chat" navigates to chat page with YouTube vault context
5. First YouTube import auto-creates "YouTube Vault" seamlessly
6. VaultSelector prevents non-YouTube vault selection during YouTube import
7. Non-YouTube vaults completely unaffected (no regression)

---

### Phase 11: PROFITS Frontend Trigger (Gap Closure)
**Goal:** Wire orphaned extract-profits Edge Function to Content area alongside other agent frameworks

**Dependencies:** Phase 7 (extract-profits Edge Function must exist)

**Gap Closure:** Closes flow gap from v1-MILESTONE-AUDIT.md

Plans:
- [ ] 11-01-PLAN.md — Add PROFITS Framework option to Content generation area
- [ ] 11-02-PLAN.md — Wire to extract-profits with progress/result display

**Requirements:**
- GAP-FLOW-01: PROFITS Analysis accessible from Content area (alongside other agent frameworks)

**Success Criteria:**
1. PROFITS Framework option visible in Content area with other agent frameworks
2. User can select call(s) and run PROFITS analysis
3. Analysis triggers extract-profits Edge Function with loading state
4. Results display consistently with other content generation output

---

## Progress Tracking

| Phase | Status | Requirements | Progress |
|-------|--------|--------------|----------|
| 1 - Security Lockdown | Complete ✅ | 6 | 100% |
| 2 - Chat Foundation | Complete ✅ | 6 | 100% (12/12 plans) |
| 3 - Integration OAuth | Complete ✅ | 3 | 100% (2/2 plans) |
| 3.1 - Compact Integration UI | Complete ✅ | 3 | 100% (3/3 plans) |
| 3.2 - Integration Import Controls | Complete ✅ | 3 | 100% (2/2 plans) |
| 4 - Team Collaboration | Complete ✅ | 2 | 100% (6/6 plans) |
| 5 - Demo Polish | Complete ✅ | 12 | 100% (7/7 plans) |
| 6 - Code Health & Infrastructure | Complete ✅ | 11 | 100% (10/10 plans) |
| 7 - Differentiators | Complete ✅ | 5 | 100% (5/5 plans) |
| 8 - Growth Infrastructure | Complete ✅ | 4 | 100% (6/6 plans) |
| 9 - Bank/Vault Architecture | Complete ✅ | 5 | 100% (10/10 plans) |
| 10 - Chat Bank/Vault Scoping | Complete ✅ | 1 | 100% (3/3 plans) |
| 10.2 - Vaults Page (INSERTED) | Complete ✅ | 7 | 100% (9/9 plans, 4 waves) |
| 10.3 - YouTube-Specific Vaults & Video Intelligence (INSERTED) | In Progress 🟡 | 6 | 67% (4/6 plans complete, gap closures planned) |
| 11 - PROFITS Frontend Trigger | Pending | 1 | 0% (0/2 plans) |

**Overall Progress:** 65/67 requirements (97%) - **1 phase remaining**

---

## Phase Dependencies

```
Phase 1: Security Lockdown (blocks all)
    ↓
Phase 2: Chat Foundation
    ↓
Phase 3: Integration OAuth
    ↓
Phase 4: Team Collaboration ✅
    ↓
Phase 5: Demo Polish ✅
    ↓
Phase 6: Code Health & Infrastructure
    ↓
Phase 7: Differentiators
    ↓
Phase 8: Growth Infrastructure
    ↓
Phase 9: Team Content Segregation (deferred - can be done anytime after Phase 4)
```

**Note:** Coach Collaboration removed from roadmap. Team Content Segregation deferred to Phase 9.

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
| TEAM-03 | 9 - Team Content Segregation (deferred) |
| TEAM-04 | 9 - Team Content Segregation (deferred) |
| TEAM-05 | 9 - Team Content Segregation (deferred) |
| TEAM-06 | 9 - Team Content Segregation (deferred) |
| TEAM-07 | 9 - Team Content Segregation (deferred) |
| WIRE-01 | 5 - Demo Polish |
| WIRE-02 | 5 - Demo Polish |
| FIX-01 | 5 - Demo Polish |
| FIX-02 | 5 - Demo Polish |
| FIX-03 | 5 - Demo Polish |
| FIX-04 | 5 - Demo Polish |
| FIX-05 | 5 - Demo Polish |
| FIX-06 | 5 - Demo Polish |
| REFACTOR-04 | 5 - Demo Polish |
| IMPL-03 | 5 - Demo Polish |
| DOC-01 | 5 - Demo Polish |
| DOC-02 | 5 - Demo Polish |
| REFACTOR-01 | 6 - Code Health |
| REFACTOR-02 | 6 - Code Health |
| REFACTOR-03 | 6 - Code Health |
| REFACTOR-05 | 6 - Code Health |
| REFACTOR-06 | 6 - Code Health |
| REFACTOR-07 | 6 - Code Health |
| CLEAN-01 | 6 - Code Health |
| CLEAN-02 | 6 - Code Health |
| IMPL-01 | 6 - Code Health |
| IMPL-02 | 6 - Code Health |
| INFRA-01 | 6 - Code Health |
| INFRA-02 | 6 - Code Health |
| INFRA-03 | 6 - Code Health |
| DIFF-01 | 7 - Differentiators |
| DIFF-02 | 7 - Differentiators |
| DIFF-03 | 7 - Differentiators |
| DIFF-04 | 7 - Differentiators |
| DIFF-05 | 7 - Differentiators |
| GROW-02 | 8 - Growth |
| GROW-03 | 8 - Growth |
| GROW-04 | 8 - Growth |
| GROW-05 | 8 - Growth |
| UI-INT-01 | 3.1 - Compact Integration UI |
| UI-INT-02 | 3.1 - Compact Integration UI |
| UI-INT-03 | 3.1 - Compact Integration UI |
| UI-INT-04 | 3.2 - Integration Import Controls |
| UI-INT-05 | 3.2 - Integration Import Controls |
| UI-INT-06 | 3.2 - Integration Import Controls |

**Coverage:** 58/58 requirements mapped ✓

---

## Next Steps

1. ~~Phase 1: Security Lockdown~~ ✅ Complete
2. ~~Phase 2: Chat Foundation~~ ✅ Complete (12/12 plans, all gap closures verified)
3. ~~Phase 3: Integration OAuth~~ ✅ Complete (Zoom verified, Google marked Beta)
4. ~~Phase 3.1: Compact Integration UI~~ ✅ Complete (3/3 plans)
5. ~~Phase 3.2: Integration Import Controls~~ ✅ Complete (2/2 plans)
6. ~~Phase 4: Team Collaboration~~ ✅ Complete (6/6 plans, all must-haves verified)
7. ~~Phase 5: Demo Polish~~ ✅ Complete (7/7 plans, all 12 requirements verified via Playwright)
8. ~~Phase 6: Code Health & Infrastructure~~ ✅ Complete (10/10 plans, 12/13 must-haves verified)
9. ~~Phase 7: Differentiators~~ ✅ Complete (5/5 plans, all 5 requirements verified)
10. ~~Phase 8: Growth Infrastructure~~ ✅ Complete (6/6 plans, all 4 requirements verified)
11. ~~Phase 9: Bank/Vault Architecture~~ ✅ Complete (10/10 plans, all 5 requirements satisfied)
12. ~~Phase 10: Chat Bank/Vault Scoping~~ ✅ Complete (3/3 plans, GAP-INT-01 closed)
13. **Phase 10.3: YouTube-Specific Vaults & Video Intelligence** ← Execute gap closures (10.3-05, 10.3-06)
14. **Phase 11: PROFITS Frontend Trigger** ← Next after 10.3 gaps close

**Gap Closure Phases Added** - 2 phases from v1-MILESTONE-AUDIT.md

---

*Last updated: 2026-02-11 (Phase 10.3 gap closures planned - 10.3-05 and 10.3-06 added for diagnosed UAT blockers)*
