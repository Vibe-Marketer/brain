<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

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

### Deferred Ideas (OUT OF SCOPE)
- Nightly QA ticket ingestion and flake suppression remain Phase 20.
- Sentry debug/fix/resolve and debounce remain Phase 21.
- Reporter comms that depend on trustworthy `source=in-app-user` remain Phase 23.
- Survival/autonomy/canary metrics remain Phase 19.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SRC-01 | Every ticket carries its true origin: extend `ticket_source`, fix QA/manual mis-attribution, watchdog/internal tickets stamp `internal`, legacy rows back-fill to `unknown`. | Additive enum migration, source-stamping fixes in `send-support-ticket`, `ingest_sentry_ticket`, `/Users/admin/dev/autopilot/src/watchdog.ts`, and QA triage path; backfill guidance below. [VERIFIED: codebase] |
| SRC-02 | AdminTab can filter and group tickets by source. | Existing `TicketFilters.source`, `TicketsSection` source select, `TicketTable` source column, and `ticketSourceLabel()` make this a small extension rather than a new surface. [VERIFIED: codebase] |
| SRC-03 | Per-source metrics: volume, fix rate, and cycle time tracked per origin. | Existing dashboard service already aggregates ticket status counts; add a per-source aggregate service/RPC and render it in Dashboard + Tickets summary. [VERIFIED: codebase] |
</phase_requirements>

## Executive Summary

Phase 18 is a schema-and-surface correction, not a new subsystem. The current ticket model already has one `tickets` table with a `source` column, existing Admin Center source filtering, a source column, and display humanizers. The gap is that the enum only has `manual | sentry`, operational sources are forced into `manual`, and metrics are currently status-only. [VERIFIED: codebase]

The planner should split this phase into four narrow work items: database/type contract, intake stamping, frontend labels/filter/grouping, and per-source metrics. Do not implement the Phase 20 `ingest_qa_ticket` RPC yet, but do stop the known active QA mis-attribution by updating the current QA triage path if Phase 20 has not replaced it. [VERIFIED: codebase]

Confidence: HIGH for schema/UI/service paths; MEDIUM for live migration verification because this research did not push to a Supabase instance.

## Standard Stack

- Database: Supabase Postgres migrations in `supabase/migrations/*.sql`; `ticket_source` is a native Postgres enum and must be extended additively with `ALTER TYPE ... ADD VALUE IF NOT EXISTS`. [VERIFIED: codebase]
- Frontend: React 18 + Vite 5 + TanStack Query + Tailwind/shadcn in `src/`; service + hook separation is binding. [VERIFIED: codebase]
- Type source: `src/types/supabase.ts` is the active generated DB type file; `package.json` has `gen:types` writing there via `SUPABASE_DB_URL`. [VERIFIED: codebase]
- External daemon: watchdog/QA paths live outside this repo under `/Users/admin/dev/autopilot`, so a complete Phase 18 plan must include coordinated edits there. [VERIFIED: codebase]
- Package/dependency rule: zero new npm packages. This phase needs none. [VERIFIED: codebase]

## Current State

### Schema

- `supabase/migrations/20260611000002_create_ticket_tables.sql` creates `public.ticket_source AS ENUM ('manual', 'sentry')`, `tickets.source public.ticket_source NOT NULL DEFAULT 'manual'`, and RLS policies where reporters see their own tickets and admins see all. [VERIFIED: codebase]
- `supabase/migrations/20260612130000_sentry_ticket_ingestion.sql` relaxes `tickets.reporter_id` to nullable for system tickets and defines `ingest_sentry_ticket(...)`, which inserts `source='sentry'` with `reporter_id=NULL`. [VERIFIED: codebase]
- `src/types/supabase.ts` still has `ticket_source: "manual" | "sentry"`, so TypeScript will reject `unknown`, `nightly_qa`, or `internal` until types are regenerated or phase-local type extension is applied. [VERIFIED: codebase]
- RLS regression already lists `tickets`, `ticket_messages`, and `ticket_events`; fixtures currently insert reporter-owned default-manual tickets. [VERIFIED: codebase]

