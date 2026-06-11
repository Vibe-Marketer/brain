---
phase: 11-ticket-foundation-flag-removal
verified: 2026-06-11T00:00:00Z
status: human_needed
score: 5/5 must-haves verified (automated); 2 browser checks deferred to orchestrator
overrides_applied: 0
human_verification:
  - test: "Open AdminTab as admin in a browser; inspect the Tickets section (list, three filters, detail dialog) against 11-UI-SPEC.md"
    expected: "Section renders per spec between System Overview and User Management; filters work; detail dialog shows context, messages, Activity timeline; list shows the ~7 real prod tickets"
    why_human: "Rendering fidelity cannot be grepped; Interceptor extension was unreachable from executor contexts (11-03/11-04 both deferred). Being verified by the orchestrator directly — deferred-to-orchestrator, NOT failed."
  - test: "Click 'New Ticket', submit a task ticket, watch it appear in the list, open detail and see the 'created' event"
    expected: "Ticket created with auto-attached context (URL, UA, org/workspace, appVersion, commit), visible immediately, 'created' event in Activity timeline"
    why_human: "End-to-end live UI flow; the underlying intake path (Edge Function insert ticket+message+event) is independently proven live. Deferred-to-orchestrator."
notes:
  - "Concurrent 11-05 pass: a codex cross-vendor audit returned 'concerns' with 3 findings; fixes in flight in a separate 11-05 pass at verification time. No 11-05 PLAN/SUMMARY artifacts on disk yet. Findings noted as in-flight; deliberately NOT re-fixed or re-litigated here. 11-05 outcome should be appended to this record or re-verified when it lands."
---

# Phase 11: Ticket Foundation + Flag Removal — Verification Report

**Phase Goal:** Tickets become first-class DB-backed records (replacing the email-only support flow) with a full audit trail, surfaced and submittable from the AdminTab. The nonfunctional feature-flag system is removed first to clear the AdminTab/Layout surface.
**Verified:** 2026-06-11
**Status:** human_needed (all automated checks pass; browser-visual checks deferred to orchestrator)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Feature-flag system removed; gated surfaces hard-enabled; build/test green, no dead refs | ✓ VERIFIED | `rg "useFeatureFlags\|isFeatureEnabled\|feature_flags\|featureFlags" src/` → 0 matches; `src/hooks/useFeatureFlags.ts` deleted; `feature_flags` absent from `src/types/supabase.ts`; live `to_regclass('public.feature_flags')` → null; `npm test` exit 0; `npm run build` exit 0. Residual `feature_flags` hits exist only in the historical 2026-03 create-migration (append-only history, superseded by drop migration 20260611000001 — not dead code). |
| 2 | Tickets persist in `tickets`/`ticket_messages`/`ticket_events` with reporter-own/admin-all RLS; support form writes DB-first, email a side-effect | ✓ VERIFIED | Live DB: 3 tables exist, `relrowsecurity=true`, policy counts 3/2/1; live `pg_policies` quals match the migration exactly (`reporter_id = auth.uid() OR has_role(auth.uid(),'ADMIN')`; messages/events mirror parent; events SELECT-only = append-only). `send-support-ticket/index.ts` inserts ticket → message → 'created' event before any Resend call; Resend in its own try/catch (lines 213-222 log-and-continue); response includes `ticketId`. Deployed: unauthenticated POST → HTTP 401. Prod data: 7 real tickets, 7 messages, 7 'created' events, 0 null reporter_ids. |
| 3 | Admin opens AdminTab tickets view: list filterable by status/severity/source + detail view with full event timeline | ✓ VERIFIED (code) / browser check deferred | AdminTab imports and renders `TicketTable` (153 ln), `TicketDetailDialog` (204 ln), filters via `useTickets({status,severity,source})`, zero inline supabase. `tickets.service.ts` (193 ln) queries `tickets`/`ticket_messages`/`ticket_events`. 14 service+component tests pass. Visual fidelity → orchestrator. |
| 4 | Admin submits a ticket in-app (bug/task) with context auto-attached, immediately visible | ✓ VERIFIED (code) / browser check deferred | `NewTicketDialog` (140 ln) mounted in AdminTab behind 'New Ticket' CTA (RiAddLine); `createTicket()` → `supabase.functions.invoke('send-support-ticket')` (tickets.service.ts:179) with type/severity + auto context; `useCreateTicket` invalidates `['tickets']` (useTickets.ts:39). 4 NewTicketDialog tests + 12 service tests pass. Live submit flow → orchestrator. |
| 5 | Every status transition writes a `ticket_events` row; lifecycle reconstructible from audit trail alone | ✓ VERIFIED | Live trigger `ticket_status_audit` present; `log_ticket_status_change` has `prosecdef=true`. Behavioral probe (BEGIN/UPDATE/SELECT/ROLLBACK against prod): status UPDATE new→triaged wrote `{event_type:'status_change', old_value:'new', new_value:'triaged'}`; rollback confirmed clean (0 residual rows). Invariant query: 0 tickets with status≠'new' lacking a status_change event (vacuously complete — no transitions yet; trigger proven live). Every existing ticket has its 'created' event. |

