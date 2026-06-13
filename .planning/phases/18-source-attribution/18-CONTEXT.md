# Phase 18: Source Attribution - Context

**Gathered:** 2026-06-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish accurate per-origin attribution for tickets so downstream phases can safely measure, filter, budget, and communicate by source. This phase extends the ticket source taxonomy, fixes known mis-attribution, exposes source filtering/grouping in Admin Center, and adds per-source metrics.

**In scope:** SRC-01 (true origin on every ticket), SRC-02 (AdminTab/Admin Center filters and groups by source), SRC-03 (per-source volume, fix rate, and cycle-time metrics).

**Explicitly NOT in this phase:** nightly QA scheduling and flake suppression (Phase 20), Sentry debug/fix/resolve write-back (Phase 21), reporter comms (Phase 23), throughput scale-up/autonomy ladder/survival metrics (Phase 19), and recurrence clustering (Phase 22).

</domain>

<decisions>
## Implementation Decisions

### Source Taxonomy and Operator Labels
- **D-01:** Operator-facing labels stay plain-English and easy to understand. Do not expose raw enum values like `nightly_qa` or `in_app_user` in the UI. Use labels in the style of "Reported by a person," "Found by Sentry," "Found by nightly QA," "Internal watchdog," and "Unknown source."
- **D-02:** Preserve the existing human-readable meaning of current `manual` tickets as "Reported by a person." If the planner introduces a more explicit `in_app_user` source for future reporter comms, keep compatibility handling so existing `manual` rows still read naturally to operators.
- **D-03:** `unknown` remains the safe value for tickets that cannot be confidently attributed, but Phase 18 should not spend effort on an aggressive historical rewrite just for UI cleanliness. Do not turn uncertain legacy rows into `in_app_user`.

### Legacy and Intake Behavior
- **D-04:** Fix active mis-attribution at the intake paths, especially the watchdog/internal path that currently writes `source: "manual"` and any QA path that stamps manual. New operational tickets must stamp their real origin.
- **D-05:** Sentry keeps using its dedicated source. Phase 18 should not broaden into Sentry debug, debounce, or resolve behavior; it only makes attribution and metrics trustworthy for later Sentry work.

### Admin Center Source Surface
- **D-06:** Prefer grouping by source with source summary if it is straightforward on top of the existing ticket list/filter code. The UX should help an operator quickly see where work is coming from.
- **D-07:** If grouping/summary becomes a large implementation detour, keep it simple: update the existing source filter, source column, labels, and table behavior. Source attribution correctness is more important than a fancy grouping UI.
- **D-08:** Keep this inside the existing Admin Center Tickets surface. Do not create a new top-level admin tab or a separate source-attribution page.

### Per-Source Metrics
- **D-09:** Show per-source metrics in both places where operators naturally look: the Dashboard stat area and the Tickets page near the source controls/summary.
- **D-10:** Metrics for this phase are volume, fix rate, and cycle time per origin. Avoid adding the Phase 19 survival/autonomy ladder here; that is later work.

### Claude's Discretion
- Exact enum naming (`in_app_user` vs keeping `manual` as the person-reported value), grouping layout, and whether metrics are computed client-side from a bounded query or through a dedicated SQL/RPC path are planner decisions, as long as the UI labels remain plain-English and the implementation stays small.
- If a grouping UI requires broad table rewrites, the planner may choose the simpler filter-only path and still satisfy the user's preference.

### Reviewed Todos (not folded)
- "Apply 15-min compliance posture fixes (GitHub + Vercel + Supabase + Cloudflare)" — low-score match; unrelated to source attribution.
- "Resync updated Fathom call metadata" — low-score match caused by `src` keyword; unrelated to ticket source attribution.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone Planning
- `.planning/ROADMAP.md` §"Phase 18: Source Attribution" — goal, success criteria, dependency ordering, and UI hint.
- `.planning/REQUIREMENTS.md` §"Source Attribution (SRC)" — SRC-01, SRC-02, SRC-03 requirement text.
- `.planning/STATE.md` §"Key Decisions" — Phase 18 is a hard dependency before reporter comms; legacy rows must not be treated as customer reports without proof.
- `.planning/phases/17-activation-per-run-observability-go-live-hardening/17-CONTEXT.md` — prior Autopilot decisions and Admin Center/runner_state context.
- `.planning/research/SUMMARY.md` — converged build order; Phase 18 is marked as a standard-pattern phase that can skip separate research.