### Intake Paths

- In-app/person-reported tickets use `supabase/functions/send-support-ticket/index.ts`, authenticate via `_shared/auth.ts`, insert `reporter_id=userId`, and set `source: 'manual'`. Keep this behavior unless a planner intentionally adds `in_app_user`; the user decision says preserving `manual` as "Reported by a person" is acceptable. [VERIFIED: codebase]
- Sentry tickets use `supabase/functions/sentry-webhook/index.ts` -> `ingest_sentry_ticket`, which stamps `source='sentry'`. Do not alter debug/resolve/debounce behavior in this phase. [VERIFIED: codebase]
- Watchdog/internal tools-health tickets are created in `/Users/admin/dev/autopilot/src/watchdog.ts` with `source: "manual"` and `context.origin = "autopilot-watchdog"`; this is the clearest SRC-01 active bug. [VERIFIED: codebase]
- Nightly QA currently uses `/Users/admin/dev/autopilot/qa/triage.ts` to call the deployed `send-support-ticket` Edge Function with a password-grant user token, which necessarily produces `source='manual'`. This is the known QA `source:'manual'` bug. [VERIFIED: codebase]

### Admin UI and Services

- `src/services/tickets.service.ts` already exports `TicketSource`, supports `TicketFilters.source`, and applies `.eq('source', filters.source)` in `getTickets()`. [VERIFIED: codebase]
- `src/hooks/useTickets.ts` passes filters through TanStack Query and invalidates `['tickets']` on ticket mutation. [VERIFIED: codebase]
- `src/pages/admin/TicketsSection.tsx` already has a source filter select for `manual` and `sentry`; this is the primary SRC-02 extension point. [VERIFIED: codebase]
- `src/components/settings/TicketTable.tsx` already renders and sorts a source column via `ticketSourceLabel(ticket.source)`. [VERIFIED: codebase]
- `src/lib/ticket-display.ts` is the single source of truth for plain-English labels; it currently maps `manual` to "Reported by a person" and `sentry` to "Found automatically". Extend here first. [VERIFIED: codebase]
- `src/services/admin-dashboard.service.ts` currently returns `ticketsByStatus`, `totalTickets`, and `ticketsLast7d`; it does not calculate source metrics. [VERIFIED: codebase]
- `src/pages/admin/DashboardSection.tsx` renders ticket stat cards from `AdminDashboardStats`; add per-source metrics here rather than creating a new page. [VERIFIED: codebase]

## Recommended Architecture Pattern

### Pattern 1: Additive Enum + Safe Default

Create a migration such as `supabase/migrations/YYYYMMDDHHMMSS_source_attribution.sql` that:

```sql
ALTER TYPE public.ticket_source ADD VALUE IF NOT EXISTS 'unknown';
ALTER TYPE public.ticket_source ADD VALUE IF NOT EXISTS 'nightly_qa';
ALTER TYPE public.ticket_source ADD VALUE IF NOT EXISTS 'internal';
```

Then backfill only rows that are not confidently person-reported. Because current `manual` has mixed meaning, use a conservative update driven by operational context markers:

```sql
UPDATE public.tickets
SET source = 'unknown'
WHERE source = 'manual'
  AND reporter_id IS NULL;

UPDATE public.tickets
SET source = 'internal'
WHERE source = 'manual'
  AND context->>'origin' IN ('autopilot-watchdog');

UPDATE public.tickets
SET source = 'nightly_qa'
WHERE source = 'manual'
  AND (
    context->>'origin' = 'qa-nightly-crawler'
    OR context->>'userAgent' = 'qa-nightly-crawler'
    OR context->>'url' ILIKE '%qa%'
  );
```

Use the exact predicates after inspecting live/context rows during execution; do not blanket-convert all `manual` to `unknown`, because the user explicitly wants person-reported meaning preserved. [VERIFIED: codebase]

### Pattern 2: Source Stamping at Intake, Not After Insert

