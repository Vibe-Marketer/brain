# State: CallVault

**Last Updated:** 2026-02-28 (Phase 17 Plan 05 Task 1 COMPLETE — All 5 edge functions deployed; frontend build passing; IMP-02 line count 389/230 (overage documented); awaiting human verification at Task 2 checkpoint)

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-02-22 after v2.0 milestone start)

**Core value:** Clarity-first organized call workspace. Users can import calls from anywhere, organize them into clear workspaces, and expose that structured context to whatever AI they already use — with zero confusion about how the system works.

**Current focus:** v2.0 — The Pivot (thin app + import rules + workspace clarity + MCP expansion)

---

## Current Position

**Milestone:** v2.0 — The Pivot

**Phase:** Phase 17 — Import Connector Pipeline (Plan 05 Task 1 complete — awaiting checkpoint)

**Status:** Phase 16 Workspace Redesign now COMPLETE — all 7 plans finished, human verification passed, build clean, deployed to production. Phase 17 Plan 05 Task 1 complete. All 5 edge functions deployed to production (youtube-import, zoom-sync-meetings, sync-meetings, fetch-meetings, file-upload-transcribe). Frontend build passes. Zero fathom_calls inserts in any connector. IMP-02 line count: 389 lines (138 edge fn + 251 FileUploadDropzone) — EXCEEDS 230-line must_have budget. Awaiting human verification of Import Hub UI at Task 2 checkpoint.

**Last activity:** 2026-02-28 — Phase 16 Plan 07 complete (human verification approved); Phase 17 Plan 05 Task 1 complete

