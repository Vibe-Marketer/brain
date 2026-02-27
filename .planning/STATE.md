# State: CallVault

**Last Updated:** 2026-02-27 (Phase 13 Plan 02 complete — pricing tiers + upgrade prompts locked)

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-02-22 after v2.0 milestone start)

**Core value:** Clarity-first organized call workspace. Users can import calls from anywhere, organize them into clear workspaces, and expose that structured context to whatever AI they already use — with zero confusion about how the system works.

**Current focus:** v2.0 — The Pivot (thin app + import rules + workspace clarity + MCP expansion)

---

## Current Position

**Milestone:** v2.0 — The Pivot

**Phase:** Phase 13 — Strategy + Pricing (in progress)

**Plan:** 3 plans in 2 waves (13-01, 13-02 parallel in Wave 1; 13-03 in Wave 2)

**Status:** Phase 13 in progress. Plans 01 and 02 complete (Wave 1 done). Plan 03 ready to execute (Wave 2).

**Last activity:** 2026-02-27 — Plan 13-02 complete (PRICING-TIERS.md + UPGRADE-PROMPTS.md)

**Progress:**
[██████████] 97%
[==        ] 2/3 plans in Phase 13 · 0/10 phases complete
Phase 13: Strategy + Pricing    [==        ] 2/3 plans complete
Phase 14: Foundation            [ ] not started
Phase 15: Data Migration        [ ] not started
Phase 16: Workspace Redesign    [ ] not started
Phase 17: Import Pipeline       [ ] not started
Phase 18: Import Routing Rules  [ ] not started
Phase 19: MCP Audit + Tokens    [ ] not started
Phase 20: MCP Differentiators   [ ] not started
Phase 21: AI Bridge + Export    [ ] not started
Phase 22: Backend Cleanup       [ ] not started
```

---

## v1 Summary (Archived)

**v1 Launch Stabilization:** COMPLETE — See `.planning/milestones/v1-ROADMAP.md`

- 93 plans across 12 phases (+ 4 inserted)
- 80 requirements (70 complete, 1 Beta, 9 skipped/eliminated/deferred)
- ~112,743 lines TypeScript
- Remote MCP live at https://callvault-mcp.naegele412.workers.dev/mcp

---

## Accumulated Context

### Key Decisions

| Date | Decision | Rationale | Impact |
|------|----------|-----------|--------|
| 2026-02-27 | Free tier: 10 imports/month, 1 org, 1 workspace, no MCP — clean limits that create conversion pressure within first month | Enough to prove value (10 calls in 2-3 days for active user), not enough to solve their problem | Drives Free->Pro conversion naturally |
| 2026-02-27 | MCP is the Free/paid paywall, not Pro/Team wall — no demo cap, zero MCP on Free | Clean single-sentence gate; demo cap adds counter complexity without proportionate value | All MCP gating logic references this boundary |
| 2026-02-27 | Team tier at $79/month flat rate (not per-seat) for early adoption | Lowers buying friction for managers (can approve without finance); Head of Sales approves $79 vs $395 for 5-person per-seat | Per-seat pricing deferred to enterprise motion |
| 2026-02-27 | UpgradeGate component pattern: shared component wraps guarded features, checks tier, shows prompt | Keeps gating logic centralized; new limits added by wrapping feature not touching component | All Phase 14+ billing gating follows this pattern |
| 2026-02-27 | CallVault is MCP-first: stores/organizes calls, hands to user's existing AI via MCP | Avoids AI lock-in, reduces infra cost to near zero, differentiates from Gong category | All v2 AI decisions flow through this constraint |
| 2026-02-27 | Smart Import is the only in-app enrichment: auto-title, action items, tags, sentiment at import | Named feature, runs once at import, no AI label — "Calls arrive pre-organized" | AI-02 constraint: no RAG code in new repo ever |
| 2026-02-27 | Drop RAG pipeline, embeddings, vector search, Content Hub, Langfuse entirely | Per-call embedding cost drops to $0, codebase simplifies dramatically | pg_trgm keyword search replaces semantic search |
| 2026-02-27 | Marketing tagline locked: AI-ready not AI-powered | Honest claim, defensible, avoids competing on AI capability with Gong | "AI-powered" never appears positively in copy or UI |
| 2026-02-27 | Primary buyer locked: Heads of Sales / RevOps at B2B companies with 5-50 reps | Different messaging hierarchy, competitive set, and sales motion from solo rep persona | All copy and feature decisions reference this persona |
| 2026-02-27 | Competitive framing: Gong is the coach, CallVault is the film room and wiring | Different category, not diet Gong — avoids living inside Gong's category | Never frame as Gong without AI lock-in or Gong for Claude users |
| 2026-02-27 | One-liner: Close more deals from the calls you're already having | Outcome-led, references existing behavior, no AI claim | Locked for all v2 marketing |
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
| 2026-02-09 | Scoped search wraps existing function | Zero breaking changes for pre-migration data | hybrid_search_transcripts_scoped wraps hybrid_search_transcripts |
| 2026-02-09 | Per-tool vault membership verification | Analytical tools independently verify access | getCallDetails/getCallsList/compareCalls each check vault access |
| 2026-01-31 | 5-level vault role hierarchy | vault_owner > vault_admin > manager > member > guest | Granular access control within vaults |
| 2026-01-31 | VaultEntry enables same recording in multiple vaults | Recording lives in ONE bank, but can appear in many vaults with local context | vault_entries has local_tags, scores, notes per appearance |
| 2026-01-31 | legacy_recording_id for fathom_calls migration | BIGINT field tracks original fathom_calls.recording_id for migration | UNIQUE(bank_id, legacy_recording_id) prevents duplicates |
| 2026-02-09 | mapRecordingToMeeting adapter for TranscriptTable reuse | Vault recordings use Recording type; TranscriptTable expects Meeting | Zero changes to TranscriptTable, adapter maps all fields |
| 2026-02-09 | UUID recordingId passed to AddToVaultMenu | Vault recordings have UUID IDs, not just legacy numeric IDs | TranscriptTableRow now passes both recordingId and legacyRecordingId |
| 2026-02-09 | Vault recordings query invalidation on mutations | VaultDetailPane and AddToVaultMenu use different query keys | useVaultAssignment invalidates both vaultEntries and vaults.recordings |
| 2026-02-09 | Client-side search/filter for vault recordings | Recordings already loaded; no server roundtrips needed | 300ms debounced title search, sort by date/duration/title |
| 2026-02-09 | hasActiveFilters includes non-default sort | User can clear all filters including sort to reset view | Sort changes count as active filters |
| 2026-02-10 | Vault entry creation non-blocking in edge functions | Vault entry failures should never break import/sync | Pattern for all import edge functions |
| 2026-02-10 | sync-meetings also needs vault_id (not just zoom/google) | SyncTab calls sync-meetings, not zoom-sync-meetings | Identified and fixed during edge function updates |
| 2026-02-10 | Store business bank logos in banks.logo_url | Support logo upload without storage infrastructure for MVP | Bank creation persists branding assets |
| 2026-02-10 | Create business banks via RPC | RLS returning blocked insert + select during provisioning | Reliable business bank creation flow |
| 2026-02-10 | Workspace tabs use per-surface floating pill override | Needed horizontal pill active indicator in Workspaces & Hubs without changing shared tabs primitive globally | BanksTab suppresses default underline with local `TabsTrigger` active-state overrides |
| 2026-02-10 | Settings category rows use pill-first active emphasis | Vertical indicator should be the primary wayfinding signal, not stacked orange icon/text/arrow accents | SettingsCategoryPane active colors are neutralized while preserving keyboard/ARIA behavior |
| 2026-02-10 | HUB pane headers use icon-led stacked context layout | Prevent overlap/truncation in constrained pane widths while keeping workspace context legible | VaultListPane header now stacks workspace label/name/switcher with dedicated action row |
| 2026-02-10 | Brand tabs standardize on rounded pill active indicators | Current UI direction moved off clip-path tab markers; docs needed canonical guidance | Brand guidelines v4.2.1 now codify pill indicator direction and hardcoded-value policy |
| 2026-02-11 | Enforce YouTube create-type parity across Hubs and Settings | UAT gap showed stale hardcoded create options blocked self-serve YouTube vault creation | Both create entry points now expose YouTube with regression coverage on option and payload |
| 2026-02-11 | Propagate provider statuses from youtube-api and normalize transcript endpoint | UAT continuation showed youtube-import 500 remained non-actionable due downstream masking and deprecated transcript host | Import failures now expose concrete upstream causes (API_KEY_INVALID, transcript billing 402) for immediate config remediation |
| 2026-02-21 | Stateless createMcpHandler over McpAgent/DurableObjects for callvault-mcp Worker | Simpler Supabase JWT integration without OAuthProvider adapter; DO billing avoided | No session persistence across tool calls; acceptable for initial remote deployment |
| 2026-02-21 | Per-request Supabase client via global.headers.Authorization (not setSession) | Workers runtime lacks browser storage; setSession triggers those code paths | Clean per-request auth without storage side effects |
| 2026-02-21 | Cursor-based pagination (next_offset) instead of KV-backed session storage | Eliminates KV namespace infrastructure dependency for initial deployment | Clients pass offset param to callvault_execute for next page |
| 2026-02-21 | Public route with internal auth guard for /oauth/consent | Matches TeamJoin/VaultJoin pattern; consent page must be accessible unauthenticated to redirect to login first | No ProtectedRoute wrapper on /oauth/consent |
| 2026-02-21 | Cast supabase.auth as any for oauth methods | supabase-js type defs may not include OAuth 2.1 server beta API yet; avoids build errors while preserving runtime behavior | Pattern for beta Supabase APIs |
| 2026-02-21 | window.location.href for approve/deny redirect | Supabase redirect_to URLs are external MCP client callback URLs; React Router navigate() only handles internal routes | Required for correct OAuth redirect behavior |
| 2026-02-21 | Context threaded through private helpers (getTranscriptText, getSpeakerEmails) | Only way to eliminate all singleton usage including internal helpers in transcripts.ts | Complete singleton elimination across all 7 handler files |
| 2026-02-21 | @ts-expect-error on stdio executeOperation call during transitional migration | Keeps stdio build green without altering runtime behavior; Plan 03 removes the suppression | Safe multi-plan migration without breaking existing stdio server |
| 2026-02-21 | WebStandardStreamableHTTPServerTransport instead of createMcpHandler (agents/mcp) | createMcpHandler does not exist in agents package; WebStandardStreamableHTTPServerTransport is correct stateless approach | Per-request transport.handleRequest(request) returns Response |
| 2026-02-21 | Per-request McpServer factory (createMcpServer) closes over RequestContext | No shared state between requests; each request gets isolated server with user's supabase client | Stateless Worker architecture without Durable Objects |
| 2026-02-21 | auth.ts refactored to use globalThis for all Node.js APIs | Enables auth.ts to compile in Worker TypeScript context (no @types/node) | Dynamic import of auth.ts works without TS errors |
| 2026-02-21 | tsconfig.json excludes worker.ts and auth-middleware.ts | Worker files use ExecutionContext (Cloudflare-only); stdio build doesn't have @cloudflare/workers-types | Clean build separation for stdio vs Worker targets |
| 2026-02-21 | Worker deployed to naegele412.workers.dev (account subdomain) not callvault.workers.dev | wrangler uses {worker-name}.{account-subdomain}.workers.dev format | Actual URL is callvault-mcp.naegele412.workers.dev |
| 2026-02-21 | Unset CLOUDFLARE_API_TOKEN to deploy (env var lacked Workers write permission) | CLOUDFLARE_API_TOKEN set in environment had only read scope; OAuth token in ~/.wrangler/config/default.toml has workers:write | Use wrangler OAuth login not API token for deploy |

### Active TODOs

*No active todos. All 5 v1 pending todos eliminated during v2 pivot (2026-02-26). See `.planning/todos/eliminated/`.*

### Pending Todos

None.

### Known Blockers (carry to v2 backlog)

- ~~`YOUTUBE_DATA_API_KEY` invalid~~ — **FIXED 2026-02-26** (new key deployed to Supabase)
- ~~Transcript provider `402 no_active_paid_plan`~~ — **FIXED 2026-02-26** (credits replenished)
- Human verification of MCP end-to-end connectivity still pending (deferred to Phase 19)

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 001 | Update workspace hub tab indicator | 2026-02-10 | 5859a1c | [001-update-workspace-hub-tab-indicator](./quick/001-update-workspace-hub-tab-indicator-to-ho/) |
| 002 | Complete UI brand audit | 2026-02-10 | e819980 | [002-complete-ui-brand-audit](./quick/002-complete-ui-brand-audit-fix-hub-header-a/) |
| 003 | Run migration, fix Sync Hub naming, workspace scope | 2026-02-10 | dd5ba9a | [003-run-migration-fix-sync-hub-naming](./quick/003-run-migration-fix-sync-hub-naming-workspace-scope/) |

---

## Session Continuity

**Last session:** 2026-02-27T08:36:55.842Z
**Stopped at:** Completed 13-02-PLAN.md — pricing tiers + upgrade prompts
**Resume with:** `/gsd:execute-phase 13` (run Plan 13-03 next — Wave 2, Polar dashboard update with human checkpoint)

### Context for Next Session

**Phase 13 Wave 1 is complete. Plan 13-03 is the only remaining plan.**

3 plans, 2 waves:
- Wave 1: Plan 13-01 DONE (AI-STRATEGY.md + PRODUCT-IDENTITY.md) || Plan 13-02 DONE (PRICING-TIERS.md + UPGRADE-PROMPTS.md)
- Wave 2: Plan 13-03 (Polar dashboard update — has human checkpoint — requires user to be in Polar dashboard)

Key strategy documents now locked:
- AI-STRATEGY.md: MCP-first, Smart Import only, no RAG ever, "AI-ready not AI-powered"
- PRODUCT-IDENTITY.md: Primary buyer = Heads of Sales / RevOps at B2B companies with 5-50 reps
- PRICING-TIERS.md: Free/Pro/Team at $0/$29/$79 flat, 10 imports/1 workspace/no MCP on Free, Team = collaboration not limits
- UPGRADE-PROMPTS.md: Every in-context upgrade prompt designed with copy, trigger, behavior, developer notes

Plans create written artifacts only (no code).

Key reference points:
- Live MCP Worker: https://callvault-mcp.naegele412.workers.dev/mcp
- Supabase project: vltmrnjsubfzrgrtdqey.supabase.co
- Migration infrastructure already deployed: recordings table, migrate_fathom_call_to_recording(), get_unified_recordings RPC, migrate-recordings edge function
- MCP deploy: unset CLOUDFLARE_API_TOKEN, run wrangler deploy (uses OAuth token in ~/.wrangler/config)
- YouTube blockers (carry to v2 backlog): YOUTUBE_DATA_API_KEY invalid + transcript provider billing 402
- Google Meet: REMOVED in v2 entirely (FOUND-09)
- All v1 archives in `.planning/milestones/`
- v2.0 ROADMAP.md: `.planning/ROADMAP.md`

---

## Quick Stats

| Metric | Value |
|--------|-------|
| v1 Total Phases | 12 (+ inserted: 3.1, 3.2, 10.2, 10.3) |
| v1 Total Plans | 93 |
| v1 Requirements | 80 (70 complete, 1 Beta, 9 skipped/eliminated/deferred) |
| v2 Phases | 10 (Phases 13–22) |
| v2 Requirements | 70 (0 complete, 0 in-progress) |
| v2 Status | Roadmap created — ready for Phase 13 |
| Next Step | `/gsd-plan-phase 13` to begin Strategy + Pricing |

---

*State tracking initialized: 2026-01-27*
*Last updated: 2026-02-21 (v1 milestone archived; v2 not yet defined)*