- Keep `send-support-ticket` as person-reported/manual unless it receives a deliberately server-trusted source path; do not let arbitrary clients pass `source` in the body. [VERIFIED: codebase]
- Keep `ingest_sentry_ticket` as the source-specific RPC pattern: service-role-only, SECURITY DEFINER, audit/notification inside the transaction. [VERIFIED: codebase]
- Change watchdog insert to `source: "internal"`. If the generated types in the autopilot repo reject it, update its local DB type union or regenerate types there too. [VERIFIED: codebase]
- For the current QA triage path, the clean long-term fix is Phase 20's `ingest_qa_ticket`. For Phase 18, either add a minimal service-role REST/RPC write path that stamps `nightly_qa`, or adjust current triage to insert tickets directly with service-role and `source: "nightly_qa"` while preserving dedupe behavior. Keep flake suppression and the full RPC swap out of scope. [VERIFIED: codebase]

### Pattern 3: Metrics as a Service Contract

Add a small typed service contract rather than embedding calculations in components:

```ts
export interface TicketSourceMetrics {
  source: TicketSource
  volume: number
  resolved: number
  fixRate: number
  averageCycleTimeHours: number | null
}
```

Preferred implementation: a SQL RPC/view that aggregates by source using `tickets` plus `ticket_events` for the first transition to `resolved`. `tickets.updated_at` is easy but less precise because priority, urgent, attempts, occurrence_count, and other non-resolution updates also touch it. [VERIFIED: codebase]

Planner-friendly SQL shape:

```sql
CREATE OR REPLACE FUNCTION public.ticket_source_metrics()
RETURNS TABLE (
  source public.ticket_source,
  volume bigint,
  resolved bigint,
  fix_rate numeric,
  avg_cycle_time_hours numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH resolved_events AS (
    SELECT ticket_id, min(created_at) AS resolved_at
    FROM public.ticket_events
    WHERE event_type = 'status_change'
      AND new_value = 'resolved'
    GROUP BY ticket_id
  )
  SELECT
    t.source,
    count(*) AS volume,
    count(*) FILTER (WHERE t.status = 'resolved') AS resolved,
    CASE WHEN count(*) = 0 THEN 0
      ELSE round((count(*) FILTER (WHERE t.status = 'resolved'))::numeric / count(*)::numeric, 4)
    END AS fix_rate,
    avg(extract(epoch FROM (re.resolved_at - t.created_at)) / 3600.0) AS avg_cycle_time_hours
  FROM public.tickets t
  LEFT JOIN resolved_events re ON re.ticket_id = t.id
  GROUP BY t.source
  ORDER BY t.source::text;
$$;
```

Guard this function to admins only, either by checking `public.has_role(auth.uid(),'ADMIN')` inside the function or by granting execute only as appropriate. Do not expose operational ticket metrics to reporters. [VERIFIED: codebase]

## Suggested Plan Breakdown

1. **Schema and types**
   - Add `unknown`, `nightly_qa`, and `internal` to `ticket_source`.
   - Add targeted backfill for nullable/system and known operational manual rows.
   - Add an index on `tickets(source, created_at DESC)` if list/metrics queries need it.
   - Regenerate `src/types/supabase.ts` from the migrated test/linked DB; confirm `ticket_source` includes all five values.

2. **Intake stamping**
   - Keep `send-support-ticket` stamping person reports as `manual`.
   - Keep Sentry stamping `sentry`.
   - Change `/Users/admin/dev/autopilot/src/watchdog.ts` tools-health ticket insert to `internal`.
   - Stop current QA triage from filing via `send-support-ticket` as manual; use a minimal `nightly_qa` stamping path without implementing Phase 20 flake suppression.

3. **Display labels and filtering**
   - Extend `ticketSourceLabel()` in `src/lib/ticket-display.ts` for `manual`, `sentry`, `nightly_qa`, `internal`, `unknown`.
   - Update `TicketsSection` source filter options and legend copy with plain-English labels.
   - Keep `TicketTable` source column; grouping/source summary can sit above the table as a compact strip if straightforward.

4. **Metrics**
   - Add `getTicketSourceMetrics()` in `src/services/tickets.service.ts` or `src/services/admin-dashboard.service.ts`.
   - Add a hook only if needed for Tickets page; dashboard can receive metrics through `fetchDashboardStats()`.
   - Render volume, fix rate, and average cycle time per source in Dashboard stats and a compact Tickets source summary.