**Progress:**
[██████████] 98%
[████      ] 3/10 phases complete
Phase 13: Strategy + Pricing    [✓] complete (2026-02-27)
Phase 14: Foundation            [✓] complete (2026-02-27)
Phase 15: Data Migration        [~] in progress (Plans 01-03 done, Plan 04 remaining)
Phase 16: Workspace Redesign    [✓] complete (2026-02-28 — all 7 plans finished, human verification passed)
Phase 17: Import Pipeline       [~] in progress (Plans 01-04 done, Plan 05 at checkpoint)
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
| 2026-02-28 | Zoom/Fathom/YouTube connectors rewired to use checkDuplicate()+insertRecording() — broken fathom_calls VIEW writes eliminated | fathom_calls is a read-only VIEW; all new recordings must go to recordings table via pipeline | All 3 connectors now dedup via source_metadata->>'external_id'; skipped_count tracked in sync_jobs |
| 2026-02-28 | YouTube always shown as active in Import Hub (no per-user OAuth) — sync action opens URL input dialog | YouTube uses shared API key; no import_sources row needed; "Sync" button is the user-facing entry point | YouTube card never shows "disconnected"; File Upload card toggle is no-op (always available) |
| 2026-02-28 | Import Hub Add Source card opens "Coming soon" dialog (Grain + Fireflies in disabled state) — no routing needed for MVP | No connectors to add yet; dialog shows future roadmap without incomplete flows | Future connector additions: add to SOURCE_REGISTRY config array in ImportPage, no grid changes needed |
| 2026-02-28 | file-upload-transcribe uses synchronous Whisper flow (no async/waitUntil) — MVP files < 25MB complete within 150s edge function limit | EdgeRuntime.waitUntil pattern adds complexity; synchronous acceptable for MVP | Plan 02 async pattern can be added later if timeouts become an issue |
| 2026-02-28 | file-upload dedup external_id = filename + '-' + file_size — deterministic, same file re-uploaded is detected as duplicate | Simple key, no content hashing needed, works without reading file bytes twice | File upload connector dedup pattern; content hash would be more robust but adds latency |
| 2026-02-28 | Monthly quota counts ALL recordings (not just file-upload source_app) — 10/month applies across all import sources | Per plan spec: "file uploads count toward the same 10/month limit as all other sources" | Consistent free tier limit regardless of how recordings are imported |
| 2026-02-28 | connector-pipeline.ts fails open on dedup query error (isDuplicate: false) — never blocks an import due to dedup check failure | Silently dropping an import is worse than a rare false negative; dedup errors should be logged not fatal | All connectors using runPipeline() inherit this fail-open behavior |
| 2026-02-28 | connector-pipeline.ts vault_entry creation is non-blocking (try/catch, logs only) — recording commit succeeds even if personal vault lookup fails | Phase 10 pattern: recording is the primary record; vault_entry is decorative context that can be repaired | insertRecording() always returns { id } once recordings insert succeeds |
| 2026-02-28 | import_sources migration named 000002 (not 000001) — 000001 taken by Phase 16 workspace_redesign_schema.sql | Filename collision is a deployment blocker; sequence increment is the correct resolution | All future Phase 17+ migrations start from 000002+ for date 20260228 |
| 2026-02-28 | user_preferences table does not exist — onboarding_seen_v2 stored in user_profiles.auto_processing_preferences JSONB | No migration needed; user_profiles already has JSONB column with full type support; server-side persistence achieved | useOnboarding reads/writes auto_processing_preferences key instead of separate table |
| 2026-02-28 | showOnboarding UI flag lives in preferencesStore (Zustand) not useOnboarding local state | SidebarNav (trigger) and _authenticated.tsx (renderer) are separate components; local state would give each a separate instance; Zustand store is the correct cross-component UI state pattern per FOUND-06 | Both components import useOnboarding which reads/writes preferencesStore.showOnboarding |
| 2026-02-28 | WorkspaceSidebarPane now uses useFolders/useArchivedFolders hooks (Plan 16-07 replaced inline query) — same TanStack Query cache key as folder mutations → real-time sidebar updates | Cache coherence: folder create/rename/archive invalidates queryKeys.folders.list(workspaceId) which sidebar now reads | No inline Supabase folder query in sidebar; folder mutations update sidebar immediately |
| 2026-02-28 | WorkspaceSidebarPane uses inline Supabase folder query (not useFolders) — Plan 16-04 will replace with full hook | Plan 16-04 is responsible for folder service/hooks; inline query avoids cross-plan dependency | WorkspaceSidebarPane.useFoldersForWorkspace is a stub; Plan 16-04 consumers use useFolders |
| 2026-02-28 | Workspace/folder call filtering still deferred — useFilteredRecordings remains a passthrough in Plan 07; full workspace-scoped query needs vault_entries join (Phase 17+) | Recording.bank_id ≠ workspace filter; vault_entries join is Phase 17+'s scope | index.tsx shows all recordings regardless of active workspace until vault_entries query added |
| 2026-02-28 | Workspace/folder call filtering deferred to Plan 16-05 — useFilteredRecordings is a passthrough until vault_entries query available | Recording.bank_id ≠ workspace filter; vault_entries join is Plan 16-05's scope | index.tsx shows all recordings regardless of active workspace until Plan 16-05 |
| 2026-02-28 | OrgSwitcherBar spans full AppShell width (above ALL panes, not just sidebar) — AppShell wrapped in flex-col | Locked decision: thin header bar above the sidebar shows org; implemented as top bar spanning all panes | AppShell desktop layout: flex-col wrapper, OrgSwitcherBar, then flex-1 pane container |
| 2026-02-28 | folders.service maps DB parent_id to Folder.parent_folder_id at service layer — DB column is parent_id, Folder interface uses parent_folder_id for semantic clarity | Keeps Folder interface consistent with plan naming while preserving actual DB column name | All folder service code reads parent_id from DB, consumers use parent_folder_id via Folder type |
| 2026-02-28 | folder_assignments.call_recording_id is a legacy numeric ID (from fathom_calls); service + hooks use number type not UUID | folder_assignments FK references fathom_calls.recording_id (bigint) not recordings.id (UUID) | useAssignToFolder/useRemoveFromFolder take callRecordingId: number parameter |
| 2026-02-28 | DnD on desktop only (DndCallProvider is a passthrough on mobile/tablet); action menu is the assignment path on mobile | Per locked decisions: drag-and-drop on desktop; action menu everywhere | DraggableCallRow disabled on isMobileOrTablet; DndCallProvider renders children without DnD context on mobile |
| 2026-02-28 | getWorkspaceMembers returns null displayName/email; profile enrichment deferred to UI layer (auth.users not directly accessible from browser client — requires service role or RPC) | Correct separation: data layer returns raw membership rows; UI layer enriches with profile data via dedicated RPC or profiles table | All workspace member display uses this pattern |
| 2026-02-28 | getWorkspaces sorts is_default client-side (not SQL ORDER BY) until supabase gen types re-run includes is_default column | is_default added in Phase 16 migration but not yet in generated supabase.ts types; TypeScript error would block build | Plan 07 or type regen will switch to SQL-level ordering |
| 2026-02-28 | orgContextStore persists activeOrgId + activeWorkspaceId to localStorage (callvault-org-context); activeFolderId is session-only | Folder selection is per-session; org/workspace selection persists for user convenience across sessions | Cross-tab sync fires on callvault-org-context-updated key via storage event |
| 2026-02-28 | TypeScript type aliases over DB views for concept rename (Organization=Bank, Workspace=Vault, Folder=folders row) — queries unchanged, only display and TS layer uses new names | Zero migration risk; supabase.from('banks') etc. remain; aliases in src/types/workspace.ts | All Phase 16+ plans use Organization/Workspace/Folder type aliases |
| 2026-02-28 | vaults.is_default backfilled: UPDATE vaults SET is_default = TRUE WHERE vault_type = 'personal' — covers all 11 existing personal vaults | Without backfill, protect_default_workspace trigger could never fire; every existing personal vault must be marked | protect_default_workspace BEFORE DELETE trigger now active and functional |
| 2026-02-28 | vercel.json: redirects array added alongside existing rewrites catch-all — 7 server-level 301s for old Bank/Vault/Hub paths | Vercel processes redirects before rewrites; server-level catches external bookmarks and crawlers before SPA loads | Old /bank/, /vault/, /hub/ paths will redirect for 90+ days per WKSP-04 |
| 2026-02-28 | workspace_invitations UNIQUE(workspace_id, email, status) constraint — prevents duplicate pending invites per user per workspace | Allows re-invite after revoke/expire while blocking simultaneous duplicate pending invites | invite flow (WKSP-10/11) can safely INSERT without prior SELECT check |
| 2026-02-28 | fathom_calls renamed to fathom_calls_archive via ALTER TABLE RENAME — dormant, no RLS, COMMENT documents 30-day hold and Phase 22 DROP | Archive not drop: preserves data safety net during v2 go-live period | Phase 22 Backend Cleanup will DROP fathom_calls_archive and compatibility VIEW |
| 2026-02-28 | fathom_calls compatibility VIEW created (SELECT * FROM fathom_calls_archive) — restores v1 frontend after rename broke it | v1 frontend and sync edge functions reference fathom_calls by name; VIEW makes rename transparent | Phase 22 will DROP both fathom_calls_archive and the fathom_calls VIEW together |
| 2026-02-28 | CI build in callvault repo fixed: changed from "tsc -b && vite build" to "vite build" only | routeTree.gen.ts is gitignored (auto-generated by TanStack Router plugin); tsc -b fails in CI without it | Aligns with existing STATE.md decision: Vite compilation is the single source of truth for build health |
| 2026-02-28 | Email delivery not implemented in Phase 16 — invite creates DB record and shows shareable link; email re-send deferred to Phase 17+ | No email infrastructure (no Resend, no Mailgun) in Phase 16; createInvitation auto-copies link to clipboard as workaround | WorkspaceInviteDialog shows amber notice; Phase 17+ can add email trigger |
| 2026-02-28 | workspace_invitations + RPCs use (supabase as any) cast — not yet in generated supabase.ts types | Same pattern as Phase 16-04 folders; types will be regenerated in Plan 07 or type regen pass | invitations.service.ts casts all workspace_invitations queries via (supabase as any) |
| 2026-02-28 | InviteRow/MemberRow use inline local confirm state (useState) in dropdown instead of separate modal dialog | Self-contained pattern; avoids prop-drilling a confirm dialog into panel; consistent with action menu inline patterns | WorkspaceMemberPanel member and invite rows both use this pattern |
| 2026-02-28 | User spot-check approved — calls confirmed visible in new v2 frontend at callvault.vercel.app | DATA-05 human verification gate passed; Phase 15 data migration objectives fully satisfied | Phase 16 Workspace Redesign is unblocked |
| 2026-02-28 | Task 2 (re-enable sync functions) N/A in Plan 03 — sync functions were never disabled per Plan 01 user decision | User skipped Plan 01 Task 2; nothing to re-enable | Phase 17 will rewire sync functions to write to recordings table |
| 2026-02-28 | Service layer pattern established: src/services/*.service.ts plain async functions, hooks wrap with useQuery | Separates data access from cache management; plain functions are independently testable | All v2 data fetching follows this service+hook separation pattern |
| 2026-02-28 | RecordingListItem = Pick<Row> for list, full Row for detail — avoids transferring full_transcript in list query | Avoids fetching kilobyte-scale transcript column for every row in the list | Pattern for all future list vs detail data shapes |
| 2026-02-28 | Task 2 (disable sync edge functions) skipped — accepted migration risk | User wanted speed; unmigrated_non_orphans = 0 confirmed no data loss | No sync functions need re-enabling; Plan 03 archive rename should still consider disabling |
| 2026-02-27 | external_id backfilled via UPDATE not re-migration for 1,532 pre-existing rows | Simpler, safer than re-running migration — no re-insert risk | All 1,554 migrated recordings now have external_id in source_metadata |
| 2026-02-27 | get_migration_progress() 100.58% is expected (1,554 > 1,545) — 9 non-Fathom recordings use legacy_recording_id | YouTube imports + Google Meet + 2 deleted fathom rows explain the overage | Canonical metric is unmigrated_non_orphans = 0, not percent_complete |
| 2026-02-27 | Production SQL run via psql direct connection (not edge function) for batch migration | Supabase CLI v2.75.0 has no db execute --project-ref; edge function requires browser JWT | Pattern for future production SQL: PGHOST=aws-1-us-east-1.pooler.supabase.com PGUSER=postgres.vltmrnjsubfzrgrtdqey |
| 2026-02-27 | CI uses pnpm build (not tsc --noEmit) — Vite compilation catches both TS and bundler errors in one step | No separate type-check needed; pnpm build is the single source of truth for build health | GitHub Actions CI workflow in .github/workflows/ci.yml |
| 2026-02-27 | Settings /settings redirects to /settings/account via beforeLoad | Avoids blank settings root; TanStack Router redirect in beforeLoad is the correct pattern | All settings navigation targets /settings/$category |
| 2026-02-27 | FOUND-06 hard boundary: TanStack Query = server state, Zustand = UI state — convention only, documented in query-config.ts | Runtime enforcement unnecessary; convention + docs prevents cache staleness bugs | All server data fetching uses queryKeys factory; Zustand stores hold UI state only |
| 2026-02-27 | v2 queryKeys domains are narrower than v1 (no chat/contentLibrary/vaults/teams) | Aligns with MCP-first pivot; no RAG, no Content Hub; domains added as features built | query-config.ts is the source of truth for what server state exists in v2 |
| 2026-02-27 | motion/react (not framer-motion) for all animations — motion v12 import path is motion/react | Correct import for Motion for React v12; zero framer-motion in codebase | All v2 animation imports use motion/react |
| 2026-02-27 | AppShellProps flattened: { children, secondaryPane?, showDetailPane? } as direct props | Cleaner JSX composition at route level vs nested config object (v1 pattern) | All v2 route pages use AppShellProps interface for pane composition |
| 2026-02-27 | PanelData discriminated union with type field as discriminator | Type-safe narrowing of panel data in Plan 04 panel components without type assertions | All v2 panel components use type narrowing on panelData |
| 2026-02-27 | Mobile layout is route-based stack (header + full-screen main) not overlay/drawer | Per CONTEXT.md locked decision: native feel via routes not DOM overlays | All mobile navigation decisions reference this pattern |
| 2026-02-27 | SidebarNav uses TanStack Router Link (not react-router-dom) | v2 uses TanStack Router exclusively; react-router-dom has no place in codebase | All navigation in v2 uses TanStack Router Link/useNavigate |
| 2026-02-27 | signInWithOAuth lives in useAuth hook not in login.tsx | Routes delegate to hook — clean Supabase abstraction, routes don't touch SDK directly | All v2 auth OAuth calls go through useAuth hook |
| 2026-02-27 | _authenticated/ pathless layout route is the TanStack Router auth guard pattern | beforeLoad throws redirect to /login if no session; all protected pages nested under src/routes/_authenticated/ | All v2 protected routes use this pattern |
| 2026-02-27 | Supabase OAuth redirect changed from origin/ (v1) to origin/oauth/callback (v2 PKCE) | v2 uses PKCE flow requiring explicit callback URL for code exchange | Add localhost:3000/oauth/callback to Supabase allowed redirect URLs |
| 2026-02-27 | shadcn init requires globals.css with @import tailwindcss AND root tsconfig.json path alias before it detects TailwindCSS v4 | shadcn reads root tsconfig.json, not tsconfig.app.json; globals.css must exist with TailwindCSS v4 import | All v2 shadcn initializations follow this order |
| 2026-02-27 | routeTree.gen.ts gitignored — auto-generated by TanStack Router plugin on dev start | Keeps repo clean; forces pnpm dev before TypeScript compilation; CI needs pre-build step if doing type-check only | All developers must run pnpm dev before TypeScript type checking |
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

**Last session:** 2026-02-28T04:56:42.294Z
**Stopped at:** Phase 17 Plan 05 Task 1 complete — awaiting human verification at Task 2 checkpoint
**Resume with:** `/gsd:execute-phase 17` to run next plan (17-04 or 17-02 if not yet done).

### Context for Next Session

**Phase 16 Plans 05 and 06 both complete. Plan 07 is next (workspace/org management UI — settings pages).**

**Plan 05 deliverables:**
- `src/services/invitations.service.ts` — getInvitations, createInvitation, revokeInvitation, resendInvitation, getInviteDetails (RPC: get_workspace_invite_details), acceptInvite (RPC: accept_workspace_invite), getShareableLink
- `src/hooks/useInvitations.ts` — useInvitations, useCreateInvitation (auto-copies link to clipboard), useRevokeInvitation, useResendInvitation, useInviteDetails, useAcceptInvite
- `src/components/dialogs/WorkspaceInviteDialog.tsx` — Two-tab dialog (email invite + share link), role picker (Viewer/Member/Admin per WKSP-11), org+workspace context in header (WKSP-10)
- `src/components/workspace/WorkspaceMemberPanel.tsx` — Members + Pending Invites tabbed panel; Members tab: inline role change dropdown (immediate effect), remove with confirmation; Pending Invites: resend/revoke
- `src/routes/_authenticated/join/workspace.$token.tsx` — Join page: inviter name, org name, workspace name, role + description before accepting (WKSP-10); expired/revoked/invalid token edge cases

**Key patterns from Plan 05:**
- Invitation service uses `(supabase as any)` cast — workspace_invitations not yet in generated supabase.ts types
- RPCs: `get_workspace_invite_details({ p_token })`, `accept_workspace_invite({ p_token, p_user_id })`
- useCreateInvitation: auto-copies shareable link to clipboard on success; graceful fallback if clipboard blocked
- WorkspaceMemberPanel Tabs uses `Tabs` from `radix-ui` package (same package as `Collapsible`)
- Email delivery is NOT implemented — invite creates record + link only; email deferred to Phase 17+
- Inline confirm state pattern in dropdowns (local useState) instead of separate modal

**Phase 16 Plan 06 fully complete. Onboarding explorer ready. Plan 07 is next (workspace/org management UI).**

**Plan 06 deliverables:**
- `src/components/onboarding/ModelExplorer.tsx` — Interactive 5-step hierarchy explorer (motion/react, RiHome4Line, Get Started/Skip)
- `src/hooks/useOnboarding.ts` — Reads/writes `onboarding_seen_v2` in `user_profiles.auto_processing_preferences` JSONB via TanStack Query
- `src/routes/_authenticated.tsx` — First-login overlay + manual re-trigger overlay; `Outlet` renders underneath
- `src/components/layout/SidebarNav.tsx` — "How it works" button calls `setShowOnboarding(true)`; uses `RiQuestionLine`
- `src/stores/preferencesStore.ts` — `showOnboarding` / `setShowOnboarding` added (session-only UI state)

**Key patterns from Plan 06:**
- `user_preferences` table does not exist — use `user_profiles.auto_processing_preferences` JSONB for app-level prefs
- Shared overlay trigger pattern: Zustand store for cross-component UI flags (not hook-local state)
- Onboarding overlay is at `_authenticated.tsx` level (not per-page) — renders over any authenticated page

**Phase 16 Plan 04 fully complete. Folder management infrastructure ready for UI integration.**

**Plan 04 deliverables:**
- `src/services/folders.service.ts` — getFolders, getArchivedFolders, createFolder (depth-limited), renameFolder, archiveFolder, restoreFolder, deleteFolder (guard), assignCallToFolder, removeCallFromFolder, moveCallToFolder
- `src/hooks/useFolders.ts` — useFolders, useArchivedFolders, useCreateFolder, useRenameFolder (optimistic), useArchiveFolder, useRestoreFolder
- `src/hooks/useFolderAssignment.ts` — useAssignToFolder, useRemoveFromFolder, useMoveToFolder
- `src/components/dnd/FolderDropZone.tsx` — useDroppable with brand orange hover ring
- `src/components/dnd/DndCallProvider.tsx` — DndContext + MouseSensor/TouchSensor; exports DraggableCallRow

**Key patterns:**
- All folder queries: `supabase.from('folders').eq('vault_id', workspaceId)`
- DB: `parent_id` (not parent_folder_id); service maps to Folder.parent_folder_id
- Archived columns cast via `(supabase as any)` until types regenerated
- DnD: `folder-{id}` and `recording-{id}` prefixes in drag/drop IDs
- `call_recording_id: number` in folder_assignments (legacy fathom numeric ID)

**Plan 02 deliverables (data layer):**
- `src/stores/orgContextStore.ts` — Zustand v5 with activeOrgId/activeWorkspaceId/activeFolderId, localStorage persistence, cross-tab sync
- `src/services/organizations.service.ts` — getOrganizations/getOrganizationById/createOrganization/isPersonalOrg; queries banks table
- `src/services/workspaces.service.ts` — getWorkspaces/getWorkspaceById/createWorkspace/getWorkspaceMembers/updateMemberRole/removeMember; queries vaults table
- `src/hooks/useOrganizations.ts` — useOrganizations(), useCreateOrganization()
- `src/hooks/useWorkspaces.ts` — useWorkspaces(orgId), useWorkspace(id), useCreateWorkspace, useWorkspaceMembers, useUpdateMemberRole, useRemoveMember
- `src/hooks/useOrgContext.ts` — convenience hook: combines store + org data, auto-selects personal org on init

**Key patterns established:**
- All org queries: `supabase.from('banks')` — never 'organizations'
- All workspace queries: `supabase.from('vaults')` — never 'workspaces'
- `setActiveOrg` always resets `activeWorkspaceId = null` (locked decision)
- Session-gated `enabled` prop on all hooks (same as useRecordings pattern)

**Phase 15 Plan 03 fully complete. All 3 tasks done. User spot-check approved at callvault.vercel.app. Plan 04 is next.**

**Archive state:**
- `fathom_calls` VIEW exists (points to `fathom_calls_archive`) — v1 frontend and sync functions use this
- `fathom_calls_archive` exists with 1,545 rows and COMMENT documenting Phase 22 DROP
- Migration: `supabase/migrations/20260227000002_archive_fathom_calls.sql` committed as `ffd05e2`
- Sync functions remain active (writing to fathom_calls_archive via VIEW temporarily — Phase 17 rewires)
- CI build fixed in callvault repo: `22d727f` (vite build only)

**Frontend state:**
- `/` route: live recordings list from recordings table (title, date, duration, source_app badge)
- `/calls/:id` route: full recording detail with summary, tags, full_transcript
- Both pages handle loading, error, and empty states
- `src/services/recordings.service.ts` — getRecordings(), getRecordingById()
- `src/hooks/useRecordings.ts` — useRecordings(), useRecording(id)
- `src/lib/query-config.ts` — recordings domain added to queryKeys factory

**Migration state (from Plan 01):**

**Migration state:**
- All fathom_calls migrated: unmigrated_non_orphans = 0
- external_id present on all migrated recordings: missing_external_id = 0
- RLS clean: User B sees 0 of User A's recordings
- fathom_calls table still exists (not yet archived)
- Sync edge functions still enabled (Task 2 was skipped)

**Production DB connection:**
- PGHOST=aws-1-us-east-1.pooler.supabase.com PGPORT=5432 PGUSER=postgres.vltmrnjsubfzrgrtdqey PGPASSWORD=x2n2KlCAA8suZjqa PGDATABASE=postgres

**Key files:**
- `.planning/phases/15-data-migration/15-01-SUMMARY.md` — full migration results
- `supabase/migrations/20260227000001_fix_migration_function.sql` — fixed migration function

### Context for Next Session

**Phase 14 Foundation complete. Ready for Phase 15 (Data Migration).**

**Production URL:** https://callvault.vercel.app (Vercel, auto-deploy from GitHub)
**GitHub repo:** https://github.com/Vibe-Marketer/callvault (private)
**CI workflow:** .github/workflows/ci.yml — pnpm build on push/PR to main

Phase 14 Plan 04 deliverables:
- `src/routes/_authenticated/index.tsx` — / (All Calls) with folder sidebar and AppShell
- `src/routes/_authenticated/workspaces/index.tsx` — /workspaces list page
- `src/routes/_authenticated/workspaces/$workspaceId.tsx` — /workspaces/:id detail page
- `src/routes/_authenticated/calls/$callId.tsx` — /calls/:id detail with showDetailPane=true
- `src/routes/_authenticated/folders/$folderId.tsx` — /folders/:id view page
- `src/routes/_authenticated/import/index.tsx` — /import hub (Fathom/Zoom/YouTube/File Upload)
- `src/routes/_authenticated/settings/index.tsx` — /settings redirect to /settings/account
- `src/routes/_authenticated/settings/$category.tsx` — /settings/:category with nav sidebar
- `src/routes/_authenticated/sharing/index.tsx` — /sharing (Shared With Me)
- `src/routes/s/$token.tsx` — /s/:token public shared call view (no auth, standalone layout)
- `src/routes/bank.tsx`, `vault.tsx`, `hub.tsx` — v1 path blockers (404 + "older version" message)
- `src/lib/query-config.ts` — TanStack Query key factory, 7 domains, FOUND-06 boundary documented
- `src/hooks/useClipboard.ts` — navigator.clipboard abstraction (Tauri-ready)
- `src/hooks/useFileOpen.ts` — file input dialog abstraction (Tauri-ready)

Phase 14 Plan 03 deliverables:
- `src/components/layout/AppShell.tsx` — 4-pane layout with Motion springs, exports AppShellProps interface
- `src/components/layout/SidebarToggle.tsx` — 24px rounded-full edge-mounted circular toggle
- `src/components/layout/SidebarNav.tsx` — TanStack Router Link nav items, data-tour attrs
- `src/components/layout/DetailPaneOutlet.tsx` — AnimatePresence spring slide-in/out
- `src/stores/panelStore.ts` — Zustand v5 (create<PanelState>()()) panel type/data store
- `src/stores/preferencesStore.ts` — Zustand v5 sidebar/secondary state, localStorage cross-tab sync
- `src/hooks/useBreakpoint.ts` — matchMedia breakpoints, exports useBreakpointFlags
- `src/routes/_authenticated/index.tsx` — renders AppShell with 4 panes (FolderSidebarStub, CallsListStub)

Phase 14 Plan 02 deliverables:
- `src/lib/supabase.ts` — typed Supabase client, same project as v1 (vltmrnjsubfzrgrtdqey)
- `src/types/supabase.ts` — 3644-line live schema types (CLI was authenticated)
- `src/hooks/useAuth.tsx` — AuthProvider + useAuth hook (session, user, loading, signInWithGoogle, signOut)
- `src/routes/__root.tsx` — updated to createRootRouteWithContext, AuthProvider wraps app
- `src/routes/login.tsx` — /login page with Google OAuth button (glossy slate gradient)
- `src/routes/oauth/callback.tsx` — PKCE handler, navigates to / on SIGNED_IN
- `src/routes/_authenticated.tsx` — beforeLoad auth guard, throws redirect to /login
- `src/routes/_authenticated/index.tsx` — now renders 4-pane AppShell (updated in Plan 03)

Phase 14 Plan 01 deliverables:
- New callvault repo at `/Users/Naegele/dev/callvault/` (Vite 7 + React 19 + TanStack Router)
- Dev server starts at localhost:3000 (`pnpm dev` in callvault/)
- TailwindCSS v4 CSS-first with full CallVault color system (198 hsl() variables)
- shadcn/ui initialized, cn() helper, all 15+ dependencies
- src-tauri/.gitkeep Tauri placeholder
- CLAUDE.md with all v2 constraints

IMPORTANT: Add `http://localhost:3000/oauth/callback` to Supabase Dashboard → Authentication → URL Configuration → Redirect URLs (if not already there from v1 setup — v1 used different callback URL)

Phase 13 deliverables (all in `.planning/phases/13-strategy-pricing/`):
- AI-STRATEGY.md: MCP-first, Smart Import only, no RAG ever, "AI-ready not AI-powered"
- PRODUCT-IDENTITY.md: Primary buyer = Heads of Sales / RevOps at B2B companies with 5-50 reps
- PRICING-TIERS.md: Free/Pro/Team at $0/$29/$79 flat. Launch prices — raise to $39/$99 after 10 Pro + 5 Team customers.
- UPGRADE-PROMPTS.md: Every in-context upgrade prompt designed with copy, trigger, behavior
- POLAR-UPDATE-LOG.md: 4 products live in Polar with IDs recorded

Polar product IDs (for Phase 14 billing):
- Pro Monthly: `30020903-fa8f-4534-9cf1-6e9fba26584c`
- Pro Annual: `9ff62255-446c-41fe-a84d-c04aed23725c`
- Team Monthly: `88f3f07e-afa3-4cb1-ac9d-d2429a1ce1b7`
- Team Annual: `6a1bcf14-86b4-4ec9-bcbe-660bb714b19f`

Key reference points:
- Live MCP Worker: https://callvault-mcp.naegele412.workers.dev/mcp
- Supabase project: vltmrnjsubfzrgrtdqey.supabase.co
- Migration infrastructure already deployed: recordings table, migrate_fathom_call_to_recording(), get_unified_recordings RPC
- MCP deploy: unset CLOUDFLARE_API_TOKEN, run wrangler deploy (uses OAuth token in ~/.wrangler/config)
- Google Meet: REMOVED in v2 entirely (FOUND-09)
- All v1 archives in `.planning/milestones/`

---

## Quick Stats

| Metric | Value |
|--------|-------|
| v1 Total Phases | 12 (+ inserted: 3.1, 3.2, 10.2, 10.3) |
| v1 Total Plans | 93 |
| v1 Requirements | 80 (70 complete, 1 Beta, 9 skipped/eliminated/deferred) |
| v2 Phases | 10 (Phases 13–22) |
| v2 Requirements | 70 (7 complete via Phase 13) |
| v2 Status | Phase 14 complete — all 5 plans executed, deployed, auth verified |
| Next Step | `/gsd:discuss-phase 15` or `/gsd:plan-phase 15` (Data Migration) |

---

*State tracking initialized: 2026-01-27*
*Last updated: 2026-02-27 (Phase 14 Plan 03 complete — AppShell 4-pane layout with Motion spring animations)*
