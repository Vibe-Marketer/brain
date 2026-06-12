# Phase 11: Ticket Foundation + Flag Removal - Context

**Gathered:** 2026-06-10
**Status:** Ready for planning

<domain>
## Phase Boundary

DB-backed ticket persistence replacing the email-only support flow, an admin tickets surface in the existing AdminTab, in-app admin ticket submission, a full event audit trail — and the complete removal of the dead feature-flag system to clear the AdminTab surface first. Requirements: FLAG-01, TKT-01, TKT-02, TKT-03, TKT-04. No autonomous-fix machinery in this phase (that's Phases 13/14); no Sentry ingestion (Phase 12).

</domain>

<decisions>
## Implementation Decisions

### Ticket Foundation Design (accepted 2026-06-10)
- Status lifecycle enum: new → triaged → in_progress → awaiting_approval | awaiting_user → resolved | rejected | escalated (matches ISA ISC-7; Phase 14 approval semantics depend on awaiting_approval)
- Severity: critical | high | medium | low, default medium
- Tickets UI: new "Tickets" section inside the existing AdminTab (`src/components/settings/AdminTab.tsx` area) — table with status/severity/source filters + detail view with event timeline, following existing settings/AdminTab idiom (Remix icons, shadcn/ui, service+hook pattern)
- Feature-flag removal: hard-enable ALL currently-gated surfaces (Layout.tsx, sidebar-nav.tsx gates removed; AdminTab flag toggles section deleted; `useFeatureFlags` hook deleted); `feature_flags` table dropped via migration
- Existing `send-support-ticket` Edge Function pivots: INSERT into tickets/ticket_messages first (source of truth), Resend email to support@callvaultai.com becomes a side-effect of the insert
- RLS: reporter sees own tickets; ADMIN role sees all (mirror existing role model used by AdminTab / useUserRole)
- Every status transition writes a ticket_events row (DB trigger for status changes; service writes for other lifecycle events)

### Claude's Discretion
- Exact table column shapes beyond ISA ISC-1..8 (tickets: id, reporter_id, type bug|suggestion|question|task, severity, status, source manual|sentry, context jsonb, created_at/updated_at; ticket_messages; ticket_events)
- Detail-panel layout within the AdminTab idiom
- Migration naming and ordering; whether flag removal and ticket tables are one migration or two (two preferred — independent revert)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SupportTicketDialog.tsx` + `support-ticket.service.ts` — existing form + context capture (URL, user agent, user/org/workspace ids, app version, commit) to pivot to DB
- `send-support-ticket` Edge Function — auth + Resend wiring to extend with DB insert
- `user_notifications` table (migration 20260131000004) — exists for later phases; do not build UI for it here
- AdminTab user-management table — the UI idiom to mirror for the tickets table
- `useUserRole` hook — role gating pattern

### Established Patterns
- Service + Hook separation locked (src/services/ pure async, src/hooks/ TanStack Query wrappers)
- RLS regression test `src/test/rls-regression.test.ts` — ADD tickets/ticket_messages/ticket_events to CROSS_ORG_TABLES
- Conventional commits scoped `feat(11-xx):`
- npm only; Remix icons only; no AI code in frontend (AI-02)

### Integration Points
- `src/components/settings/AdminTab.tsx` — tickets section lands here; flag toggles section removed here
- `src/components/Layout.tsx` + `src/components/ui/sidebar-nav.tsx` — flag gates removed
- `supabase/migrations/` — new tables + flag-table drop
- `src/types/supabase.ts` — regenerate or hand-extend types after migration

</code_context>

<specifics>
## Specific Ideas

- Andrew's lost screen-capture ticket is the canonical motivation: a ticket submitted today must be findable in the app tomorrow
- Phase 15 will wire screenshot/console-buffer attachments onto these tables — keep `ticket_messages.attachments` jsonb ready
- Phase 12 (Sentry) needs `source` + fingerprint dedup columns — include `source` and `fingerprint` (nullable, unique-when-not-null) now to avoid a second migration

</specifics>

<deferred>
## Deferred Ideas

- User-facing ticket status view / chat thread — v2 (AP-V2-02)
- Notification fan-out on ticket events — Phase 14 scope

</deferred>
