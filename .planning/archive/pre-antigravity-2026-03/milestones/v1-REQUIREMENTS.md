# Requirements Archive: v1 Launch Stabilization

**Archived:** 2026-02-21
**Status:** ✅ SHIPPED

This is the archived requirements specification for v1 Launch Stabilization.
For current requirements, see `.planning/REQUIREMENTS.md` (created for next milestone via `/gsd-new-milestone`).

---

# Requirements: CallVault Launch Stabilization

**Defined:** 2026-01-27
**Core Value:** Users can reliably ask questions across their entire call history and get accurate, cited answers every single time.

## v1 Requirements

### TIER 1: CRITICAL (Blocks Launch)

**Chat Reliability**
- [x] **CHAT-01**: Chat works reliably with all 14 RAG tools firing consistently
- [x] **CHAT-02**: Tool calls return results (no silent failures with green checkmarks on empty data)
- [x] **CHAT-03**: Streaming doesn't error out mid-response
- [x] **CHAT-04**: Citations work consistently
- [x] **CHAT-05**: Migrate to Vercel AI SDK + OpenRouter (replace manual streaming implementation)

**Integration OAuth Flows**
- [x] **INT-01**: Zoom OAuth connection flow works ✓ *Verified end-to-end with production credentials*
- [x] **INT-02**: Google OAuth connection flow works ✓ *Beta — Google Workspace only, marked with Beta badge*
- [x] **INT-03**: Integration connection errors surface to user ✓ *Toast notifications added*

**Collaboration Features**
- [x] **TEAM-01**: Team creation works ✓ *Multi-team membership enabled*
- [x] **TEAM-02**: Team join page accessible via route ✓ *`/join/team/:token` routed*
- [x] **COACH-01**: Coach invite emails send successfully → **ELIMINATED** *(Coach feature removed from roadmap in Phase 9)*
- [x] **COACH-02**: Coach invite links generate correctly → **ELIMINATED** *(Coach feature removed)*
- [x] **COACH-03**: Coach join page accessible via route → **ELIMINATED** *(Coach feature removed)*

**Security**
- [x] **SEC-01**: Remove client-side exposed API keys ✓ *VITE_OPENAI_API_KEY removed, ai-agent.ts deleted*
- [x] **SEC-02**: Delete legacy unauthenticated edge functions ✓ *extract-knowledge, generate-content deleted*
- [x] **SEC-03**: Add admin auth check to test functions ✓ *test-env-vars deleted entirely (more secure)*
- [x] **SEC-04**: Remove sensitive logging ✓ *PII console.logs removed across codebase*
- [x] **SEC-05**: Fix type safety bypasses in exports ✓ *BulkActionToolbarEnhanced properly typed*
- [x] **SEC-06**: Migrate Edge Functions from wildcard CORS to getCorsHeaders() ✓ *61+ functions migrated*

**Store Reliability**
- [x] **STORE-01**: Fix silent store failures ✓ *16 store methods now surface toast errors*

### TIER 2: DEMO POLISH (Looks Unfinished)

**Wire Orphaned Pages**
- [x] **WIRE-01**: Route Automation Rules page ✓ *`/automation-rules` → AutomationRules.tsx*
- [x] **WIRE-02**: Wire analytics tabs ✓ *All 6 analytics components show real data*

**Fix Broken Features**
- [x] **FIX-01**: Fix Tags tab error ✓ *Tags tab loads without error*
- [x] **FIX-02**: Fix Rules tab error ✓ *Rules tab loads without error*
- [x] **FIX-03**: Fix Analytics tabs crashes ✓ *All 6 analytics tabs stable*
- [x] **FIX-04**: Fix Users tab non-functional elements ✓ *Status/joined/view details functional*
- [x] **FIX-05**: Fix Billing section if charging ✓ *"Coming Soon" badge for unreleased billing*
- [x] **FIX-06**: Move bulk action toolbar to right-side 4th pane ✓ *Replaced Mac-style bottom bar*

**Documentation**
- [x] **DOC-01**: Document export system ✓ *13+ formats documented*
- [x] **DOC-02**: Document multi-source deduplication ✓ *Fuzzy matching documented*

