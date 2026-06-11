# Phase 16: Admin Center Shell + User Management Port - Context

**Gathered:** 2026-06-11 (Andrew's direct order — top priority, visible-first)
**Status:** Ready for planning

<domain>
## Phase Boundary

Port the proven admin UI from branch `worktree-admin-center` onto main's live foundation: a dedicated `/admin` route in the MAIN SIDEBAR (AppShell 4-pane, ⌘K palette) with Dashboard, Tickets, Users, QA, Audit sections — replacing the cramped Settings AdminTab as the admin home. Real user management (server-side authz, audit, password reset, revoke/restore). Deploy visibility. QA-crawler control surface. This SUPERSEDES the Phase 11 "AdminTab-in-Settings" placement decision by Andrew's explicit 2026-06-11 instruction ("get this into the main sidebar... not having any functionality over the users... not working for me").

</domain>

<decisions>
## Implementation Decisions

### Architecture (port map from the branch assessment — follow it)
- Port from `git show worktree-admin-center:<path>`: `src/pages/admin/AdminCenter.tsx`, `AdminCategoryPane.tsx`, `AdminGuard.tsx`, `adminDetailStore.ts`, `AdminCommandPalette.tsx` + `ui/command.tsx` (cmdk), routes (`/admin`, `/admin/:section`), sidebar ADMIN item gated on `isAdmin`.
- Sections in v1 (drop Flags — feature flags are deleted; drop the branch's Support/tickets implementation — dead schema):
  1. **Dashboard** — port `DashboardSection` + `admin-dashboard.service` REBOUND to live schema: user/role counts (live tables), ticket status counts + 7-day (live `tickets`), DB health round-trip, **deployed-SHA card** (running bundle's `VITE_COMMIT_SHA`/`VITE_VERCEL_GIT_COMMIT_SHA` vs `main` HEAD via gh API — "what's deployed" at a glance), runner heartbeat card reading `runner_state` (renders "not deployed yet" until Phase 13 ships — wire the read now), "Needs You" queue via ported `tagNeedsYou()` rebound to `awaiting_approval`/critical-aging/escalated.
  2. **Tickets** — REUSE main's live components (TicketTable, TicketDetailDialog, NewTicketDialog from 11-03/04/05) mounted in the shell with the pane-native detail pattern; add admin priority/urgent controls once Phase 13's migration lands (column-gated render until then). Settings AdminTab keeps a slim pointer ("Admin moved → /admin") or redirects; do NOT maintain two ticket UIs.
  3. **Users** — port `UsersSection`, `UserProfileDetails`, `admin-users.service`, `useAdminUsers`, and the `admin-manage-user` Edge Function. Rebind: `is_admin()` → existing `has_role(auth.uid(),'ADMIN')`; audit writes → port the small `admin_audit_log` table migration (service-role-only INSERT, append-only — posture from the branch). Capabilities: role change (server-side, audited), password reset, revoke/restore access, plan/last-seen visibility. Drop the deprecated billing stub.
  4. **QA** — port `QaSection` UI rebound to a new `qa_runs` table (id, started_at, finished_at, routes, findings_count, report jsonb summary, triggered_by); extend `scripts/qa/qa-crawler.ts` with an optional `--record` flag that writes the run summary row (service-role env) while staying report-only on tickets. v1 control = view runs + findings; "Run now" button INSERTs a qa_run request row the local runner can poll (full remote-trigger wiring may land with Phase 13's dispatcher — render the button disabled with "runner offline" until runner_state exists).
  5. **Audit** — port `AuditSection` UI rebound to `ticket_events` (+ `admin_audit_log` once Users lands) — actor/action/target/metadata table with filter.
- Phase 14 (approval loop) RETARGETS into this shell — its approve/reject UI lands on the Tickets detail + "Needs You" queue here, not in Settings.

### Sequencing (visible-first, Andrew's priority)
- Wave 1 ships the sidebar entry + shell + Dashboard + Tickets-in-shell + Users — the visible transformation. Waves 2+ add QA + Audit + deploy card polish if wave 1 must split.
- Velocity over ceremony: skip research agent (the assessment IS the research — cite it); pattern fidelity comes from the branch code itself + main's live analogs.

### Constraints
- All branch code rebinds to LIVE schema only — zero resurrection of support_tickets/legacy ticket_events vocab/is_admin()/feature_flags references (strip palette/category entries for Flags).
- Brand + repo rules: Remix icons, shadcn/ui, semantic tokens, service+hook pattern, AI-02, npm. Tests for ported services/components (the branch shipped tests — port them too, rebound).
- RLS: admin_audit_log + qa_runs service-role INSERT / admin SELECT; migrations via `supabase db push` (history clean).
- `npm run type-check` is hollow — gate on vitest + build + scoped tsc for new files.

### Claude's Discretion
- Exact dashboard card layout; palette command set; how the Settings AdminTab pointer/redirect renders; qa_runs column details.

</decisions>

<code_context>
## Existing Code Insights

- Port sources: `git show worktree-admin-center:<path>` for every file in the assessment's KEEP lists (~820 LOC users, ~130 shell, ~225 palette, ~342 dashboard, ~369 QA, ~150 audit + services/hooks/tests)
- Live analogs: AppShell 4-pane (src/components/panes/*), TicketTable/TicketDetailDialog (11-03), has_role pattern (migrations), CROSS_ORG_TABLES test
- gh CLI authed (deployed-SHA card); crawler at scripts/qa/qa-crawler.ts
- Known landmine: branch palette/categories reference FlagsSection — strip on port

</code_context>

<specifics>
## Specific Ideas

- Andrew's experience target: open the app → ADMIN in the sidebar → one screen shows what's deployed, what the runner is doing, what needs him, who's on the platform, and full control over tickets/users — "current status somehow" answered by the Dashboard, not by asking me.
- E2E acceptance: log in as a@vibeos.com → /admin from sidebar → change a user's role (audited) → see today's 15 tickets → see deployed SHA matching origin/main.

</specifics>

<deferred>
## Deferred Ideas

- Automation section (port shape exists) — lands WITH Phase 13's config/kill-switch as its natural UI home
- Daily digest port — Phase 14+
- Org/workspace membership panel in UserProfileDetails (the branch's own unchecked ISC-14)
</deferred>
