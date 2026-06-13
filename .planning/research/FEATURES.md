# Feature Research

**Domain:** Autonomous software-ops loop (self-healing) — turning an armed-but-idle autopilot daemon ON and broadening it across Sentry triage, nightly QA, reporter comms, source attribution, and feature dev
**Researched:** 2026-06-12
**Confidence:** HIGH (industry patterns well-documented: Sentry Seer/Autofix, Slack flake suppression, SRE phased-autonomy ladders, support-ticket comms playbooks; existing CallVault surface fully mapped in the autonomous-admin-center ISA)

> **Scope note (subsequent milestone).** v1.0 built the machinery — DB-backed tickets + AdminTab, in-app approve→merge, Sentry→ticket ingestion with fingerprint dedup, the `~/dev/autopilot` launchd daemon (sandboxed per-run worktrees, non-LLM push-gate, watchdog, kill switch), codex post-fix review, evidence bundles. The loop is armed-but-idle (kill switch ON, zero real tickets claimed). This research covers ONLY the v2.0 NEW feature surface across the six workstreams (ACT / SEN / QA / RSP / SRC / FEAT). It does not re-litigate the v1.0 foundation.

## Feature Landscape

### Table Stakes (A mature self-healing loop is incomplete without these)

These are the behaviors operators expect from any autonomous-fix system once it is actually ON. Missing them = the loop is either unsafe to run or untrustworthy.

