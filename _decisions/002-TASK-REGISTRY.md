# Brain / CallVault — Complete Task Registry

> Generated: 2026-03-10 | Covers: Mar 05–09, 2026

---

## MAR 09 ISSUES (Last 24hrs)

### Features

| # | Issue | Description |
|---|-------|-------------|
| #95 | Add/Remove Call to Workspace | Users can add or remove calls from workspaces |
| #96 | Org Member Invitation & Management UI | Invite dialog, role management, remove members, auto-create default workspace membership |
| #98 | Cross-Org Call Copy with Keep/Delete Preference | "Send to Organization" dialog; store user preference in user_profiles |
| #99 | Cross-Org Routing Rules | Extend routing rules to route calls to different org workspaces via copy mechanism |
| #100 | HOME Workspace Enforcement | "All Calls" shows all accessible recordings; org admin sees all; block removal from HOME |
| #106 | Unified Skeuomorphic Button System | Audit all buttons app-wide; consistent variants; fix dialog cancels; fix sizing |
| #110 | Global Search — Cross-Entity & Full-Text | global_search() RPC; workspace/org scoping; tag/folder/date filters; ILIKE escape; edge function endpoint; group by entity type |
| #111 | Participant/Attendee Tracking & Call Counts | New call_participants table; participant_count denormalized on recordings; RPCs for people summary + filter |
| #121 | Differentiate Users Tab vs Admin Tab | Rewrite UsersTab (team members only); admin role gate on AdminTab; rename "Users" → "People"; eliminate N+1 |
| #135 | Debug Panel — Better Issue Detection | Severity classification; root cause grouping; suggested fixes; N+1 detection; copy-as-GitHub-issue; detect schema/type/RLS mismatches |
| #147 | Add "Trim All After This" Transcript Option | Right-click → trim all segments after selected point |
| #148 | Split Call Recording at Timestamp | Right-click transcript segment → split into Part 1 / Part 2; regenerate summaries for each |
| #149 | Auto-Naming & Auto-Tagging Restoration | Wire generate-ai-titles + auto-tag-calls edge functions into import pipeline; user preference toggles (default: off) |
| #154 | YouTube Transcript Display — Formatting & Timestamps | Parse into sentences/paragraphs; show timestamps; match Fathom/Zoom format; detect YouTube format; lazy fallback |
| #155 | Auto-AI-Naming with Gemini 2.5 Flash | Switch to google/gemini-2.5-flash-lite; full 8-step Lead Strategic Analyst prompt; settings toggle (default: on); track usage |
| #156 | AI Credits System + Polar.sh Pricing Tiers | Free ($0/25 actions), Pro ($29/1000), Team ($79/5000); 14-day Pro trial; usage enforcement with upgrade CTAs |
| #158 | YouTube Integration — Full Metrics Storage | Store views, likes, subscriber count, duration, tags, definition in source_metadata; fetch channel details; display in UI |

### Fixes

| # | Issue | Description |
|---|-------|-------------|
| #97 | Permission Enforcement & RLS Verification | Audit RLS on 11 sensitive tables; verify org admin vs member scoping; cascade removal behavior; self-removal with TOCTOU protection |
| #107 | Rename Hub/Vault/Bank Code Identifiers | Hub→Workspace, Vault→Workspace, Bank→Organization in 12 files — DO NOT rename DB tables/columns |
| #108 | Fix Missing Duration, Speakers, Invitees | Backfill duration from timestamps; fix fathom_calls view missing canonical_recording_id; null out 2 corrupt rows |
| #117 | Copy to Org — Empty Dropdown & Hub Text | Fix getOrganizations filtering null rows; add inline "Create Organization" option; rename HubCard→WorkspaceCard etc. |
| #118 | Rename Legacy DB Constraints & Indexes | Rename 32 constraints + 41 indexes from bank_*/vault_* to organization_*/workspace_*; reload PostgREST schema cache |
| #123 | Fix RLS Policies — Remove fathom_raw_calls Refs | Update 8 RLS policies to join via recordings table instead of fathom_raw_calls |
| #124 | Fix DB Functions — Remove fathom_calls Refs | Update 6 functions: apply_tag_rules, get_available_metadata, get_calls_shared_with_me_v2, get_unindexed_recording_ids, backfill_transcript_segments |
| #125 | call_tag_assignments UUID Migration | Migrate call_tag_assignments, call_speakers, transcript_tag_assignments from BIGINT → UUID; add canonical_recording_id |
| #129 | [Unclear from files] | — |
| #130 | COPY Button Non-Functional | Wire to CopyToOrganizationDialog; always visible; fix service layer RPC call signature |
| #133 | Fix UUID Migration — Column Rename in Frontend | Update 10 frontend files from call_recording_id → recording_id; remove parseInt() calls; update Supabase types |
| #134 | Remove personal_folders Queries | Stub getPersonalFolders/getPersonalFolderAssignments to return empty; stop 404s on page load |
| #139 | Call Detail Missing Data | Fix missing transcripts (UUID fallback), speakers (call_participants query), tags (UUID ID mismatch); add canonical_uuid to Meeting type |
| #140 | Fix Invitee Display for Impromptu Calls | Show "Ad-hoc call" badge when no calendar invitees; fall back to transcript speakers; rename heading to "Participants" |
| #141 | Remove "Fathom Share Link" Warning | Only warn for genuinely impactful missing data; remove internal field names from user-facing text |
| #146 | Performance — Server-Side Pagination & Caching | Eliminate client-side pagination on ALL CALLS; add staleTime/gcTime; reduce payload; lazy transcript fallback |

