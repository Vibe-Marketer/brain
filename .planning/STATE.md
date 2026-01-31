# State: CallVault Launch Stabilization

**Last Updated:** 2026-01-31

## Project Reference

**Core Value:** Users can reliably ask questions across their entire call history and get accurate, cited answers every single time.

**Current Focus:** Phase 9 Bank/Vault Architecture - In progress (4/10 plans)

---

## Current Position

**Milestone:** v1 Launch Stabilization

**Phase:** 9 of 9 (Bank/Vault Architecture) - In progress

**Plan:** 4 of 10 in Phase 9

**Status:** Phase 9 in progress - 09-04 (Recordings and VaultEntries) complete

**Last activity:** 2026-01-31 - Completed 09-04-PLAN.md (Recordings and VaultEntries tables)

**Progress:**
```
[████████████████████████████████████] 57/65 plans complete (Phase 9: 4/10)
```

---

## Performance Metrics

### Execution Stats

- **Total Requirements:** 55
- **Completed:** 15 (SEC-01 through SEC-06, CHAT-01 through CHAT-05, STORE-01, INT-01, INT-03)
- **Partial:** 1 (INT-02 - Google Meet marked Beta, not fully tested)
- **In Progress:** 0
- **Blocked:** 0
- **Remaining:** 39

### Phase Progress

| Phase | Requirements | Complete | Status |
|-------|--------------|----------|--------|
| Phase 1: Security Lockdown | 6 | 6 | Complete (6/6 plans) |
| Phase 2: Chat Foundation | 6 | 6 | Complete (12/12 plans) |
| Phase 3: Integration OAuth | 3 | 2 | Complete (2/2 plans) - INT-02 partial |
| Phase 3.1: Compact Integration UI | 3 | 3 | Complete (3/3 plans) |
| Phase 3.2: Integration Import Controls | 3 | 3 | Complete (2/2 plans) |
| Phase 4: Team Collaboration | 2 | 2 | Complete (6/6 plans) |
| Phase 5: Demo Polish | 12 | 12 | Complete (7/7 plans) |
| Phase 6: Code Health & Infrastructure | 13 | 13 | Complete (10/10 plans) |
| Phase 7: Differentiators | 5 | 5 | Complete (6/6 plans) |
| Phase 8: Growth | 6 | 6 | Complete (6/6 plans) |
| Phase 9: Bank/Vault Architecture | 5 | 0 | In progress (3/10 plans) |

### Velocity

- **Plans/Session:** ~2-3 per session
- **Estimated Completion:** TBD after more data points

---

## Accumulated Context

### Key Decisions

