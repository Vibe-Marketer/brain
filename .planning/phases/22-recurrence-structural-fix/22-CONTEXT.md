# Phase 22: Recurrence → Structural Fix - Context

**Gathered:** 2026-06-13
**Status:** Ready for planning
**Source:** Authored from ROADMAP + REQUIREMENTS (REC-01/02) + STATE + `.planning/design/escalation-tier2-solutions-not-problems.md`. Discuss skipped — direction specified; defaults flagged.

<domain>
## Phase Boundary

Turn a history of resolved tickets into the primary lever for driving ticket RATE down: detect recurring ticket CLASSES (fingerprint/category clustering across resolved tickets) and escalate each class to a STRUCTURAL fix that kills the class, not a per-instance patch. Track that the structural fix observably drives the class's recurrence rate down. In scope: clustering/detection (REC-01), structural-fix escalation (REC-02), recurrence-rate observability. Out of scope: customer comms (Phase 23); the auto-push bug lane stays per-instance.
</domain>

<decisions>
## Implementation Decisions

### D-01 — Cluster resolved tickets into classes (REC-01) [LOCKED]
Detect recurring classes by clustering across RESOLVED tickets on fingerprint/category (reuse the Phase 18 `source`+error-class taxonomy and the existing fingerprint scheme). A "class" = a cluster of tickets sharing a fingerprint/category root. Cluster over resolved history (60+ resolved tickets exist).
- **Default detection threshold: ≥3 resolved tickets sharing a fingerprint/category root within a rolling 30-day window → flagged as a recurring class.** `[Claude's default — Andrew may override]`

### D-02 — Escalate a recurring class to a STRUCTURAL-fix task (REC-02) [LOCKED]
When a class crosses the threshold, create a structural-fix TASK that targets the class root (the shared cause), not any single instance. This is the primary ticket-rate-down lever.

### D-03 — Structural fixes route through tier-2/admin-approval, NEVER autonomous auto-push [LOCKED — blast-radius principle]
A structural fix is higher blast radius than a per-instance bug fix (it changes shared code/behavior). Per the established principle (FEAT deferred for blast radius; high-risk → human/tier-2), a structural-fix task is surfaced as a SOLUTION-SHAPED recommendation to the tier-2/admin-approval lane (what the class is, why it recurs, the proposed structural fix, 2-3 a/b/c options) — it is NEVER pushed by the autonomous bug lane. Reuse the tier-2 digest (Phase 19) and the autonomy ladder. Andrew approves structural fixes explicitly.

### D-04 — Recurrence-rate observability (criterion 3) [LOCKED]
Track per-class recurrence rate so a structural fix's effect is observable: the class's fresh-ticket rate before vs after the fix lands. Surface in AdminTab. A class whose rate drops to ~0 post-fix is "killed."

### Claude's Discretion
Class identity/schema (a `ticket_classes` table or a derived clustering view); how the structural-fix task is represented (a special ticket type/lane vs a tier-2 digest entry); the exact clustering query. Reuse fingerprint scheme, `runner_runs`, tier-2 digest, autonomy-ladder gating, admin surfaces.
</decisions>

<canonical_refs>
## Canonical References
- Phase 18 attribution + fingerprint taxonomy: `supabase/migrations/*extend_ticket_source_enum*`, `*source_attribution*`; `src/lib/ticket-display.ts`
- Tier-2 digest + autonomy ladder (route structural fixes here): `~/dev/autopilot/src/lib/tier2.ts`, `src/lib/trust.ts`, Phase 19 trust schema
- Resolved-ticket history: `tickets` (status='resolved'), `runner_runs` ledger
- Admin surfaces: `src/pages/admin/DashboardSection.tsx`, `src/services/admin-dashboard.service.ts`
- `.planning/design/escalation-tier2-solutions-not-problems.md`, `docs/architecture/autopilot-brain-ownership.md`
</canonical_refs>

<specifics>
## Specific Ideas
- Cross-source fingerprint namespacing (Phase 20 Med-1 follow-up) is relevant here — clustering keys on fingerprint, so confirm QA/Sentry fingerprint spaces don't collide when forming classes; namespace if needed (this is the natural phase to address it).
- "Drives ticket rate down" is the whole milestone thesis — this phase is where recurrence becomes the measured lever.
</specifics>

<deferred>
## Deferred Ideas
- Customer comms → Phase 23. Auto-push of structural fixes → never (admin-approval only). FEAT lane → v2.1.
</deferred>

---
*Phase: 22-recurrence-structural-fix · authored 2026-06-13 (discuss skipped — direction pre-specified)*