**Score:** 5/5 automated truths verified; 2 of them carry a browser-visual component deferred to the orchestrator.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260611000001_drop_feature_flags.sql` | DROP TABLE | ✓ VERIFIED | Exists; live table gone |
| `supabase/migrations/20260611000002_create_ticket_tables.sql` | 3 tables + 4 enums + RLS + triggers | ✓ VERIFIED | All CREATE TYPE/TABLE/POLICY/TRIGGER statements present; live state matches file |
| `supabase/functions/send-support-ticket/index.ts` | DB-first intake | ✓ VERIFIED + WIRED + DEPLOYED | 232 ln; insert-first/email-second; 401 on unauth probe |
| `src/services/tickets.service.ts` | getTickets/getTicketDetail/updateTicketStatus/createTicket | ✓ VERIFIED + WIRED | 193 ln; consumed by useTickets |
| `src/hooks/useTickets.ts` | TanStack wrappers + invalidation | ✓ VERIFIED + WIRED | 58 ln; consumed by AdminTab/dialogs |
| `src/components/settings/TicketTable.tsx` | UI-SPEC table (min 60 ln) | ✓ VERIFIED + WIRED | 153 ln; rendered in AdminTab:404 |
| `src/components/settings/TicketDetailDialog.tsx` | detail + Activity timeline | ✓ VERIFIED + WIRED | 204 ln; AdminTab:414 |
| `src/components/settings/NewTicketDialog.tsx` | submission dialog (min 50 ln) | ✓ VERIFIED + WIRED | 140 ln; AdminTab:422 |
| `src/lib/ticket-display.ts` | shared badge/type maps | ✓ VERIFIED + WIRED | 41 ln |
| `src/test/rls-regression.test.ts` | ticket-table coverage | ✓ EXISTS | env-gated; skips cleanly locally, CI covers |
| Test files (service/TicketTable/NewTicketDialog) | suites | ✓ VERIFIED | 49 passed, 0 failed in targeted run |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| send-support-ticket | public.tickets/messages/events | service-role inserts, reporter from `authenticateRequest` | ✓ WIRED (lines 124, 157, 178, 195) |
| tickets.status UPDATE | ticket_events | SECURITY DEFINER trigger | ✓ WIRED (live behavioral probe) |
| AdminTab | useTickets | hook consumption, no inline supabase | ✓ WIRED (AdminTab:26,85,90) |
| NewTicketDialog | send-support-ticket | `functions.invoke('send-support-ticket')` | ✓ WIRED (tickets.service.ts:179) |
| submission success | tickets list | `invalidateQueries(['tickets'])` | ✓ WIRED (useTickets.ts:39) |

### Data-Flow Trace (Level 4)

AdminTab renders `tickets` from `useTickets` → `getTickets` → live `tickets` table (7 real rows in prod). No hardcoded-empty props; empty states are legitimate conditional renders. Status: FLOWING.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Flag refs gone | `rg "useFeatureFlags\|isFeatureEnabled\|feature_flags\|featureFlags" src/` | 0 matches | ✓ PASS |
| Live schema/RLS/trigger | Management API query | 3 tables, RLS true, policies 3/2/1, trigger secdef | ✓ PASS |
| Audit trigger fires | rolled-back UPDATE probe | status_change new→triaged row written, rolled back clean | ✓ PASS |
| Deployed function auth | `curl POST .../send-support-ticket` (no auth) | HTTP 401 | ✓ PASS |
| Targeted test suites | `npx vitest run` (5 files) | 49 passed, 0 failed | ✓ PASS |
| Full suite | `npm test` | exit 0 | ✓ PASS |
| Build | `npm run build` | exit 0 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
|-------------|------------|--------|----------|
| FLAG-01 | 11-01 | ✓ SATISFIED | Truth 1 |
| TKT-01 | 11-02 | ✓ SATISFIED | Truth 2 (7 real DB-resident tickets; email demoted to side-effect) |
| TKT-02 | 11-03 | ✓ SATISFIED (code) | Truth 3; visual → orchestrator |
| TKT-03 | 11-04 | ✓ SATISFIED (code) | Truth 4; live flow → orchestrator |
| TKT-04 | 11-02 | ✓ SATISFIED | Truth 5 (live trigger probe) |

No orphaned Phase-11 requirements in REQUIREMENTS.md.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| AdminTab.tsx | 154 | `TODO: Track in separate table` | ℹ️ Info | Pre-existing (blame: 2025-11-22), User Management section — not introduced by Phase 11 |
| AdminTab.tsx | 488 | `"coming soon"` toast | ℹ️ Info | Pre-existing (blame: 2026-03-03), User Management — not Phase 11 |

No debt markers introduced by Phase 11 files. No stubs: all ticket components flow real data.

### Concurrent 11-05 Audit-Fix Pass

A codex cross-vendor audit of this phase returned 'concerns' with 3 findings; a concurrent 11-05 pass is fixing them at verification time. No 11-05 PLAN/SUMMARY artifacts exist on disk yet, so the findings are recorded here as **in-flight** — not re-fixed and not counted as gaps in this report. When 11-05 lands, its summary should be checked against this record.

### Human Verification Required

#### 1. AdminTab Tickets section visual check (deferred-to-orchestrator)

**Test:** Open AdminTab as admin; inspect Tickets section, three filters, and detail dialog against 11-UI-SPEC.md.
**Expected:** Renders per spec; list shows the ~7 real prod tickets; detail dialog shows context, messages, Activity timeline.
**Why human:** Rendering fidelity is not greppable; Interceptor extension unreachable from executor contexts. Orchestrator is verifying directly.

#### 2. Live in-app ticket submission flow (deferred-to-orchestrator)

**Test:** Click 'New Ticket', submit a task ticket, confirm it appears in the list with a 'created' event in the timeline.
**Expected:** Ticket created with auto-attached context, immediately visible.
**Why human:** End-to-end browser flow; underlying intake path independently proven live.

### Gaps Summary

No gaps. All five ROADMAP success criteria are verified at the code + live-system level with real probes (live schema/RLS/trigger queries, rolled-back trigger behavioral test, deployed-function 401 probe, full test suite, build). The two remaining items are browser-visual confirmations explicitly deferred to the orchestrator, hence `human_needed` rather than `passed`.

---

_Verified: 2026-06-11_
_Verifier: Claude (gsd-verifier)_
