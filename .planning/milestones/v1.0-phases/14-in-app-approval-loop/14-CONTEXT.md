# Phase 14: In-App Approval Loop - Context

**Gathered:** 2026-06-11
**Status:** Ready for planning

<domain>
## Phase Boundary

The admin-facing half of the autonomous-fix loop: Andrew reviews each fix's summary + evidence bundle on the ticket detail inside the **/admin Admin Center** and approves or rejects in-app; the approval event drives the Phase 13 dispatcher to merge/push the held branch on its next poll cycle; no agent-authored change reaches main without gate-pass or explicit admin approval. Requirements: APPR-01..03 (ROADMAP.md §Phase 14; REQUIREMENTS.md lines 73-75). Plus two queue-ops surfaces decided in 13-CONTEXT.md that Phase 14 owns: admin priority/urgent controls and the live runner status card with kill switch.

**RETARGET (Andrew, 2026-06-11):** Phase 14's UI lands in the new `/admin` shell shipped by Phase 16 — live in prod: AdminCenter, Dashboard with Needs-You queue, TicketsSection mounting TicketDetailDialog (16-01-SUMMARY.md; 16-CONTEXT.md line "Phase 14 (approval loop) RETARGETS into this shell"). NOT in Settings. The Phase 11-era "AdminTab in Settings" placement is dead — AdminTab is a pointer card now (16-02-SUMMARY.md).

</domain>

<decisions>
## Implementation Decisions (all on record — sources cited)

