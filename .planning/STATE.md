# State: CallVault Launch Stabilization

**Last Updated:** 2026-01-29

## Project Reference

**Core Value:** Users can reliably ask questions across their entire call history and get accurate, cited answers every single time.

**Current Focus:** Phase 4 Team Collaboration (Phase 3.2 complete)

---

## Current Position

**Milestone:** v1 Launch Stabilization

**Phase:** 3.2 of 9 (Integration Import Controls)

**Plan:** 2 of 2 in current phase (Phase 3.2 Complete)

**Status:** Phase complete

**Last activity:** 2026-01-29 - Completed 03.2-02-PLAN.md (SourcesFilterPopover + SyncTab)

**Progress:**
```
[████████████████████░] 23/58 plans complete (40%)
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
| Phase 4: Team Collaboration | 2 | 0 | Pending |
| Phase 5: Coach Collaboration | 3 | 0 | Pending |
| Phase 6: Demo Polish | 12 | 0 | Pending |
| Phase 7: Code Health & Infrastructure | 13 | 0 | Pending |
| Phase 8: Differentiators | 5 | 0 | Pending |
| Phase 9: Growth | 5 | 0 | Pending |

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

- [ ] Plan and execute Phase 4: Team Collaboration

### Pending Todos

2 todos in `.planning/todos/pending/`:
- **Fix missing get_available_metadata database function** (database)
- **Make chat sources section collapsible** (ui)

### Roadmap Evolution

- Phase 3.1 inserted after Phase 3: Compact Integration UI (URGENT) - Redesign integration cards to compact button/icon format with reusable modal component
- Phase 3.2 inserted after Phase 3.1: Integration Import Controls - Redesign "Import meetings from" section + per-integration search on/off toggle

### Known Blockers

None

---

## Session Continuity

**Last session:** 2026-01-29
**Stopped at:** Completed 03.2-02-PLAN.md - SourcesFilterPopover + SyncTab (Phase 3.2 complete)
**Resume file:** None

### Context for Next Session

**Where we are:**
Phase 3.2 Integration Import Controls complete. All UI-INT-04, UI-INT-05, UI-INT-06 requirements met. Ready for Phase 4: Team Collaboration.

**What to remember:**
- SourcesFilterPopover component created in src/components/sync/
- SyncTab integrated with client-side filtering by source_platform
- Filter only shows when integrations are connected
- Filter state persists to database via useSyncSourceFilter hook
- Next: Plan and execute Phase 4: Team Collaboration

---

## Quick Stats

| Metric | Value |
|--------|-------|
| Total Phases | 9 (+ 2 inserted: 3.1, 3.2) |
| Total Requirements | 61 |
| Requirements Complete | 18 (30%) |
| Current Phase | 3.2 Complete - Ready for Phase 4 |
| Plans Complete | 2/2 in Phase 3.2 (23/58 overall) |
| Next Plan | Phase 4: Team Collaboration |
| Blockers | 0 |

---

*State tracking initialized: 2026-01-27*
*Last updated: 2026-01-29 (Completed 03.2-02-PLAN.md - SourcesFilterPopover + SyncTab - Phase 3.2 Complete)*
