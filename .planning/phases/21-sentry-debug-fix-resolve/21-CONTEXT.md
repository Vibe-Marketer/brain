# Phase 21: Sentry Debug → Fix → Resolve - Context

**Gathered:** 2026-06-13
**Status:** Ready for planning
**Source:** Authored from ROADMAP + REQUIREMENTS (SEN-03/04/05) + STATE research flags + `.planning/design/escalation-tier2-solutions-not-problems.md`. Discuss skipped — direction specified; open questions flagged for research to resolve.

<domain>
## Phase Boundary

Add the enrichment-and-write-back layer on top of v1.0 Sentry ingestion (SEN-01/02 already ship `ingest_sentry_ticket`): auto-debug Sentry errors into the fix loop and mark them resolved in Sentry — safely, only on a verified-stable deploy. In scope: gsd-debug+Honcho debug brief (SEN-03), cycle-time/debounce/severity-priority (SEN-04), the `sentry-resolve` Edge Function with SHA-verified-stable write-back + per-fingerprint cap + oscillation paging (SEN-05). Out of scope: changing v1.0 ingestion; recurrence→structural (Phase 22); customer comms (Phase 23).
</domain>

<decisions>
## Implementation Decisions

### D-01 — Auto-debug brief feeds the fix loop (SEN-03) [LOCKED]
Sentry errors are auto-debugged via a gsd-debug-disciplined + Honcho-memory brief (Honcho session keyed by fingerprint), and routed into the existing autopilot fix loop. Reuse the loop — do not fork a separate runner.

### D-02 — Cycle-time + debounce + severity priority (SEN-04) [LOCKED]
Track error→ticket→fix→resolve cycle time with a resolve-ASAP target. Severity boosts priority. Harden fingerprint dedup with a DEBOUNCE: a minimum post-deploy occurrence count before a fingerprint tickets, to prevent transient-spike ticket storms.
- **Default debounce: a fingerprint must recur ≥3 times within a 15-minute window post-ingestion before it becomes a fixable ticket.** `[Claude's default — Andrew may override]`

### D-03 — Resolution write-back, verified-stable only (SEN-05) [LOCKED]
A NEW `sentry-resolve` Edge Function holds `SENTRY_AUTH_TOKEN` (scope `event:write`, already in .env) and marks the issue resolved ONLY on a SHA-matched verified-stable deploy (the deployed commit == the fix commit AND a post-deploy quiet window passed). NEVER resolve-on-merge (manufactures false-regression storms). A per-fingerprint fix cap freezes the category (never global) and pages on oscillation.
- **Default fix cap: ≤3 autonomous fix attempts per fingerprint; on the 4th regression, FREEZE that fingerprint/category (no more autonomous fixes) and page. Post-deploy quiet window: 30 min before resolve write-back.** `[Claude's default — Andrew may override]`

### D-04 — Resolve write-back is outward-facing [LOCKED]
Marking a real issue resolved on the live `ai-simple.sentry.io` org is outward-facing/irreversible-ish. The write-back path must be gated, idempotent, and only fire on verified-stable deploys. The BUILD is safe to ship; the write-back only triggers on the real conditions.

### Claude's Discretion
Schema for cycle-time + per-fingerprint cap state; exact gsd-debug invocation in the runner's headless session; Honcho session API usage; debounce storage. Reuse `ingest_sentry_ticket`, `runner_runs`, the deploy-SHA verification from Phase 17 (`verifyDeploySha`), and the tier-2/paging mechanisms from Phase 19.
</decisions>

<research_to_resolve>
## Open questions for RESEARCH to resolve (from STATE)
1. Whether `gsd-debug` runs non-interactively inside the runner's headless `claude` session (and how to invoke it disciplined/non-interactive).
2. Honcho session lifecycle keyed by fingerprint (create/reuse/expire).
3. Exact Sentry resolve endpoint + token scope + project mapping against the live `ai-simple.sentry.io` org; CONFIRM `issue_id` / `org_slug` are persisted at ingestion (needed to address the resolve API). Check `SENTRY_ORG`/`SENTRY_PROJECT` in .env and the v1.0 ingestion path.
</research_to_resolve>

<canonical_refs>
## Canonical References
- v1.0 Sentry ingestion: `supabase/migrations/*sentry_ticket_ingestion*.sql` (`ingest_sentry_ticket`), `.github/workflows/sentry-autofix.yml`
- Deploy-SHA verification: `~/dev/autopilot/src/lib/approval.ts` (`verifyDeploySha`) — reuse for the verified-stable gate
- Tier-2 + paging: `~/dev/autopilot/src/lib/tier2.ts`, Phase 19 trust/paging
- `.planning/design/escalation-tier2-solutions-not-problems.md`, `docs/architecture/autopilot-brain-ownership.md`
- Honcho MCP tools (mcp__plugin_honcho_honcho__*) for session/memory
</canonical_refs>

<specifics>
## Specific Ideas
- The `sentry-resolve` Edge Function is the only new secret holder — `SENTRY_AUTH_TOKEN` already present in .env (org/project too).
- Debounce + per-fingerprint cap are the storm/oscillation guards — co-ship with the auto-resolve (never auto-resolve without them).
- Resolve only when deployed SHA == fix SHA (reuse Phase 17 verifyDeploySha) + quiet window elapsed.
</specifics>

<deferred>
## Deferred Ideas
- Recurrence → structural fix → Phase 22. Customer comms → Phase 23. No changes to v1.0 ingestion.
</deferred>

---
*Phase: 21-sentry-debug-fix-resolve · authored 2026-06-13 (discuss skipped — direction pre-specified; open questions flagged for research)*