| Date | Decision | Rationale | Impact |
|------|----------|-----------|--------|
| 2026-01-27 | Security first (Phase 1 before all else) | Can't fix chat with exposed API keys and unauthenticated endpoints | Blocks all feature work until secure |
| 2026-01-27 | Comprehensive depth (9 phases) | Requirements naturally cluster into distinct delivery boundaries | Clear phase goals, easier verification |
| 2026-01-27 | Chat before integrations | Chat is core value - integrations only valuable if chat works | Prioritizes user retention over acquisition |
| 2026-01-27 | Deleted test-env-vars entirely (not secured) | Exposed full credentials + DB export mode, self-documented as DELETE AFTER USE | Eliminates most dangerous endpoint |
| 2026-01-27 | Kept ContentGenerator.tsx, stubbed AI handler | Component is active in CallDetailPage route - not dead code | Will need rewiring when content pipeline connected |
| 2026-01-27 | ExportableCall = Pick<Meeting, ...> for exports | Export functions use subset of Meeting fields, decoupled via Pick type | Type-safe without tight coupling to full Meeting |
| 2026-01-27 | Two CORS migration patterns for Group B | Functions with helpers use module-level let, inline-only use const | Minimal diff while achieving dynamic CORS for all 14 functions |
| 2026-01-27 | Removed backward-compatible corsHeaders export | No function imports it after migration; prevents accidental wildcard CORS | Only getCorsHeaders() remains as CORS API |
| 2026-01-28 | VITE_SUPABASE_PUBLISHABLE_KEY is expected client-side | Public anon key, RLS policies protect data | Not a security issue |
| 2026-01-28 | maxSteps over stopWhen/stepCountIs for streamText | Simpler API, well-documented, same behavior | Established pattern for chat-stream-v2 |
| 2026-01-28 | toast.error() placed after optimistic rollback | User sees error after state reverts, preserving UX flow | Pattern for all store error notifications |
| 2026-01-28 | rerankResults takes hfApiKey as parameter | Enables testability, avoids hidden Deno.env dependency in shared module | Shared modules don't read env directly |
| 2026-01-28 | Simple diversityFilter over existing _shared version | Exact match to chat-stream production logic (max-per-recording only) | No behavior change risk |
| 2026-01-28 | Five visual states for tool calls (pending/running/success/empty/error) | Distinguishes empty results from success - core CHAT-02 fix | Users no longer see green checkmarks on empty/failed results |
| 2026-01-28 | createTools() factory pattern for RAG tools | All 14 tools need closure access to supabase/user/apiKeys - factory pattern cleanest | Established pattern for chat-stream-v2 tool architecture |
| 2026-01-28 | mergeFilters() for session + tool filter combination | Session filters provide base context, tool args override/extend | Clean separation of session vs per-query filtering |
| 2026-01-28 | Entity search uses direct RPC not shared pipeline | searchByEntity needs JSONB post-filtering on entities column | Tool 9 is the exception to shared pipeline pattern |
| 2026-01-28 | handleRetryRef pattern for error effect -> retry handler | Breaks circular dependency between useEffect and handleRetry callback | Allows toast retry actions without stale closure issues |
| 2026-01-28 | Retry removes incomplete message before resend | Prevents duplicate messages - new response replaces failed one | Clean conversation flow on retry |
| 2026-01-28 | Renamed chat-stream to chat-stream-legacy (not deleted) | Preserves deployable fallback for rollback if v2 has issues | Legacy available at chat-stream-legacy |
| 2026-01-28 | RECORDING ID RULES as CRITICAL section in system prompt | Model was hallucinating recording_ids (1, 2) instead of using real IDs from search | Prevents getCallDetails failures from invalid IDs |
| 2026-01-28 | throttledErrorLog with 5s interval per error type | Prevents console spam during network issues while preserving debugging capability | Pattern for rate-limited error logging |
| 2026-01-28 | CallDetailPanel is read-only (no transcript editing) | Panel context is for quick reference; full editing stays in CallDetailDialog | Simpler panel component, preserves full editing in dialog |
| 2026-01-29 | reconnectAttempts changed from state to ref | State in useEffect dependency array caused infinite re-render loop (500+/sec) | Fixed critical UAT blocker for error handling |
| 2026-01-29 | Removed auto-retry, show immediate Retry button | Auto-retry with AI SDK sendMessage() creates duplicate user messages | Cleaner UX - user controls when to retry |
| 2026-01-29 | handleRetry keeps user messages intact | Removing user message on retry loses context and confuses user | Trade-off: possible duplicate user message vs lost context |
| 2026-01-29 | Call panel vs popup dialog deferred | User expressed preference for original popup dialog pattern | Panel infrastructure exists, can revisit in UX polish |
| 2026-01-29 | Exact redirect URI match for OAuth 2.0 | OAuth spec requires character-for-character match between auth URL and token exchange | Fixed Zoom redirect_uri_mismatch error |
| 2026-01-29 | Beta badge text for Google Meet | Simple "(Beta)" suffix rather than component - consistent across contexts | Sets user expectations for paid Workspace requirement |
| 2026-01-29 | Zoom Production credentials required | Supabase secrets must use Production Client ID/Secret, not Development | Root cause of Zoom OAuth 500 errors |
| 2026-01-29 | OAuth redirect to Sync tab | Better UX - after OAuth success, go to `/?tab=sync` not `/settings?tab=integrations` | Users land where they need to be |
| 2026-01-29 | 56px compact button size | Fits 6-8 buttons per row at top of Sync page | Established size for integration buttons |
| 2026-01-29 | Ring-based connection state | Green ring = connected, red ring = disconnected with opacity | Visual pattern for integration state |
| 2026-01-29 | NULL = all enabled for sync filter | When all connected platforms enabled, save NULL to auto-enable new integrations | Simpler default behavior |
| 2026-01-29 | Intersection filter for orphaned state | Intersect saved filter with connected platforms to handle disconnected integrations | Prevents invalid filter states |
| 2026-01-29 | Multi-team membership enabled | Per CONTEXT.md - users can belong to multiple teams | Removed MVP single-team restriction |
| 2026-01-29 | Team creation name-only | Per CONTEXT.md "minimal friction" - admin_sees_all and domain can be set later | Simplified team creation UX |
| 2026-01-29 | null activeTeamId = personal workspace | Per CONTEXT.md - personal workspace exists alongside team workspaces | Team context store pattern |
| 2026-01-29 | Cross-tab sync via localStorage | Same pattern as preferencesStore for consistency | Established cross-tab sync pattern |
| 2026-01-29 | onboarding_complete defaults to false | New invites start incomplete until user completes setup | Enables "Pending setup" badge tracking |
| 2026-01-29 | Amber badge for pending status | Consistent with warning/pending styling | Status badges use amber for 'pending' states |
| 2026-01-31 | Parse URL params to number for recording_id | fathom_calls uses numeric recording_id, URL params are strings | Pattern for numeric ID queries |
| 2026-01-31 | Sentiment from sentiment_cache JSON | fathom_calls stores sentiment in JSON field, not top-level columns | Extract from JSON for display |
| 2026-01-31 | Users tab already functional | Spec-042 concerns were addressed - status/joined/view details all work | No major changes needed |
| 2026-01-31 | Billing "Coming Soon" badge pattern | Unreleased features should show clear "Coming Soon" messaging | Prevents misleading CTAs |
| 2026-01-31 | Bulk actions as 4th pane | Selection actions should follow 4th pane pattern for UI consistency | Replaced bottom Mac-style portal with right-side slide-in pane |
| 2026-01-31 | Database type imports for Supabase tables | Ensures types stay in sync with schema, no manual interface maintenance | AutomationRules uses Database['public']['Tables']['X']['Row'] |
| 2026-01-31 | Discriminated union for PanelData | Use 'type' field as discriminator for type-safe panel data access | All panel components use type narrowing |
| 2026-01-31 | source_platform on Meeting interface | Support multi-source deduplication (fathom, google_meet, zoom) | SyncTab filters work with all platforms |
| 2026-01-31 | Graceful skip for missing tables | clients/tasks tables don't exist yet (Phase 7 feature) | Automation engine stable, won't crash |
| 2026-01-31 | cron-parser for 5-field cron support | Industry-standard library with timezone support | Proper cron expression parsing in scheduler |
| 2026-01-31 | cronstrue for human-readable schedules | Converts cron to natural language descriptions | Better UX for CronPreview component |
| 2026-01-31 | Database-backed rate limiting with fail-open | In-memory Maps reset on cold starts; fail-open for UX | Rate limits persist across Edge Function restarts |
| 2026-01-31 | Analytics already wired to real data | useCallAnalytics queries fathom_calls directly | DIFF-05 verified, no changes needed |
| 2026-01-31 | Folder filter resolved at request time | Folders→recording_ids via folder_assignments | Search pipeline unchanged, folder logic isolated |
| 2026-01-31 | Individual folder pills in header | Users need to see and remove specific folders | Better UX than showing count |
| 2026-01-31 | YouTube as explicit source_platform | Added 'youtube' to constraint rather than using 'other' | Better filtering and query support |
| 2026-01-31 | Metadata JSONB column for fathom_calls | Platform-specific data needs flexible storage | YouTube video details stored without schema changes |
| 2026-01-31 | YouTube recording_id range 9000000000000+ | Avoid collision with Fathom recording IDs | Unique ID space per platform |
| 2026-01-31 | SECURITY DEFINER + role check for admin RPC | Admin-only aggregation needs to bypass RLS but still verify caller role | Pattern for admin-only functions |
| 2026-01-31 | Empty results for non-admin cost queries | Return empty arrays/zeros rather than errors for non-admins | Simpler frontend logic |
| 2026-01-31 | Import nav item after Content in sidebar | Logical grouping for content acquisition features | YouTube imports accessible from main nav |
| 2026-01-31 | UpgradeButton handles checkout internally | Encapsulates ensureCustomer + checkout + redirect | Reusable anywhere without checkout logic duplication |
| 2026-01-31 | Tier derived from product_id prefix | Product IDs follow format tier-interval (solo-monthly) | No extra API calls needed for tier detection |
| 2026-01-31 | SECURITY DEFINER for bank membership checks | Prevents infinite RLS recursion when policies check membership tables | Pattern for is_bank_member/is_bank_admin_or_owner |
| 2026-01-31 | Users can create their own initial bank_membership | Bootstrap pattern for bank creators to become bank_owner | Enables self-service bank creation flow |
| 2026-01-31 | SECURITY DEFINER for vault membership checks | Prevents infinite RLS recursion when policies check vault membership tables | Pattern for is_vault_member/is_vault_admin_or_owner |
| 2026-01-31 | Bank admins can view all vaults in their banks | Oversight capability for bank administrators | Uses separate SELECT policy on vaults table |
| 2026-01-31 | 5-level vault role hierarchy | vault_owner > vault_admin > manager > member > guest | Granular access control within vaults |
| 2026-01-31 | VaultEntry enables same recording in multiple vaults | Recording lives in ONE bank, but can appear in many vaults with local context | vault_entries has local_tags, scores, notes per appearance |
| 2026-01-31 | legacy_recording_id for fathom_calls migration | BIGINT field tracks original fathom_calls.recording_id for migration | UNIQUE(bank_id, legacy_recording_id) prevents duplicates |