---

## MAR 08 ISSUES (24-48hrs ago)

### Features

| # | Issue | Description |
|---|-------|-------------|
| #54 | Copy/Move Recordings Between Workspaces | move/copy RPCs; MoveToWorkspaceDialog; service methods; mutation hooks; context menu + bulk action bar integration |
| #55 | Org Member Management Panel | OrganizationMemberPanel; service methods; cascading remove; role constraints (owner transfer, last-owner guard) |
| #57 | Recording Deletion Cascade | delete_recording SECURITY DEFINER RPC; verify owner/org admin; cascade all workspace_entries |
| #58 | Cross-Org Copy RPC + Default Workspace Auto-Entry Trigger | copy_recording_to_organization RPC; copy all fields + transcript_chunks; default workspace trigger on INSERT |
| #63 | Bulk Apply Routing Rules | Edge function apply-routing-rules with dry-run preview; "Apply to existing" button + preview dialog; batch processing |
| #91 | Port Antigravity Features | not_equals/not_contains operators; RoutingRulePanel; /rules route + nav; drag-drop for folders; ParticipantsFilterPopover + TagFilterPopover search inputs; RoutingRulesPage |

### Fixes / Security

| # | Issue | Description |
|---|-------|-------------|
| #51 | Org/Workspace/Sharing Audit | Full audit: new user onboarding, legacy backfill, terminology consistency, UI polish, code cleanup |
| #53 | Tighten Recordings RLS | Scope SELECT to workspace membership; perf index on workspace_entries(recording_id); cross-org privilege escalation guard |
| #59 | CORS + .env.example + JWT Audit | ALLOWED_ORIGINS env var; expand .env.example to 60+ vars; JWT verification audit on edge functions |
| #62 | Critical Bugs in Antigravity Branch | workspace_type column fix; copy RPC permission checks; HOME workspace fallback; bank_* role renames; invitation RLS security gaps; invite URL path fixes |
| #64 | Search & Filter Functionality | ILIKE global search; source filter dropdown; workspace-scoped search; SQL injection fix (escapeIlike); file-upload source type; duration filter conversion |
| #65 | Archive Stale Planning Docs | Move 64KB STATE.md, 47KB ROADMAP.md, 18KB REQUIREMENTS.md to archive; create fresh STATE.md; update .gitignore |
| #70 | PR #61 Follow-ups | corsHeaders export; verify 5 other items from PR #61 |
| #79 | Complete Hub Rename | 53 remaining workspace→hub strings in 22 files (UI text only, not code internals) |
| #80 | Critical Migration Issues | Fix duplicate migration timestamps; fix double workspace on signup; drop duplicate trigger; fix backfill ordering bug |
| #81 | Security — JWT Auth + search_path | JWT auth for manager-notes/share-call; SET search_path on 13 SECURITY DEFINER functions; revoke anon EXECUTE; fix test-secrets |
| #82 | Remove Dead Code | Delete 17 orphaned components, 3 dead pages, all Google Meet references, shadcn Toaster, dead OAuth routes |
| #87 | Fix N+1 workspace_entries | useWorkspaceEntriesBatch hook; batch context provider; wrap TranscriptTable; fix optimistic updates |
| #88 | Personal Folders 404 Guard | Detect 42P01 errors in personal-folders + personal-tags services; extract shared isTableMissing helper |
| #92 | Unified Button System + Collapsed Sidebar | Apple-inspired depth across button variants; fix collapsed sidebar icon styling |

---

## MAR 05-06 ISSUES (Pre-orchestrator, direct sessions)

### Security / Critical Fixes

| Date | Item | Description |
|------|------|-------------|
| Mar05 | Workspace-Aware Deletion (3 modes) | Remove from workspace only / permanent with warning (1 workspace) / always permanent from All Calls; DeleteMode type added to DeleteConfirmDialog |
| Mar05 | RLS bypass via views | fathom_calls, fathom_transcripts, recurring_call_titles views ran as SECURITY DEFINER; fix: added security_invoker=true + FORCE ROW LEVEL SECURITY |
| Mar05 | Recordings pipeline broken since Feb 27 | Deployed sync-meetings (v64) referenced bank_id (now organization_id); 15 missing calls backfilled manually |
| Mar05 | Fathom OAuth callback broken for V2 | Redirect URI hardcoded to V1 app; complete OAuth flow impossible in V2; fix: update to V2 import page |
| Mar05 | Zoom OAuth same redirect problem | Same hardcoded V1 redirect in zoom-oauth-url/callback |