| Feature | Why Expected | Complexity | Notes / Dependency on existing surface |
|---------|--------------|------------|----------------------------------------|
| **Daily fix budget / rate limit** (ACT-02) | Industry-standard circuit breaker. Budget limits enforced at runtime are the #1 named control in every self-healing reference. Raising to 25–30/day is a *tuning* of an existing guard, not a new mechanism. | LOW | `ISC-92` budget already exists (max runs / quiet hours per 5h window). Work = raise the ceiling + add per-window/per-category sub-budgets so one category can't eat the whole budget. |
| **Auto-merge vs human-approval split by blast radius** (ACT-01, ACT-03) | The universal pattern: fully-reversible / low-risk → auto-push; high-impact (migrations, RLS, auth, billing) → human approval. CallVault already has the denylist + PR-divert. | LOW–MED | `ISC-50/54/107` push-gate + denylist already built. Work = turn it on for live tickets and confirm the divert fires under real load. No new mechanism. |
| **Rollback / auto-revert on failed verify** (ACT-03) | Operators will not run an unattended loop without a revert path. "Post-deploy verification failure → `git revert`" is table stakes. | LOW | `ISC-52` auto-revert already built; `ISC-112` SHA-match deploy verify already built. Work = prove it on a live failing ticket (brake drill on real traffic). |
| **Per-run observability in AdminTab** (ACT-04) | Every reference demands "plain-language explanation of what happened and why" per run. Operators expect: status, diff, tests, gate verdict, duration, cost. | MED | Events already write to `ticket_events` (`ISC-35`) + evidence bundles exist. Work = surface them as a per-run AdminTab view (status, diff, test output, gate verdict, duration, cost). Mostly frontend. |
| **Circuit breaker on consecutive failures** (ACT) | "Repeated healing of the same fault signals deeper rework needed" — N consecutive failed verifications must freeze a lane and page. | LOW | `ISC-55` (2 consecutive fails → freeze + page) already built. Verify it survives the volume bump. |
| **Sentry error → debug → fix → verify → resolve lifecycle** (SEN-03/04) | This IS Sentry Seer/Autofix's table-stakes flow: root-cause in ~2 min, fix→PR in ~6 min. Anything less than full-lifecycle is a half-feature. | MED–HIGH | Ingestion + dedup already built (`ISC-16/17`). NEW: route the fingerprinted error through gsd-debug + Honcho into the *same* autopilot fix loop. Dependency: existing dispatcher claim path. |
| **Fingerprint dedup + occurrence counting** (SEN-04) | One error firing 10,000×/min must be ONE ticket with a count, not 10,000 tickets. Non-negotiable for any error-tracker integration. | LOW | Already built (`ISC-17`: same fingerprint twice → one ticket, count 2). Work = "harden" under real Sentry volume (dedup window, fingerprint stability). |
| **Resolution write-back to Sentry** (SEN-05) | If the loop fixes it, Sentry must show resolved on merge/deploy — otherwise the error tracker and the fix loop drift and operators lose trust in both. Sentry's own MCP/API supports resolve-on-commit. | LOW–MED | NEW. Needs Sentry API auth (the one new credential, already flagged in ISA). Write resolved status keyed to the deployed commit SHA. |
| **"Resolve ASAP" cycle-time tracking** (SEN-04) | Operators expect to see error→ticket→fix→resolve elapsed time with a target. This is the metric that proves the loop drives ticket rate down. | LOW | NEW metric on top of existing `ticket_events` timeline. Compute from event timestamps already captured. |
| **Nightly QA covering critical flows** (QA-01) | A nightly smoke across login → connect source → view recording → MCP read/write is the baseline. "Browser + API smoke across critical flows on a schedule." | MED | NEW scheduled run. Reuse existing Interceptor/gsd-browser + dedicated browser profile (`ISC-117`). Schedule via launchd alongside the dispatcher. |
| **QA failure → actionable ticket with repro evidence** (QA-02) | A QA failure must become a ticket with screenshot + console + steps — same evidence contract as user-submitted tickets. Otherwise it's noise. | MED | Reuse existing capture (screenshot/console buffer `ISC-10.1/10.2`) + ticket-insert path. NEW: QA-runner→ticket bridge with `source=nightly-qa`. |
| **Flake suppression / quarantine** (QA-02) | THE make-or-break for nightly QA. Without it, the loop drowns in false tickets and chases ghosts. Industry rule: rerun-confirm (run failing test 2–3×) before filing; quarantine known-flaky with a tracked fix timeline; historical pass-rate threshold (~2% over rolling window). | MED–HIGH | NEW. Must land *with* QA-01, not after. A flaky nightly that files tickets is worse than no nightly. |
| **Reporter status notifications** (RSP-01) | "Acknowledge → progress → resolution" is the canonical 3-stage comms arc. Customers expect to know their ticket was received, is in-progress, and is resolved. | LOW–MED | `user_notifications` table already exists (no UI). NEW: notification triggers on status transitions + in-app surface. In-app only for v1 (Telegram/email deferred per ISA). |
| **Auto-generated resolution summary** (RSP-02) | "A clear summary of the fix and confirmation everything works again" is the close of every good ticket. The agent already produces a fix summary; this surfaces it to the reporter in plain product voice. | LOW–MED | `ISC-53` already posts plain-language resolution + evidence in-thread. NEW = ensure it's reporter-facing (white-label voice, no internals/model names per `ISC-72/120`). |
| **Escalation comms when can't-fix** (RSP-03) | Silence is the cardinal sin. When autopilot escalates, the reporter must get a human-readable status, not a dead ticket. | LOW | `ISC-71` SLA escalation + `ISC-41` clarification loop already exist server-side. NEW = reporter-facing escalation message, not just an admin page. |
| **Accurate per-origin source attribution** (SRC-01) | Logging everything as "submitted by user" is a data-integrity bug. Every ticketing system distinguishes origin (end-user / monitoring / automated-QA / internal) because routing, SLA, metrics, and dedup all key off it. | LOW | `tickets` table already has a `source`/`type` concept (`ISC-16` uses `source=telemetry`). NEW = a clean enum {in-app-user, sentry, nightly-qa, internal/manual} populated correctly at every intake path. Foundational — other workstreams depend on it. |
| **AdminTab filter/group by source** (SRC-02) | Operators need to slice the queue by origin to reason about it. Baseline once attribution exists. | LOW | NEW frontend filter on existing AdminTab. Trivial once `source` is reliable. |

### Differentiators (Where this loop becomes genuinely valuable, not just safe)

Features beyond the table-stakes safety floor that turn a "self-healing demo" into a trust-compounding operation that actually drives ticket rate down.