### Active TODOs

- [x] Execute 01-01 through 01-06 (Phase 1 complete)
- [x] Execute 02-01 through 02-12 (Phase 2 complete)
- [x] Execute 03-01-PLAN.md (Zoom OAuth fix & Google Meet Beta badge)
- [x] Execute 03-02-PLAN.md (OAuth verification - Zoom verified, Google skipped)
- [x] Execute 03.1-01-PLAN.md (Core primitives - modal store + compact button)
- [x] Execute 03.1-02-PLAN.md (Composite components - modal + button group)
- [x] Execute 03.1-03-PLAN.md (Wire up Sync page)
- [x] Execute 03.2-01-PLAN.md (Database + Filter Hook)
- [x] Execute 03.2-02-PLAN.md (SourcesFilterPopover + SyncTab integration)

- [x] Execute 04-01-PLAN.md (Team Invite Route Fix)
- [x] Execute 04-02-PLAN.md (Multi-Team & Simplified Creation)
- [x] Execute 04-03-PLAN.md (Team Context Infrastructure)
- [x] Execute 04-04-PLAN.md (Team Switcher Dropdown)
- [x] Execute 04-05-PLAN.md (Pending Setup Badge)
- [x] Execute 04-06-PLAN.md (Team Collaboration Verification)

Phase 4 Complete. Phase 5 in progress.