### Cleanup / Refactor

| Date | Item | Description |
|------|------|-------------|
| Mar06 | Remove orange IMPORT button | TopBar component; remove usePageLabel() function; verify logo/org-switcher/avatar intact — DONE inline |
| Mar06 | 256MB repo bloat removal | 6 commits: 23 junk files, .venv (144MB), ralph-archived/ (80MB), dist/ (25MB), dead edge functions, v1 phases archived; ~27,900 lines deleted — DONE |
| Mar06 | Dead src code audit Phase 1 | 4 unused Zustand stores, dead chat.ts type file, embeddings.ts, prompts.ts, useMentions.ts, 4 chat test files, 3 YouTube components (~2,000 lines) |
| Mar06 | Dead src code audit Phase 2 | content-hub.ts, content-library.ts, 4 library functions, 3 test files, useYouTubeSearch (~4,000 lines) |
| Mar06 | Supabase config audit | 31 edge functions missing from config.toml; chat-stream-legacy should be deleted; 12 untracked migrations need application |
| Mar06 | Call rename saves to wrong table | Title editing updates fathom_calls not recordings; on refresh old title returns; also only invalidates calls.list() not calls.detail(id) |

---

## UNTRACKED — No Issue, No PR

### 🔴 Critical / Still Potentially Live

| Date | Item | Status |
|------|------|--------|
| Mar05 | **CRITICAL: Blanket RLS policy on `fathom_raw_calls`** — `polroles: {-}` (PUBLIC) with `USING(true)` = all authenticated users see all rows. Other users' calls were visible at app.callvaultai.com. Fix: `DROP POLICY "Service role can manage fathom_raw_calls" ON fathom_raw_calls;` | Unknown — discovered end of session, may still be live |
| Mar05 | **CRITICAL: Same blanket RLS likely on `fathom_raw_transcripts`** — Never verified or fixed | Pending |
| Mar05 | **Edge functions sync-meetings + connector-pipeline never redeployed** — Still running old code with bank_id column name | Pending |
| Mar05 | **Fathom OAuth V2 flow completely broken** — Redirect still points to V1 app | Pending |
| Mar05 | **Zoom OAuth V2 flow completely broken** — Same issue | Pending |
| Mar06 | **Call rename bug** — CallDetailHeader.tsx writes to fathom_calls not recordings; title reverts on refresh | Pending |
| Mar08 | **Git history has exposed Supabase DB password** — apply-fix-pg.ts committed with hardcoded creds; password rotated but history never scrubbed; Issue #72 created but no agent assigned | Pending |
| Mar08 | **31 edge functions missing from config.toml** — JWT settings unconfigured | Pending |
| Mar08 | **chat-stream-legacy still exists** — Should be deleted (replaced by v2) | Pending |

### 🟡 Design & Architecture Decisions (Exist Only in Conversation)

| Date | Decision |
|------|----------|
| Mar08 | HOME workspace spec finalized in chat — always visible, copy vs move semantics, cross-org rules, cascade deletion. Entire agent fleet built from this spec but spec itself never written to a doc |
| Mar08 | Sidebar: Rules should be top-level nav item, Import → renamed Sources, add Shared With Me — consensus reached, nothing ticketed |
| Mar08 | Three new features ranked: (1) Action Items, (2) People, (3) Prep — discussed and ranked, no issues created |
| Mar08 | Auto-merge enabled on all PRs — decided in conversation, no review gate currently |
| Mar09 | Sequential Pipeline pattern chosen for Keystone multi-agent MVP — 4 agents (Soren, CEO, Executor, Critic); Zod I/O contracts; circuit breakers (max 2 retries); HITL via Keystone board — full architecture designed in chat, nothing in a plan doc |

### 🟢 Done Inline (No Issue, No Ticket)

| Date | Item |
|------|------|
| Mar06 | Orange IMPORT button removed and committed directly |
| Mar06 | 256MB repo bloat removed across 6 commits |
| Mar08 | Agent-orchestrator installed and configured for brain repo |
| Mar08 | Auto-merge enabled on GitHub repo |

---

## Quick Stats

| Bucket | Count |
|--------|-------|
| Mar09 formal issues | 33 (17 features, 16 fixes) |
| Mar08 formal issues | 20 (6 features, 14 fixes/security) |
| Mar05-06 direct session work | 11 |
| Untracked critical/pending | 9 |
| Architecture decisions in chat only | 5 |
| Done inline without tickets | 4 |
| **Total** | **82** |