### Ticket Schema and Intake Paths
- `supabase/migrations/20260611000002_create_ticket_tables.sql` — original `tickets` table and `ticket_source` enum (`manual`, `sentry`).
- `supabase/migrations/20260612130000_sentry_ticket_ingestion.sql` — `ingest_sentry_ticket`, Sentry source stamping, occurrence tracking, and notification behavior.
- `supabase/functions/send-support-ticket/index.ts` — in-app/manual support-ticket intake path currently writing `source: 'manual'`.
- `/Users/admin/dev/autopilot/src/watchdog.ts` — watchdog/internal ticket path currently writing `source: "manual"` and should stamp an internal source.

### Admin Center Surfaces
- `src/services/tickets.service.ts` — `TicketSource`, `TicketFilters.source`, `getTickets()` filtering, and ticket-list types.
- `src/hooks/useTickets.ts` — TanStack Query wrapper for ticket list/detail.
- `src/pages/admin/TicketsSection.tsx` — Admin Center ticket source filter and list composition.
- `src/components/settings/TicketTable.tsx` — source column and sort behavior.
- `src/lib/ticket-display.ts` — plain-English source labels and ticket humanizers.
- `src/services/admin-dashboard.service.ts` — current dashboard stats query; likely extension point for per-source counts/metrics.
- `src/pages/admin/DashboardSection.tsx` — operator dashboard stat presentation.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/services/tickets.service.ts`: already has `TicketFilters.source` and filters `.eq('source', filters.source)`.
- `src/pages/admin/TicketsSection.tsx`: already has a source `<Select>` with `manual` and `sentry`; this is the small path for SRC-02.
- `src/components/settings/TicketTable.tsx`: already renders a SOURCE column and sorts by `source`.
- `src/lib/ticket-display.ts`: existing `ticketSourceLabel()` is the correct single place to preserve plain-English labels.
- `src/services/admin-dashboard.service.ts`: existing dashboard ticket status aggregation can be extended or mirrored for per-source metrics.

### Established Patterns
- Service + hook separation is locked: services own Supabase reads/writes, hooks wrap with TanStack Query, components do not call services directly.
- Admin Center is the correct operator surface. Settings `AdminTab` is only a pointer to `/admin/dashboard`.
- Ticket list stays paginated and bounded; avoid reverting to unbounded message-heavy list queries.
- Plain-English ticket UI is already a doctrine in `ticket-display.ts`; do not show raw enums to operators.

### Integration Points
- Database migration extends `ticket_source` additively and updates defaults/backfill carefully.
- In-app/manual support tickets are created in `send-support-ticket`.
- Sentry tickets flow through `ingest_sentry_ticket`; Phase 18 should preserve its race-safe RPC pattern.
- Watchdog/internal ticket creation lives outside this repo in `/Users/admin/dev/autopilot`.
- Admin Center Tickets and Dashboard need coordinated source labels and metrics so the same source means the same thing in both places.

</code_context>

<specifics>
## Specific Ideas

- User preference: "op facing labels stay plain english easy to understand."
- User preference: leave legacy/manual presentation as "reported by" rather than spending Phase 18 on unnecessary historical reclassification.
- User preference: group by source with a source summary only if easy; otherwise keep implementation simple with filter/column/labels.
- User preference: per-source metrics should appear in both Dashboard and Tickets contexts.

</specifics>

<deferred>
## Deferred Ideas

- Nightly QA ticket ingestion and flake suppression remain Phase 20.
- Sentry debug/fix/resolve and debounce remain Phase 21.
- Reporter comms that depend on trustworthy `source=in-app-user` remain Phase 23.
- Survival/autonomy/canary metrics remain Phase 19.

### Reviewed Todos (not folded)
- "Apply 15-min compliance posture fixes (GitHub + Vercel + Supabase + Cloudflare)" — unrelated to Phase 18.
- "Resync updated Fathom call metadata" — unrelated to ticket source attribution.

</deferred>

---

*Phase: 18-source-attribution*
*Context gathered: 2026-06-13*
