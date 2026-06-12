# Milestones

## v1.0 Self-Serve Public Launch (Shipped: 2026-06-12)

**Phases completed:** 24 phases, 113 plans, 136 tasks

**Key accomplishments:**

- Manual transcript parser fallback now preserves raw text across weak structured inputs and documents the Phase 1 format contract.
- The manual import modal now presents transcript import as the primary action, supports Markdown transcript files, and refreshes all call-list caches after success.
- The import route no longer exposes the deferred file-upload transcription path while preserving internal compatibility for historical rows.
- Phase 1 now has expanded manual-import regression coverage, dedicated Loom parser tests, and a recorded UI-boundary verification attempt.
- Import pane and onboarding surfaces now lock the hidden upload-source rule through shared metadata and focused regression tests.
- Completed:
- Completed:
- Completed:
- Complete read-category MCP module extraction with preserved markdown responses, scope boundaries, and registry coverage
- Complete current write-category MCP module extraction with preserved responses, boundaries, and category gating
- Complete admin-category MCP module extraction with preserved destructive behavior and category gating
- Complete AI-category MCP module extraction with dynamic AI SDK/OpenRouter/Zod loading
- MCP server entrypoint trimmed to a 237-line registry dispatcher with deployed smoke evidence and explicit cold-start verification limits.
- Phase 03 now uses first-class per-client OAuth grants with revoke-aware auth and prefixed manual token compatibility as the security substrate for workspace MCP setup.
- Workspace-scoped MCP endpoint routing now enforces server-side audience checks and advertises exact workspace resources via protected-resource metadata.
- OAuth consent now defaults to org scope, supports optional workspace scoping, and persists reconciled non-admin grants before approval redirect.
- OAuth-first AI connector management now ships in Settings with revocable client grants and visible manual scoped-token fallback controls.
- Capability-driven provider actions plus workspace-aware public MCP snippets in Settings without exposing raw Supabase URLs.
- Phase 03 has green targeted tests/build, updated public MCP setup docs for workspace endpoints, follow-up credential-backed production smoke for valid workspace access plus wrong-workspace rejection, and final vanity metadata proof after Cloudflare Worker deployment.
- Defined Phase 04 write-tool discovery contracts and added Wave 0 tests that lock write-category gating, text-only MCP output shape, and append/merge/upsert behavior expectations.
- Phase 04 write-tool contract and operator smoke runbook are aligned with the deployed modular MCP surface, with local test/build proof and an explicit live-smoke credential blocker.
- Manual MCP imports now resolve to a dedicated `Manual MCP Import` source identity with an official MCP SVG path, and the runbook now pins the final Phase 04 test/build/smoke contract.
- Connector rows now carry a future landing workspace, and frontend connector status exposes that workspace plus action-needed lifecycle state.
- Post-trial onboarding now lands directly in the relevant connector import surface, shows a one-time founder video, and requires explicit Sync all for historical imports.
- Sidebar help is now unified into one Support popout with launch-required actions, plus a simple authenticated ticket-to-support email flow.
- Launch-facing empty states now direct users to real import actions and tests prevent file-upload copy regressions.
- Paid feature gates now render inline locked affordances with route-preserving checkout context instead of redirect-only billing detours.
- Bidirectional real-JWT RLS coverage now includes the nine previously missing user-facing tables, backed by explicit org-scoped fixture seeding.
- Fathom imported calls with provider-title drift now surface as `Updated remotely`, with an explicit confirmation flow to apply updates without duplicating calls or mutating local placement metadata.
- RLS regression suite can no longer silently bind to prod Supabase credentials, and refreshed Fathom OAuth tokens now persist via the pgp_sym_encrypt RPC path instead of plaintext `.update()` writes to import_sources/user_settings.
- One-liner:
- DB triggers cascade mcp_tokens + mcp_oauth_client_grants revocation on workspace/org membership removal; remove-org-member Edge Function adds auth.admin.signOut(userId, 'global') for ISC-31
- ISC-37 workspace param priority hardened: server-side authDetails.workspace_id now takes precedence over attacker-controlled ?workspace_id query param in OAuthConsentPage
- org_slug_tombstone and workspace_slug_tombstone tables with SECURITY DEFINER trigger functions permanently block slug re-registration after org/workspace deletion
- Worker.ts skeleton with uniform {error:"not_found"} body and 100ms delay floor (ISC-44/45/47), plus active Cloudflare rate limit rule 5 req/10s per IP (ISC-46) on callvaultai.com
- One-liner:
- Worker.ts skeleton with uniform {error:"not_found"} body and 100ms delay floor (ISC-44/45/47), plus active Cloudflare rate limit rule 5 req/10s per IP (ISC-46) on callvaultai.com
- DB triggers cascade mcp_tokens + mcp_oauth_client_grants revocation on workspace/org membership removal; remove-org-member Edge Function adds auth.admin.signOut(userId, 'global') for ISC-31
- org_slug_tombstone and workspace_slug_tombstone tables with SECURITY DEFINER trigger functions permanently block slug re-registration after org/workspace deletion
- ISC-37 workspace param priority hardened: server-side authDetails.workspace_id now takes precedence over attacker-controlled ?workspace_id query param in OAuthConsentPage
- One-liner:
- One-liner:
- One-liner:
- One-liner:
- Paged Supabase export retrieval with typed row mapping and 5,000-call regression coverage
- Deterministic Obsidian markdown and ZIP generation with YAML escaping and 5,000-file coverage
- Settings full-vault Obsidian ZIP export is covered, documented, and separated from obsolete token sync paths
- Automated tests, type-check, build, source scans, and browser ZIP smoke all passed for Obsidian export
- 20 stale eslint-disable directives removed across 10 files, dropping warning count from 237 to 217 with no logic changes
- 85 unused-var warnings eliminated across 35 source files, dropping npm run lint from 217 to 132 warnings — 38% reduction below the 170-warning target
- All react-hooks/exhaustive-deps warnings eliminated: safe dep additions for scalar values and queryClient singleton, risky suppressions with mandatory explanatory comments for realtime subscriptions and inline function patterns
- One-liner:
- Disposable launchd→headless-claude harness built and smoke-proven: F1-270 fixture went ticket-JSON → claude -p → diff/test capture → `VERDICT: FIXED` in 104 seconds under admin's keychain-backed auth, with the LaunchAgent staged but unarmed.
- Ratified GO: headless launchd-fired `claude` judged 5/5 fixtures correctly (3 real bugs FIXED, vague ticket ESCALATED, migration ticket DIVERTED) with zero rate-limit flags — SPIKE-VERDICT.md is the canonical record and the execution-isolation design now gates into Phase 13.
- Deleted the dead feature-flag system end to end — hook, Layout/sidebar gates, AdminTab toggles section — hard-enabled DebugPanel/Import/Rules for all users, and dropped the feature_flags table from the live database.
- One-liner:
- One-liner:
- One-liner:
- One-liner:
- Live-pushed migration adding tickets queue-control/backoff columns and the kill-switch runner_state singleton, with RLS proven by a 5-check service-role probe against the production database
- Bun+TS daemon pack at ~/dev/autopilot (own repo) with mock-proven atomic claim/ordering/backoff/sweep and the argv-allowlist agent spawner — 25 tests green, tsc strict green
- Per-run ephemeral-worktree fix engine proven live end-to-end: synthetic claimed ticket → headless claude (FIXED) → vitest+build green in-worktree → commit-advance assert → held branch pushed → codex REVIEW: APPROVE → 7-section evidence bundle on the ticket thread → awaiting_approval — with the worktree destroyed and ~/dev/brain untouched
- Non-LLM exit-code authority boundary: kill switch (flag+DB, fail closed) → commit-advance (exactly base+1) → blast-radius denylist — 7/7 offline fixtures green and the live DB kill switch proven to flip the verdict
- Separate launchd job that pages Andrew on both channels (user_notifications INSERT + osascript) when the dispatcher heartbeat goes stale or the DB is unreachable, rate-limited by a cooldown file, with tools-health failures filed as fingerprint-deduped high tickets — drilled live
- The daemon is wired together and armed-but-idle: the launchd-scheduled claimer runs the full seven-step poll cycle (heartbeat → kill switch → stale sweep → admin-approval merge pass → budget guards → urgent-lane claim+run) at concurrency 1, and the approval path turns a verified-admin approval row into a gate-re-run → ff-only merge → push → deploy-SHA-verified resolution — with the DB kill switch deliberately left ON so no real ticket is claimed before the 13-07 E2E.
- Deployed the authenticated admin approval/rejection bridge — dual-client Edge Function writing dispatcher-recognized approval events with verified admin actor, live-probed 401/403/409 with zero event contamination
- Replaced the 16-01 runner stub with a live typed runner_state card (status, current ticket, heartbeat, RUNNER OFFLINE) plus a confirm-gated admin kill switch, and shipped the priority/URGENT service+hook layer for 14-04 — zero diffs to 15-03-owned files
- Condition-gated auto-merge.yml so agent PRs (autopilot label or Vibe-Marketer author) can never auto-merge, and pinned the guard with a committed invariant test that fails the suite if the exclusion is removed or a second CI merge path appears
- Evidence bundle rendering (APPR-01) and Approve/Reject + priority/URGENT controls (APPR-02 client half) live on TicketDetailDialog in /admin — agent fixes are now readable as structured blocks and approvable in one click, wired to the deployed ticket-approval function and the 14-02 queue-control hook, with reporter rendering unchanged.
- Support tickets now capture the problem view before the dialog renders (killing the "screenshots the submission form" bug), show a retakeable thumbnail, and persist the screenshot as a private Storage reference in ticket_messages.attachments via the deployed intake.
- Ticket submits now auto-attach a JSON console-log buffer (≤100 entries, errors retained preferentially, heavy/sensitive fields stripped) derived at submit time from the existing debug-panel interceptor and uploaded as a console_log attachment alongside the screenshot.
- Admins opening a ticket detail now see an Attachments group on any message carrying attachments — the screenshot as an inline signed-URL image preview and the console log as a download link — completing the CAP-01 loop from reporter capture to admin triage.
- QA

---