- [x] Execute 05-01-PLAN.md (Route Automation Rules + Fix CallDetailPage)
- [x] Execute 05-02-PLAN.md (Fix AutomationRules.tsx type mismatches)
- [x] Execute 05-03-PLAN.md (Runtime test & fix Tags/Rules/Analytics tabs)
- [x] Execute 05-04-PLAN.md (Fix Users & Billing tabs - verified functional)
- [x] Execute 05-05-PLAN.md (Bulk action toolbar 4th pane)
- [x] Execute 05-06-PLAN.md (Export & deduplication documentation)
- [x] Execute 05-07-PLAN.md (Final verification via Playwright - all 12 requirements verified)

Phase 5 Complete. (Coach Collaboration removed, Team Content Segregation deferred to Phase 9)

Phase 6 Complete. Ready for Phase 7.

- [x] Execute 07-03-PLAN.md (Verify Real Analytics Data - DIFF-05 verified)
- [x] Execute 07-01-PLAN.md (PROFITS Framework - extract-profits, usePROFITS, PROFITSReport)
- [x] Execute 07-02-PLAN.md (Folder-Level Chat - filter resolution, UI, header pills)
- [x] Execute 07-04-PLAN.md (Contacts Database - schema, useContacts, Settings UI)
- [x] Execute 07-05-PLAN.md (Client Health Alerts - notifications, scheduled check, email generation)