5. **Verification and deployment prep**
   - Unit-test display labels, source filtering, and dashboard metrics mapping.
   - Integration-test enum acceptance, source backfill, and metrics function against a dedicated test DB when env allows.
   - Build/type-check after generated types change.

## Don't Hand-Roll

- Do not add a separate ticket table per source; the architecture is one `tickets` table, many sources. [VERIFIED: codebase]
- Do not accept arbitrary `source` from the browser support form; person-reported/manual source is server-owned. [VERIFIED: codebase]
- Do not infer reporter comms eligibility here; Phase 23 owns comms, and this phase only makes source reliable enough for it. [VERIFIED: codebase]
- Do not use `tickets.updated_at` as the only source of truth for cycle time if a lifecycle event is available; `updated_at` is touched by non-status updates. [VERIFIED: codebase]
- Do not add Lucide/FontAwesome/framer-motion or any new dependency for source badges/summary. [VERIFIED: codebase]
- Do not create a new AdminTab/page; extend existing Admin Center Dashboard and Tickets surfaces. [VERIFIED: codebase]

## Common Pitfalls

1. **Forgetting `unknown`.** The requirement text explicitly needs legacy rows back-filled to `unknown`, even though the phase description only calls out adding `nightly_qa` and `internal`. Plan the enum as `manual | sentry | unknown | nightly_qa | internal`. [VERIFIED: codebase]
2. **Blanket backfill of `manual`.** Current `manual` includes real person reports and operational mis-stamps. Converting all manual rows to `unknown` would erase useful person-reported history; converting all to person-reported would make Phase 23 unsafe. Use targeted predicates. [VERIFIED: codebase]
3. **Generated type drift.** `TicketSource` comes from `src/types/supabase.ts`; frontend source options will not type-check until the enum union is updated. [VERIFIED: codebase]
4. **Nullable reporter handling.** `getTickets()` currently builds `reporterIds` from `rows.map(row.reporter_id)` even though `reporter_id` is nullable in generated types. The planner should make this null-safe before adding more system sources. [VERIFIED: codebase]
5. **Sentry scope creep.** `sentry-webhook` already persists Sentry context and stamps `sentry`; do not pull Phase 21 debug/resolve/debounce work into Phase 18. [VERIFIED: codebase]
6. **QA scope creep.** The source bug must be fixed, but full `ingest_qa_ticket`, DB dedupe, rerun quarantine, and actionability gates are Phase 20. [VERIFIED: codebase]
7. **Metrics false precision.** Averages over old mixed-source legacy rows should either include `unknown` as its own bucket or show "Unknown source"; do not silently merge them into person-reported. [VERIFIED: codebase]
8. **External repo omission.** Updating only `/Users/admin/dev/brain` leaves watchdog and current QA triage still mis-stamping tickets. [VERIFIED: codebase]

## Code Examples

### Display Labels

```ts
export function ticketSourceLabel(source: string | null | undefined): string {
  switch (source) {
    case "manual":
      return "Reported by a person";
    case "sentry":
      return "Found by Sentry";
    case "nightly_qa":
      return "Found by nightly QA";
    case "internal":
      return "Internal watchdog";
    case "unknown":
      return "Unknown source";
    default:
      return source ? prettify(source) : "Unknown source";
  }
}
```

### Source Option List

```ts
export const TICKET_SOURCE_OPTIONS: Array<{ value: TicketSource | "all"; label: string }> = [
  { value: "all", label: "All Sources" },
  { value: "manual", label: "Reported by a person" },
  { value: "sentry", label: "Found by Sentry" },
  { value: "nightly_qa", label: "Found by nightly QA" },
  { value: "internal", label: "Internal watchdog" },
  { value: "unknown", label: "Unknown source" },
];
```

### Null-Safe Reporter Lookup