**Code Cleanup**
- [x] **CLEAN-01**: Consolidate duplicate deduplication code ✓ *Single implementation*
- [x] **CLEAN-02**: Delete dead code ✓ *ai-agent.ts, Coach stub, orphaned components removed*

**Tech Debt Refactoring**
- [x] **REFACTOR-01**: Break down Chat.tsx ✓ *689 lines (from 2008) — accepted as essential orchestration logic*
- [x] **REFACTOR-02**: Break down useTeamHierarchy.ts → **SKIPPED** *(superseded by Bank/Vault in Phase 9)*
- [x] **REFACTOR-03**: Tighten types in stores ✓ *Zero `any` types in store definitions*
- [x] **REFACTOR-04**: Fix type mismatches in AutomationRules.tsx ✓ *Database type imports used*
- [x] **REFACTOR-05**: Fix AI SDK outdated property → **SKIPPED** *(ai-agent.ts removed in SEC-01)*
- [x] **REFACTOR-06**: Tighten types in SyncTab.tsx ✓ *Meetings/Jobs properly typed*
- [x] **REFACTOR-07**: Consolidate inline diversity filter ✓ *Single implementation imported by chat-stream*

**Missing Implementations**
- [x] **IMPL-01**: Create or delete missing automation functions ✓ *summarize-call, extract-action-items implemented*
- [x] **IMPL-02**: Handle non-existent table references gracefully ✓ *tasks/clients/client_health_history handled*
- [x] **IMPL-03**: Fix CallDetailPage to query fathom_calls ✓ *Legacy `calls` table reference removed*

**Infrastructure Fixes**
- [x] **INFRA-01**: Complete cost tracking for all OpenRouter models ✓ *26 models tracked*
- [x] **INFRA-02**: Fix cron expression parsing ✓ *cron-parser library, cronstrue for display*
- [x] **INFRA-03**: Move rate limiting to database ✓ *Database-backed, persists across cold starts*

### TIER 3: HIGH-VALUE DIFFERENTIATORS

- [x] **DIFF-01**: PROFITS Framework v2 ✓ *extract-profits Edge Function + PROFITSReport UI — NOTE: frontend trigger eliminated, entire framework dropped for v2*
- [x] **DIFF-02**: Folder-Level Chat ✓ *Folder filter pills in chat header, resolves to recording IDs*
- [x] **DIFF-03**: Client Health Alerts ✓ *Email alerts, NotificationBell, scheduled check*
- [x] **DIFF-04**: Contacts Database ✓ *Schema, useContacts hook, Settings UI*
- [x] **DIFF-05**: Real Analytics Data ✓ *useCallAnalytics verified querying fathom_calls directly*

### TIER 4: GROWTH

- [x] **GROW-02**: 3-tier Billing ✓ *Polar integration, Solo/Team/Business plans*
- [x] **GROW-03**: YouTube Import UI ✓ *ManualImport page with progress tracking*
- [ ] **GROW-04**: Slack Notification Action → **DEFERRED** *(deferred per CONTEXT.md)*
- [x] **GROW-05**: Complete Cost Tracking ✓ *Admin dashboard with all 26 OpenRouter models*

### INSERTED REQUIREMENTS (Added during execution)

**Phase 3.1 — Compact Integration UI**
- [x] **UI-INT-01**: Compact integration buttons replace large cards on Sync page ✓
- [x] **UI-INT-02**: Reusable IntegrationConnectModal component ✓
- [x] **UI-INT-03**: Same modal works in Sync, Settings > Integrations, and onboarding ✓

**Phase 3.2 — Integration Import Controls**
- [x] **UI-INT-04**: Redesigned "Import meetings from" section ✓
- [x] **UI-INT-05**: Per-integration on/off toggle for search inclusion ✓
- [x] **UI-INT-06**: Clear visual state for which integrations are included in search ✓

