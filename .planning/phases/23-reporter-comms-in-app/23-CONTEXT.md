# Phase 23: Reporter Comms (In-App) - Context

**Gathered:** 2026-06-13
**Status:** Ready for planning
**Source:** Authored from ROADMAP + REQUIREMENTS (RSP-01/02/03) + STATE + `.planning/design/escalation-tier2-solutions-not-problems.md`. Discuss skipped — direction specified; defaults flagged. This is the milestone finale (close the human loop).

<domain>
## Phase Boundary

Close the human loop: give IN-APP reporters status, resolution summaries, and escalation messages — WITHOUT ever messaging a customer about an error they never reported. Hard-gated on `source = in-app-user` (Phase 18 attribution, now live). In scope: status updates (RSP-01), resolution summary + content filter (RSP-02), escalation-not-silence (RSP-03). Out of scope: external email blasts; any comms to Sentry/QA/internal-sourced tickets.
</domain>

<decisions>
## Implementation Decisions

### D-00 — HARD GATE: only `source='in-app-user'` ever gets customer comms [LOCKED — the whole point of Phase 18→23]
NO comms fire for `sentry`, `nightly_qa`, `internal`, `manual`(non-in-app), or `unknown` sources. A Sentry/QA/internal ticket must stay customer-silent. This is Pitfall 7 — sending comms before trustworthy attribution emails customers about errors they never reported. Gate every comms path on `source = in-app-user`; fail closed (no source / uncertain → no comms).

### D-01 — In-app status updates on ticket state change (RSP-01) [LOCKED]
An in-app reporter receives a status update when THEIR ticket moves (received / in-progress / resolved). Reuse the existing `user_notifications` outbox (no new comms vendor). Fired only when `source='in-app-user'`.

### D-02 — Resolution summary + default-deny content filter (RSP-02) [LOCKED]
On verified-stable deploy (reuse Phase 17/21 verifyDeploySha), post an auto-generated, plain-English resolution summary in-app. Pass it through a DEFAULT-DENY content filter that REDACTS: file paths, SHAs, stack traces, and the word "agent" (and AI-internal tells). Default-deny = allow only customer-safe plain language; when in doubt, redact. Aligns with brand ("AI-ready, not AI-powered" — never expose the agent/AI internals to customers).

### D-03 — Escalation = a human-readable status, never silence (RSP-03) [LOCKED]
When autopilot can't fix a ticket, the in-app reporter gets a human-readable escalation status ("we're on it, a person is looking" tone) — NOT silence and NOT a raw problem dump. Customer-facing sibling of the operator tier-2 "solutions not problems" law: the reporter sees reassurance + status, never internals.

### Claude's Discretion
Exact notification copy templates; the content-filter implementation (regex/allowlist redactor); where the comms trigger hooks into the ticket lifecycle (Edge Function vs daemon). Reuse `user_notifications`, Resend `fetch`, verifyDeploySha, ticket lifecycle events.
</decisions>

<canonical_refs>
## Canonical References
- Source attribution (the gate): Phase 18 migrations (`ticket_source`, `in_app_user` value), `src/lib/ticket-display.ts`
- Existing comms outbox: `user_notifications` table + Resend `fetch` (find the existing send path — STATE says reuse it)
- Verified-stable signal: `~/dev/autopilot/src/lib/approval.ts` verifyDeploySha; Phase 21 deferred resolve sweep (same "on verified-stable" trigger shape)
- Ticket lifecycle events: `ticket_events`, `tickets.status`
- `.planning/design/escalation-tier2-solutions-not-problems.md` (customer-facing sibling of the operator digest), `docs/architecture/autopilot-brain-ownership.md`
- Brand: no "AI-powered" / "AI-ready not AI-powered" — the "agent" redaction in D-02 enforces this customer-side
</canonical_refs>

<specifics>
## Specific Ideas
- The hard `source='in-app-user'` gate is why Phase 18 was a HARD dependency before this phase. Phase 18 is done; the gate is now safe to build on.
- Content filter is DEFAULT-DENY (redact unless known-safe), not default-allow — a leaked file path/SHA/"agent" to a customer is a brand failure.
- Reuse user_notifications + Resend — zero new comms vendor (STATE Key Decision).
</specifics>

<deferred>
## Deferred Ideas
- External/email comms beyond the existing Resend outbox; comms to non-in-app sources (forbidden); FEAT lane → v2.1.
</deferred>

---
*Phase: 23-reporter-comms-in-app · authored 2026-06-13 (discuss skipped — direction pre-specified) · MILESTONE FINALE*