```ts
const reporterIds = [
  ...new Set(rows.map((row) => row.reporter_id).filter((id): id is string => Boolean(id))),
];

const tickets = rows.map((row) => ({
  ...row,
  reporter: row.reporter_id
    ? reporterMap.get(row.reporter_id) ?? row.reporter_id
    : ticketSourceLabel(row.source),
}));
```

## Tests and Verification

| Requirement | Test Type | Suggested Command | Notes |
|-------------|-----------|-------------------|-------|
| SRC-01 enum/backfill/stamping | Integration + source-level | `npm run test:integration -- src/test/tickets-audit.integration.test.ts` or targeted Vitest after adding cases | Must run only against dedicated test DB; skip cleanly when env is absent. [VERIFIED: codebase] |
| SRC-01 display types | Type-check/build | `npm run type-check && npm run build` | Required after `src/types/supabase.ts` regeneration. [VERIFIED: codebase] |
| SRC-02 filters/labels | Unit | `npm test -- src/services/__tests__/tickets.service.test.ts` plus new `ticket-display` tests | Existing service test already asserts source filter `.eq('source','sentry')`; add new values. [VERIFIED: codebase] |
| SRC-03 metrics | Unit + integration if RPC | `npm test -- src/services/__tests__/admin-dashboard.service.test.ts` | Extend dashboard test to cover `ticketSourceMetrics`. [VERIFIED: codebase] |
| Admin UI smoke | Browser/Playwright or dev-browser screenshot | `npm run dev` then screenshot `/admin/tickets` and `/admin/dashboard` | Required for UI changes; verify no raw enum labels. [VERIFIED: codebase] |
| External daemon stamping | Source/test in autopilot repo | Run the repo-native autopilot test/lint command after edit | This research did not inspect autopilot package scripts; planner should check before choosing the command. [VERIFIED: codebase] |

## Environment Availability

- CodeGraph index is present and healthy: 1,288 files, 14,063 nodes, 31,417 edges. [VERIFIED: codebase]
- Current `/Users/admin/dev/brain` worktree has unrelated untracked files: `.mcp.json`, `.planning/debug/autopilot-tickets-stuck-no-autofix.md`, `.planning/debug/signup-email-confirmation-setup.md`. Do not include or revert them for this phase. [VERIFIED: codebase]
- Integration test env was not probed in this research turn. Planner should treat real-DB integration verification as conditional on `.env.test` / `VITEST_INTEGRATION_OK=true`. [VERIFIED: codebase]
- This research did not run Supabase CLI migration/type generation because it is a planning artifact, not implementation. [VERIFIED: codebase]

## Open Questions (RESOLVED)

- RESOLVED — legacy backfill is conservative and predicate-driven per D-03. The executor must first sample linked DB `source='manual'` rows read-only with `supabase db query --linked`; only rows with high-confidence operational markers may be reclassified, such as `context->>'userAgent'` or equivalent QA crawler markers to `nightly_qa`, and watchdog-origin markers to `internal`. All other legacy rows remain as-is (`manual`/`unknown`) or become `unknown` only under the confirmed conservative predicate; they are never guessed into `in_app_user`, and there is no aggressive history rewrite. [VERIFIED: codebase]
- RESOLVED — Phase 18 uses the intentionally small direct service-role/minimal RPC path in current QA triage to stamp `nightly_qa`; full `ingest_qa_ticket`, flake suppression, and DB dedupe remain Phase 20. [VERIFIED: codebase]
- RESOLVED — Plan 03 requires repo-native autopilot tests and typecheck after source-stamping edits, so any generated type drift or script mismatch is caught during that plan. [VERIFIED: codebase]

## Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Schema/source taxonomy | HIGH | Current enum, migrations, generated types, Sentry RPC, and RLS policies were directly read. |
| Intake paths | HIGH | Person, Sentry, watchdog, and QA triage source paths were directly read. |
| Admin UI/filtering | HIGH | Existing filter, table column, and display label code were directly read. |
| Metrics implementation | MEDIUM | Existing dashboard stats were read; exact aggregate shape should be validated on live/test DB row volume and event history. |
| External daemon verification | MEDIUM | Relevant autopilot source files were read, but repo-native test commands were not audited. |

## RESEARCH COMPLETE
