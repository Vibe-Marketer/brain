# Design Principle: Tier-2 Escalation + "Solutions, Not Problems"

**Status:** Binding (Andrew, 2026-06-13). Applies to Phases 18, 19, 20, 23 and any agent→operator surface.

## The law
**No agent ever surfaces a problem. It surfaces a solution and a proposed resolution.**
Raw problem reports / finger-pointing / stack-trace dumps are banned for operator-facing output — "that's basically what Sentry does already." The operator's attention is the scarce resource; offloading un-triaged problems back onto Andrew is a failure mode, not a feature.

## Two-tier escalation (no human in tier-1 review)
1. **Tier 1 — autopilot fix loop** (currently Codex / gpt-5.5). Claims, attempts, gate-verifies. If it *cannot* safely fix, it does **NOT** escalate to Andrew. It enqueues to Tier 2. (Today it wrongly hands a GitHub issue + "handed off to a developer/agent" message straight at the operator — that is the behavior to replace.)
2. **Tier 2 — second-opinion reviewer.** A **different model on a different cadence** (scheduled, e.g. cron / launchd): candidates are Don/PAI (Claude on this machine) or a Hermes/Codex agent. Tier-2:
   - Re-investigates the escalated ticket from scratch (fresh context, different model family → catches tier-1 blind spots; mirrors the PAI cross-vendor auditor "Cato" pattern).
   - **Fixes what it can** autonomously (subject to the same push-gate / safety boundaries).
   - For the true residue only, emits an **operator digest**.
3. **Operator digest = the ONLY thing Andrew sees.** Format:
   - Plain-English **1–2 sentences**: what's happening + why it matters.
   - **2–3 simple decisions** (yes/no or a/b/c), each with a **recommended** resolution.
   - Never a raw error dump.

## Diversity requirement
Tier-2 must be a **different model family** than tier-1 for genuine second-opinion value. Tier-1 Codex → Tier-2 Claude (or vice-versa). Same-model re-runs share blind spots and add little.

## Mapping to roadmap
- **Phase 18 (Source Attribution):** prerequisite — tier-2 routing and the operator digest both key on accurate source.
- **Phase 19 (Trust / autonomy ladder):** tier-2 is itself a trust mechanism; the autonomy ladder governs what tier-2 may auto-fix vs must surface as a decision.
- **Phase 20 (Flake suppression):** noise never reaches tier-2; only reproduced, real, non-by-design findings escalate.
- **Phase 23 (Reporter comms):** the operator digest is the internal sibling of customer-facing comms; same "solutions not problems" rule, different audience.
