---
phase: 17-activation-per-run-observability-go-live-hardening
plan: 02
type: execute
wave: 2
depends_on: [17-01-run-ledger-schema-and-emission]
files_modified:
  - src/services/admin-dashboard.service.ts
  - src/services/__tests__/admin-dashboard.service.test.ts
  - src/hooks/useAdminDashboard.ts
  - src/lib/query-config.ts
  - src/pages/admin/DashboardSection.tsx
  - src/components/settings/TicketDetailDialog.tsx
  - src/components/settings/__tests__/TicketDetailDialog.test.tsx
  - src/components/admin/TicketEvidence.tsx
  - src/components/admin/__tests__/TicketEvidence.test.tsx
autonomous: true
requirements: [ACT-04]
must_haves:
  truths:
    - "AdminTab extends the existing runner_state card; no new top-level tab is added."
    - "At-a-glance run list shows status, gate verdict, duration, cost display, and overall pass/fail."
    - "TicketDetailDialog/TicketEvidence show run detail: diff, tests, gate reasoning, rebase/replay outcome."
  artifacts:
    - path: "src/services/admin-dashboard.service.ts"
      provides: "Runner run list/detail reads"
    - path: "src/hooks/useAdminDashboard.ts"
      provides: "TanStack Query hooks for runner runs"
    - path: "src/pages/admin/DashboardSection.tsx"
      provides: "RunnerOpsCard per-run timeline/list"
    - path: "src/components/settings/TicketDetailDialog.tsx"
      provides: "Per-ticket run evidence folded into existing detail"
  key_links:
    - from: "DashboardSection.tsx"
      to: "useAdminDashboard.ts"
      via: "service+hook separation; no inline Supabase calls"
      pattern: "useRunnerRuns"
    - from: "TicketDetailDialog.tsx"
      to: "TicketEvidence.tsx"
      via: "existing evidence bundle rendering"
      pattern: "TicketEvidence"
---

<objective>
Surface the run ledger in the existing AdminTab surfaces.

Purpose: ACT-04 is operator visibility, not a new navigation concept. Per D-09 and D-10, AdminTab must show run status, gate verdict, duration, cost display, pass/fail, and drill-down details without implying per-token billing.
Output: service/hook reads, runner card list, ticket-detail run evidence, tests.
</objective>

## Artifacts This Phase Produces

- AdminDashboard service/hook reads for `runner_runs`.
- A compact per-run list/timeline under the existing runner card.
- Per-ticket run details in the existing evidence/dialog surface.

<execution_context>
@$HOME/.codex/gsd-core/workflows/execute-plan.md
@$HOME/.codex/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/17-activation-per-run-observability-go-live-hardening/17-CONTEXT.md
@.planning/phases/17-activation-per-run-observability-go-live-hardening/17-PATTERNS.md
@src/CLAUDE.md
@CLAUDE.md
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add runner-run service and hook reads</name>
  <files>[brain] src/services/admin-dashboard.service.ts, src/services/__tests__/admin-dashboard.service.test.ts, src/hooks/useAdminDashboard.ts, src/lib/query-config.ts</files>
  <read_first>src/services/admin-dashboard.service.ts, src/services/__tests__/admin-dashboard.service.test.ts, src/hooks/useAdminDashboard.ts, src/lib/query-config.ts, src/types/supabase.ts</read_first>
  <behavior>
    - `fetchRunnerRuns(limit)` returns newest run rows with status, outcome, gate verdict/stage, duration, cost display, ticket id, branch, fix SHA, and diff/test summary fields.
    - `fetchRunnerRunsForTicket(ticketId)` returns only rows for that ticket.
    - Hooks use TanStack Query factory keys and never call Supabase directly from components.
  </behavior>
  <action>Extend the existing admin-dashboard service/hook pattern for `runner_runs`. Use generated types from Plan 01. Keep services pure async TypeScript and hooks as TanStack Query wrappers. Use query keys from `src/lib/query-config.ts`; add `admin.runnerRuns()` and `admin.runnerRunsForTicket(ticketId)` only if no existing key fits. Handle missing/empty rows as an empty list, not as a UI crash. Do not add new packages, chart libraries, or direct component queries.</action>
  <verify>
    <automated>npm test -- src/services/__tests__/admin-dashboard.service.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - Service tests cover success, empty list, Supabase error, and per-ticket filtering.
    - Components do not import Supabase or services directly for run reads.
    - Query keys are stable and invalidate/refetch on the same cadence as runner state.
  </acceptance_criteria>
  <done>Admin run data is available through the locked service+hook pattern.</done>