| Feature | Value Proposition | Complexity | Notes / Dependency |
|---------|-------------------|------------|--------------------|
| **30-day fix-survival as the primary metric** | Most self-healing systems optimize closure speed, which rewards symptom-patching and spirals tech debt. Survival-rate (shipped & not regressed/reopened) makes the *learning engine* rational instead of the patch-mill. This is the single highest-leverage design choice in the ISA. | MED | `ISC-97` already specifies this. v2.0 work = actually compute it from `ticket_events` and inject it into run context (`ISC-103`). Differentiator BECAUSE almost nobody does this. |
| **Canary re-test of every shipped fix within 24h** | "Fix shipped" ≠ "fix held." Auto-re-running the original repro 24h post-deploy catches silent regressions before users do. | MED | `ISC-98` specified. Depends on replayable repro artifacts (`ISC-118`) captured at triage. |
| **Regression attribution → reopen originating ticket** | When a fix regresses, reopening the ORIGINAL ticket (not spawning an orphan) makes the loop self-correcting and keeps survival-rate honest. | MED | `ISC-99` specified. Depends on fix→ticket linkage already in `ticket_events`. |
| **Per-category autonomy ladder** | Trust earned per category (ui-copy / frontend-logic / edge-function / data), with auto-demotion on incident but admin-gated promotion. Lets the loop run hot on safe categories while staying conservative on risky ones. THE mechanism that makes 25–30/day safe. | MED | `ISC-100/101/111` specified (rungs all 0 today). v2.0 work = wire the ladder into claim/push decisions and start promoting categories as cold-run credit accrues. |
| **Recurrence → structural-fix escalation** | 3rd recurrence of the same ticket class auto-escalates to root-cause mode instead of patch #4. Directly drives ticket rate DOWN by killing classes, not instances. | MED | `ISC-102` specified. The clearest expression of the milestone goal (ticket rate down). |
| **Sentry production context in the debug loop** | "Your agent can't fix what it can't see" — feeding Seer-style trace/breadcrumb/user-action context into gsd-debug makes fixes correct, not just plausible. Differentiates a real triage loop from a guess-and-PR bot. | MED | NEW. Pull event context via Sentry API alongside the resolve write-back credential. Enhances SEN-03. |
| **Autonomous feature dev (add/optimize, not just fix)** (FEAT-01) | Extending the proven fix engine to feature work is the leverage multiplier — the hard part (unattended correct coding) is already proven on bugs. Most "AI coding" tools are interactive; an unattended, gated, test-covered feature loop is rare. | HIGH | `ISC-56..67` suggestion-lane is the substrate (rubric → plan → branch → evidence → PR → approval). v2.0 = activate it for add/optimize tasks, NOT just inbound suggestions. Highest-risk workstream — gate hard behind human approval. |
| **Test-generation loop so feature changes ship with coverage** (FEAT-02) | Feature work without generated tests is a regression machine. Auto-adding coverage with each feature change is what makes autonomous feature dev survivable. | HIGH | `ISC-48` (regression test on bug fix) is the seed pattern. Extend to feature diffs. Pairs with canary re-test. |
| **Feature-task intake / queue** (FEAT-03) | A clean way for Andrew to queue a feature and track it through the loop (vs ad-hoc). Turns the loop into a throughput tool, not just a defense. | MED | Reuse `tickets` table with `type=suggestion`/feature + `source=internal`. The intake is mostly an AdminTab affordance + queue semantics already in the dispatcher (`ISC-29` atomic claim). |
| **Per-source metrics (volume, fix rate, cycle time)** (SRC-03) | Once attribution is clean, per-origin dashboards tell Andrew WHERE ticket rate is moving and whether each lane earns its autonomy. Feeds the ladder promotion decision. | LOW–MED | Depends on SRC-01. Compute over `ticket_events` grouped by `source`. |