**Phase 9 — Bank/Vault Architecture**
- [x] **BANK-01**: Banks provide hard tenant isolation ✓
- [x] **BANK-02**: Vaults enable collaboration within banks ✓
- [x] **BANK-03**: Recordings live in one bank, VaultEntries enable multi-vault sharing ✓
- [x] **BANK-04**: Existing fathom_calls migrate to recordings + vault_entries ✓
- [x] **BANK-05**: Personal bank/vault auto-created on signup ✓

**Phase 10 — Chat Bank/Vault Scoping**
- [x] **GAP-INT-01**: Chat backend respects bank/vault context ✓ *hybrid_search_transcripts_scoped RPC*

**Phase 10.2 — Vaults Page**
- [x] **VAULT-UI-01**: "Vaults" replaces "Collaboration" in sidebar ✓
- [x] **VAULT-UI-02**: Vault list pane shows all vaults grouped by bank ✓
- [x] **VAULT-UI-03**: Vault detail shows recordings with vault-specific metadata ✓
- [x] **VAULT-UI-04**: Can create/edit/delete vaults from the page ✓
- [x] **VAULT-UI-05**: Can invite/remove vault members and change roles ✓
- [x] **VAULT-UI-06**: Can create business banks ✓
- [x] **VAULT-UI-07**: Can move/assign recordings between vaults ✓

**Phase 10.3 — YouTube-Specific Vaults**
- [x] **YT-01**: 'youtube' vault type exists in DB and TypeScript ✓
- [x] **YT-02**: YouTube vault displays media-row list ✓
- [x] **YT-03**: Video detail opens in modal overlay ✓
- [x] **YT-04**: Chat works within YouTube vault context ✓
- [x] **YT-05**: First import auto-creates YouTube vault ✓
- [x] **YT-06**: VaultSelector filters to YouTube-only vaults ✓

**Phase 12 — Remote MCP**
- [x] **MCP-REMOTE-01**: Cloudflare Worker deployed at callvault-mcp.naegele412.workers.dev/mcp ✓
- [x] **MCP-REMOTE-02**: Supabase OAuth 2.1 Server with Dynamic Client Registration ✓
- [x] **MCP-REMOTE-03**: All 16 existing operations ported to stateless Worker format ✓
- [x] **MCP-REMOTE-04**: Users can connect from Claude Desktop via URL ✓ *(human verify pending)*
- [x] **MCP-REMOTE-05**: Users can connect from ChatGPT ✓ *(human verify pending)*
- [x] **MCP-REMOTE-06**: Users can connect from OpenClaw via config ✓ *(community plugin, downgraded)*
- [x] **MCP-REMOTE-07**: OAuth flow uses existing CallVault/Google accounts ✓
- [x] **MCP-REMOTE-08**: Semantic search operation working ✓ *(requires valid OpenAI API key in Supabase secrets)*

---

## Milestone Summary

**Total v1 requirements: 80** (55 original + 25 inserted across phases 3.1, 3.2, 9, 10, 10.2, 10.3, 12)

| Status | Count |
|--------|-------|
| ✅ Complete | 70 |
| ⚠️ Partial/Beta | 1 (INT-02 Google OAuth) |
| ⏭️ Skipped (obsolete) | 2 (REFACTOR-02, REFACTOR-05) |
| 🚫 Eliminated | 3 (COACH-01, COACH-02, COACH-03 — Coach feature removed) |
| ⏳ Deferred | 1 (GROW-04 Slack — deferred per CONTEXT.md) |
| ❌ Not done | 0 |

**Requirements adjusted during milestone:**
- DIFF-01 (PROFITS Framework): Built backend + report UI, but frontend trigger (Phase 11) eliminated; entire framework dropped for v2
- INT-02 (Google OAuth): Marked Beta with visual badge; not fully E2E tested in production Workspace environment
- TEAM-03 through TEAM-07: Replaced entirely by Bank/Vault architecture (Phase 9)

**Requirements dropped:**
- COACH-01, COACH-02, COACH-03: Coach collaboration feature removed from scope when Bank/Vault architecture superseded the team/coach model in Phase 9

---
*Archived: 2026-02-21 as part of v1 milestone completion*
*Requirements defined: 2026-01-27*