Phase 7 Complete. Ready for Phase 8 (Growth).

- [x] Execute 08-01-PLAN.md (Polar billing schema and SDK client)
- [x] Execute 08-02-PLAN.md (Polar Edge Functions - webhook, checkout, customer, state)
- [x] Execute 08-03-PLAN.md (Polar billing UI and BillingTab integration)
- [x] Execute 08-04-PLAN.md (YouTube Import Edge Function - orchestration, metadata, progress tracking)
- [x] Execute 08-05-PLAN.md (YouTube Import UI and ManualImport page)
- [x] Execute 08-06-PLAN.md (Admin Cost Dashboard - RPC function, useAdminCosts hook, AdminCostDashboard component)

Phase 8 COMPLETE (6/6 plans). Phase 9 started.

- [x] Execute 09-02-PLAN.md (Banks and BankMemberships tables with RLS)
- [x] Execute 09-03-PLAN.md (Vaults and VaultMemberships tables with RLS)
- [x] Execute 09-04-PLAN.md (Recordings and VaultEntries tables with RLS)

### Pending Todos

2 todos in `.planning/todos/pending/`:
- **Fix missing get_available_metadata database function** (database)
- **Make chat sources section collapsible** (ui)

### Roadmap Evolution

- Phase 3.1 inserted after Phase 3: Compact Integration UI (URGENT) - Redesign integration cards to compact button/icon format with reusable modal component
- Phase 3.2 inserted after Phase 3.1: Integration Import Controls - Redesign "Import meetings from" section + per-integration search on/off toggle
- Coach Collaboration (Phase 5) removed from roadmap entirely
- Team Content Segregation (Phase 4.5) deferred to Phase 9

### Known Blockers

None

---

## Session Continuity

**Last session:** 2026-01-31
**Stopped at:** Completed 09-04-PLAN.md (Recordings and VaultEntries tables)
**Resume file:** None

### Context for Next Session

**Where we are:**
Phase 9 Bank/Vault Architecture in progress. Plans 09-01, 09-02, 09-03, 09-04 complete.

**What to remember:**
- 09-04 completed: Recordings and VaultEntries tables
  - recordings table with bank ownership, source_app enum, legacy_recording_id for migration
  - vault_entries table with local context (local_tags, scores, notes) per vault appearance
  - SECURITY DEFINER helper: get_recording_bank_id
  - RLS policies enforce bank membership for recordings, vault membership for entries
  - UNIQUE constraints prevent duplicate recordings per bank and duplicate entries per vault
- Next: 09-05 (Update signup trigger + drop old team tables + update folders)

---

## Quick Stats

| Metric | Value |
|--------|-------|
| Total Phases | 9 (+ 2 inserted: 3.1, 3.2) |
| Total Requirements | 58 |
| Requirements Complete | 54 (93%) |
| Current Phase | 9 - Bank/Vault Architecture (In progress) |
| Plans Complete | 57 overall |
| Next Plan | 09-05 (Update signup trigger + drop old team tables) |
| Blockers | 0 |

---

*State tracking initialized: 2026-01-27*
*Last updated: 2026-01-31 (Completed 09-04-PLAN.md - Recordings and VaultEntries tables)*