### Anti-Features (Tempting in an autonomous loop, but they bite)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Auto-merge everything (skip approval to hit throughput)** | 25–30/day feels easier if nothing waits on a human. | The denylist (migrations / RLS / auth / billing) exists because those are the unrecoverable blast radii. Auto-merging them to chase a number is how a self-healing loop becomes a self-harming loop. | Keep blast-radius split. Raise throughput in the SAFE categories via the ladder; route risky diffs to PR. Volume comes from breadth of safe fixes, not from removing the gate. |
| **LLM-judged "is this safe to push?" gate** | Simpler than maintaining a denylist; "just ask the model." | Ticket text is attacker-controlled; an injected agent self-policing its own diff is the same defeated actor. The whole v1.0 security model is *mechanical, agent-uninfluenceable* gates. | Keep the deterministic non-LLM push-gate (`ISC-107`). The model proposes; a script disposes. |
| **File a ticket on every nightly QA failure** | Maximizes coverage, "never miss a regression." | Flaky tests turn this into a ticket firehose that buries real bugs and trains Andrew to ignore the queue. 51% of projects have flaky builds; unfiltered failures are mostly noise. | Rerun-confirm before filing; quarantine known-flaky with a tracked fix timeline; only file on confirmed, reproduced failures. Flake suppression ships WITH nightly QA, not after. |
| **"Resolve ASAP" interpreted as raw closure speed** | Fastest-looking metric; easy to brag about. | Closure-speed goals make symptom-patching rational and spiral tech debt — the loop "wins" by papering over recurring bugs. | Goal metric = 30-day fix-survival + ticket-classes-eliminated (`ISC-97`). Speed is a secondary SLA, never the optimization target. |
| **Email / SMS / push reporter comms in v1** | "Real" support tools notify everywhere. | Multi-channel comms is a maintenance + deliverability + opt-out surface that does not block the core loop. ISA already deferred Telegram + external channels for exactly this reason. | In-app `user_notifications` only for this milestone. Add channels after the in-app loop is trusted. |
| **Auto-shipping autonomous FEATURES without approval** | Feature throughput would skyrocket. | Features are not verified-broken; "correct" is subjective and blast radius is unbounded. The ISA explicitly restricts the auto-ship lane to verified-broken fixes only. | Feature dev always terminates in a human-approval PR (suggestion-lane pattern `ISC-66`). Auto-push stays bug-only, ladder-gated. |
| **Surfacing agent internals / model names / "Telegram" in reporter comms** | Easier to just relay raw agent output. | Breaks the white-label invariant and leaks system internals to customers. | Dynamic-content white-label filter (`ISC-120`) on all reporter-ward messages, not just static strings. |
| **One global kill switch as the only granularity** | Simple: one flag stops everything. | Too coarse — a single bad category shouldn't freeze the whole loop and kill throughput. | Keep the global kill switch (`ISC-37`) AS the manual emergency stop, but add per-category demotion (`ISC-101`) so incidents contain to their own category. |

## Feature Dependencies

```
SRC-01 (accurate source attribution)
    └──enables──> SRC-02 (filter by source)
    └──enables──> SRC-03 (per-source metrics)
    └──enables──> SEN-04 / QA per-origin cycle-time
            (everything that measures "where" depends on clean origin)

ACT-01 (go live: kill switch off)
    └──requires──> ACT-03 (rollback + blast-radius proven on live tickets)
    └──requires──> ACT-04 (per-run observability — can't trust what you can't see)

ACT-02 (25–30/day throughput)
    └──requires──> per-category autonomy ladder (differentiator)
                       └──requires──> ACT-04 observability + per-category metrics

SEN-03 (Sentry auto-debug→fix)
    └──requires──> existing ingestion + dedup (v1.0, done)
    └──feeds-into──> existing autopilot fix loop (dispatcher claim path)
    └──enhanced-by──> Sentry production context in debug loop (differentiator)
SEN-05 (resolve write-back)
    └──requires──> Sentry API credential (the one new external credential)
    └──requires──> ACT (a fix actually merging/deploying to write back from)

QA-01 (nightly run)
    └──requires──> QA-02 (failures → tickets w/ evidence)
            └──requires──> flake suppression  *** must co-ship ***
    └──feeds-into──> QA-03 (autopilot addresses QA tickets = ACT loop)

RSP-01/02/03 (reporter comms)
    └──requires──> SRC-01 (need a real reporter identity per origin to notify)
    └──requires──> existing user_notifications table (exists, no UI)
    └──requires──> existing resolution summary (ISC-53, done server-side)

FEAT-01 (autonomous feature dev)
    └──requires──> suggestion-lane substrate (ISC-56..67, designed)
    └──requires──> FEAT-02 (test-generation) — features without coverage regress
    └──requires──> human-approval PR gate (NEVER auto-ship features)
    └──requires──> FEAT-03 (intake/queue)

Fix-survival (ISC-97) ──governs──> autonomy ladder promotion (ISC-111)
Canary re-test (ISC-98) ──feeds──> regression attribution (ISC-99) ──feeds──> recurrence escalation (ISC-102)
```

### Dependency Notes

- **SRC-01 is foundational and should land early.** Source attribution is a small change but everything that measures or routes by origin (per-source metrics, reporter identity for comms, per-category ladder credit) reads it. Fixing "blanket submitted-by-user" first prevents re-plumbing later workstreams.
- **ACT-04 (observability) gates trust for ACT-01/02.** You cannot responsibly turn the loop on, let alone push it to 25–30/day, without per-run visibility. Observability is the prerequisite, not a nice-to-have.
- **Flake suppression MUST co-ship with QA-01/02.** A nightly QA run that files unverified flaky failures is net-negative — it trains the operator to ignore the queue. Treat "rerun-confirm + quarantine" as part of the QA definition-of-done, not a follow-up.
- **SEN-05 needs the one new external credential (Sentry API).** This is the only genuinely new integration dependency in the milestone; everything else builds on the existing daemon/tickets/capture surface.
- **FEAT must terminate in human approval.** The auto-ship lane is bug-only by ISA decision. Feature dev reuses the suggestion-lane PR+approval path; FEAT-02 test-gen is a hard prerequisite, not optional.
- **The autonomy ladder is the unlock for throughput.** ACT-02's 25–30/day is only safe because per-category trust lets the loop run hot where it's earned credit and stay conservative elsewhere. Throughput and the ladder are one feature, not two.