</task>

<task type="auto">
  <name>Task 2: Render the runner card run list</name>
  <files>[brain] src/pages/admin/DashboardSection.tsx, src/services/__tests__/admin-dashboard.service.test.ts</files>
  <read_first>src/pages/admin/DashboardSection.tsx, src/hooks/useAdminDashboard.ts, src/CLAUDE.md, .planning/phases/17-activation-per-run-observability-go-live-hardening/17-CONTEXT.md</read_first>
  <action>Extend the existing runner_state card in `DashboardSection.tsx` with a compact per-run list/timeline. At a glance, render run status, overall pass/fail, gate verdict and stage, duration, and cost display. Use `est_cost` as a display/budget-use field only; copy must not say per-token, dollar meter, or "AI-powered". Use existing shadcn/Tailwind tokens and Remix icons if needed. Preserve the current kill-switch and runner-state controls. Per D-09, do not add a new top-level tab or a separate admin route.</action>
  <verify>
    <automated>npm test -- src/services/__tests__/admin-dashboard.service.test.ts && npm run build</automated>
  </verify>
  <acceptance_criteria>
    - Existing runner card remains the anchor; no new top-level tab/route is added.
    - Empty state is quiet and does not claim runs exist.
    - Status, gate, duration, and cost display fit at desktop and mobile widths without overlapping.
  </acceptance_criteria>
  <done>Admin can scan recent autonomous runs from the existing dashboard card.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Fold per-ticket run details into existing evidence views</name>
  <files>[brain] src/components/settings/TicketDetailDialog.tsx, src/components/settings/__tests__/TicketDetailDialog.test.tsx, src/components/admin/TicketEvidence.tsx, src/components/admin/__tests__/TicketEvidence.test.tsx</files>
  <read_first>src/components/settings/TicketDetailDialog.tsx, src/components/admin/TicketEvidence.tsx, src/hooks/useAdminDashboard.ts, .planning/phases/17-activation-per-run-observability-go-live-hardening/17-PATTERNS.md</read_first>
  <behavior>
    - Ticket detail shows run-level diff/test/gate/rebase/replay detail for the selected ticket.
    - Evidence rendering remains markdown/text-safe; no HTML injection.
    - Tickets with no run rows keep the existing dialog layout without an empty noisy section.
  </behavior>
  <action>Use the per-ticket hook from Task 1 inside the existing ticket detail/evidence composition. Show full diff stat, test command/exit, test output tail if available, gate reasoning/stage, rebase result, and repro replay outcome from the ledger detail JSON/evidence. Keep this inside `TicketDetailDialog` and `TicketEvidence`; do not create a separate modal or tab. Render as React text/markdown-safe content only; do not use `dangerouslySetInnerHTML`.</action>
  <verify>
    <automated>npm test -- src/components/settings/__tests__/TicketDetailDialog.test.tsx src/components/admin/__tests__/TicketEvidence.test.tsx && npm run build</automated>
  </verify>
  <acceptance_criteria>
    - Tests cover run details present, no-run row absent state, and text-safe rendering.
    - The dialog keeps existing ticket evidence behavior for older messages.
    - Build exits 0.
  </acceptance_criteria>
  <done>Admin can drill into a ticket and see the run's diff/tests/gate/replay evidence in place.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Supabase `runner_runs` -> admin DOM | operational logs and diffs render in browser |
| ticket evidence -> markdown/text renderer | agent-authored evidence reaches UI |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-17-05 | Information Disclosure | Admin run UI | mitigate | Rely on `runner_runs` admin-only RLS; mount only inside admin shell |
| T-17-06 | Injection | TicketEvidence detail fields | mitigate | Render as React text/markdown-safe content; no `dangerouslySetInnerHTML` |
| T-17-07 | Spoofing | misleading cost display | mitigate | Label cost as existing estimate/budget display, not a per-token dollar meter |
| T-17-SC | Tampering | package installs | mitigate | Zero new packages; Remix icons only |
</threat_model>

<verification>
- Targeted service/component tests exit 0.
- `npm run build` exits 0.
- Browser screenshot of `/admin/dashboard` shows the runner card run list and no overlapping text.
</verification>

<success_criteria>
ACT-04 UI is complete in the existing AdminTab: recent runs are scannable and per-ticket run evidence is drillable without a new top-level tab.
</success_criteria>

<output>
Create `.planning/phases/17-activation-per-run-observability-go-live-hardening/17-02-SUMMARY.md` when done.
</output>