### Approval contract (Phase 13, locked)
- Approval = explicit admin-authored `approval` row in `ticket_events` (ISA ISC-66; 13-CONTEXT.md "Ship policy"). Rejection = admin-authored rejection event + reason posted to the ticket; dispatcher closes the held branch without merging (ROADMAP Phase 14 SC-2).
- Dispatcher-side recognition (13-RESEARCH.md Pitfall, line ~307): `event_type='approval'` AND `actor_id` resolves to a real ADMIN (has_role via service-role query) AND ticket status `awaiting_approval`. NULL actor never qualifies. Phase 14 writes events that satisfy this; the dispatcher (13) polls and executes — Phase 14 does NOT merge anything itself.
- Today the only INSERT path into `ticket_events` is service-role (11-02/11-05 posture; 13-CONTEXT.md constraints). **Phase 14 ships the authenticated path**: a new Edge Function `ticket-approval` using the dual-client pattern proven by `admin-manage-user` in 16-02 (in-code JWT verify via authenticateRequest, `has_role(verifiedUserId,'ADMIN')` check on the service-role client, service-role INSERT with the verified admin's `actor_id`, `verify_jwt=false` in config.toml per repo ES256 pattern — 16-02-SUMMARY.md decisions).

### Evidence bundle (Phase 13, locked)
- Evidence arrives as agent-authored `ticket_messages` rows (author_type='agent', service-role write — 13-CONTEXT.md "Evidence bundle"): diff summary, test output tail, repro-replay result where an artifact exists, codex review verdict (`codex exec --sandbox read-only`, advisory only), resolution note. Daemon writer: `~/dev/autopilot/src/lib/db.ts` writeEvent/writeAgentMessage rebound to live columns (13-02-SUMMARY.md).
- APPR-01 renders this on the live TicketDetailDialog: diff blocks, test-output tails, codex-verdict blocks. Port the dead branch's `TicketDetailView.tsx` evidence rendering + `RevertCard` (`git show worktree-admin-center:src/components/admin/TicketDetailView.tsx` — payload-tail rendering for build/test output and diffs, "View evidence" expander, RevertCard composed from events) per the dead-branch assessment's KEEP-later list (assessment conclusions encoded in 16-CONTEXT.md port map + 13-CONTEXT.md "Dead-branch reference code"), **rebound to the live event/message vocabulary** — live `ticket_events` are `event_type/old_value/new_value` and evidence lives in `ticket_messages`, not the branch's dead `needs_review`/`revert_available` event tags (16-01-SUMMARY.md rebinding table; 13-RESEARCH.md rebind map line ~265: "needs_review event → awaiting_approval status + evidence message").

### Scope (this phase ships)
1. **APPR-01 — Evidence render:** fix summary + evidence bundle visible on the ticket detail (TicketDetailDialog as mounted in /admin TicketsSection): diff / test-output / codex-verdict blocks with tail-truncation, RevertCard pattern where a revert artifact exists.
2. **APPR-02 — Approve/Reject in-app:** buttons on the ticket detail (shown for status `awaiting_approval`) → `ticket-approval` Edge Function → admin-authored approval/rejection event (+ rejection reason as a message); dispatcher reacts on its next poll cycle (13-RESEARCH decision: polling, no Realtime). UI reflects the new status optimistically/after invalidation.
3. **APPR-03 — CI/auto-merge exclusion + invariant:** agent-authored PRs excluded from any auto-merge path; an invariant test proving no merge-without-approval path exists (CI workflow guard + test).
4. **Priority/urgent controls:** quick-set priority + URGENT toggle on the admin ticket UI (13-CONTEXT.md "Queue, priority and urgency": columns admin-writable via RLS, claim order `urgent DESC, priority DESC, severity rank, created_at ASC`). Direct table UPDATE through service+hook is fine — RLS already gates UPDATE to ADMIN (13-01-PLAN Part B); no Edge Function needed for these columns.
5. **Runner status card live:** replace the Dashboard's "not deployed yet" runner stub (16-01-SUMMARY Known Stubs) with real `runner_state` reads — status, current ticket, heartbeat staleness ⇒ "runner offline" (13-CONTEXT.md "Runner status visibility") — plus the kill-switch toggle. Kill switch: `runner_state.kill_switch` is the ONLY admin-writable column (BEFORE UPDATE trigger enforces it — 13-01-PLAN Part C), so a direct admin-session UPDATE works; admin-gated render.

### Constraints
- **ticket_events INSERT is service-role-only** — the `ticket-approval` Edge Function is the authenticated bridge (dual-client pattern from 16-02's admin-manage-user). Do not add a client INSERT policy on ticket_events.
- Remix icons only; shadcn/ui + semantic tokens; service+hook pattern (src/services pure async, src/hooks TanStack Query); **no new deps**; npm. AI-02 (zero AI code in frontend) unaffected.
- `npm run type-check` is hollow (ticket 3d68d1cd) — gate on vitest + build + scoped tsc (13-CONTEXT.md constraints).
- Schema dependency: `priority`/`urgent`/`runner_state` land with **13-01 (landing now)** — migration 20260611200000. Plans touching them must gate on 13-01-SUMMARY existing (or column-gate render as 16-01 did for runner_state).

### Claude's Discretion
- Exact evidence-block layout, tail-truncation lengths, expander interaction; priority quick-set affordance (stepper vs presets); CI exclusion mechanism details (label/actor-based) so long as the invariant test proves it; where the approve/reject confirm step lives.

</decisions>

<code_context>
## Existing Code Insights

### Live surfaces this phase extends
- `/admin` shell (16-01, deployed): `src/pages/admin/AdminCenter.tsx`, `DashboardSection.tsx` (runner card stub + Needs You queue with awaiting_approval click-through), `TicketsSection.tsx` mounting main's TicketTable + **TicketDetailDialog** + NewTicketDialog, `AdminCommandPalette.tsx`, `adminDetailStore.ts`.
- `src/components/settings/TicketDetailDialog.tsx` + `src/services/tickets.service.ts` + `src/hooks/useTickets.ts` (11-03/11-04) — **OWNED BY 15-03 until 15-03-SUMMARY.md exists** (15-03-PLAN files_modified). Sequence accordingly; see ownership note below.
- `src/services/admin-dashboard.service.ts` + `src/hooks/useAdminDashboard.ts` (16-01) — runner_state untyped read lives here; 16-01 decision kept tagNeedsYou here to avoid 15-01 file collisions.
- Edge Function pattern: `supabase/functions/admin-manage-user/index.ts` (16-02) — dual-client auth, zod closed action union, admin_audit_log writes. `ticket-approval` copies this shape.
- `admin_audit_log` (16-02 migration 20260612120000) — approval/rejection actions should also audit here (append-only, service-role write), matching admin-manage-user's posture.

### Dispatcher contracts consumed (Phase 13)
- `tickets` status lifecycle incl. `awaiting_approval` (20260611000002); `ticket_events` event_type/old_value/new_value + audit trigger; `ticket_messages` author_type CHECK ('user','agent','admin') with agent service-role-only (20260611140000).
- 13-01 (in flight): `tickets.priority`/`urgent`/`attempts`/`next_attempt_at`, `runner_state` (single row id=1, status idle|claiming|running|awaiting_gate, last_heartbeat, kill_switch; SELECT admin-only; UPDATE kill_switch-only for admins), RLS probe script.
- 13-02 (complete): daemon libs at `~/dev/autopilot/` — approval-merge path polls ticket_events (13-RESEARCH decision); evidence written via writeAgentMessage.

### Dead-branch port source (reference only — rebind everything)
- `git show worktree-admin-center:src/components/admin/TicketDetailView.tsx` — evidence payload-tail rendering, "View evidence" expander, RevertCard. Branch event vocab (`needs_review`, `revert_available`, evidence events) is DEAD — rebind to live statuses + agent messages.

</code_context>

<file_ownership>
## File Ownership / Sequencing (HARD)

| File | In-flight owner | Rule for Phase 14 |
|---|---|---|
| `src/components/settings/TicketDetailDialog.tsx` | **15-03** (also touches tickets.service.ts, useTickets.ts + their tests) | Phase 14 plans touching these files carry an execution gate: DO NOT EXECUTE until `15-03-SUMMARY.md` exists. Wave the evidence/approve-reject UI behind that gate. |
| `src/services/admin-dashboard.service.ts`, `src/pages/admin/DashboardSection.tsx` | 16-01 complete (SUMMARY exists) | Free to extend (runner card live). |
| `supabase/migrations` for priority/urgent/runner_state | **13-01** (landing now) | Phase 14 writes NO competing migration; gate runtime use on 13-01-SUMMARY or column-gate render. |
| `~/dev/autopilot/**` | Phase 13 waves 2-4 | Phase 14 never touches the daemon repo — contract is events/tables only. |
| 15-02 (console buffer) | in flight on shared main | No file overlap expected (SupportTicketDialog/debug-panel); avoid those files anyway. |

</file_ownership>

<specifics>
## Specific Ideas

- E2E acceptance dovetails with 13-07's proof on real ticket 1deaa9b7: the single human step is Andrew's approval **click in /admin** — this phase supplies that click (13-CONTEXT specifics).
- Needs-You queue already deep-links awaiting_approval tickets to the dialog (16-01) — approve/reject lands exactly where that click-through arrives.
- Rejection must capture a reason (posted to the ticket thread) — it's the dispatcher's signal to close the branch (ROADMAP SC-2).

</specifics>

<deferred>
## Deferred Ideas

- Telegram bridge + user-facing chat approval (AP-V2-01/02) — v2
- Auto-ship ladder rungs + per-category autonomy (AP-V2-03, ISA ISC-100..103) — after trust window
- Daily digest port from dead branch — Phase 14+ backlog, not this phase's plans
- Drag-reorder of the queue (quick-set priority ships now; full drag UI later)
</deferred>

---
**Research base:** Skip a fresh research agent — the dead-branch assessment (conclusions encoded in 16-CONTEXT.md / 13-CONTEXT.md port maps) + `13-RESEARCH.md` (approval recognition, rebind map, polling decision, threat register) are the research base for this phase.