## MVP Definition

### Launch With (v2.0 core — "turn it on and make it trustworthy")

The smallest set that proves the loop drives ticket rate down on real traffic without an unsafe surface.

- [ ] **ACT-04 per-run observability** — prerequisite for trusting anything live.
- [ ] **ACT-01 go-live (kill switch off) + ACT-03 rollback/blast-radius proven on live tickets** — the actual milestone unlock.
- [ ] **SRC-01 accurate source attribution** — foundational; stop the data-integrity bug before more sources feed in.
- [ ] **SEN-03 Sentry auto-debug→fix + SEN-05 resolve write-back** — first new source; the highest-volume real-traffic input.
- [ ] **RSP-01 reporter status notifications + RSP-02 resolution summary (in-app)** — close the human loop so CX goes up, not just the code.

### Add After Validation (v2.x — once the loop is trusted on bug-fix)

- [ ] **ACT-02 raise to 25–30/day + per-category autonomy ladder** — push throughput once safety is proven on live volume. (Trigger: ≥N clean live auto-pushes with revert bonded.)
- [ ] **QA-01/02/03 nightly QA + flake suppression** — add a second autonomous source once the fix loop holds. (Trigger: bug-lane survival-rate stable.)
- [ ] **SRC-02/03 source filtering + per-source metrics** — operator dashboards once attribution is clean and multi-source.
- [ ] **RSP-03 escalation comms** — reporter-facing escalation once the can't-fix path is exercised on real tickets.
- [ ] **Fix-survival metric + canary re-test + regression attribution + recurrence escalation** — the self-correcting learning engine; turn on as soon as there are enough shipped fixes to measure.

### Future Consideration (defer until the loop is boringly reliable)

- [ ] **FEAT-01/02/03 autonomous feature dev** — highest risk, highest leverage. Defer until bug-fix + Sentry + QA are all trusted and the suggestion-lane substrate is exercised. (Why defer: "correct" is unbounded for features; needs test-gen maturity and a proven approval gate first.)
- [ ] **Recurrence→structural-fix escalation at scale** — needs a history of recurring classes to act on.
- [ ] **Multi-channel reporter comms (email/Telegram/push)** — explicitly deferred by ISA; revisit after in-app comms are trusted.

## Feature Prioritization Matrix

| Feature | User/Operator Value | Implementation Cost | Priority |
|---------|---------------------|---------------------|----------|
| ACT-04 per-run observability | HIGH | MEDIUM | P1 |
| ACT-01 go-live + ACT-03 rollback proven | HIGH | LOW (mechanisms exist) | P1 |
| SRC-01 accurate source attribution | HIGH | LOW | P1 |
| SEN-03 Sentry auto-debug→fix | HIGH | MEDIUM–HIGH | P1 |
| SEN-05 resolve write-back | MEDIUM | LOW–MED (new credential) | P1 |
| RSP-01 reporter status notifications | HIGH | LOW–MED | P1 |
| RSP-02 resolution summary | HIGH | LOW–MED | P1 |
| ACT-02 25–30/day + autonomy ladder | HIGH | MEDIUM | P2 |
| QA-01/02 nightly QA + flake suppression | HIGH | MEDIUM–HIGH | P2 |
| QA-03 autopilot addresses QA tickets | MEDIUM | LOW (reuses ACT loop) | P2 |
| Fix-survival + canary + regression attribution | HIGH | MEDIUM | P2 |
| SRC-02/03 source filter + metrics | MEDIUM | LOW–MED | P2 |
| RSP-03 escalation comms | MEDIUM | LOW | P2 |
| SEN-04 cycle-time / dedup hardening | MEDIUM | LOW | P2 |
| Recurrence→structural escalation | HIGH (kills ticket classes) | MEDIUM | P2 |
| FEAT-01 autonomous feature dev | HIGH | HIGH | P3 |
| FEAT-02 test-generation loop | HIGH | HIGH | P3 |
| FEAT-03 feature-task intake | MEDIUM | MEDIUM | P3 |

