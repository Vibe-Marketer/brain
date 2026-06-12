---
phase: 11
plan: 05
subsystem: tickets
audit-source: codex cross-vendor audit (post-Phase-11 hardening fix-pass)
tags: [security, rls, edge-functions, pagination]
requires: [11-02, 11-03, 11-04]
provides:
  - ticket_messages author_type RLS gating (migration 20260611140000)
  - client_claims trust-boundary namespacing in send-support-ticket
  - paginated getTickets (bounded list query, no message embedding)
key-files:
  created:
    - supabase/migrations/20260611140000_tighten_ticket_messages_author_type.sql
  modified:
    - supabase/functions/send-support-ticket/index.ts
    - src/components/settings/TicketDetailDialog.tsx
    - src/services/tickets.service.ts
    - src/hooks/useTickets.ts
    - src/components/settings/TicketTable.tsx
    - src/components/settings/AdminTab.tsx
    - src/services/__tests__/tickets.service.test.ts
    - src/components/settings/__tests__/TicketTable.test.tsx
    - src/test/tickets-audit.integration.test.ts
completed: 2026-06-11
---

# Phase 11 Plan 05: Hardening Fix-Pass Summary

**One-liner:** Closed three codex-audit findings — author_type spoofing blocked at RLS, client org/workspace ids namespaced as unverified claims, and the admin ticket list bounded to 50-row pages without message embedding.

## Fixes

### 1. [HIGH] ticket_messages author_type spoofing — FIXED

Migration `20260611140000_tighten_ticket_messages_author_type.sql` recreates the
INSERT policy `"Authors can add messages to visible tickets"` with author_type
gating:

- non-admins → `author_type = 'user'` only
- admins (`has_role(auth.uid(), 'ADMIN')`) → `'user'` or `'admin'`
- `'agent'` → reserved for service-role (no authenticated path; RLS bypassed by design)

Applied to the live DB via `supabase db push` (history reconciled — no
Management API fallback needed this time).

**Live-DB behavioral proof** (rolled-back transaction probes via Management API,
zero rows persisted — leftover count 0 verified):

- Non-admin reporter, own ticket, `author_type='admin'` → `ERROR 42501: new row violates row-level security policy for table "ticket_messages"`
- Authenticated `author_type='agent'` → `ERROR 42501`
- Non-admin `author_type='user'` on own ticket → INSERT succeeds (rolled back)
- Admin user `author_type='admin'` → allowed (by design)

**Integration fixtures:** 3 new tests in `src/test/tickets-audit.integration.test.ts`
(spoof 'admin' rejected, spoof 'agent' rejected, legit 'user' passes) — sign in
as the temp reporter via `VITE_SUPABASE_TEST_ANON_KEY`; skip cleanly when the
test project env is absent (local run: 6 skipped, 0 failed).

### 2. [MED] send-support-ticket trust boundary — FIXED

`supabase/functions/send-support-ticket/index.ts`: client-supplied
`organizationId`/`workspaceId` now stored under
`context.client_claims.{organization_id,workspace_id}` instead of top-level
context keys, so no downstream consumer can treat them as server-verified.
`reporter_id` remains JWT-derived (unchanged). Membership verification was
considered: `_shared/connector-function-utils.ts#validateWorkspaceMembership`
exists but is connector-flow-shaped (workspace-only, connector error
responses) — not a cheap drop-in, and a support ticket should not fail on
unverifiable metadata. Namespacing chosen per audit recommendation.

`TicketDetailDialog` renders the new `client_claims` entries and relabels
legacy top-level org/workspace keys as `(client-claimed)` — old tickets keep
displaying.

Deployed via `supabase functions deploy send-support-ticket --use-api`.
Curl probe: OPTIONS preflight 200; unauthenticated POST 401
(`UNAUTHORIZED_NO_AUTH_HEADER`).

### 3. [MED] tickets.service getTickets() unbounded — FIXED

- `getTickets(filters, {limit, offset})` → returns `{ tickets, totalCount }`;
  default limit 50 (`TICKETS_PAGE_SIZE`), `.range()` + `{ count: 'exact' }`.
- `ticket_messages` embedding REMOVED from the list query (was N tickets × all
  messages); detail view already fetches messages.
- `useTickets(filters, page, pageSize)` keys page into the query cache.
- `AdminTab`: removed the second unbounded all-tickets query (was fetched only
  for the footer count — now from `totalCount`); wired existing
  `PaginationControls` primitive (shown when total > page size); filter changes
  reset to page 1.
- `TicketTable`: Summary column removed with its data source.

## Deviations from Plan

**1. [UI-SPEC deviation] Summary column removed from TicketTable**
- 11-UI-SPEC.md lists a Summary column (first message, truncated). Its only
  data source was the unbounded `ticket_messages` embedding the audit flagged.
  Removing the embedding removes the column. Ticket content remains one click
  away in the detail dialog (Messages section, unchanged). If the column is
  wanted back, a `LATERAL`/limited-embed first-message query is the path —
  deliberately not added in a hardening pass.

**2. Footer count semantics:** "Showing X of Y" now means "page rows of
filter-matching total" instead of "filtered of all tickets" — consequence of
dropping the second unbounded query.

## Verification

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | 0 errors |
| `npx vitest run` | 1708 passed, 0 failed, 93 skipped |
| `npm run lint` | 0 errors (108 pre-existing warnings) |
| `npm run build` | exit 0 |
| Spoof INSERT (live DB, rolled back) | 42501 RLS rejection |
| Edge function probe | OPTIONS 200 / unauth POST 401 |

## Commits

| Commit | Description |
|--------|-------------|
| 209f81e4 | fix(11-05): gate ticket_messages author_type by role in INSERT policy |
| 7f2ceefc | fix(11-05): namespace client-supplied org/workspace ids as client_claims |
| 08b3ffb5 | fix(11-05): paginate getTickets and drop ticket_messages embed from list |

Note: concurrent agent commit af9c1842 (`feat(qa)`) landed mid-pass; not part
of this plan.

## Self-Check: PASSED
- Migration file exists and is in remote migration history (db push clean)
- All three commits present on main
- Committed tree green on tsc/vitest/lint/build
