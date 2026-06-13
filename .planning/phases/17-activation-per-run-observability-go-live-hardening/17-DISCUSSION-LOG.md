# Phase 17: Activation + Per-Run Observability + Go-Live Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-13
**Phase:** 17-activation-per-run-observability-go-live-hardening
**Areas discussed:** Go-live cutover, Test-integrity gate, Rebase-conflict handling, Per-run observability

**Mode:** Andrew declined the gray-area selection and instructed "go ahead with assumptions" — decisions below were made by Claude from the research-converged defaults and accepted.

---

## Go-Live Cutover Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Shadow-then-live, human-approval ON | Kill switch off; loop fixes real tickets autonomously but every merge requires Andrew's approval. No auto-merge until Phase 19. | ✓ |
| Straight to autonomous merge on safe categories | Auto-merge proven categories immediately | |
| Category-restricted live (allow-list) | Only certain ticket categories eligible at first | |

**User's choice:** Assumptions accepted — shadow-then-live, human-approval on every merge; low volume (~3–5/day, NOT the 25–30 target); denylist (not an allow-list) governs eligibility.
**Notes:** "Going live" = the loop claims and fixes real tickets; it does NOT yet merge autonomously. Auto-approve is Phase 19 (TRU-02).

---

## Test-Integrity Gate (ACT-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Mechanical hard-block, default-deny | Non-LLM check in push-gate; trips on test-deletion / .skip/.only / assertion-weakening; human approval is the override | ✓ |
| Allow-with-flag bypass | Gate can be bypassed with a flag for legit test changes | |
| LLM-judged test legitimacy | Model decides whether a test change is acceptable | |

**User's choice:** Assumptions accepted — mechanical, non-LLM, hard-block; legit test changes handled by the human-approval layer, not a gate bypass.
**Notes:** Gate is the only authority boundary; keep it deterministic.

---

## Rebase-Conflict Handling (ACT-06)

| Option | Description | Selected |
|--------|-------------|----------|
| Abort → destroy worktree → requeue (retry cap) → escalate | Treat conflict as retryable defer; after ~2–3 attempts, page Andrew | ✓ |
| Escalate to human immediately | No retry; first conflict pages | |
| Skip rebase / block | Don't rebase; block the ticket | |

**User's choice:** Assumptions accepted — abort + requeue with retry cap ~2–3, then escalate; never force-push, never skip rebase.
**Notes:** Mirrors the existing `detectRateLimit()` retryable-defer pattern.

---

## Per-Run Observability (ACT-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Extend AdminTab (runner_state card + TicketDetailDialog) | No new tab; per-run list off the existing card, detail folds into evidence bundle | ✓ |
| New dedicated "Runs" view/tab | Separate top-level observability surface | |

**User's choice:** Assumptions accepted — extend existing AdminTab surfaces; at-a-glance shows status/gate-verdict/duration/cost/pass-fail, drill-down shows diff/test-output/gate-reasoning.
**Notes:** One-Click / KISS-UX — reuse the 16-01 runner_state card and existing evidence rendering.

---

## Claude's Discretion

- Exact `maxRuns` value within ~3–5/day, precise retry cap (2 vs 3), AdminTab component layout.
- Whether the test-integrity check is an inline `push-gate.sh` function or an invoked helper (must stay deterministic/non-LLM, inside the gate).

## Deferred Ideas

- Throughput toward 25–30/day → Phase 19 (ACT-02).
- Autonomy ladder / auto-approve, survival metric, canary → Phase 19 (TRU).
- Compliance posture-fixes todo (score 0.2) — unrelated; remains in pending/.