**Priority key:** P1 = must-have to call the loop "on and trustworthy" · P2 = add once bug-fix loop is proven on live traffic · P3 = defer until reliability is boring.

## Competitor / Reference Feature Analysis

| Capability | Sentry Seer / Autofix | Generic self-healing CI (Semaphore/CodeRabbit pattern) | Support-tool comms (Zendesk/DevRev) | CallVault v2.0 approach |
|-----------|------------------------|--------------------------------------------------------|--------------------------------------|--------------------------|
| Error→fix lifecycle | Root-cause ~2min, fix→PR ~6min; opens PR for review | PR + AI review, human merge on risk | n/a | gsd-debug + Honcho through existing autopilot loop; auto-push safe categories, PR for risky |
| Resolution write-back | Resolve-on-commit via MCP/API | n/a | Auto-status on close | Write resolved to Sentry keyed to deployed SHA (SEN-05) |
| Auto-merge vs approval | Always human-reviews the PR | Phased autonomy L1–L4; high-risk = human gate | n/a | Mechanical blast-radius denylist; ladder-gated auto-push, PR-divert for denylist |
| Flake handling | n/a | Rerun-confirm + quarantine + ~2% historical threshold | n/a | Rerun-confirm before filing + quarantine w/ tracked fix timeline (co-ships with QA) |
| Reporter comms | n/a | Plain-language per-action explanation | Acknowledge→progress→resolution arc | In-app status + auto resolution summary in white-label voice; escalation-not-silence |
| Source attribution | Telemetry-tagged | n/a | Origin/channel on every ticket | Enum {in-app-user, sentry, nightly-qa, internal} populated at every intake path |
| Primary metric | Fix accepted | Recovery confirmed; healing frequency watched | CSAT / resolution time | 30-day fix-survival + ticket-classes-eliminated (not closure speed) |

## Sources

- [Sentry — AI-powered Autofix debugs & fixes your code in minutes](https://blog.sentry.io/ai-powered-autofix-debugs-and-fixes-your-code-in-minutes/)
- [Sentry — Your agent can't fix what it can't see (production context)](https://blog.sentry.io/agents-need-production-context/)
- [TechCrunch — Sentry's AI-powered Autofix](https://techcrunch.com/2024/03/20/sentrys-ai-powered-autofix-helps-developers-quickly-debug-and-fix-their-production-code/)
- [getsentry/sentry-for-ai — teach your AI assistant to use Sentry](https://github.com/getsentry/sentry-for-ai)
- [Semaphore — AI-Driven CI: Exploring Self-healing Pipelines](https://semaphore.io/blog/self-healing-ci)
- [Impala Intech — Self-Healing Software Systems (phased autonomy L1–L4)](https://impalaintech.com/blog/self-healing-software-systems/)
- [CloudServ — Autonomous Cloud Pipelines / self-healing as standard](https://cloudserv.ai/autonomous-cloud-pipelines-how-self-healing-systems-are-becoming-standard-in-2025/)
- [Slack Engineering — Handling Flaky Tests at Scale: Auto Detection & Suppression](https://slack.engineering/handling-flaky-tests-at-scale-auto-detection-suppression/)
- [minware — Flaky Test Quarantine best practices](https://www.minware.com/guide/best-practices/flaky-test-quarantine)
- [TestDino — Flaky Tests: Complete Guide to Detection & Prevention](https://testdino.com/blog/flaky-tests)
- [DevRev — Ticket Handling Best Practices: Automating L1](https://devrev.ai/blog/ticket-handling-best-practices)
- [Help Scout — Ticket Handling Best Practices](https://www.helpscout.com/blog/ticket-handling-best-practices/)
- [Zendesk — Ticket escalation process](https://www.zendesk.com/blog/customer-service/ticketing-system/ticketing-system/art-ticket-escalation-process/)
- Internal: `~/.claude/PAI/MEMORY/WORK/20260610-autonomous-admin-center/ISA.md` (existing autopilot surface, ISC-1..120) — HIGH confidence, authoritative for current-state.
- Internal: `.planning/PROJECT.md` (v2.0 workstreams ACT/SEN/QA/RSP/SRC/FEAT).

---
*Feature research for: autonomous software-ops loop (self-healing) — CallVault v2.0*
*Researched: 2026-06-12*
